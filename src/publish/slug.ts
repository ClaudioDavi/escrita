// Pure URL helpers (no Obsidian imports). They mirror how the author's site
// (an Astro site reading the vault) derives a note's address:
//
//   - a note (a conto, a texto, a book note): slugify(slug property || file stem)
//   - a book chapter: slugify(slug property || file stem without its number),
//     under its book: "<book slug>/<chapter slug>"
//
// slugify is the same algorithm as the site's: NFD, strip diacritics,
// lowercase, runs of anything but a-z/0-9 become "-", no leading/trailing "-".

/** "O Coração do Mar" → "o-coracao-do-mar" */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** File name without folder or extension: "Contos/O farol.md" → "O farol". */
export function stem(path: string): string {
  return (path.split("/").pop() ?? "").replace(/\.md$/i, "");
}

/** "03 A chegada" → { number: 3, name: "A chegada" }; no number → { number: Infinity, name }. */
export function splitNumber(name: string): { number: number; name: string } {
  const m = /^(\d+)[\s._-]+(.+)$/.exec(name);
  return m ? { number: Number(m[1]), name: m[2] } : { number: Infinity, name };
}

/** The slug property's value when it is a non-empty string (the site ignores anything else). */
export function slugOverride(frontmatter: Record<string, unknown> | null | undefined, slugProperty: string): string | undefined {
  if (!frontmatter || !slugProperty) return undefined;
  const v = frontmatter[slugProperty];
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

/**
 * A note's own slug, as the site computes it. `chapter` = the note is a book
 * chapter, whose leading number ("03 ") is not part of its address.
 */
export function noteSlug(
  path: string,
  frontmatter: Record<string, unknown> | null | undefined,
  slugProperty: string,
  chapter = false,
): string {
  const own = slugOverride(frontmatter, slugProperty);
  if (own !== undefined) return slugify(own);
  const name = stem(path);
  return slugify(chapter ? splitNumber(name).name : name);
}

export interface UrlSource {
  path: string;
  frontmatter?: Record<string, unknown> | null;
}

/**
 * The note's address relative to the site root, without slashes around it:
 * "o-farol", or "a-casa/chegada" for a chapter of the book "A Casa".
 */
export function noteUrl(note: UrlSource, slugProperty: string, book?: UrlSource | null): string {
  if (!book) return noteSlug(note.path, note.frontmatter, slugProperty);
  return `${noteSlug(book.path, book.frontmatter, slugProperty)}/${noteSlug(note.path, note.frontmatter, slugProperty, true)}`;
}

/**
 * When a note is renamed, the slug to add to keep its old address, or null
 * when there is nothing to keep: the note already has a slug property, or its
 * address didn't change (a move, or a chapter renumbered).
 */
export function slugToKeep(
  oldPath: string,
  newPath: string,
  frontmatter: Record<string, unknown> | null | undefined,
  slugProperty: string,
  chapter = false,
): string | null {
  if (!slugProperty || slugOverride(frontmatter, slugProperty) !== undefined) return null;
  const before = noteSlug(oldPath, null, slugProperty, chapter);
  const after = noteSlug(newPath, null, slugProperty, chapter);
  return before && before !== after ? before : null;
}
