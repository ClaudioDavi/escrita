// plugin.measure: the one place that counts notes and books. The Obsidian
// adapter of core/measure-cache.ts (counts cached per file by mtime) and
// core/measure.ts (pure counting, pieces, goals, progress).
//
// ── Interface (what modules use) ─────────────────────────────────────────
//
//   plugin.measure.counts(file, seed?, unit?) → Promise<Counts>
//       A note's words, and its characters when it is counted in characters
//       (`unit`, default the note's own unit()), cached by mtime. `seed`
//       ({ text, mtime }: the file as the caller already read it, with the
//       mtime seen before the read began) saves a second read on a miss; a
//       seed older than the file is ignored. Reading the characters of a
//       note counted in words throws CharactersNotCountedError: pass its unit.
//   plugin.measure.peek(path, unit?)    → Counts | undefined
//       Sync, no I/O: the last known counts (maybe stale), undefined when the
//       file was never counted (or, counted in characters, never with them).
//   plugin.measure.unit(file)           → PieceUnit
//       The unit the note is counted in (readUnit of its live frontmatter),
//       also for a note with a unit and no target.
//   plugin.measure.note(file, pieceOverride?) → Promise<NoteMeasure>
//       { counts, piece, unit, progress }; piece and unit read live, after the
//       count, so a frontmatter edit made meanwhile shows.
//   plugin.measure.book(book)           → Promise<BookMeasure>
//       { counts (sum of chapters), chapters, goal, deadline }.
//   plugin.measure.bookGoal(book)       → BookGoal (sync, live frontmatter)
//   plugin.measure.bookPeek(book)       → Counts | undefined
//       Sync sum of the chapters' peeks; undefined while any chapter is uncounted.
//   plugin.measure.onChange(cb(paths[])) → unsubscribe
//       After counts are added or change (a recount with the same result is
//       silent), after a file's counts are dropped (delete), and on every
//       rename (old and new paths; a folder rename also lists every moved
//       path, old and new). Frontmatter-only edits don't change counts and
//       don't fire: listen to metadataCache "changed" for those.
//
//   Pure, from core/measure.ts: measureText(md), countIn(counts, unit),
//   sumCounts, progressOf(count, piece), noteProgress(counts, piece, unit?),
//   readPiece, readUnit(fm, props), readBookGoal, parseAmount, parseDeadline.
//   Labels, from src/i18n.ts: unitAmount(unit, n) ("1 word", "5,000
//   characters"), plural(key, n).
//
// Upkeep it owns: rename and delete (folders included) move or drop cached
// counts; any .md modify or create (sync, git, other plugins, Escrita's own
// vault.process) recounts, debounced, the files already counted or tracked.
// Constructed in main.ts before the modules, so its vault handlers run first.
//
// Characters: words are counted on every recount; the two character counts
// only for notes counted in characters (they cost about three times as much).
// The cache keeps numbers only, never a note's text (see core/measure-cache.ts).

import { TFile, TFolder, debounce, type TAbstractFile } from "obsidian";
import type EscritaPlugin from "../main";
import type { Book } from "./books";
import { MeasureCache, type Seed } from "./measure-cache";
import {
  noteProgress, readBookGoal, readUnit, sumCounts,
  type BookGoal, type Counts, type Piece, type PieceUnit, type Progress,
} from "./measure";

export interface NoteMeasure {
  counts: Counts;
  /** the note's piece (target, limit, unit, deadline), or the override */
  piece: Piece | null;
  /** the unit the note is counted in: the piece's, else its unit property, else words */
  unit: PieceUnit;
  progress: Progress;
}

export interface BookMeasure {
  counts: Counts;
  chapters: number;
  goal: number | null;
  deadline: string | null;
}

/** How long vault changes settle before the files are recounted. */
const RECOUNT_MS = 500;

export class Measurer {
  private cache: MeasureCache<TFile>;
  private dirty = new Set<string>();
  private recount = debounce(() => this.flush(), RECOUNT_MS, true);

  constructor(private plugin: EscritaPlugin) {
    const { vault, workspace } = plugin.app;
    this.cache = new MeasureCache<TFile>((f) => vault.cachedRead(f));
    plugin.registerEvent(vault.on("rename", (f, oldPath) => {
      if (this.dirty.delete(oldPath)) this.dirty.add(f.path);
      if (f instanceof TFolder) this.cache.renamePrefix(oldPath, f.path);
      else this.cache.rename(oldPath, f.path);
    }));
    plugin.registerEvent(vault.on("delete", (f) => {
      this.dirty.delete(f.path);
      if (f instanceof TFolder) this.cache.forgetPrefix(f.path);
      else this.cache.forget(f.path);
    }));
    plugin.registerEvent(vault.on("modify", (f) => this.changed(f)));
    // The vault announces every file as "created" while it loads: only later creations count.
    workspace.onLayoutReady(() => {
      plugin.registerEvent(vault.on("create", (f) => this.changed(f)));
    });
  }

  /** Stops the pending recount (plugin unload). */
  unload(): void {
    this.recount.cancel();
    this.dirty.clear();
  }

  counts(file: TFile, seed?: Seed, unit?: PieceUnit): Promise<Counts> {
    return this.cache.get(file, { seed, characters: (unit ?? this.unit(file)) !== "words" });
  }

  /** `unit`: what the caller reads ("words" for totals); default the note's own unit. */
  peek(path: string, unit?: PieceUnit): Counts | undefined {
    if (unit === "words") return this.cache.peek(path);
    const f = unit === undefined ? this.plugin.app.vault.getAbstractFileByPath(path) : null;
    return this.cache.peek(path, unit !== undefined || (f instanceof TFile && this.unit(f) !== "words"));
  }

  unit(file: TFile): PieceUnit {
    return readUnit(this.plugin.books.frontmatter(file), this.plugin.settings);
  }

  async note(file: TFile, pieceOverride?: Piece): Promise<NoteMeasure> {
    let counts = await this.counts(file, undefined, pieceOverride?.unit);
    // read after the await, so a frontmatter edit made meanwhile shows
    const piece = pieceOverride ?? this.plugin.books.classify(file).piece;
    const unit = piece?.unit ?? this.unit(file);
    // counted in characters now: a hit when they were counted, else one more read
    if (unit !== "words") counts = await this.counts(file, undefined, unit);
    return { counts, piece, unit, progress: noteProgress(counts, piece, unit) };
  }

  async book(book: Book): Promise<BookMeasure> {
    const files = this.plugin.books.chapters(book).map((c) => c.file);
    // in parallel: reads of the same file are shared
    const list = await Promise.all(files.map((f) => this.counts(f)));
    return { counts: sumCounts(list), chapters: files.length, ...this.bookGoal(book) };
  }

  bookGoal(book: Book): BookGoal {
    return readBookGoal(this.plugin.books.frontmatter(book.note), this.plugin.settings);
  }

  bookPeek(book: Book): Counts | undefined {
    const list: Counts[] = [];
    for (const c of this.plugin.books.chapters(book)) {
      const v = this.cache.peek(c.file.path);
      if (!v) return undefined;
      list.push(v);
    }
    return sumCounts(list);
  }

  onChange(cb: (paths: string[]) => void): () => void {
    return this.cache.onChange(cb);
  }

  private changed(f: TAbstractFile): void {
    if (!(f instanceof TFile) || f.extension !== "md") return;
    this.dirty.add(f.path);
    this.recount();
  }

  /** Recounts the changed files that are already counted or tracked; the cache emits what changed. */
  private flush(): void {
    const paths = [...this.dirty];
    this.dirty.clear();
    const { vault } = this.plugin.app;
    for (const path of paths) {
      const f = vault.getAbstractFileByPath(path);
      if (!(f instanceof TFile)) continue;
      const p = this.plugin.books.classify(f);
      if (p.snapshot) continue;
      if (this.cache.peek(f.path) === undefined && !p.tracked) continue;
      this.counts(f).catch((e) => console.error(`Escrita: couldn't count ${f.path}`, e));
    }
  }
}
