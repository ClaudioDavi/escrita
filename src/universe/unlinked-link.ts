// The "Create link" write for one unlinked mention (0.9, U 2.5; PLAN-0.9 Q1). Pure: no
// Obsidian imports. One mention becomes `[[Entry|text]]`, or `[[text]]` when the text is
// the link target exactly. The plan checks the text is still there before it replaces
// anything (rule 1): if it moved or changed, it answers null and nothing is written.

import type { Change } from "../core/note-text";
import { insideLink, type UnlinkedMention } from "./unlinked";

/** What a row shows: the line around the mention, split so the name can be set apart. */
export interface Excerpt { before: string; match: string; after: string }

/** An unlinked mention with what the panel draws. */
export interface UnlinkedRow extends UnlinkedMention {
  /** the entry's name */
  name: string;
  excerpt: Excerpt;
  /** the whole line the mention sits on, as listed: Link writes only while it is unchanged */
  lineText: string;
}

const SIDE = 36;

/**
 * The text around a mention on its own line, trimmed to about `SIDE` characters each side
 * with an ellipsis where it was cut. Cuts at a word edge when there is one near.
 */
export function excerptOf(text: string, from: number, to: number, side = SIDE): Excerpt {
  const start = text.lastIndexOf("\n", from - 1) + 1;
  const nl = text.indexOf("\n", to);
  const end = nl === -1 ? text.length : nl;
  let a = Math.max(start, from - side);
  if (a > start) {
    const sp = text.indexOf(" ", a);
    if (sp !== -1 && sp < from) a = sp + 1;
  }
  let b = Math.min(end, to + side);
  if (b < end) {
    const sp = text.lastIndexOf(" ", b);
    if (sp > to) b = sp;
  }
  return {
    before: (a > start ? "…" : "") + text.slice(a, from).replace(/^\s+/, ""),
    match: text.slice(from, to),
    after: text.slice(to, b).replace(/\s+$/, "") + (b < end ? "…" : ""),
  };
}

/** The rows for a note, from its unlinked mentions and its text. `nameOf` is the entry's name. */
export function rowsOf(mentions: readonly UnlinkedMention[], text: string, nameOf: (entry: string) => string): UnlinkedRow[] {
  return mentions.map((m) => ({ ...m, name: nameOf(m.entry), excerpt: excerptOf(text, m.from, m.to), lineText: lineAt(text, m.from) }));
}

/** The line of `text` that holds offset `at`, without its line break. */
export function lineAt(text: string, at: number): string {
  const start = text.lastIndexOf("\n", at - 1) + 1;
  const nl = text.indexOf("\n", at);
  return text.slice(start, nl === -1 ? text.length : nl).replace(/\r$/, "");
}

/**
 * The markup that replaces the mention: `[[target]]` when the text is the target,
 * else `[[target|text]]`. Null when the text can't sit inside a wikilink (brackets,
 * a line break).
 */
export function linkMarkup(target: string, text: string): string | null {
  if (target === "" || text === "" || /[[\]\n\r]/.test(text) || /[[\]|\n\r]/.test(target)) return null;
  return text === target ? `[[${target}]]` : `[[${target}|${text}]]`;
}

/**
 * The write plan for one mention: the change that turns `[from, to)` into the link, only
 * while exactly `text` is still there, its whole line is the one listed (`lineText`, when
 * given: board 29c, "the line changed") and it is not part of a link now. Null otherwise
 * (nothing is written; the caller says so and refreshes the row).
 */
export function linkPlan(m: Pick<UnlinkedMention, "from" | "to" | "text"> & { lineText?: string }, markup: string): (current: string) => Change | null {
  return (current) => {
    if (m.from < 0 || m.to > current.length || current.slice(m.from, m.to) !== m.text) return null;
    if (m.lineText !== undefined && lineAt(current, m.from) !== m.lineText) return null;
    if (insideLink(current, m.from, m.to)) return null;
    return { from: m.from, to: m.to, insert: markup };
  };
}
