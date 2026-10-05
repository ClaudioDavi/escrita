// Where a file sits in the writer's vault (no Obsidian imports). Every module
// asks this first: is it a chapter, a book note, another file of a book, a
// loose note, and is writing in it tracked? The vault is reached through a tiny
// read-only port, `VaultTree`, the way core/chapter-engine reaches a chapters
// folder through `ChapterFs`; core/books.ts adapts the real vault to it.

import { folderList } from "./lists";
import { readPiece, type Piece, type PieceProperties } from "./measure";
import { DEFAULT_STAGES, DEFAULT_STATUS_PROPERTY, readStatus, stageOf, type Stage, type StageMapping } from "./stages";

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
  /** where Escrita keeps snapshots; read through snapshotsRoot(), so "" means the default */
  snapshotsFolder: string;
  /** the frontmatter property holding the status; defaults to DEFAULT_STATUS_PROPERTY */
  statusProperty?: string;
  /** the writer's words for each stage; defaults to DEFAULT_STAGES */
  stages?: StageMapping;
  /**
   * Where submission notes live (SF 12; 0.8). Optional until the setting exists:
   * task 1.6 reads it through submissionsRoot(), so missing or "" means
   * DEFAULT_SUBMISSIONS_FOLDER, like the snapshots folder.
   */
  submissionsFolder?: string;
  /**
   * Where export writes its files (Q3; 0.8). Optional until the setting exists:
   * task 1.6 reads it through exportRoot(), so missing or "" means
   * DEFAULT_EXPORT_FOLDER.
   */
  exportFolder?: string;
}

/** The snapshots folder when the setting is empty or unusable. */
export const DEFAULT_SNAPSHOTS_FOLDER = "Escrita/Snapshots";

/** The submissions folder when the setting is empty or missing (SF 12, settings summary). */
export const DEFAULT_SUBMISSIONS_FOLDER = "Submissions";

/** The export folder when the setting is empty or missing (PLAN-0.8 Q3). */
export const DEFAULT_EXPORT_FOLDER = "Escrita/Exports";

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
  /**
   * The path is the snapshots folder or inside it (see snapshotsRoot). Such a
   * path is never tracked, never a piece and never part of a book: a file there
   * is a "note" or a "file", a folder there is a "folder".
   */
  snapshot: boolean;
  /** the work's stage: set only for a tracked book note or tracked note whose status is a known stage word; null for everything else */
  stage: Stage | null;
  /**
   * The path is the submissions folder or inside it (SF 12; submissionsRoot).
   * Such a note is never tracked, never a work (no stage), and
   * never gets the draft status. Checked next to `snapshot` and like it: a file
   * there is a "note" (or a "file") with no book, even when the folder sits in a book. The rule applies whether the submissions feature is on or
   * off: classify knows no features, and the notes stay what they are.
   */
  submission: boolean;
  /**
   * The path is the export folder or inside it (PLAN-0.8 Q3; exportRoot). An
   * export is derived text: a `<title>.md` there must not count a whole book
   * into the daily goal, nor become a work. So, exactly like `submission`: never
   * tracked, never a work (no stage), never gets the draft status
   * (new-note-status.ts skips `place.export`), a "note" (or a "file") with no
   * book. Applies whether the export feature is on or off.
   */
  export: boolean;
}

/** Whether `path` is `folder` itself or inside it. Slashes at the folder's edges are ignored, "" means the whole vault, case-sensitive. */
export function inFolder(path: string, folder: string): boolean {
  const f = folder.replace(/^\/+|\/+$/g, "");
  return f === "" || path === f || path.startsWith(`${f}/`);
}

/**
 * The snapshots folder setting as a vault path: trimmed, backslashes and
 * repeated slashes turned into single slashes, edge slashes stripped. Empty (or
 * not a string) gives DEFAULT_SNAPSHOTS_FOLDER, so the result is never "" and
 * never means the whole vault. The one place this normalization lives: settings,
 * classify and the snapshots module all go through it.
 */
export function snapshotsRoot(setting: unknown): string {
  return folderRoot(setting, DEFAULT_SNAPSHOTS_FOLDER);
}

function folderRoot(setting: unknown, fallback: string): string {
  const s = str(setting).trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "").trim();
  return s === "" ? fallback : s;
}

/** The submissions folder setting as a vault path, normalized like snapshotsRoot; never "" (DEFAULT_SUBMISSIONS_FOLDER). */
export function submissionsRoot(setting: unknown): string {
  return folderRoot(setting, DEFAULT_SUBMISSIONS_FOLDER);
}

/** The export folder setting as a vault path, normalized like snapshotsRoot; never "" (DEFAULT_EXPORT_FOLDER). */
export function exportRoot(setting: unknown): string {
  return folderRoot(setting, DEFAULT_EXPORT_FOLDER);
}

/**
 * One fingerprint of every setting `classify` reads (IMPROVEMENTS 16): folders,
 * chapters folder, chapter template, snapshots, submissions and export folders (normalized,
 * so "" and the default key alike), status property, stages and the piece
 * properties. Every index spec whose values depend on classify composes it into
 * its `settingsKey`, so a new classify input is added here once and every index
 * rebuilds on it. Stable for equal settings. The six specs move onto it in task 2.4.
 */
export function classifyKey(s: ClassifySettings): string {
  return JSON.stringify([
    str(s.trackFolders), str(s.excludeFolders), str(s.chaptersFolder), str(s.chapterTemplate),
    snapshotsRoot(s.snapshotsFolder), submissionsRoot(s.submissionsFolder), exportRoot(s.exportFolder),
    str(s.statusProperty), s.stages ?? null,
    str(s.targetProperty), str(s.limitProperty), str(s.unitProperty), str(s.deadlineProperty),
  ]);
}

/** Whether `path` is the submissions folder or inside it. */
export function inSubmissions(path: string, settings: Pick<ClassifySettings, "submissionsFolder">): boolean {
  return inFolder(path, submissionsRoot(settings.submissionsFolder));
}

/** Whether `path` is the export folder or inside it. */
export function inExports(path: string, settings: Pick<ClassifySettings, "exportFolder">): boolean {
  return inFolder(path, exportRoot(settings.exportFolder));
}

/** Whether `path` is the snapshots folder or inside it. */
export function inSnapshots(path: string, settings: Pick<ClassifySettings, "snapshotsFolder">): boolean {
  return inFolder(path, snapshotsRoot(settings.snapshotsFolder));
}

/** What is wrong with a snapshots folder setting, if anything (see snapshotsFolderProblem). */
export type SnapshotsFolderProblem =
  /** a ".." or "." segment: not a plain folder inside the vault */
  | { reason: "path" }
  /** the config folder (.obsidian) or inside it */
  | { reason: "config"; folder: string }
  /** inside a track folder, or holding one: notes there would stop being tracked */
  | { reason: "tracked"; folder: string }
  /** the folder already holds .md notes, which would stop being tracked */
  | { reason: "notes"; folder: string };

/**
 * Checks a snapshots folder value before it is saved. `hasNotes(root)` answers
 * whether the vault already has .md notes inside `root`. With no track folders
 * the whole vault is tracked, so only existing notes matter there.
 */
export function snapshotsFolderProblem(
  value: string, configDir: string, trackFolders: string, hasNotes: (root: string) => boolean,
): SnapshotsFolderProblem | null {
  const root = snapshotsRoot(value);
  if (root.split("/").some((seg) => seg.trim() === ".." || seg.trim() === ".")) return { reason: "path" };
  const config = configDir.trim().replace(/^\/+|\/+$/g, "");
  if (config !== "" && (inFolder(root, config) || inFolder(config, root))) return { reason: "config", folder: config };
  for (const track of folderList(str(trackFolders))) {
    if (inFolder(root, track) || inFolder(track, root)) return { reason: "tracked", folder: track };
  }
  if (hasNotes(root)) return { reason: "notes", folder: root };
  return null;
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

/** The folders containing `path`, nearest first, never the root: "A/B/c.md" gives ["A/B", "A"], "c.md" gives []. */
export function ancestors(path: string): string[] {
  const out: string[] = [];
  for (let dir = parentOf(path); dir !== "" && dir !== "/"; dir = parentOf(dir)) out.push(dir);
  return out;
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

function frontmatterOf<F extends Named, D extends Named>(tree: VaultTree<F, D>, file: F): Record<string, unknown> | undefined {
  try {
    return tree.frontmatter(file);
  } catch {
    return undefined;
  }
}

function pieceOf(fm: Record<string, unknown> | undefined, settings: ClassifySettings): Piece | null {
  try {
    return readPiece(fm, settings);
  } catch {
    return null;
  }
}

/** The one stage rule for works: only a tracked note or book note has one. */
function stageFor(fm: Record<string, unknown> | undefined, tracked: boolean, settings: ClassifySettings): Stage | null {
  if (!tracked) return null;
  try {
    const prop = typeof settings.statusProperty === "string" && settings.statusProperty.trim() !== "" ? settings.statusProperty : DEFAULT_STATUS_PROPERTY;
    return stageOf(readStatus(fm, prop), settings.stages ?? DEFAULT_STAGES);
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
  const none: Placement<F, D> = { path: path ?? "", kind: "none", markdown: false, book: null, tracked: false, piece: null, snapshot: false, stage: null, submission: false, export: false };
  if (typeof path !== "string" || path === "") return none;
  if (path === "/") return { ...none, kind: "folder" };
  try {
    const ch = chaptersRel(settings);
    const file = tree.file(path);
    // Snapshots are never writing: checked before any book lookup, so a
    // snapshots folder placed inside a book never yields chapters or book files.
    // Submissions and exports are kept out the same way (never writing, no book).
    const snapshot = inSnapshots(path, settings);
    const submission = inSubmissions(path, settings);
    const exported = inExports(path, settings);
    if (snapshot || submission || exported) {
      const flags = { snapshot, submission, export: exported };
      if (file) {
        const markdown = path.endsWith(".md");
        return { ...none, ...flags, path, kind: markdown ? "note" : "file", markdown };
      }
      if (tree.folder(path)) return { ...none, ...flags, path, kind: "folder" };
      return none;
    }
    if (file) {
      const markdown = path.endsWith(".md");
      const tracked = markdown && isTracked(path, settings);
      const fm = markdown ? frontmatterOf(tree, file) : undefined;
      const piece = markdown ? pieceOf(fm, settings) : null;
      // The book note comes first: a book note inside another book's folder belongs to its own book.
      const own = markdown ? bookAt(tree, path.slice(0, -3), ch) : null;
      if (own) return { path, kind: "book-note", markdown, book: own, tracked, piece, snapshot: false, stage: stageFor(fm, tracked, settings), submission: false, export: false };
      const book = ancestorBook(tree, path, ch);
      if (book) {
        // compare against the handle's path, never the settings string
        const kind: Kind = markdown && parentOf(path) === book.chaptersFolder.path ? "chapter" : "book-file";
        return { path, kind, markdown, book, tracked, piece, snapshot: false, stage: null, submission: false, export: false };
      }
      return { path, kind: markdown ? "note" : "file", markdown, book: null, tracked, piece, snapshot: false, stage: markdown ? stageFor(fm, tracked, settings) : null, submission: false, export: false };
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
      if (inSnapshots(d.path, settings) || inSubmissions(d.path, settings) || inExports(d.path, settings)) continue;
      const b = bookAt(tree, d.path, ch);
      if (b) out.push(b);
    }
  } catch {
    // a vault that can't be listed has no books to show
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}
