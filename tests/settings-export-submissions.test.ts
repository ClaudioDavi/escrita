// @vitest-environment happy-dom
// The Export and Submissions sections build their rows in their modules (PLAN-1.0.3 Wave 1: task D):
// one row per key, no heading of their own (the tab draws the slot's), text fields that save on commit.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { exportStrings } from "../src/export/strings";
import { submissionsStrings } from "../src/submissions/strings";
import { DEFAULT_SETTINGS, defaultsFor, type EscritaSettings } from "../src/settings";
import { exportSettingsItems } from "../src/export/settings-ui";
import { submissionsSettingsItems } from "../src/submissions/settings-ui";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";
import { renderBlocks, rowNamed } from "./support/definitions";

beforeAll(() => { registerStrings(coreStrings); registerStrings(exportStrings); registerStrings(submissionsStrings); });
beforeEach(() => resetSettingLog());

const plugin = (over: Partial<EscritaSettings> = {}) => ({ settings: { ...DEFAULT_SETTINGS, ...over } as EscritaSettings });

describe("export settings items", () => {
  it("are one block without a heading, with the rows in today's order", () => {
    const { ui } = fakeUi();
    const blocks = exportSettingsItems(ui, plugin() as never);
    expect(blocks.map((b) => b.heading)).toEqual([undefined]);
    renderBlocks(blocks);
    expect(settingLog.map((r) => r.name)).toEqual([
      "compile", "dedication", "epigraph", "authorProperty", "authorName", "authorSurname", "contact", "heading.format", "cover", "epubBreak", "collection",
    ].map((k) => t(`export.settings.${k}`)));
    expect(settingLog.some((r) => r.heading)).toBe(false);
  });

  it("a property commits and saves once; blank falls back to the install's default", () => {
    const p = plugin({ ...defaultsFor("pt-BR"), defaultsLanguage: "pt-BR" });
    const { ui, save } = fakeUi("pt-BR");
    const { groups } = renderBlocks(exportSettingsItems(ui, p as never));
    const compile = rowNamed(groups, t("export.settings.compile"))!.setting.components[0];
    commit(compile, " out ");
    expect(p.settings.compileProperty).toBe("out");
    expect(save).toHaveBeenCalledTimes(1);
    commit(compile, "");
    expect(p.settings.compileProperty).toBe(defaultsFor("pt-BR").compileProperty);
    expect(compile.inputEl.value).toBe(defaultsFor("pt-BR").compileProperty);
  });

  it("the author, contact and heading format fall back to empty", () => {
    const p = plugin({ authorName: "Ana", contactLines: "a\nb", chapterHeadingFormat: "Chapter {n}" });
    const { ui } = fakeUi();
    const { groups } = renderBlocks(exportSettingsItems(ui, p as never));
    for (const [name, key] of [["authorName", "authorName"], ["authorSurname", "authorSurname"], ["contact", "contactLines"], ["heading.format", "chapterHeadingFormat"]] as const) {
      commit(rowNamed(groups, t(`export.settings.${name}`))!.setting.components[0], "");
      expect(p.settings[key]).toBe("");
    }
  });
});

describe("submissions settings items", () => {
  it("are one block without a heading: the results, then the five property names", () => {
    const { ui } = fakeUi();
    const blocks = submissionsSettingsItems(ui, plugin() as never);
    expect(blocks.map((b) => b.heading)).toEqual([undefined]);
    renderBlocks(blocks);
    expect(settingLog.map((r) => r.name)).toEqual([
      t("submissions.settings.results"),
      ...["Work", "Market", "Sent", "Result", "Responded"].map((n) => t(`submissions.settings.prop${n}`)),
    ]);
  });

  it("the result values are stored as a clean list", () => {
    const p = plugin();
    const { ui } = fakeUi();
    const { groups } = renderBlocks(submissionsSettingsItems(ui, p as never));
    const results = rowNamed(groups, t("submissions.settings.results"))!.setting.components[0];
    commit(results, "pending,  accepted ,rejected");
    expect(p.settings.submissionResults).toBe("pending, accepted, rejected");
    expect(results.inputEl.value).toBe("pending, accepted, rejected");
    commit(results, "");
    expect(p.settings.submissionResults).toBe(DEFAULT_SETTINGS.submissionResults);
  });

  it("a property name another one already uses is not stored, and the field shows the saved name again", () => {
    const p = plugin();
    const { ui, save } = fakeUi();
    const { groups } = renderBlocks(submissionsSettingsItems(ui, p as never));
    const work = rowNamed(groups, t("submissions.settings.propWork"))!.setting.components[0];
    commit(work, p.settings.submissionMarketProperty);
    expect(p.settings.submissionWorkProperty).toBe(DEFAULT_SETTINGS.submissionWorkProperty);
    expect(work.inputEl.value).toBe(DEFAULT_SETTINGS.submissionWorkProperty);
    commit(work, "piece");
    expect(p.settings.submissionWorkProperty).toBe("piece");
    commit(work, "");
    expect(p.settings.submissionWorkProperty).toBe(DEFAULT_SETTINGS.submissionWorkProperty);
    expect(save).toHaveBeenCalledTimes(3);
  });
});
