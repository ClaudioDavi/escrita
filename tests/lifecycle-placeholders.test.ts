import { beforeEach, describe, expect, it } from "vitest";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { PlaceholdersModule, PLACEHOLDERS_VIEW } from "../src/placeholders";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let mod: PlaceholdersModule;
let registry: FeatureRegistry;

beforeEach(() => {
  plugin = fakePlugin();
  mod = new PlaceholdersModule(plugin.asPlugin);
  registry = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, PlaceholdersModule>([["placeholders", mod]]));
  plugin.features = registry;
  registry.init();
});

const COMMANDS = [
  "escrita:insert-placeholder", "escrita:next-placeholder",
  "escrita:previous-placeholder", "escrita:open-placeholders",
];

describe("placeholders lifecycle", () => {
  it("registers the slots once at init, even while off", () => {
    expect(plugin.views.has(PLACEHOLDERS_VIEW)).toBe(true);
    expect(plugin.extensions).toHaveLength(1);
    expect(plugin.indexAdded).toHaveLength(0);
    expect(plugin.commands.size).toBe(0);
  });

  it("load registers commands, index, dots and the extension", () => {
    registry.apply();
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect(plugin.indexAdded).toHaveLength(1);
    expect(plugin.drawn.has("dot")).toBe(true);
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);
  });

  it("unload leaves nothing registered, and the data stays", () => {
    plugin.data.history = { keep: "me" } as never;
    registry.apply();
    plugin.turn("placeholders", false);
    registry.apply();
    expect(plugin.commands.size).toBe(0);
    expect(plugin.drawn.size).toBe(0);
    expect(plugin.indexRemoved).toEqual(plugin.indexAdded);
    expect(plugin.indexAdded[0].disposed).toBe(true);
    expect((plugin.extensions[0] as unknown[]).length).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(plugin.app.workspace.detached).toContain(PLACEHOLDERS_VIEW);
    expect(plugin.data.history).toEqual({ keep: "me" });
    expect(mod.countFor("a.md")).toBe(0);
    expect(mod.paths()).toEqual([]);
    expect(mod.isReady()).toBe(false);
  });

  it("a second load registers one of each (no double push)", () => {
    registry.apply();
    plugin.turn("placeholders", false);
    registry.apply();
    plugin.turn("placeholders", true);
    registry.apply();
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect(plugin.indexAdded).toHaveLength(2);
    expect(plugin.indexAdded[1].disposed).toBe(false);
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);
    expect(plugin.extensions).toHaveLength(1);
    expect(plugin.drawn.size).toBe(1);
  });

  it("onChange subscribers survive a reload and are fed only while loaded", () => {
    let calls = 0;
    const off = mod.onChange(() => { calls++; });
    registry.apply();
    plugin.indexAdded[0].emitChange([]);
    expect(calls).toBe(1);
    plugin.turn("placeholders", false);
    registry.apply();
    plugin.indexAdded[0].emitChange([]);
    expect(calls).toBe(1);
    plugin.turn("placeholders", true);
    registry.apply();
    plugin.indexAdded[1].emitChange([]);
    expect(calls).toBe(2);
    off();
    plugin.indexAdded[1].emitChange([]);
    expect(calls).toBe(2);
  });

  it("onChange while off returns a working unsubscribe", () => {
    const off = mod.onChange(() => {});
    expect(() => off()).not.toThrow();
  });
});
