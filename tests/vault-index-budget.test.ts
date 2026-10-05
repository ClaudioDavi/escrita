import { describe, expect, it } from "vitest";
import { IndexHub, type HubEvents } from "../src/core/index-hub";
import { BUDGET_MS, VaultIndex, yieldBudget, type IndexSpec } from "../src/core/vault-index";
import { ManualTimers, MemoryVault, settle, type MemFile } from "./support/memory-vault";

type Spec = IndexSpec<MemFile, string>;

function files(n: number): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < n; i++) o[`n${i}.md`] = `T${i}`;
  return o;
}

/** a spec whose compute costs `cost` ms of the fake clock */
function costly(timers: ManualTimers, cost: number, over: Partial<Spec> = {}): Spec {
  return {
    name: "t",
    mode: "content",
    include: (f) => f.extension === "md",
    compute: (_f, text) => { timers.clock += cost; return text ?? undefined; },
    same: (a, b) => a === b,
    ...over,
  };
}

function counted(timers: ManualTimers): { yields: () => number } {
  let n = 0;
  const inner = timers.yieldNow.bind(timers);
  timers.yieldNow = () => { n++; return inner(); };
  return { yields: () => n };
}

describe("yieldBudget", () => {
  it("resolves at once inside the slice and yields once it is spent", async () => {
    const timers = new ManualTimers();
    const c = counted(timers);
    const check = yieldBudget(timers);
    await check();
    timers.clock += BUDGET_MS - 1;
    await check();
    expect(c.yields()).toBe(0);
    timers.clock += 1;
    await check();
    expect(c.yields()).toBe(1);
    await check(); // a new slice started after the yield
    expect(c.yields()).toBe(1);
  });

  it("uses the given budget", async () => {
    const timers = new ManualTimers();
    const c = counted(timers);
    const check = yieldBudget(timers, 20);
    timers.clock += 19;
    await check();
    expect(c.yields()).toBe(0);
    timers.clock += 1;
    await check();
    expect(c.yields()).toBe(1);
  });
});

describe("budgeted builds", () => {
  it("yields by time, not by batch", async () => {
    const vault = new MemoryVault(files(100));
    const timers = new ManualTimers();
    const c = counted(timers);
    const ix = new VaultIndex(costly(timers, 1), vault, timers, { batch: 40 });
    await ix.build();
    expect(ix.size).toBe(100);
    expect(c.yields()).toBe(Math.floor(100 / BUDGET_MS)); // one per 8 files at 1 ms each
  });

  it("never yields when the work is cheap", async () => {
    const vault = new MemoryVault(files(100));
    const timers = new ManualTimers();
    const c = counted(timers);
    const ix = new VaultIndex(costly(timers, 0), vault, timers, { batch: 40 });
    await ix.build();
    expect(c.yields()).toBe(0);
  });

  it("checkpoints after every file when each costs a full slice", async () => {
    const vault = new MemoryVault(files(10));
    const timers = new ManualTimers();
    const c = counted(timers);
    const ix = new VaultIndex(costly(timers, BUDGET_MS), vault, timers, { batch: 40 });
    await ix.build();
    expect(c.yields()).toBe(10);
  });

  it("keeps reads parallel within a batch", async () => {
    const vault = new MemoryVault(files(5));
    vault.manualReads = true;
    const timers = new ManualTimers();
    const ix = new VaultIndex(costly(timers, 0), vault, timers, { batch: 5 });
    const p = ix.build();
    await settle();
    expect(vault.pendingReads).toHaveLength(5);
    vault.resolveAllReads();
    await p;
    expect(ix.size).toBe(5);
  });

  it("a file touched while its batch is being computed keeps its live value", async () => {
    const vault = new MemoryVault(files(3));
    const timers = new ManualTimers();
    const ix = new VaultIndex(costly(timers, 0), vault, timers, { batch: 40 });
    let first = true;
    const inner = timers.yieldNow.bind(timers);
    timers.clock = 0;
    timers.yieldNow = () => inner();
    const p = ix.build();
    // delete n2 while the build is mid-way (after its read, before its compute)
    await Promise.resolve();
    if (first) { first = false; ix.deleted("n2.md"); vault.delete("n2.md"); }
    await p;
    expect(ix.get("n2.md")).toBeUndefined();
  });

  it("a flush computes one file at a time and still emits per batch", async () => {
    const vault = new MemoryVault(files(10));
    const timers = new ManualTimers();
    const c = counted(timers);
    const ix = new VaultIndex(costly(timers, 0), vault, timers, { batch: 40 });
    await ix.build();
    const seen: number[] = [];
    ix.onChange((ch) => seen.push(ch.length));
    for (let i = 0; i < 10; i++) {
      vault.modify(`n${i}.md`, `U${i}`);
      ix.modified(vault.file(`n${i}.md`)!);
    }
    await timers.advance(300);
    expect(seen).toEqual([10]);
    expect(ix.get("n3.md")).toBe("U3");
    expect(c.yields()).toBe(0);
  });

  it("a flush yields on the budget too", async () => {
    const vault = new MemoryVault(files(20));
    const timers = new ManualTimers();
    const c = counted(timers);
    const ix = new VaultIndex(costly(timers, 4), vault, timers, { batch: 40 });
    await ix.build();
    const before = c.yields();
    for (let i = 0; i < 20; i++) {
      vault.modify(`n${i}.md`, `U${i}`);
      ix.modified(vault.file(`n${i}.md`)!);
    }
    await timers.advance(300);
    await settle(40); // each yield is a real macrotask
    expect(c.yields() - before).toBe(10); // 20 files x 4 ms, a yield per 2 files
    expect(ix.get("n19.md")).toBe("U19");
  });

  it("a dispose during a yield stops the build", async () => {
    const vault = new MemoryVault(files(20));
    const timers = new ManualTimers();
    const ix = new VaultIndex(costly(timers, BUDGET_MS), vault, timers, { batch: 40 });
    const p = ix.build();
    await settle(1);
    ix.dispose();
    await p;
    expect(ix.isReady()).toBe(false);
  });
});

describe("settleMs", () => {
  it("a spec's own settle replaces the shared one", async () => {
    const vault = new MemoryVault(files(1));
    const timers = new ManualTimers();
    const ix = new VaultIndex(costly(timers, 0, { settleMs: 3000 }), vault, timers, { settleMs: 300 });
    await ix.build();
    vault.modify("n0.md", "U");
    ix.modified(vault.file("n0.md")!);
    await timers.advance(2999);
    expect(ix.get("n0.md")).toBe("T0");
    await timers.advance(1);
    expect(ix.get("n0.md")).toBe("U");
  });

  it("defaults to the hub's, then to 300 ms", async () => {
    const vault = new MemoryVault(files(1));
    const timers = new ManualTimers();
    const ix = new VaultIndex(costly(timers, 0), vault, timers);
    await ix.build();
    vault.modify("n0.md", "U");
    ix.modified(vault.file("n0.md")!);
    await timers.advance(299);
    expect(ix.get("n0.md")).toBe("T0");
    await timers.advance(1);
    expect(ix.get("n0.md")).toBe("U");
  });
});

function hubSetup(initial: Record<string, string>, layout: boolean) {
  const vault = new MemoryVault(initial);
  const timers = new ManualTimers();
  const state = { layout, cached: true };
  const cbs = { layout: [] as (() => void)[], modify: [] as ((f: MemFile) => void)[], meta: [] as ((f: MemFile) => void)[], resolved: [] as (() => void)[] };
  const noop = () => {};
  const events: HubEvents<MemFile> = {
    onCreate: noop, onDelete: noop, onRename: noop,
    onModify: (cb) => void cbs.modify.push(cb),
    onMetaChanged: (cb) => void cbs.meta.push(cb),
    onResolved: (cb) => void cbs.resolved.push(cb),
    onLayoutReady: (cb) => void cbs.layout.push(cb),
    layoutReady: () => state.layout,
    hasCache: () => state.cached,
  };
  const hub = new IndexHub<MemFile>(events, vault, timers, { snapshotsRoot: () => "Escrita/Snapshots" });
  const ready = async () => { state.layout = true; cbs.layout.forEach((c) => c()); await settle(); };
  return { vault, timers, hub, cbs, state, ready };
}

describe("start: demand", () => {
  it("does not build at layout ready, builds on the first demand()", async () => {
    const s = hubSetup(files(3), false);
    const ix = s.hub.add(costly(s.timers, 0, { start: "demand" }));
    await s.ready();
    expect(ix.isReady()).toBe(false);
    expect(s.vault.readCount).toBe(0);
    ix.demand();
    await settle();
    expect(ix.isReady()).toBe(true);
    expect(ix.size).toBe(3);
  });

  it("demand() again does nothing", async () => {
    const s = hubSetup(files(3), true);
    const ix = s.hub.add(costly(s.timers, 0, { start: "demand" }));
    ix.demand();
    await settle();
    ix.demand();
    ix.demand();
    await settle();
    expect(s.vault.readCount).toBe(3);
  });

  it("a demand before layout ready waits for it", async () => {
    const s = hubSetup(files(2), false);
    const ix = s.hub.add(costly(s.timers, 0, { start: "demand" }));
    ix.demand();
    await settle();
    expect(s.vault.readCount).toBe(0);
    await s.ready();
    expect(ix.isReady()).toBe(true);
  });

  it("gets no events, rebuilds nothing and ignores `resolved` until demanded", async () => {
    const s = hubSetup(files(2), true);
    let key = "a";
    const ix = s.hub.add(costly(s.timers, 0, { start: "demand", settingsKey: () => key }));
    s.cbs.modify.forEach((c) => c(s.vault.file("n0.md")!));
    s.cbs.resolved.forEach((c) => c());
    key = "b";
    s.hub.settingsChanged();
    s.hub.rebuild();
    await s.timers.advance(10000);
    expect(s.vault.readCount).toBe(0);
    expect(ix.isReady()).toBe(false);
    ix.demand();
    await settle();
    expect(ix.size).toBe(2);
    // after the build it is an ordinary index
    s.vault.modify("n0.md", "U");
    s.cbs.modify.forEach((c) => c(s.vault.file("n0.md")!));
    await s.timers.advance(300);
    expect(ix.get("n0.md")).toBe("U");
  });

  it("a ready-start index is unaffected by demand()", async () => {
    const s = hubSetup(files(2), true);
    const ix = s.hub.add(costly(s.timers, 0));
    ix.demand();
    await settle();
    expect(s.vault.readCount).toBe(2);
  });

  it("a removed demand index ignores demand()", async () => {
    const s = hubSetup(files(2), true);
    const ix = s.hub.add(costly(s.timers, 0, { start: "demand" }));
    s.hub.remove(ix);
    ix.demand();
    await settle();
    expect(s.vault.readCount).toBe(0);
  });

  it("a bare VaultIndex ignores demand()", () => {
    const vault = new MemoryVault(files(1));
    const timers = new ManualTimers();
    const ix = new VaultIndex(costly(timers, 0, { start: "demand" }), vault, timers);
    ix.demand();
    expect(ix.isReady()).toBe(false);
  });
});
