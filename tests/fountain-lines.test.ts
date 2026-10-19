// fountainLines (1.2, SP 2, PLAN-1.2 Q3): the kind of every line of a screenplay note, read the
// same way as parseFountain, so the editor's layout never disagrees with the export.

import { describe, expect, it } from "vitest";
import { fountainLines, parseFountain, type FountainOptions } from "../src/core/fountain";
import { segment } from "../src/core/markdown";

const EN: FountainOptions = { sceneHeadings: ["INT", "EXT", "EST", "INT./EXT", "INT/EXT", "I/E"], transitions: ["TO:"] };

const SCRIPT = [
  "---",                       // 0 frontmatter
  "form: screenplay",          // 1
  "---",                       // 2
  "Title: Night Shift",        // 3 title block
  "Author: Ana",               // 4
  "",                          // 5
  "# Act one",                 // 6 section
  "= The set-up",              // 7 synopsis
  "",                          // 8
  "INT. KITCHEN - NIGHT",      // 9 scene
  "",                          // 10
  "Rain hits the window.",     // 11 action
  "A kettle starts to scream.", // 12 action (same element)
  "",                          // 13
  "ANA",                       // 14 character
  "(whispering)",              // 15 parenthetical
  "Did you hear that?",        // 16 dialogue
  "It came from upstairs.",    // 17 dialogue (same element)
  "",                          // 18
  "%% a note to self %%",      // 19 comment
  "",                          // 20
  "CUT TO:",                   // 21 transition
  "",                          // 22
  "> THE END <",               // 23 centered
] as const;
const TEXT = SCRIPT.join("\n");

describe("fountainLines", () => {
  const kinds = fountainLines(TEXT, segment(TEXT), EN);

  it("has one entry per line of the note", () => {
    expect(kinds).toHaveLength(SCRIPT.length);
  });

  it("names the kind of each line, and null for blanks, frontmatter and comments", () => {
    expect(kinds).toEqual([
      null, null, null,
      "titlePage", "titlePage", null,
      "section", "synopsis", null,
      "scene", null,
      "action", "action", null,
      "character", "parenthetical", "dialogue", "dialogue", null,
      null, null,
      "transition", null,
      "centered",
    ]);
  });

  it("agrees with parseFountain on where each element starts", () => {
    const script = parseFountain(TEXT, segment(TEXT), EN);
    expect(script.elements.length).toBeGreaterThan(0);
    for (const el of script.elements) {
      const expected = el.type === "action" && el.centered ? "centered" : el.type;
      expect(kinds[el.line], `line ${el.line} (${el.type})`).toBe(expected);
    }
    // a line that starts no element is a continuation of the one above, or null
    const starts = new Set(script.elements.map((e) => e.line));
    kinds.forEach((k, i) => {
      if (k !== null && k !== "titlePage" && !starts.has(i)) expect(kinds[i - 1], `line ${i}`).toBe(k);
    });
  });

  it("is total: empty text gives one null line", () => {
    expect(fountainLines("", segment(""), EN)).toEqual([null]);
  });
});
