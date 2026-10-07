import { Component, ItemView, MarkdownRenderer, Notice, TFile, debounce, setIcon, setTooltip, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import type EscritaPlugin from "../main";
import { bookSource, type Book } from "../core/books";
import { movedPath } from "../core/path-keys";
import type { BookSource } from "../core/book-source";
import { lang, plural, t } from "../i18n";
import { readerBlocks, type ReaderBlock } from "./reader-model";
import {
  blockForLine, readerChapters, readerHeadingFormat, readingPoint, restoreTarget,
  type ReaderChapter, type SectionBox,
} from "./reader-plan";

export const READER_VIEW = "escrita-reader";

/** Chapters render when they come within this distance of the visible area (G0d: the rest stay a placeholder). */
const LOAD_MARGIN = "900px 0px";
/** Quiet time after the last scroll before the reading position is saved. */
const SAVE_DELAY = 600;

interface ChapterEls {
  chapter: ReaderChapter;
  section: HTMLElement;
  body: HTMLElement;
  state: "idle" | "loading" | "done";
  /** the chapter's own renderer lifecycle, unloaded with the view or on a rebuild */
  comp: Component | null;
  /** the blocks as drawn, for the reading point and the scroll to a saved line */
  blocks: { el: HTMLElement; line: number }[];
  /** resolves when the chapter is drawn (or failed) */
  done: Promise<void> | null;
}

/**
 * "Read the book" (0.9, N 8; Q14, D6, D7): every included chapter of a book in order, as a
 * reader sees it (markers hidden as in the export), in the main area. Read-only. Chapters
 * render as they scroll into view; a click on a paragraph opens its chapter at that line;
 * the reading position is saved per book and restored on open.
 */
export class ReaderView extends ItemView {
  private bookPath: string | null = null;
  private book: Book | null = null;
  private chapters: ChapterEls[] = [];
  private observer: IntersectionObserver | null = null;
  /** bumped on every rebuild, so a late render of a replaced chapter draws nothing */
  private token = 0;
  /** true while a programmatic scroll (the restore) is in flight: no save from it */
  private restoring = false;

  private saveSoon = debounce(() => this.savePosition(), SAVE_DELAY, true);
  private rebuildSoon = debounce(() => { void this.build(); }, 400, true);

  constructor(leaf: WorkspaceLeaf, private plugin: EscritaPlugin) {
    super(leaf);
  }

  getViewType(): string { return READER_VIEW; }
  getDisplayText(): string {
    return this.book ? t("outline.reader.tab", { book: this.book.title }) : t("outline.reader.title");
  }
  getIcon(): string { return "book-open"; }

  getState(): Record<string, unknown> {
    return { ...super.getState(), book: this.bookPath };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = state as { book?: unknown } | null;
    if (s && typeof s.book === "string" && s.book !== this.bookPath) {
      this.bookPath = s.book;
      await super.setState(state, result);
      await this.build();
      return;
    }
    await super.setState(state, result);
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("escrita-reader");
    this.registerDomEvent(this.contentEl, "scroll", () => { if (!this.restoring) this.saveSoon(); });
    this.registerDomEvent(this.contentEl, "click", (e) => this.onClick(e));
    // The chapter list follows the vault: a new, renamed or deleted file in the book's folder rebuilds it.
    const touched = (f: { path: string }) => {
      const folder = this.book?.folder.path;
      if (folder && f.path.startsWith(folder + "/")) this.rebuildSoon();
    };
    const { vault } = this.app;
    this.registerEvent(vault.on("create", touched));
    this.registerEvent(vault.on("delete", touched));
    this.registerEvent(vault.on("rename", (f, old) => {
      // the book itself moved (its note or a folder holding it): follow it, so the tab keeps reading it
      const moved = this.bookPath === null ? null : movedPath(this.bookPath, old, f.path);
      if (moved !== null) {
        this.bookPath = moved;
        this.app.workspace.requestSaveLayout();
        this.rebuildSoon();
        return;
      }
      touched(f);
      touched({ path: old });
    }));
    this.register(() => this.teardown());
    await this.build();
  }

  async onClose(): Promise<void> {
    this.savePosition();
    this.teardown();
  }

  // ---------------------------------------------------------------- building

  private source(): BookSource<Book> {
    const p = this.plugin;
    return bookSource(this.app, p.books, p.notes, () => p.settings);
  }

  private teardown(): void {
    this.token++;
    this.observer?.disconnect();
    this.observer = null;
    for (const c of this.chapters) if (c.comp) this.removeChild(c.comp);
    this.chapters = [];
    this.saveSoon.cancel();
    this.rebuildSoon.cancel();
  }

  /** Draws the book's chapters as placeholders, then renders the one to restore and, as they scroll in, the rest. */
  private async build(): Promise<void> {
    this.teardown();
    const el = this.contentEl;
    el.empty();
    const book = this.bookPath ? this.plugin.books.allBooks().find((b) => b.note.path === this.bookPath) ?? null : null;
    this.book = book;
    if (!book) {
      this.message(el, t("outline.reader.noBook"));
      return;
    }
    const source = this.source();
    const s = this.plugin.settings;
    const list = readerChapters(source.chapters(book), readerHeadingFormat(s.chapterHeadingFormat, lang()), s.unnumberedTitles);

    const bar = el.createDiv({ cls: "escrita-reader-bar" });
    bar.createDiv({ cls: "escrita-reader-book", text: book.title });
    bar.createDiv({ cls: "escrita-reader-count", text: plural("outline.chapters", list.length) });
    const outline = bar.createEl("button", { cls: "clickable-icon escrita-reader-tool", attr: { "aria-label": t("outline.reader.openOutline") } });
    setIcon(outline, "list-tree");
    setTooltip(outline, t("outline.reader.openOutline"));
    outline.addEventListener("click", () => { void this.plugin.outline.openOutline(book.note.path); });

    if (list.length === 0) {
      const box = el.createDiv({ cls: "escrita-reader-empty" });
      box.createDiv({ cls: "escrita-reader-empty-title", text: t("outline.reader.empty") });
      // board 33e: a book with no chapter at all offers the first one (one whose chapters are all left out doesn't:
      // creating at the top would renumber them)
      if (source.chapters(book).length === 0) {
        box.createDiv({ cls: "escrita-reader-empty-hint", text: t("outline.reader.emptyHint") });
        const b = box.createEl("button", { cls: "mod-cta", text: t("outline.reader.createFirst") });
        b.addEventListener("click", () => { void this.createFirst(book); });
      }
      return;
    }
    const page = el.createDiv({ cls: "escrita-reader-page" });
    const token = this.token;
    this.chapters = list.map((chapter) => {
      const section = page.createEl("section", { cls: "escrita-reader-chapter", attr: { "data-path": chapter.path } });
      if (chapter.heading !== "") section.createEl("h1", { cls: "escrita-reader-heading", text: chapter.heading });
      const body = section.createDiv({ cls: "escrita-reader-body is-pending" });
      body.createDiv({ cls: "escrita-reader-loading", text: t("outline.reader.loading") });
      return { chapter, section, body, state: "idle", comp: null, blocks: [], done: null };
    });

    this.restoring = true;
    const target = restoreTarget(this.plugin.data.readPosition[book.note.path], list);
    try {
      const first = this.chapters[target.index];
      await this.render(first);
      if (token !== this.token) return;
      this.scrollTo(first, target.line);
      this.observe();
    } finally {
      // let the scroll event of the jump pass before saving resumes
      this.contentEl.win.setTimeout(() => { if (token === this.token) this.restoring = false; }, 150);
    }
  }

  /** Creates the book's first chapter the way the outline does, and opens it in the editor. */
  private async createFirst(book: Book): Promise<void> {
    try {
      const file = await this.plugin.chapterOps.createChapterAt(book, 0, t("common.untitled"));
      await this.app.workspace.getLeaf("tab").openFile(file, { active: true });
    } catch (e) {
      console.error("Escrita: couldn't create the first chapter", e);
      new Notice(t("outline.reader.createFailed"));
    }
  }

  private message(el: HTMLElement, text: string): void {
    el.createDiv({ cls: "escrita-reader-empty", text });
  }

  private observe(): void {
    if (typeof IntersectionObserver === "undefined") {
      // no observer (a test): draw everything
      for (const c of this.chapters) void this.render(c);
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const c = this.chapters.find((x) => x.section === e.target);
        if (c) void this.render(c);
      }
    }, { root: this.contentEl, rootMargin: LOAD_MARGIN });
    for (const c of this.chapters) this.observer.observe(c.section);
  }

  // ---------------------------------------------------------------- rendering

  /** Reads a chapter and draws its blocks with Obsidian's renderer; once per chapter. */
  private render(c: ChapterEls): Promise<void> {
    if (c.done) return c.done;
    c.state = "loading";
    c.done = this.draw(c).catch(() => {
      if (c.state === "loading") {
        c.body.empty();
        c.body.createDiv({ cls: "escrita-reader-loading", text: t("outline.reader.failed") });
      }
    });
    return c.done;
  }

  private async draw(c: ChapterEls): Promise<void> {
    const token = this.token;
    const { text } = await this.source().read(c.chapter.path);
    if (token !== this.token) return;
    const blocks = readerBlocks(text, { placeholderMarker: this.plugin.settings.placeholderMarker });
    const comp = new Component();
    this.addChild(comp);
    c.comp = comp;
    // drawn off screen and put in at once, so a long chapter lays out one time
    const wrap = createDiv();
    const drawn: { el: HTMLElement; line: number }[] = [];
    await Promise.all(blocks.map(async (b: ReaderBlock, i) => {
      const el = createDiv({ cls: "escrita-reader-block", attr: { "data-line": String(b.line) } });
      await MarkdownRenderer.render(this.app, b.text, el, c.chapter.path, comp);
      drawn[i] = { el, line: b.line };
    }));
    if (token !== this.token) { this.removeChild(comp); return; }
    for (const d of drawn) wrap.appendChild(d.el);
    c.body.empty();
    c.body.removeClass("is-pending");
    c.body.append(...Array.from(wrap.childNodes));
    c.blocks = drawn;
    c.state = "done";
  }

  // ---------------------------------------------------------------- position

  private scrollTo(c: ChapterEls, line: number): void {
    const i = blockForLine(c.blocks.map((b) => b.line), line);
    (i >= 0 ? c.blocks[i].el : c.section).scrollIntoView({ block: "start" });
  }

  private savePosition(): void {
    const book = this.book;
    if (!book || this.restoring || this.chapters.length === 0) return;
    const top = this.contentEl.getBoundingClientRect().top;
    // below the sticky bar
    const edge = top + (this.contentEl.querySelector(".escrita-reader-bar")?.getBoundingClientRect().height ?? 0) + 1;
    const boxes: SectionBox[] = this.chapters.map((c) => ({
      path: c.chapter.path,
      bottom: c.section.getBoundingClientRect().bottom,
      blocks: c.state === "done" ? c.blocks.map((b) => ({ line: b.line, bottom: b.el.getBoundingClientRect().bottom })) : null,
    }));
    const pos = readingPoint(boxes, edge);
    if (!pos) return;
    const old = this.plugin.data.readPosition[book.note.path];
    if (old && old.chapter === pos.chapter && old.line === pos.line) return;
    this.plugin.data.readPosition[book.note.path] = pos;
    this.plugin.requestSave();
  }

  // ---------------------------------------------------------------- click

  /** A click on a paragraph opens its chapter at that line (a selection in progress is left alone). */
  private onClick(e: MouseEvent): void {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const block = target.closest<HTMLElement>(".escrita-reader-block");
    const section = block?.closest<HTMLElement>(".escrita-reader-chapter");
    if (!block || !section) return;
    if ((block.win.getSelection()?.toString() ?? "") !== "") return;
    const file = this.app.vault.getAbstractFileByPath(section.dataset.path ?? "");
    if (!(file instanceof TFile)) return;
    const line = Number(block.dataset.line ?? 0);
    const at = { line, ch: 0 };
    void this.app.workspace.getLeaf("tab").openFile(file, { active: true, eState: { line, cursor: { from: at, to: at } } });
  }
}
