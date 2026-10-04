// An in-memory vault and manual timers for testing VaultIndex and the index hub
// without Obsidian. Events are delivered to whoever called `attach` or `onEvent`.

import type { IndexFile, IndexSource, IndexTimers } from "../../src/core/vault-index";

export interface MemFile extends IndexFile {
  text: string;
}

export type MemEvent =
  | { type: "create" | "modify" | "meta"; file: MemFile }
  | { type: "delete"; path: string }
  | { type: "rename"; path: string; oldPath: string; folder: boolean };

export type RenameMode = "folder-only" | "folder-then-children";

/** The surface of a VaultIndex that MemoryVault drives. */
export interface IndexEvents {
  created(f: MemFile): void;
  modified(f: MemFile): void;
  metadataChanged(f: MemFile): void;
  renamed(oldPath: string, newPath: string): void;
  deleted(path: string): void;
}

function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const i = base.lastIndexOf(".");
  return i < 0 ? "" : base.slice(i + 1);
}

export class MemoryVault implements IndexSource<MemFile> {
  private store = new Map<string, MemFile>();
  private folders = new Set<string>();
  private listeners = new Set<(e: MemEvent) => void>();
  /** when true, read() waits for resolveRead(); the text is captured at call time */
  manualReads = false;
  pendingReads: { path: string; text: string; resolve: () => void }[] = [];
  /** paths whose read() rejects */
  failReads = new Set<string>();
  readCount = 0;

  constructor(initial: Record<string, string> = {}) {
    for (const [p, t] of Object.entries(initial)) this.put(p, t);
  }

  // ------------------------------------------------------------ IndexSource

  files(): MemFile[] { return [...this.store.values()]; }
  file(path: string): MemFile | null { return this.store.get(path) ?? null; }
  async read(f: MemFile): Promise<string> {
    this.readCount++;
    if (this.failReads.has(f.path)) throw new Error(`cannot read ${f.path}`);
    const text = this.store.get(f.path)?.text ?? f.text;
    if (!this.manualReads) return text;
    return new Promise<string>((res) => {
      this.pendingReads.push({ path: f.path, text, resolve: () => res(text) });
    });
  }

  /** Resolves the pending read at `i` (default: the oldest). */
  resolveRead(i = 0): void {
    const [r] = this.pendingReads.splice(i, 1);
    r?.resolve();
  }
  resolveAllReads(): void {
    for (const r of this.pendingReads.splice(0)) r.resolve();
  }

  // ------------------------------------------------------------ events

  onEvent(cb: (e: MemEvent) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /** Wires vault events to an index (or a fake with the same methods). */
  attach(index: IndexEvents): () => void {
    return this.onEvent((e) => {
      if (e.type === "create") index.created(e.file);
      else if (e.type === "modify") index.modified(e.file);
      else if (e.type === "meta") index.metadataChanged(e.file);
      else if (e.type === "delete") index.deleted(e.path);
      else if (e.type === "rename") index.renamed(e.oldPath, e.path);
    });
  }

  private emit(e: MemEvent): void {
    for (const cb of [...this.listeners]) cb(e);
  }

  // ------------------------------------------------------------ mutations

  private put(path: string, text: string): MemFile {
    const f: MemFile = { path, extension: extOf(path), text };
    this.store.set(path, f);
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) this.folders.add(parts.slice(0, i).join("/"));
    return f;
  }

  create(path: string, text = ""): MemFile {
    const f = this.put(path, text);
    this.emit({ type: "create", file: f });
    return f;
  }

  /** Adds a folder (no event, like an empty folder made outside Obsidian). */
  mkdir(path: string): void { this.folders.add(path); }

  modify(path: string, text: string): void {
    const f = this.store.get(path);
    if (!f) throw new Error(`no such file ${path}`);
    f.text = text;
    this.emit({ type: "modify", file: f });
  }

  /** The metadata cache changed for a file (its text is replaced too). */
  changeMeta(path: string, text?: string): void {
    const f = this.store.get(path);
    if (!f) throw new Error(`no such file ${path}`);
    if (text !== undefined) f.text = text;
    this.emit({ type: "meta", file: f });
  }

  /** Deletes a file, or a folder with everything under it (one event for the target). */
  delete(path: string): void {
    for (const k of [...this.store.keys()]) {
      if (k === path || k.startsWith(path + "/")) this.store.delete(k);
    }
    for (const k of [...this.folders]) {
      if (k === path || k.startsWith(path + "/")) this.folders.delete(k);
    }
    this.emit({ type: "delete", path });
  }

  /** Deletes a folder's contents, then emits a delete event per file, then the folder. */
  deleteWithChildren(path: string): void {
    const kids = [...this.store.keys()].filter((k) => k.startsWith(path + "/"));
    this.delete(path);
    for (const k of kids) this.emit({ type: "delete", path: k });
  }

  /** Renames a file, or a folder in the given mode. The store is updated first. */
  rename(oldPath: string, newPath: string, mode: RenameMode = "folder-then-children"): void {
    const folder = this.folders.has(oldPath) && !this.store.has(oldPath);
    if (!folder) {
      const f = this.store.get(oldPath);
      if (!f) throw new Error(`no such file ${oldPath}`);
      this.store.delete(oldPath);
      this.put(newPath, f.text);
      this.emit({ type: "rename", path: newPath, oldPath, folder: false });
      return;
    }
    const kids: [string, string][] = [];
    for (const k of [...this.store.keys()]) {
      if (k.startsWith(oldPath + "/")) kids.push([k, newPath + k.slice(oldPath.length)]);
    }
    for (const [from, to] of kids) {
      const text = this.store.get(from)?.text ?? "";
      this.store.delete(from);
      this.put(to, text);
    }
    for (const k of [...this.folders]) {
      if (k === oldPath || k.startsWith(oldPath + "/")) this.folders.delete(k);
    }
    this.folders.add(newPath);
    this.emit({ type: "rename", path: newPath, oldPath, folder: true });
    if (mode === "folder-then-children") {
      for (const [from, to] of kids) this.emit({ type: "rename", path: to, oldPath: from, folder: false });
    }
  }
}

/** Timers that only fire when the test says so. yieldNow is a macrotask, so microtasks drain. */
export class ManualTimers implements IndexTimers {
  /** the fake clock, in ms; advance() moves it */
  clock = 0;
  now(): number { return this.clock; }
  private next = 1;
  private pending = new Map<number, { at: number; cb: () => void }>();

  set(cb: () => void, ms: number): unknown {
    const id = this.next++;
    this.pending.set(id, { at: this.clock + ms, cb });
    return id;
  }
  clear(h: unknown): void { this.pending.delete(h as number); }
  yieldNow(): Promise<void> { return new Promise((r) => setTimeout(r, 0)); }

  get count(): number { return this.pending.size; }

  /** Advances the clock, firing due callbacks in order, then lets promises settle. */
  async advance(ms: number): Promise<void> {
    const to = this.clock + ms;
    for (;;) {
      let best: [number, { at: number; cb: () => void }] | null = null;
      for (const e of this.pending) if (e[1].at <= to && (!best || e[1].at < best[1].at)) best = e;
      if (!best) break;
      this.pending.delete(best[0]);
      this.clock = Math.max(this.clock, best[1].at);
      best[1].cb();
    }
    this.clock = to;
    await settle();
  }
}

/** Lets pending promises and zero-delay timers run. */
export async function settle(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
}
