// The desk's pure model: what the home block shows (no Obsidian imports).
// Only draft and revision works get a line. Every other stage is one count.
// Facts carry a state per number so the renderer can color it (Q23).

import type { PieceUnit } from "../core/measure";
import type { Stage } from "../core/stages";
import type { DeskRole } from "../core/works";

export interface WorkSource {
  path: string;
  role: DeskRole;
  stage: Stage | "none";
  title: string;
  count: number;
  unit: PieceUnit;
  target?: number;
  limit?: number;
  deadline?: string;
  goal?: number;
  chapters?: { done: number; total: number };
  /** the note's own status word; the fact of an unstaged work */
  statusWord?: string;
  /** when the writer last edited it (a book: its newest chapter) */
  editedAt: number;
}

export type NumberState = "reached" | "over" | null;

export type Fact =
  | { kind: "none" }
  | { kind: "status"; word: string }
  | { kind: "chapters"; done: number; total: number; deadline?: string; deadlinePast: boolean }
  | {
      kind: "length";
      count: number;
      unit: PieceUnit;
      /** what the count is compared with */
      total?: number;
      totalKind?: "target" | "limit";
      state: NumberState;
      deadline?: string;
      deadlinePast: boolean;
    };

export interface WorkLine { path: string; title: string; fact: Fact }

export interface DeskModel {
  writing: WorkLine[];
  revising: WorkLine[];
  /** idea, ready, published, none, in that order; zero counts left out */
  counts: { stage: Stage | "none"; n: number; items: WorkLine[] }[];
}

export interface FactLabels {
  /** an ISO day as the writer reads it ("15 out") */
  day(iso: string): string;
  /** a number with its thousands separator */
  num(n: number): string;
  /** "4.210 / 5.000" */
  of(n: number, total: number): string;
  /** "2.840 / máx. 3.000" */
  ofMax(n: number, limit: number): string;
  /** the part after the count, " / 5.000", when only the count is colored */
  ofRest(total: number): string;
  /** the part after the count, " / máx. 3.000" */
  ofMaxRest(limit: number): string;
  /** "" for words, "caracteres" for characters */
  unitSuffix(unit: PieceUnit): string;
  /** "prazo 15 out", given the already formatted day */
  deadline(day: string): string;
  /** "6 de 9 capítulos prontos" */
  chaptersReady(done: number, total: number): string;
}

export interface FactPart { text: string; state: "reached" | "over" | "past" | null }

const SEP = " · ";
const COUNT_ORDER: readonly (Stage | "none")[] = ["idea", "ready", "published", "none"];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

function validDeadline(d: string | undefined): string | undefined {
  return d && ISO_DAY.test(d) ? d : undefined;
}

function isPast(deadline: string | undefined, today: string | undefined): boolean {
  return !!deadline && !!today && deadline.slice(0, 10) < today.slice(0, 10);
}

function lengthFact(w: WorkSource, compare: number | undefined, kindOfCompare: "target" | "limit" | undefined, today?: string): Fact {
  const deadline = validDeadline(w.deadline);
  return finish(w, compare, kindOfCompare, deadline, today);
}

function finish(w: WorkSource, total: number | undefined, totalKind: "target" | "limit" | undefined, deadline: string | undefined, today?: string): Fact {
  if (w.count <= 0 && total === undefined && !deadline) return { kind: "none" };
  let state: NumberState = null;
  if (w.limit !== undefined && w.count > w.limit) state = "over";
  else if (totalKind === "target" && total !== undefined && w.count >= total) state = "reached";
  return { kind: "length", count: w.count, unit: w.unit, total, totalKind, state, deadline, deadlinePast: isPast(deadline, today) };
}

/** `today` is an ISO day; without it no deadline is past. */
export function factOf(w: WorkSource, today?: string): Fact {
  if (w.role === "unstaged" || w.stage === "none") {
    return w.statusWord ? { kind: "status", word: w.statusWord } : { kind: "none" };
  }
  const deadline = validDeadline(w.deadline);
  if (w.role === "book") {
    if (w.stage === "revision" && w.chapters && w.chapters.total > 0) {
      return { kind: "chapters", done: w.chapters.done, total: w.chapters.total, deadline, deadlinePast: isPast(deadline, today) };
    }
    const goal = w.goal && w.goal > 0 ? w.goal : undefined;
    return finish({ ...w, limit: undefined }, goal, goal === undefined ? undefined : "target", deadline, today);
  }
  if (w.target !== undefined) return lengthFact(w, w.target, "target", today);
  if (w.limit !== undefined) return lengthFact(w, w.limit, "limit", today);
  return lengthFact(w, undefined, undefined, today);
}

export function factParts(f: Fact, labels: FactLabels): FactPart[] {
  const parts: FactPart[] = [];
  const plain = (text: string) => parts.push({ text, state: null });
  if (f.kind === "none") return parts;
  if (f.kind === "status") { plain(f.word); return parts; }
  const addDeadline = (deadline: string | undefined, past: boolean) => {
    if (!deadline) return;
    if (parts.length > 0) plain(SEP);
    parts.push({ text: labels.deadline(labels.day(deadline)), state: past ? "past" : null });
  };
  if (f.kind === "chapters") {
    plain(labels.chaptersReady(f.done, f.total));
    addDeadline(f.deadline, f.deadlinePast);
    return parts;
  }
  const showNumber = f.count > 0 || f.total !== undefined;
  if (showNumber) {
    if (f.state === "over" && f.total !== undefined) {
      // only the count is colored; the limit stays plain
      parts.push({ text: labels.num(f.count), state: "over" });
      plain(f.totalKind === "limit" ? labels.ofMaxRest(f.total) : labels.ofRest(f.total));
    } else {
      const text = f.total === undefined ? labels.num(f.count)
        : f.totalKind === "limit" ? labels.ofMax(f.count, f.total)
        : labels.of(f.count, f.total);
      parts.push({ text, state: f.state });
    }
    const unit = labels.unitSuffix(f.unit);
    if (unit) plain(" " + unit);
  }
  addDeadline(f.deadline, f.deadlinePast);
  return parts;
}

export function factText(f: Fact, labels: FactLabels): string {
  return factParts(f, labels).map((p) => p.text).join("");
}

function byRecency(a: WorkSource, b: WorkSource): number {
  return b.editedAt - a.editedAt || a.title.localeCompare(b.title);
}

export function buildDesk(works: readonly WorkSource[], today?: string): DeskModel {
  const shown = works.filter((w) => w.role !== "chapter").sort(byRecency);
  const line = (w: WorkSource): WorkLine => ({ path: w.path, title: w.title, fact: factOf(w, today) });
  const counts: DeskModel["counts"] = [];
  for (const stage of COUNT_ORDER) {
    const items = shown.filter((w) => w.stage === stage).map(line);
    if (items.length) counts.push({ stage, n: items.length, items });
  }
  return {
    writing: shown.filter((w) => w.stage === "draft").map(line),
    revising: shown.filter((w) => w.stage === "revision").map(line),
    counts,
  };
}

function cleanSlashes(f: string): string {
  return f.replace(/^\/+|\/+$/g, "");
}

const under = (path: string, folder: string) => path === folder || path.startsWith(folder + "/");

/** Keeps the works inside any of the folders; a book also matches by its own folder. No folders keeps all. */
export function filterByFolders(
  works: readonly WorkSource[],
  folders: string[],
  bookFolderOf: (path: string) => string | null,
): WorkSource[] {
  const fs = folders.map(cleanSlashes).filter(Boolean);
  if (fs.length === 0) return [...works];
  return works.filter((w) => {
    const bf = w.role === "book" ? bookFolderOf(w.path) : null;
    return fs.some((f) => under(w.path, f) || (bf !== null && under(bf, f)));
  });
}
