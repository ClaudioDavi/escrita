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
