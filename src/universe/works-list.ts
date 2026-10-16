// The Works tab's data (no Obsidian imports): the works of a universe grouped by
// form and sorted by stage then name.

import { STAGES, type Stage } from "../core/stages";
import { FORM_KINDS, type FormKind } from "../core/form";

/** One work in a universe (a book note, or a tracked standalone note with a known stage). */
export interface WorkInfo {
  path: string;
  title: string;
  stage: Stage;
  /** null when the form property is missing or its value is unknown */
  form: FormKind | null;
  role: "book" | "note";
}

export interface WorkGroup {
  /** null is the "No form" group */
  form: FormKind | null;
  works: WorkInfo[];
}

/** Published first, then back through the stages to ideas. */
export function compareWorks(a: WorkInfo, b: WorkInfo): number {
  return STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage) || a.title.localeCompare(b.title);
}

/** Groups in FORM_KINDS order, "No form" last; empty groups are left out; works sorted by compareWorks. */
export function groupWorks(works: Iterable<WorkInfo>): WorkGroup[] {
  const by = new Map<FormKind | null, WorkInfo[]>();
  for (const w of works) {
    const list = by.get(w.form) ?? [];
    list.push(w);
    by.set(w.form, list);
  }
  const order: (FormKind | null)[] = [...FORM_KINDS, null];
  return order.filter((f) => by.has(f)).map((form) => ({ form, works: by.get(form)!.sort(compareWorks) }));
}
