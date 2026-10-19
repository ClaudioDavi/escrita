import { MarkdownView, Notice, TFile, TFolder, normalizePath } from "obsidian";
import type EscritaPlugin from "../main";
import { ChapterError } from "../core/chapter-plan";
import { CoreModule } from "../core/module-context";
import { FolderBlockedError, NoteExistsError } from "../core/notes";
import type { NewWorkKind, NewWorkStarter } from "../core/new-work";
import { cleanFolder, joinPath, noMd } from "../core/paths";
import { resolveTemplate } from "../core/records";
import { templateVars } from "../core/template";
import { t } from "../i18n";
import { bookNoteText, cursorAfterBody, defaultFolderFor, fromTemplate, screenplayNoteText, storyNoteText, targetPath } from "./model";
import { NewWorkList, NewWorkModal } from "./modals";

/**
 * Start a new work (1.0.4, SF 14; boards 41-42; PLAN-1.0.4 Q1). A core module, not a feature:
 * starting a work is never switched off. main.ts starts it with `startCoreModule` after the
 * registry has applied the switches and assigns it to `plugin.newWork`, typed by the port
 * (`core/new-work.ts`), so the desk and the outline view call it without importing this
 * folder. It registers only through `this.ctx`.
 *
 * "New work…" opens the list; "New short story", "New screenplay" and "New book" (id `create-book`, moved from
 * the outline and offered only while it is on) skip it. A conto is one note; a book is a
 * folder with a book note and a first chapter. Both land in the prose, in the draft stage.
 */
export class NewWorkModule extends CoreModule implements NewWorkStarter {
  constructor(private readonly plugin: EscritaPlugin) {
    super();
  }

  onload(): void {
    this.ctx.command({
      id: "new-work",
      name: t("new-work.command.newWork"),
      callback: () => this.start(),
    });
    this.ctx.command({
      id: "new-short-story",
      name: t("new-work.command.newStory"),
      callback: () => this.start("story"),
    });
    this.ctx.command({
      id: "new-screenplay",
      name: t("new-work.command.newScreenplay"),
      callback: () => this.start("screenplay"),
    });
    this.ctx.command({
      id: "create-book",
      name: t("new-work.command.newBook"),
      checkCallback: (checking) => {
        if (!this.offers("book")) return false;
        if (!checking) this.start("book");
        return true;
      },
    });
  }

  start(kind?: NewWorkKind): void {
    const { app } = this.plugin;
    if (!kind) {
      new NewWorkList(app, (k) => this.offers(k), (k) => this.settingFolder(k), (k) => this.start(k)).open();
      return;
    }
    if (!this.offers(kind)) return;
    new NewWorkModal(app, {
      kind,
      folder: this.defaultFolder(kind),
      template: this.templateSetting(kind),
      submit: (title, folder) => (kind === "book" ? this.createBook(title, folder) : this.createPiece(kind, title, folder)),
    }).open();
  }

  offers(kind: NewWorkKind): boolean {
    return kind !== "book" || this.plugin.features.isOn("outline");
  }

  // ---------------------------------------------------------------- where and with what

  private settingFolder(kind: NewWorkKind): string {
    const s = this.plugin.settings;
    return cleanFolder(kind === "story" ? s.storiesFolder : kind === "screenplay" ? s.screenplaysFolder : s.booksFolder);
  }

  /** The setting's folder, else the active note's folder (the vault root is ""). */
  private defaultFolder(kind: NewWorkKind): string {
    const active = this.plugin.app.workspace.getActiveFile();
    const book = active ? this.plugin.books.classify(active).book : null;
    return defaultFolderFor(this.settingFolder(kind), active?.path ?? null, book?.folder.path ?? null);
  }

  private templateSetting(kind: NewWorkKind): string {
    const s = this.plugin.settings;
    return (kind === "story" ? s.storyTemplate : kind === "screenplay" ? s.screenplayTemplate : s.bookNoteTemplate).trim();
  }

  /** The writer's template note's text; null (with a notice when a path was set) for the built-in one. */
  private async readTemplate(kind: NewWorkKind): Promise<string | null> {
    const path = this.templateSetting(kind);
    if (!path) return null;
    const { vault } = this.plugin.app;
    const isMd = (x: unknown): x is TFile => x instanceof TFile && x.extension === "md";
    const file = resolveTemplate(normalizePath(path), (p) => vault.getAbstractFileByPath(p), isMd);
    if (file) {
      try {
        return await vault.cachedRead(file);
      } catch { /* unreadable: the same notice as a missing note */ }
    }
    new Notice(t("new-work.notice.templateMissing", { path }));
    return null;
  }

  // ---------------------------------------------------------------- creating

  /** A conto or a screenplay: one note, the built-in text or the writer's template, opened at its end. */
  private async createPiece(kind: "story" | "screenplay", title: string, folder: string): Promise<boolean> {
    const { app, settings, notes } = this.plugin;
    const path = this.pathFor(title, folder);
    if (path === null) return false;
    if (app.vault.getAbstractFileByPath(path)) {
      new Notice(t("new-work.notice.exists", { path }));
      return false;
    }
    try {
      const template = await this.readTemplate(kind);
      const builtIn = kind === "story" ? storyNoteText : screenplayNoteText;
      const text = template === null
        ? builtIn(settings, { beat: t("new-work.text.beat") })
        : fromTemplate(template, templateVars(title.trim(), new Date()), settings);
      // "fail": the check above found nothing, so a file that appeared since is not touched
      const file = (await notes.create(path, text, { exists: "fail" })).file;
      await this.open(file);
      this.untrackedNotice(file);
      return true;
    } catch (e) {
      return this.failed(e);
    }
  }

  private async createBook(title: string, dir: string): Promise<boolean> {
    const { app, settings, books, chapterOps, notes } = this.plugin;
    const notePath = this.pathFor(title, dir);
    if (notePath === null) return false;
    if (app.vault.getAbstractFileByPath(notePath)) {
      new Notice(t("new-work.notice.exists", { path: notePath }));
      return false;
    }
    const folderPath = noMd(notePath);
    const chaptersPath = normalizePath(joinPath(folderPath, settings.chaptersFolder));
    const blocker = this.fileInTheWay(chaptersPath);
    if (blocker) {
      new Notice(t("new-work.notice.exists", { path: blocker }));
      return false;
    }
    try {
      const template = await this.readTemplate("book");
      const text = template === null
        ? bookNoteText(settings, {
          premise: t("new-work.text.premise"), premiseHint: t("new-work.text.premiseHint"),
          characters: t("new-work.text.characters"), charactersHint: t("new-work.text.charactersHint"),
        })
        : fromTemplate(template, templateVars(title.trim(), new Date()), settings);
      const note = (await notes.create(notePath, text, { exists: "fail" })).file;
      await notes.ensureFolder(folderPath);
      await notes.ensureFolder(chaptersPath);
      const book = books.classify(note).book;
      if (!book || book.note.path !== note.path) throw new Error(t("new-work.notice.notBook", { path: notePath }));
      // The folder may already hold chapters (a book note added to existing work): leave them
      // as they are instead of inserting a chapter before them. Without a chapter template the
      // first chapter holds a beat; with one, the template decides (Q7).
      const body = settings.chapterTemplate.trim() === "" ? `%% beat: ${t("new-work.text.beat")} %%\n` : undefined;
      const first = books.chapters(book)[0]?.file
        ?? await chapterOps.createChapterAt(book, 0, t("common.untitled"), body);
      await this.open(first);
      if (this.plugin.features.isOn("outline")) await this.plugin.outline.openOutline(note.path);
      this.untrackedNotice(note);
      return true;
    } catch (e) {
      return this.failed(e);
    }
  }

  /** The first path of `path` (or one of its parents) that is a file, not a folder; null when none. */
  private fileInTheWay(path: string): string | null {
    const parts = path.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join("/");
      const x = this.plugin.app.vault.getAbstractFileByPath(p);
      if (x && !(x instanceof TFolder)) return p;
    }
    return null;
  }

  /** The note's vault path for the typed title and folder; a notice and null when there is no title. */
  private pathFor(title: string, folder: string): string | null {
    const path = targetPath(folder, title);
    if (path === null) {
      new Notice(t("new-work.notice.needTitle"));
      return null;
    }
    return normalizePath(path);
  }

  /** Open the note in the main area with the cursor at the end of its text. */
  private async open(file: TFile): Promise<void> {
    const { workspace } = this.plugin.app;
    await workspace.getLeaf(false).openFile(file, { active: true });
    const view = workspace.getActiveViewOfType(MarkdownView);
    if (view?.file?.path !== file.path) return;
    const editor = view.editor;
    editor.setCursor(editor.offsetToPos(cursorAfterBody(editor.getValue())));
    editor.focus();
  }

  /** Q4: the work is created anyway; a notice says goals don't count it, with a way to the settings. */
  private untrackedNotice(file: TFile): void {
    if (this.plugin.books.classify(file).tracked) return;
    const frag = createFragment((f) => f.appendText(t("new-work.notice.untracked", { name: file.basename })));
    const notice = new Notice(frag, 10000);
    const messageEl = notice.messageEl as HTMLElement | undefined;
    if (!messageEl) return;
    const button = messageEl.createEl("button", { text: t("new-work.notice.openSettings"), cls: "escrita-notice-button" });
    button.addEventListener("click", () => {
      notice.hide();
      try {
        const setting = (this.plugin.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
        setting?.open();
        setting?.openTabById(this.plugin.manifest.id);
      } catch { /* the settings tab is not reachable: nothing to do */ }
    });
  }

  /** A notice for what went wrong; false, so the modal stays open. */
  private failed(e: unknown): false {
    if (e instanceof FolderBlockedError) new Notice(t("new-work.notice.exists", { path: e.path }));
    else if (e instanceof NoteExistsError) new Notice(t("new-work.notice.exists", { path: e.existing }));
    else if (e instanceof ChapterError && e.code === "exists") new Notice(t("new-work.notice.exists", { path: e.subject }));
    else new Notice(t("new-work.notice.failed", { msg: e instanceof Error ? e.message : String(e) }));
    return false;
  }
}
