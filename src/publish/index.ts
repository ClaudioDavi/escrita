import { MarkdownView, Notice, TFile } from "obsidian";
import type EscritaPlugin from "../main";
import { bookSource } from "../core/books";
import { FeatureModule } from "../core/module-context";
import type { SettingsUi } from "../core/module-context";
import type { FeatureId } from "../core/features";
import type { Book } from "../core/books";
import type { Follower } from "../core/vault-index";
import { lineList } from "../core/lists";
import { writtenWord } from "../core/stages";
import { dropKeys, renameKeys } from "../core/path-keys";
import { writingDay } from "../core/dates";
import { t } from "../i18n";
import { isPublished, runChecks } from "./checks";
import { initialDate, shouldWriteDate } from "./date";
import { dateText } from "../core/measure";
import { PublishModal } from "./modal";
import { bookSerial, earlierUnpublished, type PublishNextPort, type SerialState } from "../core/serial";
import { publishSettingsSection } from "./settings-ui";

type Frontmatter = Record<string, unknown>;

/** Publish check: "Publish this note" / "Unpublish this note" (see docs/ROADMAP-short-fiction.md §1). */
export class PublishModule extends FeatureModule implements PublishNextPort {
  readonly id: FeatureId = "publish";

  constructor(private plugin: EscritaPlugin) { super(); }

  /** Keeps the publish records current through renames and deletes, even while the feature is off (Q8). */
  dataFollowers(): Follower[] {
    return [{
      moved: (oldPath, newPath) => this.renamed(oldPath, newPath),
      deleted: (path) => this.deleted(path),
    }];
  }

  onload(): void {
    const p = this.plugin;
    const ctx = this.ctx;

    ctx.command({
      id: "publish-note",
      name: t("publish.command"),
      checkCallback: (checking) => {
        const file = this.activeNote();
        if (!file) return false;
        if (!checking) void this.openPublish(file);
        return true;
      },
    });
    ctx.command({
      id: "unpublish-note",
      name: t("publish.unpublishCommand"),
      checkCallback: (checking) => {
        const file = this.activeNote();
        // Offered only for published notes, like the file menu; unpublish() checks again.
        if (!file || !this.published(file)) return false;
        if (!checking) void this.unpublish(file);
        return true;
      },
    });

    ctx.command({
      id: "publish-next-chapter",
      name: t("publish.nextCommand"),
      checkCallback: (checking) => {
        const book = this.activeBook();
        if (!book) return false;
        if (!checking) void this.publishNext(book.note.path);
        return true;
      },
    });

    this.registerEvent(p.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof TFile) || !this.publishable(file)) return;
      menu.addItem((item) => item
        .setTitle(t("publish.menu"))
        .setIcon("send")
        .onClick(() => { void this.openPublish(file); }));
      if (this.published(file)) {
        menu.addItem((item) => item
          .setTitle(t("publish.menuUnpublish"))
          .setIcon("undo-2")
          .onClick(() => { void this.unpublish(file); }));
      }
    }));
  }

  // ------------------------------------------------------------------ helpers

  /** A Markdown note, not a copy inside the snapshots folder. */
  private publishable(file: TFile): boolean {
    return file.extension === "md" && !this.plugin.books.classify(file).snapshot;
  }

  private activeNote(): TFile | null {
    const file = this.plugin.app.workspace.getActiveFile();
    return file && this.publishable(file) ? file : null;
  }

  /** The book of the active note; else the vault's only book. */
  private activeBook(): Book | null {
    const { books, app } = this.plugin;
    const book = books.classify(app.workspace.getActiveFile()).book;
    if (book) return book;
    const all = books.allBooks();
    return all.length === 1 ? all[0] : null;
  }

  /** The book's serial state, from the chapters' status and date in the metadata cache. */
  private serialOf(book: Book): SerialState {
    const { books, app, settings: s } = this.plugin;
    return bookSerial(bookSource(app, books, this.plugin.notes, () => s), book, s);
  }

  /** Q11: the publish check of the book's first unpublished chapter, the same modal as a single note. */
  async publishNext(bookNotePath: string): Promise<void> {
    const book = this.plugin.books.classify(bookNotePath).book;
    if (!book) { new Notice(t("publish.nextNoBook")); return; }
    const next = this.serialOf(book).next;
    if (!next) { new Notice(t("publish.nextNone")); return; }
    const file = this.plugin.app.vault.getAbstractFileByPath(next.path);
    if (!(file instanceof TFile)) return;
    // Q11: it opens that chapter first, then the same check as a single note
    const { workspace } = this.plugin.app;
    if (workspace.getActiveFile()?.path !== file.path) await workspace.getLeaf(false).openFile(file, { active: true });
    await this.openPublish(file);
  }

  private frontmatter(file: TFile): Frontmatter {
    return (this.plugin.app.metadataCache.getFileCache(file)?.frontmatter ?? {});
  }

  private published(file: TFile, fm = this.frontmatter(file)): boolean {
    const s = this.plugin.settings;
    return isPublished(fm[s.statusProperty], s.stages);
  }

  /** The note's text as the writer sees it: its editor's (maybe unsaved) text, else the file. */
  private textOf(file: TFile): Promise<string> {
    return this.plugin.notes.text(file).read();
  }

  private title(file: TFile): string {
    return file.basename;
  }

  // ------------------------------------------------------------------ publish

  async openPublish(file: TFile): Promise<void> {
    const s = this.plugin.settings;
    if (!s.statusProperty.trim()) {
      new Notice(t("publish.noStatus"));
      return;
    }
    let text: string;
    try {
      text = await this.textOf(file);
    } catch (e) {
      console.error("Escrita: couldn't read the note to publish", e);
      new Notice(t("publish.error"));
      return;
    }
    const fm = this.frontmatter(file);
    const place = this.plugin.books.classify(file);
    // a chapter of a book: warn about earlier chapters not yet published (Q13)
    const earlier = place.kind === "chapter" && place.book
      ? earlierUnpublished(this.serialOf(place.book), file.path)
      : null;
    const checks = runChecks(text, fm, {
      earlierUnpublished: earlier,
      placeholderMarker: s.placeholderMarker,
      recommendedProperties: lineList(s.recommendedProperties),
      piece: s,
    });
    const today = writingDay(new Date(), s.dayEndsAt);
    const shown = initialDate(fm[s.dateProperty], today);

    new PublishModal(this.plugin.app, {
      title: this.title(file),
      checks,
      date: shown.value,
      unparsedDate: shown.unparsed,
      onJump: (line) => { void this.jump(file, line); },
      onPublish: (date, dateChanged) => this.publish(file, date, dateChanged, today),
    }).open();
  }

  /**
   * Sets status and date in one processFrontMatter call. The date is written
   * when the user picked one, or when the note has no date yet; an existing
   * value is left exactly as it is otherwise, even one that isn't YYYY-MM-DD.
   */
  private async publish(file: TFile, date: string, dateChanged: boolean, today: string): Promise<boolean> {
    const s = this.plugin.settings;
    const picked = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
    let previous: unknown;
    let wasPublished = false;
    let finalDate = picked;
    // The text as it was, before the properties change. Never blocks publishing.
    if (this.plugin.features.isOn("snapshots")) await this.plugin.snapshots.beforePublish(file);
    try {
      await this.plugin.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
        previous = fm[s.statusProperty];
        wasPublished = isPublished(previous, s.stages);
        fm[s.statusProperty] = writtenWord(s.stages, "published");
        // Decided on the note's current frontmatter, not the (maybe stale) cache.
        if (shouldWriteDate(fm[s.dateProperty], dateChanged)) {
          fm[s.dateProperty] = picked;
          finalDate = picked;
        } else {
          finalDate = dateText(fm[s.dateProperty]);
        }
      });
    } catch (e) {
      console.error("Escrita: couldn't publish", file.path, e);
      new Notice(t("publish.error"));
      return false;
    }

    const record = this.plugin.data.publish[file.path] ?? {};
    if (!wasPublished && (typeof previous === "string" || typeof previous === "number") && String(previous).trim()) {
      record.previousStatus = String(previous);
    } else if (!wasPublished) {
      delete record.previousStatus;
    }
    if (record.previousStatus !== undefined) this.plugin.data.publish[file.path] = record;
    else delete this.plugin.data.publish[file.path];
    this.plugin.requestSave();
    new Notice(t("publish.published", { title: this.title(file), date: finalDate }));
    return true;
  }

  async unpublish(file: TFile): Promise<void> {
    const s = this.plugin.settings;
    if (!this.published(file)) {
      new Notice(t("publish.notPublished"));
      return;
    }
    const record = this.plugin.data.publish[file.path];
    const status = record?.previousStatus?.trim() || writtenWord(s.stages, "ready");
    try {
      await this.plugin.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
        fm[s.statusProperty] = status;
      });
    } catch (e) {
      console.error("Escrita: couldn't unpublish", file.path, e);
      new Notice(t("publish.errorUnpublish"));
      return;
    }
    if (record) {
      delete this.plugin.data.publish[file.path];
      this.plugin.requestSave();
    }
    new Notice(t("publish.unpublished", { title: this.title(file), status }));
  }

  /** Open the note (reusing a leaf that shows it) with the cursor on `line`. */
  private async jump(file: TFile, line: number): Promise<void> {
    const ws = this.plugin.app.workspace;
    let leaf = ws.getLeavesOfType("markdown").find((l) => l.view instanceof MarkdownView && l.view.file?.path === file.path);
    if (leaf) ws.setActiveLeaf(leaf, { focus: true });
    else {
      leaf = ws.getLeaf(false);
      await leaf.openFile(file, { active: true, eState: { line } });
    }
    if (leaf.view instanceof MarkdownView) {
      const editor = leaf.view.editor;
      const pos = { line: Math.min(line, editor.lastLine()), ch: 0 };
      editor.setCursor(pos);
      editor.scrollIntoView({ from: pos, to: pos }, true);
      editor.focus();
    }
  }

  // ------------------------------------------------------------------ vault events

  private renamed(oldPath: string, newPath: string): void {
    if (renameKeys(this.plugin.data.publish, oldPath, newPath)) this.plugin.requestSave();
  }

  private deleted(path: string): void {
    if (dropKeys(this.plugin.data.publish, path)) this.plugin.requestSave();
  }

  settingsSection(el: HTMLElement, ui: SettingsUi): void { publishSettingsSection(el, ui, this.plugin); }
}
