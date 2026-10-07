import { describe, expect, it } from "vitest";
import { collectionNoteText, storyLink } from "../src/export/logic";
import { withCoverWarning, withMissingStories, type Warning } from "../src/export/source";

describe("collection note text", () => {
  it("lists the links quoted, in order, as the only property", () => {
    expect(collectionNoteText("contents", ["[[A]]", "[[B]]"])).toBe('---\ncontents:\n  - "[[A]]"\n  - "[[B]]"\n---\n');
  });
  it("quotes an odd property name and escapes quotes in a link", () => {
    expect(collectionNoteText("my list", ['[[Say "hi"]]'])).toBe('---\n"my list":\n  - "[[Say \\"hi\\"]]"\n---\n');
  });
  it("links by name, or by path without the extension when the name is shared", () => {
    expect(storyLink("Contos/A visita.md", false)).toBe("[[A visita]]");
    expect(storyLink("Contos/A visita.md", true)).toBe("[[Contos/A visita]]");
    expect(storyLink("Raiz.md", false)).toBe("[[Raiz]]");
  });
});

describe("the missing stories warning", () => {
  const embeds: Warning = { id: "embeds", level: "info", n: 1, names: ["x.png"], links: [] };
  const empty: Warning = { id: "emptyBody", level: "warning", n: 1, names: [], links: [] };
  it("adds nothing without missing links", () => {
    expect(withMissingStories([embeds], [])).toEqual([embeds]);
  });
  it("is a confirming warning placed after the readiness checks and before the embeds", () => {
    const out = withMissingStories([embeds, empty], ["A", "B"]);
    expect(out.map((w) => w.id)).toEqual(["emptyBody", "missingStories", "embeds"]);
    expect(out[1]).toEqual({ id: "missingStories", level: "warning", n: 2, names: ["A", "B"], links: [] });
  });
  it("survives the cover warning", () => {
    const out = withCoverWarning(withMissingStories([embeds], ["A"]), "capa.png");
    expect(out.map((w) => w.id)).toEqual(["missingStories", "cover", "embeds"]);
  });
});
