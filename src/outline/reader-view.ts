import { Component, ItemView, MarkdownRenderer, Notice, TFile, debounce, setIcon, setTooltip, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import type EscritaPlugin from "../main";
import { bookSource, collectionAt, type Book } from "../core/books";
import { movedPath } from "../core/path-keys";
import { VIEW_TYPES } from "../core/view-types";
import type { BookSource } from "../core/book-source";
import { lang, plural, t } from "../i18n";
import { anchorAfterEdit, readerBlocks, type ReaderBlock } from "./reader-model";
import {
  blockForLine, readerHeadingFormat, readerSource, readerStatePath, readingPoint, restoreTarget, sameSource,
  type ReaderChapter, type ReaderSource, type SectionBox,
} from "./reader-plan";

export const READER_VIEW = VIEW_TYPES.reader;

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
  /** the drawn blocks' text, so a save that changes nothing a reader sees draws nothing; null until drawn */
  texts: string[] | null;
  /** resolves when the chapter is drawn (or failed) */
  done: Promise<void> | null;
}

/**
 * "Read the book" (0.9, N 8; Q14, D6, D7): every included chapter of a book in order, as a
 * reader sees it (markers hidden as in the export), in the main area. Read-only. Chapters
 * render as they scroll into view; a click on a paragraph opens its chapter at that line;
 * the reading position is saved per book and restored on open.
 *
 * 1.2 (SF 15, PLAN-1.2 Q13-Q15): the same view reads a collection's contos or one note. The
 * source is a path (a book's note, a collection's note or the note itself), which is also
 * the position key.
 */
export class ReaderView extends ItemView {
  private sourcePath: string | null = null;
  /** what the path resolved to at the last build; null when it names nothing in the vault */
  private src: ReaderSource | null = null;
  private book: Book | null = null;
  private chapters: ChapterEls[] = [];
  private observer: IntersectionObserver | null = null;
  /** bumped on every rebuild, so a late render of a replaced chapter draws nothing */
  private token = 0;
  /** true while a programmatic scroll (the restore) is in flight: no save from it */
  private restoring = false;

  private saveSoon = debounce(() => this.savePosition(), SAVE_DELAY, true);
  private rebuildSoon = debounce(() => { void this.build(); }, 400, true);
  /** the vault's list of chapters may have changed (the metadata cache settled): rebuild only if it did */
  private resolvedSoon = debounce(() => { void this.rebuildIfChanged(); }, 400, true);
  /** chapters modified since the last refresh (paths), re-rendered together after a quiet time */
  private dirty = new Set<string>();
  private refreshSoon = debounce(() => { void this.refreshDirty(); }, 800, true);

  constructor(leaf: WorkspaceLeaf, private plugin: EscritaPlugin) {
    super(leaf);
  }

  getViewType(): string { return READER_VIEW; }
  getDisplayText(): string {
    return this.src ? t("outline.reader.tab", { book: this.src.title }) : t("outline.reader.title");
  }
  getIcon(): string { return "book-open"; }

  getState(): Record<string, unknown> {
    return { ...super.getState(), source: this.sourcePath };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    // an old { book } state is the same thing as { source } (Q15)
    const path = readerStatePath(state);
    if (path !== null && path !== this.sourcePath) {
      this.sourcePath = path;
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
    // A collection or a note has no folder: it is touched by its own file and the contos it lists.
    const touched = (f: { path: string }) => {
      const folder = this.book?.folder.path;
      if (folder) {
        if (f.path.startsWith(folder + "/")) this.rebuildSoon();
      } else if (this.src && (f.path === this.sourcePath || this.src.sections.some((s) => s.path === f.path))) {
        this.rebuildSoon();
      }
    };
    const { vault } = this.app;
    this.registerEvent(vault.on("create", touched));
    this.registerEvent(vault.on("delete", touched));
    this.registerEvent(vault.on("rename", (f, old) => {
      // the book itself moved (its note or a folder holding it): follow it, so the tab keeps reading it
      const moved = this.sourcePath === null ? null : movedPath(this.sourcePath, old, f.path);
      if (moved !== null) {
        this.sourcePath = moved;
        this.app.workspace.requestSaveLayout();
        this.rebuildSoon();
        return;
      }
      touched(f);
      touched({ path: old });
    }));
    // A chapter saved while the book is open is drawn again, that chapter only.
    this.registerEvent(vault.on("modify", (f) => {
      if (this.chapters.some((c) => c.chapter.path === f.path)) {
        this.dirty.add(f.path);
        this.refreshSoon();
      } else if (this.chapters.length === 0 && f.path === this.sourcePath) {
        this.rebuildSoon();   // an empty note that got its first words
      }
    }));
    // Improvement 52: what a chapter is (included or left out, a collection's links) comes from the
    // metadata cache, which is not ready when the view opens at startup. When it settles, draw the list
    // again if it changed; the reading place is kept. A collection's own list changing is the same case.
    this.registerEvent(this.app.metadataCache.on("resolved", () => this.resolvedSoon()));
    this.registerEvent(this.app.metadataCache.on("changed", (f) => {
      if (this.src?.kind === "collection" && f.path === this.sourcePath) this.resolvedSoon();
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

  /** What the source path is now: a book, a collection or a note; null when it is none in the vault. */
  private resolve(): { src: ReaderSource; book: Book | null } | null {
    const path = this.sourcePath;
    if (!path) return null;
    const s = this.plugin.settings;
    const headingFormat = readerHeadingFormat(s.chapterHeadingFormat, lang());
    const unnumbered = s.unnumberedTitles;
    const book = this.plugin.books.allBooks().find((b) => b.note.path === path) ?? null;
    if (book) {
      const chapters = this.source().chapters(book);
      return { src: readerSource(path, { book: { title: book.title, chapters }, collection: null, headingFormat, unnumbered }), book };
    }
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== "md") return null;
    const collection = collectionAt(this.app, file, () => s);
    return { src: readerSource(path, { book: null, collection, headingFormat, unnumbered }), book: null };
  }

  /** The metadata cache settled: draw again only when the list or the title is not what is drawn. */
  private async rebuildIfChanged(): Promise<void> {
    const now = this.resolve();
    if (!now || !this.src || sameSource(this.src, now.src)) return;
    // the place in the text is saved first, and the rebuild restores it
    this.savePosition();
    await this.build();
  }

  private teardown(): void {
    this.token++;
    this.observer?.disconnect();
    this.observer = null;
    for (const c of this.chapters) if (c.comp) this.removeChild(c.comp);
    this.chapters = [];
    this.saveSoon.cancel();
    this.rebuildSoon.cancel();
    this.resolvedSoon.cancel();
    this.refreshSoon.cancel();
    this.dirty.clear();
  }

  /** Re-renders the modified chapters in place; the reader's place on the page stays where it was. */
  private async refreshDirty(): Promise<void> {
    const paths = [...this.dirty];
    this.dirty.clear();
    const token = this.token;
    for (const path of paths) {
      const c = this.chapters.find((x) => x.chapter.path === path);
      if (!c) continue;
      // being drawn: its text may predate the save, so try again once that draw is in
      if (c.state === "loading") { this.dirty.add(path); this.refreshSoon(); continue; }
      if (c.state !== "done") continue;   // not drawn yet: it reads the new text when it scrolls in
      const fresh = await this.blocksOf(path).catch(() => null);
      if (token !== this.token) return;
      if (fresh && c.texts && sameTexts(c.texts, fresh)) {
        // nothing a reader sees changed (a beat or a comment): keep the drawing, follow the lines
        fresh.forEach((b, i) => { c.blocks[i].line = b.line; c.blocks[i].el.dataset.line = String(b.line); });
        continue;
      }
      const scroller = this.contentEl;
      const anchor = this.anchor();
      const oldTexts = c.texts;
      const oldComp = c.comp;
      this.restoring = true;
      try {
        c.done = null;
        await this.render(c, fresh ?? undefined);
        if (token !== this.token) return;
        if (oldComp) this.removeChild(oldComp);
        // the text in view stays put: move the page by however far the block at the top of the window moved.
        // Measured, not computed from the height change, so Chromium's scroll anchoring is never applied twice.
        if (anchor) {
          let el: HTMLElement | null = anchor.el;
          if (anchor.chapter === c) {
            const i = oldTexts && c.texts ? anchorAfterEdit(oldTexts, anchor.index, c.texts) : -1;
            el = i >= 0 ? c.blocks[i].el : null;
          }
          if (el?.isConnected) scroller.scrollTop += el.getBoundingClientRect().top - anchor.top;
        }
      } finally {
        scroller.win.setTimeout(() => { if (token === this.token) this.restoring = false; }, 150);
      }
    }
  }

  /** The first drawn block whose top is in the window (below the sticky bar), and where it sits; null when none is. */
  private anchor(): { chapter: ChapterEls; index: number; el: HTMLElement; top: number } | null {
    const box = this.contentEl.getBoundingClientRect();
    const edge = box.top + (this.contentEl.querySelector(".escrita-reader-bar")?.getBoundingClientRect().height ?? 0);
    for (const c of this.chapters) {
      if (c.state !== "done") continue;
      const r = c.section.getBoundingClientRect();
      if (r.bottom <= edge) continue;
      if (r.top >= box.bottom) return null;
      for (let i = 0; i < c.blocks.length; i++) {
        const top = c.blocks[i].el.getBoundingClientRect().top;
        if (top >= edge && top < box.bottom) return { chapter: c, index: i, el: c.blocks[i].el, top };
      }
    }
    return null;
  }

  /** Draws the book's chapters as placeholders, then renders the one to restore and, as they scroll in, the rest. */
  private async build(): Promise<void> {
    this.teardown();
    const el = this.contentEl;
    el.empty();
    const now = this.resolve();
    this.book = now?.book ?? null;
    this.src = now?.src ?? null;
    if (!now) {
      this.message(el, t("outline.reader.noNote"));
      return;
    }
    const { src, book } = now;
    const list = src.sections;

    const bar = el.createDiv({ cls: "escrita-reader-bar" });
    bar.createDiv({ cls: "escrita-reader-book", text: src.title });
    if (src.kind === "book") bar.createDiv({ cls: "escrita-reader-count", text: plural("outline.chapters", list.length) });
    else if (src.kind === "collection") bar.createDiv({ cls: "escrita-reader-count", text: plural("outline.reader.stories", list.length) });
    else bar.createSpan({ cls: "escrita-reader-chip", text: t("outline.reader.readOnly") });
    if (book) {
      const outline = bar.createEl("button", { cls: "clickable-icon escrita-reader-tool", attr: { "aria-label": t("outline.reader.openOutline") } });
      setIcon(outline, "list-tree");
      setTooltip(outline, t("outline.reader.openOutline"));
      outline.addEventListener("click", () => { void this.plugin.outline.openOutline(book.note.path); });
    }

    // a note with nothing to show says so; the text is read here, so the first draw does not read it twice
    let firstBlocks: ReaderBlock[] | undefined;
    if (src.kind === "note") {
      firstBlocks = await this.blocksOf(src.sections[0].path).catch(() => undefined);
      if (this.src !== src) return;
      if (firstBlocks && firstBlocks.length === 0) {
        this.message(el, t("outline.reader.emptyNote"));
        return;
      }
    }
    if (list.length === 0) {
      if (src.kind === "collection") {
        this.message(el, t("outline.reader.emptyCollection"));
        return;
      }
      const box = el.createDiv({ cls: "escrita-reader-empty" });
      box.createDiv({ cls: "escrita-reader-empty-title", text: t("outline.reader.empty") });
      // board 33e: a book with no chapter at all offers the first one (one whose chapters are all left out doesn't:
      // creating at the top would renumber them)
      if (book && this.source().chapters(book).length === 0) {
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
      return { chapter, section, body, state: "idle", comp: null, blocks: [], texts: null, done: null };
    });

    this.restoring = true;
    const target = restoreTarget(this.plugin.data.readPosition[this.sourcePath ?? ""], list);
    try {
      const first = this.chapters[target.index];
      await this.render(first, src.kind === "note" ? firstBlocks : undefined);
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
  private render(c: ChapterEls, given?: ReaderBlock[]): Promise<void> {
    if (c.done) return c.done;
    c.state = "loading";
    c.done = this.draw(c, given).catch(() => {
      if (c.state === "loading") {
        // settled, so a later save draws it again (and a refresh never waits on it)
        c.state = "done";
        c.blocks = [];
        c.texts = null;
        c.body.empty();
        c.body.createDiv({ cls: "escrita-reader-loading", text: t("outline.reader.failed") });
      }
    });
    return c.done;
  }

  /** The chapter's blocks as the reader shows them, from its current text. */
  private async blocksOf(path: string): Promise<ReaderBlock[]> {
    const { text } = await this.source().read(path);
    return readerBlocks(text, { placeholderMarker: this.plugin.settings.placeholderMarker });
  }

  /** `given`: the blocks when the caller has just read them (a refresh). */
  private async draw(c: ChapterEls, given?: ReaderBlock[]): Promise<void> {
    const token = this.token;
    const blocks = given ?? await this.blocksOf(c.chapter.path);
    if (token !== this.token) return;
    const comp = new Component();
    this.addChild(comp);
    c.comp = comp;
    // drawn off screen and put in at once, so a long chapter lays out one time
    const drawn: { el: HTMLElement; line: number }[] = [];
    await Promise.all(blocks.map(async (b: ReaderBlock, i) => {
      const el = createDiv({ cls: "escrita-reader-block", attr: { "data-line": String(b.line) } });
      await MarkdownRenderer.render(this.app, b.text, el, c.chapter.path, comp);
      drawn[i] = { el, line: b.line };
    }));
    if (token !== this.token) { this.removeChild(comp); return; }
    c.body.empty();
    c.body.removeClass("is-pending");
    c.body.append(...drawn.map((d) => d.el));
    c.blocks = drawn;
    c.texts = blocks.map((b) => b.text);
    c.state = "done";
  }

  // ---------------------------------------------------------------- position

  private scrollTo(c: ChapterEls, line: number): void {
    const i = blockForLine(c.blocks.map((b) => b.line), line);
    (i >= 0 ? c.blocks[i].el : c.section).scrollIntoView({ block: "start" });
    // the sticky bar covers the top of the page: the block lands just below it, where savePosition reads it
    if (i >= 0) this.contentEl.scrollTop -= this.contentEl.querySelector(".escrita-reader-bar")?.getBoundingClientRect().height ?? 0;
  }

  private savePosition(): void {
    const key = this.sourcePath;
    if (!key || this.restoring || this.chapters.length === 0) return;
    const top = this.contentEl.getBoundingClientRect().top;
    // below the sticky bar
    const edge = top + (this.contentEl.querySelector(".escrita-reader-bar")?.getBoundingClientRect().height ?? 0) + 1;
    // measured lazily: readingPoint reads bottoms down to the section at the edge, then only its blocks
    const boxes: SectionBox[] = this.chapters.map((c) => ({
      path: c.chapter.path,
      bottom: () => c.section.getBoundingClientRect().bottom,
      blocks: () => c.state === "done" ? c.blocks.map((b) => ({ line: b.line, bottom: b.el.getBoundingClientRect().bottom })) : null,
    }));
    const pos = readingPoint(boxes, edge);
    if (!pos) return;
    const old = this.plugin.data.readPosition[key];
    if (old && old.chapter === pos.chapter && old.line === pos.line) return;
    this.plugin.data.readPosition[key] = pos;
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

/** Whether freshly read blocks show the same text as the drawn ones, in the same order. */
function sameTexts(drawn: readonly string[], fresh: readonly ReaderBlock[]): boolean {
  return drawn.length === fresh.length && fresh.every((b, i) => b.text === drawn[i]);
}
