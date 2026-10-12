// @vitest-environment happy-dom
// Task 2.2c: the universe and threads sections draw from their modules (PLAN-1.0.3 Wave 1: task D).

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { universeStrings } from "../src/universe/strings";
import { DEFAULT_SETTINGS, defaultsFor } from "../src/settings";
import { universeSettingsSection } from "../src/universe/settings-ui";
import { threadsSettingsSection } from "../src/universe/threads-settings-ui";
import { resetSettingLog } from "./support/obsidian";
import { names, ptRig, rig } from "./support/section-rig";

beforeAll(() => { registerStrings(coreStrings); registerStrings(universeStrings); });
beforeEach(() => resetSettingLog());

describe("universe and threads sections", () => {
  it("the universe draws no heading of its own, and the thread words once", () => {
    const r = rig({ universeMode: "universe" });
    universeSettingsSection(r.el, r.ui, r.plugin);
    expect(names()).not.toContain(t("universe.settings"));
    expect(names().filter((n) => n === t("universe.settings.threadWord"))).toHaveLength(1);
    expect(names()).toContain(t("universe.settings.types"));
    expect(names()).toContain(t("universe.settings.names"));
  });

  it("the thread words follow the form and come before the types", () => {
    const r = rig({ universeMode: "perBook" });
    universeSettingsSection(r.el, r.ui, r.plugin);
    const n = names();
    expect(n.indexOf(t("universe.settings.threadWord"))).toBeGreaterThan(n.indexOf(t("universe.settings.form")));
    expect(n.indexOf(t("universe.settings.threadWord"))).toBeLessThan(n.indexOf(t("universe.settings.types")));
  });

  it("with threads off the universe section has no thread words", () => {
    const r = rig({ universeMode: "universe" }, ["universe"]);
    universeSettingsSection(r.el, r.ui, r.plugin);
    expect(names()).not.toContain(t("universe.settings.threadWord"));
  });

  it("with the mode off only the thread words draw", () => {
    const r = rig({ universeMode: "off" });
    universeSettingsSection(r.el, r.ui, r.plugin);
    expect(names()).toEqual([t("universe.settings.threadWord"), t("universe.settings.closedWord")]);
  });

  it("threads draws the words only when the universe is off, and a committed word is saved", () => {
    const on = rig({}, ["universe", "threads"]);
    threadsSettingsSection(on.el, on.ui, on.plugin);
    expect(names()).toEqual([]);
    const off = rig({}, ["threads"]);
    threadsSettingsSection(off.el, off.ui, off.plugin);
    expect(names()).toEqual([t("universe.settings.threadWord"), t("universe.settings.closedWord")]);
    off.commits[0].apply("loose end");
    expect(off.settings.threadKeyword).toBe("loose end");
    expect(off.commits[1].fallback()).toBe("closed");
  });

  it("the universe form field saves once per commit", () => {
    const r = rig({ universeMode: "universe" });
    universeSettingsSection(r.el, r.ui, r.plugin);
    const form = r.commits.find((c) => c.fallback() === DEFAULT_SETTINGS.formProperty)!;
    form.apply("kind");
    expect(r.settings.formProperty).toBe("kind");
  });
});

describe("a pt-BR install falls back to the pt-BR set (1.0 known issue: English defaults in the tab)", () => {
  it("ui.defaults() is the install's set", () => {
    const r = ptRig();
    expect(r.ui.defaults().threadClosedWord).toBe("fechada");
    expect(r.ui.defaults().chaptersFolder).toBe("Capítulos");
  });

  it("clearing the thread words restores thread and the pt-BR closed word", () => {
    const r = ptRig({}, ["threads"]);
    threadsSettingsSection(r.el, r.ui, r.plugin);
    expect(r.commits[0].fallback()).toBe("thread");
    expect(r.commits[1].fallback()).toBe(defaultsFor("pt-BR").threadClosedWord);
    expect(r.commits[1].fallback()).not.toBe("closed");
  });

  it("clearing the universe note restores Universo.md", () => {
    const r = ptRig({ universeMode: "universe" });
    universeSettingsSection(r.el, r.ui, r.plugin);
    expect(r.commits.some((c) => c.fallback() === "Universo.md")).toBe(true);
  });
});
