// "Ignore here" keys (Q21): a match is identified by its rule, its normalized text and
// up to 3 normalized words on each side, so it survives edits elsewhere in the note.
// Pure: no obsidian or CodeMirror imports.

import { wordRegex } from "../core/wordcount";
import { normalizeWord } from "../core/stem";
import { ALL_RULES, type Dismissal, type Match, type RuleId } from "./types";

const DEFAULT_WORDS = 3;
const DEFAULT_CAP = 500;

function norm(s: string): string {
  return normalizeWord(s).replace(/\s+/g, " ").trim();
}

/**
 * The key of a match. `text` is the live document and `m` carries offsets valid for it.
 * Surrounding words are read from the plain text (not the mask), so the key does not
 * depend on settings.
 */
export function dismissalOf(text: string, m: Match, words: number = DEFAULT_WORDS): Dismissal {
  const before: string[] = [];
  const after: string[] = [];
  const re = wordRegex();
  let mt: RegExpExecArray | null;
  while ((mt = re.exec(text)) !== null) {
    const start = mt.index;
    const end = start + mt[0].length;
    if (end <= m.from) {
      before.push(norm(mt[0]));
      if (before.length > words) before.shift();
    } else if (start >= m.to) {
      after.push(norm(mt[0]));
      if (after.length >= words) break;
    }
  }
  return {
    rule: m.rule,
    text: norm(m.text),
    before: words > 0 ? before.join(" ") : "",
    after: after.join(" "),
  };
}

function same(a: Dismissal, b: Dismissal): boolean {
  return a.rule === b.rule && a.text === b.text && a.before === b.before && a.after === b.after;
}

export function isDismissed(list: readonly Dismissal[] | undefined, d: Dismissal): boolean {
  if (!list) return false;
  return list.some((x) => same(x, d));
}

/** Append (no duplicate), dropping the oldest beyond `cap`. Returns a new list. */
export function addDismissal(list: Dismissal[], d: Dismissal, cap: number = DEFAULT_CAP): Dismissal[] {
  const out = isDismissed(list, d) ? list.slice() : [...list, d];
  return out.length > cap ? out.slice(out.length - cap) : out;
}

/** `moved` first, then the `existing` ones it does not repeat. */
export function mergeDismissals(moved: Dismissal[], existing: Dismissal[]): Dismissal[] {
  const out: Dismissal[] = [];
  for (const d of [...moved, ...existing]) if (!isDismissed(out, d)) out.push(d);
  return out;
}

function isRule(x: unknown): x is RuleId {
  return typeof x === "string" && (ALL_RULES as readonly string[]).includes(x);
}

/** Saved data in, a safe shape out: wrong types and unknown rules are dropped. */
export function cleanDismissed(raw: unknown): Record<string, Dismissal[]> {
  const out: Record<string, Dismissal[]> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [path, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const clean: Dismissal[] = [];
    for (const x of list) {
      if (!x || typeof x !== "object") continue;
      const r = x as Record<string, unknown>;
      if (!isRule(r.rule)) continue;
      if (typeof r.text !== "string" || typeof r.before !== "string" || typeof r.after !== "string") continue;
      const d: Dismissal = { rule: r.rule, text: r.text, before: r.before, after: r.after };
      if (!isDismissed(clean, d)) clean.push(d);
    }
    if (clean.length > 0) out[path] = clean;
  }
  return out;
}
