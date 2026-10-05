// Pure lens settings helpers: no obsidian imports. settings.ts (normalizeSettings) reads this.

/** The setting as a vault path: trimmed, no leading or trailing "/", "//" collapsed, ".md" added. "" stays "". */
export function listsPath(setting: string): string {
  const s = setting.trim().replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!s) return "";
  return /\.md$/i.test(s) ? s : `${s}.md`;
}
