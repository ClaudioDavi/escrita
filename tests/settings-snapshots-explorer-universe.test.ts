// @vitest-environment happy-dom
// Task 2.2c: the sections of snapshots, explorer, universe and threads draw from their modules.
// The `Setting` stub of tests/support/obsidian.ts records every row; a fake `ui` records the
// committed text fields so a test can type into them.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsUi } from "../src/core/module-context";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { snapshotsStrings } from "../src/snapshots/strings";
import { universeStrings } from "../src/universe/strings";
import { DEFAULT_SETTINGS, defaultsFor, type EscritaSettings } from "../src/settings";
import { snapshotsOffNotice, snapshotsSettingsSection } from "../src/snapshots/settings-ui";
import { explorerSettingsSection } from "../src/explorer/settings-ui";
import { universeSettingsSection } from "../src/universe/settings-ui";
import { threadsSettingsSection } from "../src/universe/threads-settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";

beforeAll(() => { registerStrings(coreStrings); registerStrings(snapshotsStrings); registerStrings(universeStrings); });
beforeEach(() => resetSettingLog());

type Commit = { fallback: () => string; apply: (v: string) => void };

function rig(over: Partial<EscritaSettings> = {}, on: string[] = ["universe", "threads"]) {
  const settings = { ...DEFAULT_SETTINGS, stages: structuredClone(DEFAULT_SETTINGS.stages), entryTypes: structuredClone(DEFAULT_SETTINGS.entryTypes), ...over } as EscritaSettings;
  const commits: Commit[] = [];
  const save = vi.fn(async () => {});
  const ui = {
    app: { vault: { configDir: ".obsidian", getMarkdownFiles: () => [] } },
    save,
    defaults: () => defaultsFor(settings.defaultsLanguage),
    saveOnCommit: (_c: unknown, fallback: () => string, apply: (v: string) => void) => { commits.push({ fallback, apply }); },
    redraw: () => {},
    num: (v: string, fb: number, min = 0) => { const n = parseInt(v, 10); return Number.isNaN(n) ? fb : Math.max(min, n); },
  } as unknown as SettingsUi;
  const plugin = {
    settings, books: { allBooks: () => [], allBooksEverywhere: () => [] },
    features: { isOn: (id: string) => on.includes(id) },
  };
  return { settings, commits, save, ui, plugin: plugin as never, el: document.createElement("div") };
}
const names = () => settingLog.map((r) => r.name);

describe("snapshots section", () => {
  it("draws its heading and three rows", () => {
    const r = rig();
    snapshotsSettingsSection(r.el, r.ui, r.plugin);
    expect(names()).toEqual(["settings.snapshots", "settings.snapshotsFolder", "settings.snapshotBeforeFirstEdit", "settings.snapshotsKeepAuto"].map((k) => t(k)));
    expect(settingLog[0].heading).toBe(true);
  });

  it("a committed folder saves through one commit; a bad one keeps the saved value", () => {
    const r = rig();
    snapshotsSettingsSection(r.el, r.ui, r.plugin);
    expect(r.commits).toHaveLength(2);
    r.commits[0].apply("Escrita/Old");
    expect(r.settings.snapshotsFolder).toBe("Escrita/Old");
    r.commits[0].apply("../outside");
    expect(r.settings.snapshotsFolder).toBe("Escrita/Old");
  });

  it("the number of kept automatic snapshots is a number of at least one", () => {
    const r = rig();
    snapshotsSettingsSection(r.el, r.ui, r.plugin);
    r.commits[1].apply("0");
    expect(r.settings.snapshotsKeepAuto).toBe(1);
    r.commits[1].apply("x");
    expect(r.settings.snapshotsKeepAuto).toBe(DEFAULT_SETTINGS.snapshotsKeepAuto);
  });

  it("the off notice counts the snapshots that stay, or says nothing", async () => {
    const store = (lists: Record<string, number>) => ({
      notesWithSnapshots: async () => Object.keys(lists),
      list: async (n: string) => new Array(lists[n]).fill(0),
    });
    const plugin = (lists: Record<string, number>) => ({ settings: { snapshotsFolder: "Escrita/Snapshots" }, snapshots: { store: store(lists) } }) as never;
    expect(await snapshotsOffNotice(plugin({}))).toBeNull();
    const text = await snapshotsOffNotice(plugin({ a: 2, b: 1 }));
    expect(text).toContain("3");
    expect(text).toContain("Escrita/Snapshots");
    const broken = { settings: {}, snapshots: { store: { notesWithSnapshots: async () => { throw new Error("x"); } } } } as never;
    expect(await snapshotsOffNotice(broken)).toBeNull();
  });
});

describe("explorer section", () => {
  it("draws two toggles with no heading", () => {
    const r = rig();
    explorerSettingsSection(r.el, r.ui, r.plugin);
    expect(names()).toEqual(["settings.explorerFolderTotals", "settings.explorerShowTarget"].map((k) => t(k)));
    expect(settingLog.some((x) => x.heading)).toBe(false);
  });
});

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

describe("plugin folder rows (export, submissions)", () => {
  it("refuse a folder that holds the writer's files of any kind, not only notes", async () => {
    const { pluginFolderRows } = await import("../src/settings");
    const r = rig();
    (r.ui.app.vault as unknown as { getFiles: () => { path: string }[] }).getFiles = () => [{ path: "Manuscritos/A Casa (Shunn).docx" }];
    pluginFolderRows(r.el, r.ui, r.settings, () => []);
    expect(r.commits).toHaveLength(2);
    r.commits[0].apply("Manuscritos");
    expect(r.settings.exportFolder).toBe(DEFAULT_SETTINGS.exportFolder);
    r.commits[1].apply("Manuscritos");
    expect(r.settings.submissionsFolder).toBe(DEFAULT_SETTINGS.submissionsFolder);
    r.commits[0].apply("Saida");
    expect(r.settings.exportFolder).toBe("Saida");
  });
});

describe("a pt-BR install falls back to the pt-BR set (1.0 known issue: English defaults in the tab)", () => {
  const pt = (over: Partial<EscritaSettings> = {}, on?: string[]) => rig({ ...defaultsFor("pt-BR"), defaultsLanguage: "pt-BR", ...over }, on);

  it("ui.defaults() is the install's set", () => {
    const r = pt();
    expect(r.ui.defaults().threadKeyword).toBe("fio");
    expect(r.ui.defaults().chaptersFolder).toBe("Capítulos");
  });

  it("clearing the thread words restores fio and the pt-BR closed word", () => {
    const r = pt({}, ["threads"]);
    threadsSettingsSection(r.el, r.ui, r.plugin);
    expect(r.commits[0].fallback()).toBe("fio");
    expect(r.commits[1].fallback()).toBe(defaultsFor("pt-BR").threadClosedWord);
    expect(r.commits[1].fallback()).not.toBe("closed");
  });

  it("clearing the universe note restores Universo.md", () => {
    const r = pt({ universeMode: "universe" });
    universeSettingsSection(r.el, r.ui, r.plugin);
    expect(r.commits.some((c) => c.fallback() === "Universo.md")).toBe(true);
  });

  it("clearing the export and submissions folders restores the pt-BR folders", async () => {
    const { pluginFolderRows } = await import("../src/settings");
    const r = pt();
    pluginFolderRows(r.el, r.ui, r.settings, () => []);
    expect(r.commits[0].fallback()).toBe(defaultsFor("pt-BR").exportFolder);
    expect(r.commits[1].fallback()).toBe(defaultsFor("pt-BR").submissionsFolder);
  });
});
