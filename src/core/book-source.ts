// A book's chapters with their text and properties (IMPROVEMENTS 18). Pure port,
// no Obsidian imports: export and "Read the book" read a book through it;
// outline/rows.ts's RowsPort extends it (it uses ChapterRef.title for the basename and
// calls measure.counts without a seed when read's mtime is null). The Obsidian adapter
// sits beside BookService in core/books.ts and reads text through plugin.notes, so an
// open editor's unsaved text is what gets exported.

/** The property that keeps a chapter out of an export when false (the property name is a setting). */
export const DEFAULT_COMPILE_PROPERTY = "compile";

/** One chapter of a book, in book order. */
export interface ChapterRef {
  path: string;
  /** chapterTitle(basename): "Prólogo", "A chegada" */
  title: string;
  /** chapterNumber(basename): the number prefix, or null for "Prólogo.md" */
  number: number | null;
  /** false when the chapter's compile property is false (includeChapter); everything else is in */
  include: boolean;
}

/**
 * The book port. `B` is the adapter's book handle (core/books.ts `Book`), so this
 * file stays free of Obsidian types.
 */
export interface BookSource<B> {
  /**
   * Every .md file directly in the book's chapters folder, in compareChapters
   * order. Left-out chapters (`compile: false`) are listed too, with
   * `include: false`: export skips them, but the outline still shows them.
   */
  chapters(book: B): ChapterRef[];
  /**
   * The note's current text: the open editor's buffer when there is one, else
   * the file. `mtime` is the file's mtime when `text` is the saved file, and
   * null when it came from an open editor (possibly unsaved). Only a non-null
   * `mtime` may seed the measurer's mtime cache (`measure.counts`): unsaved
   * text paired with the disk mtime would poison it.
   */
  read(path: string): Promise<{ text: string; mtime: number | null }>;
  /** the metadata cache's frontmatter; {} when there is none yet */
  frontmatter(path: string): Record<string, unknown>;
}

/**
 * The key a frontmatter property is stored under: the exact name, else the first key equal
 * to it ignoring case (Obsidian treats property names without case). Undefined when the
 * note has no such property.
 */
export function propertyKey(frontmatter: Record<string, unknown> | null | undefined, name: string): string | undefined {
  const fm = frontmatter ?? {};
  if (Object.prototype.hasOwnProperty.call(fm, name)) return name;
  const lower = name.toLowerCase();
  return Object.keys(fm).find((k) => k.toLowerCase() === lower);
}

/** A frontmatter property's value, looked up as `propertyKey` finds it; undefined when missing. */
export function propertyValue(frontmatter: Record<string, unknown> | null | undefined, name: string): unknown {
  const key = propertyKey(frontmatter, name);
  return key === undefined ? undefined : frontmatter?.[key];
}

/**
 * The `compile: false` rule (N 7): a chapter is left out only when the property
 * (looked up by exact name, then ignoring case) is the boolean false or the text
 * "false" (trimmed, any case). Missing, true, or anything else keeps it in, so a
 * typo never silently drops a chapter.
 */
export function includeChapter(frontmatter: Record<string, unknown> | null | undefined, property: string): boolean {
  const value = propertyValue(frontmatter, property);
  if (value === false) return false;
  if (typeof value === "string" && value.trim().toLowerCase() === "false") return false;
  return true;
}
