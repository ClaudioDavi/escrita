import { beforeEach, describe, expect, it } from "vitest";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { startCoreModule, type FeatureModule } from "../src/core/module-context";
import { NewWorkModule } from "../src/new-work";
import { OutlineModule } from "../src/outline";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

const COMMANDS = ["new-work", "new-short-story", "create-book"].map((c) => `escrita:${c}`);

let plugin: FakePlugin;
let reg: FeatureRegistry;
let mod: NewWorkModule;

beforeEach(() => {
  plugin = fakePlugin();
  reg = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, FeatureModule>([["outline", new OutlineModule(plugin.asPlugin)]]));
  plugin.features = reg;
  reg.init();
  reg.apply();
  plugin.load();
  mod = new NewWorkModule(plugin.asPlugin);
  startCoreModule(plugin.asPlugin, mod);
});

/** What the command palette would do: whether the command is offered. */
function offered(id: string): boolean {
  const cmd = plugin.commands.get(id)!;
  return cmd.checkCallback ? cmd.checkCallback(true) !== false : true;
}

describe("new work lifecycle", () => {
  it("registers its three commands through the context, create-book among them", () => {
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS, "escrita:open-outline", "escrita:open-outline-board", "escrita:read-book", "escrita:read-note", "escrita:add-beat", "escrita:renumber-chapters"].sort());
  });

  it("offers create-book only while the outline is on, and never moves the other two", () => {
    expect(offered("escrita:create-book")).toBe(true);
    plugin.turn("outline", false);
    expect(offered("escrita:create-book")).toBe(false);
    expect(offered("escrita:new-work")).toBe(true);
    expect(offered("escrita:new-short-story")).toBe(true);
    plugin.turn("outline", true);
    expect(offered("escrita:create-book")).toBe(true);
  });

  it("offers a book as the outline is, and a story always", () => {
    expect(mod.offers("story")).toBe(true);
    expect(mod.offers("book")).toBe(true);
    plugin.turn("outline", false);
    expect(mod.offers("story")).toBe(true);
    expect(mod.offers("book")).toBe(false);
  });

  it("does nothing for a book while the outline is off", () => {
    plugin.turn("outline", false);
    expect(() => mod.start("book")).not.toThrow();
  });

  it("keeps its commands when the outline turns off, and drops them with the plugin", () => {
    plugin.turn("outline", false);
    for (const id of COMMANDS) expect(plugin.commands.has(id)).toBe(true);
    plugin.unload();
    for (const id of COMMANDS) expect(plugin.commands.has(id)).toBe(false);
  });
});
