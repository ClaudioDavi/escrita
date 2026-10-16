// The screenplay PDF writer (SP 6, PLAN-1.1): a thin call to core/screenplay-pdf.ts, which
// paginates the script, draws the title page and the pages, and lists the characters Courier
// cannot print (PLAN-1.1 Q7). No Obsidian imports.

import type { ManuscriptWriter } from "../../core/export-pipeline";
import type { Script, TitlePage } from "../../core/fountain";
import { screenplayPdf, type ScreenplayPdf } from "../../core/screenplay-pdf";
import type { ScreenplayPreset } from "../../core/screenplay-presets";

/** What the PDF takes: the script and the merged title page. */
export interface ScriptDoc {
  script: Script;
  titlePage: TitlePage;
}

/** The whole result: the bytes, the page count and the characters printed as "?" with their lines. */
export function pdfOfScript(doc: ScriptDoc, preset: ScreenplayPreset): ScreenplayPdf {
  return screenplayPdf(doc.script, doc.titlePage, preset);
}

export const pdfWriter: ManuscriptWriter<ScriptDoc, ScreenplayPreset> = {
  id: "pdf",
  ext: "pdf",
  write: (doc, preset) => pdfOfScript(doc, preset).bytes,
};
