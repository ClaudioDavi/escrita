// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { typingSettingsItems } from "../src/editor/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { fakeUi } from "./support/section-ui";
import { renderBlocks } from "./support/definitions";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

describe("typing settings items", () => {
  it("draws its four rows and no heading (the tab draws it)", () => {
    renderBlocks(typingSettingsItems(fakeUi().ui, { settings: { ...DEFAULT_SETTINGS } } as never));
    expect(settingLog.map((r) => r.name)).toEqual([t("settings.enterFlow"), t("settings.smartTypography"), t("settings.typographyScope"), t("settings.dialogueDash")]);
    expect(settingLog.some((r) => r.heading)).toBe(false);
  });
});
