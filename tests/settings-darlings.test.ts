// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { darlingsOffNotice, darlingsSettingsSection } from "../src/darlings/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

const plugin = () => ({ settings: { ...DEFAULT_SETTINGS } }) as never;

describe("darlings settings section", () => {
  it("draws its heading and two note rows", () => {
    darlingsSettingsSection(document.createElement("div"), fakeUi().ui, plugin());
    expect(settingLog.map((r) => r.name)).toEqual([t("settings.darlings"), t("settings.darlingsNote"), t("settings.globalDarlingsNote")]);
    expect(settingLog[0].heading).toBe(true);
  });

  it("a committed note path is stored and saved once; blank falls back", () => {
    const p = plugin() as { settings: { darlingsNote: string; globalDarlingsNote: string } };
    const { ui, save, fields } = fakeUi();
    darlingsSettingsSection(document.createElement("div"), ui, p as never);
    commit(fields[0], "  Cortes.md ");
    expect(p.settings.darlingsNote).toBe("Cortes.md");
    expect(save).toHaveBeenCalledTimes(1);
    commit(fields[1], "");
    expect(p.settings.globalDarlingsNote).toBe("Darlings.md");
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("the off notice says the darlings stay", async () => {
    expect(await darlingsOffNotice(plugin())).toBe(t("settings.features.off.darlings"));
  });
});
