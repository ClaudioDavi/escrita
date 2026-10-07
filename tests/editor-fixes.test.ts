import { describe, it, expect } from "vitest";
import { segment } from "../src/core/markdown";
import { bodyLineIn } from "../src/core/block-context";
import { decideEnter, isProseLine } from "../src/editor/enter-flow";
import { typographyFor, type TypographyOptions } from "../src/core/typography";

const D = (s: string) => segment(s);
/** The editor guard in insertSceneBreak: the line is in the properties block. */
const inProperties = (s: string, line: number) => line < bodyLineIn(D(s));
const bodyStart = (s: string) => bodyLineIn(D(s));

describe("insertSceneBreak guard (Insert scene break guard)", () => {
  const doc = "---\nstatus: draft\n---\n\nProse.";
  it("covers the opening line, the properties and the closing line", () => {
    expect(inProperties(doc, 0)).toBe(true);
    expect(inProperties(doc, 1)).toBe(true);
    expect(inProperties(doc, 2)).toBe(true);
    expect(inProperties(doc, 3)).toBe(false);
    expect(inProperties(doc, 4)).toBe(false);
  });
  it("no frontmatter: nothing is properties", () => {
    expect(inProperties("Prose.\n\n---\n\nMore.", 0)).toBe(false);
    expect(bodyStart("Prose.")).toBe(0);
  });
  it("unclosed frontmatter: everything is properties (conservative)", () => {
    expect(inProperties("---\nstatus: draft\n", 2)).toBe(true);
  });
  it("frontmatter closed with ...", () => {
    expect(bodyStart("---\na: 1\n...\nText")).toBe(3);
  });
});

describe("decideEnter after comments", () => {
  it("no break after a multi-line %% comment", () => {
    expect(decideEnter(D(["Prose.", "", "%%", "a note", "%%", "", ""].join("\n")), 6, "blank")).toBe("normal");
    expect(decideEnter(D(["Prose.", "", "%% start", "a note %%", "", ""].join("\n")), 5, "blank")).toBe("normal");
  });
  it("no break after an HTML comment or a tag-only line", () => {
    expect(decideEnter(D(["<!-- x -->", "", ""].join("\n")), 2, "blank")).toBe("normal");
    expect(decideEnter(D(["<!--", "x", "-->", "", ""].join("\n")), 4, "blank")).toBe("normal");
    expect(decideEnter(D(["</div>", "", ""].join("\n")), 2, "blank")).toBe("normal");
  });
  it("still breaks after prose with a paired comment", () => {
    expect(decideEnter(D(["Prose %% note %%", "", ""].join("\n")), 2, "blank")).toBe("break");
    expect(decideEnter(D(["Prose <!-- note --> more", "", ""].join("\n")), 2, "blank")).toBe("break");
  });
  it("isProseLine on comment edges", () => {
    for (const l of ["%%", "a note %%", "%% start", "<!-- x -->", "-->", "<!--", "<br>", "<div class=\"a\">"]) {
      expect(isProseLine(l), l).toBe(false);
    }
    expect(isProseLine("She said <em>no</em>.")).toBe(true);
  });
});

describe("typographyFor in table delimiter rows", () => {
  const o: TypographyOptions = { quoteStyle: "curly", dialogueDash: true };
  const apply = (before: string, typed: string) => {
    const r = typographyFor(before, typed, o);
    return r ? before.slice(0, before.length - r.deleteBefore) + r.insert : before + typed;
  };
  it("leaves -- alone in a delimiter row without a leading pipe", () => {
    expect(apply("--- | -", "-")).toBe("--- | --");
    expect(apply(":-", "-")).toBe(":--");
    expect(apply("--- | :-", "-")).toBe("--- | :--");
  });
  it("still makes em dashes in prose", () => {
    expect(apply("word -", "-")).toBe("word —");
    expect(apply("a | b -", "-")).toBe("a | b —");
  });
});
