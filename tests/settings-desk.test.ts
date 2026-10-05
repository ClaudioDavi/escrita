// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { deskOffNotice, deskSettingsSection } from "../src/desk/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

const plugin = (leftOff: Record<string, unknown> = {}) => ({ settings: { ...DEFAULT_SETTINGS }, data: { leftOff } });

describe("desk settings section", () => {
  it("draws the heading, the home note and the startup toggle", () => {
    deskSettingsSection(document.createElement("div"), fakeUi().ui, plugin() as never);
    expect(settingLog.map((r) => r.name)).toEqual([t("settings.homeNoteHeading"), t("settings.homeNote"), t("settings.openHomeOnStartup")]);
  });

  it("a committed home note is stored and saved once", () => {
    const p = plugin();
    const { ui, save, fields } = fakeUi();
    deskSettingsSection(document.createElement("div"), ui, p as never);
    commit(fields[0], " Início.md ");
    expect(p.settings.homeNote).toBe("Início.md");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("the off notice counts the saved places, and is null with none", async () => {
    expect(await deskOffNotice(plugin() as never)).toBeNull();
    const text = await deskOffNotice(plugin({ a: {}, b: {} }) as never);
    expect(text).toEqual(expect.stringContaining("2"));
  });
});
