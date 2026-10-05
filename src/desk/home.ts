/** Pure rules for the home note path (no Obsidian imports). */
import { movedPath } from "../core/path-keys";

export const HOME_TEMPLATE = "```escrita-works\n```\n";

const DEFAULT_NAMES = ["Home.md", "Inicio.md"];

/** The setting as a note path: trimmed, ".md" appended when missing, "" stays "". */
export function homePath(setting: string): string {
  const s = setting.trim();
  if (!s) return "";
  return /\.md$/i.test(s) ? s : `${s}.md`;
}

/**
 * What "Open the home note" should do.
 * - setting names a note: open it if it exists, else offer to create it;
 * - setting empty and a default note exists: adopt it (never overwrite);
 * - setting empty and none exists: offer `offerName` (Home.md; the glue passes
 *   Inicio.md in pt-BR).
 */
export function homeAction(
  setting: string,
  exists: (p: string) => boolean,
  offerName = "Home.md",
): { kind: "open" | "adopt" | "offer"; path: string } {
  const path = homePath(setting);
  if (path) return { kind: exists(path) ? "open" : "offer", path };
  const found = DEFAULT_NAMES.find((n) => exists(n));
  if (found) return { kind: "adopt", path: found };
  return { kind: "offer", path: offerName };
}

/** The new home note setting after a rename or move; null when it is unaffected. */
export function homeAfterMove(setting: string, oldPath: string, newPath: string): string | null {
  const path = homePath(setting);
  if (!path) return null;
  return movedPath(path, oldPath, newPath);
}

/** The path to save as the home note setting after `action`, or null when nothing to save. */
export function settingToSave(setting: string, action: { kind: "open" | "adopt" | "offer"; path: string }): string | null {
  return action.kind === "adopt" && !homePath(setting) ? action.path : null;
}

/** The vault path that matches `path` ignoring case (the exact spelling first), or null. Vault paths are case-insensitive for creating, so "home.md" is "Home.md". */
export function resolveCaseless(paths: Iterable<string>, path: string): string | null {
  const want = path.toLowerCase();
  let loose: string | null = null;
  for (const p of paths) {
    if (p === path) return p;
    if (loose === null && p.toLowerCase() === want) loose = p;
  }
  return loose;
}
