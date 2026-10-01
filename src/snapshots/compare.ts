// Compare a snapshot with another text (no Obsidian imports). Wraps jsdiff:
// `diffArrays` aligns paragraphs, then runs again on word tokens inside each
// changed passage. Tokens come from core's WORD rule, not jsdiff's own word
// class, so NFD accents ("ninguém") and "d’água" stay one word, and the words
// counted here are the words Escrita counts everywhere else.
//
// Every non-equal block carries an anchored revert: a change against the FULL
// current text that makes that block equal to the old one again, with the text
// it expects and some context, so "Use the old version" is check-then-replace.
// Contexts are clipped at the neighbouring reverts, so applying every revert
// from the last to the first (each through checkedChange) rebuilds the old
// text, frontmatter included.
//
// What counts as the same paragraph: the text with CRLF read as LF and trailing
// spaces ignored. Such differences, and the number of blank lines between
// paragraphs, are not shown and not reverted ("Restore" replaces everything).

import { diffArrays, diffLines } from "diff";
import { segment } from "../core/markdown";
import { anchor, matchLineEndings, type AnchoredChange, type Change } from "../core/note-text";
import { countSelection, wordRegex } from "../core/wordcount";

/** One paragraph of a note's body: [from, to) offsets in the FULL note text, `text` exactly that slice. */
export interface Para { from: number; to: number; text: string }

export interface Part {
  kind: "equal" | "added" | "removed";
  text: string;
  /** offset of this text in the old note (equal and removed parts) */
  oldFrom?: number;
  /** offset of this text in the current note (equal and added parts) */
  curFrom?: number;
}

export type BlockKind = "equal" | "changed" | "inserted" | "deleted" | "moved-in" | "moved-out";

export interface Span { from: number; to: number; text: string }

export interface Block {
  kind: BlockKind;
  /** in the old text; null for inserted and moved-in */
  old: Span | null;
  /** in the current text; null for deleted and moved-out (their place is `at`) */
  cur: Span | null;
  /** offset in the current text where the block sits (deleted: where it would go back) */
  at: number;
  /** changed blocks only: the word-level diff */
  parts: Part[];
  /** how many paragraphs the block spans on each side */
  paragraphs: { old: number; cur: number };
  /** null for equal; applied to the current text, makes this block equal to the old one */
  revert: AnchoredChange | null;
  /** moved-in and moved-out blocks of one move share it */
  movedId?: number;
}

export interface Compare {
  /** null when the frontmatter (with its line break) is the same */
  frontmatter: { old: string; cur: string; lines: Part[]; revert: AnchoredChange } | null;
  /** in current-text order; deleted and moved-out blocks sit at their `at` */
  blocks: Block[];
  summary: { added: number; removed: number; changedParagraphs: number; totalParagraphs: number; percent: number };
  /** some alignment gave up (timeout): changes shown as whole passages */
  degraded: boolean;
}

export interface CompareOptions {
  /** per jsdiff call; default 250. 0 or less skips alignment: whole-passage blocks, degraded. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 250;
/** Paragraphs per group in a split or a merge. */
const MAX_GROUP = 4;
/** Below this similarity two passages are a deletion and an insertion, not a change. */
const MIN_SIM = 0.35;
/** Largest removed × added run aligned by dynamic programming; bigger runs are aligned greedily. */
const PAIR_LIMIT = 2_500;
/** Context kept around a revert, clipped at the neighbouring reverts. */
const CONTEXT = 40;

// ── Tokens and paragraphs ───────────────────────────────────────────────────

function isWordToken(t: string): boolean {
  return /^[\p{L}\p{N}]/u.test(t);
}

function isSpace(t: string): boolean {
  return /^\s+$/u.test(t);
}

/** Words (core's rule), whitespace runs, and single code points for the rest; joined back they are `text`. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`${wordRegex().source}|\\s+`, "gu");
  let last = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const at = m.index;
    if (at > last) out.push(...Array.from(text.slice(last, at)));
    out.push(m[0]);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(...Array.from(text.slice(last)));
  return out;
}

/** Paragraphs of the body starting at `bodyFrom`: runs of non-blank lines, separated by one or more blank lines. */
export function paragraphs(text: string, bodyFrom: number): Para[] {
  const out: Para[] = [];
  let start = -1;
  let end = -1;
  let i = bodyFrom;
  for (;;) {
    const nl = text.indexOf("\n", i);
    const lineEnd = nl === -1 ? text.length : nl;
    const contentEnd = lineEnd > i && text.charCodeAt(lineEnd - 1) === 13 ? lineEnd - 1 : lineEnd;
    if (/^[ \t]*$/.test(text.slice(i, contentEnd))) {
      if (start >= 0) out.push({ from: start, to: end, text: text.slice(start, end) });
      start = -1;
    } else {
      if (start < 0) start = i;
      end = contentEnd;
    }
    if (nl === -1) break;
    i = nl + 1;
  }
  if (start >= 0) out.push({ from: start, to: end, text: text.slice(start, end) });
  return out;
}

/** Where the body starts: after a closed frontmatter and the line break that follows it; else 0. */
export function bodyStart(text: string): number {
  const first = segment(text).spans()[0];
  if (!first || first.kind !== "frontmatter") return 0;
  let end = first.to;
  if (text.startsWith("\r\n", end)) end += 2;
  else if (text.charCodeAt(end) === 10) end += 1;
  return end;
}

function norm(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");
}

// ── Pairing removed and added paragraphs ────────────────────────────────────

type Bag = Map<string, number>;

function bagOf(text: string): Bag {
  const bag: Bag = new Map();
  const re = wordRegex();
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const w = m[0].toLowerCase();
    bag.set(w, (bag.get(w) ?? 0) + 1);
  }
  return bag;
}

function mergeBags(bags: Bag[]): Bag {
  if (bags.length === 1) return bags[0];
  const out: Bag = new Map();
  for (const b of bags) for (const [w, n] of b) out.set(w, (out.get(w) ?? 0) + n);
  return out;
}

function size(b: Bag): number {
  let n = 0;
  for (const v of b.values()) n += v;
  return n;
}

/** Dice coefficient over the multisets of lowercased words. Two wordless passages (scene breaks) count as similar enough. */
function similarity(a: Bag, b: Bag): number {
  const na = size(a), nb = size(b);
  if (na === 0 && nb === 0) return 0.5;
  if (na === 0 || nb === 0) return 0;
  let common = 0;
  for (const [w, n] of a) common += Math.min(n, b.get(w) ?? 0);
  return (2 * common) / (na + nb);
}

/** A non-equal stretch: paragraphs removed, added, or both (a change). `whole`: a replacement shown as whole passages. */
interface Group { old: Para[]; cur: Para[]; whole?: boolean }

/**
 * Pairs a run of removed paragraphs with a run of added ones: a monotone
 * alignment with 1:1, 1:k and k:1 groups (k ≤ 4) that maximizes the summed
 * similarity. Unpaired paragraphs stay alone, except that unpaired deletions
 * and insertions at the same place form one replacement (shown whole): a
 * deletion's revert then always sits next to a paragraph that stays, so the
 * reverts never overlap or depend on each other.
 */
function pairRun(R: Para[], A: Para[]): Group[] {
  if (R.length === 0) return A.map((p) => ({ old: [], cur: [p] }));
  if (A.length === 0) return R.map((p) => ({ old: [p], cur: [] }));
  const rb = R.map((p) => bagOf(p.text));
  const ab = A.map((p) => bagOf(p.text));
  const steps = R.length * A.length > PAIR_LIMIT ? greedyPath(rb, ab) : bestPath(rb, ab);
  const out: Group[] = [];
  let dels: Para[] = [];
  let ins: Para[] = [];
  const flush = () => {
    if (dels.length && ins.length) out.push({ old: dels, cur: ins, whole: true });
    else {
      for (const p of dels) out.push({ old: [p], cur: [] });
      for (const p of ins) out.push({ old: [], cur: [p] });
    }
    dels = [];
    ins = [];
  };
  let i = 0, j = 0;
  for (const [p, q] of steps) {
    if (p > 0 && q > 0) {
      flush();
      out.push({ old: R.slice(i, i + p), cur: A.slice(j, j + q) });
    } else if (p > 0) {
      dels.push(R[i]);
    } else {
      ins.push(A[j]);
    }
    i += p;
    j += q;
  }
  flush();
  return out;
}

/** Steps of the alignment: [p, q] = p removed paragraphs paired with q added ones; [1, 0] alone removed; [0, 1] alone added. */
type Step = [number, number];

/** The alignment with the best summed similarity (dynamic programming over removed × added). */
function bestPath(rb: Bag[], ab: Bag[]): Step[] {
  const n = rb.length, m = ab.length;
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const move: Step[][] = Array.from({ length: n + 1 }, () => new Array<Step>(m + 1).fill([0, 0]));
  for (let i = n; i >= 0; i--) {
    for (let j = m; j >= 0; j--) {
      let best = -1;
      let step: Step = [0, 0];
      const consider = (p: number, q: number, s: number) => {
        if (s > best) { best = s; step = [p, q]; }
      };
      // groups first, so an equal score prefers pairing
      for (let p = 1; p <= MAX_GROUP && i + p <= n; p++) {
        for (let q = 1; q <= MAX_GROUP && j + q <= m; q++) {
          if (p > 1 && q > 1) continue;
          const s = similarity(mergeBags(rb.slice(i, i + p)), mergeBags(ab.slice(j, j + q)));
          if (s >= MIN_SIM) consider(p, q, s + score[i + p][j + q]);
        }
      }
      if (i < n) consider(1, 0, score[i + 1][j]);
      if (j < m) consider(0, 1, score[i][j + 1]);
      score[i][j] = best < 0 ? 0 : best;
      move[i][j] = step;
    }
  }
  const steps: Step[] = [];
  for (let i = 0, j = 0; i < n || j < m;) {
    const st = move[i][j];
    steps.push(st);
    i += st[0];
    j += st[1];
  }
  return steps;
}

/** A linear alignment for long runs (a whole chapter reworked): pair 1:1 while similar, skip one side when the next one matches. */
function greedyPath(rb: Bag[], ab: Bag[]): Step[] {
  const n = rb.length, m = ab.length;
  const steps: Step[] = [];
  const sim = (i: number, j: number) => (i < n && j < m ? similarity(rb[i], ab[j]) : 0);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (sim(i, j) >= MIN_SIM) steps.push([1, 1]);
    else if (sim(i, j + 1) >= MIN_SIM) { steps.push([0, 1]); j++; continue; }
    else if (sim(i + 1, j) >= MIN_SIM) { steps.push([1, 0]); i++; continue; }
    else { steps.push([1, 0], [0, 1]); }
    i++;
    j++;
  }
  for (; i < n; i++) steps.push([1, 0]);
  for (; j < m; j++) steps.push([0, 1]);
  return steps;
}

// ── Word-level diff ─────────────────────────────────────────────────────────

interface Seg { eq: boolean; old: string[]; cur: string[] }

/** An equal run this small between two changes reads better as part of one change. */
function absorbable(tokens: string[]): boolean {
  let marks = 0;
  for (const t of tokens) {
    if (isSpace(t)) continue;
    if (isWordToken(t) || Array.from(t).length > 1) return false;
    marks++;
  }
  return marks <= 2;
}

function wordDiff(old: Span, cur: Span, timeout: number): { parts: Part[]; degraded: boolean } {
  const whole = (): Part[] => {
    const parts: Part[] = [];
    if (old.text) parts.push({ kind: "removed", text: old.text, oldFrom: old.from });
    if (cur.text) parts.push({ kind: "added", text: cur.text, curFrom: cur.from });
    return parts;
  };
  if (timeout <= 0) return { parts: whole(), degraded: true };
  const ta = tokenize(old.text);
  const tb = tokenize(cur.text);
  const ops = diffArrays(ta, tb, { timeout });
  if (!ops) return { parts: whole(), degraded: true };

  const segs: Seg[] = [];
  let ia = 0, ib = 0;
  for (const op of ops) {
    if (!op.added && !op.removed) {
      segs.push({ eq: true, old: ta.slice(ia, ia + op.count), cur: tb.slice(ib, ib + op.count) });
      ia += op.count;
      ib += op.count;
      continue;
    }
    let last = segs[segs.length - 1];
    if (!last || last.eq) {
      last = { eq: false, old: [], cur: [] };
      segs.push(last);
    }
    if (op.removed) {
      last.old.push(...ta.slice(ia, ia + op.count));
      ia += op.count;
    } else {
      last.cur.push(...tb.slice(ib, ib + op.count));
      ib += op.count;
    }
  }

  const merged: Seg[] = [];
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    const prev = merged[merged.length - 1];
    const next = segs[k + 1];
    if (s.eq && prev && !prev.eq && next && !next.eq && absorbable(s.old)) {
      prev.old.push(...s.old, ...next.old);
      prev.cur.push(...s.cur, ...next.cur);
      k++;
      continue;
    }
    if (!s.eq && prev && !prev.eq) {
      prev.old.push(...s.old);
      prev.cur.push(...s.cur);
      continue;
    }
    merged.push({ eq: s.eq, old: [...s.old], cur: [...s.cur] });
  }

  const parts: Part[] = [];
  let oa = old.from, ob = cur.from;
  for (const s of merged) {
    const a = s.old.join(""), b = s.cur.join("");
    if (s.eq) {
      parts.push({ kind: "equal", text: a, oldFrom: oa, curFrom: ob });
    } else {
      if (a) parts.push({ kind: "removed", text: a, oldFrom: oa });
      if (b) parts.push({ kind: "added", text: b, curFrom: ob });
    }
    oa += a.length;
    ob += b.length;
  }
  return { parts, degraded: false };
}

// ── The comparison ──────────────────────────────────────────────────────────

function spanOf(text: string, ps: Para[]): Span | null {
  if (ps.length === 0) return null;
  const from = ps[0].from, to = ps[ps.length - 1].to;
  return { from, to, text: text.slice(from, to) };
}

/** Groups of paragraphs: equal pairs and non-equal stretches, in order. */
type Item = { eq: true; old: Para; cur: Para } | { eq: false; group: Group };

function align(oldP: Para[], curP: Para[], timeout: number): { items: Item[]; degraded: boolean } {
  const same = (a: Para, b: Para) => norm(a.text) === norm(b.text);
  const ops = timeout > 0 ? diffArrays(oldP, curP, { comparator: same, timeout }) : undefined;
  const items: Item[] = [];
  if (!ops) {
    // Whole-passage fallback: common paragraphs at both ends, one block between.
    let s = 0;
    while (s < oldP.length && s < curP.length && same(oldP[s], curP[s])) s++;
    let eo = oldP.length, ec = curP.length;
    while (eo > s && ec > s && same(oldP[eo - 1], curP[ec - 1])) { eo--; ec--; }
    for (let k = 0; k < s; k++) items.push({ eq: true, old: oldP[k], cur: curP[k] });
    if (eo > s || ec > s) items.push({ eq: false, group: { old: oldP.slice(s, eo), cur: curP.slice(s, ec) } });
    for (let k = 0; k < oldP.length - eo; k++) items.push({ eq: true, old: oldP[eo + k], cur: curP[ec + k] });
    return { items, degraded: true };
  }
  let io = 0, ic = 0;
  let R: Para[] = [], A: Para[] = [];
  const flush = () => {
    if (R.length || A.length) for (const group of pairRun(R, A)) items.push({ eq: false, group });
    R = [];
    A = [];
  };
  for (const op of ops) {
    if (op.removed) {
      R.push(...oldP.slice(io, io + op.count));
      io += op.count;
    } else if (op.added) {
      A.push(...curP.slice(ic, ic + op.count));
      ic += op.count;
    } else {
      flush();
      for (let k = 0; k < op.count; k++) items.push({ eq: true, old: oldP[io + k], cur: curP[ic + k] });
      io += op.count;
      ic += op.count;
    }
  }
  flush();
  return { items, degraded: false };
}

function frontmatterLines(a: string, b: string): Part[] {
  return diffLines(a, b).map((c) => ({ kind: c.added ? "added" : c.removed ? "removed" : "equal", text: c.value }));
}

/** Compare `oldText` (a snapshot) with `curText` (usually the note now). */
export function compareTexts(oldText: string, curText: string, opts: CompareOptions = {}): Compare {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const oldBody = bodyStart(oldText), curBody = bodyStart(curText);
  const oldFm = oldText.slice(0, oldBody), curFm = curText.slice(0, curBody);
  const oldP = paragraphs(oldText, oldBody);
  const curP = paragraphs(curText, curBody);

  const aligned = align(oldP, curP, timeout);
  let degraded = aligned.degraded;

  // Blocks, in current-text order.
  const blocks: Block[] = [];
  for (const it of aligned.items) {
    if (it.eq) {
      blocks.push({
        kind: "equal", old: spanOf(oldText, [it.old]), cur: spanOf(curText, [it.cur]), at: it.cur.from,
        parts: [], paragraphs: { old: 1, cur: 1 }, revert: null,
      });
      continue;
    }
    const g = it.group;
    const old = spanOf(oldText, g.old), cur = spanOf(curText, g.cur);
    const kind: BlockKind = old && cur ? "changed" : cur ? "inserted" : "deleted";
    let parts: Part[] = [];
    if (old && cur) {
      const wd = wordDiff(old, cur, aligned.degraded || g.whole ? 0 : timeout);
      parts = wd.parts;
      if (wd.degraded && !g.whole) degraded = true;
    }
    blocks.push({ kind, old, cur, at: cur ? cur.from : -1, parts, paragraphs: { old: g.old.length, cur: g.cur.length }, revert: null });
  }

  // Moves: an inserted paragraph that is a deleted one elsewhere.
  let movedId = 0;
  const used = new Set<Block>();
  for (const ins of blocks) {
    if (ins.kind !== "inserted" || !ins.cur) continue;
    const key = norm(ins.cur.text);
    const del = blocks.find((b) => b.kind === "deleted" && !used.has(b) && b.old && norm(b.old.text) === key);
    if (!del) continue;
    used.add(del);
    movedId++;
    ins.kind = "moved-in";
    del.kind = "moved-out";
    ins.movedId = movedId;
    del.movedId = movedId;
  }

  // Where deleted blocks go back, and every block's revert. Deleted and
  // inserted stretches only ever touch paragraphs that stay (see pairRun).
  const nl = (x: string) => matchLineEndings(x, curText);
  const oldAt = new Map(oldP.map((p, k) => [p.from, k] as const));
  const curAt = new Map(curP.map((p, k) => [p.from, k] as const));
  const oldGap = (k: number): string | null => (k >= 0 && k + 1 < oldP.length ? oldText.slice(oldP[k].to, oldP[k + 1].from) : null);
  const changes: { block: Block | null; change: Change }[] = [];
  if (oldFm !== curFm) changes.push({ block: null, change: { from: 0, to: curBody, insert: nl(oldFm) } });

  let lastCurTo: number | null = null;
  // A run of inserted paragraphs drops the separator before each one when a
  // paragraph that stays comes before the run, else the one after each.
  let runHasBefore = false;
  let prevWasInsert = false;
  let deletedIntoEmpty = 0;
  for (const b of blocks) {
    let change: Change | null = null;
    if (b.kind === "deleted" || b.kind === "moved-out") {
      const old = b.old as Span;
      const k0 = oldAt.get(old.from) ?? 0;
      const k1 = k0 + b.paragraphs.old - 1;
      const before = oldGap(k0 - 1) ?? oldGap(k1) ?? "\n\n";
      const after = oldGap(k1) ?? oldGap(k0 - 1) ?? "\n\n";
      if (lastCurTo !== null) {
        b.at = lastCurTo;
        change = { from: b.at, to: b.at, insert: nl(before + old.text) };
      } else if (curP.length > 0) {
        b.at = curP[0].from;
        change = { from: b.at, to: b.at, insert: nl(old.text + after) };
      } else {
        b.at = curBody;
        change = { from: b.at, to: b.at, insert: nl(deletedIntoEmpty === 0 ? old.text : before + old.text) };
        deletedIntoEmpty++;
      }
      prevWasInsert = false;
    } else if (b.cur) {
      const cur = b.cur;
      const c0 = curAt.get(cur.from) ?? 0;
      const c1 = c0 + b.paragraphs.cur - 1;
      const inserted = b.kind === "inserted" || b.kind === "moved-in";
      if (b.kind === "changed") {
        change = { from: cur.from, to: cur.to, insert: nl((b.old as Span).text) };
      } else if (inserted) {
        if (!prevWasInsert) runHasBefore = c0 > 0;
        if (runHasBefore) change = { from: curP[c0 - 1].to, to: cur.to, insert: "" };
        else if (c1 + 1 < curP.length) change = { from: cur.from, to: curP[c1 + 1].from, insert: "" };
        else change = { from: cur.from, to: cur.to, insert: "" };
      }
      prevWasInsert = inserted;
      lastCurTo = cur.to;
    }
    if (change) changes.push({ block: b, change });
  }

  // Anchor each revert, its context clipped at the neighbouring reverts.
  const anchored = changes.map(({ change }, k) => {
    const lo = k > 0 ? Math.min(changes[k - 1].change.to, change.from) : 0;
    const hi = k + 1 < changes.length ? Math.max(changes[k + 1].change.from, change.to) : curText.length;
    const a = anchor(curText, change, CONTEXT);
    const beforeFrom = Math.max(lo, change.from - a.before.length);
    return { ...a, before: curText.slice(beforeFrom, change.from), after: curText.slice(change.to, Math.min(hi, change.to + a.after.length)) };
  });
  let frontmatter: Compare["frontmatter"] = null;
  changes.forEach(({ block }, k) => {
    if (block) block.revert = anchored[k];
    else frontmatter = { old: oldFm, cur: curFm, lines: frontmatterLines(oldFm, curFm), revert: anchored[k] };
  });

  // Summary: words by Escrita's rules; moved text counts as nothing.
  const addedRanges: { from: number; to: number }[] = [];
  const removedRanges: { from: number; to: number }[] = [];
  let changedParagraphs = 0;
  for (const b of blocks) {
    if (b.kind === "equal" || b.kind === "moved-in" || b.kind === "moved-out") continue;
    changedParagraphs += Math.max(b.paragraphs.old, b.paragraphs.cur);
    if (b.kind === "inserted" && b.cur) addedRanges.push(b.cur);
    if (b.kind === "deleted" && b.old) removedRanges.push(b.old);
    for (const p of b.parts) {
      if (p.kind === "added" && p.curFrom !== undefined) addedRanges.push({ from: p.curFrom, to: p.curFrom + p.text.length });
      if (p.kind === "removed" && p.oldFrom !== undefined) removedRanges.push({ from: p.oldFrom, to: p.oldFrom + p.text.length });
    }
  }
  const totalParagraphs = Math.max(oldP.length, curP.length, 1);
  return {
    frontmatter,
    blocks,
    summary: {
      added: addedRanges.length ? countSelection(segment(curText), addedRanges) : 0,
      removed: removedRanges.length ? countSelection(segment(oldText), removedRanges) : 0,
      changedParagraphs,
      totalParagraphs,
      percent: Math.min(100, Math.round((100 * changedParagraphs) / totalParagraphs)),
    },
    degraded,
  };
}
