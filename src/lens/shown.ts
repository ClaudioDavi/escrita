// Pure helpers for the lens integration (5.1): the result the writer sees (dismissals
// applied), where "Create the word lists note" writes, and which selection counts for
// the panel's selection measures. No obsidian or CodeMirror imports.

import { normalizeWord } from "../core/stem";
import { dismissalOf, isDismissed } from "./dismiss";
import { listsPath } from "./lists";
import { withoutDismissed } from "./panel-model";
import type { Dismissal, LensLang, LensResult } from "./types";

function norm(s: string): string {
  return normalizeWord(s).replace(/\s+/g, " ").trim();
}

/**
 * `r` without the matches the writer ignored. `text` is the text `r` was computed on.
 * Only matches whose rule and text appear in the list pay for a context key, so a note
 * with many matches and a few dismissals stays cheap. Returns `r` itself when nothing is ignored.
 */
export function shownResult(r: LensResult, text: string, list: readonly Dismissal[] | undefined): LensResult {
  if (!list || list.length === 0) return r;
  const seen = new Set(list.map((d) => `${d.rule}\u0000${d.text}`));
  return withoutDismissed(r, (m) => {
    if (!seen.has(`${m.rule}\u0000${norm(m.text)}`)) return true;
    return !isDismissed(list, dismissalOf(text, m));
  });
}

/** Where the word lists note goes: the setting if set, else Word lists.md / Listas de palavras.md by language (English when none: rule 6). */
export function listsTarget(setting: string, l: LensLang | null): string {
  return listsPath(setting) || (l === "pt-BR" ? "Listas de palavras.md" : "Word lists.md");
}

/**
 * The range the panel measures as "Selection": the first non-empty range, unless it is
 * the match a step just selected (stepping must not flip the panel into selection mode).
 */
export function selectionRange(
  ranges: readonly { from: number; to: number }[],
  stepped: { from: number; to: number } | null,
): { from: number; to: number } | null {
  const r = ranges.find((x) => x.to > x.from);
  if (!r) return null;
  if (stepped && stepped.from === r.from && stepped.to === r.to) return null;
  return { from: r.from, to: r.to };
}
