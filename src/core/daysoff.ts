// Days off (no Obsidian imports). A day off never breaks a streak and is not
// counted as a writing day when pacing toward a deadline. Days are
// "YYYY-MM-DD" strings (writing days); weekdays are computed in UTC from the
// calendar date so no timezone can shift them.

export interface DaysOffConfig {
  /** 0 = Sunday … 6 = Saturday */
  weekdaysOff: readonly number[];
  /** YYYY-MM-DD, one per line (or commas), or an already-split list */
  datesOff: string | readonly string[];
}

export type DayOffPredicate = (day: string) => boolean;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → its weekday (0 = Sunday), or null when it isn't a real date. */
export function weekdayOf(day: string): number | null {
  const m = DAY.exec(day.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return t.getUTCDay();
}

/** The valid YYYY-MM-DD dates in a "dates off" setting, deduplicated, in order. Invalid lines are skipped. */
export function parseDatesOff(s: string | readonly string[] | null | undefined): string[] {
  const items = typeof s === "string" ? s.split(/[\r\n,;]+/) : Array.isArray(s) ? s : [];
  const out: string[] = [];
  for (const raw of items) {
    const v = String(raw).trim();
    if (weekdayOf(v) !== null && !out.includes(v)) out.push(v);
  }
  return out;
}

/** The lines of a "dates off" setting that aren't valid dates (for a settings hint). */
export function invalidDatesOff(s: string): string[] {
  return s.split(/[\r\n,;]+/).map((x) => x.trim()).filter((x) => x && weekdayOf(x) === null);
}

/** A predicate telling whether a writing day is a day off. Invalid days are never off. */
export function dayOffPredicate(cfg: Partial<DaysOffConfig> | null | undefined): DayOffPredicate {
  const weekdays = new Set((cfg?.weekdaysOff ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6));
  const dates = new Set(parseDatesOff(cfg?.datesOff ?? ""));
  if (weekdays.size === 0 && dates.size === 0) return () => false;
  return (day: string) => {
    const d = day.trim();
    if (dates.has(d)) return true;
    const w = weekdayOf(d);
    return w !== null && weekdays.has(w);
  };
}

/** True when a config has any day off at all (lets callers keep the old fast path). */
export function hasDaysOff(cfg: Partial<DaysOffConfig> | null | undefined): boolean {
  return (cfg?.weekdaysOff ?? []).some((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    || parseDatesOff(cfg?.datesOff ?? "").length > 0;
}
