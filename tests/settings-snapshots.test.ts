// @vitest-environment happy-dom
// Task 2.2c: the snapshots section draws from its module (PLAN-1.0.3 Wave 1: task C).

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { snapshotsStrings } from "../src/snapshots/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { snapshotsOffNotice, snapshotsSettingsItems } from "../src/snapshots/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { names, rig } from "./support/section-rig";
import { renderBlocks } from "./support/definitions";

beforeAll(() => { registerStrings(coreStrings); registerStrings(snapshotsStrings); });
beforeEach(() => resetSettingLog());

describe("snapshots section", () => {
  it("draws its three rows (the tab draws the heading)", () => {
    const r = rig();
    renderBlocks(snapshotsSettingsItems(r.ui, r.plugin), r.el);
    expect(names()).toEqual(["settings.snapshotsFolder", "settings.snapshotBeforeFirstEdit", "settings.snapshotsKeepAuto"].map((k) => t(k)));
    expect(settingLog.some((row) => row.heading)).toBe(false);
  });

  it("a committed folder saves through one commit; a bad one keeps the saved value", () => {
    const r = rig();
    renderBlocks(snapshotsSettingsItems(r.ui, r.plugin), r.el);
    expect(r.commits).toHaveLength(2);
    r.commits[0].apply("Escrita/Old");
    expect(r.settings.snapshotsFolder).toBe("Escrita/Old");
    r.commits[0].apply("../outside");
    expect(r.settings.snapshotsFolder).toBe("Escrita/Old");
  });

  it("a bad folder shows the snapshots warning under the name, not the shared one", () => {
    const r = rig();
    const { groups } = renderBlocks(snapshotsSettingsItems(r.ui, r.plugin), r.el);
    r.commits[0].apply("../outside");
    const hint = groups[0].rows[0].setting.descEl.querySelector(".escrita-setting-warning") as HTMLElement;
    expect(hint.textContent).toBe(t("settings.snapshotsFolder.path"));
    expect(hint.style.display).not.toBe("none");
    r.commits[0].apply("Escrita/Ok");
    expect(hint.textContent).toBe("");
  });

  it("the number of kept automatic snapshots is a number of at least one", () => {
    const r = rig();
    renderBlocks(snapshotsSettingsItems(r.ui, r.plugin), r.el);
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
