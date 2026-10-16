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
  it("are the manuscript rows in today's order, then the Screenplays group (1.1)", () => {
    const { ui } = fakeUi();
    const blocks = exportSettingsItems(ui, plugin() as never);
    expect(blocks.map((b) => b.heading)).toEqual([undefined, t("export.settings.screenplay.heading")]);
    renderBlocks(blocks);
    expect(settingLog.map((r) => r.name)).toEqual([
      ...["compile", "dedication", "epigraph", "authorProperty", "authorName", "authorSurname", "contact", "heading.format", "cover", "epubBreak", "collection"].map((k) => `export.settings.${k}`),
      "export.settings.screenplay.heading",
      ...["sceneHeadings", "transitions", "page", "sceneNumbers", "more", "continued", "credit", "source", "draftDate"].map((k) => `export.settings.screenplay.${k}`),
    ].map((k) => t(k)));
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

describe("the Screenplays group (1.1, board 44 b)", () => {
  const row = (groups: ReturnType<typeof renderBlocks>["groups"], name: string) => rowNamed(groups, t(`export.settings.screenplay.${name}`))!.setting;

  it("draws the nine rows, all named for the settings search, with the descriptions", () => {
    const { ui } = fakeUi();
    const { groups } = renderBlocks(exportSettingsItems(ui, plugin() as never));
    for (const k of ["sceneHeadings", "transitions", "page", "sceneNumbers", "more", "continued", "credit", "source", "draftDate"]) {
      expect(row(groups, k).row.desc).toBe(t(`export.settings.screenplay.${k}.desc`));
    }
  });

  it("the page is a dropdown and the scene numbers a toggle, both saved at once", async () => {
    const p = plugin();
    const { ui, save } = fakeUi();
    const { groups } = renderBlocks(exportSettingsItems(ui, p as never));
    await row(groups, "page").components[0].fire("a4");
    expect(p.settings.screenplayPage).toBe("a4");
    await row(groups, "sceneNumbers").components[0].fire(true);
    expect(p.settings.screenplaySceneNumbers).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("a cleared word falls back to the install's own, in its language", () => {
    const p = plugin({ ...defaultsFor("pt-BR"), defaultsLanguage: "pt-BR", screenplayMore: "(x)", screenplayTransitions: "x:" });
    const { ui } = fakeUi("pt-BR");
    const { groups } = renderBlocks(exportSettingsItems(ui, p as never));
    commit(row(groups, "more").components[0], "");
    commit(row(groups, "transitions").components[0], " ");
    commit(row(groups, "credit").components[0], " Escrito por ");
    expect(p.settings.screenplayMore).toBe("(MAIS)");
    expect(p.settings.screenplayTransitions).toBe("TO:, PARA:");
    expect(p.settings.screenplayCredit).toBe("Escrito por");
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
    // the rejected name changes nothing, so the first commit writes nothing; "piece" and the blank commit do
    expect(save).toHaveBeenCalledTimes(2);
  });
});
