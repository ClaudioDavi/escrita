import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import type { EscritaSettings } from "../settings";
import { includeChapter, type BookSource } from "./book-source";
import { collectionOf, type Collection } from "./collection";
import type { NoteService } from "./notes";
import { chapterTitle, compareChapters, chapterNumber } from "./book";
import { linkText } from "./scope";
import { classify, listBooks, lookupPath, placementPath, type BookOf, type Placement, type VaultTree } from "./classify";

/** A book: its note (Novels/A Casa.md), folder (Novels/A Casa), chapters folder (Novels/A Casa/Chapters) and title. */
export type Book = BookOf<TFile, TFolder>;

/** Where a file or folder sits (kind, book, tracked, piece, stage): see core/classify.ts. */
export type FilePlacement = Placement<TFile, TFolder>;

export interface Chapter {
  file: TFile;
  /** 1-based position in the book */
  index: number;
  number: number | null;
  title: string;
}

/**
 * The Obsidian adapter of core/classify.ts, plus the book queries that need the
 * vault. Every module asks `classify` first instead of re-deriving what a file is.
 */
export class BookService {
  private tree: VaultTree<TFile, TFolder>;

  constructor(private app: App, private settings: () => EscritaSettings) {
    // As given first, so a live file whose own path normalizePath would change (U+00A0) is still found.
    const get = lookupPath((p) => this.app.vault.getAbstractFileByPath(p), normalizePath);
    this.tree = {
      file: (p) => { const f = get(p); return f instanceof TFile ? f : null; },
      folder: (p) => { const f = get(p); return f instanceof TFolder && !f.isRoot() ? f : null; },
      folders: () => this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder && !f.isRoot()),
      frontmatter: (f) => this.app.metadataCache.getFileCache(f)?.frontmatter as Record<string, unknown> | undefined,
      resolve: (link, from) => this.app.metadataCache.getFirstLinkpathDest(linkText(link) ?? link, from)?.path ?? null,
    };
  }

  /**
   * The one question every module asks first: is this a chapter, a book note,
   * another file of a book, a loose note; which book owns it; is it tracked; its
   * piece. Takes a file, a folder, a vault path or null. Never throws. A path
   * that no longer exists is kind "none": for deleted or renamed-away paths,
   * test containment with core/classify.inBook against a known book.
   */
  classify(x: TAbstractFile | string | null): FilePlacement {
    const path = placementPath(x, normalizePath, (p) => this.app.vault.getAbstractFileByPath(p) !== null);
    return classify(this.tree, this.settings(), path);
  }

  chapters(book: Book): Chapter[] {
    const files = book.chaptersFolder.children
      .filter((f): f is TFile => f instanceof TFile && f.extension === "md")
      .sort((a, b) => compareChapters(a.basename, b.basename));
    return files.map((file, i) => ({
      file, index: i + 1, number: chapterNumber(file.basename), title: chapterTitle(file.basename),
    }));
  }

  /** Every book in the vault, by the same rule as classify, sorted by title. */
  allBooks(): Book[] {
    return listBooks(this.tree, this.settings());
  }

  /**
   * Every book by folder shape alone, even one inside a plugin folder (export, submissions,
   * snapshots). For settings checks, which must not let a folder setting capture a book.
   */
  allBooksEverywhere(): Book[] {
    return listBooks(this.tree, this.settings(), false);
  }

  /** Frontmatter of a file from the metadata cache (may be undefined right after creation). */
  frontmatter(file: TFile): Record<string, unknown> {
    return (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
  }
}

/**
 * What `bookSource` and `collectionSource` share: `read` and `frontmatter` by vault path.
 * Text comes through `notes` (the open editor's buffer when there is one), so `mtime` is
 * null then and the file's mtime otherwise.
 */
function fileReader(app: App, notes: Pick<NoteService, "text" | "editorView">) {
  const fileAt = (path: string): TFile | null => {
    const f = app.vault.getAbstractFileByPath(path) ?? app.vault.getAbstractFileByPath(normalizePath(path));
    return f instanceof TFile ? f : null;
  };
  const frontmatter = (path: string): Record<string, unknown> => {
    const f = fileAt(path);
    return ((f && app.metadataCache.getFileCache(f)?.frontmatter) as Record<string, unknown> | undefined) ?? {};
  };
  const read = async (path: string): Promise<{ text: string; mtime: number | null }> => {
    const f = fileAt(path);
    if (!f) throw new Error(`not a file: ${path}`);
    const open = notes.editorView(f) !== null;
    const before = f.stat.mtime;
    const text = await notes.text(f).read();
    // a save during the read may pair old text with a newer mtime: seed only when unchanged
    return { text, mtime: open || f.stat.mtime !== before ? null : before };
  };
  return { fileAt, frontmatter, read };
}

/**
 * The Obsidian adapter of core/book-source.ts. Text comes through `notes` (the open
 * editor's buffer when there is one), so `mtime` is null then and the file's mtime
 * otherwise.
 */
export function bookSource(
  app: App,
  books: Pick<BookService, "chapters">,
  notes: Pick<NoteService, "text" | "editorView">,
  settings: () => Pick<EscritaSettings, "compileProperty">,
): BookSource<Book> {
  const { frontmatter, read } = fileReader(app, notes);
  return {
    chapters: (book) => books.chapters(book).map((c) => ({
      path: c.file.path, title: c.title, number: c.number,
      include: includeChapter(frontmatter(c.file.path), settings().compileProperty),
    })),
    read,
    frontmatter,
  };
}

/**
 * The collection a note describes (core/collection.ts `collectionOf`), its links resolved
 * as Obsidian resolves them from that note (`getFirstLinkpathDest`). A link to a file
 * that isn't Markdown, or to the collection note itself, is missing. Null when the note
 * has no `collectionProperty`. Export asks this about the active note (Q28); the
 * collection source below reads the same answer, so the two never disagree. Task 1.7.
 */
export function collectionAt(
  app: App,
  note: TFile,
  settings: () => Pick<EscritaSettings, "collectionProperty">,
): Collection | null {
  const fm = app.metadataCache.getFileCache(note)?.frontmatter as Record<string, unknown> | undefined;
  return collectionOf(fm, settings().collectionProperty, (link) => {
    const dest = app.metadataCache.getFirstLinkpathDest(link, note.path);
    return dest instanceof TFile && dest.extension === "md" && dest.path !== note.path ? dest.path : null;
  });
}

/**
 * The collection's `BookSource` (PLAN-0.9 Q28): the handle is the collection note.
 * `chapters` lists the resolved stories in the note's order (`collectionAt`, missing
 * links left out), each with `number: null`, `include: true` (a story's own properties
 * are ignored, `compile` too: Q26) and its basename as `title`, never `chapterTitle`'s
 * (a conto's name is not a chapter name: "1984" keeps its digits). `read` and
 * `frontmatter` behave as `bookSource`'s: text through `notes`, so an open editor's
 * unsaved text is what gets exported. Task 1.7.
 */
export function collectionSource(
  app: App,
  notes: Pick<NoteService, "text" | "editorView">,
  settings: () => Pick<EscritaSettings, "collectionProperty">,
): BookSource<TFile> {
  const { fileAt, frontmatter, read } = fileReader(app, notes);
  return {
    chapters: (note) => (collectionAt(app, note, settings)?.stories ?? []).flatMap((path) => {
      const f = fileAt(path);
      return f ? [{ path, title: f.basename, number: null, include: true }] : [];
    }),
    read,
    frontmatter,
  };
}
