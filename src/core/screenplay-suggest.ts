// What the screenplay editor suggests as you type (1.2, SP 2, PLAN-1.2 Q11). Pure, no Obsidian
// imports; the module's EditorSuggest (src/screenplay/suggest.ts) calls these.
//
// Three triggers: a character cue (an uppercase line after a blank one), a location (after a
// scene heading prefix such as "INT. "), and a time of day (after " - " on a scene heading).

import type { LineKind, Script } from "./fountain";

export type SuggestKind = "cue" | "location" | "time";

export interface SuggestTrigger {
  kind: SuggestKind;
  /** the column where the replaced text starts */
  start: number;
  /** what is typed so far, from `start` to the cursor */
  query: string;
}

export interface SuggestContext {
  line: string;
  column: number;
  kind: LineKind | null;
  blankAbove: boolean;
  sceneHeadings: readonly string[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasLower = (s: string) => /\p{Ll}/u.test(s);
const hasLetter = (s: string) => /\p{L}/u.test(s);

/** Lowercase, accents off: the key a query and a candidate are compared by. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/** The heading prefixes of the settings as `INT. ` at the start of a line: the match ends where the location starts. */
function prefixRe(sceneHeadings: readonly string[]): RegExp | null {
  const words = sceneHeadings.map((p) => p.trim().replace(/[. ]+$/, "")).filter((p) => p !== "").sort((a, b) => b.length - a.length);
  if (words.length === 0) return null;
  return new RegExp("^\\s*(?:" + words.map(escapeRe).join("|") + ")(?:\\.\\s+|\\s+)", "i");
}

const CUE_KINDS: readonly (LineKind | null)[] = [null, "action", "character"];

/** The suggestion this cursor asks for, or null. */
export function triggerAt(ctx: SuggestContext): SuggestTrigger | null {
  const { line, column } = ctx;
  const before = line.slice(0, column);
  const re = prefixRe(ctx.sceneHeadings);
  const prefix = re ? re.exec(before) : null;

  // a scene heading: a prefix after a blank line, or a heading the parser already read (forced)
  if (ctx.kind === "scene" || (prefix && ctx.blankAbove)) {
    const dash = before.lastIndexOf(" - ");
    const afterPrefix = prefix ? prefix[0].length : 0;
    if (dash >= afterPrefix && dash >= 0) return { kind: "time", start: dash + 3, query: before.slice(dash + 3) };
    if (prefix) return { kind: "location", start: prefix[0].length, query: before.slice(prefix[0].length) };
    return null;
  }

  // a cue: capitals typed at the end of a line that follows a blank one (`@` forces a cue, any case)
  if (!ctx.blankAbove || column !== line.length || !CUE_KINDS.includes(ctx.kind)) return null;
  const lead = /^\s*/.exec(line)![0].length;
  const forced = line[lead] === "@";
  const start = lead + (forced ? 1 : 0);
  const query = line.slice(start, column);
  if (!hasLetter(query) || query.includes("(") || prefix) return null;
  if (!forced && hasLower(query)) return null;
  return { kind: "cue", start, query };
}

/** The place in a scene heading's text: after its prefix, before the first " - ". */
function locationOf(text: string, forced: boolean, re: RegExp | null): string {
  let rest = text.trim();
  if (!forced) rest = rest.replace(re ?? /^\S+?(?:\.\s+|\s+)/, "");
  const dash = rest.indexOf(" - ");
  return (dash >= 0 ? rest.slice(0, dash) : rest).trim();
}

/** The values of `all` by use, most used first, ties in order of appearance; one entry per spelling in capitals. */
function byUse(all: readonly string[]): string[] {
  const seen = new Map<string, { text: string; n: number }>();
  for (const v of all) {
    if (v === "") continue;
    const key = v.toLocaleUpperCase();
    const e = seen.get(key);
    if (e) e.n++;
    else seen.set(key, { text: v, n: 1 });
  }
  return [...seen.values()].sort((a, b) => b.n - a.n).map((e) => e.text);
}

/**
 * The candidates for a trigger, best first: for a cue, the script's own cues by use, then
 * `names` (the universe's names for the note, through `plugin.names`, in capitals); for a
 * location, the locations of the script's scene headings by use; for a time, `times` (the
 * setting). Matched by prefix, ignoring case and accents; never the query itself.
 * `sceneHeadings` (the settings words) lets a location be cut exactly; without it the first
 * word of the heading is taken as the prefix.
 */
export function candidates(
  trigger: SuggestTrigger, script: Script, names: readonly string[], times: readonly string[],
  sceneHeadings?: readonly string[],
): string[] {
  let pool: string[];
  if (trigger.kind === "time") pool = [...times];
  else if (trigger.kind === "location") {
    const re = sceneHeadings ? prefixRe(sceneHeadings) : null;
    pool = byUse(script.elements.flatMap((e) =>
      e.type === "scene" ? [locationOf(e.runs.map((r) => r.text).join(""), !!e.forced, re)] : []));
  } else {
    const own = byUse(script.elements.flatMap((e) => (e.type === "character" ? [e.name.trim()] : [])));
    const have = new Set(own.map((n) => n.toLocaleUpperCase()));
    pool = [...own, ...names.map((n) => n.trim().toLocaleUpperCase()).filter((n) => n !== "" && !have.has(n))];
  }
  const q = fold(trigger.query);
  const out: string[] = [];
  for (const c of pool) {
    if (c === trigger.query || !fold(c).startsWith(q) || out.includes(c)) continue;
    out.push(c);
  }
  return out;
}
