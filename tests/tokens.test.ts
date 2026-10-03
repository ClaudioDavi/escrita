import { describe, it, expect } from "vitest";
import { findPhrase, tokens } from "../src/core/tokens";

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/’/g, "'");

describe("tokens", () => {
  it("gives absolute offsets", () => {
    const t = tokens("Ela abriu a porta.");
    expect(t.map((x) => [x.from, x.to, x.text])).toEqual([[0, 3, "Ela"], [4, 9, "abriu"], [10, 11, "a"], [12, 17, "porta"]]);
  });

  it("reads a slice with offsets kept", () => {
    const text = "um dois três quatro";
    const t = tokens(text, 3, 12);
    expect(t.map((x) => x.text)).toEqual(["dois", "três"]);
    expect(t[0].from).toBe(3);
  });

  it("keeps apostrophes, hyphens and clitics inside one token", () => {
    expect(tokens("Teo’s").map((x) => x.text)).toEqual(["Teo’s"]);
    expect(tokens("guarda-chuva").map((x) => x.text)).toEqual(["guarda-chuva"]);
    expect(tokens("olhou-me").map((x) => x.text)).toEqual(["olhou-me"]);
  });

  it("keeps decomposed letters inside a token", () => {
    const s = "ninguém".normalize("NFD");
    expect(tokens(s).length).toBe(1);
    expect(tokens(s)[0].to).toBe(s.length);
  });
});

describe("findPhrase", () => {
  it("matches across a line break and double spaces", () => {
    const toks = tokens("Ele disse: de\n  repente  tudo mudou. De repente.");
    expect(findPhrase(toks, ["de", "repente"], norm)).toEqual([{ i: 2, j: 3 }, { i: 6, j: 7 }]);
  });

  it("matches whole tokens only", () => {
    expect(findPhrase(tokens("de repentemente"), ["de", "repente"], norm)).toEqual([]);
    expect(findPhrase(tokens("ade repente"), ["de", "repente"], norm)).toEqual([]);
  });

  it("handles an empty phrase and a phrase longer than the text", () => {
    expect(findPhrase(tokens("a b"), [], norm)).toEqual([]);
    expect(findPhrase(tokens("a"), ["a", "b"], norm)).toEqual([]);
  });

  it("matches a single word and overlapping runs", () => {
    expect(findPhrase(tokens("a a a"), ["a", "a"], norm)).toEqual([{ i: 0, j: 1 }, { i: 1, j: 2 }]);
  });
});
