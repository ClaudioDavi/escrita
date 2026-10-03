import { beforeEach, describe, expect, it } from "vitest";
import { MarkdownView, noticeLog } from "./support/obsidian";
import type { Extension } from "@codemirror/state";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import type { FeatureModule } from "../src/core/module-context";
import { DialogueFocusFeature, MoveBlocksFeature, SpellcheckFeature, TemplatesFeature, TypingFeature } from "../src/editor/features";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let registry: FeatureRegistry;

const COMMANDS: Record<string, string[]> = {
  typing: ["escrita:insert-scene-break"],
  dialogueFocus: ["escrita:toggle-dialogue-focus"],
  moveBlocks: ["escrita:move-paragraph-up", "escrita:move-paragraph-down", "escrita:move-scene-up", "escrita:move-scene-down"],
  templates: ["escrita:insert-from-template"],
  spellcheck: ["escrita:toggle-spellcheck"],
};

beforeEach(() => {
  plugin = fakePlugin();
  noticeLog.length = 0;
  const p = plugin.asPlugin;
  const modules = new Map<FeatureId, FeatureModule>([
    ["typing", new TypingFeature(p)], ["dialogueFocus", new DialogueFocusFeature(p)],
    ["moveBlocks", new MoveBlocksFeature(p)], ["templates", new TemplatesFeature(p)],
    ["spellcheck", new SpellcheckFeature(p)],
  ]);
  registry = new FeatureRegistry(p, modules);
  plugin.features = registry;
  registry.init();
});

function only(...on: FeatureId[]): void {
  const features: Partial<Record<FeatureId, boolean>> = {};
  for (const id of Object.keys(COMMANDS) as FeatureId[]) features[id] = on.includes(id);
  plugin.settings.features = features;
  plugin.settings.spellcheckOnDemand = on.includes("spellcheck");
  registry.apply();
}

function nothingLeft(): void {
  expect([...plugin.commands.keys()]).toEqual([]);
  expect(plugin.followers.size).toBe(0);
  expect(plugin.liveListeners()).toBe(0);
  expect(plugin.indexAdded.length - plugin.indexRemoved.length).toBe(0);
  expect(plugin.ribbon.size).toBe(0);
  expect(plugin.statusBars.length).toBe(0);
  expect(plugin.drawn.size).toBe(0);
  for (const slot of plugin.extensions) expect(slot as Extension[]).toEqual([]);
}

describe("declared slots", () => {
  it("registers one editor array each for typing, dialogue focus and spellcheck, once", () => {
    expect(plugin.extensions).toHaveLength(3);
    only("typing");
    only();
    only("typing");
    expect(plugin.extensions).toHaveLength(3);
  });
});

describe.each(Object.keys(COMMANDS))("%s", (id) => {
  it("loads, unloads and leaves nothing registered", () => {
    only(id as FeatureId);
    expect(registry.isOn(id as FeatureId)).toBe(true);
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS[id]].sort());
    only();
    expect(registry.isOn(id as FeatureId)).toBe(false);
    nothingLeft();
  });

  it("loads again with one of each registration", () => {
    only(id as FeatureId);
    only();
    only(id as FeatureId);
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS[id]].sort());
    const filled = plugin.extensions.filter((e) => (e as Extension[]).length > 0).length;
    expect(filled).toBe(id === "typing" || id === "dialogueFocus" || id === "spellcheck" ? 1 : 0);
    expect(plugin.followers.size).toBe(id === "dialogueFocus" ? 1 : 0);
    only();
    nothingLeft();
  });

  it("every command is added from a fresh object and removed by its raw id", () => {
    only(id as FeatureId);
    only();
    const removed = plugin.commandLog.filter((l) => l.startsWith("remove ")).map((l) => l.slice(7));
    expect(removed.sort()).toEqual(COMMANDS[id].map((c) => c.slice("escrita:".length)).sort());
  });
});

describe("features are independent", () => {
  it("turning one off keeps the others' commands and extensions", () => {
    only("typing", "dialogueFocus", "moveBlocks", "templates", "spellcheck");
    expect(plugin.commands.size).toBe(8);
    expect(plugin.extensions.filter((e) => (e as Extension[]).length > 0)).toHaveLength(3);
    only("typing", "moveBlocks", "templates", "spellcheck");
    expect(plugin.commands.has("escrita:toggle-dialogue-focus")).toBe(false);
    expect(plugin.commands.size).toBe(7);
    expect(plugin.extensions.filter((e) => (e as Extension[]).length > 0)).toHaveLength(2);
    expect(plugin.followers.size).toBe(0);
  });

  it("typing registers its three extensions as one array", () => {
    only("typing");
    const filled = plugin.extensions.map((e) => e as Extension[]).filter((e) => e.length > 0);
    expect(filled).toHaveLength(1);
    expect(filled[0]).toHaveLength(3);
  });
});

describe("spellcheck on demand", () => {
  const toggle = () => (plugin.commands.get("escrita:toggle-spellcheck") as { callback: () => void }).callback();
  const spellExt = () => plugin.extensions.map((e) => e as Extension[]);

  it("suppresses spellcheck while loaded and toggling gives it back, then suppresses it again", () => {
    only("spellcheck");
    expect(spellExt()[2]).toHaveLength(1);
    const before = plugin.app.workspace.updateOptionsCalls;
    toggle();
    expect(spellExt()[2]).toHaveLength(0);
    expect(plugin.app.workspace.updateOptionsCalls).toBe(before + 1);
    toggle();
    expect(spellExt()[2]).toHaveLength(1);
    expect(noticeLog).toHaveLength(2);
  });

  it("is Obsidian's own spellcheck when unloaded, and starts suppressed again on the next load", () => {
    only("spellcheck");
    toggle();
    only();
    expect(spellExt()[2]).toHaveLength(0);
    only("spellcheck");
    expect(spellExt()[2]).toHaveLength(1);
  });
});

describe("dialogue focus", () => {
  it("its toggle state follows a rename while loaded and is dropped on unload", () => {
    only("dialogueFocus");
    const view = Object.assign(new MarkdownView(), {
      file: { path: "a.md" },
      getMode: () => "source",
    });
    plugin.app.workspace.activeView = view;
    const cmd = plugin.commands.get("escrita:toggle-dialogue-focus") as { checkCallback: (c: boolean) => boolean };
    expect(cmd.checkCallback(true)).toBe(true);
    cmd.checkCallback(false);
    expect(noticeLog.at(-1)).toBe("editor.dialogueFocusOn");
    const [f] = [...plugin.followers];
    f.moved!("a.md", "b.md");
    f.deleted!("b.md");
    only();
    nothingLeft();
    only("dialogueFocus");
    cmd.checkCallback(false);
    expect(noticeLog.at(-1)).toBe("editor.dialogueFocusOn");
  });
});

describe("commands in the wrong place", () => {
  it("the editor commands decline outside Live Preview and Source", () => {
    only("moveBlocks", "templates");
    for (const id of ["escrita:move-scene-up", "escrita:insert-from-template"]) {
      const cmd = plugin.commands.get(id) as { editorCheckCallback: (c: boolean, e: unknown, v: unknown) => boolean };
      expect(cmd.editorCheckCallback(true, {}, {})).toBe(false);
    }
  });
});
