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
import { DEFAULT_SETTINGS, type EscritaSettings } from "../src/settings";
import { EscritaSettingTab } from "../src/settings-tab";
import { goalsSettingsSection } from "../src/goals/settings-ui";
import { outlineSettingsItems } from "../src/outline/settings-ui";
import { placeholdersSettingsSection } from "../src/placeholders/settings-ui";
import { publishSettingsSection } from "../src/publish/settings-ui";
import { snapshotsSettingsSection } from "../src/snapshots/settings-ui";
import { explorerSettingsSection } from "../src/explorer/settings-ui";
import { universeSettingsSection } from "../src/universe/settings-ui";
import { threadsSettingsSection } from "../src/universe/threads-settings-ui";
import { darlingsSettingsSection } from "../src/darlings/settings-ui";
import { typingSettingsSection } from "../src/editor/settings-ui";
import { lensSettingsSection } from "../src/lens/settings-ui";
import { deskSettingsSection } from "../src/desk/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { openTab } from "./support/definitions";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

interface Fake {
  tab: EscritaSettingTab;
  settings: EscritaSettings;
  saves: ReturnType<typeof vi.fn>;
  loaded: Set<FeatureId>;
}

/** Modules that own their section (task 2.2): the real draw function stands in for the module's method. Opened through tests/support/definitions.ts. */
type Draw = (el: HTMLElement, ui: never, plugin: never) => void;
const OWNED: Partial<Record<FeatureId, Draw>> = {
  goals: goalsSettingsSection as Draw, publish: publishSettingsSection as Draw,
  placeholders: placeholdersSettingsSection as Draw,
  snapshots: snapshotsSettingsSection as Draw, explorerCounts: explorerSettingsSection as Draw,
  universe: universeSettingsSection as Draw, threads: threadsSettingsSection as Draw,
  darlings: darlingsSettingsSection as Draw, typing: typingSettingsSection as Draw,
  lens: lensSettingsSection as Draw, desk: deskSettingsSection as Draw,
};

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
  for (const [id, draw] of Object.entries(OWNED) as [FeatureId, Draw][]) {
    modules[id] ??= { settingsSection: (el, ui) => draw(el, ui as never, plugin as never) };
  }
  // ported to settingsItems (PLAN-1.0.3 Wave 0)
  modules.outline ??= { settingsItems: (ui) => outlineSettingsItems(ui, plugin as never) };
  const tab = new EscritaSettingTab(new App() as never, plugin as never);
  return { tab, settings, saves, loaded };
}

const headings = () => settingLog.filter((r) => r.heading).map((r) => r.name);
const names = () => settingLog.map((r) => r.name);

describe("the tab draws from the order list", () => {
  it("with every feature loaded, the headings come in today's order", () => {
    openTab(tabWith().tab);
    const want = ["settings.features", "settings.shared", "settings.books", "settings.goals", "settings.publishing", "settings.outline",
      "settings.placeholders", "settings.darlings", "settings.editor", "settings.lens", "settings.lens.rules", "settings.lens.measures",
      "settings.stages", "settings.homeNoteHeading", "settings.snapshots", "universe.settings", "universe.settings.types", "universe.settings.names"];
    expect(headings()).toEqual(want.map((k) => t(k)));
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
    expect(headings()).toEqual(["settings.features", "settings.shared", "settings.books", "settings.stages"].map((k) => t(k)));
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

  it("with the universe loaded, its section draws the thread words once, between the form and the types", () => {
    openTab(tabWith().tab);
    const n = names();
    const word = n.indexOf(t("universe.settings.threadWord"));
    expect(n.filter((x) => x === t("universe.settings.threadWord"))).toHaveLength(1);
    expect(word).toBeGreaterThan(n.indexOf(t("universe.settings.form")));
    expect(word).toBeLessThan(n.indexOf(t("universe.settings.types")));
    resetSettingLog();
    openTab(tabWith(["threads"]).tab);
    expect(names()).not.toContain(t("universe.settings.threadWord"));
    expect(headings()).toContain(t("universe.settings.types"));
  });

  it("the Features page has one row each for export and submissions, and no placeholder row", () => {
    openTab(tabWith().tab);
    expect(names().filter((n) => n === t("settings.features.export"))).toHaveLength(1);
    expect(names().filter((n) => n === t("settings.features.submissions"))).toHaveLength(1);
  });

  it("a module's own settingsSection is called instead of the legacy one", () => {
    const own = vi.fn();
    openTab(tabWith([], { lens: { settingsSection: own } }).tab);
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

  it("a module on settingsItems in a slot the adapter still draws shows under the core's rows", () => {
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

  it("num keeps the digits, at least min, and the fallback for blank", () => {
    const ui = (tabWith().tab as unknown as { makeUi(): import("../src/core/module-context").SettingsUi }).makeUi();
    expect(ui.num("1,500", 9)).toBe(1500);
    expect(ui.num("", 9)).toBe(9);
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
