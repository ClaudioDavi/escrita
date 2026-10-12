// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { deskOffNotice, deskSettingsItems } from "../src/desk/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";
import { renderBlocks, rowNamed } from "./support/definitions";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

const plugin = (leftOff: Record<string, unknown> = {}) => ({ settings: { ...DEFAULT_SETTINGS }, data: { leftOff } });

describe("desk settings items", () => {
  it("are the home note and the startup toggles, with no heading (the tab draws the slot's)", () => {
    renderBlocks(deskSettingsItems(fakeUi().ui, plugin() as never));
    expect(settingLog.map((r) => r.name)).toEqual([t("settings.homeNote"), t("settings.openHomeOnStartup"), t("desk.writingMode.setting")]);
    expect(settingLog.some((r) => r.heading)).toBe(false);
  });

  it("a committed home note is stored and saved once", () => {
    const p = plugin();
    const { ui, save, fields } = fakeUi();
    renderBlocks(deskSettingsItems(ui, p as never));
    commit(fields[0], " Início.md ");
    expect(p.settings.homeNote).toBe("Início.md");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("the startup toggles store and save at once", async () => {
    const p = plugin();
    const { ui, save } = fakeUi();
    const { groups } = renderBlocks(deskSettingsItems(ui, p as never));
    await rowNamed(groups, t("settings.openHomeOnStartup"))!.setting.components[0].fire(true);
    await rowNamed(groups, t("desk.writingMode.setting"))!.setting.components[0].fire(true);
    expect(p.settings.openHomeOnStartup).toBe(true);
    expect(p.settings.openInWritingMode).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("the off notice counts the saved places, and is null with none", async () => {
    expect(await deskOffNotice(plugin() as never)).toBeNull();
    const text = await deskOffNotice(plugin({ a: {}, b: {} }) as never);
    expect(text).toEqual(expect.stringContaining("2"));
  });
});
