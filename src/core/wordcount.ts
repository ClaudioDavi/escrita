// Pure word counting for Markdown prose. Frontmatter, %% comments %%
// (beats, placeholders, notes to self), HTML comments, code and markup
// don't count; only the words a reader would read.

import { segment, type Markdown } from "./markdown";

// Combining marks (\p{M}) belong to the word, so a decomposed "ninguém" is one word.
const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;

/**
 * The text a reader reads, markup still in place: frontmatter dropped (with the
 * line break after it), code, %% comments and closed HTML comments replaced by a
 * space (see core/markdown for the one rule set), then link targets, list and
 * heading marks, rules and tags removed.
 */
export function proseOnly(md: string): string {
  let s = "";
  let afterFrontmatter = false;
  for (const span of segment(md).spans()) {
    if (span.kind === "prose") {
      let from = span.from;
      // the line break right after the frontmatter goes with it
      if (afterFrontmatter) from += md.startsWith("\r\n", from) ? 2 : 1;
      s += md.slice(from, span.to);
    } else if (span.kind !== "frontmatter") {
      s += " ";
    }
    afterFrontmatter = span.kind === "frontmatter";
  }
  return stripMarkup(s);
}

/** Link targets, embeds, urls, rules, quote/heading/list marks and tags: never words. */
function stripMarkup(s: string): string {
  s = s.replace(/!\[\[[^\]]*\]\]/g, " ");               // embeds
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");          // images
  s = s.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2"); // wikilinks → alias or target
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");        // md links → text
  s = s.replace(/https?:\/\/\S+/g, " ");                // bare urls
  s = s.replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, " ");  // scene breaks / rules
  s = s.replace(/^[ \t]*>[ \t]?(\[![^\]]*\][+-]?)?/gm, " "); // quotes, callout headers
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, " ");          // heading marks
  s = s.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(\[.\][ \t]+)?/gm, " "); // list marks
  s = s.replace(/(^|\s)#[\p{L}\p{N}_/-]+/gu, "$1");     // tags
  return s;
}

export function countWords(md: string): number {
  const m = proseOnly(md).match(WORD);
  return m ? m.length : 0;
}

/**
 * Words in the selected ranges of a segmented document, by the same rules as
 * countWords: code, comments and frontmatter in the selection don't count.
 */
export function countSelection(md: Markdown, ranges: readonly { from: number; to: number }[]): number {
  const mask = md.masked();
  const s = stripMarkup(ranges.map((r) => mask.slice(r.from, r.to)).join("\n"));
  const m = s.match(WORD);
  return m ? m.length : 0;
}

// ── Characters ───────────────────────────────────────────────────────────
// Contests count "caracteres com espaços" on the text a reader sees, so this
// counts on the same prose-only text as countWords, minus emphasis marks,
// with whitespace runs collapsed to one space and trimmed.
// A "character" is a user-perceived letter: text is NFC-normalized and
// combining marks are not counted on their own, so "é" counts as 1 whether it
// was typed precomposed (U+00E9) or decomposed (e + U+0301). An em dash, an
// ellipsis character and an emoji each count as 1 (counted by code point, not
// UTF-16 unit).

const ESCAPED = /\\([\\`*_{}[\]()#+\-.!~=|<>])/g;

/** Prose-only text with inline markup removed: what a reader reads. */
export function readerText(md: string): string {
  const kept: string[] = [];
  let s = proseOnly(md).replace(ESCAPED, (_, c: string) => {
    kept.push(c);
    return `${kept.length - 1}`;
  });
  s = s.replace(/<\/?[a-z][^>\n]*>/gi, " ");            // HTML tags
  s = s.replace(/\[\^[^\]\n]*\]/g, "");                   // footnote refs
  s = s.replace(/(^|\s)\^[\w-]+(?=\s|$)/g, "$1");          // block ids
  // Paired emphasis, strike and highlight only: a lone `*` ("5 * 3", "m***")
  // or `==` ("a == b") is a character the reader sees, so it counts.
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(/(\*{1,3})(?=[^\s*])([^\n]*?[^\s*])\1(?!\*)/g, "$2");
  }
  s = s.replace(/~~(?=\S)([^\n]*?\S)~~/g, "$1");
  s = s.replace(/==(?=\S)([^\n]*?\S)==/g, "$1");
  s = s.replace(/(^|[^\p{L}\p{N}])_+|_+(?=[^\p{L}\p{N}]|$)/gu, "$1"); // _emphasis_ (not snake_case)
  s = s.replace(/(\d+)/g, (_, i: string) => kept[Number(i)]);
  return s.replace(/\s+/g, " ").trim();
}

/** Number of user-perceived characters in plain text (see above). */
export function charLength(text: string): number {
  let n = 0;
  for (const ch of text.normalize("NFC")) if (!/\p{M}/u.test(ch)) n++;
  return n;
}

export function countCharacters(md: string, opts: { spaces: boolean }): number {
  const s = readerText(md);
  return charLength(opts.spaces ? s : s.replace(/ /g, ""));
}
