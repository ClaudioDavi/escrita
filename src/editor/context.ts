// Pure Markdown context detection for the editor features (no Obsidian imports).
// Built entirely on core/markdown (frontmatter, fences, comments and math, which
// core/markdown decides: D18): enough to keep Enter, Enter, Enter and smart typography out of frontmatter,
// code, math and multi-line comments without depending on the editor's syntax tree.

import { segment, type Markdown } from "../core/markdown";

export interface BlockState {
  /** inside the YAML frontmatter (including its closing line) */
  frontmatter: boolean;
  /** inside a fenced code block */
  code: boolean;
  /** inside a $$ math block */
  math: boolean;
  /** inside a multi-line comment (%% or a closed <!-- -->) */
  comment: boolean;
}

/**
 * Block context at the start of line `at` (0-based) of a segmented document.
 * An unclosed frontmatter counts as frontmatter all the way down (conservative:
 * we'd rather skip a feature than touch properties).
 */
export function blockStateIn(md: Markdown, at: number): BlockState {
  const st: BlockState = { frontmatter: false, code: false, math: false, comment: false };
  if (at > 0 && (md.unclosedFrontmatter || at < md.bodyLine)) {
    st.frontmatter = true;
    return st;
  }
  const kind = md.startsIn(at);
  st.code = kind === "code";
  st.comment = kind === "comment";
  st.math = md.inMath(at);
  return st;
}

/**
 * The editor's first body line of a segmented document: after a closed
 * frontmatter, else 0; an unclosed one makes every line properties (lineCount).
 */
export function bodyLineIn(md: Markdown): number {
  return md.unclosedFrontmatter ? md.lineCount : md.bodyLine;
}

export function inBlock(st: BlockState): boolean {
  return st.frontmatter || st.code || st.math || st.comment;
}

/**
 * True when the cursor, at the end of `before` (the current line up to the
 * cursor), sits somewhere typography must not touch: inline code, inline math,
 * a link or wikilink target, a URL, an HTML tag, or a table row.
 */
export function inlineProtected(before: string): boolean {
  // inline code: backtick runs open/close only with equal length. This keeps its
  // own loop instead of asking core/markdown: it predicts a span that is still
  // being typed (an open run counts), which is not a parse of finished text.
  let open = 0;
  for (let i = 0; i < before.length;) {
    if (before[i] === "`") {
      let j = i;
      while (j < before.length && before[j] === "`") j++;
      const len = j - i;
      if (open === 0) open = len;
      else if (open === len) open = 0;
      i = j;
    } else {
      if (open === 0 && before[i] === "\\") i++;
      i++;
    }
  }
  if (open > 0) return true;

  // inline math: a $ followed by non-space (and not a digit, to spare prices) opens,
  // a $ preceded by non-space closes; $$ is ignored here (block math)
  let math = false;
  for (let i = 0; i < before.length; i++) {
    const c = before[i];
    if (c === "\\") { i++; continue; }
    if (c !== "$") continue;
    if (before[i + 1] === "$") { i++; continue; }
    if (!math) {
      const next = before[i + 1];
      if (next !== undefined && !/[\s\d]/.test(next)) math = true;
    } else if (!/\s/.test(before[i - 1] ?? " ")) {
      math = false;
    }
  }
  if (math) return true;

  // wikilink target (before the | alias)
  const wl = before.lastIndexOf("[[");
  if (wl !== -1) {
    const rest = before.slice(wl + 2);
    if (!rest.includes("]]") && !rest.includes("|")) return true;
  }
  // markdown link target: ](… not yet closed
  const ml = before.lastIndexOf("](");
  if (ml !== -1 && !before.slice(ml + 2).includes(")")) return true;
  // URL being typed
  if (/(?:https?|obsidian|file|mailto):\/?\/?\S*$/i.test(before)) return true;
  // inside an HTML tag
  if (/<\/?[A-Za-z][^<>]*$/.test(before)) return true;
  // HTML comment
  const hc = before.lastIndexOf("<!--");
  if (hc !== -1 && !before.slice(hc + 4).includes("-->")) return true;
  // table rows
  if (/^[ \t]*\|/.test(before)) return true;
  return false;
}
