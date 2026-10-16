// What a screenplay export adds to the pipeline (PLAN-1.1 Q3, Q7, Q9; no Obsidian imports):
// the title page from the note's properties, the script and its pages from the text the build
// already read, and the warning for characters Courier cannot print. The module's build calls
// `withScreenplay` on the prose build's result; the modal and the writers read what it adds.

import { titlePageOf, type Author, type Preset } from "../core/export-pipeline";
import { fountainOptions, parseFountain, type Script, type TitlePage } from "../core/fountain";
import { propertyValue } from "../core/book-source";
import type { ScreenplayPdf } from "../core/screenplay-pdf";
import { screenplayPreset, type ScreenplayPageId, type ScreenplayPreset } from "../core/screenplay-presets";
import { withWarning, type Built, type Warning } from "./source";
import { pdfOfScript } from "./writers/pdf";
import { scriptNotes, type ScriptNote } from "./writers/fountain";

/** The settings a screenplay export reads. */
export interface ScreenplaySettings {
  screenplaySceneHeadings: string;
  screenplayTransitions: string;
  screenplayMore: string;
  screenplayContinued: string;
  screenplayCredit: string;
  screenplaySourceProperty: string;
  screenplayDraftDateProperty: string;
  placeholderMarker: string;
  threadKeyword: string;
}

/** What a screenplay adds to a build. */
export interface ScreenplayBuilt {
  script: Script;
  titlePage: TitlePage;
  /** the writer's `%%` notes (Escrita's markers left out), for "Keep notes" */
  notes: ScriptNote[];
  /** the page the PDF uses, with the writer's labels */
  preset: ScreenplayPreset;
  /** the PDF as the current state writes it; null for Fountain, which has no pages */
  pdf: ScreenplayPdf | null;
}

// ------------------------------------------------------------------ title page

/** A property as title page text: text or a number, a list joined by commas, `[[links]]` as their names. */
export function propertyText(v: unknown): string {
  const one = (x: unknown): string => {
    if (typeof x === "number" && Number.isFinite(x)) return String(x);
    if (typeof x !== "string") return "";
    return x.replace(/!?\[\[([^\]]*)\]\]/g, (_m, inner: string) => {
      const bar = inner.indexOf("|");
      if (bar >= 0) return inner.slice(bar + 1);
      return inner.replace(/#.*$/, "");
    }).trim();
  };
  if (Array.isArray(v)) return v.map((x) => one(x)).filter((x) => x !== "").join(", ");
  return one(v);
}

export interface TitlePageInput {
  /** the note's title */
  title: string;
  /** who wrote it, by the prose rule (`authorOf`) */
  author: Author;
  frontmatter: Record<string, unknown> | null | undefined;
  /** a `Title:` block read from the script's body; fills only what is still empty */
  block: Partial<TitlePage> | null;
  settings: Pick<ScreenplaySettings, "screenplayCredit" | "screenplaySourceProperty" | "screenplayDraftDateProperty">;
  /** the prose preset the shared `titlePageOf` wants; the contact lines do not depend on it */
  preset: Pick<Preset, "countLabel" | "byline" | "language">;
}

/**
 * The screenplay title page (PLAN-1.1 Q9, the Wave 1 judge's decision). Title is the note's;
 * author and contact lines follow the prose rule (`titlePageOf(doc).contact`: the name, then
 * the contact lines); the credit is the setting; source and draft date come from the
 * properties named in the settings. A `Title:` block in the body fills only what is empty.
 * The credit line is dropped when there is no author to credit.
 */
export function screenplayTitlePage(o: TitlePageInput): TitlePage {
  const block = o.block ?? {};
  const doc = { title: o.title, author: o.author, count: { amount: 0, unit: "words" as const }, parts: [] };
  const lines = titlePageOf(doc, o.preset).contact;
  const name = o.author.name.trim();
  const contact = lines.slice(name === "" ? 0 : 1);
  const author = name || block.author || "";
  const out: TitlePage = { title: o.title.trim() || block.title || "" };
  const credit = o.settings.screenplayCredit.trim() || block.credit || "";
  if (author !== "" && credit !== "") out.credit = credit;
  if (author !== "") out.author = author;
  const prop = (name: string): string => (name.trim() === "" ? "" : propertyText(propertyValue(o.frontmatter, name.trim())));
  const source = prop(o.settings.screenplaySourceProperty) || block.source || "";
  if (source !== "") out.source = source;
  const date = prop(o.settings.screenplayDraftDateProperty) || block.draftDate || "";
  if (date !== "") out.draftDate = date;
  const lines2 = contact.length > 0 ? contact : block.contact ?? [];
  if (lines2.length > 0) out.contact = lines2;
  return out;
}

// ------------------------------------------------------------------ building

export interface ScreenplayState {
  format: string;
  /** the page: "letter" or "a4" */
  preset: string;
  sceneNumbers?: boolean;
}

export const pageOf = (preset: string): ScreenplayPageId => (preset === "a4" ? "a4" : "letter");

/** The warning for characters the PDF prints as "?" (PLAN-1.1 Q7), one link per line; null when there are none. */
export function unsupportedWarning(pdf: ScreenplayPdf, path: string, where: string): Warning | null {
  if (pdf.unsupported.length === 0) return null;
  const names: string[] = [];
  const lines: number[] = [];
  for (const u of pdf.unsupported) {
    if (!names.includes(u.char)) names.push(u.char);
    // a title page character has no line of the note to go to: it is named, with no link
    if (u.line >= 0 && !lines.includes(u.line)) lines.push(u.line);
  }
  lines.sort((a, b) => a - b);
  return { id: "unsupported", level: "warning", n: pdf.unsupported.length, names, links: lines.map((line) => ({ path, line, where })) };
}

/**
 * The prose build of a single note, made a screenplay's: the script parsed from the text it
 * read, the title page, the notes and (for a PDF) the pages. Embeds are not dropped from a
 * script, so their note is gone; a PDF with characters Courier cannot print gets the warning.
 */
export function withScreenplay(
  built: Built,
  o: {
    state: ScreenplayState;
    settings: ScreenplaySettings;
    title: string;
    frontmatter: Record<string, unknown> | null | undefined;
    preset: Pick<Preset, "countLabel" | "byline" | "language">;
  },
): Built {
  const md = built.source.parts[0].md;
  const script = parseFountain(md.text, md, fountainOptions(o.settings));
  const titlePage = screenplayTitlePage({
    title: o.title, author: built.source.author, frontmatter: o.frontmatter, block: script.titleBlock, settings: o.settings, preset: o.preset,
  });
  const page = screenplayPreset(pageOf(o.state.preset), {
    screenplayMore: o.settings.screenplayMore, screenplayContinued: o.settings.screenplayContinued, screenplaySceneNumbers: o.state.sceneNumbers === true,
  });
  const pdf = o.state.format === "pdf" ? pdfOfScript({ script, titlePage }, page) : null;
  const notes = scriptNotes(md, ["beat", o.settings.placeholderMarker, o.settings.threadKeyword]);
  const kept = built.warnings.filter((w) => w.id !== "embeds");
  const extra = pdf ? unsupportedWarning(pdf, built.paths[0], built.labels[0]) : null;
  const warnings = extra ? withWarning(kept, extra) : kept;
  return { ...built, warnings, screenplay: { script, titlePage, notes, preset: page, pdf } };
}
