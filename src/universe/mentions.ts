// "Appears in": where an entry is mentioned (0.7 plan Q30-Q34, U 1.2). Pure: no
// Obsidian or CodeMirror imports.

import type { Markdown } from "../core/markdown";
import { pickEntry, type Occurrence } from "../core/names";
import { readerMask } from "../core/wordcount";

export interface NoteMentions {
  occurrences: readonly Occurrence[];
  links: readonly { from: number; to: number; linkpath: string }[];   // prose wikilinks and Markdown links (Q30)
}

/** `find` is injected so the model is tested without the matcher. */
export function computeMentions(md: Markdown, find: (mask: string) => Occurrence[]): NoteMentions {
  const links = proseLinks(md.masked());
  const occurrences = find(readerMask(md)).filter(
    (o) => !links.some((l) => o.from < l.to && o.to > l.from),   // the link already counts (Q30)
  );
  return { occurrences, links };
}

const WIKILINK = /(!?)\[\[([^\]]*)\]\]/g;
const MDLINK = /(!?)\[([^\]]*)\]\(([^)\n]*)\)/g;

/** Wikilinks and Markdown links in a masked text (code, comments, frontmatter blanked); embeds skipped. */
function proseLinks(masked: string): { from: number; to: number; linkpath: string }[] {
  const out: { from: number; to: number; linkpath: string }[] = [];
  for (const m of masked.matchAll(WIKILINK)) {
    if (m[1]) continue;
    const target = m[2].split("|")[0].split("#")[0].trim();
    if (target) out.push({ from: m.index, to: m.index + m[0].length, linkpath: target });
  }
  for (const m of masked.matchAll(MDLINK)) {
    if (m[1]) continue;
    const target = mdTarget(m[3]);
    if (target) out.push({ from: m.index, to: m.index + m[0].length, linkpath: target });
  }
  return out.sort((a, b) => a.from - b.from);
}

/** `<Teo%20Silva.md#h>` or `Teo\_x.md` to a link path; external URLs and bare anchors give "". */
function mdTarget(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("<")) t = t.slice(1, t.indexOf(">") < 0 ? undefined : t.indexOf(">"));
  else t = t.replace(/\s+".*$/, "");
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return "";
  t = t.split("#")[0].replace(/\\([\\`*_{}[\]()#+\-.!<>])/g, "$1");
  try {
    t = decodeURIComponent(t);
  } catch {
    // keep the raw text
  }
  return t.trim();
}

export interface MentionCtx {
  entry: string;                                                  // the entry path
  inScope(notePath: string): boolean;                             // live scope (Q20, Q31)
  candidateInScope(notePath: string, id: string): boolean;
  resolve(linkpath: string, from: string): string | null;
  /** `chapter` is the chapter's 1-based position in its book (Chapter.index), not its number; null: not a chapter. */
  workOf(notePath: string): { work: string; chapter: number | null } | null;   // null: other notes
  /** Position of a work in the Works tab's order (groupWorks then compareWorks, works-list.ts:71-84); 5.1 builds it from plugin.works. */
  workRank(work: string): number;
}

export interface MentionRow { path: string; count: number; first: { from: number; to: number } }

/** `firstChapter`/`lastChapter` are chapter paths (the view labels them), set only inside a book (Q32). */
export interface WorkMentions { work: string; count: number; notes: MentionRow[]; firstChapter?: string; lastChapter?: string }

export interface AppearsIn { works: WorkMentions[]; other: MentionRow[]; total: number; workCount: number }

export function appearsIn(all: Iterable<[string, NoteMentions]>, ctx: MentionCtx): AppearsIn {
  const byWork = new Map<string, { row: MentionRow; chapter: number | null; path: string }[]>();
  const other: MentionRow[] = [];
  let total = 0;
  for (const [path, nm] of all) {
    if (path === ctx.entry || !ctx.inScope(path)) continue;
    let count = 0;
    let first: { from: number; to: number } | null = null;
    const hit = (from: number, to: number): void => {
      count++;
      if (!first || from < first.from) first = { from, to };
    };
    for (const o of nm.occurrences) {
      if (pickEntry(o, (id) => ctx.candidateInScope(path, id)) === ctx.entry) hit(o.from, o.to);
    }
    for (const l of nm.links) {
      if (ctx.resolve(l.linkpath, path) === ctx.entry) hit(l.from, l.to);
    }
    if (count === 0 || !first) continue;
    total += count;
    const row: MentionRow = { path, count, first };
    const w = ctx.workOf(path);
    if (!w) {
      other.push(row);
      continue;
    }
    const list = byWork.get(w.work) ?? [];
    list.push({ row, chapter: w.chapter, path });
    byWork.set(w.work, list);
  }
  const works: WorkMentions[] = [];
  for (const [work, list] of byWork) {
    // not a chapter first (the book note), then by position in the book
    list.sort((a, b) => (a.chapter ?? 0) - (b.chapter ?? 0) || a.path.localeCompare(b.path));
    const chapters = list.filter((x) => x.chapter !== null);
    const w: WorkMentions = {
      work,
      count: list.reduce((n, x) => n + x.row.count, 0),
      notes: list.map((x) => x.row),
    };
    if (chapters.length) {
      w.firstChapter = chapters[0].path;
      w.lastChapter = chapters[chapters.length - 1].path;
    }
    works.push(w);
  }
  works.sort((a, b) => ctx.workRank(a.work) - ctx.workRank(b.work) || a.work.localeCompare(b.work));
  other.sort((a, b) => a.path.localeCompare(b.path));
  return { works, other, total, workCount: works.length };
}

export function mentionsSame(a: NoteMentions, b: NoteMentions): boolean {
  if (a.occurrences.length !== b.occurrences.length || a.links.length !== b.links.length) return false;
  for (let i = 0; i < a.occurrences.length; i++) {
    const x = a.occurrences[i];
    const y = b.occurrences[i];
    if (x.from !== y.from || x.to !== y.to || x.candidates.length !== y.candidates.length) return false;
    for (let k = 0; k < x.candidates.length; k++) {
      const c = x.candidates[k];
      const d = y.candidates[k];
      if (c.id !== d.id || c.exact !== d.exact || c.origin !== d.origin) return false;
    }
  }
  return a.links.every((l, i) => {
    const m = b.links[i];
    return l.from === m.from && l.to === m.to && l.linkpath === m.linkpath;
  });
}
