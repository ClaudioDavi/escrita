// @vitest-environment happy-dom
// The presets on the Features page (PLAN-1.0 task 2.5, board 38).

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { FEATURE_IDS, type FeatureId } from "../src/core/features";
import { presetSwitches } from "../src/core/feature-presets";
import { switchesOf } from "../src/core/feature-registry";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS, EscritaSettingTab } from "../src/settings";
import { resetSettingLog } from "./support/obsidian";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

function page(opts: { home?: boolean; preset?: "essentials" | "writer" | "everything" } = {}) {
  const settings = { ...DEFAULT_SETTINGS, features: {} as Partial<Record<FeatureId, boolean>>, stages: structuredClone(DEFAULT_SETTINGS.stages), universeMode: "perBook" as const };
  if (opts.preset) Object.assign(settings, presetSwitches(opts.preset, switchesOf(settings)));
  const saves = vi.fn(async () => {});
  const open = vi.fn();
  const plugin = {
    settings, saveSettings: saves, data: { history: {}, leftOff: {} },
    books: { allBooks: () => [] },
    setup: { hasHomeNote: () => opts.home ?? true, open },
    features: { isOn: (_id: FeatureId) => true, get: () => undefined },
  };
  const tab = new EscritaSettingTab(new App() as never, plugin as never);
  tab.containerEl = document.createElement("div");
  tab.display();
  const el = tab.containerEl as HTMLElement;
  const btn = (label: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;
  return { settings, saves, open, el, btn };
}

describe("presets on the Features page", () => {
  it("labels the matching preset, or Custom", () => {
    expect(page({ preset: "writer" }).el.querySelector(".escrita-presets-state")?.textContent).toBe(t("settings.features.preset.writer"));
    expect(page().el.querySelector(".escrita-presets-state")?.textContent).toBe(t("settings.features.preset.custom"));
  });

  it("a click lists the changes and saves nothing before Apply", () => {
    const p = page({ preset: "everything" });
    const before = JSON.stringify(switchesOf(p.settings));
    p.btn(t("settings.features.preset.essentials")).click();
    const box = p.el.querySelector(".escrita-presets-confirm")!;
    expect(box.textContent).toContain(t("settings.features.dialogueFocus"));
    expect(p.saves).not.toHaveBeenCalled();
    expect(JSON.stringify(switchesOf(p.settings))).toBe(before);
    p.btn(t("settings.features.preset.cancel")).click();
    expect(p.el.querySelector(".escrita-presets-confirm")).toBeNull();
    expect(JSON.stringify(switchesOf(p.settings))).toBe(before);
  });

  it("Apply writes the preset once and keeps the universe mode", async () => {
    const p = page({ preset: "everything" });
    p.btn(t("settings.features.preset.essentials")).click();
    p.btn(t("settings.features.preset.apply")).click();
    await Promise.resolve();
    expect(p.saves).toHaveBeenCalledTimes(1);
    expect(p.settings.features.dialogueFocus).toBe(false);
    expect(p.settings.features.goals).toBe(true);
    expect(p.settings.universeMode).toBe("perBook");
  });

  it("says nothing changes when already on the preset", () => {
    const p = page({ preset: "writer" });
    p.btn(t("settings.features.preset.writer")).click();
    expect(p.el.querySelector(".escrita-presets-confirm")).toBeNull();
    expect(p.el.textContent).toContain(t("settings.features.preset.already", { name: t("settings.features.preset.writer") }));
  });

  it("only Everything carries the universe line", () => {
    const p = page({ preset: "essentials" });
    p.btn(t("settings.features.preset.writer")).click();
    expect(p.el.textContent).not.toContain(t("settings.features.preset.universe"));
    p.btn(t("settings.features.preset.everything")).click();
    expect(p.el.textContent).toContain(t("settings.features.preset.universe"));
  });

  it("the setup link shows only without a home note, and opens the setup", () => {
    expect(page({ home: true }).btn(t("settings.features.setupLink"))).toBeUndefined();
    const p = page({ home: false });
    p.btn(t("settings.features.setupLink")).click();
    expect(p.open).toHaveBeenCalledTimes(1);
  });

  it.each(["en", "pt-BR"] as const)("has every string in %s", (lang) => {
    for (const k of ["label", "group", "essentials", "writer", "everything", "custom", "confirm", "confirmGroup", "off", "on", "nothing", "kept", "universe", "cancel", "apply", "already"]) {
      expect(coreStrings[lang][`settings.features.preset.${k}`], k).toBeTruthy();
    }
    expect(coreStrings[lang]["settings.features.setupLink"]).toBeTruthy();
    expect(FEATURE_IDS.length).toBeGreaterThan(0);
  });
});
