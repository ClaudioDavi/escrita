// The screenplay module keeps "is this note a screenplay" per path (the layout asks on every editor
// update): read once, changed by the note's metadata, followed on rename and delete, cleared on settings.
import { beforeEach, describe, expect, it } from "vitest";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { ScreenplayModule } from "../src/screenplay";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let mod: ScreenplayModule;
let form: string | null;
let reads: number;
const file = (path: string) => ({ path }) as never;

beforeEach(() => {
  plugin = fakePlugin();
  form = "screenplay";
  reads = 0;
  plugin.books = { classify: () => { reads++; return { form }; } };
  mod = new ScreenplayModule(plugin.asPlugin);
  const registry = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, ScreenplayModule>([["screenplay", mod]]));
  plugin.features = registry;
  registry.init();
  plugin.turn("screenplay", true);
});

const changed = (path: string, data: string, frontmatter?: object) =>
  plugin.app.metadataCache.trigger("changed", file(path), data, frontmatter ? { frontmatter } : {});

describe("screenplay form per path", () => {
  it("reads the classifier on the first ask only", () => {
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
    expect(reads).toBe(1);
  });

  it("a change that took the form away turns it off", () => {
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
    form = null;
    changed("a.md", "no frontmatter now\n");
    expect(mod.isScreenplayFile(file("a.md"))).toBe(false);
  });

  it("a change with the form still there keeps it, and one that adds it turns it on", () => {
    form = null;
    expect(mod.isScreenplayFile(file("a.md"))).toBe(false);
    form = "screenplay";
    changed("a.md", "---\nform: roteiro\n---\n", { form: "roteiro" });
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
  });

  it("a reading without frontmatter, from text that has some, does not flip the answer", () => {
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
    form = null; // the cache is mid re-parse
    changed("a.md", "---\nform: roteiro\n---\n\nText\n");
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
  });

  it("a rename reads the new path again and forgets the old one", () => {
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
    plugin.app.vault.trigger("rename", file("b.md"), "a.md");
    form = null;
    expect(mod.isScreenplayFile(file("b.md"))).toBe(false);
    form = "screenplay";
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
    expect(reads).toBe(3);
  });

  it("a delete forgets the path", () => {
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
    plugin.app.vault.trigger("delete", file("a.md"));
    form = null;
    expect(mod.isScreenplayFile(file("a.md"))).toBe(false);
  });

  it("a settings change clears every answer", () => {
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
    form = null;
    mod.settingsChanged();
    expect(mod.isScreenplayFile(file("a.md"))).toBe(false);
  });

  it("unloading clears the answers", () => {
    expect(mod.isScreenplayFile(file("a.md"))).toBe(true);
    plugin.turn("screenplay", false);
    form = null;
    expect(mod.isScreenplayFile(file("a.md"))).toBe(false);
  });
});
