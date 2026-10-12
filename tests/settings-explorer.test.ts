// @vitest-environment happy-dom
// Task 2.2c: the explorer's rows draw from its module (PLAN-1.0.3 Wave 1: task B).

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { explorerSettingsItems } from "../src/explorer/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { names, rig } from "./support/section-rig";
import { renderBlocks, rowNamed } from "./support/definitions";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

describe("explorer section", () => {
  it("draws two toggles with no heading", () => {
    const r = rig();
    renderBlocks(explorerSettingsItems(r.ui, r.plugin));
    expect(names()).toEqual(["settings.explorerFolderTotals", "settings.explorerShowTarget"].map((k) => t(k)));
    expect(settingLog.some((x) => x.heading)).toBe(false);
  });

  it("each toggle is indented as a child of the switch, stores and saves at once", async () => {
    const r = rig();
    const { groups } = renderBlocks(explorerSettingsItems(r.ui, r.plugin));
    const totals = rowNamed(groups, t("settings.explorerFolderTotals"))!;
    expect(totals.setting.settingEl.classList.contains("escrita-feature-child")).toBe(true);
    await totals.setting.components[0].fire(!r.settings.explorerFolderTotals);
    expect(r.settings.explorerFolderTotals).toBe(!DEFAULT_SETTINGS.explorerFolderTotals);
    expect(r.save).toHaveBeenCalledTimes(1);
  });
});
