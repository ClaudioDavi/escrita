import { describe, expect, it } from "vitest";
import {
  cleanDevices, cleanHistory, cleanRenames, maxBase, maxHistory, mergeHistories, unionRenames, type Rename,
} from "../src/core/device-history";
import type { History } from "../src/goals/tracker";
import { applyDelta, recordBookTotal } from "../src/goals/tracker";

const D = "2026-10-01";
const h = (added: number, deleted: number, books: Record<string, { added: number; deleted: number; total: number; at?: number }> = {}): History => ({
  [D]: { added, deleted, books },
});

describe("mergeHistories", () => {
  it("sums days and books over base and devices", () => {
    const base = h(10, 1, { "A.md": { added: 10, deleted: 1, total: 100, at: 1 } });
    const devs = {
      x: h(5, 2, { "A.md": { added: 5, deleted: 2, total: 110, at: 2 } }),
      y: h(7, 0, { "B.md": { added: 7, deleted: 0, total: 50, at: 3 } }),
    };
    const m = mergeHistories(base, devs, []);
    expect(m[D].added).toBe(22);
    expect(m[D].deleted).toBe(3);
    expect(m[D].books["A.md"]).toEqual({ added: 15, deleted: 3, total: 110, at: 2 });
    expect(m[D].books["B.md"].added).toBe(7);
  });

  it("takes the total from the latest at", () => {
    const x = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 500, at: 9 } });
    const y = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 300, at: 5 } });
    expect(mergeHistories({}, { x, y }, [])[D].books["A.md"].total).toBe(500);
    expect(mergeHistories({}, { y, x }, [])[D].books["A.md"].total).toBe(500);
  });

  it("treats a record without at as oldest", () => {
    const legacy = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 900 } });
    const fresh = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 40, at: 1 } });
    expect(mergeHistories(legacy, { f: fresh }, [])[D].books["A.md"].total).toBe(40);
    const m = mergeHistories(legacy, {}, []);
    expect(m[D].books["A.md"]).toEqual({ added: 1, deleted: 0, total: 900 });
  });

  it("does not mutate inputs", () => {
    const base = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 5, at: 1 } });
    const devs = { x: h(2, 0, { "A.md": { added: 2, deleted: 0, total: 6, at: 2 } }) };
    const snap = JSON.stringify([base, devs]);
    const r: Rename[] = [{ from: "A.md", to: "C.md", at: 3 }];
    mergeHistories(base, devs, r);
    expect(JSON.stringify([base, devs])).toBe(snap);
  });

  it("applies a file rename to every section", () => {
    const base = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 5, at: 1 } });
    const devs = { x: h(2, 0, { "A.md": { added: 2, deleted: 0, total: 8, at: 2 } }), y: h(4, 0, { "C.md": { added: 4, deleted: 0, total: 9, at: 3 } }) };
    const m = mergeHistories(base, devs, [{ from: "A.md", to: "C.md", at: 10 }]);
    expect(Object.keys(m[D].books)).toEqual(["C.md"]);
    expect(m[D].books["C.md"]).toEqual({ added: 7, deleted: 0, total: 9, at: 3 });
  });

  it("applies a folder rename to keys under it", () => {
    const base = h(3, 0, { "Old/B.md": { added: 3, deleted: 0, total: 5, at: 1 }, "Older.md": { added: 1, deleted: 0, total: 1, at: 1 } });
    const m = mergeHistories(base, {}, [{ from: "Old", to: "New", at: 1 }]);
    expect(Object.keys(m[D].books).sort()).toEqual(["New/B.md", "Older.md"]);
  });

  it("applies renames in at order, whatever the list order", () => {
    const base = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 5, at: 1 } });
    const list: Rename[] = [{ from: "B.md", to: "C.md", at: 2 }, { from: "A.md", to: "B.md", at: 1 }];
    expect(Object.keys(mergeHistories(base, {}, list)[D].books)).toEqual(["C.md"]);
  });

  it("survives malformed sections", () => {
    const bad = { [D]: null, x: 5, y: { added: "z", books: { "A.md": 3 } } } as unknown as History;
    const m = mergeHistories(bad, { d: null as unknown as History }, []);
    expect(m.y).toEqual({ added: 0, deleted: 0, books: {} });
  });
});

describe("maxHistory", () => {
  const a = h(10, 1, { "A.md": { added: 10, deleted: 1, total: 100, at: 5 } });
  const b = h(7, 4, { "A.md": { added: 12, deleted: 0, total: 80, at: 9 }, "B.md": { added: 1, deleted: 1, total: 1 } });

  it("takes the larger per field and the newer total", () => {
    const m = maxHistory(a, b);
    expect(m[D].added).toBe(10);
    expect(m[D].deleted).toBe(4);
    expect(m[D].books["A.md"]).toEqual({ added: 12, deleted: 1, total: 80, at: 9 });
    expect(m[D].books["B.md"].total).toBe(1);
  });

  it("is idempotent and commutative", () => {
    expect(maxHistory(a, a)).toEqual(a);
    expect(maxHistory(maxHistory(a, b), b)).toEqual(maxHistory(a, b));
    expect(maxHistory(a, b)).toEqual(maxHistory(b, a));
  });

  it("is commutative on an at tie and without at", () => {
    const p = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 3, at: 4 } });
    const q = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 8, at: 4 } });
    expect(maxHistory(p, q)).toEqual(maxHistory(q, p));
    const r = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 3 } });
    const s = h(1, 0, { "A.md": { added: 1, deleted: 0, total: 8 } });
    expect(maxHistory(r, s)).toEqual(maxHistory(s, r));
  });

  it("never mutates inputs", () => {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    maxHistory(a, b);
    expect(JSON.stringify(a)).toBe(sa);
    expect(JSON.stringify(b)).toBe(sb);
  });
});

describe("unionRenames", () => {
  const now = 1_000_000_000_000;
  const day = 24 * 60 * 60 * 1000;
  it("dedupes and sorts", () => {
    const r1 = { from: "A", to: "B", at: now - 5 };
    const r2 = { from: "B", to: "C", at: now - 2 };
    expect(unionRenames([r2, r1], [r1], now)).toEqual([r1, r2]);
  });
  it("drops entries older than 400 days", () => {
    const old = { from: "A", to: "B", at: now - 401 * day };
    const keep = { from: "C", to: "D", at: now - 399 * day };
    expect(unionRenames([old], [keep], now)).toEqual([keep]);
  });
});

describe("cleaners", () => {
  it("cleanHistory fixes numbers and drops junk, skipping __proto__", () => {
    const raw = JSON.parse('{"__proto__":{"added":9},"d1":{"added":-3,"deleted":"x","books":{"A.md":{"added":2,"total":"q","at":7},"B.md":4}},"d2":[],"d3":{"added":4}}');
    const c = cleanHistory(raw);
    expect(Object.keys(c).sort()).toEqual(["d1", "d3"]);
    expect(c.d1).toEqual({ added: 0, deleted: 0, books: { "A.md": { added: 2, deleted: 0, total: 0, at: 7 } } });
    expect(c.d3.books).toEqual({});
    expect(({} as Record<string, unknown>).added).toBeUndefined();
  });
  it("cleanDevices skips non-records and __proto__", () => {
    const c = cleanDevices(JSON.parse('{"__proto__":{"x":{}},"a":{"d":{"added":1}},"b":5,"c":null}'));
    expect(Object.keys(c)).toEqual(["a"]);
    expect(cleanDevices("no")).toEqual({});
  });
  it("cleanRenames keeps only well-formed entries", () => {
    const c = cleanRenames([{ from: "A", to: "B", at: 1 }, { from: "A", to: 2, at: 1 }, { from: "", to: "B", at: 1 }, { from: "A", to: "B", at: "1" }, null, 4]);
    expect(c).toEqual([{ from: "A", to: "B", at: 1 }]);
    expect(cleanRenames({})).toEqual([]);
  });
});

describe("tracker sets at", () => {
  it("applyDelta and recordBookTotal use the injected now", () => {
    const hist: History = {};
    applyDelta(hist, D, 5, { path: "A.md", total: 9 }, () => 111);
    expect(hist[D].books["A.md"].at).toBe(111);
    recordBookTotal(hist, D, { path: "A.md", total: 12 }, () => 222);
    expect(hist[D].books["A.md"]).toMatchObject({ total: 12, at: 222, added: 5 });
    applyDelta(hist, D, 1);
    expect(hist[D].books["A.md"].at).toBe(222);
  });
});

describe("maxBase (the base a 1.2.2 device still writes)", () => {
  const old = h(100, 0, { "Old.md": { added: 100, deleted: 0, total: 100, at: 5 } });
  const moved = h(100, 0, { "New.md": { added: 100, deleted: 0, total: 100, at: 5 } });

  it("takes the disk's keys when the totals match and the keys differ (a 1.2.2 rename)", () => {
    expect(Object.keys(maxBase(old, moved)[D].books)).toEqual(["New.md"]);
  });

  it("keeps a book a stale file lacks (same totals, fewer keys)", () => {
    const both = h(100, 0, { "Old.md": { added: 100, deleted: 0, total: 100, at: 5 }, "Pasted.md": { added: 0, deleted: 0, total: 40, at: 6 } });
    expect(Object.keys(maxBase(both, old)[D].books).sort()).toEqual(["Old.md", "Pasted.md"]);
  });

  it("merges as maxHistory when the totals differ", () => {
    const more = h(150, 0, { "New.md": { added: 150, deleted: 0, total: 150, at: 9 } });
    expect(maxBase(old, more)).toEqual(maxHistory(old, more));
  });

  it("is maxHistory when the keys are the same, is idempotent and never mutates", () => {
    const before = structuredClone(old);
    expect(maxBase(old, old)).toEqual(old);
    expect(maxBase(old, moved)).toEqual(maxBase(maxBase(old, moved), moved));
    expect(old).toEqual(before);
  });
});
