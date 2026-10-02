import { describe, expect, it } from "vitest";
import {
  bookTarget, cleanLeftOff, findLeftOff, firstUnwrittenBeatOffset, lastEditedChapter,
  makeLeftOff, newestLeftOff, noteSpot, pruneMissing, shouldRecord, spotPosition, type LeftOff,
} from "../src/core/left-off";
import { renameKeys } from "../src/core/path-keys";

const PROSE = "The first paragraph is long enough to be unique in this note.\n\nThe second paragraph also has its own words.\n\nThe third one ends it.";

const rec = (offset: number, at: number): LeftOff => ({ offset, before: "b", after: "a", at });

describe("makeLeftOff", () => {
  it("caps the context on both sides", () => {
    const text = "x".repeat(200) + "y".repeat(200);
    const e = makeLeftOff(text, 200, 5);
    expect(e.offset).toBe(200);
    expect(e.before).toBe("x".repeat(48));
    expect(e.after).toBe("y".repeat(48));
    expect(e.at).toBe(5);
    expect(makeLeftOff(text, 200, 5, 10).before).toHaveLength(10);
  });
  it("clamps the offset to the text", () => {
    expect(makeLeftOff("abc", 99, 1).offset).toBe(3);
    expect(makeLeftOff("abc", -4, 1).offset).toBe(0);
  });
  it("works on LF offsets for CRLF text", () => {
    const e = makeLeftOff("one\r\ntwo\r\nthree", 9, 1); // CRLF offset of "t" in three is 10; LF is 8
    expect(e.before).not.toContain("\r");
    expect(e.before + e.after).toBe("one\ntwo\nthree");
  });
});

describe("findLeftOff", () => {
  it("finds the exact spot", () => {
    const e = makeLeftOff(PROSE, 70, 1);
    expect(findLeftOff(PROSE, e)).toBe(70);
  });
  it("finds the spot after an insertion before it", () => {
    const e = makeLeftOff(PROSE, 70, 1);
    const edited = "Inserted line at the top.\n" + PROSE;
    expect(findLeftOff(edited, e)).toBe(70 + "Inserted line at the top.\n".length);
  });
  it("returns null when the context is lost", () => {
    const e = makeLeftOff(PROSE, 70, 1);
    expect(findLeftOff("Completely different text with nothing in common here.", e)).toBeNull();
  });
  it("returns null when the context is ambiguous", () => {
    const text = "alpha beta gamma. alpha beta gamma. alpha beta gamma.";
    const e: LeftOff = { offset: 999, before: "a", after: "b", at: 1 };
    expect(findLeftOff(text, e)).toBeNull();
  });
  it("handles CRLF text, with context spanning a line break", () => {
    const lf = "First line of the scene.\nSecond line of the scene.\nThird.";
    const off = lf.indexOf("\n") + 1;
    const e = makeLeftOff(lf, off, 1);
    expect(e.before).toContain("scene.");
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(findLeftOff(crlf, e)).toBe(off);
  });
});

describe("firstUnwrittenBeatOffset", () => {
  it("lands at the start of the line after the beat", () => {
    const text = "Intro.\n\n%% beat: a %%\n\n%% beat: b %%\nWritten.";
    expect(firstUnwrittenBeatOffset(text)).toBe(text.indexOf("%% beat: a %%") + "%% beat: a %%\n".length);
  });
  it("skips written beats", () => {
    const text = "%% beat: a %%\nProse here.\n\n%% beat: b %%\n";
    expect(firstUnwrittenBeatOffset(text)).toBe(text.length);
  });
  it("lands at the end of the beat line when it is the last line", () => {
    const text = "Prose.\n\n%% beat: z %%";
    expect(firstUnwrittenBeatOffset(text)).toBe(text.length);
  });
  it("ignores beats in frontmatter and code", () => {
    const text = "---\nnote: |\n  %% beat: no %%\n---\n\n```\n%% beat: no %%\n```\n\nProse.";
    expect(firstUnwrittenBeatOffset(text)).toBeNull();
  });
  it("is null with no beats and works on CRLF", () => {
    expect(firstUnwrittenBeatOffset("Just prose.")).toBeNull();
    const lf = "Intro.\n\n%% beat: a %%\n\n---\nNext.";
    expect(firstUnwrittenBeatOffset(lf.replace(/\n/g, "\r\n"))).toBe(lf.indexOf("%% beat: a %%") + "%% beat: a %%\n".length);
  });
});

describe("noteSpot", () => {
  it("prefers the left-off record", () => {
    const e = makeLeftOff(PROSE, 70, 1);
    expect(noteSpot(PROSE, e)).toEqual({ offset: 70, via: "left-off" });
  });
  it("falls to the first unwritten beat when the context is lost", () => {
    const text = "Different text entirely.\n\n%% beat: a %%\n";
    const e = makeLeftOff(PROSE, 70, 1);
    expect(noteSpot(text, e)).toEqual({ offset: text.length, via: "beat" });
  });
  it("falls to the beat with no record", () => {
    const text = "Words.\n\n%% beat: a %%\n\n%% beat: b %%\nProse.";
    expect(noteSpot(text, null).via).toBe("beat");
  });
  it("falls to the end", () => {
    expect(noteSpot("Some prose.", null)).toEqual({ offset: 11, via: "end" });
    expect(noteSpot("Some prose.\r\nMore.", null).offset).toBe("Some prose.\nMore.".length);
  });
});

describe("lastEditedChapter and bookTarget", () => {
  const chapters = ["B/C/1.md", "B/C/2.md", "B/C/3.md"];
  it("picks the chapter with the newest record", () => {
    const r = { "B/C/1.md": rec(1, 10), "B/C/3.md": rec(2, 30), "other.md": rec(3, 99) };
    expect(lastEditedChapter(r, chapters)).toBe("B/C/3.md");
  });
  it("is null with no records among the chapters", () => {
    expect(lastEditedChapter({ "other.md": rec(1, 1) }, chapters)).toBeNull();
  });
  it("record branch", () => {
    const r = { "B/C/2.md": rec(5, 7) };
    expect(bookTarget(chapters, r)).toEqual({ path: "B/C/2.md", spot: r["B/C/2.md"] });
  });
  it("scan branch keeps the chapter order", () => {
    expect(bookTarget(chapters, {})).toEqual({ scan: chapters });
  });
  it("null with no chapters", () => {
    expect(bookTarget([], { x: rec(1, 1) })).toBeNull();
  });
});

describe("shouldRecord", () => {
  const book = (p: string) => (p === "B.md" ? "book" as const : p === "N.md" ? "note" as const : null);
  it("records note works", () => expect(shouldRecord("note", book)).toBe(true));
  it("does not record the book note itself, unstaged or non-works", () => {
    expect(shouldRecord("book", book)).toBe(false);
    expect(shouldRecord("unstaged", book)).toBe(false);
    expect(shouldRecord(null, book)).toBe(false);
  });
  it("records chapters whose book note is a work", () => {
    expect(shouldRecord("chapter", book, "B.md")).toBe(true);
    expect(shouldRecord("chapter", book, "Z.md")).toBe(false);
    expect(shouldRecord("chapter", book)).toBe(false);
  });
});

describe("renames and pruning", () => {
  it("newestLeftOff keeps the newer record", () => {
    expect(newestLeftOff(rec(1, 5), rec(2, 9)).offset).toBe(2);
    expect(newestLeftOff(rec(1, 9), rec(2, 5)).offset).toBe(1);
    expect(newestLeftOff(rec(1, 5), rec(2, 5)).offset).toBe(1);
  });
  it("renameKeys merges a collision with newestLeftOff", () => {
    const r: Record<string, LeftOff> = { "a.md": rec(1, 5), "b.md": rec(2, 9) };
    renameKeys(r, "a.md", "b.md", newestLeftOff);
    expect(r).toEqual({ "b.md": rec(2, 9) });
  });
  it("a folder rename moves the chapter keys", () => {
    const r: Record<string, LeftOff> = { "Old/Cap/1.md": rec(1, 1), "Old/Cap/2.md": rec(2, 2), "X.md": rec(3, 3) };
    renameKeys(r, "Old", "New", newestLeftOff);
    expect(Object.keys(r).sort()).toEqual(["New/Cap/1.md", "New/Cap/2.md", "X.md"]);
  });
  it("pruneMissing drops records of missing files", () => {
    const r: Record<string, LeftOff> = { "a.md": rec(1, 1), "b.md": rec(2, 2) };
    expect(pruneMissing(r, (p) => p === "a.md")).toBe(true);
    expect(Object.keys(r)).toEqual(["a.md"]);
    expect(pruneMissing(r, () => true)).toBe(false);
  });
});

describe("cleanLeftOff", () => {
  it("keeps only well-typed entries", () => {
    const good = { offset: 3, before: "x", after: "y", at: 10 };
    const out = cleanLeftOff({
      "ok.md": good,
      "zero.md": { offset: 0, before: "", after: "", at: 0 },
      "nan.md": { ...good, offset: NaN },
      "neg.md": { ...good, offset: -1 },
      "negat.md": { ...good, at: -2 },
      "inf.md": { ...good, at: Infinity },
      "missing.md": { offset: 1, before: "x", at: 1 },
      "typed.md": { ...good, before: 5 },
      "str.md": "nope",
      "null.md": null,
    });
    expect(Object.keys(out).sort()).toEqual(["ok.md", "zero.md"]);
    expect(out["ok.md"]).toEqual(good);
  });
  it("returns {} for non-objects", () => {
    for (const raw of [undefined, null, 5, "x", []]) expect(cleanLeftOff(raw)).toEqual({});
  });
});

describe("spotPosition", () => {
  it("turns the left-off spot into a line and column", () => {
    const text = "Title\n\nFirst line.\nSorriu. AQUI Willian pegou feno.";
    const e = makeLeftOff(text, text.indexOf(" Willian"), 1);
    expect(spotPosition(text, e)).toEqual({ line: 3, ch: "Sorriu. AQUI".length });
  });
  it("counts lines on CRLF text as the editor does", () => {
    const text = "a\r\nb\r\nc";
    expect(spotPosition(text, null)).toEqual({ line: 2, ch: 1 });
  });
  it("falls back to the end when there is no record", () => {
    expect(spotPosition("one\ntwo", null)).toEqual({ line: 1, ch: 3 });
  });
});
