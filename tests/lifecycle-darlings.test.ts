import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile } from "./support/obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { DarlingsModule, VIEW_DARLINGS } from "../src/darlings";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let reg: FeatureRegistry;
let mod: DarlingsModule;

const setOn = (on: boolean) => {
  plugin.settings.features = { ...plugin.settings.features, darlings: on };
  reg.apply();
};
const noteFile = (path: string): TFile => Object.assign(new TFile(), { path, basename: path.replace(/\.md$/, ""), extension: "md" });

beforeEach(() => {
  vi.useFakeTimers();
  plugin = fakePlugin();
  plugin.books = { classify: () => ({ book: null }) };
  mod = new DarlingsModule(plugin.asPlugin);
  reg = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, DarlingsModule>([["darlings", mod]]));
  plugin.features = reg;
  reg.init();
});
afterEach(() => { vi.useRealTimers(); });

const ids = () => [...plugin.commands.keys()].sort();

describe("darlings lifecycle", () => {
  it("declares its view slot and registers it once at init, even while off", () => {
    expect(mod.id).toBe("darlings");
    expect([...plugin.views.keys()]).toEqual([VIEW_DARLINGS]);
  });

  it("onload registers both commands and the editor menu, file and vault listeners", () => {
    reg.apply();
    expect(reg.isOn("darlings")).toBe(true);
    expect(ids()).toEqual(["escrita:move-selection-to-darlings", "escrita:open-darlings"]);
    expect(plugin.app.workspace.liveListeners("editor-menu")).toBe(1);
    expect(plugin.app.workspace.liveListeners("file-open")).toBe(1);
    expect(plugin.app.vault.liveListeners()).toBe(4);
    expect(plugin.liveListeners()).toBe(6);
    // the view slot builds the real view while loaded
    const view = plugin.views.get(VIEW_DARLINGS)!({} as never) as { getViewType(): string };
    expect(view.getViewType()).toBe(VIEW_DARLINGS);
  });

  it("unload leaves no command, listener, timer or view binding; the slot stays registered", () => {
    reg.apply();
    plugin.app.workspace.trigger("file-open", noteFile("a.md"));
    plugin.app.vault.trigger("modify", { path: "Darlings.md" });
    expect(vi.getTimerCount()).toBe(1);
    setOn(false);
    expect(reg.isOn("darlings")).toBe(false);
    expect(ids()).toEqual([]);
    expect(plugin.liveListeners()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(plugin.app.workspace.detached).toContain(VIEW_DARLINGS);
    expect([...plugin.views.keys()]).toEqual([VIEW_DARLINGS]);
    // a restored leaf of the off feature gets a bare placeholder, not the panel
    const ph = plugin.views.get(VIEW_DARLINGS)!({} as never) as { getViewType(): string; getDisplayText(): string };
    expect(ph.getViewType()).toBe(VIEW_DARLINGS);
    expect(ph.getDisplayText()).toBe("Escrita");
  });

  it("a layout-ready callback queued while loaded never runs after unload", () => {
    const follow = vi.spyOn(plugin.app.workspace, "getActiveFile");
    reg.apply();
    setOn(false);
    follow.mockClear();
    plugin.app.workspace.fireLayoutReady();
    expect(follow).not.toHaveBeenCalled();
  });

  it("loading again leaves one of each registration", () => {
    reg.apply();
    setOn(false);
    setOn(true);
    expect(ids()).toEqual(["escrita:move-selection-to-darlings", "escrita:open-darlings"]);
    expect(plugin.liveListeners()).toBe(6);
    expect([...plugin.views.keys()]).toEqual([VIEW_DARLINGS]);
    expect(plugin.app.workspace.liveListeners("editor-menu")).toBe(1);
  });

  it("a darlings file that is open is followed again after a reload (state is reset on unload)", () => {
    reg.apply();
    plugin.app.workspace.trigger("file-open", noteFile("a.md"));
    expect(mod.currentNotePath()).toBe("Darlings.md");
    plugin.settings.globalDarlingsNote = "Cuts.md";
    setOn(false);
    setOn(true);
    expect(mod.currentNotePath()).toBe("Cuts.md");
  });

  it("keeps its data: settings and plugin data are untouched by a switch", () => {
    const before = JSON.stringify([plugin.settings.darlingsNote, plugin.settings.globalDarlingsNote, plugin.data]);
    reg.apply();
    setOn(false);
    setOn(true);
    expect(JSON.stringify([plugin.settings.darlingsNote, plugin.settings.globalDarlingsNote, plugin.data])).toBe(before);
  });

  it("has no data followers and no index specs, so a module never loaded adds none", () => {
    expect(mod.dataFollowers).toBeUndefined();
    expect(plugin.followers.size).toBe(0);
    expect(plugin.indexAdded).toHaveLength(0);
    reg.apply();
    setOn(false);
    expect(plugin.followers.size).toBe(0);
    expect(plugin.indexAdded).toHaveLength(0);
  });

  it("settingsChanged reaches it only while loaded", () => {
    const spy = vi.spyOn(mod, "settingsChanged");
    reg.settingsChanged();
    expect(spy).not.toHaveBeenCalled();
    reg.apply();
    reg.settingsChanged();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("unloadAll is idempotent and leaves nothing", () => {
    reg.apply();
    reg.unloadAll();
    reg.unloadAll();
    expect(ids()).toEqual([]);
    expect(plugin.liveListeners()).toBe(0);
  });
});
