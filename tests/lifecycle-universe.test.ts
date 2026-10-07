import { beforeEach, describe, expect, it } from "vitest";
import { TFile as FakeTFile } from "./support/obsidian";
import type { TFile } from "obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { UniverseModule } from "../src/universe";
import { ThreadsFeature } from "../src/universe/threads-feature";
import { THREADS_VIEW, UNIVERSE_VIEW } from "../src/universe/view";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";
import { EMPTY_TABLE } from "../src/core/names";
import { scopeFor, type ScopeLookup } from "../src/core/scope";
import { vi } from "vitest";

let plugin: FakePlugin;
let universe: UniverseModule;
let threads: ThreadsFeature;
let registry: FeatureRegistry;

const file = (path: string): TFile => Object.assign(new FakeTFile(), { path, basename: path.replace(/\.md$/, "").split("/").pop()!, extension: "md" }) as unknown as TFile;

beforeEach(() => {
  plugin = fakePlugin();
  plugin.settings.universeMode = "universe";
  // a note outside any book; its scope by the real rule, read through the fake vault and cache
  const lookup = (): ScopeLookup => ({
    book: () => null,
    universe: (q) => {
      const f = plugin.app.vault.getAbstractFileByPath(q) as { path: string } | null;
      return (plugin.app.metadataCache.getFileCache(f) as { frontmatter?: Record<string, unknown> } | null)?.frontmatter?.[plugin.settings.universeProperty];
    },
    resolve: (l, from) => (plugin.app.metadataCache as unknown as { getFirstLinkpathDest?: (l: string, f: string) => { path: string } | null })
      .getFirstLinkpathDest?.(l, from)?.path ?? null,
  });
  plugin.books = {
    classify: (x: { path: string } | string) => {
      const path = typeof x === "string" ? x : x.path;
      return { path, kind: "note", book: null, tracked: true, snapshot: false, submission: false, export: false, scope: scopeFor({ path }, plugin.settings, lookup()) };
    },
    scopeLookup: lookup,
    frontmatter: () => ({}),
  };
  plugin.works = { list: () => [], get: () => undefined, onChange: () => () => {} };
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
const THREADS_SLOT = 2;   // the universe declares two editor slots before it
const UNIVERSE_COMMANDS = ["escrita:create-entry", "escrita:move-book-entries", "escrita:open-universe"];
const THREAD_COMMANDS = ["escrita:close-thread", "escrita:plant-thread", "escrita:show-threads"];

describe("universe and threads load and unload", () => {
  it("both on: commands, indexes, menus and the view slots are there", () => {
    registry.apply();
    expect(names()).toEqual([...UNIVERSE_COMMANDS, ...THREAD_COMMANDS].sort());
    expect(plugin.indexAdded.map((h) => h.spec.name).sort()).toEqual(["universe-entries", "universe-names", "universe-threads"]);   // the names index is on demand: added, never built
    expect(plugin.app.workspace.liveListeners("editor-menu")).toBe(2);
    expect(plugin.app.workspace.liveListeners("file-menu")).toBe(1);
    expect([...plugin.views.keys()].sort()).toEqual([THREADS_VIEW, UNIVERSE_VIEW].sort());
    expect(plugin.extensions).toHaveLength(3);   // the universe's two (name marks, appears in) and the threads marker slot, registered once
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
    expect(plugin.indexAdded.find((h) => h.spec.name === "universe-names")?.disposed).toBe(true);
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
    expect(plugin.indexAdded.filter((h) => !h.disposed).map((h) => h.spec.name).sort()).toEqual(["universe-entries", "universe-names"]);
    expect(plugin.app.workspace.liveListeners("editor-menu")).toBe(1);
    const slot = plugin.extensions[THREADS_SLOT] as unknown[];
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
    expect(plugin.extensions.every((x) => (x as unknown[]).length === 0)).toBe(true);
    plugin.settings.universeMode = "perBook";
    plugin.settings.features = { ...plugin.settings.features, threads: true };
    registry.apply();
    expect(names()).toEqual([...UNIVERSE_COMMANDS, ...THREAD_COMMANDS].sort());
    expect(plugin.liveListeners()).toBe(7); // editor-menu, file-menu, the threads feature, the universe's metadata listener and its create, delete and rename listeners (5.1)
    expect((plugin.extensions[THREADS_SLOT] as unknown[]).length).toBe(1);
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);   // name marks
    expect((plugin.extensions[1] as unknown[]).length).toBe(1);   // appears in
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

const U = { kind: "universe", root: "Universo", note: "Universo.md" } as const;

describe("the names provider, the mentions index and the editor UI go with the universe (5.1)", () => {
  const entriesIdx = () => plugin.indexAdded.find((h) => h.spec.name !== "universe-mentions" && !h.disposed && h.spec.name.includes("entries")) ?? plugin.indexAdded[0]!;
  const entry = { path: "Universo/Mariana.md", name: "Mariana", aliases: [], kind: "character", caseSensitive: false, ignore: [], firstName: true };

  it("unload withdraws the provider and bumps the version, so a pass keyed on it re-runs", () => {
    registry.apply();
    entriesIdx().values.set(entry.path, entry);
    vi.spyOn(universe, "scopeOf").mockReturnValue(U);
    expect(plugin.names.tableFor("Universo/A.md").terms.length).toBeGreaterThan(0);
    const v = plugin.names.version();
    let told = 0;
    plugin.names.onChange(() => told++);
    plugin.settings.universeMode = "off";
    registry.apply();
    expect(plugin.names.tableFor("Universo/A.md")).toBe(EMPTY_TABLE);
    expect(plugin.names.version()).toBeGreaterThan(v);
    expect(told).toBeGreaterThan(0);
    expect(universe.names()).toBeNull();
    expect(universe.appearsInSource()).toBeNull();
  });

  it("the mentions index waits for the entries index, then is added; unload disposes it", () => {
    registry.apply();
    expect(plugin.indexAdded.map((h) => h.spec.name)).not.toContain("universe-mentions");
    entriesIdx().becomeReady();
    const mentions = plugin.indexAdded.find((h) => h.spec.name === "universe-mentions");
    expect(mentions).toBeDefined();
    plugin.settings.universeMode = "off";
    registry.apply();
    expect(mentions!.disposed).toBe(true);
  });

  it("the names index is added, built only when the names rule asks, and told to the port once (U 2.5)", () => {
    registry.apply();
    entriesIdx().values.set(entry.path, entry);
    vi.spyOn(universe, "scopeOf").mockReturnValue(U);
    (plugin as unknown as Record<string, unknown>).works = {
      list: () => [], onChange: () => () => {},
      get: (path: string) => (path.startsWith("Contos/") ? { role: "note", stage: "draft", title: path } : undefined),
    };
    const idx = plugin.indexAdded.find((h) => h.spec.name === "universe-names")!;
    expect(idx.demands).toBe(0);
    expect(plugin.names.nameCountsReady()).toBe(false);
    expect(plugin.names.workCount("Zefa", "Contos/a.md")).toBe(0);
    plugin.names.wantNameCounts();
    plugin.names.wantNameCounts();
    expect(idx.demands).toBe(1);
    let told = 0;
    let namesChanged = 0;
    plugin.names.onCountsChange(() => told++);
    plugin.names.onChange(() => namesChanged++);
    idx.becomeReady();
    expect(told).toBe(1);
    expect(namesChanged).toBe(0);   // the counts have their own signal: name marks and the rest don't refresh
    expect(plugin.names.nameCountsReady()).toBe(true);
    // known: an entry, a name title; not a new name
    expect(plugin.names.isKnownName("Mariana", "Contos/a.md")).toBe(true);
    expect(plugin.names.isKnownName("Dr", "Contos/a.md")).toBe(true);
    expect(plugin.names.isKnownName("Zefa", "Contos/a.md")).toBe(false);
    // the count is in works of the scope: two contos, an entry note never counts
    idx.values.set("Contos/a.md", ["zefa"]);
    idx.values.set("Contos/b.md", ["zefa", "teo"]);
    idx.values.set("Universo/Mariana.md", ["zefa"]);
    expect(plugin.names.workCount("Zefa", "Contos/a.md")).toBe(2);
    expect(plugin.names.workCount("Teo", "Contos/a.md")).toBe(1);
    expect(plugin.names.workCount("Nobody", "Contos/a.md")).toBe(0);
    plugin.settings.universeMode = "off";
    registry.apply();
    expect(idx.disposed).toBe(true);
    expect(plugin.names.nameCountsReady()).toBe(false);
    expect(plugin.names.workCount("Zefa", "Contos/a.md")).toBe(0);
  });

  it("the appears-in source answers counting until both indexes are ready, and null for a note that is no entry", () => {
    registry.apply();
    entriesIdx().values.set(entry.path, entry);
    vi.spyOn(universe, "scopeOf").mockReturnValue(U);
    const src = universe.appearsInSource()!;
    expect(src.appearsIn("Contos/a.md")).toBeNull();
    expect(src.appearsIn(entry.path)).toBe("counting");
    entriesIdx().becomeReady();
    const mentions = plugin.indexAdded.find((h) => h.spec.name === "universe-mentions")!;
    mentions.becomeReady();
    expect(src.appearsIn(entry.path)).not.toBe("counting");
  });

  it("unlinkedFor: counting until both indexes are ready, then the unlinked rows; null once unloaded (U 2.5)", async () => {
    registry.apply();
    entriesIdx().values.set(entry.path, entry);
    vi.spyOn(universe, "scopeOf").mockReturnValue(U);
    let body = "Mariana chegou. Depois [[Mariana]] saiu.";
    (plugin as unknown as Record<string, unknown>).notes = { text: () => ({ read: async () => body }) };
    const note = file("Contos/a.md");
    Object.assign(plugin.app.metadataCache, { getFirstLinkpathDest: (l: string) => (l === "Mariana" ? { path: entry.path } : null) });
    expect(await universe.unlinkedFor(note)).toBe("counting");
    entriesIdx().becomeReady();
    plugin.indexAdded.find((h) => h.spec.name === "universe-mentions")!.becomeReady();
    universe.names()?.refresh();
    // the note links the entry anywhere: nothing is listed
    expect(await universe.unlinkedFor(note)).toEqual([]);
    body = "Mariana chegou.";
    const rows = await universe.unlinkedFor(note);
    expect(rows).toMatchObject([{ entry: entry.path, name: "Mariana", text: "Mariana", line: 0 }]);
    plugin.settings.universeMode = "off";
    registry.apply();
    expect(await universe.unlinkedFor(note)).toBeNull();
  });

  it("registers the two editor slots on load and empties them on unload", () => {
    registry.apply();
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);
    expect((plugin.extensions[1] as unknown[]).length).toBe(1);
    plugin.settings.universeMode = "off";
    registry.apply();
    expect((plugin.extensions[0] as unknown[]).length).toBe(0);
    expect((plugin.extensions[1] as unknown[]).length).toBe(0);
  });

  it("a plain save fires no refresh; a changed universe property does, after a quiet time", () => {
    vi.useFakeTimers();
    try {
      registry.apply();
      entriesIdx().values.set(entry.path, entry);
      vi.spyOn(universe, "scopeOf").mockReturnValue(U);
      plugin.names.tableFor("Universo/A.md");
      const provider = universe.names()!;
      const refresh = vi.spyOn(provider, "refreshSoon");
      const f = file("Contos/a.md");
      plugin.app.metadataCache.trigger("changed", f, "", { frontmatter: { title: "x" } });
      expect(refresh).not.toHaveBeenCalled();
      plugin.app.metadataCache.trigger("changed", f, "", { frontmatter: { universe: "[[Universo]]" } });
      expect(refresh).toHaveBeenCalledTimes(1);
      plugin.app.metadataCache.trigger("changed", f, "", { frontmatter: { universe: "[[Universo]]", title: "y" } });
      expect(refresh).toHaveBeenCalledTimes(1);          // the property did not move
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      plugin.settings.universeMode = "off";
      registry.apply();
      expect(vi.getTimerCount()).toBe(0);                // every quiet-time timer went with the module
    } finally {
      vi.useRealTimers();
    }
  });

  it("the mentions' changes reach the panel's listeners after a second, the first ready at once", () => {
    vi.useFakeTimers();
    try {
      registry.apply();
      entriesIdx().becomeReady();
      const mentions = plugin.indexAdded.find((h) => h.spec.name === "universe-mentions")!;
      let n = 0;
      universe.onChange(() => n++);
      mentions.becomeReady();
      const first = n;
      mentions.emitChange([]);
      expect(n).toBe(first);
      vi.advanceTimersByTime(999);
      expect(n).toBe(first);
      vi.advanceTimersByTime(1);
      expect(n).toBe(first + 1);
    } finally {
      vi.useRealTimers();
    }
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
