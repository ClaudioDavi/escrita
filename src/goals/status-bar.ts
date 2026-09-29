import { setIcon, setTooltip } from "obsidian";
import { fmt, t } from "../i18n";
import type { PieceUnit } from "../core/piece";
import { plural, unitAmount } from "./format";
import type { PieceSummary } from "./piece";

/** Registers a DOM listener so plugin unload removes it (plugin.registerDomEvent). */
export type RegisterDom = <K extends keyof HTMLElementEventMap>(
  el: HTMLElement,
  type: K,
  handler: (ev: HTMLElementEventMap[K]) => unknown,
) => void;

export interface StatusState {
  /** words in the current editor selection; 0 = no selection */
  selection: number;
  /** words in the active chapter, or null when the active file isn't a chapter */
  chapter: number | null;
  /** words in the active file's book, or null outside a book */
  book: number | null;
  /** the active note's length against its target or limit, or null when it has neither */
  piece: (PieceSummary & { unit: PieceUnit }) | null;
  today: number;
  goal: number;
  streak: number;
  sprint: { clock: string; words: number; target: number; progress: number } | null;
}

/**
 * The status bar item. Its elements are built once and only their text and
 * classes change, so the one-second sprint tick never swaps out a button mid-click.
 */
export class StatusBar {
  private counts: HTMLElement;
  private piece: HTMLElement;
  private pieceText: HTMLElement;
  private pieceFill: HTMLElement;
  private pieceOver: HTMLElement;
  private today: HTMLElement;
  private todayIcon: HTMLElement;
  private todayText: HTMLElement;
  private todayFill: HTMLElement;
  private streak: HTMLElement;
  private sprint: HTMLElement;
  private clock: HTMLElement;
  private sprintText: HTMLElement;
  private sprintFill: HTMLElement;

  constructor(private el: HTMLElement, on: RegisterDom, onOpen: () => void, onStop: () => void) {
    el.addClass("escrita-status", "mod-clickable");
    setTooltip(el, t("goals.status.tooltip"), { placement: "top" });
    el.setAttr("role", "button");
    el.setAttr("aria-label", t("goals.status.tooltip"));
    el.tabIndex = 0;
    on(el, "click", () => onOpen());
    on(el, "keydown", (e) => {
      if (e.target !== el || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      onOpen();
    });

    this.counts = el.createSpan({ cls: "escrita-status-part escrita-status-counts" });

    this.piece = el.createSpan({ cls: "escrita-status-part escrita-status-piece" });
    this.pieceText = this.piece.createSpan();
    this.pieceFill = this.piece.createSpan({ cls: "escrita-status-bar" }).createSpan({ cls: "escrita-status-fill" });
    this.pieceOver = this.piece.createSpan({ cls: "escrita-status-over" });

    this.today = el.createSpan({ cls: "escrita-status-part escrita-status-today" });
    this.todayIcon = this.today.createSpan({ cls: "escrita-status-check" });
    setIcon(this.todayIcon, "check");
    this.todayText = this.today.createSpan();
    this.todayFill = this.today.createSpan({ cls: "escrita-status-bar" }).createSpan({ cls: "escrita-status-fill" });

    this.streak = el.createSpan({ cls: "escrita-status-part escrita-status-streak" });

    this.sprint = el.createSpan({ cls: "escrita-status-part escrita-status-sprint" });
    this.clock = this.sprint.createSpan({ cls: "escrita-status-clock" });
    this.sprintText = this.sprint.createSpan();
    this.sprintFill = this.sprint.createSpan({ cls: "escrita-status-bar" }).createSpan({ cls: "escrita-status-fill" });
    const stop = this.sprint.createEl("button", { cls: "escrita-status-stop", text: t("goals.status.stop") });
    setTooltip(stop, t("goals.status.stopTooltip"), { placement: "top" });
    on(stop, "click", (e) => {
      e.stopPropagation();
      onStop();
    });
  }

  setVisible(visible: boolean): void {
    this.el.toggleClass("escrita-hidden", !visible);
  }

  update(s: StatusState): void {
    // Chapter / book counts, or the selection count while text is selected.
    let counts = "";
    if (s.selection > 0) counts = plural("goals.status.selected", s.selection);
    else if (s.chapter !== null && s.book !== null) counts = t("goals.status.chapterBook", { chapter: fmt(s.chapter), book: fmt(s.book) });
    else if (s.book !== null) counts = t("goals.status.book", { book: fmt(s.book) });
    this.counts.setText(counts);
    this.counts.toggleClass("escrita-hidden", counts === "");

    // The active note's own target or limit ("4,210 / 5,000 words").
    const p = s.piece;
    this.piece.toggleClass("escrita-hidden", !p || p.of === null);
    if (p && p.of !== null) {
      this.pieceText.setText(`${fmt(p.count)} / ${unitAmount(p.unit, p.of)}`);
      this.piece.toggleClass("is-met", p.reached && p.state !== "near" && p.state !== "over");
      this.piece.toggleClass("is-near", p.state === "near");
      this.piece.toggleClass("is-over", p.state === "over");
      setWidth(this.pieceFill, p.fraction);
      this.pieceOver.setText(p.state === "over" ? t("goals.status.over", { n: fmt(p.over) }) : "");
      this.pieceOver.toggleClass("escrita-hidden", p.state !== "over");
    }

    const running = s.sprint !== null;
    const met = s.goal > 0 && s.today >= s.goal;
    this.today.toggleClass("escrita-hidden", running);
    this.today.toggleClass("is-met", met);
    this.todayIcon.toggleClass("escrita-hidden", !met);
    this.todayText.setText(s.goal > 0
      ? t("goals.status.today", { n: fmt(s.today), goal: fmt(s.goal) })
      : t("goals.status.todayNoGoal", { n: fmt(s.today) }));
    this.todayFill.parentElement?.toggleClass("escrita-hidden", s.goal <= 0);
    setWidth(this.todayFill, s.goal > 0 ? s.today / s.goal : 0);

    this.streak.toggleClass("escrita-hidden", running || s.streak <= 0);
    this.streak.setText(s.streak > 0 ? plural("goals.status.streak", s.streak) : "");

    this.sprint.toggleClass("escrita-hidden", !running);
    if (s.sprint) {
      this.clock.setText(s.sprint.clock);
      this.sprintText.setText(s.sprint.target > 0 ? `${fmt(s.sprint.words)} / ${fmt(s.sprint.target)}` : fmt(s.sprint.words));
      this.sprint.toggleClass("is-met", s.sprint.target > 0 && s.sprint.words >= s.sprint.target);
      setWidth(this.sprintFill, s.sprint.progress);
    }
  }
}

export function setWidth(el: HTMLElement, fraction: number): void {
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  el.setCssStyles({ width: `${Math.round(f * 1000) / 10}%` });
}
