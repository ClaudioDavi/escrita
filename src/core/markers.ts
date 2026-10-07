// Pure parsing of the plugin's in-text markers. All markers are single-line
// Obsidian comments so they are hidden in Reading view and by most publishers
// (text segmented by core/markdown, so markers in code or frontmatter don't count):
//
//   %% beat: As cartas na caixa de lata %%      ← a scene beat from the outline
//   %% XXX: conferir se o porão tem janela %%   ← a placeholder (marker configurable)
//   %% thread: quem escreveu as cartas? %%       ← an open thread (keyword configurable)
//   %% thread closed: quem escreveu as cartas? → [[A Casa]] %%   ← a closed thread (closed word configurable)
//
// Scene breaks are a line holding only `---` (or `***`, `* * *`) with blank lines around.

import { segment, type Markdown, type Span } from "./markdown";
import { replaceIfExact, type Change } from "./note-text";

export interface BeatMarker {
  /** 0-based line index of the beat comment */
  line: number;
  text: string;
  /** true when non-blank prose or code exists after the beat, before the next beat/break/end */
  written: boolean;
}

export interface PlaceholderMarker {
  line: number;
  /** character offset of the `%%` opening within the whole text */
  from: number;
  to: number;
  text: string;
}

export const BEAT_LINE = /^[ \t]*%%[ \t]*beat:[ \t]*(.*?)[ \t]*%%[ \t]*$/i;
export const SCENE_BREAK = /^[ \t]*(?:-{3,}|\*{3,}|(?:\*[ \t]+){2}\*|(?:-[ \t]+){2}-)[ \t]*$/;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function placeholderRegex(marker: string): RegExp {
  return new RegExp(`%%[ \\t]*${escapeRe(marker)}(?![\\p{L}\\p{N}_-]):?[ \\t]*([^\\n]*?)[ \\t]*%%`, "gu");
}

// Markers are read through core/markdown: a marker is a closed, single-line %%
// comment span, so `%% … %%` inside code, frontmatter, an HTML comment or a
// multi-line comment is not a marker (the same rule as the publish check).

/** Closed single-line %% comments in the body, in order, with their line. */
function markerComments(md: Markdown): { span: Span; line: number }[] {
  const out: { span: Span; line: number }[] = [];
  for (const span of md.spans()) {
    if (span.kind !== "comment" || span.form !== "%%" || !span.closed) continue;
    const line = md.lineOf(span.from);
    if (line < md.bodyLine || md.lineOf(span.to) !== line) continue;
    out.push({ span, line });
  }
  return out;
}

/**
 * The spans on line `i` with their text clipped to the line: the idiom for a
 * line-level question ("what is on line i") over core/markdown's spans, which
 * are unclipped and may run across lines.
 */
function lineSpans(md: Markdown, i: number): { span: Span; text: string }[] {
  const from = md.lineStart(i);
  const to = md.lineEnd(i);
  if (from === to) return [];
  return md.spans(from, to).map((span) => ({
    span,
    text: md.text.slice(Math.max(from, span.from), Math.min(to, span.to)),
  }));
}

/**
 * The beat text when line `i` is a beat line: it starts in prose and holds one
 * closed %% comment matching BEAT_LINE with only blanks around it. Null otherwise,
 * so a line of several comments ("%% beat: a %% %% beat: b %%") is no beat.
 */
function beatAt(md: Markdown, i: number): string | null {
  if (i < md.bodyLine || md.startsIn(i) !== "prose") return null;
  let beat: string | null = null;
  for (const { span, text } of lineSpans(md, i)) {
    if (span.kind === "prose") {
      if (text.trim() !== "") return null;
    } else if (span.kind === "comment" && span.form === "%%" && span.closed && beat === null
      && span.from >= md.lineStart(i) && span.to <= md.lineEnd(i)) {
      const m = BEAT_LINE.exec(text);
      if (!m) return null;
      beat = m[1];
    } else {
      return null;
    }
  }
  return beat;
}

/**
 * Whether line `i` is a scene-break line: it starts in prose, holds only prose
 * (no code, comment or frontmatter on it) and matches SCENE_BREAK. The one
 * definition for the outline, the publish check and the Enter flow (which adds
 * its own blank-line-before and body rules on top).
 */
export function isSceneBreakLine(md: Markdown, i: number): boolean {
  if (i < 0 || i >= md.lineCount || md.startsIn(i) !== "prose") return false;
  const parts = lineSpans(md, i);
  return parts.length === 1 && parts[0].span.kind === "prose" && SCENE_BREAK.test(parts[0].text);
}

/** A GFM table delimiter row: cells of `---`, `:--`, `--:` or `:-:` between pipes, leading and trailing pipes optional, at least one pipe. */
const TABLE_DELIMITER = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

/** The cells of a table row: split on unescaped pipes, one leading and one trailing pipe dropped. */
function tableCells(line: string): number {
  const t = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return t.split(/(?<!\\)\|/).length;
}

/**
 * Whether line `i` is a row of a GFM table (its header, delimiter or a body row): the line is
 * prose in a run of non-blank prose lines that holds a header row followed by a delimiter row
 * (`---|---`, leading pipe optional) with as many cells, and `i` is at or after that header.
 * Rows run to the next blank line. A pipe in plain prose ("Teo riu | e saiu") is no table.
 * Needs the lines around `i`, so it takes the segmented document.
 */
export function isTableLine(md: Markdown, i: number): boolean {
  const raw = (j: number) => md.text.slice(md.lineStart(j), md.lineEnd(j)).replace(/\r$/, "");
  const inRun = (j: number) => j >= md.bodyLine && j < md.lineCount && md.startsIn(j) === "prose" && raw(j).trim() !== "";
  if (!inRun(i)) return false;
  let start = i;
  while (inRun(start - 1)) start--;
  for (let d = start + 1; d <= i + 1 && inRun(d); d++) {
    const delim = raw(d);
    const head = raw(d - 1);
    if (delim.includes("|") && TABLE_DELIMITER.test(delim) && /(?<!\\)\|/.test(head) && tableCells(head) === tableCells(delim)) return true;
  }
  return false;
}

/** Whether line `i` is a beat line (a lone closed `%% beat: … %%` comment). */
export function isBeatLine(md: Markdown, i: number): boolean {
  return beatAt(md, i) !== null;
}

/**
 * A scene break at `i` that really is one (isSceneBreakLine, so not a `---` in
 * code or a comment), in the body (`i >= body`), and not a setext underline
 * (the body's start or a blank line must precede it).
 */
export function isSceneBreakAt(md: Markdown, i: number, body = md.bodyLine): boolean {
  if (i < body || !isSceneBreakLine(md, i)) return false;
  return i === body || md.text.slice(md.lineStart(i - 1), md.lineEnd(i - 1)).replace(/\r$/, "").match(/^[ \t]*$/) !== null;
}

/** Whether line `i` holds something a reader sees (prose or code) other than a scene break. */
function hasContent(md: Markdown, i: number): boolean {
  let t = "";
  for (const { span, text } of lineSpans(md, i)) if (span.kind === "prose" || span.kind === "code") t += " " + text;
  t = t.trim();
  return t.length > 0 && !SCENE_BREAK.test(t);
}

/** A text, or its segmentation (pass one from `segmentDoc` to reuse it). */
export type Source = string | Markdown;

function segmented(src: Source): Markdown {
  return typeof src === "string" ? segment(src) : src;
}

export function parseBeats(src: Source): BeatMarker[] {
  if (!(typeof src === "string" ? src : src.text).includes("%%")) return [];
  const md = segmented(src);
  const beats: BeatMarker[] = [];
  let last = -1;
  for (const { line: i } of markerComments(md)) {
    if (i === last) continue;
    last = i;
    const beat = beatAt(md, i);
    if (beat === null) continue;
    let written = false;
    for (let j = i + 1; j < md.lineCount; j++) {
      if (beatAt(md, j) !== null || isSceneBreakLine(md, j)) break;
      if (hasContent(md, j)) { written = true; break; }
    }
    beats.push({ line: i, text: beat, written });
  }
  return beats;
}

const anchored = new Map<string, RegExp>();

/** placeholderRegex(marker) matching a whole comment, not a search. */
function wholePlaceholder(marker: string): RegExp {
  let re = anchored.get(marker);
  if (!re) {
    re = new RegExp(`^(?:${placeholderRegex(marker).source})$`, "u");
    if (anchored.size > 16) anchored.clear();
    anchored.set(marker, re);
  }
  return re;
}

export function parsePlaceholders(src: Source, marker: string): PlaceholderMarker[] {
  const text = typeof src === "string" ? src : src.text;
  if (!text.includes("%%")) return [];
  const re = wholePlaceholder(marker);
  const out: PlaceholderMarker[] = [];
  for (const { span, line } of markerComments(segmented(src))) {
    const m = re.exec(text.slice(span.from, span.to));
    if (m) out.push({ line, from: span.from, to: span.to, text: m[1] });
  }
  return out;
}

export function beatLine(text: string): string {
  return `%% beat: ${text.replace(/%%/g, "%").replace(/\r?\n/g, " ").trim()} %%`;
}

export interface ThreadMarker {
  line: number;
  /** character offset of the `%%` opening within the whole text */
  from: number;
  to: number;
  /** the question, without the `closed` word and the answer link */
  text: string;
  closed: boolean;
  /** the note the thread was answered in (`→ [[note]]` or `-> [[note]]` at the end), else null */
  answeredBy: string | null;
  /** the whole comment as written, `%%` included (what closeThread checks before rewriting) */
  raw: string;
}

const threadRegexes = new Map<string, RegExp>();

/**
 * One whole thread comment. The keyword and the closed word are settings; the
 * closed form is the keyword, the closed word and a colon (`thread closed: …`).
 * The colon is required there so an open thread that starts with the word
 * ("%% thread closed door %%") is not read as closed.
 */
function threadRegex(keyword: string, closedWord: string): RegExp {
  const key = `${keyword}\u0000${closedWord}`;
  let re = threadRegexes.get(key);
  if (!re) {
    const mid = closedWord === "" ? ":?" : `(?:[ \\t]+(${escapeRe(closedWord)}):|:)?`;
    re = new RegExp(
      `^%%[ \\t]*${escapeRe(keyword)}(?![\\p{L}\\p{N}_-])${mid}[ \\t]*([^\\n]*?)[ \\t]*%%$`, "u");
    if (threadRegexes.size > 16) threadRegexes.clear();
    threadRegexes.set(key, re);
  }
  return re;
}

const ANSWER_LINK = /[ \t]*(?:→|->)[ \t]*\[\[([^\]\n]*)\]\][ \t]*$/u;

/** The note a wikilink body points at: no alias, heading or block part. */
export function linkTarget(inner: string): string {
  return inner.split("|")[0].split(/[#^]/)[0].trim();
}

/** Threads (open and closed) in the body, in order. Like placeholders, markers in code or frontmatter don't count. */
export function parseThreads(src: Source, keyword: string, closedWord: string): ThreadMarker[] {
  const text = typeof src === "string" ? src : src.text;
  if (keyword === "" || !text.includes("%%")) return [];
  const re = threadRegex(keyword, closedWord);
  const out: ThreadMarker[] = [];
  for (const { span, line } of markerComments(segmented(src))) {
    const raw = text.slice(span.from, span.to);
    const m = re.exec(raw);
    if (!m) continue;
    let body = m[2];
    let answeredBy: string | null = null;
    const a = ANSWER_LINK.exec(body);
    if (a) {
      answeredBy = linkTarget(a[1]) || null;
      body = body.slice(0, a.index);
    }
    out.push({ line, from: span.from, to: span.to, text: body, closed: m[1] !== undefined, answeredBy, raw });
  }
  return out;
}

/** The comment for a thread: `%% thread: … %%`, or `%% thread closed: … → [[note]] %%`. */
export function threadComment(keyword: string, closedWord: string, text: string, closed: boolean, answeredBy: string | null = null): string {
  const clean = text.replace(/%%/g, "%").replace(/\r?\n/g, " ").trim();
  const target = answeredBy ? linkTarget(answeredBy.replace(/[[\]\r\n]/g, "").replace(/%%/g, "%")) : "";
  const link = target !== "" ? ` → [[${target}]]` : "";
  return `%% ${keyword}${closed ? ` ${closedWord}` : ""}: ${clean}${link} %%`;
}

/**
 * Finds `thread` again in the text the plan runs on: the same line number and the
 * identical comment. Not a search: line and raw text are the same whether the text is
 * the file on disk (CRLF) or the editor's buffer (LF), while offsets are not.
 */
function sameThreadIn(text: string, thread: ThreadMarker, keyword: string, closedWord: string): ThreadMarker | null {
  return parseThreads(text, keyword, closedWord).find((t) => t.line === thread.line && t.raw === thread.raw) ?? null;
}

/**
 * The plan that closes `thread` (optionally recording the note that answers
 * it): the comment is rewritten only while its exact text is still on the same
 * line. Null for a thread that is already closed. Apply it through the note text port.
 */
export function closeThreadPlan(thread: ThreadMarker, keyword: string, closedWord: string, answeredBy?: string): (text: string) => Change | null {
  if (thread.closed) return () => null;
  const next = threadComment(keyword, closedWord, thread.text, true, answeredBy ?? thread.answeredBy);
  return (text) => {
    const at = sameThreadIn(text, thread, keyword, closedWord);
    return at ? replaceIfExact(at.from, at.to, at.raw, next)(text) : null;
  };
}

/**
 * The plan that reopens a closed `thread`: the closed word goes, the answer link
 * stays (it is still the best pointer to where the question was dealt with).
 * Same guard as closeThreadPlan. Null for a thread that is already open.
 */
export function reopenThreadPlan(thread: ThreadMarker, keyword: string, closedWord: string): (text: string) => Change | null {
  if (!thread.closed) return () => null;
  const next = threadComment(keyword, closedWord, thread.text, false, thread.answeredBy);
  return (text) => {
    const at = sameThreadIn(text, thread, keyword, closedWord);
    return at ? replaceIfExact(at.from, at.to, at.raw, next)(text) : null;
  };
}
