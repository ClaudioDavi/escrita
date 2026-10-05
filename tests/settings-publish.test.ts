// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { publishSettingsSection } from "../src/publish/settings-ui";
import { outlineSettingsSection } from "../src/outline/settings-ui";
import { placeholdersSettingsSection } from "../src/placeholders/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";

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

describe("outline settings section", () => {
  it("draws the heading and the ghost beats row", () => {
    outlineSettingsSection(div(), fakeUi().ui, plugin());
    expect(settingLog.map((r) => r.name)).toEqual(["settings.outline", "settings.ghostBeats"].map((k) => t(k)));
    expect(settingLog[0].heading).toBe(true);
  });
});

describe("placeholders settings section", () => {
  it("draws no heading, only the explorer dots row (the core draws the heading and the marker)", () => {
    placeholdersSettingsSection(div(), fakeUi().ui, plugin());
    expect(settingLog.map((r) => r.name)).toEqual([t("settings.showExplorerDots")]);
    expect(settingLog[0].heading).toBe(false);
  });
});
