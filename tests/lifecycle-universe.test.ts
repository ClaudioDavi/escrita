import { beforeEach, describe, expect, it } from "vitest";
import { TFile as FakeTFile } from "./support/obsidian";
import type { TFile } from "obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { UniverseModule } from "../src/universe";
import { ThreadsFeature } from "../src/universe/threads-feature";
import { THREADS_VIEW, UNIVERSE_VIEW } from "../src/universe/view";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let universe: UniverseModule;
let threads: ThreadsFeature;
let registry: FeatureRegistry;

const file = (path: string): TFile => Object.assign(new FakeTFile(), { path, basename: path.replace(/\.md$/, "").split("/").pop()!, extension: "md" }) as unknown as TFile;

beforeEach(() => {
  plugin = fakePlugin();
  plugin.settings.universeMode = "universe";
  plugin.books = {
    classify: () => ({ kind: "note", book: null, tracked: true }),
    frontmatter: () => ({}),
  };
  plugin.works = { list: () => [] };
  const p = plugin as unknown as Record<string, unknown>;
  universe = new UniverseModule(plugin.asPlugin);
  threads = new ThreadsFeature(plugin.asPlugin);
  p.universe = universe;
  p.threads = threads;
  const modules = new Map<FeatureId, UniverseModule | ThreadsFeature>([["universe", universe], ["threads", threads]]);
  registry = new FeatureRegistry(plugin.asPlugin, modules);
  plugin.features = registry;
  registry.init();
});

const names = () => [...plugin.commands.keys()].sort();
const UNIVERSE_COMMANDS = ["escrita:create-entry", "escrita:move-book-entries", "escrita:open-universe"];
const THREAD_COMMANDS = ["escrita:close-thread", "escrita:plant-thread", "escrita:show-threads"];

describe("universe and threads load and unload", () => {
  it("both on: commands, indexes, menus and the view slots are there", () => {
    registry.apply();
    expect(names()).toEqual([...UNIVERSE_COMMANDS, ...THREAD_COMMANDS].sort());
    expect(plugin.indexAdded.map((h) => h.spec.name)).toHaveLength(2);
    expect(plugin.app.workspace.liveListeners("editor-menu")).toBe(2);
    expect(plugin.app.workspace.liveListeners("file-menu")).toBe(1);
    expect([...plugin.views.keys()].sort()).toEqual([THREADS_VIEW, UNIVERSE_VIEW].sort());
    expect(plugin.extensions).toHaveLength(1);   // the threads marker slot, registered once
  });

  it("the universe mode off unloads the universe and leaves threads running", () => {
    registry.apply();
    plugin.settings.universeMode = "off";
    registry.apply();
    expect(registry.isOn("universe")).toBe(false);
    expect(registry.isOn("threads")).toBe(true);
    expect(names()).toEqual(THREAD_COMMANDS);
    expect(plugin.app.workspace.detached).toContain(UNIVERSE_VIEW);
    expect(plugin.app.workspace.detached).not.toContain(THREADS_VIEW);
    expect(plugin.indexAdded.filter((h) => !h.disposed)).toHaveLength(1);
    expect(plugin.app.workspace.liveListeners("editor-menu")).toBe(1);
    expect(plugin.app.workspace.liveListeners("file-menu")).toBe(0);
    // the view type stays registered for the plugin's life (G0b)
    expect(plugin.views.has(UNIVERSE_VIEW)).toBe(true);
  });

  it("threads off unloads the feature fully: commands, index, events, the editor extension, leaves", () => {
    registry.apply();
    plugin.settings.features = { ...plugin.settings.features, threads: false };
    registry.apply();
    expect(registry.isOn("threads")).toBe(false);
    expect(names()).toEqual(UNIVERSE_COMMANDS);
    expect(plugin.app.workspace.detached).toContain(THREADS_VIEW);
    expect(plugin.indexAdded.filter((h) => !h.disposed)).toHaveLength(1);
    expect(plugin.app.workspace.liveListeners("editor-menu")).toBe(1);
    const slot = plugin.extensions[0] as unknown[];
    expect(slot).toHaveLength(0);
    expect(threads.threads({ kind: "none", root: "", note: null })).toEqual([]);
    expect(threads.isReady()).toBe(true);   // nothing to wait for while off
  });

  it("everything off leaves nothing registered, and turning on again restores it", () => {
    registry.apply();
    plugin.settings.universeMode = "off";
    plugin.settings.features = { ...plugin.settings.features, threads: false };
    registry.apply();
    expect(plugin.commands.size).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(plugin.indexAdded.every((h) => h.disposed)).toBe(true);
    expect((plugin.extensions[0] as unknown[]).length).toBe(0);
    plugin.settings.universeMode = "perBook";
    plugin.settings.features = { ...plugin.settings.features, threads: true };
    registry.apply();
    expect(names()).toEqual([...UNIVERSE_COMMANDS, ...THREAD_COMMANDS].sort());
    expect(plugin.liveListeners()).toBe(4); // editor-menu, file-menu, the threads feature, and the names provider's metadata listener (3.1)
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);
  });

  it("the first-seen data stays when threads is off and still follows renames and deletes", () => {
    plugin.data.threadSeen = { "a.md": { "q": 1 } } as never;
    registry.apply();
    plugin.settings.features = { ...plugin.settings.features, threads: false };
    registry.apply();
    expect(plugin.data.threadSeen).toEqual({ "a.md": { q: 1 } });
    const followers = [...plugin.followers];
    expect(followers.length).toBeGreaterThan(0);
    for (const f of followers) f.moved?.("a.md", "b.md");
    expect(plugin.data.threadSeen).toEqual({ "b.md": { q: 1 } });
    for (const f of followers) f.deleted?.("b.md");
    expect(plugin.data.threadSeen).toEqual({});
  });

  it("the layout-ready prune of first-seen dates never runs after the feature is off", () => {
    plugin.data.threadSeen = { "gone.md": { q: 1 } } as never;
    registry.apply();
    plugin.settings.features = { ...plugin.settings.features, threads: false };
    registry.apply();
    plugin.app.workspace.fireLayoutReady();
    expect(plugin.data.threadSeen).toEqual({ "gone.md": { q: 1 } });
  });

  it("a thread is closed with the universe mode off (the helpers need no universe index)", async () => {
    registry.apply();
    plugin.settings.universeMode = "off";
    registry.apply();
    let applied = 0;
    plugin.notes = { text: () => ({ apply: async () => { applied++; return { ok: true }; } }) };
    const ok = await universe.closeThread(file("a.md"), { line: 0, from: 0, to: 0, text: "q", closed: false } as never);
    expect(ok).toBe(true);
    expect(applied).toBe(1);
    expect(universe.scopeOf("a.md").kind).toBe("none");
  });

  it("onChange listeners survive an unload and the universe API answers while unloaded", () => {
    registry.apply();
    let n = 0;
    universe.onChange(() => { n++; });
    plugin.settings.universeMode = "off";
    registry.apply();
    expect(n).toBeGreaterThan(0);
    expect(universe.entries({ kind: "universe", root: "U", note: "U.md" })).toEqual([]);
    expect(universe.entry("x.md")).toBeUndefined();
    expect(universe.universes()).toEqual([]);
  });
});

describe("addToUniverse and universe: false", () => {
  function withProps(props: Record<string, unknown>) {
    const f = file("Contos/Fora.md");
    let fm: Record<string, unknown> = { ...props };
    (plugin.app as unknown as Record<string, unknown>).fileManager = {
      processFrontMatter: async (_f: unknown, fn: (x: Record<string, unknown>) => void) => { fn(fm); },
    };
    (plugin.app as unknown as Record<string, unknown>).metadataCache = Object.assign(plugin.app.metadataCache, {
      fileToLinktext: () => "Universo",
      getFirstLinkpathDest: () => null,
    });
    plugin.app.vault.files.set("Universo.md", file("Universo.md"));
    plugin.app.vault.files.set(f.path, f);
    plugin.app.metadataCache.caches.set(f.path, { frontmatter: props });
    return { f, get: () => fm, reset: (v: Record<string, unknown>) => { fm = v; } };
  }
  const info = { note: "Universo.md", name: "Universo", root: "Universo", exists: true, isDefault: true };

  it("refuses a note whose universe property is false (boolean or text) and changes nothing", async () => {
    for (const v of [false, "false"]) {
      const w = withProps({ universe: v });
      expect(await universe.addToUniverse(w.f, info)).toBe(false);
      expect(w.get().universe).toBe(v);
    }
  });

  it("writes the link into a note with no value", async () => {
    const w = withProps({});
    expect(await universe.addToUniverse(w.f, info)).toBe(true);
    expect(w.get().universe).toBe("[[Universo]]");
  });

  it("keptOut on the module reads the note's property", () => {
    const w = withProps({ universe: "False" });
    expect(universe.keptOut(w.f)).toBe(true);
    plugin.app.metadataCache.caches.set(w.f.path, { frontmatter: {} });
    expect(universe.keptOut(w.f)).toBe(false);
  });
});
