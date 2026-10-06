import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { nameRuns, namesMask } from "../src/core/name-runs";
import { sentences } from "../src/core/sentences";
import { tokens } from "../src/core/tokens";

function runs(text: string, lang: "pt" | "en" | null = "pt"): string[] {
  const md = segment(text);
  const mask = namesMask(md);
  return nameRuns(tokens(mask), sentences(mask, md, lang), mask, lang).map((r) => r.text);
}

describe("nameRuns", () => {
  it("joins capitalized words and pt joiners", () => {
    expect(runs("Ele viu Maria das Dores e João da Silva no Rio Pequeno.")).toEqual(["Maria das Dores", "João da Silva", "Rio Pequeno"]);
    expect(runs("He met Maria das Dores.", "en")).toEqual(["Maria"]);
  });
  it("keeps titles in the run, splits on punctuation", () => {
    expect(runs("Ela chamou Dona Zefa.")).toEqual(["Dona Zefa"]);
    expect(runs("Ela viu Sr. Almeida.")).toEqual(["Sr", "Almeida"]);
  });
  it("never joins across a line break", () => {
    expect(runs("Ela viu Rio\nPequeno hoje.")).toEqual(["Rio", "Pequeno"]);
  });
  it("sentence starts: drop a leading stop word, otherwise skip", () => {
    expect(runs("A Joana chegou. Depois Teodoro saiu. Em Lisboa chovia.")).toEqual(["Joana", "Lisboa"]);
    expect(runs("— Vamos, disse Ana.")).toEqual(["Ana"]);
    expect(runs("A Joana chegou.", null)).toEqual([]);
  });
  it("a run is never a lone one-letter word", () => {
    expect(runs("Ele disse que I não sabia.", "en")).toEqual([]);
  });
  it("namesMask blanks headings and frontmatter, keeping offsets", () => {
    const text = "---\na: Zed\n---\n# Titulo Grande\n\nFala Zeca.\n";
    const m = namesMask(segment(text));
    expect(m.length).toBe(text.length);
    expect(m).not.toContain("Grande");
    expect(m).toContain("Zeca");
  });
});
