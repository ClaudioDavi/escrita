// Smart typography — pure replacement logic (no Obsidian imports).
//
//   word--      → word—          (not at the start of a line: that may become ---)
//   --␣ (start) → —␣             (dialogue dash, optional)
//   ...         → …
//   " '         → curly quotes / guillemets / German quotes, by context
//   letter'     → ’              (apostrophe)

import type { QuoteStyle } from "../settings";
import { inlineProtected } from "./context";

export interface TypographyOptions {
  quoteStyle: QuoteStyle;
  dialogueDash: boolean;
}

export interface Replacement {
  /** how many characters right before the cursor are replaced too */
  deleteBefore: number;
  /** what replaces them plus the typed character */
  insert: string;
  /** the characters as typed (deleted ones + the typed one), for Backspace to restore */
  original: string;
}

export const QUOTES: Record<Exclude<QuoteStyle, "off">, { open2: string; close2: string; open1: string; close1: string }> = {
  curly: { open2: "“", close2: "”", open1: "‘", close1: "’" },
  guillemets: { open2: "«", close2: "»", open1: "‹", close1: "›" },
  german: { open2: "„", close2: "“", open1: "‚", close1: "‘" },
};

export const APOSTROPHE = "’";

/** Characters after which a quote opens rather than closes (besides the style's own opening quotes). */
const OPENERS = /[\s([{<—–\-/]/;
const WORDISH = /[\p{L}\p{N}\p{M}]/u;

function rep(deleteBefore: number, insert: string, before: string, typed: string): Replacement {
  return { deleteBefore, insert, original: before.slice(before.length - deleteBefore) + typed };
}

/**
 * Decide what typing `typed` right after `before` (the current line up to the
 * cursor) should become. Null → insert it as typed. The caller skips block
 * contexts (frontmatter, code, math); inline contexts are checked here.
 */
export function typographyFor(before: string, typed: string, opts: TypographyOptions): Replacement | null {
  if (typed.length !== 1) return null;
  if (inlineProtected(before)) return null;
  // an escaped character stays literal
  if (/(^|[^\\])(\\\\)*\\$/.test(before)) return null;

  switch (typed) {
    case "-": {
      if (!before.endsWith("-") || before.endsWith("--")) return null;
      const head = before.slice(0, -1);
      if (head.trim() === "") return null; // start of line: could be --- or a list
      if (/^[ \t]*(?:>[ \t]*)+$/.test(head)) return null; // start of a quoted line
      if (head.endsWith("<!")) return null; // HTML comment
      if (/^[ \t|:-]*$/.test(head)) return null; // table delimiter row (| --- | :-- |) or a rule
      return rep(1, "—", before, typed);
    }
    case " ": {
      if (!opts.dialogueDash) return null;
      if (!/^[ \t]*(?:>[ \t]*)*--$/.test(before)) return null;
      return rep(2, "— ", before, typed);
    }
    case ".": {
      if (!before.endsWith("..") || before.endsWith("...")) return null;
      return rep(2, "…", before, typed);
    }
    case '"':
    case "'": {
      if (opts.quoteStyle === "off") {
        return null;
      }
      const q = QUOTES[opts.quoteStyle];
      const double = typed === '"';
      // look through emphasis markers: *"quoted"* or _'quoted'_
      const ctx = before.replace(/[*_~=]+$/, "");
      const prev = ctx.slice(-1);
      const opening = prev === "" || OPENERS.test(prev) || prev === q.open2 || prev === q.open1;
      if (!double && !opening && WORDISH.test(prev)) return rep(0, APOSTROPHE, before, typed);
      if (double) return rep(0, opening ? q.open2 : q.close2, before, typed);
      return rep(0, opening ? q.open1 : q.close1, before, typed);
    }
    default:
      return null;
  }
}
