// @vitest-environment happy-dom
// The row helpers of the settings tab (IMPROVEMENTS 36, PLAN-1.0.3): definitions whose render
// draws the control, rendered here the way Obsidian renders them (tests/support/definitions.ts).

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingDefinitionRender } from "obsidian";
import type { SettingsUi } from "../src/core/module-context";
import { registerStrings } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS, defaultsFor } from "../src/settings";
import { customRow, dropdownRow, folderRow, noteRow, numberRow, textAreaRow, textRow, toggleRow } from "../src/ui/settings-rows";
import { resetSettingLog, settingLog } from "./support/obsidian";
import { commit, fakeUi } from "./support/section-ui";
import { renderBlocks, renderDefinitions, rowNamed } from "./support/definitions";

beforeAll(() => registerStrings(coreStrings));
beforeEach(() => resetSettingLog());

/** One row rendered alone; its rendered row and the fake ui. */
function one(make: (ui: SettingsUi) => SettingDefinitionRender, lang: "en" | "pt-BR" = "en") {
  const f = fakeUi(lang);
  const def = make(f.ui);
  const el = document.createElement("div");
  const groups = renderDefinitions([def], el);
  return { ...f, def, el, groups, row: groups[0].rows[0] };
}

describe("textRow", () => {
  it("is a named render row whose field saves on commit, trimmed, and shows what was kept", () => {
    let v = "Chapters";
    const set = vi.fn((x: string) => { v = x.toUpperCase(); });
    const r = one((ui) => textRow(ui, { name: "Chapters folder", desc: "Where chapters live", get: () => v, set }));
    expect(r.def.name).toBe("Chapters folder");
    expect(r.def.desc).toBe("Where chapters live");
    expect(r.fields).toHaveLength(1);
    expect(r.fields[0].inputEl.value).toBe("Chapters");
    expect(r.fields[0].inputEl.getAttribute("aria-label")).toBe("Chapters folder");
    commit(r.fields[0], "  drafts ");
    expect(set).toHaveBeenCalledWith("drafts");
    expect(r.fields[0].inputEl.value).toBe("DRAFTS");
    expect(r.save).toHaveBeenCalledTimes(1);
  });

  it("a cleared field falls back to the key's default in the install's language (pt-BR)", () => {
    let v = "Chapters";
    const r = one((ui) => textRow(ui, { name: "x", key: "chaptersFolder", get: () => v, set: (x) => { v = x; } }), "pt-BR");
    commit(r.fields[0], "  ");
    expect(v).toBe(defaultsFor("pt-BR").chaptersFolder);
    expect(v).not.toBe(DEFAULT_SETTINGS.chaptersFolder);
  });

  it("without a key, a cleared field is empty, or the given fallback", () => {
    let v = "a";
    const r = one((ui) => textRow(ui, { name: "x", get: () => v, set: (x) => { v = x; } }));
    commit(r.fields[0], "");
    expect(v).toBe("");
    const r2 = one((ui) => textRow(ui, { name: "x", key: "chaptersFolder", fallback: () => "Own", get: () => v, set: (x) => { v = x; } }));
    commit(r2.fields[0], "");
    expect(v).toBe("Own");
  });

  it("a description function is read again at each render; the definition keeps its value for search", () => {
    let n = 1;
    const f = fakeUi();
    const def = textRow(f.ui, { name: "x", desc: () => `count ${n}`, get: () => "", set: () => {} });
    expect(def.desc).toBe("count 1");
    n = 2;
    renderDefinitions([def], document.createElement("div"));
    expect(settingLog.at(-1)!.desc).toBe("count 2");
  });

  it("puts row and input classes where they go", () => {
    const r = one((ui) => textRow(ui, { name: "x", cls: "escrita-a escrita-b", inputCls: "escrita-mono", get: () => "", set: () => {} }));
    expect(r.row.setting.settingEl.classList.contains("escrita-a")).toBe(true);
    expect(r.row.setting.settingEl.classList.contains("escrita-b")).toBe(true);
    expect(r.fields[0].inputEl.classList.contains("escrita-mono")).toBe(true);
  });
});

describe("textAreaRow", () => {
  it("commits like a text row", () => {
    let v = "";
    const r = one((ui) => textAreaRow(ui, { name: "Track folders", get: () => v, set: (x) => { v = x; } }));
    commit(r.fields[0], " Contos ");   // the stub's text area is an <input>: one line
    expect(v).toBe("Contos");
    expect(r.save).toHaveBeenCalledTimes(1);
  });
});

describe("toggleRow", () => {
  it("shows the value and saves at once", async () => {
    let v = false;
    const r = one((ui) => toggleRow(ui, { name: "Ghost beats", get: () => v, set: (x) => { v = x; } }));
    const c = r.row.setting.components[0];
    expect(c.value).toBe(false);
    await c.fire(true);
    expect(v).toBe(true);
    expect(r.save).toHaveBeenCalledTimes(1);
  });
});

describe("dropdownRow", () => {
  it("gives a number value back as a number", async () => {
    let v = 2;
    const r = one((ui) => dropdownRow(ui, { name: "Padding", options: [[1, "1"], [2, "01"], [3, "001"]], get: () => v, set: (x) => { v = x; } }));
    const c = r.row.setting.components[0];
    expect(c.value).toBe("2");
    await c.fire("3");
    expect(v).toBe(3);
    expect(r.save).toHaveBeenCalledTimes(1);
  });

  it("ignores a value that is not an option", async () => {
    let v: "a" | "b" = "a";
    const r = one((ui) => dropdownRow(ui, { name: "x", options: [["a", "A"], ["b", "B"]], get: () => v, set: (x) => { v = x; } }));
    await r.row.setting.components[0].fire("z");
    expect(v).toBe("a");
    expect(r.save).not.toHaveBeenCalled();
  });
});

describe("numberRow", () => {
  it("keeps the digits, between min and max; blank or wordless keeps the stored number", () => {
    let v = 40;
    const r = one((ui) => numberRow(ui, { name: "Echo window", min: 10, max: 200, unit: "words", get: () => v, set: (x) => { v = x; } }));
    const field = r.fields[0];
    expect(field.inputEl.value).toBe("40");
    expect(field.inputEl.inputMode).toBe("numeric");
    commit(field, "1,500");
    expect(v).toBe(200);
    expect(field.inputEl.value).toBe("200");
    commit(field, "3");
    expect(v).toBe(10);
    commit(field, "");
    expect(v).toBe(10);
    commit(field, "55 words");
    expect(v).toBe(55);
    commit(field, "abc");
    expect(v).toBe(55);
    expect(field.inputEl.value).toBe("55");
    expect(r.row.setting.controlEl.textContent).toContain("words");
  });
});

describe("folderRow", () => {
  it("saves a value that passes, and warns without saving one that doesn't", () => {
    let v = "Escrita/Export";
    const problemOf = (x: string) => (x.startsWith(".") ? { reason: "path" as const } : null);
    const r = one((ui) => folderRow(ui, { name: "Export folder", placeholder: "Escrita/Export", get: () => v, set: (x) => { v = x; }, problemOf }));
    const hint = r.row.setting.descEl.querySelector(".escrita-setting-warning") as HTMLElement;
    commit(r.fields[0], ".obsidian/x");
    expect(v).toBe("Escrita/Export");
    expect(hint.textContent).not.toBe("");
    expect(hint.style.display).toBe("");
    commit(r.fields[0], "Out");
    expect(v).toBe("Out");
    expect(hint.style.display).toBe("none");
  });

  it("takes its own problem text, and a cleared field becomes the placeholder", () => {
    let v = "Snaps";
    const r = one((ui) => folderRow(ui, {
      name: "Snapshots folder", placeholder: "Escrita/Snapshots", get: () => v, set: (x) => { v = x; },
      problemOf: (x) => (x === "bad" ? { reason: "path" } : null), problemText: () => "own words",
    }));
    commit(r.fields[0], "bad");
    expect(r.row.setting.descEl.textContent).toContain("own words");
    commit(r.fields[0], "");
    expect(v).toBe("Escrita/Snapshots");
  });
});

describe("customRow and noteRow", () => {
  it("customRow empties the row, draws into it, and its cleanup runs before the next render", () => {
    const cleanup = vi.fn();
    const draw = vi.fn((el: HTMLElement) => { el.createDiv({ cls: "mine", text: "hello" }); return cleanup; });
    const def = customRow("Presets", draw);
    expect(def.searchable).toBeUndefined();
    const el = document.createElement("div");
    const first = renderDefinitions([def], el);
    const settingEl = first[0].rows[0].setting.settingEl;
    expect(settingEl.children).toHaveLength(1);
    expect(settingEl.querySelector(".mine")?.textContent).toBe("hello");
    expect(settingEl.classList.contains("escrita-custom-row")).toBe(true);
    renderDefinitions([def], el, first);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(settingEl.querySelectorAll(".mine")).toHaveLength(1);
  });

  it("an unnamed custom row and a note row are left out of search", () => {
    expect(customRow("", () => {}).searchable).toBe(false);
    const note = noteRow("Names several features read.", "escrita-shared-desc");
    expect(note.name).toBe("");
    expect(note.searchable).toBe(false);
    const { el } = renderBlocks([{ items: [note] }]);
    const p = el.querySelector(".escrita-shared-desc");
    expect(p?.textContent).toBe("Names several features read.");
    expect(p?.classList.contains("setting-item-description")).toBe(true);
  });
});

describe("visible", () => {
  it("is read at each render; a group whose rows are all hidden hides", () => {
    let shown = true;
    const ui = fakeUi().ui;
    const defs = [
      toggleRow(ui, { name: "a", visible: () => shown, get: () => true, set: () => {} }),
      toggleRow(ui, { name: "b", visible: () => shown, get: () => true, set: () => {} }),
    ];
    const el = document.createElement("div");
    const first = renderDefinitions([{ type: "group", heading: "G", items: defs }], el);
    expect(rowNamed(first, "a")!.setting.settingEl.style.display).toBe("");
    shown = false;
    const second = renderDefinitions([{ type: "group", heading: "G", items: defs }], el, first);
    expect(rowNamed(second, "a")!.setting.settingEl.style.display).toBe("none");
    expect(second[0].group.groupEl.style.display).toBe("none");
  });
});

describe("the harness (Obsidian's keys)", () => {
  it("fails on two rows with one name in a group, and on two groups with one heading", () => {
    const ui = fakeUi().ui;
    const row = () => toggleRow(ui, { name: "Same", get: () => true, set: () => {} });
    expect(() => renderDefinitions([{ type: "group", items: [row(), row()] }], document.createElement("div"))).toThrow(/duplicate/);
    expect(() => renderDefinitions([{ type: "group", heading: "H", items: [row()] }, { type: "group", heading: "H", items: [row()] }], document.createElement("div"))).toThrow(/duplicate/);
  });

  it("keys unnamed rows by index, so several of them live in one group", () => {
    expect(() => renderBlocks([{ items: [noteRow("a"), noteRow("b"), customRow("", () => {})] }])).not.toThrow();
  });

  it("renderBlocks groups blocks as the tab does: a block without a heading joins the group above", () => {
    const named = (name: string) => customRow(name, () => {});
    expect(() => renderBlocks([{ items: [named("A")] }, { items: [named("A")] }])).toThrow(/duplicate/);
    const { groups } = renderBlocks([{ items: [named("A")] }, { heading: "Rules", items: [named("A")] }, { items: [named("B")] }]);
    expect(groups.map((g) => [g.def.heading, g.rows.map((r) => r.def.name)])).toEqual([[undefined, ["A"]], ["Rules", ["A", "B"]]]);
  });
});
