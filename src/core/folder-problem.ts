import { exportRoot, inExports, inFolder, inSnapshots, inSubmissions, snapshotsFolderProblem, submissionsRoot, snapshotsRoot, type ClassifySettings, type SnapshotsFolderProblem } from "./classify";

/** What is wrong with a plugin folder setting (export, submissions, snapshots), if anything. */
export type FolderProblem = SnapshotsFolderProblem
  /** it holds, or sits inside, another of the plugin's own folders */
  | { reason: "overlap"; folder: string }
  /** it sits inside a book (or its chapters folder) */
  | { reason: "book"; folder: string }
  /** it holds a book (the book's folder or note is inside it) */
  | { reason: "holds-book"; folder: string };

type FolderSettings = Pick<ClassifySettings, "exportFolder" | "submissionsFolder" | "snapshotsFolder">;

/** The roots of the three plugin folders, as saved right now. */
export function pluginFolders(s: FolderSettings): { export: string; submissions: string; snapshots: string } {
  return { export: exportRoot(s.exportFolder), submissions: submissionsRoot(s.submissionsFolder), snapshots: snapshotsRoot(s.snapshotsFolder) };
}

/** The first of `others` that `root` contains or sits inside, if any. */
export function overlapProblem(root: string, others: readonly string[]): FolderProblem | null {
  for (const o of others) if (inFolder(root, o) || inFolder(o, root)) return { reason: "overlap", folder: o };
  return null;
}

/** A book's two paths, all the book check needs. */
export type BookPaths = { note: { path: string }; folder: { path: string } };

/**
 * The first book that `root` sits inside (its folder or chapters folder) or holds (its folder or
 * note). Pass every book, even one inside a plugin folder (see BookService.allBooksEverywhere).
 */
export function bookProblem(root: string, books: readonly BookPaths[]): FolderProblem | null {
  for (const b of books) {
    if (inFolder(root, b.folder.path)) return { reason: "book", folder: b.folder.path };
    if (inFolder(b.folder.path, root) || inFolder(b.note.path, root)) return { reason: "holds-book", folder: root };
  }
  return null;
}

/**
 * Checks a plugin folder value (already normalized to `root`) before it is saved: a plain folder
 * inside the vault, not the config folder, not a track folder, not another plugin folder, and
 * not a place that already holds the writer's notes (`hasNotes(root)`), and not inside or around a
 * book (`books`: all of them).
 */
export function pluginFolderProblem(
  root: string, others: readonly string[], configDir: string, trackFolders: string, hasNotes: (root: string) => boolean,
  books: readonly BookPaths[] = [],
): FolderProblem | null {
  return snapshotsFolderProblem(root, configDir, trackFolders, () => false)
    ?? overlapProblem(root, others)
    ?? bookProblem(root, books)
    ?? (hasNotes(root) ? { reason: "notes", folder: root } : null);
}

/**
 * Whether `paths` has a note inside `root` that is not one of the plugin's own files (export,
 * submissions or snapshots, by the saved settings). The folder that is already saved is never a
 * problem: it is full of the plugin's own files by design.
 */
export function holdsOwnNotes(paths: readonly string[], root: string, current: string, s: FolderSettings): boolean {
  if (root === current) return false;
  return paths.some((p) => inFolder(p, root) && !inExports(p, s) && !inSubmissions(p, s) && !inSnapshots(p, s));
}
