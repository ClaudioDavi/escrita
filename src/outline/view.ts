import {
  ItemView, MarkdownView, Menu, Notice, Platform, TAbstractFile, TFile, WorkspaceLeaf, debounce, setIcon, setTooltip,
  type ViewStateResult,
} from "obsidian";
import type EscritaPlugin from "../main";
import type { Book } from "../core/books";
import { inBook, inSnapshots } from "../core/classify";
import { beatLine, parseBeats, type BeatMarker } from "../core/markers";
import { guardedEdit } from "../core/note-text";
import { statusColor } from "../core/stages";
import { fmt, plural, t, unitAmount } from "../i18n";
import { noteProgress, readChapterDefault, type Piece, type Progress } from "../core/measure";
import { appendBeat, insertBeat, insertFirstBeat, isBlankBody, moveBeatOut, removeBeat, setBeatText } from "./beats-edit";
import {
  beatLetter, chapterAsBeatText, decideKey, decideNoteKey, dropIndex, moveItem, resolveTarget,
  type ActiveFile, type Field, type KeyAction, type OutlineTarget,
} from "./model";
import { confirmAction } from "./modals";
import { errorMessage } from "./errors";
import { loadRows, type ChapterRow as LoadedRow, type RowsPort } from "./rows";
import {
  canReorder, filterActive, povValue, rowMatches, type PovColor, type RowFilter,
} from "./pov";
import {
  headerModel, povCss, pruneFilter, renderChips, renderColorToggle, showPovMenu, summaryText,
  type ChipModel, type ColorBy,
} from "./header";
import { renderPieceBar } from "./bar";

export const OUTLINE_VIEW = "escrita-outline";

interface ChapterRow {
  file: TFile;
  /** 0-based position */
  index: number;
  /** the number as written in the file name, or the position */
  label: string;
  title: string;
  summary: string;
  status: string;
  words: number;
  beats: BeatMarker[];
  placeholders: number;
  bodyBlank: boolean;
  /** the row loader's row (chapters only): stage, POV, piece, count and progress for the stripe, chips and bar */
  data?: LoadedRow;
}

/** The row loader's row as the panel's own, keyed by file (0.7 plan 2.2). */
export function toViewRow(row: LoadedRow, file: TFile): ChapterRow {
  return {
    file,
    index: row.index,
    label: row.label,
    title: row.title,
    summary: row.summary,
    status: row.status,
    words: row.words,
    beats: row.beats,
    placeholders: row.placeholders,
    bodyBlank: row.bodyBlank,
    data: row,
  };
}

/**
 * What `rows.loadRows` needs from Obsidian, for the panel and the board. `files` maps
 * each chapter path of the book being loaded to its file.
 */
export function chaptersPort(plugin: EscritaPlugin): { port: RowsPort<Book>; files: Map<string, TFile> } {
  const files = new Map<string, TFile>();
  const { app, books, settings } = plugin;
  const fileAt = (path: string): TFile => files.get(path) as TFile;
  const port: RowsPort<Book> = {
    chapters: (book) => books.chapters(book).map((ch) => {
      files.set(ch.file.path, ch.file);
      return { path: ch.file.path, basename: ch.file.basename };
    }),
    read: async (path) => {
      const file = fileAt(path);
      return { text: await app.vault.cachedRead(file), mtime: file.stat.mtime };
    },
    frontmatter: (path) => books.frontmatter(fileAt(path)),
    counts: (path, seed, unit) => plugin.measure.counts(fileAt(path), seed, unit),
    placeholders: (path) => (plugin.features.isOn("placeholders") ? plugin.placeholders.countFor(path) : 0),
    chapterDefault: (book) => readChapterDefault(books.frontmatter(book.note), settings),
    resolvePov: (value, path) => povValue(value, (link) => {
      const dest = app.metadataCache.getFirstLinkpathDest(link, path);
      if (dest) return { path: dest.path, name: dest.basename };
      return plugin.names.entryFor(link, path);
    }),
    settings: () => settings,
    stages: () => settings.stages,
  };
  return { port, files };
}

interface LineInfo {
  field: Field;
  row?: ChapterRow;
  beat?: number;
  /**
   * for "new" lines: the chapter the line sits before (null = the last line).
   * Positions are looked up from it when the line is used, never stored.
   */
  before?: TFile | null;
}

type FocusTarget =
  | { kind: "title" | "summary"; file: TFile; caret?: "start" | "end" | "all" }
  | { kind: "beat"; file: TFile; beat: number; caret?: "start" | "end" | "all" }
  | { kind: "new"; before: TFile | null };

interface RowEls {
  row: ChapterRow;
  group: HTMLElement;
  /** title, summary and meta exist for chapters, not for a single note */
  title?: HTMLElement;
  summary?: HTMLElement;
  meta?: HTMLElement;
  /** the stripe and the bar under the title line */
  stripe?: HTMLElement;
  bar?: HTMLElement;
  beats: { el: HTMLElement; text: HTMLElement }[];
}

/** A single note shown on its own (not in a book): its beats and its length. */
interface NoteState {
  row: ChapterRow;
  piece: Piece | null;
  /** its length in its unit (the piece's, else its unit property, else words) against a target or limit */
  progress: Progress;
}

/** A property value as text, as the panel and the board show it. */
export function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(str).join(", ");
  return String(v);
}

function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, " ");
}

function fieldText(el: HTMLElement): string {
  return oneLine(el.textContent ?? "");
}

/** Make a non-field element work like a button from the keyboard. */
function buttonize(el: HTMLElement, label: string, onActivate: (e: KeyboardEvent | MouseEvent) => void): void {
  el.setAttr("role", "button");
  el.setAttr("tabindex", "0");
  el.setAttr("aria-label", label);
  el.addEventListener("click", onActivate);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate(e); }
  });
}

/**
 * The outline panel: chapters and their beats for one book, editable in
 * place; or, for a note outside any book, that note's beats.
 */
export class OutlineView extends ItemView {
  /** what is shown: a book, a single note, or the empty state */
  private target: OutlineTarget = { mode: "empty" };
  private bookPath: string | null = null;
  private book: Book | null = null;
  private note: NoteState | null = null;
  private rows: ChapterRow[] = [];
  private rowEls: RowEls[] = [];
  private lines = new WeakMap<HTMLElement, LineInfo>();
  /** a "new chapter" line opened between chapters: the chapter it sits before */
  private draftBefore: TFile | null = null;
  private pendingFocus: FocusTarget | null = null;
  private dirty = false;
  private busy = false;
  private token = 0;
  /** a forced refresh is in flight; a later refresh that supersedes it inherits the force */
  private forceNext = false;
  private dragFile: TFile | null = null;
  /** active file path when the book was last resolved (undefined = never) */
  private lastActive: string | null | undefined = undefined;
  private statsEl: HTMLElement | null = null;
  private progressEl: HTMLElement | null = null;
  private chipsEl: HTMLElement | null = null;
  /** Q43: what the stripe follows; kept in the view's state, so Obsidian saves it with the layout */
  private colorBy: ColorBy = "status";
  /** Q44: session only */
  private filter = { stages: new Set<string>(), povs: new Set<string>() };
  private povExpanded = false;
  /** re-fits the POV chips to the width (the observer calls it when the width changes) */
  private refitChips: (() => void) | null = null;
  private chipsObserver: ResizeObserver | null = null;
  private chipsWidth = 0;
  /** Q42: the colour of each POV key in the book shown */
  private colors: Record<string, PovColor> = {};
  private closeMenu: (() => void) | null = null;

  private requestRefresh = debounce(() => { void this.refresh(); }, 300, true);

  constructor(leaf: WorkspaceLeaf, private plugin: EscritaPlugin) {
    super(leaf);
  }

  getViewType(): string { return OUTLINE_VIEW; }
  getDisplayText(): string { return t("outline.viewTitle"); }
  getIcon(): string { return "list-tree"; }

  getState(): Record<string, unknown> {
    const note = this.target.mode === "note" ? this.target.path : undefined;
    return { ...super.getState(), book: this.bookPath, note, colorBy: this.colorBy };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = state as { book?: unknown; note?: unknown; colorBy?: unknown } | null;
    this.colorBy = s?.colorBy === "pov" ? "pov" : "status";
    if (s && typeof s.book === "string") {
      this.bookPath = s.book;
      this.target = { mode: "book", path: s.book };
    }
    if (s && typeof s.note === "string") this.target = { mode: "note", path: s.note };
    await super.setState(state, result);
    this.requestRefresh();
  }

  /** Show a given book (by its note path). */
  showBook(notePath: string): void {
    if (this.bookPath !== notePath) this.clearFilter();
    this.bookPath = notePath;
    this.target = { mode: "book", path: notePath };
    this.draftBefore = null;
    void this.refresh(true);
  }

  /** The book currently shown, if any. */
  currentBook(): Book | null {
    return this.book;
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("escrita-outline");
    const { workspace, vault, metadataCache } = this.app;
    this.registerEvent(workspace.on("active-leaf-change", () => this.requestRefresh()));
    this.registerEvent(workspace.on("file-open", () => this.requestRefresh()));
    this.registerEvent(metadataCache.on("changed", (file) => { if (this.concerns(file.path)) this.requestRefresh(); }));
    const onFs = (file: TAbstractFile, oldPath?: string) => {
      // Snapshots are never part of a book or a note's outline (classify's
      // snapshot rule, by path so deleted snapshot files count too).
      const s = this.plugin.settings;
      if (inSnapshots(file.path, s) && (oldPath === undefined || inSnapshots(oldPath, s))) return;
      // A single note renamed: keep showing it under its new path.
      if (oldPath !== undefined && this.target.mode === "note" && this.target.path === oldPath) {
        this.target = { mode: "note", path: file.path };
        if (this.lastActive === oldPath) this.lastActive = file.path;
      }
      if (this.target.mode !== "book" || this.concerns(file.path) || (oldPath !== undefined && this.concerns(oldPath))) this.requestRefresh();
    };
    this.registerEvent(vault.on("create", (f) => onFs(f)));
    this.registerEvent(vault.on("delete", (f) => onFs(f)));
    this.registerEvent(vault.on("rename", (f, old) => onFs(f, old)));
    // Placeholder badges: the index only notifies when some file's markers change.
    this.register(this.plugin.placeholders.onChange(() => { if (this.book) this.requestRefresh(); }));
    // Switching placeholders on or off changes every row's badge: the badges count 0 while it is off.
    this.register(this.plugin.features.onChange((id) => { if (id === "placeholders" && this.book) this.requestRefresh(); }));
    this.registerDomEvent(this.contentEl, "focusout", () => {
      this.contentEl.win.setTimeout(() => {
        if ((this.book || this.note) && this.dirty && !this.fieldFocused() && !this.busy) void this.refresh(true);
      }, 0);
    });
    await this.refresh(true);
  }

  async onClose(): Promise<void> {
    // Drop a queued refresh and any in flight, so nothing renders into the closed view.
    this.requestRefresh.cancel();
    this.closeMenu?.();
    this.chipsObserver?.disconnect();
    this.chipsObserver = null;
    this.token++;
    this.book = null;
    this.note = null;
    this.contentEl.empty();
  }

  /** Called when settings change. */
  settingsChanged(): void {
    void this.refresh();
  }

  private concerns(path: string): boolean {
    if (this.target.mode === "note") return path === this.target.path;
    const b = this.book;
    if (!b) return false;
    return inBook(path, b);
  }

  private fieldFocused(): boolean {
    const a = this.contentEl.doc.activeElement;
    return !!a && this.contentEl.contains(a) && a.classList.contains("escrita-outline-field");
  }

  // ------------------------------------------------------------------ data

  /** Decide what to show (see `resolveTarget`) and remember it. */
  private resolve(): OutlineTarget {
    const { books } = this.plugin;
    const file = this.app.workspace.getActiveFile();
    const p = books.classify(file);
    const active: ActiveFile | null = file
      ? { path: p.path, markdown: p.markdown, bookPath: p.book?.note.path ?? null }
      : null;
    const r = resolveTarget({
      active,
      lastActive: this.lastActive,
      shown: this.target,
      bookPath: this.bookPath,
      valid: (mode, path) => books.classify(path).kind === (mode === "book" ? "book-note" : "note"),
    });
    this.lastActive = r.lastActive;
    if (r.target.mode === "book") {
      if (this.bookPath !== r.target.path) { this.draftBefore = null; this.clearFilter(); }
      this.bookPath = r.target.path;
    }
    this.target = r.target;
    return r.target;
  }

  private bookAt(path: string): Book | null {
    const p = this.plugin.books.classify(path);
    return p.kind === "book-note" ? p.book : null;
  }

  private async loadNote(file: TFile): Promise<NoteState> {
    const mtime = file.stat.mtime;
    const text = await this.app.vault.cachedRead(file);
    const piece = this.plugin.books.classify(file).piece;
    const unit = piece?.unit ?? this.plugin.measure.unit(file);
    // the text just read seeds the count, so a miss doesn't read the file again
    const counts = await this.plugin.measure.counts(file, { text, mtime }, unit);
    return {
      piece,
      progress: noteProgress(counts, piece, unit),
      row: {
        file,
        index: 0,
        label: "",
        title: file.basename,
        summary: "",
        status: "",
        words: counts.words,
        beats: parseBeats(text),
        placeholders: 0,
        bodyBlank: isBlankBody(text),
      },
    };
  }

  private async loadRows(book: Book): Promise<ChapterRow[]> {
    const { port, files } = chaptersPort(this.plugin);
    const s = this.plugin.settings;
    const rows = await loadRows(port, book);
    // Q42: rows call colorsFor when they load, so a POV seen for the first time gets the next free colour
    this.colors = this.plugin.outline.colorsFor(rows.flatMap((r) => (r.pov ? [r.pov.key] : [])));
    return rows.map((row) => {
      const file = files.get(row.path) as TFile;
      const fm = this.plugin.books.frontmatter(file);
      // summary and status as written, as the panel always showed them (the row's are one line and trimmed)
      return { ...toViewRow(row, file), summary: str(fm[s.summaryProperty]), status: str(fm[s.statusProperty]) };
    });
  }

  /** Reload and re-render. Without `force`, only counts are patched while a field has focus. */
  async refresh(force = false): Promise<void> {
    if (force) this.forceNext = true;
    const token = ++this.token;
    const target = this.resolve();
    if (target.mode === "note") {
      await this.refreshNote(target.path, token);
      return;
    }
    const book = target.mode === "book" ? this.bookAt(target.path) : null;
    if (!book) {
      if (!this.forceNext && this.fieldFocused()) return;
      this.forceNext = false;
      this.book = null;
      this.note = null;
      this.rows = [];
      this.renderNoBook();
      return;
    }
    let rows: ChapterRow[];
    try {
      rows = await this.loadRows(book);
    } catch (e) {
      console.error("Escrita: could not load the outline", e);
      return;
    }
    if (token !== this.token) return;
    this.pruneFilter(rows);
    const sameBook = this.book?.note.path === book.note.path;
    if (!this.forceNext && sameBook && this.fieldFocused()) {
      // Keep `rows` matching what the panel shows until it can be re-rendered.
      if (!this.patch(rows)) this.dirty = true;
      return;
    }
    this.book = book;
    this.note = null;
    this.rows = rows;
    this.forceNext = false;
    this.render();
  }

  private async refreshNote(path: string, token: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    let note: NoteState;
    try {
      note = await this.loadNote(file);
    } catch (e) {
      console.error("Escrita: could not load the outline", e);
      return;
    }
    if (token !== this.token) return;
    const same = this.note?.row.file === file && !this.book;
    if (!this.forceNext && this.fieldFocused()) {
      // Never re-render under the caret: patch in place, or wait for the field to lose focus.
      if (!same || !this.patchNote(note)) this.dirty = true;
      return;
    }
    this.book = null;
    this.note = note;
    this.rows = [note.row];
    this.forceNext = false;
    this.renderNote();
  }

  // ------------------------------------------------------------------ rendering

  private renderNoBook(note?: NoteState): void {
    const el = this.contentEl;
    el.empty();
    this.rowEls = [];
    this.lines = new WeakMap();
    if (note) {
      // A note without beats: offer its first beat, above the usual book options.
      this.renderNoteHeader(el, note);
      const first = el.createDiv({ cls: "escrita-outline-empty escrita-outline-note-empty" });
      first.createEl("p", { text: t("outline.note.noBeats") });
      const add = first.createEl("button", { cls: "mod-cta", text: t("outline.note.addFirst") });
      add.addEventListener("click", () => { void this.addFirstBeat(note.row.file); });
    }
    const books = this.plugin.books.allBooks();
    const box = el.createDiv({ cls: "escrita-outline-empty" });
    if (books.length) {
      box.createDiv({ cls: "escrita-outline-empty-title", text: t("outline.pick") });
      const list = box.createDiv({ cls: "escrita-outline-booklist" });
      for (const b of books) {
        const btn = list.createEl("button", { cls: "escrita-outline-bookbtn", text: b.title });
        btn.addEventListener("click", () => this.showBook(b.note.path));
      }
    } else {
      const folder = this.plugin.settings.chaptersFolder;
      box.createDiv({ cls: "escrita-outline-empty-title", text: t("outline.empty.title") });
      box.createEl("p", { text: t("outline.empty.desc", { folder }) });
      box.createEl("pre", { cls: "escrita-outline-example", text: t("outline.empty.example", { folder }) });
    }
    const create = box.createEl("button", { cls: books.length || note ? "" : "mod-cta", text: t("outline.empty.create") });
    create.addEventListener("click", () => this.plugin.outline.createBook());
  }

  private render(): void {
    const book = this.book;
    if (!book) { this.renderNoBook(); return; }
    this.dirty = false;
    const el = this.contentEl;
    // Save whatever is being typed before the field goes away.
    const focused = el.doc.activeElement;
    if (focused && this.fieldFocused()) void this.commit(focused as HTMLElement);
    const scroll = el.scrollTop;
    el.empty();
    this.rowEls = [];
    this.lines = new WeakMap();

    // Header
    const header = el.createDiv({ cls: "escrita-outline-header" });
    const top = header.createDiv({ cls: "escrita-outline-top" });
    const title = top.createDiv({ cls: "escrita-outline-titlerow" });
    title.createDiv({ cls: "escrita-outline-heading is-book", text: t("outline.viewTitle") });
    const books = this.plugin.books.allBooks();
    if (books.length > 1) {
      const sel = title.createEl("select", { cls: "dropdown escrita-outline-bookselect" });
      sel.setAttr("aria-label", t("outline.bookSelect"));
      for (const b of books) sel.createEl("option", { text: b.title, value: b.note.path });
      sel.value = book.note.path;
      sel.addEventListener("change", () => this.showBook(sel.value));
    } else {
      title.createDiv({ cls: "escrita-outline-book", text: book.title });
    }
    const tools = top.createDiv({ cls: "escrita-outline-tools" });
    renderColorToggle(tools, this.colorBy, (m) => {
      this.colorBy = m;
      this.app.workspace.requestSaveLayout();
      this.render();
    });
    const boardBtn = tools.createEl("button", { cls: "clickable-icon escrita-outline-tool" });
    setIcon(boardBtn, "layout-dashboard");
    setTooltip(boardBtn, t("outline.board"));
    boardBtn.setAttr("aria-label", t("outline.board"));
    boardBtn.addEventListener("click", () => { if (this.book) void this.plugin.outline.openBoard(this.book); });

    this.statsEl = header.createDiv({ cls: "escrita-outline-stats escrita-outline-sumr" });
    this.progressEl = header.createDiv({ cls: "escrita-outline-progress" });
    this.chipsEl = header.createDiv({ cls: "escrita-outline-chipbox" });
    this.observeChips(this.chipsEl);
    this.renderStats();

    // Chapters
    const list = el.createDiv({ cls: "escrita-outline-list" });
    const activePath = this.app.workspace.getActiveFile()?.path;
    this.shownRows(this.rows).forEach((row) => {
      if (this.draftBefore === row.file) this.renderNewLine(list, row.file);
      this.renderChapter(list, row, row.file.path === activePath);
    });
    this.renderNewLine(list, null);

    // Footer
    const foot = el.createDiv({ cls: "escrita-outline-footer" });
    const hint = (keys: string[], text: string) => {
      const h = foot.createDiv({ cls: "escrita-outline-hint" });
      for (const k of keys) h.createEl("kbd", { text: k });
      h.createSpan({ text: text });
    };
    if (Platform.isMobile) {
      // Soft keyboards have no Tab and there is no drag: the ⋯ menus do it all.
      foot.createDiv({ cls: "escrita-outline-hint", text: t("outline.hint.touch") });
    } else {
      hint(["Enter"], t("outline.hint.enter"));
      hint(["Tab"], t("outline.hint.tab"));
      hint(["Shift", "Tab"], t("outline.hint.shiftTab"));
      hint(["⌫"], t("outline.hint.backspace"));
      foot.createDiv({ cls: "escrita-outline-hint", text: t("outline.hint.drag") });
    }

    el.scrollTop = scroll;
    this.applyFocus();
  }

  /** A single note: its title, length against its target or limit, and its beats. */
  private renderNote(): void {
    const note = this.note;
    if (!note) { this.renderNoBook(); return; }
    this.dirty = false;
    if (!note.row.beats.length) { this.renderNoBook(note); this.applyFocus(); return; }
    const el = this.contentEl;
    const scroll = el.scrollTop;
    el.empty();
    this.rowEls = [];
    this.lines = new WeakMap();

    this.renderNoteHeader(el, note);
    const list = el.createDiv({ cls: "escrita-outline-list" });
    const group = list.createDiv({ cls: "escrita-outline-chapter escrita-outline-note" });
    const row = note.row;
    const beats: RowEls["beats"] = row.beats.map((b, i) => this.renderBeat(group, row, b, i));
    this.rowEls.push({ row, group, beats });

    const foot = el.createDiv({ cls: "escrita-outline-footer" });
    if (Platform.isMobile) {
      foot.createDiv({ cls: "escrita-outline-hint", text: t("outline.note.touchHint") });
    } else {
      for (const [keys, text] of [[["Enter"], t("outline.hint.enter")], [["⌫"], t("outline.hint.backspace")]] as const) {
        const h = foot.createDiv({ cls: "escrita-outline-hint" });
        for (const k of keys) h.createEl("kbd", { text: k });
        h.createSpan({ text });
      }
    }

    el.scrollTop = scroll;
    this.applyFocus();
  }

  private renderNoteHeader(el: HTMLElement, note: NoteState): void {
    const header = el.createDiv({ cls: "escrita-outline-header" });
    const top = header.createDiv({ cls: "escrita-outline-top" });
    top.createDiv({ cls: "escrita-outline-heading", text: t("outline.viewTitle") });
    header.createDiv({ cls: "escrita-outline-book", text: note.row.title });
    this.statsEl = header.createDiv({ cls: "escrita-outline-stats" });
    this.progressEl = header.createDiv({ cls: "escrita-outline-progress" });
    this.renderNoteStats(note);
  }

  private renderNoteStats(note: NoteState): void {
    if (!this.statsEl || !this.progressEl) return;
    const stats = this.statsEl;
    stats.empty();
    // a standalone work shows its stage, in the stage's color, before the beats
    const stage = this.plugin.books.classify(note.row.file).stage;
    if (stage) {
      const st = stats.createSpan({ cls: "escrita-outline-stage" });
      const dot = st.createSpan({ cls: "escrita-outline-dot" });
      dot.setAttr("aria-hidden", "true");
      const color = this.plugin.settings.stages[stage]?.color;
      if (color) dot.setCssProps({ "--escrita-dot": color });
      st.createSpan({ text: t(`stage.${stage}`) });
      stats.createSpan({ cls: "escrita-outline-sep", text: " · " });
    }
    stats.createSpan({ text: plural("outline.beats", note.row.beats.length) });
    const g = note.progress;
    const p = this.progressEl;
    p.empty();
    p.toggleClass("is-near", g.state === "near");
    p.toggleClass("is-over", g.state === "over");
    p.toggleClass("is-reached", g.reached);
    if (g.of === null) {
      p.createDiv({ cls: "escrita-outline-progress-text", text: unitAmount(g.unit, g.count) });
      return;
    }
    let text = t("outline.progress", { words: fmt(g.count), goal: unitAmount(g.unit, g.of) });
    if (g.kind === "limit") text += ` ${t("outline.note.limitOnly")}`;
    if (g.kind === "target" && g.limit !== undefined) text += ` · ${t("outline.note.limit", { n: fmt(g.limit) })}`;
    const line = p.createDiv({ cls: "escrita-outline-progress-text", text });
    if (g.state === "over" && g.over > 0) line.createSpan({ cls: "escrita-outline-over", text: ` · ${t("outline.note.over", { n: fmt(g.over) })}` });
    const bar = p.createDiv({ cls: "escrita-outline-bar" });
    bar.createDiv({ cls: "escrita-outline-bar-fill" }).setCssProps({ width: `${(g.fraction * 100).toFixed(1)}%` });
  }

  /** Update a single note's counts and non-focused beat texts in place; false when its beats changed shape. */
  private patchNote(note: NoteState): boolean {
    const els = this.rowEls[0];
    if (!els || els.title || els.row.file !== note.row.file || els.beats.length !== note.row.beats.length) return false;
    if (!note.row.beats.length) return false;
    this.note = note;
    this.rows = [note.row];
    els.row = note.row;
    const focused = this.contentEl.doc.activeElement;
    note.row.beats.forEach((b, j) => {
      const be = els.beats[j];
      be.el.toggleClass("is-written", b.written);
      const check = be.el.querySelector<HTMLElement>(".escrita-outline-check");
      if (check) { check.empty(); if (b.written) setIcon(check, "check"); }
      this.lines.set(be.text, { field: "beat", row: note.row, beat: j });
      if (be.text === focused) return;
      if (fieldText(be.text) !== b.text) be.text.setText(b.text);
      be.text.dataset.original = b.text;
    });
    this.renderNoteStats(note);
    return true;
  }

  /** "Add the first beat": at the top of the note's body, focused for typing. */
  private async addFirstBeat(file: TFile): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const ok = await this.run(() => this.editText(file, (text) => insertFirstBeat(text, "")));
      if (ok) this.pendingFocus = { kind: "beat", file, beat: 0, caret: "end" };
    } finally {
      this.busy = false;
    }
    await this.refresh(true);
  }

  private renderStats(): void {
    if (!this.statsEl || !this.progressEl || !this.book) return;
    const stats = this.statsEl;
    stats.empty();
    const model = this.model(this.rows);
    stats.createSpan({ cls: "escrita-outline-sum", text: summaryText(this.rows.length, model.tally) });
    const words = this.rows.reduce((n, r) => n + r.words, 0);
    const { goal } = this.plugin.measure.bookGoal(this.book);
    const total = stats.createSpan({ cls: "escrita-outline-total" });
    this.progressEl.empty();
    if (goal) {
      total.createSpan({ cls: "escrita-outline-total-now", text: fmt(words) });
      total.createSpan({ text: ` / ${fmt(goal)}` });
      const bar = this.progressEl.createDiv({ cls: "escrita-outline-bar" });
      bar.createDiv({ cls: "escrita-outline-bar-fill" }).setCssProps({ width: `${Math.min(100, (words / goal) * 100).toFixed(1)}%` });
    } else {
      total.setText(unitAmount("words", words));
    }
    this.renderChips(model);
  }

  private observeChips(el: HTMLElement): void {
    this.chipsObserver?.disconnect();
    this.chipsWidth = 0;
    if (typeof ResizeObserver === "undefined") return;
    this.chipsObserver = new ResizeObserver(() => {
      if (el.clientWidth === this.chipsWidth) return;
      this.chipsWidth = el.clientWidth;
      this.refitChips?.();
    });
    this.chipsObserver.observe(el);
  }

  private renderChips(model = this.model(this.rows)): void {
    if (!this.chipsEl) return;
    this.refitChips = renderChips(this.chipsEl, {
      model, filter: this.filter, povExpanded: this.povExpanded,
      shown: this.shownRows(this.rows).length, total: this.rows.length, compact: Platform.isMobile,
    }, {
      toggle: (group, key) => {
        const set = this.filter[group];
        if (!set.delete(key)) set.add(key);
        this.render();
      },
      clear: () => { this.clearFilter(); this.render(); },
      togglePovExpanded: () => { this.povExpanded = !this.povExpanded; this.renderChips(); },
      povMenu: (anchor, chip) => this.openPovMenu(anchor, chip),
    });
  }

  /** The chips, summary and tally for these rows (the whole book, whatever the filter). */
  private model(rows: readonly ChapterRow[]) {
    const { stages, otherStatusColors } = this.plugin.settings;
    return headerModel(
      rows.flatMap((r) => (r.data ? [r.data] : [])), stages,
      (word) => statusColor(word, stages, otherStatusColors), this.colors,
    );
  }

  private get rowFilter(): RowFilter { return this.filter; }

  /** Q44: the rows that pass the filter, in book order. */
  private shownRows(rows: ChapterRow[]): ChapterRow[] {
    if (!filterActive(this.rowFilter)) return rows;
    return rows.filter((r) => r.data && rowMatches(r.data, this.rowFilter));
  }

  private clearFilter(): void {
    this.filter.stages.clear();
    this.filter.povs.clear();
  }

  /** Drop filter keys the book no longer has (a stage or POV that left it). */
  private pruneFilter(rows: ChapterRow[]): void {
    pruneFilter(this.model(rows), this.filter);
  }

  /** Q44: drag and moving chapters are off while a filter hides some of them (rule 1). */
  reorderBlocked(): boolean {
    return !canReorder(this.rowFilter);
  }

  /** Q42: the swatches write `data.povColors` (shared by every book) and ask for a save. */
  private openPovMenu(anchor: HTMLElement, chip: ChipModel): void {
    this.closeMenu?.();
    const current = Object.prototype.hasOwnProperty.call(this.colors, chip.key) ? this.colors[chip.key] : null;
    const path = chip.path;
    const open = path ? () => { void this.openPath(path); } : null;
    const close = showPovMenu(this, anchor, chip, current, (color) => {
      this.plugin.data.povColors[chip.key] = color;
      this.plugin.requestSave();
      this.colors = { ...this.colors, [chip.key]: color };
      this.render();
    }, open);
    this.closeMenu = close;
  }

  private async openPath(path: string): Promise<void> {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) await this.app.workspace.getLeaf(false).openFile(f);
  }

  private renderMeta(meta: HTMLElement, row: ChapterRow): void {
    meta.empty();
    if (row.placeholders > 0) {
      const badge = meta.createSpan({
        cls: "escrita-outline-badge",
        text: t("outline.placeholderBadge", { n: fmt(row.placeholders), marker: this.plugin.settings.placeholderMarker }),
      });
      setTooltip(badge, t("outline.placeholderTip"));
    }
    // The stripe already shows the status in status mode; in POV mode the dot keeps it visible.
    if (row.status && this.colorBy === "pov") {
      const dot = meta.createSpan({ cls: "escrita-outline-dot" });
      const color = statusColor(row.status, this.plugin.settings.stages, this.plugin.settings.otherStatusColors);
      if (color) dot.setCssProps({ "--escrita-dot": color });
      setTooltip(dot, row.status);
      dot.setAttr("role", "img");
      dot.setAttr("aria-label", row.status);
    }
    if (row.words > 0) meta.createSpan({ cls: "escrita-outline-words", text: fmt(row.words) });
    else meta.createSpan({ cls: "escrita-outline-words is-empty", text: t("outline.outlineOnly") });
  }

  private makeField(parent: HTMLElement, cls: string, value: string, placeholder: string, line: LineInfo): HTMLElement {
    const el = parent.createDiv({ cls: `escrita-outline-field ${cls}`, text: value });
    try {
      el.contentEditable = "plaintext-only";
    } catch {
      // older engines reject the value
    }
    if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
    el.setAttr("role", "textbox");
    el.setAttr("aria-label", placeholder);
    el.setAttr("data-placeholder", placeholder);
    el.dataset.original = value;
    this.lines.set(el, line);
    el.addEventListener("input", () => {
      if (fieldText(el) === "" && el.childNodes.length) el.empty();
    });
    el.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/\s*[\r\n]+\s*/g, " ");
      insertPlainText(el, text);
    });
    el.addEventListener("drop", (e) => e.preventDefault());
    el.addEventListener("keydown", (e) => this.onKey(e, el));
    el.addEventListener("blur", () => { void this.commit(el); });
    return el;
  }

  private renderChapter(list: HTMLElement, row: ChapterRow, active: boolean): void {
    const group = list.createDiv({ cls: "escrita-outline-chapter" });
    if (active) group.addClass("is-active");
    const stripe = group.createSpan({ cls: "escrita-outline-stripe" });
    this.paintStripe(group, stripe, row);
    const line = group.createDiv({ cls: "escrita-outline-line" });

    const num = line.createDiv({ cls: "escrita-outline-num", text: row.label });
    buttonize(num, t("outline.menu.open"), (e) => { void this.openFile(row.file, undefined, e.ctrlKey || e.metaKey); });
    setTooltip(num, Platform.isMobile ? t("outline.menu.open") : t("outline.numberTip"));
    num.draggable = !Platform.isMobile && !this.reorderBlocked();
    num.addEventListener("dragstart", (e) => {
      if (this.reorderBlocked()) { e.preventDefault(); return; }
      this.dragFile = row.file;
      e.dataTransfer?.setData("text/plain", row.file.basename);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      group.addClass("is-dragging");
    });
    num.addEventListener("dragend", () => {
      this.dragFile = null;
      group.removeClass("is-dragging");
      this.clearDropMarks();
    });
    group.addEventListener("dragover", (e) => {
      if (!this.dragFile) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      const r = group.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      this.clearDropMarks();
      group.addClass(after ? "is-drop-after" : "is-drop-before");
    });
    group.addEventListener("dragleave", (e) => {
      if (!group.contains(e.relatedTarget as Node | null)) group.removeClass("is-drop-after", "is-drop-before");
    });
    group.addEventListener("drop", (e) => {
      const dragged = this.dragFile;
      if (!dragged) return;
      e.preventDefault();
      const r = group.getBoundingClientRect();
      this.dragFile = null;
      this.clearDropMarks();
      const from = this.indexOf(dragged), target = this.indexOf(row.file);
      if (from < 0 || target < 0) return;
      void this.moveChapter(dragged, dropIndex(from, target, e.clientY > r.top + r.height / 2));
    });
    group.addEventListener("contextmenu", (e) => {
      if ((e.target as HTMLElement).closest(".escrita-outline-beat")) return;
      e.preventDefault();
      this.chapterMenu(row.file).showAtMouseEvent(e);
    });

    const title = this.makeField(line, "escrita-outline-title", row.title, t("outline.titlePlaceholder"), { field: "title", row });
    const meta = line.createDiv({ cls: "escrita-outline-meta" });
    this.renderMeta(meta, row);
    this.moreButton(line, () => this.chapterMenu(row.file));
    const bar = group.createDiv({ cls: "escrita-outline-pbar-box" });
    this.renderBar(bar, row);
    const summary = this.makeField(group, "escrita-outline-summary", row.summary, t("outline.summaryPlaceholder"), { field: "summary", row });

    const beats: RowEls["beats"] = row.beats.map((b, i) => this.renderBeat(group, row, b, i));
    this.rowEls.push({ row, group, title, summary, meta, stripe, bar, beats });
  }

  /** Q43: the stripe's colour follows the toggle: the stage's (or status') colour, or the POV's. */
  private stripeOf(row: ChapterRow): { color: string | null; label: string } {
    if (this.colorBy === "pov") {
      const pov = row.data?.pov;
      if (!pov) return { color: null, label: "" };
      const c = Object.prototype.hasOwnProperty.call(this.colors, pov.key) ? this.colors[pov.key] : null;
      return { color: c ? povCss(c) : null, label: pov.label };
    }
    const { stages, otherStatusColors } = this.plugin.settings;
    return { color: row.status ? statusColor(row.status, stages, otherStatusColors) ?? null : null, label: row.status };
  }

  private paintStripe(group: HTMLElement, stripe: HTMLElement, row: ChapterRow): void {
    const { color, label } = this.stripeOf(row);
    if (color) group.setCssProps({ "--escrita-stripe": color });
    else group.style.removeProperty("--escrita-stripe");
    group.toggleClass("has-stripe", color !== null);
    if (color && label) {
      stripe.setAttr("role", "img");
      stripe.setAttr("aria-label", label);
      setTooltip(stripe, label);
    } else {
      stripe.removeAttribute("role");
      stripe.removeAttribute("aria-label");
    }
  }

  /** Q50: the chapter's bar and its line, from the row's piece (own target, else the book's default). */
  private renderBar(host: HTMLElement, row: ChapterRow): void {
    host.empty();
    const d = row.data;
    if (!d) return;
    const bookDefault = this.book ? readChapterDefault(this.plugin.books.frontmatter(this.book.note), this.plugin.settings) : null;
    renderPieceBar(host, d.progress, d.count, d.piece, d.unit, d.pieceSource === "own" && bookDefault !== null);
  }

  private renderBeat(group: HTMLElement, row: ChapterRow, b: BeatMarker, i: number): RowEls["beats"][number] {
    const bl = group.createDiv({ cls: "escrita-outline-beat" });
    if (b.written) bl.addClass("is-written");
    const letter = bl.createDiv({ cls: "escrita-outline-letter", text: beatLetter(i) });
    // Look the line up when clicked: the beat may have moved since this was drawn.
    buttonize(letter, t("outline.letterTip"), (e) => {
      const cur = this.rows.find((r) => r.file === row.file)?.beats[i] ?? b;
      void this.openFile(row.file, cur.line, e.ctrlKey || e.metaKey);
    });
    setTooltip(letter, t("outline.letterTip"));
    const text = this.makeField(bl, "escrita-outline-beat-text", b.text, t("outline.beatPlaceholder"), { field: "beat", row, beat: i });
    const check = bl.createDiv({ cls: "escrita-outline-check" });
    if (b.written) { setIcon(check, "check"); setTooltip(check, t("outline.writtenTip")); }
    this.moreButton(bl, () => this.beatMenu(row.file, i));
    bl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.beatMenu(row.file, i).showAtMouseEvent(e);
    });
    return { el: bl, text };
  }

  /** A "new chapter" line before chapter `before` (a draft), or the last line (null). */
  private renderNewLine(list: HTMLElement, before: TFile | null): void {
    const draft = before !== null;
    const line = list.createDiv({ cls: "escrita-outline-new" + (draft ? " is-draft" : "") });
    line.createDiv({ cls: "escrita-outline-plus", text: "+" });
    this.makeField(line, "escrita-outline-new-text", "", t("outline.newChapter"), { field: "new", before });
    if (!draft && !Platform.isMobile) line.createDiv({ cls: "escrita-outline-new-hint", text: t("outline.newChapterHint") });
  }

  /** A visible "⋯" button opening a row's menu (the touch path to every action). */
  private moreButton(parent: HTMLElement, menu: () => Menu): void {
    const btn = parent.createEl("button", { cls: "clickable-icon escrita-outline-more" });
    setIcon(btn, "more-horizontal");
    btn.setAttr("aria-label", t("outline.more"));
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = btn.getBoundingClientRect();
      menu().showAtPosition({ x: r.left, y: r.bottom }, btn.doc);
    });
  }

  /** Current 0-based position of a chapter, or -1 when it isn't in the list any more. */
  private indexOf(file: TFile): number {
    return this.rows.findIndex((r) => r.file === file);
  }

  /** The position a new line's chapter will take, or -1 when its neighbour is gone. */
  private newLineAt(line: LineInfo): number {
    return line.before ? this.indexOf(line.before) : this.rows.length;
  }

  private clearDropMarks(): void {
    this.contentEl.querySelectorAll(".is-drop-after, .is-drop-before")
      .forEach((n) => n.removeClass("is-drop-after", "is-drop-before"));
  }

  /**
   * Update counts and non-focused texts in place from `rows`. False (and
   * nothing changed) when the structure differs from what is shown.
   */
  private patch(all: ChapterRow[]): boolean {
    const rows = this.shownRows(all);
    if (rows.length !== this.rowEls.length) return false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i], els = this.rowEls[i];
      if (!els.title || row.file !== els.row.file || row.beats.length !== els.beats.length) return false;
    }
    this.rows = all;
    const activePath = this.app.workspace.getActiveFile()?.path;
    const focused = this.contentEl.doc.activeElement;
    const sync = (el: HTMLElement, value: string, line: LineInfo) => {
      this.lines.set(el, line);
      if (el === focused) return;
      if (fieldText(el) !== value) el.setText(value);
      el.dataset.original = value;
    };
    rows.forEach((row, i) => {
      const els = this.rowEls[i];
      els.row = row;
      els.group.toggleClass("is-active", row.file.path === activePath);
      if (els.stripe) this.paintStripe(els.group, els.stripe, row);
      if (els.bar) this.renderBar(els.bar, row);
      if (els.meta) this.renderMeta(els.meta, row);
      if (els.title) sync(els.title, row.title, { field: "title", row });
      if (els.summary) sync(els.summary, row.summary, { field: "summary", row });
      row.beats.forEach((b, j) => {
        const be = els.beats[j];
        be.el.toggleClass("is-written", b.written);
        const check = be.el.querySelector<HTMLElement>(".escrita-outline-check");
        if (check) { check.empty(); if (b.written) setIcon(check, "check"); }
        sync(be.text, b.text, { field: "beat", row, beat: j });
      });
    });
    this.renderStats();
    return true;
  }

  // ------------------------------------------------------------------ focus

  private fields(): HTMLElement[] {
    return Array.from(this.contentEl.querySelectorAll<HTMLElement>(".escrita-outline-field"));
  }

  private applyFocus(): void {
    const target = this.pendingFocus;
    this.pendingFocus = null;
    if (!target) return;
    let el: HTMLElement | undefined;
    if (target.kind === "new") {
      el = this.fields().find((f) => {
        const l = this.lines.get(f);
        return l?.field === "new" && (l.before ?? null) === target.before;
      });
    } else {
      const re = this.rowEls.find((r) => r.row.file === target.file);
      if (re) {
        if (target.kind === "beat") el = re.beats[target.beat]?.text;
        else el = target.kind === "title" ? re.title : re.summary;
      }
    }
    if (!el) return;
    el.focus();
    setCaret(el, target.kind === "new" ? "end" : target.caret ?? "end");
    el.scrollIntoView({ block: "nearest" });
  }

  private focusSibling(el: HTMLElement, dir: -1 | 1): void {
    const all = this.fields();
    const i = all.indexOf(el);
    const next = all[i + dir];
    if (!next) return;
    next.focus();
    setCaret(next, dir < 0 ? "end" : "start");
    next.scrollIntoView({ block: "nearest" });
  }

  // ------------------------------------------------------------------ editing

  /** Save a field's change (title → rename, summary → frontmatter, beat → file, new → chapter). */
  private async commit(el: HTMLElement): Promise<void> {
    const line = this.lines.get(el);
    if (!line || el.dataset.done === "1") return;
    const value = fieldText(el).trim();
    const isDraft = line.field === "new" && !!line.before && line.before === this.draftBefore;
    if (line.field === "new" && !value) {
      if (isDraft) {
        this.draftBefore = null;
        this.dirty = true;
      }
      return;
    }
    // Compare as the field shows it: a multi-line summary is shown on one
    // line, and just passing through it must not rewrite it.
    if (value === oneLine(el.dataset.original ?? "").trim()) return;

    if (line.field === "new") {
      el.dataset.done = "1";
      if (isDraft) this.draftBefore = null;
      await this.run(async () => {
        const at = this.newLineAt(line);
        if (!this.book || at < 0) throw new Error(t("outline.beatChanged"));
        await this.plugin.chapterOps.createChapterAt(this.book, at, value);
      });
      return;
    }
    const row = line.row;
    if (!row) return;
    el.dataset.original = value;
    if (line.field === "title") {
      if (!value) { el.setText(row.title); el.dataset.original = row.title; return; }
      await this.run(() => this.plugin.chapterOps.retitle(row.file, value));
    } else if (line.field === "summary") {
      await this.run(() => this.app.fileManager.processFrontMatter(row.file, (fm: Record<string, unknown>) => {
        fm[this.plugin.settings.summaryProperty] = value;
      }));
    } else if (line.field === "beat" && line.beat !== undefined) {
      const i = line.beat, expected = row.beats[i]?.text;
      let saved = false;
      await this.run(async () => { saved = await this.editBeats(row.file, i, expected, (text) => setBeatText(text, i, value)); });
      // Remember what is on disk now, so a second edit before the next refresh still matches.
      const b = row.beats[i];
      if (saved && b) row.beats[i] = { ...b, text: parseBeats(beatLine(value))[0]?.text ?? value };
    }
  }

  /**
   * Change a chapter's text through `fn`, but only if beat `i` still has the
   * text the outline showed (the file may have changed since).
   */
  private async editBeats(file: TFile, i: number, expected: string | undefined, fn: (text: string) => string): Promise<boolean> {
    const res = await this.plugin.notes.text(file).apply(guardedEdit(
      expected === undefined ? null : (text) => parseBeats(text)[i]?.text === expected,
      fn,
    ));
    const ok = res.ok;
    if (!ok) {
      new Notice(this.changedMessage());
      void this.refresh(true);
    }
    return ok;
  }

  /** Write `edit`'s text into a chapter through the note text port (the open editor, else the vault). */
  private async editText(file: TFile, edit: (text: string) => string): Promise<void> {
    await this.plugin.notes.text(file).apply(guardedEdit(null, edit));
  }

  private changedMessage(): string {
    return t(this.note ? "outline.note.changed" : "outline.beatChanged");
  }

  /** Run a file operation, reporting errors instead of throwing. */
  private async run(fn: () => Promise<unknown>): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (e) {
      console.error("Escrita:", e);
      new Notice(t("outline.error", { msg: errorMessage(e) }));
      return false;
    }
  }

  private onKey(e: KeyboardEvent, el: HTMLElement): void {
    const line = this.lines.get(el);
    if (!line) return;
    if (e.key === "Escape") {
      // Cancel the edit: restore the text (an unsaved new line just goes away).
      e.preventDefault();
      if (line.field === "new") el.empty();
      else el.setText(el.dataset.original ?? "");
      el.blur();
      return;
    }
    const caret = caretInfo(el);
    const row = line.row;
    const rowEls = row ? this.rowEls.find((r) => r.row.file === row.file) : undefined;
    const decide = this.note ? decideNoteKey : decideKey;
    const action = decide({
      key: e.key,
      shift: e.shiftKey,
      mod: e.ctrlKey || e.metaKey || e.altKey,
      composing: e.isComposing,
      field: line.field,
      value: fieldText(el),
      ...caret,
      chapterIndex: line.field === "new" ? Math.max(0, this.newLineAt(line)) : row ? this.indexOf(row.file) : 0,
      words: row?.words ?? 0,
      bodyBlank: row?.bodyBlank ?? true,
      summaryEmpty: rowEls?.summary ? fieldText(rowEls.summary).trim() === "" : true,
      beatWritten: line.beat !== undefined ? row?.beats[line.beat]?.written ?? false : false,
    });
    if (action.type === "default") return;
    e.preventDefault();
    e.stopPropagation();
    if (action.type === "swallow") return;
    if (action.type === "focus") { this.focusSibling(el, action.dir); return; }
    if (action.type === "blocked") {
      const key = action.reason === "notEmpty"
        ? (e.key === "Tab" ? "outline.blocked.notEmptyTab" : "outline.blocked.notEmptyDelete")
        : `outline.blocked.${action.reason}`;
      new Notice(t(key));
      return;
    }
    this.trigger(action, el);
  }

  /** Run an action for a field (from a key or a menu), one at a time. */
  private trigger(action: KeyAction, el: HTMLElement): void {
    const line = this.lines.get(el);
    if (!line || this.busy) return;
    this.busy = true;
    void this.act(action, el, line).finally(() => {
      this.busy = false;
    });
  }

  /**
   * The chapter's current position. The panel may be showing an older list
   * (a refresh couldn't patch it while you typed), so positions are always
   * looked up by file; -1 means it's gone, and the outline reloads.
   */
  private locate(row: ChapterRow): number {
    const idx = this.indexOf(row.file);
    if (idx < 0 || !row.file.parent) {
      new Notice(this.changedMessage());
      void this.refresh(true);
      return -1;
    }
    return idx;
  }

  private async act(action: KeyAction, el: HTMLElement, line: LineInfo): Promise<void> {
    const book = this.book;
    const note = this.note;
    // A single note only has beats: chapter actions need a book.
    if (!book && !(note && (action.type === "newBeat" || action.type === "removeBeat"))) return;
    const row = line.row;
    const untitled = t("common.untitled");

    switch (action.type) {
      case "newChapter": {
        if (!row || !book) return;
        const idx = this.locate(row);
        if (idx < 0) return;
        await this.commit(el);
        const before = action.before ? row.file : this.rows[idx + 1]?.file ?? null;
        this.draftBefore = before;
        this.pendingFocus = { kind: "new", before };
        break;
      }
      case "createFromNew": {
        if (!book) return;
        const at = this.newLineAt(line);
        if (at < 0) { new Notice(t("outline.beatChanged")); break; }
        const value = fieldText(el).trim();
        el.dataset.done = "1";
        const ok = await this.run(() => this.plugin.chapterOps.createChapterAt(book, at, value));
        if (!ok) { el.dataset.done = ""; return; }
        // keep typing: a new line right after the chapter just made (still before the same chapter)
        const before = line.before ?? null;
        this.draftBefore = before;
        this.pendingFocus = { kind: "new", before };
        break;
      }
      case "newAsBeat": {
        if (!book) return;
        const at = this.newLineAt(line);
        if (at < 0) { new Notice(t("outline.beatChanged")); break; }
        const target = this.rows[at - 1];
        if (!target) return;
        const value = fieldText(el).trim();
        el.dataset.done = "1";
        if (line.before && this.draftBefore === line.before) this.draftBefore = null;
        const ok = await this.run(() => this.editText(target.file, (text) => appendBeat(text, value)));
        if (!ok) { el.dataset.done = ""; return; }
        this.pendingFocus = { kind: "beat", file: target.file, beat: target.beats.length, caret: "end" };
        break;
      }
      case "newBeat": {
        if (!row || line.beat === undefined) return;
        await this.commit(el);
        const i = line.beat;
        const ok = await this.run(() => this.editBeats(row.file, i, undefined, (text) => {
          if (!parseBeats(text)[i]) throw new Error(this.changedMessage());
          return insertBeat(text, action.before ? i - 1 : i, "");
        }));
        if (!ok) return;
        this.pendingFocus = { kind: "beat", file: row.file, beat: action.before ? i : i + 1, caret: "start" };
        break;
      }
      case "removeBeat": {
        if (!row || line.beat === undefined) return;
        const i = line.beat;
        const expected = row.beats[i]?.text;
        el.dataset.done = "1";
        const ok = await this.run(() => this.editBeats(row.file, i, undefined, (text) => {
          const cur = parseBeats(text)[i];
          if (!cur || (cur.text !== expected && cur.text !== "")) throw new Error(this.changedMessage());
          return removeBeat(text, i);
        }));
        if (!ok) { el.dataset.done = ""; return; }
        if (i > 0) this.pendingFocus = { kind: "beat", file: row.file, beat: i - 1, caret: "end" };
        else if (note) this.pendingFocus = { kind: "beat", file: row.file, beat: 0, caret: "start" };
        else this.pendingFocus = { kind: "summary", file: row.file, caret: "end" };
        break;
      }
      case "beatToChapter": {
        if (!row || !book || line.beat === undefined) return;
        const i = line.beat;
        const beatText = fieldText(el).trim();
        const original = row.beats[i]?.text;
        // Create the chapter first, then take the beat out: a failure leaves a copy, never a loss.
        el.dataset.done = "1";
        const idx = this.locate(row);
        if (idx < 0) { el.dataset.done = ""; return; }
        let created: TFile | null = null;
        const ok = await this.run(async () => {
          const file = await this.plugin.chapterOps.createChapterAt(book, idx + 1, untitled);
          created = file;
          await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            fm[this.plugin.settings.summaryProperty] = beatText;
          });
          const res = await this.plugin.notes.text(row.file).apply(guardedEdit(
            (text) => parseBeats(text)[i]?.text === original,
            (text) => {
              const out = moveBeatOut(text, i);
              if (!out) throw new Error(t("outline.blocked.written"));
              return out.text;
            },
          ));
          if (!res.ok) throw new Error(t("outline.beatChanged"));
        });
        if (!ok && !created) { el.dataset.done = ""; return; }
        if (created) this.pendingFocus = { kind: "title", file: created, caret: "all" };
        break;
      }
      case "chapterToBeat": {
        if (!row || !book) return;
        const idx = this.locate(row);
        if (idx < 0) return;
        const prev = this.rows[idx - 1];
        if (!prev || prev.file === row.file) return;
        const summaryEl = this.rowEls.find((r) => r.row.file === row.file)?.summary;
        const beatText = chapterAsBeatText(fieldText(el), summaryEl ? fieldText(summaryEl) : row.summary, untitled);
        el.dataset.done = "1";
        if (summaryEl) summaryEl.dataset.done = "1";
        const ok = await this.run(async () => {
          // Re-check, through the note text port (an open editor's unsaved buffer counts), that the chapter is still empty before trashing it.
          const text = await this.plugin.notes.text(row.file).read();
          if (!isBlankBody(text)) throw new Error(t("outline.blocked.notEmptyTab"));
          await this.editText(prev.file, (p) => appendBeat(p, beatText));
          await this.app.fileManager.trashFile(row.file);
          await this.renumberRest(book, row.file);
        });
        if (!ok) { el.dataset.done = ""; if (summaryEl) summaryEl.dataset.done = ""; return; }
        this.pendingFocus = { kind: "beat", file: prev.file, beat: prev.beats.length, caret: "end" };
        break;
      }
      case "trashChapter": {
        if (!row || !book) return;
        el.dataset.done = "1";
        const before = this.previousTarget(el);
        const ok = await this.run(async () => {
          const text = await this.plugin.notes.text(row.file).read();
          if (!isBlankBody(text)) throw new Error(t("outline.blocked.notEmptyDelete"));
          await this.app.fileManager.trashFile(row.file);
          await this.renumberRest(book, row.file);
        });
        if (!ok) { el.dataset.done = ""; return; }
        this.pendingFocus = before;
        break;
      }
      default:
        return;
    }
    await this.refresh(true);
  }

  /** A focus target for the line before `el`, to land on after deleting it. */
  private previousTarget(el: HTMLElement): FocusTarget | null {
    const all = this.fields();
    const prev = all[all.indexOf(el) - 1];
    const l = prev ? this.lines.get(prev) : undefined;
    if (!l || !l.row) return null;
    if (l.field === "beat" && l.beat !== undefined) return { kind: "beat", file: l.row.file, beat: l.beat, caret: "end" };
    return { kind: l.field === "summary" ? "summary" : "title", file: l.row.file, caret: "end" };
  }

  private async renumberRest(book: Book, removed: TFile): Promise<void> {
    const rest = this.plugin.books.chapters(book).map((c) => c.file).filter((f) => f !== removed);
    await this.plugin.chapterOps.renumber(book, rest);
  }

  /** Move a chapter to 0-based position `to` (in the list as shown) and renumber. */
  private async moveChapter(file: TFile, to: number): Promise<void> {
    const book = this.book;
    const from = this.indexOf(file);
    if (!book || from < 0 || from === to || to < 0 || to >= this.rows.length) return;
    if (this.reorderBlocked()) return;   // Q44: chapters are hidden, so a move could land among the wrong ones
    // Renumber what is really in the folder: drop files that are gone, keep new ones at the end.
    const live = this.plugin.books.chapters(book).map((c) => c.file);
    const liveSet = new Set(live);
    const ordered = moveItem(this.rows.map((r) => r.file), from, to).filter((f) => liveSet.has(f));
    for (const f of live) if (!ordered.includes(f)) ordered.push(f);
    await this.run(() => this.plugin.chapterOps.renumber(book, ordered));
    await this.refresh(true);
  }

  /** Add an empty beat at the end of a chapter and focus it. */
  private async addBeat(file: TFile): Promise<void> {
    let index = -1;
    const ok = await this.run(() => this.editText(file, (text) => {
      const out = appendBeat(text, "");
      index = parseBeats(out).length - 1;
      return out;
    }));
    if (ok && index >= 0) this.pendingFocus = { kind: "beat", file, beat: index, caret: "end" };
    await this.refresh(true);
  }

  private async deleteChapter(row: ChapterRow): Promise<void> {
    const book = this.book;
    if (!book) return;
    if (row.words > 0) {
      const ok = await confirmAction(
        this.app,
        t("outline.delete.title"),
        t("outline.delete.desc", { title: row.title, words: unitAmount("words", row.words) }),
        t("outline.delete.confirm"),
      );
      if (!ok) return;
    }
    await this.run(async () => {
      await this.app.fileManager.trashFile(row.file);
      await this.renumberRest(book, row.file);
    });
    await this.refresh(true);
  }

  // ------------------------------------------------------------------ menus and navigation

  private chapterMenu(file: TFile): Menu {
    const menu = new Menu();
    menu.addItem((i) => i.setTitle(t("outline.menu.open")).setIcon("file-text")
      .onClick(() => { void this.openFile(file); }));
    menu.addItem((i) => i.setTitle(t("outline.menu.openTab")).setIcon("file-plus")
      .onClick(() => { void this.openFile(file, undefined, true); }));
    const idx = this.indexOf(file);
    const row = this.rows[idx];
    const els = this.rowEls.find((r) => r.row.file === file);
    const titleEl = els?.title;
    if (!row || !titleEl) return menu;

    // The keyboard actions, for touch screens (no Tab key) and discoverability.
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(t("outline.menu.newChapterAfter")).setIcon("plus")
      .onClick(() => this.trigger({ type: "newChapter", before: false }, titleEl)));
    menu.addItem((i) => i.setTitle(t("outline.menu.addBeat")).setIcon("list-plus")
      .onClick(() => { void this.addBeat(file); }));
    menu.addItem((i) => i.setTitle(t("outline.menu.toBeat")).setIcon("indent")
      .setDisabled(idx === 0 || row.words > 0 || !row.bodyBlank)
      .onClick(() => this.trigger({ type: "chapterToBeat" }, titleEl)));

    menu.addSeparator();
    const blocked = this.reorderBlocked();
    if (idx > 0) {
      menu.addItem((i) => i.setTitle(t("outline.menu.moveUp")).setIcon("arrow-up").setDisabled(blocked)
        .onClick(() => { void this.moveChapter(file, this.indexOf(file) - 1); }));
    }
    if (idx < this.rows.length - 1) {
      menu.addItem((i) => i.setTitle(t("outline.menu.moveDown")).setIcon("arrow-down").setDisabled(blocked)
        .onClick(() => { void this.moveChapter(file, this.indexOf(file) + 1); }));
    }
    menu.addSeparator();
    menu.addItem((i) => {
      i.setTitle(t("outline.menu.delete")).setIcon("trash").setWarning(true)
        .onClick(() => { void this.deleteChapter(row); });
    });
    return menu;
  }

  private beatMenu(file: TFile, i: number): Menu {
    const menu = new Menu();
    const els = this.rowEls.find((r) => r.row.file === file);
    const row = els?.row;
    const beat = row?.beats[i];
    menu.addItem((it) => it.setTitle(t("outline.menu.goToBeat")).setIcon("arrow-right")
      .onClick(() => { void this.openFile(file, beat?.line); }));
    const textEl = els?.beats[i]?.text;
    if (textEl) {
      menu.addItem((it) => it.setTitle(t("outline.menu.addBeatAfter")).setIcon("list-plus")
        .onClick(() => this.trigger({ type: "newBeat", before: false }, textEl)));
      if (!this.note) {
        menu.addItem((it) => it.setTitle(t("outline.menu.toChapter")).setIcon("outdent")
          .setDisabled(!beat || beat.written)
          .onClick(() => this.trigger({ type: "beatToChapter" }, textEl)));
      }
    }
    menu.addItem((it) => it.setTitle(t("outline.menu.removeBeat")).setIcon("x")
      .onClick(() => {
        void (async () => {
          await this.run(() => this.editBeats(file, i, beat?.text, (text) => removeBeat(text, i)));
          await this.refresh(true);
        })();
      }));
    return menu;
  }

  private async openFile(file: TFile, line?: number, newTab = false): Promise<void> {
    const leaf = this.app.workspace.getLeaf(newTab ? "tab" : false);
    await leaf.openFile(file, { active: true, eState: line !== undefined ? { line } : undefined });
    if (line !== undefined && leaf.view instanceof MarkdownView) {
      const editor = leaf.view.editor;
      const pos = { line, ch: 0 };
      editor.setCursor(pos);
      editor.scrollIntoView({ from: pos, to: pos }, true);
      editor.focus();
    }
  }
}

// -------------------------------------------------------------------- caret helpers

function caretInfo(el: HTMLElement): { caret: number; selectionEmpty: boolean; atFirstLine: boolean; atLastLine: boolean } {
  const sel = el.win.getSelection();
  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) {
    return { caret: 0, selectionEmpty: true, atFirstLine: true, atLastLine: true };
  }
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  const caret = pre.toString().length;
  let atFirstLine = true, atLastLine = true;
  const rect = range.getClientRects()[0];
  if (rect && (rect.height > 0 || rect.top !== 0)) {
    const box = el.getBoundingClientRect();
    const lh = parseFloat(el.win.getComputedStyle(el).lineHeight) || rect.height || 16;
    atFirstLine = rect.top - box.top < lh * 0.9;
    atLastLine = box.bottom - rect.bottom < lh * 0.9;
  } else {
    const len = fieldText(el).length;
    atFirstLine = caret === 0 || len < 30;
    atLastLine = caret === len || len < 30;
  }
  return { caret, selectionEmpty: range.collapsed, atFirstLine, atLastLine };
}

function setCaret(el: HTMLElement, where: "start" | "end" | "all"): void {
  const sel = el.win.getSelection();
  if (!sel) return;
  const range = el.doc.createRange();
  range.selectNodeContents(el);
  if (where !== "all") range.collapse(where === "start");
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertPlainText(el: HTMLElement, text: string): void {
  const sel = el.win.getSelection();
  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) {
    el.appendText(text);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = el.doc.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  el.dispatchEvent(new Event("input"));
}
