// @vitest-environment happy-dom
// The settings tab draws the core sections and each loaded module's section from one list
// (PLAN-0.8 task 2.1). The `Setting` stub of tests/support/obsidian.ts records every row.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { FEATURE_IDS, type FeatureId } from "../src/core/features";
import type { FeatureModule, SettingsUi } from "../src/core/module-context";
import { toggleRow, type SettingsBlock } from "../src/ui/settings-rows";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { exportStrings } from "../src/export/strings";
import { submissionsStrings } from "../src/submissions/strings";
import { DEFAULT_SETTINGS, type EscritaSettings } from "../src/settings";
import { EscritaSettingTab, featureGroupHeading, slotGroups } from "../src/settings-tab";
import { FEATURE_GROUPS } from "../src/core/features";
import * as goalsUi from "../src/goals/settings-ui";
import * as outlineUi from "../src/outline/settings-ui";
import * as placeholdersUi from "../src/placeholders/settings-ui";
import * as publishUi from "../src/publish/settings-ui";
import * as snapshotsUi from "../src/snapshots/settings-ui";
import * as explorerUi from "../src/explorer/settings-ui";
import * as universeUi from "../src/universe/settings-ui";
import * as threadsUi from "../src/universe/threads-settings-ui";
import * as darlingsUi from "../src/darlings/settings-ui";
import * as editorUi from "../src/editor/settings-ui";
import * as lensUi from "../src/lens/settings-ui";
import * as deskUi from "../src/desk/settings-ui";
import * as exportUi from "../src/export/settings-ui";
import * as submissionsUi from "../src/submissions/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { openTab, renderBlocks, rowNamed } from "./support/definitions";
import { commit } from "./support/section-ui";

beforeAll(() => { registerStrings(coreStrings); registerStrings(exportStrings); registerStrings(submissionsStrings); });
beforeEach(() => resetSettingLog());

interface Fake {
  tab: EscritaSettingTab;
  settings: EscritaSettings;
  saves: ReturnType<typeof vi.fn>;
  loaded: Set<FeatureId>;
}

/**
 * Modules that own their part of the tab (task 2.2): the real function of each settings-ui file
 * stands in for the module's method. Opened through tests/support/definitions.ts.
 */
const OWNED: Partial<Record<FeatureId, [ns: object, prefix: string]>> = {
  goals: [goalsUi, "goals"], publish: [publishUi, "publish"], outline: [outlineUi, "outline"],
  placeholders: [placeholdersUi, "placeholders"],
  snapshots: [snapshotsUi, "snapshots"], explorerCounts: [explorerUi, "explorer"],
  universe: [universeUi, "universe"], threads: [threadsUi, "threads"],
  darlings: [darlingsUi, "darlings"], typing: [editorUi, "typing"],
  lens: [lensUi, "lens"], desk: [deskUi, "desk"],
  export: [exportUi, "export"], submissions: [submissionsUi, "submissions"],
};

/** A module's part from its settings-ui file: `<prefix>SettingsItems(ui, plugin)`, found by name. */
function fromUi(ns: object, prefix: string, plugin: unknown): Partial<FeatureModule> {
  const items = (ns as Record<string, unknown>)[`${prefix}SettingsItems`];
  if (typeof items === "function") return { settingsItems: (ui) => (items as (ui: SettingsUi, plugin: unknown) => SettingsBlock[])(ui, plugin) };
  throw new Error(`${prefix}: no ${prefix}SettingsItems`);
}

function tabWith(off: FeatureId[] = [], modules: Partial<Record<FeatureId, Partial<FeatureModule>>> = {}): Fake {
  const settings = { ...DEFAULT_SETTINGS, features: {}, stages: structuredClone(DEFAULT_SETTINGS.stages), universeMode: "perBook" as const };
  const loaded = new Set<FeatureId>(FEATURE_IDS.filter((id) => !off.includes(id)));
  const saves = vi.fn(async () => {});
  const plugin = {
    settings, saveSettings: saves, data: { history: {}, leftOff: {} },
    books: { allBooks: () => [] },
    setup: { hasHomeNote: () => true, open: () => {} },
    features: { isOn: (id: FeatureId) => loaded.has(id), get: (id: FeatureId) => (loaded.has(id) ? modules[id] : undefined) },
  };
  for (const [id, [ns, prefix]] of Object.entries(OWNED) as [FeatureId, [object, string]][]) {
    modules[id] ??= fromUi(ns, prefix, plugin);
  }
  const tab = new EscritaSettingTab(new App() as never, plugin as never);
  return { tab, settings, saves, loaded };
}

const headings = () => settingLog.filter((r) => r.heading).map((r) => r.name);
/** The Features page's group headings, as `want` below names them. */
const groupHeadings = FEATURE_GROUPS.map((g) => `group:${g}`);
const names = () => settingLog.map((r) => r.name);

describe("the tab draws from the order list", () => {
  it("with every feature loaded, the headings come in today's order", () => {
    openTab(tabWith().tab);
    const want = ["settings.features", ...groupHeadings, "settings.shared", "settings.books", "settings.forms", "settings.newWorks", "settings.goals", "settings.publishing",
      "export.settings.heading", "submissions.settings.heading", "settings.outline",
      "settings.placeholders", "settings.darlings", "settings.editor", "settings.lens", "settings.lens.rules", "settings.lens.measures",
      "settings.stages", "settings.homeNoteHeading", "settings.snapshots", "universe.settings", "universe.settings.types", "universe.settings.names"];
    expect(headings()).toEqual(want.map((k) => (k.startsWith("group:") ? featureGroupHeading(k.slice(6) as never) : t(k))));
  });

  it("turning a feature off removes its section", () => {
    for (const [id, heading] of [["goals", "settings.goals"], ["lens", "settings.lens"], ["snapshots", "settings.snapshots"],
      ["darlings", "settings.darlings"], ["desk", "settings.homeNoteHeading"], ["outline", "settings.outline"], ["publish", "settings.publishing"]] as const) {
      resetSettingLog();
      openTab(tabWith([id]).tab);
      expect(headings(), id).not.toContain(t(heading));
    }
    resetSettingLog();
    openTab(tabWith(["universe"]).tab);
    expect(headings()).not.toContain(t("universe.settings.types"));
  });

  it("the core sections stay when every module is off", () => {
    openTab(tabWith([...FEATURE_IDS]).tab);
    // the Features page lists every feature, loaded or not, in its groups
    expect(headings()).toEqual([t("settings.features"), ...FEATURE_GROUPS.map(featureGroupHeading), ...["settings.shared", "settings.books", "settings.forms", "settings.newWorks", "settings.stages"].map((k) => t(k))]);
  });

  it("the form rows draw in the books slot under their own Forms heading, with every module off", () => {
    for (const off of [[], [...FEATURE_IDS]] as FeatureId[][]) {
      resetSettingLog();
      openTab(tabWith(off).tab);
      const n = names();
      for (const key of ["settings.formProperty", "settings.formValues", "settings.formFolders"]) {
        expect(n.filter((x) => x === t(key)), `${key} with ${off.length} off`).toHaveLength(1);
        expect(n.indexOf(t(key))).toBeGreaterThan(n.indexOf(t("settings.unnumberedTitles")));
        expect(n.indexOf(t(key))).toBeLessThan(n.indexOf(t("settings.storiesFolder")));
      }
    }
  });

  it("the form rows save: the property and the folders as typed, the values by position", () => {
    const { tab, settings, saves } = tabWith();
    const ui = (tab as unknown as { makeUi(): SettingsUi }).makeUi();
    const items = (tab as unknown as { formItems(ui: SettingsUi): SettingsBlock["items"] }).formItems(ui);
    const { groups } = renderBlocks([{ items }]);
    const field = (key: string) => rowNamed(groups, t(key))!.setting.components[0];
    commit(field("settings.formProperty"), " kind ");
    expect(settings.formProperty).toBe("kind");
    const before = { ...settings.formValues };
    commit(field("settings.formValues"), "a, , c");
    expect(settings.formValues.shortStory).toBe("a");
    expect(settings.formValues.essay).toBe(before.essay);   // a blank item keeps the saved word
    expect(settings.formValues.screenplay).toBe(before.screenplay);
    commit(field("settings.formFolders"), "Roteiros: roteiro");
    expect(settings.formFolders).toBe("Roteiros: roteiro");
    expect(saves).toHaveBeenCalledTimes(3);
  });

  it("the export and submissions folders draw in the shared section with both features off (the classifier reads them)", () => {
    for (const off of [[], ["export", "submissions"], [...FEATURE_IDS]] as FeatureId[][]) {
      resetSettingLog();
      openTab(tabWith(off).tab);
      const n = names();
      for (const key of ["export.settings.folder", "submissions.settings.folder"]) {
        expect(n.filter((x) => x === t(key)), `${key} with ${off.length} off`).toHaveLength(1);
        expect(n.indexOf(t(key))).toBeGreaterThan(n.indexOf(t("settings.excludeFolders")));
        expect(n.indexOf(t(key))).toBeLessThan(n.indexOf(t("settings.books")));
      }
    }
  });

  it("a shared row stays while another feature reads it", () => {
    openTab(tabWith(["placeholders"]).tab);
    expect(names()).toContain(t("settings.placeholderMarker"));
    expect(names()).not.toContain(t("settings.showExplorerDots"));
    resetSettingLog();
    openTab(tabWith(["placeholders", "publish"]).tab);
    expect(names()).not.toContain(t("settings.placeholderMarker"));
    resetSettingLog();
    openTab(tabWith(["typing"]).tab);   // the lens, the dialogue focus and the block mover still read these
    expect(names()).toContain(t("settings.paragraphStyle"));
    expect(names()).not.toContain(t("settings.enterFlow"));
  });

  it("the thread words show with threads on and the universe off", () => {
    openTab(tabWith(["universe"]).tab);
    expect(headings()).toContain(t("universe.settings"));
    expect(names()).toContain(t("universe.settings.threadWord"));
    resetSettingLog();
    openTab(tabWith(["universe", "threads"]).tab);
    expect(headings()).not.toContain(t("universe.settings"));
  });

  it("with the universe loaded, its section draws the thread words once, before the types", () => {
    openTab(tabWith().tab);
    const n = names();
    const word = n.indexOf(t("universe.settings.threadWord"));
    expect(n.filter((x) => x === t("universe.settings.threadWord"))).toHaveLength(1);
    expect(word).toBeLessThan(n.indexOf(t("universe.settings.types")));
    resetSettingLog();
    openTab(tabWith(["threads"]).tab);
    expect(names()).not.toContain(t("universe.settings.threadWord"));
    expect(headings()).toContain(t("universe.settings.types"));
  });

  it("the Features page has one row each for export and submissions, and no placeholder row", () => {
    openTab(tabWith().tab);
    const rows = settingLog.filter((r) => !r.heading).map((r) => r.name);
    expect(rows.filter((n) => n === t("settings.features.export"))).toHaveLength(1);
    expect(rows.filter((n) => n === t("settings.features.submissions"))).toHaveLength(1);
  });

  it("a module's own settingsItems is called instead of its settings-ui file's", () => {
    const own = vi.fn((): SettingsBlock[] => []);
    openTab(tabWith([], { lens: { settingsItems: own } }).tab);
    expect(own).toHaveBeenCalledTimes(1);
    expect(headings()).not.toContain(t("settings.lens"));
  });
});

describe("the declarative tab (PLAN-1.0.3)", () => {
  const configs: FeatureId[][] = [[], [...FEATURE_IDS], ...FEATURE_IDS.map((id) => [id])];

  it("builds groups and rows with unique keys (the harness throws on a duplicate), each heading once", () => {
    for (const off of configs) {
      resetSettingLog();
      expect(() => openTab(tabWith(off).tab), off.join(",")).not.toThrow();
      const h = headings();
      expect(new Set(h).size, off.join(",")).toBe(h.length);
    }
  });

  it("every searchable row has a name", () => {
    const { tab } = tabWith();
    openTab(tab);
    for (const g of tab.settingItems) {
      for (const item of ("items" in g ? g.items ?? [] : [g])) {
        if ("type" in item) continue;
        if (item.searchable !== false) expect(item.name, JSON.stringify(item)).not.toBe("");
      }
    }
  });

  it("a ported module's rows sit in a group under the slot's heading", () => {
    const open = openTab(tabWith().tab);
    const group = open.groups().find((g) => g.def.heading === t("settings.outline"));
    expect(group?.rows.map((r) => r.def.name)).toEqual([t("settings.ghostBeats")]);
  });

  it("a module on settingsItems in a slot with a core part shows under the core's rows", () => {
    const items = (ui: SettingsUi): SettingsBlock[] => [{ items: [toggleRow(ui, { name: "Dots", get: () => true, set: () => {} })] }];
    openTab(tabWith([], { placeholders: { settingsItems: items } }).tab);
    const n = names();
    expect(n.indexOf("Dots")).toBeGreaterThan(n.indexOf(t("settings.placeholderMarker")));
    expect(n.indexOf("Dots")).toBeLessThan(settingLog.findIndex((r) => r.heading && r.name === t("settings.darlings")));
  });

  it("ui.redraw() rebuilds the rows (update)", () => {
    const { tab } = tabWith();
    openTab(tab);
    const update = vi.spyOn(tab, "update");
    (tab as unknown as { makeUi(): SettingsUi }).makeUi().redraw();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("a module whose rows fail to build costs only its own section (the rows are built in onload)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const broken = { settingsItems: (): SettingsBlock[] => { throw new Error("broken"); } };
      expect(() => openTab(tabWith([], { lens: broken }).tab)).not.toThrow();
      expect(error).toHaveBeenCalledTimes(1);
      expect(headings()).not.toContain(t("settings.lens"));
      expect(headings()).toContain(t("settings.editor"));
      expect(headings()).toContain(t("settings.stages"));
    } finally {
      error.mockRestore();
    }
  });
});

describe("slotGroups", () => {
  const rows = (...names: string[]): SettingsBlock[] => [{ items: names.map((name) => ({ name, render: () => {} })) }];
  const shape = (parts: Parameters<typeof slotGroups>[0]) =>
    slotGroups(parts).map((g) => [g.heading, (g.items ?? []).map((i) => ("name" in i ? i.name : ""))]);

  it("a slot without a heading continues the group above; a block with one opens its own group", () => {
    expect(shape([
      { slot: { heading: "settings.books" }, blocks: rows("Chapters folder") },
      { slot: { heading: null }, blocks: rows("Day ends at") },
      { slot: { heading: "settings.lens" }, blocks: [...rows("Echo"), { heading: "Rules", items: rows("Adverbs")[0].items }] },
    ])).toEqual([
      [t("settings.books"), ["Chapters folder", "Day ends at"]],
      [t("settings.lens"), ["Echo"]],
      ["Rules", ["Adverbs"]],
    ]);
  });

  it("after an empty slot, a slot without a heading opens under the empty slot's heading (threads with the universe off)", () => {
    expect(shape([
      { slot: { heading: "settings.snapshots" }, blocks: rows("Snapshots folder") },
      { slot: { heading: "universe.settings" }, blocks: [] },
      { slot: { heading: null }, blocks: rows("Thread word") },
    ])).toEqual([
      [t("settings.snapshots"), ["Snapshots folder"]],
      [t("universe.settings"), ["Thread word"]],
    ]);
  });
});

describe("saveOnCommit", () => {
  function field() {
    const input = document.createElement("input");
    let kept = "";
    return {
      input,
      c: { inputEl: input, getValue: () => input.value, setValue: (v: string) => { input.value = v; kept = v; } },
      kept: () => kept,
    };
  }

  it("saves on change, not at each key, and shows what was kept", () => {
    const { tab, saves } = tabWith();
    const ui = (tab as unknown as { makeUi(): import("../src/core/module-context").SettingsUi }).makeUi();
    const f = field();
    const applied: string[] = [];
    ui.saveOnCommit(f.c as never, () => "fallback", (v) => applied.push(v));

    f.input.value = " Cha";
    f.input.dispatchEvent(new Event("input"));
    f.input.value = " Chapters ";
    f.input.dispatchEvent(new Event("input"));
    expect(saves).not.toHaveBeenCalled();
    expect(applied).toEqual([]);

    f.input.dispatchEvent(new Event("change"));
    expect(applied).toEqual(["Chapters"]);
    expect(f.kept()).toBe("Chapters");
    expect(saves).toHaveBeenCalledTimes(1);
  });

  it("a blank field becomes the fallback", () => {
    const { tab } = tabWith();
    const ui = (tab as unknown as { makeUi(): import("../src/core/module-context").SettingsUi }).makeUi();
    const f = field();
    const applied: string[] = [];
    ui.saveOnCommit(f.c as never, () => "Chapters", (v) => applied.push(v));
    f.input.value = "   ";
    f.input.dispatchEvent(new Event("change"));
    expect(applied).toEqual(["Chapters"]);
    expect(f.input.value).toBe("Chapters");
  });

  it("with read, an unchanged value writes nothing and a changed one saves", () => {
    const { tab, saves } = tabWith();
    const ui = (tab as unknown as { makeUi(): import("../src/core/module-context").SettingsUi }).makeUi();
    const f = field();
    let stored = "a";
    ui.saveOnCommit(f.c as never, () => "a", (v) => { stored = v.toLowerCase(); }, () => stored);
    f.input.value = " A ";
    f.input.dispatchEvent(new Event("change"));
    expect(stored).toBe("a");
    expect(saves).not.toHaveBeenCalled();
    f.input.value = "b";
    f.input.dispatchEvent(new Event("change"));
    expect(stored).toBe("b");
    expect(saves).toHaveBeenCalledTimes(1);
  });

  it("takes a plain input: trims, falls back, shows what was kept", () => {
    const { tab, saves } = tabWith();
    const ui = (tab as unknown as { makeUi(): import("../src/core/module-context").SettingsUi }).makeUi();
    const input = document.createElement("input");
    const applied: string[] = [];
    ui.saveOnCommit(input, () => "dflt", (v) => applied.push(v));
    input.value = "  x ";
    input.dispatchEvent(new Event("change"));
    input.value = " ";
    input.dispatchEvent(new Event("change"));
    expect(applied).toEqual(["x", "dflt"]);
    expect(input.value).toBe("dflt");
    expect(saves).toHaveBeenCalledTimes(2);
  });

  it("num keeps the digits, at least min, and the fallback for a field with no digit", () => {
    const ui = (tabWith().tab as unknown as { makeUi(): import("../src/core/module-context").SettingsUi }).makeUi();
    expect(ui.num("1,500", 9)).toBe(1500);
    expect(ui.num("", 9)).toBe(9);
    expect(ui.num("abc", 9)).toBe(9);
    expect(ui.num("3", 9, 50)).toBe(50);
  });
});

describe("makeUi().defaults()", () => {
  it("follows the install's defaultsLanguage, not the English schema", () => {
    const { tab, settings } = tabWith();
    const ui = (tab as unknown as { makeUi(): import("../src/core/module-context").SettingsUi }).makeUi();
    expect(ui.defaults().chaptersFolder).toBe("Chapters");
    settings.defaultsLanguage = "pt-BR";
    expect(ui.defaults().chaptersFolder).toBe("Capítulos");
    expect(ui.defaults().threadClosedWord).toBe("fechada");
  });
});
