// Pure helpers for the "Names" rows of the universe settings (0.7 task 4.5; no Obsidian
// imports): which built-in titles to name in the extra titles description.

import { matchLang } from "../core/names";
import { NAME_TITLES } from "../core/name-titles";

const lower = (list: readonly string[]): string => list.map((x) => x.toLowerCase()).join(", ");

/**
 * The built-in titles for the writing language, as the description names them:
 * Portuguese gives its own table and then the English one in brackets; English gives
 * its own; an unknown language gives both, Portuguese first. `also` wraps the English
 * list ("(and {list} in English)").
 */
export function builtinTitlesText(
  language: "auto" | "pt-BR" | "en",
  locale: string,
  also: (list: string) => string,
): string {
  const lang = matchLang(language, locale);
  if (lang === "en") return lower(NAME_TITLES.en);
  return `${lower(NAME_TITLES.pt)} ${also(lower(NAME_TITLES.en))}`;
}
