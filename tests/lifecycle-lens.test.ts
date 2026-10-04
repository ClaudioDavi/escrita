import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { LensModule } from "../src/lens";
import { LENS_VIEW } from "../src/lens/view";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let lens: LensModule;
let reg: FeatureRegistry;

beforeEach(() => {
  vi.useFakeTimers();
  plugin = fakePlugin();
  plugin.settings.lensListsNote = "Lists.md";
  lens = new LensModule(plugin.asPlugin);
  reg = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, LensModule>([["lens", lens]]));
  plugin.features = reg;
  reg.init();
});
afterEach(() => { vi.useRealTimers(); });

function turn(on: boolean): void {
  plugin.settings.features = { ...plugin.settings.features, lens: on };
  reg.apply();
}

const COMMANDS = ["escrita:toggle-revision-lens", "escrita:next-revision-lens-match", "escrita:previous-revision-lens-match", "escrita:create-word-lists-note"];

function registrations() {
  return {
    commands: [...plugin.commands.keys()].sort(),
    listeners: plugin.liveListeners(),
    indexes: plugin.indexAdded.filter((h) => !h.disposed).length,
    followers: plugin.followers.size,
    timers: vi.getTimerCount(),
  };
}

describe("lens lifecycle", () => {
  it("loads: commands, the editor slot, the view factory, the lists index, a follower", () => {
    reg.apply();
    expect(reg.isOn("lens")).toBe(true);
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect(plugin.views.has(LENS_VIEW)).toBe(true);
    expect(plugin.extensions).toHaveLength(1);
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);
    expect(plugin.indexAdded.filter((h) => !h.disposed).map((h) => h.spec.name)).toEqual(["lens-lists"]);
    expect(plugin.app.workspace.liveListeners("editor-menu")).toBe(1);
    // the view factory builds the real panel while on
    const v = plugin.views.get(LENS_VIEW)!({}) as { getViewType(): string };
    expect(v.getViewType()).toBe(LENS_VIEW);
  });

  it("unloads: nothing left registered, data stays", () => {
    plugin.data.lensDismissed = { "a.md": [{ rule: "echo", key: "k" }] } as never;
    reg.apply();
    const base = { followers: registrations().followers };
    turn(false);
    const after = registrations();
    expect(after.commands).toEqual([]);
    expect(after.listeners).toBe(0);
    expect(after.indexes).toBe(0);
    expect(after.timers).toBe(0);
    expect(after.followers).toBe(base.followers - 1);
    expect((plugin.extensions[0] as unknown[]).length).toBe(0);
    expect(plugin.app.workspace.detached).toContain(LENS_VIEW);
    expect(plugin.data.lensDismissed["a.md"]).toHaveLength(1);
    // the slot now builds a bare placeholder, not the panel
    const v = plugin.views.get(LENS_VIEW)!({}) as { getDisplayText(): string };
    expect(v.getDisplayText()).toBe("Escrita");
  });

  it("drops its names listener on unload, and a names change after that wakes nothing (finding 18)", () => {
    const names = plugin.names;
    const orig = names.onChange.bind(names);
    const subs = { on: 0, off: 0 };
    names.onChange = (cb: () => void) => {
      subs.on++;
      const stop = orig(cb);
      return () => { subs.off++; stop(); };
    };
    reg.apply();
    expect(subs.on).toBe(1);
    expect(subs.off).toBe(0);
    turn(false);
    expect(subs.off).toBe(1);
    // a provider coming or going now calls nothing of the lens's
    const lensInvalidate = vi.spyOn(lens as unknown as { invalidate(): void }, "invalidate");
    const withdraw = names.provide({ tableFor: () => ({ terms: [], lang: null, signature: "" }), entryFor: () => null, version: () => 0, onChange: () => () => {} });
    withdraw();
    expect(lensInvalidate).not.toHaveBeenCalled();
  });

  it("clears a pending pass timer on unload", () => {
    reg.apply();
    const session = (lens as unknown as { session: { toggle(p: string): boolean; changed(p: string, t: () => string): number } }).session;
    session.toggle("a.md");
    session.changed("a.md", () => "text");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    turn(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("loads again with one of each registration", () => {
    reg.apply();
    const first = registrations();
    turn(false);
    turn(true);
    expect(registrations()).toEqual(first);
    expect(plugin.commands.size).toBe(COMMANDS.length);
    expect(plugin.views.size).toBe(1);
    expect(plugin.extensions).toHaveLength(1);
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);
  });

  it("unloaded lens answers its public methods without throwing", () => {
    turn(false);
    expect(lens.activeState().on).toBe(false);
    expect(lens.lists()).toEqual({ crutch: [], names: [], ignore: [] });
    expect(() => lens.settingsChanged()).not.toThrow();
    expect(lens.dismissedCount("a.md")).toBe(0);
  });
});

describe("lens data followers on a module that was never loaded", () => {
  beforeEach(() => { turn(false); });

  it("a rename moves the dismissals and the lists note path", () => {
    plugin.data.lensDismissed = { "a.md": [{ rule: "echo", key: "k" }] } as never;
    plugin.settings.lensListsNote = "Lists.md";
    expect(reg.isOn("lens")).toBe(false);
    for (const f of plugin.followers) f.moved?.("a.md", "b.md");
    expect(Object.keys(plugin.data.lensDismissed)).toEqual(["b.md"]);
    for (const f of plugin.followers) f.moved?.("Lists.md", "Notes/Lists.md");
    expect(plugin.settings.lensListsNote).toBe("Notes/Lists.md");
    expect(plugin.saves).toBe(1);
  });

  it("a delete drops the dismissals and leaves the lists setting alone", () => {
    plugin.data.lensDismissed = { "a.md": [{ rule: "echo", key: "k" }] } as never;
    for (const f of plugin.followers) f.deleted?.("a.md");
    expect(plugin.data.lensDismissed).toEqual({});
    for (const f of plugin.followers) f.deleted?.("Lists.md");
    expect(plugin.settings.lensListsNote).toBe("Lists.md");
  });

  it("turning it on after renames keeps the moved data", () => {
    plugin.data.lensDismissed = { "a.md": [{ rule: "echo", key: "k" }] } as never;
    for (const f of plugin.followers) f.moved?.("a.md", "b.md");
    turn(true);
    expect(lens.dismissedCount("b.md")).toBe(1);
  });
});
