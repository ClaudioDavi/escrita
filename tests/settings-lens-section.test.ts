// @vitest-environment happy-dom
import type { SettingDefinitionRender } from "obsidian";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { lensStrings } from "../src/lens/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { lensOffNotice, lensSettingsItems } from "../src/lens/settings-ui";
import { listsPath } from "../src/lens/settings";
import { listsPath as reexported } from "../src/lens/lists";
import { RULES } from "../src/lens/types";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { fakeUi } from "./support/section-ui";
import { renderBlocks, rowNamed } from "./support/definitions";

beforeAll(() => { registerStrings(coreStrings); registerStrings(lensStrings); });
beforeEach(() => resetSettingLog());

const plugin = () => ({ settings: { ...DEFAULT_SETTINGS, lensListsNote: "" }, lens: { createLists: async () => {} } });

describe("lens settings items", () => {
  it("draws the two block headings (the tab draws the section's) and a row per rule", () => {
    renderBlocks(lensSettingsItems(fakeUi().ui, plugin() as never));
    expect(settingLog.filter((r) => r.heading).map((r) => r.name)).toEqual([t("settings.lens.rules"), t("settings.lens.measures")]);
    expect(settingLog.map((r) => r.name)).toContain(t("settings.lens.lists"));
    expect(settingLog).toHaveLength(12 + RULES.length);   // 2 block headings, the description, lists, 2 numbers, skip quotes, rules, the names rule and its Not names list, 3 measures
  });

  it("a committed lists path is saved once, and an unchanged one is not", () => {
    const inputs: HTMLInputElement[] = [];
    const make = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const e = make(tag);
      if (tag === "input") inputs.push(e as HTMLInputElement);
      return e;
    }) as never);
    const p = plugin();
    const { ui, save } = fakeUi();
    try { renderBlocks(lensSettingsItems(ui, p as never)); } finally { spy.mockRestore(); }
    const lists = inputs[0];   // the first text field is the lists note
    lists.value = "Modelos/Revisão";
    lists.dispatchEvent(new Event("change"));
    lists.dispatchEvent(new Event("blur"));
    expect(p.settings.lensListsNote).toBe("Modelos/Revisão.md");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("Not names is saved as trimmed lines, and only when it changed (U 2.5)", () => {
    const inputs: HTMLInputElement[] = [];
    const make = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const e = make(tag);
      if (tag === "input") inputs.push(e as HTMLInputElement);
      return e;
    }) as never);
    const p = plugin();
    const { ui, save } = fakeUi();
    try { renderBlocks(lensSettingsItems(ui, p as never)); } finally { spy.mockRestore(); }
    const field = inputs.find((i) => i.getAttribute("aria-label") === t("settings.lens.notNames"))!;
    field.value = "  Zefa  ";   // (the stub field is an input, which has no line breaks)
    field.dispatchEvent(new Event("change"));
    expect(p.settings.notNames).toBe("Zefa");
    expect(save).toHaveBeenCalledTimes(1);
    field.dispatchEvent(new Event("change"));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("the section is three groups in order: the opening rows, Rules and Measures; the description is the first row", () => {
    const { groups } = renderBlocks(lensSettingsItems(fakeUi().ui, plugin() as never));
    expect(groups.map((g) => g.def.heading)).toEqual([undefined, t("settings.lens.rules"), t("settings.lens.measures")]);
    expect(groups[0].rows.map((r) => r.def.name)).toEqual(["", t("settings.lens.lists"), t("settings.lens.echoWindow"), t("settings.lens.longSentence"), t("settings.lens.skipQuotes")]);
    expect(groups[0].rows[0].setting.settingEl.textContent).toBe(t("settings.lens.desc"));
  });

  it("Create lists makes the lists and redraws the tab", async () => {
    const p = { ...plugin(), lens: { createLists: vi.fn(async () => {}) } };
    const { ui } = fakeUi();
    const def = lensSettingsItems(ui, p as never)[0].items[1] as SettingDefinitionRender;
    expect(def.name).toBe(t("settings.lens.lists"));
    let onClick: (() => unknown) | undefined;
    const button = { setButtonText: vi.fn(() => button), onClick: (cb: () => unknown) => { onClick = cb; return button; } };
    const setting = {
      settingEl: document.createElement("div"),
      setDesc: () => setting,
      addText: () => setting,
      addButton: (cb: (b: typeof button) => unknown) => { cb(button); return setting; },
    };
    def.render!(setting as never, undefined as never);
    expect(button.setButtonText).toHaveBeenCalledWith(t("settings.lens.lists.create"));
    expect(setting.settingEl.classList.contains("escrita-lens-stack")).toBe(true);
    await onClick!();
    expect(p.lens.createLists).toHaveBeenCalledTimes(1);
    expect(ui.redraw).toHaveBeenCalledTimes(1);
  });

  it("a number is kept between its limits and saved only when it changed", () => {
    const inputs: HTMLInputElement[] = [];
    const make = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const e = make(tag);
      if (tag === "input") inputs.push(e as HTMLInputElement);
      return e;
    }) as never);
    const p = plugin();
    const { ui, save } = fakeUi();
    try { renderBlocks(lensSettingsItems(ui, p as never)); } finally { spy.mockRestore(); }
    const field = inputs.find((i) => i.getAttribute("aria-label") === t("settings.lens.echoWindow"))!;
    field.value = "5000";
    field.dispatchEvent(new Event("change"));
    expect(p.settings.lensEchoWindow).toBe(200);
    expect(save).toHaveBeenCalledTimes(1);
    field.value = "200";
    field.dispatchEvent(new Event("change"));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("a rule's toggle turns it off and on in the settings, saving each time", async () => {
    const p = plugin();
    const { ui, save } = fakeUi();
    const { groups } = renderBlocks(lensSettingsItems(ui, p as never));
    const toggle = rowNamed(groups, t("lens.rule.echo"))!.setting.components[0] as unknown as { fire: (v: boolean) => Promise<void> };
    await toggle.fire(false);
    expect(p.settings.lensRulesOff).toEqual(["echo"]);
    await toggle.fire(true);
    expect(p.settings.lensRulesOff).toEqual([]);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("listsPath lives in lens/settings and lists.ts re-exports it", () => {
    expect(reexported).toBe(listsPath);
    expect(listsPath("/Modelos/Revisão")).toBe("Modelos/Revisão.md");
  });

  it("the off notice names the lists note", async () => {
    const p = plugin();
    expect(await lensOffNotice(p as never)).toEqual(expect.stringContaining(".md"));
    p.settings.lensListsNote = "Minhas listas.md";
    expect(await lensOffNotice(p as never)).toEqual(expect.stringContaining("Minhas listas.md"));
  });
});
