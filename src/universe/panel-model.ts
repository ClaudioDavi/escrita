// The panel's pure logic (no Obsidian imports): highlighting a search, grouping
// threads by work, the counts the header and footer show, the first-seen date.

import { linkTarget } from "../core/markers";
import { segment } from "../core/markdown";
import type { ThreadRef } from "./threads";
import { foldName } from "../core/names";

export interface Segment {
  text: string;
  hit: boolean;
}

/**
 * Splits `text` into plain and matching parts for a search `query`, ignoring case and
 * accents ("mae" marks "Mã" in "Mãe"). The parts always join back into `text`.
 */
export function splitHighlight(text: string, query: string): Segment[] {
  const q = foldName(query.trim());
  if (q === "" || text === "") return [{ text, hit: false }];
  let folded = "";
  const from: number[] = []; // folded index → start of the original character
  const to: number[] = []; // folded index → end of the original character
  let i = 0;
  for (const ch of text) {
    const f = foldName(`x${ch}x`).slice(1, -1); // padded: foldName trims, and a space must stay a space
    for (let k = 0; k < f.length; k++) { from.push(i); to.push(i + ch.length); }
    folded += f;
    i += ch.length;
  }
  const out: Segment[] = [];
  let last = 0;
  let at = folded.indexOf(q);
  while (at !== -1) {
    const a = from[at];
    const b = to[at + q.length - 1];
    if (a >= last) {
      if (a > last) out.push({ text: text.slice(last, a), hit: false });
      out.push({ text: text.slice(a, b), hit: true });
      last = b;
    }
    at = folded.indexOf(q, at + q.length);
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out.length > 0 ? out : [{ text, hit: false }];
}

export interface ThreadGroup {
  path: string;
  title: string;
  /** the threads to show, in text order */
  items: ThreadRef[];
  open: number;
  closed: number;
}

/** The work a thread belongs to: where its group is drawn, and what counts as one work. */
export type WorkOf = (ref: ThreadRef) => { path: string; title: string };

/** Each note is its own work (used when nothing knows about books). */
const ownWork: WorkOf = (r) => ({ path: r.path, title: r.title });

/** Threads grouped by work (a book's chapters share their book's group; the callers' `workOf` says which), items in path order (the index sorts by path then position, so chapters stay in order). Closed ones are listed only with `showClosed`; a group with nothing to show is dropped. */
export function groupThreads(refs: ThreadRef[], showClosed: boolean, workOf: WorkOf = ownWork): ThreadGroup[] {
  const by = new Map<string, ThreadGroup>();
  for (const r of refs) {
    const w = workOf(r);
    let g = by.get(w.path);
    if (!g) {
      g = { path: w.path, title: w.title, items: [], open: 0, closed: 0 };
      by.set(w.path, g);
    }
    if (r.thread.closed) g.closed++; else g.open++;
    if (showClosed || !r.thread.closed) g.items.push(r);
  }
  return [...by.values()].filter((g) => g.items.length > 0);
}

export interface ThreadCounts {
  open: number;
  closed: number;
  /** works with at least one open thread */
  works: number;
}

export function countThreads(refs: ThreadRef[], workOf: WorkOf = ownWork): ThreadCounts {
  const works = new Set<string>();
  let open = 0;
  let closed = 0;
  for (const r of refs) {
    if (r.thread.closed) closed++;
    else { open++; works.add(workOf(r).path); }
  }
  return { open, closed, works: works.size };
}

/** "14 Sep" style: day and month, with the year only when it isn't the current one. Null for no date. */
export function seenDate(ms: number | null, now: number, locale: string): string | null {
  if (ms === null || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  try {
    const parts = new Intl.DateTimeFormat(locale, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }).formatToParts(d);
    // day, month and year only: no "de" and no trailing period ("14 set", "14 Sep")
    const pick = (type: string) => parts.find((x) => x.type === type)?.value.replace(/\.$/, "").trim();
    return [pick("day"), pick("month"), sameYear ? undefined : pick("year")].filter((x): x is string => !!x).join(" ");
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Adds or removes a value from a list (a copy), for the remembered collapsed groups. */
export function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/** The remembered view state, from whatever the workspace saved. */
export interface PanelState {
  tab: "entries" | "threads" | "works";
  collapsed: string[];
  showClosed: boolean;
}

export function readPanelState(raw: unknown): PanelState {
  const r = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const tab = r.tab === "threads" || r.tab === "works" ? r.tab : "entries";
  const collapsed = Array.isArray(r.collapsed) ? r.collapsed.filter((x): x is string => typeof x === "string") : [];
  return { tab, collapsed, showClosed: r.showClosed === true };
}

/** What the close form's hint shows: the marker the thread will become. */
export function closedPreview(keyword: string, closedWord: string, answer: string): string {
  const target = linkTarget(answer.replace(/[[\]\r\n]/g, "").replace(/%%/g, "%"));
  const link = target === "" ? "" : ` → [[${target}]]`;
  return `%% ${keyword} ${closedWord}: …${link} %%`;
}

/** The manually picked universe holds only while the active note stays in the universe it was picked from. */
export function pickStillValid(pick: { note: string; at: string | null } | null, activeNote: string | null): boolean {
  return pick !== null && pick.at === activeNote;
}

/**
 * Where an inserted link may go for a cursor at `offset`: the cursor itself in prose; the
 * start of the body when the cursor is in the properties (a link there would break the
 * property); null inside code or a comment, where a link would do nothing.
 */
export function linkInsertPoint(text: string, offset: number): number | null {
  const md = segment(text);
  const at = Math.max(0, Math.min(offset, text.length));
  for (const span of md.spans(Math.max(0, at - 1), at + 1)) {
    if (span.kind === "prose" || !(span.from < at && at < span.to)) continue;
    if (span.kind === "frontmatter") return md.bodyLine < md.lineCount ? md.lineStart(md.bodyLine) : text.length;
    return null;
  }
  return at;
}
