// Pure helpers for list-like settings (no Obsidian imports).

/** "a, b\nc" → ["a", "b", "c"]: split on newlines and commas, trimmed, empties dropped, duplicates removed. */
export function lineList(s: string | null | undefined): string[] {
  if (typeof s !== "string") return [];
  const out: string[] = [];
  for (const x of s.split(/[\r\n,]+/)) {
    const v = x.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** "Novels, /Contos/\nDrafts" → ["Novels", "Contos", "Drafts"]: folder settings, trimmed, edge slashes stripped, empties dropped. */
export function folderList(s: string): string[] {
  return s.split(/[\n,]/).map((x) => x.trim().replace(/^\/+|\/+$/g, "")).filter(Boolean);
}

const parsedFolders = new Map<string, readonly string[]>();

/**
 * folderList, parsed once per setting text: for the per-path rules (classify's tracked test,
 * the scope's default-universe folders) that run on every file. Read-only; a few texts at most
 * are live at once (the cache is dropped past 32).
 */
export function folderListOf(s: string): readonly string[] {
  let hit = parsedFolders.get(s);
  if (!hit) {
    if (parsedFolders.size >= 32) parsedFolders.clear();
    hit = Object.freeze(folderList(s));
    parsedFolders.set(s, hit);
  }
  return hit;
}
