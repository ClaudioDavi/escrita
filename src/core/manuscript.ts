// A note's prose as an editor receives it (IMPROVEMENTS 15, PLAN-0.8 Q5-Q8). Pure,
// no Obsidian imports. `manuscriptOf` turns a note's Markdown into a small block
// model that every export writer formats: Markdown and DOCX in 0.8, EPUB in 0.10.
// Nothing in the model is format-specific: a writer never looks at Markdown again.
//
// What is dropped, and what is reported (`Manuscript.dropped`):
// - frontmatter, `%%` and closed `<!-- -->` comments: dropped silently (the writer's
//   notes to self). A line that held only a comment (a beat, a placeholder, a thread)
//   goes with its blank line, so no stray empty paragraph is left.
// - placeholders (`%% XXX: … %%`, marker word from settings): dropped and reported,
//   so the export modal can warn like the publish check does.
// - embeds (`![[…]]`, `![](…)`): dropped and reported.
// - an unclosed `%%`, or an unclosed `<!--` at the start of a line: Reading view hides
//   everything after it, so the manuscript does too (a mid-line `<!--` is literal text);
//   the hidden text is reported once, at the opener.
// Removing an inline `%%` or `<!-- -->` takes the whitespace before it, so no double
// or trailing space is left.
// For task 3.1: read `strictLineBreaks` only through a listed ARCHITECTURE exception,
// or default it off. For task 2.3: the Markdown writer writes a run's "\n" as a
// CommonMark hard break (backslash, newline).
// The segmentation is core/markdown's (`segment`), the scene break rule is
// `isSceneBreakAt` (core/markers.ts), and the link rules come from the `MARKUP`
// table in core/wordcount.ts, so the manuscript can't drift from the counts.
//
import { segment, type Markdown } from "./markdown";
import { SCENE_BREAK, parsePlaceholders } from "./markers";
import { MARKUP } from "./wordcount";

/**
 * A stretch of text with one formatting. Writers render runs in order and add
 * nothing between them. `text` may contain "\n": a line break inside the block
 * (a verse line, an address in an epigraph), never a paragraph break.
 * Inline code becomes a plain run (Q6: code keeps its text, unformatted).
 */
export interface Run {
  text: string;
  italic?: true;
  bold?: true;
}

/**
 * One block of the manuscript, in reading order. Closed set: a new kind of block
 * is a deliberate change to every writer.
 * - `paragraph`: a paragraph of prose. A list item is a paragraph too, its mark
 *   kept as text (lists are rare in fiction; nothing is lost).
 * - `heading`: a heading inside the note's body, level 1-6 as written. The
 *   chapter heading the pipeline adds is not a block (see ExportPart.heading).
 * - `quote`: one paragraph of a `>` quotation or a callout's body; consecutive
 *   quote blocks are one quotation. A callout's header line is dropped.
 * - `sceneBreak`: a scene break (`isSceneBreakAt`). Never first or last in a
 *   manuscript, never two in a row: a break at the edge of a note or chapter is
 *   dropped, since a chapter boundary already separates (N 7).
 */
export type Block =
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: Run[] }
  | { kind: "quote"; runs: Run[] }
  | { kind: "sceneBreak" };

/** Something Reading view would not show, or that can't go into a manuscript. */
export interface Dropped {
  kind: "placeholder" | "embed" | "unclosedComment";
  /** 0-based line in the whole file (frontmatter included), to jump to */
  line: number;
  /** the placeholder's note, the embed's target, or "" for an unclosed comment */
  text: string;
}

export interface Manuscript {
  blocks: Block[];
  /** in file order */
  dropped: Dropped[];
}

export interface ManuscriptOptions {
  /** the placeholder marker word from settings (`XXX`) */
  placeholderMarker: string;
  /**
   * Obsidian's "Strict line breaks" setting. Off (the default, like Obsidian's):
   * a single line break inside a paragraph is a "\n" in its run. On: it is a space.
   */
  strictLineBreaks?: boolean;
  /**
   * When the first block is a heading whose text equals this (trimmed, case
   * ignored), it is dropped: a note that starts with `# Its title` doesn't print
   * the title twice under the pipeline's own heading. Omitted = keep every heading.
   */
  dropTitleHeading?: string;
}


// Private-use sentinels: a removed stretch (comment, embed) and a protected code text.
const GONE = "\u0001";
const CODE_OPEN = "\u0002";
const CODE_CLOSE = "\u0003";

// Entries of the MARKUP table this module reads (pinned by tests/manuscript.test.ts).
const EMBED_RES = [MARKUP[0].re, MARKUP[1].re];
const LINK_RES = [MARKUP[2], MARKUP[3]];

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const HEADING_EMPTY = /^ {0,3}(#{1,6})[ \t]*$/;
const LIST_ITEM = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/;
const CALLOUT_HEAD = /^\[![^\]]*\][+-]?/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;

interface Built {
  vis: string;
  codes: string[];
  dropped: Dropped[];
}

/** The visible text: comments and embeds become GONE, code a token, frontmatter nothing. */
function build(md: Markdown, o: ManuscriptOptions): Built {
  const text = md.text;
  const dropped: Dropped[] = [];
  const order = new Map<Dropped, number>();
  const codes: string[] = [];
  let vis = "";
  for (const span of md.spans()) {
    if (span.kind === "frontmatter") continue;
    if (span.kind === "comment") {
      vis += GONE;
      if (!span.closed) {
        dropped.push({ kind: "unclosedComment", line: md.lineOf(span.from), text: "" });
        break;
      }
      continue;
    }
    if (span.kind === "code") {
      const raw = text.slice(span.from, span.to);
      const line = md.lineOf(span.from);
      const atLineStart = text.slice(md.lineStart(line), span.from).trim() === "";
      if (atLineStart && FENCE_OPEN.test(raw)) {
        const lines = raw.split(/\r?\n/);
        lines.shift();
        if (span.closed) lines.pop();
        const inner = lines.join("\n");
        if (inner.trim() === "") vis += GONE;
        else vis += CODE_OPEN + (codes.push(inner) - 1) + CODE_CLOSE;
      } else {
        const m = /^(`+)([\s\S]*?)\1$/.exec(raw);
        let inner = m ? m[2] : raw;
        if (/^ .* $/.test(inner) && inner.trim() !== "") inner = inner.slice(1, -1);
        vis += CODE_OPEN + (codes.push(inner) - 1) + CODE_CLOSE;
      }
      continue;
    }
    // prose
    let prose = text.slice(span.from, span.to);
    let cut = false;
    // Only a `<!--` that starts its line hides the rest (D11); mid-line it is literal text.
    for (let open = prose.indexOf("<!--"); open >= 0; open = prose.indexOf("<!--", open + 4)) {
      const ls = md.lineStart(md.lineOf(span.from + open));
      if (!/^ {0,3}$/.test(text.slice(ls, span.from + open))) continue;
      dropped.push({ kind: "unclosedComment", line: md.lineOf(span.from + open), text: "" });
      prose = prose.slice(0, open);
      cut = true;
      break;
    }
    for (const re of EMBED_RES) {
      prose = prose.replace(re, (...a: unknown[]) => {
        const m = a[0] as string;
        const at = a[a.length - 2] as number;
        const inner = m.startsWith("![[") ? m.slice(3, -2).split("|")[0] : /\(([^)]*)\)$/.exec(m)?.[1] ?? "";
        const d: Dropped = { kind: "embed", line: md.lineOf(span.from + at), text: inner };
        order.set(d, span.from + at);
        dropped.push(d);
        return GONE;
      });
    }
    vis += prose;
    if (cut) {
      vis += GONE;
      break;
    }
  }
  for (const p of parsePlaceholders(md, o.placeholderMarker)) {
    const d: Dropped = { kind: "placeholder", line: p.line, text: p.text };
    order.set(d, p.from);
    dropped.push(d);
  }
  const at = (d: Dropped) => order.get(d) ?? md.lineStart(d.line);
  dropped.sort((a, b) => a.line - b.line || at(a) - at(b));
  return { vis, codes, dropped };
}

function hasGone(s: string): boolean {
  return s.includes(GONE);
}

function stripGone(s: string): string {
  return s.replace(/[ \t]*\u0001/g, "");
}

function applyLinks(s: string): string {
  for (const { re, keep } of LINK_RES) {
    s = s.replace(re, (...a: unknown[]) => (a[keep ?? 0] as string | undefined) ?? "");
  }
  return s;
}

interface Delim {
  ch: string;
  n: number;
  rem: number;
  canOpen: boolean;
  canClose: boolean;
  opens: number[];
  closes: number[];
}
type Tok = { t: "text"; s: string; plain?: boolean } | ({ t: "delim" } & Delim);

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);
const isWord = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/** Inline Markdown to runs: links to text, emphasis to flags, code plain. */
function runsOf(raw: string, codes: string[]): Run[] {
  const s = applyLinks(raw);
  const toks: Tok[] = [];
  let buf = "";
  const flush = () => {
    if (buf) toks.push({ t: "text", s: buf });
    buf = "";
  };
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (c === CODE_OPEN) {
      const end = s.indexOf(CODE_CLOSE, i);
      flush();
      toks.push({ t: "text", s: codes[Number(s.slice(i + 1, end))] ?? "", plain: true });
      i = end + 1;
    } else if (c === "\\" && i + 1 < s.length && /[!-/:-@[-`{-~]/.test(s[i + 1])) {
      buf += s[i + 1];
      i += 2;
    } else if (c === "*" || c === "_") {
      let j = i;
      while (s[j] === c) j++;
      const before = buf ? buf[buf.length - 1] : toks.length ? lastChar(toks[toks.length - 1]) : undefined;
      const after = s[j] === CODE_OPEN ? "x" : s[j];
      let canOpen = !isSpace(after);
      let canClose = !isSpace(before);
      if (c === "_") {
        canOpen = canOpen && !isWord(before);
        canClose = canClose && !isWord(after);
      }
      flush();
      toks.push({ t: "delim", ch: c, n: j - i, rem: j - i, canOpen, canClose, opens: [], closes: [] });
      i = j;
    } else {
      buf += c;
      i++;
    }
  }
  flush();

  const stack: Delim[] = [];
  for (const tk of toks) {
    if (tk.t !== "delim") continue;
    if (tk.canClose) {
      while (tk.rem > 0) {
        let at = stack.length - 1;
        while (at >= 0 && !(stack[at].ch === tk.ch && stack[at].rem > 0)) at--;
        if (at < 0) break;
        const op = stack[at];
        stack.length = at + 1;
        const k = Math.min(op.rem, tk.rem) >= 2 ? 2 : 1;
        op.rem -= k;
        tk.rem -= k;
        op.opens.push(k);
        tk.closes.push(k);
        if (op.rem === 0) stack.pop();
      }
    }
    if (tk.canOpen && tk.rem > 0) stack.push(tk);
  }

  const runs: Run[] = [];
  let bold = 0;
  let italic = 0;
  const emit = (text: string, plain = false) => {
    if (!text) return;
    const last = runs[runs.length - 1];
    const b = !plain && bold > 0;
    const it = !plain && italic > 0;
    if (last && !!last.bold === b && !!last.italic === it) {
      last.text += text;
      return;
    }
    const r: Run = { text };
    if (it) r.italic = true;
    if (b) r.bold = true;
    runs.push(r);
  };
  for (const tk of toks) {
    if (tk.t === "text") {
      emit(tk.s, tk.plain);
      continue;
    }
    const apply = (ks: number[], dir: 1 | -1) => {
      for (const k of ks) {
        if (k === 2) bold += dir;
        else italic += dir;
      }
    };
    if (tk.closes.length) {
      // closer: consumed marks first (innermost), then the literal rest
      apply(tk.closes, -1);
      emit(tk.ch.repeat(tk.rem));
    } else {
      emit(tk.ch.repeat(tk.rem));
      apply(tk.opens, 1);
    }
    if (tk.closes.length && tk.opens.length) apply(tk.opens, 1);
  }
  return runs;
}

function lastChar(t: Tok): string | undefined {
  if (t.t === "text") return t.s[t.s.length - 1];
  return t.ch;
}

function isBlankRuns(runs: Run[]): boolean {
  return runs.every((r) => r.text.trim() === "");
}

function trimRuns(runs: Run[]): Run[] {
  if (!runs.length) return runs;
  runs[0].text = runs[0].text.replace(/^\s+/, "");
  runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, "");
  return runs.filter((r) => r.text !== "");
}

/**
 * The note's prose as blocks of runs, plus what was dropped (see the header).
 * Takes the raw text or an existing segmentation. Pure and total: never throws,
 * and an empty or comment-only note gives `{ blocks: [], dropped: [...] }`.
 * Wikilinks become their alias, else their target's text; Markdown links their
 * text; bare URLs stay as text. Emphasis (`*`, `_`, `**`, `__`) becomes run
 * flags; an unmatched mark stays as a literal character.
 *
 * Choices the plan left open: fenced code keeps its inner lines as one plain
 * paragraph (fences dropped); `~~strike~~`, `==highlight==` and `#tags` stay as
 * literal text; a `---` right under a text line is a setext heading, like Reading
 * view; math (`$$`) is kept as text.
 */
export function manuscriptOf(md: string | Markdown, o: ManuscriptOptions): Manuscript {
  const seg = typeof md === "string" ? segment(md) : md;
  const { vis, codes, dropped } = build(seg, o);
  const join = o.strictLineBreaks ? " " : "\n";

  // lines, with the ones a removal emptied left out
  const lines: string[] = [];
  for (const raw of vis.split(/\r?\n/)) {
    if (hasGone(raw)) {
      const t = stripGone(raw).replace(/^[ \t]+/, "");
      if (t.trim() === "") continue;
      lines.push(t);
    } else lines.push(raw);
  }

  const blocks: Block[] = [];
  let para: string[] = [];
  let paraKind: "paragraph" | "quote" = "paragraph";
  const endPara = () => {
    if (!para.length) return;
    const runs = trimRuns(runsOf(para.map((l) => l.trim()).join(join), codes));
    if (runs.length && !isBlankRuns(runs)) blocks.push({ kind: paraKind, runs });
    para = [];
    paraKind = "paragraph";
  };
  const prevBlank = (i: number) => i === 0 || lines[i - 1].trim() === "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      endPara();
      continue;
    }
    if (prevBlank(i) && SCENE_BREAK.test(line)) {
      endPara();
      blocks.push({ kind: "sceneBreak" });
      continue;
    }
    const setext = SETEXT.exec(line);
    if (setext && para.length && paraKind === "paragraph" && !LIST_ITEM.test(para[0])) {
      const runs = trimRuns(runsOf(para.map((l) => l.trim()).join(" "), codes));
      para = [];
      if (runs.length) blocks.push({ kind: "heading", level: setext[1][0] === "=" ? 1 : 2, runs });
      continue;
    }
    const h = HEADING.exec(line);
    if (h || HEADING_EMPTY.test(line)) {
      endPara();
      if (h) {
        const runs = trimRuns(runsOf(h[2], codes));
        if (runs.length) blocks.push({ kind: "heading", level: h[1].length as 1, runs });
      }
      continue;
    }
    if (/^[ \t]*>/.test(line)) {
      if (paraKind !== "quote") endPara();
      paraKind = "quote";
      const body = line.replace(/^(?:[ \t]*>)+[ \t]?/, "");
      if (para.length === 0 && CALLOUT_HEAD.test(body.trim())) continue;
      if (body.trim() === "") {
        endPara();
        paraKind = "quote";
        continue;
      }
      para.push(body);
      continue;
    }
    if (paraKind === "quote") endPara();
    if (LIST_ITEM.test(line)) endPara();
    para.push(line);
  }
  endPara();

  // scene breaks: never first, never last, never two in a row
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.kind === "sceneBreak" && (out.length === 0 || out[out.length - 1].kind === "sceneBreak")) continue;
    out.push(b);
  }
  while (out.length && out[out.length - 1].kind === "sceneBreak") out.pop();

  if (o.dropTitleHeading !== undefined && out[0]?.kind === "heading") {
    const t = out[0].runs.map((r) => r.text).join("").trim().toLowerCase();
    if (t === o.dropTitleHeading.trim().toLowerCase()) out.shift();
  }
  while (out.length && out[0].kind === "sceneBreak") out.shift();
  return { blocks: out, dropped };
}
