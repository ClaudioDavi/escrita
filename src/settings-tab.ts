// The settings tab (PLAN-1.0.3): Obsidian's declarative settings, so Escrita's rows show in the
// settings search (1.13+). `getSettingDefinitions` makes one group per slot of the order list
// (core/settings-order.ts), under the slot's heading: the core's rows for the slot, then the
// module's blocks (`settingsItems`). Obsidian computes the rows when the tab is added and on each
// `update()`, never when the tab opens, so the tab calls `update()` whenever the structure changes
// (Q5): a feature loads or unloads, the switches or the universe mode change (`refresh`, through
// the registry's `onApplied`), or a section asks (`ui.redraw()`). Never after a text field commits.
//
// The adapter (until PLAN-1.0.3 Wave 1 ports every part): a core slot, or a module still on
// `settingsSection`, is one `customRow` that runs today's drawing code into the row, headings
// included, so the tab looks and behaves as before.

import { App, Notice, PluginSettingTab, Setting, SettingGroup, type ColorComponent, type SettingDefinitionGroup, type SettingDefinitionItem, type TextAreaComponent, type TextComponent } from "obsidian";
import type EscritaPlugin from "./main";
import { lang, t } from "./i18n";
import { PRESET_IDS, matchingPreset, presetChanges, presetSwitches, type PresetId } from "./core/feature-presets";
import { STAGES, hexColor, stageConflicts, writtenWord, type Stage } from "./core/stages";
import { FEATURE_IDS, FEATURE_PAGE, FEATURE_SPECS, wanted, type FeatureId } from "./core/features";
import { switchesOf } from "./core/feature-registry";
import { sectionOrder, type SectionId, type SectionSlot } from "./core/settings-order";
import type { FeatureModule, SettingsUi } from "./core/module-context";
import type { UniverseMode } from "./universe/settings";
import { exportRoot, snapshotsRoot, submissionsRoot } from "./core/classify";
import { holdsOwnNotes, pluginFolderProblem, type BookPaths } from "./core/folder-problem";
import { addFolderField } from "./core/folder-setting";
import { customRow, type SettingsBlock } from "./ui/settings-rows";
import { defaultsFor, digitsNumber, rowShown, setFeature, type EscritaSettings, type ParagraphStyle, type QuoteStyle } from "./settings";

/** What the color input holds while a stage has no color (not black, so black is a real choice). */
const EMPTY_SWATCH = "#808080";

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
      placeholder: ui.defaults().exportFolder,
      value: s.exportFolder,
      problemOf: (v) => pluginFolderProblem(
        exportRoot(v, s.defaultsLanguage), [submissionsRoot(s.submissionsFolder, s.defaultsLanguage), snapshotsRoot(s.snapshotsFolder, s.defaultsLanguage)],
        ui.app.vault.configDir, s.trackFolders, (r) => holdsOwnNotes(paths(), r, exportRoot(s.exportFolder, s.defaultsLanguage), s), books(),
      ),
      save: (v) => { s.exportFolder = exportRoot(v, s.defaultsLanguage); },
    },
  );
  addFolderField(
    new Setting(el).setName(t("submissions.settings.folder")).setDesc(t("submissions.settings.folder.desc")), ui,
    {
      placeholder: ui.defaults().submissionsFolder,
      value: s.submissionsFolder,
      problemOf: (v) => pluginFolderProblem(
        submissionsRoot(v, s.defaultsLanguage), [exportRoot(s.exportFolder, s.defaultsLanguage), snapshotsRoot(s.snapshotsFolder, s.defaultsLanguage)],
        ui.app.vault.configDir, s.trackFolders, (r) => holdsOwnNotes(paths(), r, submissionsRoot(s.submissionsFolder, s.defaultsLanguage), s), books(),
      ),
      save: (v) => { s.submissionsFolder = submissionsRoot(v, s.defaultsLanguage); },
    },
  );
}

export class EscritaSettingTab extends PluginSettingTab {
  /** The features loaded when the rows were last built (modules' sections draw while loaded, not just switched on). */
  private loaded: ReadonlySet<FeatureId> = new Set();
  /** The loaded features and the switches the rows were last built from (`structure()`). */
  private builtFrom = "";
  private ui: SettingsUi | null = null;

  constructor(app: App, private plugin: EscritaPlugin) {
    super(app, plugin);
  }

  /** What every section gets (IMPROVEMENTS 11): saving, committed text fields, rebuilding the rows, numbers. */
  private makeUi(): SettingsUi {
    const save = async () => { await this.plugin.saveSettings(); };
    return {
      app: this.app,
      save,
      defaults: () => defaultsFor(this.plugin.settings.defaultsLanguage),
      saveOnCommit: (c: TextComponent | TextAreaComponent, fallback: () => string, apply: (v: string) => void) => {
        c.inputEl.addEventListener("change", () => {
          const v = c.getValue().trim() || fallback();
          c.setValue(v);
          apply(v);
          void save();
        });
      },
      redraw: () => this.update(),
      num: digitsNumber,
    };
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const ui = this.ui ??= this.makeUi();
    this.loaded = new Set(FEATURE_IDS.filter((id) => this.plugin.features.isOn(id)));
    this.builtFrom = this.structure();
    return slotGroups(sectionOrder(this.loaded).map((slot) => {
      // Obsidian builds the rows in the plugin's onload (addSettingTab calls update()) and on each
      // update(), unguarded: a part that throws costs its own rows, not the plugin's load.
      try {
        return this.slotPart(slot, ui);
      } catch (err) {
        console.error(`Escrita: the ${slot.id} settings failed`, err);
        return { slot, blocks: [], drawsHeading: false };
      }
    }));
  }

  /**
   * Rebuilds the rows (`update()`) when the loaded features, the switches (the universe mode
   * among them) or the language of the defaults (the setup; rows read placeholders and
   * fallbacks from it when built) differ from what they were built from. Called after every registry apply
   * (main.ts) and after the Features page saves, so one change rebuilds once, and a text
   * commit, which changes neither, never does.
   */
  refresh(): void {
    if (this.structure() !== this.builtFrom) this.update();
  }

  private structure(): string {
    const s = this.plugin.settings;
    return JSON.stringify([FEATURE_IDS.filter((id) => this.plugin.features.isOn(id)), switchesOf(s), s.defaultsLanguage]);
  }

  /** One slot's blocks: declarative for a ported module, else the adapter's one row of today's drawing. */
  private slotPart(slot: SectionSlot, ui: SettingsUi): SlotPart {
    if (ADAPTED_CORE.has(slot.id)) {
      return { slot, blocks: [{ items: [adapterRow((el) => this.drawSlot(slot, el, ui))] }], drawsHeading: true };
    }
    const id = slot.feature;
    const mod = id !== null && this.loaded.has(id) ? this.plugin.features.get<FeatureModule>(id) : undefined;
    if (mod?.settingsItems) return { slot, blocks: mod.settingsItems(ui), drawsHeading: false };
    if (id !== null && mod?.settingsSection) {
      return { slot, blocks: [{ items: [adapterRow((el) => this.drawModule(id, el, ui))] }], drawsHeading: true };
    }
    return { slot, blocks: [], drawsHeading: false };
  }

  /** The adapter: a core slot drawn as today (shared rows, headings), then the module's own rows while it is loaded. */
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

  /**
   * A module's rows inside the adapter: its `settingsSection`, or, for a module already on
   * `settingsItems` in a slot whose core part is still drawn here, its items as plain rows.
   */
  private drawModule(id: FeatureId, el: HTMLElement, ui: SettingsUi): void {
    if (!this.loaded.has(id)) return;
    const mod = this.plugin.features.get<FeatureModule>(id);
    if (mod?.settingsItems) drawBlocks(el, mod.settingsItems(ui));
    else mod?.settingsSection?.(el, ui);
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
        ui.saveOnCommit(c, () => ui.defaults()[key], (v) => { s[key] = v; });
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
        c.setPlaceholder(ui.defaults().chaptersFolder).setValue(s.chaptersFolder);
        ui.saveOnCommit(c, () => ui.defaults().chaptersFolder, (v) => { s.chaptersFolder = v; });
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
        c.setPlaceholder(ui.defaults().statusProperty).setValue(s.statusProperty);
        ui.saveOnCommit(c, () => ui.defaults().statusProperty, (v) => { s.statusProperty = v; });
      })
      .addText((c) => {
        c.setPlaceholder(ui.defaults().summaryProperty).setValue(s.summaryProperty);
        ui.saveOnCommit(c, () => ui.defaults().summaryProperty, (v) => { s.summaryProperty = v; });
      });
  }

  /**
   * The Features page (board 21): the writing language, then one row per feature in its
   * group, each with a switch and one line on what it does. The universe's row is the mode
   * dropdown. The stage snapshot is disabled while snapshots is off, its stored value kept.
   */
  private featuresSection(containerEl: HTMLElement, ui: SettingsUi, want: ReadonlySet<FeatureId>): void {
    const s = this.plugin.settings;
    // A switch or the universe mode changes the structure: the registry's apply already
    // rebuilt the rows (main.ts); refresh() rebuilds them when nothing did (a test's plugin).
    const apply = async () => { await ui.save(); this.refresh(); };
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
          await ui.save();
          ui.redraw(); // the gerund rule is named for the language
        });
        d.selectEl.setAttr("aria-label", t("settings.language"));
      });

    this.presetBlock(containerEl, ui);

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

  /**
   * The presets (board 38): a label ("Custom" unless the switches match one), three buttons,
   * and a confirm step that lists what turns off and on. Nothing is saved before Apply. Only
   * this block redraws while asking, so the page keeps its scroll. The setup link shows only
   * while there is no home note.
   */
  private presetBlock(containerEl: HTMLElement, ui: SettingsUi): void {
    const s = this.plugin.settings;
    const block = containerEl.createDiv({ cls: "escrita-presets" });
    let asking: PresetId | null = null;
    const name = (id: PresetId) => t(`settings.features.preset.${id}`);
    const order = FEATURE_PAGE.flatMap((g) => g.ids);
    const list = (ids: FeatureId[]) => ids.length
      ? [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((id) => t(`settings.features.${id}`)).join(", ")
      : t("settings.features.preset.nothing");

    const draw = () => {
      block.empty();
      const current = matchingPreset(switchesOf(s));
      const head = block.createDiv({ cls: "escrita-presets-head" });
      head.createSpan({ cls: "escrita-presets-title", text: t("settings.features.preset.label") });
      head.createSpan({ cls: "escrita-tag escrita-presets-state", text: current ? name(current) : t("settings.features.preset.custom") });
      const row = block.createDiv({ cls: "escrita-presets-row", attr: { role: "group", "aria-label": t("settings.features.preset.group") } });
      for (const id of PRESET_IDS) {
        const b = row.createEl("button", { cls: "escrita-preset-btn", text: name(id) });
        b.toggleClass("is-active", current === id || asking === id);
        b.setAttr("aria-pressed", String(current === id));
        b.addEventListener("click", () => { asking = id; draw(); });
      }
      if (asking) {
        const target = asking;
        const changes = presetChanges(switchesOf(s), target);
        if (changes.off.length + changes.on.length === 0) {
          block.createDiv({ cls: "setting-item-description", text: t("settings.features.preset.already", { name: name(target) }) });
        } else {
          const box = block.createDiv({ cls: "escrita-presets-confirm", attr: { role: "group", "aria-label": t("settings.features.preset.confirmGroup") } });
          box.createDiv({ cls: "escrita-presets-ask", text: t("settings.features.preset.confirm", { name: name(target) }) });
          for (const [key, ids] of [["off", changes.off], ["on", changes.on]] as const) {
            const line = box.createDiv({ cls: "escrita-presets-change" });
            line.createSpan({ cls: "escrita-presets-kind", text: t(`settings.features.preset.${key}`) });
            line.createSpan({ text: list(ids) });
          }
          const note = [t("settings.features.preset.kept"), target === "everything" ? t("settings.features.preset.universe") : ""].filter(Boolean).join(" ");
          box.createDiv({ cls: "setting-item-description", text: note });
          const btns = box.createDiv({ cls: "escrita-presets-btns" });
          btns.createEl("button", { text: t("settings.features.preset.cancel") })
            .addEventListener("click", () => { asking = null; draw(); });
          btns.createEl("button", { cls: "mod-cta", text: t("settings.features.preset.apply") })
            .addEventListener("click", () => {
              Object.assign(s, presetSwitches(target, switchesOf(s)));
              void ui.save().then(() => this.refresh());
            });
        }
      }
      if (!this.plugin.setup.hasHomeNote()) {
        block.createEl("button", { cls: "escrita-link escrita-presets-setup", text: t("settings.features.setupLink") })
          .addEventListener("click", () => this.plugin.setup.open());
      }
    };
    draw();
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
            if (s.stages[k].words.trim() === "") s.stages[k].words = ui.defaults().stages[k].words;
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

/** What one slot gives the tab: its blocks, and whether its own drawing code draws the slot's heading (the adapter). */
export interface SlotPart {
  slot: Pick<SectionSlot, "heading">;
  blocks: readonly SettingsBlock[];
  drawsHeading: boolean;
}

/** The core slots still drawn imperatively, each through one adapter row (until PLAN-1.0.3 Wave 1, task A). */
const ADAPTED_CORE: ReadonlySet<SectionId> = new Set<SectionId>(["features", "shared", "books", "dayEnds", "stages", "placeholders", "editor", "universe"]);

/** The adapter's row: today's drawing code, headings included, run into one custom row. Not searched. */
function adapterRow(draw: (el: HTMLElement) => void): ReturnType<typeof customRow> {
  return customRow("", draw, { cls: "escrita-adapter-row" });
}

/**
 * The groups of the tab, in slot order (Q4). Each slot with a heading starts a group under it,
 * unless its own drawing code still draws the heading (the adapter); a slot without one
 * continues the group above. A block with a heading becomes a group of its own. Empty slots
 * and groups are left out, but an empty slot's heading still opens the rows of a slot without
 * one after it: the thread words with the universe off sit under the universe's heading.
 */
export function slotGroups(parts: readonly SlotPart[]): SettingDefinitionGroup[] {
  const groups: SettingDefinitionGroup[] = [];
  let current: SettingDefinitionGroup | null = null;
  /** The heading the next group opens under: the last slot heading, until a group opens. */
  let opening: string | undefined;
  for (const { slot, blocks, drawsHeading } of parts) {
    if (slot.heading !== null) {
      current = null;
      opening = drawsHeading ? undefined : t(slot.heading);
    }
    if (blocks.every((b) => b.items.length === 0)) continue;
    for (const b of blocks) {
      if (b.heading || current === null) {
        current = { type: "group", items: [] };
        const heading = b.heading || opening;
        if (heading) current.heading = heading;
        groups.push(current);
        opening = undefined;
      }
      current.items!.push(...b.items);
    }
  }
  return groups.filter((g) => (g.items?.length ?? 0) > 0);
}

/**
 * Draws a module's blocks as plain rows into an element, the way Obsidian renders a row (name,
 * description, render, visibility): how a module on `settingsItems` shows inside an adapter row.
 * Goes with the adapter.
 */
function drawBlocks(el: HTMLElement, blocks: readonly SettingsBlock[]): void {
  const group = new SettingGroup(createDiv());   // detached: a render callback may ask for its group
  for (const b of blocks) {
    if (b.heading) new Setting(el).setName(b.heading).setHeading();
    for (const item of b.items) {
      if ("type" in item || !item.render) continue;   // pages and control rows are not used (Q3)
      const row = new Setting(el).setName(item.name);
      if (item.desc) row.setDesc(item.desc);
      item.render(row, group);
      const visible = typeof item.visible === "function" ? item.visible() : item.visible ?? true;
      row.settingEl.toggle(visible);
    }
  }
}
