// Where snapshots live (no Obsidian imports). Layout:
//
//   <root>/<note path, .md kept>/<YYYY-MM-DD HHmm> <label>.txt
//   <root>/<note path, .md kept>/index.json
//
// Keeping ".md" in the folder name keeps note A.md's snapshots apart from the
// snapshot folders of notes inside a folder A/, and makes a note rename one
// folder move. The root setting is normalized by core's snapshotsRoot (the one
// place that rule lives); settings validation is core's snapshotsFolderProblem.
//
// The folder is named with the note path's exact bytes, but Obsidian's
// vault.create / createFolder normalize every path they are given (NBSP and
// U+202F become spaces, NFC), and macOS file systems fold NFD and NFC. So two
// notes whose paths differ only in those characters can land in one folder:
// the store detects it through index.json's "note" (foldedPath) and refuses.

import { safeFileName } from "../core/book";
import { inFolder } from "../core/classify";
import { pad2 } from "../core/dates";

/** A path as file systems and Obsidian's normalizePath may fold it: NBSP and U+202F as spaces, NFC. */
export function foldedPath(p: string): string {
  return p.replace(/[\u00A0\u202F]/g, " ").normalize("NFC");
}

/** Any segment starts with "." (Obsidian doesn't index it; reached through the adapter). */
export function isHiddenPath(p: string): boolean {
  return p.split("/").some((seg) => seg.startsWith("."));
}

/** The folder holding one note's snapshots. The note path keeps its exact bytes (NBSP, NFD accents) and its ".md". */
export function snapshotDir(root: string, notePath: string): string {
  return `${root}/${notePath}`;
}

/** The note path a snapshot folder belongs to, or null when `dir` is not a note's snapshot folder under `root`. */
export function notePathOfDir(root: string, dir: string): string | null {
  if (root === "" || !dir.startsWith(`${root}/`)) return null;
  const note = dir.slice(root.length + 1);
  return note.endsWith(".md") && note.length > 3 ? note : null;
}

/** `path` is the root itself or inside it. An empty root is no folder at all, never the whole vault. */
export function isInside(root: string, path: string): boolean {
  return root !== "" && inFolder(path, root);
}

/** Local time as "YYYY-MM-DD HHmm". */
export function stamp(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

const LABEL_MAX = 80;

/** A label safe for a file name: characters Obsidian rejects dropped, at most 80 code points, no trailing dots or spaces. */
export function labelPart(label: string): string {
  const clean = safeFileName(label).replace(/[. ]+$/, "");
  return Array.from(clean).slice(0, LABEL_MAX).join("").replace(/[. ]+$/, "");
}

function withStamp(stampText: string, label: string, taken: ReadonlySet<string>): string {
  const part = labelPart(label);
  const base = part === "" ? stampText : `${stampText} ${part}`;
  const lower = new Set(Array.from(taken, (n) => n.toLowerCase()));
  // Case-insensitive: two names differing only in case are one file on macOS and Windows.
  if (!lower.has(`${base}.txt`.toLowerCase())) return `${base}.txt`;
  for (let n = 2; ; n++) {
    const name = `${base} (${n}).txt`;
    if (!lower.has(name.toLowerCase())) return name;
  }
}

/** `${stamp} ${label}.txt`, with " (2)", " (3)"… when that name (in any case) is taken; an empty label gives `${stamp}.txt`. */
export function snapshotFileName(d: Date, label: string, taken: ReadonlySet<string>): string {
  return withStamp(stamp(d), label, taken);
}

// the label never starts with the collision suffix: "0705 (2).txt" has no label
const FILE_NAME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})(?: (?!\(\d+\)\.txt$)(.*?))?(?: \((\d+)\))?\.txt$/;

/** The local time and the label of a snapshot file name (collision suffix dropped), or null for any other name. */
export function parseSnapshotFileName(name: string): { taken: number; name: string } | null {
  const m = FILE_NAME.exec(name);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return { taken: date.getTime(), name: m[6] ?? "" };
}

/** A new name for a snapshot file that keeps its stamp. `file` itself doesn't count as taken. */
export function renamedFileName(file: string, newLabel: string, taken: ReadonlySet<string>): string {
  const m = /^(\d{4}-\d{2}-\d{2} \d{4})/.exec(file);
  if (!m) throw new Error(`not a snapshot file name: ${file}`);
  const others = new Set(Array.from(taken).filter((n) => n !== file));
  return withStamp(m[1], newLabel, others);
}
