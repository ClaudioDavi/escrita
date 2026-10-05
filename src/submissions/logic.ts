// Pure half of the submissions module (SF 12, PLAN-0.8 task 3.2): frontmatter to a
// submission, the pending test, recent markets, the file name and the note text.
// No Obsidian imports, so it is tested on plain values.

import { lineList } from "../core/lists";
import { isoDay } from "../core/dates";
import { yamlKey } from "../core/template";
import type { PendingSubmission } from "../core/pending";

/** The property names of a submission note (SF 12): settings with these English defaults (rule 6). */
export interface SubmissionProps {
  work: string;
  market: string;
  sent: string;
  result: string;
  responded: string;
}

export const DEFAULT_PROPS: SubmissionProps = { work: "work", market: "market", sent: "sent", result: "result", responded: "responded" };

/** The names from the settings; a blank or missing one falls back to its default. */
export function propsOf(s?: object | null): SubmissionProps {
  const pick = (key: string, dflt: string) => {
    const v = (s as Record<string, unknown> | null | undefined)?.[key];
    return typeof v === "string" && v.trim() ? v.trim() : dflt;
  };
  return {
    work: pick("submissionWorkProperty", DEFAULT_PROPS.work),
    market: pick("submissionMarketProperty", DEFAULT_PROPS.market),
    sent: pick("submissionSentProperty", DEFAULT_PROPS.sent),
    result: pick("submissionResultProperty", DEFAULT_PROPS.result),
    responded: pick("submissionRespondedProperty", DEFAULT_PROPS.responded),
  };
}

/** Part of an index key: a rename of any property rebuilds the index. */
export function propsKey(p: SubmissionProps): string {
  return JSON.stringify([p.work, p.market, p.sent, p.result, p.responded]);
}

/** What the index keeps for one submission note: the frontmatter, read once. */
export interface SubmissionRow {
  /** the `work` property as written ("[[Cartas de Lisboa]]"); "" when missing */
  work: string;
  market: string;
  /** YYYY-MM-DD; null when missing or unreadable */
  sent: string | null;
  /** the `result` value, trimmed; "" when missing */
  result: string;
}

export function sameRow(a: SubmissionRow, b: SubmissionRow): boolean {
  return a.work === b.work && a.market === b.market && a.sent === b.sent && a.result === b.result;
}

/** The result values from the setting, in order: the first is "pending". Never empty. */
export function resultValues(setting: unknown): string[] {
  const list = lineList(typeof setting === "string" ? setting : "");
  return list.length > 0 ? list : ["pending"];
}

export function pendingValue(setting: unknown): string {
  return resultValues(setting)[0];
}

/**
 * A link property. Unquoted `work: [[X|Y]]` is parsed by YAML as a list inside a list
 * ([["X|Y"]]); rebuild the brackets so it reads as the wikilink it was typed as.
 */
export function linkText(v: unknown): string {
  if (Array.isArray(v) && v.length === 1 && Array.isArray(v[0]) && v[0].length === 1 && typeof v[0][0] === "string") {
    return `[[${v[0][0].trim()}]]`;
  }
  return text(v);
}

function text(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.length > 0 ? text(v[0]) : "";
  return "";
}

/** A YAML date can reach us as "2026-10-05", "2026-10-05T00:00:00" or a Date. */
export function dayOf(v: unknown): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : isoDay(v);
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(v.trim());
  if (!m) return null;
  return realDay(Number(m[1]), Number(m[2]), Number(m[3])) ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** A real calendar day (no 31 February). */
function realDay(y: number, mo: number, d: number): boolean {
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** Frontmatter to a row. Never throws; anything unreadable becomes ""/null. */
export function rowOf(fm: Record<string, unknown> | null | undefined, props: SubmissionProps = DEFAULT_PROPS): SubmissionRow {
  const f = fm ?? {};
  return {
    work: linkText(f[props.work]),
    market: text(f[props.market]),
    sent: dayOf(f[props.sent]),
    result: text(f[props.result]),
  };
}

/** Case-insensitive, so "pending" and "Pending" are the same result. */
export function isPending(row: SubmissionRow, pending: string): boolean {
  return row.result !== "" && row.result.toLowerCase() === pending.trim().toLowerCase();
}

/** "[[Target#h|alias]]" → { target, label }; null when the text is not a wikilink. */
export function parseWorkLink(value: string): { target: string; label: string } | null {
  const m = /^\s*"?\[\[([^\]]+)\]\]"?\s*$/.exec(value);
  if (!m) return null;
  const [rawTarget, alias] = m[1].split("|");
  const target = rawTarget.split("#")[0].split("^")[0].trim();
  if (!target) return null;
  const base = target.slice(target.lastIndexOf("/") + 1);
  return { target, label: (alias ?? base).trim() };
}

/** The pending list, newest `sent` first (no date last, then by path). `resolve` maps a link target to a path. */
export function pendingList(
  rows: Iterable<[string, SubmissionRow]>,
  pending: string,
  resolve: (target: string, from: string) => string | null,
): PendingSubmission[] {
  const out: PendingSubmission[] = [];
  for (const [path, row] of rows) {
    if (!isPending(row, pending)) continue;
    const link = parseWorkLink(row.work);
    const workPath = link ? resolve(link.target, path) : null;
    const base = workPath ? workPath.slice(workPath.lastIndexOf("/") + 1).replace(/\.md$/i, "") : null;
    out.push({
      path,
      workPath,
      workTitle: base ?? link?.label ?? row.work,
      market: row.market,
      sent: row.sent,
    });
  }
  return out.sort((a, b) => {
    if (a.sent !== b.sent) {
      if (a.sent === null) return 1;
      if (b.sent === null) return -1;
      return a.sent < b.sent ? 1 : -1;
    }
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
}

/** Up to `limit` distinct markets, the most recently sent first (case-insensitive, trimmed, empties skipped). */
export function recentMarkets(rows: Iterable<SubmissionRow>, limit = 3): string[] {
  const sorted = [...rows]
    .filter((r) => r.market !== "")
    .sort((a, b) => (a.sent === b.sent ? 0 : a.sent === null ? 1 : b.sent === null ? -1 : a.sent < b.sent ? 1 : -1));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of sorted) {
    const key = r.market.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r.market);
    if (out.length >= limit) break;
  }
  return out;
}

/** Whether a property name is already used by another of the five (they would collide in the note's frontmatter). */
export function duplicateProp(props: SubmissionProps, key: keyof SubmissionProps, value: string): boolean {
  return (Object.keys(props) as (keyof SubmissionProps)[]).some((k) => k !== key && props[k] === value);
}

/** One line, no characters a file name or link can't hold. */
export function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim();
}

/** "2026-10-05 Cartas de Lisboa – Revista Pessoa.md" (just the name). */
const ENCODER = new TextEncoder();
/** Leaves room for ".md" and the " 1" suffix of a unique name inside 255 bytes. */
const NAME_BYTES = 240;

export function submissionFileName(sent: string, work: string, market: string): string {
  const w = safeName(work) || "Work";
  const m = safeName(market);
  const full = (m ? `${sent} ${w} – ${m}` : `${sent} ${w}`).slice(0, 180);
  // Cut by UTF-8 bytes per code point: file systems cap a name at 255 bytes, and a
  // slice by UTF-16 units could split a surrogate pair.
  let out = "";
  let bytes = 0;
  for (const ch of full) {
    const b = ENCODER.encode(ch).length;
    if (bytes + b > NAME_BYTES) break;
    out += ch;
    bytes += b;
  }
  const base = out.replace(/\s*–?\s*$/, "");
  return `${base}.md`;
}

/** "Submissions/2026-10-05 … .md": folder and name joined (the caller normalizes the path). */
export function submissionPath(folder: string, sent: string, work: string, market: string): string {
  const f = folder.replace(/^\/+|\/+$/g, "");
  const name = submissionFileName(sent, work, market);
  return f ? `${f}/${name}` : name;
}

const YAML_RESERVED = /^(true|false|yes|no|on|off|null|y|n|~)$/i;

/** A YAML scalar: plain when that is safe and reads back the same, else double-quoted. */
export function yamlValue(v: string): string {
  if (/^[A-Za-z\u00C0-\u024F][\w\u00C0-\u024F-]*$/.test(v) && !YAML_RESERVED.test(v)) return v;
  return quoted(v);
}

export function quoted(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;
}

/** The `work` and `result` lines as written into the note (and shown in the modal). */
export function workLine(props: SubmissionProps, link: string): string {
  return `${yamlKey(props.work)}: ${quoted(link)}`;
}
export function resultLine(props: SubmissionProps, result: string): string {
  return `${yamlKey(props.result)}: ${yamlValue(result)}`;
}

export interface NewSubmission {
  /** the link as written into `work`: "[[Cartas de Lisboa]]" */
  link: string;
  market: string;
  /** YYYY-MM-DD */
  sent: string;
  /** the first value of the results list */
  result: string;
}

/** The text of a new submission note: frontmatter only, an empty body (the writer's space). */
export function submissionText(s: NewSubmission, props: SubmissionProps = DEFAULT_PROPS): string {
  return [
    "---",
    workLine(props, s.link),
    `${yamlKey(props.market)}: ${quoted(s.market)}`,
    `${yamlKey(props.sent)}: ${s.sent}`,
    resultLine(props, s.result),
    `${yamlKey(props.responded)}:`,
    "---",
    "",
  ].join("\n");
}

export type WorkChoice =
  | { kind: "work"; path: string; title: string; stage: string | null }
  | { kind: "none" }
  | { kind: "no-stage"; title: string }
  | { kind: "untracked"; title: string };

/** The part of a classify() result this module reads. */
export interface PlacementLike {
  path: string;
  kind: string;
  markdown: boolean;
  tracked: boolean;
  submission: boolean;
  export: boolean;
  snapshot: boolean;
  stage: string | null;
  book: { note: { path: string }; title: string } | null;
}

/**
 * Which work a note stands for: a chapter or a book note → its book; a tracked
 * standalone note with a stage → itself; a standalone note without a stage →
 * "no-stage" (board 28 d); a standalone note with a stage outside the tracked folders → "untracked"; anything else (no note, a submission, a snapshot) → "none".
 */
export function workFor(p: PlacementLike, title: string): WorkChoice {
  if (!p.markdown || p.submission || p.export || p.snapshot) return { kind: "none" };
  if ((p.kind === "chapter" || p.kind === "book-note") && p.book) {
    return { kind: "work", path: p.book.note.path, title: p.book.title, stage: p.kind === "book-note" ? p.stage : null };
  }
  if (p.kind === "note" && !p.book) {
    if (p.stage && !p.tracked) return { kind: "untracked", title };
    return p.tracked && p.stage ? { kind: "work", path: p.path, title, stage: p.stage } : { kind: "no-stage", title };
  }
  return { kind: "none" };
}

/** A date as typed in the form: YYYY-MM-DD and a real day. */
export function validDay(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  return realDay(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** The market as stored: one line, trimmed. */
export function cleanMarket(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

/** Whether the form can be recorded. */
export function canRecord(market: string, sent: string): boolean {
  return cleanMarket(market) !== "" && validDay(sent);
}

/** Splits "Creates {path} with {work}, {result}." into text and filled tokens, for the "Creates…" line. */
export function whereParts(template: string, vars: { path: string; work: string; result: string }): { text: string; code: boolean }[] {
  const parts: { text: string; code: boolean }[] = [];
  for (const piece of template.split(/(\{path\}|\{work\}|\{result\})/)) {
    if (piece === "") continue;
    const m = /^\{(path|work|result)\}$/.exec(piece);
    parts.push(m ? { text: vars[m[1] as "path" | "work" | "result"], code: true } : { text: piece, code: false });
  }
  return parts;
}
