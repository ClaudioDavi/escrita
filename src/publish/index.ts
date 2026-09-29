import { MarkdownView, Notice, TFile, type TAbstractFile } from "obsidian";
import type EscritaPlugin from "../main";
import type { EscritaModule } from "../data";
import { folderList } from "../settings";
import { lineList } from "../core/lists";
import { writingDay } from "../core/dates";
import { t } from "../i18n";
import { isPublished, runChecks, type SlugEntry } from "./checks";
import { noteUrl, slugToKeep } from "./slug";
import { dateText, initialDate, shouldWriteDate } from "./date";
import { PublishModal } from "./modal";

type Frontmatter = Record<string, unknown>;

/** Publish check: "Publish this note" / "Unpublish this note" (see docs/ROADMAP-short-fiction.md §1). */
export class PublishModule implements EscritaModule {
  constructor(private plugin: EscritaPlugin) {}

  load(): void {
    const p = this.plugin;

    p.addCommand({
      id: "publish-note",
      name: t("publish.command"),
      checkCallback: (checking) => {
        const file = this.activeNote();
        if (!file) return false;
        if (!checking) void this.openPublish(file);
        return true;
      },
    });
    p.addCommand({
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

    p.registerEvent(p.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
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

    p.registerEvent(p.app.vault.on("rename", (file, oldPath) => this.renamed(file, oldPath)));
    p.registerEvent(p.app.vault.on("delete", (file) => this.deleted(file)));
  }

  // ------------------------------------------------------------------ helpers

  private activeNote(): TFile | null {
    const file = this.plugin.app.workspace.getActiveFile();
    return file && file.extension === "md" ? file : null;
  }

  private frontmatter(file: TFile): Frontmatter {
    return (this.plugin.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Frontmatter;
  }

  private published(file: TFile, fm = this.frontmatter(file)): boolean {
    const s = this.plugin.settings;
    return isPublished(fm[s.statusProperty], s.publishedValue);
  }

  /** The note's site address (chapters under their book's slug). */
  private urlOf(file: TFile, fm = this.frontmatter(file)): string {
    const slugProperty = this.plugin.settings.slugProperty;
    const book = this.plugin.books.isChapter(file) ? this.plugin.books.bookFor(file) : null;
    return noteUrl(
      { path: file.path, frontmatter: fm },
      slugProperty,
      book ? { path: book.note.path, frontmatter: this.frontmatter(book.note) } : null,
    );
  }

  private publishFolders(): string[] {
    return folderList(this.plugin.settings.publishFolders);
  }

  private inFolders(path: string, folders: readonly string[]): boolean {
    return folders.some((f) => path === f || path.startsWith(`${f}/`));
  }

  /** Other published notes in the publish folders, with their addresses; null when the check is off for this note. */
  private otherPublished(file: TFile): SlugEntry[] | null {
    const folders = this.publishFolders();
    if (!folders.length || !this.inFolders(file.path, folders)) return null;
    const out: SlugEntry[] = [];
    for (const f of this.plugin.app.vault.getMarkdownFiles()) {
      if (f.path === file.path || !this.inFolders(f.path, folders)) continue;
      const fm = this.frontmatter(f);
      if (this.published(f, fm)) out.push({ path: f.path, slug: this.urlOf(f, fm) });
    }
    return out;
  }

  /** The note's text, from its editor when it's open there (it may not be saved yet). */
  private async textOf(file: TFile): Promise<string> {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === file.path) return view.editor.getValue();
    }
    return this.plugin.app.vault.cachedRead(file);
  }

  private title(file: TFile): string {
    return file.basename;
  }

  // ------------------------------------------------------------------ publish

  async openPublish(file: TFile): Promise<void> {
    const s = this.plugin.settings;
    if (!s.statusProperty.trim() || !s.publishedValue.trim()) {
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
    const url = this.urlOf(file, fm);
    const record = this.plugin.data.publish[file.path];
    const checks = runChecks(text, fm, {
      path: file.path,
      placeholderMarker: s.placeholderMarker,
      recommendedProperties: lineList(s.recommendedProperties),
      piece: s,
      url,
      others: this.otherPublished(file) ?? undefined,
      previousUrl: record?.slug,
    });
    const today = writingDay(new Date(), s.dayEndsAt);
    const shown = initialDate(fm[s.dateProperty], today);

    new PublishModal(this.plugin.app, {
      title: this.title(file),
      checks,
      date: shown.value,
      unparsedDate: shown.unparsed,
      onJump: (line) => { void this.jump(file, line); },
      onOpenPath: (path) => {
        const other = this.plugin.app.vault.getAbstractFileByPath(path);
        if (other instanceof TFile) void this.plugin.app.workspace.getLeaf(false).openFile(other);
      },
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
    try {
      await this.plugin.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
        previous = fm[s.statusProperty];
        wasPublished = isPublished(previous, s.publishedValue);
        fm[s.statusProperty] = s.publishedValue;
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
    // The metadata cache may not have the new properties yet; the slug property wasn't touched.
    record.slug = this.urlOf(file);
    this.plugin.data.publish[file.path] = record;
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
    const status = record?.previousStatus?.trim() || s.unpublishedValue.trim() || "ready";
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
      // Keep the slug so a later publish can still tell when the URL changed.
      delete record.previousStatus;
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

  private renamed(file: TAbstractFile, oldPath: string): void {
    const data = this.plugin.data.publish;
    if (oldPath in data) {
      data[file.path] = data[oldPath];
      delete data[oldPath];
      this.plugin.requestSave();
    } else {
      // A folder rename: move the records of the notes inside it.
      const prefix = `${oldPath}/`;
      let moved = false;
      for (const key of Object.keys(data)) {
        if (!key.startsWith(prefix)) continue;
        data[`${file.path}/${key.slice(prefix.length)}`] = data[key];
        delete data[key];
        moved = true;
      }
      if (moved) this.plugin.requestSave();
    }

    if (!(file instanceof TFile) || file.extension !== "md") return;
    const s = this.plugin.settings;
    if (!s.keepUrlOnRename) return;
    const fm = this.frontmatter(file);
    if (!this.published(file, fm)) return;
    const slug = slugToKeep(oldPath, file.path, fm, s.slugProperty, this.plugin.books.isChapter(file));
    if (slug) this.offerKeepUrl(file, slug);
  }

  private deleted(file: TAbstractFile): void {
    const data = this.plugin.data.publish;
    const prefix = `${file.path}/`;
    let changed = false;
    for (const key of Object.keys(data)) {
      if (key === file.path || key.startsWith(prefix)) {
        delete data[key];
        changed = true;
      }
    }
    if (changed) this.plugin.requestSave();
  }

  private offerKeepUrl(file: TFile, slug: string): void {
    const prop = this.plugin.settings.slugProperty;
    let notice: Notice | null = null;
    const frag = createFragment((f) => {
      f.createDiv({ text: t("publish.keepUrl.text", { title: this.title(file), slug }) });
      const button = f.createEl("button", { cls: "mod-cta escrita-publish-keep", text: t("publish.keepUrl.button") });
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        notice?.hide();
        void this.keepUrl(file, prop, slug);
      });
    });
    notice = new Notice(frag, 20000);
  }

  private async keepUrl(file: TFile, prop: string, slug: string): Promise<void> {
    try {
      let added = false;
      await this.plugin.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
        const cur = fm[prop];
        if (typeof cur === "string" && cur.trim()) return;
        fm[prop] = slug;
        added = true;
      });
      if (added) new Notice(t("publish.keepUrl.done", { property: prop, slug }));
    } catch (e) {
      console.error("Escrita: couldn't add the slug property", file.path, e);
      new Notice(t("publish.keepUrl.error"));
    }
  }
}
