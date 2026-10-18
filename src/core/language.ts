// The default sets Escrita ships and how a language picks one (no Obsidian imports). Split
// from defaults.ts in 1.1.1 so the settings table can name a language without importing the sets.

/** The default sets Escrita ships. Order: the setup's language menu. */
export const DEFAULTS_LANGUAGES = ["en", "pt-BR"] as const;
export type DefaultsLanguage = typeof DEFAULTS_LANGUAGES[number];

export function isDefaultsLanguage(v: unknown): v is DefaultsLanguage {
  return typeof v === "string" && (DEFAULTS_LANGUAGES as readonly string[]).includes(v);
}

/**
 * The set for Obsidian's language: "pt-BR" for "pt", "pt-BR" and any other "pt-…" tag
 * (case and `_` ignored), else "en". Every Portuguese goes to pt-BR, as `lang()` in
 * i18n.ts does for the interface strings, so the defaults and the interface always
 * agree; Escrita has no European set (and its words are Brazilian on purpose).
 *
 * Where the language is read: from `locale()` in i18n.ts, that is Obsidian's
 * `getLanguage()` (since 1.0; `minAppVersion` is 1.13.0 since 1.0.3). An empty or missing value
 * (a test) gives "en", the fallback.
 */
export function languageOf(obsidianLanguage: string | null | undefined): DefaultsLanguage {
  const l = typeof obsidianLanguage === "string" ? obsidianLanguage.trim().toLowerCase().replace(/_/g, "-") : "";
  return l === "pt" || l.startsWith("pt-") ? "pt-BR" : "en";
}
