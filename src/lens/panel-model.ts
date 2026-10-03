import { LANG_RULES, RULES } from "./types";
import type { LensLang, LensResult, Lists, Match, RuleId } from "./types";

/** Matches per 1000 words, unrounded; 0 when there are no words. The view shows one decimal. */
export function per1000(count: number, words: number): number {
  if (!(words > 0)) return 0;
  return (count / words) * 1000;
}

/**
 * The result the writer sees: matches minus the ones `keep` rejects, counts
 * recomputed. The one filtered view: marks, rows, rates and stepping read it,
 * never `LensResult.matches` directly. Everything else is shared with `r`.
 */
export function withoutDismissed(r: LensResult, keep: (m: Match) => boolean): LensResult {
  const matches = r.matches.filter(keep);
  const counts = {} as Record<RuleId, number>;
  for (const rule of RULES) counts[rule] = 0;
  for (const m of matches) counts[m.rule]++;
  return { ...r, matches, counts };
}

/**
 * The next match of `rule` after `cursor` in direction `dir`, wrapping at the ends.
 * A cursor inside a match (ends included) steps past it. `index` is the match's
 * 0-based position among the matches of that rule; `of` is how many there are
 * (the view shows `index + 1` / `of`).
 */
export function stepTo(
  matches: readonly Match[],
  rule: RuleId,
  cursor: number,
  dir: 1 | -1,
): { index: number; of: number; match: Match } | null {
  const own = matches.filter((m) => m.rule === rule).sort((a, b) => a.from - b.from || a.to - b.to);
  const of = own.length;
  if (of === 0) return null;
  let index = -1;
  if (dir === 1) {
    index = own.findIndex((m) => m.from > cursor);
    if (index < 0) index = 0;
  } else {
    for (let i = of - 1; i >= 0; i--) {
      if (own[i].to < cursor) {
        index = i;
        break;
      }
    }
    if (index < 0) index = of - 1;
  }
  return { index, of, match: own[index] };
}

export interface RuleRow {
  rule: RuleId;
  kind: "on" | "needsLists" | "needsLanguage";
  count: number;
  rate: number;
}

/** One row per enabled rule, in rule order. A rule that cannot run yet says what it needs. */
export function ruleRows(
  r: LensResult,
  enabled: ReadonlySet<RuleId>,
  lists: Pick<Lists, "crutch" | "names">,
  lang: LensLang | null,
): RuleRow[] {
  const rows: RuleRow[] = [];
  for (const rule of RULES) {
    if (!enabled.has(rule)) continue;
    let kind: RuleRow["kind"] = "on";
    if (LANG_RULES.has(rule) && lang === null) kind = "needsLanguage";
    else if (rule === "crutch" && lists.crutch.length === 0) kind = "needsLists";
    else if (rule === "name" && lists.names.length === 0) kind = "needsLists";
    if (kind !== "on") {
      rows.push({ rule, kind, count: 0, rate: 0 });
      continue;
    }
    const count = r.counts[rule] ?? 0;
    rows.push({ rule, kind, count, rate: per1000(count, r.words) });
  }
  return rows;
}

/** Every rule except the ones switched off in settings; unknown ids are ignored. */
export function enabledRules(rulesOff: readonly string[]): Set<RuleId> {
  const off = new Set(rulesOff);
  return new Set(RULES.filter((rule) => !off.has(rule)));
}
