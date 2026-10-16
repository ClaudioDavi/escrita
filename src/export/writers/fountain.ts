// The Fountain writer (SP 1, PLAN-1.1 Q5, Q9; no Obsidian imports): a Script back to Fountain
// text. It inverts the parser's rules (core/fountain.ts): the plain form of every element is
// written when the parser would read it back as that element, and a forced mark (`.` scene,
// `@` cue, `!` action, `>` transition) only where the plain form would be read as something
// else. The check is the parser itself, so the two cannot drift apart: parse what this writes
// and you get the same elements (tests/export-fountain.test.ts).
//
// Escrita's own markers (beats, placeholders, threads) never go in the file. Other `%%` notes
// become `[[notes]]` only when the caller passes them (the modal's "Keep notes").

import type { ManuscriptWriter } from "../../core/export-pipeline";
import {
  parseFountain, parseRuns,
  type FountainOptions, type Script, type ScriptElement, type ScriptRun, type TitlePage,
} from "../../core/fountain";
import { segment, type Markdown } from "../../core/markdown";

/** A `%%` note of the writer's, kept as a Fountain note: the text and the 0-based line it stood on. */
export interface ScriptNote {
  line: number;
  text: string;
}

/** What the writer takes: the script, the merged title page and the notes to keep (empty = none). */
export interface FountainDoc {
  script: Script;
  titlePage: TitlePage;
  notes: ScriptNote[];
}

// ------------------------------------------------------------------ notes

/**
 * The `%%` notes worth keeping: every closed `%%` comment in the body that is not one of
 * Escrita's markers. `words` are the marker words from settings (the beat word "beat", the
 * placeholder marker, the thread keyword); a comment starting with one is a marker. HTML
 * comments and the frontmatter are not notes. A note over several lines is joined into one.
 */
export function scriptNotes(md: Markdown, words: readonly string[]): ScriptNote[] {
  const marker = words.map((w) => w.trim()).filter((w) => w !== "");
  const isMarker = (inner: string): boolean => marker.some((w) => {
    const head = inner.slice(0, w.length);
    if (head.toLowerCase() !== w.toLowerCase()) return false;
    return !/^[\p{L}\p{N}_-]$/u.test(inner.charAt(w.length));
  });
  const out: ScriptNote[] = [];
  for (const span of md.spans()) {
    if (span.kind !== "comment" || span.form !== "%%" || !span.closed) continue;
    const line = md.lineOf(span.from);
    if (line < md.bodyLine) continue;
    const inner = md.text.slice(span.from + 2, span.to - 2).trim();
    if (inner === "" || isMarker(inner)) continue;
    out.push({ line, text: inner.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "").join(" ") });
  }
  return out;
}

// ------------------------------------------------------------------ inline text

const sameRuns = (a: ScriptRun[], b: ScriptRun[]): boolean =>
  a.length === b.length && a.every((r, i) => r.text === b[i].text && !!r.bold === !!b[i].bold && !!r.italic === !!b[i].italic && !!r.underline === !!b[i].underline);

/** Backslash before every mark the parser reads as emphasis, and before a backslash that would escape one. */
function escapeMarks(text: string): string {
  return text.replace(/\\(?=[*_\\])|[*_]/g, (m) => `\\${m}`);
}

/** One run with its marks: `***` bold italic, `**` bold, `*` italic, `_` underline around the rest. */
function wrapRun(r: ScriptRun, esc: boolean): string {
  const text = esc ? escapeMarks(r.text) : r.text;
  const star = r.bold && r.italic ? "***" : r.bold ? "**" : r.italic ? "*" : "";
  const u = r.underline ? "_" : "";
  return `${u}${star}${text}${star}${u}`;
}

/**
 * Runs as Fountain inline text. Tries the plain spelling (marks written as they are), then
 * with the literal `*` and `_` escaped; the first that the parser reads back as the same
 * runs wins. Where neither does (two different styles touching with no space between), the
 * text is written unstyled and escaped, so the words are never lost, only their style.
 */
export function runsToText(runs: ScriptRun[]): string {
  const plain = runs.map((r) => wrapRun(r, false)).join("");
  if (sameRuns(parseRuns(plain), runs)) return plain;
  const escaped = runs.map((r) => wrapRun(r, true)).join("");
  if (sameRuns(parseRuns(escaped), runs)) return escaped;
  return escapeMarks(runs.map((r) => r.text).join(""));
}

/** A title block value: written as typed unless the parser would read marks in it. */
function valueText(v: string): string {
  const plain = (s: string) => parseRuns(s).map((r) => r.text).join("");
  return plain(v) === v ? v : escapeMarks(v);
}

// ------------------------------------------------------------------ elements

const speechTypes: ReadonlySet<ScriptElement["type"]> = new Set(["parenthetical", "dialogue", "lyric"]);

/** What the parser makes of a text read alone at the start of a block (null when it makes nothing). */
function firstOf(text: string, opts: FountainOptions): ScriptElement | null {
  return parseFountain(text, segment(text), opts).elements[0] ?? null;
}

const textOf = (el: ScriptElement): string => runsToText(el.runs);

/** The block of lines one element (or one whole speech) is written as. */
function blockOf(els: ScriptElement[], opts: FountainOptions): string[] {
  const el = els[0];
  switch (el.type) {
    case "scene": {
      const number = el.number !== undefined ? ` #${el.number}#` : "";
      const text = textOf(el) + number;
      if (el.forced) return [`.${text}`];
      const read = firstOf(text, opts);
      return [read && read.type === "scene" && read.runs.length > 0 ? text : `.${text}`];
    }
    case "action": {
      const text = textOf(el);
      if (el.centered) return text.split("\n").map((l) => `> ${l} <`);
      if (el.forced) return [`!${text}`];
      const read = firstOf(text, opts);
      const same = read !== null && read.type === "action" && !(read as { forced?: boolean }).forced && !(read as { centered?: boolean }).centered;
      return text.split("\n").map((l, i) => (i === 0 && !same ? `!${l}` : l));
    }
    case "transition": {
      const text = textOf(el);
      if (el.forced) return [`>${text.startsWith(" ") ? "" : " "}${text}`];
      const read = firstOf(text, opts);
      return [read && read.type === "transition" ? text : `> ${text}`];
    }
    case "pageBreak": return ["==="];
    case "section": return [`${"#".repeat(Math.max(1, el.depth))} ${textOf(el)}`];
    case "synopsis": return [`= ${textOf(el)}`];
    case "character": return speechOf(els, opts);
    default: return [textOf(el)];   // a speech line with no cue before it cannot be read back; written as it is
  }
}

/** A cue, then its parentheticals, dialogue and lyrics, with no blank line between them. */
function speechOf(els: ScriptElement[], opts: FountainOptions): string[] {
  const cue = els[0] as ScriptElement & { type: "character" };
  const dual = cue.dual ? " ^" : "";
  const body = textOf(cue) + dual;
  let head = body;
  if (cue.forced) head = `@${body}`;
  else {
    // read back with a line after it: a cue needs one
    const read = firstOf(`${body}\nx`, opts);
    if (!read || read.type !== "character" || read.name !== cue.name) head = `@${body}`;
  }
  const lines = [head];
  let prev: ScriptElement = cue;
  for (const el of els.slice(1)) {
    // two dialogue (or lyric) elements in a row were split by a line of spaces: keep it
    if ((el.type === "dialogue" || el.type === "lyric") && prev.type === el.type) lines.push("  ");
    if (el.type === "lyric") lines.push(...textOf(el).split("\n").map((l) => `~${l}`));
    else lines.push(textOf(el));
    prev = el;
  }
  return lines;
}

/** The elements grouped into the blocks they are written as: a cue takes the speech lines after it. */
function blocksOf(elements: ScriptElement[]): ScriptElement[][] {
  const blocks: ScriptElement[][] = [];
  for (const el of elements) {
    const last = blocks[blocks.length - 1];
    if (last && speechTypes.has(el.type) && last[0].type === "character") last.push(el);
    else blocks.push([el]);
  }
  return blocks;
}

// ------------------------------------------------------------------ title page

/** The `Title:` block (Fountain's key: value lines, a value on several lines indented). */
function titleBlock(tp: TitlePage): string[] {
  const out: string[] = [];
  const add = (key: string, value: string | string[] | undefined): void => {
    const lines = (Array.isArray(value) ? value : (value ?? "").split("\n")).map((l) => l.trim()).filter((l) => l !== "");
    if (lines.length === 0) return;
    if (lines.length === 1) out.push(`${key}: ${valueText(lines[0])}`);
    else {
      out.push(`${key}:`);
      for (const l of lines) out.push(`    ${valueText(l)}`);
    }
  };
  add("Title", tp.title);
  add("Credit", tp.credit);
  add("Author", tp.author);
  add("Source", tp.source);
  add("Draft date", tp.draftDate);
  add("Contact", tp.contact);
  return out;
}

// ------------------------------------------------------------------ the file

/** The Fountain text of a script: the title block, then each element as a paragraph. Ends with a newline. */
export function fountainText(doc: FountainDoc, opts: FountainOptions): string {
  const paragraphs: string[] = [];
  const title = titleBlock(doc.titlePage);
  if (title.length > 0) paragraphs.push(title.join("\n"));
  const blocks = blocksOf(doc.script.elements);
  // a note goes before the first block that reaches its line, or at the end
  const notes = [...doc.notes].sort((a, b) => a.line - b.line);
  let n = 0;
  for (const block of blocks) {
    const reach = block[block.length - 1].line;
    while (n < notes.length && notes[n].line <= reach) paragraphs.push(`[[${notes[n++].text}]]`);
    paragraphs.push(blockOf(block, opts).join("\n"));
  }
  while (n < notes.length) paragraphs.push(`[[${notes[n++].text}]]`);
  return paragraphs.join("\n\n") + "\n";
}

/** Script to a `.fountain` file (UTF-8). The preset is the parser's words: scene prefixes and transitions. */
export const fountainWriter: ManuscriptWriter<FountainDoc, FountainOptions> = {
  id: "fountain",
  ext: "fountain",
  write: (doc, opts) => fountainText(doc, opts),
};
