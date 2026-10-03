import { MarkdownView, Notice, TFile } from "obsidian";
import type EscritaPlugin from "../main";
import { FeatureModule } from "../core/module-context";
import type { FeatureId } from "../core/features";
import type { Follower } from "../core/vault-index";
import { lineList } from "../core/lists";
import { writtenWord } from "../core/stages";
import { dropKeys, renameKeys } from "../core/path-keys";
import { writingDay } from "../core/dates";
import { t } from "../i18n";
import { isPublished, runChecks } from "./checks";
import { dateText, initialDate, shouldWriteDate } from "./date";
import { PublishModal } from "./modal";

type Frontmatter = Record<string, unknown>;

/** Publish check: "Publish this note" / "Unpublish this note" (see docs/ROADMAP-short-fiction.md §1). */
export class PublishModule extends FeatureModule {
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

  private frontmatter(file: TFile): Frontmatter {
    return (this.plugin.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Frontmatter;
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
    const checks = runChecks(text, fm, {
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
}
