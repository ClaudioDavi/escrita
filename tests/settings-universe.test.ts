// @vitest-environment happy-dom
// Task 2.2c: the universe and threads sections build their rows in their modules (PLAN-1.0.3 Wave 1: task D).

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { universeStrings } from "../src/universe/strings";
import { DEFAULT_SETTINGS, defaultsFor } from "../src/settings";
import { universeSettingsItems } from "../src/universe/settings-ui";
import { threadsSettingsItems } from "../src/universe/threads-settings-ui";
import { resetSettingLog } from "./support/obsidian";
import { names, ptRig, rig } from "./support/section-rig";
import { commit, fakeUi } from "./support/section-ui";
import { renderBlocks, rowNamed } from "./support/definitions";

beforeAll(() => { registerStrings(coreStrings); registerStrings(universeStrings); });
beforeEach(() => resetSettingLog());

describe("universe and threads sections", () => {
  it("the universe draws no slot heading of its own, and the thread words once", () => {
    const r = rig({ universeMode: "universe" });
    renderBlocks(universeSettingsItems(r.ui, r.plugin));
    expect(names()).not.toContain(t("universe.settings"));
    expect(names().filter((n) => n === t("universe.settings.threadWord"))).toHaveLength(1);
    expect(names()).toContain(t("universe.settings.types"));
    expect(names()).toContain(t("universe.settings.names"));
  });

  it("the thread words follow the form and come before the types", () => {
    const r = rig({ universeMode: "perBook" });
    renderBlocks(universeSettingsItems(r.ui, r.plugin));
    const n = names();
    expect(n.indexOf(t("universe.settings.threadWord"))).toBeGreaterThan(n.indexOf(t("universe.settings.form")));
    expect(n.indexOf(t("universe.settings.threadWord"))).toBeLessThan(n.indexOf(t("universe.settings.types")));
  });

  it("with threads off the universe section has no thread words", () => {
    const r = rig({ universeMode: "universe" }, ["universe"]);
    renderBlocks(universeSettingsItems(r.ui, r.plugin));
    expect(names()).not.toContain(t("universe.settings.threadWord"));
  });

  it("with the mode off only the thread words draw", () => {
    const r = rig({ universeMode: "off" });
    renderBlocks(universeSettingsItems(r.ui, r.plugin));
    expect(names()).toEqual([t("universe.settings.threadWord"), t("universe.settings.closedWord")]);
  });

  it("threads draws the words only when the universe is off, and a committed word is saved", () => {
    const on = rig({}, ["universe", "threads"]);
    renderBlocks(threadsSettingsItems(on.ui, on.plugin));
    expect(names()).toEqual([]);
    const off = rig({}, ["threads"]);
    renderBlocks(threadsSettingsItems(off.ui, off.plugin));
    expect(names()).toEqual([t("universe.settings.threadWord"), t("universe.settings.closedWord")]);
    off.commits[0].apply("loose end");
    expect(off.settings.threadKeyword).toBe("loose end");
    expect(off.commits[1].fallback()).toBe("closed");
  });

  it("the universe form field saves once per commit", () => {
    const r = rig({ universeMode: "universe" });
    renderBlocks(universeSettingsItems(r.ui, r.plugin));
    const form = r.commits.find((c) => c.fallback() === DEFAULT_SETTINGS.formProperty)!;
    form.apply("kind");
    expect(r.settings.formProperty).toBe("kind");
  });
});

describe("a pt-BR install falls back to the pt-BR set (1.0 known issue: English defaults in the tab)", () => {
  it("ui.defaults() is the install's set", () => {
    const r = ptRig();
    expect(r.ui.defaults().threadClosedWord).toBe("fechada");
    expect(r.ui.defaults().chaptersFolder).toBe("Capítulos");
  });

  it("clearing the thread words restores thread and the pt-BR closed word", () => {
    const r = ptRig({}, ["threads"]);
    renderBlocks(threadsSettingsItems(r.ui, r.plugin));
    expect(r.commits[0].fallback()).toBe("thread");
    expect(r.commits[1].fallback()).toBe(defaultsFor("pt-BR").threadClosedWord);
    expect(r.commits[1].fallback()).not.toBe("closed");
  });

  it("clearing the universe note restores Universo.md", () => {
    const r = ptRig({ universeMode: "universe" });
    renderBlocks(universeSettingsItems(r.ui, r.plugin));
    expect(r.commits.some((c) => c.fallback() === "Universo.md")).toBe(true);
  });
});

// The blocks and rows of PLAN-1.0.3 (board 40): the slot's heading is the core's, "Types" and
// "Names" are blocks with headings of their own, the descriptions are the first rows.
describe("the universe section's blocks", () => {
  const rowNames = () => names().filter(Boolean);

  it("is three blocks in a universe: the form rows, then Types and Names under their own headings", () => {
    const r = rig({ universeMode: "universe" });
    const blocks = universeSettingsItems(r.ui, r.plugin);
    expect(blocks.map((b) => b.heading)).toEqual([undefined, t("universe.settings.types"), t("universe.settings.names")]);
    renderBlocks(blocks);
    expect(rowNames()).toEqual([
      "universe.settings.note", "universe.settings.folders", "universe.settings.form", "universe.settings.formFolders",
      "universe.settings.threadWord", "universe.settings.closedWord", "universe.settings.types", "universe.settings.types.property",
      "universe.settings.names", "universe.settings.underline", "universe.settings.titles", "universe.settings.props",
    ].map((k) => t(k)));
  });

  it("per book has no note or folders, and its form row is one field", () => {
    const r = rig({ universeMode: "perBook" });
    const { groups } = renderBlocks(universeSettingsItems(r.ui, r.plugin));
    expect(rowNames()).toEqual([
      "universe.settings.form", "universe.settings.threadWord", "universe.settings.closedWord", "universe.settings.types",
      "universe.settings.types.property", "universe.settings.names", "universe.settings.underline", "universe.settings.titles", "universe.settings.props",
    ].map((k) => t(k)));
    expect(rowNamed(groups, t("universe.settings.form"))!.setting.components).toHaveLength(1);
    expect(rowNamed(groups, t("universe.settings.form"))!.def.desc).toBe(t("universe.settings.form.desc.perBook"));
  });

  it("starts with the description and the mode pointer as rows without a name", () => {
    const r = rig({ universeMode: "universe" });
    const { groups } = renderBlocks(universeSettingsItems(r.ui, r.plugin));
    const [desc, pointer] = groups[0].rows;
    expect(desc.def.name).toBe("");
    expect(desc.setting.settingEl.textContent).toBe(t("universe.settings.desc"));
    expect(pointer.setting.settingEl.textContent).toBe(t("universe.settings.mode.pointer"));
    expect(desc.def.searchable).toBe(false);
  });

  it("with the mode off and threads off there is nothing to show", () => {
    const r = rig({ universeMode: "off" }, ["universe"]);
    expect(universeSettingsItems(r.ui, r.plugin)).toEqual([]);
  });

  it("the form row holds the property and, in a universe, the values after it; the values save once per change", () => {
    const { ui, save } = fakeUi();
    const r = rig({ universeMode: "universe" });
    const { groups } = renderBlocks(universeSettingsItems(ui, r.plugin));
    const form = rowNamed(groups, t("universe.settings.form"))!.setting.components;
    expect(form).toHaveLength(2);
    commit(form[0], " kind ");
    expect(r.settings.formProperty).toBe("kind");
    expect(save).toHaveBeenCalledTimes(1);
    const before = r.settings.formValues;
    const keys = Object.keys(before) as (keyof typeof before)[];
    commit(form[1], "a, , c");
    expect(save).toHaveBeenCalledTimes(2);
    expect(r.settings.formValues[keys[0]]).toBe("a");
    expect(r.settings.formValues[keys[1]]).toBe(before[keys[1]]);   // a blank item keeps the saved word
    expect(form[1].inputEl.value).toContain("a, ");
  });

  it("the note and folders fields store, and the note keeps its default when cleared", () => {
    const { ui, save } = fakeUi();
    const r = rig({ universeMode: "universe" });
    const { groups } = renderBlocks(universeSettingsItems(ui, r.plugin));
    const note = rowNamed(groups, t("universe.settings.note"))!.setting.components;
    expect(note).toHaveLength(2);   // the field and the "Create" button
    commit(note[0], "");
    expect(r.settings.universeNote).toBe(DEFAULT_SETTINGS.universeNote);
    const folders = rowNamed(groups, t("universe.settings.folders"))!.setting.components[0];
    commit(folders, " Worlds ");
    expect(r.settings.defaultUniverseFolders).toBe("Worlds");
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("the types table keeps its inputs, labels and change-saves", () => {
    const { ui, save } = fakeUi();
    const r = rig({ universeMode: "universe" });
    const { el } = renderBlocks(universeSettingsItems(ui, r.plugin));
    const table = el.querySelector(".escrita-types")!;
    expect(table.getAttribute("role")).toBe("group");
    const folder = el.querySelector<HTMLInputElement>(`input[aria-label="${t("universe.kind.character")}: ${t("universe.settings.types.folder")}"]`)!;
    expect(folder.value).toBe(DEFAULT_SETTINGS.entryTypes.character.folder);
    folder.value = " /People/ ";
    folder.dispatchEvent(new Event("change"));
    expect(r.settings.entryTypes.character.folder).toBe("People");
    expect(folder.value).toBe("/People/");
    expect(save).toHaveBeenCalledTimes(1);
    folder.value = "";
    folder.dispatchEvent(new Event("change"));
    expect(r.settings.entryTypes.character.folder).toBe(DEFAULT_SETTINGS.entryTypes.character.folder);
    const tpl = el.querySelector<HTMLInputElement>(`input[aria-label="${t("universe.kind.character")}: ${t("universe.settings.types.template")}"]`)!;
    tpl.value = "T/Character.md";
    tpl.dispatchEvent(new Event("change"));
    expect(r.settings.entryTypes.character.template).toBe("T/Character.md");
    tpl.value = "";
    tpl.dispatchEvent(new Event("change"));
    expect(r.settings.entryTypes.character.template).toBe("");
  });

  it("the type property clears to the install's default", () => {
    const r = ptRig({ universeMode: "universe", typeProperty: "x" });
    const { groups } = renderBlocks(universeSettingsItems(r.ui, r.plugin));
    expect(rowNamed(groups, t("universe.settings.types.property"))).toBeDefined();
    const commitOfType = r.commits.find((c) => c.fallback() === defaultsFor("pt-BR").typeProperty)!;
    commitOfType.apply("tipo");
    expect(r.settings.typeProperty).toBe("tipo");
  });

  it("the property names are collapsed, hold their inputs, and save with the default as the fallback", () => {
    const { ui, save } = fakeUi();
    const r = rig({ universeMode: "universe" });
    const { groups, el } = renderBlocks(universeSettingsItems(ui, r.plugin));
    const block = el.querySelector<HTMLElement>("#escrita-universe-props")!;
    expect(block.classList.contains("escrita-universe-props")).toBe(true);
    expect(block.closest<HTMLElement>(".escrita-custom-row")!.style.display).toBe("none");
    const toggle = rowNamed(groups, t("universe.settings.props"))!.setting.components[0];
    expect(toggle.buttonEl.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.buttonEl.getAttribute("aria-controls")).toBe("escrita-universe-props");
    const ignore = block.querySelector<HTMLInputElement>(`input[aria-label="${t("universe.settings.props.ignore.label")}"]`)!;
    expect(ignore.value).toBe(r.settings.ignoreProperty);
    ignore.value = " skip ";
    ignore.dispatchEvent(new Event("change"));
    expect(r.settings.ignoreProperty).toBe("skip");
    ignore.value = "";
    ignore.dispatchEvent(new Event("change"));
    expect(r.settings.ignoreProperty).toBe(DEFAULT_SETTINGS.ignoreProperty);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("the underline switch saves at once and the titles save when committed", async () => {
    const { ui, save } = fakeUi();
    const r = rig({ universeMode: "universe" });
    const { groups } = renderBlocks(universeSettingsItems(ui, r.plugin));
    const underline = rowNamed(groups, t("universe.settings.underline"))!.setting.components[0];
    await underline.fire(!r.settings.underlineNames);
    expect(r.settings.underlineNames).toBe(!DEFAULT_SETTINGS.underlineNames);
    expect(save).toHaveBeenCalledTimes(1);
    commit(rowNamed(groups, t("universe.settings.titles"))!.setting.components[0], "sir, lady");
    expect(r.settings.nameTitles).toBe("sir, lady");
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("the thread words describe themselves with the live words, and carry no description with the mode off", () => {
    const r = rig({ universeMode: "universe", threadKeyword: "loose" });
    const { groups } = renderBlocks(universeSettingsItems(r.ui, r.plugin));
    expect(rowNamed(groups, t("universe.settings.threadWord"))!.def.desc).toContain("%% loose: … %%");
    const off = rig({ universeMode: "off" });
    const { groups: offGroups } = renderBlocks(universeSettingsItems(off.ui, off.plugin));
    expect(rowNamed(offGroups, t("universe.settings.threadWord"))!.def.desc).toBeUndefined();
  });
});
