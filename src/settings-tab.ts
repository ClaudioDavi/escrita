// The settings tab (PLAN-1.0.3): Obsidian's declarative settings, so Escrita's rows show in the
// settings search (1.13+). `getSettingDefinitions` makes one group per slot of the order list
// (core/settings-order.ts), under the slot's heading: the core's rows for the slot, then the
// module's blocks (`settingsItems`). Obsidian computes the rows when the tab is added and on each
// `update()`, never when the tab opens, so the tab calls `update()` whenever the structure changes
// (Q5): a feature loads or unloads, the switches or the universe mode change (`refresh`, through
// the registry's `onApplied`), or a section asks (`ui.redraw()`). Never after a text field commits.
//
// Every core slot is built here with the row helpers (ui/settings-rows.ts). A row that depends on
// the loaded features is left out when the rows are built (`rowShown(key, this.loaded)`), never
// hidden with `visible`: the tab rebuilds on every change of the loaded set, the switches, the
// language of the defaults and the lens's language, so the build is always current.

import { App, Notice, PluginSettingTab, Setting, type ColorComponent, type SettingDefinitionGroup, type SettingDefinitionItem, type SettingDefinitionRender, type SettingGroupItem } from "obsidian";
import type EscritaPlugin from "./main";
import { lang, t } from "./i18n";
import { PRESET_IDS, matchingPreset, presetChanges, presetSwitches, type PresetId } from "./core/feature-presets";
import { STAGES, hexColor, stageConflicts, writtenWord, type Stage } from "./core/stages";
import { FEATURE_IDS, FEATURE_PAGE, FEATURE_SPECS, wanted, type FeatureGroup, type FeatureId } from "./core/features";
import { switchesOf } from "./core/feature-registry";
import { sectionOrder, type SectionSlot } from "./core/settings-order";
import type { FeatureModule, SettingsUi } from "./core/module-context";
import type { UniverseMode } from "./universe/settings";
import { formValuesText, parseFormValues } from "./core/form";
import { pluginRoot } from "./core/classify";
import { holdsOwnNotes, pluginFolderProblem, type BookPaths } from "./core/folder-problem";
import { FolderSuggest, NoteSuggest } from "./ui/suggest";
import { customRow, drawnRow, wireCommit, dropdownRow, folderRow, noteRow, textAreaRow, textRow, toggleRow, type SettingsBlock, type TextKey } from "./ui/settings-rows";
import { defaultsFor, digitsNumber, rowShown, setFeature, type EscritaSettings, type ParagraphStyle, type QuoteStyle } from "./settings";

/** What the color input holds while a stage has no color (not black, so black is a real choice). */
const EMPTY_SWATCH = "#808080";

/**
 * The export and submissions folders. The classifier reads both whether or not their feature is
 * loaded (never tracked, never a work), so they are drawn from the core, next to the track and
 * exclude folders, with every feature on or off. `books` is every book (BookService.allBooksEverywhere),
 * read only when a value is checked.
 */
export function pluginFolderRows(ui: SettingsUi, s: EscritaSettings, books: () => readonly BookPaths[]): SettingDefinitionRender[] {
  // every file, not only notes: a folder of the writer's .docx files is theirs too
  const paths = () => ui.app.vault.getFiles().map((f) => f.path);
  return [
    folderRow(ui, {
      name: t("export.settings.folder"),
      desc: t("export.settings.folder.desc"),
      placeholder: ui.defaults().exportFolder,
      get: () => s.exportFolder,
      set: (v) => { s.exportFolder = pluginRoot("export", { ...s, exportFolder: v }); },
      problemOf: (v) => pluginFolderProblem(
        pluginRoot("export", { ...s, exportFolder: v }), [pluginRoot("submissions", s), pluginRoot("snapshots", s)],
        ui.app.vault.configDir, s.trackFolders, (r) => holdsOwnNotes(paths(), r, pluginRoot("export", s), s), books(),
      ),
    }),
    folderRow(ui, {
      name: t("submissions.settings.folder"),
      desc: t("submissions.settings.folder.desc"),
      placeholder: ui.defaults().submissionsFolder,
      get: () => s.submissionsFolder,
      set: (v) => { s.submissionsFolder = pluginRoot("submissions", { ...s, submissionsFolder: v }); },
      problemOf: (v) => pluginFolderProblem(
        pluginRoot("submissions", { ...s, submissionsFolder: v }), [pluginRoot("export", s), pluginRoot("snapshots", s)],
        ui.app.vault.configDir, s.trackFolders, (r) => holdsOwnNotes(paths(), r, pluginRoot("submissions", s), s), books(),
      ),
    }),
  ];
}

/**
 * The heading of a Features page group (Writing, Revision, ...), plain as on board 40. Obsidian
 * matches groups by heading, so no section repeats one: the lens's section is "Revision · the
 * lens" and the publish check's "Publishing · the check" (tests/settings-core-rows.test.ts).
 */
export function featureGroupHeading(group: FeatureGroup): string {
  return t(`settings.features.group.${group}`);
}

/** The status property, then the summary property, two fields in one row (as goals' sprint row composes two). */
function statusAndSummaryRow(ui: SettingsUi, s: EscritaSettings): SettingDefinitionRender {
  const status = textRow(ui, {
    name: t("settings.statusProperty"),
    desc: t("settings.statusProperty.desc"),
    key: "statusProperty",
    placeholder: ui.defaults().statusProperty,
    get: () => s.statusProperty,
    set: (v) => { s.statusProperty = v; },
  });
  // Only its field is drawn (into the status row), so the name is just the field's label.
  const summary = textRow(ui, {
    name: t("settings.summaryProperty"),
    key: "summaryProperty",
    placeholder: ui.defaults().summaryProperty,
    get: () => s.summaryProperty,
    set: (v) => { s.summaryProperty = v; },
  });
  return {
    ...status,
    render: (setting, group) => {
      const a = status.render?.(setting, group);
      const b = summary.render?.(setting, group);
      return () => { a?.(); b?.(); };
    },
  };
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
      saveOnCommit: (c, fallback, apply, read) => wireCommit(c, fallback, apply, read, save),
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
        return { slot, blocks: [] };
      }
    }));
  }

  /**
   * Rebuilds the rows (`update()`) when the loaded features, the switches (the universe mode
   * among them), the language of the defaults (the setup; rows read placeholders and
   * fallbacks from it when built) or the lens's language (its rule names, the adverb rule's
   * description and the lists placeholder; the setup or the Features page) differ from what
   * they were built from. Called after every registry apply (main.ts) and after the Features
   * page saves, so one change rebuilds once, and a text commit, which changes none, never does.
   */
  refresh(): void {
    if (this.structure() !== this.builtFrom) this.update();
  }

  private structure(): string {
    const s = this.plugin.settings;
    return JSON.stringify([FEATURE_IDS.filter((id) => this.plugin.features.isOn(id)), switchesOf(s), s.defaultsLanguage, s.lensLanguage]);
  }

  /**
   * One slot's blocks: the core's rows of the slot, then the module's. The editor slot puts the
   * typing module's rows first and the rows shared by several features after them.
   */
  private slotPart(slot: SectionSlot, ui: SettingsUi): SlotPart {
    const core = this.coreBlocks(slot, ui);
    const mod = this.moduleBlocks(slot.feature, ui);
    const blocks = slot.id === "editor" ? [...mod, ...(core ?? [])] : [...(core ?? []), ...mod];
    return { slot, blocks };
  }

  /** A module's blocks while it is loaded. */
  private moduleBlocks(id: FeatureId | null, ui: SettingsUi): SettingsBlock[] {
    const mod = id !== null && this.loaded.has(id) ? this.plugin.features.get<FeatureModule>(id) : undefined;
    return mod?.settingsItems?.(ui) ?? [];
  }

  /** The rows the core draws in a slot, or null for a slot that is only a module's. */
  private coreBlocks(slot: SectionSlot, ui: SettingsUi): SettingsBlock[] | null {
    const s = this.plugin.settings;
    const shown = (key: string) => rowShown(key, this.loaded);
    switch (slot.id) {
      case "features": return this.featuresBlocks(ui);
      case "shared": return [{ items: this.sharedItems(ui) }];
      case "books": return [{ items: this.booksItems(ui, shown("templatesFolder")) }];
      case "dayEnds": return shown("dayEndsAt") ? [{ items: [this.dayEndsRow(ui)] }] : [];
      case "forms": return [{ items: this.formItems(ui) }];
      case "newWorks": return [{ items: this.newWorksItems(ui, shown("booksFolder")) }];
      case "stages": return [{ items: this.stagesItems(ui) }];
      case "placeholders":
        // The heading and the marker are shared with publish; the module adds its own rows under them.
        return [{
          items: [textRow(ui, {
            name: t("settings.placeholderMarker"),
            desc: () => t("settings.placeholderMarker.desc", { marker: s.placeholderMarker }),
            get: () => s.placeholderMarker,
            set: (v) => { s.placeholderMarker = v.replace(/[^\p{L}\p{N}_-]/gu, "") || "XXX"; },
            fallback: () => "XXX",
          })],
        }];
      case "editor": return [{ items: this.editorSharedItems(ui, shown) }];
      // Only the heading: the module's rows, or the thread words alone (the slot after it), go under it.
      case "universe": return [];
      default: return null;
    }
  }

  /** Names and folders several features read: always shown (Q13). */
  private sharedItems(ui: SettingsUi): SettingGroupItem[] {
    const s = this.plugin.settings;
    type PropertyKey = Extract<TextKey, "targetProperty" | "limitProperty" | "unitProperty" | "deadlineProperty" | "goalProperty" | "povProperty" | "chapterTargetProperty">;
    const property = (key: PropertyKey, name: string, placeholder: string, desc?: string) =>
      textRow(ui, { name, desc, placeholder, key, get: () => s[key], set: (v) => { s[key] = v; } });
    return [
      noteRow(t("settings.shared.desc"), "escrita-shared-desc"),
      property("targetProperty", t("settings.targetProperty"), "target", t("settings.pieceProperties.desc")),
      property("limitProperty", t("settings.limitProperty"), "limit"),
      property("unitProperty", t("settings.unitProperty"), "unit"),
      property("deadlineProperty", t("settings.deadlineProperty"), "deadline"),
      property("goalProperty", t("settings.goalProperty"), "goal", t("settings.goalProperty.desc")),
      property("povProperty", t("settings.povProperty"), "pov", t("settings.povProperty.desc")),
      property("chapterTargetProperty", t("settings.chapterTargetProperty"), "chapterTarget", t("settings.chapterTargetProperty.desc")),
      textAreaRow(ui, {
        name: t("settings.trackFolders"),
        desc: t("settings.trackFolders.desc"),
        placeholder: t("settings.trackFolders.example"),
        get: () => s.trackFolders,
        set: (v) => { s.trackFolders = v; },
      }),
      textAreaRow(ui, { name: t("settings.excludeFolders"), get: () => s.excludeFolders, set: (v) => { s.excludeFolders = v; } }),
      ...pluginFolderRows(ui, s, () => this.plugin.books.allBooksEverywhere()),
    ];
  }

  private booksItems(ui: SettingsUi, templatesShown: boolean): SettingGroupItem[] {
    const s = this.plugin.settings;
    return [
      textRow(ui, {
        name: t("settings.chaptersFolder"),
        desc: t("settings.chaptersFolder.desc"),
        placeholder: ui.defaults().chaptersFolder,
        key: "chaptersFolder",
        get: () => s.chaptersFolder,
        set: (v) => { s.chaptersFolder = v; },
      }),
      textRow(ui, {
        name: t("settings.chapterTemplate"),
        desc: t("settings.chapterTemplate.desc"),
        placeholder: "Templates/Chapter.md",
        get: () => s.chapterTemplate,
        set: (v) => { s.chapterTemplate = v; },
      }),
      ...(templatesShown ? [textRow(ui, {
        name: t("settings.templatesFolder"),
        desc: t("settings.templatesFolder.desc"),
        placeholder: "Templates",
        get: () => s.templatesFolder,
        set: (v) => { s.templatesFolder = v; },
      })] : []),
      dropdownRow(ui, {
        name: t("settings.numberPadding"),
        desc: t("settings.numberPadding.desc"),
        options: [1, 2, 3, 4].map((w) => [w, "1".padStart(w, "0")] as const),
        get: () => s.numberPadding,
        set: (v) => { s.numberPadding = v; },
      }),
      textAreaRow(ui, {
        name: t("settings.unnumberedTitles"),
        desc: t("settings.unnumberedTitles.desc"),
        placeholder: t("settings.unnumberedTitles.example"),
        get: () => s.unnumberedTitles,
        set: (v) => { s.unnumberedTitles = v; },
      }),
      statusAndSummaryRow(ui, s),
    ];
  }

  /** The form rows (1.1, PLAN-1.1 Q1): they moved here from the universe, because the form matters with it off. */
  private formItems(ui: SettingsUi): SettingGroupItem[] {
    const s = this.plugin.settings;
    return [
      textRow(ui, {
        name: t("settings.formProperty"),
        desc: t("settings.formProperty.desc"),
        placeholder: ui.defaults().formProperty,
        key: "formProperty",
        get: () => s.formProperty,
        set: (v) => { s.formProperty = v; },
      }),
      // by position; a blank or unreadable text keeps the saved words (parseFormValues)
      textRow(ui, {
        name: t("settings.formValues"),
        desc: t("settings.formValues.desc"),
        placeholder: formValuesText(ui.defaults().formValues),
        get: () => formValuesText(s.formValues),
        set: (v) => { s.formValues = parseFormValues(v, s.formValues); },
        fallback: () => formValuesText(s.formValues),
      }),
      textAreaRow(ui, {
        name: t("settings.formFolders"),
        desc: t("settings.formFolders.desc"),
        placeholder: t("settings.formFolders.example"),
        get: () => s.formFolders,
        set: (v) => { s.formFolders = v; },
      }),
    ];
  }

  private dayEndsRow(ui: SettingsUi): SettingGroupItem {
    const s = this.plugin.settings;
    return dropdownRow(ui, {
      name: t("settings.dayEndsAt"),
      desc: t("settings.dayEndsAt.desc"),
      options: [0, 1, 2, 3, 4, 5, 6].map((h) => [h, `${String(h).padStart(2, "0")}:00`] as const),
      get: () => s.dayEndsAt,
      set: (v) => { s.dayEndsAt = v; },
    });
  }

  /** Where New short story, New screenplay and New book create, and the templates they use (1.0.4, Q5). The book rows follow the outline. */
  private newWorksItems(ui: SettingsUi, bookRowsShown: boolean): SettingGroupItem[] {
    const s = this.plugin.settings;
    const app = ui.app;
    const folder = (key: "storiesFolder" | "screenplaysFolder" | "booksFolder", name: string, desc: string) => folderRow(ui, {
      name, desc, placeholder: "", get: () => s[key], set: (v) => { s[key] = v; },
      problemOf: () => null, suggest: (input) => { new FolderSuggest(app, input); },
    });
    const template = (key: "storyTemplate" | "screenplayTemplate" | "bookNoteTemplate", name: string, desc: string) => textRow(ui, {
      name, desc, placeholder: t("new-work.modal.builtIn"), key, get: () => s[key], set: (v) => { s[key] = v; },
      suggest: (input) => { new NoteSuggest(app, input); },
    });
    return [
      folder("storiesFolder", t("settings.storiesFolder"), t("settings.storiesFolder.desc")),
      template("storyTemplate", t("settings.storyTemplate"), t("settings.storyTemplate.desc")),
      folder("screenplaysFolder", t("settings.screenplaysFolder"), t("settings.screenplaysFolder.desc")),
      template("screenplayTemplate", t("settings.screenplayTemplate"), t("settings.screenplayTemplate.desc")),
      ...(bookRowsShown ? [
        folder("booksFolder", t("settings.booksFolder"), t("settings.booksFolder.desc")),
        template("bookNoteTemplate", t("settings.bookNoteTemplate"), t("settings.bookNoteTemplate.desc")),
      ] : []),
    ];
  }

  /**
   * The Features page (board 21, board 40): the writing language and the presets under the
   * slot's heading, then one block (a group) per feature group, each row with a switch and one
   * line on what it does. The universe's row is the mode dropdown. The stage snapshot is
   * disabled while snapshots is off, its stored value kept.
   */
  private featuresBlocks(ui: SettingsUi): SettingsBlock[] {
    const s = this.plugin.settings;
    // A switch or the universe mode changes the structure: the registry's apply already
    // rebuilt the rows (main.ts); refresh() rebuilds them when nothing did (a test's plugin).
    const apply = async () => { await ui.save(); this.refresh(); };
    const afterSave = (then: () => void): SettingsUi => ({ ...ui, save: async () => { await ui.save(); then(); } });
    const want = wanted(switchesOf(s));
    const desc = (id: FeatureId) => () => t(`settings.features.${id}.desc`, { marker: s.placeholderMarker, keyword: s.threadKeyword });

    const blocks: SettingsBlock[] = [{
      items: [
        noteRow(t("settings.features.desc"), "escrita-features-desc"),
        dropdownRow(afterSave(() => this.refresh()), {   // the lens's rows are named for the language
          name: t("settings.language"),
          desc: t("settings.language.desc"),
          options: [["auto", t("settings.language.auto")], ["pt-BR", t("settings.language.pt")], ["en", t("settings.language.en")]],
          get: () => s.lensLanguage,
          set: (v) => { s.lensLanguage = v; },
        }),
        customRow(t("settings.features.preset.label"), (el) => this.drawPresets(el, ui)),
      ],
    }];

    for (const { group, ids } of FEATURE_PAGE) {
      const items: SettingGroupItem[] = [];
      if (group === "desk") {
        items.push(drawnRow({ name: t("settings.features.stages"), desc: t("settings.features.stages.desc"), cls: "escrita-feature-row" }, (row) => {
          row.nameEl.createSpan({ cls: "escrita-tag", text: t("settings.features.alwaysOn") });
        }));
      }
      for (const id of ids) {
        const spec = FEATURE_SPECS.find((f) => f.id === id)!;
        const name = t(`settings.features.${id}`);

        if (id === "universe") {
          items.push(dropdownRow(afterSave(() => this.refresh()), {
            name,
            desc: desc(id),
            cls: "escrita-feature-row",
            options: [
              ["universe", t("universe.settings.mode.universe")],
              ["perBook", t("universe.settings.mode.perBook")],
              ["off", t("universe.settings.mode.off")],
            ] as readonly (readonly [UniverseMode, string])[],
            get: () => s.universeMode,
            set: (v) => { s.universeMode = v; },
          }));
          continue;
        }

        items.push(drawnRow({ name, desc: desc(id), cls: "escrita-feature-row" }, (row) => {
          const now = wanted(switchesOf(s));
          const needs = spec.requires?.find((r) => !now.has(r));
          const on = now.has(id);
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
          addSwitch(row, name, shownOn, needs !== undefined, async (v) => {
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
        }));

        // The explorer's own rows sit right under its switch while it is on and loaded (Q13).
        if (id === "explorerCounts" && want.has(id)) {
          items.push(...this.moduleBlocks("explorerCounts", ui).flatMap((b) => b.items));
        }
      }
      blocks.push({ heading: featureGroupHeading(group), items });
    }
    return blocks;
  }

  /**
   * The presets (board 38): a label ("Custom" unless the switches match one), three buttons,
   * and a confirm step that lists what turns off and on. Nothing is saved before Apply. Only
   * this block redraws while asking, so the page keeps its scroll. The setup link shows only
   * while there is no home note.
   */
  private drawPresets(containerEl: HTMLElement, ui: SettingsUi): void {
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
  private editorSharedItems(ui: SettingsUi, shown: (key: string) => boolean): SettingGroupItem[] {
    const s = this.plugin.settings;
    const items: SettingGroupItem[] = [];
    if (shown("paragraphStyle")) {
      items.push(dropdownRow<ParagraphStyle>(ui, {
        name: t("settings.paragraphStyle"),
        desc: t("settings.paragraphStyle.desc"),
        options: [["blank", t("settings.paragraphStyle.blank")], ["single", t("settings.paragraphStyle.single")]],
        get: () => s.paragraphStyle,
        set: (v) => { s.paragraphStyle = v; },
      }));
    }
    if (shown("quoteStyle")) {
      items.push(dropdownRow<QuoteStyle>(ui, {
        name: t("settings.quoteStyle"),
        options: [["curly", "“…” ‘…’"], ["guillemets", "«…» ‹…›"], ["german", "„…“ ‚…‘"], ["off", t("settings.quoteStyle.off")]],
        get: () => s.quoteStyle,
        set: (v) => { s.quoteStyle = v; },
      }));
    }
    return items;
  }

  /**
   * The Stages section: one row per stage (words, color, clear; the duplicate warning in the
   * row), the other-status-colors box and the draft switch. A duplicate word never blocks
   * saving; the first stage wins (stageOf).
   */
  private stagesItems(ui: SettingsUi): SettingGroupItem[] {
    const s = this.plugin.settings;

    // Each stage row draws its own warning line and registers it here; one repeated word shows
    // under the last stage that repeats it, and a change of words updates every line.
    const warnings = new Map<Stage, HTMLElement>();
    const showWarnings = () => {
      const lines = new Map<Stage, string>();
      for (const c of stageConflicts(s.stages)) {
        const names = c.stages.map((k) => t(`stage.${k}`));
        const text = t("settings.stages.duplicate", { word: c.word, stages: listJoin(names), first: names[0] });
        const last = c.stages[c.stages.length - 1];
        lines.set(last, lines.has(last) ? `${lines.get(last)} ${text}` : text);
      }
      for (const [k, el] of warnings) {
        const text = lines.get(k) ?? "";
        el.setText(text);
        el.toggle(text !== "");
      }
    };

    const stageRow = (k: Stage) => drawnRow({ name: t(`stage.${k}`), cls: "escrita-stage-row" }, (setting) => {
      const stage = t(`stage.${k}`).toLowerCase();
      let swatch: HTMLInputElement | null = null;
      let clear: HTMLButtonElement | null = null;
      const paint = () => {
        const color = hexColor(s.stages[k].color);
        swatch?.toggleClass("escrita-swatch-empty", !color);
        clear?.toggle(!!color);
        swatch?.setAttr("aria-label", color ? t("settings.stages.color", { stage }) : t("settings.stages.noColor"));
      };
      setting.addText((c) => {
        c.setValue(s.stages[k].words);
        c.inputEl.addClass("escrita-stage-words");
        c.inputEl.setAttr("aria-label", t("settings.stages.words", { stage }));
        // Saved when the writer commits the field (Enter or leaving it), never per key. An empty field
        // is never stored: it shows the previous (or default) words again.
        ui.saveOnCommit(
          c,
          () => (s.stages[k].words.trim() === "" ? ui.defaults().stages[k].words : s.stages[k].words),
          (v) => { s.stages[k].words = v; showWarnings(); },
          () => s.stages[k].words,
        );
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
      // The warning lives in the row (its description, inside the info element), so a re-render can't orphan it.
      const warning = setting.descEl.createDiv({ cls: "escrita-setting-warning escrita-stage-warning" });
      warnings.set(k, warning);
      showWarnings();
      return () => { if (warnings.get(k) === warning) warnings.delete(k); };
    });

    return [
      noteRow(t("settings.stages.desc"), "escrita-stages-desc"),
      ...STAGES.map(stageRow),
      textAreaRow(ui, {
        name: t("settings.otherStatusColors"),
        desc: t("settings.otherStatusColors.desc"),
        placeholder: t("settings.otherStatusColors.example"),
        inputCls: "escrita-mono",
        get: () => s.otherStatusColors,
        set: (v) => { s.otherStatusColors = v; },
      }),
      toggleRow(ui, {
        name: t("settings.draftNewNotes"),
        desc: () => t("settings.draftNewNotes.desc", { word: writtenWord(s.stages, "draft") }),
        get: () => s.draftNewNotes,
        set: (v) => { s.draftNewNotes = v; },
      }),
    ];
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

/** What one slot gives the tab: its blocks. */
export interface SlotPart {
  slot: Pick<SectionSlot, "heading">;
  blocks: readonly SettingsBlock[];
}

/**
 * The groups of the tab, in slot order (Q4). Each slot with a heading starts a group under it;
 * a slot without one continues the group above. A block with a heading becomes a group of its own. Empty slots
 * and groups are left out, but an empty slot's heading still opens the rows of a slot without
 * one after it: the thread words with the universe off sit under the universe's heading.
 */
export function slotGroups(parts: readonly SlotPart[]): SettingDefinitionGroup[] {
  const groups: SettingDefinitionGroup[] = [];
  let current: SettingDefinitionGroup | null = null;
  /** The heading the next group opens under: the last slot heading, until a group opens. */
  let opening: string | undefined;
  for (const { slot, blocks } of parts) {
    if (slot.heading !== null) {
      current = null;
      opening = t(slot.heading);
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
