import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fountainOptions, parseFountain, parseRuns, type Script, type ScriptElement, type TitlePage } from "../src/core/fountain";
import { segment } from "../src/core/markdown";
import { DEFAULT_SETTINGS, defaultsFor } from "../src/settings";
import { fountainText, fountainWriter, runsToText, scriptNotes } from "../src/export/writers/fountain";

// The Fountain writer (PLAN-1.1 Q5, Q9; the Wave 1 judge's decision): a Script back to text that
// the parser reads as the same elements.

const EN = fountainOptions(DEFAULT_SETTINGS);
const PT = fountainOptions(defaultsFor("pt-BR"));
const parse = (text: string, opts = EN): Script => parseFountain(text, segment(text), opts);
const bare = (els: ScriptElement[]): unknown[] => els.map((e) => { const { line: _l, ...rest } = e; return rest; });
const TP: TitlePage = { title: "O farol" };
const write = (script: Script, tp: TitlePage = TP, opts = EN, notes: { line: number; text: string }[] = []): string => fountainText({ script, titlePage: tp, notes }, opts);
/** parse, write, parse again: the elements must be the same */
const roundTrip = (text: string, opts = EN): { again: Script; first: Script; out: string } => {
  const first = parse(text, opts);
  const out = write(first, { title: "T" }, opts);
  return { first, again: parse(out, opts), out };
};

describe("the round trip", () => {
  it("writes a centered block of several lines as one > … < line each", () => {
    const { again, first, out } = roundTrip("> BRICK & STEEL <\n> FULL RETIRED <");
    expect(out).toContain("> BRICK & STEEL <\n> FULL RETIRED <");
    expect(bare(again.elements)).toEqual(bare(first.elements));
  });

  it("gives the same elements for every sample script", () => {
    for (const [file, opts] of [
      ["tests/fixtures/fountain/roteiro.md", PT],
      ["tests/fixtures/screenplay/pt-short.fountain", PT],
      ["tests/fixtures/screenplay/en-short.fountain", EN],
    ] as const) {
      const { first, again } = roundTrip(readFileSync(file, "utf8"), opts);
      expect(first.elements.length).toBeGreaterThan(5);
      expect(bare(again.elements)).toEqual(bare(first.elements));
    }
  });

  it("keeps every element kind: forced marks, dual dialogue, lyrics, centered text, sections, synopses", () => {
    const text = [
      "# ACT ONE", "", "= The lighthouse goes dark.", "",
      "INT. KITCHEN - NIGHT #12#", "",
      "The kettle rattles. *She* counts **coins** and _loses count_.", "A second line of the same paragraph.", "",
      "MARA (V.O.)", "(whispering)", "Eleven, twelve.", "  ", "Count again.", "",
      "TOMÉ ^", "Wait.", "",
      "BRICK", "~Row, row, row", "~your boat", "",
      "> THE END <", "", "===", "", "CUT TO:", "",
      ".the sea at dawn", "", "@McBRIDE", "Hello.", "", "!INT. THIS IS ACTION", "", "> burn to white.",
    ].join("\n");
    const { first, again, out } = roundTrip(text);
    expect(first.elements.map((e) => e.type)).toEqual([
      "section", "synopsis", "scene", "action", "character", "parenthetical", "dialogue", "dialogue", "character", "dialogue",
      "character", "lyric", "action", "pageBreak", "transition", "scene", "character", "dialogue", "action", "transition",
    ]);
    expect(bare(again.elements)).toEqual(bare(first.elements));
    expect(out).toContain("INT. KITCHEN - NIGHT #12#");
    expect(out).toContain("\n  \n");
  });

  it("round-trips in Portuguese with the install's words", () => {
    const text = "INT. CASA - DIA\n\nJOÃO\nOlá.\n\nCORTA PARA:\n\nEXT. RUA - NOITE\n\nO vento.";
    const { first, again } = roundTrip(text, PT);
    expect(first.elements.map((e) => e.type)).toEqual(["scene", "character", "dialogue", "transition", "scene", "action"]);
    expect(bare(again.elements)).toEqual(bare(first.elements));
  });
});

describe("indented action (Q6, the spec's reading of indents)", () => {
  it("forces an indented action line that would now read as another element, and round-trips the rest", () => {
    for (const text of ["!    CUT TO:", "!\tINT. HOUSE - DAY", "!    BOB\n    Hello", "!    # not a section", "He walks.\n    # not a section", "He walks.\n\t= not a synopsis", "    plain indent\n    kept"]) {
      const { first, again, out } = roundTrip(text);
      expect(bare(again.elements), out).toEqual(bare(first.elements));
    }
  });
  it("writes the '!' for an indented CUT TO: action", () => {
    expect(write({ titleBlock: null, elements: [{ type: "action", line: 0, runs: [{ text: "    CUT TO:" }] }] }, { title: "" })).toBe("!    CUT TO:\n");
  });
});

describe("forced marks, only where needed", () => {
  it("writes the plain form when the parser reads it back, and a mark when not", () => {
    const script: Script = {
      titleBlock: null,
      elements: [
        { type: "scene", line: 0, runs: [{ text: "EXT. PRAIA - DIA" }] },
        { type: "scene", line: 1, runs: [{ text: "A praia" }] },
        { type: "character", line: 2, name: "McBride", runs: [{ text: "McBride" }] },
        { type: "dialogue", line: 3, runs: [{ text: "Oi." }] },
        { type: "character", line: 4, name: "JOÃO", extension: "V.O.", runs: [{ text: "JOÃO (V.O.)" }] },
        { type: "dialogue", line: 5, runs: [{ text: "Oi." }] },
        { type: "action", line: 6, runs: [{ text: "CORTA PARA:" }] },
        { type: "action", line: 7, runs: [{ text: "Ele sai." }] },
        { type: "transition", line: 8, runs: [{ text: "CORTA PARA:" }] },
        { type: "transition", line: 9, runs: [{ text: "queima para o branco." }] },
      ],
    };
    const out = write(script, { title: "" }, PT);
    expect(out.split("\n\n")).toEqual([
      "EXT. PRAIA - DIA", ".A praia", "@McBride\nOi.", "JOÃO (V.O.)\nOi.", "!CORTA PARA:", "Ele sai.", "CORTA PARA:", "> queima para o branco.\n",
    ]);
    expect(bare(parse(out, PT).elements)).toEqual(bare(script.elements).map((e) => {
      const c = { ...(e as Record<string, unknown>) };
      if (c.type === "scene" && (c.runs as { text: string }[])[0].text === "A praia") c.forced = true;
      if (c.type === "character" && c.name === "McBride") c.forced = true;
      if (c.type === "action" && (c.runs as { text: string }[])[0].text === "CORTA PARA:") c.forced = true;
      if (c.type === "transition" && (c.runs as { text: string }[])[0].text.startsWith("queima")) c.forced = true;
      return c;
    }));
  });

  it("an action that would read as a cue or a scene gets a bang", () => {
    const script: Script = {
      titleBlock: null,
      elements: [{ type: "action", line: 0, runs: [{ text: "INT. NOT A SCENE, JUST A LINE" }] }],
    };
    // alone it reads as a scene heading, so it is forced
    expect(write(script, { title: "" })).toBe("!INT. NOT A SCENE, JUST A LINE\n");
  });
});

describe("inline text", () => {
  it("writes emphasis the parser reads back", () => {
    for (const raw of ["*itálico* e **negrito** e ***ambos***", "_sublinhado_ e _**tudo**_", "a * b * c", "snake_case_name", "\\*literal\\*"]) {
      const runs = parseRuns(raw);
      expect(parseRuns(runsToText(runs))).toEqual(runs);
    }
  });
  it("never loses the words when two styles touch", () => {
    const runs = [{ text: "um", bold: true }, { text: "dois", italic: true }];
    const text = runsToText(runs);
    expect(parseRuns(text).map((r) => r.text).join("")).toBe("umdois");
  });
});

describe("the title block", () => {
  it("writes the merged title page as Title: lines, contact indented", () => {
    const out = write(parse("INT. A - DIA\n\nx"), {
      title: "O farol", credit: "Roteiro de", author: "Ana Souza", source: "o conto \"A ilha\"", draftDate: "15/10/2026", contact: ["ana@exemplo.com", "(11) 99999-0000"],
    });
    expect(out.startsWith([
      "Title: O farol", "Credit: Roteiro de", "Author: Ana Souza", "Source: o conto \"A ilha\"", "Draft date: 15/10/2026", "Contact:", "    ana@exemplo.com", "    (11) 99999-0000", "", "INT. A - DIA",
    ].join("\n"))).toBe(true);
    expect(parse(out).titleBlock).toEqual({
      title: "O farol", credit: "Roteiro de", author: "Ana Souza", source: "o conto \"A ilha\"", draftDate: "15/10/2026", contact: ["ana@exemplo.com", "(11) 99999-0000"],
    });
  });
  it("leaves the empty lines out", () => {
    expect(write({ titleBlock: null, elements: [] }, { title: "Só título" })).toBe("Title: Só título\n");
  });
});

describe("notes", () => {
  const text = [
    "%% beat: João sobe %%", "", "EXT. FAROL - NOITE", "",
    "%% conferir o nome da escada %%", "", "João sobe.", "%% XXX: cor da capa %%", "", "JOÃO", "Oi. %% thread: quem mexeu? %%", "", "%% nota final %%",
  ].join("\n");
  const md = segment(text);

  it("takes the writer's %% comments and never Escrita's markers", () => {
    expect(scriptNotes(md, ["beat", "XXX", "thread"])).toEqual([
      { line: 4, text: "conferir o nome da escada" },
      { line: 12, text: "nota final" },
    ]);
  });
  it("a marker word followed by more letters is a note, not a marker", () => {
    expect(scriptNotes(segment("%% beaten path %%\n\n%% XXXL %%"), ["beat", "XXX"]).map((n) => n.text)).toEqual(["beaten path", "XXXL"]);
  });
  it("puts a note before the block it stood above, and the last at the end", () => {
    const script = parse(text);
    const out = write(script, { title: "" }, EN, scriptNotes(md, ["beat", "XXX", "thread"]));
    expect(out).toBe("EXT. FAROL - NOITE\n\n[[conferir o nome da escada]]\n\nJoão sobe.\n\nJOÃO\nOi.\n\n[[nota final]]\n");
  });
  it("writes none without notes, and the markers never appear", () => {
    const out = write(parse(text), { title: "" });
    expect(out).not.toContain("[[");
    expect(out).not.toMatch(/beat|XXX|thread/);
  });
  it("the writer takes the notes it is given, as the table passes them", () => {
    expect(fountainWriter.write({ script: parse("x"), titlePage: { title: "" }, notes: [{ line: 0, text: "n" }] }, EN)).toBe("[[n]]\n\nx\n");
  });
});
