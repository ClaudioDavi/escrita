// A screenplay note read as Fountain (SP 1, PLAN-1.1; no Obsidian imports). The note is
// Markdown on disk; inside a screenplay note the screenplay wins where Fountain and Markdown
// disagree (`#` is a section, `>` a transition or centered text, `_x_` underline, a 4-space
// indent is action: PLAN-1.1 Q6). Escrita's `%% … %%` notes are skipped through `segment()`;
// `[[…]]` stays an Obsidian link, written as its text; boneyard `/* … */` is read here
// (Q5). The model is what the Fountain and PDF writers take (src/export/writers/), and
// core/screenplay-pages.ts paginates it.

import type { Markdown } from "./markdown";

/** Inline style runs inside an element's text, as Fountain marks them (`*`, `**`, `_`). */
export interface ScriptRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface ElementBase {
  /** the 0-based line in the note where the element starts (click-to-line, warnings) */
  line: number;
  /** the element's text as runs; a multi-line element joins its lines with "\n" inside runs */
  runs: ScriptRun[];
}

export type ScriptElement =
  | (ElementBase & { type: "scene"; /** `#12#` at the end of the heading, without the hashes */ number?: string; /** forced with a leading "." */ forced?: boolean })
  | (ElementBase & { type: "action"; /** forced with "!" */ forced?: boolean; /** centered with `> … <` */ centered?: boolean })
  | (ElementBase & {
    type: "character";
    /** the name as written, without the extension and the `^` */
    name: string;
    /** "V.O.", "O.S.", "CONT'D"… without the parentheses; absent when none */
    extension?: string;
    /** `^` after the cue: this speech sits beside the one before (dual dialogue) */
    dual?: boolean;
    /** forced with "@" */
    forced?: boolean;
  })
  | (ElementBase & { type: "parenthetical" })
  | (ElementBase & { type: "dialogue" })
  | (ElementBase & { type: "lyric" })
  | (ElementBase & { type: "transition"; /** forced with ">" */ forced?: boolean })
  | (ElementBase & { type: "pageBreak" })
  | (ElementBase & { type: "section"; /** the number of `#` */ depth: number })
  | (ElementBase & { type: "synopsis" });

export type ScriptElementType = ScriptElement["type"];

/**
 * The title page. From the note's properties first (title = the note's title; author, credit,
 * source, draft date and contact through the settings, PLAN-1.1 Q9); a Fountain `Title:` block
 * at the top of the body fills what the properties leave empty.
 */
export interface TitlePage {
  title: string;
  credit?: string;
  author?: string;
  source?: string;
  draftDate?: string;
  /** one entry per line */
  contact?: string[];
}

export interface Script {
  /** the `Title:` block read from the body, if there was one; merged with properties by the export */
  titleBlock: Partial<TitlePage> | null;
  elements: ScriptElement[];
}

/** What the parser reads from settings (rule 6): the screenplay words of the install's set. */
export interface FountainOptions {
  /** scene heading prefixes without the trailing "." or space ("INT", "EXT", "INT./EXT", "I/E") */
  sceneHeadings: readonly string[];
  /** a line in capitals ending in one of these is a transition ("TO:", "PARA:") */
  transitions: readonly string[];
}

/** The settings words as parser options (comma or newline separated lists, blanks dropped). */
export function fountainOptions(s: { screenplaySceneHeadings: string; screenplayTransitions: string }): FountainOptions {
  const list = (v: string) => v.split(/[,\n]/).map((x) => x.trim()).filter((x) => x !== "");
  return { sceneHeadings: list(s.screenplaySceneHeadings), transitions: list(s.screenplayTransitions) };
}

/**
 * The note's body as a script. `md` is `segment(text)` of the same text: frontmatter, code and
 * `%%` comments are never script. Pure and total: any text gives a script (unknown lines are
 * action). Wave 1, task B.
 */
export function parseFountain(text: string, md: Markdown, opts: FountainOptions): Script {
  void text; void md; void opts;
  throw new Error("parseFountain: not built yet (PLAN-1.1, Wave 1 B)");
}
