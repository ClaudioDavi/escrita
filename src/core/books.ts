import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { EscritaSettings } from "../settings";
import { chapterTitle, compareChapters, chapterNumber } from "./book";

export interface Book {
  /** the book note, e.g. Novels/A Casa.md */
  note: TFile;
  /** Novels/A Casa */
  folder: TFolder;
  /** Novels/A Casa/Chapters */
  chaptersFolder: TFolder;
  title: string;
}

export interface Chapter {
  file: TFile;
  /** 1-based position in the book */
  index: number;
  number: number | null;
  title: string;
}

/** Finds books and chapters in the vault, following the folder convention in core/book.ts. */
export class BookService {
  constructor(private app: App, private settings: () => EscritaSettings) {}

  private bookFromFolder(folder: TFolder | null): Book | null {
    if (!folder || folder.isRoot()) return null;
    const note = this.app.vault.getAbstractFileByPath(normalizePath(`${folder.path}.md`));
    const ch = this.app.vault.getAbstractFileByPath(normalizePath(`${folder.path}/${this.settings().chaptersFolder}`));
    if (note instanceof TFile && ch instanceof TFolder) {
      return { note, folder, chaptersFolder: ch, title: note.basename };
    }
    return null;
  }

  /** The book a file belongs to: the book note itself, or anything inside the book's folder. */
  bookFor(file: TFile | null): Book | null {
    if (!file) return null;
    if (file.extension === "md") {
      const folder = this.app.vault.getAbstractFileByPath(file.path.replace(/\.md$/, ""));
      if (folder instanceof TFolder) {
        const b = this.bookFromFolder(folder);
        if (b) return b;
      }
    }
    let f: TFolder | null = file.parent;
    while (f && !f.isRoot()) {
      const b = this.bookFromFolder(f);
      if (b) return b;
      f = f.parent;
    }
    return null;
  }

  isChapter(file: TFile | null): boolean {
    if (!file || file.extension !== "md") return false;
    const b = this.bookFor(file);
    return !!b && file.parent?.path === b.chaptersFolder.path;
  }

  chapters(book: Book): Chapter[] {
    const files = book.chaptersFolder.children
      .filter((f): f is TFile => f instanceof TFile && f.extension === "md")
      .sort((a, b) => compareChapters(a.basename, b.basename));
    return files.map((file, i) => ({
      file, index: i + 1, number: chapterNumber(file.basename), title: chapterTitle(file.basename),
    }));
  }

  allBooks(): Book[] {
    const out: Book[] = [];
    const name = this.settings().chaptersFolder;
    for (const f of this.app.vault.getAllLoadedFiles()) {
      if (f instanceof TFolder && f.name === name && f.parent) {
        const b = this.bookFromFolder(f.parent);
        if (b) out.push(b);
      }
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
  }

  /** Frontmatter of a file from the metadata cache (may be undefined right after creation). */
  frontmatter(file: TFile): Record<string, unknown> {
    return (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
  }
}
