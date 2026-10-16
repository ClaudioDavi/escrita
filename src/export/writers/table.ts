// The writers by format (PLAN-1.1 Q3; no Obsidian imports): what `write()` in index.ts used to
// pick with a ternary. A prose format takes the manuscript model and a prose preset; a script
// format takes a Script and a screenplay preset. Each entry says which it is, so the module
// hands each writer only the inputs it understands and the formats offered for a source
// (core/export-formats.ts `formatsFor`) are exactly the entries of one kind.

import type { ExportFormat } from "../../core/export-formats";
import type { EpubCover, ExportDoc, Preset } from "../../core/export-pipeline";
import type { FountainOptions } from "../../core/fountain";
import type { ScreenplayPreset } from "../../core/screenplay-presets";
import { docxWriter } from "./docx";
import { epubLayout, epubWriter } from "./epub";
import { fountainWriter, type ScriptNote } from "./fountain";
import { markdownWriter } from "./markdown";
import { pdfWriter, type ScriptDoc } from "./pdf";

/** What a prose writer is given. */
export interface ProseInput {
  doc: ExportDoc;
  preset: Preset;
  /** EPUB only */
  epub: { identifier: string; modified: string; cover: EpubCover | null; sceneBreak: string };
}

/** What a script writer is given. */
export interface ScriptInput {
  script: ScriptDoc;
  /** the PDF's page and labels */
  page: ScreenplayPreset;
  /** the parser's words, for the Fountain writer */
  words: FountainOptions;
  /** the notes to write into a Fountain file; empty when "Keep notes" is off */
  notes: ScriptNote[];
}

export type FormatWriter =
  | { kind: "prose"; write(input: ProseInput): string | Uint8Array }
  | { kind: "script"; write(input: ScriptInput): string | Uint8Array };

export const WRITERS = {
  docx: { kind: "prose" as const, write: (i: ProseInput) => docxWriter.write(i.doc, i.preset) },
  md: { kind: "prose" as const, write: (i: ProseInput) => markdownWriter.write(i.doc, i.preset) },
  epub: {
    kind: "prose" as const,
    write: (i: ProseInput) => epubWriter.write(
      { doc: i.doc, identifier: i.epub.identifier, modified: i.epub.modified, cover: i.epub.cover },
      epubLayout(i.preset, i.epub.sceneBreak),
    ),
  },
  pdf: { kind: "script" as const, write: (i: ScriptInput) => pdfWriter.write(i.script, i.page) },
  fountain: { kind: "script" as const, write: (i: ScriptInput) => fountainWriter.write({ ...i.script, notes: i.notes }, i.words) },
} satisfies Record<ExportFormat, FormatWriter>;
