// Collections (0.9, SF 13; PLAN-0.9 Q24-Q28). Pure, no Obsidian imports.
//
// A collection is a note with a `contents` property (the name is the
// `collectionProperty` setting): a list of links to contos, in reading order. It is not
// a classifier kind and adds no classifier field (Q28): export asks `collectionOf`
// about the active note, and reads the stories through the collection's `BookSource`
// adapter (core/books.ts `collectionSource`), every story unnumbered, so the manuscript
// model and the writers don't change. Filled in by task 1.7.

/** The property that lists a collection's stories (the property name is a setting). */
export const DEFAULT_COLLECTION_PROPERTY = "contents";

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
  const fm = frontmatter ?? {};
  let key: string | undefined = property in fm ? property : undefined;
  if (key === undefined) {
    const lower = property.toLowerCase();
    key = Object.keys(fm).find((k) => k.toLowerCase() === lower);
  }
  if (key === undefined) return null;
  const value = fm[key];
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

/** The link text of one list item: `[[A|b]]` and `[[A#h]]` give "A"; plain text stays; blank gives null. */
function linkText(value: string): string | null {
  const m = /\[\[([^\]]*)\]\]/.exec(value);
  const inner = (m ? m[1] : value).split("|")[0].split(/[#^]/)[0].trim();
  return inner === "" ? null : inner;
}
