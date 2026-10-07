// Collections (0.9, SF 13; PLAN-0.9 Q24-Q28). Pure, no Obsidian imports.
//
// A collection is a note with a `contents` property (the name is the
// `collectionProperty` setting): a list of links to contos, in reading order. It is not
// a classifier kind and adds no classifier field (Q28): export asks `collectionOf`
// about the active note (core/books.ts `collectionAt`) and exports its stories as a
// book's chapters (`storyChapters`), every story unnumbered, so the manuscript model and
// the writers don't change. Filled in by task 1.7.

import { propertyKey, type ChapterRef } from "./book-source";
import { linkText } from "./scope";

/**
 * Where one link of the list points: the vault path of a Markdown note, or null when it
 * resolves to nothing (or to a file that isn't a Markdown note, or to the collection
 * note itself). Takes the link text alone ("A visita" from `[[A visita|alias]]`, the
 * heading and block parts dropped); the adapter resolves it from the collection note,
 * as Obsidian resolves a link written there.
 */
export type ResolveStory = (link: string) => string | null;

/** What a collection note lists, in order. */
export interface Collection {
  /**
   * The stories' vault paths in the list's order. A story listed twice is kept once,
   * at its first place (Q28): two links that resolve to the same note are the same story.
   */
  stories: string[];
  /**
   * The links that resolve to nothing, as their link text, each once, in list order.
   * Export shows them as a warning and skips them (Q26).
   */
  missing: string[];
}

/**
 * The collection a note's front matter describes, or null when it is not a collection.
 *
 * - The property is looked up by exact name, then ignoring case (as `includeChapter`).
 *   Missing, or a value that is neither text nor a list: null.
 * - Present with no value (`contents:` alone, null, an empty list): a collection with no
 *   stories, so the writer who has just started one sees "nothing to export" rather
 *   than a plain note.
 * - A list item, or a single text value, is a link: `[[A visita]]`, `[[A visita|alias]]`,
 *   `[[A visita#Parte]]`, or plain text "A visita" (an Obsidian text list). Blank items
 *   and items that aren't text are skipped without a word. A text with several
 *   wikilinks ("[[A]], [[B]]" typed as one value) gives each, in order.
 * - Each link goes through `resolve`; a path already listed is dropped, a null joins
 *   `missing` (once per link text).
 */
export function collectionOf(
  frontmatter: Record<string, unknown> | null | undefined,
  property: string,
  resolve: ResolveStory,
): Collection | null {
  const key = propertyKey(frontmatter, property);
  if (key === undefined) return null;
  const value = frontmatter?.[key];
  if (value !== null && value !== undefined && typeof value !== "string" && !Array.isArray(value)) return null;

  const stories: string[] = [];
  const missing: string[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (typeof v !== "string") return;
    // every wikilink in the text ("[[A]], [[B]]" typed as one value), else the text itself
    const links = [...v.matchAll(/\[\[[^\]]*\]\]/g)].map((m) => m[0]);
    for (const item of links.length ? links : [v]) {
      const link = linkText(item);
      if (link === null) continue;
      const path = resolve(link);
      if (path === null) {
        if (!missing.includes(link)) missing.push(link);
      } else if (!stories.includes(path)) stories.push(path);
    }
  };
  visit(value);
  return { stories, missing };
}

/**
 * A collection's stories as chapters (PLAN-0.9 Q28), in the list's order: each with
 * `number: null`, `include: true` (a story's own properties are ignored, `compile` too:
 * Q26) and its file name as `title`, never `chapterTitle`'s (a conto's name is not a
 * chapter name: "1984" keeps its digits). The paths are the resolved Markdown notes.
 */
export function storyChapters(collection: Collection): ChapterRef[] {
  return collection.stories.map((path) => ({
    path, title: (path.split("/").pop() ?? path).replace(/\.md$/, ""), number: null, include: true,
  }));
}
