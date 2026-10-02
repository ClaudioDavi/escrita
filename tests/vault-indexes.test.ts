import { describe, expect, it } from "vitest";
import { IndexHub, type HubEvents } from "../src/core/index-hub";
import type { IndexSpec } from "../src/core/vault-index";
import { ManualTimers, MemoryVault, settle, type MemFile, type RenameMode } from "./support/memory-vault";

type Spec = IndexSpec<MemFile, string>;

function spec(name: string, over: Partial<Spec> = {}): Spec {
  return {
    name,
    mode: "content",
    include: (f) => f.extension === "md",
    compute: (_f, text) => (text && text.trim() ? text : undefined),
    same: (a, b) => a === b,
    ...over,
  };
}

function setup(files: Record<string, string>, o: { layout?: boolean; cached?: boolean } = {}) {
  const vault = new MemoryVault(files);
  const timers = new ManualTimers();
  const state = { layout: o.layout ?? false, cached: o.cached ?? true };
  const cbs = {
    create: [] as ((f: MemFile) => void)[],
    modify: [] as ((f: MemFile) => void)[],
    delete: [] as ((f: MemFile) => void)[],
    rename: [] as ((f: MemFile, old: string) => void)[],
    meta: [] as ((f: MemFile) => void)[],
    resolved: [] as (() => void)[],
    layout: [] as (() => void)[],
  };
  const events: HubEvents<MemFile> = {
    onCreate: (cb) => void cbs.create.push(cb),
    onModify: (cb) => void cbs.modify.push(cb),
    onDelete: (cb) => void cbs.delete.push(cb),
    onRename: (cb) => void cbs.rename.push(cb),
    onMetaChanged: (cb) => void cbs.meta.push(cb),
    onResolved: (cb) => void cbs.resolved.push(cb),
    onLayoutReady: (cb) => void cbs.layout.push(cb),
    layoutReady: () => state.layout,
    hasCache: () => state.cached,
  };
  vault.onEvent((e) => {
    if (e.type === "create") cbs.create.forEach((c) => c(e.file));
    else if (e.type === "modify") cbs.modify.forEach((c) => c(e.file));
    else if (e.type === "meta") cbs.meta.forEach((c) => c(e.file));
    else if (e.type === "delete") cbs.delete.forEach((c) => c({ path: e.path, extension: "", text: "" }));
    else if (e.type === "rename") cbs.rename.forEach((c) => c({ path: e.path, extension: "", text: "" }, e.oldPath));
  });
  const errors: unknown[] = [];
  const hub = new IndexHub<MemFile>(events, vault, timers, {
    snapshotsRoot: () => "Escrita/Snapshots",
    onError: (_p, e) => errors.push(e),
  });
  const layoutReady = async () => {
    state.layout = true;
    cbs.layout.forEach((c) => c());
    await settle();
  };
  const resolved = () => cbs.resolved.forEach((c) => c());
  return { vault, timers, hub, state, layoutReady, resolved, errors };
}

describe("dispatch", () => {
  it("builds at once when layout is ready at add()", async () => {
    const s = setup({ "a.md": "A" }, { layout: true });
    const ix = s.hub.add(spec("t"));
    await settle();
    expect(ix.isReady()).toBe(true);
    expect(ix.get("a.md")).toBe("A");
  });

  it("waits for layout ready otherwise", async () => {
    const s = setup({ "a.md": "A" });
    const ix = s.hub.add(spec("t"));
    await settle();
    expect(ix.isReady()).toBe(false);
    await s.layoutReady();
    expect(ix.isReady()).toBe(true);
  });

  it("ignores creates before layout ready (the build covers them)", async () => {
    const s = setup({ "a.md": "A" });
    const ix = s.hub.add(spec("t"));
    s.vault.create("b.md", "B");
    await s.timers.advance(1000);
    expect(s.vault.readCount).toBe(0);
    await s.layoutReady();
    expect(ix.get("b.md")).toBe("B");
    expect(s.vault.readCount).toBe(2);
  });

  it("calls every index before the followers", async () => {
    const s = setup({ "a.md": "A" }, { layout: true });
    const ix = s.hub.add(spec("t"));
    await settle();
    const order: string[] = [];
    ix.onChange((c) => order.push("index:" + c.map((x) => x.cause).join()));
    s.hub.follow({
      moved: (o, n) => order.push(`moved:${o}>${n}:${ix.get(n) === "A"}`),
      deleted: (p) => order.push(`deleted:${p}:${ix.get(p) === undefined}`),
    });
    s.vault.rename("a.md", "b.md");
    s.vault.delete("b.md");
    expect(order).toEqual(["index:rename", "moved:a.md>b.md:true", "index:delete", "deleted:b.md:true"]);
  });

  it("follow() returns an unsubscribe", async () => {
    const s = setup({ "a.md": "A" }, { layout: true });
    let n = 0;
    const off = s.hub.follow({ moved: () => n++ });
    s.vault.rename("a.md", "b.md");
    off();
    s.vault.rename("b.md", "c.md");
    expect(n).toBe(1);
  });

  it.each<RenameMode>(["folder-only", "folder-then-children"])("calls a follower once per folder rename (%s)", async (mode) => {
    const s = setup({ "F/a.md": "A", "F/b.md": "B" }, { layout: true });
    const ix = s.hub.add(spec("t"));
    await settle();
    const calls: string[] = [];
    s.hub.follow({ moved: (o, n) => calls.push(`${o}>${n}`) });
    s.vault.rename("F", "G", mode);
    expect(calls).toEqual(["F>G"]);
    expect(ix.paths().sort()).toEqual(["G/a.md", "G/b.md"]);
  });

  it("still sees a later rename of the same child", async () => {
    const s = setup({ "F/a.md": "A" }, { layout: true });
    s.hub.add(spec("t"));
    await settle();
    const calls: string[] = [];
    s.hub.follow({ moved: (o, n) => calls.push(`${o}>${n}`) });
    s.vault.rename("F", "G");
    s.vault.rename("G/a.md", "G/b.md");
    expect(calls).toEqual(["F>G", "G/a.md>G/b.md"]);
  });
});

describe("structural fan-out", () => {
  it("recomputes structural indexes on create, delete and rename", async () => {
    let n = 0;
    const s = setup({ "F.md": "x" }, { layout: true });
    s.hub.add(spec("t", { structural: true, mode: "metadata", compute: () => `v${++n}` }));
    await settle();
    n = 100;
    s.vault.create("F/Cap/x.md", "");
    await s.timers.advance(300);
    const afterCreate = n;
    expect(afterCreate).toBeGreaterThan(100);
    s.vault.rename("F", "G");
    await s.timers.advance(300);
    expect(n).toBeGreaterThan(afterCreate);
  });

  it("skips the snapshots root", async () => {
    let n = 0;
    const s = setup({ "F.md": "x" }, { layout: true });
    s.hub.add(spec("t", { structural: true, mode: "metadata", compute: () => `v${++n}` }));
    await settle();
    n = 0;
    s.vault.create("Escrita/Snapshots/F/1.txt", "");
    s.vault.rename("Escrita/Snapshots/F", "Escrita/Snapshots/G");
    s.vault.delete("Escrita/Snapshots/G");
    await s.timers.advance(2000);
    expect(n).toBe(0);
  });
});

describe("metadata readiness", () => {
  const meta = () => spec("m", { mode: "metadata", compute: (f) => f.path });

  it("builds on layout ready when every file has a cache entry", async () => {
    const s = setup({ "a.md": "A" });
    const ix = s.hub.add(meta());
    await s.layoutReady();
    expect(ix.isReady()).toBe(true);
  });

  it("an earlier resolved still gives isReady() after layout ready", async () => {
    const s = setup({ "a.md": "A" }, { cached: false });
    const ix = s.hub.add(meta());
    s.resolved();
    await s.layoutReady();
    expect(ix.isReady()).toBe(true);
  });

  it("waits for the first resolved when a file has no cache", async () => {
    const s = setup({ "a.md": "A" }, { cached: false });
    const ix = s.hub.add(meta());
    await s.layoutReady();
    expect(ix.isReady()).toBe(false);
    s.resolved();
    await settle();
    expect(ix.isReady()).toBe(true);
  });

  it("falls back to a build after 5 s", async () => {
    const s = setup({ "a.md": "A" }, { cached: false });
    const ix = s.hub.add(meta());
    await s.layoutReady();
    await s.timers.advance(4900);
    expect(ix.isReady()).toBe(false);
    await s.timers.advance(200);
    expect(ix.isReady()).toBe(true);
    s.resolved();
    await settle();
  });

  it("builds a spec added mid-session without waiting when cached", async () => {
    const s = setup({ "a.md": "A" }, { layout: true });
    const ix = s.hub.add(meta());
    await settle();
    expect(ix.isReady()).toBe(true);
  });
});

describe("settingsChanged", () => {
  it("ten calls in a burst give one build", async () => {
    const s = setup({ "a.md": "A" }, { layout: true });
    let key = "1";
    let builds = 0;
    s.hub.add(spec("t", { settingsKey: () => key, compute: (_f, t) => { builds++; return t ?? undefined; } }));
    await settle();
    builds = 0;
    key = "2";
    for (let i = 0; i < 10; i++) s.hub.settingsChanged();
    await s.timers.advance(499);
    expect(builds).toBe(0);
    await s.timers.advance(2);
    expect(builds).toBe(1);
  });

  it("rebuilds only specs whose key changed", async () => {
    const s = setup({ "a.md": "A" }, { layout: true });
    let k1 = "a";
    let b1 = 0;
    let b2 = 0;
    s.hub.add(spec("one", { settingsKey: () => k1, compute: (_f, t) => { b1++; return t ?? undefined; } }));
    s.hub.add(spec("two", { settingsKey: () => "same", compute: (_f, t) => { b2++; return t ?? undefined; } }));
    s.hub.add(spec("three", { compute: (_f, t) => t ?? undefined }));
    await settle();
    b1 = b2 = 0;
    k1 = "b";
    s.hub.settingsChanged();
    await s.timers.advance(600);
    expect([b1, b2]).toEqual([1, 0]);
    s.hub.settingsChanged();
    await s.timers.advance(600);
    expect([b1, b2]).toEqual([1, 0]);
  });

  it("rebuild(name) rebuilds one index", async () => {
    const s = setup({ "a.md": "A" }, { layout: true });
    let b1 = 0;
    let b2 = 0;
    s.hub.add(spec("one", { compute: (_f, t) => { b1++; return t ?? undefined; } }));
    s.hub.add(spec("two", { compute: (_f, t) => { b2++; return t ?? undefined; } }));
    await settle();
    b1 = b2 = 0;
    s.hub.rebuild("one");
    await settle();
    expect([b1, b2]).toEqual([1, 0]);
    s.hub.rebuild();
    await settle();
    expect([b1, b2]).toEqual([2, 1]);
  });
});

describe("unload", () => {
  it("stops everything", async () => {
    const s = setup({ "a.md": "A" }, { layout: true });
    const ix = s.hub.add(spec("t"));
    await settle();
    let n = 0;
    s.hub.follow({ moved: () => n++ });
    s.hub.unload();
    s.vault.rename("a.md", "b.md");
    expect(n).toBe(0);
    expect(ix.get("b.md")).toBeUndefined();
  });
});

describe("errors", () => {
  it("a throwing follower does not stop the others", async () => {
    const s = setup({ "a.md": "A" }, { layout: true });
    let n = 0;
    s.hub.follow({ moved: () => { throw new Error("x"); } });
    s.hub.follow({ moved: () => n++ });
    s.vault.rename("a.md", "b.md");
    expect(n).toBe(1);
    expect(s.errors).toHaveLength(1);
  });
});
