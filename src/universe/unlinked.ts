// Unlinked mentions (0.9, U 2.5; PLAN-0.9 Q1, Q17). Pure: no Obsidian or CodeMirror
// imports. From one note's mentions (the mentions index, no new read) and the entries
// the note already links, the places where an entry is named without a link. The Works
// tab lists them under the active work, each with a Link button (task 2.2).
//
// A note that links an entry anywhere lists no unlinked mention of it: the writer links
// the first one, and the rest are fine as plain text.

import type { NoteMentions } from "./mentions";

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
 * - `note.text`: the text the mentions were computed from, for `line`.
 * - `note.inScope`: which candidates count, as in Appears in (pickEntry, Q26). An
 *   occurrence whose entry is still ambiguous after it is left out. Default: every candidate.
 */
export function unlinkedIn(
  mentions: NoteMentions,
  linkedEntries: ReadonlySet<string>,
  note: { text: string; inScope?: (id: string) => boolean },
): UnlinkedMention[] {
  void mentions; void linkedEntries; void note;
  throw new Error("not implemented: 0.9 task 1.2");
}
