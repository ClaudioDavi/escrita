// Pure pacing math for a book goal with an optional deadline (no Obsidian imports).
//
// Days are counted as in the approved design: the days left run from tomorrow
// through the deadline (deadline inclusive), and the projection starts
// tomorrow too, since today's writing is already part of the average. On the
// deadline itself there is still one day left (today).

import { addDays, daysBetween, parseDay, isoDay } from "../core/dates";

export interface PacingInput {
  /** the book's current word count */
  total: number;
  /** the book's word goal; <= 0 means no goal */
  goal: number;
  /** YYYY-MM-DD, or null/empty for no deadline */
  deadline?: string | null;
  /** today's writing day, YYYY-MM-DD */
  today: string;
  /** recent words per day (e.g. the 7-day average) */
  average: number;
}

export interface Pacing {
  goal: number;
  total: number;
  /** words still to write, never negative */
  remaining: number;
  /** 0–1 */
  fraction: number;
  done: boolean;
  deadline: string | null;
  /** days until the deadline, deadline inclusive (at least 1 on the deadline day); null without a deadline; < 0 once it has passed */
  daysLeft: number | null;
  overdue: boolean;
  /** words a day needed to finish by the deadline; null without a deadline, when overdue, or when done */
  neededPerDay: number | null;
  average: number;
  /** projected finish at the current average; null when done or with no pace */
  projectedFinish: string | null;
  /** deadline − projected finish, in days: positive = early, negative = late; null when unknown */
  daysEarly: number | null;
  /** null when there is no deadline to be on track for */
  onTrack: boolean | null;
}

function finite(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Pacing for a book, or null when there is no goal to pace against. */
export function pacing(input: PacingInput): Pacing | null {
  const goal = Math.max(0, Math.round(finite(input.goal)));
  if (goal <= 0) return null;
  const total = Math.max(0, Math.round(finite(input.total)));
  const average = Math.max(0, finite(input.average));
  const remaining = Math.max(0, goal - total);
  const done = remaining === 0;
  const deadline = normalizeDeadline(input.deadline);
  const until = deadline ? daysBetween(input.today, deadline) : null;
  const daysLeft = until === null ? null : until === 0 ? 1 : until;
  const overdue = !done && daysLeft !== null && daysLeft <= 0;
  const neededPerDay = !done && daysLeft !== null && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : null;

  let projectedFinish: string | null = null;
  if (!done && average > 0) {
    const days = Math.ceil(remaining / average);
    // Guard absurd projections (a trickle of words against a huge goal).
    if (Number.isFinite(days) && days <= 365 * 200) projectedFinish = addDays(input.today, days);
  }
  const daysEarly = deadline && projectedFinish ? daysBetween(projectedFinish, deadline) : null;

  let onTrack: boolean | null = null;
  if (done) onTrack = true;
  else if (deadline) onTrack = !overdue && daysEarly !== null && daysEarly >= 0;

  return {
    goal, total, remaining, fraction: Math.min(1, total / goal), done,
    deadline, daysLeft, overdue, neededPerDay, average,
    projectedFinish, daysEarly, onTrack,
  };
}

/** A frontmatter `goal` value → a positive whole number, or null. Accepts "80,000", "80.000", "80 000". */
export function parseGoal(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!/^\d[\d.,\s_]*$/.test(s)) return null;
  const digits = s.replace(/[.,\s_]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type NumberField = { kind: "clear" } | { kind: "invalid" } | { kind: "value"; n: number };

/**
 * Read an `<input type="number">`: its `.value` is a plain decimal string (or ""
 * when the browser couldn't parse what was typed, flagged by `validity.badInput`).
 * Unlike parseGoal, "." is a decimal point here. "" typed on purpose = clear;
 * bad input, negatives and non-numbers = invalid (keep the old value); anything
 * else is rounded to a whole number.
 */
export function readNumberField(value: string, badInput = false): NumberField {
  if (badInput) return { kind: "invalid" };
  const s = value.trim();
  if (s === "") return { kind: "clear" };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { kind: "invalid" };
  return { kind: "value", n: Math.round(n) };
}

/** A frontmatter `deadline` value (string or Date) → YYYY-MM-DD, or null. */
export function normalizeDeadline(v: unknown): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : isoDay(v);
  if (typeof v !== "string") return null;
  const d = parseDay(v);
  if (!d) return null;
  const iso = isoDay(d);
  // Reject rollovers like 2026-02-31.
  return v.trim().startsWith(iso) ? iso : null;
}
