// Adding one entry to the word lists note (0.5.1). Pure: no obsidian imports.
// Only the text of the section that holds the list changes; the prose is never touched.

import { sectionOf, parseLists } from "./lists";
import type { LensLang, Lists } from "./types";

export type ListName = keyof Lists;

export type AddResult = { text: string } | { already: true } | { unreadable: true };

const HEADING_WORDS: Record<LensLang, Record<ListName, string>> = {
  "pt-BR": { crutch: "Vícios", names: "Nomes", ignore: "Ignorar" },
  en: { crutch: "Crutch words", names: "Names", ignore: "Ignore" },
};

/** The entry as parseLists would read it back: one line, spaces collapsed. */
export function cleanEntry(entry: string): string {
  return entry.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Whether an entry survives the round trip through the note (no comment marks, no list marker lead). */
export function listable(entry: string): boolean {
  const e = cleanEntry(entry);
  if (e === "" || e.includes("%%")) return false;
  if (/^(?:[-*+]|\d+[.)])(?:\s|$)/.test(e) || /^\[[ xX]\](?:\s|$)/.test(e)) return false;
  return /\p{L}/u.test(e);
}

interface Line { start: number; end: number; next: number }

function splitLines(text: string): Line[] {
  const out: Line[] = [];
  const re = /\r\n|\n|\r/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ start, end: m.index, next: m.index + m[0].length });
    start = m.index + m[0].length;
  }
  if (start < text.length) out.push({ start, end: text.length, next: text.length });
  return out;
}

function eolOf(text: string): string {
  const m = /\r\n|\n|\r/.exec(text);
  return m ? m[0] : "\n";
}

/**
 * `noteText` with "- entry" added to the list's section, or `{ already: true }` when the entry
 * is there (same text after NFC and case folding). A missing section is appended, with its heading
 * in the lens language. Line endings are kept.
 */
export function addToList(noteText: string, list: ListName, entry: string, lang: LensLang): AddResult {
  const r = addToListRaw(noteText, list, entry, lang);
  if (!("text" in r)) return r;
  // never report success for an entry the lens would not read back (open comment, open frontmatter)
  const key = cleanEntry(entry).toLowerCase();
  if (!parseLists(r.text)[list].some((x) => x.normalize("NFC").toLowerCase() === key)) return { unreadable: true };
  return r;
}

function addToListRaw(noteText: string, list: ListName, entry: string, lang: LensLang): AddResult {
  const e = cleanEntry(entry);
  if (e === "") return { already: true };
  const key = e.toLowerCase();
  if (parseLists(noteText)[list].some((x) => x.normalize("NFC").toLowerCase() === key)) return { already: true };

  const eol = eolOf(noteText);
  const lines = splitLines(noteText);
  const line = (i: number) => noteText.slice(lines[i].start, lines[i].end);

  // skip a frontmatter block
  let i = 0;
  if (lines.length > 0 && /^---[ \t]*$/.test(line(0))) {
    let close = -1;
    for (let j = 1; j < lines.length; j++) {
      if (/^(?:---|\.\.\.)[ \t]*$/.test(line(j))) { close = j; break; }
    }
    if (close !== -1) i = close + 1;
  }

  // find the first section of this list: [head, stop) where stop is the next heading
  let head = -1;
  let stop = lines.length;
  let inComment = false;
  for (; i < lines.length; i++) {
    const text = line(i);
    const startsInComment = inComment;
    if ((text.match(/%%/g)?.length ?? 0) % 2 === 1) inComment = !inComment;
    if (startsInComment) continue;
    if (sectionOf(text) === undefined) continue;
    if (head !== -1) { stop = i; break; }
    if (sectionOf(text) === list) head = i;
  }

  const entryLine = `- ${e}`;
  if (head === -1) {
    const endsNewline = noteText === "" || /[\r\n]$/.test(noteText);
    let base = noteText;
    if (base !== "" && !endsNewline) base += eol;
    const lastBlank = lines.length === 0 || line(lines.length - 1).trim() === "";
    if (base !== "" && !lastBlank) base += eol;
    const tail = `## ${HEADING_WORDS[lang][list]}${eol}${entryLine}`;
    return { text: base + tail + (endsNewline ? eol : "") };
  }

  // after the last non-blank line of the section (a hint comment counts)
  let last = head;
  for (let j = head + 1; j < stop; j++) if (line(j).trim() !== "") last = j;
  const l = lines[last];
  if (l.next === l.end) {
    // no line ending after it: end of the file
    return { text: noteText.slice(0, l.end) + eol + entryLine + noteText.slice(l.end) };
  }
  return { text: noteText.slice(0, l.next) + entryLine + eol + noteText.slice(l.next) };
}

// ---------------------------------------------------------------- what the menu offers

export interface MenuEntry {
  entry: string;
  /** a capitalized word or name: also offer "Add to names" */
  name: boolean;
  /** a single word: also offer "Always ignore" */
  word: boolean;
}

const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e", "of", "the", "van", "von", "di", "del", "la", "le"]);

function isUpperFirst(w: string): boolean {
  const c = Array.from(w)[0] ?? "";
  return c !== "" && c !== c.toLowerCase() && c === c.toUpperCase();
}

/**
 * What the menu works with: the selected text (one line, 1 to 6 words) or else the word under
 * the cursor. null when there is nothing to offer.
 */
export function menuEntry(selected: string, wordAtCursor: string): MenuEntry | null {
  const raw = selected.trim() !== "" ? selected : wordAtCursor;
  if (/[\r\n]/.test(raw.trim())) return null;
  const entry = cleanEntry(raw);
  if (!listable(entry)) return null;
  const words = entry.split(" ");
  if (words.length > 6) return null;
  const name = isUpperFirst(words[0])
    && words.slice(1).every((w) => isUpperFirst(w) || CONNECTORS.has(w.toLowerCase()))
    && /\p{L}/u.test(words[words.length - 1]) && !CONNECTORS.has(words[words.length - 1].toLowerCase());
  return { entry, name, word: words.length === 1 };
}
