// Which export formats a source offers (PLAN-1.1 Q3; no Obsidian imports). A single note
// whose form is a screenplay exports as a script (PDF first, then Fountain) and never as
// prose; every other source keeps the prose formats. A book or collection exports as prose
// even when its notes are screenplays (feature-length scripts are SP 7, phase 3).

import type { FormKind } from "./form";

/** The export formats (0.8: Markdown and DOCX; 0.9 EPUB, PLAN-0.9 Q5; 1.1 PDF and Fountain for screenplays). */
export type ExportFormat = "md" | "docx" | "epub" | "pdf" | "fountain";
export const EXPORT_FORMATS: readonly ExportFormat[] = ["md", "docx", "epub", "pdf", "fountain"];

/** The prose formats in the order the modal shows them (DOCX first, as in 0.8). */
export const PROSE_FORMATS: readonly ExportFormat[] = ["docx", "md", "epub"];
/** The screenplay formats in the order the modal shows them. */
export const SCREENPLAY_FORMATS: readonly ExportFormat[] = ["pdf", "fountain"];

export function isScreenplayFormat(f: ExportFormat): boolean {
  return f === "pdf" || f === "fountain";
}

/** The formats for a source: a single screenplay note gets the script formats; anything else the prose ones. */
export function formatsFor(source: { single: boolean; form: FormKind | null }): readonly ExportFormat[] {
  return source.single && source.form === "screenplay" ? SCREENPLAY_FORMATS : PROSE_FORMATS;
}
