// The names matcher (0.7 plan Q22-Q29, U 1.2 "Appears in" and U 1.4). Pure: no
// Obsidian imports. Accents are folded before stemming (Q23): Inês and Ines are one key.

import { NAME_TITLES } from "./name-titles";
import { isStopWord } from "./stem/stopwords";
import { normalizeWord, stem, type StemLang, type StemProfile } from "./stem";
import { tokens } from "./tokens";

/**
 * The one accent fold for names (Q23): NFC, lowercase, ’ → ' (normalizeWord), then
 * NFD, drop combining marks, NFC, trim. "Inês" and "Ines" give "ines". The matcher
 * folds every word before stemming (key = stem(foldName(word))), and every exact
 * comparison of names (Candidate.exact, NamesProvider.entryFor, POV keys) compares
 * foldName forms.
 */
export function foldName(s: string): string {
  return normalizeWord(s).normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC").trim();
}

export interface NameSource {
  id: string;                        // the entry path
  name: string;                      // the file's basename
  aliases: readonly string[];
  person: boolean;                   // a character: first-name alias allowed
  firstName: boolean;                // the per-entry option (default true)
  caseSensitive: boolean;
  ignore: readonly string[];
}

export type TermOrigin = "name" | "alias" | "first";

export interface NameTerm {
  id: string;
  text: string;
  words: readonly string[];
  keys: readonly string[];
  profile: StemProfile;
  origin: TermOrigin;
  caseSensitive: boolean;
}

/** An `ignore` phrase of an entry: occurrences wholly inside its span are dropped. */
export interface IgnorePhrase { id: string; words: readonly string[]; keys: readonly string[]; profile: StemProfile }

export interface TermTable {
  terms: readonly NameTerm[];
  lang: StemLang | null;
  signature: string;
  ignores?: readonly IgnorePhrase[];
}

/** `exact`: the occurrence's foldName form equals the term's. */
export interface Candidate { id: string; exact: boolean; origin: TermOrigin }

export interface Occurrence { from: number; to: number; text: string; candidates: readonly Candidate[] }

export function matchLang(setting: "auto" | "pt-BR" | "en", locale: string): StemLang | null {
  if (setting === "pt-BR") return "pt";
  if (setting === "en") return "en";
  const code = (locale ?? "").trim().toLowerCase().split(/[-_]/)[0];
  if (code === "pt") return "pt";
  if (code === "en") return "en";
  return null;
}

const RANK: Record<TermOrigin, number> = { name: 0, alias: 1, first: 2 };

const isUpper = (s: string): boolean => {
  const c = s.charAt(0);
  return c !== c.toLowerCase() && c === c.toUpperCase();
};

/** Q22: by the term's capital letter. */
const profileOf = (text: string): StemProfile => (isUpper(text) ? "name" : "word");

function wordKey(folded: string, lang: StemLang | null, profile: StemProfile): string {
  if (lang === null) return folded;
  return `${profile}:${stem(folded, lang, profile)}`;
}

/** Q25: a hyphenated word is its parts (both in a term and in the text), unless a part has an apostrophe. */
function splitHyphen(w: string): string[] {
  const parts = w.split("-");
  return parts.length > 1 && parts.every((p) => p.length > 0 && !/['’]/.test(p)) ? parts : [w];
}

/** Letters without accents, case kept: the comparison of a case-sensitive term (Q23). */
const stripAccents = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC").replace(/’/g, "'");

/** The name titles ("Dona", "Dr"), normalized: the built-in tables for `lang` (both when null) plus the writer's extras (trailing dots dropped, blanks skipped). */
export function titleSet(lang: StemLang | null, extra: readonly string[]): Set<string> {
  const out = new Set<string>();
  const langs: StemLang[] = lang ? [lang] : ["pt", "en"];
  for (const l of langs) for (const t of NAME_TITLES[l]) out.add(normalizeWord(t));
  for (const t of extra) {
    const f = normalizeWord(t.replace(/\.+$/, "")).trim();
    if (f) out.add(f);
  }
  return out;
}

/** `extraTitles` is the `nameTitles` setting; the built-in tables (core/name-titles.ts) are picked by `lang` (both when null). */
export function compileTerms(
  sources: readonly NameSource[],
  o: { lang: StemLang | null; extraTitles: readonly string[] },
): TermTable {
  const lang = o.lang;
  const titles = titleSet(lang, o.extraTitles);
  const byKey = new Map<string, NameTerm>();
  const ignores: IgnorePhrase[] = [];
  const seenIgnore = new Set<string>();

  const add = (id: string, text: string, origin: TermOrigin, caseSensitive: boolean): void => {
    const raw = tokens(text.normalize("NFC")).map((t) => t.text);
    if (raw.length === 0) return;
    if (raw.length === 1) {
      const w = raw[0];
      if (Array.from(w).length <= 1) return; // one letter (Q27)
      if (lang && isStopWord(normalizeWord(w), lang)) return;
    }
    const words = raw.flatMap(splitHyphen);
    const profile = profileOf(words[0]);
    const keys = words.map((w) => wordKey(foldName(w), lang, profile));
    const term: NameTerm = { id, text: raw.join(" "), words, keys, profile, origin, caseSensitive };
    const k = `${id}\u0000${profile}\u0000${caseSensitive}\u0000${caseSensitive ? words.join(" ") : words.map(foldName).join(" ")}\u0000${keys.join(" ")}`;
    const had = byKey.get(k);
    if (!had || RANK[origin] < RANK[had.origin]) byKey.set(k, term);
  };

  for (const src of sources) {
    add(src.id, src.name, "name", src.caseSensitive);
    for (const a of src.aliases) add(src.id, a, "alias", src.caseSensitive);
    if (src.person && src.firstName) {
      const words = tokens(src.name.normalize("NFC")).map((t) => t.text);
      let i = 0;
      while (i < words.length && titles.has(normalizeWord(words[i]))) i++;
      const rest = words.slice(i);
      if (rest.length >= 2) add(src.id, rest[0], "first", src.caseSensitive);
      if (i > 0 && rest.length >= 1) add(src.id, rest.join(" "), "first", src.caseSensitive);
    }
    for (const phrase of src.ignore) {
      const words = tokens(phrase.normalize("NFC")).flatMap((t) => splitHyphen(t.text));
      if (words.length === 0) continue;
      const profile = profileOf(words[0]);
      const keys = words.map((w) => wordKey(foldName(w), lang, profile));
      const k = `${src.id}\u0000${profile}\u0000${keys.join(" ")}`;
      if (seenIgnore.has(k)) continue;
      seenIgnore.add(k);
      ignores.push({ id: src.id, words, keys, profile });
    }
  }

  const terms = [...byKey.values()];
  const sig = (t: NameTerm): string =>
    [t.id, t.origin, t.profile, t.caseSensitive ? "cs" : "ci", t.words.map((w) => (t.caseSensitive ? w : foldName(w))).join(" "), t.keys.join(" ")].join("|");
  const termSigs = terms.map(sig).sort();
  const ignoreSigs = ignores.map((g) => `${g.id}|${g.profile}|${g.keys.join(" ")}`).sort();
  const signature = [lang ?? "none", ...termSigs, "--", ...ignoreSigs].join("\n");
  return { terms, lang, signature, ignores };
}

// Words of the text, hyphenated words split into parts that remember their group (Q25).
interface Unit { from: number; to: number; text: string; folded: string; group: number }

interface Matchable { words: readonly string[]; keys: readonly string[]; profile: StemProfile; caseSensitive: boolean }

interface Index {
  byFirst: Map<string, NameTerm[]>;
  ignoreByFirst: Map<string, IgnorePhrase[]>;
}

const indexes = new WeakMap<TermTable, Index>();

function indexOf(table: TermTable): Index {
  let ix = indexes.get(table);
  if (ix) return ix;
  ix = { byFirst: new Map(), ignoreByFirst: new Map() };
  for (const t of table.terms) {
    const k = t.keys[0];
    const l = ix.byFirst.get(k);
    if (l) l.push(t);
    else ix.byFirst.set(k, [t]);
  }
  for (const g of table.ignores ?? []) {
    const k = g.keys[0];
    const l = ix.ignoreByFirst.get(k);
    if (l) l.push(g);
    else ix.ignoreByFirst.set(k, [g]);
  }
  indexes.set(table, ix);
  return ix;
}

// Module-level caches (IMPROVEMENTS 22): a word folds and stems the same way on every call.
// Each map is cleared when it reaches CACHE_LIMIT entries, so memory stays bounded.
const CACHE_LIMIT = 50_000;
const foldCache = new Map<string, string>();
const keyCaches = new Map<string, Map<string, string>>();

function foldCached(w: string): string {
  let f = foldCache.get(w);
  if (f === undefined) {
    if (foldCache.size >= CACHE_LIMIT) foldCache.clear();
    f = foldName(w);
    foldCache.set(w, f);
  }
  return f;
}

function keyCacheFor(lang: StemLang | null, profile: StemProfile): Map<string, string> {
  const id = `${lang ?? "none"}:${profile}`;
  let m = keyCaches.get(id);
  if (!m) {
    m = new Map();
    keyCaches.set(id, m);
  }
  return m;
}

/** Sizes of the matcher's caches, for the bounded-memory test. */
export function namesCacheStats(): { fold: number; keys: number } {
  let keys = 0;
  for (const m of keyCaches.values()) keys += m.size;
  return { fold: foldCache.size, keys };
}

/** Empties the matcher's caches (tests). */
export function clearNamesCaches(): void {
  foldCache.clear();
  keyCaches.clear();
}

const GAP = /^[ \t*_~=]*(?:\r?\n[ \t*_~=]*)?$/;

/** Over a mask whose offsets match the document (readerMask). Ignore phrases suppress their span. */
export function findNames(mask: string, table: TermTable, from = 0, to = mask.length): Occurrence[] {
  if (table.terms.length === 0) return [];
  const lang = table.lang;
  const ix = indexOf(table);

  const units: Unit[] = [];
  let group = 0;
  const fold = foldCached;
  for (const tk of tokens(mask, from, to)) {
    const folded = fold(tk.text);
    const parts = splitHyphen(tk.text);
    if (parts.length > 1) {
      group++;
      let at = tk.from;
      for (const p of parts) {
        units.push({ from: at, to: at + p.length, text: p, folded: fold(p), group });
        at += p.length + 1;
      }
    } else {
      units.push({ from: tk.from, to: tk.to, text: tk.text, folded, group: 0 });
    }
  }

  // Stem keys per word and profile, kept across calls.
  const nameKeys = keyCacheFor(lang, "name");
  const wordKeys = keyCacheFor(lang, "word");
  const keyOf = (u: Unit, profile: StemProfile): string => {
    const cache = profile === "name" ? nameKeys : wordKeys;
    let k = cache.get(u.folded);
    if (k === undefined) {
      if (cache.size >= CACHE_LIMIT) cache.clear();
      k = wordKey(u.folded, lang, profile);
      cache.set(u.folded, k);
    }
    return k;
  };
  const firstKeys = (u: Unit): string[] => {
    if (lang === null) return [u.folded];
    return [keyOf(u, "name"), keyOf(u, "word")];
  };

  // Case-sensitive: the same letters in the same case, accents ignored; the end may differ (inflection).
  const caseOk = (u: Unit, raw: string): boolean => {
    const a = stripAccents(u.text);
    const b = stripAccents(raw);
    const n = Math.min(a.length, b.length);
    return a.slice(0, n) === b.slice(0, n);
  };
  /** How many units a term matches from `i`, or 0. */
  const run = (t: Matchable, i: number): number => {
    const n = t.words.length;
    if (i + n > units.length) return 0;
    for (let k = 0; k < n; k++) {
      const u = units[i + k];
      if (k > 0) {
        const p = units[i + k - 1];
        if (!(u.group !== 0 && u.group === p.group) && !GAP.test(mask.slice(p.to, u.from))) return 0;
      }
      if (keyOf(u, t.profile) !== t.keys[k]) return 0;
      if (t.caseSensitive) {
        if (!caseOk(u, t.words[k])) return 0;
      } else if (t.profile === "name" && isUpper(t.words[k]) && !isUpper(u.text)) return 0; // G3: a capitalized word needs a capital
    }
    return n;
  };

  const spans: { from: number; to: number }[] = [];
  if (ix.ignoreByFirst.size) {
    for (let i = 0; i < units.length; i++) {
      for (const key of firstKeys(units[i])) {
        for (const g of ix.ignoreByFirst.get(key) ?? []) {
          const n = run({ ...g, caseSensitive: false }, i);
          if (n) spans.push({ from: units[i].from, to: units[i + n - 1].to });
        }
      }
    }
  }

  const out: Occurrence[] = [];
  for (let i = 0; i < units.length; ) {
    let best = 0;
    let hits: NameTerm[] = [];
    for (const key of firstKeys(units[i])) {
      for (const t of ix.byFirst.get(key) ?? []) {
        const n = run(t, i);
        if (n === 0) continue;
        if (n > best) {
          best = n;
          hits = [t];
        } else if (n === best) hits.push(t);
      }
    }
    if (best === 0) {
      i++;
      continue;
    }
    const first = units[i];
    const last = units[i + best - 1];
    const folded = units.slice(i, i + best).map((u) => u.folded).join(" ");
    const candidates: Candidate[] = [];
    const dup = new Set<string>();
    for (const t of hits) {
      const k = `${t.id}|${t.origin}|${t.words.map(foldName).join(" ") === folded}`;
      if (dup.has(k)) continue;
      dup.add(k);
      candidates.push({ id: t.id, exact: t.words.map(foldName).join(" ") === folded, origin: t.origin });
    }
    i += best;
    if (spans.some((s) => first.from >= s.from && last.to <= s.to)) continue;
    out.push({ from: first.from, to: last.to, text: mask.slice(first.from, last.to), candidates });
  }
  return out;
}

/** Q26: filter to the note's scope, exact form first, explicit beats first name; null when still ambiguous. */
export function pickEntry(o: Occurrence, inScope: (id: string) => boolean): string | null {
  let cs = o.candidates.filter((c) => inScope(c.id));
  if (cs.length === 0) return null;
  if (cs.some((c) => c.exact)) cs = cs.filter((c) => c.exact);
  if (cs.some((c) => c.origin !== "first")) cs = cs.filter((c) => c.origin !== "first");
  const ids = new Set(cs.map((c) => c.id));
  return ids.size === 1 ? cs[0].id : null;
}

/** For the lens (Q38): every term whose first letter is a capital, once. */
export function capitalizedTerms(table: TermTable): string[] {
  const out = new Set<string>();
  for (const t of table.terms) if (isUpper(t.text)) out.add(t.text);
  return [...out];
}

export const EMPTY_TABLE: TermTable = Object.freeze({ terms: [], lang: null, signature: "" });
