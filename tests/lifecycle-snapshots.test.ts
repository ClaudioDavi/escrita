// Task 2.7: snapshots and the stage snapshot on the feature registry. Load, unload,
// nothing left registered, load again with one of each; the rename follower works on a
// module that was never loaded (Q8).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile, TFolder } from "./support/obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import type { FeatureModule } from "../src/core/module-context";
import { SnapshotsModule, SNAPSHOTS_VIEW, COMPARE_VIEW } from "../src/snapshots";
import { StageSnapshotFeature } from "../src/snapshots/stage-feature";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

const COMMANDS = [
  "escrita:take-snapshot", "escrita:open-snapshots", "escrita:compare-last-snapshot", "escrita:browse-deleted-snapshots",
];

/** A works index that counts its subscribers. */
function fakeWorks() {
  const changes = new Set<unknown>();
  const ready = new Set<unknown>();
  return {
    changes, ready,
    get: () => undefined,
    list: () => [] as [string, never][],
    isReady: () => false,
    onChange: (cb: unknown) => { changes.add(cb); return () => { changes.delete(cb); }; },
    onReady: (cb: unknown) => { ready.add(cb); return () => { ready.delete(cb); }; },
  };
}

function fakeStore(mod: SnapshotsModule) {
  const calls: string[] = [];
  const store = {
    moveNote: async (a: string, b: string) => { calls.push(`note ${a} > ${b}`); },
    moveFolder: async (a: string, b: string) => { calls.push(`folder ${a} > ${b}`); },
    onChange: () => () => {},
  };
  mod.store = store as unknown as typeof mod.store;
  return calls;
}

function file(path: string): TFile {
  const f = new TFile();
  f.path = path;
  f.name = path.split("/").pop()!;
  return f;
}
function folder(path: string): TFolder {
  const f = new TFolder();
  f.path = path;
  f.name = path.split("/").pop()!;
  return f;
}

let plugin: FakePlugin;
let works: ReturnType<typeof fakeWorks>;
let snap: SnapshotsModule;
let registry: FeatureRegistry;

function setup(): void {
  plugin = fakePlugin();
  works = fakeWorks();
  plugin.works = works;
  plugin.measure = { onChange: () => () => {} };
  snap = new SnapshotsModule(plugin.asPlugin);
  (plugin as unknown as { snapshots: SnapshotsModule }).snapshots = snap;
  const stage = new StageSnapshotFeature(plugin.asPlugin);
  const map = new Map<FeatureId, FeatureModule>([["snapshots", snap], ["stageSnapshot", stage]]);
  registry = new FeatureRegistry(plugin.asPlugin, map);
  plugin.features = registry;
  registry.init();
}

beforeEach(() => {
  vi.useFakeTimers();
  setup();
});
afterEach(() => { vi.useRealTimers(); });

describe("snapshots lifecycle", () => {
  it("loads: four commands, two views bound, events and the works subscriptions", () => {
    registry.apply();
    expect(registry.isOn("snapshots")).toBe(true);
    expect(registry.isOn("stageSnapshot")).toBe(true);
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect([...plugin.views.keys()].sort()).toEqual([COMPARE_VIEW, SNAPSHOTS_VIEW].sort());
    expect(plugin.app.workspace.liveListeners("file-menu")).toBe(1);
    expect(plugin.app.workspace.liveListeners("editor-change")).toBe(1);
    expect(plugin.app.workspace.liveListeners("file-open")).toBe(1);
    expect(plugin.app.vault.liveListeners("modify")).toBe(1);
    // the file rename follower is always on; the panel's follower only while loaded
    expect(plugin.followers.size).toBe(2);
    expect(works.changes.size).toBe(1);
    expect(works.ready.size).toBe(1);
  });

  it("unloads: no command, listener, follower (but the data one), subscription or timer; views stay registered", () => {
    registry.apply();
    // a pending refresh timer, from the panel following a note
    plugin.app.workspace.trigger("file-open", file("a.md"));
    plugin.app.vault.trigger("modify", { path: "a.md" });
    expect(vi.getTimerCount()).toBe(1);

    plugin.turn("snapshots", false);
    expect(registry.isOn("snapshots")).toBe(false);
    expect(registry.isOn("stageSnapshot")).toBe(false);   // requires snapshots
    expect(plugin.commands.size).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(plugin.followers.size).toBe(1);
    expect(works.changes.size).toBe(0);
    expect(works.ready.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(plugin.app.workspace.detached).toEqual(expect.arrayContaining([SNAPSHOTS_VIEW, COMPARE_VIEW]));
    expect(plugin.views.size).toBe(2);
    expect(snap.currentNotePath()).toBeNull();
  });

  it("loads again with one of each", () => {
    registry.apply();
    const listeners = plugin.liveListeners();
    plugin.turn("snapshots", false);
    plugin.turn("snapshots", true);
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect(plugin.liveListeners()).toBe(listeners);
    expect(plugin.followers.size).toBe(2);
    expect(works.changes.size).toBe(1);
    expect(plugin.views.size).toBe(2);
    expect(registry.isOn("stageSnapshot")).toBe(true);
  });

  it("the stage snapshot alone can be switched off and on", () => {
    registry.apply();
    plugin.turn("stageSnapshot", false);
    expect(registry.isOn("snapshots")).toBe(true);
    expect(works.changes.size).toBe(0);
    expect(plugin.commands.size).toBe(4);
    plugin.turn("stageSnapshot", true);
    expect(works.changes.size).toBe(1);
  });

  it("unloadAll leaves nothing and keeps no data behind", () => {
    registry.apply();
    registry.unloadAll();
    expect(plugin.commands.size).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(works.changes.size).toBe(0);
    expect(plugin.data).toEqual(expect.objectContaining({ history: {} }));
  });

  it("the panel follows the active note and a rename of it", () => {
    registry.apply();
    plugin.app.workspace.trigger("file-open", file("Contos/a.md"));
    expect(snap.currentNotePath()).toBe("Contos/a.md");
    for (const f of plugin.followers) f.moved?.("Contos/a.md", "Contos/b.md");
    expect(snap.currentNotePath()).toBe("Contos/b.md");
    for (const f of plugin.followers) f.moved?.("Contos", "Textos");
    expect(snap.currentNotePath()).toBe("Textos/b.md");
  });
});

describe("the rename follower on a module that was never loaded", () => {
  // init() only: snapshots has not loaded, as when the writer switched it off at startup
  it("registers at init and moves a note's snapshots", () => {
    plugin.settings.features = { snapshots: false };
    expect(plugin.followers.size).toBe(1);
    expect(registry.isOn("snapshots")).toBe(false);
    const calls = fakeStore(snap);
    plugin.app.vault.files.set("Contos/novo.md", file("Contos/novo.md"));
    for (const f of plugin.followers) f.moved?.("Contos/velho.md", "Contos/novo.md");
    expect(calls).toEqual(["note Contos/velho.md > Contos/novo.md"]);
  });

  it("moves the snapshots of a renamed folder", () => {
    const calls = fakeStore(snap);
    plugin.app.vault.files.set("Textos", folder("Textos"));
    for (const f of plugin.followers) f.moved?.("Ensaios", "Textos");
    expect(calls).toEqual(["folder Ensaios > Textos"]);
  });

  it("ignores a non-Markdown file and a path that is gone", () => {
    const calls = fakeStore(snap);
    plugin.app.vault.files.set("a.png", file("a.png"));
    for (const f of plugin.followers) {
      f.moved?.("b.png", "a.png");
      f.moved?.("x.md", "y.md");
    }
    expect(calls).toEqual([]);
  });

  it("ignores renames inside the snapshots folder", () => {
    const calls = fakeStore(snap);
    const root = snap.root();
    plugin.app.vault.files.set(`${root}/n/b.txt`, file(`${root}/n/b.txt`));
    for (const f of plugin.followers) f.moved?.(`${root}/n/a.txt`, `${root}/n/b.txt`);
    expect(calls).toEqual([]);
  });

  it("follows a rename of the snapshots root, through a re-entry safe saveSettings", () => {
    const calls = fakeStore(snap);
    plugin.settings.snapshotsFolder = "Escrita/Snapshots";
    plugin.settings.features = { snapshots: false };
    let applies = 0;
    plugin.saveSettingsHook = () => { applies++; registry.apply(); registry.apply(); };
    plugin.app.vault.files.set("Escrita/Versões", folder("Escrita/Versões"));
    for (const f of plugin.followers) f.moved?.("Escrita/Snapshots", "Escrita/Versões");
    expect(plugin.settings.snapshotsFolder).toBe("Escrita/Versões");
    expect(plugin.saves).toBe(1);
    expect(applies).toBe(1);
    expect(calls).toEqual([]);
    expect(registry.isOn("snapshots")).toBe(false);
  });

  it("follows a rename of a folder that holds the snapshots root", () => {
    plugin.settings.snapshotsFolder = "Escrita/Snapshots";
    plugin.app.vault.files.set("Oficina", folder("Oficina"));
    for (const f of plugin.followers) f.moved?.("Escrita", "Oficina");
    expect(plugin.settings.snapshotsFolder).toBe("Oficina/Snapshots");
    expect(plugin.saves).toBe(1);
  });
});
