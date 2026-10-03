// Stemming for echoes, name variants and (later) the shared universe.
// One function, two profiles (0.5 plan Q1, Q4, Q5). Written by hand from the
// published algorithms (Orengo & Huyck 2001, Porter2); no library, no copied lists.

import { stemEn } from "./en";
import { stemPt } from "./pt";

export type StemLang = "pt" | "en";
export type StemProfile = "word" | "name";

const MEMO_LIMIT = 20000;
const memo = new Map<string, Map<string, string>>();

/** NFC, lowercase (no locale), ’ → '. What every stem call starts from. */
export function normalizeWord(word: string): string {
  return word.normalize("NFC").toLowerCase().replace(/’/g, "'");
}

/**
 * NFC, lowercase, ’ → ', then the language's steps. An opaque key: compare for equality only.
 * The key is case-folded: a case-sensitive caller compares the raw token's casing first
 * and uses stem only for inflection.
 */
export function stem(word: string, lang: StemLang, profile: StemProfile = "word"): string {
  const bucketKey = `${lang}:${profile}`;
  let bucket = memo.get(bucketKey);
  if (!bucket) {
    bucket = new Map();
    memo.set(bucketKey, bucket);
  }
  const hit = bucket.get(word);
  if (hit !== undefined) return hit;
  const w = normalizeWord(word);
  const out = lang === "pt" ? stemPt(w, profile) : stemEn(w, profile);
  if (bucket.size >= MEMO_LIMIT) bucket.clear();
  bucket.set(word, out);
  return out;
}

/** For tests. */
export function clearStemCache(): void {
  memo.clear();
}
