import { moment } from "obsidian";
import { fmt, t } from "../i18n";
import type { PieceUnit } from "../core/piece";

/** "goals.days" + 1 → "goals.days.one"; anything else → ".other" (right for en and pt-BR, including 0). */
export function plural(base: string, n: number, vars: Record<string, string | number> = {}): string {
  return t(`${base}.${Math.round(n) === 1 ? "one" : "other"}`, { n: fmt(n), ...vars });
}

/** YYYY-MM-DD → a short localized date ("Mar 1, 2027" / "1 de mar. de 2027"). */
export function fmtDay(day: string): string {
  const m = moment(day, "YYYY-MM-DD", true);
  return m.isValid() ? m.format("ll") : day;
}

/** YYYY-MM-DD → "Sep 29" / "29 de set." for chart labels. */
export function fmtShortDay(day: string): string {
  const m = moment(day, "YYYY-MM-DD", true);
  if (!m.isValid()) return day;
  const long = m.localeData().longDateFormat("ll");
  // Drop the year from the locale's "ll" format.
  const noYear = long.replace(/[\s,]*(?:\[[^\]]*\]\s*)?Y+[\s,.]*/g, " ").trim();
  return m.format(noYear || "MMM D");
}

/** An amount in a piece's unit: "5,000 words", "15,000 characters", "1 character (no spaces)". */
export function unitAmount(unit: PieceUnit, n: number): string {
  if (unit === "characters") return plural("goals.chars", n);
  if (unit === "characters-no-spaces") return plural("goals.charsNoSpaces", n);
  return plural("goals.words", n);
}
