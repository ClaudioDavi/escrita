import { describe, expect, it } from "vitest";
import { applyChange } from "../src/core/note-text";
import { excerptOf, isTableRow, linkFromGenerated, linkableText, linkMarkup, linkPlan, rowsOf } from "../src/universe/unlinked-link";

const text = "Ontem o Capitão voltou.\n\nTeo riu. Teo saiu.";
const teo = { from: text.indexOf("Teo"), to: text.indexOf("Teo") + 3, text: "Teo" };

describe("linkMarkup", () => {
  it("uses the plain form when the text is the target", () => {
    expect(linkMarkup("Teo", "Teo")).toBe("[[Teo]]");
  });
  it("uses the alias form when it differs", () => {
    expect(linkMarkup("Teodoro", "Teo")).toBe("[[Teodoro|Teo]]");
    expect(linkMarkup("Personagens/Teo", "Teo")).toBe("[[Personagens/Teo|Teo]]");
    expect(linkMarkup("Teo", "teo")).toBe("[[Teo|teo]]");
  });
  it("refuses text that cannot sit in a link", () => {
    expect(linkMarkup("Teo", "a]]b")).toBeNull();
    expect(linkMarkup("Teo", "a\nb")).toBeNull();
    expect(linkMarkup("", "Teo")).toBeNull();
    expect(linkMarkup("Teo", "a|b")).toBeNull();
  });
  it("escapes the alias pipe in a table row, so the cell isn't split (release review)", () => {
    expect(linkMarkup("Teodoro", "Teo", true)).toBe("[[Teodoro\\|Teo]]");
    expect(linkMarkup("Teo", "Teo", true)).toBe("[[Teo]]");
    expect(isTableRow("| Teo | capitão |")).toBe(true);
    expect(isTableRow("  | Teo |")).toBe(true);
    expect(isTableRow("Teo riu | e saiu")).toBe(false);
  });
});

describe("linkPlan", () => {
  it("replaces exactly the one mention", () => {
    const c = linkPlan(teo, "[[Teodoro|Teo]]")(text)!;
    expect(applyChange(text, c)).toBe("Ontem o Capitão voltou.\n\n[[Teodoro|Teo]] riu. Teo saiu.");
  });
  it("writes the plain form too", () => {
    const c = linkPlan(teo, "[[Teo]]")(text)!;
    expect(applyChange(text, c)).toContain("\n\n[[Teo]] riu. Teo saiu.");
  });
  it("writes nothing when the text there changed", () => {
    expect(linkPlan(teo, "[[Teo]]")(text.replace("Teo riu", "Ana riu"))).toBeNull();
    expect(linkPlan(teo, "[[Teo]]")("curto")).toBeNull();
    expect(linkPlan(teo, "[[Teo]]")("x" + text)).toBeNull();
  });
  it("writes nothing when the place became part of a link", () => {
    const now = text.replace("Teo riu", "[[Teo riu]]");
    expect(linkPlan({ ...teo, from: teo.from + 2, to: teo.to + 2 }, "[[Teo]]")(now)).toBeNull();
    expect(linkPlan(teo, "[[Teo]]")(text.replace("Teo riu", "[Teo](a.md)"))).toBeNull();
  });
});

describe("linkPlan with the listed line", () => {
  const listed = { ...teo, lineText: "Teo riu. Teo saiu." };
  it("writes while the line is the one listed", () => {
    expect(linkPlan(listed, "[[Teo]]")(text)).not.toBeNull();
  });
  it("writes nothing when the word grew or the line changed around it", () => {
    expect(linkPlan(listed, "[[Teo]]")(text.replace("Teo riu", "Teodoro riu"))).toBeNull();
    expect(linkPlan(listed, "[[Teo]]")(text.replace("Teo saiu", "Teo ficou"))).toBeNull();
  });
});

describe("excerptOf", () => {
  it("stays on the mention's line", () => {
    const e = excerptOf(text, teo.from, teo.to);
    expect(e).toEqual({ before: "", match: "Teo", after: " riu. Teo saiu." });
  });
  it("cuts long lines at word edges with an ellipsis", () => {
    const long = "palavra ".repeat(20) + "Teo" + " palavra".repeat(20);
    const from = long.indexOf("Teo");
    const e = excerptOf(long, from, from + 3, 20);
    expect(e.before.startsWith("…")).toBe(true);
    expect(e.after.endsWith("…")).toBe(true);
    expect(e.before.length).toBeLessThanOrEqual(22);
    expect(e.match).toBe("Teo");
  });
});

describe("rowsOf", () => {
  it("adds the entry name and the excerpt", () => {
    const rows = rowsOf([{ entry: "U/Teo.md", from: teo.from, to: teo.to, line: 2, text: "Teo" }], text, () => "Teo");
    expect(rows[0]).toMatchObject({ name: "Teo", line: 2, excerpt: { match: "Teo" }, lineText: "Teo riu. Teo saiu." });
  });
});

describe("linkFromGenerated and linkableText", () => {
  it("keeps a Markdown link as generated, even with a pipe in the text", () => {
    expect(linkFromGenerated("[a|b](Teo.md)", "Teo", "a|b")).toBe("[a|b](Teo.md)");
    expect(linkFromGenerated("[teo](Teo.md)", "Teo", "teo", true)).toBe("[teo](Teo.md)");
    expect(linkableText("a|b", false)).toBe(true);
  });
  it("escapes a Markdown link's pipes in a table row, so the cell isn't split", () => {
    expect(linkFromGenerated("[a|b](Teo.md)", "Teo", "a|b", true)).toBe("[a\\|b](Teo.md)");
  });
  it("builds a wikilink the usual way and refuses a pipe", () => {
    expect(linkFromGenerated("[[Teo|teo]]", "Teo", "teo")).toBe("[[Teo|teo]]");
    expect(linkFromGenerated("[[Teo|Teo]]", "Teo", "Teo")).toBe("[[Teo]]");
    expect(linkFromGenerated("[[Teo|teo]]", "Teo", "teo", true)).toBe("[[Teo\\|teo]]");
    expect(linkableText("a|b", true)).toBe(false);
  });
  it("refuses brackets and line breaks in both forms", () => {
    expect(linkableText("a]b", false)).toBe(false);
    expect(linkFromGenerated("[a\nb](T.md)", "T", "a\nb")).toBeNull();
  });
});
