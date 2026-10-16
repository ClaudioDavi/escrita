// The Export modal (PLAN-0.8 Q4, Q16, Q17; boards 26 and 27). One modal, two views:
// the options (what, chapters, format, template, where it writes, warnings) and the
// preview (the document the file will have, drawn by the preview writer). Everything it
// needs from Obsidian comes through `ExportHost`, which index.ts implements.
import { App, Modal } from "obsidian";
import type { ExportFormat, LastExport } from "../data";
import { noteName } from "../core/paths";
import type { ChapterRef } from "../core/book-source";
import { aboutCount } from "../core/export-pipeline";
import type { PieceUnit } from "../core/measure";
import { fmt, lang, plural, t } from "../i18n";
import { headingFormat, planChapters, presetLabel, stateOfLast, whenText, type ChapterPlan, type ExportState } from "./logic";
import { ExistsModal, WhereModal, askChapters, type ExistsAnswer } from "./dialogs";
import { presetById, PRESETS } from "../core/presets";
import { needsConfirm, type Built, type Warning } from "./source";
import { drawScriptPages } from "./script-preview";
import { epubLayout } from "./writers/epub";
import { PreviewWriter } from "./writers/preview";

export type ModalState = ExportState;

/** What the modal asks of the module. */
export interface ExportHost {
  /** the work's title for a state: the book's, a chapter's or the note's */
  titleFor(state: ModalState): string;
  /** reads the text of the state's parts and finds what is wrong with it (cached by the modal) */
  build(state: ModalState): Promise<Built>;
  /** the vault path the state writes to, without checking that it is free */
  pathFor(state: ModalState): string;
  /**
   * Writes the file (asking when it exists), remembers the choices and says so.
   * True when the file was written; false when the writer cancelled or it failed.
   */
  write(state: ModalState, built: Built, again?: boolean): Promise<boolean>;
  /**
   * Whether "Export again" may write on its own for this state: the same kind of export
   * as the last one (a chapter alone only from that chapter). Absent: always.
   */
  canRepeat?(last: LastExport, state: ModalState): boolean;
  /** open the note at a 0-based line (the modal has closed) */
  jump(path: string, line: number): void;
  /** open the last exported file; false when it is gone */
  openLast(path: string): boolean;
  fileExists(path: string): boolean;
}

export interface BookOptions {
  chapters: ChapterRef[];
  /** the compile property's name, for "compile: false" */
  compileProperty: string;
  /** the settings' chapter heading format; "" = the template's */
  headingOverride: string;
  /** settings' `unnumberedTitles`: titles that export with no number */
  unnumberedTitles: string;
  /** the active note is a chapter: offer "This chapter" next to "The whole book" */
  offerChapter: boolean;
  /** front matter pages the book note links to (and that exist) */
  front: ("dedication" | "epigraph")[];
  /** the "book" is a collection (SF 13): its chapters are stories; the "What" row says so and the warnings name stories */
  collection?: boolean;
}

export interface ExportModalOptions {
  /** null: a single note, which has no "What" and no "Chapters" */
  book: BookOptions | null;
  state: ModalState;
  last: LastExport | null;
  /** the placeholder marker word from settings, for "2 XXX markers" */
  marker: string;
  /** the `epubSceneBreak` setting, for the EPUB preview */
  epubSceneBreak: string;
  /** the formats this source offers, in order (core/export-formats `formatsFor`) */
  formats: readonly ExportFormat[];
  /** a single screenplay note (boards 43): the page, scene numbers and notes rows, and the credit line the title page shows; null for prose */
  script: { credit: string } | null;
  host: ExportHost;
}

const PAGES = ["letter", "a4"] as const;

export class ExportModal extends Modal {
  private state: ModalState;
  private view: "options" | "preview" = "options";
  private built: Built | null = null;
  private builtKey = "";
  private seq = 0;
  private loading = false;
  private failed = false;
  private busy = false;
  private timer: number | null = null;
  private coverUrl: string | null = null;
  // regions redrawn without redrawing the whole view (a range input keeps its focus)
  private dyn: { warn: HTMLElement; where: HTMLElement; last: HTMLElement; footer: HTMLElement } | null = null;

  constructor(app: App, private o: ExportModalOptions) {
    super(app);
    this.state = { ...o.state };
  }

  onOpen(): void {
    this.modalEl?.addClass("escrita-export-modal");
    this.contentEl.addClass("escrita-export");
    this.render();
    void this.ensureBuilt();
  }

  onClose(): void {
    this.seq++;
    this.dropCoverUrl();
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.contentEl.empty();
  }

  private dropCoverUrl(): void {
    if (this.coverUrl) URL.revokeObjectURL(this.coverUrl);
    this.coverUrl = null;
  }

  // ------------------------------------------------------------------ state

  private plan(): ChapterPlan | null {
    const b = this.o.book;
    if (!b || !this.state.whole) return null;
    const format = headingFormat(b.headingOverride, presetById(this.state.preset).chapterHeading);
    return planChapters(b.chapters, this.state.selection, format, b.unnumberedTitles);
  }

  private key(): string {
    const s = this.state;
    // an EPUB reads its cover too, so it is built apart from the same text in another format
    // a PDF's pages depend on the page and the scene numbers; the notes only matter when writing
    return JSON.stringify([s.whole, s.whole ? s.selection : null, s.preset, s.format === "epub", s.format === "pdf" ? s.sceneNumbers === true : null]);
  }

  private emptyChoice(): boolean {
    const plan = this.plan();
    return plan !== null && plan.chosen.length === 0;
  }

  private canExport(): boolean {
    return !this.busy && !this.loading && !this.failed && this.built !== null && !this.emptyChoice();
  }

  /** Builds (or reuses) the document for the current state, then redraws what depends on it. */
  private async ensureBuilt(): Promise<Built | null> {
    if (this.emptyChoice()) {
      this.built = null;
      this.builtKey = "";
      this.loading = false;
      this.refresh();
      return null;
    }
    const key = this.key();
    if (this.built && this.builtKey === key) return this.built;
    const mine = ++this.seq;
    this.loading = true;
    this.failed = false;
    this.refresh();
    try {
      const built = await this.o.host.build(this.state);
      if (mine !== this.seq) return null;
      this.built = built;
      this.builtKey = key;
    } catch (e) {
      if (mine !== this.seq) return null;
      console.error("Escrita: couldn't read the text to export", e);
      this.built = null;
      this.builtKey = "";
      this.failed = true;
    }
    this.loading = false;
    this.refresh();
    if (this.view === "preview") this.render();
    return this.built;
  }

  /** A change that alters what is read: build again, after a pause when typing. */
  private changed(delay = 0): void {
    this.built = null;
    this.builtKey = "";
    this.seq++;
    this.loading = true;
    this.refresh();
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.timer = null; void this.ensureBuilt(); }, delay);
  }

  /**
   * Enter exports (board 26) when nothing needs a confirmation: the new primary button takes focus
   * unless the writer is typing in a field. Runs after every redraw, so a chip click (which destroys
   * the focused chip) hands focus back to the button.
   */
  private focusPrimary(): void {
    if (this.view !== "options" || !this.built || needsConfirm(this.built.warnings) || !this.canExport()) return;
    const btn = this.dyn?.footer.querySelector<HTMLButtonElement>("button.mod-cta");
    if (!btn || btn.disabled) return;
    const a = document.activeElement;
    const typing = a instanceof HTMLElement && this.contentEl.contains(a) &&
      (a.instanceOf(HTMLSelectElement) || (a.instanceOf(HTMLInputElement) && ["text", "number", "range"].includes(a.type)) || a.instanceOf(HTMLTextAreaElement));
    if (typing) return;
    btn.focus();
  }

  // ------------------------------------------------------------------ options view

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.dyn = null;
    if (this.view === "preview") {
      this.renderPreview();
      return;
    }
    this.modalEl?.removeClass("is-preview");
    this.setTitle(t("export.title", { title: this.o.host.titleFor(this.state) }));
    const book = this.o.book;
    // the warnings come first (board 26 c)
    const warn = contentEl.createDiv({ cls: "escrita-export-warnings" });

    if (book?.collection) {
      this.renderWhat(this.field(t("export.what")), book);
    } else if (book && book.offerChapter) {
      const f = this.field(t("export.what"));
      this.chips(f, t("export.what"), [
        { label: t("export.what.chapter"), on: !this.state.whole },
        { label: t("export.what.book"), on: this.state.whole },
      ], (i) => { this.state.whole = i === 1; this.render(); this.changed(); });
    }
    if (book && this.state.whole) this.renderChapters(this.field(t(book.collection ? "export.stories" : "export.chapters")), book);

    const formats = this.o.formats;
    const format = this.field(t("export.format"));
    this.chips(format, t("export.format"), formats.map((f) => ({ label: t(`export.format.${f}`), on: this.state.format === f })), (i) => {
      const was = this.state.format;
      this.state.format = formats[i];
      this.render();
      // the cover is read for an EPUB only, and a PDF's pages for a PDF: build again when the format crosses that line
      if ((was === "epub") !== (this.state.format === "epub") || (was === "pdf") !== (this.state.format === "pdf")) this.changed();
    });
    if (this.o.script) this.renderScriptOptions();
    else {
      const preset = this.field(t("export.preset"));
      // the template of the UI language comes first (board 26: pt-BR leads for a Portuguese writer)
      const presets = [...PRESETS].sort((a, b) => Number(b.language === lang()) - Number(a.language === lang()));
      this.chips(preset, t("export.preset"), presets.map((p) => ({
        label: t(`export.preset.${p.id}`), hint: t(`export.preset.${p.id}.hint`), on: this.state.preset === p.id,
      })), (i) => {
        this.state.preset = presets[i].id;
        this.render();
        this.changed();
      });
    }

    const whereBox = contentEl.createDiv({ cls: "escrita-export-wherebox" });
    const where = whereBox.createDiv({ cls: "escrita-export-where" });
    const last = whereBox.createDiv({ cls: "escrita-export-last" });
    const footer = contentEl.createDiv({ cls: "escrita-export-footer" });
    this.dyn = { warn, where, last, footer };
    this.refresh();
  }

  /** A screenplay's rows (board 43 a, b): the page and scene numbers for a PDF, the notes for Fountain. */
  private renderScriptOptions(): void {
    if (this.state.format === "pdf") {
      const page = this.field(t("export.page"));
      this.chips(page, t("export.page"), PAGES.map((id) => ({
        label: t(`export.page.${id}`), hint: t(`export.page.${id}.hint`), on: this.state.preset === id,
      })), (i) => {
        this.state.preset = PAGES[i];
        this.render();
        this.changed();
      });
      this.checkbox(t("export.sceneNumbers"), this.state.sceneNumbers === true, (on) => {
        this.state.sceneNumbers = on;
        this.render();
        this.changed();
      });
    } else {
      // the notes only change what is written, not what is read: nothing to build again
      this.checkbox(t("export.keepNotes"), this.state.keepNotes === true, (on) => {
        this.state.keepNotes = on;
        this.render();
      });
    }
  }

  private checkbox(label: string, on: boolean, pick: (on: boolean) => void): void {
    const b = this.contentEl.createEl("button", { cls: "escrita-export-check", attr: { role: "checkbox", "aria-checked": String(on) } });
    b.createSpan({ cls: `escrita-export-box${on ? " is-on" : ""}` });
    b.createSpan({ text: label });
    b.addEventListener("click", () => pick(!on));
  }

  private field(label: string): HTMLElement {
    const f = this.contentEl.createDiv({ cls: "escrita-export-field" });
    f.createDiv({ cls: "escrita-export-label", text: label });
    return f;
  }

  private chips(parent: HTMLElement, label: string, items: { label: string; hint?: string; on: boolean }[], pick: (i: number) => void): void {
    const row = parent.createDiv({ cls: "escrita-export-chips", attr: { role: "radiogroup", "aria-label": label } });
    items.forEach((it, i) => {
      const b = row.createEl("button", { cls: "escrita-export-chip", attr: { role: "radio", "aria-checked": String(it.on) } });
      if (it.on) b.addClass("is-on");
      b.createSpan({ text: it.label });
      if (it.hint) b.createSpan({ cls: "escrita-export-chip-hint", text: it.hint });
      b.addEventListener("click", () => { if (!it.on) pick(i); });
    });
  }

  /** A collection is always exported whole: the row only says what it is ("Collection: 3 stories"). */
  private renderWhat(parent: HTMLElement, book: BookOptions): void {
    const n = this.plan()?.included.length ?? book.chapters.filter((c) => c.include).length;
    parent.createDiv({ cls: "escrita-export-muted", text: plural("export.what.collection", n, { n: fmt(n) }) });
  }

  private renderChapters(parent: HTMLElement, book: BookOptions): void {
    const plan = this.plan()!;
    const total = plan.included.length;
    const sel = this.state.selection;
    const group = parent.createDiv({ cls: "escrita-export-radios", attr: { role: "radiogroup", "aria-label": t("export.chapters") } });
    const radio = (parentEl: HTMLElement, on: boolean, label: string, pick: () => void): HTMLElement => {
      const row = parentEl.createEl("label", { cls: "escrita-export-radio" });
      const input = row.createEl("input", { attr: { type: "radio", name: "escrita-export-chapters" } });
      input.checked = on;
      input.addEventListener("change", () => { if (input.checked) pick(); });
      row.createSpan({ text: label });
      return row;
    };
    radio(group, sel.mode === "all", t("export.chapters.all", { n: fmt(total) }), () => {
      this.state.selection = { mode: "all" };
      this.render();
      this.changed();
    });

    const rangeRow = group.createDiv({ cls: "escrita-export-range" });
    const from = sel.mode === "range" ? sel.from : 1;
    const to = sel.mode === "range" ? sel.to : Math.max(1, total);
    radio(rangeRow, sel.mode === "range", t("export.chapters.from"), () => {
      this.state.selection = { mode: "range", from, to };
      this.render();
      this.changed();
    });
    const num = (value: number, label: string): HTMLInputElement => {
      const i = rangeRow.createEl("input", { cls: "escrita-export-num", attr: { type: "number", "aria-label": label, min: "1", max: String(Math.max(1, total)) } });
      i.value = String(value);
      return i;
    };
    const fromInput = num(from, t("export.chapters.fromLabel"));
    rangeRow.createSpan({ text: t("export.chapters.to") });
    const toInput = num(to, t("export.chapters.toLabel"));
    const onRange = () => {
      const a = Math.max(1, Math.floor(Number(fromInput.value)) || 1);
      const b = Math.max(1, Math.floor(Number(toInput.value)) || a);
      this.state.selection = { mode: "range", from: a, to: b };
      this.changed(250);
    };
    fromInput.addEventListener("change", onRange);
    toInput.addEventListener("change", onRange);

    const pickRow = radio(group, sel.mode === "pick", t("export.chapters.pick"), () => { void this.pickChapters(); });
    if (sel.mode === "pick") {
      pickRow.createSpan({ cls: "escrita-export-muted", text: ` ${t("export.chapters.picked", { n: fmt(plan.chosen.length), total: fmt(total) })}` });
    }
    // re-clicking "Choose…" while it is on must still open the picker
    pickRow.addEventListener("click", (e) => {
      if (sel.mode === "pick" && (e.target as HTMLElement).tagName !== "INPUT") { e.preventDefault(); void this.pickChapters(); }
    });

    if (plan.left.length > 0) {
      parent.createDiv({
        cls: "escrita-export-hint",
        text: plural("export.chapters.left", plan.left.length, {
          names: plan.left.map((c) => noteName(c.path)).join(", "),
          property: book.compileProperty,
        }),
      });
    }
  }

  private async pickChapters(): Promise<void> {
    const plan = this.plan();
    if (!plan) return;
    const current = this.state.selection.mode === "pick"
      ? new Set(this.state.selection.paths)
      : new Set(plan.chosen.map((c) => c.ref.path));
    const heads = new Map(plan.included.map((c) => [c.ref.path, c.heading]));
    const picked = await askChapters(this.app, this.o.book!.chapters, heads, current, this.o.book!.compileProperty, this.o.book!.collection === true);
    if (picked !== null) {
      this.state.selection = { mode: "pick", paths: picked };
      this.changed();
    }
    this.render();
  }

  /** The regions that depend on the build: warnings, the "Writes" box, the last-export line and the footer. */
  private refresh(): void {
    const d = this.dyn;
    if (!d) return;
    this.drawWarnings(d.warn);
    this.drawWhere(d.where);
    this.drawLast(d.last);
    this.drawFooter(d.footer);
    this.focusPrimary();
  }

  private drawWarnings(el: HTMLElement): void {
    el.empty();
    if (this.loading && this.built === null) {
      el.createDiv({ cls: "escrita-export-muted", text: t("export.reading") });
      return;
    }
    if (this.failed) {
      el.createDiv({ cls: "escrita-export-warn-title", text: t("export.readError") });
      return;
    }
    if (this.emptyChoice()) {
      el.createDiv({ cls: "escrita-export-hint", text: t(this.o.book?.collection ? "export.stories.none" : "export.chapters.none") });
      return;
    }
    const list = this.built?.warnings ?? [];
    if (list.length === 0) return;
    const box = el.createDiv({ cls: "escrita-export-warn", attr: { role: "group", "aria-label": t("export.warn.title") } });
    box.createDiv({ cls: "escrita-export-warn-title", text: t("export.warn.title") });
    for (const w of list) this.warningRow(box, w, this.o.marker);
  }

  private warningRow(box: HTMLElement, w: Warning, marker: string): void {
    const row = box.createDiv({ cls: `escrita-export-wl is-${w.level}` });
    row.createSpan({ cls: "escrita-export-wtext", text: this.warningText(w, marker) });
    const named = this.o.book !== null && this.state.whole;
    const shown = w.links.slice(0, 4);
    for (const link of shown) {
      const text = !named
        ? t("export.warn.line", { line: fmt(link.line + 1) })
        : t("export.warn.lineIn", { where: link.where, line: fmt(link.line + 1) });
      const b = row.createEl("button", {
        cls: "escrita-export-go",
        text,
        attr: { "aria-label": t("export.warn.go", { line: fmt(link.line + 1), where: link.where }) },
      });
      b.addEventListener("click", () => { this.close(); this.o.host.jump(link.path, link.line); });
    }
    if (w.links.length > shown.length) row.createSpan({ cls: "escrita-export-muted", text: t("export.warn.more", { n: fmt(w.links.length - shown.length) }) });
  }

  private warningText(w: Warning, marker: string): string {
    const names = w.names.filter((n) => n !== "").join(", ") || "…";
    switch (w.id) {
      case "placeholders": return plural("export.warn.placeholders", w.n, { marker });
      case "unwrittenBeats": return plural("export.warn.unwrittenBeats", w.n);
      case "embeds": return plural("export.warn.embeds", w.n, { names });
      case "unclosedComment": return t("export.warn.unclosedComment");
      case "unclosedHtmlComment": return t("export.warn.unclosedHtmlComment");
      case "emptyBody": return t("export.warn.emptyBody");
      case "cover": return t("export.warn.cover", { names });
      case "unsupported": return plural("export.warn.unsupported", w.n, { names });
      case "missingStories": return plural("export.warn.missingStories", w.n, { names: w.names.map((n) => `[[${n}]]`).join(", ") });
    }
  }

  private drawWhere(el: HTMLElement): void {
    el.empty();
    const path = this.o.host.pathFor(this.state);
    const [before, after] = t("export.where", { path: "\u0000" }).split("\u0000");
    el.createSpan({ text: before });
    el.createSpan({ cls: "escrita-export-mono", text: path });
    el.createSpan({ text: after });
    const built = this.built;
    if (!built) return;
    if (this.o.script) {
      this.drawScriptWhere(el, built);
      return;
    }
    const count = this.aboutText(built.source.count.amount, built.source.count.unit);
    const book = this.o.book !== null && this.state.whole;
    let sentence: string;
    if (this.state.format === "epub") sentence = t(built.cover ? "export.where.epubCover" : "export.where.epub");
    else if (!book) sentence = t("export.where.note", { count });
    else {
      const front = this.o.book!.front;
      const label = front.length === 2 ? "both" : front[0];
      const kind = this.o.book!.collection ? "collection" : "book";
      sentence = front.length === 0
        ? t(`export.where.${kind}`, { count })
        : t(`export.where.${kind}Front`, { count, front: t(`export.where.front.${label}`) });
    }
    el.createSpan({ text: ` ${sentence}` });
  }

  /** The "Writes" box of a script (board 43 a, b): the PDF's page count and title page, or what Fountain is. */
  private drawScriptWhere(el: HTMLElement, built: Built): void {
    if (this.state.format === "fountain") {
      // the path sits inside the sentence, which carries on after it (board 43 b)
      el.empty();
      const [before, after] = t("export.where.fountain", { path: "\u0000" }).split("\u0000");
      el.createSpan({ text: before });
      el.createSpan({ cls: "escrita-export-mono", text: this.o.host.pathFor(this.state) });
      el.createSpan({ text: after });
      return;
    }
    const pages = built.screenplay?.pdf?.pages;
    if (pages === undefined) return;
    el.createSpan({ text: ` ${plural("export.where.pdf", pages, { n: fmt(pages), credit: this.o.script?.credit ?? "" })}` });
  }

  private aboutText(amount: number, unit: PieceUnit): string {
    return t(`export.about.${unit}`, { n: fmt(aboutCount(amount)) });
  }

  private drawLast(el: HTMLElement): void {
    el.empty();
    const last = this.o.last;
    if (!last) return;
    const parts = [t(`export.format.${last.format}`)];
    if (last.format !== "fountain") parts.push(presetLabel(last.preset));
    // the count is chapters for a book and pages for a PDF
    if (last.chapterCount !== undefined) parts.push(plural(last.format === "pdf" ? "export.last.pages" : "export.last.chapters", last.chapterCount));
    const text = t("export.last", { summary: parts.join(" · "), when: whenText(last.at, lang()) });
    el.createSpan({ text });
    const name = last.path.split("/").pop() ?? last.path;
    if (this.o.host.fileExists(last.path)) {
      const a = el.createEl("a", { cls: "escrita-export-mono", text: name, attr: { href: "#" } });
      a.addEventListener("click", (e) => { e.preventDefault(); if (this.o.host.openLast(last.path)) this.close(); });
    } else {
      el.createSpan({ cls: "escrita-export-mono escrita-export-muted", text: name });
      el.createSpan({ cls: "escrita-export-muted", text: ` ${t("export.last.gone")}` });
    }
  }

  private primaryText(): string {
    return this.built && needsConfirm(this.built.warnings) ? t("export.buttonAnyway") : t("export.button");
  }

  private drawFooter(el: HTMLElement): void {
    el.empty();
    const again = this.o.last;
    if (again) {
      const b = el.createEl("button", { cls: "escrita-export-again", text: t("export.again") });
      b.disabled = this.busy;
      b.addEventListener("click", () => { void this.again(again); });
    }
    const right = el.createDiv({ cls: "modal-button-container escrita-export-buttons" });
    right.createEl("button", { text: t("export.cancel") }).addEventListener("click", () => this.close());
    // Fountain has no pages to preview (board 43 b)
    if (!(this.o.script && this.state.format === "fountain")) {
      const preview = right.createEl("button", { text: t("export.previewButton") });
      preview.disabled = !this.canExport();
      preview.addEventListener("click", () => { this.view = "preview"; this.render(); });
    }
    const go = right.createEl("button", { cls: "mod-cta", text: this.primaryText() });
    go.disabled = !this.canExport();
    go.addEventListener("click", () => { void this.doExport(); });
  }

  /** Export again (Q17): the last choices, the same warnings; it runs by itself only when nothing needs a confirmation. */
  private async again(last: LastExport): Promise<void> {
    this.state = { ...stateOfLast(last, this.o.book !== null, this.o.book?.offerChapter ?? false), sceneNumbers: this.state.sceneNumbers, keepNotes: this.state.keepNotes };
    this.render();
    // One build only: a pending timer would start a second one and drop this call's result.
    if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; }
    this.built = null;
    this.builtKey = "";
    const built = await this.ensureBuilt();
    // the last file's whereabouts are the host's to judge: it asks where to write when it moved or is gone
    if (built && !needsConfirm(built.warnings) && (this.o.host.canRepeat?.(last, this.state) ?? true)) await this.doExport(true);
  }

  private async doExport(again = false): Promise<void> {
    if (this.busy) return;
    const built = await this.ensureBuilt();
    if (!built || this.emptyChoice()) return;
    this.busy = true;
    this.refresh();
    let ok = false;
    try {
      ok = await this.o.host.write(this.state, built, again);
    } finally {
      this.busy = false;
    }
    if (ok) this.close();
    else this.refresh();
  }

  // ------------------------------------------------------------------ preview view

  private renderPreview(): void {
    const { contentEl } = this;
    this.dropCoverUrl();
    this.modalEl?.addClass("is-preview");
    this.setTitle("");
    const head = contentEl.createDiv({ cls: "escrita-export-phead" });
    head.createSpan({ cls: "escrita-export-ptitle", text: t("export.title", { title: this.o.host.titleFor(this.state) }) });
    const crumb = head.createSpan({ cls: "escrita-export-crumb" });
    crumb.createSpan({ text: `${t("export.preview.crumbOptions")} › ` });
    crumb.createEl("b", { text: t("export.preview.crumb") });
    const plan = this.plan();
    const summary = [t(`export.format.${this.state.format}`), presetLabel(this.state.preset)];
    if (plan) summary.push(plural("export.last.chapters", plan.chosen.length));
    const pdf = this.built?.screenplay?.pdf;
    if (pdf) summary.push(plural("export.last.pages", pdf.pages));
    head.createSpan({ cls: "escrita-export-crumb escrita-export-psummary", text: summary.join(" · ") });

    const scroll = contentEl.createDiv({ cls: "escrita-export-scroll", attr: { role: "document", "aria-label": t("export.preview.label") } });
    const built = this.built;
    if (!built) scroll.createDiv({ cls: "escrita-export-muted", text: t("export.reading") });
    else if (built.screenplay) {
      const path = built.paths[0];
      drawScriptPages(scroll, built.screenplay, {
        titlePage: t("export.preview.titlePage"),
        page: (n) => t("export.preview.page", { n: fmt(n) }),
        tip: (line) => t("export.preview.tip", { where: built.labels[0] ?? "", line: fmt(line + 1) }),
        open: (line) => { if (path) { this.close(); this.o.host.jump(path, line); } },
      });
    } else {
      const epub = this.state.format === "epub";
      const layout = epubLayout(presetById(this.state.preset), this.o.epubSceneBreak);
      // the last preview's cover URL goes with its image (the preview is drawn anew)
      this.dropCoverUrl();
      if (epub && built.cover) {
        try {
          this.coverUrl = URL.createObjectURL(new Blob([built.cover.data as BlobPart], { type: built.cover.mediaType }));
        } catch { /* no object URLs here: the preview draws a plain cover box */ }
      }
      const writer = new PreviewWriter(scroll, {
        epub: epub ? { sceneBreak: layout.sceneBreak, contentsLabel: layout.contentsLabel, cover: built.cover != null, coverUrl: this.coverUrl } : undefined,
        where: (part) => built.labels[part] ?? "",
        tip: (part, line) => t("export.preview.tip", { where: built.labels[part] ?? "", line: fmt(line + 1) }),
        open: (part, line) => { const path = built.paths[part]; if (path) { this.close(); this.o.host.jump(path, line); } },
        zone: (kind) => t(`export.preview.zone.${kind}`),
      });
      writer.write(built.doc, presetById(this.state.preset));
    }

    const foot = contentEl.createDiv({ cls: "escrita-export-pfoot" });
    foot.createEl("button", { text: t("export.preview.back") }).addEventListener("click", () => { this.view = "options"; this.render(); });
    foot.createSpan({ cls: "escrita-export-hint escrita-export-phint", text: t("export.preview.hint") });
    const go = foot.createEl("button", { cls: "mod-cta escrita-export-pgo", text: this.primaryText() });
    go.disabled = !this.canExport();
    go.addEventListener("click", () => { void this.doExport(); });
  }
}

// ------------------------------------------------------------------ the dialogs' entry points (board 26 d)

/** The file is already there: cancel, keep both (a new name), or replace. Closing the dialog is a cancel. */
export function askExists(app: App, path: string, mtime: number | null, canReplace = true): Promise<ExistsAnswer> {
  return new Promise((resolve) => new ExistsModal(app, path, mtime, resolve, canReplace).open());
}

/** Export again found the last file moved or gone: ask before writing at the usual place. True to write. */
export function askWhere(app: App, path: string): Promise<boolean> {
  return new Promise((resolve) => new WhereModal(app, path, resolve).open());
}
