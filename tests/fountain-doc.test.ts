// fountainDocLines / fountainDoc (1.2, PLAN-1.2 Q3): cached per document version and options object.

import { describe, expect, it } from "vitest";
import { fountainDoc, fountainDocLines } from "../src/core/fountain-doc";
import type { FountainOptions } from "../src/core/fountain";

const opts = (): FountainOptions => ({ sceneHeadings: ["INT", "EXT"], transitions: ["TO:"] });
// a stand-in for a CodeMirror Text: an immutable object with toString()
const docOf = (text: string) => ({ toString: () => text });
const TEXT = "INT. ROOM - DAY\n\nHe waits.\n\nANA\nHello.\n";

describe("fountainDocLines", () => {
  it("returns the same array for the same document and options", () => {
    const doc = docOf(TEXT), o = opts();
    expect(fountainDocLines(doc, o)).toBe(fountainDocLines(doc, o));
  });
  it("recomputes for a new options object", () => {
    const doc = docOf(TEXT);
    const a = fountainDocLines(doc, opts());
    const b = fountainDocLines(doc, opts());
    expect(b).not.toBe(a);
    expect(b).toEqual(a);
  });
  it("reads a different document afresh", () => {
    const o = opts();
    expect(fountainDocLines(docOf(TEXT), o)).not.toBe(fountainDocLines(docOf(TEXT), o));
    expect(fountainDocLines(docOf(TEXT), o)[0]).toBe("scene");
  });
});

describe("fountainDoc", () => {
  it("returns the same script for the same document and options", () => {
    const doc = docOf(TEXT), o = opts();
    expect(fountainDoc(doc, o)).toBe(fountainDoc(doc, o));
  });
  it("recomputes for a new options object", () => {
    const doc = docOf(TEXT);
    const a = fountainDoc(doc, opts());
    const b = fountainDoc(doc, opts());
    expect(b).not.toBe(a);
    expect(b).toEqual(a);
  });
  it("keeps lines and script cached side by side", () => {
    const doc = docOf(TEXT), o = opts();
    const lines = fountainDocLines(doc, o), script = fountainDoc(doc, o);
    expect(fountainDocLines(doc, o)).toBe(lines);
    expect(fountainDoc(doc, o)).toBe(script);
  });
});
