// Whether a note the writer just created should start in the draft stage (no Obsidian imports).
// main.ts asks this a moment after the vault's "create" event, so a template has landed first.

import { propertyKey } from "./book-source";

export interface NewNotePlace {
  kind: string;
  markdown: boolean;
  tracked: boolean;
  snapshot: boolean;
  /** in the submissions folder (never a work); optional so older callers still type */
  submission?: boolean;
  /** in the export folder (derived text, never a work) */
  export?: boolean;
  path: string;
}

export interface NewNoteOptions {
  statusProperty: string;
  /** the universe's entry type property: an entry is not a work, so it gets no status */
  typeProperty: string;
  /** folders whose notes are templates, not writing */
  templateFolders: string[];
  /** Escrita's own notes (home note, word lists, universe note, chapter template) */
  ownNotes: string[];
  /**
   * A note with any of these properties (any value, even none; name in any case) is not
   * prose, so it gets no draft status: a collection is a work only if the writer gives it
   * a status (Q27).
   */
  structuralProperties: string[];
}

const WRITING_KINDS = new Set(["note", "chapter", "book-note"]);

function filled(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== "";
}

function under(path: string, folder: string): boolean {
  const f = folder.trim().replace(/^\/+|\/+$/g, "");
  return f !== "" && (path === f || path.startsWith(`${f}/`));
}

function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.trim().replace(/^\/+/, "").replace(/\.md$/i, "").toLowerCase();
  return norm(a) !== "" && norm(a) === norm(b);
}

/** True when the note is writing in a tracked place, has no status, and isn't a template, an entry or one of Escrita's notes. */
export function needsDraftStatus(place: NewNotePlace, fm: Record<string, unknown> | null | undefined, o: NewNoteOptions): boolean {
  if (!place.markdown || place.snapshot || place.submission || place.export || !place.tracked || !WRITING_KINDS.has(place.kind)) return false;
  if (o.templateFolders.some((f) => under(place.path, f))) return false;
  if (o.ownNotes.some((n) => samePath(n, place.path))) return false;
  const props = fm ?? {};
  if (filled(props[o.statusProperty])) return false;
  if (o.typeProperty.trim() && filled(props[o.typeProperty])) return false;
  if (o.structuralProperties.some((p) => propertyKey(props, p) !== undefined)) return false;
  return true;
}
