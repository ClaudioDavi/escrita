// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { goalsOffNotice, goalsSettingsSection } from "../src/goals/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

const plugin = (history: Record<string, unknown> = {}) => ({ settings: { ...DEFAULT_SETTINGS }, data: { history } }) as never;

describe("goals settings section", () => {
  it("draws the heading and its rows in order", () => {
    goalsSettingsSection(document.createElement("div"), fakeUi().ui, plugin());
    expect(settingLog.map((r) => r.name)).toEqual([
      "settings.goals", "settings.dailyGoal", "settings.ignoreJumpsOver", "settings.sprintMinutes",
      "settings.showStatusBar", "settings.weekdaysOff", "settings.datesOff",
    ].map((k) => t(k)));
    expect(settingLog[0].heading).toBe(true);
  });

  it("a committed daily goal is stored and saved once; text that is not a number keeps the old one", () => {
    const p = plugin() as { settings: { dailyGoal: number } };
    const { ui, save, fields } = fakeUi();
    goalsSettingsSection(document.createElement("div"), ui, p as never);
    commit(fields[0], "750");
    expect(p.settings.dailyGoal).toBe(750);
    expect(save).toHaveBeenCalledTimes(1);
    commit(fields[0], "abc");
    expect(p.settings.dailyGoal).toBe(750);
  });

  it("the off notice counts the days of history that stay, and is null with none", async () => {
    expect(await goalsOffNotice(plugin())).toBeNull();
    const text = await goalsOffNotice(plugin({ "2026-01-01": {}, "2026-01-02": {} }));
    expect(text).toEqual(expect.any(String));
    expect(text).toContain("2");
  });
});
