// Pure lens settings helpers: no obsidian imports. settings.ts (normalizeSettings) reads this.

import { foldName } from "../core/names";

/** The setting as a vault path: trimmed, no leading or trailing "/", "//" collapsed, ".md" added. "" stays "". */
export function listsPath(setting: string): string {
  const s = setting.trim().replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!s) return "";
  return /\.md$/i.test(s) ? s : `${s}.md`;
}

/** The "Not names" setting as a list: one word or run per line, trimmed, blanks dropped, each once. */
export function parseNotNames(setting: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of setting.split(/\r?\n/)) {
    const w = line.trim();
    if (w === "" || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/** The setting with `name` added as a new last line; null when it is already there (compared as written, ignoring case and accents). */
export function addNotName(setting: string, name: string): string | null {
  const w = name.trim();
  if (w === "") return null;
  const list = parseNotNames(setting);
  if (list.some((x) => foldName(x) === foldName(w))) return null;
  return [...list, w].join("\n");
}
