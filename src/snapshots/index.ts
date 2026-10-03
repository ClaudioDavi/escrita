// Snapshots (SF 4): copies of a note's text, taken by hand or automatically
// (before publishing, before restoring, before the day's first edit), a side
// panel listing them and a compare tab with word-level changes.
//
// Storage and naming: store.ts (pure, over the fs.ts port), paths.ts,
// index-format.ts, retention.ts. Comparing: compare.ts. Every write into the
// note goes through plugin.notes (the note text port), and every one of them
// first takes a "Before restoring" snapshot of the text it replaces.

import { Notice, TFile, TFolder, type TAbstractFile, type WorkspaceLeaf } from "obsidian";
import type EscritaPlugin from "../main";
import { FeatureModule, type FeatureSlots } from "../core/module-context";
import type { Follower } from "../core/vault-index";
import { movedPath } from "../core/path-keys";
import { inSnapshots, snapshotsRoot } from "../core/classify";
import { writingDay } from "../core/dates";
import { measureText } from "../core/measure";
import { revertPlan, wholeText, type AnchoredChange, type Change } from "../core/note-text";
import { t } from "../i18n";
import { confirmAction } from "../outline/modals";
import { createSnapshotFs } from "./fs";
import { label as entryLabel, type SnapshotEntry, type SnapshotKind } from "./index-format";
import { askName, pickPath } from "./modals";
import { isInside } from "./paths";
import { SharedFolderError, SnapshotStore, type SnapshotFs, type TakeResult } from "./store";
import { SNAPSHOTS_VIEW, SnapshotsView } from "./view";
import { COMPARE_VIEW, CompareView, type CompareMode } from "./compare-view";

export { SNAPSHOTS_VIEW } from "./view";
export { COMPARE_VIEW } from "./compare-view";

export class SnapshotsModule extends FeatureModule {
  readonly id = "snapshots" as const;
  readonly slots: FeatureSlots = { views: [SNAPSHOTS_VIEW, COMPARE_VIEW] };
  /** built at construction, not at load: the rename follower moves snapshot files while the feature is off (Q8) */
  store: SnapshotStore;
  private fsCache: { root: string; fs: SnapshotFs } | null = null;
  /** path → writing day of its first edit seen this session (the daily snapshot runs once) */
  private edited = new Map<string, string>();
  /** "notePath|file" of snapshots with an action running (double clicks) */
  private busy = new Set<string>();
  private dailyFailed = false;
  /** the note the panel shows; follows the active note */
  private shownPath: string | null = null;
  private refreshTimer: number | null = null;

  constructor(private plugin: EscritaPlugin) {
    super();
    this.store = new SnapshotStore(
      () => this.fs(),
      () => ({
        root: this.root(),
        keepAuto: plugin.settings.snapshotsKeepAuto,
        noteExists: (path) => plugin.app.vault.getAbstractFileByPath(path) instanceof TFile,
      }),
      (k) => this.kindLabel(k),
      (text) => measureText(text).words,
    );
  }

  // ---------------------------------------------------------------- paths

  root(): string {
    return snapshotsRoot(this.plugin.settings.snapshotsFolder);
  }

  isSnapshotPath(path: string): boolean {
    return inSnapshots(path, this.plugin.settings);
  }

  private fs(): SnapshotFs {
    const root = this.root();
    if (this.fsCache?.root !== root) {
      this.fsCache = { root, fs: createSnapshotFs(this.plugin.app, root, (p) => this.plugin.notes.ensureFolder(p)) };
    }
    return this.fsCache.fs;
  }

  /** A Markdown note outside the snapshots folder. */
  canSnapshot(file: TAbstractFile | null): file is TFile {
    return file instanceof TFile && file.extension === "md" && !this.isSnapshotPath(file.path);
  }

  kindLabel(k: SnapshotKind): string {
    return t(`snapshots.kind.${k}`);
  }

  labelOf(e: SnapshotEntry): string {
    return entryLabel(e, (k) => this.kindLabel(k));
  }

  noteFile(path: string): TFile | null {
    const f = this.plugin.app.vault.getAbstractFileByPath(path);
    return this.canSnapshot(f) ? f : null;
  }

  // ---------------------------------------------------------------- lifecycle

  onload(): void {
    const ctx = this.ctx;
    const { workspace, vault } = this.plugin.app;
    ctx.view(SNAPSHOTS_VIEW, (leaf) => new SnapshotsView(leaf, this));
    ctx.view(COMPARE_VIEW, (leaf) => new CompareView(leaf, this));

    const onActive = (run: (file: TFile) => void) => (checking: boolean): boolean => {
      const file = workspace.getActiveFile();
      if (!this.canSnapshot(file)) return false;
      if (!checking) run(file);
      return true;
    };
    ctx.command({
      id: "take-snapshot",
      name: t("snapshots.cmd.take"),
      checkCallback: onActive((f) => { void this.promptTake(f); }),
    });
    ctx.command({
      id: "open-snapshots",
      name: t("snapshots.cmd.open"),
      callback: () => { void this.openPanel(); },
    });
    ctx.command({
      id: "compare-last-snapshot",
      name: t("snapshots.cmd.compareLast"),
      checkCallback: onActive((f) => { void this.compareLast(f); }),
    });
    ctx.command({
      id: "browse-deleted-snapshots",
      name: t("snapshots.cmd.browseDeleted"),
      callback: () => { void this.browseDeleted(); },
    });

    this.registerEvent(workspace.on("file-menu", (menu, file) => {
      if (!this.canSnapshot(file)) return;
      menu.addItem((item) => item
        .setTitle(t("snapshots.menu.take"))
        .setIcon("camera")
        .onClick(() => { void this.promptTake(file); }));
    }));

    // The panel follows a rename of the note it shows. The snapshot files follow in dataFollowers().
    ctx.follow({ moved: (oldPath, newPath) => this.shownMoved(oldPath, newPath) });
    this.registerEvent(workspace.on("editor-change", (_ed, info) => this.firstEdit(info.file)));
    this.registerEvent(workspace.on("file-open", (file) => { if (this.canSnapshot(file)) this.follow(file.path); }));
    this.registerEvent(vault.on("modify", (f) => { if (f.path === this.shownPath) this.scheduleRefresh(); }));
    this.register(this.store.onChange((path) => { if (path === this.shownPath) this.scheduleRefresh(); }));
    // the panel's word delta
    this.register(this.plugin.measure.onChange((paths) => { if (this.shownPath && paths.includes(this.shownPath)) this.scheduleRefresh(); }));
    ctx.onLayoutReady(() => {
      const active = workspace.getActiveFile();
      if (this.canSnapshot(active)) this.follow(active.path);
    });
  }

  onunload(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.shownPath = null;
  }

  /**
   * Snapshots follow their note, also while the feature is off (Q8, a listed deviation):
   * this one moves files on disk and may rewrite `snapshotsFolder`. Deletes keep them, on purpose.
   * It touches only the store (built at construction), the settings and the vault.
   */
  dataFollowers(): Follower[] {
    return [{ moved: (oldPath, newPath) => this.renamed(oldPath, newPath) }];
  }

  settingsChanged(): void {
    this.fsCache = null;
    this.refreshViews();
  }

  // ---------------------------------------------------------------- views

  /** The note the panel shows. */
  currentNotePath(): string | null {
    return this.shownPath;
  }

  private follow(path: string): void {
    if (path === this.shownPath) return;
    this.shownPath = path;
    this.refreshViews();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refreshPanels();
    }, 250);
  }

  private refreshPanels(): void {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType(SNAPSHOTS_VIEW)) {
      if (leaf.view instanceof SnapshotsView) void leaf.view.refresh();
    }
  }

  refreshViews(): void {
    this.refreshPanels();
    for (const leaf of this.plugin.app.workspace.getLeavesOfType(COMPARE_VIEW)) {
      if (leaf.view instanceof CompareView) leaf.view.requestRefresh();
    }
  }

  async openPanel(): Promise<void> {
    const ws = this.plugin.app.workspace;
    let leaf: WorkspaceLeaf | null = ws.getLeavesOfType(SNAPSHOTS_VIEW)[0] ?? null;
    if (!leaf) {
      leaf = ws.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: SNAPSHOTS_VIEW, active: true });
    }
    await ws.revealLeaf(leaf);
  }

  /** The compare tab for a note (reused when one is open for it). `b` is "current" or another snapshot file. */
  async openCompare(notePath: string, a: string, b = "current", mode?: CompareMode): Promise<void> {
    const ws = this.plugin.app.workspace;
    const open = ws.getLeavesOfType(COMPARE_VIEW).find((l) => l.view instanceof CompareView && l.view.notePath() === notePath);
    const leaf = open ?? ws.getLeaf("tab");
    const prev = open?.view instanceof CompareView ? open.view.mode() : undefined;
    await leaf.setViewState({ type: COMPARE_VIEW, active: true, state: { notePath, a, b, mode: mode ?? prev ?? "inline" } });
    await ws.revealLeaf(leaf);
  }

  private async compareLast(file: TFile): Promise<void> {
    try {
      const last = (await this.store.list(file))[0];
      if (!last) {
        new Notice(t("snapshots.empty.none"));
        return;
      }
      await this.openCompare(file.path, last.file);
    } catch (e) {
      console.error("Escrita: couldn't open the snapshot comparison", e);
      new Notice(t("snapshots.notice.failed"));
    }
  }

  /**
   * Snapshots are kept when their note is deleted: pick such a note and read
   * its snapshots in the compare tab (full text, read-only).
   */
  private async browseDeleted(): Promise<void> {
    try {
      const { vault } = this.plugin.app;
      const gone = (await this.store.notesWithSnapshots())
        .filter((p) => !(vault.getAbstractFileByPath(p) instanceof TFile))
        .sort((a, b) => a.localeCompare(b));
      if (gone.length === 0) {
        new Notice(t("snapshots.deleted.none"));
        return;
      }
      const path = await pickPath(this.plugin.app, gone, t("snapshots.deleted.placeholder"));
      if (path === null) return;
      const last = (await this.store.list(path))[0];
      if (!last) {
        new Notice(t("snapshots.deleted.none"));
        return;
      }
      await this.openCompare(path, last.file, "current", "view");
    } catch (e) {
      console.error("Escrita: couldn't list the snapshots of deleted notes", e);
      new Notice(t("snapshots.notice.failed"));
    }
  }

  // ---------------------------------------------------------------- reading

  /** A note's snapshots: a TFile, or the path of a note that is gone. */
  list(note: TFile | string): Promise<SnapshotEntry[]> {
    return this.store.list(note);
  }

  readSnapshot(notePath: string, file: string): Promise<string> {
    return this.store.read(notePath, file);
  }

  /** The note's text as the writer sees it (the editor's, maybe unsaved). */
  currentText(file: TFile): Promise<string> {
    return this.plugin.notes.text(file).read();
  }

  /** The note's words now, by Escrita's rules (plugin.measure). */
  async currentWords(file: TFile): Promise<number> {
    return (await this.plugin.measure.counts(file)).words;
  }

  isBusy(notePath: string, file: string): boolean {
    return this.busy.has(`${notePath}|${file}`);
  }

  private async guard<T>(notePath: string, file: string, run: () => Promise<T>, fallback: T): Promise<T> {
    const key = `${notePath}|${file}`;
    if (this.busy.has(key)) return fallback;
    this.busy.add(key);
    this.refreshPanels();
    try {
      return await run();
    } finally {
      this.busy.delete(key);
      this.refreshPanels();
    }
  }

  // ---------------------------------------------------------------- taking

  /** Ask for a name, then take a manual snapshot. */
  async promptTake(file: TFile): Promise<void> {
    const name = await askName(this.plugin.app, {
      title: t("snapshots.name.takeTitle"),
      value: "",
      placeholder: t("snapshots.name.placeholder"),
      confirm: t("snapshots.name.take"),
    });
    if (name === null) return;
    await this.take(file, "manual", name.trim() || t("snapshots.name.placeholder"));
  }

  /**
   * Take a snapshot of `text` (default: what the writer sees now). Manual ones
   * say what happened; automatic ones are silent unless they fail. Null on
   * failure (a notice was shown).
   */
  async take(
    file: TFile, kind: SnapshotKind, name?: string, text?: string, day?: string, protect?: string[],
  ): Promise<TakeResult | null> {
    const shown = kind === "manual" ? name || this.kindLabel(kind) : this.kindLabel(kind);
    try {
      const body = text ?? await this.plugin.notes.text(file).read();
      const r = await this.store.take(file, body, {
        kind,
        name: kind === "manual" ? name : undefined,
        day: day ?? writingDay(new Date(), this.plugin.settings.dayEndsAt),
        words: measureText(body).words,
        protect,
      });
      if (kind === "manual") {
        if (r.status === "taken") new Notice(t("snapshots.notice.taken", { name: this.labelOf(r.entry) }));
        else if (r.status === "promoted") new Notice(t("snapshots.notice.promoted", { name: this.labelOf(r.entry) }));
        else new Notice(t("snapshots.notice.unchanged"));
      }
      return r;
    } catch (e) {
      console.error(`Escrita: couldn't take a snapshot of ${file.path}`, e);
      new Notice(e instanceof SharedFolderError
        ? t("snapshots.notice.sharedFolder", { other: e.owner })
        : t("snapshots.notice.autoFailed", { name: shown }));
      return null;
    }
  }

  /** "Before publishing": the text as it was before the properties change. Never throws. */
  async beforePublish(file: TFile): Promise<void> {
    if (!this.canSnapshot(file)) return;
    try {
      await this.take(file, "publish");
    } catch (e) {
      console.error("Escrita: the snapshot before publishing failed", e);
    }
  }

  /** Escrita's own writes don't count as the writer's first edit of the day. */
  markEditedToday(path: string): void {
    this.edited.set(path, writingDay(new Date(), this.plugin.settings.dayEndsAt));
  }

  /**
   * The first change to a tracked note on a writing day: snapshot the text on
   * disk, which autosave (debounced) hasn't touched yet. The read starts before
   * anything is awaited, so the save can't land first.
   */
  private firstEdit(file: TFile | null): void {
    const s = this.plugin.settings;
    if (!s.snapshotBeforeFirstEdit || !this.canSnapshot(file)) return;
    const day = writingDay(new Date(), s.dayEndsAt);
    if (this.edited.get(file.path) === day) return;
    this.edited.set(file.path, day);
    if (!this.plugin.books.classify(file).tracked) return;
    const reading = this.plugin.app.vault.read(file);
    void (async () => {
      const text = await reading;
      if (await this.store.hasDaily(file, day)) return;
      const r = await this.store.take(file, text, { kind: "daily", day, words: measureText(text).words });
      if (r.status === "taken" && file.path === this.shownPath) this.scheduleRefresh();
    })().catch((e) => {
      console.error(`Escrita: couldn't take the day's first snapshot of ${file.path}`, e);
      if (this.dailyFailed) return;
      this.dailyFailed = true;
      new Notice(t("snapshots.notice.autoFailed", { name: this.kindLabel("daily") }));
    });
  }

  // ---------------------------------------------------------------- changing snapshots

  async rename(file: TFile, e: SnapshotEntry): Promise<void> {
    const name = await askName(this.plugin.app, {
      title: t("snapshots.name.renameTitle"),
      value: e.name,
      placeholder: this.labelOf(e),
      confirm: t("snapshots.name.save"),
    });
    if (name === null || name.trim() === e.name) return;
    await this.guard(file.path, e.file, async () => {
      try {
        await this.store.rename(file, e.file, name);
      } catch (err) {
        console.error("Escrita: couldn't rename the snapshot", err);
        new Notice(t("snapshots.notice.failed"));
      }
    }, undefined);
  }

  async remove(file: TFile, e: SnapshotEntry): Promise<void> {
    const name = this.labelOf(e);
    const ok = await confirmAction(this.plugin.app, t("snapshots.confirm.deleteTitle", { name }),
      t("snapshots.confirm.deleteBody"), t("snapshots.action.delete"), true);
    if (!ok) return;
    await this.guard(file.path, e.file, async () => {
      try {
        await this.store.trash(file, e.file);
        new Notice(t("snapshots.notice.deleted", { name }));
      } catch (err) {
        console.error("Escrita: couldn't delete the snapshot", err);
        new Notice(t("snapshots.notice.failed"));
      }
    }, undefined);
  }

  // ---------------------------------------------------------------- restoring

  /**
   * The whole note becomes the snapshot's text. Confirms first; the text it
   * replaces is saved as "Before restoring" (nothing is replaced when that
   * fails), and it is replaced only if the note didn't change meanwhile.
   */
  async restoreAll(file: TFile, e: SnapshotEntry): Promise<boolean> {
    const name = this.labelOf(e);
    const ok = await confirmAction(this.plugin.app, t("snapshots.confirm.restoreTitle", { name }),
      t("snapshots.confirm.restoreBody"), t("snapshots.action.restore"), true);
    if (!ok) return false;
    return this.guard(file.path, e.file, async () => {
      let snap: string;
      try {
        snap = await this.store.read(file, e.file);
      } catch (err) {
        console.error("Escrita: couldn't read the snapshot", err);
        new Notice(t("snapshots.notice.missing"));
        return false;
      }
      return this.replace(file, (cur) => (cur === snap ? "same" : (now) => (now === cur ? wholeText(now, snap) : null)), () => {
        new Notice(t("snapshots.notice.restored", { name }));
      }, "snapshots.notice.changed", [e.file]);
    }, false);
  }

  /**
   * "Use the old version" for one passage (or the properties): check-then-replace,
   * after a "Before restoring" snapshot. `shown` is the note text the compare view
   * showed: the revert is refused when the note differs from it now (a stale view).
   * `protect`: the snapshots being compared, which that snapshot must not prune.
   */
  async revertBlock(file: TFile, change: AnchoredChange, shown?: string, protect: string[] = []): Promise<boolean> {
    const plan = revertPlan(change, shown);
    return this.replace(file, (cur) => (plan(cur) ? plan : "gone"),
      () => undefined, "snapshots.notice.blockChanged", protect);
  }

  /**
   * The common path of every write into the note: read what the writer sees,
   * decide, snapshot it as "Before restoring", then apply the plan (which
   * checks the text again, atomically).
   */
  private async replace(
    file: TFile,
    decide: (cur: string) => "same" | "gone" | ((now: string) => Change | null),
    done: () => void,
    changedKey: string,
    protect: string[] = [],
  ): Promise<boolean> {
    try {
      const cur = await this.plugin.notes.text(file).read();
      const plan = decide(cur);
      if (plan === "same") {
        new Notice(t("snapshots.notice.identical"));
        return false;
      }
      if (plan === "gone") {
        new Notice(t(changedKey));
        return false;
      }
      this.markEditedToday(file.path);
      // never replace text that isn't saved somewhere first
      if (!(await this.take(file, "restore", undefined, cur, undefined, protect))) return false;
      // a fresh port: while the snapshot was written, the editor may have moved on
      // to another note, or the note may have been opened for editing
      const res = await this.plugin.notes.text(file).apply(plan);
      if (!res.ok) {
        new Notice(t(changedKey));
        return false;
      }
      done();
      this.refreshViews();
      return true;
    } catch (err) {
      console.error(`Escrita: couldn't restore into ${file.path}`, err);
      new Notice(t("snapshots.notice.failed"));
      return false;
    }
  }

  // ---------------------------------------------------------------- renames

  private renamed(oldPath: string, newPath: string): void {
    // A follower carries paths only; the vault says what the new path is.
    const f = this.plugin.app.vault.getAbstractFileByPath(newPath);
    if (!f) return;
    const root = this.root();
    // The snapshots folder itself (or a folder holding it) was renamed: follow it.
    if (f instanceof TFolder && isInside(oldPath, root)) {
      this.plugin.settings.snapshotsFolder = f.path + root.slice(oldPath.length);
      void this.plugin.saveSettings();
      return;
    }
    if (isInside(root, f.path) || isInside(root, oldPath)) return;
    let job: Promise<void> | null = null;
    if (f instanceof TFile) {
      if (oldPath.endsWith(".md") && f.path.endsWith(".md")) job = this.store.moveNote(oldPath, f.path);
    } else if (f instanceof TFolder) {
      job = this.store.moveFolder(oldPath, f.path);
    }
    job?.catch((e) => console.error(`Escrita: couldn't move the snapshots of ${oldPath} to ${f.path}`, e));
  }

  /** The panel's note was renamed, or sits in a folder that was. */
  private shownMoved(oldPath: string, newPath: string): void {
    const root = this.root();
    if (isInside(root, newPath) || isInside(root, oldPath)) return;
    if (this.shownPath === null) return;
    const next = movedPath(this.shownPath, oldPath, newPath);
    if (next !== null) this.shownPath = next;
  }
}
