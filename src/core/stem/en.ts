// English stemmer (0.5 plan Q3, Q4). Written by hand from the published Porter2
// algorithm: step 0 (possessive), 1a (plural), 1b (-ed / -ing), 1c (y to i), the
// final-e rule of step 5, plus -ly on stems of 4 or more letters. Steps 2 to 4 stay out
// (universe / university). The "name" profile never Porter-stems.

import type { StemProfile } from "./index";

const VOWELS = "aeiouàáâäæãåāèéêëēėęîïíīįìôöòóœøōõûüùúū";

/** Porter2's special words: exact forms that map to a fixed key. */
const SPECIAL: Record<string, string> = {
  skis: "ski", skies: "sky", dying: "die", lying: "lie", tying: "tie",
  sky: "sky", news: "news", howe: "howe", atlas: "atlas", cosmos: "cosmos", bias: "bias", andes: "andes",
};

/** Words left untouched after step 1a (Porter2's exceptions). */
const AFTER_1A = new Set(["inning", "outing", "canning", "herring", "earring", "proceed", "exceed", "succeed"]);

/** Words ending in -ly that are not an adverb made from a shorter word. */
const LY_KEEP = new Set([
  "only", "family", "reply", "apply", "supply", "imply", "comply", "rely", "multiply", "early", "holy",
  "ugly", "silly", "lonely", "lovely", "friendly", "likely", "unlikely", "lively", "july", "italy",
  "assembly", "butterfly", "monopoly", "melancholy", "anomaly", "lily", "emily", "homily", "deadly",
  "costly", "orderly", "elderly", "ghastly", "ghostly", "cowardly", "hardly",
]);

/** Names and places that end in s without being a plural (name profile). */
const NAME_KEEP = new Set([
  "james", "charles", "moses", "thomas", "lucas", "silas", "agnes", "jones", "dickens", "williams", "adams",
  "jacobs", "hughes", "jonas", "elias", "tobias", "andreas", "mathias", "matthias", "lukas", "nicholas",
  "achilles", "hercules", "socrates", "ulysses", "athens", "texas", "kansas", "atlas", "venus", "mars",
  "wales", "brussels",
]);

/** Contractions that end in 's: left whole, not read as possessives. */
const CONTRACTIONS_S = new Set([
  "it's", "he's", "she's", "that's", "there's", "here's", "what's", "who's", "where's", "how's", "when's",
  "why's", "let's",
]);

const DOUBLES = ["bb", "dd", "ff", "gg", "mm", "nn", "pp", "rr", "tt"];

/** Vowel flags: y is a vowel unless it starts the word or follows a vowel. */
function vowelFlags(w: string): boolean[] {
  const v: boolean[] = [];
  for (let i = 0; i < w.length; i++) {
    const c = w[i]!;
    if (c === "y") v.push(i > 0 && !v[i - 1]);
    else v.push(VOWELS.includes(c));
  }
  return v;
}

/** Index where the region after the first non-vowel that follows a vowel starts, from `start`. */
function regionStart(v: readonly boolean[], start: number, len: number): number {
  for (let i = start + 1; i < len; i++) if (!v[i]! && v[i - 1]!) return i + 1;
  return len;
}

function r1Of(w: string, v: readonly boolean[]): number {
  for (const p of ["gener", "commun", "arsen"]) if (w.startsWith(p)) return p.length;
  return regionStart(v, 0, w.length);
}

/** Ends in a short syllable (Porter2). */
function endsShort(w: string, v: readonly boolean[]): boolean {
  const n = w.length;
  if (n === 2) return v[0]! && !v[1]!;
  if (n < 3) return false;
  const last = w[n - 1]!;
  return !v[n - 3]! && v[n - 2]! && !v[n - 1]! && last !== "w" && last !== "x" && last !== "y";
}

function hasVowel(w: string, upTo: number): boolean {
  const v = vowelFlags(w);
  for (let i = 0; i < upTo; i++) if (v[i]) return true;
  return false;
}

function step1a(w: string): string {
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("ied") || w.endsWith("ies")) return w.length > 4 ? w.slice(0, -2) : w.slice(0, -1);
  if (/(?:x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("us") || w.endsWith("ss")) return w;
  if (w.endsWith("s")) {
    // delete when a vowel appears before the letter just before the s
    if (hasVowel(w, w.length - 2)) return w.slice(0, -1);
  }
  return w;
}

function step1b(w: string): string {
  let v = vowelFlags(w);
  if (w.endsWith("eed")) {
    return w.length - 3 >= r1Of(w, v) ? w.slice(0, -1) : w;
  }
  let stem: string | null = null;
  if (w.endsWith("ed")) stem = w.slice(0, -2);
  else if (w.endsWith("ing")) stem = w.slice(0, -3);
  if (stem === null || !hasVowel(stem, stem.length)) return w;
  if (/(?:at|bl|iz)$/.test(stem)) return stem + "e";
  if (DOUBLES.some((d) => stem!.endsWith(d))) return stem.slice(0, -1);
  v = vowelFlags(stem);
  if (r1Of(stem, v) >= stem.length && endsShort(stem, v)) return stem + "e";
  return stem;
}

function step1c(w: string): string {
  const n = w.length;
  if (n > 2 && w.endsWith("y")) {
    const v = vowelFlags(w);
    if (!v[n - 2]! && !(w[n - 2] === "y") && n - 2 > 0) return w.slice(0, -1) + "i";
  }
  return w;
}

/** Porter2 step 5, the final-e half only. */
function finalE(w: string): string {
  if (!w.endsWith("e") || w.length < 3) return w;
  if (/aste$/.test(w)) return w; // paste, taste, waste: keep apart from past, tast...
  const v = vowelFlags(w);
  const r1 = r1Of(w, v);
  const r2 = regionStart(v, r1, w.length);
  const at = w.length - 1;
  if (at >= r2) return w.slice(0, -1);
  if (at >= r1) {
    const before = w.slice(0, -1);
    if (!endsShort(before, vowelFlags(before))) return before;
  }
  return w;
}

function possessive(w: string): string {
  if (w.endsWith("'s'")) return w.slice(0, -3);
  if (w.endsWith("'s")) return w.slice(0, -2);
  if (w.endsWith("'")) return w.slice(0, -1);
  return w;
}

function stemName(w: string): string {
  if (CONTRACTIONS_S.has(w)) return w;
  let s = possessive(w);
  if (s.length < 2) s = w;
  if (s.includes("'")) return s;
  if (s.length > 3 && s.endsWith("s") && !NAME_KEEP.has(s) && !/(?:ss|us|is)$/.test(s)) {
    if (/(?:x|z|ch|sh)es$/.test(s) && s.length - 2 >= 2) return s.slice(0, -2);
    const base = s.slice(0, -1);
    if (base.length >= 3 && !base.endsWith("s")) return base;
  }
  return s;
}

function stemWord(w: string): string {
  if (CONTRACTIONS_S.has(w)) return w;
  let s = possessive(w);
  if (s.length < 2) s = w;
  if (s.includes("'")) return s; // contractions (don't, she'd, I'm) stay whole
  const special = SPECIAL[s];
  if (special !== undefined) return special;
  if (s.length - 2 >= 4 && s.endsWith("ly") && !LY_KEEP.has(s)) s = s.slice(0, -2);
  s = step1a(s);
  if (!AFTER_1A.has(s)) s = step1b(s);
  s = step1c(s);
  s = finalE(s);
  return s.length > 0 ? s : w;
}

/** Input is already normalized (NFC, lowercase, ’ → '). */
export function stemEn(w: string, profile: StemProfile): string {
  if (w.length < 2 || !/\p{L}/u.test(w)) return w;
  return profile === "name" ? stemName(w) : stemWord(w);
}
