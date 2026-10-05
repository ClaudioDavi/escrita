import { MarkdownView, Notice, TFile, TFolder, normalizePath } from "obsidian";
import type EscritaPlugin from "../main";
import { FeatureModule } from "../core/module-context";
import type { SettingsUi } from "../core/module-context";
import type { FeatureId } from "../core/features";
import type { Follower } from "../core/vault-index";
import type { ExportChoice, ExportSelection, LastExport } from "../data";
import { chapterTitle } from "../core/book";
import { bookSource, type Book } from "../core/books";
import type { BookSource } from "../core/book-source";
import { exportRoot } from "../core/classify";
import { isInside } from "../snapshots/paths";
import { NoteExistsError, FolderBlockedError } from "../core/notes";
import { macrotaskYield, yieldBudget } from "../core/vault-index";
import { lang, t } from "../i18n";
import {
  authorOf, canRepeat, choiceOfLast, dropChoices, exportFileName, inFolder, keepBothName, lastInPlace, linkTarget, placeOf, planChapters, renameChoices,
} from "./logic";
import { ExportModal, askExists, askWhere, type BookOptions, type ExportHost, type ModalState } from "./modal";
import { presetById } from "./presets";
import { exportSettingsSection } from "./settings-ui";
import { buildExport, needsConfirm, type Built, type ExportPlan, type PartPlan } from "./source";
import { docxWriter } from "./writers/docx";
import { markdownWriter } from "./writers/markdown";

type Frontmatter = Record<string, unknown>;

/** What "Export…" was invoked on: a note, or a book through one of its files (a chapter or the book note). */
interface Target {
  file: TFile;
  book: Book | null;
  /** the active file is a chapter: "This chapter" is an option */
  chapter: boolean;
  /** the key of its choices in data.exportChoices: the book note's path, or the note's */
  key: string;
}

const baseName = (path: string): string => (path.split("/").pop() ?? path).replace(/\.md$/i, "");

/**
 * Export (N 7, PLAN-0.8): one "Export…" command for the active note or its book, a
 * modal with a preview, and "Export again" for a work that has been exported. The
 * pipeline is source → model → writer; this module reads the vault, asks the writer
 * and writes the file through `plugin.notes.create`.
 */
export class ExportModule extends FeatureModule {
  readonly id: FeatureId = "export";

  constructor(private plugin: EscritaPlugin) { super(); }

  /** Keeps the remembered choices current through renames and deletes, even while the feature is off (Q17). */
  dataFollowers(): Follower[] {
    return [{
      moved: (oldPath, newPath) => {
        // the export folder itself was renamed (or a folder holding it): the setting follows, like the snapshots'
        const f = this.plugin.app.vault.getAbstractFileByPath(newPath);
        const root = exportRoot(this.plugin.settings.exportFolder);
        if (f instanceof TFolder && isInside(oldPath, root)) {
          this.plugin.settings.exportFolder = f.path + root.slice(oldPath.length);
          void this.plugin.saveSettings();
        }
        if (renameChoices(this.plugin.data.exportChoices, oldPath, newPath)) this.plugin.requestSave();
      },
      deleted: (path) => { if (dropChoices(this.plugin.data.exportChoices, path)) this.plugin.requestSave(); },
    }];
  }

  onload(): void {
    const p = this.plugin;
    this.ctx.command({
      id: "export",
      name: t("export.command"),
      checkCallback: (checking) => {
        const file = this.activeNote();
        if (!file) return false;
        if (!checking) this.open(file);
        return true;
      },
    });
    this.ctx.command({
      id: "export-again",
      name: t("export.againCommand"),
      checkCallback: (checking) => {
        const file = this.activeNote();
        if (!file || !this.lastOf(this.targetOf(file))) return false;
        if (!checking) void this.exportAgain(file);
        return true;
      },
    });
    this.registerEvent(p.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof TFile) || !this.exportable(file)) return;
      menu.addItem((item) => item
        .setTitle(t("export.menu"))
        .setIcon("file-output")
        .onClick(() => { this.open(file); }));
    }));
  }

  settingsSection(el: HTMLElement, ui: SettingsUi): void { exportSettingsSection(el, ui, this.plugin); }

  // ------------------------------------------------------------------ what can be exported

  /** A Markdown note that is not a snapshot, a submission or an export itself. */
  private exportable(file: TFile): boolean {
    if (file.extension !== "md") return false;
    const place = this.plugin.books.classify(file);
    return !place.snapshot && !place.submission && !place.export;
  }

  private activeNote(): TFile | null {
    const file = this.plugin.app.workspace.getActiveFile();
    return file && this.exportable(file) ? file : null;
  }

  private targetOf(file: TFile): Target {
    const place = this.plugin.books.classify(file);
    if (place.book && (place.kind === "chapter" || place.kind === "book-note")) {
      return { file, book: place.book, chapter: place.kind === "chapter", key: place.book.note.path };
    }
    return { file, book: null, chapter: false, key: file.path };
  }

  /**
   * The last export of a work. A chapter exported alone keeps the book's own selection in
   * the choices (older data saved "all" in the last export), so that is what it carries.
   */
  private lastOf(target: Target): LastExport | null {
    const choice = this.plugin.data.exportChoices[target.key];
    const last = choice?.last;
    if (!last) return null;
    if (!last.whole && choice.chapters) return { ...last, chapters: choice.chapters };
    return last;
  }

  /** Whether "Export again" may write on its own for this target and state (same kind of export as the last). */
  private repeatable(target: Target, last: LastExport, state: ModalState): boolean {
    return canRepeat(last, { whole: state.whole, inBook: target.book !== null, path: target.file.path });
  }

  private frontmatter(path: string): Frontmatter {
    const f = this.plugin.app.vault.getAbstractFileByPath(path);
    return ((f instanceof TFile && this.plugin.app.metadataCache.getFileCache(f)?.frontmatter) as Frontmatter | undefined) ?? {};
  }

  private source(): BookSource<Book> {
    const p = this.plugin;
    return bookSource(p.app, p.books, p.notes, () => p.settings);
  }

  private defaultPreset(): string {
    return lang() === "pt-BR" ? "ptbr" : "shunn";
  }

  /** The modal's starting state: the work's remembered choices, else the defaults. */
  private stateOf(target: Target, choice: ExportChoice | undefined): ModalState {
    return {
      whole: target.book !== null && (target.chapter ? choice?.whole ?? true : true),
      selection: choice?.chapters ?? { mode: "all" },
      format: choice?.format ?? "docx",
      preset: choice?.preset ?? this.defaultPreset(),
    };
  }

  /** The book note's front matter pages that exist (Q7): the property links to a note. */
  private frontPages(book: Book): { role: "dedication" | "epigraph"; path: string }[] {
    const { app, settings } = this.plugin;
    const fm = this.frontmatter(book.note.path);
    const out: { role: "dedication" | "epigraph"; path: string }[] = [];
    for (const [role, prop] of [["dedication", settings.dedicationProperty], ["epigraph", settings.epigraphProperty]] as const) {
      const link = linkTarget(fm[prop.trim()]);
      if (link === null) continue;
      const dest = app.metadataCache.getFirstLinkpathDest(link, book.note.path);
      if (dest instanceof TFile && dest.extension === "md") out.push({ role, path: dest.path });
    }
    return out;
  }

  // ------------------------------------------------------------------ building

  private titleFor(target: Target, state: ModalState): string {
    if (target.book && state.whole) return target.book.title;
    return target.chapter ? chapterTitle(target.file.basename) : target.file.basename;
  }

  private planFor(target: Target, state: ModalState): ExportPlan {
    const p = this.plugin;
    const s = p.settings;
    const preset = presetById(state.preset);
    const base = { placeholderMarker: s.placeholderMarker };
    if (target.book && state.whole) {
      const format = s.chapterHeadingFormat.trim() || preset.chapterHeading;
      const chapters = planChapters(this.source().chapters(target.book), state.selection, format);
      const parts: PartPlan[] = [
        ...this.frontPages(target.book).map((f): PartPlan => ({ role: f.role, path: f.path, heading: null, title: null, label: baseName(f.path) })),
        ...chapters.chosen.map((c): PartPlan => ({ role: "body", path: c.ref.path, heading: c.heading, title: c.ref.title, label: baseName(c.ref.path) })),
      ];
      return {
        ...base, single: false, parts,
        title: target.book.title,
        author: authorOf(s, this.frontmatter(target.book.note.path)),
        unit: p.measure.unit(target.book.note),
      };
    }
    return {
      ...base, single: true,
      title: this.titleFor(target, state),
      author: authorOf(s, this.frontmatter(target.file.path)),
      unit: p.measure.unit(target.file),
      parts: [{ role: "body", path: target.file.path, heading: null, title: null, label: target.file.basename }],
    };
  }

  private async build(target: Target, state: ModalState): Promise<Built> {
    const p = this.plugin;
    const plan = this.planFor(target, state);
    const source = this.source();
    const checkpoint = yieldBudget({
      set: (cb, ms) => window.setTimeout(cb, ms),
      clear: (h) => window.clearTimeout(h as number),
      yieldNow: macrotaskYield,
      now: () => performance.now(),
    });
    return buildExport(plan, {
      read: (path) => source.read(path),
      count: (path, read) => {
        const f = p.app.vault.getAbstractFileByPath(path);
        if (!(f instanceof TFile)) throw new Error(`not a file: ${path}`);
        // only text read from the saved file may seed the measurer (BookSource.read)
        return p.measure.counts(f, read.mtime === null ? undefined : { text: read.text, mtime: read.mtime }, plan.unit);
      },
      checkpoint,
    });
  }

  // ------------------------------------------------------------------ opening

  private open(file: TFile, again = false): void {
    const target = this.targetOf(file);
    const s = this.plugin.settings;
    const last = this.lastOf(target);
    const choice = this.plugin.data.exportChoices[target.key];
    const state = again && last ? this.stateOfLast(target, last) : this.stateOf(target, choice);
    let book: BookOptions | null = null;
    if (target.book) {
      book = {
        chapters: this.source().chapters(target.book),
        compileProperty: s.compileProperty,
        headingOverride: s.chapterHeadingFormat,
        offerChapter: target.chapter,
        front: this.frontPages(target.book).map((f) => f.role),
      };
    }
    new ExportModal(this.plugin.app, {
      book, state, last, marker: s.placeholderMarker,
      host: this.host(target.file),
    }).open();
  }

  private stateOfLast(target: Target, last: LastExport): ModalState {
    const c = choiceOfLast(last);
    return { whole: target.book !== null && (target.chapter ? c.whole : true), selection: c.chapters ?? { mode: "all" }, format: c.format, preset: c.preset };
  }

  /**
   * "Export again" from the palette (Q17): the last choices, the same warnings. It writes
   * at once when nothing needs a confirmation and it is the same kind of export (a chapter
   * exported alone is repeated from that chapter); otherwise the modal opens with those
   * choices and the warnings, and "Export anyway" is its button. Where it writes is
   * `write`'s business: over the last file when it is still in place, else it asks.
   */
  private async exportAgain(file: TFile): Promise<void> {
    const target = this.targetOf(file);
    const last = this.lastOf(target);
    if (!last) {
      new Notice(t("export.noLast"));
      return;
    }
    const state = this.stateOfLast(target, last);
    let built: Built;
    try {
      built = await this.build(target, state);
    } catch (e) {
      console.error("Escrita: couldn't read the text to export", e);
      new Notice(t("export.readError"));
      return;
    }
    if (needsConfirm(built.warnings) || built.source.parts.filter((p) => p.role === "body").length === 0 || !this.repeatable(target, last, state)) {
      this.open(file, true);
      return;
    }
    await this.write(target, state, built, true);
  }

  /**
   * The host follows the vault while the modal is open: the target is resolved when each
   * call runs (Obsidian updates a TFile's path on rename), and ticked chapters are
   * mapped to where they are now, or dropped when they are gone.
   */
  private host(file: TFile): ExportHost {
    const start = this.targetOf(file);
    const known = new Map<string, TFile>();
    if (start.book) {
      for (const c of this.source().chapters(start.book)) {
        const f = this.plugin.app.vault.getAbstractFileByPath(c.path);
        if (f instanceof TFile) known.set(c.path, f);
      }
    }
    const now = (): Target => this.targetOf(file);
    const fresh = (state: ModalState): ModalState => {
      const sel = state.selection;
      if (sel.mode !== "pick") return state;
      const paths: string[] = [];
      for (const path of sel.paths) {
        const f = known.get(path);
        if (f && this.plugin.app.vault.getAbstractFileByPath(f.path) === f) paths.push(f.path);
        else if (!f && this.plugin.app.vault.getAbstractFileByPath(path) instanceof TFile) paths.push(path);
      }
      return { ...state, selection: { mode: "pick", paths } };
    };
    return {
      titleFor: (state) => this.titleFor(now(), state),
      build: (state) => this.build(now(), fresh(state)),
      pathFor: (state) => this.pathFor(this.titleFor(now(), state), state),
      write: (state, built, again) => this.write(now(), fresh(state), built, again),
      canRepeat: (last, state) => this.repeatable(now(), last, state),
      jump: (path, line) => { void this.jump(path, line); },
      openLast: (path) => this.openFile(path),
      fileExists: (path) => this.plugin.app.vault.getAbstractFileByPath(path) instanceof TFile,
    };
  }

  // ------------------------------------------------------------------ writing

  private pathFor(title: string, state: ModalState): string {
    return inFolder(exportRoot(this.plugin.settings.exportFolder), exportFileName(title, state.format, state.preset));
  }

  /**
   * Writes the file through `notes.create`, never replacing without asking (board 26 d),
   * then remembers the choices and the file (Q4, Q17) and says so. True when written.
   */
  private async write(target: Target, state: ModalState, built: Built, again = false): Promise<boolean> {
    const p = this.plugin;
    const preset = presetById(state.preset);
    const writer = state.format === "docx" ? docxWriter : markdownWriter;
    const title = this.titleFor(target, state);
    const path = this.pathFor(title, state);
    let data: string | Uint8Array;
    try {
      data = writer.write(built.doc, preset);
    } catch (e) {
      console.error("Escrita: couldn't format the export", e);
      new Notice(t("export.error"));
      return false;
    }
    let file: TFile;
    try {
      // Export again over the last file: only when it is still where it was written, and it is an export
      const last = again ? this.lastOf(target) : null;
      const prior = last ? p.app.vault.getAbstractFileByPath(last.path) : null;
      if (last && prior instanceof TFile && lastInPlace(last) && p.books.classify(prior.path).export) {
        file = (await p.notes.create(last.path, data, { exists: "replace" })).file;
        this.remember(target, state, built, file.path);
        this.done(file);
        return true;
      }
      // moved or gone: always ask where to write, even when nothing sits at the usual place
      if (last && !(p.app.vault.getAbstractFileByPath(path) instanceof TFile)) {
        if (!(await askWhere(p.app, path))) return false;
      }
      try {
        file = (await p.notes.create(path, data, { exists: "fail" })).file;
      } catch (e) {
        if (!(e instanceof NoteExistsError)) throw e;
        if (e.folder) {
          new Notice(t("export.errorFolder", { path: e.existing }));
          return false;
        }
        const there = p.app.vault.getAbstractFileByPath(e.existing);
        // notes.create matches paths ignoring case, so what exists may be another file: only an
        // export, at exactly this path, may be replaced (never a note of the writer's)
        const canReplace = e.existing === normalizePath(path) && p.books.classify(e.existing).export;
        const answer = await askExists(p.app, e.existing, there instanceof TFile ? there.stat.mtime : null, canReplace);
        if (answer === "cancel") return false;
        if (answer === "replace" && canReplace) {
          // a file that is not a recorded export may be the writer's own: it goes to the trash, not over
          const ours = Object.values(p.data.exportChoices).some((c) => c.last?.path === e.existing);
          file = (await p.notes.create(path, data, { exists: "replace", trashOld: !ours })).file;
        } else {
          const again = inFolder(exportRoot(p.settings.exportFolder), keepBothName(title, state.format, state.preset, new Date()));
          file = (await p.notes.create(again, data, { exists: "unique" })).file;
        }
      }
    } catch (e) {
      if (e instanceof NoteExistsError || e instanceof FolderBlockedError) {
        new Notice(t("export.errorFolder", { path: e.path }));
      } else {
        console.error("Escrita: couldn't write the export", e);
        new Notice(t("export.error"));
      }
      return false;
    }
    this.remember(target, state, built, file.path);
    this.done(file);
    return true;
  }

  private remember(target: Target, state: ModalState, built: Built, path: string): void {
    const data = this.plugin.data;
    const previous = data.exportChoices[target.key];
    const book = target.book !== null && state.whole;
    const chapters: ExportSelection = book ? state.selection : previous?.chapters ?? { mode: "all" };
    const last: LastExport = {
      format: state.format, preset: state.preset, whole: book,
      // a chapter exported alone still carries the book's selection, for "Export again" from the book
      chapters: book ? state.selection : chapters,
      at: new Date().toISOString(), path, ...placeOf(path),
    };
    if (!book) last.source = target.file.path;
    if (book) last.chapterCount = built.source.parts.filter((x) => x.role === "body").length;
    data.exportChoices[target.key] = {
      format: state.format,
      preset: state.preset,
      whole: target.book !== null ? state.whole : false,
      chapters,
      last,
    };
    this.plugin.requestSave();
  }

  /** The notice after writing (board 26 e): the name and a way to the folder. */
  private done(file: TFile): void {
    const msg = t("export.done", { name: file.name });
    const doc = typeof activeDocument !== "undefined" ? activeDocument : typeof document !== "undefined" ? document : null;
    if (!doc) {
      new Notice(msg);
      return;
    }
    const frag = doc.createDocumentFragment();
    frag.appendChild(doc.createTextNode(`${msg} `));
    const a = doc.createElement("a");
    a.textContent = t("export.done.show");
    a.setAttribute("href", "#");
    a.addEventListener("click", (e) => { e.preventDefault(); this.reveal(file); });
    frag.appendChild(a);
    new Notice(frag);
  }

  // ------------------------------------------------------------------ opening files

  /** Show the file in the file explorer, when the explorer offers it (a guarded cast: ARCHITECTURE, documented exceptions). */
  private reveal(file: TFile): void {
    const { workspace } = this.plugin.app;
    const leaf = workspace.getLeavesOfType("file-explorer")[0];
    const explorer = leaf?.view as unknown as { revealInFolder?: (f: TFile) => void } | undefined;
    if (!leaf || !explorer?.revealInFolder) return;
    void workspace.revealLeaf(leaf);
    explorer.revealInFolder(file);
  }

  /** Open the last export: a Markdown file opens in a leaf, any other shows in the explorer. False when it is gone. */
  private openFile(path: string): boolean {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return false;
    if (file.extension === "md") void this.plugin.app.workspace.getLeaf(false).openFile(file, { active: true });
    else this.reveal(file);
    return true;
  }

  /** Open the note (reusing a leaf that shows it) with the cursor on a 0-based line. */
  private async jump(path: string, line: number): Promise<void> {
    const ws = this.plugin.app.workspace;
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
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
}
