import { beforeEach, describe, expect, it } from "vitest";
import { Notice, noticeLog } from "./support/obsidian";
import type { Extension } from "@codemirror/state";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { FeatureModule, type EditorSlot, type FeatureSlots } from "../src/core/module-context";
import type { EscritaModule } from "../src/data";
import type { Follower } from "../src/core/vault-index";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

void Notice;

/** A module whose onload/onunload are scripted by the test. */
class Fake extends FeatureModule {
  readonly id: FeatureId;
  readonly slots: FeatureSlots;
  loads = 0;
  unloads = 0;
  editorSlot: EditorSlot | null = null;
  settingsCalls = 0;
  followerList: Follower[] = [];
  constructor(id: FeatureId, slots: FeatureSlots = {}, private run: (m: Fake) => void = () => {}, private order?: string[]) {
    super();
    this.id = id;
    this.slots = slots;
  }
  onload(): void {
    this.loads++;
    this.order?.push(`load ${this.id}`);
    this.run(this);
  }
  onunload(): void {
    this.unloads++;
    this.order?.push(`unload ${this.id}`);
  }
  ctxOf() { return this.ctx; }
  settingsChanged(): void { this.settingsCalls++; }
  dataFollowers(): Follower[] { return this.followerList; }
}

let plugin: FakePlugin;
beforeEach(() => {
  plugin = fakePlugin();
  noticeLog.length = 0;
});

function registryOf(...mods: FeatureModule[]): FeatureRegistry {
  const map = new Map<FeatureId, FeatureModule | EscritaModule>(mods.map((m) => [m.id, m]));
  const r = new FeatureRegistry(plugin.asPlugin, map);
  plugin.features = r;
  r.init();
  return r;
}

function turn(id: FeatureId, on: boolean): void {
  plugin.settings.features = { ...plugin.settings.features, [id]: on };
}

describe("registrations are undone on unload", () => {
  it("commands go through addCommand and are removed by raw id, from a fresh object each load", () => {
    const m = new Fake("goals", {}, (f) => {
      f.ctxOf().command({ id: "goals-open", name: "Open goals", callback: () => {} });
    });
    const r = registryOf(m);
    r.apply();
    expect([...plugin.commands.keys()]).toEqual(["escrita:goals-open"]);
    turn("goals", false);
    r.apply();
    expect(plugin.commands.size).toBe(0);
    expect(plugin.commandLog).toEqual(["add escrita:goals-open", "remove goals-open"]);
    turn("goals", true);
    r.apply();
    expect([...plugin.commands.keys()]).toEqual(["escrita:goals-open"]);
  });

  it("the module's own command object is not rewritten (a reused object would be prefixed twice)", () => {
    const cmd = { id: "x", name: "X", callback: () => {} };
    const m = new Fake("goals", {}, (f) => f.ctxOf().command(cmd));
    const r = registryOf(m);
    r.apply();
    turn("goals", false);
    r.apply();
    turn("goals", true);
    r.apply();
    expect(cmd.id).toBe("x");
    expect([...plugin.commands.keys()]).toEqual(["escrita:x"]);
  });

  it("status bar items are removed", () => {
    let el!: HTMLElement;
    const m = new Fake("goals", {}, (f) => { el = f.ctxOf().statusBar(); el.textContent = "42"; });
    const r = registryOf(m);
    r.apply();
    expect(document.body.contains(el)).toBe(true);
    turn("goals", false);
    r.apply();
    expect(document.body.contains(el)).toBe(false);
  });

  it("a status bar element that was never attached (mobile) is removed without error", () => {
    plugin.addStatusBarItem = () => document.createElement("div");
    const m = new Fake("goals", {}, (f) => { f.ctxOf().statusBar(); });
    const r = registryOf(m);
    r.apply();
    turn("goals", false);
    expect(() => r.apply()).not.toThrow();
    expect(r.isOn("goals")).toBe(false);
  });

  it("indexes are disposed and removed from the hub, followers and decorations are dropped", () => {
    const f: Follower = { moved() {} };
    const m = new Fake("goals", {}, (x) => {
      x.ctxOf().index({ name: "goals", mode: "content", include: () => true, compute: () => undefined, same: () => true });
      x.ctxOf().follow(f);
      x.ctxOf().decorate("dot", () => null);
    });
    const r = registryOf(m);
    r.apply();
    expect(plugin.indexAdded).toHaveLength(1);
    expect(plugin.followers.has(f)).toBe(true);
    expect(plugin.drawn.has("dot")).toBe(true);
    turn("goals", false);
    r.apply();
    expect(plugin.indexRemoved).toEqual(plugin.indexAdded);
    expect(plugin.indexAdded[0].disposed).toBe(true);
    expect(plugin.followers.has(f)).toBe(false);
    expect(plugin.drawn.has("dot")).toBe(false);
    turn("goals", true);
    r.apply();
    expect(plugin.indexAdded).toHaveLength(2);
    expect(plugin.indexAdded[1].disposed).toBe(false);
  });

  it("a Component child, registered callback and DOM event of the module go with it (Obsidian's order)", () => {
    const order: string[] = [];
    const m = new Fake("goals", {}, (f) => {
      f.register(() => order.push("callback"));
      const child = new Fake("outline");
      child.onunload = () => { order.push("child"); };
      f.addChild(child);
    }, order);
    const r = registryOf(m);
    r.apply();
    turn("goals", false);
    r.apply();
    expect(order).toEqual(["load goals", "child", "callback", "unload goals"]);
  });

  it("an undo that throws does not stop the others", () => {
    const m = new Fake("goals", {}, (f) => {
      f.ctxOf().command({ id: "a", name: "A", callback: () => {} });
      f.ctxOf().decorate("dot", () => null);
    });
    plugin.removeCommand = () => { throw new Error("boom"); };
    const r = registryOf(m);
    r.apply();
    turn("goals", false);
    expect(() => r.apply()).not.toThrow();
    expect(plugin.drawn.has("dot")).toBe(false);
  });
});

describe("view, code block and post-processor slots", () => {
  it("a view type is registered once across three load/unload cycles", () => {
    const m = new Fake("outline", { views: ["escrita-outline"] }, (f) => {
      f.ctxOf().view("escrita-outline", () => ({ real: true }) as never);
    });
    const r = registryOf(m);
    for (let i = 0; i < 3; i++) {
      turn("outline", true);
      r.apply();
      turn("outline", false);
      r.apply();
    }
    expect(m.loads).toBe(3);
    expect(plugin.views.size).toBe(1);
  });

  it("the factory builds the real view while on and a bare placeholder while off", () => {
    const m = new Fake("outline", { views: ["escrita-outline"] }, (f) => {
      f.ctxOf().view("escrita-outline", () => ({ real: true }) as never);
    });
    const r = registryOf(m);
    r.apply();
    const factory = plugin.views.get("escrita-outline")!;
    expect(factory({})).toEqual({ real: true });
    turn("outline", false);
    r.apply();
    const bare = factory({}) as { getViewType(): string; real?: boolean };
    expect(bare.real).toBeUndefined();
    expect(bare.getViewType()).toBe("escrita-outline");
  });

  it("switching a feature off detaches its leaves; plugin unload does not", () => {
    const m = new Fake("outline", { views: ["escrita-outline"] }, (f) => {
      f.ctxOf().view("escrita-outline", () => ({}) as never);
    });
    const r = registryOf(m);
    r.apply();
    turn("outline", false);
    r.apply();
    expect(plugin.app.workspace.detached).toEqual(["escrita-outline"]);
    turn("outline", true);
    r.apply();
    r.unloadAll();
    expect(plugin.app.workspace.detached).toEqual(["escrita-outline"]);
  });

  it("ctx.view with an undeclared type throws", () => {
    const m = new Fake("outline", { views: ["declared"] }, (f) => f.ctxOf().view("other", () => ({}) as never));
    const r = registryOf(m);
    r.apply();
    expect(r.isOn("outline")).toBe(false);   // the failed load is rolled back
    const bare = new Fake("goals", {}, (f) => f.ctxOf().view("x", () => ({}) as never));
    const r2 = registryOf(bare);
    r2.apply();
    expect(r2.isOn("goals")).toBe(false);
  });

  it("a feature off at startup gets a placeholder view, and its restored leaf is detached at layout ready", () => {
    turn("outline", false);
    const m = new Fake("outline", { views: ["escrita-outline"] }, (f) => f.ctxOf().view("escrita-outline", () => ({}) as never));
    const r = registryOf(m);
    r.apply();
    expect(m.loads).toBe(0);
    expect(plugin.views.has("escrita-outline")).toBe(true);
    expect((plugin.views.get("escrita-outline")!({}) as { getViewType(): string }).getViewType()).toBe("escrita-outline");
    plugin.app.workspace.leaves.set("escrita-outline", [{ id: 1 }]);
    expect(plugin.app.workspace.detached).toEqual([]);
    plugin.app.workspace.fireLayoutReady();
    expect(plugin.app.workspace.detached).toEqual(["escrita-outline"]);
    expect(plugin.app.workspace.getLeavesOfType("escrita-outline")).toEqual([]);
  });

  it("code blocks: the bound handler while on, plain source while off", () => {
    const seen: string[] = [];
    const m = new Fake("desk", { codeBlocks: ["escrita-works"] }, (f) => {
      f.ctxOf().codeBlock("escrita-works", (src) => { seen.push(src); });
    });
    const r = registryOf(m);
    r.apply();
    const el = document.createElement("div");
    plugin.codeBlocks.get("escrita-works")!("hello", el, {});
    expect(seen).toEqual(["hello"]);
    expect(el.querySelector("pre > code")).toBeNull();
    turn("desk", false);
    r.apply();
    const off = document.createElement("div");
    plugin.codeBlocks.get("escrita-works")!("hello", off, {});
    expect(seen).toEqual(["hello"]);
    expect(off.querySelector("pre > code")?.textContent).toBe("hello");
  });

  it("the post-processor slot is a no-op while off", () => {
    let calls = 0;
    plugin.settings.universeMode = "universe";
    const m = new Fake("universe", { postProcessor: true }, (f) => f.ctxOf().postProcessor(() => { calls++; }));
    const r = registryOf(m);
    r.apply();
    const el = document.createElement("div");
    plugin.postProcessors[0](el, {} as never);
    expect(calls).toBe(1);
    plugin.settings.universeMode = "off";
    r.apply();
    expect(m.unloads).toBe(1);
    plugin.postProcessors[0](el, {} as never);
    expect(calls).toBe(1);
    expect(plugin.postProcessors).toHaveLength(1);
  });
});

describe("editor slots", () => {
  const ext = (n: number): Extension => [{ extension: n } as unknown as Extension];

  it("set replaces the array contents and unload empties it", () => {
    const m = new Fake("typing", { editors: 1 }, (f) => { f.editorSlot = f.ctxOf().editor([ext(1)]); });
    const r = registryOf(m);
    r.apply();
    const arr = plugin.extensions[0] as Extension[];
    expect(arr).toHaveLength(1);
    m.editorSlot!.set([ext(2), ext(3)]);
    expect(arr).toHaveLength(2);
    m.editorSlot!.set([]);
    expect(arr).toHaveLength(0);
    m.editorSlot!.set([ext(4)]);
    turn("typing", false);
    r.apply();
    expect(arr).toHaveLength(0);
    expect(plugin.extensions).toHaveLength(1);   // registered once
  });

  it("each load takes the slots from the first again; too many is an error", () => {
    const m = new Fake("typing", { editors: 2 }, (f) => { f.ctxOf().editor([ext(1)]); f.ctxOf().editor([ext(2)]); });
    const r = registryOf(m);
    r.apply();
    turn("typing", false);
    r.apply();
    turn("typing", true);
    r.apply();
    expect(r.isOn("typing")).toBe(true);
    expect((plugin.extensions[0] as Extension[]).length).toBe(1);
    expect((plugin.extensions[1] as Extension[]).length).toBe(1);
    const greedy = new Fake("lens", { editors: 1 }, (f) => { f.ctxOf().editor(); f.ctxOf().editor(); });
    const r2 = registryOf(greedy);
    r2.apply();
    expect(r2.isOn("lens")).toBe(false);
  });

  it("one updateOptions per apply, none when no slot changed", () => {
    const a = new Fake("typing", { editors: 1 }, (f) => { f.ctxOf().editor([ext(1)]); });
    const b = new Fake("lens", { editors: 1 }, (f) => { f.ctxOf().editor([ext(2)]); });
    const c = new Fake("goals");
    const r = registryOf(a, b, c);
    r.apply();
    expect(plugin.app.workspace.updateOptionsCalls).toBe(1);   // two features loaded, one call
    r.apply();
    expect(plugin.app.workspace.updateOptionsCalls).toBe(1);   // nothing changed
    turn("typing", false);
    turn("lens", false);
    r.apply();
    expect(plugin.app.workspace.updateOptionsCalls).toBe(2);
    turn("goals", false);
    r.apply();
    expect(plugin.app.workspace.updateOptionsCalls).toBe(2);   // goals has no slot
  });
});

describe("ribbon icons (G0f)", () => {
  const ribbonModule = (calls: string[]) =>
    new Fake("goals", {}, (f) => { f.ctxOf().ribbon("target", "Goals", () => calls.push("click")); });

  it("never adds an icon for a feature that is off at startup", () => {
    turn("goals", false);
    const r = registryOf(ribbonModule([]));
    r.apply();
    expect(plugin.ribbonAdds).toEqual([]);
  });

  it("ribbon() outside a load adds nothing and returns null", () => {
    const m = ribbonModule([]);
    const r = registryOf(m);
    expect(m.ctxOf()).toBeUndefined();
    r.apply();
    turn("goals", false);
    r.apply();
    expect(m.ctxOf().ribbon("target", "Late", () => {})).toBeNull();
    expect(plugin.ribbonAdds).toEqual(["Goals"]);
  });

  it("after a runtime switch-off the click shows the notice and runs nothing", () => {
    const calls: string[] = [];
    const r = registryOf(ribbonModule(calls));
    r.apply();
    plugin.clickRibbon("Goals");
    expect(calls).toEqual(["click"]);
    turn("goals", false);
    r.apply();
    plugin.clickRibbon("Goals");
    expect(calls).toEqual(["click"]);
    expect(noticeLog).toHaveLength(1);
    expect(noticeLog[0]).toMatch(/off/i);
  });

  it("switched on again, there is one icon with the same title and the click works", () => {
    const calls: string[] = [];
    const r = registryOf(ribbonModule(calls));
    r.apply();
    turn("goals", false);
    r.apply();
    turn("goals", true);
    r.apply();
    expect([...plugin.ribbon.keys()]).toEqual(["Goals"]);
    plugin.clickRibbon("Goals");
    expect(calls).toEqual(["click"]);
    expect(noticeLog).toEqual([]);
  });
});

describe("onLayoutReady", () => {
  it("runs while the module is loaded", () => {
    let ran = 0;
    const m = new Fake("goals", {}, (f) => f.ctxOf().onLayoutReady(() => { ran++; }));
    const r = registryOf(m);
    r.apply();
    plugin.app.workspace.fireLayoutReady();
    expect(ran).toBe(1);
  });

  it("never runs after unload, nor in a later load's place", () => {
    let ran = 0;
    const m = new Fake("goals", {}, (f) => f.ctxOf().onLayoutReady(() => { ran++; }));
    const r = registryOf(m);
    r.apply();
    turn("goals", false);
    r.apply();
    turn("goals", true);
    r.apply();      // a second load queues its own callback
    plugin.app.workspace.fireLayoutReady();
    expect(ran).toBe(1);   // the first load's callback is dead; the second one's ran
    turn("goals", false);
    r.apply();
    const late = new Fake("outline", {}, (f) => f.ctxOf().onLayoutReady(() => { ran += 10; }));
    const r2 = registryOf(late);
    r2.apply();
    turn("outline", false);
    r2.apply();
    expect(ran).toBe(11);   // already ready: runs at once while loaded
  });
});

describe("apply", () => {
  it("loads in FEATURE_IDS order and unloads in reverse", () => {
    const order: string[] = [];
    const mods = (["lens", "goals", "outline"] as FeatureId[]).map((id) => new Fake(id, {}, () => {}, order));
    const r = registryOf(...mods);
    r.apply();
    expect(order).toEqual(["load goals", "load outline", "load lens"]);
    order.length = 0;
    plugin.settings.features = { goals: false, outline: false, lens: false };
    r.apply();
    expect(order).toEqual(["unload lens", "unload outline", "unload goals"]);
  });

  it("a feature the writer turns off in settings is not loaded at startup", () => {
    turn("lens", false);
    const m = new Fake("lens");
    const r = registryOf(m);
    r.apply();
    expect(m.loads).toBe(0);
    expect(r.isOn("lens")).toBe(false);
    expect(r.get("lens")).toBeUndefined();
  });

  it("get returns the module while loaded", () => {
    const m = new Fake("goals");
    const r = registryOf(m);
    r.apply();
    expect(r.get<Fake>("goals")).toBe(m);
  });

  it("apply from inside a follower, and twice in a row, end in the right state", () => {
    const lens = new Fake("lens");
    const goals = new Fake("goals");
    // a data follower that saves settings the way a rename follower does: it switches lens off and re-applies
    const desk = new Fake("desk");
    desk.followerList = [{ moved: () => { turn("lens", false); r.apply(); } }];
    const r = registryOf(goals, lens, desk);
    r.apply();
    expect(r.isOn("lens")).toBe(true);
    for (const f of plugin.followers) f.moved?.("a.md", "b.md");   // from outside an apply
    expect(r.isOn("lens")).toBe(false);
    r.apply();
    r.apply();
    expect(r.isOn("goals") && r.isOn("desk")).toBe(true);
    expect(lens.loads).toBe(1);
    expect(lens.unloads).toBe(1);
  });

  it("apply called from a module's own load does not recurse and ends in the right state", () => {
    let depth = 0;
    let maxDepth = 0;
    const goals = new Fake("goals");
    const outline = new Fake("outline", {}, () => {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
      turn("goals", false);
      r.apply();
      depth--;
    });
    const r = registryOf(goals, outline);
    r.apply();
    expect(maxDepth).toBe(1);
    expect(r.isOn("goals")).toBe(false);
    expect(r.isOn("outline")).toBe(true);
  });

  it("a settings change that arrives during apply re-runs once at the end", () => {
    const m = new Fake("goals");
    const trigger = new Fake("outline", {}, () => { turn("goals", false); r.apply(); });
    const r = registryOf(trigger, m);
    // goals loads after outline in FEATURE_IDS order? no: goals first, so it is loaded when outline switches it off
    r.apply();
    expect(m.loads).toBe(1);
    expect(m.unloads).toBe(1);
    expect(r.isOn("goals")).toBe(false);
  });

  it("onChange reports each switch after the whole apply", () => {
    const m = new Fake("goals");
    const r = registryOf(m);
    const heard: string[] = [];
    r.onChange((id, on) => heard.push(`${id}:${on}`));
    r.apply();
    turn("goals", false);
    r.apply();
    expect(heard).toEqual(["goals:true", "goals:false"]);
  });

  it("settingsChanged fans out to loaded modules only", () => {
    const a = new Fake("goals");
    const b = new Fake("lens");
    turn("lens", false);
    const r = registryOf(a, b);
    r.apply();
    r.settingsChanged();
    expect(a.settingsCalls).toBe(1);
    expect(b.settingsCalls).toBe(0);
  });

  it("a module whose load throws is rolled back and does not stop the others", () => {
    const bad = new Fake("goals", {}, (f) => { f.ctxOf().command({ id: "x", name: "X", callback: () => {} }); throw new Error("boom"); });
    const good = new Fake("outline");
    const r = registryOf(bad, good);
    r.apply();
    expect(r.isOn("goals")).toBe(false);
    expect(r.isOn("outline")).toBe(true);
    expect(plugin.commands.size).toBe(0);
  });

  it("a feature turned on mid-session loads once and a second apply does nothing", () => {
    turn("goals", false);
    const m = new Fake("goals");
    const r = registryOf(m);
    r.apply();
    turn("goals", true);
    r.apply();
    r.apply();
    expect(m.loads).toBe(1);
  });
});

describe("data followers", () => {
  it("are registered at init for every module and run while the module is off", () => {
    const moved: string[] = [];
    const m = new Fake("desk");
    m.followerList = [{ moved: (o, n) => moved.push(`${o}>${n}`) }];
    turn("desk", false);
    const r = registryOf(m);
    r.apply();
    expect(m.loads).toBe(0);
    expect(plugin.followers.size).toBe(1);
    for (const f of plugin.followers) f.moved?.("a.md", "b.md");
    expect(moved).toEqual(["a.md>b.md"]);
  });

  it("stay registered across switches (the context does not own them)", () => {
    const m = new Fake("desk");
    m.followerList = [{ moved() {} }];
    const r = registryOf(m);
    r.apply();
    turn("desk", false);
    r.apply();
    turn("desk", true);
    r.apply();
    expect(plugin.followers.size).toBe(1);
  });
});

describe("unloadAll", () => {
  it("runs modules in reverse FEATURE_IDS order, before the final persist", () => {
    const order: string[] = [];
    const mods = (["goals", "outline", "lens"] as FeatureId[]).map((id) => new Fake(id, {}, () => {}, order));
    const r = registryOf(...mods);
    r.apply();
    order.length = 0;
    r.unloadAll();
    order.push("persist");
    expect(order).toEqual(["unload lens", "unload outline", "unload goals", "persist"]);
  });

  it("twice is harmless, and apply afterwards loads nothing", () => {
    const m = new Fake("goals");
    const r = registryOf(m);
    r.apply();
    r.unloadAll();
    expect(() => r.unloadAll()).not.toThrow();
    expect(m.unloads).toBe(1);
    turn("goals", true);
    r.apply();
    expect(m.loads).toBe(1);
  });
});

describe("the adapter for 0.6 modules", () => {
  it("calls load and unload on an EscritaModule", () => {
    const calls: string[] = [];
    const legacy: EscritaModule = { load: () => { calls.push("load"); }, unload: () => { calls.push("unload"); }, settingsChanged: () => { calls.push("settings"); } };
    const r = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, FeatureModule | EscritaModule>([["goals", legacy]]));
    r.init();
    r.apply();
    r.settingsChanged();
    turn("goals", false);
    r.apply();
    expect(calls).toEqual(["load", "settings", "unload"]);
  });

  it("keeps a 0.6 module that reads its own switch (explorer counts, universe mode) loaded", () => {
    const calls: string[] = [];
    const mk = (name: string): EscritaModule => ({ load: () => { calls.push(`load ${name}`); } });
    plugin.settings.explorerCounts = false;
    plugin.settings.universeMode = "off";
    const r = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, FeatureModule | EscritaModule>([
      ["explorerCounts", mk("explorer")], ["universe", mk("universe")],
    ]));
    r.init();
    r.apply();
    expect(calls).toEqual(["load explorer", "load universe"]);
  });

  it("a 0.6 module that throws in load is not marked loaded", () => {
    const legacy: EscritaModule = { load: () => { throw new Error("boom"); } };
    const r = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, FeatureModule | EscritaModule>([["goals", legacy]]));
    r.init();
    r.apply();
    expect(r.isOn("goals")).toBe(false);
  });
});
