// Pure Markdown context detection for the editor features (no Obsidian imports).
// A light line scanner: good enough to keep Enter, Enter, Enter and smart
// typography out of frontmatter, code, math and multi-line comments without
// depending on the editor's syntax tree.

export interface BlockState {
  /** inside the YAML frontmatter (including its closing line) */
  frontmatter: boolean;
  /** inside a fenced code block */
  code: boolean;
  /** inside a $$ math block */
  math: boolean;
  /** inside a multi-line %% comment */
  comment: boolean;
}

const FM_OPEN = /^---[ \t]*$/;
const FM_CLOSE = /^(?:---|\.\.\.)[ \t]*$/;
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/;

function count(line: string, token: string): number {
  let n = 0;
  for (let i = line.indexOf(token); i !== -1; i = line.indexOf(token, i + token.length)) n++;
  return n;
}

/**
 * Block context at the start of line `at` (0-based), scanning `lines[0..at)`.
 * An unclosed frontmatter counts as frontmatter all the way down (conservative:
 * we'd rather skip a feature than touch properties).
 */
export function blockStateAt(lines: readonly string[], at: number): BlockState {
  const st: BlockState = { frontmatter: false, code: false, math: false, comment: false };
  let i = 0;
  if (lines.length > 0 && FM_OPEN.test(lines[0])) {
    if (at === 0) return st;
    let close = -1;
    for (let j = 1; j < lines.length; j++) {
      if (FM_CLOSE.test(lines[j])) { close = j; break; }
    }
    if (close === -1 || at <= close) { st.frontmatter = true; return st; }
    i = close + 1;
  }
  let fence: { ch: string; len: number } | null = null;
  for (; i < at && i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      const m = FENCE.exec(line);
      if (m && m[1][0] === fence.ch && m[1].length >= fence.len && line.trim() === m[1]) fence = null;
      continue;
    }
    if (st.comment) {
      if (count(line, "%%") % 2 === 1) st.comment = false;
      continue;
    }
    if (st.math) {
      if (count(line, "$$") % 2 === 1) st.math = false;
      continue;
    }
    const f = FENCE.exec(line);
    if (f) { fence = { ch: f[1][0], len: f[1].length }; continue; }
    if (count(line, "%%") % 2 === 1) { st.comment = true; continue; }
    if (count(line, "$$") % 2 === 1) st.math = true;
  }
  st.code = fence !== null;
  return st;
}

/** First body line: after a closed frontmatter, else 0 (unclosed: everything counts as properties). */
export function bodyStart(lines: readonly string[]): number {
  if (lines.length > 0 && FM_OPEN.test(lines[0])) {
    for (let i = 1; i < lines.length; i++) if (FM_CLOSE.test(lines[i])) return i + 1;
    return lines.length;
  }
  return 0;
}

/** True when line `at` is part of the properties block, its opening and closing `---` included. */
export function inProperties(lines: readonly string[], at: number): boolean {
  return at < bodyStart(lines);
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
  // inline code: backtick runs open/close only with equal length
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
