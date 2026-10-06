// Pure helpers for the book/chapter file convention (no Obsidian imports):
//
//   Novels/A Casa.md                 ← the book note (frontmatter: goal, deadline, …)
//   Novels/A Casa/<chaptersFolder>/  ← one note per chapter
//       01 Chegada.md
//       02 A porta fechada.md
//
// The numeric prefix orders chapters and is managed by the plugin.

import { foldName } from "./names";

const PREFIX = /^(\d+)(?:[ \t._-]+|$)/;

export function chapterNumber(basename: string): number | null {
  const m = PREFIX.exec(basename);
  return m ? Number(m[1]) : null;
}

export function chapterTitle(basename: string): string {
  return basename.replace(PREFIX, "").trim() || basename;
}

/** The setting's list: comma- or newline-separated, trimmed, empties dropped. */
export function parseTitleList(list: string): string[] {
  return list.split(/[,\n\r]+/).map((s) => s.trim()).filter((s) => s !== "");
}

/**
 * Does this chapter title never get a number (the "Chapters without a number"
 * setting)? Folded with `foldName` (case and accents ignored): it equals a list entry,
 * or starts with one followed by a space or punctuation ("Interlúdio — a carta" matches
 * "Interlúdio"; "Interlúdios" does not). An empty list matches nothing.
 */
export function isUnnumberedTitle(title: string, list: string | readonly string[]): boolean {
  const entries = (typeof list === "string" ? parseTitleList(list) : list).map(foldName).filter((e) => e !== "");
  if (entries.length === 0) return false;
  const t = foldName(title);
  return entries.some((e) => t === e || (t.startsWith(e) && /^[\s\p{P}]/u.test(t.slice(e.length))));
}

/**
 * The number each chapter is counted as, in order: null for an unnumbered file, a 00
 * file and a title in the unnumbered list (they are not counted), else 1, 2, 3...
 * Export headings and the outline label read this one rule.
 */
export function countedNumbers(
  chapters: readonly { number: number | null; title: string }[], unnumbered: string | readonly string[] = [],
): (number | null)[] {
  let n = 0;
  return chapters.map((c) => {
    if (c.number === null || c.number === 0 || isUnnumberedTitle(c.title, unnumbered)) return null;
    return ++n;
  });
}

export function compareChapters(a: string, b: string): number {
  const na = chapterNumber(a), nb = chapterNumber(b);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  if (na !== null && nb === null) return -1;
  if (na === null && nb !== null) return 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

export function numberedName(index1: number, title: string, pad: number): string {
  return `${String(index1).padStart(pad, "0")} ${title}`;
}

export interface RenamePlan { from: string; to: string }

/**
 * Given chapter basenames in their desired order, return the renames that
 * make every prefix equal its 1-based position. Unchanged names are omitted.
 * Width grows past `pad` when there are more chapters than digits allow.
 */
export function planRenumber(ordered: string[], pad: number): RenamePlan[] {
  const width = Math.max(pad, String(ordered.length).length);
  const plan: RenamePlan[] = [];
  ordered.forEach((name, i) => {
    const to = numberedName(i + 1, chapterTitle(name), width);
    if (to !== name) plan.push({ from: name, to });
  });
  return plan;
}

/** Characters Obsidian refuses in file names. */
export function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
}
