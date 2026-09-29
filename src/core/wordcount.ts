// Pure word counting for Markdown prose. Frontmatter, %% comments %%
// (beats, placeholders, notes to self), HTML comments, code and markup
// don't count; only the words a reader would read.

// Combining marks (\p{M}) belong to the word, so a decomposed "ninguém" is one word.
const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;

export function stripFrontmatter(md: string): string {
  if (!md.startsWith("---")) return md;
  const m = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(md);
  return m ? md.slice(m[0].length) : md;
}

/** An inline code span: a backtick run closed by a run of the same length, on one line. */
const INLINE_CODE = /(?<!`)(`+)(?!`)(?:[^\n]*?[^`\n])?\1(?!`)/g;

export function proseOnly(md: string): string {
  let s = stripFrontmatter(md);
  // Code first: `%%` inside inline or fenced code is literal, not a comment
  // (as in Obsidian), so it must not hide the rest of the note.
  s = s.replace(/^(```|~~~)[^\n]*\n[\s\S]*?(?:^\1[ \t]*$|(?![\s\S]))/gm, " "); // fenced code
  s = s.replace(INLINE_CODE, " ");                      // inline code, any backtick run
  s = s.replace(/%%[\s\S]*?(?:%%|$)/g, " ");          // Obsidian comments (unclosed runs to end, like Obsidian)
  s = s.replace(/<!--[\s\S]*?(?:-->|$)/g, " ");        // HTML comments
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

/** Count words in a plain selection (no frontmatter handling). */
export function countSelection(text: string): number {
  const s = text.replace(/%%[\s\S]*?(?:%%|$)/g, " ");
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
