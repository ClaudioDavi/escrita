// Pure word counting for Markdown prose. Frontmatter, %% comments %%
// (beats, placeholders, notes to self), HTML comments, code and markup
// don't count; only the words a reader would read.

const WORD = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

export function stripFrontmatter(md: string): string {
  if (!md.startsWith("---")) return md;
  const m = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(md);
  return m ? md.slice(m[0].length) : md;
}

export function proseOnly(md: string): string {
  let s = stripFrontmatter(md);
  s = s.replace(/%%[\s\S]*?(?:%%|$)/g, " ");          // Obsidian comments (unclosed runs to end, like Obsidian)
  s = s.replace(/<!--[\s\S]*?(?:-->|$)/g, " ");        // HTML comments
  s = s.replace(/^(```|~~~)[^\n]*\n[\s\S]*?(?:^\1[ \t]*$|(?![\s\S]))/gm, " "); // fenced code
  s = s.replace(/`[^`\n]*`/g, " ");                     // inline code
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
