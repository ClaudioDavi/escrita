// Snapshot storage over a small file-system port (no Obsidian imports; fs.ts
// adapts the vault or its adapter). One folder per note:
//
//   <root>/<note path, .md kept>/<YYYY-MM-DD HHmm> <label>.txt + index.json
//
// Every mutation runs through one SerialQueue, so takes, renames, deletes and
// the folder moves that follow note renames never interleave. A take names its
// note by a live reference ({ path }: a TFile), read inside the queue, so a
// rename queued before it moves the folder first and the take lands in the new
// one (history never splits).
//
// Files are the truth: every load reconciles index.json with the .txt files.
// A file is written before the index that lists it, so a failed index write
// leaves an orphan the next load adopts (as manual, never pruned). Pruned
// snapshots go to the trash, never a permanent delete.

import { SerialQueue } from "../core/chapter-engine";
import {
  addEntry, fnv1a, latest, mergeIndexes, newestFirst, parseIndex, reconcile, removeEntry, sameText, serializeIndex,
  updateEntry, indexNote, AUTO_KINDS, type SnapshotEntry, type SnapshotIndex, type SnapshotKind,
} from "./index-format";
import { foldedPath, isInside, notePathOfDir, parseSnapshotFileName, renamedFileName, snapshotDir, snapshotFileName } from "./paths";
import { toPrune } from "./retention";

export interface SnapshotFs {
  exists(path: string): Promise<boolean>;
  /** names (not paths) of the files and folders directly inside `dir`; a missing dir lists empty */
  list(dir: string): Promise<{ files: string[]; folders: string[] }>;
  read(path: string): Promise<string>;
  /** creates missing parent folders; creates or overwrites */
  write(path: string, text: string): Promise<void>;
  /** a file or a folder; creates missing parent folders of `to`, which must not exist */
  rename(from: string, to: string): Promise<void>;
  /** to the trash (system or vault), never a permanent delete */
  trash(path: string): Promise<void>;
  /** removes `dir` only when it exists and is empty */
  removeIfEmpty(dir: string): Promise<void>;
}

export type TakeResult =
  | { status: "taken"; entry: SnapshotEntry; pruned: string[] }
  | { status: "unchanged"; entry: SnapshotEntry }
  | { status: "promoted"; entry: SnapshotEntry };

export interface TakeOptions {
  kind: SnapshotKind;
  /** the writer's name for a manual snapshot; automatic ones leave it empty */
  name?: string;
  /** writing day, YYYY-MM-DD */
  day: string;
  words: number;
  /** snapshot files of this note that pruning must leave alone (the one being restored or compared) */
  protect?: readonly string[];
  /** kind "stage": the stage ids the note moved between */
  stage?: { from: string; to: string };
}

/** A note by path, or by a live handle whose path follows renames (a TFile). */
export type NoteRef = string | { readonly path: string };

export interface StoreOptions {
  root: string;
  keepAuto: number;
  /** whether a note exists at this path (the other owner of a shared folder); default: never */
  noteExists?: (path: string) => boolean;
}

/**
 * Another note's snapshots are in this note's folder: their paths differ only in
 * characters the file system or Obsidian folds (special spaces, accents). Mixing
 * them would restore one note's text into the other, so the store refuses.
 */
export class SharedFolderError extends Error {
  constructor(readonly note: string, readonly owner: string) {
    super(`the snapshot folder of ${note} holds the snapshots of ${owner}`);
    this.name = "SharedFolderError";
  }
}

const INDEX = "index.json";

function pathOf(ref: NoteRef): string {
  return typeof ref === "string" ? ref : ref.path;
}

function join(dir: string, name: string): string {
  return `${dir}/${name}`;
}

function parentOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function lowerSet(names: Iterable<string>): Set<string> {
  return new Set(Array.from(names, (n) => n.toLowerCase()));
}

/** A free name for `file` among `taken` (case-insensitive), keeping its stamp and label. */
function freeName(file: string, taken: Set<string>): string {
  if (!taken.has(file.toLowerCase())) return file;
  // a snapshot name loses its own collision suffix first: "x (2).txt" → "x (3).txt"
  const base = parseSnapshotFileName(file) ? file.replace(/(?: \(\d+\))?\.txt$/, "") : file.replace(/\.txt$/, "");
  for (let n = 2; ; n++) {
    const name = `${base} (${n}).txt`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

interface Loaded {
  index: SnapshotIndex;
  changed: boolean;
  files: string[];
  folders: string[];
}

export class SnapshotStore {
  private queue = new SerialQueue();
  private listeners = new Set<(notePath: string) => void>();

  constructor(
    private fs: () => SnapshotFs,
    private opts: () => StoreOptions,
    private kindLabel: (k: SnapshotKind) => string,
    private countWords: (text: string) => number,
    private now: () => Date = () => new Date(),
  ) {}

  onChange(fn: (notePath: string) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit(...paths: string[]): void {
    for (const p of paths) {
      for (const fn of [...this.listeners]) {
        try {
          fn(p);
        } catch (e) {
          console.error("Escrita: a snapshots listener failed", e);
        }
      }
    }
  }

  private dir(notePath: string): string {
    return snapshotDir(this.opts().root, notePath);
  }

  private async load(fs: SnapshotFs, dir: string, note: string): Promise<Loaded> {
    const { files, folders } = await fs.list(dir);
    let json: string | null = null;
    if (files.includes(INDEX)) {
      try {
        json = await fs.read(join(dir, INDEX));
      } catch (e) {
        console.error(`Escrita: couldn't read ${join(dir, INDEX)}; rebuilding it from the files`, e);
      }
    }
    const owner = indexNote(json);
    if (owner !== null && owner !== note && foldedPath(owner) === foldedPath(note) && this.opts().noteExists?.(owner)) {
      throw new SharedFolderError(note, owner);
    }
    const { index, changed } = reconcile(parseIndex(json, note), files.filter((f) => f.endsWith(".txt")));
    return { index, changed, files, folders };
  }

  private writeIndex(fs: SnapshotFs, dir: string, index: SnapshotIndex): Promise<void> {
    return fs.write(join(dir, INDEX), serializeIndex(index));
  }

  /** The note's snapshots, newest first. Writes the index back when reconciling changed it. */
  list(note: NoteRef): Promise<SnapshotEntry[]> {
    return this.queue.run(async () => {
      const notePath = pathOf(note);
      const fs = this.fs();
      const dir = this.dir(notePath);
      const l = await this.load(fs, dir, notePath);
      if (l.changed && l.files.length > 0) await this.writeIndex(fs, dir, l.index);
      return newestFirst(l.index.entries);
    });
  }

  /**
   * A snapshot's text. Fills in the words, hash and length of an entry that
   * lacks them (a file copied in by hand), in the background.
   */
  async read(note: NoteRef, file: string): Promise<string> {
    const notePath = pathOf(note);
    const text = await this.fs().read(join(this.dir(notePath), file));
    void this.fillIn(notePath, file, text).catch((e) => console.error("Escrita: couldn't update a snapshot index", e));
    return text;
  }

  private fillIn(notePath: string, file: string, text: string): Promise<void> {
    return this.queue.run(async () => {
      const fs = this.fs();
      const dir = this.dir(notePath);
      const l = await this.load(fs, dir, notePath);
      const e = l.index.entries.find((x) => x.file === file);
      if (!e || (e.words >= 0 && e.hash !== "" && e.length >= 0)) return;
      const index = updateEntry(l.index, file, { words: this.countWords(text), hash: fnv1a(text), length: text.length });
      await this.writeIndex(fs, dir, index);
      this.emit(notePath);
    });
  }

  take(note: NoteRef, text: string, o: TakeOptions): Promise<TakeResult> {
    return this.queue.run(async () => {
      // the path now, inside the queue: a rename queued earlier has moved the folder already
      const notePath = pathOf(note);
      const fs = this.fs();
      const { keepAuto } = this.opts();
      const dir = this.dir(notePath);
      let { index, files } = await this.load(fs, dir, notePath);
      const last = latest(index);

      const readSame = async (e: SnapshotEntry): Promise<boolean> => {
        if (sameText(e, text) !== "maybe") return false;
        try {
          return (await fs.read(join(dir, e.file))) === text;
        } catch {
          return false;
        }
      };

      if (last && (await readSame(last))) {
        const name = o.name?.trim() ?? "";
        if (AUTO_KINDS.has(last.kind) && ((o.kind === "manual" && name !== "") || o.kind === "stage")) {
          // A named milestone (or a stage change) must never be pruned: the automatic copy becomes it.
          const file = name !== "" ? renamedFileName(last.file, name, new Set(files)) : last.file;
          if (file !== last.file) await fs.rename(join(dir, last.file), join(dir, file));
          index = updateEntry(index, last.file, {
            file, kind: o.kind, name, hash: fnv1a(text), length: text.length,
            ...(o.kind === "stage" && o.stage ? { stage: o.stage } : {}),
          });
          await this.writeIndex(fs, dir, index);
          this.emit(notePath);
          return { status: "promoted", entry: index.entries.find((e) => e.file === file) as SnapshotEntry };
        }
        if (o.kind !== "stage") return { status: "unchanged", entry: last };
      }
      if (o.kind === "stage") {
        for (const e of newestFirst(index.entries)) {
          if ((e.kind === "manual" || e.kind === "stage") && (await readSame(e))) return { status: "unchanged", entry: e };
        }
      }

      const when = this.now();
      const name = o.kind === "manual" || o.kind === "stage" ? o.name?.trim() ?? "" : "";
      const file = snapshotFileName(when, name || this.kindLabel(o.kind), new Set(files));
      const entry: SnapshotEntry = {
        file, name, kind: o.kind, taken: when.getTime(), day: o.day, words: o.words,
        notePath, hash: fnv1a(text), length: text.length,
        ...(o.kind === "stage" && o.stage ? { stage: o.stage } : {}),
      };
      await fs.write(join(dir, file), text);
      index = addEntry(index, entry);
      await this.writeIndex(fs, dir, index);

      const pruned: string[] = [];
      for (const f of toPrune(index.entries, keepAuto, [file, ...(o.protect ?? [])])) {
        try {
          await fs.trash(join(dir, f));
          pruned.push(f);
          index = removeEntry(index, f);
        } catch (e) {
          console.error(`Escrita: couldn't move an old snapshot to the trash: ${join(dir, f)}`, e);
        }
      }
      if (pruned.length) await this.writeIndex(fs, dir, index);
      this.emit(notePath);
      return { status: "taken", entry, pruned };
    });
  }

  /** A new name for a snapshot; the file is renamed too, keeping its stamp. */
  rename(note: NoteRef, file: string, name: string): Promise<SnapshotEntry> {
    return this.queue.run(async () => {
      const notePath = pathOf(note);
      const fs = this.fs();
      const dir = this.dir(notePath);
      const l = await this.load(fs, dir, notePath);
      if (!l.index.entries.some((e) => e.file === file)) throw new Error(`no snapshot ${file} for ${notePath}`);
      const clean = name.trim();
      const next = renamedFileName(file, clean, new Set(l.files));
      if (next !== file) await fs.rename(join(dir, file), join(dir, next));
      // a name makes it the writer's: never pruned
      const index = updateEntry(l.index, file, { file: next, name: clean, ...(clean !== "" && AUTO_KINDS.has(l.index.entries.find((e) => e.file === file)!.kind) ? { kind: "manual" as const } : {}) });
      await this.writeIndex(fs, dir, index);
      this.emit(notePath);
      return index.entries.find((e) => e.file === next) as SnapshotEntry;
    });
  }

  /** The snapshot file goes to the trash and leaves the index. */
  trash(note: NoteRef, file: string): Promise<void> {
    return this.queue.run(async () => {
      const notePath = pathOf(note);
      const fs = this.fs();
      const dir = this.dir(notePath);
      if (await fs.exists(join(dir, file))) await fs.trash(join(dir, file));
      const l = await this.load(fs, dir, notePath);
      if (l.files.length > 0) await this.writeIndex(fs, dir, removeEntry(l.index, file));
      this.emit(notePath);
    });
  }

  /**
   * Every note path that has snapshot files under the root (walks the folder
   * tree; for finding the snapshots of deleted notes). Unsorted.
   */
  notesWithSnapshots(): Promise<string[]> {
    return this.queue.run(async () => {
      const fs = this.fs();
      const root = this.opts().root;
      const out: string[] = [];
      const walk = async (dir: string): Promise<void> => {
        const { files, folders } = await fs.list(dir);
        const note = notePathOfDir(root, dir);
        if (note !== null && files.some((f) => parseSnapshotFileName(f) !== null)) out.push(note);
        for (const f of folders) await walk(join(dir, f));
      };
      await walk(root);
      return out;
    });
  }

  /** Whether the note has a "before the day's first edit" snapshot for `day`. */
  hasDaily(note: NoteRef, day: string): Promise<boolean> {
    return this.queue.run(async () => {
      const notePath = pathOf(note);
      const l = await this.load(this.fs(), this.dir(notePath), notePath);
      return l.index.entries.some((e) => e.kind === "daily" && e.day === day);
    });
  }

  /** A note was renamed: its snapshots follow. Idempotent; merges into snapshots already at the new path. */
  moveNote(oldPath: string, newPath: string): Promise<void> {
    return this.queue.run(async () => {
      if (oldPath === newPath) return;
      const from = this.dir(oldPath);
      const moved = await this.moveDir(this.fs(), from, this.dir(newPath));
      if (!moved) return;
      await this.removeEmptyParents(this.fs(), from);
      this.emit(oldPath, newPath);
    });
  }

  /** A folder was renamed: the snapshots of every note under it follow. Idempotent with the per-note moves. */
  moveFolder(oldPath: string, newPath: string): Promise<void> {
    return this.queue.run(async () => {
      if (oldPath === newPath || oldPath === "") return;
      const root = this.opts().root;
      const from = snapshotDir(root, oldPath);
      const moved = await this.moveDir(this.fs(), from, snapshotDir(root, newPath));
      if (!moved) return;
      await this.removeEmptyParents(this.fs(), from);
      this.emit(oldPath, newPath);
    });
  }

  /** Moves `from` to `to`, merging into what is there. False when there was nothing to move. */
  private async moveDir(fs: SnapshotFs, from: string, to: string): Promise<boolean> {
    if (!(await fs.exists(from))) return false;
    const root = this.opts().root;
    const newNote = notePathOfDir(root, to);
    if (!(await fs.exists(to))) {
      await fs.rename(from, to);
      if (newNote) {
        // the index names its note
        const l = await this.load(fs, to, newNote);
        if (l.files.includes(INDEX) || l.changed) await this.writeIndex(fs, to, { ...l.index, note: newNote });
      }
      return true;
    }
    const src = await fs.list(from);
    const oldNote = notePathOfDir(root, from);
    if (newNote && oldNote && src.files.some((f) => f.endsWith(".txt") || f === INDEX)) {
      await this.mergeNote(fs, from, to, oldNote, newNote);
    }
    for (const folder of src.folders) await this.moveDir(fs, join(from, folder), join(to, folder));
    await fs.removeIfEmpty(from);
    return true;
  }

  /** One note's snapshots merged into another's folder; colliding names get " (2)"… */
  private async mergeNote(fs: SnapshotFs, from: string, to: string, oldNote: string, newNote: string): Promise<void> {
    const src = await this.load(fs, from, oldNote);
    const dst = await this.load(fs, to, newNote);
    const taken = lowerSet(dst.files);
    const renames: Record<string, string> = {};
    for (const f of src.files) {
      if (!f.endsWith(".txt")) continue;
      const target = freeName(f, taken);
      await fs.rename(join(from, f), join(to, target));
      taken.add(target.toLowerCase());
      renames[f] = target;
    }
    await this.writeIndex(fs, to, mergeIndexes({ ...dst.index, note: newNote }, src.index, renames));
    if (src.files.includes(INDEX)) await fs.trash(join(from, INDEX));
  }

  /** Empty folders left between a moved snapshot folder and the root. */
  private async removeEmptyParents(fs: SnapshotFs, dir: string): Promise<void> {
    const root = this.opts().root;
    for (let p = parentOf(dir); p !== root && p.length > root.length && isInside(root, p); p = parentOf(p)) {
      await fs.removeIfEmpty(p);
    }
  }
}
