import { describe, expect, it } from "vitest";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import type { FeatureModule } from "../src/core/module-context";
import { ExplorerModule } from "../src/explorer";
import { fakePlugin } from "./support/fake-plugin";

function setup() {
  const plugin = fakePlugin();
  const listeners = new Set<(paths: string[]) => void>();
  plugin.measure = { onChange: (cb: (p: string[]) => void) => { listeners.add(cb); return () => listeners.delete(cb); } };
  plugin.books = { allBooks: () => [], chapters: () => [], classify: () => ({ tracked: false }) };
  (plugin.app.vault as unknown as { getMarkdownFiles(): unknown[] }).getMarkdownFiles = () => [];
  const mod = new ExplorerModule(plugin.asPlugin);
  const reg = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, FeatureModule>([["explorerCounts", mod]]));
  plugin.features = reg;
  reg.init();
  return { plugin, reg, listeners };
}

describe("explorer lifecycle", () => {
  it("loads, unloads and leaves nothing registered", () => {
    const { plugin, reg, listeners } = setup();
    plugin.settings.explorerCounts = true;
    reg.apply();
    plugin.app.workspace.fireLayoutReady();
    expect(reg.isOn("explorerCounts")).toBe(true);
    expect(plugin.drawn.has("count")).toBe(true);
    expect(listeners.size).toBe(1);
    expect(plugin.liveListeners()).toBe(5);

    plugin.settings.explorerCounts = false;
    reg.apply();
    expect(reg.isOn("explorerCounts")).toBe(false);
    expect(plugin.drawn.has("count")).toBe(false);
    expect(listeners.size).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(plugin.commands.size).toBe(0);
    expect(plugin.extensions.length).toBe(0);
    expect(plugin.views.size).toBe(0);
    expect(plugin.indexAdded.length).toBe(0);
  });

  it("loads again, and a load before layout ready registers no events until it", () => {
    const { plugin, reg } = setup();
    plugin.settings.explorerCounts = true;
    reg.apply();
    expect(plugin.liveListeners()).toBe(0);
    plugin.settings.explorerCounts = false;
    reg.apply();
    plugin.app.workspace.fireLayoutReady();   // the queued callback must not run after unload
    expect(plugin.liveListeners()).toBe(0);
    plugin.settings.explorerCounts = true;
    reg.apply();
    expect(plugin.liveListeners()).toBe(5);
    expect(plugin.drawn.has("count")).toBe(true);
  });

  it("stays off at startup when the switch is off", () => {
    const { plugin, reg } = setup();
    plugin.settings.explorerCounts = false;
    reg.apply();
    plugin.app.workspace.fireLayoutReady();
    expect(plugin.drawn.size).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
  });
});
