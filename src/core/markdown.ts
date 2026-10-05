// Pure Markdown segmentation (no Obsidian or CodeMirror imports).
//
// One left-to-right pass splits a note into labelled ranges: prose, YAML
// frontmatter, code (fenced blocks and inline spans) and comments (%% … %% and
// closed <!-- … -->). Every feature that must skip non-prose text (word counts,
// markers, publish checks, the editor's Enter flow and typography) asks this
// module instead of re-detecting fences, comments or frontmatter itself.
//
// THE RULE SET (each rule is pinned by tests/markdown.test.ts)
// Lines split on "\n"; a "\r" before it belongs to the line ending. The scan is a
// strict left fold: the first opener wins, and inside a construct only its own
// closer matters.
// 1 FRONTMATTER: only if line 0 is `---` (trailing blanks allowed) AND a later line
//   is `---` or `...`; the first such line closes it. No closer → no frontmatter
//   span (the text is read as body) and `unclosedFrontmatter` is set.
// 2 FENCE, checked only at the start of a line that starts in prose: ≤3 spaces of
//   indent, then ``` or ~~~ (3+); a backtick opener's info string can't contain "`".
//   Closer: ≤3 spaces, same char, run ≥ opener length, only blanks after. Unclosed →
//   runs to the end. %%, <!-- and ` inside are literal.
// 3 In prose, char by char:
//   "\" before "`" or "\" escapes it (the escaped char is prose).
//   a backtick run of n opens inline code when a run of exactly n closes it on the
//     same line; otherwise the run is literal prose.
//   "%%" opens a comment up to the next "%%" (may span lines; fences inside are
//     literal). Unclosed → runs to the end, like Obsidian.
//   "<!--" opens a comment up to the next "-->" if there is one; otherwise literal
//     (so publish can't miss a placeholder after a stray one; counts over-count
//     after a line-start one, which Reading view hides). "%%" inside it is literal.
//   MATH (D16): "$$" at a line start in prose (≤3 spaces of indent) opens math up to
//   the next "$$", on that line or later. It stays prose (its words count) but
//   nothing opens inside it: %% is literal, as in Reading view. No closing "$$" →
//   not math, the "$$" is plain prose. "$$" inside a comment, code or frontmatter,
//   or after other text on a line, opens nothing.
// Not segmented: 4-space indented code, fences inside quotes or lists,
// multi-line inline code.

export type Kind = "prose" | "frontmatter" | "code" | "comment";

export interface Span {
  readonly kind: Kind;
  /** [from, to) UTF-16 offsets. Block spans end at the end of their last line's
   *  content: the line break after a closer is prose. */
  readonly from: number;
  readonly to: number;
  /** false only for the last span, when a fence or a %% comment runs to the end unclosed */
  readonly closed: boolean;
  /** comments only: which syntax */
  readonly form?: "%%" | "html";
}

export interface Markdown {
  readonly text: string;
  /** Spans overlapping [from, to), unclipped, in order. No args → all. Together they
   *  cover the text exactly: contiguous, non-empty, adjacent prose merged. "" → []. */
  spans(from?: number, to?: number): readonly Span[];
  /** The kind of the line break before line `line`: what the line starts inside.
   *  "prose" for line 0 and out of range. */
  startsIn(line: number): Kind;
  readonly lineCount: number;
  /** 0-based line of an offset; clamped. */
  lineOf(offset: number): number;
  /** Offset where a line starts; clamped. */
  lineStart(line: number): number;
  /** Offset where a line's content ends (before "\r?\n"); clamped. */
  lineEnd(line: number): number;
  /** First body line: the line after a closed frontmatter's closer, else 0. */
  readonly bodyLine: number;
  /** Line 0 is `---` and nothing closes it (there is no frontmatter span). */
  readonly unclosedFrontmatter: boolean;
  /** Same length as text: every char outside prose → " ", "\r" and "\n" kept. */
  masked(): string;
}

const KINDS: readonly Kind[] = ["prose", "frontmatter", "code", "comment"];
const KIND_INDEX: Record<Kind, number> = { prose: 0, frontmatter: 1, code: 2, comment: 3 };

const FM_OPEN = /^---[ \t]*$/;
const FM_CLOSE = /^(?:---|\.\.\.)[ \t]*$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
/** The characters that can start something in prose. */
const INTERESTING = /[\\`%<\n]/g;

class Segmented implements Markdown {
  readonly lineCount: number;
  private mask: string | null = null;

  constructor(
    readonly text: string,
    private readonly all: readonly Span[],
    private readonly starts: Int32Array,
    private readonly kinds: Uint8Array,
    readonly bodyLine: number,
    readonly unclosedFrontmatter: boolean,
  ) {
    this.lineCount = starts.length;
  }

  spans(from?: number, to?: number): readonly Span[] {
    if (from === undefined && to === undefined) return this.all;
    const a = from ?? 0;
    const b = to ?? this.text.length;
    const s = this.all;
    // first span whose end is past `a`
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (s[mid].to <= a) lo = mid + 1;
      else hi = mid;
    }
    const out: Span[] = [];
    for (let i = lo; i < s.length && s[i].from < b; i++) out.push(s[i]);
    return out;
  }

  startsIn(line: number): Kind {
    if (!(line > 0 && line < this.lineCount)) return "prose";
    return KINDS[this.kinds[line]];
  }

  lineOf(offset: number): number {
    const st = this.starts;
    const o = Math.max(0, Math.min(offset, this.text.length));
    let lo = 0;
    let hi = st.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (st[mid] <= o) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  lineStart(line: number): number {
    return this.starts[clampLine(line, this.lineCount)];
  }

  lineEnd(line: number): number {
    return contentEnd(this.text, this.starts, clampLine(line, this.lineCount));
  }

  masked(): string {
    if (this.mask === null) {
      let out = "";
      for (const s of this.all) {
        const part = this.text.slice(s.from, s.to);
        out += s.kind === "prose" ? part : part.replace(/[^\r\n]/g, " ");
      }
      this.mask = out;
    }
    return this.mask;
  }
}

function clampLine(line: number, count: number): number {
  return line < 0 || Number.isNaN(line) ? 0 : line >= count ? count - 1 : Math.floor(line);
}

function contentEnd(text: string, starts: Int32Array, line: number): number {
  if (line + 1 >= starts.length) return text.length;
  const nl = starts[line + 1] - 1;
  return nl > starts[line] && text.charCodeAt(nl - 1) === 13 ? nl - 1 : nl;
}

function scan(text: string): Segmented {
  const n = text.length;
  let lines = 1;
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) lines++;
  const starts = new Int32Array(lines);
  for (let i = text.indexOf("\n"), k = 1; i !== -1; i = text.indexOf("\n", i + 1)) starts[k++] = i + 1;
  const lineText = (l: number) => text.slice(starts[l], contentEnd(text, starts, l));

  const blocks: Span[] = []; // non-prose spans, in order
  let pos = 0;
  let bodyLine = 0;
  let unclosedFrontmatter = false;

  // 1 frontmatter
  if (n > 0 && FM_OPEN.test(lineText(0))) {
    let close = -1;
    for (let l = 1; l < lines; l++) if (FM_CLOSE.test(lineText(l))) { close = l; break; }
    if (close === -1) unclosedFrontmatter = true;
    else {
      const end = contentEnd(text, starts, close);
      blocks.push({ kind: "frontmatter", from: 0, to: end, closed: true });
      bodyLine = close + 1;
      pos = end;
    }
  }

  const lastArrow = text.lastIndexOf("-->");
  let line = 0; // line of the next line start to look at for fences
  let atLineStart = pos === 0;

  const tryFence = (l: number): number => {
    // returns the offset where prose resumes, or -1 when line l doesn't open a fence
    const t = lineText(l);
    const m = FENCE_OPEN.exec(t);
    if (!m || (m[1][0] === "`" && t.slice(m[0].length).includes("`"))) return -1;
    const ch = m[1][0];
    const len = m[1].length;
    for (let k = l + 1; k < lines; k++) {
      const c = FENCE_CLOSE.exec(lineText(k));
      if (c && c[1][0] === ch && c[1].length >= len) {
        const end = contentEnd(text, starts, k);
        blocks.push({ kind: "code", from: starts[l], to: end, closed: true });
        return end;
      }
    }
    blocks.push({ kind: "code", from: starts[l], to: n, closed: false });
    return n;
  };

  let i = pos;
  while (i < n) {
    if (atLineStart) {
      atLineStart = false;
      line = lineOfStart(starts, i, line);
      const resume = tryFence(line);
      if (resume !== -1) { i = resume; continue; }
      // a $$ block opened at a line start is math up to its closing $$: it stays
      // prose (words count), but %%, <!--, ` and fences inside are literal
      let q = i;
      while (q < i + 3 && text.charCodeAt(q) === 32) q++;
      if (text.charCodeAt(q) === 36 && text.charCodeAt(q + 1) === 36) {
        const close = text.indexOf("$$", q + 2);
        if (close !== -1) { i = close + 2; continue; }
      }
    }
    INTERESTING.lastIndex = i;
    const m = INTERESTING.exec(text);
    if (!m) break;
    i = m.index;
    const c = text.charCodeAt(i);
    if (c === 10 /* \n */) {
      i++;
      atLineStart = true;
    } else if (c === 92 /* \ */) {
      const next = text.charCodeAt(i + 1);
      i += next === 96 || next === 92 ? 2 : 1;
    } else if (c === 96 /* ` */) {
      let r = 1;
      while (text.charCodeAt(i + r) === 96) r++;
      const le = lineEndFrom(text, i);
      let j = i + r;
      let close = -1;
      while (j < le) {
        const k = text.indexOf("`", j);
        if (k === -1 || k >= le) break;
        let q = 1;
        while (text.charCodeAt(k + q) === 96) q++;
        if (q === r) { close = k; break; }
        j = k + q;
      }
      if (close === -1) i += r;
      else {
        blocks.push({ kind: "code", from: i, to: close + r, closed: true });
        i = close + r;
      }
    } else if (c === 37 /* % */) {
      if (text.charCodeAt(i + 1) !== 37) { i++; continue; }
      const close = text.indexOf("%%", i + 2);
      if (close === -1) {
        blocks.push({ kind: "comment", from: i, to: n, closed: false, form: "%%" });
        i = n;
      } else {
        blocks.push({ kind: "comment", from: i, to: close + 2, closed: true, form: "%%" });
        i = close + 2;
      }
    } else {
      // "<"
      if (!text.startsWith("<!--", i)) { i++; continue; }
      if (lastArrow < i + 4) { i += 4; continue; }
      const close = text.indexOf("-->", i + 4);
      blocks.push({ kind: "comment", from: i, to: close + 3, closed: true, form: "html" });
      i = close + 3;
    }
  }

  // fill prose gaps
  const all: Span[] = [];
  let at = 0;
  for (const b of blocks) {
    if (b.from > at) all.push({ kind: "prose", from: at, to: b.from, closed: true });
    all.push(b);
    at = b.to;
  }
  if (at < n) all.push({ kind: "prose", from: at, to: n, closed: true });

  // what each line starts inside: the span holding the "\n" before it
  const kinds = new Uint8Array(lines);
  let s = 0;
  for (let l = 1; l < lines; l++) {
    const nl = starts[l] - 1;
    while (all[s].to <= nl) s++;
    kinds[l] = KIND_INDEX[all[s].kind];
  }
  return new Segmented(text, all, starts, kinds, bodyLine, unclosedFrontmatter);
}

/** Line index of a line-start offset, searching forward from `hint`. */
function lineOfStart(starts: Int32Array, offset: number, hint: number): number {
  let l = hint;
  while (l + 1 < starts.length && starts[l + 1] <= offset) l++;
  return l;
}

/** End of the content of the line holding `i` (before "\r?\n"). */
function lineEndFrom(text: string, i: number): number {
  const nl = text.indexOf("\n", i);
  if (nl === -1) return text.length;
  return nl > i && text.charCodeAt(nl - 1) === 13 ? nl - 1 : nl;
}

let lastText: string | null = null;
let lastMd: Markdown | null = null;

/** Segment a text in one pass. The last result is cached (keyed on the exact string). */
export function segment(text: string): Markdown {
  if (lastMd !== null && lastText === text) return lastMd;
  const md = scan(text);
  lastText = text;
  lastMd = md;
  return md;
}

const byDoc = new WeakMap<object, Markdown>();

/** Segmentation of an immutable document object (e.g. a CodeMirror `Text`, one per doc version). */
export function segmentDoc(doc: { toString(): string }): Markdown {
  let md = byDoc.get(doc);
  if (!md) {
    md = segment(doc.toString());
    byDoc.set(doc, md);
  }
  return md;
}
