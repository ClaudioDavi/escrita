// A work's form (no Obsidian imports): short story, essay, novel, screenplay… read from the
// form property, or from the folder it sits in. In core since 1.1 (PLAN-1.1 Q1), so a
// screenplay is known with the universe off; `classify` gives it as `Placement.form`. The
// settings keys keep their 0.6 names, so saved data needs no migration.

export const FORM_KINDS = ["shortStory", "essay", "novella", "novel", "poem", "fragment", "screenplay"] as const;
export type FormKind = (typeof FORM_KINDS)[number];

/** The settings the form rule reads. EscritaSettings has all three. */
export interface FormSettings {
  /** property holding a work's form */
  formProperty: string;
  /** the words used for each form */
  formValues: Record<FormKind, string>;
  /** newline-separated `Folder: form word` lines: the form of works in a folder without the property */
  formFolders: string;
}

export const FORM_DEFAULTS: Record<FormKind, string> = {
  shortStory: "short story",
  essay: "essay",
  novella: "novella",
  novel: "novel",
  poem: "poem",
  fragment: "fragment",
  screenplay: "screenplay",
};

export const DEFAULT_FORM_PROPERTY = "form";

const norm = (s: string) => s.normalize("NFC").trim().toLowerCase();

/** The form a property value names (case and spacing forgiven; a first list item counts), or null. */
export function formOf(value: unknown, values: FormSettings["formValues"]): FormKind | null {
  const v = Array.isArray(value) ? (value as unknown[])[0] : value;
  if (typeof v !== "string" && typeof v !== "number") return null;
  const word = norm(String(v));
  if (word === "") return null;
  for (const k of FORM_KINDS) if (norm(values[k] ?? "") === word) return k;
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
  s: Pick<FormSettings, "formValues" | "formFolders">,
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

/** The form words as one comma-separated text (the settings field), in FORM_KINDS order. */
export function formValuesText(values: FormSettings["formValues"]): string {
  return FORM_KINDS.map((k) => values[k]).join(", ");
}

/**
 * The settings field back into form words: by position; a missing or blank item keeps `current`
 * (so a text saved before 1.1, with six words, keeps the screenplay word).
 */
export function parseFormValues(text: string, current: FormSettings["formValues"]): FormSettings["formValues"] {
  const parts = text.split(",").map((p) => p.trim());
  const out = { ...current };
  FORM_KINDS.forEach((k, i) => { if (parts[i]) out[k] = parts[i]; });
  return out;
}
