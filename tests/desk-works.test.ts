import { describe, expect, it } from "vitest";
import { buildDesk, factOf, factParts, factText, filterByFolders, type FactLabels, type WorkSource } from "../src/desk/works";

const labels: FactLabels = {
  day: (iso) => `d(${iso})`,
  num: (n) => `n${n}`,
  of: (n, t) => `n${n}/n${t}`,
  ofMax: (n, t) => `n${n}/max n${t}`,
  ofRest: (t) => `/n${t}`,
  ofMaxRest: (t) => `/max n${t}`,
  unitSuffix: (u) => (u === "words" ? "" : u),
  deadline: (d) => `due ${d}`,
  chaptersReady: (d, t) => `${d} of ${t} ch`,
};

function w(over: Partial<WorkSource> & { path: string }): WorkSource {
  return { role: "note", stage: "draft", title: over.path, count: 0, unit: "words", editedAt: 0, ...over };
}

describe("factOf", () => {
  it("count against target, plus deadline", () => {
    const f = factOf(w({ path: "a", count: 4210, target: 5000, deadline: "2026-10-15" }));
    expect(factText(f, labels)).toBe("n4210/n5000 · due d(2026-10-15)");
  });
  it("count alone, no target", () => {
    expect(factText(factOf(w({ path: "a", count: 1020 })), labels)).toBe("n1020");
  });
  it("zero count with nothing to compare shows no fact", () => {
    expect(factOf(w({ path: "a", count: 0 })).kind).toBe("none");
    expect(factText(factOf(w({ path: "a", count: 0 })), labels)).toBe("");
  });
  it("zero count against a target still shows it", () => {
    expect(factText(factOf(w({ path: "a", count: 0, target: 100 })), labels)).toBe("n0/n100");
  });
  it("characters get the unit suffix", () => {
    expect(factText(factOf(w({ path: "a", count: 612, target: 1000, unit: "characters" })), labels)).toBe("n612/n1000 characters");
    expect(factText(factOf(w({ path: "a", count: 320, unit: "characters" })), labels)).toBe("n320 characters");
  });
  it("limit-only piece", () => {
    expect(factText(factOf(w({ path: "a", count: 2840, limit: 3000 })), labels)).toBe("n2840/max n3000");
  });
  it("target wins over limit when both exist and the count is within", () => {
    expect(factText(factOf(w({ path: "a", count: 10, target: 20, limit: 30 })), labels)).toBe("n10/n20");
  });
  it("revision of a note has the same fact as draft (Q21)", () => {
    const a = w({ path: "a", count: 2940, target: 3500, deadline: "2026-09-28" });
    expect(factOf({ ...a, stage: "revision" })).toEqual(factOf(a));
  });
  it("book in draft: words against goal", () => {
    expect(factText(factOf(w({ path: "b", role: "book", count: 18420, goal: 80000, deadline: "2026-11-30" })), labels)).toBe("n18420/n80000 · due d(2026-11-30)");
  });
  it("book in revision: chapters ready", () => {
    const f = factOf(w({ path: "b", role: "book", stage: "revision", count: 50, goal: 100, chapters: { done: 6, total: 9 } }));
    expect(f.kind).toBe("chapters");
    expect(factText(f, labels)).toBe("6 of 9 ch");
  });
  it("book in revision with no chapters shows words (Q22)", () => {
    const f = factOf(w({ path: "b", role: "book", stage: "revision", count: 50, goal: 100, chapters: { done: 0, total: 0 } }));
    expect(factText(f, labels)).toBe("n50/n100");
    expect(factText(factOf(w({ path: "b", role: "book", stage: "revision", count: 50 })), labels)).toBe("n50");
  });
  it("book in draft ignores chapter progress", () => {
    const f = factOf(w({ path: "b", role: "book", count: 5, chapters: { done: 1, total: 2 } }));
    expect(factText(f, labels)).toBe("n5");
  });
  it("unstaged shows the status word", () => {
    const f = factOf(w({ path: "u", role: "unstaged", stage: "none", count: 90, statusWord: "esboço" }));
    expect(f).toEqual({ kind: "status", word: "esboço" });
    expect(factText(f, labels)).toBe("esboço");
    expect(factOf(w({ path: "u", role: "unstaged", stage: "none" })).kind).toBe("none");
  });
});

describe("fact states (Q23)", () => {
  it("target reached is reached, below is not", () => {
    expect(factOf(w({ path: "a", count: 5000, target: 5000 }))).toMatchObject({ state: "reached" });
    expect(factOf(w({ path: "a", count: 5120, target: 5000 }))).toMatchObject({ state: "reached" });
    expect(factOf(w({ path: "a", count: 4999, target: 5000 }))).toMatchObject({ state: null });
  });
  it("book goal reached", () => {
    expect(factOf(w({ path: "b", role: "book", count: 10, goal: 10 }))).toMatchObject({ state: "reached" });
  });
  it("over the limit is over; at the limit is not", () => {
    expect(factOf(w({ path: "a", count: 4380, limit: 4000 }))).toMatchObject({ state: "over" });
    expect(factOf(w({ path: "a", count: 4000, limit: 4000 }))).toMatchObject({ state: null });
  });
  it("over a limit beats a reached target", () => {
    expect(factOf(w({ path: "a", count: 50, target: 20, limit: 40 }))).toMatchObject({ state: "over" });
  });
  it("past deadline needs today; the day itself is not past", () => {
    const a = w({ path: "a", count: 1, target: 9, deadline: "2026-09-28" });
    expect(factOf(a, "2026-10-01")).toMatchObject({ deadlinePast: true });
    expect(factOf(a, "2026-09-28")).toMatchObject({ deadlinePast: false });
    expect(factOf(a, "2026-09-01")).toMatchObject({ deadlinePast: false });
    expect(factOf(a)).toMatchObject({ deadlinePast: false });
  });
  it("factParts colors the number and the deadline separately", () => {
    const f = factOf(w({ path: "a", count: 5120, target: 5000, deadline: "2026-09-28" }), "2026-10-01");
    const parts = factParts(f, labels);
    expect(parts.map((p) => p.text).join("")).toBe(factText(f, labels));
    expect(parts.find((p) => p.text === "n5120/n5000")?.state).toBe("reached");
    expect(parts.find((p) => p.text === "due d(2026-09-28)")?.state).toBe("past");
    expect(parts.filter((p) => p.state).length).toBe(2);
  });
  it("a bad deadline is ignored", () => {
    expect(factText(factOf(w({ path: "a", count: 3, deadline: "soon" })), labels)).toBe("n3");
  });
});

describe("buildDesk", () => {
  it("empty gives empty sections", () => {
    expect(buildDesk([])).toEqual({ writing: [], revising: [], counts: [] });
  });
  it("splits draft and revision, orders by editedAt desc then title", () => {
    const d = buildDesk([
      w({ path: "1", title: "Zeta", editedAt: 5 }),
      w({ path: "2", title: "Alfa", editedAt: 5 }),
      w({ path: "3", title: "Mais novo", editedAt: 9 }),
      w({ path: "4", title: "Velho", editedAt: 1 }),
      w({ path: "5", title: "Rev", stage: "revision" }),
    ]);
    expect(d.writing.map((l) => l.title)).toEqual(["Mais novo", "Alfa", "Zeta", "Velho"]);
    expect(d.revising.map((l) => l.title)).toEqual(["Rev"]);
    expect(d.writing[0].path).toBe("3");
  });
  it("counts idea, ready, published, none in order; zero counts left out", () => {
    const d = buildDesk([
      w({ path: "i1", stage: "idea", title: "B", editedAt: 1 }),
      w({ path: "i2", stage: "idea", title: "A", editedAt: 1 }),
      w({ path: "i3", stage: "idea", title: "C", editedAt: 7 }),
      w({ path: "p1", stage: "published", count: 10 }),
      w({ path: "u1", stage: "none", role: "unstaged", statusWord: "esboço" }),
      w({ path: "d1", stage: "draft" }),
    ]);
    expect(d.counts.map((c) => [c.stage, c.n])).toEqual([["idea", 3], ["published", 1], ["none", 1]]);
    expect(d.counts[0].items.map((l) => l.title)).toEqual(["C", "A", "B"]);
    expect(d.counts[2].items[0].fact).toEqual({ kind: "status", word: "esboço" });
    expect(d.counts[1].items[0].fact.kind).toBe("length");
  });
  it("chapters never appear anywhere", () => {
    const d = buildDesk([w({ path: "c", role: "chapter", stage: "draft" }), w({ path: "c2", role: "chapter", stage: "idea" })]);
    expect(d).toEqual({ writing: [], revising: [], counts: [] });
  });
  it("passes today to the facts", () => {
    const d = buildDesk([w({ path: "a", count: 1, target: 2, deadline: "2026-01-01" })], "2026-10-01");
    expect(d.writing[0].fact).toMatchObject({ deadlinePast: true });
  });
  it("a draft idea with no content has no fact", () => {
    const d = buildDesk([w({ path: "i", stage: "idea" })]);
    expect(d.counts[0].items[0].fact.kind).toBe("none");
  });
});

describe("filterByFolders", () => {
  const items = [
    w({ path: "Contos/A.md" }),
    w({ path: "Textos/B.md" }),
    w({ path: "Romances/A Casa/A Casa.md", role: "book" }),
    w({ path: "Contos2/C.md" }),
  ];
  const bookFolderOf = (p: string) => (p === "Romances/A Casa/A Casa.md" ? "Romances/A Casa" : null);
  it("no folders keeps everything", () => {
    expect(filterByFolders(items, [], bookFolderOf)).toEqual(items);
  });
  it("keeps works under the folder, not look-alike prefixes", () => {
    expect(filterByFolders(items, ["Contos"], bookFolderOf).map((x) => x.path)).toEqual(["Contos/A.md"]);
  });
  it("several folders union", () => {
    expect(filterByFolders(items, ["Contos", "Textos"], bookFolderOf).map((x) => x.path)).toEqual(["Contos/A.md", "Textos/B.md"]);
  });
  it("a book matches by its folder", () => {
    expect(filterByFolders(items, ["Romances/A Casa"], bookFolderOf).map((x) => x.path)).toEqual(["Romances/A Casa/A Casa.md"]);
    expect(filterByFolders(items, ["Romances"], bookFolderOf).map((x) => x.path)).toEqual(["Romances/A Casa/A Casa.md"]);
  });
  it("a folder that matches nothing gives an empty list", () => {
    expect(filterByFolders(items, ["Nada"], bookFolderOf)).toEqual([]);
  });
  it("tolerates slashes in the folder names", () => {
    expect(filterByFolders(items, ["/Contos/"], bookFolderOf).length).toBe(1);
  });
});

describe("factParts over the limit", () => {
  it("colors only the count", () => {
    const parts = factParts(factOf(w({ path: "a", count: 4380, limit: 4000 })), labels);
    expect(parts.slice(0, 2)).toEqual([
      { text: "n4380", state: "over" },
      { text: "/max n4000", state: null },
    ]);
  });
  it("splits a target too when the limit is passed", () => {
    const parts = factParts(factOf(w({ path: "a", count: 4380, target: 4000, limit: 4200 })), labels);
    expect(parts.slice(0, 2)).toEqual([
      { text: "n4380", state: "over" },
      { text: "/n4000", state: null },
    ]);
  });
  it("keeps a reached target as one part", () => {
    const parts = factParts(factOf(w({ path: "a", count: 5120, target: 5000 })), labels);
    expect(parts[0]).toEqual({ text: "n5120/n5000", state: "reached" });
  });
});
