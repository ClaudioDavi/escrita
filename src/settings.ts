import { App, PluginSettingTab, Setting, moment, type ColorComponent } from "obsidian";
import type EscritaPlugin from "./main";
import { lang, locale, t } from "./i18n";
import { listsPath } from "./lens/lists";
import { listsTarget } from "./lens/shown";
import { lensLang } from "./lens/lang";
import { RULES } from "./lens/types";
import { cleanWeekdays } from "./core/merge";
import { invalidDatesOff } from "./core/daysoff";
import { DEFAULT_STAGES, DEFAULT_STATUS_PROPERTY, STAGES, hexColor, normalizeStages, stageConflicts, type Stage, type StageMapping } from "./core/stages";
import { renderUniverseSettings } from "./universe/settings-ui";
import { defaultUniverseSettings, normalizeUniverse, type UniverseSettings } from "./universe/settings";
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
  Object.assign(s, normalizeUniverse(s));
  return s;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

/** Frontmatter property names a piece or book is read from; normalizeSettings trims them and restores empty ones. */
const PROPERTY_KEYS = ["targetProperty", "limitProperty", "unitProperty", "deadlineProperty", "goalProperty"] as const;

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
    const num = (v: string, fallback: number, min = 0) => {
      const n = Number(v.replace(/[^\d]/g, ""));
      return Number.isFinite(n) && v.trim() !== "" ? Math.max(min, n) : fallback;
    };

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
    new Setting(containerEl)
      .setName(t("settings.templatesFolder"))
      .setDesc(t("settings.templatesFolder.desc"))
      .addText((c) => c.setPlaceholder("Templates").setValue(s.templatesFolder)
        .onChange(async (v) => { s.templatesFolder = v.trim(); await save(); }));
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

    this.stagesSettings(containerEl, save);
    this.lensSettings(containerEl, save);
    renderUniverseSettings(this.plugin, containerEl, save, () => this.display());

    new Setting(containerEl).setName(t("settings.goals")).setHeading();
    new Setting(containerEl)
      .setName(t("settings.dailyGoal"))
      .addText((c) => c.setValue(String(s.dailyGoal))
        .onChange(async (v) => { s.dailyGoal = num(v, s.dailyGoal); await save(); }));
    new Setting(containerEl)
      .setName(t("settings.dayEndsAt"))
      .setDesc(t("settings.dayEndsAt.desc"))
      .addDropdown((d) => {
        for (let h = 0; h <= 6; h++) d.addOption(String(h), `${String(h).padStart(2, "0")}:00`);
        d.setValue(String(s.dayEndsAt)).onChange(async (v) => { s.dayEndsAt = Number(v); await save(); });
      });
    new Setting(containerEl)
      .setName(t("settings.trackFolders"))
      .setDesc(t("settings.trackFolders.desc"))
      .addTextArea((c) => c.setPlaceholder("Fiction\nNovels").setValue(s.trackFolders)
        .onChange(async (v) => { s.trackFolders = v; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.excludeFolders"))
      .addTextArea((c) => c.setValue(s.excludeFolders)
        .onChange(async (v) => { s.excludeFolders = v; await save(); }));
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
    new Setting(containerEl)
      .setName(t("settings.explorerCounts"))
      .setDesc(t("settings.explorerCounts.desc"))
      .addToggle((c) => c.setValue(s.explorerCounts)
        .onChange(async (v) => { s.explorerCounts = v; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.explorerFolderTotals"))
      .setDesc(t("settings.explorerFolderTotals.desc"))
      .addToggle((c) => c.setValue(s.explorerFolderTotals)
        .onChange(async (v) => { s.explorerFolderTotals = v; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.explorerShowTarget"))
      .setDesc(t("settings.explorerShowTarget.desc"))
      .addToggle((c) => c.setValue(s.explorerShowTarget)
        .onChange(async (v) => { s.explorerShowTarget = v; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.targetProperty"))
      .setDesc(t("settings.pieceProperties.desc"))
      .addText((c) => c.setPlaceholder("target").setValue(s.targetProperty)
        .onChange(async (v) => { s.targetProperty = v.trim() || DEFAULT_SETTINGS.targetProperty; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.limitProperty"))
      .addText((c) => c.setPlaceholder("limit").setValue(s.limitProperty)
        .onChange(async (v) => { s.limitProperty = v.trim() || DEFAULT_SETTINGS.limitProperty; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.unitProperty"))
      .addText((c) => c.setPlaceholder("unit").setValue(s.unitProperty)
        .onChange(async (v) => { s.unitProperty = v.trim() || DEFAULT_SETTINGS.unitProperty; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.deadlineProperty"))
      .addText((c) => c.setPlaceholder("deadline").setValue(s.deadlineProperty)
        .onChange(async (v) => { s.deadlineProperty = v.trim() || DEFAULT_SETTINGS.deadlineProperty; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.goalProperty"))
      .setDesc(t("settings.goalProperty.desc"))
      .addText((c) => c.setPlaceholder("goal").setValue(s.goalProperty)
        .onChange(async (v) => { s.goalProperty = v.trim() || DEFAULT_SETTINGS.goalProperty; await save(); }));
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

    new Setting(containerEl).setName(t("settings.publishing")).setHeading();
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

    this.snapshotsSettings(containerEl, save, num);

    new Setting(containerEl).setName(t("settings.outline")).setHeading();
    new Setting(containerEl)
      .setName(t("settings.ghostBeats"))
      .setDesc(t("settings.ghostBeats.desc"))
      .addToggle((c) => c.setValue(s.ghostBeats)
        .onChange(async (v) => { s.ghostBeats = v; await save(); }));

    new Setting(containerEl).setName(t("settings.placeholders")).setHeading();
    new Setting(containerEl)
      .setName(t("settings.placeholderMarker"))
      .setDesc(t("settings.placeholderMarker.desc"))
      .addText((c) => c.setValue(s.placeholderMarker)
        .onChange(async (v) => { s.placeholderMarker = v.replace(/[^\p{L}\p{N}_-]/gu, "") || "XXX"; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.showExplorerDots"))
      .addToggle((c) => c.setValue(s.showExplorerDots)
        .onChange(async (v) => { s.showExplorerDots = v; await save(); }));

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

    new Setting(containerEl).setName(t("settings.editor")).setHeading();
    new Setting(containerEl)
      .setName(t("settings.enterFlow"))
      .setDesc(t("settings.enterFlow.desc"))
      .addToggle((c) => c.setValue(s.enterFlow)
        .onChange(async (v) => { s.enterFlow = v; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.paragraphStyle"))
      .setDesc(t("settings.paragraphStyle.desc"))
      .addDropdown((d) => d
        .addOption("blank", t("settings.paragraphStyle.blank"))
        .addOption("single", t("settings.paragraphStyle.single"))
        .setValue(s.paragraphStyle)
        .onChange(async (v) => { s.paragraphStyle = v as ParagraphStyle; await save(); }));
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
    new Setting(containerEl)
      .setName(t("settings.quoteStyle"))
      .addDropdown((d) => d
        .addOption("curly", "“…” ‘…’")
        .addOption("guillemets", "«…» ‹…›")
        .addOption("german", "„…“ ‚…‘")
        .addOption("off", t("settings.quoteStyle.off"))
        .setValue(s.quoteStyle)
        .onChange(async (v) => { s.quoteStyle = v as QuoteStyle; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.dialogueDash"))
      .setDesc(t("settings.dialogueDash.desc"))
      .addToggle((c) => c.setValue(s.dialogueDash)
        .onChange(async (v) => { s.dialogueDash = v; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.spellcheckOnDemand"))
      .setDesc(t("settings.spellcheckOnDemand.desc"))
      .addToggle((c) => c.setValue(s.spellcheckOnDemand)
        .onChange(async (v) => { s.spellcheckOnDemand = v; await save(); }));
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

    const languageRow = new Setting(containerEl)
      .setName(t("settings.lens.language"))
      .setDesc(t("settings.lens.language.desc"))
      .addDropdown((d) => {
        d.addOption("auto", t("settings.lens.language.auto"));
        d.addOption("pt-BR", t("settings.lens.language.pt"));
        d.addOption("en", t("settings.lens.language.en"));
        d.setValue(s.lensLanguage).onChange(async (v) => {
          s.lensLanguage = v === "pt-BR" || v === "en" ? v : "auto";
          await save();
          this.display(); // the gerund rule is named for the language
        });
      });
    languageRow.settingEl.addClass("escrita-lens-stack");

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
