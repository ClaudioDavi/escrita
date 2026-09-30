import { TFile, TFolder, normalizePath } from "obsidian";
import type EscritaPlugin from "../main";
import type { Book } from "./books";
import { safeFileName } from "./book";
import { t } from "../i18n";
import { ChapterError, retitledName } from "./chapter-plan";
import { SerialQueue, createChapter, renumberChapters, type ChapterFs } from "./chapter-engine";

/**
 * File operations on a book's chapters. Every chapter create/move goes through
 * here so numbering stays consistent. Implemented by the outline module.
 *
 * Operations run one at a time (a queue), so quick keystrokes in the outline
 * can't interleave renames. Renames go through `fileManager.renameFile` so
 * links elsewhere in the vault are updated. The sequencing itself lives in
 * core/chapter-engine.ts (tested without Obsidian).
 */
export class ChapterOps {
  private queue = new SerialQueue();

  constructor(private plugin: EscritaPlugin) {}

  /**
   * Create a chapter at 0-based position `at` (chapters.length = append),
   * renumbering the chapters after it. Uses the chapter template when set.
   * Resolves to the new file.
   */
  async createChapterAt(book: Book, at: number, title: string, body?: string): Promise<TFile> {
    return this.queue.run(() => {
      const s = this.plugin.settings;
      return createChapter(this.fs(book), at, title, {
        pad: s.numberPadding, summaryProperty: s.summaryProperty, untitled: t("common.untitled"),
      }, body);
    });
  }

  /**
   * Create a chapter right after `file`. The position is looked up when the
   * operation runs, not when it's queued, so a rename still in the queue
   * can't put the new chapter in the wrong place.
   */
  async createChapterAfter(file: TFile, title: string, body?: string): Promise<TFile> {
    return this.queue.run(() => {
      const book = this.plugin.books.classify(file).book;
      const chapter = book ? this.plugin.books.chapters(book).find((c) => c.file === file) : undefined;
      if (!book || !chapter) throw new ChapterError("notFound", file.basename);
      const s = this.plugin.settings;
      return createChapter(this.fs(book), chapter.index, title, {
        pad: s.numberPadding, summaryProperty: s.summaryProperty, untitled: t("common.untitled"),
      }, body);
    });
  }

  /** Rename chapter files so their numeric prefixes match `ordered`. */
  async renumber(book: Book, ordered: TFile[]): Promise<void> {
    return this.queue.run(() => renumberChapters(
      this.fs(book), ordered.map((f) => f.basename), this.plugin.settings.numberPadding,
    ));
  }

  /** Change a chapter's title, keeping its number. */
  async retitle(file: TFile, title: string): Promise<void> {
    return this.queue.run(async () => {
      const name = retitledName(file.basename, safeFileName(title));
      if (!name || name === file.basename) return;
      const parent = file.parent && !file.parent.isRoot() ? file.parent.path : "";
      const path = normalizePath(parent ? `${parent}/${name}.md` : `${name}.md`);
      const clash = this.plugin.app.vault.getAbstractFileByPath(path);
      if (clash && clash !== file) throw new ChapterError("exists", name);
      await this.plugin.app.fileManager.renameFile(file, path);
    });
  }

  /** The book's chapters folder as seen by the engine. */
  private fs(book: Book): ChapterFs<TFile> {
    const { app, books, settings } = this.plugin;
    const folder: TFolder = book.chaptersFolder;
    const mdFiles = () => folder.children.filter((f): f is TFile => f instanceof TFile && f.extension === "md");
    const pathOf = (name: string) => normalizePath(`${folder.path}/${name}.md`);
    return {
      chapters: () => books.chapters(book).map((c) => c.file.basename),
      names: () => mdFiles().map((f) => f.basename),
      rename: async (from, to) => {
        const file = mdFiles().find((f) => f.basename === from);
        if (!file) throw new ChapterError("notFound", from);
        await app.fileManager.renameFile(file, pathOf(to));
      },
      create: (name, content) => app.vault.create(pathOf(name), content),
      template: async () => {
        const p = settings.chapterTemplate.trim();
        if (!p) return null;
        const f = app.vault.getAbstractFileByPath(normalizePath(p))
          ?? app.vault.getAbstractFileByPath(normalizePath(`${p}.md`));
        if (!(f instanceof TFile)) return null;
        try {
          return await app.vault.cachedRead(f);
        } catch (e) {
          console.error("Escrita: could not read the chapter template", e);
          return null;
        }
      },
    };
  }
}
