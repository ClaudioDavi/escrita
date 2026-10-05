import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import type { EscritaSettings } from "../settings";
import { includeChapter, type BookSource } from "./book-source";
import type { NoteService } from "./notes";
import { chapterTitle, compareChapters, chapterNumber } from "./book";
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

  /** Frontmatter of a file from the metadata cache (may be undefined right after creation). */
  frontmatter(file: TFile): Record<string, unknown> {
    return (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
  }
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
  const fileAt = (path: string): TFile | null => {
    const f = app.vault.getAbstractFileByPath(path) ?? app.vault.getAbstractFileByPath(normalizePath(path));
    return f instanceof TFile ? f : null;
  };
  const frontmatter = (path: string): Record<string, unknown> => {
    const f = fileAt(path);
    return ((f && app.metadataCache.getFileCache(f)?.frontmatter) as Record<string, unknown> | undefined) ?? {};
  };
  return {
    chapters: (book) => books.chapters(book).map((c) => ({
      path: c.file.path, title: c.title, number: c.number,
      include: includeChapter(frontmatter(c.file.path), settings().compileProperty),
    })),
    async read(path) {
      const f = fileAt(path);
      if (!f) throw new Error(`not a file: ${path}`);
      const open = notes.editorView(f) !== null;
      const text = await notes.text(f).read();
      return { text, mtime: open ? null : f.stat.mtime };
    },
    frontmatter,
  };
}
