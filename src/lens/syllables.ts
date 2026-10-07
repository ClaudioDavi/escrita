// Syllable counters for the revision lens (SF 5, Q27). Pure: no obsidian or
// CodeMirror imports.
//
// Approximate on purpose (about 95% exact on running text). pt-BR follows the
// dictionary split, with rising sequences after a consonant (histó-ri-a, sé-ri-e)
// counted as two (Q27). en counts vowel groups with the usual silent-e, -ed and -es
// rules, splits a few vowel pairs, and consults a map of irregular words first.

import type { LensLang } from "./types";

const MEMO_LIMIT = 50000;
const memo: Record<LensLang, Map<string, number>> = { en: new Map(), "pt-BR": new Map() };

/** For tests. */
export function clearSyllableMemo(): void {
  memo.en.clear();
  memo["pt-BR"].clear();
}

/** Syllables in one token: 1 or more for a token with letters, 0 for one without. Memoized per language (bounded). */
export function syllables(word: string, lang: LensLang): number {
  const bucket = memo[lang];
  const hit = bucket.get(word);
  if (hit !== undefined) return hit;
  const n = countSyllables(word, lang);
  if (bucket.size >= MEMO_LIMIT) bucket.clear();
  bucket.set(word, n);
  return n;
}

function countSyllables(word: string, lang: LensLang): number {
  const w = word.normalize("NFC").toLowerCase().replace(/[’]/g, "'");
  let total = 0;
  for (const part of w.split(/[-‐‑–—]/)) {
    if (!/\p{L}/u.test(part)) continue;
    total += lang === "en" ? enWord(part) : ptWord(part);
  }
  return total;
}

// ---------------------------------------------------------------- pt-BR

const PT_VOWELS = "aeiouáàâãéêíóôõú";
const PT_STRONG = "aeoáàâãéêóôõ";
const isPtVowel = (c: string | undefined): boolean => c !== undefined && PT_VOWELS.includes(c);
const ptBase = (c: string): string => c.normalize("NFD").charAt(0);

function ptWord(raw: string): number {
  let w = raw.replace(/[^\p{L}]/gu, "");
  // qu / gu: silent before e, i; a consonant-like glide before a, o (no extra syllable).
  w = w.replace(/([qg])u(?=[eéêiíî])/g, "$1");
  w = w.replace(/([qg])u(?=[aáâãoóô])/g, "$1w");

  let total = 0;
  const re = /[aeiouáàâãéêíóôõú]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(w))) {
    const run = m[0];
    const start = m.index;
    let n = 1;
    for (let i = 1; i < run.length; i++) {
      if (ptBoundary(run, i, start, w)) n++;
    }
    total += n;
  }
  return Math.max(1, total);
}

function ptBoundary(run: string, i: number, start: number, w: string): boolean {
  const x = run[i - 1];
  const y = run[i];
  if (ptBase(x) === ptBase(y)) return true;                       // identical vowels: voo, leem
  if (y === "í" || y === "ú" || x === "í" || x === "ú") return true; // accented hiatus
  const xStrong = PT_STRONG.includes(x);
  const yStrong = PT_STRONG.includes(y);
  if (xStrong && yStrong) {
    // nasal diphthongs ão, õe, ãe stay together
    if ((x === "ã" || x === "õ") && (y === "o" || y === "e")) return false;
    return true;                                                  // two strong vowels
  }
  const yPos = start + i;
  if (xStrong) return ptClosed(w, yPos);                          // falling diphthong, unless closed
  // x is a weak i or u
  if (!yStrong) return ptClosed(w, yPos);                         // ui, iu
  // weak + strong
  if (i === 1) return start > 0;                                  // rising after a consonant counts 2 (Q27)
  return true;                                                    // diphthong then a vowel: vei-o, mai-o
}

/** The i or u at `pos` is closed by r l z m n (or nh) with no vowel after: ra-iz, ca-ir, a-in-da, mo-i-nho. */
function ptClosed(w: string, pos: number): boolean {
  const c = w[pos + 1];
  if (c === undefined || !"rlzmn".includes(c)) return false;
  return !isPtVowel(w[pos + 2]);
}

// ---------------------------------------------------------------- en


/** Irregular words the rules get wrong, with their dictionary counts. */
const EN_IRREGULAR: Readonly<Record<string, number>> = {
  // vowel pairs that split
  quiet: 2, diet: 2, riot: 2, science: 2, client: 2, audience: 3, experience: 4,
  society: 4, variety: 4, anxiety: 4, poem: 2, poet: 2, poetry: 3, lion: 2,
  ruin: 2, fluid: 2, create: 2, created: 3, creation: 3, react: 2, realize: 3,
  reality: 4, real: 1, idea: 3, area: 3, theater: 3, people: 2, brilliant: 2,
  hideous: 3, spontaneous: 4, being: 2, seeing: 2, doing: 2, going: 2,
  // compounds and silent letters
  something: 2, someone: 2, sometimes: 2, nothing: 2, anything: 3, everything: 3,
  evening: 2, homework: 2, sidewalk: 2, business: 2, colonel: 2, naked: 2,
  wicked: 2, hundred: 2, sacred: 2, isle: 1, aisle: 1, eye: 1, eyes: 1, eyed: 1,
  every: 2, family: 3, camera: 3, different: 3, comfortable: 4, chocolate: 2,
  fire: 1, hour: 1, flower: 2, our: 1, towel: 2, power: 2, tower: 2, shower: 2,
  fuel: 2, cruel: 2, jewel: 2, poor: 1, lower: 2, higher: 2, wire: 1, tired: 1,
  // common irregulars
  the: 1, are: 1, were: 1, one: 1, once: 1, two: 1, who: 1, whose: 1, you: 1,
  your: 1, their: 1, heir: 1, they: 1, said: 1, says: 1, again: 2, against: 2,
  because: 2, beautiful: 3, beauty: 2, lovely: 2, friend: 1, friends: 1,
  queue: 1, league: 1, tongue: 1, rhythm: 2, rhythms: 2, prism: 2, chasm: 2,
  spasm: 2, orange: 2, average: 3, interest: 3, interesting: 4, vegetable: 4,
  temperature: 4, restaurant: 3, medicine: 3, library: 3, february: 4, wednesday: 2,
  mischievous: 3, usually: 4, probably: 3, generally: 4, actually: 4, finally: 3,
  especially: 4, immediately: 5, definitely: 4, separately: 4, unfortunately: 5,
  ocean: 2, giant: 2, diamond: 3, violet: 3, quiz: 1, quizzes: 2, ahead: 2,
  oven: 2, evil: 2, devil: 2, level: 2, travel: 2, cousin: 2, pretty: 2, woman: 2,
  women: 2, bury: 2, busy: 2, island: 2, iron: 2, heaven: 2, seven: 2, eleven: 3,
  gigantic: 4, behaviour: 3, behavior: 3, rarely: 2, sincerely: 3,
  drawer: 1, drawers: 1, fiery: 3, theory: 3, theories: 3,
};

function enWord(raw: string): number {
  let w = raw.replace(/'s$/, "").replace(/'(ll|d|ve|re|m)$/, "");
  let extra = 0;
  const nt = /([a-z]*)n't$/.exec(w);
  if (nt) {
    w = nt[1];
    if (/[dzs]$/.test(w)) extra = 1;            // didn't, doesn't, isn't, wasn't
  }
  w = w.replace(/[^a-z]/g, "");
  if (w === "") return /\p{L}/u.test(raw) ? 1 : 0;
  const known = EN_IRREGULAR[w];
  if (known !== undefined) return known + extra;
  return enCount(w) + extra;
}

function enCount(w: string): number {
  // "-ing": the stem's count plus one when the stem has a vowel (go-ing, be-ing, hop-ing).
  if (w.length > 4 && w.endsWith("ing")) {
    const stem = w.slice(0, -3);
    if (/[aeiouy]/.test(stem)) return Math.max(1, enBody(stem, false)) + 1;
  }
  return Math.max(1, enBody(w, true));
}

/** Counts vowel groups of a word after the silent-letter rules. */
function enBody(word: string, final: boolean): number {
  let w = word;
  let bonus = 0;

  // qu and gu: u acts as a consonant before a vowel (a final -gue or -que then loses its e)
  w = w.replace(/([qg])u(?=[aeiouy])/g, "$1w");

  // -ed: silent unless after t or d; syllabic -led after a consonant (settled, handled).
  if (final && w.length > 3 && w.endsWith("ed") && !/[td]ed$/.test(w)) {
    const stem = w.slice(0, -2);
    if (/[^aeiouyrl]l$/.test(stem)) bonus++;
    w = stem;
  } else if (final && w.endsWith("es") && w.length > 3) {
    if (/([sxz]|[cs]h)es$/.test(w) || /[cgsz]es$/.test(w)) {
      // the -es is a syllable: boxes, dishes, places, judges, roses
    } else if (/[^aeiouyl]les$/.test(w)) {
      w = w.slice(0, -1);                       // tables: handled by -le below
    } else {
      w = w.slice(0, -2);                       // hopes, tides, babies, knives
    }
  }

  // silent e before a consonant suffix: lovely, careful, careless, movement, kindness
  w = w.replace(/([^aeiouyl])e(ly|ful|less|ment|ments|ness)$/, "$1$2");

  // final -e
  if (final || w !== word) {
    if (w.length > 2 && w.endsWith("e") && !/[^aeiouy]le$/.test(w) && !/[aeiouy]e$/.test(w)) {
      w = w.slice(0, -1);
    }
  }

  // -sm / -thm: syllabic m (prism, rhythm handled by map)
  if (/[^aeiouy]sm$/.test(w) || /thm$/.test(w)) bonus++;

  // y is a consonant before a vowel at the start or after a vowel
  w = w.replace(/(^|[aeiou])y(?=[aeiou])/g, "$1Y");

  let total = bonus;
  const re = /[aeiouy]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(w))) {
    const g = m[0];
    const at = m.index;
    let n = 1;
    for (let i = 1; i < g.length; i++) {
      if (enSplit(g, i, w, at)) n++;
    }
    total += n;
  }
  return total;
}

/** Does the vowel pair g[i-1] g[i] split into two syllables? */
function enSplit(g: string, i: number, w: string, at: number): boolean {
  const pair = g[i - 1] + g[i];
  const before = i >= 2 ? g[i - 2] : w[at - 1];
  const after = g[i + 1] ?? w[at + g.length];
  switch (pair) {
    case "ia":
      // special, social, partial, musician merge; giant, trial, denial, piano split
      return !(i === 1 && before !== undefined && /[tcs]/.test(before) && (after === "l" || after === "n"));
    case "io":
      if (after === "u") return !(before !== undefined && /[cgstx]/.test(before)); // ious
      if (after === "n") return false;                                       // tion, sion, onion, million
      return true;                                                           // radio, violin, period
    case "eo":
      return after !== "u";                                                  // video, theory; courageous merges
    case "ua":
    case "uo":
      return true;                                                           // usual, actual, duo
    case "iu":
      return after === "m";                                                  // stadium, medium
    default:
      return false;
  }
}
