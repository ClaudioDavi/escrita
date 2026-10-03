// A reusable, incrementally maintained index over the vault (no Obsidian imports).
// Types (the wave 0 contract) first, then the VaultIndex class.

import { dropFromMap, dropFromSet, isUnder, movedPath, renameInMap, renameInSet } from "./path-keys";

export interface IndexFile { path: string; extension: string }

export interface IndexSource<F extends IndexFile> {
  files(): F[];
  file(path: string): F | null;
  read(f: F): Promise<string>;
}

export interface IndexTimers {
  set(cb: () => void, ms: number): unknown;
  clear(h: unknown): void;
  yieldNow(): Promise<void>;
}

/**
 * 'delete' only for a vault delete event. A live file whose compute returns
 * undefined, or that leaves `include`, emits 'update' with `after: undefined`.
 * A structural recompute emits 'update' for changed values only.
 * A build (first build or settings rebuild) emits 'build' for EVERY entry,
 * `same()` notwithstanding.
 */
export type IndexCause = "build" | "update" | "rename" | "delete";

export interface IndexChange<V> {
  path: string;
  /** set for 'rename' */
  from?: string;
  before?: V;
  after?: V;
  cause: IndexCause;
}

export interface IndexSpec<F extends IndexFile, V> {
  name: string;
  mode: "content" | "metadata";
  include(f: F): boolean;
  /** text is null in metadata mode */
  compute(f: F, text: string | null): V | undefined;
  same(a: V, b: V): boolean;
  structural?: boolean;
  settingsKey?(): string;
}

export interface Follower {
  moved?(oldPath: string, newPath: string): void;
  deleted?(path: string): void;
}

// ---------------------------------------------------------------------------
// The index itself. Keyed by path, batched on the first pass, rename- and
// delete-aware, debounced on modify. No Obsidian imports: the vault is an
// `IndexSource` and time is an `IndexTimers`, so tests drive it with in-memory
// fakes (tests/support/memory-vault.ts).

export interface VaultIndexOptions {
  /** quiet time before changed files are recomputed (default 300 ms) */
  settleMs?: number;
  /** files read at once per step of a build or a flush (default 40) */
  batch?: number;
  onError?(path: string, error: unknown): void;
}

export class VaultIndex<F extends IndexFile, V> {
  private map = new Map<string, V>();
  /** the map being built; rename and delete keep it current while a build runs */
  private fresh: Map<string, V> | null = null;
  private ready = false;
  private disposed = false;
  /** bumps on every build (and dispose) so a stale one stops */
  private generation = 0;
  private building = false;
  /** paths touched by events while a build runs; their live value wins */
  private touched = new Set<string>();
  /**
   * Latest read ticket per path, so an older read can't overwrite a newer one.
   * Tickets come from one counter and never repeat.
   */
  private seq = new Map<string, number>();
  private nextSeq = 0;
  private dirty = new Set<string>();
  private structuralPending = false;
  private timer: unknown = null;
  private readyCbs = new Set<() => void>();
  private changeCbs = new Set<(c: readonly IndexChange<V>[]) => void>();
  private readonly settleMs: number;
  private readonly batchSize: number;

  constructor(
    private spec: IndexSpec<F, V>,
    private source: IndexSource<F>,
    private timers: IndexTimers,
    private opts: VaultIndexOptions = {},
  ) {
    this.settleMs = opts.settleMs ?? 300;
    this.batchSize = Math.max(1, opts.batch ?? 40);
  }

  // ---------------------------------------------------------------- reading

  get(path: string): V | undefined { return this.map.get(path); }
  entries(): Iterable<[string, V]> { return this.map.entries(); }
  paths(): string[] { return [...this.map.keys()]; }
  get size(): number { return this.map.size; }
  isReady(): boolean { return this.ready; }

  /**
   * Fires after every completed build (the first one, and each rebuild), never
   * on subscribe: check isReady() first. Returns the unsubscribe function.
   */
  onReady(cb: () => void): () => void {
    this.readyCbs.add(cb);
    return () => { this.readyCbs.delete(cb); };
  }

  /** One call per batch of changes, in order. Returns the unsubscribe function. */
  onChange(cb: (c: readonly IndexChange<V>[]) => void): () => void {
    this.changeCbs.add(cb);
    return () => { this.changeCbs.delete(cb); };
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.cancelTimer();
    this.dirty.clear();
    this.seq.clear();
    this.touched.clear();
    this.fresh = null;
    this.readyCbs.clear();
    this.changeCbs.clear();
    // a disposed index answers nothing (a feature that is off holds no data)
    this.map = new Map();
    this.ready = false;
  }

  // ---------------------------------------------------------------- build

  /** Reads every included file in batches. A newer build makes an older one stop. */
  async build(): Promise<void> {
    if (this.disposed) return;
    const gen = ++this.generation;
    this.building = true;
    this.touched.clear();
    const fresh = new Map<string, V>();
    this.fresh = fresh;
    const files = this.source.files().filter((f) => this.spec.include(f));
    const content = this.spec.mode === "content";
    for (let i = 0; i < files.length; i += this.batchSize) {
      if (gen !== this.generation) return;
      await Promise.all(files.slice(i, i + this.batchSize).map(async (f) => {
        try {
          const text = content ? await this.source.read(f) : null;
          if (gen !== this.generation || this.touched.has(f.path)) return;
          const v = this.spec.compute(f, text);
          if (v !== undefined) fresh.set(f.path, v);
        } catch (e) {
          this.fail(f.path, e);
        }
      }));
      await this.timers.yieldNow();
    }
    if (gen !== this.generation) return;
    // Live events were mirrored into `fresh`, so touched paths are already current.
    const old = this.map;
    this.map = fresh;
    this.fresh = null;
    this.building = false;
    this.touched.clear();
    this.ready = true;
    const changes: IndexChange<V>[] = [];
    for (const [path, after] of fresh) {
      changes.push({ path, before: old.get(path), after, cause: "build" });
    }
    for (const [path, before] of old) {
      if (!fresh.has(path)) changes.push({ path, before, after: undefined, cause: "update" });
    }
    this.emit(changes);
    for (const cb of [...this.readyCbs]) this.guard(cb);
  }

  // ---------------------------------------------------------------- events

  created(f: F): void {
    this.touch(f.path);
    if (this.disposed) return;
    if (this.spec.mode === "metadata") this.recomputeNow([f.path]);
    else this.markDirty(f.path);
  }

  /** Content mode only: metadata indexes follow metadataChanged. */
  modified(f: F): void {
    if (this.disposed || this.spec.mode !== "content") return;
    this.touch(f.path);
    this.markDirty(f.path);
  }

  /** Metadata mode only: recomputes at once. */
  metadataChanged(f: F): void {
    if (this.disposed || this.spec.mode !== "metadata") return;
    this.touch(f.path);
    this.recomputeNow([f.path]);
  }

  /** A file or a folder moved. Safe to call again for each child of a folder. */
  renamed(oldPath: string, newPath: string): void {
    if (this.disposed || oldPath === "" || oldPath === newPath) return;
    const moves: [string, string, V][] = [];
    for (const [k, v] of this.map) {
      const to = movedPath(k, oldPath, newPath);
      if (to !== null) moves.push([k, to, v]);
    }
    // First build: the value may live only in `fresh`. Same scope check, no change record.
    const freshMoves: [string, string][] = [];
    if (this.fresh) {
      for (const k of this.fresh.keys()) {
        const to = movedPath(k, oldPath, newPath);
        if (to !== null) freshMoves.push([k, to]);
      }
    }
    const affected = new Set<string>([oldPath, newPath, ...moves.flatMap(([k, to]) => [k, to]), ...freshMoves.flatMap(([k, to]) => [k, to])]);
    for (const k of this.seq.keys()) if (isUnder(k, oldPath)) affected.add(k);
    for (const k of this.dirty) if (isUnder(k, oldPath)) affected.add(k);
    if (this.fresh) for (const k of this.fresh.keys()) if (isUnder(k, oldPath)) affected.add(k);
    for (const k of [...affected]) {
      const to = movedPath(k, oldPath, newPath);
      if (to !== null) affected.add(to);
    }
    // Invalidate reads in flight for the old keys and the new ones.
    for (const k of affected) this.seq.set(k, ++this.nextSeq);
    renameInMap(this.map, oldPath, newPath);
    if (this.fresh) renameInMap(this.fresh, oldPath, newPath);
    renameInSet(this.dirty, oldPath, newPath);
    if (this.building) for (const k of affected) this.touched.add(k);

    const changes: IndexChange<V>[] = [];
    for (const [from, to, v] of moves) {
      changes.push({ path: to, from, before: v, after: v, cause: "rename" });
    }
    const content = this.spec.mode === "content";
    const recompute: string[] = [];
    // Keep or drop what moved, depending on where it landed.
    for (const [, to, v] of moves) {
      const f = this.source.file(to);
      if (!f) continue;
      if (!this.spec.include(f)) {
        this.map.delete(to);
        this.fresh?.delete(to);
        changes.push({ path: to, before: v, after: undefined, cause: "update" });
      } else recompute.push(to);
    }
    for (const [, to] of freshMoves) {
      const f = this.source.file(to);
      if (f && !this.spec.include(f)) this.fresh?.delete(to);
    }
    // Files that moved into scope, and were not indexed before.
    const exact = this.source.file(newPath);
    const candidates = exact ? [exact] : this.source.files().filter((f) => isUnder(f.path, newPath));
    for (const f of candidates) {
      if (this.map.has(f.path) || recompute.includes(f.path) || this.dirty.has(f.path)) continue;
      if (this.spec.include(f)) {
        if (this.building) this.touched.add(f.path);
        recompute.push(f.path);
      }
    }
    if (content) for (const p of recompute) this.markDirty(p);
    else changes.push(...this.compute(recompute));
    this.emit(changes);
  }

  /** A vault delete event: a file, or a folder with everything under it. */
  deleted(path: string): void {
    if (this.disposed || path === "") return;
    const changes: IndexChange<V>[] = [];
    for (const [k, v] of this.map) {
      if (isUnder(k, path)) changes.push({ path: k, before: v, after: undefined, cause: "delete" });
    }
    const affected = new Set<string>(changes.map((c) => c.path));
    for (const k of this.seq.keys()) if (isUnder(k, path)) affected.add(k);
    for (const k of this.dirty) if (isUnder(k, path)) affected.add(k);
    if (this.fresh) for (const k of this.fresh.keys()) if (isUnder(k, path)) affected.add(k);
    affected.add(path);
    for (const k of affected) {
      if (isUnder(k, path)) this.seq.set(k, ++this.nextSeq);
      if (this.building) this.touched.add(k);
    }
    dropFromMap(this.map, path);
    if (this.fresh) dropFromMap(this.fresh, path);
    dropFromSet(this.dirty, path);
    this.emit(changes);
  }

  /** Something that decides who is what changed (a folder appeared). Structural specs only. */
  structureChanged(): void {
    if (this.disposed || !this.spec.structural) return;
    this.structuralPending = true;
    this.schedule();
  }

  // ---------------------------------------------------------------- upkeep

  private touch(path: string): void {
    if (this.building) this.touched.add(path);
  }

  private markDirty(path: string): void {
    this.dirty.add(path);
    this.seq.set(path, ++this.nextSeq);
    this.schedule();
  }

  private schedule(): void {
    this.cancelTimer();
    this.timer = this.timers.set(() => {
      this.timer = null;
      void this.flush();
    }, this.settleMs);
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      this.timers.clear(this.timer);
      this.timer = null;
    }
  }

  /** Recomputes the changed files (and, after a structural change, every file). */
  private async flush(): Promise<void> {
    if (this.disposed) return;
    const paths = new Set(this.dirty);
    this.dirty.clear();
    if (this.structuralPending) {
      this.structuralPending = false;
      for (const f of this.source.files()) paths.add(f.path);
      for (const k of this.map.keys()) paths.add(k);
    }
    const list = [...paths];
    if (this.spec.mode === "metadata") {
      this.emit(this.compute(list));
      return;
    }
    for (let i = 0; i < list.length; i += this.batchSize) {
      const changes: IndexChange<V>[] = [];
      await Promise.all(list.slice(i, i + this.batchSize).map((p) => this.refresh(p, changes)));
      if (this.disposed) return;
      this.emit(changes);
      if (i + this.batchSize < list.length) await this.timers.yieldNow();
      if (this.disposed) return;
    }
  }

  /** Reads one file (content mode) and applies the result when it is still the latest read. */
  private async refresh(path: string, out: IndexChange<V>[]): Promise<void> {
    const f = this.source.file(path);
    if (!f || !this.spec.include(f)) {
      this.removeLive(path, out);
      return;
    }
    const ticket = this.seq.get(path) ?? ++this.nextSeq;
    this.seq.set(path, ticket);
    let text: string;
    try {
      text = await this.source.read(f);
    } catch (e) {
      this.fail(path, e);
      return;
    }
    if (this.disposed || this.seq.get(path) !== ticket) return;
    this.seq.delete(path);
    let v: V | undefined;
    try {
      v = this.spec.compute(f, text);
    } catch (e) {
      this.fail(path, e);
      return;
    }
    this.apply(path, v, out);
  }

  /** Metadata mode: synchronous recompute of paths. */
  private compute(paths: string[]): IndexChange<V>[] {
    const out: IndexChange<V>[] = [];
    for (const p of paths) {
      const f = this.source.file(p);
      if (!f || !this.spec.include(f)) {
        this.removeLive(p, out);
        continue;
      }
      try {
        this.apply(p, this.spec.compute(f, null), out);
      } catch (e) {
        this.fail(p, e);
      }
    }
    return out;
  }

  private recomputeNow(paths: string[]): void {
    this.emit(this.compute(paths));
  }

  private apply(path: string, v: V | undefined, out: IndexChange<V>[]): void {
    if (v === undefined) {
      this.removeLive(path, out);
      return;
    }
    this.fresh?.set(path, v);
    const before = this.map.get(path);
    if (before !== undefined && this.spec.same(before, v)) return;
    this.map.set(path, v);
    out.push({ path, before, after: v, cause: "update" });
  }

  /** A live file left scope or computed to nothing: an update, never a delete. */
  private removeLive(path: string, out: IndexChange<V>[]): void {
    this.fresh?.delete(path);
    const before = this.map.get(path);
    if (before === undefined) return;
    this.map.delete(path);
    out.push({ path, before, after: undefined, cause: "update" });
  }

  private emit(changes: IndexChange<V>[]): void {
    if (changes.length === 0) return;
    for (const cb of [...this.changeCbs]) this.guard(() => cb(changes));
  }

  private guard(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      this.fail("", e);
    }
  }

  private fail(path: string, e: unknown): void {
    this.opts.onError?.(path, e);
  }
}
