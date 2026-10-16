import { describe, expect, it } from "vitest";
import { bylineOf, exportDocOf, minHeadingOf, titlePageOf } from "../src/core/export-pipeline";
import { PTBR, SHUNN } from "../src/core/presets";
import type { LastExport } from "../src/data";
import { headingFormat, stateOfLast } from "../src/export/logic";
import { bookSource, contoSource } from "./support/export-fixture";

const O = { placeholderMarker: "XXX" };

describe("titlePageOf", () => {
  it("joins the name and contact lines, trimmed, and rounds the count in the preset's words", () => {
    const doc = exportDocOf(contoSource(18_480), O);
    const tp = titlePageOf({ ...doc, author: { name: " Ana Souza ", surname: "Souza", contact: [" a@b.c ", "  ", "Rua 1"] } }, SHUNN);
    expect(tp.contact).toEqual(["Ana Souza", "a@b.c", "Rua 1"]);
    expect(tp.count).toBe("about 18,500 words");
    expect(tp.byline).toBe("by Ana Souza");
  });
  it("formats the count in the manuscript's language", () => {
    const doc = exportDocOf(contoSource(18_480), O);
    expect(titlePageOf(doc, PTBR).count).toContain("18.500");
  });
  it("leaves the count and byline out for an empty work and a nameless author", () => {
    const doc = exportDocOf(contoSource(0), O);
    const tp = titlePageOf({ ...doc, author: { name: "  ", surname: "", contact: [] } }, SHUNN);
    expect(tp).toEqual({ contact: [], count: "", byline: "" });
  });
});

describe("bylineOf", () => {
  it("fills the template with the trimmed name, or is empty", () => {
    expect(bylineOf(" Ana ", "by {name}")).toBe("by Ana");
    expect(bylineOf(" ", "by {name}")).toBe("");
  });
});

describe("minHeadingOf", () => {
  it("is 3 for a book and 2 for a single note", () => {
    expect(minHeadingOf(exportDocOf(bookSource(SHUNN), O))).toBe(3);
    expect(minHeadingOf(exportDocOf(contoSource(), O))).toBe(2);
  });
});

describe("headingFormat", () => {
  it("prefers the writer's setting, trimmed, else the preset's", () => {
    expect(headingFormat(" Cap. {n} ", "Chapter {n}")).toBe("Cap. {n}");
    expect(headingFormat("  ", "Chapter {n}")).toBe("Chapter {n}");
  });
});

describe("stateOfLast", () => {
  const last = (whole: boolean): LastExport => ({
    format: "epub", preset: "ptbr", whole, chapters: { mode: "range", from: 2, to: 3 }, path: "x.epub", at: "2026-10-01T10:00:00Z",
  } as LastExport);
  it("keeps the last choices in a chapter, and is the whole book from the book note", () => {
    expect(stateOfLast(last(false), true, true)).toEqual({ whole: false, selection: { mode: "range", from: 2, to: 3 }, format: "epub", preset: "ptbr" });
    expect(stateOfLast(last(false), true, false).whole).toBe(true);
  });
  it("is never whole for a single note", () => {
    expect(stateOfLast(last(true), false, false).whole).toBe(false);
  });
});
