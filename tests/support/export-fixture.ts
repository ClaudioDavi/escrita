// Builds an ExportSource from tests/fixtures/manuscript/ files, the way the export
// module will from the vault (task 3.1), with no Obsidian.
import { readFileSync } from "node:fs";
import { chapterHeadings, type ExportPart, type ExportSource } from "../../src/core/export-pipeline";
import { segment } from "../../src/core/markdown";
import type { Preset } from "../../src/core/export-pipeline";

const FX = new URL("../fixtures/manuscript/", import.meta.url);
export const read = (p: string): string => readFileSync(new URL(p, FX), "utf8");
export const md = (p: string) => segment(read(p));

const AUTHOR = { name: "Ana Souza", surname: "Souza", contact: [] as string[] };

export function contoSource(count = 612): ExportSource {
  return {
    title: "A visita",
    author: AUTHOR,
    count: { amount: count, unit: "words" },
    parts: [{ role: "body", heading: null, md: md("conto.md") }],
  };
}

export function bookSource(preset: Preset, count = 1234): ExportSource {
  const dir = "book/A Casa/";
  // `02 Rascunho` has compile: false, so it is not passed; numbers count what is left
  const chapters = [
    { file: "Prólogo.md", number: null, title: "Prólogo" },
    { file: "01 A chegada.md", number: 1, title: "A chegada" },
    { file: "03 A casa.md", number: 3, title: "A casa" },
  ];
  const heads = chapterHeadings(chapters, preset.chapterHeading);
  const parts: ExportPart[] = [
    { role: "dedication", heading: null, md: md(dir + "Dedicatória.md") },
    { role: "epigraph", heading: null, md: md(dir + "Epígrafe.md") },
    ...chapters.map((c, i): ExportPart => ({ role: "body", heading: heads[i], md: md(dir + "Chapters/" + c.file) })),
  ];
  return { title: "A Casa", author: AUTHOR, count: { amount: count, unit: "words" }, parts };
}
