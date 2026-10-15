import { describe, it, expect } from "vitest";
import { baseName, cleanFolder, isUnder, joinPath, noMd, noteName, parentOf, withMd } from "../src/core/paths";

describe("core/paths", () => {
  it("parentOf: the folder, '' at the root", () => {
    expect(parentOf("a/b/c.md")).toBe("a/b");
    expect(parentOf("c.md")).toBe("");
    expect(parentOf("")).toBe("");
    expect(parentOf("a/")).toBe("a");
  });

  it("baseName and noteName", () => {
    expect(baseName("a/b/c.md")).toBe("c.md");
    expect(baseName("c")).toBe("c");
    expect(noteName("a/O porão.md")).toBe("O porão");
    expect(noteName("a/Upper.MD")).toBe("Upper");
    expect(noteName("a/img.png")).toBe("img.png");
  });

  it("withMd and noMd match .md without case", () => {
    expect(withMd("a/b")).toBe("a/b.md");
    expect(withMd("a/b.md")).toBe("a/b.md");
    expect(withMd("a/b.MD")).toBe("a/b.MD");
    expect(noMd("a/b.Md")).toBe("a/b");
    expect(noMd("a/b.mdx")).toBe("a/b.mdx");
    expect(noMd("a.md/b")).toBe("a.md/b");
  });

  it("cleanFolder trims spaces and edge slashes only", () => {
    expect(cleanFolder(" /Contos/ ")).toBe("Contos");
    expect(cleanFolder("//a/b//")).toBe("a/b");
    expect(cleanFolder("")).toBe("");
    expect(cleanFolder("/")).toBe("");
    expect(cleanFolder("a//b")).toBe("a//b");
    expect(cleanFolder("a\\b")).toBe("a\\b");
  });

  it("joinPath is the export's join", () => {
    expect(joinPath("", "x.md")).toBe("x.md");
    expect(joinPath("/Export/", "x.md")).toBe("Export/x.md");
    expect(joinPath("a\\b", "x.md")).toBe("a/b/x.md");
    expect(joinPath("a//b", "x.md")).toBe("a/b/x.md");
  });

  it("isUnder: the folder itself or inside it, case-sensitive", () => {
    expect(isUnder("a", "a")).toBe(true);
    expect(isUnder("a/b.md", "a")).toBe(true);
    expect(isUnder("a/b.md", "/a/")).toBe(true);
    expect(isUnder("ab/c.md", "a")).toBe(false);
    expect(isUnder("A/b.md", "a")).toBe(false);
  });

  it("isUnder: an empty folder answers emptyMatches", () => {
    expect(isUnder("a.md", "")).toBe(false);
    expect(isUnder("a.md", "", { emptyMatches: true })).toBe(true);
    expect(isUnder("a.md", "/", { emptyMatches: true })).toBe(true);
  });
});
