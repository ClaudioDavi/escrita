import { App, Notice, PluginSettingTab, Setting, type ColorComponent, type TextAreaComponent, type TextComponent } from "obsidian";
import type EscritaPlugin from "./main";
import { lang, t } from "./i18n";
import { listsPath } from "./lens/settings";
import { cleanWeekdays, mergeDefaults } from "./core/merge";
import { migrateSettings } from "./core/migrate";
import { presetSwitches } from "./core/feature-presets";
import { DEFAULT_STAGES, DEFAULT_STATUS_PROPERTY, STAGES, hexColor, normalizeStages, stageConflicts, writtenWord, type Stage, type StageMapping } from "./core/stages";
import { FEATURE_IDS, FEATURE_PAGE, FEATURE_SPECS, cleanFeatures, wanted, type FeatureId } from "./core/features";
import { switchesOf } from "./core/feature-registry";
import { sectionOrder, type SectionSlot } from "./core/settings-order";
import type { FeatureModule, SettingsUi } from "./core/module-context";
import { defaultUniverseSettings, normalizeUniverse, type UniverseMode, type UniverseSettings } from "./universe/settings";
import { DEFAULT_SNAPSHOTS_FOLDER, exportRoot, snapshotsRoot, submissionsRoot } from "./core/classify";
import { holdsOwnNotes, pluginFolderProblem, type BookPaths } from "./core/folder-problem";
import { addFolderField } from "./core/folder-setting";
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
  s.snapshotsFolder = snapshotsRoot(s.snapshotsFolder);
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
/** What the color input holds while a stage has no color (not black, so black is a real choice). */
const EMPTY_SWATCH = "#808080";

/** A number typed in a field: its digits, at least `min`; `fallback` when blank or not a number. */
export function digitsNumber(v: string, fallback: number, min = 0): number {
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && v.trim() !== "" ? Math.max(min, n) : fallback;
}

/**
 * The export and submissions folders. The classifier reads both whether or not their feature is
 * loaded (never tracked, never a work), so they are drawn from the core, next to the track and
 * exclude folders, with every feature on or off. `books` is every book (BookService.allBooksEverywhere),
 * read only when a value is checked.
 */
export function pluginFolderRows(el: HTMLElement, ui: SettingsUi, s: EscritaSettings, books: () => readonly BookPaths[]): void {
  // every file, not only notes: a folder of the writer's .docx files is theirs too
  const paths = () => ui.app.vault.getFiles().map((f) => f.path);
  addFolderField(
    new Setting(el).setName(t("export.settings.folder")).setDesc(t("export.settings.folder.desc")), ui,
    {
      placeholder: DEFAULT_SETTINGS.exportFolder,
      value: s.exportFolder,
      problemOf: (v) => pluginFolderProblem(
        exportRoot(v, s.defaultsLanguage), [submissionsRoot(s.submissionsFolder, s.defaultsLanguage), snapshotsRoot(s.snapshotsFolder)],
        ui.app.vault.configDir, s.trackFolders, (r) => holdsOwnNotes(paths(), r, exportRoot(s.exportFolder, s.defaultsLanguage), s), books(),
      ),
      save: (v) => { s.exportFolder = exportRoot(v, s.defaultsLanguage); },
    },
  );
  addFolderField(
    new Setting(el).setName(t("submissions.settings.folder")).setDesc(t("submissions.settings.folder.desc")), ui,
    {
      placeholder: DEFAULT_SETTINGS.submissionsFolder,
      value: s.submissionsFolder,
      problemOf: (v) => pluginFolderProblem(
        submissionsRoot(v, s.defaultsLanguage), [exportRoot(s.exportFolder, s.defaultsLanguage), snapshotsRoot(s.snapshotsFolder)],
        ui.app.vault.configDir, s.trackFolders, (r) => holdsOwnNotes(paths(), r, submissionsRoot(s.submissionsFolder, s.defaultsLanguage), s), books(),
      ),
      save: (v) => { s.submissionsFolder = submissionsRoot(v, s.defaultsLanguage); },
    },
  );
}

export class EscritaSettingTab extends PluginSettingTab {
  /** The features loaded at the start of this draw (modules' sections draw while loaded, not just switched on). */
  private loaded: ReadonlySet<FeatureId> = new Set();

  constructor(app: App, private plugin: EscritaPlugin) {
    super(app, plugin);
  }

  /** What every section gets (IMPROVEMENTS 11): saving, committed text fields, redrawing, numbers. */
  private makeUi(): SettingsUi {
    const save = async () => { await this.plugin.saveSettings(); };
    return {
      app: this.app,
      save,
      saveOnCommit: (c: TextComponent | TextAreaComponent, fallback: () => string, apply: (v: string) => void) => {
        c.inputEl.addEventListener("change", () => {
          const v = c.getValue().trim() || fallback();
          c.setValue(v);
          apply(v);
          void save();
        });
      },
      redraw: () => this.display(),
      num: digitsNumber,
    };
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const ui = this.makeUi();
    this.loaded = new Set(FEATURE_IDS.filter((id) => this.plugin.features.isOn(id)));
    for (const slot of sectionOrder(this.loaded)) this.drawSlot(slot, containerEl, ui);
  }

  /** The core part of a slot (shared rows, headings), then the module's own section while it is loaded. */
  private drawSlot(slot: SectionSlot, el: HTMLElement, ui: SettingsUi): void {
    const s = this.plugin.settings;
    const shown = (key: string) => rowShown(key, this.loaded);
    switch (slot.id) {
      case "features": this.featuresSection(el, ui, wanted(switchesOf(s))); return;
      case "shared": this.sharedSection(el, ui); return;
      case "books": this.booksSection(el, ui, shown("templatesFolder")); return;
      case "dayEnds":
        if (shown("dayEndsAt")) {
          new Setting(el)
            .setName(t("settings.dayEndsAt"))
            .setDesc(t("settings.dayEndsAt.desc"))
            .addDropdown((d) => {
              for (let h = 0; h <= 6; h++) d.addOption(String(h), `${String(h).padStart(2, "0")}:00`);
              d.setValue(String(s.dayEndsAt)).onChange(async (v) => { s.dayEndsAt = Number(v); await ui.save(); });
            });
        }
        return;
      case "stages": this.stagesSettings(el, ui); return;
      case "placeholders":
        // The heading and the marker are shared with publish; the module adds its own rows under them.
        new Setting(el).setName(t("settings.placeholders")).setHeading();
        new Setting(el)
          .setName(t("settings.placeholderMarker"))
          .setDesc(t("settings.placeholderMarker.desc", { marker: s.placeholderMarker }))
          .addText((c) => {
            c.setValue(s.placeholderMarker);
            ui.saveOnCommit(c, () => "XXX", (v) => {
              s.placeholderMarker = v.replace(/[^\p{L}\p{N}_-]/gu, "") || "XXX";
              c.setValue(s.placeholderMarker);
            });
          });
        break;
      case "editor":
        new Setting(el).setName(t("settings.editor")).setHeading();
        this.drawModule("typing", el, ui);
        this.editorSharedRows(el, ui, shown);
        return;
      case "universe":
        // Drawn for threads alone too: the thread words sit in this section in every mode.
        new Setting(el).setName(t("universe.settings")).setHeading();
        break;
      default:
    }
    if (slot.feature !== null) this.drawModule(slot.feature, el, ui);
  }

  /** The module's `settingsSection`. */
  private drawModule(id: FeatureId, el: HTMLElement, ui: SettingsUi): void {
    if (!this.loaded.has(id)) return;
    this.plugin.features.get<FeatureModule>(id)?.settingsSection?.(el, ui);
  }

  /** Names and folders several features read: always shown (Q13). */
  private sharedSection(el: HTMLElement, ui: SettingsUi): void {
    const s = this.plugin.settings;
    const textRow = (key: "targetProperty" | "limitProperty" | "unitProperty" | "deadlineProperty" | "goalProperty" | "povProperty" | "chapterTargetProperty",
      name: string, placeholder: string, desc?: string) => {
      const row = new Setting(el).setName(name);
      if (desc) row.setDesc(desc);
      row.addText((c) => {
        c.setPlaceholder(placeholder).setValue(s[key]);
        ui.saveOnCommit(c, () => DEFAULT_SETTINGS[key], (v) => { s[key] = v; });
      });
    };
    new Setting(el).setName(t("settings.shared")).setHeading();
    el.createDiv({ cls: "setting-item-description escrita-shared-desc", text: t("settings.shared.desc") });
    textRow("targetProperty", t("settings.targetProperty"), "target", t("settings.pieceProperties.desc"));
    textRow("limitProperty", t("settings.limitProperty"), "limit");
    textRow("unitProperty", t("settings.unitProperty"), "unit");
    textRow("deadlineProperty", t("settings.deadlineProperty"), "deadline");
    textRow("goalProperty", t("settings.goalProperty"), "goal", t("settings.goalProperty.desc"));
    textRow("povProperty", t("settings.povProperty"), "pov", t("settings.povProperty.desc"));
    textRow("chapterTargetProperty", t("settings.chapterTargetProperty"), "chapterTarget", t("settings.chapterTargetProperty.desc"));
    new Setting(el)
      .setName(t("settings.trackFolders"))
      .setDesc(t("settings.trackFolders.desc"))
      .addTextArea((c) => {
        c.setPlaceholder(t("settings.trackFolders.example")).setValue(s.trackFolders);
        ui.saveOnCommit(c, () => "", (v) => { s.trackFolders = v; });
      });
    new Setting(el)
      .setName(t("settings.excludeFolders"))
      .addTextArea((c) => {
        c.setValue(s.excludeFolders);
        ui.saveOnCommit(c, () => "", (v) => { s.excludeFolders = v; });
      });
    pluginFolderRows(el, ui, s, () => this.plugin.books.allBooksEverywhere());
  }

  private booksSection(el: HTMLElement, ui: SettingsUi, templatesShown: boolean): void {
    const s = this.plugin.settings;
    new Setting(el).setName(t("settings.books")).setHeading();
    new Setting(el)
      .setName(t("settings.chaptersFolder"))
      .setDesc(t("settings.chaptersFolder.desc"))
      .addText((c) => {
        c.setPlaceholder("Chapters").setValue(s.chaptersFolder);
        ui.saveOnCommit(c, () => DEFAULT_SETTINGS.chaptersFolder, (v) => { s.chaptersFolder = v; });
      });
    new Setting(el)
      .setName(t("settings.chapterTemplate"))
      .setDesc(t("settings.chapterTemplate.desc"))
      .addText((c) => {
        c.setPlaceholder("Templates/Chapter.md").setValue(s.chapterTemplate);
        ui.saveOnCommit(c, () => "", (v) => { s.chapterTemplate = v; });
      });
    if (templatesShown) {
      new Setting(el)
        .setName(t("settings.templatesFolder"))
        .setDesc(t("settings.templatesFolder.desc"))
        .addText((c) => {
          c.setPlaceholder("Templates").setValue(s.templatesFolder);
          ui.saveOnCommit(c, () => "", (v) => { s.templatesFolder = v; });
        });
    }
    new Setting(el)
      .setName(t("settings.numberPadding"))
      .setDesc(t("settings.numberPadding.desc"))
      .addDropdown((d) => {
        for (let w = 1; w <= 4; w++) d.addOption(String(w), "1".padStart(w, "0"));
        d.setValue(String(s.numberPadding)).onChange(async (v) => { s.numberPadding = Number(v); await ui.save(); });
      });
    new Setting(el)
      .setName(t("settings.unnumberedTitles"))
      .setDesc(t("settings.unnumberedTitles.desc"))
      .addTextArea((c) => {
        c.setPlaceholder(t("settings.unnumberedTitles.example")).setValue(s.unnumberedTitles);
        ui.saveOnCommit(c, () => "", (v) => { s.unnumberedTitles = v; });
      });
    new Setting(el)
      .setName(t("settings.statusProperty"))
      .setDesc(t("settings.statusProperty.desc"))
      .addText((c) => {
        c.setPlaceholder(DEFAULT_SETTINGS.statusProperty).setValue(s.statusProperty);
        ui.saveOnCommit(c, () => DEFAULT_STATUS_PROPERTY, (v) => { s.statusProperty = v; });
      })
      .addText((c) => {
        c.setPlaceholder(DEFAULT_SETTINGS.summaryProperty).setValue(s.summaryProperty);
        ui.saveOnCommit(c, () => "summary", (v) => { s.summaryProperty = v; });
      });
  }

  /**
   * The Features page (board 21): the writing language, then one row per feature in its
   * group, each with a switch and one line on what it does. The universe's row is the mode
   * dropdown. The stage snapshot is disabled while snapshots is off, its stored value kept.
   */
  private featuresSection(containerEl: HTMLElement, ui: SettingsUi, want: ReadonlySet<FeatureId>): void {
    const s = this.plugin.settings;
    const apply = async () => { await ui.save(); this.display(); };
    new Setting(containerEl).setName(t("settings.features")).setHeading();
    containerEl.createDiv({ cls: "setting-item-description escrita-features-desc", text: t("settings.features.desc") });

    new Setting(containerEl)
      .setName(t("settings.language"))
      .setDesc(t("settings.language.desc"))
      .addDropdown((d) => {
        d.addOption("auto", t("settings.language.auto"));
        d.addOption("pt-BR", t("settings.language.pt"));
        d.addOption("en", t("settings.language.en"));
        d.setValue(s.lensLanguage).onChange(async (v) => {
          s.lensLanguage = v === "pt-BR" || v === "en" ? v : "auto";
          await apply(); // the gerund rule is named for the language
        });
        d.selectEl.setAttr("aria-label", t("settings.language"));
      });

    for (const { group, ids } of FEATURE_PAGE) {
      containerEl.createDiv({ cls: "escrita-feature-group", text: t(`settings.features.group.${group}`), attr: { role: "heading", "aria-level": "3" } });
      if (group === "desk") {
        const row = new Setting(containerEl).setName(t("settings.features.stages"));
        row.setDesc(t("settings.features.stages.desc"));
        row.settingEl.addClass("escrita-feature-row");
        row.nameEl.createSpan({ cls: "escrita-tag", text: t("settings.features.alwaysOn") });
      }
      for (const id of ids) {
        const spec = FEATURE_SPECS.find((f) => f.id === id)!;
        const row = new Setting(containerEl).setName(t(`settings.features.${id}`));
        row.settingEl.addClass("escrita-feature-row");
        row.setDesc(t(`settings.features.${id}.desc`, { marker: s.placeholderMarker, keyword: s.threadKeyword }));

        if (id === "universe") {
          row.addDropdown((d) => {
            d.addOption("universe", t("universe.settings.mode.universe"));
            d.addOption("perBook", t("universe.settings.mode.perBook"));
            d.addOption("off", t("universe.settings.mode.off"));
            d.setValue(s.universeMode).onChange(async (v) => { s.universeMode = v as UniverseMode; await apply(); });
            d.selectEl.setAttr("aria-label", t(`settings.features.${id}`));
          });
          continue;
        }

        const needs = spec.requires?.find((r) => !want.has(r));
        const on = want.has(id);
        row.settingEl.toggleClass("escrita-feature-off", !on);
        if (spec.requires) row.settingEl.addClass("escrita-feature-child");
        if (spec.requires) {
          row.nameEl.createSpan({
            cls: needs ? "escrita-tag escrita-tag-warn" : "escrita-tag",
            text: t(needs ? `settings.features.needs.${needs}` : `settings.features.uses.${spec.requires[0]}`),
          });
        }
        // The switch shows the writer's own choice, so turning the requirement back on restores it.
        const shownOn = needs ? false : on;
        addSwitch(row, t(`settings.features.${id}`), shownOn, needs !== undefined, async (v) => {
          // The module is read before it unloads: its offNotice reads only what stays (module-context.ts).
          const mod = v ? undefined : this.plugin.features.get<FeatureModule>(id);
          setFeature(s, id, v);
          await apply();
          if (!v) void this.offNotice(id, mod);
        });
        if (id === "snapshots" && !on && s.features.stageSnapshot !== false) {
          row.descEl.createDiv({ text: t("settings.features.snapshots.off") });
        }
        if (needs) {
          const hint = row.descEl.createDiv({ text: `${t(`settings.features.needs.${needs}.desc`)} ` });
          hint.createEl("button", { cls: "escrita-link", text: t(`settings.features.turnOn.${needs}`) })
            .addEventListener("click", () => { setFeature(s, needs, true); void apply(); });
        }

        // The explorer's own rows sit right under its switch (Q13).
        if (id === "explorerCounts" && on) this.drawModule("explorerCounts", containerEl, ui);
      }
    }
  }

  /** Turning off a feature that keeps data says what stays and where (board FeaturesStates, state 1). */
  private async offNotice(id: FeatureId, mod: FeatureModule | undefined): Promise<void> {
    try {
      const text = mod?.offNotice ? await mod.offNotice() : null;
      if (text) new Notice(text);
    } catch { /* a notice that can't be built is not worth a failure */ }
  }

  /** The Editor section's rows several features read: paragraph style and quote style, while one of them is loaded. */
  private editorSharedRows(el: HTMLElement, ui: SettingsUi, shown: (key: string) => boolean): void {
    const s = this.plugin.settings;
    if (shown("paragraphStyle")) {
      new Setting(el)
        .setName(t("settings.paragraphStyle"))
        .setDesc(t("settings.paragraphStyle.desc"))
        .addDropdown((d) => d
          .addOption("blank", t("settings.paragraphStyle.blank"))
          .addOption("single", t("settings.paragraphStyle.single"))
          .setValue(s.paragraphStyle)
          .onChange(async (v) => { s.paragraphStyle = v as ParagraphStyle; await ui.save(); }));
    }
    if (shown("quoteStyle")) {
      new Setting(el)
        .setName(t("settings.quoteStyle"))
        .addDropdown((d) => d
          .addOption("curly", "“…” ‘…’")
          .addOption("guillemets", "«…» ‹…›")
          .addOption("german", "„…“ ‚…‘")
          .addOption("off", t("settings.quoteStyle.off"))
          .setValue(s.quoteStyle)
          .onChange(async (v) => { s.quoteStyle = v as QuoteStyle; await ui.save(); }));
    }
  }

  /**
   * The Stages section: one row per stage (words, color, clear), the duplicate
   * warning under the rows, the other-status-colors box and the draft switch.
   * A duplicate word never blocks saving; the first stage wins (stageOf).
   */
  private stagesSettings(containerEl: HTMLElement, ui: SettingsUi): void {
    const s = this.plugin.settings;
    new Setting(containerEl).setName(t("settings.stages")).setHeading();
    containerEl.createDiv({ cls: "setting-item-description escrita-stages-desc", text: t("settings.stages.desc") });

    const warnings = new Map<Stage, HTMLElement>();
    const showWarnings = () => {
      const lines = new Map<Stage, string>();
      for (const c of stageConflicts(s.stages)) {
        const names = c.stages.map((k) => t(`stage.${k}`));
        const text = t("settings.stages.duplicate", { word: c.word, stages: listJoin(names), first: names[0] });
        // The warning sits under the last stage that repeats the word.
        const last = c.stages[c.stages.length - 1];
        lines.set(last, lines.has(last) ? `${lines.get(last)} ${text}` : text);
      }
      for (const [k, el] of warnings) {
        const text = lines.get(k) ?? "";
        el.setText(text);
        el.toggle(text !== "");
      }
    };

    for (const k of STAGES) {
      const setting = new Setting(containerEl).setName(t(`stage.${k}`));
      setting.settingEl.addClass("escrita-stage-row");
      const stage = t(`stage.${k}`).toLowerCase();
      let swatch: HTMLInputElement | null = null;
      let clear: HTMLButtonElement | null = null;
      const paint = () => {
        const color = hexColor(s.stages[k].color);
        swatch?.toggleClass("escrita-swatch-empty", !color);
        clear?.toggle(!!color);
        swatch?.setAttr("aria-label", color ? t("settings.stages.color", { stage }) : t("settings.stages.noColor"));
      };
      const saveWords = async (v: string) => {
        if (v === s.stages[k].words) return;
        s.stages[k].words = v;
        showWarnings();
        await ui.save();
      };
      setting.addText((c) => {
        c.setValue(s.stages[k].words);
        c.inputEl.addClass("escrita-stage-words");
        c.inputEl.setAttr("aria-label", t("settings.stages.words", { stage }));
        // Saved when the writer commits the field (Enter or leaving it), never per key. An empty field
        // is never stored: it shows the previous (or default) words again.
        const commit = () => {
          if (c.getValue().trim() === "") {
            if (s.stages[k].words.trim() === "") s.stages[k].words = DEFAULT_STAGES[k].words;
            c.setValue(s.stages[k].words);
            showWarnings();
            return;
          }
          void saveWords(c.getValue());
        };
        c.inputEl.addEventListener("change", commit);
        // Also on blur, so a value typed and left is never lost.
        c.inputEl.addEventListener("blur", commit);
      });
      let picker: ColorComponent | null = null;
      setting.addColorPicker((c) => {
        picker = c;
        c.setValue(hexColor(s.stages[k].color) ?? EMPTY_SWATCH).onChange(async (v) => {
          s.stages[k].color = hexColor(v) ?? "";
          paint();
          await ui.save();
        });
      });
      swatch = setting.controlEl.querySelector<HTMLInputElement>('input[type="color"]');
      swatch?.addClass("escrita-swatch");
      setting.addExtraButton((b) => {
        b.setIcon("x").setTooltip(t("settings.stages.clear")).onClick(async () => {
          s.stages[k].color = "";
          // Reset the input too, so picking the same color again fires a change.
          // The empty state is the dashed swatch; the input holds a neutral grey so black can still be picked.
          (picker)?.setValue(EMPTY_SWATCH);
          paint();
          await ui.save();
        });
        clear = b.extraSettingsEl as unknown as HTMLButtonElement;
        clear.addClass("escrita-swatch-clear");
        clear.setAttr("aria-label", t("settings.stages.clear"));
      });
      paint();
      warnings.set(k, containerEl.createDiv({ cls: "escrita-setting-warning escrita-stage-warning" }));
      // The warning belongs to its row: keep it directly under it.
      setting.settingEl.after(warnings.get(k)!);
    }
    showWarnings();

    new Setting(containerEl)
      .setName(t("settings.otherStatusColors"))
      .setDesc(t("settings.otherStatusColors.desc"))
      .addTextArea((c) => {
        c.setPlaceholder(t("settings.otherStatusColors.example")).setValue(s.otherStatusColors);
        c.inputEl.addClass("escrita-mono");
        c.inputEl.setAttr("aria-label", t("settings.otherStatusColors"));
        ui.saveOnCommit(c, () => "", (v) => { s.otherStatusColors = v; });
      });

    new Setting(containerEl)
      .setName(t("settings.draftNewNotes"))
      .setDesc(t("settings.draftNewNotes.desc", { word: writtenWord(s.stages, "draft") }))
      .addToggle((c) => c.setValue(s.draftNewNotes)
        .onChange(async (v) => { s.draftNewNotes = v; await ui.save(); }));
  }
}

/** A switch: a button with role "switch", 48x32 (44 on a phone), drawn like the approved board. */
function addSwitch(row: Setting, label: string, on: boolean, disabled: boolean, onToggle: (on: boolean) => void | Promise<void>): HTMLButtonElement {
  const btn = row.controlEl.createEl("button", { cls: "escrita-switch", attr: { type: "button", role: "switch", "aria-checked": String(on), "aria-label": label } });
  btn.toggleClass("is-on", on);
  btn.disabled = disabled;
  btn.createSpan({ cls: "escrita-switch-track" }).createSpan({ cls: "escrita-switch-knob" });
  // The listener lives and dies with the element (the tab redraws after every change).
  btn.addEventListener("click", () => { void onToggle(!on); });
  return btn;
}

/** "A and B" / "A, B and C" in the writer's language. */
function listJoin(items: string[]): string {
  if (items.length < 2) return items.join("");
  const and = lang() === "pt-BR" ? " e " : " and ";
  return items.slice(0, -1).join(", ") + and + items[items.length - 1];
}
