import { describe, expect, it } from "vitest";
import { lensLang, stemLang } from "../src/lens/lang";
import { listsPath, parseLists, sameLists, starterNote } from "../src/lens/lists";

describe("parseLists", () => {
  it("reads Portuguese and English headings at any level", () => {
    const l = parseLists("# Vícios\n- de repente\n### Names\n- Ana\n###### Ignore\n- foo\n## Crutches\n- sort of\n");
    expect(l).toEqual({ crutch: ["de repente", "sort of"], names: ["Ana"], ignore: ["foo"] });
    expect(parseLists("## Crutch words\n- a\n## Nomes\n- B\n## Ignorar\n- c")).toEqual({
      crutch: ["a"], names: ["B"], ignore: ["c"],
    });
  });
  it("ignores case and accents in headings", () => {
    expect(parseLists("## vicios\n- x\n## NOMES\n- Y\n## ignorar\n- z").crutch).toEqual(["x"]);
    expect(parseLists("## VÍCIOS\n- x").crutch).toEqual(["x"]);
  });
  it("strips list markers, task boxes and spacing", () => {
    const l = parseLists("## Vícios\n- a b\n* c\n+ d\n1. e\n2) f\n- [ ] g\n- [x] h\n\n   i   j  \n");
    expect(l.crutch).toEqual(["a b", "c", "d", "e", "f", "g", "h", "i j"]);
  });
  it("skips comments, frontmatter and other headings", () => {
    const text = "---\ntitle: x\n---\n- stray\n## Vícios\n- a %% hidden %%\n%% one\ntwo %%\n- b\n## Notas\n- no\n## Nomes\n- Ana\n";
    expect(parseLists(text)).toEqual({ crutch: ["a", "b"], names: ["Ana"], ignore: [] });
  });
  it("keeps duplicates once and normalizes to NFC", () => {
    const l = parseLists("## Nomes\n- João\n- João\n- joão\n");
    expect(l.names).toEqual(["João"]);
  });
  it("is empty for an empty note", () => {
    expect(parseLists("")).toEqual({ crutch: [], names: [], ignore: [] });
  });
});

describe("starterNote", () => {
  it("parses back to its own lists", () => {
    for (const l of ["pt-BR", "en"] as const) {
      const p = parseLists(starterNote(l));
      expect(p.crutch.length).toBe(7);
      expect(p.names).toEqual([]);
      expect(p.ignore).toEqual([]);
    }
    const pt = starterNote("pt-BR");
    expect(pt).toContain("# Listas de palavras\n\nA lente de revisão lê esta nota.");
    expect(pt).toContain("%% palavras que a lente não deve marcar %%");
    expect(starterNote("en")).toContain("# Word lists\n\nThe revision lens reads this note.");
    expect(parseLists(starterNote("pt-BR")).crutch).toContain("começou a");
    expect(parseLists(starterNote("en")).crutch).toContain("all of a sudden");
  });
});

describe("sameLists", () => {
  it("compares in order", () => {
    const a = { crutch: ["a"], names: ["b"], ignore: [] };
    expect(sameLists(a, { crutch: ["a"], names: ["b"], ignore: [] })).toBe(true);
    expect(sameLists(a, { crutch: ["a", "c"], names: ["b"], ignore: [] })).toBe(false);
    expect(sameLists(a, { crutch: ["a"], names: ["x"], ignore: [] })).toBe(false);
  });
});

describe("lensLang", () => {
  it("maps locales in auto", () => {
    for (const l of ["pt", "pt-br", "pt-PT", "pt_BR"]) expect(lensLang("auto", l)).toBe("pt-BR");
    for (const l of ["en", "en-GB"]) expect(lensLang("auto", l)).toBe("en");
    for (const l of ["es", "fr", ""]) expect(lensLang("auto", l)).toBeNull();
  });
  it("lets an explicit setting win", () => {
    expect(lensLang("en", "pt")).toBe("en");
    expect(lensLang("pt-BR", "fr")).toBe("pt-BR");
  });
  it("maps to the stem language", () => {
    expect(stemLang("pt-BR")).toBe("pt");
    expect(stemLang("en")).toBe("en");
  });
});

describe("listsPath", () => {
  it("normalizes", () => {
    expect(listsPath("Modelos/Revisão")).toBe("Modelos/Revisão.md");
    expect(listsPath("/Modelos/Revisão.md")).toBe("Modelos/Revisão.md");
    expect(listsPath("Revisão.MD")).toBe("Revisão.MD");
    expect(listsPath("")).toBe("");
    expect(listsPath("   ")).toBe("");
    expect(listsPath("  A//B/  ")).toBe("A/B.md");
    expect(listsPath("/")).toBe("");
  });
});
