import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noticeLog } from "./support/obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import type { FeatureModule } from "../src/core/module-context";
import { GoalsModule } from "../src/goals";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let goals: GoalsModule;
let registry: FeatureRegistry;
/** intervals that were set and not cleared, by id */
let live: Set<number>;

beforeEach(() => {
  noticeLog.length = 0;
  live = new Set();
  const set = window.setInterval.bind(window);
  const clear = window.clearInterval.bind(window);
  vi.spyOn(window, "setInterval").mockImplementation(((cb: () => void, ms?: number) => {
    const id = set(cb, ms) as unknown as number;
    live.add(id);
    return id;
  }) as typeof window.setInterval);
  vi.spyOn(window, "clearInterval").mockImplementation(((id?: number) => {
    if (id !== undefined) live.delete(id);
    clear(id);
  }) as typeof window.clearInterval);

  plugin = fakePlugin();
  (plugin as unknown as { books: unknown }).books = { classify: () => ({ tracked: false, kind: "note", book: null, markdown: false }) };
  goals = new GoalsModule(plugin.asPlugin);
  const map = new Map<FeatureId, FeatureModule>([["goals", goals]]);
  registry = new FeatureRegistry(plugin.asPlugin, map);
  plugin.features = registry;
  registry.init();
});

afterEach(() => {
  registry.unloadAll();
  vi.restoreAllMocks();
});

function turn(on: boolean): void {
  plugin.settings.features = { ...plugin.settings.features, goals: on };
  registry.apply();
}

const COMMANDS = ["escrita:open-progress", "escrita:start-sprint", "escrita:stop-sprint"];

describe("goals lifecycle", () => {
  it("loads with its commands, ribbon icon, status bar, listeners, interval and editor extension", () => {
    registry.apply();
    expect(registry.isOn("goals")).toBe(true);
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect(plugin.ribbon.size).toBe(1);
    expect(plugin.statusBars).toHaveLength(1);
    expect(plugin.statusBars[0].isConnected).toBe(true);
    expect(plugin.liveListeners()).toBe(3);
    expect(live.size).toBe(1);
    expect(plugin.extensions).toHaveLength(1);
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);
  });

  it("leaves nothing registered after unload, and data stays", () => {
    plugin.data.history = { "2026-01-01": { added: 5, books: { "Old": { added: 5 } } } } as never;
    registry.apply();
    turn(false);
    expect(registry.isOn("goals")).toBe(false);
    expect(plugin.commands.size).toBe(0);
    expect(plugin.statusBars[0].isConnected).toBe(false);
    expect(plugin.liveListeners()).toBe(0);
    expect(live.size).toBe(0);
    expect((plugin.extensions[0] as unknown[]).length).toBe(0);
    // only the data follower remains
    expect(plugin.followers.size).toBe(1);
    expect(Object.keys(plugin.data.history["2026-01-01"].books ?? {})).toEqual(["Old"]);
    // the ribbon icon stays until restart (G0f); its click says the feature is off
    plugin.clickRibbon([...plugin.ribbon.keys()][0]);
    expect(noticeLog).toHaveLength(1);
  });

  it("loads again with one of each registration", () => {
    registry.apply();
    turn(false);
    turn(true);
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect(plugin.liveListeners()).toBe(3);
    expect(live.size).toBe(1);
    expect(plugin.extensions).toHaveLength(1);
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);
    expect(plugin.ribbonAdds).toHaveLength(1);
    expect(plugin.followers.size).toBe(2);   // data follower + the loaded one
    expect(plugin.statusBars.filter((e) => e.isConnected)).toHaveLength(1);
    expect(plugin.statusBars).toHaveLength(2);
  });

  it("keeps a running sprint's count across a switch-off: the timer stops, the sprint stays", () => {
    registry.apply();
    goals.startSprint(10, 100);
    expect(live.size).toBe(2);   // the minute refresh and the sprint timer
    const sprint = goals.sprint;
    sprint!.add(40);
    turn(false);
    expect(live.size).toBe(0);
    expect(goals.sprint).toBe(sprint);
    expect(goals.sprint!.words).toBe(40);
    turn(true);
    expect(goals.sprint!.words).toBe(40);
    expect(live.size).toBe(2);
  });

  it("closes the progress modal if open", () => {
    registry.apply();
    const close = vi.fn();
    (goals as unknown as { modal: unknown }).modal = { close };
    turn(false);
    expect(close).toHaveBeenCalledTimes(1);
    expect((goals as unknown as { modal: unknown }).modal).toBeNull();
  });

  it("forgets baselines while off, so words typed meanwhile are not counted", () => {
    registry.apply();
    (goals as unknown as { baseline: Map<string, number> }).baseline.set("a.md", 10);
    turn(false);
    expect((goals as unknown as { baseline: Map<string, number> }).baseline.size).toBe(0);
  });

  it("follows a renamed book in history even when it was never loaded", () => {
    plugin.settings.features = { goals: false };
    plugin.data.history = { "2026-01-01": { added: 5, books: { "Old": { added: 5 } } } } as never;
    registry.apply();
    expect(registry.isOn("goals")).toBe(false);
    expect(plugin.commands.size).toBe(0);
    for (const f of plugin.followers) f.moved?.("Old", "New");
    expect(Object.keys(plugin.data.history["2026-01-01"].books ?? {})).toEqual(["New"]);
  });

  it("builds the status bar element detached without error (mobile)", () => {
    const orig = plugin.addStatusBarItem.bind(plugin);
    plugin.addStatusBarItem = () => { const el = orig(); el.remove(); return el; };
    expect(() => registry.apply()).not.toThrow();
    expect(() => turn(false)).not.toThrow();
  });
});
