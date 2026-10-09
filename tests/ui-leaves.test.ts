import { describe, it, expect } from "vitest";
import { isMarkdownStateFor } from "../src/ui/leaves";
import { undoFreshBeat } from "../src/outline/beats-edit";
import { insertBeat, appendBeat, insertFirstBeat } from "../src/outline/beats-edit";

describe("isMarkdownStateFor", () => {
  it("matches a markdown view of the path", () => {
    expect(isMarkdownStateFor({ type: "markdown", state: { file: "Início.md" } }, "Início.md")).toBe(true);
  });
  it("ignores side panels that keep the last file", () => {
    for (const type of ["outline", "backlink", "outgoing-link", "escrita-outline"]) {
      expect(isMarkdownStateFor({ type, state: { file: "Início.md" } }, "Início.md")).toBe(false);
    }
  });
  it("ignores other files and missing state", () => {
    expect(isMarkdownStateFor({ type: "markdown", state: { file: "B.md" } }, "A.md")).toBe(false);
    expect(isMarkdownStateFor({ type: "markdown" }, "A.md")).toBe(false);
    expect(isMarkdownStateFor(null, "A.md")).toBe(false);
  });
});

describe("undoFreshBeat", () => {
  const B = (s: string) => `%% beat: ${s} %%`;
  it("puts the chapter back as it was, scene breaks included", () => {
    const before = ["", B("a"), "", "Prosa.", ""].join("\n");
    for (const after of [insertBeat(before, 0, ""), appendBeat(before, ""), insertFirstBeat("", "")]) {
      expect(after).not.toBe(before);
    }
    const after = insertBeat(before, 0, "");
    expect(undoFreshBeat(after, { before, after })).toBe(before);
  });
  it("leaves the chapter alone when it changed meanwhile", () => {
    const before = "Prosa.\n", after = appendBeat(before, "");
    expect(undoFreshBeat(after + "Mais.", { before, after })).toBeNull();
  });
});
