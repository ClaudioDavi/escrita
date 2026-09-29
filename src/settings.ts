import { App, PluginSettingTab, Setting, moment } from "obsidian";
import type EscritaPlugin from "./main";
import { t } from "./i18n";
import { cleanWeekdays } from "./core/merge";
import { invalidDatesOff } from "./core/daysoff";

export type ParagraphStyle = "single" | "blank";
export type Scope = "books" | "all";
export type QuoteStyle = "curly" | "guillemets" | "german" | "off";

export interface EscritaSettings {
  // Books
  chaptersFolder: string;
  chapterTemplate: string;
  numberPadding: number;
  /** "value = #hex" per line; colors the outline's status dots */
  statusColors: string;
  statusProperty: string;
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
  sprintMinutes: number;
  sprintTarget: number;
  /** property names for a piece's target length, hard limit and unit (see core/piece) */
  targetProperty: string;
  limitProperty: string;
  unitProperty: string;
  /** weekdays off, 0 = Sunday … 6 = Saturday (see core/daysoff) */
  weekdaysOff: number[];
  /** specific days off, YYYY-MM-DD, one per line */
  datesOff: string;

  // Publishing (status property: statusProperty)
  /** status value that means published */
  publishedValue: string;
  /** status set by "Unpublish" when the previous status is unknown */
  unpublishedValue: string;
  /** property holding the publication date */
  dateProperty: string;
  /** properties a published note should have; newline/comma list (lineList); empty disables the check */
  recommendedProperties: string;
  /** folders whose published notes share one URL space; one per line (folderList); empty turns the duplicate URL check off */
  publishFolders: string;
  /** property that overrides the URL slug */
  slugProperty: string;
  /** offer to add the old slug when a published note is renamed */
  keepUrlOnRename: boolean;

  // Outline
  ghostBeats: boolean;

  // Placeholders
  placeholderMarker: string;
  showExplorerDots: boolean;

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
}

export const DEFAULT_SETTINGS: EscritaSettings = {
  chaptersFolder: "Chapters",
  chapterTemplate: "",
  numberPadding: 2,
  statusColors: "idea = #7d7972\ndraft = #9a968e\nrevision = #e0b567\nready = #8fb3d9\npublished = #86c497",
  statusProperty: "status",
  summaryProperty: "summary",

  dailyGoal: 1000,
  dayEndsAt: 0,
  trackFolders: "",
  excludeFolders: "Templates",
  ignoreJumpsOver: 1500,
  showStatusBar: true,
  sprintMinutes: 25,
  sprintTarget: 500,
  targetProperty: "target",
  limitProperty: "limit",
  unitProperty: "unit",
  weekdaysOff: [],
  datesOff: "",

  publishedValue: "published",
  unpublishedValue: "ready",
  dateProperty: "date",
  recommendedProperties: "description",
  publishFolders: "",
  slugProperty: "slug",
  keepUrlOnRename: true,

  ghostBeats: true,

  placeholderMarker: "XXX",
  showExplorerDots: true,

  darlingsNote: "Darlings.md",
  globalDarlingsNote: "Darlings.md",

  enterFlow: false,
  paragraphStyle: "blank",
  smartTypography: true,
  typographyScope: "books",
  quoteStyle: "curly",
  dialogueDash: true,
  spellcheckOnDemand: false,
};

export function parseStatusColors(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of s.split(/\r?\n/)) {
    const m = /^\s*(.+?)\s*[=:]\s*(#[0-9a-f]{3,8}|[a-z]+)\s*$/i.exec(line);
    if (m) out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

/** Settings as saved, with defaults filled in and list fields cleaned (used by loadAll). */
export function normalizeSettings(s: EscritaSettings): EscritaSettings {
  s.weekdaysOff = cleanWeekdays(s.weekdaysOff);
  return s;
}

export function folderList(s: string): string[] {
  return s.split(/[\n,]/).map((x) => x.trim().replace(/^\/+|\/+$/g, "")).filter(Boolean);
}

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
    new Setting(containerEl)
      .setName(t("settings.statusColors"))
      .setDesc(t("settings.statusColors.desc"))
      .addTextArea((c) => { c.setValue(s.statusColors).onChange(async (v) => { s.statusColors = v; await save(); }); c.inputEl.rows = 5; });

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
      .setName(t("settings.publishedValue"))
      .setDesc(t("settings.publishedValue.desc"))
      .addText((c) => c.setPlaceholder("published").setValue(s.publishedValue)
        .onChange(async (v) => { s.publishedValue = v.trim() || DEFAULT_SETTINGS.publishedValue; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.unpublishedValue"))
      .setDesc(t("settings.unpublishedValue.desc"))
      .addText((c) => c.setPlaceholder("ready").setValue(s.unpublishedValue)
        .onChange(async (v) => { s.unpublishedValue = v.trim() || DEFAULT_SETTINGS.unpublishedValue; await save(); }));
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
    new Setting(containerEl)
      .setName(t("settings.publishFolders"))
      .setDesc(t("settings.publishFolders.desc"))
      .addTextArea((c) => c.setPlaceholder("Stories\nEssays").setValue(s.publishFolders)
        .onChange(async (v) => { s.publishFolders = v; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.slugProperty"))
      .setDesc(t("settings.slugProperty.desc"))
      .addText((c) => c.setPlaceholder("slug").setValue(s.slugProperty)
        .onChange(async (v) => { s.slugProperty = v.trim() || DEFAULT_SETTINGS.slugProperty; await save(); }));
    new Setting(containerEl)
      .setName(t("settings.keepUrlOnRename"))
      .setDesc(t("settings.keepUrlOnRename.desc"))
      .addToggle((c) => c.setValue(s.keepUrlOnRename)
        .onChange(async (v) => { s.keepUrlOnRename = v; await save(); }));

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
