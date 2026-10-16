// A screenplay as a PDF (SP 6, PLAN-1.1; no Obsidian imports): the title page, the pages from
// core/screenplay-pages.ts, and the drawing through core/pdf.ts. The export module's writer
// is a thin call to `screenplayPdf`. Courier 12: a column is 7.2 points, a line 12.

import { COURIER_ADVANCE, pdfOf, unsupportedIn, type PdfFace, type PdfPage, type PdfText } from "./pdf";
import type { Script, ScriptRun, TitlePage } from "./fountain";
import { paginate, rowText, type PageRow } from "./screenplay-pages";
import type { ScreenplayPreset } from "./screenplay-presets";

const SIZE = 12;
const COL = SIZE * COURIER_ADVANCE;
const LINE = SIZE;
/** The line of a title page row: it comes from the properties and the settings, not from a line of the note. */
export const TITLE_PAGE_LINE = -1;

/** the baseline sits this far below the top of its line box */
const BASE = 9;

export interface ScreenplayPdf {
  bytes: Uint8Array;
  /** every page, the title page included */
  pages: number;
  /** characters Courier's WinAnsi cannot print (shown as "?"), with the 0-based note line (Q7); `TITLE_PAGE_LINE` on the title page */
  unsupported: { char: string; line: number }[];
}

const faceOf = (r: ScriptRun): PdfFace => (r.bold && r.italic ? "boldItalic" : r.bold ? "bold" : r.italic ? "italic" : "regular");

function itemsOf(col: number, y: number, runs: ScriptRun[]): PdfText[] {
  const out: PdfText[] = [];
  let c = col;
  for (const r of runs) {
    if (r.text === "") continue;
    out.push({ x: c * COL, y, text: r.text, face: faceOf(r), size: SIZE, underline: !!r.underline });
    c += [...r.text].length;
  }
  return out;
}

/** The title page as printed rows: title centered a third of the way down, contact at the bottom left. */
function titleRows(tp: TitlePage, preset: ScreenplayPreset): PageRow[] {
  const rows: PageRow[] = [];
  const a = preset.columns.action;
  const width = a.right - a.left;
  const center = (text: string, row: number, runs?: ScriptRun[]) => {
    const rs = runs ?? [{ text }];
    const n = [...text].length;
    rows.push({ row, col: a.left + Math.max(0, Math.floor((width - n) / 2)), runs: rs, line: TITLE_PAGE_LINE });
  };
  const wrapped = (text: string, w: number): string[] => {
    const out: string[] = [];
    for (const hard of text.split("\n")) {
      let cur = "";
      for (const word of hard.split(/\s+/).filter(Boolean)) {
        if (cur !== "" && [...cur].length + 1 + [...word].length > w) {
          out.push(cur);
          cur = word;
        } else cur = cur === "" ? word : cur + " " + word;
      }
      out.push(cur);
    }
    return out;
  };
  let row = Math.floor(preset.linesPerPage * 0.33);
  for (const l of wrapped(tp.title.toUpperCase(), 40)) center(l, row++, [{ text: l, underline: true }]);
  const block = (text: string | undefined) => {
    if (!text) return;
    row++;
    for (const l of wrapped(text, width)) center(l, row++);
  };
  block(tp.credit);
  block(tp.author);
  block(tp.source);
  // bottom left: the draft date, then the contact lines, ending on the last row
  const bottom: string[] = [];
  if (tp.draftDate) bottom.push(tp.draftDate);
  if (tp.draftDate && tp.contact?.length) bottom.push("");
  bottom.push(...(tp.contact ?? []));
  let r = preset.linesPerPage - bottom.length;
  for (const l of bottom) {
    if (l !== "") rows.push({ row: r, col: a.left, runs: [{ text: l }], line: TITLE_PAGE_LINE });
    r++;
  }
  return rows;
}

/**
 * The PDF for a script: the title page (unnumbered), then the body pages with "N." at the
 * top right from the body's page 2. Characters Courier cannot print come back in
 * `unsupported` with their note line, and print as "?".
 */
export function screenplayPdf(script: Script, titlePage: TitlePage, preset: ScreenplayPreset): ScreenplayPdf {
  const body = paginate(script, preset);
  const { width, height } = preset.page;
  const pdfPages: PdfPage[] = [];
  const unsupported: { char: string; line: number }[] = [];
  const seen = new Set<string>();
  const scan = (rows: PageRow[]) => {
    for (const r of rows) {
      for (const ch of unsupportedIn(rowText(r))) {
        const key = `${r.line}:${ch}:${r.row}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unsupported.push({ char: ch, line: r.line });
      }
    }
  };

  const draw = (rows: PageRow[], items: PdfText[]) => {
    for (const r of rows) {
      const y = preset.top + r.row * LINE + BASE;
      items.push(...itemsOf(r.col, y, r.runs));
      if (r.sceneNumber) {
        const n = [...r.sceneNumber].length;
        items.push(...itemsOf(preset.columns.scene.left - 1 - n, y, [{ text: r.sceneNumber }]));
        items.push(...itemsOf(preset.columns.scene.right + 1, y, [{ text: r.sceneNumber }]));
      }
    }
  };

  const hasTitle = titlePage.title.trim() !== "";
  if (hasTitle) {
    const rows = titleRows(titlePage, preset);
    scan(rows);
    const items: PdfText[] = [];
    draw(rows, items);
    pdfPages.push({ width, height, items });
  }
  for (const p of body) {
    scan(p.rows);
    const items: PdfText[] = [];
    if (p.number >= 2) {
      const label = `${p.number}.`;
      items.push(...itemsOf(preset.columns.action.right - label.length, preset.top / 2 + BASE, [{ text: label }]));
    }
    draw(p.rows, items);
    pdfPages.push({ width, height, items });
  }
  if (pdfPages.length === 0) pdfPages.push({ width, height, items: [] });

  const bytes = pdfOf(pdfPages, { title: titlePage.title, author: titlePage.author });
  return { bytes, pages: pdfPages.length, unsupported };
}
