// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerStrings, t } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { lensOffNotice, lensSettingsSection } from "../src/lens/settings-ui";
import { listsPath } from "../src/lens/settings";
import { listsPath as reexported } from "../src/lens/lists";
import { RULES } from "../src/lens/types";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { fakeUi } from "./support/section-ui";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

const plugin = () => ({ settings: { ...DEFAULT_SETTINGS, lensListsNote: "" }, lens: { createLists: async () => {} } });

describe("lens settings section", () => {
  it("draws the three headings and a row per rule", () => {
    lensSettingsSection(document.createElement("div"), fakeUi().ui, plugin() as never);
    expect(settingLog.filter((r) => r.heading).map((r) => r.name)).toEqual([t("settings.lens"), t("settings.lens.rules"), t("settings.lens.measures")]);
    expect(settingLog.map((r) => r.name)).toContain(t("settings.lens.lists"));
    expect(settingLog).toHaveLength(9 + RULES.length);   // 3 headings, lists, 2 numbers, skip quotes, rules, 2 measures
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
    try { lensSettingsSection(document.createElement("div"), ui, p as never); } finally { spy.mockRestore(); }
    const lists = inputs[0];   // the first text field is the lists note
    lists.value = "Modelos/Revisão";
    lists.dispatchEvent(new Event("change"));
    lists.dispatchEvent(new Event("blur"));
    expect(p.settings.lensListsNote).toBe("Modelos/Revisão.md");
    expect(save).toHaveBeenCalledTimes(1);
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
