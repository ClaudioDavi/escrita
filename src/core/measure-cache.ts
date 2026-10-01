// Counts per file, cached by modification time (no Obsidian imports, so it can
// be tested with a fake read). core/measurer.ts wires it to the vault.
//
// The cache holds numbers only, never a note's text: it is kept for the whole
// session, for every counted note (the whole vault by default). Characters are
// counted when the caller asks for them (a note counted in characters), or
// when the entry had them before; a words-only entry is a miss for a caller
// that needs characters, which re-reads the file once.

import { measureText, type Counts } from "./measure";

export interface Measurable {
  path: string;
  stat: { mtime: number };
}

/** A note's text as a caller already read it, with the file's mtime seen before that read began. */
export interface Seed {
  text: string;
  mtime: number;
}

export interface GetOptions {
  /** the file's content, already read: a miss is measured from it without reading (when its mtime is current) */
  seed?: Seed;
  /** the caller reads the character counts */
  characters?: boolean;
}

interface Entry {
  mtime: number;
  counts: Counts;
  /** the character counts are in `counts` */
  chars: boolean;
}

interface Pending {
  mtime: number;
  chars: boolean;
  promise: Promise<Counts>;
  /** identity of this read: a result is stored only while it is still the pending one */
  token: object;
}

export type ChangeListener = (paths: string[]) => void;

function under(key: string, dir: string): boolean {
  return key === dir || key.startsWith(`${dir}/`);
}

/** The characters were not counted for this note (it isn't counted in characters). */
export class CharactersNotCountedError extends Error {
  constructor() {
    super("characters were not counted for this note: ask the measure for them");
    this.name = "CharactersNotCountedError";
  }
}

/** Plain numbers detached from the text: with the characters, or words only (reading a character count throws). */
function detach(c: Counts, chars: boolean): Counts {
  if (chars) return Object.freeze({ words: c.words, characters: c.characters, charactersNoSpaces: c.charactersNoSpaces });
  const missing = (): never => { throw new CharactersNotCountedError(); };
  // not enumerable, so equality checks and spreads see only the words
  return Object.freeze(Object.defineProperties({ words: c.words } as Counts, {
    characters: { get: missing, enumerable: false },
    charactersNoSpaces: { get: missing, enumerable: false },
  }));
}

export class MeasureCache<F extends Measurable> {
  private entries = new Map<string, Entry>();
  private pending = new Map<string, Pending>();
  private listeners = new Set<ChangeListener>();

  constructor(
    private read: (f: F) => Promise<string>,
    private measure: (text: string) => Counts = measureText,
  ) {}

  /**
   * The file's counts. A hit when the stored mtime is the file's (and it has
   * the characters, when asked for); otherwise the read already in flight for
   * this path and mtime is shared, or a new one starts. A seed whose mtime is
   * the file's is measured without reading; an older seed (the file changed
   * while the caller read it) is ignored and the file read again.
   */
  get(f: F, o: GetOptions = {}): Promise<Counts> {
    const path = f.path, mtime = f.stat.mtime;
    const hit = this.entries.get(path);
    // a note counted in characters once keeps its characters on recounts
    const chars = o.characters === true || hit?.chars === true;
    if (hit && hit.mtime === mtime && (hit.chars || !chars)) return Promise.resolve(hit.counts);
    if (o.seed !== undefined && o.seed.mtime === mtime) {
      this.pending.delete(path); // an older read in flight must not overwrite this
      return Promise.resolve(this.store(path, mtime, this.measure(o.seed.text), chars));
    }
    const inflight = this.pending.get(path);
    if (inflight && inflight.mtime === mtime && (inflight.chars || !chars)) return inflight.promise;
    const token = {};
    const promise = this.read(f).then(
      (s) => {
        const counts = this.measure(s);
        if (this.pending.get(path)?.token !== token) return detach(counts, chars); // superseded: newer mtime, rename or forget
        this.pending.delete(path);
        return this.store(path, mtime, counts, chars);
      },
      (e: unknown) => {
        if (this.pending.get(path)?.token === token) this.pending.delete(path);
        throw e;
      },
    );
    this.pending.set(path, { mtime, chars, promise, token });
    return promise;
  }

  /**
   * The last stored counts for the path, even when the file changed since;
   * undefined when never counted (or, asked for characters, never counted with them).
   */
  peek(path: string, characters = false): Counts | undefined {
    const e = this.entries.get(path);
    return e && (e.chars || !characters) ? e.counts : undefined;
  }

  /** Whether counts are stored for the path at this mtime. */
  fresh(path: string, mtime: number): boolean {
    return this.entries.get(path)?.mtime === mtime;
  }

  /** Moves the entry; a read in flight for the old path is then discarded. Emits both paths. */
  rename(oldPath: string, newPath: string): void {
    const v = this.entries.get(oldPath);
    this.entries.delete(oldPath);
    this.pending.delete(oldPath);
    if (v) this.entries.set(newPath, v);
    this.emit([oldPath, newPath]);
  }

  /** A folder rename: every key under `oldDir/` moves under `newDir/`. Emits both folders and every moved path, old and new. */
  renamePrefix(oldDir: string, newDir: string): void {
    const paths = [oldDir, newDir];
    for (const key of [...this.pending.keys()]) if (under(key, oldDir)) this.pending.delete(key);
    for (const [key, v] of [...this.entries]) {
      if (!under(key, oldDir)) continue;
      const moved = newDir + key.slice(oldDir.length);
      this.entries.delete(key);
      this.entries.set(moved, v);
      paths.push(key, moved);
    }
    this.emit(paths);
  }

  /** Drops the entry and any read in flight; emits when an entry existed. */
  forget(path: string): void {
    this.pending.delete(path);
    if (this.entries.delete(path)) this.emit([path]);
  }

  /** forget for the folder and everything under it; emits the paths that had entries. */
  forgetPrefix(dir: string): void {
    const gone: string[] = [];
    for (const key of [...this.pending.keys()]) if (under(key, dir)) this.pending.delete(key);
    for (const key of [...this.entries.keys()]) {
      if (under(key, dir)) { this.entries.delete(key); gone.push(key); }
    }
    if (gone.length) this.emit(gone);
  }

  clear(): void {
    this.entries.clear();
    this.pending.clear();
  }

  /**
   * Called with the paths whose counts were added, changed (a recount that
   * gives the same counts is silent), removed, or renamed. Returns the unsubscribe.
   */
  onChange(cb: ChangeListener): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /** Stores plain numbers (never the text) and returns them; emits when they differ from what was stored. */
  private store(path: string, mtime: number, measured: Counts, chars: boolean): Counts {
    const prev = this.entries.get(path);
    const counts = detach(measured, chars);
    this.entries.set(path, { mtime, counts, chars });
    const same = prev !== undefined && prev.counts.words === counts.words && (!chars || (prev.chars
      && prev.counts.characters === counts.characters && prev.counts.charactersNoSpaces === counts.charactersNoSpaces));
    if (!same) this.emit([path]);
    return counts;
  }

  private emit(paths: string[]): void {
    for (const cb of [...this.listeners]) {
      try {
        cb(paths);
      } catch (e) {
        console.error("Escrita: a count listener failed", e);
      }
    }
  }
}
