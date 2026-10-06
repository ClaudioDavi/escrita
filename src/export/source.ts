// Reads what an export is made of and says what is wrong with it. No Obsidian imports:
// the module hands it ports (the book source's `read`, the measurer's counts, a yield
// checkpoint), and tests hand it fakes.
//
//   plan (what to read, from the modal's choices)
//     → buildExport (reads each part once, through plugin.notes, so unsaved text counts)
//     → { source: ExportSource, labels, warnings }

import type { Author, ExportDoc, ExportPart, ExportSource } from "../core/export-pipeline";
import { droppedIn, exportDocOf } from "../core/export-pipeline";
import { segment } from "../core/markdown";
import { countIn, sumCounts, type Counts, type PieceUnit } from "../core/measure";
import { readinessOf, type ReadinessId } from "../core/readiness";

/**
 * What an export reads (0.9, PLAN-0.9 Q28), the source choice task 2.7 hands the modal
 * (task 2.4):
 * - `note`: one note, read whole.
 * - `book`: a book's chapters through `bookSource`, from a chapter or the book note.
 * - `collection`: a collection note's stories through `collectionSource`, each an
 *   unnumbered chapter headed by its title alone (Q26). Its title is the note's
 *   basename; author, dedication, epigraph and cover come from the note's own
 *   properties, as a book note's. No "This chapter": the note is the collection.
 */
export type SourceKind = "note" | "book" | "collection";

/**
 * Which source an export takes. A book wins: a chapter or book note with a `contents`
 * list is still read as its book (books are folders, collections are lists, and a
 * book's shape is the stronger fact). Otherwise a note that `collectionAt` answers for
 * is a collection, even an empty one, and anything else is a note.
 */
export function sourceKindOf(place: { kind: string; book: unknown }, collection: boolean): SourceKind {
  if (place.book && (place.kind === "chapter" || place.kind === "book-note")) return "book";
  return collection ? "collection" : "note";
}

export interface PartPlan {
  role: ExportPart["role"];
  path: string;
  /** the chapter heading, already formatted; null for a single note and front matter */
  heading: string | null;
  /** the chapter's own title, to drop a leading `# Title` that repeats it */
  title: string | null;
  /** how a warning names this part ("A chegada", "Dedicatória") */
  label: string;
}

export interface ExportPlan {
  title: string;
  author: Author;
  unit: PieceUnit;
  parts: PartPlan[];
  placeholderMarker: string;
  /** a single note, whose text must not be empty (a book's empty chapter is fine) */
  single: boolean;
  /**
   * A collection's links that resolve to nothing (`Collection.missing`), skipped (Q26).
   * Absent for a note and a book. Task 2.7 turns them into a warning: id
   * `missingStories` (added to `WarningId` then, not now, so the modal's `warningText`
   * switch stays exhaustive), level `warning`, the link texts as `names`, no links. The
   * modal's case and its strings belong to task 2.4; 2.7 hands them over.
   */
  missing?: string[];
}

export interface ExportPorts {
  read(path: string): Promise<{ text: string; mtime: number | null }>;
  /** the measured size of a file just read, from the measurer's cache (never a recount) */
  count(path: string, read: { text: string; mtime: number | null }): Promise<Counts>;
  /** yields after a unit of work, within a time budget (core/vault-index `yieldBudget`) */
  checkpoint(): Promise<void>;
}

/** One place in a note a warning points at. */
export interface WarningLink {
  path: string;
  /** 0-based line in that file */
  line: number;
  /** the part's label */
  where: string;
}

export type WarningId = ReadinessId | "embeds";

export interface Warning {
  id: WarningId;
  /** a blocker or warning asks for "Export anyway"; info (embeds) only reports */
  level: "blocker" | "warning" | "info";
  n: number;
  /** embeds: the dropped targets, each once, in order */
  names: string[];
  links: WarningLink[];
}

export interface Built {
  source: ExportSource;
  /** the model the writers and the preview format, built once from `source` */
  doc: ExportDoc;
  /** the file each source part came from, same order */
  paths: string[];
  /** the label of each source part, same order */
  labels: string[];
  warnings: Warning[];
}

const ORDER: WarningId[] = ["placeholders", "unclosedComment", "unclosedHtmlComment", "unwrittenBeats", "emptyBody", "embeds"];

/** Reads every part once and measures the body, then collects the warnings. */
export async function buildExport(plan: ExportPlan, ports: ExportPorts): Promise<Built> {
  const parts: ExportPart[] = [];
  const counts: Counts[] = [];
  for (const p of plan.parts) {
    const read = await ports.read(p.path);
    parts.push({ role: p.role, heading: p.heading, title: p.title, md: segment(read.text) });
    if (p.role === "body") counts.push(await ports.count(p.path, read));
    await ports.checkpoint();
  }
  const source: ExportSource = {
    title: plan.title,
    author: plan.author,
    count: { amount: countIn(sumCounts(counts), plan.unit), unit: plan.unit },
    parts,
  };
  const paths = plan.parts.map((p) => p.path);
  const labels = plan.parts.map((p) => p.label);
  const doc = exportDocOf(source, { placeholderMarker: plan.placeholderMarker });
  return { source, doc, paths, labels, warnings: warningsOf(plan, source, doc, paths, labels) };
}

/**
 * The readiness checks of every part (placeholders, unclosed comments, unwritten
 * beats, an empty single note) plus the embeds the manuscript drops. Passed checks
 * are left out. Each carries links to its lines, in file order within a part.
 */
export function warningsOf(plan: Pick<ExportPlan, "placeholderMarker" | "single">, source: ExportSource, doc: ExportDoc, paths: string[], labels: string[]): Warning[] {
  const found = new Map<WarningId, Warning>();
  const add = (id: WarningId, level: Warning["level"], n: number, link: WarningLink | null, name?: string): void => {
    let w = found.get(id);
    if (!w) {
      w = { id, level, n: 0, names: [], links: [] };
      found.set(id, w);
    }
    w.n += n;
    if (link) w.links.push(link);
    if (name !== undefined && !w.names.includes(name)) w.names.push(name);
  };
  source.parts.forEach((part, i) => {
    const r = readinessOf(part.md, { placeholderMarker: plan.placeholderMarker });
    for (const c of r.checks) {
      if (c.level === "passed") continue;
      if (c.id === "emptyBody") {
        // a book's empty chapter is still a chapter; only an empty single note is a problem
        if (plan.single && part.role === "body") add("emptyBody", c.level, 1, null);
        continue;
      }
      const lines = c.items.length > 0 ? c.items.map((it) => it.line) : [c.line];
      const n = c.items.length > 0 ? c.items.length : 1;
      add(c.id, c.level, n, null);
      for (const line of lines) {
        if (line !== undefined) found.get(c.id)!.links.push({ path: paths[i], line, where: labels[i] });
      }
    }
  });
  for (const { part, dropped } of droppedIn(doc)) {
    if (dropped.kind !== "embed") continue;
    add("embeds", "info", 1, { path: paths[part], line: dropped.line, where: labels[part] }, dropped.text);
  }
  return ORDER.map((id) => found.get(id)).filter((w): w is Warning => w !== undefined);
}

/** True when a blocker or a warning asks the writer to confirm (the button reads "Export anyway"). */
export function needsConfirm(warnings: readonly Warning[]): boolean {
  return warnings.some((w) => w.level !== "info");
}
