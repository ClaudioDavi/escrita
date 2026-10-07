// Which scope a file lives in (no Obsidian imports; moved from universe/scope.ts in 0.9,
// IMPROVEMENTS 9: the classifier reads it, so it lives in core): the one question every
// universe feature asks first (ROADMAP-universe, "Modes").
//
//   none      the feature doesn't apply (mode off, or a note outside any book in per-book mode)
//   book      per-book rules: the book's own folders; `root` is the book folder
//   universe  the shared world; `root` is the universe's folder
//
// `note` is the note that names the scope: the book note, or the universe note.
//
// Universe mode, in this order (first match wins):
//   0. `universe: false` (the YAML boolean, or the string "false", trimmed, any case) keeps
//      the file out of the universe: its book scope, else none. The file comes before its
//      book note, so a file's own link beats the book's `false`, and its own `false` beats
//      the book's link. It beats the universe folder and the universe note too.
//   1. the file's own `universe` property (a work, an entry, a chapter that sets it);
//   2. the book note's property, for a chapter or other file of a book;
//   3. the file is inside the universe folder (entries join by folder);
//   4. the file is inside a default-universe folder (existing contos join without edits);
//   5. the file belongs to a book: that book, per-book rules (a mixed vault's standalone novel);
//   6. none: a standalone note with no universe stays standalone.
// The universe's folder is never a setting: it is the folder beside the universe
// note with the same basename (Universo.md -> Universo/). Several universes: the
// property links a universe note, whose own folder is the root. A link that resolves to no note and isn't the
// settings' universe note joins nothing (it is read as a typo, never guessed at).

// core/classify.ts imports this file at runtime (Placement.scope), so this file never
// imports classify: inFolder and NO_SCOPE live here, and classify re-exports them.
import { folderListOf } from "./lists";

export type ScopeKind = "none" | "book" | "universe";

export interface Scope {
  kind: ScopeKind;
  /** a folder path; "" for none */
  root: string;
  /** the book note or the universe note (a path), when known */
  note: string | null;
}

/** What scopeFor learns about the vault, as plain data (built from books.classify and the metadata cache). */
export interface ScopeLookup {
  /** the book the file belongs to (its chapter, its book note or another file of it), else null */
  book(path: string): { note: string; folder: string } | null;
  /** the raw `universe` property value of the note at `path` (a link string, a list, or nothing) */
  universe(path: string): unknown;
  /** the note path a link text points at, as seen from `from`; null when it points at nothing */
  resolve(link: string, from: string): string | null;
}

/** The universe modes (UniverseSettings.universeMode has the same values). */
export type ScopeMode = "off" | "perBook" | "universe";

/**
 * The settings scope reads. Declared here, not picked from UniverseSettings, because core
 * never imports the universe; UniverseSettings (and so EscritaSettings) is assignable to it.
 */
export interface ScopeSettings {
  universeMode: ScopeMode;
  /** the universe note (path, `.md` optional) */
  universeNote: string;
  /** newline-separated folders whose notes join the universe without a property */
  defaultUniverseFolders: string;
}

/** Two scopes are the same world: same kind and same root folder. */
export function sameScope(a: Scope, b: Scope): boolean {
  return a.kind === b.kind && a.root === b.root;
}

/**
 * The scope of a path outside every universe and book. Frozen and shared: every
 * placement without a scope of its own carries this one object.
 */
export const NO_SCOPE: Scope = Object.freeze({ kind: "none", root: "", note: null }) as Scope;

/** Whether `path` is `folder` itself or inside it. Slashes at the folder's edges are ignored, "" means the whole vault, case-sensitive. */
export function inFolder(path: string, folder: string): boolean {
  const f = folder.replace(/^\/+|\/+$/g, "");
  return f === "" || path === f || path.startsWith(`${f}/`);
}

const trimSlashes = (p: string) => p.replace(/^\/+|\/+$/g, "");
const withMd = (p: string) => (/\.md$/i.test(p) ? p : `${p}.md`);
const noMd = (p: string) => p.replace(/\.md$/i, "");

/** The link text of a property value: `[[A|b]]` and `[[A#h]]` → "A"; a plain string stays; the first non-empty item of a list. */
export function linkText(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const v of value) {
      const l = linkText(v);
      if (l) return l;
    }
    return null;
  }
  if (typeof value !== "string") return null;
  const m = /\[\[([^\]]*)\]\]/.exec(value);
  const inner = (m ? m[1] : value).split("|")[0].split(/[#^]/)[0].trim();
  return inner === "" ? null : inner;
}

/** The settings' universe note as a vault path: no edge slashes, `.md` added when missing ("Universo/" and "Universo" both give "Universo.md"). */
export function universeNotePath(universeNote: string): string {
  return withMd(trimSlashes(universeNote.trim()));
}

function defaultUniverse(s: ScopeSettings): Scope {
  const note = universeNotePath(s.universeNote);
  return { kind: "universe", root: noMd(note), note };
}

function universeFromLink(link: string, from: string, s: ScopeSettings, lookup: ScopeLookup): Scope | null {
  const own = universeNotePath(s.universeNote);
  const path = lookup.resolve(link, from);
  if (path !== null) {
    return path === own ? defaultUniverse(s) : { kind: "universe", root: noMd(path), note: path };
  }
  // an unresolved link still names the settings' universe by its name
  const name = (p: string) => noMd(p).split("/").pop()!.toLowerCase();
  return name(link) === name(own) ? defaultUniverse(s) : null;
}

/** `universe: false`: the YAML boolean, or the string "false" (trimmed, any case; the Properties editor writes a string). A list never counts. */
function isFalse(value: unknown): boolean {
  return value === false || (typeof value === "string" && value.trim().toLowerCase() === "false");
}

/**
 * True when `universe: false` keeps the note out: its own `false`, or its book note's `false`
 * when its own link names nothing. An own link wins only when it resolves (the same test
 * scopeFor makes), so the two always agree.
 */
export function keptOut(path: string, lookup: ScopeLookup, settings: ScopeSettings): boolean {
  const book = lookup.book(path);
  for (const p of book ? [path, book.note] : [path]) {
    if (isFalse(lookup.universe(p))) return true;
    const link = linkText(lookup.universe(p));
    if (link !== null && universeFromLink(link, p, settings, lookup)) return false;
  }
  return false;
}

export function scopeFor(file: { path: string }, settings: ScopeSettings, lookup: ScopeLookup): Scope {
  const mode = settings.universeMode;
  if (mode === "off") return NO_SCOPE;
  const book = lookup.book(file.path);
  const bookScope: Scope = book ? { kind: "book", root: trimSlashes(book.folder), note: book.note } : NO_SCOPE;
  if (mode === "perBook") return bookScope;

  for (const path of book ? [file.path, book.note] : [file.path]) {
    if (isFalse(lookup.universe(path))) return bookScope;
    const link = linkText(lookup.universe(path));
    if (link === null) continue;
    const joined = universeFromLink(link, path, settings, lookup);
    if (joined) return joined;
  }
  const own = defaultUniverse(settings);
  if (inFolder(file.path, own.root)) return own;
  if (own.note === file.path) return own;
  if (folderListOf(settings.defaultUniverseFolders).some((f) => inFolder(file.path, f))) return own;
  return bookScope;
}

/** The universe root of a universe note path: the folder beside it with the same basename. */
export function universeRootOf(note: string): string {
  return noMd(trimSlashes(note));
}
