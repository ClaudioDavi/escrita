// Path helpers (IMPROVEMENTS 33, 1.0.4): one rule per path question. Pure, no Obsidian
// imports. Paths are vault paths with "/" separators; nothing here calls normalizePath.
//
// The rules, pinned in tests/paths.test.ts:
// - the vault root is "" (a parent, a clean folder);
// - ".md" is matched without case (`withMd`, `noMd`, `noteName`);
// - `cleanFolder` trims spaces and the slashes at the edges, nothing else: a "\" stays a
//   "\" (classify's folder settings keep their own fuller rule, `cleanVaultFolder`, on purpose);
// - `joinPath` is the export's join: it also turns "\" into "/" and collapses "//";
// - `isUnder` with an empty folder answers `emptyMatches` (default false).

/** The folder holding `path`; "" at the vault root. */
export function parentOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

/** The last segment of `path`, with its extension. */
export function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** The last segment without ".md" (any case): the note's name as the explorer shows it. */
export function noteName(path: string): string {
  return noMd(baseName(path));
}

/** `path` with ".md" added when it doesn't end in it (any case). */
export function withMd(path: string): string {
  return /\.md$/i.test(path) ? path : `${path}.md`;
}

/** `path` without a trailing ".md" (any case). */
export function noMd(path: string): string {
  return path.replace(/\.md$/i, "");
}

/** A folder as typed in a setting or a field: spaces and edge slashes trimmed; "" is the vault root. */
export function cleanFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, "").trim();
}

/**
 * A folder setting as a vault path, the fuller rule of classify's folder settings: trimmed,
 * backslashes and repeated slashes turned into single slashes, edge slashes stripped.
 */
export function cleanVaultFolder(v: string): string {
  return v.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "").trim();
}

/** The lens's word lists setting as a vault path: trimmed, no leading or trailing "/", "//" collapsed, ".md" added. "" stays "". */
export function listsPath(setting: string): string {
  const s = setting.trim().replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!s) return "";
  return withMd(s);
}

/** A note path as typed: edge slashes stripped, `.md` added; blank gives the fallback. */
export function normalizeNotePath(v: string, fallback: string): string {
  const p = v.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (p === "" || p.toLowerCase() === ".md") return fallback;
  return withMd(p);
}

/** folder + name, without a doubled or leading slash; an empty folder is the vault root. */
export function joinPath(folder: string, name: string): string {
  const f = folder.replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
  return f === "" ? name : `${f}/${name}`;
}

/**
 * Whether `path` is `folder` itself or inside it, case-sensitive. The folder's edge slashes
 * are ignored. An empty folder answers `emptyMatches`: true where "" means the whole vault
 * (a scope), false where it means "no folder" (path-keyed data).
 */
export function isUnder(path: string, folder: string, o: { emptyMatches?: boolean } = {}): boolean {
  const f = folder.replace(/^\/+|\/+$/g, "");
  if (f === "") return o.emptyMatches ?? false;
  return path === f || path.startsWith(`${f}/`);
}
