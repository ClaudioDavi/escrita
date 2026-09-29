import { Notice, TAbstractFile, TFile, debounce } from "obsidian";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import type EscritaPlugin from "../main";
import type { EscritaModule } from "../data";
import { folderList } from "../settings";
import { writingDay } from "../core/dates";
import { countSelection, countWords } from "../core/wordcount";
import { pieceCount, readPiece, type Piece } from "../core/piece";
import { dayOffPredicate, hasDaysOff, type DayOffPredicate } from "../core/daysoff";
import { pieceSummary } from "./piece";
import { fmt, t } from "../i18n";
import { ProgressModal } from "./progress-modal";
import { Sprint, formatClock, type SprintEvent } from "./sprint";
import { StatusBar } from "./status-bar";
import { plural } from "./format";
import {
  ActiveFiles, addedOn, applyDelta, countsAsWriting, isTrackedPath, recordBookTotal, renameBook, streak,
} from "./tracker";

/**
 * Word goals: tracks real typing in the active file, shows progress in the
 * status bar and the progress modal, and runs writing sprints.
 */
export class GoalsModule implements EscritaModule {
  /** word count of each file when we last looked, so each change yields a delta */
  private baseline = new Map<string, number>();
  /** the active file plus files left moments ago, whose pending editor save still counts as typing */
  private activeFiles = new ActiveFiles();
  /** tracking work runs one change at a time so quick saves can't double count */
  private queue: Promise<void> = Promise.resolve();
  private status: StatusBar | null = null;
  private selection = 0;
  private activeCounts: { chapter: number | null; book: number | null } = { chapter: null, book: null };
  /** the active note's piece (target/limit/unit) and its length in that unit, when it has a target or limit */
  private activePiece: { piece: Piece; count: number } | null = null;
  private currentSprint: Sprint | null = null;
  private sprintTimer: number | null = null;
  private modal: ProgressModal | null = null;

  constructor(private plugin: EscritaPlugin) {}

  get sprint(): Sprint | null {
    return this.currentSprint;
  }

  /** Days off from settings, or null when there are none (the old behavior everywhere). */
  dayOff(): DayOffPredicate | null {
    const s = this.plugin.settings;
    return hasDaysOff(s) ? dayOffPredicate(s) : null;
  }

  /** The target/limit/unit/deadline properties of a note, or null when it has none. */
  pieceOf(file: TFile | null): Piece | null {
    if (!file || file.extension !== "md") return null;
    return readPiece(this.plugin.app.metadataCache.getFileCache(file)?.frontmatter, this.plugin.settings);
  }

  /** Today's writing day (YYYY-MM-DD), honoring "the day ends at". */
  today(): string {
    return writingDay(new Date(), this.plugin.settings.dayEndsAt);
  }

  load(): void {
    const { plugin } = this;
    const { workspace, vault } = plugin.app;

    this.status = new StatusBar(
      plugin.addStatusBarItem(),
      (el, type, handler) => plugin.registerDomEvent(el, type, handler),
      () => this.openProgress(),
      () => this.stopSprint(),
    );
    this.status.setVisible(plugin.settings.showStatusBar);

    // Obsidian hides the status bar on mobile: the ribbon (and the commands) open progress there.
    plugin.addRibbonIcon("target", t("goals.cmd.open"), () => this.openProgress());

    plugin.addCommand({ id: "open-progress", name: t("goals.cmd.open"), callback: () => this.openProgress() });
    plugin.addCommand({
      id: "start-sprint",
      name: t("goals.cmd.start"),
      callback: () => this.startSprint(plugin.settings.sprintMinutes, plugin.settings.sprintTarget),
    });
    plugin.addCommand({
      id: "stop-sprint",
      name: t("goals.cmd.stop"),
      checkCallback: (checking) => {
        if (!this.currentSprint) return false;
        if (!checking) this.stopSprint();
        return true;
      },
    });

    plugin.registerEditorExtension(EditorView.updateListener.of((u) => this.onEditorUpdate(u)));

    plugin.registerEvent(workspace.on("file-open", (file) => {
      this.activeFiles.focus(file?.path ?? null, Date.now());
      this.selection = 0;
      this.prime(file);
      this.refreshStatus();
    }));
    plugin.registerEvent(vault.on("modify", (file) => this.onModify(file)));
    // Frontmatter edits (a new target, limit or unit) change the piece segment.
    plugin.registerEvent(plugin.app.metadataCache.on("changed", (file) => {
      if (file.path === workspace.getActiveFile()?.path) this.refreshStatus();
    }));
    plugin.registerEvent(vault.on("rename", (file, oldPath) => this.onRename(file, oldPath)));
    plugin.registerEvent(vault.on("delete", (file) => {
      this.plugin.counter.forget(file.path);
      this.baseline.delete(file.path);
      this.activeFiles.forget(file.path);
      this.refreshStatus();
    }));

    // Day rollover and anything else that drifts: a cheap refresh once a minute.
    plugin.registerInterval(window.setInterval(() => this.renderStatus(), 60_000));

    workspace.onLayoutReady(() => {
      this.activeFiles.focus(workspace.getActiveFile()?.path ?? null, Date.now());
      this.prime(workspace.getActiveFile());
      this.refreshStatus();
    });
  }

  unload(): void {
    this.refreshStatus.cancel();
    this.clearSprintTimer();
    this.currentSprint = null;
    this.modal = null;
  }

  settingsChanged(): void {
    this.status?.setVisible(this.plugin.settings.showStatusBar);
    // Tracked folders may have changed: start (or stop) watching the active file.
    const active = this.plugin.app.workspace.getActiveFile();
    if (this.tracked(active)) this.prime(active);
    else if (active) this.baseline.delete(active.path);
    this.refreshStatus();
  }

  // ---------- tracking ----------

  tracked(file: TAbstractFile | null): boolean {
    if (!(file instanceof TFile) || file.extension !== "md") return false;
    const s = this.plugin.settings;
    return isTrackedPath(file.path, folderList(s.trackFolders), folderList(s.excludeFolders), s.chapterTemplate);
  }

  private enqueue(fn: () => Promise<void>): void {
    this.queue = this.queue.then(fn).catch((e) => console.error("Escrita: word tracking failed", e));
  }

  /** Remember the active file's current count so the next change can be measured against it. */
  private prime(file: TFile | null): void {
    if (!file || !this.tracked(file)) return;
    this.enqueue(async () => {
      this.baseline.set(file.path, await this.plugin.counter.count(file));
    });
  }

  private onModify(file: TAbstractFile): void {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    const active = this.plugin.app.workspace.getActiveFile();
    // Only real typing counts: changes to other files (sync, git, other plugins) just reset their baseline.
    // A file left moments ago still counts, so its debounced last save isn't lost.
    if (!this.activeFiles.accepts(file.path, active?.path ?? null, Date.now()) || !this.tracked(file)) {
      this.baseline.delete(file.path);
      this.refreshStatus();
      return;
    }
    this.enqueue(async () => {
      const before = this.baseline.get(file.path);
      const after = await this.plugin.counter.count(file);
      this.baseline.set(file.path, after);
      if (before === undefined || after === before) return;
      this.record(after - before, (await this.bookChange(file)) ?? this.pieceChange(file, after));
    });
    this.refreshStatus();
  }

  private async bookChange(file: TFile): Promise<{ path: string; total: number } | null> {
    const books = this.plugin.books;
    if (!books.isChapter(file)) return null;
    const book = books.bookFor(file);
    if (!book) return null;
    const total = await this.plugin.counter.total(books.chapters(book).map((c) => c.file));
    return { path: book.note.path, total };
  }

  /**
   * A note with its own target, limit or deadline (outside a book) keeps its
   * per-day words in history the way a book does, keyed by its path, so the
   * progress modal can chart it and pace it with its own average.
   */
  private pieceChange(file: TFile, words: number): { path: string; total: number } | null {
    if (this.plugin.books.bookFor(file) || !this.pieceOf(file)) return null;
    return { path: file.path, total: words };
  }

  private record(delta: number, book: { path: string; total: number } | null): void {
    const day = this.today();
    const history = this.plugin.data.history;
    if (countsAsWriting(delta, this.plugin.settings.ignoreJumpsOver)) {
      applyDelta(history, day, delta, book);
      const ev = this.currentSprint?.add(delta);
      if (ev) this.sprintEvent(ev);
    } else if (book) {
      recordBookTotal(history, day, book);
    } else {
      return;
    }
    this.plugin.requestSave();
    this.renderStatus();
    this.refreshModal();
  }

  private onRename(file: TAbstractFile, oldPath: string): void {
    this.plugin.counter.rename(oldPath, file.path);
    this.activeFiles.rename(oldPath, file.path);
    const b = this.baseline.get(oldPath);
    this.baseline.delete(oldPath);
    if (b !== undefined && this.tracked(file)) this.baseline.set(file.path, b);
    if (file instanceof TFile && file.extension === "md" && renameBook(this.plugin.data.history, oldPath, file.path)) {
      this.plugin.requestSave();
    }
    this.refreshStatus();
  }

  // ---------- status bar ----------

  private onEditorUpdate(u: ViewUpdate): void {
    if (!u.selectionSet && !u.docChanged && !u.focusChanged) return;
    if (!u.view.hasFocus) return;
    const state = u.state;
    let words = 0;
    if (state.selection.ranges.some((r) => !r.empty)) {
      words = countSelection(state.selection.ranges.map((r) => state.sliceDoc(r.from, r.to)).join("\n"));
    }
    if (words !== this.selection) {
      this.selection = words;
      this.renderStatus();
    }
  }

  /** Recount the active chapter and book (debounced), then redraw. */
  refreshStatus = debounce(() => { void this.updateActiveCounts(); }, 400, true);

  private async updateActiveCounts(): Promise<void> {
    const file = this.plugin.app.workspace.getActiveFile();
    try {
      const books = this.plugin.books;
      const book = file ? books.bookFor(file) : null;
      if (!file || !book) {
        this.activeCounts = { chapter: null, book: null };
      } else {
        const chapters = books.chapters(book).map((c) => c.file);
        const total = await this.plugin.counter.total(chapters);
        const chapter = books.isChapter(file) ? await this.plugin.counter.count(file) : null;
        this.activeCounts = { chapter, book: total };
      }
    } catch (e) {
      console.error("Escrita: couldn't count the active book", e);
      this.activeCounts = { chapter: null, book: null };
    }
    try {
      const piece = this.pieceOf(file);
      if (file && piece && (piece.target !== undefined || piece.limit !== undefined)) {
        const md = await this.plugin.app.vault.cachedRead(file);
        this.activePiece = { piece, count: pieceCount(md, piece.unit) };
      } else {
        this.activePiece = null;
      }
    } catch (e) {
      console.error("Escrita: couldn't count the active note", e);
      this.activePiece = null;
    }
    this.renderStatus();
  }

  /** The active note's length in its unit and in words (for the progress modal). */
  async measure(file: TFile, piece: Piece): Promise<{ count: number; words: number }> {
    const md = await this.plugin.app.vault.cachedRead(file);
    return { count: pieceCount(md, piece.unit), words: countWords(md) };
  }

  private renderStatus(): void {
    if (!this.status || !this.plugin.settings.showStatusBar) return;
    const history = this.plugin.data.history;
    const today = this.today();
    const s = this.currentSprint;
    const now = Date.now();
    this.status.update({
      selection: this.selection,
      chapter: this.activeCounts.chapter,
      book: this.activeCounts.book,
      piece: this.activePiece
        ? { ...pieceSummary(this.activePiece.count, this.activePiece.piece), unit: this.activePiece.piece.unit }
        : null,
      today: addedOn(history, today),
      goal: this.plugin.settings.dailyGoal,
      streak: streak(history, today, this.dayOff()),
      sprint: s ? { clock: formatClock(s.remainingMs(now)), words: s.words, target: s.target, progress: s.progress(now) } : null,
    });
  }

  // ---------- progress modal ----------

  openProgress(): void {
    this.modal?.close();
    const active = this.plugin.app.workspace.getActiveFile();
    const book = this.plugin.books.bookFor(active);
    // Outside a book, a note with a target, limit or deadline gets a piece tile and pacing.
    const pieceFile = !book && active && this.pieceOf(active) ? active : null;
    this.modal = new ProgressModal(this.plugin, this, book, pieceFile);
    this.modal.open();
  }

  private refreshModal(): void {
    this.modal?.refresh().catch((e) => console.error("Escrita: couldn't refresh the progress modal", e));
  }

  /** Called by the modal when it closes. */
  modalClosed(modal: ProgressModal): void {
    if (this.modal === modal) this.modal = null;
  }

  // ---------- sprints ----------

  startSprint(minutes: number, target: number): void {
    if (this.currentSprint) {
      new Notice(t("goals.sprint.already"));
      return;
    }
    const sprint = new Sprint(minutes, target, Date.now());
    this.currentSprint = sprint;
    this.sprintTimer = window.setInterval(() => this.tickSprint(), 1000);
    this.plugin.registerInterval(this.sprintTimer);
    new Notice(sprint.target > 0
      ? t("goals.sprint.started", { min: fmt(sprint.minutes), target: plural("goals.words", sprint.target) })
      : t("goals.sprint.startedNoTarget", { min: fmt(sprint.minutes) }));
    this.renderStatus();
    this.refreshModal();
  }

  stopSprint(): void {
    const ev = this.currentSprint?.finish(Date.now());
    if (ev) this.sprintEvent(ev);
  }

  private tickSprint(): void {
    const s = this.currentSprint;
    if (!s) { this.clearSprintTimer(); return; }
    const ev = s.tick(Date.now());
    if (ev) { this.sprintEvent(ev); return; }
    this.renderStatus();
    this.modal?.sprintTick();
  }

  private sprintEvent(ev: SprintEvent): void {
    if (ev.type === "target") {
      new Notice(t("goals.sprint.targetReached", { words: plural("goals.words", ev.words) }));
      this.renderStatus();
      return;
    }
    this.clearSprintTimer();
    this.currentSprint = null;
    new Notice(t("goals.sprint.done", { words: plural("goals.words", ev.words), min: fmt(ev.minutes), rate: fmt(ev.perHour) }), 10000);
    this.renderStatus();
    this.refreshModal();
  }

  private clearSprintTimer(): void {
    if (this.sprintTimer !== null) window.clearInterval(this.sprintTimer);
    this.sprintTimer = null;
  }
}
