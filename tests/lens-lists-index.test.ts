import { describe, expect, it, vi } from "vitest";
import { IndexHub, type HubEvents } from "../src/core/index-hub";
import { ManualTimers, MemoryVault, settle, type MemFile } from "./support/memory-vault";

// src/i18n.ts imports obsidian, which has no runtime in vitest
vi.mock("../src/i18n", () => ({ lang: () => "en", locale: () => "en" }));
// the Obsidian-facing half of the module (views, commands) needs a running Obsidian
vi.mock("../src/lens/ui", () => ({
  LensUi: class { load() {} activePath() { return null; } refreshPanels() {} refresh() {} },
}));

import { LensModule } from "../src/lens";

const LISTS = "Modelos/Revisão.md";
const NOTE = (word: string) => `## Crutch words\n\n- ${word}\n`;

async function setup(files: Record<string, string>, setting = "Modelos/Revisão") {
  (globalThis as unknown as { window: unknown }).window = globalThis;
  const vault = new MemoryVault(files);
  const timers = new ManualTimers();
  const cbs = {
    create: [] as ((f: MemFile) => void)[], modify: [] as ((f: MemFile) => void)[],
    delete: [] as ((f: MemFile) => void)[], rename: [] as ((f: MemFile, o: string) => void)[],
    meta: [] as ((f: MemFile) => void)[], layout: [] as (() => void)[],
  };
  const events: HubEvents<MemFile> = {
    onCreate: (cb) => void cbs.create.push(cb), onModify: (cb) => void cbs.modify.push(cb),
    onDelete: (cb) => void cbs.delete.push(cb), onRename: (cb) => void cbs.rename.push(cb),
    onMetaChanged: (cb) => void cbs.meta.push(cb), onResolved: () => {},
    onLayoutReady: (cb) => void cbs.layout.push(cb), layoutReady: () => false, hasCache: () => true,
  };
  vault.onEvent((e) => {
    if (e.type === "create") cbs.create.forEach((c) => c(e.file));
    else if (e.type === "modify") cbs.modify.forEach((c) => c(e.file));
    else if (e.type === "delete") cbs.delete.forEach((c) => c({ path: e.path, extension: "", text: "" }));
    else if (e.type === "rename") cbs.rename.forEach((c) => c({ path: e.path, extension: "md", text: "" }, e.oldPath));
  });
  const hub = new IndexHub<MemFile>(events, vault, timers, { snapshotsRoot: () => "Escrita/Snapshots" });
  const saves = { settings: 0, data: 0 };
  const plugin: any = {
    settings: {
      lensListsNote: setting, lensLanguage: "auto", lensEchoWindow: 40, lensLongSentence: 45, lensRulesOff: [],
      lensSkipQuotes: true, quoteStyle: "curly", paragraphStyle: "blank",
    },
    data: { lensDismissed: {} },
    index: hub,
    app: { vault: { getAbstractFileByPath: (p: string) => vault.file(p) }, workspace: { onLayoutReady: (cb: () => void) => cbs.layout.push(cb) } },
    register: () => {},
    requestSave: () => { saves.data++; },
    saveSettings: async () => { saves.settings++; hub.settingsChanged(); lens.settingsChanged(); },
  };
  const lens = new LensModule(plugin);
  lens.load();
  cbs.layout.forEach((c) => c());
  await settle();
  return { vault, timers, lens, plugin, saves };
}

describe("lens word lists index", () => {
  it("loads the lists after the first build", async () => {
    const { lens } = await setup({ [LISTS]: NOTE("suddenly") });
    expect(lens.lists().crutch).toEqual(["suddenly"]);
    expect(lens.activeState().listsState).toBe("ok");
  });

  it("is empty and unset when the setting is empty", async () => {
    const { lens } = await setup({ [LISTS]: NOTE("suddenly") }, "");
    expect(lens.lists()).toEqual({ crutch: [], names: [], ignore: [] });
    expect(lens.activeState().listsState).toBe("unset");
  });

  it("shows an edit after the settle time", async () => {
    const { lens, vault, timers } = await setup({ [LISTS]: NOTE("suddenly") });
    vault.modify(LISTS, NOTE("slowly"));
    await timers.advance(1000);
    expect(lens.lists().crutch).toEqual(["slowly"]);
  });

  it("follows a rename: the setting moves and the lists stay", async () => {
    const { lens, vault, timers, plugin, saves } = await setup({ [LISTS]: NOTE("suddenly") });
    vault.rename(LISTS, "Modelos/Vícios.md");
    await timers.advance(2000);
    expect(plugin.settings.lensListsNote).toBe("Modelos/Vícios.md");
    expect(saves.settings).toBeGreaterThan(0);
    expect(lens.lists().crutch).toEqual(["suddenly"]);
    expect(lens.activeState().listsState).toBe("ok");
  });

  it("gives empty lists and missing after a delete, leaving the setting alone", async () => {
    const { lens, vault, timers, plugin } = await setup({ [LISTS]: NOTE("suddenly") });
    vault.delete(LISTS);
    await timers.advance(2000);
    expect(lens.lists()).toEqual({ crutch: [], names: [], ignore: [] });
    expect(lens.activeState().listsState).toBe("missing");
    expect(plugin.settings.lensListsNote).toBe("Modelos/Revisão");
  });

  it("moves and drops dismissals with the note", async () => {
    const { vault, timers, plugin } = await setup({ [LISTS]: NOTE("x"), "A.md": "text" });
    const d = { rule: "echo", text: "a", before: "", after: "" };
    plugin.data.lensDismissed["A.md"] = [d];
    vault.rename("A.md", "B.md");
    await timers.advance(100);
    expect(Object.keys(plugin.data.lensDismissed)).toEqual(["B.md"]);
    vault.delete("B.md");
    await timers.advance(100);
    expect(plugin.data.lensDismissed).toEqual({});
  });
});

describe("lens settingsChanged", () => {
  it("re-runs passes only when a setting that affects them changed", async () => {
    const { lens, plugin } = await setup({ [LISTS]: NOTE("suddenly") });
    const session = (lens as any).session;
    session.toggle("a.md");
    const first = session.now("a.md", "Ele andou lentamente.");
    plugin.settings.dailyGoal = 500;
    await plugin.saveSettings();
    expect(session.result("a.md")).toBe(first);
    plugin.settings.lensEchoWindow = 20;
    await plugin.saveSettings();
    expect(session.result("a.md")).not.toBe(first);
  });
});
