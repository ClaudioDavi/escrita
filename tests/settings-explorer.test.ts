// @vitest-environment happy-dom
// Task 2.2c: the explorer's rows draw from its module (PLAN-1.0.3 Wave 1: task B).

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { explorerSettingsSection } from "../src/explorer/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { names, rig } from "./support/section-rig";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

describe("explorer section", () => {
  it("draws two toggles with no heading", () => {
    const r = rig();
    explorerSettingsSection(r.el, r.ui, r.plugin);
    expect(names()).toEqual(["settings.explorerFolderTotals", "settings.explorerShowTarget"].map((k) => t(k)));
    expect(settingLog.some((x) => x.heading)).toBe(false);
  });
});
