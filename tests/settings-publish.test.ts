// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { publishSettingsItems } from "../src/publish/settings-ui";
import { outlineSettingsItems } from "../src/outline/settings-ui";
import { placeholdersSettingsItems } from "../src/placeholders/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";
import { renderBlocks, rowNamed } from "./support/definitions";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

const plugin = () => ({ settings: { ...DEFAULT_SETTINGS } }) as never;

describe("publish settings items", () => {
  it("are the date property and the recommended properties, with no heading (the tab draws the slot's)", () => {
    renderBlocks(publishSettingsItems(fakeUi().ui, plugin()));
    expect(settingLog.map((r) => r.name)).toEqual(["settings.dateProperty", "settings.recommendedProperties"].map((k) => t(k)));
    expect(settingLog.some((r) => r.heading)).toBe(false);
  });

  it("a committed date property is stored and saved once; blank falls back to the default", () => {
    const p = plugin() as { settings: { dateProperty: string } };
    const { ui, save, fields } = fakeUi();
    renderBlocks(publishSettingsItems(ui, p as never));
    commit(fields[0], " published ");
    expect(p.settings.dateProperty).toBe("published");
    expect(save).toHaveBeenCalledTimes(1);
    commit(fields[0], "");
    expect(p.settings.dateProperty).toBe(DEFAULT_SETTINGS.dateProperty);
  });
});

describe("publish settings items: the recommended list", () => {
  it("a cleared list stays empty, and a pt-BR install's date property falls back to pt-BR", () => {
    const p = plugin() as { settings: { recommendedProperties: string; dateProperty: string } };
    const { ui, fields } = fakeUi("pt-BR");
    renderBlocks(publishSettingsItems(ui, p as never));
    commit(fields[1], "");
    expect(p.settings.recommendedProperties).toBe("");
    commit(fields[0], "");
    expect(p.settings.dateProperty).toBe(ui.defaults().dateProperty);
  });
});

describe("outline settings items", () => {
  it("are the ghost beats row, with no heading (the tab draws the slot's)", () => {
    const blocks = outlineSettingsItems(fakeUi().ui, plugin());
    expect(blocks.map((b) => b.heading)).toEqual([undefined]);
    renderBlocks(blocks);
    expect(settingLog.map((r) => r.name)).toEqual([t("settings.ghostBeats")]);
    expect(settingLog[0].heading).toBe(false);
  });

  it("the toggle stores and saves at once", async () => {
    const p = plugin() as { settings: { ghostBeats: boolean } };
    const { ui, save } = fakeUi();
    const { groups } = renderBlocks(outlineSettingsItems(ui, p as never));
    const toggle = rowNamed(groups, t("settings.ghostBeats"))!.setting.components[0];
    expect(toggle.value).toBe(p.settings.ghostBeats);
    await toggle.fire(!p.settings.ghostBeats);
    expect(p.settings.ghostBeats).toBe(!DEFAULT_SETTINGS.ghostBeats);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe("placeholders settings items", () => {
  it("are only the explorer dots row (the core draws the heading and the marker)", () => {
    renderBlocks(placeholdersSettingsItems(fakeUi().ui, plugin()));
    expect(settingLog.map((r) => r.name)).toEqual([t("settings.showExplorerDots")]);
    expect(settingLog[0].heading).toBe(false);
  });

  it("the toggle stores and saves at once", async () => {
    const p = plugin() as { settings: { showExplorerDots: boolean } };
    const { ui, save } = fakeUi();
    const { groups } = renderBlocks(placeholdersSettingsItems(ui, p as never));
    await rowNamed(groups, t("settings.showExplorerDots"))!.setting.components[0].fire(!p.settings.showExplorerDots);
    expect(p.settings.showExplorerDots).toBe(!DEFAULT_SETTINGS.showExplorerDots);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
