// Word counts in the file explorer (SF 6): next to tracked notes and chapters
// in the note's own unit, next to books (note, folder, chapters folder) the
// book's words, and, with the toggle, folder totals. Drawn through
// plugin.decorations ("count"); the numbers come from plugin.measure, so
// nothing is read again on update. The pure parts are in ./counts.ts.

import { TFile, TFolder, debounce, type Editor, type MarkdownFileInfo, type MarkdownView, type TAbstractFile } from "obsidian";
import type EscritaPlugin from "../main";
import { FeatureModule } from "../core/module-context";
import type { FeatureId } from "../core/features";
import type { ExplorerItem, Decoration } from "../core/explorer-decorations";
import { ancestors, inBook, inSnapshots } from "../core/classify";
import type { Book } from "../core/books";
import { measureText, noteProgress, type Counts } from "../core/measure";
import { fmt, lang, t, unitAmount } from "../i18n";
import { abbreviate, countLabel, explorerTotals, stateClass, type Abbrev, type BookShape, type NumFmt, type Totals } from "./counts";

/** files counted concurrently per step of the first pass */
const BATCH = 40;
/** how long changes gather before the affected items are redrawn */
const DRAW_MS = 300;
/** how long typing pauses before the active note's count is updated from the editor */
const LIVE_MS = 500;

interface Last {
  folders: boolean;
  target: boolean;
  /** settings that change which files are tracked or what a book is */
  tracked: string;
  /** settings that change a note's unit or target */
  props: string;
}

export class ExplorerModule extends FeatureModule {
  readonly id: FeatureId = "explorerCounts";
  private loaded = false;
  /** the first pass is done: counts may be drawn */
  private ready = false;
  /** bumps on every first pass (and unload) so a stale one stops */
  private generation = 0;
  /** tracked .md paths (for folder totals) */
  private tracked = new Set<string>();
  /** the active note's counts from its editor, ahead of the save */
  private live: { path: string; counts: Counts } | null = null;
  /** null: recompute on the next draw */
  private totals: Totals | null = null;
  /** the books whose note is tracked; null: list again */
  private shapes: BookShape[] | null = null;
  private pending = new Set<string>();
  private last: Last | null = null;
  private abbrev: Abbrev = { k: "{n}k", m: "{n}M" };
  private liveEditor: { editor: Editor; file: TFile } | null = null;

  private readonly num: NumFmt = (n, d) => n.toLocaleString(lang(), { maximumFractionDigits: d });

  private drawSoon = debounce(() => this.drawPending(), DRAW_MS, true);
  private fullSoon = debounce(() => this.redrawAll(), DRAW_MS, true);
  private liveSoon = debounce(() => this.liveNow(), LIVE_MS, true);
  /** a moved folder can bring notes into the tracked folders that were never counted */
  private rebuildSoon = debounce(() => { void this.rebuild(); }, DRAW_MS, true);

  constructor(private plugin: EscritaPlugin) {
    super();
  }

  onload(): void {
    const p = this.plugin;
    this.loaded = true;
    this.last = this.snapshot();
    this.abbrev = { k: t("explorer.thousands"), m: t("explorer.millions") };
    this.ctx.decorate("count", (it) => this.draw(it));
    this.register(p.measure.onChange((paths) => this.changed(paths)));

    this.ctx.onLayoutReady(() => {
      if (!this.loaded) return;
      const { vault, metadataCache, workspace } = p.app;
      // Registered after layout ready so the vault's initial "create" events are skipped.
      this.registerEvent(vault.on("create", (f) => this.structure(f)));
      this.registerEvent(vault.on("delete", (f) => {
        this.forgetTracked(f.path, f instanceof TFolder);
        this.structure(f);
      }));
      this.registerEvent(vault.on("rename", (f, oldPath) => {
        if (f instanceof TFolder) this.forgetTracked(oldPath, true);
        this.structure(f, oldPath);
      }));
      // a new unit, target or limit changes no count, so measure stays silent
      this.registerEvent(metadataCache.on("changed", (f) => this.propsChanged(f)));
      this.registerEvent(workspace.on("editor-change", (editor, info) => this.typed(editor, info)));
      if (p.settings.explorerCounts) void this.rebuild();
    });
  }

  onunload(): void {
    this.loaded = false;
    this.ready = false;
    this.generation++;
    this.drawSoon.cancel();
    this.fullSoon.cancel();
    this.liveSoon.cancel();
    this.rebuildSoon.cancel();
    this.reset();
  }

  settingsChanged(): void {
    const now = this.snapshot();
    const was = this.last ?? now;
    this.last = now;
    const p = this.plugin;
    if (now.tracked !== was.tracked) {
      if (p.app.workspace.layoutReady) void this.rebuild();
      return;
    }
    if (now.folders !== was.folders || now.target !== was.target || now.props !== was.props) {
      this.totals = null;
      p.decorations.refresh("count");
    }
  }

  // ---------------------------------------------------------------- counting

  private snapshot(): Last {
    const s = this.plugin.settings;
    return {
      folders: s.explorerFolderTotals,
      target: s.explorerShowTarget,
      tracked: JSON.stringify([s.trackFolders, s.excludeFolders, s.chaptersFolder, s.chapterTemplate, s.snapshotsFolder]),
      props: JSON.stringify([s.targetProperty, s.limitProperty, s.unitProperty]),
    };
  }

  private reset(): void {
    this.tracked.clear();
    this.pending.clear();
    this.live = null;
    this.liveEditor = null;
    this.totals = null;
    this.shapes = null;
  }

  /** The first pass: counts every tracked note and every chapter of a tracked book, then draws everything once. */
  private async rebuild(): Promise<void> {
    const gen = ++this.generation;
    const { books, measure } = this.plugin;
    const tracked = new Set<string>();
    const files = new Map<string, TFile>();
    try {
      for (const f of this.plugin.app.vault.getMarkdownFiles()) {
        if (!books.classify(f).tracked) continue;
        tracked.add(f.path);
        files.set(f.path, f);
      }
      this.shapes = null;
      for (const b of this.bookList()) {
        for (const c of books.chapters(b.book)) files.set(c.file.path, c.file);
      }
    } catch (e) {
      console.error("Escrita: could not list the notes to count for the file explorer", e);
      return;
    }
    this.tracked = tracked;
    const list = [...files.values()];
    for (let i = 0; i < list.length; i += BATCH) {
      if (gen !== this.generation || !this.loaded) return;
      await Promise.all(list.slice(i, i + BATCH).map((f) =>
        measure.counts(f).catch((e) => console.error(`Escrita: couldn't count ${f.path}`, e))));
      await sleep(0);
    }
    if (gen !== this.generation || !this.loaded) return;
    this.ready = true;
    this.totals = null;
    this.pending.clear();
    this.plugin.decorations.refresh("count");
  }

  /** From measure.onChange: counts were added, changed, dropped or renamed. */
  private changed(paths: string[]): void {
    if (!this.loaded || !this.plugin.settings.explorerCounts) return;
    const { vault } = this.plugin.app;
    for (const path of paths) {
      if (this.live?.path === path) this.live = null;
      const f = vault.getAbstractFileByPath(path);
      if (!(f instanceof TFile) || f.extension !== "md") {
        this.tracked.delete(path);
        continue;
      }
      if (this.plugin.books.classify(f).tracked) {
        this.tracked.add(path);
        // a note renamed or moved in that was never counted: its count lands back here
        if (this.plugin.measure.peek(path) === undefined) {
          this.plugin.measure.counts(f).catch((e) => console.error(`Escrita: couldn't count ${path}`, e));
        }
      } else {
        this.tracked.delete(path);
      }
    }
    this.touch(paths);
  }

  /**
   * A frontmatter edit: a new target, limit or unit redraws. A note now counted
   * in characters that was counted in words only is counted again (the count lands in changed()).
   */
  private propsChanged(f: TFile): void {
    if (this.ready && this.plugin.settings.explorerCounts && this.tracked.has(f.path)
      && this.plugin.measure.peek(f.path) === undefined && this.plugin.measure.peek(f.path, "words") !== undefined) {
      this.plugin.measure.counts(f).catch((e) => console.error(`Escrita: couldn't count ${f.path}`, e));
    }
    this.touch([f.path]);
  }

  /** Redraws the paths, their folders and their books soon. */
  private touch(paths: Iterable<string>): void {
    if (!this.ready || !this.plugin.settings.explorerCounts) return;
    this.totals = null;
    const shapes = this.bookShapes();
    for (const path of paths) {
      this.pending.add(path);
      for (const dir of ancestors(path)) this.pending.add(dir);
      for (const b of shapes) {
        if (inBook(path, { note: { path: b.note }, folder: { path: b.folder } })) this.pending.add(b.note);
      }
    }
    this.drawSoon();
  }

  /** A file or folder appeared, went or moved: books and the tracked set may have changed. */
  private structure(f: TAbstractFile, oldPath?: string): void {
    // snapshots are never books or tracked (and their folders are named like notes: "x.md/")
    const s = this.plugin.settings;
    if (inSnapshots(f.path, s) && (oldPath === undefined || inSnapshots(oldPath, s))) return;
    this.shapes = null;
    this.totals = null;
    if (!this.ready || !s.explorerCounts) return;
    if (f instanceof TFolder && oldPath !== undefined) this.rebuildSoon();
    else if (f instanceof TFolder || f.path.endsWith(".md") || oldPath?.endsWith(".md")) this.fullSoon();
  }

  private forgetTracked(path: string, folder: boolean): void {
    if (!folder) {
      this.tracked.delete(path);
      return;
    }
    for (const p of [...this.tracked]) if (p.startsWith(`${path}/`)) this.tracked.delete(p);
  }

  private typed(editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
    if (!this.ready || !this.plugin.settings.explorerCounts) return;
    const file = info.file;
    if (!(file instanceof TFile) || file.extension !== "md") return;
    this.liveEditor = { editor, file };
    this.liveSoon();
  }

  /** The active note's counts from its editor, so the explorer follows typing before the save. */
  private liveNow(): void {
    const cur = this.liveEditor;
    this.liveEditor = null;
    if (!cur || !this.ready || !this.plugin.settings.explorerCounts) return;
    const { editor, file } = cur;
    if (this.plugin.app.vault.getAbstractFileByPath(file.path) !== file) return;
    const p = this.plugin.books.classify(file);
    if (!p.tracked && !this.isChapterOfShownBook(file.path)) return;
    let counts: Counts;
    try {
      counts = measureText(editor.getValue());
    } catch (e) {
      console.error(`Escrita: couldn't count ${file.path}`, e);
      return;
    }
    this.live = { path: file.path, counts };
    this.touch([file.path]);
  }

  private isChapterOfShownBook(path: string): boolean {
    return this.bookShapes().some((b) => b.chapters.includes(path));
  }

  // ---------------------------------------------------------------- drawing

  private drawPending(): void {
    const paths = [...this.pending];
    this.pending.clear();
    if (paths.length) this.plugin.decorations.refresh("count", paths);
  }

  private redrawAll(): void {
    this.pending.clear();
    this.totals = null;
    this.countNewChapters();
    this.plugin.decorations.refresh("count");
  }

  /**
   * An untracked chapter of a shown book that appeared since the first pass is
   * counted by nobody else (measure recounts only counted or tracked files); its
   * count lands back in changed().
   */
  private countNewChapters(): void {
    const { vault } = this.plugin.app;
    for (const b of this.bookShapes()) {
      for (const path of b.chapters) {
        if (this.plugin.measure.peek(path) !== undefined) continue;
        const f = vault.getAbstractFileByPath(path);
        if (f instanceof TFile) this.plugin.measure.counts(f).catch((e) => console.error(`Escrita: couldn't count ${path}`, e));
      }
    }
  }

  /** `unit` "words" for totals; default the note's own unit (its characters, when it is counted in them). */
  private countsOf(path: string, unit?: "words"): Counts | undefined {
    return this.live?.path === path ? this.live.counts : this.plugin.measure.peek(path, unit);
  }

  private bookList(): { book: Book; shape: BookShape }[] {
    const { books } = this.plugin;
    return books.allBooks()
      .filter((b) => books.classify(b.note).tracked)
      .map((book) => ({
        book,
        shape: {
          note: book.note.path,
          folder: book.folder.path,
          chaptersFolder: book.chaptersFolder.path,
          chapters: books.chapters(book).map((c) => c.file.path),
        },
      }));
  }

  private bookShapes(): BookShape[] {
    if (!this.shapes) {
      try {
        this.shapes = this.bookList().map((b) => b.shape);
      } catch (e) {
        console.error("Escrita: could not list the books for the file explorer", e);
        this.shapes = [];
      }
    }
    return this.shapes;
  }

  private ensureTotals(): Totals {
    if (this.totals) return this.totals;
    const words = new Map<string, number>();
    for (const path of this.tracked) {
      const c = this.countsOf(path, "words");
      if (c) words.set(path, c.words);
    }
    const shapes = this.bookShapes();
    const chapterWords = new Map<string, number>();
    for (const b of shapes) {
      for (const path of b.chapters) {
        const c = this.countsOf(path, "words");
        if (c) chapterWords.set(path, c.words);
      }
    }
    this.totals = explorerTotals({ words, books: shapes, chapterWords, folderTotals: this.plugin.settings.explorerFolderTotals });
    return this.totals;
  }

  /** The drawer: cheap, no I/O. */
  private draw(item: ExplorerItem): Decoration | null {
    if (!this.ready || !this.plugin.settings.explorerCounts) return null;
    const totals = this.ensureTotals();
    const book = totals.books.get(item.path);
    if (book) {
      const amount = unitAmount("words", book.words);
      return {
        text: abbreviate(book.words, this.num, this.abbrev),
        tooltip: t(book.role === "chapters" ? "explorer.tip.chapters" : "explorer.tip.book", { amount }),
      };
    }
    if (item.folder) {
      const n = totals.folders.get(item.path);
      if (n === undefined) return null;
      return {
        text: abbreviate(n, this.num, this.abbrev),
        tooltip: t("explorer.tip.folder", { amount: unitAmount("words", n) }),
      };
    }
    if (!item.path.endsWith(".md")) return null;
    const file = this.plugin.app.vault.getAbstractFileByPath(item.path);
    if (!(file instanceof TFile)) return null;
    const p = this.plugin.books.classify(file);
    // a book note without its total (a chapter still uncounted) shows nothing rather than its own words
    if (!p.tracked || p.kind === "book-note") return null;
    const counts = this.countsOf(item.path);
    if (!counts) return null;
    const unit = p.piece?.unit ?? this.plugin.measure.unit(file);
    const progress = noteProgress(counts, p.piece, unit);
    const label = countLabel(progress, { showTarget: this.plugin.settings.explorerShowTarget, fmt: this.num, abbrev: this.abbrev });
    const amount = unitAmount(progress.unit, progress.count);
    const tooltip = progress.target !== undefined
      ? t("explorer.tip.target", { amount, target: fmt(progress.target) })
      : progress.limit !== undefined
        ? t("explorer.tip.limit", { amount, limit: fmt(progress.limit) })
        : amount;
    return { text: label.text, tooltip, cls: stateClass(label.state) };
  }
}
