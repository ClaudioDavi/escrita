// The Obsidian shell of the index hub: one vault.on each for modify, delete,
// rename and create, plus metadataCache changed and resolved, all registered
// through the plugin. The logic lives in core/index-hub.ts.

import { TFile, type TAbstractFile } from "obsidian";
import type EscritaPlugin from "../main";
import type { VaultIndexes } from "../main";
import { IndexHub } from "./index-hub";
import { snapshotsRoot } from "./classify";
import { macrotaskYield, type Follower, IndexFile, IndexSource, IndexSpec, IndexTimers, VaultIndex } from "./vault-index";

export class VaultIndexesShell implements VaultIndexes {
  private hub: IndexHub<TFile>;

  constructor(plugin: EscritaPlugin) {
    const { vault, metadataCache, workspace } = plugin.app;
    const source: IndexSource<TFile> = {
      files: () => vault.getFiles(),
      file: (path) => {
        const f = vault.getAbstractFileByPath(path);
        return f instanceof TFile ? f : null;
      },
      read: (f) => vault.cachedRead(f),
    };
    const timers: IndexTimers = {
      set: (cb, ms) => window.setTimeout(cb, ms),
      clear: (h) => window.clearTimeout(h as number),
      yieldNow: macrotaskYield,
      now: () => performance.now(),
    };
    const subs = {
      // Create, delete and rename also carry folders (the hub reads only their path), so
      // these hold the hub's callbacks under the vault's real event type.
      create: [] as ((f: TAbstractFile) => void)[],
      modify: [] as ((f: TFile) => void)[],
      delete: [] as ((f: TAbstractFile) => void)[],
      rename: [] as ((f: TAbstractFile, old: string) => void)[],
      meta: [] as ((f: TFile) => void)[],
      resolved: [] as (() => void)[],
    };
    this.hub = new IndexHub<TFile>(
      {
        onCreate: (cb) => void subs.create.push(cb as unknown as (typeof subs.create)[number]),
        onModify: (cb) => void subs.modify.push(cb),
        onDelete: (cb) => void subs.delete.push(cb as unknown as (typeof subs.delete)[number]),
        onRename: (cb) => void subs.rename.push(cb as unknown as (typeof subs.rename)[number]),
        onMetaChanged: (cb) => void subs.meta.push(cb),
        onResolved: (cb) => void subs.resolved.push(cb),
        onLayoutReady: (cb) => workspace.onLayoutReady(cb),
        layoutReady: () => workspace.layoutReady,
        hasCache: (f) => metadataCache.getFileCache(f) !== null,
      },
      source,
      timers,
      {
        snapshotsRoot: () => snapshotsRoot(plugin.settings.snapshotsFolder),
        onError: (path, e) => console.error(`Escrita: the vault index failed on ${path || "a callback"}`, e),
      },
    );
    plugin.registerEvent(vault.on("modify", (f) => { if (f instanceof TFile) subs.modify.forEach((c) => c(f)); }));
    plugin.registerEvent(vault.on("delete", (f) => subs.delete.forEach((c) => c(f))));
    plugin.registerEvent(vault.on("rename", (f, old) => subs.rename.forEach((c) => c(f, old))));
    plugin.registerEvent(vault.on("create", (f) => subs.create.forEach((c) => c(f))));
    plugin.registerEvent(metadataCache.on("changed", (f) => subs.meta.forEach((c) => c(f))));
    plugin.registerEvent(metadataCache.on("resolved", () => subs.resolved.forEach((c) => c())));
  }

  add<F extends IndexFile, V>(spec: IndexSpec<F, V>): VaultIndex<F, V> {
    return this.hub.add(spec as unknown as IndexSpec<TFile, V>) as unknown as VaultIndex<F, V>;
  }
  remove<F extends IndexFile, V>(index: VaultIndex<F, V>): void { this.hub.remove(index as unknown as VaultIndex<TFile, V>); }
  follow(f: Follower): () => void { return this.hub.follow(f); }
  rebuild(name?: string): void { this.hub.rebuild(name); }
  settingsChanged(): void { this.hub.settingsChanged(); }
  unload(): void { this.hub.unload(); }
}
