// Pure date helpers. A "writing day" rolls over at `dayEndsAt` (hour, 0–6),
// so a session that runs past midnight still counts toward the night it began.

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function writingDay(now: Date, dayEndsAt: number): string {
  const d = new Date(now.getTime());
  if (d.getHours() < dayEndsAt) d.setDate(d.getDate() - 1);
  return isoDay(d);
}

/** Parse YYYY-MM-DD as a local date (no timezone shift). */
export function parseDay(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  if (!d) return day;
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

/** Whole days from `a` to `b` (b - a), both YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  const da = parseDay(a), db = parseDay(b);
  if (!da || !db) return 0;
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86400000);
}

/** The last `n` writing days ending at `today`, oldest first. */
export function lastDays(today: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}
