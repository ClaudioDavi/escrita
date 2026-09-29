// Pure helpers for the book/chapter file convention (no Obsidian imports):
//
//   Novels/A Casa.md                 ← the book note (frontmatter: goal, deadline, …)
//   Novels/A Casa/<chaptersFolder>/  ← one note per chapter
//       01 Chegada.md
//       02 A porta fechada.md
//
// The numeric prefix orders chapters and is managed by the plugin.

const PREFIX = /^(\d+)(?:[ \t._-]+|$)/;

export function chapterNumber(basename: string): number | null {
  const m = PREFIX.exec(basename);
  return m ? Number(m[1]) : null;
}

export function chapterTitle(basename: string): string {
  return basename.replace(PREFIX, "").trim() || basename;
}

export function compareChapters(a: string, b: string): number {
  const na = chapterNumber(a), nb = chapterNumber(b);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  if (na !== null && nb === null) return -1;
  if (na === null && nb !== null) return 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

export function numberedName(index1: number, title: string, pad: number): string {
  return `${String(index1).padStart(pad, "0")} ${title}`;
}

export interface RenamePlan { from: string; to: string }

/**
 * Given chapter basenames in their desired order, return the renames that
 * make every prefix equal its 1-based position. Unchanged names are omitted.
 * Width grows past `pad` when there are more chapters than digits allow.
 */
export function planRenumber(ordered: string[], pad: number): RenamePlan[] {
  const width = Math.max(pad, String(ordered.length).length);
  const plan: RenamePlan[] = [];
  ordered.forEach((name, i) => {
    const to = numberedName(i + 1, chapterTitle(name), width);
    if (to !== name) plan.push({ from: name, to });
  });
  return plan;
}

/** Characters Obsidian refuses in file names. */
export function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
}
