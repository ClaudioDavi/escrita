import { describe, expect, it } from "vitest";
import { fountainOptions } from "../src/core/fountain";
import { segment } from "../src/core/markdown";
import { compileTerms, findNames, type NameSource } from "../src/core/names";
import { computeMentions, type CueSource } from "../src/universe/mentions";
import { DEFAULT_SETTINGS } from "../src/settings";

const joao: NameSource = { id: "João.md", name: "João", aliases: ["Joãozinho"], person: true, firstName: true, caseSensitive: false, ignore: [] };
const table = compileTerms([joao], { lang: "pt", extraTitles: [] });
const find = (mask: string) => findNames(mask, table);
const options = fountainOptions(DEFAULT_SETTINGS);
const cues = (form: CueSource["form"]): CueSource => ({ form, options });

const SCRIPT = "INT. COZINHA - DIA\n\nJOÃO entra.\n\nJOÃO\nOlá.\n\nJOÃO (V.O.)\nTchau.\n\nMARIA\nOi.\n";

describe("cues as mentions (PLAN-1.1 Q8)", () => {
  it("counts a cue, with or without an extension, as an occurrence of the entry", () => {
    const r = computeMentions(segment(SCRIPT), find, cues("screenplay"));
    const at = r.occurrences.map((o) => SCRIPT.slice(o.from, o.to));
    expect(at).toEqual(["JOÃO", "JOÃO", "JOÃO"]);   // the action line, the cue, the cue with (V.O.)
    expect(r.occurrences.every((o) => o.candidates[0]?.id === "João.md")).toBe(true);
    expect(r.occurrences.map((o) => o.from)).toEqual([...r.occurrences.map((o) => o.from)].sort((a, b) => a - b));
  });

  it("does not count a cue twice when the prose matcher already found it", () => {
    const r = computeMentions(segment(SCRIPT), find, cues("screenplay"));
    const prose = computeMentions(segment(SCRIPT), find);
    expect(r.occurrences.length).toBe(prose.occurrences.length);
  });

  it("adds a cue the prose matcher missed, at the cue's place in the note", () => {
    // a matcher that sees only what is on its own line start: it misses the cue in the mask
    const blind = (mask: string) => (mask === "JOÃO" ? find(mask) : []);
    const text = "JOÃO (V.O.)\nTchau.\n";
    const r = computeMentions(segment(text), blind, cues("screenplay"));
    expect(r.occurrences).toHaveLength(1);
    expect(text.slice(r.occurrences[0].from, r.occurrences[0].to)).toBe("JOÃO");
    expect(r.occurrences[0].from).toBe(0);
  });

  it("reads a cue whose name is an alias, and ignores a cue that names no entry", () => {
    const text = "JOÃOZINHO\nOi.\n\nMARIA\nOi.\n";
    const blind = (mask: string) => (mask === "JOÃOZINHO" ? find(mask) : []);
    const r = computeMentions(segment(text), blind, cues("screenplay"));
    expect(r.occurrences).toHaveLength(1);
    expect(r.occurrences[0].candidates[0].id).toBe("João.md");
  });

  it("in a prose note, only the existing matcher counts", () => {
    const blind = (mask: string) => (mask === "JOÃO" ? find(mask) : []);
    const text = "JOÃO (V.O.)\nTchau.\n";
    expect(computeMentions(segment(text), blind, cues(null)).occurrences).toHaveLength(0);
    expect(computeMentions(segment(text), blind, cues("shortStory")).occurrences).toHaveLength(0);
    expect(computeMentions(segment(text), blind).occurrences).toHaveLength(0);
  });

  it("leaves a cue inside a link to the link", () => {
    const text = "[[João]]\nOi.\n";
    const blind = (mask: string) => (mask === "João" ? find(mask) : []);
    const r = computeMentions(segment(text), blind, cues("screenplay"));
    expect(r.occurrences).toHaveLength(0);
    expect(r.links).toHaveLength(1);
  });
});
