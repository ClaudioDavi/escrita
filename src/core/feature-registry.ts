// Loads and unloads the switchable features (0.7 plan Q6, Q12). It owns one
// ModuleContext per module and decides what runs from the writer's switches.
// Modules are constructed once; they are not children of the plugin, so the
// registry controls the order of load (FEATURE_IDS) and unload (reverse).

import type EscritaPlugin from "../main";
import { FEATURE_IDS, planApply, wanted, type FeatureId, type FeatureSwitches } from "./features";
import type { EscritaSettings } from "../settings";
import type { FeatureModule } from "./module-context";
import { ModuleContextImpl, ModuleSlots } from "./module-context";

type FeatureSettings = Pick<EscritaSettings, "features" | "explorerCounts" | "spellcheckOnDemand" | "universeMode">;

/** The writer's switches as the registry reads them (the same record `wanted` takes). */
export function switchesOf(s: FeatureSettings): FeatureSwitches {
  return { features: s.features, explorerCounts: s.explorerCounts, spellcheckOnDemand: s.spellcheckOnDemand, universeMode: s.universeMode };
}

/** Past this many passes a feature that keeps re-triggering apply() is cut off. */
const MAX_PASSES = 10;

interface Entry {
  id: FeatureId;
  module: FeatureModule;
  ctx: ModuleContextImpl;
  slots: ModuleSlots;
}

export class FeatureRegistry {
  private entries: Entry[] = [];
  private loaded = new Set<FeatureId>();
  private listeners = new Set<(id: FeatureId, on: boolean) => void>();
  private applying = false;
  private again = false;
  private closed = false;
  private slotsDirty = false;
  private layoutHooked = false;

  constructor(private plugin: EscritaPlugin, modules: ReadonlyMap<FeatureId, FeatureModule>) {
    for (const id of FEATURE_IDS) {
      const module = modules.get(id);
      if (!module) continue;
      const slots = new ModuleSlots(plugin, module.slots, () => { this.slotsDirty = true; });
      this.entries.push({ id, module, ctx: new ModuleContextImpl(plugin, slots), slots });
    }
  }

  /** At plugin load: view, extension and code block slots; data followers of every module. */
  init(): void {
    for (const e of this.entries) {
      e.slots.register();
      for (const f of e.module.dataFollowers?.() ?? []) this.plugin.index.follow(f);
    }
  }

  /** Synchronous; a re-entrant call re-runs once at the end (Q12). */
  apply(): void {
    if (this.closed) return;
    if (this.applying) {
      this.again = true;
      return;
    }
    this.applying = true;
    let changes: [FeatureId, boolean][] = [];
    try {
      this.slotsDirty = false;
      let passes = 0;
      do {
        this.again = false;
        changes.push(...this.applyOnce());
      } while (this.again && !this.closed && ++passes < MAX_PASSES);
      if (this.slotsDirty) this.plugin.app.workspace.updateOptions();
      this.slotsDirty = false;
      this.hookLayoutReady();
    } finally {
      this.applying = false;
    }
    // After updateOptions, and after `applying` is off, so a listener may call apply() again.
    for (const [id, on] of changes) {
      for (const cb of [...this.listeners]) {
        try { cb(id, on); } catch (err) { console.error("Escrita: a feature listener failed", err); }
      }
    }
  }

  isOn(id: FeatureId): boolean {
    return this.loaded.has(id);
  }

  /** The module when loaded. */
  get<T>(id: FeatureId): T | undefined {
    if (!this.loaded.has(id)) return undefined;
    return this.entry(id)?.module as T | undefined;
  }

  onChange(cb: (id: FeatureId, on: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /** Fans out to loaded modules only. */
  settingsChanged(): void {
    for (const e of this.entries) {
      if (!this.loaded.has(e.id)) continue;
      try { e.module.settingsChanged?.(); } catch (err) { console.error(`Escrita: ${e.id} failed on a settings change`, err); }
    }
  }

  /** First thing plugin.onunload does; idempotent. Leaves are not detached (the plugin is going away). */
  unloadAll(): void {
    this.closed = true;
    for (const id of planApply(this.loaded, new Set()).unload) this.unloadOne(id, false);
  }

  // ------------------------------------------------------------ internals

  private switches(): FeatureSwitches {
    return switchesOf(this.plugin.settings);
  }

  private want(): Set<FeatureId> {
    return wanted(this.switches());
  }

  /** One pass; the changes are fired by apply(), after updateOptions. */
  private applyOnce(): [FeatureId, boolean][] {
    const plan = planApply(this.loaded, this.want());
    const changes: [FeatureId, boolean][] = [];
    for (const id of plan.unload) {
      this.unloadOne(id, true);
      changes.push([id, false]);
    }
    for (const id of plan.load) {
      if (this.loadOne(id)) changes.push([id, true]);
    }
    return changes;
  }

  private entry(id: FeatureId): Entry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  private loadOne(id: FeatureId): boolean {
    const e = this.entry(id);
    if (!e) return false;
    e.ctx.begin();
    try {
      e.module.attach(e.ctx);
      e.module.load();
    } catch (err) {
      console.error(`Escrita: ${id} failed to load`, err);
      this.stop(e);
      return false;
    }
    this.loaded.add(id);
    return true;
  }

  private unloadOne(id: FeatureId, detachLeaves: boolean): void {
    const e = this.entry(id);
    this.loaded.delete(id);
    if (!e) return;
    // Unregistering a view leaves ghost panes (G0b), so a switched-off feature closes its own leaves.
    // Before stop(): a view's onClose runs now, while the module is still whole.
    if (detachLeaves) {
      for (const type of e.slots.viewTypes) this.plugin.app.workspace.detachLeavesOfType(type);
    }
    this.stop(e);
  }

  private stop(e: Entry): void {
    try {
      e.module.unload();
    } catch (err) {
      console.error(`Escrita: ${e.id} failed to unload`, err);
    }
    e.ctx.end(!this.closed);   // the plugin going away skips afterUnload callbacks
  }

  /** A leaf restored from the saved layout can belong to a feature that is off; close it once the layout is ready. */
  private hookLayoutReady(): void {
    if (this.layoutHooked) return;
    this.layoutHooked = true;
    this.plugin.app.workspace.onLayoutReady(() => {
      if (this.closed) return;
      for (const e of this.entries) {
        if (this.loaded.has(e.id)) continue;
        for (const type of e.slots.viewTypes) this.plugin.app.workspace.detachLeavesOfType(type);
      }
    });
  }
}
