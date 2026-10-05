// Task 2.4: the index specs compose classifyKey, the mentions index starts on demand
// (Q15, IMPROVEMENTS 14), and the placeholder dots redraw only the changed paths (23).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyKey } from "../src/core/classify";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { settingsKeyOf, worksSpec, type WorksSettings } from "../src/core/works-index";
import { DEFAULT_SETTINGS } from "../src/settings";
import { PlaceholdersModule } from "../src/placeholders";
import { entriesSettingsKey } from "../src/universe/entries";
import { MENTIONS_INDEX_NAME, MENTIONS_SETTLE_MS } from "../src/universe/mentions-index";
import { threadsSettingsKey, type ThreadsSettings } from "../src/universe/threads";
import { defaultUniverseSettings } from "../src/universe/settings";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";
import { settle } from "./support/memory-vault";
import { setup, src } from "./support/mentions-setup";

const A = src("Universo/Teo.md", "Teo");
const ctx = (entry: string) => ({
  entry, inScope: () => true, candidateInScope: () => true, resolve: () => null, workOf: () => null, workRank: () => 0,
});

describe("the specs' settings keys follow classify's inputs", () => {
  const works = (): WorksSettings => ({ ...structuredClone(DEFAULT_SETTINGS) });
  const threads = (): ThreadsSettings => ({ ...structuredClone(DEFAULT_SETTINGS), ...defaultUniverseSettings() }) as ThreadsSettings;

  // the inputs classify reads that no spec used to copy by hand
  const changes: [string, (s: Record<string, unknown>) => void][] = [
    ["submissions folder", (s) => { s.submissionsFolder = "Envios"; }],
    ["export folder", (s) => { s.exportFolder = "Saidas"; }],
    ["status property", (s) => { s.statusProperty = "estado"; }],
    ["deadline property", (s) => { s.deadlineProperty = "prazo"; }],
    ["track folders", (s) => { s.trackFolders = "Contos"; }],
  ];

  for (const [name, edit] of changes) {
    it(`a changed ${name} changes the works, entries and threads keys`, () => {
      const w = works(), t = threads();
      const w0 = settingsKeyOf(w), e0 = entriesSettingsKey(t), t0 = threadsSettingsKey(t);
      const k0 = classifyKey(w);
      edit(w as unknown as Record<string, unknown>);
      edit(t as unknown as Record<string, unknown>);
      expect(classifyKey(w)).not.toBe(k0);
      expect(settingsKeyOf(w)).not.toBe(w0);
      expect(entriesSettingsKey(t)).not.toBe(e0);
      expect(threadsSettingsKey(t)).not.toBe(t0);
    });
  }

  it("an unrelated setting changes none of them", () => {
    const w = works(), t = threads();
    const before = [settingsKeyOf(w), entriesSettingsKey(t), threadsSettingsKey(t)];
    (w as unknown as Record<string, unknown>).placeholderMarker = "TODO";
    (t as unknown as Record<string, unknown>).placeholderMarker = "TODO";
    expect([settingsKeyOf(w), entriesSettingsKey(t), threadsSettingsKey(t)]).toEqual(before);
  });

  it("the works spec still keys on the book goal property", () => {
    const w = works();
    const spec = worksSpec({ settings: () => w, placement: () => { throw new Error("unused"); }, frontmatter: () => undefined, bookGoal: () => undefined });
    const k0 = spec.settingsKey!();
    w.goalProperty = "meta";
    expect(spec.settingsKey!()).not.toBe(k0);
  });
});

describe("the mentions index starts on demand", () => {
  it("adds a demand spec with a 4 s settle, and builds nothing on start", async () => {
    const s = setup({ "Contos/a.md": "Teo chegou." }, [A]);
    s.mentions.start();
    await settle();
    await s.timers.advance(10000);
    expect(s.vault.readCount).toBe(0);
    expect(s.mentions.isReady()).toBe(false);
    expect(MENTIONS_SETTLE_MS).toBe(4000);
  });

  it("the first appearsIn query builds, with counting until ready; later queries add no build", async () => {
    const s = setup({ "Contos/a.md": "Teo chegou." }, [A]);
    s.mentions.start();
    expect(s.mentions.appearsIn(A.id, ctx(A.id)).total).toBe(0);   // counting: nothing known yet
    expect(s.mentions.isReady()).toBe(false);
    await settle();
    expect(s.mentions.isReady()).toBe(true);
    expect(s.vault.readCount).toBe(1);
    s.mentions.appearsIn(A.id, ctx(A.id));
    s.mentions.workCount(A.id, ctx(A.id));
    await settle();
    expect(s.vault.readCount).toBe(1);
    expect(s.mentions.appearsIn(A.id, ctx(A.id)).total).toBe(1);
  });

  it("workCount demands too", async () => {
    const s = setup({ "Contos/a.md": "Teo chegou." }, [A]);
    s.mentions.start();
    s.mentions.workCount(A.id, ctx(A.id));
    await settle();
    expect(s.mentions.isReady()).toBe(true);
  });

  it("a demand made before start is kept and builds at start", async () => {
    const s = setup({ "Contos/a.md": "Teo chegou." }, [A]);
    s.mentions.demand();
    await settle();
    expect(s.vault.readCount).toBe(0);
    s.mentions.start();
    await settle();
    expect(s.mentions.isReady()).toBe(true);
    expect(s.vault.readCount).toBe(1);
  });

  it("a term-table change while not demanded does nothing, and the first build reads the table then", async () => {
    const s = setup({ "Contos/a.md": "Teo" }, [A]);
    s.mentions.start();
    s.mentions.tableChanged();
    expect(s.timers.count).toBe(0);
    s.hub.rebuild(MENTIONS_INDEX_NAME);
    await settle();
    expect(s.vault.readCount).toBe(0);
    s.mentions.demand();
    await settle();
    expect(s.vault.readCount).toBe(1);
  });

  it("after the first build a table change rebuilds once, as before", async () => {
    const s = setup({ "Contos/a.md": "Teo" }, [A]);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    s.state.table = (await import("./support/mentions-setup")).table([A, src("Universo/X.md", "Xana")]);
    s.mentions.tableChanged();
    await s.timers.advance(2000);
    expect(s.vault.readCount).toBe(2);
  });

  it("an edit shows after 4 s of quiet, not before", async () => {
    const s = setup({ "Contos/a.md": "Teo" }, [A]);
    s.mentions.start();
    s.mentions.demand();
    await settle();
    s.vault.modify("Contos/a.md", "Teo e Teo");
    await s.timers.advance(3999);
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(1);
    await s.timers.advance(1);
    expect(s.mentions.get("Contos/a.md")?.occurrences).toHaveLength(2);
  });
});

describe("placeholder dots redraw only the changed paths", () => {
  let plugin: FakePlugin;
  let registry: FeatureRegistry;
  let refreshed: { id?: string; paths?: string[] }[];

  beforeEach(() => {
    vi.useFakeTimers();
    plugin = fakePlugin();
    (plugin.app.workspace as unknown as { updateOptions: () => void }).updateOptions = () => {};
    refreshed = [];
    plugin.decorations.refresh = ((id?: string, paths?: Iterable<string>) => {
      refreshed.push({ id, paths: paths ? [...paths] : undefined });
    }) as never;
    const mod = new PlaceholdersModule(plugin.asPlugin);
    registry = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, PlaceholdersModule>([["placeholders", mod]]));
    plugin.features = registry;
    registry.init();
    registry.apply();
    refreshed.length = 0;
  });
  afterEach(() => { vi.useRealTimers(); });

  it("an edit redraws that note's item only", () => {
    plugin.indexAdded[0].emitChange([{ path: "a.md", cause: "modify" }, { path: "b.md", cause: "modify" }]);
    vi.advanceTimersByTime(200);
    expect(refreshed).toEqual([{ id: "dot", paths: ["a.md", "b.md"] }]);
  });

  it("a rename redraws the old and the new path", () => {
    plugin.indexAdded[0].emitChange([{ path: "n.md", from: "o.md", cause: "rename" }]);
    vi.advanceTimersByTime(200);
    expect(refreshed).toEqual([{ id: "dot", paths: ["n.md", "o.md"] }]);
  });

  it("a build redraws everything", () => {
    plugin.indexAdded[0].emitChange([{ path: "a.md", cause: "modify" }, { path: "b.md", cause: "build" }]);
    vi.advanceTimersByTime(200);
    expect(refreshed).toEqual([{ id: "dot", paths: undefined }]);
  });

  it("changes in one quiet window redraw once, and the next window starts clean", () => {
    const h = plugin.indexAdded[0];
    h.emitChange([{ path: "a.md", cause: "modify" }]);
    h.emitChange([{ path: "b.md", cause: "modify" }]);
    vi.advanceTimersByTime(200);
    h.emitChange([{ path: "c.md", cause: "modify" }]);
    vi.advanceTimersByTime(200);
    expect(refreshed).toEqual([{ id: "dot", paths: ["a.md", "b.md"] }, { id: "dot", paths: ["c.md"] }]);
  });
});
