import { Notice, TFile, normalizePath, type Editor } from "obsidian";
import type { Extension } from "@codemirror/state";
import type EscritaPlugin from "../main";
import type { EscritaModule } from "../data";
import type { Book } from "../core/books";
import { safeFileName } from "../core/book";
import { FolderBlockedError } from "../core/notes";
import { parseBeats } from "../core/markers";
import { statusColor } from "../core/stages";
import { t } from "../i18n";
import { beatAtLine, insertBeat, minimalChange } from "./beats-edit";
import { buildBoard, canOverwriteBoard, mergeBoard, type BoardChapter } from "./model";
import { reportError } from "./errors";
import { ghostBeats } from "./ghost";
import { CreateBookModal, confirmAction } from "./modals";
import { OUTLINE_VIEW, OutlineView } from "./view";

/** Default goal written into a new book's note. */
const NEW_BOOK_GOAL = 80000;

/**
 * The outline: a side panel with a book's chapters and beats (editable in
 * place), ghost beats in the editor, a Canvas board export and book creation.
 */
export class OutlineModule implements EscritaModule {
  /** editor extensions, swapped in place when settings change */
  private extensions: Extension[] = [];

  constructor(private plugin: EscritaPlugin) {}

  load(): void {
    const plugin = this.plugin;
    plugin.registerView(OUTLINE_VIEW, (leaf) => new OutlineView(leaf, plugin));
    plugin.addRibbonIcon("list-tree", t("outline.command.open"), () => { void this.openOutline(); });

    plugin.addCommand({
      id: "open-outline",
      name: t("outline.command.open"),
      callback: () => { void this.openOutline(); },
    });
    plugin.addCommand({
      id: "open-outline-board",
      name: t("outline.command.board"),
      checkCallback: (checking) => {
        const book = this.currentBook();
        if (!book) return false;
        if (!checking) void this.openBoard(book);
        return true;
      },
    });
    plugin.addCommand({
      id: "create-book",
      name: t("outline.command.createBook"),
      callback: () => this.createBook(),
    });
    plugin.addCommand({
      id: "add-beat",
      name: t("outline.command.addBeat"),
      editorCheckCallback: (checking, editor, ctx) => {
        const file = ctx.file;
        if (!file || plugin.books.classify(file).kind !== "chapter") return false;
        if (!checking) this.addBeatInEditor(editor);
        return true;
      },
    });
    plugin.addCommand({
      id: "renumber-chapters",
      name: t("outline.command.renumber"),
      checkCallback: (checking) => {
        const book = plugin.books.classify(plugin.app.workspace.getActiveFile()).book;
        if (!book) return false;
        if (!checking) void this.renumber(book);
        return true;
      },
    });

    this.applyEditorSettings(false);
    plugin.registerEditorExtension(this.extensions);
  }

  settingsChanged(): void {
    this.applyEditorSettings(true);
    for (const leaf of this.plugin.app.workspace.getLeavesOfType(OUTLINE_VIEW)) {
      if (leaf.view instanceof OutlineView) leaf.view.settingsChanged();
    }
  }

  private applyEditorSettings(update: boolean): void {
    this.extensions.length = 0;
    if (this.plugin.settings.ghostBeats) this.extensions.push(ghostBeats());
    if (update) this.plugin.app.workspace.updateOptions();
  }

  /** The active note's book, else the book shown in the outline panel. */
  private currentBook(): Book | null {
    const { books, app } = this.plugin;
    const active = books.classify(app.workspace.getActiveFile()).book;
    if (active) return active;
    for (const leaf of app.workspace.getLeavesOfType(OUTLINE_VIEW)) {
      if (leaf.view instanceof OutlineView) {
        const b = leaf.view.currentBook();
        if (b) return b;
      }
    }
    return null;
  }

  /** Reveal the outline in the right sidebar (creating it if needed), optionally on a given book. */
  async openOutline(bookNotePath?: string): Promise<void> {
    const { workspace } = this.plugin.app;
    let leaf = workspace.getLeavesOfType(OUTLINE_VIEW)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      await right.setViewState({ type: OUTLINE_VIEW, active: true });
      leaf = right;
    }
    await workspace.revealLeaf(leaf);
    if (bookNotePath && leaf.view instanceof OutlineView) leaf.view.showBook(bookNotePath);
  }

  // ---------------------------------------------------------------- beats in the editor

  /** Insert an empty beat after the scene the cursor is in, as one undoable change. */
  private addBeatInEditor(editor: Editor): void {
    const text = editor.getValue();
    const idx = beatAtLine(text, editor.getCursor().line);
    const next = insertBeat(text, idx, "");
    const change = minimalChange(text, next);
    editor.replaceRange(change.insert, editor.offsetToPos(change.from), editor.offsetToPos(change.to));
    const beat = parseBeats(next)[idx + 1];
    if (beat) {
      const lineText = editor.getLine(beat.line);
      const ch = lineText.search(/beat:/i);
      editor.setCursor({ line: beat.line, ch: ch >= 0 ? ch + "beat: ".length : lineText.length });
    }
    editor.focus();
  }

  private async renumber(book: Book): Promise<void> {
    try {
      await this.plugin.chapterOps.renumber(book, this.plugin.books.chapters(book).map((c) => c.file));
      new Notice(t("outline.renumbered"));
    } catch (e) {
      this.fail(e);
    }
  }

  // ---------------------------------------------------------------- canvas board

  /** Write `<book folder>/<book title> board.canvas` from the outline and open it. */
  async openBoard(book: Book): Promise<void> {
    const { app, settings, books } = this.plugin;
    try {
      const chapters: BoardChapter[] = [];
      for (const ch of books.chapters(book)) {
        const text = await app.vault.cachedRead(ch.file);
        const fm = books.frontmatter(ch.file);
        chapters.push({
          path: ch.file.path,
          name: ch.file.basename,
          summary: stringOf(fm[settings.summaryProperty]),
          status: stringOf(fm[settings.statusProperty]),
          beats: parseBeats(text).map((b) => b.text),
        });
      }
      const board = buildBoard(chapters, (s) => statusColor(s, settings.stages, settings.otherStatusColors));
      const path = normalizePath(`${book.folder.path}/${book.title} board.canvas`);
      const existing = app.vault.getAbstractFileByPath(path);
      let file: TFile;
      if (existing instanceof TFile) {
        const current = await app.vault.read(existing);
        let replace = false;
        if (!canOverwriteBoard(current)) {
          const ok = await confirmAction(app, t("outline.boardTitle"), t("outline.boardExists", { file: existing.name }), t("outline.boardReplace"));
          if (!ok) return;
          replace = true;
        }
        // An Escrita board is updated in place: the user's own cards, arrows
        // and card positions stay; only the chapter cards' text is refreshed.
        await app.vault.process(existing, (text) => JSON.stringify(
          replace ? board : mergeBoard(canOverwriteBoard(text) ? text : "", board), null, 2,
        ));
        file = existing;
      } else if (existing) {
        throw new Error(t("outline.create.exists", { path }));
      } else {
        file = await app.vault.create(path, JSON.stringify(board, null, 2));
      }
      await app.workspace.getLeaf("tab").openFile(file, { active: true });
    } catch (e) {
      this.fail(e);
    }
  }

  // ---------------------------------------------------------------- books

  /** Ask for a title and folder, then create the book note, its folders and a first chapter. */
  createBook(): void {
    const parent = this.currentBook()?.folder.parent;
    const folder = parent && !parent.isRoot() ? parent.path : "";
    new CreateBookModal(this.plugin.app, folder, (title, dir) => this.makeBook(title, dir)).open();
  }

  private async makeBook(title: string, dir: string): Promise<boolean> {
    const { app, settings, books, chapterOps } = this.plugin;
    const name = safeFileName(title);
    if (!name) {
      new Notice(t("outline.create.needTitle"));
      return false;
    }
    const base = dir.trim().replace(/^\/+|\/+$/g, "");
    const join = (...parts: string[]) => normalizePath(parts.filter(Boolean).join("/"));
    const notePath = join(base, `${name}.md`);
    const folderPath = join(base, name);
    if (app.vault.getAbstractFileByPath(notePath)) {
      new Notice(t("outline.create.exists", { path: notePath }));
      return false;
    }
    try {
      if (base) await this.ensureFolder(base);
      // the configured property names, quoted when YAML needs it
      const key = (k: string) => (/^[\p{L}\p{N}_-]+$/u.test(k) ? k : JSON.stringify(k));
      const note = await app.vault.create(notePath, `---\n${key(settings.goalProperty)}: ${NEW_BOOK_GOAL}\n${key(settings.deadlineProperty)}: \n---\n`);
      await this.ensureFolder(folderPath);
      await this.ensureFolder(join(folderPath, settings.chaptersFolder));
      const book = books.classify(note).book;
      if (!book) throw new Error(t("outline.create.notBook", { path: notePath }));
      // The folder may already hold chapters (a book note added to existing
      // work): leave them as they are instead of inserting a chapter before them.
      const first = books.chapters(book)[0]?.file ?? await chapterOps.createChapterAt(book, 0, t("common.untitled"));
      await app.workspace.getLeaf(false).openFile(first, { active: true });
      await this.openOutline(note.path);
      return true;
    } catch (e) {
      this.fail(e);
      return false;
    }
  }

  /** plugin.notes.ensureFolder, with the outline's message when a segment is a file. */
  private async ensureFolder(path: string): Promise<void> {
    try {
      await this.plugin.notes.ensureFolder(path);
    } catch (e) {
      if (e instanceof FolderBlockedError) throw new Error(t("outline.create.exists", { path: e.path }));
      throw e;
    }
  }

  private fail(e: unknown): void {
    reportError(e);
  }
}

function stringOf(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(stringOf).join(", ");
  return String(v);
}

