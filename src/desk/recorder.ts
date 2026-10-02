import type { Editor, MarkdownFileInfo, MarkdownView } from "obsidian";
import type EscritaPlugin from "../main";
import { makeLeftOff, shouldRecord } from "../core/left-off";
import type { LeftOff, LeftOffEvents } from "../core/left-off";
import { dropFromMap, renameInMap } from "../core/path-keys";

/** How long after the last edit an idle note is committed. */
export const IDLE_MS = 30_000;

/**
 * Which pending paths to commit now. `all` commits everything (quit, hidden,
 * idle, unload). Otherwise a path is committed once the writer has left it:
 * it is not the active note, or its tab is no longer open.
 */
export function toCommit(
  pending: ReadonlyMap<string, unknown>,
  active: string | null,
  open: ReadonlySet<string>,
  all: boolean,
): string[] {
  const out: string[] = [];
  for (const path of pending.keys()) {
    if (all || path !== active || !open.has(path)) out.push(path);
  }
  return out;
}

/**
 * A note edited and not yet committed: only the cursor offset and ways to read
 * the text later. `read` gives the live editor text, or null once the tab shows
 * another note; `saved` reads the note as saved in the vault.
 */
export interface Dirty {
  offset: number;
  at: number;
  read: () => string | null;
  saved?: () => Promise<string>;
}

/** Cheap, per keystroke: remember the cursor offset only. Never reads the text. */
export function markDirty(
  pending: Map<string, Dirty>,
  path: string,
  offset: number,
  read: () => string | null,
  now: number,
  saved?: () => Promise<string>,
): void {
  pending.set(path, { offset, at: now, read, saved });
}

/** At commit time: read the live text once and build the stored spot; null if it can't be read. */
export function buildRecord(d: Dirty): LeftOff | null {
  try {
    const text = d.read();
    return text === null ? null : makeLeftOff(text, d.offset, d.at);
  } catch {
    return null;
  }
}

/** When the live text is gone (the tab moved on), build the spot from the saved note. */
export async function buildSavedRecord(d: Dirty): Promise<LeftOff | null> {
  if (!d.saved) return null;
  try {
    return makeLeftOff(await d.saved(), d.offset, d.at);
  } catch {
    return null;
  }
}

/**
 * A lazy reader tied to the note it was captured for. Obsidian reuses a tab's
 * editor when another note opens in it, so the editor is read only while the
 * view still shows the same file; otherwise null (the caller falls back to the
 * saved note). Public API only.
 */
export function makeReader<F>(editor: { getValue(): string }, file: F, currentFile: () => F | null): () => string | null {
  return () => (currentFile() === file ? editor.getValue() : null);
}

/** Rename collision between two pending captures: the newer wins. */
export function newestPending(moved: Dirty, existing: Dirty): Dirty {
  return moved.at >= existing.at ? moved : existing;
}

/**
 * Remembers where the writer stopped in a note. Edits are captured in memory
 * only; a commit writes `data.leftOff` and tells the listeners.
 */
export class LeftOffRecorder implements LeftOffEvents {
  private pending = new Map<string, Dirty>();
  private listeners = new Set<(paths: readonly string[]) => void>();
  private idle: number | null = null;

  constructor(private plugin: EscritaPlugin) {}

  onChange(cb: (paths: readonly string[]) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  load(): void {
    const p = this.plugin;
    const ws = p.app.workspace;
    p.registerEvent(ws.on("editor-change", (editor, info) => this.capture(editor, info)));
    p.registerEvent(ws.on("active-leaf-change", () => this.commit(false)));
    p.registerEvent(ws.on("file-open", () => this.commit(false)));
    p.registerEvent(ws.on("layout-change", () => this.commit(false)));
    p.registerEvent(ws.on("quit", () => this.commit(true, true)));
    p.registerDomEvent(document, "visibilitychange", () => {
      if (document.visibilityState === "hidden") this.commit(true, true);
    });
    p.register(p.index.follow({
      moved: (oldPath, newPath) => { renameInMap(this.pending, oldPath, newPath, newestPending); },
      deleted: (path) => { dropFromMap(this.pending, path); },
    }));
  }

  unload(): void {
    this.clearIdle();
    this.commit(true);
  }

  private capture(editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
    const file = info.file;
    if (!file || file.extension !== "md") return;
    if (!this.recordable(file.path)) return;
    const offset = editor.posToOffset(editor.getCursor());
    const vault = this.plugin.app.vault;
    markDirty(this.pending, file.path, offset, makeReader(editor, file, () => info.file), Date.now(),
      () => vault.cachedRead(file));
    this.armIdle();
  }

  /** Notes and chapters of a book that is a work; everything else is left alone. */
  private recordable(path: string): boolean {
    const works = this.plugin.works;
    const entry = works.get(path);
    return shouldRecord(
      entry?.role ?? null,
      (bookPath) => works.get(bookPath)?.role ?? null,
      entry?.book,
    );
  }

  private armIdle(): void {
    this.clearIdle();
    this.idle = window.setTimeout(() => { this.idle = null; this.commit(true); }, IDLE_MS);
  }

  private clearIdle(): void {
    if (this.idle !== null) window.clearTimeout(this.idle);
    this.idle = null;
  }

  private openPaths(): Set<string> {
    const open = new Set<string>();
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.getViewType() !== "markdown") return;
      const file = (leaf.view as MarkdownView).file;
      if (file) open.add(file.path);
    });
    return open;
  }

  /** The tab moved on before the commit: build the spot from the saved note instead. */
  private async commitSaved(path: string, dirty: Dirty): Promise<void> {
    const rec = await buildSavedRecord(dirty);
    if (!rec || this.pending.has(path)) return;
    this.plugin.data.leftOff[path] = rec;
    this.plugin.requestSave();
    for (const cb of [...this.listeners]) cb([path]);
  }

  /** `flush` also writes data.json now, for the moments the app may be gone next. */
  private commit(all: boolean, flush = false): void {
    if (this.pending.size === 0) return;
    const ws = this.plugin.app.workspace;
    const active = ws.getActiveFile()?.path ?? null;
    const paths = toCommit(this.pending, active, this.openPaths(), all);
    if (paths.length === 0) return;
    const later: Array<[string, Dirty]> = [];
    for (const path of paths) {
      const dirty = this.pending.get(path);
      this.pending.delete(path);
      if (!dirty) continue;
      const rec = buildRecord(dirty);
      if (rec) this.plugin.data.leftOff[path] = rec;
      else later.push([path, dirty]);
    }
    for (const [path, dirty] of later) void this.commitSaved(path, dirty);
    if (this.pending.size === 0) this.clearIdle();
    this.plugin.requestSave();
    if (flush) this.plugin.requestSave.run();
    for (const cb of [...this.listeners]) cb(paths);
  }
}
