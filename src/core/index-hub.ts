// The index hub (no Obsidian imports): owns every VaultIndex, feeds them vault
// events through one event source, and calls the followers after the indexes.
// The thin Obsidian shell is core/vault-indexes.ts. Pure, tested on MemoryVault.

import { inFolder } from "./classify";
import { isUnder, movedPath } from "./path-keys";
import {
  VaultIndex,
  type Follower,
  type IndexFile,
  type IndexSource,
  type IndexSpec,
  type IndexTimers,
} from "./vault-index";

/** Where vault and metadata events come from. Folders arrive as files with a path. */
export interface HubEvents<F extends IndexFile = IndexFile> {
  onCreate(cb: (f: F) => void): void;
  onModify(cb: (f: F) => void): void;
  onDelete(cb: (f: F) => void): void;
  onRename(cb: (f: F, oldPath: string) => void): void;
  onMetaChanged(cb: (f: F) => void): void;
  onResolved(cb: () => void): void;
  onLayoutReady(cb: () => void): void;
  layoutReady(): boolean;
  hasCache(f: F): boolean;
}

export interface IndexHubOptions {
  /** the snapshots folder, as a vault path */
  snapshotsRoot(): string;
  onError?: (path: string, error: unknown) => void;
  /** quiet time before a settings change rebuilds (default 500 ms) */
  settingsMs?: number;
  /** how long a metadata build waits for `resolved` (default 5000 ms) */
  fallbackMs?: number;
  /** passed to every index; a spec's own `settleMs` wins (IndexSpec.settleMs) */
  settleMs?: number;
  batch?: number;
}

interface Entry<F extends IndexFile> {
  spec: IndexSpec<F, unknown>;
  index: VaultIndex<F, unknown>;
  /** a build was started: events reach the index from then on */
  started: boolean;
  /** a `start: "demand"` spec: its index asked to build */
  demanded: boolean;
  key: string;
  fallback: unknown;
}

/** How long a folder event hides the per-child events that may follow it. */
const ECHO_MS = 1000;

export class IndexHub<F extends IndexFile = IndexFile> {
  private entries: Entry<F>[] = [];
  private followers = new Set<Follower>();
  private resolvedSeen = false;
  private settingsTimer: unknown = null;
  private echoes: { old: string; next: string | null; timer: unknown }[] = [];
  private unloaded = false;
  private readonly settingsMs: number;
  private readonly fallbackMs: number;

  constructor(
    private events: HubEvents<F>,
    private source: IndexSource<F>,
    private timers: IndexTimers,
    private opts: IndexHubOptions,
  ) {
    this.settingsMs = opts.settingsMs ?? 500;
    this.fallbackMs = opts.fallbackMs ?? 5000;
    events.onLayoutReady(() => this.layoutReady());
    events.onCreate((f) => this.created(f));
    events.onModify((f) => this.each((e) => e.index.modified(f)));
    events.onMetaChanged((f) => this.each((e) => e.index.metadataChanged(f)));
    events.onDelete((f) => this.deleted(f.path));
    events.onRename((f, old) => this.renamed(old, f.path));
    events.onResolved(() => this.resolved());
  }

  // ------------------------------------------------------------ public

  /**
   * Adds an index and starts it when the layout is ready. A `start: "demand"` spec
   * waits for its index's `demand()` instead. Builds and flushes run on `yieldBudget`.
   */
  add<V>(spec: IndexSpec<F, V>): VaultIndex<F, V> {
    const index = new VaultIndex<F, V>(spec, this.source, this.timers, {
      settleMs: this.opts.settleMs,
      batch: this.opts.batch,
      onError: this.opts.onError,
      onDemand: () => this.demand(entry),
    });
    const entry: Entry<F> = {
      spec: spec,
      index: index as VaultIndex<F, unknown>,
      started: false,
      demanded: spec.start !== "demand",
      key: spec.settingsKey?.() ?? "",
      fallback: null,
    };
    this.entries.push(entry);
    if (this.events.layoutReady()) this.start(entry);
    return index;
  }

  /**
   * Takes an index added with `add` out of the hub: stops its fallback timer, disposes
   * it and forgets its spec, so it gets no more events and no settings rebuilds. A
   * build in progress stops. Adding the same spec again builds a fresh index.
   */
  remove<V>(index: VaultIndex<F, V>): void {
    const i = this.entries.findIndex((e) => (e.index as unknown) === index);
    if (i < 0) return;
    const [e] = this.entries.splice(i, 1);
    if (e.fallback !== null) this.timers.clear(e.fallback);
    e.fallback = null;
    e.index.dispose();
  }

  follow(f: Follower): () => void {
    this.followers.add(f);
    return () => { this.followers.delete(f); };
  }

  /** Rebuilds one index by name, or all of them. */
  rebuild(name?: string): void {
    for (const e of this.entries) {
      if (name !== undefined && e.spec.name !== name) continue;
      if (!e.started) continue; // the first build is still to come
      this.build(e);
    }
  }

  /** Call on every settings save: rebuilds the specs whose settingsKey changed. */
  settingsChanged(): void {
    if (this.unloaded) return;
    if (this.settingsTimer !== null) this.timers.clear(this.settingsTimer);
    this.settingsTimer = this.timers.set(() => {
      this.settingsTimer = null;
      for (const e of this.entries) {
        const key = e.spec.settingsKey?.();
        if (key === undefined || key === e.key) continue;
        e.key = key;
        if (e.started) this.build(e);
      }
    }, this.settingsMs);
  }

  unload(): void {
    this.unloaded = true;
    if (this.settingsTimer !== null) this.timers.clear(this.settingsTimer);
    this.settingsTimer = null;
    for (const e of this.entries) {
      if (e.fallback !== null) this.timers.clear(e.fallback);
      e.index.dispose();
    }
    for (const x of this.echoes) this.timers.clear(x.timer);
    this.echoes = [];
    this.entries = [];
    this.followers.clear();
  }

  // ------------------------------------------------------------ building

  private layoutReady(): void {
    if (this.unloaded) return;
    for (const e of this.entries) if (!e.started) this.start(e);
  }

  /** First build of an entry: content now, metadata once the cache is there. */
  private start(e: Entry<F>): void {
    if (e.started || this.unloaded || !e.demanded) return;
    if (e.spec.mode === "content" || this.resolvedSeen || this.allCached(e)) {
      this.build(e);
      return;
    }
    // Wait for the first `resolved`; a mid-session reload may never send one.
    if (e.fallback === null) {
      e.fallback = this.timers.set(() => {
        e.fallback = null;
        if (!e.started) this.build(e);
      }, this.fallbackMs);
    }
  }

  /** A demand index asked to build: now if the layout is ready, else at layout ready. */
  private demand(e: Entry<F>): void {
    if (e.demanded || this.unloaded || !this.entries.includes(e)) return;
    e.demanded = true;
    if (this.events.layoutReady()) this.start(e);
  }

  private allCached(e: Entry<F>): boolean {
    return this.source.files().every((f) => !e.spec.include(f) || this.events.hasCache(f));
  }

  private resolved(): void {
    this.resolvedSeen = true;
    if (!this.events.layoutReady()) return;
    for (const e of this.entries) if (!e.started && e.demanded) this.build(e);
  }

  private build(e: Entry<F>): void {
    e.started = true;
    if (e.fallback !== null) {
      this.timers.clear(e.fallback);
      e.fallback = null;
    }
    void e.index.build().catch((err) => this.fail("", err));
  }

  // ------------------------------------------------------------ events

  private each(fn: (e: Entry<F>) => void): void {
    for (const e of [...this.entries]) {
      if (!e.started || !this.entries.includes(e)) continue; // the build will cover it; or it was removed meanwhile
      try { fn(e); } catch (err) { this.fail("", err); }
    }
  }

  private created(f: F): void {
    if (!this.events.layoutReady()) return; // the vault announces every file while it loads
    this.each((e) => e.index.created(f));
    this.structure(f.path);
  }

  private deleted(path: string): void {
    const echo = this.echo(path, null);
    this.each((e) => e.index.deleted(path));
    this.structure(path);
    if (!echo) this.notify((fl) => fl.deleted?.(path), path);
  }

  private renamed(oldPath: string, newPath: string): void {
    const echo = this.echo(oldPath, newPath);
    this.each((e) => e.index.renamed(oldPath, newPath));
    if (!this.inSnapshots(oldPath) || !this.inSnapshots(newPath)) this.structure("");
    if (!echo) this.notify((fl) => fl.moved?.(oldPath, newPath), oldPath);
  }

  /**
   * True when this event repeats one already seen for a parent folder (Obsidian
   * may send one per child after the folder event). The first event of its kind
   * is remembered for a moment.
   */
  private echo(oldPath: string, newPath: string | null): boolean {
    for (const x of this.echoes) {
      if (x.next === null || newPath === null) {
        if (x.next === null && newPath === null && isUnder(oldPath, x.old) && oldPath !== x.old) return true;
      } else if (oldPath !== x.old && movedPath(oldPath, x.old, x.next) === newPath) return true;
    }
    const entry = { old: oldPath, next: newPath, timer: null as unknown };
    entry.timer = this.timers.set(() => {
      this.echoes = this.echoes.filter((x) => x !== entry);
    }, ECHO_MS);
    this.echoes.push(entry);
    return false;
  }

  /** A create, delete or rename outside the snapshots root can change who is what. */
  private structure(path: string): void {
    if (path !== "" && this.inSnapshots(path)) return;
    this.each((e) => e.index.structureChanged());
  }

  private inSnapshots(path: string): boolean {
    return inFolder(path, this.opts.snapshotsRoot());
  }

  private notify(fn: (f: Follower) => void, path: string): void {
    for (const f of [...this.followers]) {
      try { fn(f); } catch (err) { this.fail(path, err); }
    }
  }

  private fail(path: string, e: unknown): void {
    this.opts.onError?.(path, e);
  }
}
