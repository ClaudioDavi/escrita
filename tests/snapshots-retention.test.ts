import { describe, it, expect } from "vitest";
import { toPrune } from "../src/snapshots/retention";
import type { SnapshotEntry, SnapshotKind } from "../src/snapshots/index-format";

function e(file: string, taken: number, kind: SnapshotKind = "daily"): SnapshotEntry {
  return { file, name: "", kind, taken, day: "2026-09-03", words: 1, notePath: "a.md", hash: "", length: -1 };
}

function autos(n: number, kind: SnapshotKind = "daily"): SnapshotEntry[] {
  return Array.from({ length: n }, (_, i) => e(`f${String(i).padStart(2, "0")}.txt`, 1000 + i, kind));
}

describe("toPrune", () => {
  it("keeps up to keepAuto automatic snapshots", () => {
    expect(toPrune(autos(20), 20)).toEqual([]);
    expect(toPrune(autos(21), 20)).toEqual(["f00.txt"]);
    expect(toPrune(autos(25), 20)).toEqual(["f00.txt", "f01.txt", "f02.txt", "f03.txt", "f04.txt"]);
  });
  it("mixes the automatic kinds", () => {
    const es = [e("p.txt", 1, "publish"), e("r.txt", 2, "restore"), e("d.txt", 3, "daily")];
    expect(toPrune(es, 2)).toEqual(["p.txt"]);
  });
  it("never prunes or counts stage snapshots, even with keepAuto 1", () => {
    const es = [e("s0.txt", 1, "stage"), ...autos(3), e("s1.txt", 5000, "stage")];
    expect(toPrune(es, 1)).toEqual(["f00.txt", "f01.txt"]);
    expect(toPrune([e("s.txt", 1, "stage"), e("t.txt", 2, "stage")], 1)).toEqual([]);
  });
  it("never prunes or counts manual snapshots", () => {
    const es = [e("m0.txt", 1, "manual"), ...autos(21), e("m1.txt", 5000, "manual")];
    expect(toPrune(es, 20)).toEqual(["f00.txt"]);
    expect(toPrune([e("a.txt", 1, "manual"), e("b.txt", 2, "manual")], 1)).toEqual([]);
  });
  it("never prunes `keep`, even when it is the oldest by clock", () => {
    const es = autos(21);
    expect(toPrune(es, 20, "f00.txt")).toEqual(["f01.txt"]);
  });
  it("never prunes any protected file (a snapshot being restored or compared)", () => {
    const es = autos(21);
    expect(toPrune(es, 20, ["f20.txt", "f00.txt", "f01.txt"])).toEqual(["f02.txt"]);
    // every candidate protected: the count stays over for now
    expect(toPrune(autos(2), 1, ["f00.txt", "f01.txt"])).toEqual([]);
  });
  it("keepAuto below 1 (or not a number) counts as 1", () => {
    expect(toPrune(autos(3), 0)).toEqual(["f00.txt", "f01.txt"]);
    expect(toPrune(autos(3), -5)).toEqual(["f00.txt", "f01.txt"]);
    expect(toPrune(autos(3), Number.NaN)).toEqual(["f00.txt", "f01.txt"]);
  });
  it("a tie on time goes by file name", () => {
    const es = [e("b.txt", 1), e("a.txt", 1), e("c.txt", 2)];
    expect(toPrune(es, 1)).toEqual(["a.txt", "b.txt"]);
  });
});
