// Pure parsing of the plugin's in-text markers. All markers are single-line
// Obsidian comments so they are hidden in Reading view and by most publishers
// (text segmented by core/markdown, so markers in code or frontmatter don't count):
//
//   %% beat: As cartas na caixa de lata %%      ← a scene beat from the outline
//   %% XXX: conferir se o porão tem janela %%   ← a placeholder (marker configurable)
//
// Scene breaks are a line holding only `---` (or `***`, `* * *`) with blank lines around.

import { segment, type Markdown, type Span } from "./markdown";

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

/** Index of the first body line (after a closed frontmatter), 0-based. */
export function bodyStartLine(lines: string[]): number {
  return segment(lines.join("\n")).bodyLine;
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
