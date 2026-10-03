import { describe, expect, it } from "vitest";
import { mapMatches, markSpecs } from "../src/lens/marks-model";
import type { Match } from "../src/lens/types";

const m = (rule: Match["rule"], from: number, to: number, extra: Partial<Match> = {}): Match =>
  ({ rule, kind: "base", from, to, text: "x", ...extra });

/** Mapping for an edit replacing [at, at + del) with `ins` characters. */
const edit = (at: number, del: number, ins: number) => (pos: number, assoc: -1 | 1) => {
  if (pos <= at) return pos;
  if (pos >= at + del) return pos - del + ins;
  return assoc < 0 ? at : at + ins;
};

describe("mapMatches", () => {
  it("shifts a match after an insertion before it", () => {
    const [r] = mapMatches([m("adverb", 10, 15)], edit(2, 0, 4));
    expect([r.from, r.to]).toEqual([14, 19]);
  });
  it("leaves a match before the edit alone", () => {
    const [r] = mapMatches([m("adverb", 10, 15)], edit(30, 0, 4));
    expect([r.from, r.to]).toEqual([10, 15]);
  });
  it("drops a match when a deletion covers it", () => {
    expect(mapMatches([m("adverb", 10, 15)], edit(8, 10, 0))).toEqual([]);
  });
  it("shrinks a match when a deletion clips it", () => {
    const [r] = mapMatches([m("long", 10, 30)], edit(20, 5, 0));
    expect([r.from, r.to]).toEqual([10, 25]);
  });
  it("maps and drops the related range of an echo", () => {
    const [a] = mapMatches([m("echo", 20, 25, { related: { from: 5, to: 10 } })], edit(0, 0, 3));
    expect(a.related).toEqual({ from: 8, to: 13 });
    const [b] = mapMatches([m("echo", 20, 25, { related: { from: 5, to: 10 } })], edit(4, 8, 0));
    expect(b.related).toBeUndefined();
    expect([b.from, b.to]).toEqual([12, 17]);
  });
});

describe("markSpecs", () => {
  const list = [
    m("echo", 5, 10, { related: { from: 0, to: 3 } }),
    m("adverb", 20, 25),
    m("gerund", 100, 108),
  ];
  it("gives the current match its extra class", () => {
    const specs = markSpecs(list, list[1], 0, 50);
    expect(specs.find((s) => s.from === 20)?.cls).toBe("escrita-lens-adverb escrita-lens-current");
    expect(specs.find((s) => s.from === 5)?.cls).toBe("escrita-lens-echo");
  });
  it("adds the related mark for an echo, sorted by position", () => {
    const specs = markSpecs(list, null, 0, 50);
    expect(specs.map((s) => s.from)).toEqual([0, 5, 20]);
    expect(specs[0].cls).toBe("escrita-lens-related");
  });
  it("keeps only ranges inside the window", () => {
    expect(markSpecs(list, null, 90, 120).map((s) => s.cls)).toEqual(["escrita-lens-gerund"]);
    expect(markSpecs(list, null, 30, 60)).toEqual([]);
  });
});
