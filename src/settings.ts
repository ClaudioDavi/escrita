import { App, Notice, PluginSettingTab, Setting, moment, type ColorComponent } from "obsidian";
import type EscritaPlugin from "./main";
import { fmt, lang, locale, plural, t } from "./i18n";
import { listsPath } from "./lens/lists";
import { listsTarget } from "./lens/shown";
import { lensLang } from "./lens/lang";
import { RULES } from "./lens/types";
import { cleanWeekdays } from "./core/merge";
import { invalidDatesOff } from "./core/daysoff";
import { DEFAULT_STAGES, DEFAULT_STATUS_PROPERTY, STAGES, hexColor, normalizeStages, stageConflicts, writtenWord, type Stage, type StageMapping } from "./core/stages";
import { FEATURE_SPECS, cleanFeatures, wanted, type FeatureId, type FeatureGroup, type FeatureSwitches } from "./core/features";
import { renderUniverseSettings } from "./universe/settings-ui";
import { defaultUniverseSettings, normalizeUniverse, type UniverseMode, type UniverseSettings } from "./universe/settings";
import { DEFAULT_SNAPSHOTS_FOLDER, inFolder, snapshotsFolderProblem, snapshotsRoot, type SnapshotsFolderProblem } from "./core/classify";

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
  lensSkipQuotes: boolean;
  lensShowDialogue: boolean;
  lensShowReadability: boolean;
}

export const DEFAULT_SETTINGS: EscritaSettings = {
  chaptersFolder: "Chapters",
  chapterTemplate: "",
  templatesFolder: "",
  numberPadding: 2,
  statusProperty: "status",
  stages: DEFAULT_STAGES,
  otherStatusColors: "",
  draftNewNotes: true,
  homeNote: "",
  openHomeOnStartup: false,
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
  lensSkipQuotes: true,
  lensShowDialogue: true,
  lensShowReadability: true,

  ...defaultUniverseSettings(),
};

/** Settings as saved, with defaults filled in and list fields cleaned (used by loadAll). */
export function normalizeSettings(s: EscritaSettings): EscritaSettings {
  s.weekdaysOff = cleanWeekdays(s.weekdaysOff);
  // Always a fresh copy: never share the frozen defaults with the live settings.
  s.stages = normalizeStages(s.stages);
  s.statusProperty = (typeof s.statusProperty === "string" ? s.statusProperty.trim() : "") || DEFAULT_STATUS_PROPERTY;
  s.homeNote = typeof s.homeNote === "string" ? s.homeNote.trim() : DEFAULT_SETTINGS.homeNote;
  if (typeof s.otherStatusColors !== "string") s.otherStatusColors = DEFAULT_SETTINGS.otherStatusColors;
  if (typeof s.draftNewNotes !== "boolean") s.draftNewNotes = DEFAULT_SETTINGS.draftNewNotes;
  for (const k of PROPERTY_KEYS) s[k] = (typeof s[k] === "string" ? s[k].trim() : "") || DEFAULT_SETTINGS[k];
  s.snapshotsFolder = snapshotsRoot(s.snapshotsFolder);
  s.snapshotsKeepAuto = Number.isFinite(s.snapshotsKeepAuto) ? Math.max(1, Math.round(s.snapshotsKeepAuto)) : DEFAULT_SETTINGS.snapshotsKeepAuto;
  s.lensLanguage = s.lensLanguage === "pt-BR" || s.lensLanguage === "en" ? s.lensLanguage : "auto";
  s.lensListsNote = typeof s.lensListsNote === "string" ? listsPath(s.lensListsNote) : DEFAULT_SETTINGS.lensListsNote;
  s.lensEchoWindow = clampInt(s.lensEchoWindow, 10, 200, DEFAULT_SETTINGS.lensEchoWindow);
  s.lensLongSentence = clampInt(s.lensLongSentence, 15, 200, DEFAULT_SETTINGS.lensLongSentence);
  s.lensRulesOff = Array.isArray(s.lensRulesOff) ? s.lensRulesOff.filter((x): x is string => typeof x === "string") : [];
  s.templatesFolder = typeof s.templatesFolder === "string" ? s.templatesFolder.trim().replace(/^\/+|\/+$/g, "") : "";
  s.threadKeyword = (typeof s.threadKeyword === "string" ? s.threadKeyword.trim() : "") || DEFAULT_SETTINGS.threadKeyword;
  s.features = cleanFeatures(s.features);
  Object.assign(s, normalizeUniverse(s));
  return s;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

/** Frontmatter property names a piece or book is read from; normalizeSettings trims them and restores empty ones. */
const PROPERTY_KEYS = ["targetProperty", "limitProperty", "unitProperty", "deadlineProperty", "goalProperty", "povProperty", "chapterTargetProperty"] as const;

/**
 * Which features read each setting (0.7 plan Q13). A row draws while any of them is on;
 * "always" rows are shared core (the classifier, the stages, the property names several
 * features read). A section whose rows are all hidden is not drawn. The switches
 * themselves (`features`, `explorerCounts`, `spellcheckOnDemand`, `universeMode`) and
 * the universe section's own rows (universe/settings-ui.ts) are not listed here.
 */
export const SETTING_FEATURES: Readonly<Record<string, readonly FeatureId[] | "always">> = {
  chaptersFolder: "always", chapterTemplate: "always", numberPadding: "always",
  statusProperty: "always", summaryProperty: "always", stages: "always", otherStatusColors: "always", draftNewNotes: "always",
  lensLanguage: "always",
  targetProperty: "always", limitProperty: "always", unitProperty: "always", deadlineProperty: "always",
  goalProperty: "always", povProperty: "always", chapterTargetProperty: "always",
  trackFolders: "always", excludeFolders: "always",
  templatesFolder: ["templates", "universe"],
  homeNote: ["desk"], openHomeOnStartup: ["desk"],
  dailyGoal: ["goals"], dayEndsAt: ["goals", "darlings", "snapshots", "publish"],
  ignoreJumpsOver: ["goals"], sprintMinutes: ["goals"], sprintTarget: ["goals"], showStatusBar: ["goals"],
  weekdaysOff: ["goals"], datesOff: ["goals"],
  explorerFolderTotals: ["explorerCounts"], explorerShowTarget: ["explorerCounts"],
  dateProperty: ["publish"], recommendedProperties: ["publish"],
  snapshotsFolder: ["snapshots"], snapshotBeforeFirstEdit: ["snapshots"], snapshotsKeepAuto: ["snapshots"],
  ghostBeats: ["outline"],
  placeholderMarker: ["placeholders", "publish"], showExplorerDots: ["placeholders"],
  threadKeyword: ["threads"],
  darlingsNote: ["darlings"], globalDarlingsNote: ["darlings"],
  enterFlow: ["typing"], smartTypography: ["typing"], typographyScope: ["typing"], dialogueDash: ["typing"],
  paragraphStyle: ["typing", "dialogueFocus", "moveBlocks", "lens"],
  quoteStyle: ["typing", "dialogueFocus", "lens"],
  lensListsNote: ["lens"], lensEchoWindow: ["lens"], lensLongSentence: ["lens"], lensRulesOff: ["lens"],
  lensSkipQuotes: ["lens"], lensShowDialogue: ["lens"], lensShowReadability: ["lens"],
};

/** The Features page, in the order of the approved board: group, then the rows of the group. */
export const FEATURE_PAGE: readonly { group: FeatureGroup; ids: readonly FeatureId[] }[] = [
  { group: "writing", ids: ["goals", "outline", "placeholders", "typing", "dialogueFocus", "moveBlocks", "templates", "spellcheck", "explorerCounts"] },
  { group: "revision", ids: ["lens", "snapshots", "darlings"] },
  { group: "desk", ids: ["stageSnapshot", "desk"] },
  { group: "publishing", ids: ["publish"] },
  { group: "world", ids: ["universe", "threads"] },
];

/** The writer's switches as the registry reads them (the same record `wanted` takes). */
export function switchesOf(s: EscritaSettings): FeatureSwitches {
  return { features: s.features, explorerCounts: s.explorerCounts, spellcheckOnDemand: s.spellcheckOnDemand, universeMode: s.universeMode };
}

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

export class EscritaSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: EscritaPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const save = async () => { await this.plugin.saveSettings(); };
    const want = wanted(switchesOf(s));
    const shown = (key: string) => rowShown(key, want);
    /** Draws the heading when at least one of the section's rows shows (a section without rows is not drawn). */
    const section = (title: string, keys: string[]): boolean => {
      if (!keys.some(shown)) return false;
      new Setting(containerEl).setName(title).setHeading();
      return true;
    };
    const num = (v: string, fallback: number, min = 0) => {
      const n = Number(v.replace(/[^\d]/g, ""));
      return Number.isFinite(n) && v.trim() !== "" ? Math.max(min, n) : fallback;
    };
    const textRow = (key: "targetProperty" | "limitProperty" | "unitProperty" | "deadlineProperty" | "goalProperty" | "povProperty" | "chapterTargetProperty",
      name: string, placeholder: string, desc?: string) => {
      const row = new Setting(containerEl).setName(name);
      if (desc) row.setDesc(desc);
      row.addText((c) => c.setPlaceholder(placeholder).setValue(s[key])
        .onChange(async (v) => { s[key] = v.trim() || DEFAULT_SETTINGS[key]; await save(); }));
    };

    this.featuresSection(containerEl, save, want);

    // Names and folders several features read: always shown (Q13).
    new Setting(containerEl).setName(t("settings.shared")).setHeading();
    containerEl.createDiv({ cls: "setting-item-description escrita-shared-desc", text: t("settings.shared.desc") });
    textRow("targetProperty", t("settings.targetProperty"), "target", t("settings.pieceProperties.desc"));
    textRow("limitProperty", t("settings.limitProperty"), "limit");
    textRow("unitProperty", t("settings.unitProperty"), "unit");
    textRow("deadlineProperty", t("settings.deadlineProperty"), "deadline");
    textRow("goalProperty", t("settings.goalProperty"), "goal", t("settings.goalProperty.desc"));
    textRow("povProperty", t("settings.povProperty"), "pov", t("settings.povProperty.desc"));
    textRow("chapterTargetProperty", t("settings.chapterTargetProperty"), "chapterTarget", t("settings.chapterTargetProperty.desc"));
    new Setting(containerEl)
      .setName(t("settings.trackFolders"))
      .setDesc(t("settings.trackFolders.desc"))
      .addTextArea((c) => c.setPlaceholder("Fiction\nNovels").setValue(s.trackFolders)
        .onChange(async (v) => { s.trackFolders = v; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.excludeFolders"))
      .addTextArea((c) => c.setValue(s.excludeFolders)
        .onChange(async (v) => { s.excludeFolders = v; await save(); }));

    new Setting(containerEl).setName(t("settings.books")).setHeading();
    new Setting(containerEl)
      .setName(t("settings.chaptersFolder"))
      .setDesc(t("settings.chaptersFolder.desc"))
      .addText((c) => c.setPlaceholder("Chapters").setValue(s.chaptersFolder)
        .onChange(async (v) => { s.chaptersFolder = v.trim() || DEFAULT_SETTINGS.chaptersFolder; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.chapterTemplate"))
      .setDesc(t("settings.chapterTemplate.desc"))
      .addText((c) => c.setPlaceholder("Templates/Chapter.md").setValue(s.chapterTemplate)
        .onChange(async (v) => { s.chapterTemplate = v.trim(); await save(); }));
    if (shown("templatesFolder")) {
      new Setting(containerEl)
        .setName(t("settings.templatesFolder"))
        .setDesc(t("settings.templatesFolder.desc"))
        .addText((c) => c.setPlaceholder("Templates").setValue(s.templatesFolder)
          .onChange(async (v) => { s.templatesFolder = v.trim(); await save(); }));
    }
    new Setting(containerEl)
      .setName(t("settings.numberPadding"))
      .setDesc(t("settings.numberPadding.desc"))
      .addDropdown((d) => {
        for (let w = 1; w <= 4; w++) d.addOption(String(w), "1".padStart(w, "0"));
        d.setValue(String(s.numberPadding)).onChange(async (v) => { s.numberPadding = Number(v); await save(); });
      });
    new Setting(containerEl)
      .setName(t("settings.statusProperty"))
      .setDesc(t("settings.statusProperty.desc"))
      .addText((c) => c.setPlaceholder("status").setValue(s.statusProperty)
        .onChange(async (v) => { s.statusProperty = v.trim() || "status"; await save(); }))
      .addText((c) => c.setPlaceholder("summary").setValue(s.summaryProperty)
        .onChange(async (v) => { s.summaryProperty = v.trim() || "summary"; await save(); }));

    if (shown("dayEndsAt")) {
      new Setting(containerEl)
        .setName(t("settings.dayEndsAt"))
        .setDesc(t("settings.dayEndsAt.desc"))
        .addDropdown((d) => {
          for (let h = 0; h <= 6; h++) d.addOption(String(h), `${String(h).padStart(2, "0")}:00`);
          d.setValue(String(s.dayEndsAt)).onChange(async (v) => { s.dayEndsAt = Number(v); await save(); });
        });
    }

    if (section(t("settings.goals"), ["dailyGoal", "ignoreJumpsOver", "sprintMinutes", "showStatusBar", "weekdaysOff", "datesOff"])) {
      if (shown("dailyGoal")) {
        new Setting(containerEl)
          .setName(t("settings.dailyGoal"))
          .addText((c) => c.setValue(String(s.dailyGoal))
            .onChange(async (v) => { s.dailyGoal = num(v, s.dailyGoal); await save(); }));
      }
      if (shown("ignoreJumpsOver")) {
        new Setting(containerEl)
          .setName(t("settings.ignoreJumpsOver"))
          .setDesc(t("settings.ignoreJumpsOver.desc"))
          .addText((c) => c.setValue(String(s.ignoreJumpsOver))
            .onChange(async (v) => { s.ignoreJumpsOver = num(v, s.ignoreJumpsOver, 50); await save(); }));
        new Setting(containerEl)
          .setName(t("settings.sprintMinutes"))
          .setDesc(t("settings.sprintMinutes.desc"))
          .addText((c) => c.setValue(String(s.sprintMinutes))
            .onChange(async (v) => { s.sprintMinutes = Math.min(240, num(v, s.sprintMinutes, 1)); await save(); }))
          .addText((c) => c.setValue(String(s.sprintTarget))
            .onChange(async (v) => { s.sprintTarget = num(v, s.sprintTarget, 0); await save(); }));
        new Setting(containerEl)
          .setName(t("settings.showStatusBar"))
          .addToggle((c) => c.setValue(s.showStatusBar)
            .onChange(async (v) => { s.showStatusBar = v; await save(); }));
        this.weekdaysSetting(containerEl, save);
        const datesOff = new Setting(containerEl)
          .setName(t("settings.datesOff"))
          .setDesc(t("settings.datesOff.desc"));
        const datesHint = datesOff.descEl.createDiv({ cls: "escrita-setting-warning" });
        const showDatesHint = () => {
          const bad = invalidDatesOff(s.datesOff);
          datesHint.setText(bad.length ? t("settings.datesOff.invalid", { dates: bad.join(", ") }) : "");
          datesHint.toggle(bad.length > 0);
        };
        showDatesHint();
        datesOff.addTextArea((c) => c.setPlaceholder("2026-12-25\n2027-01-01").setValue(s.datesOff)
          .onChange(async (v) => { s.datesOff = v; showDatesHint(); await save(); }));
      }
    }

    if (section(t("settings.publishing"), ["dateProperty", "recommendedProperties"])) {
      new Setting(containerEl)
        .setName(t("settings.dateProperty"))
        .setDesc(t("settings.dateProperty.desc"))
        .addText((c) => c.setPlaceholder("date").setValue(s.dateProperty)
          .onChange(async (v) => { s.dateProperty = v.trim() || DEFAULT_SETTINGS.dateProperty; await save(); }));
      new Setting(containerEl)
        .setName(t("settings.recommendedProperties"))
        .setDesc(t("settings.recommendedProperties.desc"))
        .addTextArea((c) => c.setPlaceholder("description").setValue(s.recommendedProperties)
          .onChange(async (v) => { s.recommendedProperties = v; await save(); }));
    }

    if (shown("ghostBeats")) {
      new Setting(containerEl).setName(t("settings.outline")).setHeading();
      new Setting(containerEl)
        .setName(t("settings.ghostBeats"))
        .setDesc(t("settings.ghostBeats.desc"))
        .addToggle((c) => c.setValue(s.ghostBeats)
          .onChange(async (v) => { s.ghostBeats = v; await save(); }));
    }

    if (section(t("settings.placeholders"), ["placeholderMarker", "showExplorerDots"])) {
      new Setting(containerEl)
        .setName(t("settings.placeholderMarker"))
        .setDesc(t("settings.placeholderMarker.desc", { marker: s.placeholderMarker }))
        .addText((c) => c.setValue(s.placeholderMarker)
          .onChange(async (v) => { s.placeholderMarker = v.replace(/[^\p{L}\p{N}_-]/gu, "") || "XXX"; await save(); }));
      if (shown("showExplorerDots")) {
        new Setting(containerEl)
          .setName(t("settings.showExplorerDots"))
          .addToggle((c) => c.setValue(s.showExplorerDots)
            .onChange(async (v) => { s.showExplorerDots = v; await save(); }));
      }
    }

    if (shown("darlingsNote")) {
      new Setting(containerEl).setName(t("settings.darlings")).setHeading();
      new Setting(containerEl)
        .setName(t("settings.darlingsNote"))
        .setDesc(t("settings.darlingsNote.desc"))
        .addText((c) => c.setValue(s.darlingsNote)
          .onChange(async (v) => { s.darlingsNote = v.trim() || "Darlings.md"; await save(); }));
      new Setting(containerEl)
        .setName(t("settings.globalDarlingsNote"))
        .addText((c) => c.setValue(s.globalDarlingsNote)
          .onChange(async (v) => { s.globalDarlingsNote = v.trim() || "Darlings.md"; await save(); }));
    }

    this.editorSettings(containerEl, save, section, shown);
    if (shown("lensEchoWindow")) this.lensSettings(containerEl, save);

    this.stagesSettings(containerEl, save);
    if (shown("homeNote")) this.homeSettings(containerEl, save);
    if (shown("snapshotsFolder")) this.snapshotsSettings(containerEl, save, num);
    renderUniverseSettings(this.plugin, containerEl, save);
  }

  /**
   * The Features page (board 21): the writing language, then one row per feature in its
   * group, each with a switch and one line on what it does. The universe's row is the mode
   * dropdown. The stage snapshot is disabled while snapshots is off, its stored value kept.
   */
  private featuresSection(containerEl: HTMLElement, save: () => Promise<void>, want: ReadonlySet<FeatureId>): void {
    const s = this.plugin.settings;
    const apply = async () => { await save(); this.display(); };
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
          setFeature(s, id, v);
          await apply();
          if (!v) void this.offNotice(id);
        });
        if (id === "snapshots" && !on && s.features.stageSnapshot !== false) {
          row.descEl.createDiv({ text: t("settings.features.snapshots.off") });
        }
        if (needs) {
          const hint = row.descEl.createDiv({ text: `${t(`settings.features.needs.${needs}.desc`)} ` });
          hint.createEl("button", { cls: "escrita-link", text: t(`settings.features.turnOn.${needs}`) })
            .addEventListener("click", () => { setFeature(s, needs, true); void apply(); });
        }

        if (id === "explorerCounts" && on) this.explorerRows(containerEl, save);
      }
      if (group === "publishing") {
        const row = new Setting(containerEl).setName(t("settings.features.export")).setDesc(t("settings.features.export.desc"));
        row.settingEl.addClasses(["escrita-feature-row", "escrita-feature-off"]);
        row.nameEl.createSpan({ cls: "escrita-tag", text: t("settings.features.export.tag") });
        addSwitch(row, t("settings.features.export"), false, true, async () => {});
      }
    }
  }

  /** Turning off a feature that keeps data says what stays and where (board FeaturesStates, state 1). */
  private async offNotice(id: FeatureId): Promise<void> {
    const p = this.plugin;
    const s = p.settings;
    const say = (text: string) => { new Notice(text); };
    switch (id) {
      case "snapshots": {
        let n = 0;
        try {
          for (const note of await p.snapshots.store.notesWithSnapshots()) n += (await p.snapshots.store.list(note)).length;
        } catch { return; }
        if (n > 0) say(plural("settings.features.off.snapshots", n, { n: fmt(n), folder: s.snapshotsFolder }));
        return;
      }
      case "darlings":
        say(t("settings.features.off.darlings"));
        return;
      case "goals": {
        const n = Object.keys(p.data.history).length;
        if (n > 0) say(plural("settings.features.off.goals", n, { n: fmt(n) }));
        return;
      }
      case "lens":
        say(t("settings.features.off.lens", { note: s.lensListsNote || listsTarget("", lensLang(s.lensLanguage, locale())) }));
        return;
      case "desk": {
        const n = Object.keys(p.data.leftOff).length;
        if (n > 0) say(plural("settings.features.off.desk", n, { n: fmt(n) }));
        return;
      }
      default:
    }
  }

  /** The explorer's own rows, right under its switch (Q13). */
  private explorerRows(containerEl: HTMLElement, save: () => Promise<void>): void {
    const s = this.plugin.settings;
    new Setting(containerEl)
      .setName(t("settings.explorerFolderTotals"))
      .setDesc(t("settings.explorerFolderTotals.desc"))
      .addToggle((c) => c.setValue(s.explorerFolderTotals)
        .onChange(async (v) => { s.explorerFolderTotals = v; await save(); }))
      .settingEl.addClass("escrita-feature-child");
    new Setting(containerEl)
      .setName(t("settings.explorerShowTarget"))
      .setDesc(t("settings.explorerShowTarget.desc"))
      .addToggle((c) => c.setValue(s.explorerShowTarget)
        .onChange(async (v) => { s.explorerShowTarget = v; await save(); }))
      .settingEl.addClass("escrita-feature-child");
  }

  /** The Editor section: each row shows while a feature that reads it is on. */
  private editorSettings(containerEl: HTMLElement, save: () => Promise<void>,
    section: (title: string, keys: string[]) => boolean, shown: (key: string) => boolean): void {
    const s = this.plugin.settings;
    if (!section(t("settings.editor"), ["enterFlow", "paragraphStyle", "smartTypography", "typographyScope", "quoteStyle", "dialogueDash"])) return;
    if (shown("enterFlow")) {
      new Setting(containerEl)
        .setName(t("settings.enterFlow"))
        .setDesc(t("settings.enterFlow.desc"))
        .addToggle((c) => c.setValue(s.enterFlow)
          .onChange(async (v) => { s.enterFlow = v; await save(); }));
    }
    if (shown("paragraphStyle")) {
      new Setting(containerEl)
        .setName(t("settings.paragraphStyle"))
        .setDesc(t("settings.paragraphStyle.desc"))
        .addDropdown((d) => d
          .addOption("blank", t("settings.paragraphStyle.blank"))
          .addOption("single", t("settings.paragraphStyle.single"))
          .setValue(s.paragraphStyle)
          .onChange(async (v) => { s.paragraphStyle = v as ParagraphStyle; await save(); }));
    }
    if (shown("smartTypography")) {
      new Setting(containerEl)
        .setName(t("settings.smartTypography"))
        .setDesc(t("settings.smartTypography.desc"))
        .addToggle((c) => c.setValue(s.smartTypography)
          .onChange(async (v) => { s.smartTypography = v; await save(); }));
      new Setting(containerEl)
        .setName(t("settings.typographyScope"))
        .addDropdown((d) => d
          .addOption("books", t("settings.scope.books"))
          .addOption("all", t("settings.scope.all"))
          .setValue(s.typographyScope)
          .onChange(async (v) => { s.typographyScope = v as Scope; await save(); }));
    }
    if (shown("quoteStyle")) {
      new Setting(containerEl)
        .setName(t("settings.quoteStyle"))
        .addDropdown((d) => d
          .addOption("curly", "“…” ‘…’")
          .addOption("guillemets", "«…» ‹…›")
          .addOption("german", "„…“ ‚…‘")
          .addOption("off", t("settings.quoteStyle.off"))
          .setValue(s.quoteStyle)
          .onChange(async (v) => { s.quoteStyle = v as QuoteStyle; await save(); }));
    }
    if (shown("dialogueDash")) {
      new Setting(containerEl)
        .setName(t("settings.dialogueDash"))
        .setDesc(t("settings.dialogueDash.desc"))
        .addToggle((c) => c.setValue(s.dialogueDash)
          .onChange(async (v) => { s.dialogueDash = v; await save(); }));
    }
  }

  /**
   * The Stages section: one row per stage (words, color, clear), the duplicate
   * warning under the rows, the other-status-colors box and the home note rows.
   * A duplicate word never blocks saving; the first stage wins (stageOf).
   */
  private lensSettings(containerEl: HTMLElement, save: () => Promise<void>): void {
    const s = this.plugin.settings;
    new Setting(containerEl).setName(t("settings.lens")).setHeading();
    containerEl.createDiv({ cls: "setting-item-description escrita-lens-desc", text: t("settings.lens.desc") });

    const listsRow = new Setting(containerEl)
      .setName(t("settings.lens.lists"))
      .setDesc(t("settings.lens.lists.desc"))
      .addText((c) => {
        c.setPlaceholder(listsTarget("", lensLang(s.lensLanguage, locale()))).setValue(s.lensListsNote);
        c.inputEl.setAttr("aria-label", t("settings.lens.lists"));
        c.inputEl.addEventListener("blur", () => {
          const path = listsPath(c.getValue());
          c.setValue(path);
          if (path === s.lensListsNote) return;
          s.lensListsNote = path;
          void save();
        });
      })
      .addButton((b) => b.setButtonText(t("settings.lens.lists.create"))
        .onClick(async () => { await this.plugin.lens.createLists(); this.display(); }));
    listsRow.settingEl.addClass("escrita-lens-stack");

    const numberRow = (key: "lensEchoWindow" | "lensLongSentence", name: string, min: number, max: number) => {
      new Setting(containerEl)
        .setName(t(`settings.lens.${name}`))
        .setDesc(t(`settings.lens.${name}.desc`))
        .addText((c) => {
          c.inputEl.type = "text";
          c.inputEl.inputMode = "numeric";
          c.inputEl.addClass("escrita-lens-number");
          c.inputEl.setAttr("aria-label", t(`settings.lens.${name}`));
          c.setValue(String(s[key]));
          const commit = (final: boolean) => {
            const raw = c.getValue().trim();
            const n = Number(raw);
            if (raw !== "" && /^\d+$/.test(raw) && n >= min && n <= max && n !== s[key]) { s[key] = n; void save(); }
            if (final) c.setValue(String(s[key]));
          };
          c.onChange(() => commit(false));
          c.inputEl.addEventListener("blur", () => commit(true));
        })
        .controlEl.createSpan({ cls: "setting-item-description", text: t("settings.lens.words") });
    };
    numberRow("lensEchoWindow", "echoWindow", 10, 200);
    numberRow("lensLongSentence", "longSentence", 15, 200);

    new Setting(containerEl)
      .setName(t("settings.lens.skipQuotes"))
      .setDesc(t("settings.lens.skipQuotes.desc"))
      .addToggle((c) => c.setValue(s.lensSkipQuotes).onChange(async (v) => { s.lensSkipQuotes = v; await save(); }));

    new Setting(containerEl).setName(t("settings.lens.rules")).setHeading();
    const lens = lensLang(s.lensLanguage, locale());
    const english = lens === "en";
    for (const r of RULES) {
      const key = r === "gerund" && english ? "gerund.en" : r;
      const desc = r === "adverb"
        ? t(`settings.lens.rule.adverb.${lens ?? "none"}.desc`)
        : t(`settings.lens.rule.${key}.desc`);
      const row = new Setting(containerEl).setName(t(`lens.rule.${key}`));
      if (desc !== "") row.setDesc(desc);
      row.addToggle((c) => c.setValue(!s.lensRulesOff.includes(r)).onChange(async (v) => {
        const off = s.lensRulesOff.filter((x) => x !== r);
        if (!v) off.push(r);
        s.lensRulesOff = off;
        await save();
      }));
    }

    new Setting(containerEl).setName(t("settings.lens.measures")).setHeading();
    new Setting(containerEl)
      .setName(t("settings.lens.showDialogue"))
      .addToggle((c) => c.setValue(s.lensShowDialogue).onChange(async (v) => { s.lensShowDialogue = v; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.lens.showReadability"))
      .setDesc(t("settings.lens.showReadability.desc"))
      .addToggle((c) => c.setValue(s.lensShowReadability).onChange(async (v) => { s.lensShowReadability = v; await save(); }));
  }

  private stagesSettings(containerEl: HTMLElement, save: () => Promise<void>): void {
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
        await save();
      };
      setting.addText((c) => {
        // An empty field is never stored: on blur it shows the previous (or default) words again.
        const fieldChange = (v: string) => { if (v.trim() !== "") void saveWords(v); };
        c.setValue(s.stages[k].words).onChange(fieldChange);
        c.inputEl.addClass("escrita-stage-words");
        c.inputEl.setAttr("aria-label", t("settings.stages.words", { stage }));
        // Also on blur, so a value typed and left is never lost.
        c.inputEl.addEventListener("blur", () => {
          if (c.getValue().trim() === "") {
            if (s.stages[k].words.trim() === "") s.stages[k].words = DEFAULT_STAGES[k].words;
            c.setValue(s.stages[k].words);
            showWarnings();
            return;
          }
          void saveWords(c.getValue());
        });
      });
      let picker: ColorComponent | null = null;
      setting.addColorPicker((c) => {
        picker = c;
        c.setValue(hexColor(s.stages[k].color) ?? EMPTY_SWATCH).onChange(async (v) => {
          s.stages[k].color = hexColor(v) ?? "";
          paint();
          await save();
        });
      });
      swatch = setting.controlEl.querySelector<HTMLInputElement>('input[type="color"]');
      swatch?.addClass("escrita-swatch");
      setting.addExtraButton((b) => {
        b.setIcon("x").setTooltip(t("settings.stages.clear")).onClick(async () => {
          s.stages[k].color = "";
          // Reset the input too, so picking the same color again fires a change.
          // The empty state is the dashed swatch; the input holds a neutral grey so black can still be picked.
          (picker as ColorComponent | null)?.setValue(EMPTY_SWATCH);
          paint();
          await save();
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

    const other = new Setting(containerEl)
      .setName(t("settings.otherStatusColors"))
      .setDesc(t("settings.otherStatusColors.desc"));
    other.addTextArea((c) => {
      c.setPlaceholder("paused: #6e6b66").setValue(s.otherStatusColors)
        .onChange(async (v) => { s.otherStatusColors = v; await save(); });
      c.inputEl.addClass("escrita-mono");
      c.inputEl.setAttr("aria-label", t("settings.otherStatusColors"));
    });

    new Setting(containerEl)
      .setName(t("settings.draftNewNotes"))
      .setDesc(t("settings.draftNewNotes.desc", { word: writtenWord(s.stages, "draft") }))
      .addToggle((c) => c.setValue(s.draftNewNotes)
        .onChange(async (v) => { s.draftNewNotes = v; await save(); }));
  }

  /** The home note rows, shown while the desk is on. */
  private homeSettings(containerEl: HTMLElement, save: () => Promise<void>): void {
    const s = this.plugin.settings;
    new Setting(containerEl).setName(t("settings.homeNoteHeading")).setHeading();
    new Setting(containerEl)
      .setName(t("settings.homeNote"))
      .setDesc(t("settings.homeNote.desc"))
      .addText((c) => c.setPlaceholder(lang() === "pt-BR" ? "Inicio.md" : "Home.md").setValue(s.homeNote)
        .onChange(async (v) => { s.homeNote = v.trim(); await save(); }));
    new Setting(containerEl)
      .setName(t("settings.openHomeOnStartup"))
      .setDesc(t("settings.openHomeOnStartup.desc"))
      .addToggle((c) => c.setValue(s.openHomeOnStartup)
        .onChange(async (v) => { s.openHomeOnStartup = v; await save(); }));
  }

  /**
   * The Snapshots section. The folder is saved only when it passes
   * snapshotsFolderProblem; otherwise the saved value stays and a warning under
   * the setting says why (no notices while typing).
   */
  private snapshotsSettings(containerEl: HTMLElement, save: () => Promise<void>, num: (v: string, fallback: number, min?: number) => number): void {
    const s = this.plugin.settings;
    new Setting(containerEl).setName(t("settings.snapshots")).setHeading();
    const folder = new Setting(containerEl)
      .setName(t("settings.snapshotsFolder"))
      .setDesc(t("settings.snapshotsFolder.desc"));
    const hint = folder.descEl.createDiv({ cls: "escrita-setting-warning" });
    hint.toggle(false);
    folder.addText((c) => c.setPlaceholder(DEFAULT_SNAPSHOTS_FOLDER).setValue(s.snapshotsFolder)
      .onChange(async (v) => {
        const root = snapshotsRoot(v);
        const problem = snapshotsFolderProblem(v, this.app.vault.configDir, s.trackFolders, (r) =>
          r !== s.snapshotsFolder && this.app.vault.getMarkdownFiles().some((f) => inFolder(f.path, r)));
        c.inputEl.toggleClass("escrita-invalid", problem !== null);
        hint.setText(problem ? snapshotsProblemText(problem) : "");
        hint.toggle(problem !== null);
        if (problem || root === s.snapshotsFolder) return;
        s.snapshotsFolder = root;
        await save();
      }));
    new Setting(containerEl)
      .setName(t("settings.snapshotBeforeFirstEdit"))
      .setDesc(t("settings.snapshotBeforeFirstEdit.desc"))
      .addToggle((c) => c.setValue(s.snapshotBeforeFirstEdit)
        .onChange(async (v) => { s.snapshotBeforeFirstEdit = v; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.snapshotsKeepAuto"))
      .setDesc(t("settings.snapshotsKeepAuto.desc"))
      .addText((c) => c.setValue(String(s.snapshotsKeepAuto))
        .onChange(async (v) => { s.snapshotsKeepAuto = num(v, DEFAULT_SETTINGS.snapshotsKeepAuto, 1); await save(); }));
  }

  /** One labeled checkbox per weekday, in the locale's week order. */
  private weekdaysSetting(containerEl: HTMLElement, save: () => Promise<void>): void {
    const s = this.plugin.settings;
    const setting = new Setting(containerEl)
      .setName(t("settings.weekdaysOff"))
      .setDesc(t("settings.weekdaysOff.desc"));
    setting.settingEl.addClass("escrita-setting-weekdays");
    const box = setting.controlEl.createDiv({ cls: "escrita-weekdays" });
    const first = moment.localeData().firstDayOfWeek();
    for (let i = 0; i < 7; i++) {
      const day = (first + i) % 7;
      const label = box.createEl("label", { cls: "escrita-weekday" });
      const input = label.createEl("input", { type: "checkbox" });
      input.checked = s.weekdaysOff.includes(day);
      label.createSpan({ text: moment.weekdaysShort(day) });
      label.setAttr("aria-label", moment.weekdays(day));
      // The listener lives and dies with the element (re-rendered on every display()).
      input.addEventListener("change", () => {
        const set = new Set(s.weekdaysOff);
        if (input.checked) set.add(day);
        else set.delete(day);
        s.weekdaysOff = cleanWeekdays([...set]);
        void save();
      });
    }
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

function snapshotsProblemText(p: SnapshotsFolderProblem): string {
  switch (p.reason) {
    case "path": return t("settings.snapshotsFolder.path");
    case "config":
    case "tracked": return t("settings.snapshotsFolder.invalid", { folder: p.folder });
    case "notes": return t("settings.snapshotsFolder.notes", { folder: p.folder });
  }
}
