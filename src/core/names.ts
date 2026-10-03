// The names matcher (0.7 plan Q22-Q29, U 1.1 and U 1.4). Pure: no Obsidian imports.
// Stubs until 1.2, except foldName. Accents are folded before stemming (Q23): Inês
// and Ines are one key.

import { normalizeWord, type StemLang, type StemProfile } from "./stem";

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

export interface TermTable { terms: readonly NameTerm[]; lang: StemLang | null; signature: string }

/** `exact`: the occurrence's foldName form equals the term's. */
export interface Candidate { id: string; exact: boolean; origin: TermOrigin }

export interface Occurrence { from: number; to: number; text: string; candidates: readonly Candidate[] }

export function matchLang(setting: "auto" | "pt-BR" | "en", locale: string): StemLang | null {
  throw new Error("todo");
}

/** `extraTitles` is the `nameTitles` setting; the built-in tables (core/name-titles.ts) are picked by `lang` (both when null). */
export function compileTerms(
  sources: readonly NameSource[],
  o: { lang: StemLang | null; extraTitles: readonly string[] },
): TermTable {
  throw new Error("todo");
}

/** Over a mask whose offsets match the document (readerMask). Ignore phrases suppress their span. */
export function findNames(mask: string, table: TermTable, from?: number, to?: number): Occurrence[] {
  throw new Error("todo");
}

/** Q26: filter to the note's scope, exact form first, explicit beats first name; null when still ambiguous. */
export function pickEntry(o: Occurrence, inScope: (id: string) => boolean): string | null {
  throw new Error("todo");
}

/** For the lens (Q38). */
export function capitalizedTerms(table: TermTable): string[] {
  throw new Error("todo");
}

export const EMPTY_TABLE: TermTable = Object.freeze({ terms: [], lang: null, signature: "" });
