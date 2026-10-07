// Where a file sits in the writer's vault (no Obsidian imports). Every module
// asks this first: is it a chapter, a book note, another file of a book, a
// loose note, and is writing in it tracked? The vault is reached through a tiny
// read-only port, `VaultTree`, the way core/chapter-engine reaches a chapters
// folder through `ChapterFs`; core/books.ts adapts the real vault to it.

import { folderList, folderListOf } from "./lists";
import { readPiece, type Piece, type PieceProperties } from "./measure";
import { DEFAULT_STAGES, DEFAULT_STATUS_PROPERTY, readStatus, stageOf, type Stage, type StageMapping } from "./stages";
// one direction only: classify imports scope, scope never imports classify (no cycle at load)
import { inFolder, NO_SCOPE, scopeFor, type Scope, type ScopeLookup, type ScopeMode, type ScopeSettings } from "./scope";
// inFolder and NO_SCOPE live in core/scope.ts (0.9); re-exported so their callers keep importing them from here
export { inFolder, NO_SCOPE };

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
  /**
   * The vault path a link points at, as seen from the note at `from` (0.9, IMPROVEMENTS 9):
   * Obsidian's link resolution, so "Universo", "[[Universo]]" and "[[Universo|o mundo]]"
   * all find Universo.md. null when it points at no file. The scope rule reads a
   * `universe` property through it (core/scope.ts ScopeLookup.resolve). The adapter in
   * core/books.ts: metadataCache.getFirstLinkpathDest(linkText(link) ?? link, from)?.path ?? null.
   */
  resolve(link: string, from: string): string | null;
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
  /**
   * The scope keys (0.9, IMPROVEMENTS 9; PLAN-0.9 Q15): what `Placement.scope` reads.
   * EscritaSettings has all four (UniverseSettings). Optional so the many hand-built test
   * settings stay valid: a missing `universeMode` means "off" (every scope is none), and
   * the others take UniverseSettings' defaults ("Universe.md", "", "universe").
   */
  universeMode?: ScopeMode;
  universeNote?: string;
  defaultUniverseFolders?: string;
  /** the property on a work, chapter or entry that links its universe note */
  universeProperty?: string;
}

/** The snapshots folder when the setting is empty or unusable. */
export const DEFAULT_SNAPSHOTS_FOLDER = "Escrita/Snapshots";

/** The submissions folder when the setting is empty or missing (SF 12, settings summary). */
export const DEFAULT_SUBMISSIONS_FOLDER = "Escrita/Submissions";

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
   * Where the piece's target comes from (1.0, IMPROVEMENTS 8). The rule, one for every
   * surface (outline, explorer, goals modal, measurer): per field, a note's own target
   * wins; a chapter without one takes its book's default (`chapterTargetProperty` on the
   * book note, with the book's `unit` when the chapter sets none); `limit` and `deadline`
   * are only ever the note's own. That is `effectivePiece` in core/measure.ts, applied here.
   * - "own": the target is the note's own frontmatter.
   * - "book": a chapter's target is its book's default (only `kind === "chapter"`).
   * - null: no target (no piece, or a piece with only a limit, unit or deadline).
   *
   * Wave 0: set from today's `piece` ("own" when it has a target, else null) and read by
   * nobody. Task 1.1 computes the book default here and makes `piece` the effective piece
   * (a chapter with only a book default then has a piece, with source "book"); until then
   * `piece` keeps today's value, the note's own (readPiece). A standalone piece stays
   * `kind === "note" && piece`: book defaults reach chapters only. Cached counts keyed by
   * the chapter's mtime must also drop when the book note changes (task 1.1's call).
   */
  pieceSource: "own" | "book" | null;
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
  /**
   * Which world the path lives in (0.9, IMPROVEMENTS 9; PLAN-0.9 Q15): core/scope.ts
   * `scopeFor` with the settings' scope keys and a lookup built on this tree (the book
   * from this placement, the `universeProperty` from frontmatter, links through
   * `VaultTree.resolve`). Set on every placement, folders and "none" included; NO_SCOPE
   * when the universe mode is off or nothing applies. A field, never a new kind (the
   * growth rule). The frontmatter read is shared with `piece` and `stage`.
   */
  scope: Scope;
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

/**
 * A folder setting after the folder `oldPath` was renamed or moved to `newPath`: the new
 * setting when `current` is that folder or inside it, else null (nothing to change). Both
 * paths are vault paths of the folder that moved; the setting is normalized first.
 */
export function followFolderSetting(current: string, oldPath: string, newPath: string): string | null {
  const root = folderRoot(current, "");
  const from = folderRoot(oldPath, "");
  if (root === "" || from === "" || !inFolder(root, from)) return null;
  return folderRoot(newPath, "") + root.slice(from.length);
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
 * One fingerprint of every setting `classify` reads except the scope keys (IMPROVEMENTS 16):
 * folders, chapters folder, chapter template, snapshots, submissions and export folders
 * (normalized, so "" and the default key alike), status property, stages, the piece
 * properties. Every index spec whose values depend on classify composes it into its
 * `settingsKey`, so a new classify input is added here once and every index rebuilds on it.
 * A spec that also reads `Placement.scope` composes scopeKey too. Stable for equal settings.
 */
export function classifyKey(s: ClassifySettings): string {
  return JSON.stringify([
    str(s.trackFolders), str(s.excludeFolders), str(s.chaptersFolder), str(s.chapterTemplate),
    snapshotsRoot(s.snapshotsFolder), submissionsRoot(s.submissionsFolder), exportRoot(s.exportFolder),
    str(s.statusProperty), s.stages ?? null,
    str(s.targetProperty), str(s.limitProperty), str(s.unitProperty), str(s.deadlineProperty),
  ]);
}

/**
 * The four scope keys `Placement.scope` reads (0.9, PLAN-0.9 Q16; a missing mode keys as
 * "off"), apart from classifyKey so a universe setting change rebuilds only the specs whose
 * values depend on scope (the universe's entries, threads, mentions and names indexes).
 */
export function scopeKey(s: Pick<ClassifySettings, "universeMode" | "universeNote" | "defaultUniverseFolders" | "universeProperty">): string {
  return JSON.stringify([str(s.universeMode) || "off", str(s.universeNote), str(s.defaultUniverseFolders), str(s.universeProperty)]);
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
  const track = folderListOf(str(settings.trackFolders));
  if (track.length > 0 && !track.some((f) => inFolder(path, f))) return false;
  if (folderListOf(str(settings.excludeFolders)).some((f) => inFolder(path, f))) return false;
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
 * The tree-backed ScopeLookup for `path` (core/scope.ts): its book as classify found it (the
 * lookup answers for `path` only), the `universeProperty` from frontmatter (`own.fm` when
 * classify already read it for `path`), links through `VaultTree.resolve`. keptOut reads it
 * too (books.scopeLookup), so the scope and `universe: false` agree.
 */
export function scopeLookup<F extends Named, D extends Named>(
  tree: VaultTree<F, D>, settings: ClassifySettings, path: string, book: BookOf<F, D> | null,
  own?: { fm: Record<string, unknown> | undefined },
): ScopeLookup {
  const prop = settings.universeProperty ?? "universe";
  return {
    book: (p) => (book && p === path ? { note: book.note.path, folder: book.folder.path } : null),
    universe: (p) => {
      if (own && p === path) return own.fm?.[prop];
      const f = tree.file(p);
      return f ? frontmatterOf(tree, f)?.[prop] : undefined;
    },
    resolve: (link, from) => tree.resolve(link, from),
  };
}

/** The settings' scope keys as ScopeSettings, with UniverseSettings' defaults for the missing ones. */
export function scopeSettings(settings: ClassifySettings): ScopeSettings {
  return {
    universeMode: settings.universeMode ?? "off",
    universeNote: settings.universeNote ?? "Universe.md",
    defaultUniverseFolders: settings.defaultUniverseFolders ?? "",
  };
}

/**
 * `p` with its `scope` (never throws; none when the mode is off). Computed at once: a lazy
 * getter (Object.defineProperty per placement) measured slower on the bench than the
 * scope itself, once its frontmatter read is shared with classify's (`own`).
 */
function withScope<F extends Named, D extends Named>(
  p: Omit<Placement<F, D>, "scope">, tree: VaultTree<F, D>, settings: ClassifySettings,
  own?: { fm: Record<string, unknown> | undefined },
): Placement<F, D> {
  let scope: Scope = NO_SCOPE;
  if ((settings.universeMode ?? "off") !== "off") {
    try {
      scope = scopeFor({ path: p.path }, scopeSettings(settings), scopeLookup(tree, settings, p.path, p.book, own));
    } catch {
      // a failing lookup reads as no scope
    }
  }
  return { ...p, scope };
}

/**
 * Where `path` sits in the vault. Reads the live tree and the settings passed
 * in (no cache, so renames and settings changes need no invalidation) and never
 * throws. A missing path is "none": it guesses nothing from its ancestors.
 */
export function classify<F extends Named, D extends Named>(
  tree: VaultTree<F, D>, settings: ClassifySettings, path: string | null,
): Placement<F, D> {
  const none: Placement<F, D> = { path: path ?? "", kind: "none", markdown: false, book: null, tracked: false, piece: null, pieceSource: null, snapshot: false, stage: null, submission: false, export: false, scope: NO_SCOPE };
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
      const pieceSource = piece?.target !== undefined ? "own" as const : null;
      // The book note comes first: a book note inside another book's folder belongs to its own book.
      const own = markdown ? bookAt(tree, path.slice(0, -3), ch) : null;
      const read = markdown ? { fm } : undefined;
      if (own) return withScope({ path, kind: "book-note", markdown, book: own, tracked, piece, pieceSource, snapshot: false, stage: stageFor(fm, tracked, settings), submission: false, export: false }, tree, settings, read);
      const book = ancestorBook(tree, path, ch);
      if (book) {
        // compare against the handle's path, never the settings string
        const kind: Kind = markdown && parentOf(path) === book.chaptersFolder.path ? "chapter" : "book-file";
        return withScope({ path, kind, markdown, book, tracked, piece, pieceSource, snapshot: false, stage: null, submission: false, export: false }, tree, settings, read);
      }
      return withScope({ path, kind: markdown ? "note" : "file", markdown, book: null, tracked, piece, pieceSource, snapshot: false, stage: markdown ? stageFor(fm, tracked, settings) : null, submission: false, export: false }, tree, settings, read);
    }
    if (tree.folder(path)) {
      const own = bookAt(tree, path, ch);
      if (own) return withScope({ ...none, path, kind: "book-folder", book: own }, tree, settings);
      const book = ancestorBook(tree, path, ch);
      const kind: Kind = book && book.chaptersFolder.path === path ? "chapters-folder" : "folder";
      return withScope({ ...none, path, kind, book }, tree, settings);
    }
  } catch {
    // a failing lookup reads as "nothing here"
  }
  return none;
}

/**
 * Every book in the vault: a non-root folder F with a file F.md and a folder
 * F/<chaptersFolder>, the same rule as classify. Sorted by title. Folders inside the plugin's own
 * folders are skipped, unless `skipPluginFolders` is false (a settings check that must see a book
 * a folder setting already captured).
 */
export function listBooks<F extends Named, D extends Named>(
  tree: VaultTree<F, D>, settings: ClassifySettings, skipPluginFolders = true,
): BookOf<F, D>[] {
  const ch = chaptersRel(settings);
  const out: BookOf<F, D>[] = [];
  try {
    for (const d of tree.folders()) {
      if (skipPluginFolders && (inSnapshots(d.path, settings) || inSubmissions(d.path, settings) || inExports(d.path, settings))) continue;
      const b = bookAt(tree, d.path, ch);
      if (b) out.push(b);
    }
  } catch {
    // a vault that can't be listed has no books to show
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}
