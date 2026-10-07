import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownView, TFile } from "./support/obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { makeLeftOff } from "../src/core/left-off";
import { DeskModule } from "../src/desk";
import { gatherDesk } from "../src/desk/gather";
import { FeatureModule } from "../src/core/module-context";
import type { PendingSource, PendingSubmission } from "../src/core/pending";
import { openWork } from "../src/ui/open-work";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let registry: FeatureRegistry;

function setup(ready = true): void {
  plugin = fakePlugin();
  plugin.app.workspace.ready = ready;
  const desk = new DeskModule(plugin.asPlugin);
  registry = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, DeskModule>([["desk", desk]]));
  plugin.features = registry;
  registry.init();
}

function turn(on: boolean): void {
  plugin.settings.features = { ...plugin.settings.features, desk: on };
  registry.apply();
}

/** What the code block slot draws for a block right now. */
function draw(): { el: HTMLElement; children: unknown[] } {
  const el = document.createElement("div");
  const children: unknown[] = [];
  void plugin.codeBlocks.get("escrita-works")!("folder: Contos", el, { addChild: (c: unknown) => children.push(c) });
  return { el, children };
}

beforeEach(() => setup());

describe("desk lifecycle", () => {
  it("declares its code block once, at init, while off or on", () => {
    expect([...plugin.codeBlocks.keys()]).toEqual(["escrita-works"]);
    registry.apply();
    turn(false);
    turn(true);
    expect([...plugin.codeBlocks.keys()]).toEqual(["escrita-works"]);
  });

  it("loaded: command, events, DOM event and recorder follower; unloaded: none of them", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    registry.apply();
    expect([...plugin.commands.keys()]).toEqual(["escrita:open-home-note"]);
    expect(plugin.liveListeners()).toBe(5);
    expect(add.mock.calls.map((c) => c[0])).toEqual(["visibilitychange"]);
    expect(plugin.followers.size).toBe(2);   // the data follower and the recorder's

    turn(false);
    expect(plugin.commands.size).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(remove.mock.calls.map((c) => c[0])).toEqual(["visibilitychange"]);
    expect(plugin.followers.size).toBe(1);   // the data follower stays
    expect(plugin.indexAdded).toHaveLength(0);
    expect(plugin.views.size).toBe(0);
    expect(plugin.statusBars).toHaveLength(0);
    expect(plugin.ribbonAdds).toHaveLength(0);
    expect(plugin.extensions).toHaveLength(0);

    turn(true);
    expect(plugin.commands.size).toBe(1);
    expect(plugin.liveListeners()).toBe(5);
    expect(plugin.followers.size).toBe(2);
    add.mockRestore();
    remove.mockRestore();
  });

  it("the code block draws plain source while the desk is off, and the block while on", () => {
    expect(draw().el.querySelector("pre > code")?.textContent).toBe("folder: Contos");
    registry.apply();
    const on = draw();
    expect(on.children).toHaveLength(1);
    expect(on.el.querySelector("pre")).toBeNull();
    turn(false);
    expect(draw().el.querySelector("pre > code")?.textContent).toBe("folder: Contos");
  });

  it("unloading the desk unloads its live blocks", () => {
    registry.apply();
    const { children } = draw();
    const spy = vi.spyOn(children[0] as { unload(): void }, "unload");
    turn(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a toggle re-renders open notes, and an unload does it with the slot already unbound", () => {
    const seen: (string | undefined)[] = [];
    const view = Object.create(MarkdownView.prototype) as { previewMode: { rerender(full?: boolean): void } };
    view.previewMode = { rerender: () => { seen.push(draw().el.querySelector("pre > code")?.textContent); } };
    plugin.app.workspace.allLeaves.push({ view });
    registry.apply();
    expect(seen).toEqual([undefined]);   // bound: the block, not plain source
    seen.length = 0;
    turn(false);
    expect(seen).toEqual(["folder: Contos"]);   // plain source: the blocks are gone
    expect(plugin.app.workspace.updateOptionsCalls).toBeGreaterThan(0);
  });

  it("the data follower keeps leftOff and the home note current while the desk is off", () => {
    const rec = makeLeftOff("Hello world", 5, 1);
    plugin.data.leftOff = { "Contos/a.md": rec };
    plugin.settings.homeNote = "Contos/a.md";
    plugin.app.vault.files.set("Contos/a.md", {});   // the load-time prune keeps records of notes that exist
    registry.apply();
    turn(false);
    const data = [...plugin.followers][0];
    data.moved?.("Contos/a.md", "Contos/b.md");
    expect(plugin.data.leftOff).toEqual({ "Contos/b.md": rec });
    expect(plugin.settings.homeNote).toBe("Contos/b.md");
    data.deleted?.("Contos/b.md");
    expect(plugin.data.leftOff).toEqual({});
  });

  it("data stays across an unload: leftOff is untouched by switching off", () => {
    const rec = makeLeftOff("Hello world", 5, 1);
    plugin.data.leftOff = { "a.md": rec };
    plugin.app.vault.files.set("a.md", {});
    registry.apply();
    turn(false);
    turn(true);
    expect(plugin.data.leftOff).toEqual({ "a.md": rec });
  });

  it("the cold-start open and layout work never run after an unload", () => {
    setup(false);
    registry.apply();   // cold start: queued for layout ready
    turn(false);
    const spy = vi.spyOn(plugin.app.vault, "getAbstractFileByPath");
    plugin.app.workspace.fireLayoutReady();
    expect(spy).not.toHaveBeenCalled();
  });

  it("settingsChanged reaches the desk only while loaded", () => {
    registry.apply();
    expect(() => registry.settingsChanged()).not.toThrow();
    turn(false);
    expect(() => registry.settingsChanged()).not.toThrow();
  });
});

describe("openWork and the desk switch", () => {
  const text = "line one\nline two\nline three";

  function wire(): { eStates: unknown[] } {
    const file = new TFile();
    file.path = "a.md";
    plugin.app.vault.files.set("a.md", file);
    plugin.books = { classify: () => ({ kind: "note", book: null }) };
    plugin.notes = { text: () => ({ read: async () => text }) };
    const eStates: unknown[] = [];
    (plugin.app.workspace as unknown as { getLeaf: () => unknown }).getLeaf = () => ({
      view: {},
      openFile: async (_f: unknown, opts: { eState?: unknown }) => { eStates.push(opts.eState); },
    });
    plugin.data.leftOff = { "a.md": makeLeftOff(text, text.indexOf("two"), 1) };
    return { eStates };
  }

  it("lands where the writer left off while the desk is on", async () => {
    registry.apply();
    const { eStates } = wire();
    await openWork(plugin.asPlugin, "a.md", false);
    expect((eStates[0] as { line: number }).line).toBe(1);
  });

  it("ignores leftOff while the desk is off", async () => {
    registry.apply();
    turn(false);
    const { eStates } = wire();
    await openWork(plugin.asPlugin, "a.md", false);
    expect((eStates[0] as { line: number }).line).not.toBe(1);
    expect(Object.keys(plugin.data.leftOff)).toEqual(["a.md"]);   // read, never dropped
  });
});

describe("desk pending-count wiring", () => {
  class StubSubmissions extends FeatureModule {
    readonly id = "submissions" as const;
    subscriptions = 0;
    unsubs: ReturnType<typeof vi.fn>[] = [];
    rows: PendingSubmission[] = [];
    pending: PendingSource = {
      list: () => this.rows,
      onChange: () => {
        this.subscriptions++;
        const off = vi.fn();
        this.unsubs.push(off);
        return off;
      },
    };
  }

  function withSubmissions(): StubSubmissions {
    const desk = new DeskModule(plugin.asPlugin);
    const subs = new StubSubmissions();
    plugin.settings.features = { ...plugin.settings.features, submissions: true };
    registry = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, FeatureModule>([["desk", desk], ["submissions", subs]]));
    plugin.features = registry;
    registry.init();
    registry.apply();
    return subs;
  }

  function stubIndex(): void {
    Object.assign(plugin, {
      works: { isReady: () => false, onChange: () => () => {}, onReady: () => () => {}, get: () => undefined, list: () => [] },
      measure: { onChange: () => () => {} },
    });
  }

  it("follows the submissions switch and unsubscribes when the block unloads", () => {
    stubIndex();
    const subs = withSubmissions();
    const { el, children } = draw();
    document.body.appendChild(el);
    const block = children[0] as { load(): void; unload(): void; refresh(): Promise<void> };
    const refresh = vi.spyOn(block, "refresh");
    block.load();
    expect(subs.subscriptions).toBe(1);
    refresh.mockClear();   // the first paint at load is not under test

    plugin.settings.features = { ...plugin.settings.features, submissions: false };
    registry.apply();
    expect(subs.unsubs[0]).toHaveBeenCalledTimes(1);
    expect(subs.subscriptions).toBe(1);   // nothing new while it is off
    expect(refresh).toHaveBeenCalledTimes(1);

    plugin.settings.features = { ...plugin.settings.features, submissions: true };
    registry.apply();
    expect(subs.subscriptions).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(2);   // one per switch

    block.unload();
    expect(subs.unsubs[1]).toHaveBeenCalledTimes(1);
    el.remove();
  });

  it("a block that never loaded, or one unloaded while off, leaves nothing subscribed", () => {
    stubIndex();
    const subs = withSubmissions();
    const { children } = draw();
    const block = children[0] as { load(): void; unload(): void };
    block.load();
    plugin.settings.features = { ...plugin.settings.features, submissions: false };
    registry.apply();
    block.unload();
    expect(subs.unsubs[0]).toHaveBeenCalledTimes(1);   // not called twice
    expect(subs.subscriptions).toBe(1);
  });

  describe("gatherDesk", () => {
    const row = (path: string, workPath: string): PendingSubmission =>
      ({ path, workPath, workTitle: workPath, market: "Revista", sent: "2026-10-05" });

    function wireWorks(subs: StubSubmissions): void {
      const file = new TFile();
      file.path = "Contos/a.md";
      plugin.app.vault.files.set("Contos/a.md", file);
      Object.assign(plugin.app.vault, {
        getFileByPath: (p: string) => (p === "Contos/a.md" ? file : null),
        getFolderByPath: () => ({}),
      });
      Object.assign(plugin, {
        works: {
          list: () => [["Contos/a.md", { role: "note", stage: "draft", title: "A" }]],
          get: () => undefined,
        },
        measure: { note: async () => ({ unit: "words", counts: { words: 10, characters: 50, charactersNoSpaces: 40 } }) },
        books: { classify: () => ({ kind: "note", book: null }), frontmatter: () => ({}) },
      });
      subs.rows = [row("s1", "Contos/a.md"), row("s2", "Outros/b.md")];
    }

    it("with a folder filter, a submission of a work outside the folder is not counted", async () => {
      const subs = withSubmissions();
      wireWorks(subs);
      subs.rows = [row("s2", "Outros/b.md")];
      const g = await gatherDesk(plugin.asPlugin, "folder: Contos", "2026-10-05");
      expect(g.model.pending).toBeUndefined();
      subs.rows = [row("s1", "Contos/a.md"), row("s2", "Outros/b.md")];
      const h = await gatherDesk(plugin.asPlugin, "folder: Contos", "2026-10-05");
      expect(h.model.pending?.items.map((i) => i.path)).toEqual(["s1"]);
    });

    it("with no folder filter, the same outside row is counted", async () => {
      const subs = withSubmissions();
      wireWorks(subs);
      subs.rows = [row("s2", "Outros/b.md")];
      const g = await gatherDesk(plugin.asPlugin, "", "2026-10-05");
      expect(g.model.pending?.n).toBe(1);
    });
  });
});
