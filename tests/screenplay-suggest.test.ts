// What the screenplay editor suggests (1.2, SP 2, PLAN-1.2 Q11): the three triggers and their
// candidates, in pt-BR.

import { describe, expect, it } from "vitest";
import { parseFountain, type FountainOptions } from "../src/core/fountain";
import { segment } from "../src/core/markdown";
import { compileTerms } from "../src/core/names";
import { candidates, cueNames, triggerAt, type SuggestContext, type SuggestTrigger } from "../src/core/screenplay-suggest";

const PT: FountainOptions = { sceneHeadings: ["INT", "EXT", "INT./EXT", "I/E"], transitions: ["TO:", "PARA:"] };
const script = (text: string) => parseFountain(text, segment(text), PT);

function at(line: string, over: Partial<SuggestContext> = {}, column = line.length) {
  return triggerAt({ line, column, kind: "action", blankAbove: true, sceneHeadings: PT.sceneHeadings, ...over });
}

const SCRIPT = [
  "INT. COZINHA - NOITE", "", "JOÃO", "Oi.", "", "MARIA", "Oi.", "", "JOÃO", "Tchau.", "",
  "EXT. QUINTAL - DIA", "", "INT. COZINHA - DIA", "", "INT./EXT. CARRO", "", ".SALA ESCURA - NOITE", "", "MARIA", "Ei.",
].join("\n");

describe("triggerAt, a cue", () => {
  it("fires on capitals at the end of a line after a blank one", () => {
    expect(at("JO")).toEqual({ kind: "cue", start: 0, query: "JO" });
    expect(at("  mar".toUpperCase(), { kind: null })).toEqual({ kind: "cue", start: 2, query: "MAR" });
    expect(at("JOÃO", { kind: "character" })).toEqual({ kind: "cue", start: 0, query: "JOÃO" });
  });
  it("takes a forced cue in any case, after the @", () => {
    expect(at("@jo")).toEqual({ kind: "cue", start: 1, query: "jo" });
  });
  it("does not fire on lowercase, an empty line, the middle of a line, or an extension", () => {
    expect(at("Jo")).toBeNull();
    expect(at("")).toBeNull();
    expect(at("@")).toBeNull();
    expect(at("JOÃO", {}, 2)).toBeNull();
    expect(at("JOÃO (V")).toBeNull();
  });
  it("does not fire inside a speech or below a line of action", () => {
    expect(at("OI", { kind: "dialogue" })).toBeNull();
    expect(at("(RINDO", { kind: "parenthetical" })).toBeNull();
    expect(at("JO", { blankAbove: false })).toBeNull();
    expect(at("CORTA PARA:", { kind: "transition" })).toBeNull();
  });
  it("leaves a scene heading being typed to the location trigger", () => {
    expect(at("INT")?.kind).toBe("cue");
    expect(at("INT. ")?.kind).toBe("location");
  });
});

describe("triggerAt, a location and a time", () => {
  it("a location starts after the prefix", () => {
    expect(at("INT. ")).toEqual({ kind: "location", start: 5, query: "" });
    expect(at("int. coz")).toEqual({ kind: "location", start: 5, query: "coz" });
    expect(at("EXT. QUINTAL", { kind: "scene" })).toEqual({ kind: "location", start: 5, query: "QUINTAL" });
    expect(at("INT./EXT. CA", { kind: "scene" })).toEqual({ kind: "location", start: 10, query: "CA" });
    expect(at("I/E ")).toEqual({ kind: "location", start: 4, query: "" });
  });
  it("needs a space after the prefix and a blank line above", () => {
    expect(at("INT.")?.kind).not.toBe("location");
    expect(at("INT. COZ", { blankAbove: false })).toBeNull();
  });
  it("a time starts after ' - '", () => {
    expect(at("INT. COZINHA - ", { kind: "scene" })).toEqual({ kind: "time", start: 15, query: "" });
    expect(at("INT. COZINHA - NO", { kind: "scene" })).toEqual({ kind: "time", start: 15, query: "NO" });
    expect(at("INT. A - B - NO", { kind: "scene" })).toEqual({ kind: "time", start: 13, query: "NO" });
  });
  it("a forced heading takes a time too, but no location", () => {
    expect(at(".SALA - ", { kind: "scene" })).toEqual({ kind: "time", start: 8, query: "" });
    expect(at(".SALA", { kind: "scene" })).toBeNull();
  });
  it("only looks at the text before the cursor", () => {
    expect(at("INT. COZINHA - NOITE", { kind: "scene" }, 8)).toEqual({ kind: "location", start: 5, query: "COZ" });
  });
  it("follows the settings' prefixes", () => {
    expect(at("CENA ", { sceneHeadings: ["CENA"] })).toEqual({ kind: "location", start: 5, query: "" });
    expect(at("INT. ", { sceneHeadings: ["CENA"] })?.kind).not.toBe("location");
  });
});

const trig = (kind: SuggestTrigger["kind"], query: string): SuggestTrigger => ({ kind, start: 0, query });
const TIMES = ["DIA", "NOITE", "CONTÍNUO", "MAIS TARDE"];

describe("candidates", () => {
  it("cues: the script's own by use, then the names, in capitals", () => {
    const s = script(SCRIPT);
    expect(candidates(trig("cue", ""), s, ["Zeca", "joão", "Ana"], [])).toEqual(["JOÃO", "MARIA", "ZECA", "ANA"]);
    expect(candidates(trig("cue", "M"), s, ["Marta"], [])).toEqual(["MARIA", "MARTA"]);
  });
  it("matches ignoring case and accents, and never offers the query itself", () => {
    const s = script(SCRIPT);
    expect(candidates(trig("cue", "JOA"), s, [], [])).toEqual(["JOÃO"]);
    expect(candidates(trig("cue", "joão"), s, [], [])).toEqual(["JOÃO"]);
    expect(candidates(trig("cue", "JOÃO"), s, [], [])).toEqual([]);
    expect(candidates(trig("cue", "X"), s, [], [])).toEqual([]);
  });
  it("cues: a cue's extension is not part of the name", () => {
    const s = script("MARIA (V.O.)\nOi.");
    expect(candidates(trig("cue", "MA"), s, [], [])).toEqual(["MARIA"]);
  });
  it("locations: after the prefix, before ' - ', by use", () => {
    const s = script(SCRIPT);
    expect(candidates(trig("location", ""), s, [], [])).toEqual(["COZINHA", "QUINTAL", "CARRO", "SALA ESCURA"]);
    expect(candidates(trig("location", "co"), s, [], [])).toEqual(["COZINHA"]);
    expect(candidates(trig("location", "COZINHA"), s, [], [])).toEqual([]);
  });
  it("locations: cut exactly with the settings' prefixes", () => {
    const s = script("INT. / EXT. CARRO - DIA", );
    const o: FountainOptions = { sceneHeadings: ["INT. / EXT"], transitions: [] };
    const s2 = parseFountain("INT. / EXT. CARRO - DIA", segment("INT. / EXT. CARRO - DIA"), o);
    expect(candidates(trig("location", ""), s2, [], [], o.sceneHeadings)).toEqual(["CARRO"]);
    expect(s.elements[0].type).toBe("scene");
  });
  it("times: the setting's words, by prefix, in the setting's order", () => {
    const s = script(SCRIPT);
    expect(candidates(trig("time", ""), s, [], TIMES)).toEqual(TIMES);
    expect(candidates(trig("time", "c"), s, [], TIMES)).toEqual(["CONTÍNUO"]);
    expect(candidates(trig("time", "CONTINUO"), s, [], TIMES)).toEqual(["CONTÍNUO"]);
    expect(candidates(trig("time", "NOITE"), s, [], TIMES)).toEqual([]);
  });
  it("is empty for an empty script", () => {
    const s = script("");
    expect(candidates(trig("cue", ""), s, [], [])).toEqual([]);
    expect(candidates(trig("location", ""), s, [], [])).toEqual([]);
  });
});

describe("cueNames", () => {
  it("offers characters by their own name, never places, objects, aliases or first names", () => {
    const base = { aliases: [], firstName: true, caseSensitive: false, ignore: [] };
    const table = compileTerms([
      { id: "p/Maria Souza.md", name: "Maria Souza", person: true, ...base, aliases: ["Mariazinha"] },
      { id: "p/Casa Velha.md", name: "Casa Velha", person: false, ...base },
    ], { lang: "pt", extraTitles: [] });
    expect(cueNames(table)).toEqual(["Maria Souza"]);
  });
});
