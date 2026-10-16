// The PDF preview of a screenplay (board 43 d): the pages as the PDF has them, title page
// first, drawn from the same `paginate` output the PDF is, so the breaks match. Light pages
// in a monospace font; every position is in em (a column is 0.6 em, a line 1 em, as in
// Courier 12), so the page scales with one font size. DOM only through Obsidian's element
// helpers; no innerHTML.

import type { ScriptRun } from "../core/fountain";
import { paginate, type Page, type PageRow } from "../core/screenplay-pages";
import type { ScreenplayBuilt } from "./screenplay";

export interface ScriptPreviewLabels {
  titlePage: string;
  page(n: number): string;
  /** the tooltip of a row: "Open O farol, line 12" */
  tip(line: number): string;
  /** a row was clicked: open the note at this 0-based line */
  open(line: number): void;
}

/** Points per em at Courier 12. */
const EM = 12;
/** A column in em (Courier's advance is 0.6 em). */
const COL = 0.6;

function drawRuns(parent: HTMLElement, runs: ScriptRun[]): void {
  for (const r of runs) {
    if (r.text === "") continue;
    const span = parent.createSpan({ text: r.text });
    if (r.bold) span.addClass("is-bold");
    if (r.italic) span.addClass("is-italic");
    if (r.underline) span.addClass("is-underline");
  }
}

function drawRow(page: HTMLElement, preset: ScreenplayBuilt["preset"], row: PageRow, labels: ScriptPreviewLabels): void {
  const y = (preset.top + row.row * EM) / EM;
  const line = page.createDiv({ cls: "escrita-sp-row", attr: { title: labels.tip(row.line) } });
  line.setCssStyles({ top: `${y}em`, left: `${row.col * COL}em` });
  drawRuns(line, row.runs);
  line.addEventListener("click", () => labels.open(row.line));
  if (row.sceneNumber) {
    const n = [...row.sceneNumber].length;
    const at = (col: number) => {
      const el = page.createDiv({ cls: "escrita-sp-row escrita-sp-scene-number", text: row.sceneNumber });
      el.setCssStyles({ top: `${y}em`, left: `${col * COL}em` });
    };
    at(preset.columns.scene.left - 1 - n);
    at(preset.columns.scene.right + 1);
  }
}

function newPage(parent: HTMLElement, preset: ScreenplayBuilt["preset"], tag: string): HTMLElement {
  const page = parent.createDiv({ cls: "escrita-sp-page" });
  page.setCssStyles({ width: `${preset.page.width / EM}em`, height: `${preset.page.height / EM}em` });
  page.createSpan({ cls: "escrita-sp-tag", text: tag });
  return page;
}

/** The title page as the PDF lays it out: the title underlined a third of the way down, then credit, author and source centered; the draft date and the contact at the bottom left. */
function drawTitlePage(parent: HTMLElement, sp: ScreenplayBuilt, tag: string): void {
  const tp = sp.titlePage;
  const page = newPage(parent, sp.preset, tag);
  const a = sp.preset.columns.action;
  const middle = page.createDiv({ cls: "escrita-sp-title" });
  middle.setCssStyles({ top: `${(sp.preset.top + Math.floor(sp.preset.linesPerPage * 0.33) * EM) / EM}em`, left: `${a.left * COL}em`, width: `${(a.right - a.left) * COL}em` });
  middle.createDiv({ cls: "is-underline", text: tp.title.toUpperCase() });
  for (const text of [tp.credit, tp.author, tp.source]) {
    if (text) middle.createDiv({ cls: "escrita-sp-title-gap", text });
  }
  const bottom = [...(tp.draftDate ? [tp.draftDate, ""] : []), ...(tp.contact ?? [])];
  if (bottom.length > 0) {
    const box = page.createDiv({ cls: "escrita-sp-contact" });
    box.setCssStyles({ left: `${a.left * COL}em` });
    for (const l of bottom) box.createDiv({ text: l === "" ? " " : l });
  }
}

/** Draws every page into `parent`. Returns the pages (the PDF's count is title page + these). */
export function drawScriptPages(parent: HTMLElement, sp: ScreenplayBuilt, labels: ScriptPreviewLabels): Page[] {
  const wrap = parent.createDiv({ cls: "escrita-sp-pages" });
  if (sp.titlePage.title.trim() !== "") drawTitlePage(wrap, sp, labels.titlePage);
  const pages = paginate(sp.script, sp.preset);
  const shown = pages.length > 0 ? pages : [];
  for (const p of shown) {
    const page = newPage(wrap, sp.preset, labels.page(p.number + (sp.titlePage.title.trim() !== "" ? 1 : 0)));
    if (p.number >= 2) {
      const num = page.createDiv({ cls: "escrita-sp-row", text: `${p.number}.` });
      num.setCssStyles({ top: `${sp.preset.top / 2 / EM}em`, left: `${(sp.preset.columns.action.right - `${p.number}.`.length) * COL}em` });
    }
    for (const row of p.rows) drawRow(page, sp.preset, row, labels);
  }
  return pages;
}
