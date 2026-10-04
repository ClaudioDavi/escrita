import { beforeEach, describe, expect, it } from "vitest";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import type { FeatureModule } from "../src/core/module-context";
import { PublishModule } from "../src/publish";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let module: PublishModule;
let registry: FeatureRegistry;

beforeEach(() => {
  plugin = fakePlugin();
  module = new PublishModule(plugin.asPlugin);
  const map = new Map<FeatureId, FeatureModule>([["publish", module]]);
  registry = new FeatureRegistry(plugin.asPlugin, map);
  plugin.features = registry;
  registry.init();
});

const turn = (on: boolean): void => {
  plugin.settings.features = { ...plugin.settings.features, publish: on };
  registry.apply();
};

describe("publish lifecycle", () => {
  it("loads with its commands and file menu", () => {
    registry.apply();
    expect(registry.isOn("publish")).toBe(true);
    expect([...plugin.commands.keys()].sort()).toEqual(["escrita:publish-note", "escrita:unpublish-note"]);
    expect(plugin.app.workspace.liveListeners("file-menu")).toBe(1);
  });

  it("leaves no command or listener behind when unloaded", () => {
    registry.apply();
    turn(false);
    expect(registry.isOn("publish")).toBe(false);
    expect(plugin.commands.size).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(plugin.followers.size).toBe(1); // only the data follower stays
    expect(plugin.indexAdded).toHaveLength(0);
    expect(plugin.statusBars).toHaveLength(0);
    expect(plugin.extensions.every((e) => !Array.isArray(e) || e.length === 0)).toBe(true);
  });

  it("loads again with exactly one of each registration", () => {
    registry.apply();
    turn(false);
    turn(true);
    expect([...plugin.commands.keys()]).toHaveLength(2);
    expect(plugin.app.workspace.liveListeners("file-menu")).toBe(1);
    expect(plugin.followers.size).toBe(1);
  });

  it("starts with the feature off: nothing registered, followers still on", () => {
    plugin.settings.features = { publish: false };
    registry.apply();
    expect(plugin.commands.size).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(plugin.followers.size).toBe(1);
  });

  it("keeps publish records following renames and deletes while never loaded", () => {
    plugin.settings.features = { publish: false };
    registry.apply();
    plugin.data.publish["a.md"] = { previousStatus: "draft" };
    plugin.data.publish["b.md"] = { previousStatus: "idea" };
    const [f] = [...plugin.followers];
    f.moved?.("a.md", "c.md");
    expect(plugin.data.publish["c.md"]).toEqual({ previousStatus: "draft" });
    expect(plugin.data.publish["a.md"]).toBeUndefined();
    f.deleted?.("b.md");
    expect(plugin.data.publish["b.md"]).toBeUndefined();
  });

  it("keeps its data when switched off and on", () => {
    registry.apply();
    plugin.data.publish["a.md"] = { previousStatus: "draft" };
    turn(false);
    turn(true);
    expect(plugin.data.publish["a.md"]).toEqual({ previousStatus: "draft" });
  });
});
