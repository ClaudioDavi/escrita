// Pure publish checks (no Obsidian imports). runChecks looks at a note's text
// and properties and reports what could go wrong on the published page.
// Messages are not translated here: each Check carries an id, a level and
// variables, and the modal turns them into text with t().

import { bodyStartLine, parseBeats, parsePlaceholders } from "../core/markers";
import { countWords } from "../core/wordcount";
import { pieceCount, pieceProgress, readPiece, type PieceProperties } from "../core/piece";

export type CheckLevel = "blocker" | "warning" | "passed";

export type CheckId =
  | "unclosedComment"
  | "placeholders"
  | "unwrittenBeats"
  | "emptyBody"
  | "recommended"
  | "overLimit"
  | "urlTaken"
  | "urlChanged";

export interface CheckItem {
  /** raw text from the note (a placeholder's note, a beat, a path); "" = nothing to show */
  text: string;
  /** 0-based line in the whole file, to jump to */
  line?: number;
  /** another note this item points to (URL taken) */
  path?: string;
}

export interface Check {
  id: CheckId;
  level: CheckLevel;
  /** 0-based line in the whole file where the problem is */
  line?: number;
  items: CheckItem[];
  vars: Record<string, string | number>;
}

export interface SlugEntry {
  path: string;
  /** the note's address (see slug.noteUrl) */
  slug: string;
}

export interface CheckContext {
  /** the note being checked */
  path: string;
  placeholderMarker: string;
  /** property names that should be filled in; empty = check off */
  recommendedProperties: readonly string[];
  /** where the target/limit/unit live; omitted = no limit check */
  piece?: PieceProperties;
  /** this note's address; omitted = no URL checks */
  url?: string;
  /** other published notes in the publish folders; omitted = no "URL taken" check */
  others?: readonly SlugEntry[];
  /** the address stored at the last publish; omitted = no "URL changed" check */
  previousUrl?: string;
}

export const BLOCKER_FIRST: Record<CheckLevel, number> = { blocker: 0, warning: 1, passed: 2 };

// ------------------------------------------------------------------ code ranges

const FENCE_OPEN = /^[ \t]{0,3}(`{3,}|~{3,})/;

/**
 * For each line, whether it is part of a fenced code block (fence lines included),
 * for lines from `start` on. Unclosed fences run to the end, like Markdown.
 */
export function fencedLines(lines: readonly string[], start = 0): boolean[] {
  const out = lines.map(() => false);
  let fence: string | null = null;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      out[i] = true;
      const m = FENCE_OPEN.exec(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && line.slice(m[0].length).trim() === "") fence = null;
      continue;
    }
    const m = FENCE_OPEN.exec(line);
    // A backtick fence's info string can't contain backticks.
    if (m && !(m[1][0] === "`" && line.slice(m[0].length).includes("`"))) {
      fence = m[1];
      out[i] = true;
    }
  }
  return out;
}

/** The line with inline code spans blanked out (same length), so `%%` inside them isn't counted. */
export function blankInlineCode(line: string): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] !== "`") { out += line[i++]; continue; }
    let n = 0;
    while (line[i + n] === "`") n++;
    const run = "`".repeat(n);
    // The closing run has exactly n backticks.
    let j = i + n;
    let close = -1;
    while ((j = line.indexOf(run, j)) !== -1) {
      if (line[j + n] !== "`" && line[j - 1] !== "`") { close = j; break; }
      while (line[j] === "`") j++;
    }
    if (close === -1) { out += run; i += n; continue; }
    out += " ".repeat(close + n - i);
    i = close + n;
  }
  return out;
}

// ------------------------------------------------------------------ comments

/**
 * The 0-based line where an unclosed `%%` comment opens, or null when every
 * comment is closed. `%%` pairs are counted in the body only, outside inline
 * and fenced code, across lines (a comment may span paragraphs).
 */
export function unclosedComment(text: string): number | null {
  const lines = text.split(/\r?\n/);
  const start = bodyStartLine(lines);
  const fenced = fencedLines(lines, start);
  let open: number | null = null;
  for (let i = start; i < lines.length; i++) {
    if (fenced[i]) continue;
    const line = blankInlineCode(lines[i]);
    for (let at = line.indexOf("%%"); at !== -1; at = line.indexOf("%%", at + 2)) {
      open = open === null ? i : null;
    }
  }
  return open;
}

// ------------------------------------------------------------------ URLs

/** Addresses shared by two or more different notes, each with the notes that share it. */
export function duplicateSlugs(entries: readonly SlugEntry[]): { slug: string; paths: string[] }[] {
  const by = new Map<string, string[]>();
  for (const e of entries) {
    const paths = by.get(e.slug) ?? [];
    if (!paths.includes(e.path)) paths.push(e.path);
    by.set(e.slug, paths);
  }
  return [...by.entries()].filter(([, p]) => p.length > 1).map(([slug, paths]) => ({ slug, paths }));
}

// ------------------------------------------------------------------ status

/** Whether a status property value equals the published value (trimmed, case-insensitive, like the site). */
export function isPublished(status: unknown, publishedValue: string): boolean {
  if (typeof status !== "string" && typeof status !== "number") return false;
  const want = publishedValue.trim().toLowerCase();
  return want !== "" && String(status).trim().toLowerCase() === want;
}

/** A frontmatter value that counts as filled in: not missing, null, blank or an empty list. */
export function isFilled(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some(isFilled);
  return true;
}

function propertyValue(fm: Record<string, unknown>, name: string): unknown {
  if (name in fm) return fm[name];
  const lower = name.toLowerCase();
  const key = Object.keys(fm).find((k) => k.toLowerCase() === lower);
  return key === undefined ? undefined : fm[key];
}

// ------------------------------------------------------------------ all checks

/** Every check that applies to the note, in the roadmap's order. */
export function runChecks(
  text: string,
  frontmatter: Record<string, unknown> | null | undefined,
  ctx: CheckContext,
): Check[] {
  const fm = frontmatter ?? {};
  const out: Check[] = [];
  const lines = text.split(/\r?\n/);
  const start = bodyStartLine(lines);
  const fenced = fencedLines(lines, start);

  const open = unclosedComment(text);
  out.push(open === null
    ? { id: "unclosedComment", level: "passed", items: [], vars: {} }
    : { id: "unclosedComment", level: "blocker", line: open, items: [], vars: { line: open + 1 } });

  const lineStarts = [0];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) lineStarts.push(i + 1);
  const inInlineCode = (line: number, from: number) =>
    blankInlineCode(lines[line] ?? "").slice(from - lineStarts[line], from - lineStarts[line] + 2) !== "%%";
  const placeholders = parsePlaceholders(text, ctx.placeholderMarker)
    .filter((p) => p.line >= start && !fenced[p.line] && !inInlineCode(p.line, p.from));
  out.push({
    id: "placeholders",
    level: placeholders.length ? "blocker" : "passed",
    line: placeholders[0]?.line,
    items: placeholders.map((p) => ({ text: p.text, line: p.line })),
    vars: { n: placeholders.length },
  });

  const beats = parseBeats(text).filter((b) => !b.written && !fenced[b.line]);
  out.push({
    id: "unwrittenBeats",
    level: beats.length ? "warning" : "passed",
    line: beats[0]?.line,
    items: beats.map((b) => ({ text: b.text, line: b.line })),
    vars: { n: beats.length },
  });

  const words = countWords(text);
  out.push({ id: "emptyBody", level: words === 0 ? "blocker" : "passed", items: [], vars: { n: words } });

  if (ctx.recommendedProperties.length) {
    const missing = ctx.recommendedProperties.filter((p) => !isFilled(propertyValue(fm, p)));
    out.push({
      id: "recommended",
      level: missing.length ? "warning" : "passed",
      items: [],
      vars: { names: missing.join(", "), n: missing.length },
    });
  }

  const piece = ctx.piece ? readPiece(fm, ctx.piece) : null;
  if (piece?.limit !== undefined) {
    const count = pieceCount(text, piece.unit);
    const p = pieceProgress({ count, limit: piece.limit });
    out.push({
      id: "overLimit",
      level: p.state === "over" ? "warning" : "passed",
      items: [],
      vars: { count, limit: piece.limit, over: p.over, unit: piece.unit },
    });
  }

  if (ctx.url !== undefined && ctx.others) {
    const self: SlugEntry = { path: ctx.path, slug: ctx.url };
    const taken = duplicateSlugs([self, ...ctx.others.filter((o) => o.path !== ctx.path)])
      .find((d) => d.slug === ctx.url);
    const paths = taken ? taken.paths.filter((p) => p !== ctx.path) : [];
    out.push({
      id: "urlTaken",
      level: paths.length ? "blocker" : "passed",
      items: paths.map((p) => ({ text: p, path: p })),
      vars: { url: ctx.url, n: paths.length },
    });
  }

  if (ctx.url !== undefined && ctx.previousUrl !== undefined && ctx.previousUrl !== "") {
    out.push({
      id: "urlChanged",
      level: ctx.previousUrl === ctx.url ? "passed" : "warning",
      items: [],
      vars: { from: ctx.previousUrl, to: ctx.url },
    });
  }

  return out;
}

export function hasBlockers(checks: readonly Check[]): boolean {
  return checks.some((c) => c.level === "blocker");
}

/** Blockers first, then warnings, then passed checks; stable otherwise. */
export function sortChecks(checks: readonly Check[]): Check[] {
  return checks
    .map((c, i) => ({ c, i }))
    .sort((a, b) => BLOCKER_FIRST[a.c.level] - BLOCKER_FIRST[b.c.level] || a.i - b.i)
    .map((x) => x.c);
}
