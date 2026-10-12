// @vitest-environment happy-dom
// When the settings tab rebuilds its rows (PLAN-1.0.3 Q5): Obsidian computes them when the tab is
// added and on each update() only, so a change of structure (a feature loads or unloads, the
// switches or the universe mode change) must call update() once, and a text commit never.
// The real registry, wired to the tab as main.ts does.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { FeatureRegistry, switchesOf } from "../src/core/feature-registry";
import { FEATURE_IDS, type FeatureId } from "../src/core/features";
import { PRESET_IDS, presetChanges } from "../src/core/feature-presets";
import { FeatureModule, type SettingsUi } from "../src/core/module-context";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { EscritaSettingTab } from "../src/settings-tab";
import { textRow, type SettingsBlock } from "../src/ui/settings-rows";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";
import { openTab, rowNamed, type OpenTab } from "./support/definitions";
import { resetSettingLog } from "./support/obsidian";
import { commit } from "./support/section-ui";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

class Mod extends FeatureModule {
  readonly id: FeatureId;
  constructor(id: FeatureId, items?: (ui: SettingsUi) => SettingsBlock[]) {
    super();
    this.id = id;
    if (items) this.settingsItems = items;
  }
}

interface Rig { plugin: FakePlugin; reg: FeatureRegistry; tab: EscritaSettingTab; open: OpenTab; update: ReturnType<typeof vi.spyOn> }

function rig(): Rig {
  const plugin = fakePlugin();
  plugin.books = { allBooksEverywhere: () => [] };
  Object.assign(plugin, { setup: { hasHomeNote: () => true, open: () => {} } });
  // goals stands in with one text row, so a commit can be made through a real field
  const goals = new Mod("goals", (ui) => [{
    items: [textRow(ui, { name: "Words", key: "chaptersFolder", get: () => plugin.settings.chaptersFolder, set: (v) => { plugin.settings.chaptersFolder = v; } })],
  }]);
  const mods = new Map<FeatureId, FeatureModule>(FEATURE_IDS.map((id) => [id, id === "goals" ? goals : new Mod(id)]));
  const reg = new FeatureRegistry(plugin.asPlugin, mods);
  plugin.features = reg;
  reg.init();
  reg.apply();
  plugin.saveSettingsHook = () => reg.apply();   // main.ts saveSettings: persist, then features.apply()
  const tab = new EscritaSettingTab(new App() as never, plugin.asPlugin);
  plugin.register(reg.onApplied(() => tab.refresh()));   // as main.ts
  const open = openTab(tab);
  const update = vi.spyOn(tab, "update");
  return { plugin, reg, tab, open, update };
}

const settle = () => new Promise((r) => setTimeout(r, 0));
const button = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll("button")].find((b) => b.textContent === label || b.getAttribute("aria-label") === label) as HTMLButtonElement;

describe("the registry's onApplied", () => {
  it("runs once per apply, changed or not, and stops when unsubscribed", () => {
    const { reg, plugin } = rig();
    const cb = vi.fn();
    const off = reg.onApplied(cb);
    reg.apply();
    expect(cb).toHaveBeenCalledTimes(1);
    plugin.settings.features = { ...plugin.settings.features, goals: false, outline: false, lens: false };
    reg.apply();
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    reg.apply();
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe("the tab rebuilds on a change of structure, once", () => {
  it("a feature switch on the Features page", async () => {
    const r = rig();
    expect(r.reg.isOn("goals")).toBe(true);
    button(r.open.el, t("settings.features.goals")).click();
    await settle();
    expect(r.reg.isOn("goals")).toBe(false);
    expect(r.update).toHaveBeenCalledTimes(1);
    expect(rowNamed(r.open.groups(), "Words")).toBeUndefined();
  });

  it("a preset that changes several features", async () => {
    const r = rig();
    const target = PRESET_IDS.find((id) => {
      const c = presetChanges(switchesOf(r.plugin.settings), id);
      return c.off.length + c.on.length > 1;
    })!;
    button(r.open.el, t(`settings.features.preset.${target}`)).click();
    button(r.open.el, t("settings.features.preset.apply")).click();
    await settle();
    expect(r.update).toHaveBeenCalledTimes(1);
  });

  it("the universe mode, with or without a feature loading", async () => {
    const r = rig();
    r.plugin.settings.universeMode = "perBook";   // the universe loads
    await r.plugin.saveSettings();
    expect(r.reg.isOn("universe")).toBe(true);
    expect(r.update).toHaveBeenCalledTimes(1);
    r.plugin.settings.universeMode = "universe";  // nothing loads; the section's rows differ
    await r.plugin.saveSettings();
    expect(r.update).toHaveBeenCalledTimes(2);
  });

  it("the language of the defaults (the setup): rows built from it get its placeholders and fallbacks", async () => {
    const r = rig();
    expect(r.plugin.settings.defaultsLanguage).toBe("en");
    r.plugin.settings.defaultsLanguage = "pt-BR";
    await r.plugin.saveSettings();
    expect(r.update).toHaveBeenCalledTimes(1);
  });

  it("never after a text field commits", async () => {
    const r = rig();
    const field = rowNamed(r.open.groups(), "Words")!.setting.components[0] as unknown as { inputEl: HTMLInputElement };
    commit(field, "Capítulos");
    await settle();
    expect(r.plugin.settings.chaptersFolder).toBe("Capítulos");
    expect(r.plugin.saves).toBe(1);
    expect(r.update).not.toHaveBeenCalled();
  });

  it("a save that changes nothing structural does not rebuild", async () => {
    const r = rig();
    await r.plugin.saveSettings();
    expect(r.update).not.toHaveBeenCalled();
  });
});
