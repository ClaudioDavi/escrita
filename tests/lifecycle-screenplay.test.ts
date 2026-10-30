import { beforeEach, describe, expect, it } from "vitest";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { ScreenplayModule } from "../src/screenplay";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let mod: ScreenplayModule;
let registry: FeatureRegistry;

beforeEach(() => {
  plugin = fakePlugin();
  mod = new ScreenplayModule(plugin.asPlugin);
  registry = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, ScreenplayModule>([["screenplay", mod]]));
  plugin.features = registry;
  registry.init();
});

const COMMANDS = ["escrita:screenplay-next-element", "escrita:screenplay-previous-element"];

describe("screenplay lifecycle", () => {
  it("is off until switched on, and declares one editor slot", () => {
    expect(registry.isOn("screenplay")).toBe(false);
    expect(plugin.extensions).toHaveLength(1);
    expect((plugin.extensions[0] as unknown[]).length).toBe(0);
    expect(plugin.commands.size).toBe(0);
    expect(plugin.suggests).toHaveLength(0);
  });

  it("load registers the extensions, the two commands and the suggest", () => {
    plugin.turn("screenplay", true);
    expect(registry.isOn("screenplay")).toBe(true);
    expect([...plugin.commands.keys()].sort()).toEqual(COMMANDS);
    expect((plugin.extensions[0] as unknown[]).length).toBe(2);
    expect(plugin.suggests).toHaveLength(1);
    expect(mod.suggestEnabled).toBe(true);
    // no default hotkeys (rule 8)
    for (const c of plugin.commands.values()) expect(c.hotkeys).toBeUndefined();
    expect(plugin.liveListeners()).toBe(4); // metadata changed and resolved, vault rename and delete
  });

  it("unload leaves no extension, command or listener, and the suggest answers nothing", () => {
    plugin.turn("screenplay", true);
    plugin.turn("screenplay", false);
    expect(plugin.commands.size).toBe(0);
    expect((plugin.extensions[0] as unknown[]).length).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(mod.suggestEnabled).toBe(false);
  });

  it("a second load registers one of each, and the same suggest once", () => {
    plugin.turn("screenplay", true);
    plugin.turn("screenplay", false);
    plugin.turn("screenplay", true);
    expect([...plugin.commands.keys()].sort()).toEqual(COMMANDS);
    expect((plugin.extensions[0] as unknown[]).length).toBe(2);
    expect(plugin.extensions).toHaveLength(1);
    expect(plugin.suggests).toHaveLength(1);
    expect(mod.suggestEnabled).toBe(true);
    expect(plugin.liveListeners()).toBe(4); // metadata changed and resolved, vault rename and delete
  });

  it("the commands are offered only in a screenplay note", () => {
    plugin.turn("screenplay", true);
    const next = plugin.commands.get("escrita:screenplay-next-element")!;
    // no markdown view at all
    expect(next.editorCheckCallback!(true, {} as never, {} as never)).toBe(false);
  });
});
