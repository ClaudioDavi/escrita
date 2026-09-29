import { MarkdownView, Notice, TFile, debounce, type Editor, type PaneType, type TAbstractFile, type WorkspaceLeaf } from "obsidian";
import type { Extension } from "@codemirror/state";
import type EscritaPlugin from "../main";
import type { EscritaModule } from "../data";
import { folderList } from "../settings";
import { t } from "../i18n";
import { isIndexable, locate, planInsert, resolvePlaceholder, scan, stepIndex, type IndexedMarker } from "./logic";
import { PlaceholderStore } from "./store";
import { placeholderDecorations } from "./decoration";
import { applyDots, clearDots } from "./explorer";
import { PLACEHOLDERS_VIEW, PlaceholdersView } from "./view";

export { PLACEHOLDERS_VIEW } from "./view";
export type { IndexedMarker } from "./logic";

/** files read concurrently per step of the initial index */
const BATCH = 40;

export class PlaceholdersModule implements EscritaModule {
  private store = new PlaceholderStore();
  private extensions: Extension[] = [];
  private ready = false;
  private loaded = false;
  /** bumps on every full rebuild (and unload) so a stale one stops */
  private generation = 0;
  private building = false;
  /** paths updated by events while a rebuild runs; their live value wins */
  private touched = new Set<string>();
  /**
   * Latest read ticket per path, so an older read can't overwrite a newer one.
   * Tickets come from one module-wide counter and never repeat, so a stale read
   * can't match a ticket handed out later for the same path.
   */
  private seq = new Map<string, number>();
  private nextSeq = 0;
  private lastMarker = "";
  private lastExclude = "";
  private lastDots = true;
  private dotsSoon = debounce(() => this.applyDots(), 100, true);

  constructor(private plugin: EscritaPlugin) {}

  // ---------------------------------------------------------------- public API

  /** Number of placeholders in a file (0 when none, or not indexed). */
  countFor(path: string): number {
    return this.store.countFor(path);
  }

  /** Placeholders in a file, as last indexed. */
  markersFor(path: string): IndexedMarker[] {
    return this.store.markersFor(path);
  }

  /** Paths of every file with at least one placeholder. */
  paths(): string[] {
    return this.store.paths();
  }

  /** Every file with placeholders and its markers. */
  all(): { file: TFile; markers: IndexedMarker[] }[] {
    const out: { file: TFile; markers: IndexedMarker[] }[] = [];
    for (const { path, markers } of this.store.entries()) {
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) out.push({ file, markers });
    }
    return out;
  }

  /** Called whenever the index changes. Returns the unsubscribe function. */
  onChange(cb: () => void): () => void {
    return this.store.onChange(cb);
  }

  /** True once the first full index has been built. */
  isReady(): boolean {
    return this.ready;
  }

  // ---------------------------------------------------------------- lifecycle

  load(): void {
    const p = this.plugin;
    this.loaded = true;
    this.lastMarker = this.marker();
    this.lastExclude = p.settings.excludeFolders;
    this.lastDots = p.settings.showExplorerDots;

    p.registerView(PLACEHOLDERS_VIEW, (leaf) => new PlaceholdersView(leaf, p));

    this.extensions.push(placeholderDecorations(() => this.marker()));
    p.registerEditorExtension(this.extensions);

    p.addCommand({
      id: "insert-placeholder",
      name: t("placeholders.cmd.insert"),
      editorCallback: (editor) => this.insert(editor),
    });
    p.addCommand({
      id: "next-placeholder",
      name: t("placeholders.cmd.next"),
      editorCallback: (editor) => this.step(editor, 1),
    });
    p.addCommand({
      id: "previous-placeholder",
      name: t("placeholders.cmd.prev"),
      editorCallback: (editor) => this.step(editor, -1),
    });
    p.addCommand({
      id: "open-placeholders",
      name: t("placeholders.cmd.open"),
      callback: () => { void this.openView(); },
    });

    p.register(this.store.onChange(() => this.dotsSoon()));

    p.app.workspace.onLayoutReady(() => {
      if (!this.loaded) return;
      const vault = p.app.vault;
      // Registered after layout ready so the vault's initial "create" events are skipped.
      p.registerEvent(vault.on("modify", (f) => this.reindex(f)));
      p.registerEvent(vault.on("create", (f) => this.reindex(f)));
      p.registerEvent(vault.on("delete", (f) => this.forget(f.path)));
      p.registerEvent(vault.on("rename", (f, oldPath) => this.renamed(f, oldPath)));
      p.registerEvent(p.app.workspace.on("layout-change", () => this.dotsSoon()));
      void this.rebuild();
    });
  }

  unload(): void {
    this.loaded = false;
    this.generation++;
    this.dotsSoon.cancel();
    clearDots(this.plugin.app);
  }

  settingsChanged(): void {
    const s = this.plugin.settings;
    const marker = this.marker();
    const reindex = marker !== this.lastMarker || s.excludeFolders !== this.lastExclude;
    const dots = s.showExplorerDots !== this.lastDots;
    this.lastMarker = marker;
    this.lastExclude = s.excludeFolders;
    this.lastDots = s.showExplorerDots;
    if (reindex) {
      // Editors read the marker on each update; this makes them update now.
      this.plugin.app.workspace.updateOptions();
      if (this.plugin.app.workspace.layoutReady) void this.rebuild();
    }
    if (dots) this.applyDots();
  }

  // ---------------------------------------------------------------- index

  private marker(): string {
    return this.plugin.settings.placeholderMarker || "XXX";
  }

  private indexable(path: string): boolean {
    return isIndexable(path, folderList(this.plugin.settings.excludeFolders));
  }

  private async rebuild(): Promise<void> {
    const gen = ++this.generation;
    this.building = true;
    this.touched.clear();
    const marker = this.marker();
    const vault = this.plugin.app.vault;
    const files = vault.getMarkdownFiles().filter((f) => this.indexable(f.path));
    const fresh = new Map<string, IndexedMarker[]>();
    for (let i = 0; i < files.length; i += BATCH) {
      if (gen !== this.generation) return;
      await Promise.all(files.slice(i, i + BATCH).map(async (f) => {
        try {
          const text = await vault.cachedRead(f);
          if (!text.includes("%%")) return;
          const ms = scan(text, marker);
          if (ms.length) fresh.set(f.path, ms);
        } catch (e) {
          console.error(`Escrita: could not read ${f.path} for placeholders`, e);
        }
      }));
      await sleep(0);
    }
    if (gen !== this.generation) return;
    this.building = false;
    const wasReady = this.ready;
    this.ready = true;
    this.store.replaceAll(fresh, this.touched);
    this.touched.clear();
    // The first build may leave the (empty) store unchanged; open views still need to leave "indexing".
    if (!wasReady) {
      for (const leaf of this.plugin.app.workspace.getLeavesOfType(PLACEHOLDERS_VIEW)) {
        if (leaf.view instanceof PlaceholdersView) leaf.view.render();
      }
    }
    this.applyDots();
  }

  private bump(path: string): number {
    const n = ++this.nextSeq;
    this.seq.set(path, n);
    if (this.building) this.touched.add(path);
    return n;
  }

  private reindex(f: TAbstractFile): void {
    if (!(f instanceof TFile)) return;
    if (!this.indexable(f.path)) {
      this.forget(f.path);
      return;
    }
    const path = f.path;
    const n = this.bump(path);
    const marker = this.marker();
    this.plugin.app.vault.cachedRead(f).then((text) => {
      if (this.seq.get(path) !== n || !this.loaded) return;
      this.seq.delete(path);
      this.store.set(path, scan(text, marker));
    }, (e) => console.error(`Escrita: could not read ${path} for placeholders`, e));
  }

  private forget(path: string): void {
    this.bump(path);
    this.store.remove(path);
  }

  private renamed(f: TAbstractFile, oldPath: string): void {
    if (!(f instanceof TFile)) return;
    if (!this.indexable(f.path)) {
      this.forget(oldPath);
      this.forget(f.path);
      return;
    }
    // Move what we know right away so the UI doesn't flicker, then read the file
    // anyway: a modify read still in flight for oldPath is dropped by the bump, and
    // the moved data may predate a marker/exclude change (rebuild in progress).
    this.bump(oldPath);
    this.store.rename(oldPath, f.path);
    this.reindex(f);
  }

  private applyDots(): void {
    applyDots(this.plugin.app, this.plugin.settings.showExplorerDots, (p) => this.store.countFor(p) > 0);
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
      this.forget(path);
      return;
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
      this.forget(path);
      return;
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
      this.reindex(file);
    }
    editor.focus();
  }

  /**
   * Remove a placeholder, only if its exact text is still where the index says
   * (or appears exactly once in the file). Goes through an open editor when there
   * is one, so undo works; otherwise `vault.process`. Resolves to true when removed.
   */
  async resolve(path: string, m: IndexedMarker): Promise<boolean> {
    const marker = this.marker();
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      this.forget(path);
      new Notice(t("placeholders.notFound"));
      return false;
    }
    const leaf = this.markdownLeafFor(path);
    if (leaf && leaf.view instanceof MarkdownView) {
      const editor = leaf.view.editor;
      const text = editor.getValue();
      const r = resolvePlaceholder(text, m, marker);
      if (!r) {
        new Notice(t("placeholders.notFound"));
        this.bump(path);
        this.store.set(path, scan(text, marker));
        return false;
      }
      editor.replaceRange("", editor.offsetToPos(r.from), editor.offsetToPos(r.to));
      // Reflect it right away; the vault "modify" follows when the editor saves.
      this.bump(path);
      this.store.set(path, scan(editor.getValue(), marker));
      return true;
    }
    let after: string | null = null;
    let current = "";
    try {
      await this.plugin.app.vault.process(file, (text) => {
        current = text;
        after = null;
        const r = resolvePlaceholder(text, m, marker);
        if (!r) return text;
        after = r.text;
        return r.text;
      });
    } catch (e) {
      console.error(`Escrita: could not resolve a placeholder in ${path}`, e);
      new Notice(t("placeholders.notFound"));
      return false;
    }
    this.bump(path);
    if (after === null) {
      new Notice(t("placeholders.notFound"));
      this.store.set(path, scan(current, marker));
      return false;
    }
    this.store.set(path, scan(after, marker));
    return true;
  }
}
