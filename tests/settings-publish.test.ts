// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { publishSettingsSection } from "../src/publish/settings-ui";
import { outlineSettingsItems } from "../src/outline/settings-ui";
import { placeholdersSettingsSection } from "../src/placeholders/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";
import { renderBlocks, rowNamed } from "./support/definitions";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

const plugin = () => ({ settings: { ...DEFAULT_SETTINGS } }) as never;
const div = () => document.createElement("div");

describe("publish settings section", () => {
  it("draws the heading, the date property and the recommended properties", () => {
    publishSettingsSection(div(), fakeUi().ui, plugin());
    expect(settingLog.map((r) => r.name)).toEqual(["settings.publishing", "settings.dateProperty", "settings.recommendedProperties"].map((k) => t(k)));
    expect(settingLog[0].heading).toBe(true);
  });

  it("a committed date property is stored and saved once; blank falls back to the default", () => {
    const p = plugin() as { settings: { dateProperty: string } };
    const { ui, save, fields } = fakeUi();
    publishSettingsSection(div(), ui, p as never);
    commit(fields[0], " published ");
    expect(p.settings.dateProperty).toBe("published");
    expect(save).toHaveBeenCalledTimes(1);
    commit(fields[0], "");
    expect(p.settings.dateProperty).toBe(DEFAULT_SETTINGS.dateProperty);
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

describe("placeholders settings section", () => {
  it("draws no heading, only the explorer dots row (the core draws the heading and the marker)", () => {
    placeholdersSettingsSection(div(), fakeUi().ui, plugin());
    expect(settingLog.map((r) => r.name)).toEqual([t("settings.showExplorerDots")]);
    expect(settingLog[0].heading).toBe(false);
  });
});
