import { Notice, TAbstractFile, TFile, TFolder, debounce } from "obsidian";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import type EscritaPlugin from "../main";
import { FeatureModule } from "../core/module-context";
import type { SettingsUi } from "../core/module-context";
import type { Follower } from "../core/vault-index";
import type { FeatureId } from "../core/features";
import { dropFromMap, isUnder, renameInMap } from "../core/path-keys";
import { writingDay } from "../core/dates";
import { countSelection } from "../core/wordcount";
import { segmentDoc } from "../core/markdown";
import type { Progress } from "../core/measure";
import type { FilePlacement } from "../core/books";
import { dayOffPredicate, hasDaysOff, type DayOffPredicate } from "../core/daysoff";
import { fmt, t, unitAmount } from "../i18n";
import { shouldShareRename } from "./rename-share";
import { ProgressModal } from "./progress-modal";
import { Sprint, formatClock, type SprintEvent } from "./sprint";
import { StatusBar } from "./status-bar";
import {
  ActiveFiles, addedOn, applyDelta, countedChange, type Baseline, countsAsWriting, recordBookTotal, streak,
} from "./tracker";
import { goalsSettingsItems, goalsOffNotice } from "./settings-ui";
import type { SettingsBlock } from "../ui/settings-rows";
import type { DailyProgress, DailyProgressSource } from "../core/daily-progress";

/**
 * Word goals: tracks real typing in the active file, shows progress in the
 * status bar and the progress modal, and runs writing sprints.
 */
export class GoalsModule extends FeatureModule {
  readonly id: FeatureId = "goals";
  readonly slots = { editors: 1 };
  /** word count of each file when we last looked, so each change yields a delta */
  private baseline = new Map<string, Baseline>();
  /** the active file plus files left moments ago, whose pending editor save still counts as typing */
  private activeFiles = new ActiveFiles();
  /** tracking work runs one change at a time so quick saves can't double count */
  private queue: Promise<void> = Promise.resolve();
  /** bumped on unload: work queued before it must not write a baseline back after the clear */
  private generation = 0;
  private status: StatusBar | null = null;
  private selection = 0;
  private activeCounts: { chapter: number | null; book: number | null } = { chapter: null, book: null };
  /** the active note's progress in its piece's unit, when it has a target or limit */
  private activePiece: Progress | null = null;
  private currentSprint: Sprint | null = null;
  private sprintTimer: number | null = null;
  private modal: ProgressModal | null = null;
  private progressListeners = new Set<() => void>();
  /** the numbers the listeners were last told about; a repaint with the same ones stays quiet */
  private notified: DailyProgress | null = null;

  /**
   * The daily progress port (core/daily-progress.ts): today's words and the daily goal,
   * read by writing mode's counter through `features.get("goals")` while goals are on.
   */
  readonly dailyProgress: DailyProgressSource = {
    current: (): DailyProgress => ({ words: addedOn(this.plugin.history.view(), this.today()), goal: this.plugin.settings.dailyGoal }),
    onChange: (cb) => {
      this.progressListeners.add(cb);
      return () => { this.progressListeners.delete(cb); };
    },
  };

  constructor(private plugin: EscritaPlugin) {
    super();
  }

  get sprint(): Sprint | null {
    return this.currentSprint;
  }

  /** Days off from settings, or null when there are none (the old behavior everywhere). */
  dayOff(): DayOffPredicate | null {
    const s = this.plugin.settings;
    return hasDaysOff(s) ? dayOffPredicate(s) : null;
  }

  /** Today's writing day (YYYY-MM-DD), honoring "the day ends at". */
  today(): string {
    return writingDay(new Date(), this.plugin.settings.dayEndsAt);
  }

  onload(): void {
    const { plugin, ctx } = this;
    const { workspace, vault } = plugin.app;

    this.status = new StatusBar(
      ctx.statusBar(),
      (el, type, handler) => this.registerDomEvent(el, type, handler),
      () => this.openProgress(),
      () => this.stopSprint(),
    );
    this.status.setVisible(plugin.settings.showStatusBar);

    // Obsidian hides the status bar on mobile: the ribbon (and the commands) open progress there.
    ctx.ribbon("target", t("goals.cmd.open"), () => this.openProgress());

    ctx.command({ id: "open-progress", name: t("goals.cmd.open"), callback: () => this.openProgress() });
    ctx.command({
      id: "start-sprint",
      name: t("goals.cmd.start"),
      callback: () => this.startSprint(plugin.settings.sprintMinutes, plugin.settings.sprintTarget),
    });
    ctx.command({
      id: "stop-sprint",
      name: t("goals.cmd.stop"),
      checkCallback: (checking) => {
        if (!this.currentSprint) return false;
        if (!checking) this.stopSprint();
        return true;
      },
    });

    ctx.editor([EditorView.updateListener.of((u) => this.onEditorUpdate(u))]);

    this.registerEvent(workspace.on("file-open", (file) => {
      this.activeFiles.focus(file?.path ?? null, Date.now());
      this.selection = 0;
      this.prime(file);
      this.refreshStatus();
    }));
    this.registerEvent(vault.on("modify", (file) => this.onModify(file)));
    // Frontmatter edits (a new target, limit or unit) change the piece segment.
    this.registerEvent(plugin.app.metadataCache.on("changed", (file) => {
      if (file.path === workspace.getActiveFile()?.path) this.refreshStatus();
    }));
    // plugin.measure drops and moves cached counts itself (its handlers run first).
    // The history rename is a data follower (dataFollowers), so it also runs while goals is off.
    ctx.follow({
      moved: (oldPath, newPath) => this.onRename(oldPath, newPath),
      deleted: (path) => {
        dropFromMap(this.baseline, path);
        this.activeFiles.forget(path);
        this.refreshStatus();
      },
    });

    // History written on another device (or a rename shared by it) reaches the screen without a keystroke.
    this.register(plugin.history.onChange(() => {
      this.renderStatus();
      this.refreshModal();
    }));

    // Day rollover and anything else that drifts: a cheap refresh once a minute.
    this.registerInterval(window.setInterval(() => this.renderStatus(), 60_000));

    // A sprint that was running when goals was switched off carries on, its count kept.
    if (this.currentSprint) this.sprintTimer = window.setInterval(() => this.tickSprint(), 1000);

    ctx.onLayoutReady(() => {
      this.activeFiles.focus(workspace.getActiveFile()?.path ?? null, Date.now());
      this.prime(workspace.getActiveFile());
      this.refreshStatus();
    });
  }

  onunload(): void {
    this.refreshStatus.cancel();
    // The timer stops, the sprint and its count stay (a sprint is not lost by a switch-off).
    this.clearSprintTimer();
    this.modal?.close();
    this.modal = null;
    // Nothing watched the files while off: a stale baseline would count words typed meanwhile.
    this.baseline.clear();
    this.generation++;
    this.activeFiles = new ActiveFiles();
    this.selection = 0;
    this.status = null;   // its element is removed by the context
    // readers subscribe again when goals come back on (features.onChange)
    this.progressListeners.clear();
    this.notified = null;
  }

  /** Keeps the history of a renamed book or piece current even while goals is off (Q8). */
  dataFollowers(): Follower[] {
    return [{
      moved: (oldPath, newPath) => {
        // a book, a piece or a folder holding one is shared even when nothing here moved (D8)
        const { books, app } = this.plugin;
        const share = shouldShareRename(newPath, {
          classify: (p) => books.classify(p),
          bookNotes: () => books.allBooks().map((b) => b.note.path),
          filesUnder: (p) => {
            const out: string[] = [];
            const walk = (f: TAbstractFile | null): void => {
              if (f instanceof TFolder) for (const c of f.children) walk(c);
              else if (f) out.push(f.path);
            };
            const root = app.vault.getAbstractFileByPath(p);
            if (root instanceof TFolder) walk(root);
            return out;
          },
        });
        this.plugin.history.rename(oldPath, newPath, { share });
      },
    }];
  }

  settingsChanged(): void {
    this.status?.setVisible(this.plugin.settings.showStatusBar);
    // Tracked folders may have changed: start (or stop) watching the active file.
    const active = this.plugin.app.workspace.getActiveFile();
    if (this.plugin.books.classify(active).tracked) this.prime(active);
    else if (active) this.baseline.delete(active.path);
    this.refreshStatus();
  }

  // ---------- tracking ----------

  /** `fn` gets a check that says whether goals unloaded since it was queued (call it after each await). */
  private enqueue(fn: (stale: () => boolean) => Promise<void>): void {
    const gen = this.generation;
    const stale = () => gen !== this.generation;
    this.queue = this.queue.then(() => (stale() ? undefined : fn(stale)))
      .catch((e) => console.error("Escrita: word tracking failed", e));
  }

  /**
   * Remember the active file's current count so the next change can be measured against it.
   * Always measured again: a save still being counted when its baseline was dropped (a sync
   * meanwhile) writes back an old one. Only what an open comment hid carries over, while the
   * note still runs open.
   */
  private prime(file: TFile | null): void {
    if (!file || !this.plugin.books.classify(file).tracked) return;
    this.enqueue(async (stale) => {
      const fresh = countedChange(undefined, await this.plugin.measure.counts(file)).baseline;
      if (stale()) return;
      const old = this.baseline.get(file.path);
      this.baseline.set(file.path, old?.open && fresh.open ? { ...old, words: fresh.words, openWords: fresh.openWords } : fresh);
    });
  }

  private onModify(file: TAbstractFile): void {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    const active = this.plugin.app.workspace.getActiveFile();
    // Only real typing counts: changes to other files (sync, git, other plugins) just reset their baseline.
    // A file left moments ago still counts, so its debounced last save isn't lost.
    if (!this.activeFiles.accepts(file.path, active?.path ?? null, Date.now()) || !this.plugin.books.classify(file).tracked) {
      this.baseline.delete(file.path);
      this.refreshStatus();
      return;
    }
    this.enqueue(async (stale) => {
      const after = await this.plugin.measure.counts(file);
      if (stale()) return;
      const before = this.baseline.get(file.path);
      const { delta, baseline } = countedChange(before, after);
      this.baseline.set(file.path, baseline);
      // the save that closes a comment may record no words, but the book or piece total
      // taken while it ran open was partial: write the full one (record(0) keeps only the total)
      const closed = before?.open === true && !baseline.open;
      if (delta === 0 && !closed) return;
      // classified after the count, as before: a rename queued meanwhile has landed
      const p = this.plugin.books.classify(file);
      this.record(delta, (await this.bookChange(p)) ?? this.pieceChange(p, after.words));
    });
    this.refreshStatus();
  }

  private async bookChange(p: FilePlacement): Promise<{ path: string; total: number } | null> {
    if (p.kind !== "chapter" || !p.book) return null;
    const total = (await this.plugin.measure.book(p.book)).counts.words;
    return { path: p.book.note.path, total };
  }

  /**
   * A note with its own target, limit or deadline (outside a book) keeps its
   * per-day words in history the way a book does, keyed by its path, so the
   * progress modal can chart it and pace it with its own average.
   */
  private pieceChange(p: FilePlacement, words: number): { path: string; total: number } | null {
    return p.kind === "note" && p.piece ? { path: p.path, total: words } : null;
  }

  private record(delta: number, book: { path: string; total: number } | null): void {
    const day = this.today();
    if (countsAsWriting(delta, this.plugin.settings.ignoreJumpsOver)) {
      applyDelta(this.plugin.history.own(), day, delta, book);
      const ev = this.currentSprint?.add(delta);
      if (ev) this.sprintEvent(ev);
    } else if (book) {
      recordBookTotal(this.plugin.history.own(), day, book);
    } else {
      return;
    }
    // changed() rebuilds the view, asks for the save and tells the subscription below, which
    // repaints the status bar, notifies the listeners and refreshes the modal
    this.plugin.history.changed();
  }

  private onRename(oldPath: string, newPath: string): void {
    this.activeFiles.rename(oldPath, newPath);
    // a baseline only lives on while the file is still tracked at its new place
    renameInMap(this.baseline, oldPath, newPath);
    for (const k of [...this.baseline.keys()]) {
      if (isUnder(k, newPath) && !this.plugin.books.classify(k).tracked) this.baseline.delete(k);
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
      // segmented once per document version, so a selection-only change costs O(selection)
      words = countSelection(segmentDoc(state.doc), state.selection.ranges.filter((r) => !r.empty));
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
    const p = this.plugin.books.classify(file);
    try {
      const book = p.book;
      if (!file || !book) {
        this.activeCounts = { chapter: null, book: null };
      } else {
        const total = (await this.plugin.measure.book(book)).counts.words;
        const chapter = p.kind === "chapter" ? (await this.plugin.measure.counts(file)).words : null;
        this.activeCounts = { chapter, book: total };
      }
    } catch (e) {
      console.error("Escrita: couldn't count the active book", e);
      this.activeCounts = { chapter: null, book: null };
    }
    try {
      // shown for any note with a target or limit, chapters included (history keys only standalone pieces)
      // measure.note reads the piece after its count, so a frontmatter edit made meanwhile shows
      const n = file && p.markdown ? await this.plugin.measure.note(file) : null;
      this.activePiece = n?.piece && (n.piece.target !== undefined || n.piece.limit !== undefined) ? n.progress : null;
    } catch (e) {
      console.error("Escrita: couldn't count the active note", e);
      this.activePiece = null;
    }
    this.renderStatus();
  }

  private renderStatus(): void {
    const numbers = this.dailyProgress.current();
    if (numbers.words !== this.notified?.words || numbers.goal !== this.notified?.goal) {
      this.notified = numbers;
      for (const cb of [...this.progressListeners]) {
        try { cb(); } catch (e) { console.error("Escrita: a daily progress listener failed", e); }
      }
    }
    if (!this.status || !this.plugin.settings.showStatusBar) return;
    const history = this.plugin.history.view();
    const today = this.today();
    const s = this.currentSprint;
    const now = Date.now();
    this.status.update({
      selection: this.selection,
      chapter: this.activeCounts.chapter,
      book: this.activeCounts.book,
      piece: this.activePiece,
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
    const p = this.plugin.books.classify(active);
    const book = p.book;
    // Outside a book, a note with a target, limit or deadline gets a piece tile and pacing.
    const pieceFile = active && p.kind === "note" && p.piece ? active : null;
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
    this.clearSprintTimer();
    this.sprintTimer = window.setInterval(() => this.tickSprint(), 1000);
    new Notice(sprint.target > 0
      ? t("goals.sprint.started", { min: fmt(sprint.minutes), target: unitAmount("words", sprint.target) })
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
      new Notice(t("goals.sprint.targetReached", { words: unitAmount("words", ev.words) }));
      this.renderStatus();
      return;
    }
    this.clearSprintTimer();
    this.currentSprint = null;
    new Notice(t("goals.sprint.done", { words: unitAmount("words", ev.words), min: fmt(ev.minutes), rate: fmt(ev.perHour) }), 10000);
    this.renderStatus();
    this.refreshModal();
  }

  private clearSprintTimer(): void {
    if (this.sprintTimer !== null) window.clearInterval(this.sprintTimer);
    this.sprintTimer = null;
  }

  settingsItems(ui: SettingsUi): SettingsBlock[] { return goalsSettingsItems(ui, this.plugin); }
  offNotice(): Promise<string | null> { return goalsOffNotice(this.plugin); }
}
