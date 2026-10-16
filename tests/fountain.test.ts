// The Fountain parser (SP 1, PLAN-1.1 Q5, Q6): the spec's elements, the settings words,
// Portuguese, boneyard and notes, and every place where Markdown and Fountain disagree.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { fountainOptions, parseFountain, parseRuns, type FountainOptions, type Script, type ScriptElement } from "../src/core/fountain";
import { segment } from "../src/core/markdown";

const EN: FountainOptions = { sceneHeadings: ["INT", "EXT", "EST", "INT./EXT", "INT/EXT", "I/E"], transitions: ["TO:"] };
const PT: FountainOptions = { sceneHeadings: ["INT", "EXT", "INT./EXT", "I/E"], transitions: ["TO:", "PARA:"] };

const parse = (text: string, opts: FountainOptions = EN): Script => parseFountain(text, segment(text), opts);
const els = (text: string, opts: FountainOptions = EN): ScriptElement[] => parse(text, opts).elements;
const plain = (e: ScriptElement) => e.runs.map((r) => r.text).join("");
/** type and text of each element, for compact assertions */
const brief = (text: string, opts: FountainOptions = EN) => els(text, opts).map((e) => `${e.type}:${plain(e)}`);

describe("scene headings", () => {
  it("reads the configured prefixes, case-insensitive, after a blank line", () => {
    expect(brief("INT. HOUSE - DAY\n\nEXT. GARDEN\n\nint. kitchen\n\nI/E CAR - NIGHT\n\nINT./EXT. PORCH\n\nEST. TOWN")).toEqual([
      "scene:INT. HOUSE - DAY", "scene:EXT. GARDEN", "scene:int. kitchen", "scene:I/E CAR - NIGHT", "scene:INT./EXT. PORCH", "scene:EST. TOWN",
    ]);
  });
  it("needs a '.' or a space after the prefix", () => {
    expect(els("INTERIOR of the house.")[0].type).toBe("action");
    expect(els("INT")[0].type).toBe("action");
  });
  it("is not a heading in the middle of an action paragraph", () => {
    expect(brief("He waits.\nINT. HOUSE")).toEqual(["action:He waits.\nINT. HOUSE"]);
  });
  it("follows the settings, not a built-in list", () => {
    expect(els("INT. HOUSE", { sceneHeadings: ["CENA"], transitions: [] })[0].type).toBe("action");
    expect(els("CENA. HOUSE", { sceneHeadings: ["CENA"], transitions: [] })[0].type).toBe("scene");
  });
  it("forces a heading with '.'", () => {
    const [e] = els(".SNIPER SCOPE POV");
    expect(e).toMatchObject({ type: "scene", forced: true });
    expect(plain(e)).toBe("SNIPER SCOPE POV");
    expect(els("..not a scene")[0].type).toBe("action");
  });
  it("reads the scene number", () => {
    const [a, b, c] = els("INT. HOUSE - DAY #1#\n\nEXT. GARDEN #A12-b#\n\n.FORCED #2.1#");
    expect(a).toMatchObject({ type: "scene", number: "1" });
    expect(plain(a)).toBe("INT. HOUSE - DAY");
    expect(b).toMatchObject({ number: "A12-b" });
    expect(c).toMatchObject({ forced: true, number: "2.1" });
  });
});

describe("action", () => {
  it("joins the lines of a paragraph and splits at blank lines", () => {
    expect(brief("One.\nTwo.\n\nThree.")).toEqual(["action:One.\nTwo.", "action:Three."]);
  });
  it("forces with '!'", () => {
    const [e] = els("!INT. THIS IS ACTION");
    expect(e).toMatchObject({ type: "action", forced: true });
    expect(plain(e)).toBe("INT. THIS IS ACTION");
  });
  it("centers with > … <", () => {
    const [e] = els("> THE END <");
    expect(e).toMatchObject({ type: "action", centered: true });
    expect(plain(e)).toBe("THE END");
  });
  it("keeps tabs and 4-space indents in action, indent included", () => {
    expect(brief("\tHe walks.\n\tShe waits.")).toEqual(["action:\tHe walks.\n\tShe waits."]);
    expect(brief("    He walks.")).toEqual(["action:    He walks."]);
  });
  it("ignores leading whitespace on every other element (Fountain, 'Indenting')", () => {
    expect(brief("\tBOB\n\tHello")).toEqual(["character:BOB", "dialogue:Hello"]);
    expect(brief("    JOHN\n    (hello)\n    Hi.")).toEqual(["character:JOHN", "parenthetical:(hello)", "dialogue:Hi."]);
    expect(brief("A line.\n\n\t\tCUT TO:\n\n    INT. HOUSE - DAY")).toEqual(["action:A line.", "transition:CUT TO:", "scene:INT. HOUSE - DAY"]);
    expect(brief("    > THE END <")).toEqual(["action:THE END"]);
    expect(brief("    # Act one\n\n\t= beat\n\n    ===")).toEqual(["section:Act one", "synopsis:beat", "pageBreak:"]);
    expect(brief("\t.forced scene\n\n    >TRANSITION")).toEqual(["scene:forced scene", "transition:TRANSITION"]);
    expect(brief("    @McBride\n    Hi.\n\n    !INT. NOT A SCENE")).toEqual(["character:McBride", "dialogue:Hi.", "action:INT. NOT A SCENE"]);
  });
  it("uppercase text with no dialogue after it is action", () => {
    expect(brief("BANG!")).toEqual(["action:BANG!"]);
    expect(brief("BANG!\n\nThe door.")).toEqual(["action:BANG!", "action:The door."]);
  });
});

describe("characters, dialogue, parentheticals", () => {
  it("reads a cue, a parenthetical and dialogue", () => {
    const e = els("STEEL\n(starting the engine)\nSo much for retirement!");
    expect(e.map((x) => x.type)).toEqual(["character", "parenthetical", "dialogue"]);
    expect(e[0]).toMatchObject({ name: "STEEL" });
    expect(plain(e[1])).toBe("(starting the engine)");
    expect(plain(e[2])).toBe("So much for retirement!");
  });
  it("needs a blank line before the cue and text after it", () => {
    expect(els("Walks in.\nBOB\nHello")[0].type).toBe("action");
    expect(brief("Walks in.\n\nBOB\n\nHello")).toEqual(["action:Walks in.", "action:BOB", "action:Hello"]);
  });
  it("keeps a speech going through a line of two spaces", () => {
    const e = els("BOB\nFirst.\n  \nSecond.\n\nAction.");
    expect(e.map((x) => x.type)).toEqual(["character", "dialogue", "dialogue", "action"]);
  });
  it("joins dialogue lines of one speech", () => {
    expect(brief("BOB\nLine one.\nLine two.")).toEqual(["character:BOB", "dialogue:Line one.\nLine two."]);
  });
  it("splits extensions off the name", () => {
    const [a, , b, , c] = els("BOB (V.O.)\nHi.\n\nANN (CONT'D)\nHi.\n\nCARL (O.S.) (CONT'D)\nHi.").filter((x) => x.type === "character").flatMap((x) => [x, x]);
    expect(a).toMatchObject({ name: "BOB", extension: "V.O." });
    expect(b).toMatchObject({ name: "ANN", extension: "CONT'D" });
    expect(c).toMatchObject({ name: "CARL", extension: "O.S. CONT'D" });
    expect(els("BOB\nHi.")[0]).not.toHaveProperty("extension");
  });
  it("reads '^' as dual dialogue", () => {
    const [c] = els("BRICK ^\nScrew retirement.");
    expect(c).toMatchObject({ type: "character", name: "BRICK", dual: true });
  });
  it("forces a cue with '@' so mixed case works", () => {
    const [c] = els("@McCLANE\nYippee.");
    expect(c).toMatchObject({ type: "character", name: "McCLANE", forced: true });
  });
  it("does not read a lowercase line or a bare number as a cue", () => {
    expect(els("Bob\nHello")[0].type).toBe("action");
    expect(els("1999\nHello")[0].type).toBe("action");
    expect(els("(V.O.)\nHello")[0].type).toBe("action");
  });
  it("reads accented capitals as a cue", () => {
    expect(els("JOÃO\nOi.")[0]).toMatchObject({ type: "character", name: "JOÃO" });
    expect(els("CONCEIÇÃO (V.O.)\nOi.")[0]).toMatchObject({ name: "CONCEIÇÃO", extension: "V.O." });
  });
  it("reads lyrics, in a speech and out of it", () => {
    expect(brief("~Willy Wonka!\n~Willy Wonka!")).toEqual(["lyric:Willy Wonka!\nWilly Wonka!"]);
    expect(els("BOB\n~la la la").map((x) => x.type)).toEqual(["character", "lyric"]);
  });
});

describe("transitions, page breaks, sections, synopses", () => {
  it("reads a transition by the configured ending", () => {
    expect(brief("Text.\n\nCUT TO:\n\nINT. HOUSE")).toEqual(["action:Text.", "transition:CUT TO:", "scene:INT. HOUSE"]);
    expect(brief("DISSOLVE TO:\n\nX")[0]).toBe("transition:DISSOLVE TO:");
  });
  it("needs capitals, a blank line before and after, and a configured ending", () => {
    expect(els("Cut to:\n\nX")[0].type).toBe("action");
    expect(els("CUT TO:\nX")[0].type).not.toBe("transition");
    expect(els("FADE OUT.\n\nX")[0].type).toBe("action");
  });
  it("forces a transition with '>'", () => {
    expect(els("> Burn to white.")[0]).toMatchObject({ type: "transition", forced: true });
    expect(plain(els("> Burn to white.")[0])).toBe("Burn to white.");
  });
  it("reads page breaks", () => {
    expect(els("A.\n\n===\n\nB.").map((x) => x.type)).toEqual(["action", "pageBreak", "action"]);
    expect(els("=====")[0].type).toBe("pageBreak");
  });
  it("reads sections with their depth, and synopses", () => {
    const e = els("# Act one\n\n## Sequence\n\n= Bob finds the key.\n\nINT. HOUSE");
    expect(e[0]).toMatchObject({ type: "section", depth: 1 });
    expect(e[1]).toMatchObject({ type: "section", depth: 2 });
    expect(plain(e[1])).toBe("Sequence");
    expect(e[2].type).toBe("synopsis");
    expect(plain(e[2])).toBe("Bob finds the key.");
  });
});

describe("Portuguese words from the settings", () => {
  it("reads CORTA PARA: and FUSÃO PARA: as transitions with the PT list", () => {
    expect(brief("CORTA PARA:\n\nFUSÃO PARA:\n\nX", PT).slice(0, 2)).toEqual(["transition:CORTA PARA:", "transition:FUSÃO PARA:"]);
    expect(els("CORTA PARA:\n\nX", EN)[0].type).toBe("action");
  });
  it("builds options from the settings strings", () => {
    const o = fountainOptions({ screenplaySceneHeadings: "INT, EXT,\nI/E, ", screenplayTransitions: "TO:,PARA:" });
    expect(o).toEqual({ sceneHeadings: ["INT", "EXT", "I/E"], transitions: ["TO:", "PARA:"] });
  });
  it("reads a whole Brazilian script", () => {
    const text = readFileSync(fileURLToPath(new URL("./fixtures/fountain/roteiro.md", import.meta.url)), "utf8");
    const s = parse(text, PT);
    expect(s.titleBlock).toEqual({
      title: "A TRAVESSIA", credit: "Escrito por", author: "Maria Conceição", draftDate: "12/10/2026",
      contact: ["maria@example.com", "Rua das Flores, 10"],
    });
    expect(s.elements.map((e) => `${e.type}:${plain(e)}`)).toEqual([
      "scene:INT. CASA DA VÓ - DIA",
      "action:Cozinha pequena. O cheiro de café fresco enche o ar. A casa está vazia.",
      "character:JOÃO",
      "parenthetical:(baixo)",
      "dialogue:Cadê todo mundo?",
      "character:CONCEIÇÃO (V.O.)",
      "dialogue:Na varanda, meu filho.",
      "transition:CORTA PARA:",
      "scene:EXT. QUINTAL - NOITE",
      "character:JOÃO",
      "dialogue:Boa noite!",
      "transition:FUSÃO PARA:",
      "action:FIM",
    ]);
    expect(s.elements[0]).toMatchObject({ number: "1", line: 12 });
    expect(s.elements[9]).toMatchObject({ dual: true });
    expect(s.elements[12]).toMatchObject({ centered: true });
    expect(s.elements[1].runs.find((r) => r.text === "fresco")).toMatchObject({ italic: true });
  });
});

describe("title block", () => {
  it("reads the keys and their indented lines", () => {
    const s = parse("Title:\n    _**BRICK & STEEL**_\n    _**FULL RETIRED**_\nCredit: Written by\nAuthors: Stu Maschwitz, Chris Lamb\nSource: Story by KTM\nDraft date: 1/20/2012\nContact:\n    Next Level Productions\n    1588 Mission Dr.\n\nINT. HOUSE");
    expect(s.titleBlock).toEqual({
      title: "BRICK & STEEL\nFULL RETIRED", credit: "Written by", author: "Stu Maschwitz, Chris Lamb", source: "Story by KTM",
      draftDate: "1/20/2012", contact: ["Next Level Productions", "1588 Mission Dr."],
    });
    expect(s.elements.map((e) => e.type)).toEqual(["scene"]);
  });
  it("is null without keys, and a first line like FADE IN: is not a title block", () => {
    expect(parse("INT. HOUSE").titleBlock).toBeNull();
    expect(parse("FADE IN:\n\nINT. HOUSE").titleBlock).toBeNull();
  });
  it("keeps what follows a key-less line in the body", () => {
    const s = parse("Title: X\nSome action here\n\nMore.");
    expect(s.titleBlock).toEqual({ title: "X" });
    expect(s.elements.map((e) => plain(e))).toEqual(["Some action here", "More."]);
  });
  it("starts after the frontmatter", () => {
    expect(parse("---\ntitle: x\n---\nTitle: Real\n\nINT. A").titleBlock).toEqual({ title: "Real" });
  });
});

describe("emphasis", () => {
  it("reads italic, bold, bold italic and underline", () => {
    expect(parseRuns("a *b* **c** ***d*** _e_ f")).toEqual([
      { text: "a " }, { text: "b", italic: true }, { text: " " }, { text: "c", bold: true }, { text: " " },
      { text: "d", bold: true, italic: true }, { text: " " }, { text: "e", underline: true }, { text: " f" },
    ]);
  });
  it("nests and combines", () => {
    expect(parseRuns("**bold *both* bold**")).toEqual([{ text: "bold ", bold: true }, { text: "both", bold: true, italic: true }, { text: " bold", bold: true }]);
    expect(parseRuns("_**x**_")).toEqual([{ text: "x", bold: true, underline: true }]);
  });
  it("honors backslash escapes", () => {
    expect(parseRuns("2 \\* 3 \\*x\\* \\_y\\_ \\\\")).toEqual([{ text: "2 * 3 *x* _y_ \\" }]);
    expect(parseRuns("a\\b")).toEqual([{ text: "a\\b" }]);
  });
  it("leaves unpaired and spaced marks as text", () => {
    expect(parseRuns("2 * 3 * 4")).toEqual([{ text: "2 * 3 * 4" }]);
    expect(parseRuns("*open")).toEqual([{ text: "*open" }]);
    expect(parseRuns("snake_case_name")).toEqual([{ text: "snake_case_name" }]);
    expect(parseRuns("")).toEqual([]);
  });
  it("applies inside elements", () => {
    const [e] = els("He *runs* **fast**.");
    expect(e.runs.map((r) => r.text)).toEqual(["He ", "runs", " ", "fast", "."]);
  });
});

describe("Markdown notes, links and boneyard", () => {
  it("skips frontmatter, code and %% notes; a note inside a line is removed", () => {
    const text = "---\ntype: roteiro\n---\nINT. A\n\n%% a note\nover two lines %%\n\n```\nINT. IN CODE\n```\n\nHe %% hush %% waits.";
    expect(brief(text)).toEqual(["scene:INT. A", "action:He  waits."]);
  });
  it("a %% line does not break an action paragraph or a speech", () => {
    expect(brief("One.\n%% note %%\nTwo.")).toEqual(["action:One.\nTwo."]);
    expect(brief("BOB\nHi.\n%% note %%\nThere.")).toEqual(["character:BOB", "dialogue:Hi.\nThere."]);
  });
  it("a note around a blank line leaves no blank", () => {
    expect(brief("BOB\n%% a\n\nb %%\nHi.")).toEqual(["character:BOB", "dialogue:Hi."]);
  });
  it("turns [[links]] into their text, not Fountain notes", () => {
    expect(brief("See [[Other note]] and [[Folder/Deep.md]] and [[Target|alias]] [[A#B|c]].")).toEqual(["action:See Other note and Deep and alias c."]);
    expect(brief("[[a note]]")).toEqual(["action:a note"]);
  });
  it("removes boneyard, on one line and over several", () => {
    expect(brief("A /* gone */ b.")).toEqual(["action:A  b."]);
    expect(brief("A.\n\n/* gone\nstill gone\nINT. X\n*/\n\nB.")).toEqual(["action:A.", "action:B."]);
    expect(brief("Ab.\n/* gone */\nBc.")).toEqual(["action:Ab.\nBc."]);
  });
  it("keeps an unclosed /* as text instead of eating the script", () => {
    expect(brief("A /* b\n\nINT. X")).toEqual(["action:A /* b", "scene:INT. X"]);
  });
  it("gives 0-based lines of the note text", () => {
    const e = els("---\na: b\n---\nINT. A\n\nBob walks.\n\nCUT TO:\n\nX");
    expect(e.map((x) => x.line)).toEqual([3, 5, 7, 9]);
  });
});

describe("where the screenplay wins over Markdown (Q6)", () => {
  it("# is a section, not a heading", () => {
    expect(brief("# Act one")).toEqual(["section:Act one"]);
    expect(brief("###### deep")[0]).toBe("section:deep");
  });
  it("> is a transition or centered text, not a quote", () => {
    expect(brief("> A quote\n\n> CENTER <")).toEqual(["transition:A quote", "action:CENTER"]);
  });
  it("centered lines with no blank between are one centered block (Wave 2 judge, R4)", () => {
    const [e, ...rest] = els("> BRICK & STEEL <\n> FULL RETIRED <\n\n> ONE <");
    expect(e).toMatchObject({ type: "action", centered: true, runs: [{ text: "BRICK & STEEL\nFULL RETIRED" }] });
    expect(rest).toHaveLength(1);
  });
  it("_x_ is underline, not italic", () => {
    expect(els("an _underlined_ word")[0].runs[1]).toEqual({ text: "underlined", underline: true });
  });
  it("a 4-space indent in action is action, not code", () => {
    expect(brief("    not code")).toEqual(["action:    not code"]);
  });
  it("a '---' line is action text, nothing is dropped", () => {
    expect(brief("A.\n\n---\n\nB.")).toEqual(["action:A.", "action:---", "action:B."]);
  });
  it("** in a cue is emphasis, not part of the name", () => {
    const [c] = els("**BOB**\nHi.");
    expect(c).toMatchObject({ type: "character", name: "BOB" });
    expect(c.runs).toEqual([{ text: "BOB", bold: true }]);
  });
  it("* and - lists are action", () => {
    expect(brief("* one\n* two")).toEqual(["action:* one\n* two"]);
  });
});

describe("total on any input", () => {
  const odd = [
    "", "\n", "\n\n\n", "\r\n\r\n", "   ", "\t", "---", "---\n---", "---\nabc", "%%", "%% open", "/*", "*/", "/* */ */",
    "[[", "]]", "[[]]", "[[|]]", "**", "***", "*****", "_", "__", "\\", "\\\\\\", "#", "#####", "=", "==", "===", ">", "<", "><", "> <",
    ".", "..", "!", "@", "@\n", "^", "~", "()", "(", "(\n)", "Title:", "Title:\n", "Contact:\n  ", "INT.", "INT. ", "#1#", "INT. A #1#", "INT. A ##",
    "\u0000\u0001", "😀\n\n😀 ^\nx", "A".repeat(10000), "BOB\n".repeat(500), "```\nopen fence", "$$\nx", "<!-- c -->\nA", "BOB (\nHi",
    "BOB ()\nHi", "BOB (a) (b) (\nHi", "*a _b* c_", "\\*\\*", "a\r\nB\r\n\r\nC",
  ];
  it.each(odd.map((s) => [JSON.stringify(s.slice(0, 40)), s]))("%s", (_name, s) => {
    const r = parse(s);
    expect(Array.isArray(r.elements)).toBe(true);
    for (const e of r.elements) {
      expect(Number.isInteger(e.line) && e.line >= 0).toBe(true);
      expect(Array.isArray(e.runs)).toBe(true);
    }
  });
  it("escapes regex characters in scene prefixes", () => {
    expect(els("A\\B. X", { sceneHeadings: ["A\\B", "(("], transitions: [] })[0].type).toBe("scene");
  });
  it("is total with empty options", () => {
    expect(() => parse("INT. A\n\nCUT TO:\n\nBOB\nHi", { sceneHeadings: [], transitions: [] })).not.toThrow();
  });
  it("is total when md does not match the text", () => {
    expect(() => parseFountain("INT. A", segment("something else entirely"), EN)).not.toThrow();
  });
  it("handles CRLF like LF", () => {
    expect(brief("INT. A\r\n\r\nBOB\r\nHi.\r\n")).toEqual(brief("INT. A\n\nBOB\nHi.\n"));
  });
});
