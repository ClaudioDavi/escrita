// The settings table (IMPROVEMENTS 53, 1.1.1; no Obsidian imports): one row per setting, with
// its English default, how a loaded value is cleaned (its kind), which features read it
// and, for the word-bearing keys, the pt-BR value. The default sets (core/defaults.ts), the
// settings defaults, the feature map of the settings tab and the load-time normalizer are all
// derived from this one table (PLAN-1.1.1, "Improvement: one settings table").
//
// This file may import only leaf core files and `EscritaSettings` as a type. Never
// `./classify` or `./defaults`: they import this file (an import cycle at load).
//
// `EscritaSettings` stays the interface (it keeps its JSDoc, unions and `extends`); the table is
// checked against it with `satisfies`, which rejects a missing row, an extra row and a default
// of the wrong type. It does not catch a missing member of an `enumOf` list: keep each list
// beside the union it mirrors.

import type { EscritaSettings } from "../settings";
import { DEFAULT_STAGES, STAGES, normalizeStages, type StageMapping } from "./stages";
import { cleanFeatures, type FeatureId } from "./features";
import { cleanWeekdays } from "./merge";
import { cleanFolder, cleanVaultFolder, listsPath, normalizeNotePath } from "./paths";
import { DEFAULT_FORM_PROPERTY, FORM_DEFAULTS, FORM_KINDS } from "./form";
import { ENTRY_KINDS, type EntryKind, type EntryTypeSetting } from "./entry-kinds";
import { DEFAULTS_LANGUAGES } from "./language";

/** Which features read a setting. Arrays and "always" rows are drawn by the tab; see `SETTING_FEATURES`. */
export type ReadBy = readonly FeatureId[] | "always" | "switch" | "universe";

export type KindName =
  | "word" | "property" | "trimmed" | "text" | "folder" | "optionalFolder" | "vaultFolder" | "templatePath"
  | "enum" | "bool" | "number" | "int" | "strings" | "custom";

/** How a loaded value is cleaned: `fallback` is the install's set value for the key. Must be idempotent. */
export interface Kind<V> {
  readonly kind: KindName;
  normalize(v: unknown, fallback: V): V;
}

type Lang<V> = { lang?: never; ptBR?: never } | { lang: "word" | "install"; ptBR: V };

/**
 * One setting. `lang: "word"` keys are in the language sets and offered by the setup (their
 * order is `WORD_KEYS` in core/defaults.ts); `"install"` keys are in the sets but only an install
 * takes them. Both need a `ptBR` value.
 */
export type Row<V> = { default: V; kind: Kind<V>; readBy: ReadBy } & Lang<V>;
export type SettingsSchema = { [K in keyof EscritaSettings]-?: Row<EscritaSettings[K]> };

// Kinds ----------------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const trimmedOr = (v: unknown, f: string): string => (typeof v === "string" && v.trim() !== "" ? v.trim() : f);

const kind = <V>(name: KindName, normalize: (v: unknown, f: V) => V): Kind<V> => ({ kind: name, normalize });

/** Trimmed text; blank or not a string gives the fallback. */
const word = kind<string>("word", trimmedOr);
/** A frontmatter property name: the same rule as `word`, but never language-bearing. */
const property = kind<string>("property", trimmedOr);
/** Trimmed text, blank kept on purpose; not a string gives the fallback. */
const trimmed = kind<string>("trimmed", (v, f) => (typeof v === "string" ? v.trim() : f));
/** Text kept as typed; not a string gives the fallback. */
const text = kind<string>("text", (v, f) => (typeof v === "string" ? v : f));
/** A folder that is never blank. */
const folder = kind<string>("folder", (v, f) => (typeof v === "string" ? cleanFolder(v) : "") || f);
/** A folder, blank kept (blank means "no folder"). */
const optionalFolder = kind<string>("optionalFolder", (v, f) => (typeof v === "string" ? cleanFolder(v) : f));
/** A vault folder that is never blank: classify's fuller rule (backslashes, repeated slashes). */
const vaultFolder = kind<string>("vaultFolder", (v, f) => (typeof v === "string" ? cleanVaultFolder(v) : "") || f);
/** A template note path: trimmed, no leading slash; not a string gives the fallback. */
const templatePath = kind<string>("templatePath", (v, f) => (typeof v === "string" ? v.trim().replace(/^\/+/, "").trim() : f));
const bool = kind<boolean>("bool", (v, f) => (typeof v === "boolean" ? v : f));
const number = kind<number>("number", (v, f) => (typeof v === "number" && Number.isFinite(v) ? v : f));
const strings = kind<string[]>("strings", (v, f) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [...f]));
const enumOf = <T extends string>(values: readonly T[]): Kind<T> =>
  kind<T>("enum", (v, f) => ((values as readonly unknown[]).includes(v) ? (v as T) : f));
/** A whole number clamped to min..max; not a number gives the fallback. */
const int = (min: number, max: number): Kind<number> =>
  kind<number>("int", (v, f) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : f));
const custom = <V>(normalize: (v: unknown, f: V) => V): Kind<V> => kind<V>("custom", normalize);
const entryTypes = custom<Record<EntryKind, EntryTypeSetting>>((v, f) => {
  const src = isRecord(v) ? v : {};
  const out = {} as Record<EntryKind, EntryTypeSetting>;
  for (const k of ENTRY_KINDS) {
    const e = isRecord(src[k]) ? src[k] : {};
    out[k] = {
      value: trimmedOr(e.value, f[k].value),
      folder: trimmedOr(e.folder, f[k].folder),
      template: typeof e.template === "string" ? e.template.trim() : "",
      label: trimmedOr(e.label, f[k].label),
    };
  }
  return out;
});

const formValues = custom<EscritaSettings["formValues"]>((v, f) => {
  const src = isRecord(v) ? v : {};
  const out = { ...f };
  for (const k of FORM_KINDS) out[k] = trimmedOr(src[k], f[k]);
  return out;
});

// Word-bearing helpers (moved from core/defaults.ts) -------------------------------------

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

// The table ------------------------------------------------------------------------------

const ALWAYS = "always" as const;
const SWITCH = "switch" as const;
const UNIVERSE = "universe" as const;

export const SETTINGS_SCHEMA = {
  // Books
  chaptersFolder: { default: "Chapters", kind: word, readBy: ALWAYS, lang: "word", ptBR: "Capítulos" },
  chapterTemplate: { default: "", kind: text, readBy: ALWAYS },
  templatesFolder: { default: "", kind: optionalFolder, readBy: ["templates", "universe"] },
  storiesFolder: { default: "", kind: optionalFolder, readBy: ALWAYS },
  storyTemplate: { default: "", kind: templatePath, readBy: ALWAYS },
  booksFolder: { default: "", kind: optionalFolder, readBy: ["outline"] },
  bookNoteTemplate: { default: "", kind: templatePath, readBy: ["outline"] },
  numberPadding: { default: 2, kind: number, readBy: ALWAYS },
  unnumberedTitles: {
    default: "Prologue, Preface, Foreword, Introduction, Interlude, Epilogue, Afterword", kind: trimmed, readBy: ["export", "outline"],
    lang: "word",
    // SF 10 names "Nota do autor"; the rest mirror the English list
    ptBR: "Prólogo, Prefácio, Apresentação, Introdução, Nota do autor, Interlúdio, Epílogo, Posfácio",
  },
  statusProperty: { default: "status", kind: property, readBy: ALWAYS },
  stages: {
    default: DEFAULT_STAGES, kind: custom<StageMapping>(normalizeStages), readBy: ALWAYS, lang: "word",
    ptBR: stages({ idea: "ideia", draft: "rascunho", revision: "revisão", ready: "pronto", published: "publicado" }),
  },
  otherStatusColors: { default: "", kind: text, readBy: ALWAYS },
  draftNewNotes: { default: true, kind: bool, readBy: ALWAYS },
  homeNote: { default: "", kind: trimmed, readBy: ["desk"] },
  openHomeOnStartup: { default: false, kind: bool, readBy: ["desk"] },
  openInWritingMode: { default: false, kind: bool, readBy: ["desk"] },
  summaryProperty: { default: "summary", kind: property, readBy: ALWAYS },

  // Goals
  dailyGoal: { default: 1000, kind: number, readBy: ["goals"] },
  dayEndsAt: { default: 0, kind: number, readBy: ["goals", "darlings", "snapshots", "publish"] },
  trackFolders: { default: "", kind: text, readBy: ALWAYS },
  excludeFolders: { default: "Templates", kind: text, readBy: ALWAYS, lang: "install", ptBR: "Modelos" },
  ignoreJumpsOver: { default: 1500, kind: number, readBy: ["goals"] },
  showStatusBar: { default: true, kind: bool, readBy: ["goals"] },
  explorerCounts: { default: true, kind: bool, readBy: SWITCH },
  explorerFolderTotals: { default: false, kind: bool, readBy: ["explorerCounts"] },
  explorerShowTarget: { default: false, kind: bool, readBy: ["explorerCounts"] },
  sprintMinutes: { default: 25, kind: number, readBy: ["goals"] },
  sprintTarget: { default: 500, kind: number, readBy: ["goals"] },
  targetProperty: { default: "target", kind: property, readBy: ALWAYS },
  limitProperty: { default: "limit", kind: property, readBy: ALWAYS },
  unitProperty: { default: "unit", kind: property, readBy: ALWAYS },
  deadlineProperty: { default: "deadline", kind: property, readBy: ALWAYS },
  goalProperty: { default: "goal", kind: property, readBy: ALWAYS },
  povProperty: { default: "pov", kind: property, readBy: ALWAYS },
  chapterTargetProperty: { default: "chapterTarget", kind: property, readBy: ALWAYS },
  features: { default: {}, kind: custom<EscritaSettings["features"]>((v) => cleanFeatures(v)), readBy: SWITCH },
  weekdaysOff: { default: [], kind: custom<number[]>((v) => cleanWeekdays(v)), readBy: ["goals"] },
  datesOff: { default: "", kind: text, readBy: ["goals"] },

  // Publishing
  dateProperty: { default: "date", kind: property, readBy: ["publish"] },
  recommendedProperties: { default: "description", kind: text, readBy: ["publish"] },

  // Export
  exportFolder: {
    default: "Escrita/Exports", kind: folder, readBy: ALWAYS,
    lang: "word", ptBR: "Escrita/Exportações",
  },
  compileProperty: { default: "compile", kind: property, readBy: ["export"] },
  dedicationProperty: { default: "dedication", kind: property, readBy: ["export"] },
  epigraphProperty: { default: "epigraph", kind: property, readBy: ["export"] },
  authorProperty: { default: "author", kind: property, readBy: ["export"] },
  authorName: { default: "", kind: trimmed, readBy: ["export"] },
  authorSurname: { default: "", kind: trimmed, readBy: ["export"] },
  contactLines: { default: "", kind: trimmed, readBy: ["export"] },
  chapterHeadingFormat: { default: "", kind: trimmed, readBy: ["export"] },
  coverProperty: { default: "cover", kind: property, readBy: ["export"] },
  // a blank scene break would vanish in the book: the default instead
  epubSceneBreak: { default: "* * *", kind: word, readBy: ["export"] },
  collectionProperty: { default: "contents", kind: property, readBy: ["export"] },

  // Screenplays
  screenplaySceneHeadings: { default: "INT, EXT, EST, INT./EXT, INT/EXT, I/E", kind: word, readBy: ["export", "screenplay"] },
  screenplayTransitions: {
    default: "TO:", kind: word, readBy: ["export", "screenplay"], lang: "word",
    // Brazilian scripts: CORTA PARA:, FUSÃO PARA: (SP 1); the English TO: stays for pasted scripts
    ptBR: "TO:, PARA:",
  },
  screenplayPage: { default: "letter", kind: enumOf<"letter" | "a4">(["letter", "a4"]), readBy: ["export"] },
  screenplaySceneNumbers: { default: false, kind: bool, readBy: ["export"] },
  screenplayMore: { default: "(MORE)", kind: word, readBy: ["export"], lang: "word", ptBR: "(MAIS)" },
  screenplayContinued: { default: "(CONT'D)", kind: word, readBy: ["export"], lang: "word", ptBR: "(CONT.)" },
  screenplayCredit: { default: "Written by", kind: word, readBy: ["export"], lang: "word", ptBR: "Roteiro de" },
  screenplaySourceProperty: { default: "source", kind: property, readBy: ["export"] },
  screenplayDraftDateProperty: { default: "draftDate", kind: property, readBy: ["export"] },

  // The screenplay editor (1.2, SP 2)
  screenplayFont: { default: "courier", kind: enumOf<"courier" | "theme">(["courier", "theme"]), readBy: ["screenplay"] },
  screenplayTimes: {
    default: "DAY, NIGHT, CONTINUOUS, LATER", kind: word, readBy: ["screenplay"], lang: "word",
    ptBR: "DIA, NOITE, CONTÍNUO, MAIS TARDE",
  },

  // Submissions
  submissionsFolder: {
    default: "Escrita/Submissions", kind: folder, readBy: ALWAYS,
    lang: "word", ptBR: "Escrita/Envios",
  },
  submissionResults: {
    default: "pending, accepted, rejected, withdrawn", kind: word, readBy: ["submissions"], lang: "word",
    // the first word is "pending" (submissions/logic): pendente
    ptBR: "pendente, aceito, recusado, retirado",
  },
  submissionWorkProperty: { default: "work", kind: property, readBy: ["submissions"] },
  submissionMarketProperty: { default: "market", kind: property, readBy: ["submissions"] },
  submissionSentProperty: { default: "sent", kind: property, readBy: ["submissions"] },
  submissionResultProperty: { default: "result", kind: property, readBy: ["submissions"] },
  submissionRespondedProperty: { default: "responded", kind: property, readBy: ["submissions"] },

  // Snapshots
  snapshotsFolder: { default: "Escrita/Snapshots", kind: vaultFolder, readBy: ["snapshots"], lang: "install", ptBR: "Escrita/Versões" },
  snapshotBeforeFirstEdit: { default: false, kind: bool, readBy: ["snapshots"] },
  snapshotsKeepAuto: { default: 20, kind: int(1, Infinity), readBy: ["snapshots"] },

  // Outline
  ghostBeats: { default: true, kind: bool, readBy: ["outline"] },

  // Placeholders
  placeholderMarker: { default: "XXX", kind: word, readBy: ["placeholders", "publish"] },
  showExplorerDots: { default: true, kind: bool, readBy: ["placeholders"] },

  // Threads
  threadKeyword: { default: "thread", kind: word, readBy: ["threads"], lang: "word", ptBR: "thread" },

  // Darlings: the pt-BR interface calls them "darlings" too
  darlingsNote: { default: "Darlings.md", kind: word, readBy: ["darlings"], lang: "word", ptBR: "Darlings.md" },
  globalDarlingsNote: { default: "Darlings.md", kind: word, readBy: ["darlings"], lang: "word", ptBR: "Darlings.md" },

  // Editor
  enterFlow: { default: false, kind: bool, readBy: ["typing"] },
  paragraphStyle: { default: "blank", kind: enumOf<EscritaSettings["paragraphStyle"]>(["single", "blank"]), readBy: ["typing", "dialogueFocus", "moveBlocks", "lens"] },
  smartTypography: { default: true, kind: bool, readBy: ["typing"] },
  typographyScope: { default: "books", kind: enumOf<EscritaSettings["typographyScope"]>(["books", "all"]), readBy: ["typing"] },
  quoteStyle: { default: "curly", kind: enumOf<EscritaSettings["quoteStyle"]>(["curly", "guillemets", "german", "off"]), readBy: ["typing", "dialogueFocus", "lens"] },
  dialogueDash: { default: true, kind: bool, readBy: ["typing"] },
  spellcheckOnDemand: { default: false, kind: bool, readBy: SWITCH },

  // Revision lens
  lensLanguage: { default: "auto", kind: enumOf<"auto" | "pt-BR" | "en">(["auto", "pt-BR", "en"]), readBy: ALWAYS },
  lensListsNote: { default: "", kind: custom<string>((v, f) => (typeof v === "string" ? listsPath(v) : f)), readBy: ["lens"] },
  lensEchoWindow: { default: 40, kind: int(10, 200), readBy: ["lens"] },
  lensLongSentence: { default: 45, kind: int(15, 200), readBy: ["lens"] },
  lensRulesOff: { default: [], kind: strings, readBy: ["lens"] },
  lensRulesOn: { default: [], kind: strings, readBy: ["lens"] },
  notNames: { default: "", kind: text, readBy: ["lens"] },
  lensSkipQuotes: { default: true, kind: bool, readBy: ["lens"] },
  lensShowDialogue: { default: true, kind: bool, readBy: ["lens"] },
  lensShowReadability: { default: true, kind: bool, readBy: ["lens"] },
  lensShowRhythm: { default: true, kind: bool, readBy: ["lens"] },

  // Language: shared core, no settings row in 1.0
  defaultsLanguage: { default: "en", kind: enumOf<"en" | "pt-BR">(DEFAULTS_LANGUAGES), readBy: ALWAYS },

  // Forms (core/form.ts): the form rule's settings, read by the classifier
  formProperty: { default: DEFAULT_FORM_PROPERTY, kind: property, readBy: ALWAYS },
  formValues: {
    default: FORM_DEFAULTS, kind: formValues, readBy: ALWAYS, lang: "word",
    ptBR: { shortStory: "conto", essay: "ensaio", novella: "novela", novel: "romance", poem: "poema", fragment: "fragmento", screenplay: "roteiro" },
  },
  formFolders: { default: "", kind: text, readBy: ALWAYS },

  // Universe (the universe module draws its own rows)
  universeMode: { default: "off", kind: enumOf<"off" | "perBook" | "universe">(["off", "perBook", "universe"]), readBy: UNIVERSE },
  universeNote: {
    default: "Universe.md", kind: custom<string>((v, f) => normalizeNotePath(trimmedOr(v, f), f)), readBy: UNIVERSE,
    lang: "word", ptBR: "Universo.md",
  },
  defaultUniverseFolders: { default: "", kind: text, readBy: UNIVERSE },
  threadClosedWord: { default: "closed", kind: word, readBy: UNIVERSE, lang: "word", ptBR: "fechada" },
  universeProperty: { default: "universe", kind: property, readBy: UNIVERSE },
  typeProperty: { default: "type", kind: property, readBy: UNIVERSE },
  entryTypes: {
    default: entries({
      character: ["character", "Characters", "Character"],
      place: ["place", "Places", "Place"],
      object: ["object", "Objects", "Object"],
      group: ["group", "Groups", "Group"],
      event: ["event", "Events", "Event"],
    }),
    kind: entryTypes, readBy: UNIVERSE, lang: "word",
    ptBR: entries({
      character: ["personagem", "Personagens", "Personagem"],
      place: ["lugar", "Lugares", "Lugar"],
      object: ["objeto", "Objetos", "Objeto"],
      group: ["grupo", "Grupos", "Grupo"],
      event: ["evento", "Eventos", "Evento"],
    }),
  },
  caseSensitiveProperty: { default: "caseSensitive", kind: property, readBy: UNIVERSE },
  ignoreProperty: { default: "ignore", kind: property, readBy: UNIVERSE },
  firstNameProperty: { default: "firstName", kind: property, readBy: UNIVERSE },
  nameTitles: { default: "", kind: text, readBy: UNIVERSE },
  underlineNames: { default: false, kind: bool, readBy: UNIVERSE },
} satisfies SettingsSchema;

export type Schema = typeof SETTINGS_SCHEMA;
export type SettingKey = keyof Schema;

/** The keys whose row has this `lang`: "word" (the setup's) or "install". */
export type KeysWith<L extends "word" | "install"> = { [K in SettingKey]: Schema[K] extends { lang: L } ? K : never }[SettingKey];

// Derived views ---------------------------------------------------------------------------

/** Every key of the table, in row order. */
export const SETTING_KEYS = Object.keys(SETTINGS_SCHEMA) as SettingKey[];

const rowOf = (k: SettingKey): Row<unknown> => SETTINGS_SCHEMA[k];

/** The keys of the universe's settings (`readBy: "universe"`); the universe module draws their rows. */
export const UNIVERSE_KEYS: readonly SettingKey[] = SETTING_KEYS.filter((k) => rowOf(k).readBy === "universe");

/**
 * Which features read each setting (0.7 plan Q13). A row draws while any of them is on;
 * "always" rows are shared core (the classifier, the stages, the property names several
 * features read). A section whose rows are all hidden is not drawn. The switches
 * themselves (`features`, `explorerCounts`, `spellcheckOnDemand`) and the universe
 * section's own rows (universe/settings-ui.ts) are not listed here.
 */
export const SETTING_FEATURES: Readonly<Record<string, readonly FeatureId[] | "always">> = Object.fromEntries(
  SETTING_KEYS.flatMap((k): [string, readonly FeatureId[] | "always"][] => {
    const r = rowOf(k).readBy;
    return r === "switch" || r === "universe" ? [] : [[k, r]];
  }),
);

/** A copy two levels deep, enough for stages, entryTypes, formValues, features and the lists. */
export function cloneValue<V>(v: V): V {
  if (Array.isArray(v)) return [...v] as V;
  if (!v || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    out[k] = Array.isArray(x) ? [...(x as unknown[])] : x && typeof x === "object" ? { ...(x as Record<string, unknown>) } : x;
  }
  return out as V;
}

/** A fresh `EscritaSettings` with every English default, sharing no object with the table. */
export function schemaDefaults(): EscritaSettings {
  const out: Record<string, unknown> = {};
  for (const k of SETTING_KEYS) out[k] = cloneValue(rowOf(k).default);
  return out as unknown as EscritaSettings;
}

/**
 * Cleans `keys` of `target` in place, each by its row's kind, with `base[k]` (copied) as the
 * fallback. Keys not in `keys` and keys the table does not know are left alone.
 */
export function normalizeKeys(target: Partial<EscritaSettings>, base: Partial<EscritaSettings>, keys: readonly SettingKey[]): void {
  const t = target as Record<string, unknown>;
  const b = base as Record<string, unknown>;
  for (const k of keys) t[k] = rowOf(k).kind.normalize(t[k], cloneValue(b[k]));
}
