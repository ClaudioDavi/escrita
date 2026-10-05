import { Notice, TFile, normalizePath, type Editor } from "obsidian";
import { newBookNote } from "./new-book";
import type { Extension } from "@codemirror/state";
import type EscritaPlugin from "../main";
import type { Follower } from "../core/vault-index";
import { FeatureModule, type EditorSlot, type FeatureSlots } from "../core/module-context";
import type { SettingsUi } from "../core/module-context";
import type { Book } from "../core/books";
import { safeFileName } from "../core/book";
import { FolderBlockedError, NoteExistsError } from "../core/notes";
import { parseBeats } from "../core/markers";
import { statusColor } from "../core/stages";
import { t } from "../i18n";
import { beatAtLine, insertBeat, minimalChange } from "./beats-edit";
import { buildBoard, canOverwriteBoard, mergeBoard, type BoardChapter } from "./model";
import { reportError } from "./errors";
import { ghostBeats } from "./ghost";
import { loadRows, type RowsPort } from "./rows";
import { bookSource } from "../core/books";
import { readChapterDefault } from "../core/measure";
import { assignColors, povValue, renamePovKey, type PovColor } from "./pov";
import { CreateBookModal, confirmAction } from "./modals";
import { OUTLINE_VIEW, OutlineView, str } from "./view";
import { outlineSettingsSection } from "./settings-ui";

/** Default goal written into a new book's note. */

/**
 * The outline: a side panel with a book's chapters and beats (editable in
 * place), ghost beats in the editor, a Canvas board export and book creation.
 */
export class OutlineModule extends FeatureModule {
  readonly id = "outline" as const;
  readonly slots: FeatureSlots = { views: [OUTLINE_VIEW], editors: 1 };
  /** the ghost beats' extension slot, refilled when the setting changes */
  private editorSlot: EditorSlot | null = null;

  constructor(private plugin: EscritaPlugin) { super(); }

  /** Q8: the POV colours follow a renamed note while the outline is off. A deleted note keeps its colour (never pruned). */
  dataFollowers(): Follower[] {
    const p = this.plugin;
    return [{
      moved: (oldPath, newPath) => {
        if (renamePovKey(p.data.povColors, oldPath, newPath)) p.requestSave();
      },
    }];
  }

  /** Q42: the colour of each POV key. A key seen for the first time gets the next free colour and is saved. */
  colorsFor(keys: readonly string[]): Record<string, PovColor> {
    const store = this.plugin.data.povColors;
    if (assignColors(keys, store)) this.plugin.requestSave();
    const out: Record<string, PovColor> = {};
    for (const k of keys) if (Object.prototype.hasOwnProperty.call(store, k)) out[k] = store[k];
    return out;
  }

  /**
   * What `loadRows` needs from Obsidian, for the panel and the board. Chapters, text
   * and frontmatter come through the book source (reads go through plugin.notes, so
   * an open editor's text is what shows).
   */
  rowsPort(): RowsPort<Book> {
    const plugin = this.plugin;
    const { app, books } = plugin;
    const source = bookSource(app, books, plugin.notes, () => plugin.settings);
    const fileAt = (path: string): TFile => app.vault.getAbstractFileByPath(path) as TFile;
    return {
      ...source,
      counts: (path, seed, unit) => plugin.measure.counts(fileAt(path), seed, unit),
      placeholders: (path) => (plugin.features.isOn("placeholders") ? plugin.placeholders.countFor(path) : 0),
      chapterDefault: (book) => readChapterDefault(books.frontmatter(book.note), plugin.settings),
      resolvePov: (value, path) => povValue(value, (link) => {
        const dest = app.metadataCache.getFirstLinkpathDest(link, path);
        if (dest) return { path: dest.path, name: dest.basename };
        return plugin.names.entryFor(link, path);
      }),
      settings: () => plugin.settings,
      stages: () => plugin.settings.stages,
    };
  }

  onload(): void {
    const plugin = this.plugin;
    const ctx = this.ctx;
    ctx.view(OUTLINE_VIEW, (leaf) => new OutlineView(leaf, plugin));
    ctx.ribbon("list-tree", t("outline.command.open"), () => { void this.openOutline(); });

    ctx.command({
      id: "open-outline",
      name: t("outline.command.open"),
      callback: () => { void this.openOutline(); },
    });
    ctx.command({
      id: "open-outline-board",
      name: t("outline.command.board"),
      checkCallback: (checking) => {
        const book = this.currentBook();
        if (!book) return false;
        if (!checking) void this.openBoard(book);
        return true;
      },
    });
    ctx.command({
      id: "create-book",
      name: t("outline.command.createBook"),
      callback: () => this.createBook(),
    });
    ctx.command({
      id: "add-beat",
      name: t("outline.command.addBeat"),
      editorCheckCallback: (checking, editor, ectx) => {
        const file = ectx.file;
        if (!file || plugin.books.classify(file).kind !== "chapter") return false;
        if (!checking) this.addBeatInEditor(editor);
        return true;
      },
    });
    ctx.command({
      id: "renumber-chapters",
      name: t("outline.command.renumber"),
      checkCallback: (checking) => {
        const book = plugin.books.classify(plugin.app.workspace.getActiveFile()).book;
        if (!book) return false;
        // Q44: while an outline for this book is filtered, its chapters are partly hidden
        if (this.filteredOutline(book.note.path)) return false;
        if (!checking) void this.renumber(book);
        return true;
      },
    });

    this.editorSlot = ctx.editor(this.ghostExtensions());
  }

  onunload(): void {
    this.editorSlot = null;
  }

  settingsChanged(): void {
    this.editorSlot?.set(this.ghostExtensions());
    this.plugin.app.workspace.updateOptions();
    for (const leaf of this.plugin.app.workspace.getLeavesOfType(OUTLINE_VIEW)) {
      if (leaf.view instanceof OutlineView) leaf.view.settingsChanged();
    }
  }

  private ghostExtensions(): Extension[] {
    return this.plugin.settings.ghostBeats ? [ghostBeats()] : [];
  }

  /** True while an outline leaf showing this book hides chapters behind a filter. */
  private filteredOutline(bookNotePath: string): boolean {
    return this.plugin.app.workspace.getLeavesOfType(OUTLINE_VIEW).some((leaf) =>
      leaf.view instanceof OutlineView && leaf.view.currentBook()?.note.path === bookNotePath && leaf.view.reorderBlocked());
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
    const { app, settings } = this.plugin;
    try {
      const port = this.rowsPort();
      const chapters: BoardChapter[] = (await loadRows(port, book)).map((row) => {
        // summary and status as written in the note, as the board always had them
        const fm = port.frontmatter(row.path) ?? {};
        return {
          path: row.path,
          name: row.path.slice(row.path.lastIndexOf("/") + 1).replace(/\.md$/, ""),
          summary: str(fm[settings.summaryProperty]),
          status: str(fm[settings.statusProperty]),
          beats: row.beats.map((b) => b.text),
        };
      });
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
        file = (await this.plugin.notes.create(path, JSON.stringify(board, null, 2), { exists: "fail" })).file;
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
      // starts in the draft stage, in the writer's own status word; "fail": the check above found nothing, so a file that appeared since is not touched
      const note = (await this.plugin.notes.create(notePath, newBookNote(settings), { exists: "fail" }).catch((e) => {
        if (e instanceof FolderBlockedError) throw new Error(t("outline.create.exists", { path: e.path }));
        if (e instanceof NoteExistsError) throw new Error(t("outline.create.exists", { path: e.existing }));
        throw e;
      })).file;
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

  settingsSection(el: HTMLElement, ui: SettingsUi): void { outlineSettingsSection(el, ui, this.plugin); }
}
