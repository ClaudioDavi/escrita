// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { darlingsOffNotice, darlingsSettingsItems } from "../src/darlings/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";
import { renderBlocks } from "./support/definitions";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

const plugin = () => ({ settings: { ...DEFAULT_SETTINGS } }) as never;

describe("darlings settings items", () => {
  it("are two note rows, with no heading (the tab draws the slot's)", () => {
    renderBlocks(darlingsSettingsItems(fakeUi().ui, plugin()));
    expect(settingLog.map((r) => r.name)).toEqual([t("settings.darlingsNote"), t("settings.globalDarlingsNote")]);
    expect(settingLog.some((r) => r.heading)).toBe(false);
  });

  it("a committed note path is stored and saved once; blank falls back", () => {
    const p = plugin() as { settings: { darlingsNote: string; globalDarlingsNote: string } };
    const { ui, save, fields } = fakeUi();
    renderBlocks(darlingsSettingsItems(ui, p as never));
    commit(fields[0], "  Cortes.md ");
    expect(p.settings.darlingsNote).toBe("Cortes.md");
    expect(save).toHaveBeenCalledTimes(1);
    commit(fields[1], "");
    expect(p.settings.globalDarlingsNote).toBe("Darlings.md");
    // the blank field gives the value already stored, so nothing is written
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("a pt-BR install's cleared field falls back to the pt-BR default", () => {
    const p = plugin() as { settings: { darlingsNote: string } };
    const { ui, fields } = fakeUi("pt-BR");
    renderBlocks(darlingsSettingsItems(ui, p as never));
    commit(fields[0], "");
    expect(p.settings.darlingsNote).toBe(ui.defaults().darlingsNote);
  });

  it("the off notice says the darlings stay", async () => {
    expect(await darlingsOffNotice(plugin())).toBe(t("settings.features.off.darlings"));
  });
});
