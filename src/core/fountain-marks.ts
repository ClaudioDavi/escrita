// Where Fountain's inline underline sits in one line (1.2, SP 2): `_text_`, read as `parseRuns`
// reads it. An underscore opens before a non-space and not right after a word character, and
// closes after a non-space and not right before a word character; a backslash escapes one.
// Pure, no Obsidian imports; the screenplay layout marks these ranges (src/screenplay/layout.ts).

const WORD = /[\p{L}\p{N}]/u;
const isWord = (c: string | undefined) => c !== undefined && WORD.test(c);
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

/** The `[from, to)` ranges of the `_…_` runs in `text`, underscores included, in order. */
export function underlineRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  const free = (i: number) => text[i] === "_" && text[i - 1] !== "\\";
  let i = 0;
  while (i < text.length) {
    if (!free(i) || isSpace(text[i + 1]) || isWord(text[i - 1])) { i++; continue; }
    let j = i + 2;
    while (j < text.length && !(free(j) && !isSpace(text[j - 1]) && !isWord(text[j + 1]))) j++;
    if (j >= text.length) { i++; continue; }
    out.push([i, j + 1]);
    i = j + 1;
  }
  return out;
}
