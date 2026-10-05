import { MarkdownView, Notice, TFile, debounce, type Editor, type PaneType, type WorkspaceLeaf } from "obsidian";
import type EscritaPlugin from "../main";
import { FeatureModule } from "../core/module-context";
import type { SettingsUi } from "../core/module-context";
import type { FeatureId } from "../core/features";
import { folderList } from "../core/lists";
import type { IndexChange, VaultIndex } from "../core/vault-index";
import { classifyKey, snapshotsRoot } from "../core/classify";
import type { Applied } from "../core/note-text";
import { t } from "../i18n";
import { locate, placeholderSpec, planInsert, resolvePlaceholder, scan, stepIndex, type IndexedMarker } from "./logic";
import { placeholderDecorations } from "./decoration";
import { PLACEHOLDERS_VIEW, PlaceholdersView } from "./view";
import { placeholdersSettingsSection } from "./settings-ui";

export { PLACEHOLDERS_VIEW } from "./view";
export type { IndexedMarker } from "./logic";

export class PlaceholdersModule extends FeatureModule {
  readonly id: FeatureId = "placeholders";
  readonly slots = { views: [PLACEHOLDERS_VIEW], editors: 1 };
  /** the vault index; set in onload(), null while the feature is off */
  private idx: VaultIndex<TFile, IndexedMarker[]> | null = null;
  /** Subscribers to onChange. They outlive a load: the index feeds them only while loaded. */
  private listeners = new Set<() => void>();
  private lastMarker = "";
  private lastDots = true;
  /** paths whose dot may have changed since the last redraw; "all" redraws every item */
  private dotPaths: Set<string> | "all" = new Set();
  private dotsSoon = debounce(() => this.flushDots(), 100, true);

  constructor(private plugin: EscritaPlugin) {
    super();
  }

  // ---------------------------------------------------------------- public API

  /** Number of placeholders in a file (0 when none, or not indexed). */
  countFor(path: string): number {
    return this.idx?.get(path)?.length ?? 0;
  }

  /** Placeholders in a file, as last indexed. */
  markersFor(path: string): IndexedMarker[] {
    return this.idx?.get(path) ?? [];
  }

  /** Paths of every file with at least one placeholder. */
  paths(): string[] {
    return this.idx?.paths() ?? [];
  }

  /** Every file with placeholders and its markers. */
  all(): { file: TFile; markers: IndexedMarker[] }[] {
    const out: { file: TFile; markers: IndexedMarker[] }[] = [];
    for (const [path, markers] of this.idx?.entries() ?? []) {
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) out.push({ file, markers });
    }
    return out;
  }

  /** Called whenever the index changes, while the feature is on. Returns the unsubscribe function. */
  onChange(cb: () => void): () => void {
    const entry = () => cb();
    this.listeners.add(entry);
    return () => { this.listeners.delete(entry); };
  }

  /** True once the first full index has been built. */
  isReady(): boolean {
    return this.idx?.isReady() ?? false;
  }

  // ---------------------------------------------------------------- lifecycle

  onload(): void {
    const p = this.plugin;
    const ctx = this.ctx;
    this.lastMarker = this.marker();
    this.lastDots = p.settings.showExplorerDots;

    const idx = ctx.index<TFile, IndexedMarker[]>(placeholderSpec<TFile>({
      marker: () => this.marker(),
      exclude: () => this.excluded(),
      settingsKey: () => JSON.stringify([classifyKey(p.settings), this.marker()]),
    }));
    this.idx = idx;
    // Views waiting on "indexing" leave it once a build completes.
    idx.onReady(() => {
      for (const leaf of p.app.workspace.getLeavesOfType(PLACEHOLDERS_VIEW)) {
        if (leaf.view instanceof PlaceholdersView) leaf.view.render();
      }
      this.applyDots();
    });

    ctx.view(PLACEHOLDERS_VIEW, (leaf) => new PlaceholdersView(leaf, p));
    ctx.editor([placeholderDecorations(() => this.marker())]);

    ctx.command({
      id: "insert-placeholder",
      name: t("placeholders.cmd.insert"),
      editorCallback: (editor) => this.insert(editor),
    });
    ctx.command({
      id: "next-placeholder",
      name: t("placeholders.cmd.next"),
      editorCallback: (editor) => this.step(editor, 1),
    });
    ctx.command({
      id: "previous-placeholder",
      name: t("placeholders.cmd.prev"),
      editorCallback: (editor) => this.step(editor, -1),
    });
    ctx.command({
      id: "open-placeholders",
      name: t("placeholders.cmd.open"),
      callback: () => { void this.openView(); },
    });

    // A small dot after files with placeholders in the file explorer (silent: no tooltip).
    ctx.decorate("dot", (it) =>
      !it.folder && p.settings.showExplorerDots && this.countFor(it.path) > 0 ? {} : null);
    // One subscription per load; the index is disposed on unload, which ends it.
    idx.onChange((changes) => {
      for (const cb of [...this.listeners]) cb();
      this.markDots(changes);
      this.dotsSoon();
    });
  }

  onunload(): void {
    this.idx = null;
    this.dotsSoon.cancel();
    this.dotPaths = new Set();
  }

  settingsChanged(): void {
    const s = this.plugin.settings;
    const marker = this.marker();
    const dots = s.showExplorerDots !== this.lastDots;
    const markerMoved = marker !== this.lastMarker;
    this.lastMarker = marker;
    this.lastDots = s.showExplorerDots;
    // Editors read the marker on each update; this makes them update now. The hub itself
    // rebuilds the index when its settings key (classify's inputs and the marker) changed.
    if (markerMoved) this.plugin.app.workspace.updateOptions();
    if (dots) this.applyDots();
  }

  // ---------------------------------------------------------------- index

  private marker(): string {
    return this.plugin.settings.placeholderMarker || "XXX";
  }

  /** Folders the index leaves out: the exclude folders and the snapshots folder. */
  private excluded(): string[] {
    const s = this.plugin.settings;
    return [...folderList(s.excludeFolders), snapshotsRoot(s.snapshotsFolder)];
  }

  private applyDots(): void {
    this.dotPaths = new Set();
    this.plugin.decorations.refresh("dot");
  }

  /** Notes which items' dots an index change may have moved (a build or a settings change: all of them). */
  private markDots(changes: readonly IndexChange<IndexedMarker[]>[]): void {
    if (this.dotPaths === "all") return;
    for (const c of changes) {
      if (c.cause === "build") { this.dotPaths = "all"; return; }
      this.dotPaths.add(c.path);
      if (c.from !== undefined) this.dotPaths.add(c.from);
    }
  }

  /** Redraws only the items whose dot may have changed (IMPROVEMENTS 23). */
  private flushDots(): void {
    const paths = this.dotPaths;
    this.dotPaths = new Set();
    if (paths === "all") this.plugin.decorations.refresh("dot");
    else if (paths.size > 0) this.plugin.decorations.refresh("dot", paths);
  }

  // ---------------------------------------------------------------- commands

  private insert(editor: Editor): void {
    const marker = this.marker();
    const selection = editor.getSelection();
    const at = selection ? editor.getCursor("to") : editor.getCursor();
    const line = editor.getLine(at.line);
    const before = at.ch > 0 ? line.charAt(at.ch - 1) : "";
    const after = line.charAt(at.ch);
    const plan = planInsert(marker, selection, before, after);
    const base = editor.posToOffset(at);
    editor.replaceRange(plan.text, at);
    editor.setCursor(editor.offsetToPos(base + plan.cursor));
  }

  private step(editor: Editor, dir: 1 | -1): void {
    const ms = scan(editor.getValue(), this.marker());
    if (ms.length === 0) {
      new Notice(t("placeholders.noneInNote"));
      return;
    }
    const i = stepIndex(ms.map((m) => m.from), editor.posToOffset(editor.getCursor("from")), dir);
    this.select(editor, ms[i].from, ms[i].to);
  }

  private select(editor: Editor, from: number, to: number): void {
    const a = editor.offsetToPos(from);
    const b = editor.offsetToPos(to);
    editor.setSelection(a, b);
    editor.scrollIntoView({ from: a, to: b }, true);
  }

  // ---------------------------------------------------------------- view actions

  async openView(): Promise<void> {
    try {
      const ws = this.plugin.app.workspace;
      let leaf: WorkspaceLeaf | null = ws.getLeavesOfType(PLACEHOLDERS_VIEW)[0] ?? null;
      if (!leaf) {
        leaf = ws.getRightLeaf(false);
        if (!leaf) return;
        await leaf.setViewState({ type: PLACEHOLDERS_VIEW, active: true });
      }
      await ws.revealLeaf(leaf);
    } catch (e) {
      console.error("Escrita: could not open the placeholders view", e);
      new Notice(t("placeholders.openFailed"));
    }
  }

  private markdownLeafFor(path: string): WorkspaceLeaf | null {
    const leaves = this.plugin.app.workspace.getLeavesOfType("markdown");
    return leaves.find((l) => l.view instanceof MarkdownView && l.view.file?.path === path) ?? null;
  }

  /** Open the file with the placeholder selected (in a new tab/split when `newLeaf`). Never rejects. */
  async openAt(path: string, m: IndexedMarker, newLeaf: PaneType | boolean = false): Promise<void> {
    try {
      await this.openAtUnsafe(path, m, newLeaf);
    } catch (e) {
      console.error(`Escrita: could not open ${path} at a placeholder`, e);
      new Notice(t("placeholders.openFailed"));
    }
  }

  /** Open a file (header click in the view). Never rejects. */
  async openFile(path: string, newLeaf: PaneType | boolean = false): Promise<void> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return; // the index drops a deleted file on the vault event
    }
    try {
      await this.plugin.app.workspace.getLeaf(newLeaf).openFile(file);
    } catch (e) {
      console.error(`Escrita: could not open ${path}`, e);
      new Notice(t("placeholders.openFailed"));
    }
  }

  private async openAtUnsafe(path: string, m: IndexedMarker, newLeaf: PaneType | boolean): Promise<void> {
    const ws = this.plugin.app.workspace;
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return; // the index drops a deleted file on the vault event
    }
    let leaf = newLeaf ? null : this.markdownLeafFor(path);
    if (leaf) {
      ws.setActiveLeaf(leaf, { focus: true });
    } else {
      leaf = ws.getLeaf(newLeaf);
      await leaf.openFile(file, { active: true });
    }
    if (!(leaf.view instanceof MarkdownView)) return;
    if (leaf.view.getMode() === "preview") {
      const vs = leaf.getViewState();
      await leaf.setViewState({ ...vs, state: { ...(vs.state ?? {}), mode: "source" }, active: true });
    }
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) return;
    const editor = view.editor;
    const at = locate(editor.getValue(), m, this.marker(), false);
    if (at) {
      this.select(editor, at.from, at.to);
    } else {
      const line = Math.max(0, Math.min(m.line, editor.lineCount() - 1));
      editor.setCursor({ line, ch: 0 });
      editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
      new Notice(t("placeholders.moved"));
      this.idx?.modified(file);
    }
    editor.focus();
  }

  /**
   * Remove a placeholder, only if its exact text is still where the index says
   * (or appears exactly once in the file). Goes through the note text port:
   * an open editor when there is one (undo works), else `vault.process`.
   * Resolves to true when removed.
   */
  async resolve(path: string, m: IndexedMarker): Promise<boolean> {
    const marker = this.marker();
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      new Notice(t("placeholders.notFound"));
      return false;
    }
    let res: Applied;
    try {
      res = await this.plugin.notes.text(file).apply((text) => {
        const r = resolvePlaceholder(text, m, marker);
        return r ? { from: r.from, to: r.to, insert: "" } : null;
      });
    } catch (e) {
      console.error(`Escrita: could not resolve a placeholder in ${path}`, e);
      new Notice(t("placeholders.notFound"));
      return false;
    }
    // The index re-reads on the vault "modify" (an open editor saves a moment later);
    // ask for a re-read now for the cases where no modify follows.
    this.idx?.modified(file);
    if (!res.ok) {
      new Notice(t("placeholders.notFound"));
      return false;
    }
    return true;
  }

  settingsSection(el: HTMLElement, ui: SettingsUi): void { placeholdersSettingsSection(el, ui, this.plugin); }
}
