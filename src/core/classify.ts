// Where a file sits in the writer's vault (no Obsidian imports). Every module
// asks this first: is it a chapter, a book note, another file of a book, a
// loose note, and is writing in it tracked? The vault is reached through a tiny
// read-only port, `VaultTree`, the way core/chapter-engine reaches a chapters
// folder through `ChapterFs`; core/books.ts adapts the real vault to it.

import { folderList } from "./lists";
import { readPiece, type Piece, type PieceProperties } from "./piece";

/** Anything with a vault path. TFile/TFolder satisfy it; test fakes are `{ path }` objects that keep their identity. */
export interface Named { path: string }

/**
 * The smallest read-only view of the vault classification needs. Lookups take
 * plain joined paths (the adapter tries them as given, then normalized: see
 * lookupPath) and are never asked for the root.
 */
export interface VaultTree<F extends Named, D extends Named> {
  /** the file at exactly this path, else null */
  file(path: string): F | null;
  /** the non-root folder at this path, else null */
  folder(path: string): D | null;
  /** every non-root folder (only listBooks walks it) */
  folders(): Iterable<D>;
  /** the metadata cache's frontmatter; undefined right after creation */
  frontmatter(file: F): Record<string, unknown> | undefined;
}

/**
 * The settings classification reads. EscritaSettings satisfies it as is. New
 * rules (universe mode, default-universe folders…) arrive as new fields here,
 * so callers don't change.
 */
export interface ClassifySettings extends PieceProperties {
  /** "Chapters", "Capítulos", or a nested path like "Drafts/Chapters" */
  chaptersFolder: string;
  /** raw folderList text; empty = the whole vault */
  trackFolders: string;
  /** raw folderList text */
  excludeFolders: string;
  chapterTemplate: string;
}

/**
 * Structure only, and a closed set: future knowledge (scope, universe entry,
 * form) arrives as new fields on Placement, never as new values here.
 */
export type Kind =
  /** a .md file directly inside <book>/<chaptersFolder>/ */
  | "chapter"
  /** Novels/A Casa.md, whose sibling folder Novels/A Casa holds <chaptersFolder>/ */
  | "book-note"
  /** any other file under a book folder: Darlings.md, board.canvas, Chapters/Old/x.md, Personagens/Teo.md */
  | "book-file"
  /** a .md file in no book */
  | "note"
  /** a non-.md file in no book */
  | "file"
  /** Novels/A Casa */
  | "book-folder"
  /** Novels/A Casa/Chapters */
  | "chapters-folder"
  /** any other folder, including the vault root; `book` is set when it sits inside a book */
  | "folder"
  /** null, "", or nothing exists at the path (deleted or renamed away) */
  | "none";

export interface BookOf<F extends Named, D extends Named> {
  /** the book note, e.g. Novels/A Casa.md */
  note: F;
  /** Novels/A Casa */
  folder: D;
  /** Novels/A Casa/Chapters */
  chaptersFolder: D;
  /** the book note's basename */
  title: string;
}

export interface Placement<F extends Named, D extends Named> {
  path: string;
  kind: Kind;
  /** an existing file whose path ends in ".md" (case-sensitive, like TFile.extension === "md") */
  markdown: boolean;
  /**
   * The innermost book that OWNS the path. Set for chapter, book-note,
   * book-file, book-folder, chapters-folder and a folder inside a book; null
   * otherwise. For containment by path (deleted paths, nested books), use `inBook`.
   */
  book: BookOf<F, D> | null;
  /**
   * Whether writing here counts (goals): markdown, inside a track folder (or
   * anywhere when there is none), outside every exclude folder, not the chapter
   * template. Independent of kind: a chapter can be untracked.
   */
  tracked: boolean;
  /** readPiece(frontmatter) for any markdown file, chapters included; null otherwise. A standalone piece is `kind === "note" && piece`. */
  piece: Piece | null;
}

/** Whether `path` is `folder` itself or inside it. Slashes at the folder's edges are ignored, "" means the whole vault, case-sensitive. */
export function inFolder(path: string, folder: string): boolean {
  const f = folder.replace(/^\/+|\/+$/g, "");
  return f === "" || path === f || path.startsWith(`${f}/`);
}

/**
 * Containment by path string alone, so it also works for deleted and old
 * paths: the book note, the book folder, or anything under it. Files of a nested
 * inner book count for the outer book too, unlike Placement.book (ownership).
 */
export function inBook(path: string, book: { note: Named; folder: Named }): boolean {
  return path === book.note.path || inFolder(path, book.folder.path);
}

/**
 * The adapter's path lookup: the path exactly as given first, then its
 * normalized form (normalizePath). A live file keeps the path the vault stores,
 * even one that normalizing would change (a U+00A0 or U+202F space, NFD
 * accents), so its own path must reach it unchanged; the normalized form still
 * finds paths joined from settings or typed by the user.
 */
export function lookupPath<T>(get: (path: string) => T | null, normalize: (path: string) => string): (path: string) => T | null {
  return (path) => {
    const hit = get(path);
    if (hit) return hit;
    const n = normalize(path);
    return n === path ? null : get(n);
  };
}

/**
 * What the adapter's classify(x) classifies: a handle's own path unchanged,
 * null for null, "" for "" (normalizePath would turn it into "/", the root), and
 * any other string as is when something exists there, else normalized.
 */
export function placementPath(
  x: Named | string | null | undefined, normalize: (path: string) => string, exists: (path: string) => boolean,
): string | null {
  if (typeof x !== "string") return x?.path ?? null;
  if (x === "" || exists(x)) return x;
  return normalize(x);
}

function parentOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** The chapters folder setting as a relative path: repeated slashes collapsed, edge slashes stripped (spaces kept, like normalizePath). */
function chaptersRel(settings: ClassifySettings): string {
  return str(settings.chaptersFolder).replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
}

function bookAt<F extends Named, D extends Named>(tree: VaultTree<F, D>, dir: string, ch: string): BookOf<F, D> | null {
  if (dir === "" || dir === "/") return null;
  const folder = tree.folder(dir);
  if (!folder) return null;
  const note = tree.file(`${dir}.md`);
  if (!note) return null;
  const chaptersFolder = ch ? tree.folder(`${dir}/${ch}`) : folder;
  if (!chaptersFolder) return null;
  const name = note.path.slice(note.path.lastIndexOf("/") + 1);
  return { note, folder, chaptersFolder, title: name.replace(/\.md$/, "") };
}

/** The innermost book among the proper ancestors of `path`. */
function ancestorBook<F extends Named, D extends Named>(tree: VaultTree<F, D>, path: string, ch: string): BookOf<F, D> | null {
  for (let dir = parentOf(path); dir !== ""; dir = parentOf(dir)) {
    const b = bookAt(tree, dir, ch);
    if (b) return b;
  }
  return null;
}

function isTracked(path: string, settings: ClassifySettings): boolean {
  const track = folderList(str(settings.trackFolders));
  if (track.length > 0 && !track.some((f) => inFolder(path, f))) return false;
  if (folderList(str(settings.excludeFolders)).some((f) => inFolder(path, f))) return false;
  const tpl = str(settings.chapterTemplate).trim().replace(/^\/+/, "");
  if (tpl && path === (/\.md$/i.test(tpl) ? tpl : `${tpl}.md`)) return false;
  return true;
}

function pieceOf<F extends Named, D extends Named>(tree: VaultTree<F, D>, file: F, settings: ClassifySettings): Piece | null {
  try {
    return readPiece(tree.frontmatter(file), settings);
  } catch {
    return null;
  }
}

/**
 * Where `path` sits in the vault. Reads the live tree and the settings passed
 * in (no cache, so renames and settings changes need no invalidation) and never
 * throws. A missing path is "none": it guesses nothing from its ancestors.
 */
export function classify<F extends Named, D extends Named>(
  tree: VaultTree<F, D>, settings: ClassifySettings, path: string | null,
): Placement<F, D> {
  const none: Placement<F, D> = { path: path ?? "", kind: "none", markdown: false, book: null, tracked: false, piece: null };
  if (typeof path !== "string" || path === "") return none;
  if (path === "/") return { ...none, kind: "folder" };
  try {
    const ch = chaptersRel(settings);
    const file = tree.file(path);
    if (file) {
      const markdown = path.endsWith(".md");
      const tracked = markdown && isTracked(path, settings);
      const piece = markdown ? pieceOf(tree, file, settings) : null;
      // The book note comes first: a book note inside another book's folder belongs to its own book.
      const own = markdown ? bookAt(tree, path.slice(0, -3), ch) : null;
      if (own) return { path, kind: "book-note", markdown, book: own, tracked, piece };
      const book = ancestorBook(tree, path, ch);
      if (book) {
        // compare against the handle's path, never the settings string
        const kind: Kind = markdown && parentOf(path) === book.chaptersFolder.path ? "chapter" : "book-file";
        return { path, kind, markdown, book, tracked, piece };
      }
      return { path, kind: markdown ? "note" : "file", markdown, book: null, tracked, piece };
    }
    if (tree.folder(path)) {
      const own = bookAt(tree, path, ch);
      if (own) return { ...none, path, kind: "book-folder", book: own };
      const book = ancestorBook(tree, path, ch);
      const kind: Kind = book && book.chaptersFolder.path === path ? "chapters-folder" : "folder";
      return { ...none, path, kind, book };
    }
  } catch {
    // a failing lookup reads as "nothing here"
  }
  return none;
}

/**
 * Every book in the vault: a non-root folder F with a file F.md and a folder
 * F/<chaptersFolder>, the same rule as classify. Sorted by title.
 */
export function listBooks<F extends Named, D extends Named>(tree: VaultTree<F, D>, settings: ClassifySettings): BookOf<F, D>[] {
  const ch = chaptersRel(settings);
  const out: BookOf<F, D>[] = [];
  try {
    for (const d of tree.folders()) {
      const b = bookAt(tree, d.path, ch);
      if (b) out.push(b);
    }
  } catch {
    // a vault that can't be listed has no books to show
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}
