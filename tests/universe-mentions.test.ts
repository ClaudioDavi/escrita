import { describe, expect, it, vi } from "vitest";
import { segment } from "../src/core/markdown";
import type { Occurrence } from "../src/core/names";

// 1.2 fills the real pickEntry in the same wave; this stand-in follows Q26.
vi.mock("../src/core/names", () => ({
  pickEntry(o: Occurrence, inScope: (id: string) => boolean): string | null {
    let c = o.candidates.filter((x) => inScope(x.id));
    if (c.some((x) => x.exact)) c = c.filter((x) => x.exact);
    if (c.some((x) => x.origin !== "first")) c = c.filter((x) => x.origin !== "first");
    return c.length === 1 ? c[0]!.id : null;
  },
}));

import { appearsIn, computeMentions, mentionsSame, type MentionCtx, type NoteMentions } from "../src/universe/mentions";

const occ = (from: number, to: number, ...ids: string[]): Occurrence => ({
  from,
  to,
  text: "x",
  candidates: ids.map((id) => ({ id, exact: true, origin: "name" as const })),
});
const nm = (occurrences: Occurrence[] = [], links: NoteMentions["links"] = []): NoteMentions => ({ occurrences, links });

function ctx(over: Partial<MentionCtx> = {}): MentionCtx {
  return {
    entry: "Teo.md",
    inScope: () => true,
    candidateInScope: () => true,
    resolve: (p) => (p === "Teo" || p === "Teo.md" || p === "Teo Silva.md" ? "Teo.md" : null),
    workOf: () => null,
    workRank: () => 0,
    ...over,
  };
}

describe("computeMentions", () => {
  it("collects wikilinks and markdown links from prose, skipping embeds, code and comments", () => {
    const text = "A [[Teo|him]] and [b](Teo%20Silva.md#h) ![[Teo]] `[[Teo]]` %% [[Teo]] %% [x](https://a.b)";
    const r = computeMentions(segment(text), () => []);
    expect(r.links.map((l) => l.linkpath)).toEqual(["Teo", "Teo Silva.md"]);
    expect(text.slice(r.links[0]!.from, r.links[0]!.to)).toBe("[[Teo|him]]");
  });

  it("drops occurrences inside a link's span and keeps the rest", () => {
    const text = "Teo saw [[Teo]] today";
    const found = [occ(0, 3, "a"), occ(10, 13, "a")];
    const r = computeMentions(segment(text), () => found);
    expect(r.occurrences.map((o) => o.from)).toEqual([0]);
  });

  it("hands the reader mask to find", () => {
    let seen = "";
    computeMentions(segment("---\nk: v\n---\nTeo [[Teo]]"), (m) => ((seen = m), []));
    expect(seen).not.toContain("k: v");
    expect(seen.length).toBe("---\nk: v\n---\nTeo [[Teo]]".length);
  });
});

describe("appearsIn", () => {
  const e = "Teo.md";
  it("is empty with no notes", () => {
    expect(appearsIn([], ctx())).toEqual({ works: [], other: [], total: 0, workCount: 0 });
  });

  it("groups by work, orders works by rank and chapters by position, and sets first and last", () => {
    const works: Record<string, { work: string; chapter: number | null }> = {
      "B/c2.md": { work: "B", chapter: 2 },
      "B/c1.md": { work: "B", chapter: 1 }, // both unnumbered in the file; position decides
      "A.md": { work: "A", chapter: null },
    };
    const r = appearsIn(
      [
        ["B/c2.md", nm([occ(5, 8, e), occ(1, 3, e)])],
        ["B/c1.md", nm([occ(9, 12, e)])],
        ["A.md", nm([occ(2, 4, e)])],
        ["loose.md", nm([occ(0, 3, e)])],
      ],
      ctx({ workOf: (p) => works[p] ?? null, workRank: (w) => (w === "B" ? 0 : 1) }),
    );
    expect(r.works.map((w) => w.work)).toEqual(["B", "A"]);
    expect(r.works[0]!.notes.map((n) => n.path)).toEqual(["B/c1.md", "B/c2.md"]);
    expect(r.works[0]!.notes[1]!.first).toEqual({ from: 1, to: 3 });
    expect(r.works[0]).toMatchObject({ count: 3, firstChapter: "B/c1.md", lastChapter: "B/c2.md" });
    expect(r.works[1]!.firstChapter).toBeUndefined();
    expect(r.other.map((n) => n.path)).toEqual(["loose.md"]);
    expect(r.total).toBe(5);
    expect(r.workCount).toBe(2);
  });

  it("skips the entry's own note and notes out of scope", () => {
    const r = appearsIn(
      [
        [e, nm([occ(0, 3, e)])],
        ["out.md", nm([occ(0, 3, e)])],
        ["in.md", nm([occ(0, 3, e)])],
      ],
      ctx({ inScope: (p) => p !== "out.md" }),
    );
    expect(r.other.map((n) => n.path)).toEqual(["in.md"]);
  });

  it("counts a link as one mention and adds it to occurrences", () => {
    const r = appearsIn(
      [["n.md", nm([occ(10, 13, e)], [{ from: 0, to: 7, linkpath: "Teo" }, { from: 20, to: 25, linkpath: "Other" }])]],
      ctx(),
    );
    expect(r.other[0]).toEqual({ path: "n.md", count: 2, first: { from: 0, to: 7 } });
  });

  it("counts an ambiguous occurrence nowhere, and respects scope of candidates", () => {
    const r = appearsIn(
      [
        ["amb.md", nm([occ(0, 3, e, "Teo2.md")])],
        ["scoped.md", nm([occ(0, 3, e, "Teo2.md")])],
      ],
      ctx({ candidateInScope: (p, id) => !(p === "scoped.md" && id === "Teo2.md") }),
    );
    expect(r.other.map((n) => n.path)).toEqual(["scoped.md"]);
    expect(r.total).toBe(1);
  });
});

describe("mentionsSame", () => {
  it("compares ranges, candidates and links", () => {
    const a = nm([occ(0, 3, "a")], [{ from: 5, to: 9, linkpath: "x" }]);
    expect(mentionsSame(a, nm([occ(0, 3, "a")], [{ from: 5, to: 9, linkpath: "x" }]))).toBe(true);
    expect(mentionsSame(a, nm([occ(0, 4, "a")], [...a.links]))).toBe(false);
    expect(mentionsSame(a, nm([occ(0, 3, "b")], [...a.links]))).toBe(false);
    expect(mentionsSame(a, nm([...a.occurrences], []))).toBe(false);
    expect(mentionsSame(a, nm([...a.occurrences], [{ from: 5, to: 9, linkpath: "y" }]))).toBe(false);
  });
});
