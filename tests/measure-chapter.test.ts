import { describe, expect, it } from "vitest";
import { effectivePiece, readChapterDefault, type ChapterDefault, type Piece } from "../src/core/measure";

const props = { chapterTargetProperty: "chapterTarget", unitProperty: "unit" };
const def = (target = 2000, unit: ChapterDefault["unit"] = null): ChapterDefault => ({ target, unit });

describe("readChapterDefault", () => {
  it("reads target and unit", () => {
    expect(readChapterDefault({ chapterTarget: "2.500", unit: "characters" }, props)).toEqual({ target: 2500, unit: "characters" });
  });
  it("has a null unit when the book note sets none", () => {
    expect(readChapterDefault({ chapterTarget: 2000 }, props)).toEqual({ target: 2000, unit: null });
  });
  it("gives nothing for a bad or zero amount", () => {
    expect(readChapterDefault({ chapterTarget: 0 }, props)).toBeNull();
    expect(readChapterDefault({ chapterTarget: "lots" }, props)).toBeNull();
    expect(readChapterDefault({ unit: "characters" }, props)).toBeNull();
  });
  it("handles no frontmatter", () => {
    expect(readChapterDefault(null, props)).toBeNull();
    expect(readChapterDefault(undefined, props)).toBeNull();
  });
});

describe("effectivePiece", () => {
  it("own target wins", () => {
    const own: Piece = { unit: "words", target: 500 };
    expect(effectivePiece(own, def(), "words")).toEqual({ piece: { unit: "words", target: 500 }, source: "own" });
  });
  it("the default fills a missing target", () => {
    expect(effectivePiece(null, def(), null)).toEqual({ piece: { unit: "words", target: 2000 }, source: "book" });
  });
  it("keeps own limit and deadline with a default target", () => {
    const own: Piece = { unit: "words", limit: 3000, deadline: "2026-12-01" };
    expect(effectivePiece(own, def(), null)).toEqual({
      piece: { unit: "words", target: 2000, limit: 3000, deadline: "2026-12-01" },
      source: "book",
    });
  });
  it("unit: own, then book, then words", () => {
    expect(effectivePiece(null, def(2000, "characters"), "words").piece?.unit).toBe("words");
    expect(effectivePiece(null, def(2000, "characters"), null).piece?.unit).toBe("characters");
    expect(effectivePiece(null, def(2000, null), null).piece?.unit).toBe("words");
  });
  it("a deadline-only chapter in a characters book counts in characters", () => {
    const own: Piece = { unit: "words", deadline: "2026-12-01" };
    const r = effectivePiece(own, def(2000, "characters"), null);
    expect(r.piece).toEqual({ unit: "characters", target: 2000, deadline: "2026-12-01" });
  });
  it("no default and no own piece gives nothing", () => {
    expect(effectivePiece(null, null, null)).toEqual({ piece: null, source: null });
  });
  it("own piece without a target and no default has no source", () => {
    const own: Piece = { unit: "words", limit: 100 };
    expect(effectivePiece(own, null, null)).toEqual({ piece: { unit: "words", limit: 100 }, source: null });
  });
});
