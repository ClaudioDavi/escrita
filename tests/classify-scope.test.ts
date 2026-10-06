import { describe, expect, it } from "vitest";
import { classify, classifyKey, NO_SCOPE, type ClassifySettings, type Named, type VaultTree } from "../src/core/classify";

const base: ClassifySettings = {
  chaptersFolder: "Chapters", trackFolders: "", excludeFolders: "", chapterTemplate: "", snapshotsFolder: "Escrita/Snapshots",
  targetProperty: "target", limitProperty: "limit", unitProperty: "unit",
};
const uni: ClassifySettings = { ...base, universeMode: "universe", universeNote: "Universo.md", defaultUniverseFolders: "Contos", universeProperty: "universe" };

function tree(paths: string[], fm: Record<string, Record<string, unknown>> = {}): VaultTree<Named, Named> {
  const files = new Map(paths.map((p) => [p, { path: p }]));
  const dirs = new Map<string, Named>();
  for (const p of paths) for (let d = p.slice(0, Math.max(p.lastIndexOf("/"), 0)); d; d = d.includes("/") ? d.slice(0, d.lastIndexOf("/")) : "") dirs.set(d, { path: d });
  return {
    file: (p) => files.get(p) ?? null,
    folder: (p) => dirs.get(p) ?? null,
    folders: () => dirs.values(),
    frontmatter: (f) => fm[f.path],
    // a link resolves by basename, like a vault with unique names
    resolve: (link) => {
      const name = link.toLowerCase();
      for (const p of files.keys()) if (p.replace(/^.*\//, "").replace(/\.md$/i, "").toLowerCase() === name) return p;
      return null;
    },
  };
}

const paths = [
  "Universo.md", "Universo/Personagens/Teo.md", "Contos/Conto A.md", "Solto.md", "Outro/Mundo.md",
  "Novels/Livro.md", "Novels/Livro/Chapters/01.md", "Novels/Livro/Personagens/Ana.md",
  "Novels/Fora.md", "Novels/Fora/Chapters/01.md", "Novels/Sem.md", "Novels/Sem/Chapters/01.md",
];
const fm = {
  "Novels/Livro.md": { universe: "[[Universo]]" },
  "Novels/Fora.md": { universe: "[[Universo]]" },
  "Novels/Fora/Chapters/01.md": { universe: false },
  "Outro/Mundo.md": { universe: "[[Universo|o mundo]]" },
};
const t = tree(paths, fm);
const sc = (p: string, s: ClassifySettings = uni) => classify(t, s, p).scope;
const universe = { kind: "universe", root: "Universo", note: "Universo.md" };

describe("Placement.scope", () => {
  it("is the none scope when the mode is off or missing", () => {
    expect(sc("Universo/Personagens/Teo.md", base)).toBe(NO_SCOPE);
    expect(sc("Novels/Livro.md", { ...uni, universeMode: "off" })).toBe(NO_SCOPE);
  });

  it("a note with the universe property joins that universe", () => {
    expect(sc("Outro/Mundo.md")).toMatchObject(universe);
  });

  it("entries join by folder, contos by default folder", () => {
    expect(sc("Universo/Personagens/Teo.md")).toMatchObject(universe);
    expect(sc("Universo.md")).toMatchObject(universe);
    expect(sc("Contos/Conto A.md")).toMatchObject(universe);
  });

  it("a book's files follow the book note's property", () => {
    for (const p of ["Novels/Livro.md", "Novels/Livro/Chapters/01.md", "Novels/Livro/Personagens/Ana.md"]) expect(sc(p)).toMatchObject(universe);
  });

  it("a book without a universe is per-book; a chapter's own false keeps it in its book", () => {
    expect(sc("Novels/Sem/Chapters/01.md")).toEqual({ kind: "book", root: "Novels/Sem", note: "Novels/Sem.md" });
    expect(sc("Novels/Fora/Chapters/01.md")).toEqual({ kind: "book", root: "Novels/Fora", note: "Novels/Fora.md" });
    expect(sc("Novels/Fora.md")).toMatchObject(universe);
  });

  it("a standalone note outside every universe has no scope", () => {
    expect(sc("Solto.md")).toMatchObject({ kind: "none" });
  });

  it("perBook mode gives the book, or none", () => {
    const pb = { ...uni, universeMode: "perBook" as const };
    expect(sc("Novels/Livro/Chapters/01.md", pb)).toEqual({ kind: "book", root: "Novels/Livro", note: "Novels/Livro.md" });
    expect(sc("Contos/Conto A.md", pb).kind).toBe("none");
  });

  it("folders carry a scope too", () => {
    expect(sc("Novels/Livro")).toMatchObject(universe);
    expect(sc("Novels/Livro/Chapters")).toMatchObject(universe);
    expect(sc("Novels/Sem")).toMatchObject({ kind: "book", root: "Novels/Sem" });
    expect(sc("Universo/Personagens")).toMatchObject(universe);
  });

  it("a missing path and plugin folders have no scope", () => {
    expect(sc("Nope.md")).toBe(NO_SCOPE);
    expect(sc("Escrita/Snapshots/x.md")).toBe(NO_SCOPE);
  });

  it("reads the property named in the settings", () => {
    const t2 = tree(["Universo.md", "A.md"], { "A.md": { mundo: "[[Universo]]" } });
    expect(classify(t2, { ...uni, universeProperty: "mundo" }, "A.md").scope).toMatchObject(universe);
    expect(classify(t2, uni, "A.md").scope.kind).toBe("none");
  });

  it("a throwing resolve reads as no scope, never throws", () => {
    const bad: VaultTree<Named, Named> = { ...t, resolve: () => { throw new Error("x"); } };
    expect(() => classify(bad, uni, "Outro/Mundo.md")).not.toThrow();
  });
});

describe("classifyKey and the scope keys", () => {
  it("changes with each of the four keys", () => {
    const k = classifyKey(uni);
    expect(classifyKey({ ...uni, universeMode: "perBook" })).not.toBe(k);
    expect(classifyKey({ ...uni, universeNote: "Outro.md" })).not.toBe(k);
    expect(classifyKey({ ...uni, defaultUniverseFolders: "X" })).not.toBe(k);
    expect(classifyKey({ ...uni, universeProperty: "mundo" })).not.toBe(k);
    expect(classifyKey({ ...uni })).toBe(k);
  });
});
