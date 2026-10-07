// The export module's decisions, with no Obsidian imports (PLAN-0.8 Q3, Q4, Q7, Q17):
// which chapters a selection takes, what the file is called, the author, the last
// export's caption, and how a path-keyed choice follows a rename. index.ts and
// modal.ts are thin around these.

import type { ExportChoice, ExportFormat, ExportSelection, LastExport } from "../data";
import { chapterHeadings, type Author } from "../core/export-pipeline";
import type { ChapterRef } from "../core/book-source";
import { dropKeys, movedPath, renameKeys } from "../core/path-keys";
import { safeFileName } from "../core/book";

// ------------------------------------------------------------------ chapters

export interface ChapterPlan {
  /** the chapters that export takes, in book order, with their manuscript headings */
  chosen: { ref: ChapterRef; heading: string }[];
  /** every included chapter (compile not false), in book order, with its heading: what the picker lists */
  included: { ref: ChapterRef; heading: string }[];
  /** the chapters `compile: false` keeps out, always */
  left: ChapterRef[];
}

/**
 * The chapters a selection takes. Headings are numbered over every included chapter
 * before the selection narrows the list (core/export-pipeline `chapterHeadings`), so
 * exporting chapters 5-7 keeps "Chapter 5", "6", "7". A range is 1-based positions in
 * the included list, clamped to it, and swapped when written backwards; ticked paths
 * that are no longer chapters are ignored.
 */
export function planChapters(all: readonly ChapterRef[], selection: ExportSelection, format: string, unnumbered: string | readonly string[] = []): ChapterPlan {
  const kept = all.filter((c) => c.include);
  const heads = chapterHeadings(kept, format, unnumbered);
  const included = kept.map((ref, i) => ({ ref, heading: heads[i] }));
  const left = all.filter((c) => !c.include);
  let chosen = included;
  if (selection.mode === "range") {
    const lo = Math.max(1, Math.min(selection.from, selection.to));
    const hi = Math.min(included.length, Math.max(selection.from, selection.to));
    chosen = included.slice(lo - 1, Math.max(lo - 1, hi));
  } else if (selection.mode === "pick") {
    const want = new Set(selection.paths);
    chosen = included.filter((c) => want.has(c.ref.path));
  }
  return { chosen, included, left };
}

// ------------------------------------------------------------------ names

/** Fixed file-name label of a preset: "Shunn", "pt-BR" (the same in every language). */
export function presetLabel(id: string): string {
  if (id === "shunn") return "Shunn";
  if (id === "ptbr") return "pt-BR";
  return id;
}

/** A work's title as a file name: what Obsidian refuses becomes a space; never empty. */
export function fileTitle(title: string): string {
  const s = safeFileName(title).replace(/[. ]+$/, "").trim();
  return s === "" ? "Export" : s;
}

/** `<title>.md`, or `<title> (<preset>).docx` / `.epub` (Q3; D2: an EPUB names its preset as DOCX does). */
export function exportFileName(title: string, format: ExportFormat, preset: string): string {
  const base = fileTitle(title);
  if (format === "md") return `${base}.md`;
  return `${base} (${presetLabel(preset)}).${format}`;
}

/** "2026-10-05 14h32", local time (the keep-both name, G1). */
export function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}h${p(d.getMinutes())}`;
}

/** The keep-both name: `<title> (<preset>) YYYY-MM-DD HHhMM.docx` (or `.epub`), or `<title> YYYY-MM-DD HHhMM.md`. */
export function keepBothName(title: string, format: ExportFormat, preset: string, at: Date): string {
  const base = fileTitle(title);
  if (format === "md") return `${base} ${stamp(at)}.md`;
  return `${base} (${presetLabel(preset)}) ${stamp(at)}.${format}`;
}

/** folder + name, without a doubled or leading slash; an empty folder is the vault root. */
export function inFolder(folder: string, name: string): string {
  const f = folder.replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
  return f === "" ? name : `${f}/${name}`;
}

// ------------------------------------------------------------------ author, front matter

/** The text of a property that links to a note: `[[Dedicatória|x]]` → "Dedicatória"; plain text as is; else null. */
export function linkTarget(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^\s*\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]\s*$/.exec(value);
  const target = (m ? m[1] : value).trim();
  return target === "" ? null : target;
}

/**
 * The link a cover property holds (Q8, D3): `[[capa.png]]`, `![[capa.png]]`, `[[pasta/capa.png|x]]`
 * or plain text; YAML reads an unquoted `[[x]]` as a nested list, so the first text inside a list
 * counts. Null when there is none.
 */
export function coverLink(value: unknown): string | null {
  let v: unknown = value;
  while (Array.isArray(v)) v = v[0];
  if (typeof v !== "string") return null;
  return linkTarget(v.trim().replace(/^!/, ""));
}

/** The image type of a cover from its first bytes (JPEG or PNG), else null: the extension is not trusted. */
export function coverMediaType(data: Uint8Array): "image/jpeg" | "image/png" | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length >= png.length && png.every((b, i) => data[i] === b)) return "image/png";
  return null;
}

/** A string property, trimmed; "" when it is missing or not text. */
function textOf(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Who wrote it (Q2). The name comes from the `authorProperty` setting (`author`) on the work, else the
 * settings. The surname is the settings' own when the name is the settings' name, and
 * the name's last word otherwise (or when the setting is empty).
 */
export function authorOf(
  settings: { authorProperty: string; authorName: string; authorSurname: string; contactLines: string },
  frontmatter: Record<string, unknown> | null | undefined,
): Author {
  const key = settings.authorProperty.trim();
  const own = key ? textOf(frontmatter?.[key]) : "";
  const name = own !== "" ? own : settings.authorName.trim();
  const configured = own !== "" ? "" : settings.authorSurname.trim();
  const surname = configured !== "" ? configured : name.split(/\s+/).filter(Boolean).pop() ?? "";
  const contact = settings.contactLines.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  return { name, surname, contact };
}

// ------------------------------------------------------------------ last export

/** "3 Oct" / "3 out" in the given locale (BCP 47), day first, no dot and no "de". */
export function dayMonthText(date: Date, locale: string): string {
  try {
    const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(/\./g, "").trim();
    return `${date.getDate()} ${month}`;
  } catch {
    return date.toISOString();
  }
}

/** "3 Oct, 14:32" (en) or "3 out, 14:32" (pt-BR): the time is built by hand, always 24-hour. */
export function whenText(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(d).replace(/\./g, "").trim();
    const time = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return `${d.getDate()} ${month}, ${time}`;
  } catch {
    return iso;
  }
}

/** The choice to repeat: what the last export used. */
export function choiceOfLast(last: LastExport): ExportChoice {
  return { format: last.format, preset: last.preset, whole: last.whole, chapters: last.chapters, last };
}

// ------------------------------------------------------------------ following renames (Q17)

function mapPaths(c: ExportChoice, fn: (path: string) => string | null): boolean {
  let changed = false;
  const sel = (s: ExportSelection | undefined): ExportSelection | undefined => {
    if (!s || s.mode !== "pick") return s;
    const paths = s.paths.map((p) => {
      const to = fn(p);
      if (to !== null && to !== p) changed = true;
      return to ?? p;
    });
    return { mode: "pick", paths };
  };
  if (c.chapters) c.chapters = sel(c.chapters);
  if (c.last) {
    c.last.chapters = sel(c.last.chapters) ?? { mode: "all" };
    const to = fn(c.last.path);
    if (to !== null && to !== c.last.path) {
      c.last.path = to;
      changed = true;
    }
    if (c.last.folder !== undefined) {
      const dir = fn(c.last.folder);
      if (dir !== null && dir !== c.last.folder) {
        c.last.folder = dir;
        changed = true;
      }
    }
    if (c.last.source !== undefined) {
      const src = fn(c.last.source);
      if (src !== null && src !== c.last.source) {
        c.last.source = src;
        changed = true;
      }
    }
  }
  return changed;
}

/** A note or folder moved: the keys, the ticked chapters and the last file follow it. True when something changed. */
export function renameChoices(choices: Record<string, ExportChoice>, oldPath: string, newPath: string): boolean {
  let changed = renameKeys(choices, oldPath, newPath);
  for (const c of Object.values(choices)) {
    if (mapPaths(c, (p) => movedPath(p, oldPath, newPath))) changed = true;
  }
  return changed;
}

/**
 * A note or folder deleted: its keys go, and so do ticked chapters under it. A last
 * export whose file is deleted keeps its record: "Export again" checks the file when
 * it runs and asks where to write when it is gone (Q17).
 */
export function dropChoices(choices: Record<string, ExportChoice>, path: string): boolean {
  let changed = dropKeys(choices, path);
  const under = (p: string) => p === path || p.startsWith(path + "/");
  for (const c of Object.values(choices)) {
    if (c.chapters?.mode === "pick" && c.chapters.paths.some(under)) {
      c.chapters = { mode: "pick", paths: c.chapters.paths.filter((p) => !under(p)) };
      changed = true;
    }
    const lp = c.last?.chapters;
    if (c.last && lp?.mode === "pick" && lp.paths.some(under)) {
      c.last.chapters = { mode: "pick", paths: lp.paths.filter((p) => !under(p)) };
      changed = true;
    }
  }
  return changed;
}

// ------------------------------------------------------------------ repeating an export (Q17)

const dirOf = (path: string): string => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const nameOf = (path: string): string => path.split("/").pop() ?? path;

/**
 * The last file is still where the export wrote it: same folder, same name (a keep-both
 * name counts, it is what was written). A rename or a move, even inside the export
 * folder, makes it "moved" and Export again asks where to write. Entries saved before
 * the folder and name were remembered are taken as in place.
 */
export function lastInPlace(last: LastExport): boolean {
  if (last.folder === undefined || last.name === undefined) return true;
  return dirOf(last.path) === last.folder && nameOf(last.path) === last.name;
}

/** The folder and file name to remember for a file just written. */
export function placeOf(path: string): { folder: string; name: string } {
  return { folder: dirOf(path), name: nameOf(path) };
}

/**
 * Whether "Export again" may write on its own for this target: it repeats the same
 * kind of export. A chapter exported alone is repeated from that chapter only, a whole
 * book from any file of the book; anything else needs the modal.
 */
export function canRepeat(last: LastExport, now: { whole: boolean; inBook: boolean; path: string }): boolean {
  if (now.whole !== last.whole) return false;
  return last.whole || !now.inBook || last.source === now.path;
}

// ------------------------------------------------------------------ collections

/**
 * The link a collection note lists a story by (Q25): `[[Name]]`, or `[[folder/Name]]` when
 * another note shares the name (`ambiguous`), so `collectionOf` resolves the story it was made from.
 */
export function storyLink(path: string, ambiguous: boolean): string {
  const bare = path.replace(/\.md$/i, "");
  return `[[${ambiguous ? bare : bare.split("/").pop() ?? bare}]]`;
}

/**
 * A new collection note (Q25): the `property` as a YAML list of quoted `[[links]]` in the
 * order given, and nothing else. Quoted, so YAML doesn't read `[[A]]` as a nested list;
 * a property name that isn't plain is quoted too.
 */
export function collectionNoteText(property: string, links: readonly string[]): string {
  const quote = (s: string): string => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const key = /^[\p{L}\p{N}_-]+$/u.test(property) ? property : quote(property);
  return ["---", `${key}:`, ...links.map((l) => `  - ${quote(l)}`), "---", ""].join("\n");
}

// ------------------------------------------------------------------ explorer order (0.9, Q25)

/** Obsidian's "File explorer: sort files by" values (`fileSortOrder` in the vault config). */
export type ExplorerSort =
  | "alphabetical" | "alphabeticalReverse"
  | "byModifiedTime" | "byModifiedTimeReverse"
  | "byCreatedTime" | "byCreatedTimeReverse";

export interface SortableFile { path: string; ctime: number; mtime: number }

const NATURAL = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** The sort setting as the vault config gives it; anything unknown is the default, name A to Z. */
export function explorerSortOf(value: unknown): ExplorerSort {
  switch (value) {
    case "alphabetical": case "alphabeticalReverse":
    case "byModifiedTime": case "byModifiedTimeReverse":
    case "byCreatedTime": case "byCreatedTimeReverse":
      return value;
    default: return "alphabetical";
  }
}

/**
 * The files in the order the file explorer lists them, top to bottom (Q25): at every folder
 * level the folders come before the files, each group in the explorer's sort. Names compare
 * naturally ("2" before "10"). The time sorts apply to files that sit in the same folder
 * (a folder has no time here); everything else falls back to the name. Returns a new array.
 */
export function sortLikeExplorer<T extends SortableFile>(files: readonly T[], sort: ExplorerSort): T[] {
  const reverse = sort.endsWith("Reverse");
  const byTime = sort.startsWith("byModified") ? "mtime" : sort.startsWith("byCreated") ? "ctime" : null;
  const cmp = (a: T, b: T): number => {
    const sa = a.path.split("/");
    const sb = b.path.split("/");
    let i = 0;
    while (i < sa.length && i < sb.length && sa[i] === sb[i]) i++;
    if (i >= sa.length || i >= sb.length) return sa.length - sb.length;
    const aFile = i === sa.length - 1;
    const bFile = i === sb.length - 1;
    if (aFile !== bFile) return aFile ? 1 : -1;            // folders first, whatever the order
    let r = 0;
    if (aFile && byTime) r = a[byTime] - b[byTime];       // siblings: newest-last, reversed by the setting
    if (r === 0) r = NATURAL.compare(sa[i], sb[i]);
    return reverse ? -r : r;
  };
  return [...files].sort(cmp);
}
