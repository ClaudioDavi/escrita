// The Works tab's data (no Obsidian imports): the works of a universe grouped by
// form and sorted by stage then name.

import { STAGES, type Stage } from "../core/stages";
import { FORM_KINDS, type FormKind, type UniverseSettings } from "./settings";

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

const norm = (s: string) => s.normalize("NFC").trim().toLowerCase();

/** The form a property value names (case and spacing forgiven; a first list item counts), or null. */
export function formOf(value: unknown, values: UniverseSettings["formValues"]): FormKind | null {
  const v = Array.isArray(value) ? (value as unknown[])[0] : value;
  if (typeof v !== "string" && typeof v !== "number") return null;
  const word = norm(String(v));
  if (word === "") return null;
  for (const k of FORM_KINDS) if (norm(values[k]) === word) return k;
  return null;
}

/** `Folder: form word` lines → pairs, folder without leading/trailing slashes; malformed lines are skipped. */
export function parseFormFolders(text: string): { folder: string; word: string }[] {
  const out: { folder: string; word: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const i = line.lastIndexOf(":");
    if (i < 0) continue;
    const folder = line.slice(0, i).trim().replace(/^\/+|\/+$/g, "");
    const word = line.slice(i + 1).trim();
    if (folder && word) out.push({ folder, word });
  }
  return out;
}

/**
 * A work's form: its own property first; else the form of the deepest folder in
 * `formFolders` that holds it (so `Contos: conto` covers every conto without a
 * property). Folder names compare as written, path segment by segment.
 */
export function formFor(
  path: string,
  value: unknown,
  s: Pick<UniverseSettings, "formValues" | "formFolders">,
): FormKind | null {
  const own = formOf(value, s.formValues);
  if (own) return own;
  let best: { depth: number; form: FormKind } | null = null;
  for (const { folder, word } of parseFormFolders(s.formFolders)) {
    if (!path.startsWith(folder + "/")) continue;
    const form = formOf(word, s.formValues);
    const depth = folder.split("/").length;
    if (form && (!best || depth > best.depth)) best = { depth, form };
  }
  return best?.form ?? null;
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

/** The form words as one comma-separated text (the settings field), in FORM_KINDS order. */
export function formValuesText(values: UniverseSettings["formValues"]): string {
  return FORM_KINDS.map((k) => values[k]).join(", ");
}

/** The settings field back into form words: by position; a missing or blank item keeps `current`. */
export function parseFormValues(text: string, current: UniverseSettings["formValues"]): UniverseSettings["formValues"] {
  const parts = text.split(",").map((p) => p.trim());
  const out = { ...current };
  FORM_KINDS.forEach((k, i) => { if (parts[i]) out[k] = parts[i]; });
  return out;
}
