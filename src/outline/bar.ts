// The thin bar under a chapter's title line (0.7 plan Q50, board OutlinePov c): the same
// colours and rules as a piece's bar in the goals tile, in the chapter's own unit.

import type { Piece, PieceUnit, Progress } from "../core/measure";
import { pieceBar } from "../goals/piece";
import { fmt, t, unitAmount } from "../i18n";

export interface BarModel {
  /** 0-1 */
  fill: number;
  targetMark: number | null;
  limitMark: number | null;
  state: "part" | "met" | "near" | "over";
  /** "1.234 / 2.000 palavras", for the tooltip and the screen reader */
  value: string;
  /** the line under the bar: the value, the limit, how far over, where the target came from */
  label: string;
  of: number;
  now: number;
}

/**
 * Null when there is nothing to measure against (no target and no limit): then the
 * chapter has no bar, as before. `chapterOwn` is true when the chapter has its own target; the label
 * then says so, so the writer can tell it from the book's default.
 */
export function barModel(
  progress: Progress | null, count: number, piece: Piece | null, unit: PieceUnit,
  chapterOwn: boolean,
): BarModel | null {
  if (!progress || !piece || progress.of === null) return null;
  const g = pieceBar(count, piece);
  const value = `${fmt(count)} / ${unitAmount(unit, progress.of)}`;
  const parts = [value];
  if (progress.kind === "limit") parts[0] += ` ${t("outline.note.limitOnly")}`;
  if (progress.kind === "target" && progress.limit !== undefined && progress.state !== "over") {
    parts.push(t("outline.note.limit", { n: fmt(progress.limit) }));
  }
  if (progress.state === "over" && progress.over > 0) parts.push(t("outline.note.over", { n: fmt(progress.over) }));
  if (chapterOwn) parts.push(t("outline.bar.own"));
  const state = progress.state === "over" ? "over"
    : progress.state === "near" ? "near"
    : progress.reached ? "met" : "part";
  return {
    fill: g.fill, targetMark: g.targetMark, limitMark: g.limitMark, state,
    value, label: parts.join(" · "), of: progress.of, now: count,
  };
}

/** Draws the bar and its line into `parent`. Nothing when the model is null. */
export function renderPieceBar(
  parent: HTMLElement, progress: Progress | null, count: number, piece: Piece | null,
  unit: PieceUnit, chapterOwn = false,
): void {
  const m = barModel(progress, count, piece, unit, chapterOwn);
  if (!m) return;
  const bar = parent.createDiv({
    cls: "escrita-bar escrita-piece-bar escrita-outline-pbar",
    attr: {
      role: "progressbar",
      "aria-label": t("outline.bar.label"),
      "aria-valuemin": "0",
      "aria-valuemax": String(Math.round(m.of)),
      "aria-valuenow": String(Math.round(Math.min(m.now, m.of))),
      "aria-valuetext": m.value,
      title: m.value,
    },
  });
  const fill = bar.createDiv({ cls: `escrita-bar-fill is-${m.state}` });
  fill.setCssStyles({ width: `${Math.round(m.fill * 1000) / 10}%` });
  const mark = (at: number | null, cls: string) => {
    if (at === null) return;
    const el = bar.createDiv({ cls: `escrita-bar-mark ${cls}`, attr: { "aria-hidden": "true" } });
    el.setCssStyles({ left: `${Math.round(at * 1000) / 10}%` });
  };
  mark(m.targetMark, "is-target");
  mark(m.limitMark, "is-limit");
  parent.createDiv({ cls: "escrita-outline-pbar-text", text: m.label });
}
