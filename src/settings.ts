import { listsPath } from "./lens/settings";
import { cleanWeekdays, mergeDefaults } from "./core/merge";
import { migrateSettings } from "./core/migrate";
import { presetSwitches } from "./core/feature-presets";
import { DEFAULT_STAGES, DEFAULT_STATUS_PROPERTY, normalizeStages, type StageMapping } from "./core/stages";
import { FEATURE_SPECS, cleanFeatures, type FeatureId } from "./core/features";
import { switchesOf } from "./core/feature-registry";
import { defaultUniverseSettings, normalizeUniverse, type UniverseSettings } from "./universe/settings";
import { DEFAULT_SNAPSHOTS_FOLDER, snapshotsRoot } from "./core/classify";
import { isDefaultsLanguage, languageOf, overlayDefaults, type DefaultsLanguage } from "./core/defaults";

export type ParagraphStyle = "single" | "blank";
export type Scope = "books" | "all";
export type QuoteStyle = "curly" | "guillemets" | "german" | "off";

export interface EscritaSettings extends UniverseSettings {
  // Books
  chaptersFolder: string;
  chapterTemplate: string;
  /** folder of the notes offered by "Insert from a template"; empty = none */
  templatesFolder: string;
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

export const DEFAULT_SETTINGS: EscritaSettings = {
  chaptersFolder: "Chapters",
  chapterTemplate: "",
  templatesFolder: "",
  numberPadding: 2,
  unnumberedTitles: "Prologue, Preface, Foreword, Introduction, Interlude, Epilogue, Afterword",
  statusProperty: "status",
  stages: DEFAULT_STAGES,
  otherStatusColors: "",
  draftNewNotes: true,
  homeNote: "",
  openHomeOnStartup: false,
  openInWritingMode: false,
  summaryProperty: "summary",

  dailyGoal: 1000,
  dayEndsAt: 0,
  trackFolders: "",
  excludeFolders: "Templates",
  ignoreJumpsOver: 1500,
  showStatusBar: true,
  explorerCounts: true,
  explorerFolderTotals: false,
  explorerShowTarget: false,
  sprintMinutes: 25,
  sprintTarget: 500,
  targetProperty: "target",
  limitProperty: "limit",
  unitProperty: "unit",
  deadlineProperty: "deadline",
  goalProperty: "goal",
  povProperty: "pov",
  chapterTargetProperty: "chapterTarget",
  features: {},
  weekdaysOff: [],
  datesOff: "",

  dateProperty: "date",
  recommendedProperties: "description",
  exportFolder: "Escrita/Exports",
  compileProperty: "compile",
  dedicationProperty: "dedication",
  epigraphProperty: "epigraph",
  authorProperty: "author",
  authorName: "",
  authorSurname: "",
  contactLines: "",
  chapterHeadingFormat: "",
  coverProperty: "cover",
  epubSceneBreak: "* * *",
  collectionProperty: "contents",
  submissionsFolder: "Escrita/Submissions",
  submissionResults: "pending, accepted, rejected, withdrawn",
  submissionWorkProperty: "work",
  submissionMarketProperty: "market",
  submissionSentProperty: "sent",
  submissionResultProperty: "result",
  submissionRespondedProperty: "responded",

  snapshotsFolder: DEFAULT_SNAPSHOTS_FOLDER,
  snapshotBeforeFirstEdit: false,
  snapshotsKeepAuto: 20,

  ghostBeats: true,

  placeholderMarker: "XXX",
  showExplorerDots: true,

  threadKeyword: "thread",

  darlingsNote: "Darlings.md",
  globalDarlingsNote: "Darlings.md",

  enterFlow: false,
  paragraphStyle: "blank",
  smartTypography: true,
  typographyScope: "books",
  quoteStyle: "curly",
  dialogueDash: true,
  spellcheckOnDemand: false,

  lensLanguage: "auto",
  lensListsNote: "",
  lensEchoWindow: 40,
  lensLongSentence: 45,
  lensRulesOff: [],
  lensRulesOn: [],
  notNames: "",
  lensSkipQuotes: true,
  lensShowDialogue: true,
  lensShowReadability: true,

  defaultsLanguage: "en",

  ...defaultUniverseSettings(),
};

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

/** Settings as saved, with defaults filled in and list fields cleaned (used by loadAll). */
export function normalizeSettings(s: EscritaSettings): EscritaSettings {
  // 1.0 (Q1): an unknown language is the English set. Blank fields below come back from the install's set.
  s.defaultsLanguage = isDefaultsLanguage(s.defaultsLanguage) ? s.defaultsLanguage : "en";
  const d = defaultsFor(s.defaultsLanguage);
  s.weekdaysOff = cleanWeekdays(s.weekdaysOff);
  // Always a fresh copy: never share the frozen defaults with the live settings.
  s.stages = normalizeStages(s.stages, d.stages);
  s.statusProperty = (typeof s.statusProperty === "string" ? s.statusProperty.trim() : "") || DEFAULT_STATUS_PROPERTY;
  s.homeNote = typeof s.homeNote === "string" ? s.homeNote.trim() : DEFAULT_SETTINGS.homeNote;
  if (typeof s.otherStatusColors !== "string") s.otherStatusColors = DEFAULT_SETTINGS.otherStatusColors;
  if (typeof s.draftNewNotes !== "boolean") s.draftNewNotes = DEFAULT_SETTINGS.draftNewNotes;
  for (const k of PROPERTY_KEYS) s[k] = (typeof s[k] === "string" ? s[k].trim() : "") || DEFAULT_SETTINGS[k];
  s.snapshotsFolder = snapshotsRoot(s.snapshotsFolder, s.defaultsLanguage);
  // 0.8 folders: trimmed here; task 1.6 routes them through classify's exportRoot / submissionsRoot
  for (const k of ["exportFolder", "submissionsFolder"] as const) {
    s[k] = (typeof s[k] === "string" ? s[k].trim().replace(/^\/+|\/+$/g, "") : "") || d[k];
  }
  s.submissionResults = (typeof s.submissionResults === "string" ? s.submissionResults.trim() : "") || d.submissionResults;
  for (const k of ["authorName", "authorSurname", "contactLines", "chapterHeadingFormat"] as const) {
    s[k] = typeof s[k] === "string" ? s[k].trim() : "";
  }
  s.unnumberedTitles = typeof s.unnumberedTitles === "string" ? s.unnumberedTitles.trim() : d.unnumberedTitles;
  s.snapshotsKeepAuto = Number.isFinite(s.snapshotsKeepAuto) ? Math.max(1, Math.round(s.snapshotsKeepAuto)) : DEFAULT_SETTINGS.snapshotsKeepAuto;
  s.lensLanguage = s.lensLanguage === "pt-BR" || s.lensLanguage === "en" ? s.lensLanguage : "auto";
  s.lensListsNote = typeof s.lensListsNote === "string" ? listsPath(s.lensListsNote) : DEFAULT_SETTINGS.lensListsNote;
  s.lensEchoWindow = clampInt(s.lensEchoWindow, 10, 200, DEFAULT_SETTINGS.lensEchoWindow);
  s.lensLongSentence = clampInt(s.lensLongSentence, 15, 200, DEFAULT_SETTINGS.lensLongSentence);
  s.lensRulesOff = Array.isArray(s.lensRulesOff) ? s.lensRulesOff.filter((x): x is string => typeof x === "string") : [];
  s.lensRulesOn = Array.isArray(s.lensRulesOn) ? s.lensRulesOn.filter((x): x is string => typeof x === "string") : [];
  s.notNames = typeof s.notNames === "string" ? s.notNames : "";
  // a blank scene break would vanish in the book: the default instead
  s.epubSceneBreak = (typeof s.epubSceneBreak === "string" ? s.epubSceneBreak.trim() : "") || DEFAULT_SETTINGS.epubSceneBreak;
  s.templatesFolder = typeof s.templatesFolder === "string" ? s.templatesFolder.trim().replace(/^\/+|\/+$/g, "") : "";
  s.threadKeyword = (typeof s.threadKeyword === "string" ? s.threadKeyword.trim() : "") || d.threadKeyword;
  s.features = cleanFeatures(s.features);
  Object.assign(s, normalizeUniverse(s, d));
  // the mode is on only when saved as true
  s.openInWritingMode = s.openInWritingMode === true;
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
    return { settings: normalizeSettings(mergeDefaults(defaultsFor(lang), migrated)), fresh };
  }
  const lang = languageOf(obsidianLocale);
  const settings = normalizeSettings(mergeDefaults(defaultsFor(lang), { defaultsLanguage: lang }));
  Object.assign(settings, presetSwitches("writer", switchesOf(settings)));
  return { settings: normalizeSettings(settings), fresh };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

/** Frontmatter property names a piece or book is read from; normalizeSettings trims them and restores empty ones. */
const PROPERTY_KEYS = ["targetProperty", "limitProperty", "unitProperty", "deadlineProperty", "goalProperty", "povProperty", "chapterTargetProperty",
  "compileProperty", "dedicationProperty", "epigraphProperty", "coverProperty", "collectionProperty",
  "submissionWorkProperty", "submissionMarketProperty", "submissionSentProperty", "submissionResultProperty", "submissionRespondedProperty"] as const;

/**
 * Which features read each setting (0.7 plan Q13). A row draws while any of them is on;
 * "always" rows are shared core (the classifier, the stages, the property names several
 * features read). A section whose rows are all hidden is not drawn. The switches
 * themselves (`features`, `explorerCounts`, `spellcheckOnDemand`, `universeMode`) and
 * the universe section's own rows (universe/settings-ui.ts) are not listed here.
 */
export const SETTING_FEATURES: Readonly<Record<string, readonly FeatureId[] | "always">> = {
  chaptersFolder: "always", chapterTemplate: "always", numberPadding: "always", unnumberedTitles: ["export", "outline"],
  statusProperty: "always", summaryProperty: "always", stages: "always", otherStatusColors: "always", draftNewNotes: "always",
  lensLanguage: "always",
  targetProperty: "always", limitProperty: "always", unitProperty: "always", deadlineProperty: "always",
  goalProperty: "always", povProperty: "always", chapterTargetProperty: "always",
  trackFolders: "always", excludeFolders: "always",
  templatesFolder: ["templates", "universe"],
  homeNote: ["desk"], openHomeOnStartup: ["desk"], openInWritingMode: ["desk"],
  // shared core (it picks the fallback of every word-bearing setting); no row in 1.0
  defaultsLanguage: "always",
  dailyGoal: ["goals"], dayEndsAt: ["goals", "darlings", "snapshots", "publish"],
  ignoreJumpsOver: ["goals"], sprintMinutes: ["goals"], sprintTarget: ["goals"], showStatusBar: ["goals"],
  weekdaysOff: ["goals"], datesOff: ["goals"],
  explorerFolderTotals: ["explorerCounts"], explorerShowTarget: ["explorerCounts"],
  dateProperty: ["publish"], recommendedProperties: ["publish"],
  // 0.8: the folders are read by the classifier; the rest belong to the export and submissions modules
  // (their rows are drawn by those modules' sections, tasks 3.1 and 3.2)
  exportFolder: "always", submissionsFolder: "always",
  compileProperty: ["export"], dedicationProperty: ["export"], epigraphProperty: ["export"], authorProperty: ["export"],
  authorName: ["export"], authorSurname: ["export"], contactLines: ["export"], chapterHeadingFormat: ["export"],
  coverProperty: ["export"], epubSceneBreak: ["export"], collectionProperty: ["export"],
  submissionResults: ["submissions"],
  submissionWorkProperty: ["submissions"], submissionMarketProperty: ["submissions"], submissionSentProperty: ["submissions"],
  submissionResultProperty: ["submissions"], submissionRespondedProperty: ["submissions"],
  snapshotsFolder: ["snapshots"], snapshotBeforeFirstEdit: ["snapshots"], snapshotsKeepAuto: ["snapshots"],
  ghostBeats: ["outline"],
  placeholderMarker: ["placeholders", "publish"], showExplorerDots: ["placeholders"],
  threadKeyword: ["threads"],
  darlingsNote: ["darlings"], globalDarlingsNote: ["darlings"],
  enterFlow: ["typing"], smartTypography: ["typing"], typographyScope: ["typing"], dialogueDash: ["typing"],
  paragraphStyle: ["typing", "dialogueFocus", "moveBlocks", "lens"],
  quoteStyle: ["typing", "dialogueFocus", "lens"],
  lensListsNote: ["lens"], lensEchoWindow: ["lens"], lensLongSentence: ["lens"], lensRulesOff: ["lens"],
  lensRulesOn: ["lens"], notNames: ["lens"],
  lensSkipQuotes: ["lens"], lensShowDialogue: ["lens"], lensShowReadability: ["lens"],
};

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
