// Unlinked mentions (0.9, U 2.5; PLAN-0.9 Q1, Q17). Pure: no Obsidian or CodeMirror
// imports. From one note's mentions (the mentions index, no new read) and the entries
// the note already links, the places where an entry is named without a link. The Works
// tab lists them under the active work, each with a Link button (task 2.2).
//
// A note that links an entry anywhere lists no unlinked mention of it: the writer links
// the first one, and the rest are fine as plain text.
//
// An occurrence inside any link or embed in the text is never listed, even one the
// mentions leave in (the text of a Markdown link to a web page): Link would write a link
// inside a link and break it (rule 1).

import type { Markdown } from "../core/markdown";
import { pickEntry } from "../core/names";
import type { NoteMentions } from "./mentions";

/** Wikilinks, embeds and Markdown links or images, as written. */
const LINKS = /!?\[\[[^\]\n]*\]\]|!?\[[^\]\n]*\]\([^)\n]*\)/g;

function linkSpans(text: string): { from: number; to: number }[] {
  return [...text.matchAll(LINKS)].map((m) => ({ from: m.index!, to: m.index! + m[0].length }));
}

/** Whether `[from, to)` touches a link or embed written in `text`. */
export function insideLink(text: string, from: number, to: number): boolean {
  return linkSpans(text).some((l) => from < l.to && to > l.from);
}

/** One place where an entry is named and not linked. */
export interface UnlinkedMention {
  /** the entry's path */
  entry: string;
  /** document offsets of the occurrence in the note's text (frontmatter included) */
  from: number;
  to: number;
  /** 0-based line of `from` in the note's text (frontmatter included), to show and to jump to */
  line: number;
  /** the occurrence as written ("Teo", "o Capitão"): what Link checks is still there before it writes */
  text: string;
}

/**
 * The unlinked mentions of one note, in document order.
 *
 * - `mentions`: the note's `NoteMentions` from the mentions index. Its occurrences
 *   already leave out the text inside links (computeMentions).
 * - `linkedEntries`: the entry paths the note links anywhere, resolved by the caller
 *   from `mentions.links` (MentionCtx.resolve). An entry in this set lists nothing.
 * - `note.md`: the segmented text the mentions were computed from (its `lineOf` gives `line`).
 * - `note.inScope`: which candidates count, as in Appears in (pickEntry, Q26). An
 *   occurrence whose entry is still ambiguous after it is left out. Default: every candidate.
 */
export function unlinkedIn(
  mentions: NoteMentions,
  linkedEntries: ReadonlySet<string>,
  note: { md: Markdown; inScope?: (id: string) => boolean },
): UnlinkedMention[] {
  const inScope = note.inScope ?? (() => true);
  const { md } = note;
  const out: UnlinkedMention[] = [];
  const occ = [...mentions.occurrences].sort((x, y) => x.from - y.from);
  const spans = occ.length ? linkSpans(md.text) : [];
  for (const o of occ) {
    const entry = pickEntry(o, inScope);
    if (entry === null || linkedEntries.has(entry)) continue;
    if (spans.some((l) => o.from < l.to && o.to > l.from)) continue;
    out.push({ entry, from: o.from, to: o.to, line: md.lineOf(o.from), text: md.text.slice(o.from, o.to) });
  }
  return out;
}
