// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { goalsOffNotice, goalsSettingsItems } from "../src/goals/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";
import { renderBlocks, rowNamed } from "./support/definitions";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

const plugin = (history: Record<string, unknown> = {}) => ({ settings: { ...DEFAULT_SETTINGS }, data: { history } }) as never;

describe("goals settings items", () => {
  it("are its rows in order, with no heading (the tab draws the slot's)", () => {
    const blocks = goalsSettingsItems(fakeUi().ui, plugin());
    expect(blocks.map((b) => b.heading)).toEqual([undefined]);
    renderBlocks(blocks);
    expect(settingLog.map((r) => r.name)).toEqual([
      "settings.dailyGoal", "settings.ignoreJumpsOver", "settings.sprintMinutes",
      "settings.showStatusBar", "settings.weekdaysOff", "settings.datesOff",
    ].map((k) => t(k)));
    expect(settingLog.some((r) => r.heading)).toBe(false);
  });

  it("a committed daily goal is stored and saved once; text that is not a number keeps the old one", () => {
    const p = plugin() as { settings: { dailyGoal: number } };
    const { ui, save, fields } = fakeUi();
    renderBlocks(goalsSettingsItems(ui, p as never));
    commit(fields[0], "750");
    expect(p.settings.dailyGoal).toBe(750);
    expect(save).toHaveBeenCalledTimes(1);
    commit(fields[0], "abc");
    expect(p.settings.dailyGoal).toBe(750);
  });

  it("the sprint row holds two fields: minutes (1 to 240), then target words", () => {
    const p = plugin() as { settings: { sprintMinutes: number; sprintTarget: number } };
    const { ui, fields } = fakeUi();
    const { groups } = renderBlocks(goalsSettingsItems(ui, p as never));
    expect(rowNamed(groups, t("settings.sprintMinutes"))!.setting.components).toHaveLength(2);
    commit(fields[2], "999");
    expect(p.settings.sprintMinutes).toBe(240);
    commit(fields[2], "0");
    expect(p.settings.sprintMinutes).toBe(1);
    commit(fields[3], "400");
    expect(p.settings.sprintTarget).toBe(400);
  });

  it("jumps keep at least 50, and a daily goal field shows what was kept", () => {
    const p = plugin() as { settings: { ignoreJumpsOver: number; dailyGoal: number } };
    const { ui, fields } = fakeUi();
    renderBlocks(goalsSettingsItems(ui, p as never));
    commit(fields[1], "10");
    expect(p.settings.ignoreJumpsOver).toBe(50);
    expect(fields[1].inputEl.value).toBe("50");
    commit(fields[0], "abc");
    expect(fields[0].inputEl.value).toBe(String(p.settings.dailyGoal));
  });

  it("the weekday boxes store the checked days and save at once", () => {
    const p = plugin() as { settings: { weekdaysOff: number[] } };
    const { ui, save } = fakeUi();
    const { groups } = renderBlocks(goalsSettingsItems(ui, p as never));
    const row = rowNamed(groups, t("settings.weekdaysOff"))!;
    expect(row.setting.settingEl.classList.contains("escrita-setting-weekdays")).toBe(true);
    const boxes = row.setting.controlEl.querySelectorAll("input");
    expect(boxes).toHaveLength(7);
    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change"));
    expect(p.settings.weekdaysOff).toHaveLength(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("the dates-off warning follows the typing, and is gone after a clean commit", () => {
    const p = plugin() as { settings: { datesOff: string } };
    const { ui, fields } = fakeUi();
    const { groups } = renderBlocks(goalsSettingsItems(ui, p as never));
    const row = rowNamed(groups, t("settings.datesOff"))!;
    const hint = row.setting.descEl.querySelector(".escrita-setting-warning") as HTMLElement;
    expect(hint.textContent).toBe("");
    row.setting.components[0].fire("2026-12-25\nnot a date");
    expect(hint.textContent).toBe(t("settings.datesOff.invalid", { dates: "not a date" }));
    commit(fields[fields.length - 1], "2026-12-25");
    expect(p.settings.datesOff).toBe("2026-12-25");
    expect(hint.textContent).toBe("");
  });

  it("a re-render draws the dates-off warning once, under the stored text", () => {
    const p = plugin() as { settings: { datesOff: string } };
    p.settings.datesOff = "oops";
    const { ui } = fakeUi();
    const rendered = renderBlocks(goalsSettingsItems(ui, p as never));
    const row = rowNamed(rendered.groups, t("settings.datesOff"))!;
    expect(row.setting.descEl.querySelectorAll(".escrita-setting-warning")).toHaveLength(1);
    expect(row.setting.descEl.textContent).toContain("oops");
  });

  it("the off notice counts the days of history that stay, and is null with none", async () => {
    expect(await goalsOffNotice(plugin())).toBeNull();
    const text = await goalsOffNotice(plugin({ "2026-01-01": {}, "2026-01-02": {} }));
    expect(text).toEqual(expect.any(String));
    expect(text).toContain("2");
  });
});
