import { describe, expect, it } from "vitest";
import { VaultIndex, type IndexChange, type IndexSpec } from "../src/core/vault-index";
import { ManualTimers, MemoryVault, settle, type MemFile } from "./support/memory-vault";

type Spec = IndexSpec<MemFile, string>;

function contentSpec(over: Partial<Spec> = {}): Spec {
  return {
    name: "t",
    mode: "content",
    include: (f) => f.extension === "md" && !f.path.startsWith("Skip/"),
    compute: (_f, text) => (text && text.trim() ? text : undefined),
    same: (a, b) => a === b,
    ...over,
  };
}

function metaSpec(over: Partial<Spec> = {}): Spec {
  return contentSpec({
    mode: "metadata",
    compute: (f) => (f.text.trim() ? `${f.path.split("/").slice(0, -1).join("/")}|${f.text}` : undefined),
    ...over,
  });
}

function setup(files: Record<string, string>, spec: Spec = contentSpec(), opts = {}) {
  const vault = new MemoryVault(files);
  const timers = new ManualTimers();
  const errors: [string, unknown][] = [];
  const index = new VaultIndex<MemFile, string>(spec, vault, timers, { onError: (p, e) => errors.push([p, e]), ...opts });
  const batches: IndexChange<string>[][] = [];
  index.onChange((c) => batches.push([...c]));
  vault.attach(index);
  return { vault, timers, index, batches, errors };
}

const flat = (b: IndexChange<string>[][]) => b.flat();
const snapshot = (i: VaultIndex<MemFile, string>) => Object.fromEntries([...i.entries()].sort());

describe("build", () => {
  it("indexes included files, in batches, and is ready", async () => {
    const { index, vault } = setup({ "a.md": "A", "b.md": "B", "c.txt": "C", "Skip/d.md": "D", "e.md": "E" }, contentSpec(), { batch: 2 });
    expect(index.isReady()).toBe(false);
    await index.build();
    expect(index.isReady()).toBe(true);
    expect(snapshot(index)).toEqual({ "a.md": "A", "b.md": "B", "e.md": "E" });
    expect(index.size).toBe(3);
    expect(index.paths().sort()).toEqual(["a.md", "b.md", "e.md"]);
    expect(vault.readCount).toBe(3);
  });

  it("emits one build batch with every entry, and fires onReady", async () => {
    const { index, batches } = setup({ "a.md": "A", "b.md": "B" });
    let ready = 0;
    index.onReady(() => ready++);
    await index.build();
    expect(batches).toHaveLength(1);
    expect(batches[0]!.map((c) => [c.path, c.cause, c.after]).sort()).toEqual([["a.md", "build", "A"], ["b.md", "build", "B"]]);
    expect(ready).toBe(1);
  });

  it("is ready even when it finds nothing", async () => {
    const { index, batches } = setup({});
    let ready = 0;
    index.onReady(() => ready++);
    await index.build();
    expect(index.isReady()).toBe(true);
    expect(index.size).toBe(0);
    expect(ready).toBe(1);
    expect(batches).toHaveLength(0);
  });

  it("emits every entry again on a rebuild, and an update for entries that left", async () => {
    let skip = "";
    const { index, batches } = setup({ "a.md": "A", "b.md": "B" }, contentSpec({ include: (f) => f.path !== skip }));
    await index.build();
    batches.length = 0;
    skip = "b.md";
    await index.build();
    const all = flat(batches);
    expect(all.filter((c) => c.cause === "build").map((c) => c.path)).toEqual(["a.md"]);
    expect(all.find((c) => c.path === "b.md")).toMatchObject({ cause: "update", before: "B", after: undefined });
  });

  it("emits build changes even when nothing changed (same() notwithstanding)", async () => {
    const { index, batches } = setup({ "a.md": "A" });
    await index.build();
    await index.build();
    expect(batches).toHaveLength(2);
    expect(batches[1]![0]).toMatchObject({ path: "a.md", cause: "build", before: "A", after: "A" });
  });

  it("a stale build stops: only the newest emits", async () => {
    const { index, vault, batches } = setup({ "a.md": "A", "b.md": "B", "c.md": "C" }, contentSpec(), { batch: 1 });
    let ready = 0;
    index.onReady(() => ready++);
    const first = index.build();
    vault.modify("a.md", "A2");
    const second = index.build();
    await Promise.all([first, second]);
    expect(batches.filter((b) => b.some((c) => c.cause === "build"))).toHaveLength(1);
    expect(ready).toBe(1);
    expect(index.get("a.md")).toBe("A2");
  });

  it("an event during the build wins over what the build read", async () => {
    const { index, vault, timers } = setup({ "a.md": "old", "b.md": "B" });
    vault.manualReads = true;
    const done = index.build();
    await settle();
    vault.modify("a.md", "new"); // debounced; the build's read of "old" must not win
    vault.resolveAllReads();
    await done;
    await timers.advance(300);
    vault.resolveAllReads();
    await settle();
    expect(index.get("a.md")).toBe("new");
    expect(index.get("b.md")).toBe("B");
  });

  it("a delete during the build is not resurrected", async () => {
    const { index, vault } = setup({ "a.md": "A", "b.md": "B" });
    vault.manualReads = true;
    const done = index.build();
    await settle();
    vault.delete("a.md");
    vault.resolveAllReads();
    await done;
    expect(index.paths()).toEqual(["b.md"]);
  });

  it("a rename during the build lands at the new path only", async () => {
    const { index, vault, timers } = setup({ "a.md": "A", "b.md": "B" });
    vault.manualReads = true;
    const done = index.build();
    await settle();
    vault.rename("a.md", "z.md");
    vault.resolveAllReads();
    await done;
    await timers.advance(300);
    vault.resolveAllReads();
    await settle();
    expect(snapshot(index)).toEqual({ "b.md": "B", "z.md": "A" });
  });

  it("reports a read error through onError and goes on", async () => {
    const { index, vault, errors } = setup({ "a.md": "A", "b.md": "B" });
    vault.failReads.add("a.md");
    await index.build();
    expect(snapshot(index)).toEqual({ "b.md": "B" });
    expect(errors.map(([p]) => p)).toEqual(["a.md"]);
  });
});

describe("modify and create (content mode)", () => {
  it("debounces a burst into one read and one batch", async () => {
    const { index, vault, timers, batches } = setup({ "a.md": "A", "b.md": "B" });
    await index.build();
    batches.length = 0;
    vault.readCount = 0;
    vault.modify("a.md", "A1");
    await timers.advance(200);
    vault.modify("a.md", "A2");
    vault.modify("b.md", "B2");
    await timers.advance(200);
    expect(batches).toHaveLength(0); // the second modify restarted the wait
    await timers.advance(100);
    expect(vault.readCount).toBe(2);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.map((c) => [c.path, c.cause, c.before, c.after]).sort()).toEqual([
      ["a.md", "update", "A", "A2"],
      ["b.md", "update", "B", "B2"],
    ]);
  });

  it("creates a file after the debounce", async () => {
    const { index, vault, timers, batches } = setup({});
    await index.build();
    vault.create("n.md", "N");
    expect(index.get("n.md")).toBeUndefined();
    await timers.advance(300);
    expect(index.get("n.md")).toBe("N");
    expect(flat(batches)).toEqual([{ path: "n.md", before: undefined, after: "N", cause: "update" }]);
  });

  it("ignores a create outside include", async () => {
    const { index, vault, timers } = setup({});
    await index.build();
    vault.create("Skip/x.md", "X");
    vault.create("x.txt", "X");
    await timers.advance(300);
    expect(index.size).toBe(0);
  });

  it("same() suppresses a no-op update", async () => {
    const { index, vault, timers, batches } = setup({ "a.md": "A" });
    await index.build();
    batches.length = 0;
    vault.modify("a.md", "A");
    await timers.advance(300);
    expect(batches).toHaveLength(0);
  });

  it("the latest read wins when reads resolve out of order", async () => {
    const { index, vault, timers } = setup({ "a.md": "A" });
    await index.build();
    vault.manualReads = true;
    vault.modify("a.md", "v1");
    await timers.advance(300);
    vault.modify("a.md", "v2");
    await timers.advance(300);
    expect(vault.pendingReads.map((r) => r.text)).toEqual(["v1", "v2"]);
    vault.resolveRead(1);
    await settle();
    vault.resolveRead(0);
    await settle();
    expect(index.get("a.md")).toBe("v2");
  });

  it("a read that resolves after a delete is dropped", async () => {
    const { index, vault, timers } = setup({ "a.md": "A" });
    await index.build();
    vault.manualReads = true;
    vault.modify("a.md", "A2");
    await timers.advance(300);
    vault.delete("a.md");
    vault.resolveAllReads();
    await settle();
    expect(index.size).toBe(0);
  });

  it("a read error keeps the old value", async () => {
    const { index, vault, timers, errors } = setup({ "a.md": "A" });
    await index.build();
    vault.failReads.add("a.md");
    vault.modify("a.md", "A2");
    await timers.advance(300);
    expect(index.get("a.md")).toBe("A");
    expect(errors).toHaveLength(1);
  });
});

describe("leaving scope and compute undefined", () => {
  it("a live file that computes undefined emits update, never delete", async () => {
    const { index, vault, timers, batches } = setup({ "a.md": "A" });
    await index.build();
    batches.length = 0;
    vault.modify("a.md", "  ");
    await timers.advance(300);
    expect(index.get("a.md")).toBeUndefined();
    expect(flat(batches)).toEqual([{ path: "a.md", before: "A", after: undefined, cause: "update" }]);
  });

  it("a file renamed out of scope emits a rename then an update with after undefined", async () => {
    const { index, vault, batches } = setup({ "a.md": "A" });
    await index.build();
    batches.length = 0;
    vault.rename("a.md", "Skip/a.md");
    expect(index.size).toBe(0);
    expect(flat(batches).map((c) => [c.path, c.cause, c.after])).toEqual([
      ["Skip/a.md", "rename", "A"],
      ["Skip/a.md", "update", undefined],
    ]);
  });

  it("a file renamed into scope is picked up", async () => {
    const { index, vault, timers } = setup({ "Skip/a.md": "A" });
    await index.build();
    expect(index.size).toBe(0);
    vault.rename("Skip/a.md", "a.md");
    await timers.advance(300);
    expect(snapshot(index)).toEqual({ "a.md": "A" });
  });
});

describe("rename", () => {
  const files = { "F/1.md": "one", "F/sub/2.md": "two", "G/3.md": "three", "FF.md": "ff" };

  it("moves a file at once, with a rename change", async () => {
    const { index, vault, batches } = setup(files);
    await index.build();
    batches.length = 0;
    vault.rename("G/3.md", "G/4.md");
    expect(index.get("G/4.md")).toBe("three");
    expect(index.get("G/3.md")).toBeUndefined();
    expect(flat(batches)).toEqual([{ path: "G/4.md", from: "G/3.md", before: "three", after: "three", cause: "rename" }]);
  });

  it.each(["folder-only", "folder-then-children"] as const)("a folder rename (%s) gives the same map", async (mode) => {
    const { index, vault, timers } = setup(files);
    await index.build();
    vault.rename("F", "H", mode);
    await timers.advance(300);
    expect(snapshot(index)).toEqual({ "H/1.md": "one", "H/sub/2.md": "two", "G/3.md": "three", "FF.md": "ff" });
  });

  it("a folder rename emits one rename per entry and no duplicates when children follow", async () => {
    const a = setup(files);
    const b = setup(files);
    await a.index.build();
    await b.index.build();
    a.batches.length = 0;
    b.batches.length = 0;
    a.vault.rename("F", "H", "folder-only");
    b.vault.rename("F", "H", "folder-then-children");
    await a.timers.advance(300);
    await b.timers.advance(300);
    const norm = (c: IndexChange<string>[]) => c.map((x) => `${x.cause}:${x.from ?? ""}>${x.path}`).sort();
    expect(norm(flat(a.batches))).toEqual(["rename:F/1.md>H/1.md", "rename:F/sub/2.md>H/sub/2.md"]);
    expect(norm(flat(b.batches))).toEqual(norm(flat(a.batches)));
  });

  it("does not touch a sibling that shares a prefix", async () => {
    const { index, vault } = setup(files);
    await index.build();
    vault.rename("F", "H", "folder-only");
    expect(index.get("FF.md")).toBe("ff");
  });

  it("a folder moved into scope is indexed (folder-only)", async () => {
    const { index, vault, timers } = setup({ "Skip/x/1.md": "one", "Skip/x/2.md": "two" });
    await index.build();
    expect(index.size).toBe(0);
    vault.rename("Skip/x", "x", "folder-only");
    await timers.advance(300);
    expect(snapshot(index)).toEqual({ "x/1.md": "one", "x/2.md": "two" });
  });

  it("a pending read for the old path does not land", async () => {
    const { index, vault, timers } = setup({ "a.md": "A" });
    await index.build();
    vault.manualReads = true;
    vault.modify("a.md", "A2");
    await timers.advance(300);
    vault.rename("a.md", "b.md");
    vault.resolveAllReads(); // the old path's read
    await settle();
    expect(index.get("a.md")).toBeUndefined();
    await timers.advance(300);
    vault.resolveAllReads();
    await settle();
    expect(snapshot(index)).toEqual({ "b.md": "A2" });
  });

  it("recomputes the moved value, so path-dependent values follow", async () => {
    const { index, vault, batches } = setup({ "A/n.md": "x" }, metaSpec());
    await index.build();
    expect(index.get("A/n.md")).toBe("A|x");
    batches.length = 0;
    vault.rename("A/n.md", "B/n.md");
    expect(index.get("B/n.md")).toBe("B|x");
    expect(flat(batches).map((c) => [c.cause, c.after])).toEqual([["rename", "A|x"], ["update", "B|x"]]);
  });
});

describe("delete", () => {
  it("deletes a file at once with a delete change", async () => {
    const { index, vault, batches } = setup({ "a.md": "A", "b.md": "B" });
    await index.build();
    batches.length = 0;
    vault.delete("a.md");
    expect(index.paths()).toEqual(["b.md"]);
    expect(flat(batches)).toEqual([{ path: "a.md", before: "A", after: undefined, cause: "delete" }]);
  });

  it("deletes a folder with everything under it, once even when child events follow", async () => {
    const { index, vault, batches } = setup({ "F/1.md": "1", "F/s/2.md": "2", "FF.md": "x" });
    await index.build();
    batches.length = 0;
    vault.deleteWithChildren("F");
    expect(index.paths()).toEqual(["FF.md"]);
    expect(flat(batches).map((c) => [c.path, c.cause]).sort()).toEqual([["F/1.md", "delete"], ["F/s/2.md", "delete"]]);
  });

  it("deleting a dirty path cancels its recompute", async () => {
    const { index, vault, timers, batches } = setup({ "a.md": "A" });
    await index.build();
    batches.length = 0;
    vault.modify("a.md", "A2");
    vault.delete("a.md");
    vault.readCount = 0;
    await timers.advance(300);
    expect(vault.readCount).toBe(0);
    expect(index.size).toBe(0);
    expect(flat(batches).map((c) => c.cause)).toEqual(["delete"]);
  });

  it("deleting a path that was never indexed emits nothing", async () => {
    const { index, vault, batches } = setup({ "a.md": "A" });
    await index.build();
    batches.length = 0;
    vault.create("n.md", "N");
    vault.delete("n.md");
    expect(batches).toHaveLength(0);
  });

  it("a created-then-deleted file is not indexed", async () => {
    const { index, vault, timers } = setup({});
    await index.build();
    vault.create("n.md", "N");
    vault.delete("n.md");
    await timers.advance(300);
    expect(index.size).toBe(0);
  });
});

describe("metadata mode", () => {
  it("computes synchronously from the file, with null text", async () => {
    let seen: string | null | undefined;
    const { index } = setup({ "a.md": "A" }, metaSpec({ compute: (f, t) => { seen = t; return f.text; } }));
    await index.build();
    expect(seen).toBeNull();
    expect(index.get("a.md")).toBe("A");
  });

  it("follows metadataChanged at once and ignores modify", async () => {
    const { index, vault, batches } = setup({ "a.md": "A" }, metaSpec());
    await index.build();
    batches.length = 0;
    vault.modify("a.md", "B");
    expect(index.get("a.md")).toBe("|A");
    vault.changeMeta("a.md", "B");
    expect(index.get("a.md")).toBe("|B");
    expect(flat(batches)).toEqual([{ path: "a.md", before: "|A", after: "|B", cause: "update" }]);
  });

  it("creates at once", async () => {
    const { index, vault } = setup({}, metaSpec());
    await index.build();
    vault.create("n.md", "N");
    expect(index.get("n.md")).toBe("|N");
  });

  it("same() suppresses an unchanged metadata update", async () => {
    const { index, vault, batches } = setup({ "a.md": "A" }, metaSpec());
    await index.build();
    batches.length = 0;
    vault.changeMeta("a.md");
    expect(batches).toHaveLength(0);
  });

  it("content mode ignores metadataChanged", async () => {
    const { index, vault } = setup({ "a.md": "A" });
    await index.build();
    vault.changeMeta("a.md", "B");
    expect(index.get("a.md")).toBe("A");
  });
});

describe("structural", () => {
  it("recomputes everything after structureChanged, debounced, emitting changed values only", async () => {
    let folderSeen = false;
    const spec = metaSpec({
      structural: true,
      compute: (f) => `${f.path}:${f.path === "F.md" && folderSeen ? "book" : "note"}`,
    });
    const { index, vault, timers, batches } = setup({ "F.md": "x", "other.md": "y" }, spec);
    await index.build();
    expect(index.get("F.md")).toBe("F.md:note");
    batches.length = 0;
    folderSeen = true;
    index.structureChanged();
    index.structureChanged();
    expect(index.get("F.md")).toBe("F.md:note"); // not yet
    await timers.advance(300);
    expect(index.get("F.md")).toBe("F.md:book");
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([{ path: "F.md", before: "F.md:note", after: "F.md:book", cause: "update" }]);
    void vault;
  });

  it("is a no-op for a non-structural spec", async () => {
    const { index, timers, vault } = setup({ "a.md": "A" }, metaSpec());
    await index.build();
    vault.files()[0]!.text = "changed without an event";
    index.structureChanged();
    await timers.advance(300);
    expect(index.get("a.md")).toBe("|A");
  });

  it("drops entries that fell out of scope", async () => {
    let on = true;
    const spec = contentSpec({ structural: true, include: () => on });
    const { index, timers, batches } = setup({ "a.md": "A" }, spec);
    await index.build();
    batches.length = 0;
    on = false;
    index.structureChanged();
    await timers.advance(300);
    expect(index.size).toBe(0);
    expect(flat(batches)).toEqual([{ path: "a.md", before: "A", after: undefined, cause: "update" }]);
  });
});

describe("dispose", () => {
  it("stops reacting, clears the timer and listeners", async () => {
    const { index, vault, timers, batches } = setup({ "a.md": "A" });
    await index.build();
    batches.length = 0;
    vault.modify("a.md", "A2");
    expect(timers.count).toBe(1);
    index.dispose();
    expect(timers.count).toBe(0);
    vault.modify("a.md", "A3");
    vault.create("b.md", "B");
    vault.rename("a.md", "c.md");
    vault.delete("c.md");
    await timers.advance(1000);
    expect(batches).toHaveLength(0);
  });

  it("a build in flight stops", async () => {
    const { index, vault, batches } = setup({ "a.md": "A" });
    vault.manualReads = true;
    const done = index.build();
    await settle();
    index.dispose();
    vault.resolveAllReads();
    await done;
    expect(index.isReady()).toBe(false);
    expect(batches).toHaveLength(0);
  });

  it("unsubscribed listeners are not called", async () => {
    const { index } = setup({ "a.md": "A" });
    let n = 0;
    const off = index.onChange(() => n++);
    const offReady = index.onReady(() => n++);
    off();
    offReady();
    await index.build();
    expect(n).toBe(0);
  });
});

describe("events during the first build", () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("a metadata event that removes the value wins over the build", async () => {
    const { index, vault } = setup({ "a.md": "A", "b.md": "B", "c.md": "C" }, metaSpec(), { batch: 1 });
    const done = index.build();
    await tick();
    vault.changeMeta("a.md", "   ");
    await done;
    expect(index.get("a.md")).toBeUndefined();
    expect(index.get("b.md")).toBe("|B");
  });

  it("a rename out of scope drops the entry", async () => {
    const { index, vault } = setup({ "a.md": "A", "b.md": "B", "c.md": "C" }, metaSpec(), { batch: 1 });
    const done = index.build();
    await tick();
    vault.rename("a.md", "Skip/a.md");
    await done;
    expect(index.get("a.md")).toBeUndefined();
    expect(index.get("Skip/a.md")).toBeUndefined();
    expect(index.paths().sort()).toEqual(["b.md", "c.md"]);
  });
});

describe("compute errors in a content flush", () => {
  it("one file throwing does not lose the others", async () => {
    let boom = false;
    const spec = contentSpec({
      compute: (f, text) => {
        if (boom && f.path === "a.md") throw new Error("x");
        return text && text.trim() ? text : undefined;
      },
    });
    const { index, vault, timers, errors } = setup({ "a.md": "A", "b.md": "B" }, spec);
    await index.build();
    boom = true;
    vault.modify("a.md", "A2");
    vault.modify("b.md", "B2");
    await timers.advance(1000);
    expect(index.get("b.md")).toBe("B2");
    expect(index.get("a.md")).toBe("A");
    expect(errors.map((e) => e[0])).toEqual(["a.md"]);
  });
});
