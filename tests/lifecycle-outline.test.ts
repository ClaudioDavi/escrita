import { beforeEach, describe, expect, it } from "vitest";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import type { FeatureModule } from "../src/core/module-context";
import { OutlineModule } from "../src/outline";
import { OUTLINE_VIEW } from "../src/outline/view";
import { READER_VIEW } from "../src/outline/reader-view";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

const COMMANDS = ["open-outline", "open-outline-board", "read-book", "create-book", "add-beat", "renumber-chapters"].map((c) => `escrita:${c}`);

let plugin: FakePlugin;
let mod: OutlineModule;
let reg: FeatureRegistry;

/** The editor array the module's slot fills, registered once at plugin load. */
function slotArray(): unknown[] {
  return plugin.extensions[0] as unknown[];
}

beforeEach(() => {
  plugin = fakePlugin();
  mod = new OutlineModule(plugin.asPlugin);
  reg = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, FeatureModule>([["outline", mod]]));
  plugin.features = reg;
  reg.init();
});

describe("outline lifecycle", () => {
  it("registers its view and one editor slot at init, before anything loads", () => {
    expect([...plugin.views.keys()].sort()).toEqual([OUTLINE_VIEW, READER_VIEW].sort());
    expect(plugin.extensions).toHaveLength(1);
    expect(slotArray()).toHaveLength(0);
    expect(plugin.commands.size).toBe(0);
  });

  it("loads: six commands, the ribbon icon, the ghost beats, the view creates an OutlineView", () => {
    reg.apply();
    expect(reg.isOn("outline")).toBe(true);
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect(plugin.ribbonAdds).toHaveLength(1);
    expect(slotArray()).toHaveLength(1);
    expect(plugin.views.get(OUTLINE_VIEW)).toBeTypeOf("function");
  });

  it("unloads: no command, no extension, no listener, no index, no timer; the view slot answers a placeholder", () => {
    reg.apply();
    plugin.turn("outline", false);
    reg.apply();
    expect(reg.isOn("outline")).toBe(false);
    expect(plugin.commands.size).toBe(0);
    expect(slotArray()).toHaveLength(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(plugin.indexAdded).toHaveLength(0);
    expect(plugin.followers.size).toBe(1); // the always-on POV colour follower (Q8), registered at plugin load
    expect(plugin.drawn.size).toBe(0);
    expect(plugin.statusBars).toHaveLength(0);
    expect(plugin.app.workspace.detached).toContain(OUTLINE_VIEW);
    expect(plugin.app.workspace.detached).toContain(READER_VIEW);
    // the leaf of an off feature gets Obsidian's placeholder, not the outline
    const view = plugin.views.get(OUTLINE_VIEW)!({} as never) as { getViewType(): string };
    expect(view.getViewType()).toBe(OUTLINE_VIEW);
    expect(view.constructor.name).not.toBe("OutlineView");
  });

  it("loads again with one of each, and the ribbon icon is reused (G0f)", () => {
    reg.apply();
    plugin.turn("outline", false);
    reg.apply();
    plugin.turn("outline", true);
    reg.apply();
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect(plugin.views.size).toBe(2);
    expect(plugin.extensions).toHaveLength(1);
    expect(slotArray()).toHaveLength(1);
    expect(plugin.ribbon.size).toBe(1);
  });

  it("a click on the ribbon icon of an off feature shows the notice and opens nothing", () => {
    reg.apply();
    plugin.turn("outline", false);
    reg.apply();
    expect(() => plugin.clickRibbon("Open outline")).not.toThrow();
  });

  it("the ghost beats setting refills the slot while loaded, and updates the editors", () => {
    reg.apply();
    const before = plugin.app.workspace.updateOptionsCalls;
    plugin.settings.ghostBeats = false;
    mod.settingsChanged();
    expect(slotArray()).toHaveLength(0);
    expect(plugin.app.workspace.updateOptionsCalls).toBeGreaterThan(before);
    plugin.settings.ghostBeats = true;
    mod.settingsChanged();
    expect(slotArray()).toHaveLength(1);
  });

  it("starts with ghost beats off: the slot is empty", () => {
    plugin.settings.ghostBeats = false;
    reg.apply();
    expect(slotArray()).toHaveLength(0);
    expect(plugin.commands.size).toBe(COMMANDS.length);
  });

  it("a settings change on an unloaded outline does nothing (the registry skips it)", () => {
    reg.apply();
    plugin.turn("outline", false);
    reg.apply();
    plugin.settings.ghostBeats = false;
    reg.settingsChanged();
    expect(slotArray()).toHaveLength(0);
  });

  it("keeps the writer's data: nothing in plugin.data changes across a switch", () => {
    const before = JSON.stringify(plugin.data);
    reg.apply();
    plugin.turn("outline", false);
    reg.apply();
    expect(JSON.stringify(plugin.data)).toBe(before);
  });
});

describe("read the book (0.9, Q14)", () => {
  it("the reading positions follow a rename and a delete through the always-on follower, even while off", () => {
    plugin.data.readPosition["Livro.md"] = { chapter: "Livro/Capítulos/01 A.md", line: 12 };
    reg.apply();
    plugin.turn("outline", false);
    reg.apply();
    const f = [...plugin.followers][0];
    f.moved!("Livro/Capítulos/01 A.md", "Livro/Capítulos/01 B.md");
    expect(plugin.data.readPosition["Livro.md"]).toEqual({ chapter: "Livro/Capítulos/01 B.md", line: 12 });
    f.moved!("Livro.md", "Romance.md");
    expect(Object.keys(plugin.data.readPosition)).toEqual(["Romance.md"]);
    f.deleted!("Livro/Capítulos/01 B.md");
    expect(plugin.data.readPosition).toEqual({});
  });

  it("the command is offered only when the active note is in a book", () => {
    reg.apply();
    const cmd = plugin.commands.get("escrita:read-book") as { checkCallback: (checking: boolean) => boolean };
    const p = plugin as unknown as { books: unknown; app: { workspace: { getActiveFile?: () => null } } };
    p.app.workspace.getActiveFile = () => null;
    p.books = { classify: () => ({ book: null }) };
    expect(cmd.checkCallback(true)).toBe(false);
    p.books = { classify: () => ({ book: { note: { path: "Livro.md" } } }) };
    expect(cmd.checkCallback(true)).toBe(true);
  });
});

describe("the outline view's subscriptions (finding 18)", () => {
  it("the features.onChange subscription goes with the view", async () => {
    reg.apply();
    const subs = { on: 0, off: 0 };
    const orig = reg.onChange.bind(reg);
    reg.onChange = (cb) => {
      subs.on++;
      const stop = orig(cb);
      return () => { subs.off++; stop(); };
    };
    (plugin as unknown as Record<string, unknown>).placeholders = { onChange: () => () => {}, countFor: () => 0 };
    const leaf = {} as never;
    const view = plugin.views.get(OUTLINE_VIEW)!(leaf) as unknown as { app: unknown; load(): void; unload(): void; onOpen(): Promise<void> };
    view.app = plugin.app;
    view.load();
    // onOpen subscribes first and then draws; the drawing needs a vault the fake doesn't have
    await view.onOpen().catch(() => {});
    expect(subs.on).toBe(1);
    expect(subs.off).toBe(0);
    view.unload();
    expect(subs.off).toBe(1);
  });
});
