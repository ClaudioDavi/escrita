// The default sets in the writer's language (1.0, SF 10; PLAN-1.0 Q1, Q2). Pure data and
// functions, no Obsidian imports: settings.ts builds `defaultsFor` on top of this file, and
// the setup reads `SETUP_NAMES`.
//
// What a set holds: the word-bearing settings only, the words Escrita writes into notes or
// reads as folder and note names (stage words, folders, unnumbered titles, submission
// results, the universe's words). Everything else, numbers and switches included, is the
// same in every language and comes from DEFAULT_SETTINGS.
//
// What a set never holds: property NAMES (`status`, `target`, `type`…). They are keys in
// the writer's notes and stay English in both sets; a pt-BR vault with `status: rascunho`
// is the author's own. Rule 6 holds: every value here is still a setting the writer can
// change, and the author's values live in their data.json.
//
// Which set an install uses is the setting `defaultsLanguage` (PLAN-1.0, "Q1 as built"):
// a saved settings object without the key is "en" (a 0.9 install keeps every English
// default it relies on, and nothing has to be written for it); a fresh install takes
// `languageOf(locale())` once and saves it, so the set never moves when Obsidian's
// language changes later. Loading (task 1.4) is `mergeDefaults(defaultsFor(lang), saved)`
// and `normalizeSettings` restores a blank field from the same set.

import type { EscritaSettings } from "../settings";
import { DEFAULT_STAGES, STAGES, type StageMapping } from "./stages";
import { ENTRY_KINDS, type EntryKind, type EntryTypeSetting } from "../universe/settings";

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
 * Where the language is read (the contract's call): from `locale()` in i18n.ts, that is
 * `moment.locale()`, which Obsidian sets to its interface language at startup on every
 * version Escrita supports. `getLanguage()` is the official call but needs Obsidian
 * 1.8.7, and `minAppVersion` is 1.7.2; when the minimum reaches 1.8.7, the call site
 * switches to `getLanguage()` and this function stays as it is. An empty or missing
 * value (moment not set yet, a test) gives "en", the fallback.
 */
export function languageOf(obsidianLanguage: string | null | undefined): DefaultsLanguage {
  const l = typeof obsidianLanguage === "string" ? obsidianLanguage.trim().toLowerCase().replace(/_/g, "-") : "";
  return l === "pt" || l.startsWith("pt-") ? "pt-BR" : "en";
}

/**
 * The word-bearing settings, the keys every set lists (tests/defaults.test.ts checks that
 * both sets list exactly these, and that the "en" set equals DEFAULT_SETTINGS on each).
 *
 * Beyond the list in PLAN-1.0 (0.1), three more keys are word-bearing and in the sets:
 * `threadKeyword` (it pairs with `threadClosedWord`: `%% fio fechado: … %%`, never
 * `%% thread fechado`), the entry type `value`s and `formValues` (values written into
 * notes, like the stage words; the author's vault uses `personagem` and `conto`).
 * Left out on purpose, same in both languages: `snapshotsFolder` (Escrita's own storage
 * under `Escrita/`, never browsed, and classify falls back to its English constant),
 * `excludeFolders` (the setup never writes it), `placeholderMarker` (`XXX` is no word),
 * `epubSceneBreak`, and every property name.
 * `darlingsNote` and `globalDarlingsNote` are listed with the same value in both sets:
 * the pt-BR interface calls them "darlings" too.
 */
export const WORD_KEYS = [
  "stages", "chaptersFolder", "unnumberedTitles", "submissionResults", "exportFolder", "submissionsFolder",
  "darlingsNote", "globalDarlingsNote", "universeNote", "entryTypes", "formValues", "threadKeyword", "threadClosedWord",
] as const;
export type WordKey = typeof WORD_KEYS[number];

/** One language's set: every word-bearing key, complete (nested records too). */
export type LanguageDefaults = Pick<EscritaSettings, WordKey>;

/** The stage colours are the same in every set (DEFAULT_STAGES); only the words change. */
function stages(words: Record<keyof StageMapping, string>): StageMapping {
  const out = {} as StageMapping;
  for (const k of STAGES) out[k] = { words: words[k], color: DEFAULT_STAGES[k].color };
  return out;
}

function entries(t: Record<EntryKind, [value: string, folder: string, label: string]>): Record<EntryKind, EntryTypeSetting> {
  const out = {} as Record<EntryKind, EntryTypeSetting>;
  for (const k of ENTRY_KINDS) out[k] = { value: t[k][0], folder: t[k][1], template: "", label: t[k][2] };
  return out;
}

const EN: LanguageDefaults = {
  stages: stages({ idea: "idea", draft: "draft", revision: "revision", ready: "ready", published: "published" }),
  chaptersFolder: "Chapters",
  unnumberedTitles: "Prologue, Preface, Foreword, Introduction, Interlude, Epilogue, Afterword",
  submissionResults: "pending, accepted, rejected, withdrawn",
  exportFolder: "Escrita/Exports",
  submissionsFolder: "Escrita/Submissions",
  darlingsNote: "Darlings.md",
  globalDarlingsNote: "Darlings.md",
  universeNote: "Universe.md",
  entryTypes: entries({
    character: ["character", "Characters", "Character"],
    place: ["place", "Places", "Place"],
    object: ["object", "Objects", "Object"],
    group: ["group", "Groups", "Group"],
    event: ["event", "Events", "Event"],
  }),
  formValues: { shortStory: "short story", essay: "essay", novella: "novella", novel: "novel", poem: "poem", fragment: "fragment" },
  threadKeyword: "thread",
  threadClosedWord: "closed",
};

/** Brazilian Portuguese (never European: "versão", "envios", "rascunho"). */
const PT_BR: LanguageDefaults = {
  stages: stages({ idea: "ideia", draft: "rascunho", revision: "revisão", ready: "pronto", published: "publicado" }),
  chaptersFolder: "Capítulos",
  // SF 10 names "Nota do autor"; the rest mirror the English list
  unnumberedTitles: "Prólogo, Prefácio, Apresentação, Introdução, Nota do autor, Interlúdio, Epílogo, Posfácio",
  // the first word is "pending" (submissions/logic): pendente
  submissionResults: "pendente, aceito, recusado, retirado",
  exportFolder: "Escrita/Exportações",
  submissionsFolder: "Escrita/Envios",
  darlingsNote: "Darlings.md",
  globalDarlingsNote: "Darlings.md",
  universeNote: "Universo.md",
  entryTypes: entries({
    character: ["personagem", "Personagens", "Personagem"],
    place: ["lugar", "Lugares", "Lugar"],
    object: ["objeto", "Objetos", "Objeto"],
    group: ["grupo", "Grupos", "Grupo"],
    event: ["evento", "Eventos", "Evento"],
  }),
  formValues: { shortStory: "conto", essay: "ensaio", novella: "novela", novel: "romance", poem: "poema", fragment: "fragmento" },
  threadKeyword: "fio",
  threadClosedWord: "fechado",
};

function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    for (const x of Object.values(v as Record<string, unknown>)) deepFreeze(x);
    Object.freeze(v);
  }
  return v;
}

/** The sets, frozen: read them, never hand them to live settings (use `overlayDefaults`). */
export const LANGUAGE_DEFAULTS: Readonly<Record<DefaultsLanguage, Readonly<LanguageDefaults>>> = deepFreeze({ en: EN, "pt-BR": PT_BR });

/**
 * `base` with one language's set laid over it: a complete, fresh settings object that
 * shares no object or array with `base` or the frozen sets, so live settings can be
 * mutated freely. `base` is DEFAULT_SETTINGS in practice (`defaultsFor` in settings.ts);
 * it is a parameter so this file needs no value import from settings.ts (settings.ts
 * imports this file: the other direction would be a cycle, and would pull Obsidian into
 * every test that reads the sets).
 */
export function overlayDefaults(base: EscritaSettings, lang: DefaultsLanguage): EscritaSettings {
  const set = LANGUAGE_DEFAULTS[isDefaultsLanguage(lang) ? lang : "en"];
  const out = { ...base } as Record<string, unknown>;
  // copy every nested value of the base first (stages may be the frozen DEFAULT_STAGES)
  for (const [k, v] of Object.entries(out)) {
    if (Array.isArray(v)) out[k] = [...v];
    else if (v && typeof v === "object") out[k] = cloneRecord(v as Record<string, unknown>);
  }
  for (const k of WORD_KEYS) {
    const v = set[k] as unknown;
    out[k] = v && typeof v === "object" ? cloneRecord(v as Record<string, unknown>) : v;
  }
  return out as unknown as EscritaSettings;
}

/** Two levels deep, enough for stages, entryTypes, formValues and features. */
function cloneRecord(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    out[k] = Array.isArray(v) ? [...v] : v && typeof v === "object" ? { ...(v as Record<string, unknown>) } : v;
  }
  return out;
}

/**
 * The names the setup gives what it creates (boards 35-37), per language. Not settings:
 * the setup writes `homeNote` and the track folders from these, and the writer may rename
 * everything after. `homeNote` is not in the sets above because its default stays ""
 * (no home note) until the setup or the writer sets one.
 */
export interface SetupNames {
  /** vault path of the home note the setup creates */
  homeNote: string;
  /** the folder for contos and essays ("What do you write?": short fiction or both) */
  storiesFolder: string;
  /** the folder for books, one per subfolder (a novel or both) */
  booksFolder: string;
  /** every example's name starts with this; examples also carry `example: true` */
  examplePrefix: string;
  /** the example conto's basename (no `.md`), in `storiesFolder` */
  exampleStory: string;
  /** the example book's folder and book note basename, in `booksFolder` */
  exampleBook: string;
}

export const SETUP_NAMES: Readonly<Record<DefaultsLanguage, Readonly<SetupNames>>> = deepFreeze({
  en: {
    homeNote: "Home.md",
    storiesFolder: "Stories",
    booksFolder: "Books",
    examplePrefix: "Example · ",
    exampleStory: "Example · The crossing",
    exampleBook: "Example · The lighthouse",
  },
  "pt-BR": {
    homeNote: "Início.md",
    storiesFolder: "Contos",
    booksFolder: "Livros",
    examplePrefix: "Exemplo · ",
    exampleStory: "Exemplo · A travessia",
    exampleBook: "Exemplo · O farol",
  },
});

