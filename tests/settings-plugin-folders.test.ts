// @vitest-environment happy-dom
// The export and submissions folders, drawn from the core (settings-tab.ts, `pluginFolderRows`;
// PLAN-1.0.3 Wave 1: task A).

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS, defaultsFor } from "../src/settings";
import { pluginFolderRows } from "../src/settings-tab";
import { resetSettingLog } from "./support/obsidian";
import { ptRig, rig } from "./support/section-rig";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

describe("plugin folder rows (export, submissions)", () => {
  it("refuse a folder that holds the writer's files of any kind, not only notes", () => {
    const r = rig();
    (r.ui.app.vault as unknown as { getFiles: () => { path: string }[] }).getFiles = () => [{ path: "Manuscritos/A Casa (Shunn).docx" }];
    pluginFolderRows(r.el, r.ui, r.settings, () => []);
    expect(r.commits).toHaveLength(2);
    r.commits[0].apply("Manuscritos");
    expect(r.settings.exportFolder).toBe(DEFAULT_SETTINGS.exportFolder);
    r.commits[1].apply("Manuscritos");
    expect(r.settings.submissionsFolder).toBe(DEFAULT_SETTINGS.submissionsFolder);
    r.commits[0].apply("Saida");
    expect(r.settings.exportFolder).toBe("Saida");
  });

  it("clearing the export and submissions folders restores the pt-BR folders on a pt-BR install", () => {
    const r = ptRig();
    pluginFolderRows(r.el, r.ui, r.settings, () => []);
    expect(r.commits[0].fallback()).toBe(defaultsFor("pt-BR").exportFolder);
    expect(r.commits[1].fallback()).toBe(defaultsFor("pt-BR").submissionsFolder);
  });
});
