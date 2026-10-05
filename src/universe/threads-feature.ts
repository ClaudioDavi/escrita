// Open threads as a switchable feature, split out of the universe module (0.7 plan Q9, task 2.11).
// It owns the threads index, the thread marker extension, the standalone threads view and the
// three thread commands. It works with the universe unloaded (the mode off): the stateless
// helpers it calls on `plugin.universe` (scopeOf, closeThread, answerLink, worksIn) never touch
// the universe's own index.

import { TFile } from "obsidian";
import type EscritaPlugin from "../main";
import { t } from "../i18n";
import { FeatureModule, type SettingsUi } from "../core/module-context";
import type { Follower, VaultIndex } from "../core/vault-index";
import { dropSeen, pruneSeen, recordSeen, renameSeen } from "./first-seen";
import { collectThreads, inScope, threadsSpec, type NoteThreads, type ThreadRef } from "./threads";
import type { Scope } from "./scope";
import { addThreadsEditorMenuItems, closeThreadAtCursor, inSource, plantThread, threadAtCursor, threadMarkerExtension } from "./create";
import { THREADS_VIEW, ThreadsView } from "./view";
import { threadsSettingsSection } from "./threads-settings-ui";

export class ThreadsFeature extends FeatureModule {
  readonly id = "threads" as const;
  readonly slots = { views: [THREADS_VIEW], editors: 1 };
  private idx: VaultIndex<TFile, NoteThreads> | null = null;

  constructor(private plugin: EscritaPlugin) { super(); }

  /** First-seen dates follow renames and go with deleted notes, whether or not the feature is on (Q8). Touches plugin.data only. */
  dataFollowers(): Follower[] {
    const p = this.plugin;
    return [{
      moved: (oldPath, newPath) => { if (renameSeen(p.data.threadSeen, oldPath, newPath)) p.requestSave(); },
      deleted: (path) => { if (dropSeen(p.data.threadSeen, path)) p.requestSave(); },
    }];
  }

  onload(): void {
    const p = this.plugin;
    const idx = this.ctx.index<TFile, NoteThreads>(threadsSpec<TFile>(() => p.settings));
    this.idx = idx;
    this.register(idx.onReady(() => { this.recordAll(); p.universe.emit(); }));
    this.register(idx.onChange((changes) => {
      let dirty = false;
      for (const c of changes) {
        if (c.after && recordSeen(p.data.threadSeen, c.path, c.after.map((x) => x.text), Date.now())) dirty = true;
      }
      if (dirty) p.requestSave();
      p.universe.emit();
    }));
    this.ctx.onLayoutReady(() => {
      const exists = (path: string) => p.app.vault.getAbstractFileByPath(path) !== null;
      if (pruneSeen(p.data.threadSeen, exists)) p.requestSave();
    });

    this.ctx.view(THREADS_VIEW, (leaf) => new ThreadsView(leaf, p));
    this.ctx.editor([threadMarkerExtension(p)]);
    this.registerCommands();
    this.registerEvent(p.app.workspace.on("editor-menu", (menu, editor, info) => addThreadsEditorMenuItems(p, menu, editor, info)));
    p.universe.emit();
  }

  onunload(): void {
    this.idx = null;   // the context disposes the index
    this.plugin.universe.emit();
  }

  settingsChanged(): void {
    this.plugin.universe.emit();
  }

  /** True when nothing is being built: the index finished, or the feature is off. */
  isReady(): boolean {
    return this.idx === null || this.idx.isReady();
  }

  /**
   * The threads of a scope (open and closed; `{ open: true }` drops the closed), by note
   * path then position. Scope kind none means the tracked works (mode off, or a note
   * outside any book in per-book mode); book and universe scopes cover every note of
   * that book or universe, entries included. Each ref carries its first-seen time (ms).
   * [] while the feature is off.
   */
  threads(scope: Scope, opts: { open?: boolean } = {}): ThreadRef[] {
    const p = this.plugin;
    const belongs = scope.kind === "none"
      ? (path: string) => p.books.classify(path).tracked
      : (path: string) => inScope(p.universe.scopeOf(path), scope);
    return collectThreads(this.idx?.entries() ?? [], belongs, p.data.threadSeen, opts.open === true);
  }

  /** The threads of one note, in order (open and closed). */
  threadsOf(path: string): ThreadRef[] {
    return collectThreads(this.idx?.entries() ?? [], (x) => x === path, this.plugin.data.threadSeen);
  }

  private recordAll(): void {
    const p = this.plugin;
    let dirty = false;
    for (const [path, list] of this.idx?.entries() ?? []) {
      if (recordSeen(p.data.threadSeen, path, list.map((x) => x.text), Date.now())) dirty = true;
    }
    if (dirty) p.requestSave();
  }

  private registerCommands(): void {
    const p = this.plugin;
    this.ctx.command({
      id: "show-threads",
      name: t("universe.cmd.showThreads"),
      callback: () => { void p.universe.showThreads(); },
    });
    this.ctx.command({
      id: "plant-thread",
      name: t("universe.cmd.plantThread"),
      editorCheckCallback: (checking, editor, ctx) => {
        if (!inSource(ctx)) return false;
        if (!checking) plantThread(p, editor);
        return true;
      },
    });
    this.ctx.command({
      id: "close-thread",
      name: t("universe.cmd.closeThread"),
      editorCheckCallback: (checking, editor, ctx) => {
        if (!inSource(ctx) || !ctx.file) return false;
        const thread = threadAtCursor(p, editor);
        if (!thread || thread.closed) return false;
        if (!checking) closeThreadAtCursor(p, editor, ctx.file, thread);
        return true;
      },
    });
  }

  settingsSection(el: HTMLElement, ui: SettingsUi): void { threadsSettingsSection(el, ui, this.plugin); }
}
