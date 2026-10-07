import { describe, it, expect } from "vitest";
import { classify, classifyKey, type ClassifySettings, type VaultTree } from "../src/core/classify";

// Task 1.1 (IMPROVEMENTS 8): the effective piece, computed once in classify.

interface N { path: string; name: string; extension: string; parent: N | null; children: N[] }

function tree(files: string[], fm: Record<string, Record<string, unknown>>): VaultTree<N, N> {
  const nodes = new Map<string, N>();
  const dir = (path: string): N | null => {
    if (path === "") return null;
    let n = nodes.get(path);
    if (n) return n;
    const i = path.lastIndexOf("/");
    const parent = dir(i < 0 ? "" : path.slice(0, i));
    n = { path, name: path.slice(i + 1), extension: "", parent, children: [] };
    parent?.children.push(n);
    nodes.set(path, n);
    return n;
  };
  const isFile = new Set(files);
  for (const f of files) {
    const i = f.lastIndexOf("/");
    const parent = i < 0 ? null : dir(f.slice(0, i));
    const n: N = { path: f, name: f.slice(i + 1), extension: f.endsWith(".md") ? "md" : "", parent, children: [] };
    parent?.children.push(n);
    nodes.set(f, n);
  }
  return {
    file: (p) => (isFile.has(p) ? nodes.get(p) ?? null : null),
    folder: (p) => (!isFile.has(p) ? nodes.get(p) ?? null : null),
    folders: () => [...nodes.values()].filter((n) => !isFile.has(n.path)),
    frontmatter: (f) => fm[f.path],
    resolve: (l) => (isFile.has(l) ? l : null),
  };
}

const S: ClassifySettings = {
  chaptersFolder: "Chapters", trackFolders: "", excludeFolders: "", chapterTemplate: "",
  targetProperty: "target", limitProperty: "limit", unitProperty: "unit", chapterTargetProperty: "chapterTarget",
  snapshotsFolder: "Escrita/Snapshots",
};
const FILES = ["B.md", "B/Chapters/01.md", "B/Chapters/02.md", "B/Chapters/03.md", "B/Chapters/04.md", "B/Chapters/05.md", "B/Notes.md", "Solto.md", "N.md", "N/Chapters/01.md"];

const at = (path: string, fm: Record<string, Record<string, unknown>>, s: Partial<ClassifySettings> = {}) =>
  classify(tree(FILES, fm), { ...S, ...s }, path);

describe("classify: a chapter's effective piece", () => {
  const book = { chapterTarget: 2000, unit: "characters" };

  it("a chapter with only the book default gets the book piece", () => {
    const p = at("B/Chapters/01.md", { "B.md": book });
    expect(p.piece).toEqual({ unit: "characters", target: 2000 });
    expect(p.pieceSource).toBe("book");
  });

  it("the chapter's own target wins; its own limit and deadline are kept", () => {
    const p = at("B/Chapters/01.md", { "B.md": book, "B/Chapters/01.md": { target: 500, limit: 900, deadline: "2026-12-01" } });
    // the unit is still the book's when the chapter sets none (the rule effectivePiece has always had)
    expect(p.piece).toEqual({ unit: "characters", target: 500, limit: 900, deadline: "2026-12-01" });
    expect(p.pieceSource).toBe("own");
  });

  it("a chapter with a limit only takes the book's target, and keeps its limit", () => {
    const p = at("B/Chapters/01.md", { "B.md": book, "B/Chapters/01.md": { limit: 900 } });
    expect(p.piece).toEqual({ unit: "characters", target: 2000, limit: 900 });
    expect(p.pieceSource).toBe("book");
  });

  it("the chapter's own unit wins over the book's; a blank unit does not", () => {
    expect(at("B/Chapters/01.md", { "B.md": book, "B/Chapters/01.md": { unit: "words" } }).piece?.unit).toBe("words");
    expect(at("B/Chapters/01.md", { "B.md": book, "B/Chapters/01.md": { unit: "  " } }).piece?.unit).toBe("characters");
  });

  it("the book's default without a unit counts in words", () => {
    expect(at("B/Chapters/01.md", { "B.md": { chapterTarget: 700 } }).piece).toEqual({ unit: "words", target: 700 });
  });

  it("no default (none set, invalid, or the property setting blank): the chapter's own piece", () => {
    expect(at("B/Chapters/01.md", { "B.md": {} }).piece).toBeNull();
    expect(at("B/Chapters/01.md", { "B.md": {} }).pieceSource).toBeNull();
    expect(at("B/Chapters/01.md", { "B.md": { chapterTarget: "abc" } }).piece).toBeNull();
    const off = at("B/Chapters/01.md", { "B.md": book }, { chapterTargetProperty: "" });
    expect(off.piece).toBeNull();
    expect(off.pieceSource).toBeNull();
    expect(at("B/Chapters/01.md", { "B.md": book }, { chapterTargetProperty: undefined }).piece).toBeNull();
  });

  it("a unit-only chapter without a default stays a piece with no target and no source", () => {
    const p = at("B/Chapters/01.md", { "B/Chapters/01.md": { limit: 900, unit: "characters" } });
    expect(p.piece).toEqual({ unit: "characters", limit: 900 });
    expect(p.pieceSource).toBeNull();
  });

  it("the default of another book does not reach this chapter", () => {
    expect(at("N/Chapters/01.md", { "B.md": book }).piece).toBeNull();
  });

  it("book defaults reach chapters only: not the book note, a standalone note, or a note in the book", () => {
    const fm = { "B.md": book };
    for (const path of ["B.md", "Solto.md", "B/Notes.md"]) {
      const p = at(path, fm);
      expect(p.piece, path).toBeNull();
      expect(p.pieceSource, path).toBeNull();
    }
  });

  it("a standalone note's own target is source own", () => {
    const p = at("Solto.md", { "Solto.md": { target: 3000 } });
    expect(p.piece?.target).toBe(3000);
    expect(p.pieceSource).toBe("own");
    expect(p.kind).toBe("note");
  });

  it("a book-folder chapter reads the book note live (no cache): the next classify sees a changed default", () => {
    const fm: Record<string, Record<string, unknown>> = { "B.md": { chapterTarget: 1000 } };
    const t = tree(FILES, fm);
    expect(classify(t, S, "B/Chapters/01.md").piece?.target).toBe(1000);
    fm["B.md"].chapterTarget = 1500;
    expect(classify(t, S, "B/Chapters/01.md").piece?.target).toBe(1500);
  });

  it("the chapter-target property is part of the classify key", () => {
    expect(classifyKey(S)).not.toBe(classifyKey({ ...S, chapterTargetProperty: "alvo" }));
  });

  it("the surfaces agree: every reader of a chapter gets one piece from one call", () => {
    const fm = { "B.md": book, "B/Chapters/02.md": { target: 100 } };
    const a = at("B/Chapters/01.md", fm), b = at("B/Chapters/02.md", fm);
    expect([a.pieceSource, b.pieceSource]).toEqual(["book", "own"]);
  });
});
