// "Appears in", the pure parts (0.7 plan 4.2, Q34): the one-line summary, the count beside
// an entry's name, the chapter labels, and the check that a stored mention is still where
// the index saw it. No Obsidian or CodeMirror imports.

import { segment } from "../core/markdown";
import { findNames, type TermTable } from "../core/names";
import { readerMask } from "../core/wordcount";
import { fmt, plural, t } from "../i18n";
import type { AppearsIn, MentionRow, WorkMentions } from "./mentions";

export function worksLabel(n: number): string {
  return plural("universe.view.count.works", n);
}

export function mentionsLabel(n: number): string {
  return plural("universe.appears.mentions", n);
}

/**
 * The collapsed line's text: "4 works · 41 mentions". With no mention at all, "no works yet"
 * (board 24e). With mentions only in notes outside any work, just the mentions.
 */
export function summaryLine(ai: AppearsIn): string {
  if (ai.total === 0) return t("universe.appears.none");
  if (ai.workCount === 0) return mentionsLabel(ai.total);
  return t("universe.view.sub.join", { a: worksLabel(ai.workCount), b: mentionsLabel(ai.total) });
}

/** The count beside the name in the Entries tab: "4 works". Nothing (null) when there are no mentions (board 23a). */
export function countLabel(ai: AppearsIn): string | null {
  if (ai.total === 0) return null;
  return ai.workCount > 0 ? worksLabel(ai.workCount) : mentionsLabel(ai.total);
}

/** The count's tooltip: "41 mentions in 4 works". */
export function countTip(ai: AppearsIn): string {
  if (ai.workCount === 0) return mentionsLabel(ai.total);
  return t("universe.appears.tip", { mentions: mentionsLabel(ai.total), works: worksLabel(ai.workCount) });
}

/** A chapter's position and title from its note's name: "03 O porão" gives 3 and "O porão". */
export function chapterParts(basename: string): { n: number | null; title: string } {
  const m = /^\s*(\d+)\s*[-–—.:)]*\s*(.*)$/.exec(basename);
  if (!m) return { n: null, title: basename.trim() };
  const title = m[2].trim();
  return { n: Number(m[1]), title: title === "" ? basename.trim() : title };
}

/** "1, Chegada" (or just the title when the name has no number). */
export function chapterRef(basename: string): string {
  const { n, title } = chapterParts(basename);
  return n === null ? title : `${fmt(n)}, ${title}`;
}

/** The note's name without folders or the extension. */
export function baseName(path: string): string {
  const file = path.slice(path.lastIndexOf("/") + 1);
  return file.replace(/\.md$/i, "");
}

/** "first in ch. 1, Chegada · last in ch. 4, Teo"; empty when the entry is in one chapter only. */
export function firstLastLine(first: string, last: string): string {
  if (first === last) return "";
  return t("universe.view.sub.join", {
    a: t("universe.appears.first", { ref: chapterRef(baseName(first)) }),
    b: t("universe.appears.last", { ref: chapterRef(baseName(last)) }),
  });
}

/**
 * Is the mention still where the index saw it? The index stores ranges, and the note may
 * have been edited since (or the index may be behind), so before a click selects anything it
 * checks the live text: a link is still a wikilink or a Markdown link over exactly that range; a name must be found at exactly that range
 * for this entry. Otherwise the caller opens the note at the top and selects nothing.
 */
export function mentionStillThere(
  text: string,
  range: { from: number; to: number },
  table: TermTable,
  entry: string,
): boolean {
  const { from, to } = range;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from || to > text.length) return false;
  const slice = text.slice(from, to);
  if (/^\[\[[^\]\n]*\]\]$/.test(slice) || /^\[[^\]\n]*\]\([^)\n]*\)$/.test(slice)) return true;
  const found = findNames(readerMask(segment(text)), table, from, to);
  return found.some((o) => o.from === from && o.to === to && o.candidates.some((c) => c.id === entry));
}

/** How many works the phone's compact section lists before the "more" row (board AppearsInStates k). */
export const PHONE_WORKS_SHOWN = 2;

/** The compact layout's works: the first few, or all once "more" was opened; `hidden` is what the row counts. */
export function compactWorks(ai: AppearsIn, expanded: boolean, limit = PHONE_WORKS_SHOWN): { shown: WorkMentions[]; hidden: number } {
  if (expanded || ai.works.length <= limit) return { shown: ai.works, hidden: 0 };
  return { shown: ai.works.slice(0, limit), hidden: ai.works.length - limit };
}

const sameRow = (a: MentionRow, b: MentionRow): boolean =>
  a.path === b.path && a.count === b.count && a.first.from === b.first.from && a.first.to === b.first.to;

/**
 * Whether two answers draw the same section: the same counts, rows and ranges (a click uses
 * the row's range, so a moved range must redraw). Compared by value, never by identity, so the
 * widget keeps its DOM while the cache hands out a fresh object (finding 17).
 */
export function sameAppearsIn(a: AppearsIn | "counting", b: AppearsIn | "counting"): boolean {
  if (a === "counting" || b === "counting") return a === b;
  if (a === b) return true;
  if (a.total !== b.total || a.workCount !== b.workCount || a.works.length !== b.works.length || a.other.length !== b.other.length) return false;
  for (let i = 0; i < a.works.length; i++) {
    const x = a.works[i];
    const y = b.works[i];
    if (x.work !== y.work || x.count !== y.count || x.firstChapter !== y.firstChapter || x.lastChapter !== y.lastChapter) return false;
    if (x.notes.length !== y.notes.length || !x.notes.every((n, k) => sameRow(n, y.notes[k]))) return false;
  }
  return a.other.every((n, k) => sameRow(n, b.other[k]));
}
