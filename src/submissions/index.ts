import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type EscritaPlugin from "../main";
import { FeatureModule, type SettingsUi } from "../core/module-context";
import type { FeatureId } from "../core/features";
import type { Follower, VaultIndex } from "../core/vault-index";
import { isInside } from "../snapshots/paths";
import type { PendingSource, PendingSubmission } from "../core/pending";
import { inSubmissions, submissionsRoot } from "../core/classify";
import { isoDay } from "../core/dates";
import { writtenWord } from "../core/stages";
import { fmt, t } from "../i18n";
import { SubmissionModal } from "./modal";
import { submissionsOffNotice, submissionsSettingsSection } from "./settings-ui";
import {
  pendingList, pendingValue, propsKey, propsOf, recentMarkets, rowOf, sameRow, submissionPath, submissionText, workFor,
  type PlacementLike, type SubmissionRow,
} from "./logic";

/**
 * Submissions (SF 12, 0.8): one note per submission, "Record a submission" for the active
 * note's work, and the pending list the home block counts (the `pending` port, Q12).
 */
export class SubmissionsModule extends FeatureModule {
  readonly id: FeatureId = "submissions";

  private index: VaultIndex<TFile, SubmissionRow> | null = null;
  private listeners = new Set<() => void>();
  private cached: readonly PendingSubmission[] | null = null;

  /** The port the desk reads while this feature is on (core/pending.ts). Stable across loads. */
  readonly pending: PendingSource = {
    list: () => this.list(),
    onChange: (cb) => {
      this.listeners.add(cb);
      return () => { this.listeners.delete(cb); };
    },
  };

  constructor(private plugin: EscritaPlugin) { super(); }

  override onload(): void {
    const { plugin, ctx } = this;
    const s = () => plugin.settings;

    this.index = ctx.index<TFile, SubmissionRow>({
      name: "submissions",
      mode: "metadata",
      include: (f) => f.extension === "md" && inSubmissions(f.path, s()),
      compute: (f) => rowOf(plugin.app.metadataCache.getFileCache(f)?.frontmatter as Record<string, unknown> | undefined, propsOf(s())),
      same: sameRow,
      settingsKey: () => `${submissionsRoot(s().submissionsFolder)}|${propsKey(propsOf(s()))}`,
    });
    this.register(this.index.onChange(() => this.changed()));
    // a work renamed or moved changes what a `work` link resolves to, though no submission note changed
    const linkMoved = (f: unknown) => { if (f instanceof TFile && f.extension === "md" && this.hasRows()) this.changed(); };
    this.registerEvent(plugin.app.vault.on("rename", linkMoved));
    this.registerEvent(plugin.app.vault.on("delete", linkMoved));
    this.registerEvent(plugin.app.vault.on("create", linkMoved));

    ctx.command({
      id: "record-submission",
      name: t("submissions.command"),
      callback: () => { void this.record(plugin.app.workspace.getActiveFile()); },
    });
    this.registerEvent(plugin.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      if (this.choose(file).kind !== "work") return;
      menu.addItem((item) => item
        .setTitle(t("submissions.menu"))
        .setIcon("send")
        .onClick(() => { void this.record(file); }));
    }));
  }

  override onunload(): void {
    this.index = null;
    this.cached = null;
    this.listeners.clear();
  }

  override settingsChanged(): void {
    this.changed();
  }

  /** The submissions folder (or a folder holding it) was renamed: the setting follows, even while the feature is off. */
  dataFollowers(): Follower[] {
    return [{
      moved: (oldPath, newPath) => {
        const f = this.plugin.app.vault.getAbstractFileByPath(newPath);
        const root = submissionsRoot(this.plugin.settings.submissionsFolder);
        if (f instanceof TFolder && isInside(oldPath, root)) {
          this.plugin.settings.submissionsFolder = f.path + root.slice(oldPath.length);
          void this.plugin.saveSettings();
        }
      },
    }];
  }

  settingsSection(el: HTMLElement, ui: SettingsUi): void { submissionsSettingsSection(el, ui, this.plugin); }
  offNotice(): Promise<string | null> { return submissionsOffNotice(this.plugin); }

  // --- the pending port -----------------------------------------------------

  private hasRows(): boolean {
    return this.index !== null && this.index.size > 0;
  }

  private changed(): void {
    this.cached = null;
    for (const cb of [...this.listeners]) {
      try { cb(); } catch (e) { console.error("Escrita: a submissions listener failed", e); }
    }
  }

  private list(): readonly PendingSubmission[] {
    if (!this.index) return [];
    if (this.cached) return this.cached;
    const { metadataCache } = this.plugin.app;
    const list = pendingList(this.index.entries(), pendingValue(this.plugin.settings.submissionResults), (target, from) => {
      const dest = metadataCache.getFirstLinkpathDest(target, from);
      return dest ? dest.path : null;
    });
    this.cached = list;
    return list;
  }

  /** The three most recent markets from the submission notes. */
  recentMarkets(): string[] {
    return this.index ? recentMarkets([...this.index.entries()].map(([, row]) => row), 3) : [];
  }

  // --- recording ------------------------------------------------------------

  private choose(file: TFile) {
    return workFor(this.plugin.books.classify(file) as unknown as PlacementLike, file.basename);
  }

  async record(file: TFile | null): Promise<void> {
    const { plugin } = this;
    const choice = file && file.extension === "md" ? this.choose(file) : ({ kind: "none" } as const);
    if (choice.kind === "none") { new Notice(t("submissions.notice.open")); return; }
    if (choice.kind === "no-stage") { new Notice(t("submissions.notice.noStage", { title: choice.title })); return; }
    if (choice.kind === "untracked") { new Notice(t("submissions.notice.untracked", { title: choice.title })); return; }
    const work = plugin.app.vault.getAbstractFileByPath(choice.path);
    if (!(work instanceof TFile)) { new Notice(t("submissions.notice.open")); return; }

    const s = plugin.settings;
    const folder = submissionsRoot(s.submissionsFolder);
    const result = pendingValue(s.submissionResults);
    const pathFor = (market: string, sent: string) => normalizePath(submissionPath(folder, sent, work.basename, market));
    const linkFor = (market: string, sent: string) =>
      `[[${plugin.app.metadataCache.fileToLinktext(work, pathFor(market, sent), true)}]]`;

    new SubmissionModal(plugin.app, {
      workTitle: choice.title,
      workInfo: this.workInfo(work),
      markets: this.recentMarkets(),
      today: isoDay(new Date()),
      result,
      props: propsOf(s),
      pathFor,
      linkFor,
      onRecord: async (market, sent) => {
        try {
          const path = pathFor(market, sent);
          await plugin.notes.create(path, submissionText({ link: linkFor(market, sent), market, sent, result }, propsOf(s)), { exists: "unique" });
          new Notice(t("submissions.recorded", { work: choice.title, market }));
          return true;
        } catch (e) {
          console.error("Escrita: couldn't record the submission", e);
          new Notice(t("submissions.notice.error"));
          return false;
        }
      },
    }).open();
  }

  /** "pronto · 5.120": the work's stage word and size, as far as they are known without counting. */
  private workInfo(work: TFile): string {
    const { plugin } = this;
    const place = plugin.books.classify(work);
    const bits: string[] = [];
    if (place.stage) bits.push(writtenWord(plugin.settings.stages, place.stage));
    const counts = place.book && place.kind === "book-note" ? plugin.measure.bookPeek(place.book) : plugin.measure.peek(work.path, "words");
    if (counts) bits.push(fmt(counts.words));
    return bits.join(" · ");
  }
}
