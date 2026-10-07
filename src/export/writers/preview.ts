// The preview writer (PLAN-0.8 Q16, board 27): a third ManuscriptWriter, behind the same
// seam as the Markdown and DOCX writers, that draws the ExportDoc into a container with
// createEl. It can't drift from the file, because it reads the same model. A reading
// column, not pages: no page breaks, no page numbers. Bands mark where the file starts a
// page for the front matter and the text. No obsidian imports: createEl and friends are
// Obsidian's HTMLElement helpers, present in the app and in the tests' DOM setup.
import { aboutCount, fillTemplate, isBookDoc, type ExportDoc, type ManuscriptWriter, type Preset } from "../../core/export-pipeline";
import type { Block, Run } from "../../core/manuscript";

/** CSS pixels per point: a 12 pt manuscript reads at 15 px in the column. */
const PX = 1.25;

export interface PreviewHooks {
  /** how the tip names a part ("01 A chegada") */
  where?(part: number): string;
  /** the tip's text; default `where, line N` */
  tip?(part: number, line: number): string;
  /** a click on a block that knows its line */
  open?(part: number, line: number): void;
  /** the band labels, by role ("dedication", "epigraph", "text") */
  zone?(kind: "dedication" | "epigraph" | "text" | "cover" | "contents"): string;
  /**
   * Draw an EPUB's reading column instead of a manuscript (0.9, board 31): no contact lines, no
   * word count, no end mark; the cover, the title page, the table of contents and each chapter
   * opening a section, with the EPUB's own scene break. Absent: the manuscript.
   */
  epub?: {
    /** the `epubSceneBreak` setting */
    sceneBreak: string;
    /** the contents' title in the preset's language ("Sumário") */
    contentsLabel: string;
    /** the cover image's object URL; null draws a plain cover box when `cover` is true */
    coverUrl: string | null;
    /** the book has a cover image */
    cover: boolean;
  };
}

function appendRuns(el: HTMLElement, runs: readonly Run[]): void {
  for (const r of runs) {
    let host = el;
    if (r.bold) host = host.createEl("strong");
    if (r.italic) host = host.createEl("em");
    r.text.split("\n").forEach((line, i) => {
      if (i > 0) host.createEl("br");
      if (line !== "") host.createSpan({ text: line });
    });
  }
}

/** The title page's count, in the preset's language ("cerca de 18.500 palavras"). */
export function countLine(doc: ExportDoc, preset: Preset): string {
  if (doc.count.amount <= 0) return "";
  return fillTemplate(preset.countLabel[doc.count.unit], {
    n: new Intl.NumberFormat(preset.language).format(aboutCount(doc.count.amount)),
  });
}

export class PreviewWriter implements ManuscriptWriter<ExportDoc> {
  readonly id = "preview";
  readonly ext = "";

  /** `host` is emptied and redrawn by every `write`. */
  constructor(private host: HTMLElement, private hooks: PreviewHooks = {}) {}

  /** Draws the document; returns "" (a preview writes no file). */
  write(doc: ExportDoc, preset: Preset): string {
    const host = this.host;
    host.empty();
    const epub = this.hooks.epub;
    const paper = host.createDiv({ cls: epub ? "escrita-export-paper is-epub" : "escrita-export-paper", attr: { lang: preset.language } });
    if (!epub) paper.setCssStyles({
      fontFamily: `"${preset.font.family}", "Times New Roman", Times, serif`,
      fontSize: `${preset.font.size * PX}px`,
      lineHeight: String(preset.lineSpacing),
    });
    if (!epub) paper.style.setProperty("--escrita-export-indent", `${preset.indent * PX}px`);
    const tip = host.createDiv({ cls: "escrita-export-tip" });
    tip.hide?.();

    if (epub) {
      this.epubFront(paper, doc, preset, epub);
    } else this.titlePage(paper, doc, preset);

    const book = isBookDoc(doc);
    let firstBody = true;
    let wrote = false;
    doc.parts.forEach((part, index) => {
      const blocks = part.manuscript.blocks;
      if (part.role !== "body" && blocks.length === 0) return;
      wrote = true;
      // bands only where a book's file starts a page for its front matter and its text
      if (book && !epub) {
        if (part.role !== "body") this.zone(paper, part.role);
        else if (firstBody && part.heading !== null) this.zone(paper, "text");
      }
      if (part.role === "body") firstBody = false;
      if (epub && part.role !== "body") this.zone(paper, part.role);
      if (part.role === "body" && part.heading !== null) paper.createDiv({ cls: epub ? "escrita-export-chapter is-opener" : "escrita-export-chapter", text: part.heading });
      for (const b of blocks) this.block(paper, b, index, part.role !== "body", preset);
    });
    if (wrote && preset.endMark && !epub) paper.createDiv({ cls: "escrita-export-end", text: preset.endMark });

    this.wire(paper, tip);
    return "";
  }

  /** The EPUB's first pages: the cover, the title page and the table of contents (Q6, board 31). */
  private epubFront(paper: HTMLElement, doc: ExportDoc, preset: Preset, epub: NonNullable<PreviewHooks["epub"]>): void {
    if (epub.cover) {
      this.zone(paper, "cover");
      const box = paper.createDiv({ cls: "escrita-export-cover" });
      if (epub.coverUrl) box.createEl("img", { attr: { src: epub.coverUrl, alt: "" } });
    }
    paper.createDiv({ cls: "escrita-export-title is-epub", text: doc.title });
    const name = doc.author.name.trim();
    if (name !== "") paper.createDiv({ cls: "escrita-export-byline", text: fillTemplate(preset.byline, { name }) });
    this.zone(paper, "contents");
    paper.createDiv({ cls: "escrita-export-contents-title", text: epub.contentsLabel });
    const list = paper.createEl("ol", { cls: "escrita-export-contents" });
    for (const part of doc.parts) {
      if (part.role !== "body") continue;
      list.createEl("li", { text: part.heading ?? doc.title });
    }
  }

  private titlePage(paper: HTMLElement, doc: ExportDoc, preset: Preset): void {
    const count = countLine(doc, preset);
    const contact = [doc.author.name.trim(), ...doc.author.contact.map((c) => c.trim())].filter((c) => c !== "");
    if (contact.length > 0 || count !== "") {
      const top = paper.createDiv({ cls: "escrita-export-top" });
      const left = top.createDiv({ cls: "escrita-export-contact" });
      for (const line of contact) left.createDiv({ text: line });
      if (count !== "") top.createDiv({ cls: "escrita-export-count", text: count });
    }
    paper.createDiv({ cls: isBookDoc(doc) ? "escrita-export-title is-book" : "escrita-export-title", text: doc.title });
    const name = doc.author.name.trim();
    if (name !== "") paper.createDiv({ cls: "escrita-export-byline", text: fillTemplate(preset.byline, { name }) });
  }

  private zone(paper: HTMLElement, kind: "dedication" | "epigraph" | "text" | "cover" | "contents"): void {
    const label = this.hooks.zone?.(kind) ?? kind;
    paper.createDiv({ cls: "escrita-export-zone", text: label });
  }

  private block(paper: HTMLElement, b: Block, part: number, front: boolean, preset: Preset): void {
    let el: HTMLElement;
    switch (b.kind) {
      case "sceneBreak":
        el = paper.createDiv({ cls: "escrita-export-break", text: this.hooks.epub?.sceneBreak ?? preset.sceneBreak });
        break;
      case "heading":
        el = paper.createDiv({ cls: `escrita-export-heading is-h${b.level}` });
        appendRuns(el, b.runs);
        break;
      case "quote":
        el = paper.createEl("p", { cls: "escrita-export-quote" });
        appendRuns(el, b.runs);
        break;
      case "paragraph":
        el = paper.createEl("p", { cls: front ? "escrita-export-front" : "escrita-export-para" });
        appendRuns(el, b.runs);
        break;
    }
    if (b.line !== undefined && b.kind !== "sceneBreak") {
      el.addClass("is-linked");
      el.setAttr("data-part", String(part));
      el.setAttr("data-line", String(b.line));
    }
  }

  /** One hover tip and one click handler for the whole column. */
  private wire(paper: HTMLElement, tip: HTMLElement): void {
    const linked = (target: EventTarget | null): HTMLElement | null => {
      const el = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-line]") : null;
      return el && paper.contains(el) ? el : null;
    };
    const at = (el: HTMLElement) => ({ part: Number(el.getAttribute("data-part")), line: Number(el.getAttribute("data-line")) });
    paper.addEventListener("mouseover", (e) => {
      const el = linked(e.target);
      if (!el) { tip.hide?.(); return; }
      const { part, line } = at(el);
      const where = this.hooks.where?.(part) ?? "";
      tip.setText(this.hooks.tip ? this.hooks.tip(part, line) : `${where}, ${line + 1}`);
      tip.show?.();
      const host = tip.parentElement;
      if (host) {
        const box = el.getBoundingClientRect();
        const outer = host.getBoundingClientRect();
        tip.style.top = `${Math.max(0, box.top - outer.top + host.scrollTop - 30)}px`;
      }
    });
    paper.addEventListener("mouseleave", () => tip.hide?.());
    paper.addEventListener("click", (e) => {
      const el = linked(e.target);
      if (!el || !this.hooks.open) return;
      const { part, line } = at(el);
      this.hooks.open(part, line);
    });
  }
}
