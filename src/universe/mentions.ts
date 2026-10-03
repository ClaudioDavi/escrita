// "Appears in": where an entry is mentioned (0.7 plan Q30-Q34, U 1.2). Pure: no
// Obsidian or CodeMirror imports. Stubs until 3.2.

import type { Markdown } from "../core/markdown";
import type { Occurrence } from "../core/names";

export interface NoteMentions {
  occurrences: readonly Occurrence[];
  links: readonly { from: number; to: number; linkpath: string }[];   // prose wikilinks and Markdown links (Q30)
}

/** `find` is injected so the model is tested without the matcher. */
export function computeMentions(md: Markdown, find: (mask: string) => Occurrence[]): NoteMentions {
  throw new Error("todo");
}

export interface MentionCtx {
  entry: string;                                                  // the entry path
  inScope(notePath: string): boolean;                             // live scope (Q20, Q31)
  candidateInScope(notePath: string, id: string): boolean;
  resolve(linkpath: string, from: string): string | null;
  workOf(notePath: string): { work: string; chapter: number | null } | null;   // null: other notes
  /** Position of a work in the Works tab's order (groupWorks then compareWorks, works-list.ts:71-84); 5.1 builds it from plugin.works. */
  workRank(work: string): number;
}

export interface MentionRow { path: string; count: number; first: { from: number; to: number } }

export interface WorkMentions { work: string; count: number; notes: MentionRow[]; firstChapter?: string; lastChapter?: string }

export interface AppearsIn { works: WorkMentions[]; other: MentionRow[]; total: number; workCount: number }

export function appearsIn(all: Iterable<[string, NoteMentions]>, ctx: MentionCtx): AppearsIn {
  throw new Error("todo");
}

export function mentionsSame(a: NoteMentions, b: NoteMentions): boolean {
  throw new Error("todo");
}
