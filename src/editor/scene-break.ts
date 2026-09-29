// "Insert scene break" — pure edit computation (no Obsidian imports).

export interface TextEdit {
  from: number;
  to: number;
  insert: string;
  /** cursor offset after the edit */
  cursor: number;
}

const WS = /[ \t\r\n]/;

/**
 * Insert a scene break at `pos`, normalizing the whitespace around it so the
 * text reads `prose\n\n---\n\nnext`. Only whitespace is ever replaced; the
 * indentation of the following line is kept. At the very start of the text a
 * leading empty line keeps the `---` from turning into frontmatter.
 */
export function sceneBreakEdit(doc: string, pos: number): TextEdit {
  const p = Math.max(0, Math.min(pos, doc.length));
  let from = p;
  while (from > 0 && WS.test(doc[from - 1])) from--;
  let to = p;
  while (to < doc.length && WS.test(doc[to])) to++;
  if (to < doc.length) {
    // keep the next line's indentation; eat only what's left on the cursor's line
    const nl = doc.lastIndexOf("\n", to - 1);
    if (nl >= p) to = nl + 1;
  }
  const insert = (from > 0 ? "\n\n" : "\n") + "---\n\n";
  return { from, to, insert, cursor: from + insert.length };
}
