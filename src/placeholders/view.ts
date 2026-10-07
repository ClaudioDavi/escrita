import { ItemView, Keymap, Platform, debounce, setIcon, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import type EscritaPlugin from "../main";
import type { Book } from "../core/books";
import { fmt, t } from "../i18n";
import { inBook } from "../core/classify";
import { displayName, orderPaths, parentPath, type IndexedMarker } from "./logic";

export const PLACEHOLDERS_VIEW = "escrita-placeholders";

type ScopeChoice = "book" | "all";

/** data attribute naming each focusable control, so focus survives a re-render */
const FOCUS_KEY = "data-escrita-focus";

let hintIds = 0;

export class PlaceholdersView extends ItemView {
  private panelScope: ScopeChoice = "book";
  private shownBook: string | null = null;
  private refreshSoon = debounce(() => this.render(), 150, true);

  constructor(leaf: WorkspaceLeaf, private plugin: EscritaPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return PLACEHOLDERS_VIEW;
  }

  getDisplayText(): string {
    return t("placeholders.view.title");
  }

  getIcon(): string {
    return "map-pin";
  }

  getState(): Record<string, unknown> {
    return { ...super.getState(), scope: this.panelScope };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = (state ?? {}) as { scope?: unknown };
    if (s.scope === "book" || s.scope === "all") this.panelScope = s.scope;
    await super.setState(state, result);
    this.render();
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("escrita-placeholders");
    this.register(this.plugin.placeholders.onChange(() => this.refreshSoon()));
    this.registerEvent(this.app.workspace.on("file-open", () => {
      // Only the book scope depends on the active file.
      if (this.panelScope === "book" && this.currentBook()?.note.path !== this.shownBook) this.refreshSoon();
    }));
    this.render();
  }

  async onClose(): Promise<void> {
    this.refreshSoon.cancel();
    this.contentEl.empty();
  }

  private currentBook(): Book | null {
    try {
      return this.plugin.books.classify(this.app.workspace.getActiveFile()).book;
    } catch {
      return null;
    }
  }

  render(): void {
    const el = this.contentEl;
    const focused = this.focusedKey();
    el.empty();
    this.build();
    if (focused) this.restoreFocus(focused);
  }

  /** The focus key of the control that has keyboard focus inside the view, if any. */
  private focusedKey(): string | null {
    const active = this.contentEl.ownerDocument.activeElement;
    if (!(active instanceof HTMLElement) || !this.contentEl.contains(active)) return null;
    return active.closest(`[${FOCUS_KEY}]`)?.getAttribute(FOCUS_KEY) ?? null;
  }

  /**
   * Put focus back on the same control after a re-render. When it is gone (the
   * placeholder was just resolved), use the item that took its place, else the
   * previous one, else the file's header, else the first control in the view.
   */
  private restoreFocus(key: string): void {
    const find = (k: string): HTMLElement | null => {
      for (const node of Array.from(this.contentEl.querySelectorAll(`[${FOCUS_KEY}]`))) {
        if (node.instanceOf(HTMLElement) && node.getAttribute(FOCUS_KEY) === k) return node;
      }
      return null;
    };
    const candidates = [key];
    const m = /^(open|resolve)\t(.*)\t(\d+)$/.exec(key);
    if (m) {
      const i = Number(m[3]);
      candidates.push(`open\t${m[2]}\t${i}`);
      if (i > 0) candidates.push(`open\t${m[2]}\t${i - 1}`);
      candidates.push(`file\t${m[2]}`);
    }
    for (const k of candidates) {
      const target = find(k);
      if (target) { target.focus(); return; }
    }
    const first = this.contentEl.querySelector(`[${FOCUS_KEY}]`);
    if (first instanceof HTMLElement) first.focus();
  }

  private build(): void {
    const el = this.contentEl;
    const mod = this.plugin.placeholders;
    const book = this.currentBook();
    const scope: ScopeChoice = this.panelScope === "book" && book ? "book" : "all";
    this.shownBook = book?.note.path ?? null;

    // Which files, in which order.
    let paths = mod.paths();
    let chapterOrder: string[];
    if (scope === "book" && book) {
      paths = paths.filter((p) => inBook(p, book));
      chapterOrder = this.plugin.books.chapters(book).map((c) => c.file.path);
    } else {
      chapterOrder = this.plugin.books.allBooks().flatMap((b) => this.plugin.books.chapters(b).map((c) => c.file.path));
    }
    const ordered = orderPaths(paths, chapterOrder);
    const total = ordered.reduce((n, p) => n + mod.countFor(p), 0);

    // Header
    const header = el.createDiv({ cls: "escrita-ph-header" });
    const titleRow = header.createDiv({ cls: "escrita-ph-title-row" });
    titleRow.createDiv({ cls: "escrita-ph-title", text: t("placeholders.view.title") });
    if (total > 0) titleRow.createDiv({ cls: "escrita-ph-total", text: fmt(total) });
    if (scope === "book" && book) header.createDiv({ cls: "escrita-ph-book", text: book.title });

    // Scope toggle
    const toggle = header.createDiv({ cls: "escrita-ph-scope" });
    toggle.setAttr("role", "group");
    toggle.setAttr("aria-label", t("placeholders.scope.label"));
    // Visible hint when there is no book; referenced by the unavailable button.
    const hintId = `escrita-ph-scope-hint-${++hintIds}`;
    const mk = (value: ScopeChoice, label: string, unavailable: boolean) => {
      const b = toggle.createEl("button", { cls: "escrita-ph-scope-btn", text: label });
      b.setAttr(FOCUS_KEY, `scope\t${value}`);
      b.setAttr("aria-pressed", String(scope === value));
      if (scope === value) b.addClass("is-active");
      if (unavailable) {
        // aria-disabled (not `disabled`) keeps it focusable and its name visible-label only.
        b.setAttr("aria-disabled", "true");
        b.setAttr("aria-describedby", hintId);
      }
      b.addEventListener("click", () => {
        if (unavailable || this.panelScope === value) return;
        this.panelScope = value;
        this.render();
        this.app.workspace.requestSaveLayout();
      });
    };
    mk("book", t("placeholders.scope.book"), !book);
    mk("all", t("placeholders.scope.all"), false);
    if (!book) header.createDiv({ cls: "escrita-ph-scope-hint", text: t("placeholders.scope.noBook"), attr: { id: hintId } });

    if (!mod.isReady()) {
      el.createDiv({ cls: "escrita-ph-status", text: t("placeholders.indexing") });
      return;
    }

    if (ordered.length === 0) {
      const empty = el.createDiv({ cls: "escrita-ph-empty" });
      empty.createDiv({
        cls: "escrita-ph-empty-title",
        text: scope === "book" && book ? t("placeholders.empty.book", { book: book.title }) : t("placeholders.empty.all"),
      });
      const marker = this.plugin.settings.placeholderMarker || "XXX";
      if (Platform.isMobile) {
        empty.createEl("p", { text: t("placeholders.empty.howMobile", { marker }) });
      } else {
        empty.createEl("p", { text: t("placeholders.empty.how", { marker }) });
        empty.createEl("p", { cls: "escrita-ph-muted", text: t("placeholders.empty.hotkey") });
      }
      return;
    }

    const list = el.createDiv({ cls: "escrita-ph-list" });
    const chapters = new Set(chapterOrder);
    for (const path of ordered) this.renderGroup(list, path, mod.markersFor(path), scope, chapters.has(path));
  }

  private renderGroup(parent: HTMLElement, path: string, markers: IndexedMarker[], scope: ScopeChoice, isChapter: boolean): void {
    const group = parent.createDiv({ cls: "escrita-ph-group" });
    const head = group.createDiv({ cls: "escrita-ph-file" });
    head.setAttr("role", "button");
    head.setAttr("tabindex", "0");
    head.setAttr(FOCUS_KEY, `file\t${path}`);
    const name = head.createDiv({ cls: "escrita-ph-file-name", text: displayName(path) });
    if (isChapter) name.addClass("is-chapter");
    head.createDiv({ cls: "escrita-ph-count", text: fmt(markers.length) });
    if (scope === "all") {
      const where = this.whereLabel(path);
      if (where) group.createDiv({ cls: "escrita-ph-where", text: where });
    }
    const openFile = (evt: MouseEvent | KeyboardEvent) => {
      void this.plugin.placeholders.openFile(path, Keymap.isModEvent(evt));
    };
    head.addEventListener("click", openFile);
    head.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") { evt.preventDefault(); openFile(evt); }
    });

    markers.forEach((m, i) => {
      // A plain row: the open button and the resolve button sit side by side,
      // never one inside the other.
      const item = group.createDiv({ cls: "escrita-ph-item" });
      const open = item.createEl("button", { cls: "escrita-ph-open" });
      open.setAttr(FOCUS_KEY, `open\t${path}\t${i}`);
      if (m.text.trim()) open.createSpan({ cls: "escrita-ph-note", text: m.text });
      else open.createSpan({ cls: "escrita-ph-note escrita-ph-muted", text: t("placeholders.noNote") });
      open.createSpan({ cls: "escrita-ph-line", text: t("placeholders.line", { n: fmt(m.line + 1) }) });

      const btn = item.createEl("button", { cls: "escrita-ph-resolve clickable-icon" });
      btn.setAttr(FOCUS_KEY, `resolve\t${path}\t${i}`);
      setIcon(btn, "check");
      btn.setAttr("aria-label", t("placeholders.resolve"));

      open.addEventListener("click", (evt) => {
        void this.plugin.placeholders.openAt(path, m, Keymap.isModEvent(evt));
      });
      btn.addEventListener("click", () => {
        if (btn.getAttr("aria-disabled") === "true") return;
        btn.setAttr("aria-disabled", "true");
        item.addClass("is-resolving");
        void this.plugin.placeholders.resolve(path, m).then((ok) => {
          if (!ok) { btn.removeAttribute("aria-disabled"); item.removeClass("is-resolving"); }
        });
      });
    });
  }

  /** "Book · folder" style hint under a file in the all-notes scope. */
  private whereLabel(path: string): string {
    const p = this.plugin.books.classify(path);
    if (p.book && (p.kind === "chapter" || p.kind === "book-file")) return p.book.title;
    return parentPath(path);
  }
}
