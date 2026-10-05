import { describe, expect, it } from "vitest";
import { manuscriptOf } from "../src/core/manuscript";

const md = (s: string) => manuscriptOf(s, { placeholderMarker: "XXX" });
const lines = (s: string) => md(s).blocks.map((b) => b.line);

describe("a block's line in the file (Q16)", () => {
  it("is the 0-based line the block starts on", () => {
    expect(lines("um\n\ndois\ndois b\n\n# H\n\n---\n\ntres")).toEqual([0, 2, 5, 7, 9]);
  });
  it("counts the frontmatter", () => {
    expect(lines("---\na: 1\n---\n\num\n\ndois")).toEqual([4, 6]);
  });
  it("skips comments that span lines and lines a comment emptied", () => {
    expect(lines("um\n\n%% a\nb\nc %%\n\ndois\n%% x %%\n\ntres")).toEqual([0, 6, 9]);
  });
  it("follows code fences and quotes", () => {
    expect(lines("```\ncodigo\n```\n\n> citacao\n\nfim")).toEqual([0, 4, 6]);
  });
  it("handles CRLF", () => {
    expect(lines("a\r\n\r\nb\r\n\r\nc")).toEqual([0, 2, 4]);
  });
  it("is invisible to equality and spreads", () => {
    const b = md("x").blocks[0];
    expect(b.line).toBe(0);
    expect(b).toEqual({ kind: "paragraph", runs: [{ text: "x" }] });
    expect({ ...b }.line).toBeUndefined();
  });
});
