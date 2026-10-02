import { describe, it, expect } from "vitest";
import { toCommit } from "../src/desk/recorder";

const pend = (...paths: string[]) => new Map(paths.map((p) => [p, 1]));

describe("toCommit", () => {
  it("commits nothing when nothing is pending", () => {
    expect(toCommit(new Map(), "a.md", new Set(["a.md"]), false)).toEqual([]);
    expect(toCommit(new Map(), null, new Set(), true)).toEqual([]);
  });
  it("keeps the active note pending", () => {
    expect(toCommit(pend("a.md"), "a.md", new Set(["a.md"]), false)).toEqual([]);
  });
  it("commits a note that was left but is still open in another tab", () => {
    expect(toCommit(pend("a.md", "b.md"), "b.md", new Set(["a.md", "b.md"]), false)).toEqual(["a.md"]);
  });
  it("commits a note whose tab was closed", () => {
    expect(toCommit(pend("a.md", "b.md"), "b.md", new Set(["b.md"]), false)).toEqual(["a.md"]);
  });
  it("commits everything on quit, hide, idle and unload", () => {
    expect(toCommit(pend("a.md", "b.md"), "a.md", new Set(["a.md", "b.md"]), true)).toEqual(["a.md", "b.md"]);
  });
  it("commits all pending when no note is active", () => {
    expect(toCommit(pend("a.md", "b.md"), null, new Set(), false)).toEqual(["a.md", "b.md"]);
  });
  it("keeps the pending order", () => {
    expect(toCommit(pend("z.md", "a.md", "m.md"), "a.md", new Set(["a.md"]), false)).toEqual(["z.md", "m.md"]);
  });
});

import { markDirty, buildRecord, buildSavedRecord, newestPending, makeReader } from "../src/desk/recorder";

describe("markDirty", () => {
  it("does no full-text work: it never reads the text", () => {
    const pending = new Map();
    let reads = 0;
    const read = () => { reads++; return "text"; };
    for (let i = 0; i < 100; i++) markDirty(pending, "a.md", i, read, 1000 + i);
    expect(reads).toBe(0);
    expect(pending.get("a.md").offset).toBe(99);
    expect(pending.size).toBe(1);
  });
});

describe("buildRecord", () => {
  it("reads the text once and builds the context", () => {
    let reads = 0;
    const rec = buildRecord({ offset: 6, at: 5, read: () => { reads++; return "hello world"; } });
    expect(reads).toBe(1);
    expect(rec).toMatchObject({ offset: 6, before: "hello ", after: "world", at: 5 });
  });
  it("returns null when the text cannot be read", () => {
    expect(buildRecord({ offset: 1, at: 1, read: () => { throw new Error("gone"); } })).toBeNull();
  });
});

describe("newestPending", () => {
  it("keeps the newer capture", () => {
    const a = { offset: 1, at: 1, read: () => "" };
    const b = { offset: 2, at: 2, read: () => "" };
    expect(newestPending(a, b)).toBe(b);
    expect(newestPending(b, a)).toBe(b);
  });
});

describe("makeReader", () => {
  it("reads the live editor while the view shows the same file", () => {
    const read = makeReader({ getValue: () => "live text" }, "a", () => "a");
    expect(read()).toBe("live text");
  });
  it("gives null once the tab moved to another file, so the wrong note is never read", () => {
    let current = "a";
    const read = makeReader({ getValue: () => "new note" }, "a", () => current);
    current = "b";
    expect(read()).toBeNull();
    expect(buildRecord({ offset: 1, at: 1, read })).toBeNull();
  });
});

describe("buildSavedRecord", () => {
  it("builds the spot from the saved note when the live text is gone", async () => {
    const d = { offset: 4, at: 1, read: () => null, saved: async () => "old note text here" };
    expect(buildRecord(d)).toBeNull();
    expect((await buildSavedRecord(d))?.before).toContain("old");
  });
  it("gives null without a saved reader or when reading fails", async () => {
    expect(await buildSavedRecord({ offset: 1, at: 1, read: () => null })).toBeNull();
    expect(await buildSavedRecord({ offset: 1, at: 1, read: () => null, saved: async () => { throw new Error("gone"); } })).toBeNull();
  });
});
