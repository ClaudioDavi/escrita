import { describe, expect, it } from "vitest";
import { IndexHub, type HubEvents } from "../src/core/index-hub";
import type { IndexSpec } from "../src/core/vault-index";
import { ManualTimers, MemoryVault, settle, type MemFile } from "./support/memory-vault";

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

function setup(files: Record<string, string>) {
  const vault = new MemoryVault(files);
  const timers = new ManualTimers();
  const cbs = {
    create: [] as ((f: MemFile) => void)[],
    modify: [] as ((f: MemFile) => void)[],
    delete: [] as ((f: MemFile) => void)[],
    rename: [] as ((f: MemFile, old: string) => void)[],
    meta: [] as ((f: MemFile) => void)[],
    resolved: [] as (() => void)[],
  };
  const events: HubEvents<MemFile> = {
    onCreate: (cb) => void cbs.create.push(cb),
    onModify: (cb) => void cbs.modify.push(cb),
    onDelete: (cb) => void cbs.delete.push(cb),
    onRename: (cb) => void cbs.rename.push(cb),
    onMetaChanged: (cb) => void cbs.meta.push(cb),
    onResolved: (cb) => void cbs.resolved.push(cb),
    onLayoutReady: (cb) => cb(),
    layoutReady: () => true,
    hasCache: () => true,
  };
  vault.onEvent((e) => {
    if (e.type === "create") cbs.create.forEach((c) => c(e.file));
    else if (e.type === "modify") cbs.modify.forEach((c) => c(e.file));
    else if (e.type === "meta") cbs.meta.forEach((c) => c(e.file));
    else if (e.type === "delete") cbs.delete.forEach((c) => c({ path: e.path, extension: "", text: "" }));
    else if (e.type === "rename") cbs.rename.forEach((c) => c({ path: e.path, extension: "", text: "" }, e.oldPath));
  });
  const hub = new IndexHub<MemFile>(events, vault, timers, { snapshotsRoot: () => "Escrita/Snapshots" });
  return { vault, timers, hub };
}

describe("IndexHub.remove", () => {
  it("a removed spec stops receiving events", async () => {
    const s = setup({ "a.md": "A" });
    const keep = s.hub.add(spec("keep"));
    const gone = s.hub.add(spec("gone"));
    await settle();
    s.hub.remove(gone);
    s.vault.create("b.md", "B");
    s.vault.modify("a.md", "A2");
    await s.timers.advance(1000);
    expect(keep.get("b.md")).toBe("B");
    expect(keep.get("a.md")).toBe("A2");
    expect(gone.get("b.md")).toBeUndefined();
    expect(gone.get("a.md")).toBeUndefined();
  });

  it("disposes the index: its map is cleared and it is no longer ready", async () => {
    const s = setup({ "a.md": "A" });
    const ix = s.hub.add(spec("t"));
    await settle();
    expect(ix.isReady()).toBe(true);
    s.hub.remove(ix);
    expect(ix.isReady()).toBe(false);
    expect(ix.size).toBe(0);
    expect(ix.get("a.md")).toBeUndefined();
  });

  it("a removed spec gets no settings rebuild", async () => {
    const s = setup({ "a.md": "A" });
    let key = "1";
    let computes = 0;
    const ix = s.hub.add(spec("t", { settingsKey: () => key, compute: (_f, text) => { computes++; return text ?? undefined; } }));
    await settle();
    expect(computes).toBe(1);
    s.hub.remove(ix);
    key = "2";
    s.hub.settingsChanged();
    await s.timers.advance(1000);
    expect(computes).toBe(1);
  });

  it("re-adding a spec with the same name builds it again", async () => {
    const s = setup({ "a.md": "A" });
    const first = s.hub.add(spec("t"));
    await settle();
    s.hub.remove(first);
    const second = s.hub.add(spec("t"));
    await settle();
    expect(second).not.toBe(first);
    expect(second.isReady()).toBe(true);
    expect(second.get("a.md")).toBe("A");
    s.vault.create("b.md", "B");
    await s.timers.advance(1000);
    expect(second.get("b.md")).toBe("B");
    expect(first.get("b.md")).toBeUndefined();
  });

  it("rebuild(name) no longer reaches a removed spec, but reaches its replacement", async () => {
    const s = setup({ "a.md": "A" });
    let computes = 0;
    const counting = () => spec("t", { compute: (_f, text) => { computes++; return text ?? undefined; } });
    const first = s.hub.add(counting());
    await settle();
    s.hub.remove(first);
    s.hub.rebuild("t");
    await settle();
    expect(computes).toBe(1);
    s.hub.add(counting());
    await settle();
    s.hub.rebuild("t");
    await settle();
    expect(computes).toBe(3);
  });

  it("removing during a build stops it", async () => {
    const s = setup({ "a.md": "A", "b.md": "B" });
    s.vault.manualReads = true;
    const ix = s.hub.add(spec("t"));
    await settle();
    expect(s.vault.pendingReads.length).toBeGreaterThan(0);
    s.hub.remove(ix);
    s.vault.resolveAllReads();
    await settle();
    expect(ix.isReady()).toBe(false);
    expect(ix.size).toBe(0);
  });

  it("removing an index twice, or one the hub never had, is harmless", async () => {
    const s = setup({ "a.md": "A" });
    const ix = s.hub.add(spec("t"));
    const other = setup({}).hub.add(spec("x"));
    await settle();
    s.hub.remove(ix);
    s.hub.remove(ix);
    s.hub.remove(other);
    expect(ix.isReady()).toBe(false);
  });

  it("removing inside a change callback does not break the dispatch to the others", async () => {
    const s = setup({ "a.md": "A" });
    const first = s.hub.add(spec("first"));
    const second = s.hub.add(spec("second"));
    await settle();
    first.onChange(() => s.hub.remove(second));
    s.vault.modify("a.md", "A2");
    await s.timers.advance(1000);
    expect(first.get("a.md")).toBe("A2");
    expect(second.isReady()).toBe(false);
  });
});
