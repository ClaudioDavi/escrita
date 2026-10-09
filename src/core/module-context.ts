// What a module registers on the plugin, and the base class of a switchable
// feature (0.7 plan Q1-Q7). The context is the one place, with main.ts and the
// two core services that already do, that calls the Plugin-only registration
// methods; it records an undo for each and runs them on unload.

import { Component, ItemView, Notice, type App, type Command, type TextAreaComponent, type TextComponent, type MarkdownPostProcessor, type MarkdownPostProcessorContext, type ViewCreator, type WorkspaceLeaf } from "obsidian";
import type { Extension } from "@codemirror/state";
import type EscritaPlugin from "../main";
import type { EscritaSettings } from "../settings";
import { t } from "../i18n";
import type { FeatureId } from "./features";
import type { Follower, IndexFile, IndexSpec, VaultIndex } from "./vault-index";
import type { DecorationId, Drawer } from "./explorer-decorations";

/** A code block processor: what `registerMarkdownCodeBlockProcessor` takes. */
export type CodeBlockHandler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void | Promise<void>;

/** What a module registers on the plugin for its whole life, read in init() even when it is off (Q3). */
export interface FeatureSlots {
  views?: readonly string[];          // view types
  codeBlocks?: readonly string[];     // code block languages
  postProcessor?: boolean;            // one Reading-view post-processor (Q34)
  editors?: number;                   // how many extension slots
}

/** The module calls updateOptions after a mid-session set. */
export interface EditorSlot { set(exts: readonly Extension[]): void }

export interface ModuleContext {
  command(cmd: Command): void;                                   // raw id recorded before addCommand; removed on unload (Q2, G0a)
  /** G0f: null (nothing added) when the feature is off at startup; turned off at runtime, the icon stays until restart and its click shows that the feature is off. */
  ribbon(icon: string, title: string, cb: (e: MouseEvent) => void): HTMLElement | null;
  statusBar(): HTMLElement;                                      // el.remove() on unload; on mobile the element is detached (obsidian.d.ts:4941-4947)
  view(type: string, create: ViewCreator): void;                 // binds a declared slot (Q3); throws for an undeclared type; leaves detached on unload
  editor(initial?: readonly Extension[]): EditorSlot;            // takes the next declared slot (Q4); emptied on unload
  codeBlock(lang: string, handler: CodeBlockHandler): void;      // binds a declared slot (Q5)
  postProcessor(fn: MarkdownPostProcessor): void;                // binds the declared slot (Q5, Q34); a no-op while off
  index<F extends IndexFile, V>(spec: IndexSpec<F, V>): VaultIndex<F, V>;  // disposed and removed on unload (Q7)
  follow(f: Follower): void;                                     // removed on unload
  decorate(id: DecorationId, draw: Drawer): void;                // undrawn on unload
  onLayoutReady(cb: () => void): void;                           // never runs after unload
  /**
   * Runs once after this feature has unloaded: after `onunload`, after every undo of the
   * context and after its view, code block, post-processor and editor slots are unbound.
   * For work that must see the feature as gone, such as the desk re-drawing the blocks
   * that were showing its content (they now render as plain source). Never survives the
   * load it was registered in; register it again on each load. Not run when the plugin itself
   * unloads (unloadAll). A throw is logged.
   */
  afterUnload(cb: () => void): void;
}

/**
 * What the settings tab hands a module's `settingsSection` (IMPROVEMENTS 11).
 */
export interface SettingsUi {
  app: App;
  /**
   * Saves the settings now: data.json, then features.apply() and every module's
   * settingsChanged (main.ts saveSettings). For toggles, dropdowns and buttons.
   */
  save(): Promise<void>;
  /**
   * Wires a text field to save when the writer commits it (blur or Enter: the
   * `change` event), not at every key, so typing a folder name doesn't reload
   * features per letter. The value is trimmed; blank becomes `fallback()`; the
   * field then shows what was kept, `apply(v)` stores it, and the settings save.
   */
  saveOnCommit(c: TextComponent | TextAreaComponent, fallback: () => string, apply: (v: string) => void): void;
  /**
   * The default set of the install's language (`defaultsFor(settings.defaultsLanguage)`, 1.0):
   * what a cleared field falls back to and what a placeholder shows. Never DEFAULT_SETTINGS
   * for a word-bearing setting: that is the English set, wrong in a pt-BR install.
   */
  defaults(): EscritaSettings;
  /** Draws the whole tab again (after a change that shows or hides rows). */
  redraw(): void;
  /** A number typed in a field: its digits, at least `min` (default 0); `fallback` when blank or not a number. */
  num(v: string, fallback: number, min?: number): number;
}

/**
 * A switchable part of Escrita. Constructed once; the registry calls Component.load()
 * and unload() itself, in order (Q6). Subclasses implement onload/onunload, never
 * load/unload.
 */
export abstract class FeatureModule extends Component {
  abstract readonly id: FeatureId;
  readonly slots: FeatureSlots = {};
  protected ctx!: ModuleContext;

  /** Called by the registry before each load. */
  attach(ctx: ModuleContext): void {
    this.ctx = ctx;
  }

  settingsChanged?(): void;

  /** Followers that keep this feature's path-keyed data current even while it is off (Q8). Touch only plugin.data and plugin.settings. */
  dataFollowers?(): Follower[];

  /**
   * Draws this module's rows of the settings tab into `el` (IMPROVEMENTS 11), with
   * its own heading, except in a slot with shared rows (core/settings-order.ts `also`:
   * placeholders, editor, universe), where the core draws the heading and those rows.
   * Called only while the feature is loaded, in the tab's one order list (PLAN-0.8
   * Q13), so an off feature's section is gone with it.
   */
  settingsSection?(el: HTMLElement, ui: SettingsUi): void;

  /**
   * What the Features page says when the writer turns this feature off and it
   * keeps data ("12 snapshots stay in Escrita/Snapshots"), or null to say nothing.
   * Called after the switch is saved, so the feature has already unloaded: read
   * only what stays (plugin.data, settings, the vault), never this module's live
   * state. Returns translated text.
   */
  offNotice?(): Promise<string | null>;
}

/**
 * A part of Escrita that is not one of the 19 features and never switches off (1.0: the
 * setup, "Set up a writing vault"). It has no `FeatureId`, so it is not on the Features
 * page, in a preset or in `settings.features`, and the registry never sees it.
 *
 * The seam (PLAN-1.0 0.1, ARCHITECTURE.md "Core modules"): main.ts constructs it after
 * the registry has applied the switches and hands it to `startCoreModule`, which gives it
 * its own `ModuleContext` (the same door every feature registers through, rule 8) and
 * adds it as a child of the plugin, so it loads once now and unloads with the plugin.
 * Subclasses implement `onload`/`onunload` and register only through `this.ctx`.
 * A core module declares no slots: `ctx.view`, `ctx.editor`, `ctx.codeBlock` and
 * `ctx.postProcessor` throw for it. One that ever needs a view gets `ModuleSlots`
 * registered at plugin load, as the registry does, in a deliberate change to this seam.
 * It reads other features only as soft dependencies (`plugin.features.isOn`).
 */
export abstract class CoreModule extends Component {
  protected ctx!: ModuleContext;

  /** Called once by `startCoreModule`, before load. */
  attach(ctx: ModuleContext): void {
    this.ctx = ctx;
  }
}

/**
 * Loads a core module for the plugin's life (main.ts, once per module, at the end of
 * onload). The context is begun before the module loads; the plugin's unload unloads the
 * module (a child) and then ends the context without its afterUnload callbacks, as
 * `FeatureRegistry.unloadAll` does for the features.
 */
export function startCoreModule(plugin: EscritaPlugin, module: CoreModule): void {
  const ctx = new ModuleContextImpl(plugin);
  ctx.begin();
  module.attach(ctx);
  plugin.register(() => ctx.end(false));
  plugin.addChild(module);
}

/** What a restored leaf of an off feature's view type shows until the layout is ready and it is detached (Q3). */
class PlaceholderView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private readonly type: string) { super(leaf); }
  getViewType(): string { return this.type; }
  getDisplayText(): string { return "Escrita"; }
}

/**
 * The slots one module declared: views, code blocks, a post-processor and editor
 * extension arrays. Each is registered on the plugin once, at plugin load, whether
 * the feature is on or not; the module only binds and unbinds what they call (Q3-Q5).
 */
export class ModuleSlots {
  private views = new Map<string, ViewCreator | null>();
  private blocks = new Map<string, CodeBlockHandler | null>();
  private post: MarkdownPostProcessor | null = null;
  private editors: Extension[][] = [];
  private nextEditor = 0;
  /** bumps on every release, so an EditorSlot handle outlives only the load it came from */
  private epoch = 0;
  private registered = false;

  /** `changed` is called when an editor slot's contents change. */
  constructor(private plugin: EscritaPlugin, readonly declared: FeatureSlots, private changed: () => void) {}

  /** Registers every declared slot on the plugin; a second call does nothing. */
  register(): void {
    if (this.registered) return;
    this.registered = true;
    const p = this.plugin;
    for (const type of this.declared.views ?? []) {
      this.views.set(type, null);
      p.registerView(type, (leaf) => {
        const create = this.views.get(type);
        return create ? create(leaf) : new PlaceholderView(leaf, type);
      });
    }
    for (const lang of this.declared.codeBlocks ?? []) {
      this.blocks.set(lang, null);
      p.registerMarkdownCodeBlockProcessor(lang, (source, el, ctx) => {
        const handler = this.blocks.get(lang);
        if (handler) return handler(source, el, ctx);
        // off: plain source, the way Obsidian shows an unknown language
        el.createEl("pre").createEl("code", { text: source });
      });
    }
    if (this.declared.postProcessor) {
      p.registerMarkdownPostProcessor((el, ctx) => { void this.post?.(el, ctx); });
    }
    for (let i = 0; i < (this.declared.editors ?? 0); i++) {
      const arr: Extension[] = [];
      this.editors.push(arr);
      p.registerEditorExtension(arr);
    }
  }

  bindView(type: string, create: ViewCreator): () => void {
    if (!this.views.has(type)) throw new Error(`Escrita: view type "${type}" was not declared in slots.views`);
    this.views.set(type, create);
    return () => { this.views.set(type, null); };
  }

  bindCodeBlock(lang: string, handler: CodeBlockHandler): () => void {
    if (!this.blocks.has(lang)) throw new Error(`Escrita: code block "${lang}" was not declared in slots.codeBlocks`);
    this.blocks.set(lang, handler);
    return () => { this.blocks.set(lang, null); };
  }

  bindPostProcessor(fn: MarkdownPostProcessor): () => void {
    if (!this.declared.postProcessor) throw new Error("Escrita: the post-processor was not declared in slots.postProcessor");
    this.post = fn;
    return () => { this.post = null; };
  }

  /** The module's next declared array; `set` replaces its contents. */
  takeEditor(initial?: readonly Extension[]): EditorSlot {
    const arr = this.editors[this.nextEditor++];
    if (!arr) throw new Error("Escrita: more editor slots taken than declared in slots.editors");
    const epoch = this.epoch;
    const set = (exts: readonly Extension[]): void => {
      if (epoch !== this.epoch) return;   // a handle from an earlier load is dead
      arr.splice(0, arr.length, ...exts);
      this.changed();
    };
    if (initial && initial.length > 0) set(initial);
    return { set };
  }

  /** Unload: empties every editor array and lets the next load take them from the first. */
  releaseEditors(): void {
    this.nextEditor = 0;
    this.epoch++;
    let any = false;
    for (const arr of this.editors) {
      if (arr.length > 0) any = true;
      arr.length = 0;
    }
    if (any) this.changed();
  }

  /** The declared view types (the registry detaches their leaves when a feature is switched off). */
  get viewTypes(): readonly string[] { return this.declared.views ?? []; }
}

/**
 * The context of one module, reused across its loads and owned by the registry.
 * `begin()` before each load, `end()` on unload: it runs every recorded undo in
 * reverse. Commands, ribbon icons, the status bar, views, editor slots, code
 * blocks, indexes, followers and decorations all go through here.
 */
export class ModuleContextImpl implements ModuleContext {
  private disposers: (() => void)[] = [];
  private active = false;
  private generation = 0;
  private afterEnd: (() => void)[] = [];
  /** G0f: a ribbon icon can't be removed, so it is kept by title for the plugin's life */
  private ribbons = new Map<string, { el: HTMLElement; cb: ((e: MouseEvent) => void) | null }>();

  constructor(private plugin: EscritaPlugin, private slots: ModuleSlots | null = null) {}

  /** Before each load. */
  begin(): void {
    this.active = true;
    this.generation++;
  }

  /**
   * On unload: undoes everything registered since `begin()`. Safe to call twice.
   * `runAfter` false (the plugin itself unloading) drops the afterUnload callbacks unrun.
   */
  end(runAfter = true): void {
    this.active = false;
    this.generation++;
    const run = this.disposers.splice(0).reverse();
    for (const undo of run) {
      try { undo(); } catch (e) { console.error("Escrita: a feature's undo failed", e); }
    }
    this.slots?.releaseEditors();
    for (const r of this.ribbons.values()) r.cb = null;
    const after = this.afterEnd.splice(0);
    if (!runAfter) return;
    for (const cb of after) {
      try { cb(); } catch (e) { console.error("Escrita: an afterUnload callback failed", e); }
    }
  }

  command(cmd: Command): void {
    const raw = cmd.id;               // addCommand rewrites id to `escrita:<id>` on the object it gets (G0a)
    this.plugin.addCommand({ ...cmd });
    this.disposers.push(() => this.plugin.removeCommand(raw));
  }

  ribbon(icon: string, title: string, cb: (e: MouseEvent) => void): HTMLElement | null {
    if (!this.active) return null;
    const known = this.ribbons.get(title);
    if (known) {
      known.cb = cb;
      return known.el;
    }
    const entry: { el: HTMLElement; cb: ((e: MouseEvent) => void) | null } = { el: null as unknown as HTMLElement, cb };
    entry.el = this.plugin.addRibbonIcon(icon, title, (e) => {
      if (entry.cb) entry.cb(e);
      else new Notice(t("features.offNotice"));
    });
    this.ribbons.set(title, entry);
    return entry.el;
  }

  statusBar(): HTMLElement {
    const el = this.plugin.addStatusBarItem();
    this.disposers.push(() => el.remove());
    return el;
  }

  view(type: string, create: ViewCreator): void {
    if (!this.slots) throw new Error(`Escrita: view type "${type}" was not declared in slots.views`);
    this.disposers.push(this.slots.bindView(type, create));
  }

  editor(initial?: readonly Extension[]): EditorSlot {
    if (!this.slots) throw new Error("Escrita: more editor slots taken than declared in slots.editors");
    return this.slots.takeEditor(initial);
  }

  codeBlock(lang: string, handler: CodeBlockHandler): void {
    if (!this.slots) throw new Error(`Escrita: code block "${lang}" was not declared in slots.codeBlocks`);
    this.disposers.push(this.slots.bindCodeBlock(lang, handler));
  }

  postProcessor(fn: MarkdownPostProcessor): void {
    if (!this.slots) throw new Error("Escrita: the post-processor was not declared in slots.postProcessor");
    this.disposers.push(this.slots.bindPostProcessor(fn));
  }

  index<F extends IndexFile, V>(spec: IndexSpec<F, V>): VaultIndex<F, V> {
    const index = this.plugin.index.add(spec);
    this.disposers.push(() => this.plugin.index.remove(index));
    return index;
  }

  follow(f: Follower): void {
    this.disposers.push(this.plugin.index.follow(f));
  }

  decorate(id: DecorationId, draw: Drawer): void {
    this.disposers.push(this.plugin.decorations.add(id, draw));
  }

  afterUnload(cb: () => void): void {
    this.afterEnd.push(cb);
  }

  onLayoutReady(cb: () => void): void {
    const gen = this.generation;
    this.plugin.app.workspace.onLayoutReady(() => {
      if (this.active && this.generation === gen) cb();
    });
  }
}
