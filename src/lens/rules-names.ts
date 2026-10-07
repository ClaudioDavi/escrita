// The "names without an entry" rule of the revision lens (0.9, U 2.5; PLAN-0.9 Q2-Q4,
// Q18). Pure: no obsidian or CodeMirror imports. Off by default (OPT_IN_RULES): the
// writer turns it on in the lens settings, and it runs only while the lens is on.
//
// The candidates are core/name-runs.ts `nameRuns` over the lens's mask: capitalized
// words and runs not at a sentence start (the run rules are written there, shared with
// the universe-names index). A candidate is marked when:
// - it is not a known name: an entry's name, alias or automatic first name, or a name
//   title (`o.newName.query.known`), nor in the lens's names list (`o.lists.names`), nor
//   in "Not names" (`o.newName.notNames`), all compared by foldName of the whole run;
// - it recurs (Q3): it appears in at least NEW_NAME_IN_WORKS works of the scope
//   (`o.newName.query.works`, the note's own work included), or at least
//   NEW_NAME_IN_NOTE times in this note (occurrences that are candidates, by key).
//   While the universe-names index builds, `works` answers 0 and only the in-note
//   count applies.
// Frontmatter, code, comments and headings are never read: the lens's read mask
// (core/wordcount readMask) blanks them. A sentence-start occurrence of a marked name is
// not marked.
//
// Match shape: `rule: "newName"`, `kind: "base"`, one match per occurrence, `text` the
// run as written (the panel groups the matches by foldName(text) and offers Create and
// Dismiss per name).

import { nameRuns } from "../core/name-runs";
import { foldName } from "../core/names";
import type { Sentence } from "../core/sentences";
import type { Token } from "../core/tokens";
import { stemLang } from "./lang";
import type { Match, RuleOptions } from "./types";

/** At least this many times in the note makes a run a name to flag, whatever the works say (Q3). */
export const NEW_NAME_IN_NOTE = 5;
/** In at least this many works of the scope (the note's own included) makes it one (Q3). */
export const NEW_NAME_IN_WORKS = 2;

/**
 * The `newName` matches of one pass, sorted by `from`. [] when `o.newName` is absent
 * (the universe off, or the caller didn't wire the query).
 */
export function newNames(
  toks: readonly Token[],
  sents: readonly Sentence[],
  mask: string,
  o: Pick<RuleOptions, "lang" | "lists" | "newName">,
): Match[] {
  const nn = o.newName;
  if (!nn) return [];
  const runs = nameRuns(toks, sents, mask, o.lang ? stemLang(o.lang) : null);
  const skip = new Set<string>();
  for (const w of o.lists.names) skip.add(foldName(w));
  for (const w of nn.notNames) skip.add(foldName(w));
  const counts = new Map<string, number>();
  for (const r of runs) counts.set(r.key, (counts.get(r.key) ?? 0) + 1);
  const verdict = new Map<string, boolean>();
  const out: Match[] = [];
  for (const r of runs) {
    let ok = verdict.get(r.key);
    if (ok === undefined) {
      ok = !skip.has(r.key) && !nn.query.known(r.text) &&
        ((counts.get(r.key) ?? 0) >= NEW_NAME_IN_NOTE || nn.query.works(r.text) >= NEW_NAME_IN_WORKS);
      verdict.set(r.key, ok);
    }
    if (ok) out.push({ rule: "newName", kind: "base", from: r.from, to: r.to, text: r.text });
  }
  return out;
}
