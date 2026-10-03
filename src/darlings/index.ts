import {
  Editor, MarkdownView, Menu, Notice, TFile, normalizePath,
  type MarkdownFileInfo, type WorkspaceLeaf,
} from "obsidian";
import type EscritaPlugin from "../main";
import { FeatureModule, type FeatureSlots } from "../core/module-context";
import { t } from "../i18n";
import { writingDay } from "../core/dates";
import { chapterTitle } from "../core/book";
import { FolderBlockedError } from "../core/notes";
import {
  alreadyRestored, appendEntry, appendText, baseName, findRestoreOffset, formatEntry,
  matchLineEndings, newId, parseEntries, planCut, removeEntry, restoreText, withMd,
  type DarlingEntry,
} from "./format";
import { ConfirmModal, DarlingsView, VIEW_DARLINGS } from "./view";

export { VIEW_DARLINGS };

export class DarlingsModule extends FeatureModule {
  readonly id = "darlings" as const;
  override readonly slots: FeatureSlots = { views: [VIEW_DARLINGS] };

  /** the darlings note the panel shows; follows the active file */
  private shownPath: string | null = null;
  /** entries with an operation in progress (guards double clicks) */
  private busy = new Set<string>();
  /** notes with a cut in progress (guards a hotkey or menu firing twice) */
  private cutting = new Set<string>();
  private refreshTimer: number | null = null;

  constructor(private plugin: EscritaPlugin) { super(); }

  override onload(): void {
    const { plugin, ctx } = this;
    ctx.view(VIEW_DARLINGS, (leaf) => new DarlingsView(leaf, this));

    ctx.command({
      id: "move-selection-to-darlings",
      name: t("darlings.cmd.move"),
      editorCheckCallback: (checking, editor, ctx) => {
        const file = ctx.file;
        if (!file || !editor.somethingSelected() || this.isDarlingsNote(file)) return false;
        if (!checking) void this.cut(editor, file);
        return true;
      },
    });
    ctx.command({
      id: "open-darlings",
      name: t("darlings.cmd.open"),
      callback: () => { void this.activateView(); },
    });

    this.registerEvent(plugin.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
      const file = info.file;
      if (!file || !editor.somethingSelected() || this.isDarlingsNote(file)) return;
      menu.addItem((item) => item
        .setTitle(t("darlings.menu.move"))
        .setIcon("heart")
        .setSection("action")
        .onClick(() => { void this.cut(editor, file); }));
    }));

    this.registerEvent(plugin.app.workspace.on("file-open", (file) => {
      if (file && file.extension === "md") this.follow(file);
    }));
    const onChange = (path: string, oldPath?: string) => {
      if (this.shownPath && (path === this.shownPath || oldPath === this.shownPath)) this.scheduleRefresh();
    };
    this.registerEvent(plugin.app.vault.on("modify", (f) => onChange(f.path)));
    this.registerEvent(plugin.app.vault.on("create", (f) => onChange(f.path)));
    this.registerEvent(plugin.app.vault.on("delete", (f) => onChange(f.path)));
    this.registerEvent(plugin.app.vault.on("rename", (f, old) => onChange(f.path, old)));

    ctx.onLayoutReady(() => {
      const active = plugin.app.workspace.getActiveFile();
      if (active) this.follow(active);
    });
  }

  override onunload(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.shownPath = null;
  }

  override settingsChanged(): void {
    const active = this.plugin.app.workspace.getActiveFile();
    this.shownPath = null;
    if (active) this.follow(active);
    else this.refreshViews();
  }

  // --- paths ----------------------------------------------------------------

  /** Darlings note for a file: its book's note, else the global one. */
  notePathFor(file: TFile | null): string {
    const s = this.plugin.settings;
    const book = this.plugin.books.classify(file).book;
    if (book) return normalizePath(`${book.folder.path}/${withMd(s.darlingsNote || "Darlings.md")}`);
    return normalizePath(withMd(s.globalDarlingsNote || "Darlings.md"));
  }

  isDarlingsNote(file: TFile): boolean {
    return file.path === this.notePathFor(file);
  }

  /** The note the panel shows. */
  currentNotePath(): string {
    if (this.shownPath) return this.shownPath;
    this.shownPath = this.notePathFor(this.plugin.app.workspace.getActiveFile());
    return this.shownPath;
  }

  private follow(file: TFile): void {
    const path = this.isDarlingsNote(file) ? file.path : this.notePathFor(file);
    if (path !== this.shownPath) {
      this.shownPath = path;
      this.refreshViews();
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refreshViews();
    }, 250);
  }

  refreshViews(): void {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType(VIEW_DARLINGS)) {
      if (leaf.view instanceof DarlingsView) void leaf.view.refresh();
    }
  }

  async activateView(): Promise<void> {
    const ws = this.plugin.app.workspace;
    let leaf: WorkspaceLeaf | null = ws.getLeavesOfType(VIEW_DARLINGS)[0] ?? null;
    if (!leaf) {
      leaf = ws.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_DARLINGS, active: true });
    }
    await ws.revealLeaf(leaf);
  }

  // --- reading --------------------------------------------------------------

  noteFile(path = this.currentNotePath()): TFile | null {
    const f = this.plugin.app.vault.getAbstractFileByPath(path);
    return f instanceof TFile ? f : null;
  }

  async entries(path = this.currentNotePath()): Promise<DarlingEntry[]> {
    const note = this.noteFile(path);
    if (!note) return [];
    return parseEntries(await this.plugin.app.vault.cachedRead(note));
  }

  /**
   * The note a darling came from. The heading link wins, since Obsidian
   * updates it on rename while `from` goes stale (and another note may later
   * take that path). The recorded path is used when the link doesn't resolve,
   * or when it names the same note as the link (it disambiguates duplicates).
   */
  sourceFor(e: DarlingEntry, notePath: string): TFile | null {
    const { vault, metadataCache } = this.plugin.app;
    const found = e.from ? vault.getAbstractFileByPath(e.from) : null;
    const byPath = found instanceof TFile ? found : null;
    const link = e.link ?? (e.from ? baseName(e.from) : "");
    if (byPath && (!link || baseName(byPath.path) === baseName(link))) return byPath;
    const byLink = link ? metadataCache.getFirstLinkpathDest(link, notePath) : null;
    return byLink ?? byPath;
  }

  sourceTitle(e: DarlingEntry): string {
    return chapterTitle(baseName(e.link ?? e.from ?? "")) || t("common.untitled");
  }

  isBusy(id: string): boolean {
    return this.busy.has(id);
  }

  // --- cutting --------------------------------------------------------------

  private async ensureNote(path: string): Promise<TFile> {
    const { vault } = this.plugin.app;
    const existing = vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    if (existing) throw new Error(t("darlings.error.notAFile", { path }));
    const parent = path.split("/").slice(0, -1).join("/");
    try {
      await this.plugin.notes.ensureFolder(parent);
    } catch (e) {
      if (e instanceof FolderBlockedError) throw new Error(t("darlings.error.notAFolder", { path: e.path }));
      throw e;
    }
    return vault.create(path, `${t("darlings.intro")}\n`);
  }

  /**
   * Move the editor's selection to the darlings note. The passage is saved to
   * the note first; only then is it removed from the editor (one undo step).
   */
  async cut(editor: Editor, file: TFile): Promise<void> {
    if (this.cutting.has(file.path)) return;
    this.cutting.add(file.path);
    try {
      await this.cutNow(editor, file);
    } finally {
      this.cutting.delete(file.path);
    }
  }

  private async cutNow(editor: Editor, file: TFile): Promise<void> {
    const { app } = this.plugin;
    const doc = editor.getValue();
    const a = editor.posToOffset(editor.getCursor("from"));
    const b = editor.posToOffset(editor.getCursor("to"));
    if (a === b) return;
    const passage = doc.slice(a, b);
    const plan = planCut(doc, a, b);
    const notePath = this.notePathFor(file);
    if (notePath === file.path) {
      new Notice(t("darlings.notice.sameNote"));
      return;
    }

    let note: TFile;
    let id = "";
    try {
      note = await this.ensureNote(notePath);
      const link = app.metadataCache.fileToLinktext(file, note.path, true);
      const date = writingDay(new Date(), this.plugin.settings.dayEndsAt);
      await app.vault.process(note, (data) => {
        id = newId(new Set(parseEntries(data).map((e) => e.id)));
        const meta = { id, from: file.path, date, before: plan.before, after: plan.after, pre: plan.pre, post: plan.post };
        return appendEntry(data, formatEntry(meta, passage, link));
      });
    } catch (err) {
      console.error("Escrita: could not save darling", err);
      new Notice(t("darlings.notice.failed", { error: err instanceof Error ? err.message : String(err) }));
      return;
    }

    // Never remove text that isn't exactly what was saved.
    const now = editor.getValue();
    if (now !== doc) {
      // Still in the note: drop the copy so restoring it later can't duplicate
      // it. Gone from the note (edited away meanwhile): keep the copy, it's the
      // only one left.
      if (now.includes(passage)) {
        try {
          await app.vault.process(note, (d) => removeEntry(d, id));
          new Notice(t("darlings.notice.changedNothing"));
        } catch (err) {
          console.error("Escrita: could not undo the darling copy", err);
          new Notice(t("darlings.notice.changed"));
        }
      } else {
        new Notice(t("darlings.notice.changed"));
      }
      return;
    }
    const from = editor.offsetToPos(plan.from);
    editor.transaction({
      changes: [{ from, to: editor.offsetToPos(plan.to), text: "" }],
      selection: { from },
    });
    new Notice(t("darlings.notice.moved"));
    if (this.shownPath !== notePath) {
      this.shownPath = notePath;
      this.refreshViews();
    }
  }

  // --- restoring ------------------------------------------------------------

  private async freshEntry(notePath: string, id: string): Promise<{ note: TFile; entry: DarlingEntry } | null> {
    const note = this.noteFile(notePath);
    if (!note) return null;
    const entry = parseEntries(await this.plugin.app.vault.read(note)).find((e) => e.id === id);
    return entry ? { note, entry } : null;
  }

  /** The most recent note in the main area with an editor, for pasting. */
  private recentEditor(): { editor: Editor; file: TFile } | null {
    const leaf = this.plugin.app.workspace.getMostRecentLeaf();
    const v = leaf?.view;
    if (v instanceof MarkdownView && v.file && v.getMode() === "source") return { editor: v.editor, file: v.file };
    return null;
  }

  async restore(notePath: string, id: string): Promise<void> {
    if (this.busy.has(id)) return;
    this.busy.add(id);
    this.refreshViews();
    try {
      const found = await this.freshEntry(notePath, id);
      if (!found) {
        new Notice(t("darlings.notice.gone"));
        return;
      }
      const { note, entry } = found;
      const source = this.sourceFor(entry, note.path);
      if (!source) {
        this.offerPaste(note, entry);
        return;
      }
      const where = await this.insertInto(source, entry);
      if (!(await this.dropEntry(note, entry.id, source.basename))) return;
      new Notice(where === "context"
        ? t("darlings.notice.restored", { title: source.basename })
        : where === "present"
          ? t("darlings.notice.alreadyThere", { title: source.basename })
          : t("darlings.notice.restoredEnd", { title: source.basename }));
    } catch (err) {
      console.error("Escrita: could not restore darling", err);
      new Notice(t("darlings.notice.error", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      this.busy.delete(id);
      this.refreshViews();
    }
  }

  /**
   * Remove a darling after its passage went back into a note. When that fails
   * the passage is in both places, so say so instead of inviting a retry that
   * would paste it again. True when removed.
   */
  private async dropEntry(note: TFile, id: string, title: string): Promise<boolean> {
    try {
      await this.plugin.app.vault.process(note, (d) => removeEntry(d, id));
      return true;
    } catch (err) {
      console.error("Escrita: could not remove restored darling", err);
      new Notice(t("darlings.notice.notRemoved", { title }));
      return false;
    }
  }

  /**
   * Insert the passage back. "context" when its context was found, "end" when
   * appended at the end, "present" when it was already there (the cut was
   * undone in the chapter) and nothing was inserted.
   */
  private async insertInto(file: TFile, e: DarlingEntry): Promise<"context" | "end" | "present"> {
    let where: "context" | "end" | "present" = "context";
    const place = (doc: string): { at: number; text: string } => {
      const at = findRestoreOffset(doc, e.before, e.after);
      if (at === null) {
        where = "end";
        return { at: doc.length, text: matchLineEndings(appendText(doc, e.text), doc) };
      }
      if (alreadyRestored(doc, e, at)) {
        where = "present";
        return { at, text: "" };
      }
      where = "context";
      return { at, text: matchLineEndings(restoreText(e), doc) };
    };
    // Through the note text port: the editor when one is editing the file
    // (undo works), else vault.process. `place` never refuses.
    const res = await this.plugin.notes.text(file).apply((doc) => {
      const { at, text } = place(doc);
      return { from: at, to: at, insert: text };
    });
    if (!res.ok) throw new Error(`could not insert into ${file.path}`);
    const view = res.via === "editor" ? this.plugin.notes.editorView(file) : null;
    if (view) {
      const { editor } = view;
      const { from, insert } = res.change;
      editor.scrollIntoView({ from: editor.offsetToPos(from), to: editor.offsetToPos(from + insert.length) }, true);
    }
    return where;
  }

  private offerPaste(note: TFile, entry: DarlingEntry): void {
    const target = this.recentEditor();
    if (!target || target.file.path === note.path) {
      new Notice(t("darlings.notice.sourceMissing", { title: this.sourceTitle(entry) }));
      return;
    }
    new ConfirmModal(this.plugin.app, {
      title: t("darlings.missing.title"),
      body: t("darlings.missing.body", { title: this.sourceTitle(entry), active: target.file.basename }),
      confirm: t("darlings.missing.paste"),
      onConfirm: async () => {
        // re-check: the entry and the editor may have changed while the modal was open
        const again = await this.freshEntry(note.path, entry.id);
        const now = this.recentEditor();
        if (!again) {
          new Notice(t("darlings.notice.gone"));
          return;
        }
        if (!now || now.file.path === note.path) {
          new Notice(t("darlings.notice.noEditor"));
          return;
        }
        const pos = now.editor.getCursor("to");
        now.editor.transaction({ changes: [{ from: pos, to: pos, text: again.entry.text }] });
        const removed = await this.dropEntry(note, entry.id, now.file.basename);
        if (removed) new Notice(t("darlings.notice.restored", { title: now.file.basename }));
        this.refreshViews();
      },
    }).open();
  }

  // --- other actions ----------------------------------------------------------

  async openSource(notePath: string, e: DarlingEntry): Promise<void> {
    const source = this.sourceFor(e, notePath);
    if (!source) {
      new Notice(t("darlings.notice.sourceMissing", { title: this.sourceTitle(e) }));
      return;
    }
    const leaf = this.plugin.app.workspace.getLeaf(false);
    await leaf.openFile(source);
    const v = leaf.view;
    if (v instanceof MarkdownView && v.getMode() === "source") {
      const at = findRestoreOffset(v.editor.getValue(), e.before, e.after);
      if (at !== null) {
        const pos = v.editor.offsetToPos(at);
        v.editor.setCursor(pos);
        v.editor.scrollIntoView({ from: pos, to: pos }, true);
      }
    }
  }

  async openNote(notePath: string): Promise<void> {
    const note = this.noteFile(notePath);
    if (note) await this.plugin.app.workspace.getLeaf(false).openFile(note);
  }

  confirmDelete(notePath: string, e: DarlingEntry): void {
    new ConfirmModal(this.plugin.app, {
      title: t("darlings.delete.title"),
      body: t("darlings.delete.body", { title: this.sourceTitle(e) }),
      confirm: t("darlings.delete.confirm"),
      warning: true,
      onConfirm: async () => {
        const note = this.noteFile(notePath);
        if (!note) return;
        await this.plugin.app.vault.process(note, (d) => removeEntry(d, e.id));
        this.refreshViews();
      },
    }).open();
  }
}
