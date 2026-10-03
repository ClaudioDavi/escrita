// The sentence splitter. Our own, not Intl.Segmenter (Q28): ICU differs across
// Electron, iOS and Android, and knows nothing of travessão tags.
// Pure: no obsidian imports. Offsets are UTF-16 offsets into the mask, which has the
// same length as the document.

import type { Markdown } from "./markdown";
import { isSceneBreakLine } from "./markers";
import type { StemLang } from "./stem";

export interface Sentence { from: number; to: number }

/** Lowercase, with the trailing dot, compared against the word before a single ".". */
export const ABBREVIATIONS: Record<StemLang, ReadonlySet<string>> = {
  pt: new Set([
    "sr.", "sra.", "srta.", "srs.", "sras.", "dr.", "dra.", "drs.", "prof.", "profa.", "profs.",
    "d.", "sto.", "sta.", "av.", "pág.", "págs.", "p.", "pp.", "vol.", "vols.", "cap.", "caps.",
    "nº", "nº.", "n.º", "etc.", "ex.", "exmo.", "exma.", "ilmo.", "ilma.", "art.", "arts.",
    "séc.", "obs.", "tel.", "ed.", "fig.", "gen.", "cel.", "cap.", "ltda.", "cia.", "min.",
  ]),
  en: new Set([
    "mr.", "mrs.", "ms.", "dr.", "prof.", "st.", "jr.", "sr.", "vs.", "etc.", "e.g.", "i.e.",
    "a.m.", "p.m.", "mt.", "gen.", "col.", "capt.", "lt.", "sgt.", "rev.", "hon.", "fig.",
    "vol.", "ch.", "pp.", "approx.", "dept.", "inc.", "ltd.", "co.",
  ]),
};

/** Abbreviations that can still end a sentence when a capital follows. */
const CAN_END = new Set(["etc.", "a.m.", "p.m."]);

const TERMINATORS = ".!?…";
const DASHES = "—–";
const CLOSE_QUOTES = "\"”’»'";
const CLOSERS = new RegExp(String.raw`^(?:["”’»)*_']|\[\^?[\w-]+\])`);
const OPEN_QUOTES = "\"“‘«'";
const OPENERS = "*_~([¡¿“‘«\"'";
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const UPPER = /\p{Lu}/u;
const LOWER = /\p{Ll}/u;
const WS = /\s/;
const PREV_TOKEN = /[\p{L}\p{N}.ºª°]+$/u;
const INITIALS = /^(?:\p{Lu}\.)*\p{Lu}$/u;
const LINE_CLOSED = /[.!?…](?:["”’»)*_'’]|\[\^?[\w-]+\])*$/u;

/**
 * Sentences of the mask, in order, never overlapping. A range covers the sentence's
 * first to last visible character (closers included). `lang` null: the shared rules and
 * initials only, no abbreviation list (Q8, Q28). `from`/`to` limit the work: every
 * sentence overlapping [from, to) is returned whole, so its edges are right.
 */
export function sentences(mask: string, md: Markdown, lang: StemLang | null, from?: number, to?: number): Sentence[] {
  const out: Sentence[] = [];
  if (mask.length === 0 || md.lineCount === 0) return out;
  const abbr = lang ? ABBREVIATIONS[lang] : null;
  const lo = Math.max(0, Math.min(from ?? 0, mask.length));
  const hi = Math.max(lo, Math.min(to ?? mask.length, mask.length));

  const n = md.lineCount;
  const kind: ("blank" | "heading" | "break" | "text")[] = new Array(n);
  const classify = (i: number) => {
    const a = md.lineStart(i);
    const b = md.lineEnd(i);
    if (/^\s*$/.test(mask.slice(a, b))) return "blank" as const;
    if (isSceneBreakLine(md, i)) return "break" as const;
    if (md.startsIn(i) === "prose" && /^#{1,6} /.test(md.text.slice(a, b))) return "heading" as const;
    return "text" as const;
  };
  const kindOf = (i: number) => (kind[i] ??= classify(i));

  let line = from === undefined ? 0 : md.lineOf(lo);
  while (line > 0 && kindOf(line) === "text" && kindOf(line - 1) === "text") line--;
  const lastLine = to === undefined ? n - 1 : md.lineOf(hi);

  while (line < n) {
    if (md.lineStart(line) > hi && line > lastLine) break;
    const k = kindOf(line);
    if (k === "blank" || k === "break") { line++; continue; }
    if (k === "heading") {
      region(mask, md.lineStart(line), md.lineEnd(line), abbr, out);
      line++;
      continue;
    }
    let end = line;
    while (end + 1 < n && kindOf(end + 1) === "text") end++;
    region(mask, md.lineStart(line), md.lineEnd(end), abbr, out);
    line = end + 1;
  }
  return from === undefined && to === undefined ? out : out.filter((s) => s.to > lo && s.from < Math.max(hi, lo + 1));
}

function isDashAt(s: string, i: number, le: number): number {
  if (i >= le) return 0;
  if (DASHES.includes(s[i])) return 1;
  if (s[i] === "-" && s[i + 1] === "-") return 2;
  if (s[i] === "-" && i + 1 < le && WS.test(s[i + 1])) return 1;
  return 0;
}

/** Skip opening marks (emphasis, brackets, quotes) and dialogue dashes. */
function skipOpeners(s: string, i: number, le: number, dashes: boolean): number {
  for (;;) {
    if (i >= le) return i;
    const d = dashes ? isDashAt(s, i, le) : 0;
    if (d) { i += d; continue; }
    if (OPENERS.includes(s[i]) || WS.test(s[i])) { i++; continue; }
    return i;
  }
}

/** Split one paragraph (or heading): mask[ls, le) holds no blank line. */
function region(s: string, ls: number, le: number, abbr: ReadonlySet<string> | null, out: Sentence[]): void {
  let start = -1;
  let hasWord = false;
  let i = ls;
  const push = (to: number) => {
    let e = to;
    while (e > start && WS.test(s[e - 1])) e--;
    if (hasWord && e > start) out.push({ from: start, to: e });
    start = -1;
    hasWord = false;
  };

  while (i < le) {
    const ch = s[i];
    if (start < 0) {
      if (WS.test(ch)) { i++; continue; }
      start = i;
    }
    if (LETTER_OR_DIGIT.test(ch)) { hasWord = true; i++; continue; }

    if (ch === "\n") {
      // A single line break ends a sentence unless the line has no closing mark and
      // the next one starts lowercase. (Lines with a mark were decided at the mark.)
      const before = s.slice(start, i).trimEnd();
      if (before && !LINE_CLOSED.test(before)) {
        const q = skipOpeners(s, i, le, true);
        if (q < le && !LOWER.test(s[q])) { push(i); i++; continue; }
      }
      i++;
      continue;
    }

    // a terminator run: . ! ? … or a dash cut off by a closing quote
    let j = i;
    let dashRun = false;
    if (TERMINATORS.includes(ch)) {
      while (j < le && TERMINATORS.includes(s[j])) j++;
    } else if (isDashAt(s, i, le) && !(s[i] === "-" && s[i + 1] !== "-")) {
      const d = isDashAt(s, i, le);
      if (j + d < le && CLOSE_QUOTES.includes(s[j + d]) && s[j + d] !== "'") { j += d; dashRun = true; }
    }
    if (j === i) { i++; continue; }
    if (!hasWord) { i = j; continue; }

    const run = s.slice(i, j);
    const runStart = i;
    for (;;) {
      if (j >= le) break;
      const m = CLOSERS.exec(s.slice(j, Math.min(le, j + 40)));
      if (!m) break;
      j += m[0].length;
    }
    const end = j;
    const ellipsis = !dashRun && !/[!?]/.test(run) && (run.includes("…") || run.length >= 2);

    let k = end;
    let sawBreak = false;
    while (k < le && WS.test(s[k])) { if (s[k] === "\n") sawBreak = true; k++; }
    if (k >= le) { push(end); i = k; continue; }

    const afterDash = isDashAt(s, k, le);
    if (k === end && !afterDash) { i = end; continue; }

    // abbreviations and initials (a lone ".") never end a sentence
    if (run === ".") {
      const tok = (PREV_TOKEN.exec(s.slice(start, runStart))?.[0] ?? "").replace(/^\.+/, "");
      const low = tok.toLowerCase() + ".";
      const nextUpper = UPPER.test(s[skipOpeners(s, k, le, false)] ?? "");
      if (abbr?.has(low)) {
        if (!(CAN_END.has(low) && (nextUpper || sawBreak))) { i = end; continue; }
      } else if (INITIALS.test(tok) && !(tok === "I" && !/^\p{Lu}\./u.test(s.slice(k, k + 3)))) {
        i = end;
        continue;
      }
    }

    // what follows
    let boundary: boolean;
    if (afterDash) {
      const q = skipOpeners(s, k, le, true);
      boundary = q < le && UPPER.test(s[q]);
    } else if (OPEN_QUOTES.includes(s[k]) && !(s[k] === "'" && LOWER.test(s[k + 1] ?? ""))) {
      boundary = true;
    } else {
      const q = skipOpeners(s, k, le, false);
      const c = s[q] ?? "";
      if (sawBreak) boundary = !(ellipsis && LOWER.test(c));
      else boundary = UPPER.test(c);
    }
    if (boundary) { push(end); i = end; } else i = end;
  }
  if (start >= 0) push(le);
}
