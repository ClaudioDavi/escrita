import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings";
import { linkText, parseWorkLink, duplicateProp, pendingList, propsKey, propsOf, rowOf, submissionFileName, submissionText } from "../src/submissions/logic";

describe("unquoted work links", () => {
  it("rebuilds the brackets YAML ate", () => {
    expect(linkText([["X|Y"]])).toBe("[[X|Y]]");
    expect(linkText([["X"]])).toBe("[[X]]");
    expect(linkText("[[X]]")).toBe("[[X]]");
    expect(linkText(["[[X]]"])).toBe("[[X]]");
    expect(linkText(undefined)).toBe("");
    expect(parseWorkLink(linkText([["X|Y"]]))).toEqual({ target: "X", label: "Y" });
  });
  it("a pending submission with such a link still resolves", () => {
    const row = rowOf({ work: [["X"]], market: "M", sent: "2026-10-01", result: "pending" });
    const seen: string[] = [];
    const list = pendingList([["Submissions/a.md", row]], "pending", (target) => { seen.push(target); return "X.md"; });
    expect(seen).toEqual(["X"]);
    expect(list[0]).toMatchObject({ workPath: "X.md", workTitle: "X" });
  });
});

describe("property names are settings", () => {
  it("defaults match the settings defaults", () => {
    expect(propsOf(DEFAULT_SETTINGS)).toEqual({ work: "work", market: "market", sent: "sent", result: "result", responded: "responded" });
    expect(propsOf({ submissionSentProperty: "  " }).sent).toBe("sent");
  });
  it("custom names are read back and written out", () => {
    const props = propsOf({
      submissionWorkProperty: "obra", submissionMarketProperty: "destino", submissionSentProperty: "enviado",
      submissionResultProperty: "resultado", submissionRespondedProperty: "respondido",
    });
    const row = rowOf({ obra: "[[A]]", destino: "Pessoa", enviado: "2026-10-05", resultado: "pending", market: "ignored" }, props);
    expect(row).toEqual({ work: "[[A]]", market: "Pessoa", sent: "2026-10-05", result: "pending" });
    const text = submissionText({ link: "[[A]]", market: "Pessoa", sent: "2026-10-05", result: "pending" }, props);
    expect(text).toBe('---\nobra: "[[A]]"\ndestino: "Pessoa"\nenviado: 2026-10-05\nresultado: pending\nrespondido:\n---\n');
    expect(propsKey(props)).not.toBe(propsKey(propsOf({})));
  });
});

describe("unsafe and duplicate property names", () => {
  it("quotes keys so the note parses back to the right keys", () => {
    const props = propsOf({ submissionWorkProperty: "a: b", submissionMarketProperty: "my market", submissionSentProperty: "# s", submissionResultProperty: "[r]", submissionRespondedProperty: "-x y" });
    const text = submissionText({ link: "[[A]]", market: "M", sent: "2026-10-05", result: "pending" }, props);
    const keys = text.split("\n").slice(1, 6).map((l) => (l.startsWith('"') ? JSON.parse(l.slice(0, l.lastIndexOf('":') + 1)) : l.slice(0, l.indexOf(":"))));
    expect(keys).toEqual(["a: b", "my market", "# s", "[r]", "-x y"]);
  });
  it("finds a name another setting already uses", () => {
    const props = propsOf({});
    expect(duplicateProp(props, "responded", "result")).toBe(true);
    expect(duplicateProp(props, "responded", "responded")).toBe(false);
    expect(duplicateProp(props, "responded", "answered")).toBe(false);
  });
});

describe("file name truncation", () => {
  it("leaves no dangling dash when the cut lands on the separator", () => {
    const w = "W".repeat(180 - "2026-10-05 ".length);
    for (const extra of [0, 1, 2, 3]) {
      const n = submissionFileName("2026-10-05", w.slice(0, w.length - 3 + extra), "Market");
      expect(n).not.toMatch(/[–\s]\.md$/);
    }
    expect(submissionFileName("2026-10-05", "W".repeat(168), "Market")).toBe(`2026-10-05 ${"W".repeat(168)}.md`);
  });
});
