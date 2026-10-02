// Tiny i18n. Each feature module ships its own `strings.ts` with an `en`
// dictionary (the source of truth) and translations keyed by locale.
// Adding a language = adding one key to each strings file.

import { moment } from "obsidian";
import { pluralKey, unitKey, type PieceUnit } from "./core/measure";

export type Dict = Record<string, string>;
export type Strings = { en: Dict } & Record<string, Dict>;

const dicts: Record<string, Dict> = { en: {} };

export function registerStrings(s: Strings): void {
  for (const [lang, d] of Object.entries(s)) dicts[lang] = Object.assign(dicts[lang] ?? {}, d);
}

export function lang(): string {
  const l = (moment.locale() || "en").toLowerCase();
  if (l.startsWith("pt")) return "pt-BR";
  const exact = Object.keys(dicts).find((k) => k.toLowerCase() === l);
  if (exact) return exact;
  const base = Object.keys(dicts).find((k) => k.toLowerCase() === l.split("-")[0]);
  return base ?? "en";
}

/** t("goals.today", { n: 412 }) → "412 today". Missing keys fall back to English, then the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const s = dicts[lang()]?.[key] ?? dicts.en[key] ?? key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Locale-aware number: 18420 → "18,420" / "18.420". */
export function fmt(n: number): string {
  return Math.round(n).toLocaleString(lang());
}

/** plural("goals.days", 1) → t("goals.days.one", { n: "1" }); anything else → ".other" (right for en and pt-BR, including 0). */
export function plural(base: string, n: number, vars: Record<string, string | number> = {}): string {
  return t(pluralKey(base, n), { n: fmt(n), ...vars });
}

/** An amount in a unit: "5,000 words", "1 character", "15.000 caracteres sem espaços". */
export function unitAmount(unit: PieceUnit, n: number): string {
  return plural(unitKey(unit), n);
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
