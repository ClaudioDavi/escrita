import { mergeDefaults } from "./core/merge";
import { migrateSettings } from "./core/migrate";
import { presetSwitches, settleNewSwitches } from "./core/feature-presets";
import { type StageMapping } from "./core/stages";
import { FEATURE_SPECS, type FeatureId } from "./core/features";
import { switchesOf } from "./core/feature-registry";
import { type UniverseSettings } from "./universe/settings";
import { isDefaultsLanguage, languageOf, overlayDefaults, type DefaultsLanguage } from "./core/defaults";
import { type FormSettings } from "./core/form";
import { SETTING_FEATURES, SETTING_KEYS, normalizeKeys, schemaDefaults } from "./core/settings-schema";

export type ParagraphStyle = "single" | "blank";
export type Scope = "books" | "all";
export type QuoteStyle = "curly" | "guillemets" | "german" | "off";

export interface EscritaSettings extends UniverseSettings, FormSettings {
  // Books
  chaptersFolder: string;
  chapterTemplate: string;
  /** folder of the notes offered by "Insert from a template"; empty = none */
  templatesFolder: string;
  // New works (1.0.4, SF 14): where "New short story" and "New book" create, and the notes
  // that replace their built-in templates. Empty folder = the active note's folder; empty
  // template = the built-in one. Setup writes the folders it creates (PLAN-1.0.4 Q3).
  storiesFolder: string;
  storyTemplate: string;
  booksFolder: string;
  bookNoteTemplate: string;
  numberPadding: number;
  /** titles that never get a chapter number in export and the outline (comma or newline separated); empty = none */
  unnumberedTitles: string;
  statusProperty: string;
  /** the writer's words and color for each stage */
  stages: StageMapping;
  /** "value = #hex" lines for chapter-only statuses and colors the picker can't show */
  otherStatusColors: string;
  /** new chapters and notes created in track folders get the draft word as their status */
  draftNewNotes: boolean;
  /** path of the home note; empty = none */
  homeNote: string;
  openHomeOnStartup: boolean;
  /**
   * Enter writing mode when Obsidian starts (1.0, SF 10, board 39): only the note and the
   * small goal counter. Beside `openHomeOnStartup`, part of the home block feature (`desk`,
   * no switch of its own); the setup turns it on when the writer picks the writing mode
   * layout. False by default; read only while the desk is on.
   */
  openInWritingMode: boolean;
  summaryProperty: string;

  // Goals
  dailyGoal: number;
  /** hour 0–6 at which the writing day rolls over */
  dayEndsAt: number;
  /** newline-separated folders to track; empty = whole vault */
  trackFolders: string;
  /** newline-separated folders never tracked */
  excludeFolders: string;
  /** single changes bigger than this (pastes, imports, syncs) are not counted as writing */
  ignoreJumpsOver: number;
  showStatusBar: boolean;
  /** word counts next to tracked notes, chapters and books in the file explorer */
  explorerCounts: boolean;
  /** other folders show the sum of the tracked notes inside them */
  explorerFolderTotals: boolean;
  /** "4,210 / 5,000" for notes with a target or limit */
  explorerShowTarget: boolean;
  sprintMinutes: number;
  sprintTarget: number;
  /** property names for a piece's target length, hard limit and unit (see core/measure) */
  targetProperty: string;
  limitProperty: string;
  unitProperty: string;
  /** property holding a book's or a note's deadline */
  deadlineProperty: string;
  /** property in a book's note holding its word goal */
  goalProperty: string;
  /** property on a chapter holding its point of view (a link or text) */
  povProperty: string;
  /** property in a book's note holding the default target of its chapters */
  chapterTargetProperty: string;
  /** which features are on; a missing key means on (0.7); see core/features */
  features: Partial<Record<FeatureId, boolean>>;
  /** weekdays off, 0 = Sunday … 6 = Saturday (see core/daysoff) */
  weekdaysOff: number[];
  /** specific days off, YYYY-MM-DD, one per line */
  datesOff: string;

  // Publishing (status property: statusProperty)
  /** property holding the publication date */
  dateProperty: string;
  /** properties a published note should have; newline/comma list (lineList); empty disables the check */
  recommendedProperties: string;

  // Export (0.8, PLAN-0.8 Q2, Q3, Q5, Q7; drawn by the export module's section, task 3.1)
  /** vault folder for exported manuscripts; kept out of tracking (classify `export`, task 1.6) */
  exportFolder: string;
  /** chapter property that leaves a chapter out of an export when false (N 7) */
  compileProperty: string;
  /** book note properties linking to the dedication and epigraph notes (Q7) */
  dedicationProperty: string;
  epigraphProperty: string;
  /** the work property that names its author on the title page; empty uses the name below (Q2) */
  authorProperty: string;
  /** the author on the title page; an `author` property on the work overrides the name (Q2) */
  authorName: string;
  /** surname in the manuscript header; empty = the last word of authorName */
  authorSurname: string;
  /** contact block on the title page, one line per line */
  contactLines: string;
  /** chapter heading with {n} and {title}; empty = the preset's own (Q5) */
  chapterHeadingFormat: string;
  /** book note property linking the EPUB cover image, JPEG or PNG (0.9, PLAN-0.9 Q8) */
  coverProperty: string;
  /** the scene break line in an EPUB (0.9, Q6) */
  epubSceneBreak: string;
  /** the property of a collection note listing its stories in reading order (0.9, SF 13, PLAN-0.9 Q24) */
  collectionProperty: string;

  // Screenplays (1.1, SP 1, SP 6, PLAN-1.1 Q4; drawn by the export module's section). The title
  // page's author and contact come from authorProperty, authorName and contactLines above.
  /** scene heading prefixes, comma or newline separated (Fountain's list) */
  screenplaySceneHeadings: string;
  /** a line in capitals ending in one of these is a transition, comma or newline separated */
  screenplayTransitions: string;
  /** the PDF's page: US Letter or A4 */
  screenplayPage: "letter" | "a4";
  /** scene numbers in both margins of the PDF (a shooting script) */
  screenplaySceneNumbers: boolean;
  /** printed under a speech that goes on to the next page */
  screenplayMore: string;
  /** printed after the character's name where the speech goes on */
  screenplayContinued: string;
  /** the credit line on the title page, above the author */
  screenplayCredit: string;
  /** the work property naming what the script is based on; its line is left out when absent */
  screenplaySourceProperty: string;
  /** the work property holding the draft date on the title page */
  screenplayDraftDateProperty: string;

  // The screenplay editor (1.2, SP 2, PLAN-1.2 Q5, Q11; drawn by the screenplay module's section)
  /** the editor's font in a screenplay note: a Courier stack, or the theme's editor font */
  screenplayFont: "courier" | "theme";
  /** time-of-day words offered after " - " on a scene heading, comma or newline separated */
  screenplayTimes: string;

  // Submissions (0.8, SF 12; drawn by the submissions module's section, task 3.2)
  /** vault folder of submission notes; kept out of tracking (classify `submission`, task 1.6) */
  submissionsFolder: string;
  /** result words, comma or newline separated: pending, accepted, rejected, withdrawn (the first is pending) */
  submissionResults: string;
  /** property names of a submission note (rule 6): the work link, market, sent date, result, response date */
  submissionWorkProperty: string;
  submissionMarketProperty: string;
  submissionSentProperty: string;
  submissionResultProperty: string;
  submissionRespondedProperty: string;

  // Snapshots
  /** vault folder holding one folder of snapshots per note; always read through core/classify.snapshotsRoot */
  snapshotsFolder: string;
  /** take an automatic snapshot before the first change of each writing day to a tracked note */
  snapshotBeforeFirstEdit: boolean;
  /** automatic snapshots kept per note (manual ones are never removed); at least 1 */
  snapshotsKeepAuto: number;

  // Outline
  ghostBeats: boolean;

  // Placeholders
  placeholderMarker: string;
  showExplorerDots: boolean;

  // Threads
  /** the word after `%%` that marks an open thread */
  threadKeyword: string;

  // Darlings
  /** relative to the book folder */
  darlingsNote: string;
  /** used for notes that aren't in a book */
  globalDarlingsNote: string;

  // Editor
  enterFlow: boolean;
  paragraphStyle: ParagraphStyle;
  smartTypography: boolean;
  typographyScope: Scope;
  quoteStyle: QuoteStyle;
  dialogueDash: boolean;
  spellcheckOnDemand: boolean;

  // Revision lens
  lensLanguage: "auto" | "pt-BR" | "en";
  /** path of the word lists note; empty = none */
  lensListsNote: string;
  lensEchoWindow: number;
  lensLongSentence: number;
  /** rules turned off; an array so mergeDefaults copies it and a future rule starts on */
  lensRulesOff: string[];
  /** opt-in rules turned on (0.9: `newName`, lens/types OPT_IN_RULES); they start off */
  lensRulesOn: string[];
  /** "Not names": words and runs the names rule never marks, one per line (0.9, Q4) */
  notNames: string;
  lensSkipQuotes: boolean;
  lensShowDialogue: boolean;
  lensShowReadability: boolean;
  /** the Rhythm section of the lens panel (1.2, SF 16, PLAN-1.2 Q17) */
  lensShowRhythm: boolean;

  // Language (1.0, PLAN-1.0 "Q1 as built"; no settings row in 1.0)
  /**
   * The default set this install uses (core/defaults.ts): every word-bearing setting the
   * writer never saved takes its value from this set, and a blank one is restored from
   * it. "en" for a saved settings object without the key (any install from before 1.0),
   * so a 0.9 writer keeps every English default they rely on. A fresh install takes
   * Obsidian's language once (`languageOf`) and saves it on its first load (task 1.4);
   * after that only the setup changes it. Never follows Obsidian's language by itself.
   */
  defaultsLanguage: DefaultsLanguage;
}

/** Every English default, from the settings table (core/settings-schema.ts). */
export const DEFAULT_SETTINGS: EscritaSettings = schemaDefaults();

/**
 * DEFAULT_SETTINGS with one language's default set laid over it (core/defaults.ts): what
 * an install whose `defaultsLanguage` is `lang` falls back to for every key it never saved.
 * A fresh object each call, sharing nothing with DEFAULT_SETTINGS. `defaultsFor("en")`
 * equals DEFAULT_SETTINGS. Lives here, not in core/defaults.ts, so that file needs no
 * value import from this one (see `overlayDefaults`).
 */
export function defaultsFor(lang: DefaultsLanguage): EscritaSettings {
  return overlayDefaults(DEFAULT_SETTINGS, lang);
}

/**
 * Settings as saved, with defaults filled in and list fields cleaned (used by loadAll). Every
 * key is cleaned by its row of the settings table (core/settings-schema.ts); a blank or wrong
 * value comes back from the install's set.
 */
export function normalizeSettings(s: EscritaSettings): EscritaSettings {
  // 1.0 (Q1): an unknown language is the English set. Blank fields below come back from the install's set.
  s.defaultsLanguage = isDefaultsLanguage(s.defaultsLanguage) ? s.defaultsLanguage : "en";
  normalizeKeys(s, defaultsFor(s.defaultsLanguage), SETTING_KEYS);
  return s;
}

/**
 * Settings as `loadAll` loads them (PLAN-1.0 "Q1 as built", Q7). A saved settings object
 * keeps its set: `migrateSettings` gives one without `defaultsLanguage` "en", so a 0.9
 * install loads unchanged. No saved settings is a fresh install: it takes the set of
 * `obsidianLocale` (`languageOf`) and the Writer features, and `fresh` tells the caller
 * to save once, so the set never moves when Obsidian's language changes later.
 */
export function loadSettings(saved: unknown, obsidianLocale: string): { settings: EscritaSettings; fresh: boolean } {
  const fresh = !saved || typeof saved !== "object" || Array.isArray(saved);
  if (!fresh) {
    const migrated = migrateSettings(saved);
    const lang = (migrated as { defaultsLanguage: DefaultsLanguage }).defaultsLanguage;
    const settings = normalizeSettings(mergeDefaults(defaultsFor(lang), migrated));
    settings.features = settleNewSwitches(switchesOf(settings));   // 1.2: PLAN-1.2 Q2
    return { settings, fresh };
  }
  const lang = languageOf(obsidianLocale);
  const settings = normalizeSettings(mergeDefaults(defaultsFor(lang), { defaultsLanguage: lang }));
  Object.assign(settings, presetSwitches("writer", switchesOf(settings)));
  return { settings: normalizeSettings(settings), fresh };
}

// Which features read each setting lives in the settings table (readBy); re-exported for the tab.
export { SETTING_FEATURES };

/** Does a row of this setting draw, with these features on? */
export function rowShown(key: string, want: ReadonlySet<FeatureId>): boolean {
  const f = SETTING_FEATURES[key];
  if (f === undefined) return true;
  return f === "always" || f.some((id) => want.has(id));
}

/** Writes one switch where it lives: its own setting (Q10) or `features`. A stored value is never dropped. */
export function setFeature(s: EscritaSettings, id: FeatureId, on: boolean): void {
  switch (FEATURE_SPECS.find((f) => f.id === id)?.switch) {
    case "explorerCounts": s.explorerCounts = on; break;
    case "spellcheckOnDemand": s.spellcheckOnDemand = on; break;
    case "universeMode": s.universeMode = on ? (s.universeMode === "off" ? "perBook" : s.universeMode) : "off"; break;
    default: s.features = { ...s.features, [id]: on };
  }
}

/** A number typed in a field: its digits, at least `min`; `fallback` when it has no digit (blank, or only words). */
export function digitsNumber(v: string, fallback: number, min = 0): number {
  const n = Number(v.replace(/[^\d]/g, ""));
  return /\d/.test(v) && Number.isFinite(n) ? Math.max(min, n) : fallback;
}
