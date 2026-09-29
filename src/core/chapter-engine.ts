// The sequencing behind ChapterOps, free of Obsidian so it can be tested with
// an in-memory folder. ChapterOps adapts a real chapters folder to `ChapterFs`.

import { safeFileName } from "./book";
import {
  ChapterError, buildChapterContent, orderRenames, planInsert, planRenumberNames, templateVars,
} from "./chapter-plan";

/** A book's chapters folder, by basename (file name without ".md"). */
export interface ChapterFs<F> {
  /** chapter basenames in chapter order */
  chapters(): string[];
  /** every Markdown basename in the folder (what a rename could collide with) */
  names(): string[];
  rename(from: string, to: string): Promise<void>;
  create(name: string, content: string): Promise<F>;
  /** the chapter template's text, or null when there is none */
  template(): Promise<string | null>;
}

export interface CreateOptions {
  pad: number;
  summaryProperty: string;
  /** file-safe fallback title */
  untitled: string;
  now?: Date;
}

/** Runs async jobs one at a time, in call order. A failed job doesn't block the next. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const job = this.tail.then(fn, fn);
    this.tail = job.catch(() => undefined);
    return job;
  }
}

/** Create a chapter at 0-based `at`, shifting the chapters after it. Resolves to the new file. */
export async function createChapter<F>(
  fs: ChapterFs<F>, at: number, title: string, opts: CreateOptions, body?: string,
): Promise<F> {
  const safe = safeFileName(title) || safeFileName(opts.untitled) || "Untitled";
  const plan = planInsert(fs.chapters(), at, safe, opts.pad);
  const existing = fs.names();
  const steps = orderRenames(plan.renames, existing);
  const after = new Set(existing.map((n) => n.toLowerCase()));
  for (const r of plan.renames) after.delete(r.from.toLowerCase());
  for (const r of plan.renames) after.add(r.to.toLowerCase());
  if (after.has(plan.name.toLowerCase())) throw new ChapterError("exists", plan.name);

  for (const s of steps) await fs.rename(s.from, s.to);
  const content = buildChapterContent(await fs.template(), templateVars(safe, opts.now ?? new Date()), opts.summaryProperty, body);
  return fs.create(plan.name, content);
}

/** Rename chapters so their prefixes match the order of `ordered` (basenames). */
export async function renumberChapters<F>(fs: ChapterFs<F>, ordered: string[], pad: number): Promise<void> {
  const plan = planRenumberNames(ordered, pad);
  if (!plan.length) return;
  for (const s of orderRenames(plan, fs.names())) await fs.rename(s.from, s.to);
}
