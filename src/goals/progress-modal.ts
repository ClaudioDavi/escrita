import { Modal, Notice, TFile } from "obsidian";
import type EscritaPlugin from "../main";
import type { Book } from "../core/books";
import { lastDays } from "../core/dates";
import { DEADLINE_PROPERTY, PIECE_UNITS, type Piece, type PieceUnit } from "../core/piece";
import { fmt, t } from "../i18n";
import type { GoalsModule } from "./index";
import { chartGeometry } from "./chart";
import { fmtDay, fmtShortDay, plural, unitAmount } from "./format";
import { normalizeDeadline, pacing, parseGoal, readNumberField, type Pacing } from "./pacing";
import { paceInUnit, pieceBar, pieceSummary } from "./piece";
import { setWidth } from "./status-bar";
import {
  addedOn, bookTotalSeries, dailyAverage, dailySeries, dayStates, deletedOn, goalMetSummary, streak, sumAdded,
} from "./tracker";
import { formatClock } from "./sprint";

const CHART_DAYS = 30;
const CHART_HEIGHT = 150;
const SPRINT_OPTIONS = [15, 25, 45];

/** A note outside a book with its own target, limit or deadline. */
interface PieceScope {
  file: TFile;
  piece: Piece;
  /** length in the piece's unit */
  count: number;
  /** length in words (history is kept in words) */
  words: number;
}

const UNIT_LABELS: Record<PieceUnit, string> = {
  words: "goals.set.unitWords",
  characters: "goals.set.unitCharacters",
  "characters-no-spaces": "goals.set.unitCharactersNoSpaces",
};

interface BookScope {
  book: Book;
  chapters: number;
  total: number;
  goal: number | null;
  deadline: string | null;
}

/** The progress modal from the design: tiles, a 30-day chart, pacing, settings and sprints. */
export class ProgressModal extends Modal {
  private bookScope: BookScope | null = null;
  private pieceScope: PieceScope | null = null;
  private summaryEl!: HTMLElement;
  private sprintEl!: HTMLElement;
  private sprintStatusEl: HTMLElement | null = null;
  private sprintMinutes: number;

  constructor(
    private plugin: EscritaPlugin,
    private goals: GoalsModule,
    private book: Book | null,
    private pieceFile: TFile | null = null,
  ) {
    super(plugin.app);
    this.sprintMinutes = plugin.settings.sprintMinutes;
  }

  async onOpen(): Promise<void> {
    const { contentEl, titleEl } = this;
    this.modalEl.addClass("escrita-progress-modal");
    contentEl.addClass("escrita-progress");
    titleEl.empty();
    titleEl.createSpan({ text: t("goals.progress.title") });
    titleEl.createSpan({
      cls: "escrita-progress-scope",
      text: this.book ? this.book.title : this.pieceFile ? this.pieceFile.basename : t("goals.progress.allWriting"),
    });

    this.summaryEl = contentEl.createDiv({ cls: "escrita-progress-summary" });
    const settingsEl = contentEl.createDiv({ cls: "escrita-progress-settings" });
    this.sprintEl = contentEl.createDiv({ cls: "escrita-progress-sprint" });

    try {
      await this.loadScope();
    } catch (e) {
      // Still show everything else; the book tile falls back to "All writing" data.
      console.error("Escrita: couldn't count the book for the progress modal", e);
    }
    this.renderSummary();
    this.renderSettings(settingsEl);
    this.renderSprint();
  }

  /** An event handler that reports failures instead of leaving an unhandled rejection. */
  private guard(fn: () => Promise<void>): () => void {
    return () => {
      fn().catch((e) => {
        console.error("Escrita: progress modal action failed", e);
        new Notice(t("goals.error"));
      });
    };
  }

  onClose(): void {
    this.goals.modalClosed(this);
    this.contentEl.empty();
  }

  /** Called by the goals module after tracked writing and on sprint start/stop. */
  async refresh(): Promise<void> {
    if (!this.summaryEl) return;
    await this.loadScope();
    this.renderSummary();
    this.renderSprint();
  }

  /** Called every second while a sprint runs. */
  sprintTick(): void {
    const s = this.goals.sprint;
    if (!s || !this.sprintStatusEl) return;
    this.sprintStatusEl.setText(this.sprintText());
  }

  private async loadScope(): Promise<void> {
    const book = this.book;
    if (!book) {
      this.bookScope = null;
      await this.loadPiece();
      return;
    }
    const note = this.plugin.app.vault.getAbstractFileByPath(book.note.path);
    if (!(note instanceof TFile)) { this.bookScope = null; return; }
    const files = this.plugin.books.chapters(book).map((c) => c.file);
    const total = await this.plugin.counter.total(files);
    const fm = this.plugin.books.frontmatter(note);
    // Keep values the user just typed until the metadata cache catches up.
    const prev = this.bookScope;
    this.bookScope = {
      book,
      chapters: files.length,
      total,
      goal: prev ? prev.goal : parseGoal(fm.goal),
      deadline: prev ? prev.deadline : normalizeDeadline(fm.deadline),
    };
  }

  private async loadPiece(): Promise<void> {
    const file = this.pieceFile;
    if (!file) { this.pieceScope = null; return; }
    const current = this.plugin.app.vault.getAbstractFileByPath(file.path);
    if (!(current instanceof TFile)) { this.pieceScope = null; return; }
    // Keep values the user just typed until the metadata cache catches up.
    const piece = this.pieceScope?.piece ?? this.goals.pieceOf(current) ?? { unit: "words" };
    const { count, words } = await this.goals.measure(current, piece);
    this.pieceScope = { file: current, piece, count, words };
  }

  /** The history key the chart and pacing follow: the book note or the piece note. */
  private scopePath(): string | null {
    return this.bookScope?.book.note.path ?? this.pieceScope?.file.path ?? null;
  }

  // ---------- summary: tiles, chart, pacing ----------

  private renderSummary(): void {
    const el = this.summaryEl;
    el.empty();
    const history = this.plugin.data.history;
    const today = this.goals.today();
    const goal = this.plugin.settings.dailyGoal;
    const scope = this.bookScope;
    const piece = this.pieceScope;
    const bookPath = this.scopePath();
    const off = this.goals.dayOff();

    const tiles = el.createDiv({ cls: "escrita-tiles" });

    // Today (always vault-wide: the daily goal covers all tracked writing).
    const written = addedOn(history, today);
    const cut = deletedOn(history, today);
    const todayTile = this.tile(tiles, t("goals.tile.today"));
    this.tileValue(todayTile, written, goal > 0 ? goal : null, goal > 0 && written >= goal);
    if (goal > 0) this.tileBar(todayTile, written, goal, t("goals.tile.today"));
    const todaySub: string[] = [];
    if (goal > 0) todaySub.push(written >= goal ? t("goals.tile.goalMet") : plural("goals.tile.toGo", goal - written));
    if (cut > 0) todaySub.push(plural("goals.tile.cut", cut));
    if (todaySub.length) todayTile.createDiv({ cls: "escrita-tile-sub", text: todaySub.join(" · ") });

    if (scope) {
      const bookTile = this.tile(tiles, t("goals.tile.book"));
      const chapters = plural("goals.chapters", scope.chapters);
      if (scope.goal) {
        this.tileValue(bookTile, scope.total, scope.goal, scope.total >= scope.goal);
        this.tileBar(bookTile, scope.total, scope.goal, t("goals.tile.book"));
        const pct = Math.floor((scope.total / scope.goal) * 100);
        bookTile.createDiv({ cls: "escrita-tile-sub", text: t("goals.tile.bookSub", { pct: fmt(pct), chapters }) });
      } else {
        this.tileValue(bookTile, scope.total, null, false);
        bookTile.createDiv({ cls: "escrita-tile-sub", text: t("goals.tile.noGoal", { chapters }) });
      }
    } else if (piece) {
      this.renderPieceTile(tiles, piece);
    } else {
      const week = lastDays(today, 7);
      const sum = sumAdded(history, week);
      const weekTile = this.tile(tiles, t("goals.tile.week"));
      this.tileValue(weekTile, sum, null, false);
      weekTile.createDiv({ cls: "escrita-tile-sub", text: t("goals.tile.weekSub", { n: fmt(sum / 7) }) });
    }

    const streakTile = this.tile(tiles, t("goals.tile.streak"));
    const n = streak(history, today, off);
    streakTile.createDiv({
      cls: "escrita-tile-value escrita-tile-streak",
      text: n > 0 ? plural("goals.status.streak", n) : t("goals.tile.noStreak"),
    });
    const segs = streakTile.createDiv({ cls: "escrita-streak-segments", attr: { role: "list" } });
    const week = lastDays(today, 7);
    dayStates(history, week, goal, off).forEach((state, i) => {
      const label = state === "off"
        ? t("goals.chart.dayOff", { date: fmtDay(week[i]) })
        : `${fmtDay(week[i])}: ${plural("goals.words", addedOn(history, week[i]))}`;
      segs.createSpan({ cls: `escrita-streak-seg is-${state}`, attr: { role: "listitem", "aria-label": label } });
    });
    const month = lastDays(today, CHART_DAYS);
    // Days off where the goal wasn't met are left out: "goal met 8 of 22 days".
    const met = goalMetSummary(history, month, goal, off);
    streakTile.createDiv({
      cls: "escrita-tile-sub",
      text: t("goals.tile.metOf", { n: fmt(met.met), days: fmt(met.of) }),
    });

    this.renderChart(el, month, bookPath);
    if (scope) this.renderPacing(el, scope);
    else if (piece) this.renderPiecePacing(el, piece);
  }

  private renderPieceTile(tiles: HTMLElement, scope: PieceScope): void {
    const { piece, count } = scope;
    const tile = this.tile(tiles, t("goals.tile.piece"));
    const sum = pieceSummary(count, piece);

    const v = tile.createDiv({ cls: "escrita-tile-value" });
    v.toggleClass("is-met", sum.reached && sum.state !== "near" && sum.state !== "over");
    v.toggleClass("is-near", sum.state === "near");
    v.toggleClass("is-over", sum.state === "over");
    if (sum.of === null) {
      v.createSpan({ text: unitAmount(piece.unit, count) });
    } else {
      v.createSpan({ text: fmt(count) });
      v.createSpan({ cls: "escrita-tile-of", text: ` / ${unitAmount(piece.unit, sum.of)}` });
    }

    if (sum.of !== null) {
      const g = pieceBar(count, piece);
      const bar = tile.createDiv({
        cls: "escrita-bar escrita-piece-bar",
        attr: {
          role: "progressbar",
          "aria-label": t("goals.tile.piece"),
          "aria-valuemin": 0,
          "aria-valuemax": Math.round(sum.of),
          "aria-valuenow": Math.round(Math.min(count, sum.of)),
          "aria-valuetext": `${fmt(count)} / ${unitAmount(piece.unit, sum.of)}`,
        },
      });
      const fill = bar.createDiv({ cls: "escrita-bar-fill" });
      fill.toggleClass("is-met", sum.reached && sum.state === "under");
      fill.toggleClass("is-near", sum.state === "near");
      fill.toggleClass("is-over", sum.state === "over");
      setWidth(fill, g.fill);
      const mark = (at: number | null, cls: string, label: string) => {
        if (at === null) return;
        const m = bar.createDiv({ cls: `escrita-bar-mark ${cls}`, attr: { "aria-hidden": "true", title: label } });
        m.setCssStyles({ left: `${Math.round(at * 1000) / 10}%` });
      };
      mark(g.targetMark, "is-target", t("goals.tile.targetMark"));
      mark(g.limitMark, "is-limit", t("goals.tile.limitMark"));
    }

    const sub = tile.createDiv({ cls: "escrita-tile-sub" });
    const parts: string[] = [];
    if (piece.target) parts.push(t("goals.tile.pieceSub", { pct: fmt(Math.floor((count / piece.target) * 100)) }));
    else parts.push(t("goals.tile.pieceNoTarget"));
    if (piece.limit) {
      const limit = unitAmount(piece.unit, piece.limit);
      if (sum.state !== "over") parts.push(t(sum.state === "near" ? "goals.tile.nearLimit" : "goals.tile.limit", { limit }));
    }
    sub.setText(parts.join(" · "));
    if (sum.state === "over") {
      tile.createDiv({ cls: "escrita-tile-sub is-over", text: t("goals.status.over", { n: fmt(sum.over) }) });
    }
  }

  private tile(parent: HTMLElement, label: string): HTMLElement {
    const tile = parent.createDiv({ cls: "escrita-tile" });
    tile.createDiv({ cls: "escrita-tile-label", text: label });
    return tile;
  }

  private tileValue(tile: HTMLElement, value: number, of: number | null, met: boolean): void {
    const v = tile.createDiv({ cls: "escrita-tile-value" });
    v.toggleClass("is-met", met);
    v.createSpan({ text: fmt(value) });
    if (of !== null) v.createSpan({ cls: "escrita-tile-of", text: ` / ${fmt(of)}` });
  }

  private tileBar(tile: HTMLElement, value: number, max: number, label: string): void {
    const bar = tile.createDiv({
      cls: "escrita-bar",
      attr: {
        role: "progressbar",
        "aria-label": label,
        "aria-valuemin": 0,
        "aria-valuemax": Math.round(max),
        "aria-valuenow": Math.round(Math.min(value, max)),
        "aria-valuetext": `${fmt(value)} / ${fmt(max)}`,
      },
    });
    const fill = bar.createDiv({ cls: "escrita-bar-fill" });
    fill.toggleClass("is-met", value >= max);
    setWidth(fill, max > 0 ? value / max : 0);
  }

  private renderChart(parent: HTMLElement, days: string[], bookPath: string | null): void {
    const history = this.plugin.data.history;
    const goal = this.plugin.settings.dailyGoal;
    const values = dailySeries(history, days, bookPath);
    let totals: number[] | null = null;
    const live = this.bookScope?.total
      // A piece's running total is in words (like its history), so only drawn for word pieces.
      ?? (this.pieceScope?.piece.unit === "words" ? this.pieceScope.count : null);
    if (live !== null && live !== undefined && bookPath) {
      totals = bookTotalSeries(history, days, bookPath, live);
      totals[totals.length - 1] = live; // today's point is the live count
    }
    const isOff = this.goals.dayOff();
    const off = isOff ? days.map((d) => isOff(d)) : null;

    const wrap = parent.createDiv({ cls: "escrita-chart" });
    const width = Math.round(this.contentEl.clientWidth || 520);
    const g = chartGeometry({ width, height: CHART_HEIGHT, values, goal, totals, off });

    const svg = wrap.createSvg("svg", {
      cls: "escrita-chart-svg",
      attr: {
        viewBox: `0 0 ${g.width} ${g.height}`,
        width: "100%",
        height: g.height,
        role: "img",
        "aria-label": t("goals.chart.label", { n: days.length }),
      },
    });
    if (g.offBands.length > 0) {
      // Days off: a dimmed band with a light hatch behind the bars.
      const id = `escrita-off-hatch-${Math.random().toString(36).slice(2, 8)}`;
      const pattern = svg.createSvg("defs").createSvg("pattern", {
        attr: { id, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
      });
      pattern.createSvg("line", { cls: "escrita-chart-hatch", attr: { x1: 0, y1: 0, x2: 0, y2: 6 } });
      for (const b of g.offBands) {
        const range = b.from === b.to
          ? fmtDay(days[b.from])
          : `${fmtShortDay(days[b.from])} – ${fmtShortDay(days[b.to])}`;
        const attr = { x: b.x, y: b.y, width: b.width, height: b.height };
        svg.createSvg("rect", { cls: "escrita-chart-off", attr });
        const hatch = svg.createSvg("rect", { cls: "escrita-chart-off-hatch", attr: { ...attr, fill: `url(#${id})` } });
        hatch.createSvg("title").textContent = t("goals.chart.dayOff", { date: range });
      }
    }
    svg.createSvg("line", {
      cls: "escrita-chart-axis",
      attr: { x1: g.plot.left, x2: g.plot.right, y1: g.plot.bottom, y2: g.plot.bottom },
    });
    for (const b of g.bars) {
      const rect = svg.createSvg("rect", {
        cls: `escrita-chart-bar${b.met ? " is-met" : ""}`,
        attr: { x: b.x, y: b.y, width: b.width, height: b.height, rx: Math.min(2, b.width / 2) },
      });
      rect.createSvg("title").textContent = `${fmtDay(days[b.index])}: ${plural("goals.words", b.value)}`;
    }
    if (g.goalY !== null) {
      svg.createSvg("line", {
        cls: "escrita-chart-goal",
        attr: { x1: g.plot.left, x2: g.plot.right, y1: g.goalY, y2: g.goalY },
      });
    }
    if (g.totalPath && g.totalEnd) {
      svg.createSvg("path", { cls: "escrita-chart-total", attr: { d: g.totalPath } });
      svg.createSvg("circle", { cls: "escrita-chart-total-dot", attr: { cx: g.totalEnd.x, cy: g.totalEnd.y, r: 2.5 } });
      svg.createSvg("text", {
        cls: "escrita-chart-total-label",
        attr: { x: g.totalEnd.x + 6, y: g.totalEnd.y + 4 },
      }).textContent = fmt(g.totalEnd.value);
    }
    for (const l of g.xLabels) {
      const text = l.index === days.length - 1 ? t("goals.chart.today") : fmtShortDay(days[l.index]);
      svg.createSvg("text", {
        cls: "escrita-chart-xlabel",
        attr: { x: l.x, y: g.height - 5, "text-anchor": l.anchor },
      }).textContent = text;
    }

    const legend = wrap.createDiv({ cls: "escrita-chart-legend" });
    const item = (swatch: string, label: string) => {
      const i = legend.createSpan({ cls: "escrita-legend-item" });
      i.createSpan({ cls: `escrita-legend-swatch ${swatch}` });
      i.createSpan({ text: label });
    };
    item("is-bar", t("goals.legend.words"));
    if (goal > 0) {
      item("is-met", t("goals.legend.met"));
      item("is-goal", t("goals.legend.goal"));
    }
    if (totals) item("is-total", t(this.bookScope ? "goals.legend.total" : "goals.legend.pieceTotal"));
    if (g.offBands.length > 0) item("is-off", t("goals.legend.off"));
  }

  private renderPacing(parent: HTMLElement, scope: BookScope): void {
    const history = this.plugin.data.history;
    const today = this.goals.today();
    const callout = parent.createDiv({ cls: "escrita-pacing" });
    const off = this.goals.dayOff();
    const p = pacing({
      total: scope.total,
      goal: scope.goal ?? 0,
      deadline: scope.deadline,
      today,
      average: dailyAverage(history, today, { bookPath: scope.book.note.path, net: true, isDayOff: off }),
      isDayOff: off,
    });
    if (!p) {
      callout.setText(t("goals.pace.noGoal"));
      return;
    }
    if (p.done) {
      callout.addClass("is-good");
      callout.setText(t("goals.pace.done", { total: fmt(p.total), goal: fmt(p.goal) }));
      return;
    }
    if (p.overdue && p.deadline) {
      callout.addClass("is-behind");
      callout.setText(plural("goals.pace.overdue", p.remaining, { date: fmtDay(p.deadline) }));
      return;
    }
    const avg = fmt(p.average);
    const finish = (): string => {
      if (!p.projectedFinish) {
        // Words were added but as many were cut: revising, not idle.
        const added = dailyAverage(history, today, { bookPath: scope.book.note.path });
        return t(added > 0 ? "goals.pace.revising" : "goals.pace.noPace");
      }
      const date = fmtDay(p.projectedFinish);
      if (p.daysEarly === null) return t("goals.pace.finish", { avg, date });
      if (p.daysEarly > 0) return t("goals.pace.finishEarly", { avg, date, days: plural("goals.days", p.daysEarly) });
      if (p.daysEarly < 0) return t("goals.pace.finishLate", { avg, date, days: plural("goals.days", -p.daysEarly) });
      return t("goals.pace.finishOnTime", { avg, date });
    };
    if (!p.deadline || p.daysLeft === null || p.neededPerDay === null) {
      callout.setText(`${finish()} ${t("goals.pace.noDeadline")}`);
      return;
    }
    callout.addClass(p.onTrack ? "is-good" : "is-behind");
    callout.createSpan({ cls: "escrita-pacing-verdict", text: t(p.onTrack ? "goals.pace.onTrack" : "goals.pace.behind") });
    callout.appendText(" ");
    callout.appendText(this.needText(p, (n) => plural("goals.words", n)));
    callout.appendText(` ${finish()}`);
  }

  /** "12 days left until Oct 11 (8 writing days): you need 1,000 words a day." */
  private needText(p: Pacing, amount: (n: number) => string): string {
    const daysLeft = p.daysLeft ?? 0;
    const writing = p.writingDaysLeft ?? daysLeft;
    const vars = {
      days: plural("goals.days", daysLeft),
      date: p.deadline ? fmtDay(p.deadline) : "",
      words: amount(p.neededPerDay ?? 0),
    };
    if (writing !== daysLeft) {
      return plural("goals.pace.needWriting", daysLeft, { ...vars, writing: plural("goals.writingDays", writing) });
    }
    return plural("goals.pace.need", daysLeft, vars);
  }

  private renderPiecePacing(parent: HTMLElement, scope: PieceScope): void {
    const history = this.plugin.data.history;
    const today = this.goals.today();
    const { piece, count, words } = scope;
    const unit = piece.unit;
    const callout = parent.createDiv({ cls: "escrita-pacing" });
    if (!piece.target) {
      callout.setText(t("goals.pace.pieceNoTarget"));
      return;
    }
    const off = this.goals.dayOff();
    const path = scope.file.path;
    // History is kept in words; a character piece converts with its own characters per word.
    const wordsAvg = dailyAverage(history, today, { bookPath: path, net: true, isDayOff: off });
    const avg = paceInUnit(wordsAvg, unit, count, words) ?? 0;
    const p = pacing({ total: count, goal: piece.target, deadline: piece.deadline ?? null, today, average: avg, isDayOff: off });
    if (!p) {
      callout.setText(t("goals.pace.pieceNoTarget"));
      return;
    }
    if (p.done) {
      callout.addClass("is-good");
      callout.setText(t("goals.pace.pieceDone", { total: fmt(p.total), goal: unitAmount(unit, p.goal) }));
      return;
    }
    if (p.overdue && p.deadline) {
      callout.addClass("is-behind");
      callout.setText(plural("goals.pace.pieceOverdue", p.remaining, { date: fmtDay(p.deadline), left: unitAmount(unit, p.remaining) }));
      return;
    }
    const avgText = unit === "words" ? fmt(p.average) : unitAmount(unit, p.average);
    const finish = (): string => {
      if (!p.projectedFinish) {
        const added = dailyAverage(history, today, { bookPath: path, isDayOff: off });
        return t(added > 0 ? "goals.pace.revising" : "goals.pace.pieceNoPace");
      }
      const date = fmtDay(p.projectedFinish);
      let text: string;
      if (p.daysEarly === null) text = t("goals.pace.finish", { avg: avgText, date });
      else if (p.daysEarly > 0) text = t("goals.pace.finishEarly", { avg: avgText, date, days: plural("goals.days", p.daysEarly) });
      else if (p.daysEarly < 0) text = t("goals.pace.finishLate", { avg: avgText, date, days: plural("goals.days", -p.daysEarly) });
      else text = t("goals.pace.finishOnTime", { avg: avgText, date });
      return unit === "words" ? text : `${text} ${t("goals.pace.charsEstimate")}`;
    };
    if (!p.deadline || p.daysLeft === null || p.neededPerDay === null) {
      callout.setText(`${finish()} ${t("goals.pace.pieceNoDeadline")}`);
      return;
    }
    callout.addClass(p.onTrack ? "is-good" : "is-behind");
    callout.createSpan({ cls: "escrita-pacing-verdict", text: t(p.onTrack ? "goals.pace.onTrack" : "goals.pace.behind") });
    callout.appendText(" ");
    callout.appendText(this.needText(p, (n) => unitAmount(unit, n)));
    callout.appendText(` ${finish()}`);
  }

  // ---------- settings row ----------

  private renderSettings(el: HTMLElement): void {
    const s = this.plugin.settings;
    const field = (label: string) => {
      const f = el.createEl("label", { cls: "escrita-field" });
      f.createSpan({ cls: "escrita-field-label", text: label });
      return f;
    };

    const daily = field(t("goals.set.daily")).createEl("input", {
      type: "number",
      attr: { min: 0, step: 50, inputmode: "numeric" },
    });
    daily.value = String(s.dailyGoal);
    daily.addEventListener("change", this.guard(async () => {
      const f = readNumberField(daily.value, daily.validity.badInput);
      if (f.kind === "invalid") {
        // Keep the current goal rather than turning it off.
        daily.value = String(s.dailyGoal);
        new Notice(t("goals.set.invalidNumber"));
        return;
      }
      const n = f.kind === "value" ? f.n : 0;
      s.dailyGoal = n;
      daily.value = String(n);
      await this.plugin.saveSettings();
      this.renderSummary();
    }));

    const scope = this.bookScope;
    if (scope) {
      const bookGoal = field(t("goals.set.book")).createEl("input", {
        type: "number",
        attr: { min: 0, step: 1000, inputmode: "numeric" },
      });
      bookGoal.value = scope.goal ? String(scope.goal) : "";
      bookGoal.addEventListener("change", this.guard(async () => {
        const f = readNumberField(bookGoal.value, bookGoal.validity.badInput);
        if (f.kind === "invalid") {
          // Never erase the goal in the note because of a typo.
          bookGoal.value = this.bookScope?.goal ? String(this.bookScope.goal) : "";
          new Notice(t("goals.set.invalidNumber"));
          return;
        }
        const n = f.kind === "value" && f.n > 0 ? f.n : null;
        bookGoal.value = n ? String(n) : "";
        if (await this.writeFrontmatter(scope.book, (fm) => {
          if (n) fm.goal = n;
          else delete fm.goal;
        })) {
          if (this.bookScope) this.bookScope.goal = n;
          this.renderSummary();
        }
      }));

      const deadline = field(t("goals.set.deadline")).createEl("input", { type: "date" });
      deadline.value = scope.deadline ?? "";
      deadline.addEventListener("change", this.guard(async () => {
        const d = normalizeDeadline(deadline.value);
        if (await this.writeFrontmatter(scope.book, (fm) => {
          if (d) fm.deadline = d;
          else delete fm.deadline;
        })) {
          if (this.bookScope) this.bookScope.deadline = d;
          this.renderSummary();
        }
      }));
    }

    const piece = this.pieceScope;
    if (piece) this.renderPieceSettings(field, piece.file);

    const dayEnds = field(t("goals.set.dayEnds")).createEl("select", { cls: "dropdown" });
    for (let h = 0; h <= 6; h++) dayEnds.createEl("option", { value: String(h), text: `${String(h).padStart(2, "0")}:00` });
    dayEnds.value = String(s.dayEndsAt);
    dayEnds.addEventListener("change", this.guard(async () => {
      s.dayEndsAt = Math.min(6, Math.max(0, Number(dayEnds.value) || 0));
      await this.plugin.saveSettings();
      this.renderSummary();
    }));
  }

  /** Target, limit, unit and deadline fields that edit the piece note's properties. */
  private renderPieceSettings(field: (label: string) => HTMLElement, file: TFile): void {
    const s = this.plugin.settings;
    const current = () => this.pieceScope?.piece ?? { unit: "words" as PieceUnit };
    const apply = async (fn: (fm: Record<string, unknown>) => void, update: (p: Piece) => void): Promise<void> => {
      try {
        await this.plugin.app.fileManager.processFrontMatter(file, fn);
      } catch (e) {
        console.error("Escrita: couldn't update the note's properties", e);
        new Notice(t("goals.set.saveErrorNote"));
        return;
      }
      const scope = this.pieceScope;
      if (!scope) return;
      update(scope.piece);
      const { count, words } = await this.goals.measure(scope.file, scope.piece);
      scope.count = count;
      scope.words = words;
      this.renderSummary();
      this.goals.refreshStatus();
    };

    const amount = (label: string, key: "target" | "limit", prop: () => string) => {
      const input = field(label).createEl("input", {
        type: "number",
        attr: { min: 0, step: 100, inputmode: "numeric" },
      });
      input.value = current()[key] ? String(current()[key]) : "";
      input.addEventListener("change", this.guard(async () => {
        const f = readNumberField(input.value, input.validity.badInput);
        if (f.kind === "invalid") {
          // Never erase a property in the note because of a typo.
          const was = current()[key];
          input.value = was ? String(was) : "";
          new Notice(t("goals.set.invalidNumber"));
          return;
        }
        const n = f.kind === "value" && f.n > 0 ? f.n : undefined;
        input.value = n ? String(n) : "";
        const name = prop();
        await apply((fm) => {
          if (n) fm[name] = n;
          else delete fm[name];
        }, (p) => {
          if (n) p[key] = n;
          else delete p[key];
        });
      }));
    };
    amount(t("goals.set.target"), "target", () => s.targetProperty);
    amount(t("goals.set.limit"), "limit", () => s.limitProperty);

    const unit = field(t("goals.set.unit")).createEl("select", { cls: "dropdown" });
    for (const u of PIECE_UNITS) unit.createEl("option", { value: u, text: t(UNIT_LABELS[u]) });
    unit.value = current().unit;
    unit.addEventListener("change", this.guard(async () => {
      const u = (PIECE_UNITS as readonly string[]).includes(unit.value) ? (unit.value as PieceUnit) : "words";
      const name = s.unitProperty;
      await apply((fm) => {
        // Words is the default: don't add the property just to say so.
        if (u === "words" && !(name in fm)) return;
        fm[name] = u;
      }, (p) => { p.unit = u; });
    }));

    const deadline = field(t("goals.set.deadline")).createEl("input", { type: "date" });
    deadline.value = current().deadline ?? "";
    deadline.addEventListener("change", this.guard(async () => {
      const d = normalizeDeadline(deadline.value);
      await apply((fm) => {
        if (d) fm[DEADLINE_PROPERTY] = d;
        else delete fm[DEADLINE_PROPERTY];
      }, (p) => {
        if (d) p.deadline = d;
        else delete p.deadline;
      });
    }));
  }

  private async writeFrontmatter(book: Book, fn: (fm: Record<string, unknown>) => void): Promise<boolean> {
    try {
      await this.plugin.app.fileManager.processFrontMatter(book.note, fn);
      return true;
    } catch (e) {
      console.error("Escrita: couldn't update the book note's frontmatter", e);
      new Notice(t("goals.set.saveError"));
      return false;
    }
  }

  // ---------- sprint row ----------

  private sprintText(): string {
    const s = this.goals.sprint;
    if (!s) return "";
    const time = formatClock(s.remainingMs(Date.now()));
    return s.target > 0
      ? t("goals.sprint.running", { time, words: fmt(s.words), target: plural("goals.words", s.target) })
      : t("goals.sprint.runningNoTarget", { time, words: plural("goals.words", s.words) });
  }

  private renderSprint(): void {
    const el = this.sprintEl;
    if (!el) return;
    el.empty();
    this.sprintStatusEl = null;
    el.createSpan({ cls: "escrita-field-label escrita-sprint-title", text: t("goals.sprint.title") });

    const running = this.goals.sprint;
    if (running) {
      this.sprintStatusEl = el.createSpan({ cls: "escrita-sprint-status", text: this.sprintText() });
      const stop = el.createEl("button", { cls: "escrita-sprint-button", text: t("goals.sprint.stop") });
      stop.addEventListener("click", () => this.goals.stopSprint());
      return;
    }

    const s = this.plugin.settings;
    const options = Array.from(new Set([...SPRINT_OPTIONS, s.sprintMinutes]))
      .filter((m) => Number.isFinite(m) && m > 0)
      .sort((a, b) => a - b);
    const seg = el.createDiv({ cls: "escrita-segmented", attr: { role: "group", "aria-label": t("goals.sprint.length") } });
    const buttons: HTMLButtonElement[] = [];
    for (const m of options) {
      const b = seg.createEl("button", { text: t("goals.sprint.minutes", { n: fmt(m) }) });
      b.toggleClass("is-active", m === this.sprintMinutes);
      b.setAttr("aria-pressed", String(m === this.sprintMinutes));
      b.addEventListener("click", () => {
        this.sprintMinutes = m;
        buttons.forEach((x, i) => {
          x.toggleClass("is-active", options[i] === m);
          x.setAttr("aria-pressed", String(options[i] === m));
        });
      });
      buttons.push(b);
    }

    const target = el.createEl("input", {
      type: "number",
      cls: "escrita-sprint-target",
      attr: { min: 0, step: 50, inputmode: "numeric", "aria-label": t("goals.sprint.target"), placeholder: t("goals.sprint.target") },
    });
    target.value = s.sprintTarget > 0 ? String(s.sprintTarget) : "";

    const start = el.createEl("button", { cls: "mod-cta escrita-sprint-button", text: t("goals.sprint.start") });
    start.addEventListener("click", this.guard(async () => {
      const f = readNumberField(target.value, target.validity.badInput);
      if (f.kind === "invalid") {
        new Notice(t("goals.set.invalidNumber"));
        target.focus();
        return;
      }
      const n = f.kind === "value" ? f.n : 0;
      s.sprintMinutes = this.sprintMinutes;
      s.sprintTarget = n;
      await this.plugin.saveSettings();
      this.goals.startSprint(this.sprintMinutes, n);
    }));
  }
}
