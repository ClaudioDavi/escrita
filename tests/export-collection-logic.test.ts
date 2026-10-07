import { describe, expect, it } from "vitest";
import { collectionNoteText, explorerSortOf, sortLikeExplorer } from "../src/export/logic";
import { withWarning, type Warning } from "../src/export/source";

describe("collection note text", () => {
  it("lists the links quoted, in order, as the only property", () => {
    expect(collectionNoteText("contents", ["[[A]]", "[[B]]"])).toBe('---\ncontents:\n  - "[[A]]"\n  - "[[B]]"\n---\n');
  });
  it("quotes an odd property name and escapes quotes in a link", () => {
    expect(collectionNoteText("my list", ['[[Say "hi"]]'])).toBe('---\n"my list":\n  - "[[Say \\"hi\\"]]"\n---\n');
  });
});

describe("withWarning: the missing stories and cover warnings", () => {
  const embeds: Warning = { id: "embeds", level: "info", n: 1, names: ["x.png"], links: [] };
  const empty: Warning = { id: "emptyBody", level: "warning", n: 1, names: [], links: [] };
  const missing: Warning = { id: "missingStories", level: "warning", n: 2, names: ["A", "B"], links: [] };
  const cover: Warning = { id: "cover", level: "warning", n: 1, names: ["capa.png"], links: [] };
  it("places missing stories after the readiness checks and before the embeds", () => {
    const out = withWarning([embeds, empty], missing);
    expect(out.map((w) => w.id)).toEqual(["emptyBody", "missingStories", "embeds"]);
    expect(out[1]).toBe(missing);
  });
  it("keeps both: missing stories, then the cover", () => {
    const out = withWarning(withWarning([embeds], missing), cover);
    expect(out.map((w) => w.id)).toEqual(["missingStories", "cover", "embeds"]);
  });
});

describe("explorer order", () => {
  const f = (path: string, mtime = 0, ctime = 0) => ({ path, mtime, ctime });
  const order = (files: ReturnType<typeof f>[], sort = explorerSortOf("alphabetical")) => sortLikeExplorer(files, sort).map((x) => x.path);

  it("sorts names naturally, not in click order", () => {
    expect(order([f("C/10 b.md"), f("C/2 a.md"), f("C/1 z.md")])).toEqual(["C/1 z.md", "C/2 a.md", "C/10 b.md"]);
  });
  it("puts folders before files at every level", () => {
    expect(order([f("A.md"), f("Sub/Z.md"), f("B.md")])).toEqual(["Sub/Z.md", "A.md", "B.md"]);
  });
  it("reverses the names for the reverse sort, folders still first", () => {
    expect(order([f("A.md"), f("B.md"), f("Sub/Z.md")], "alphabeticalReverse")).toEqual(["Sub/Z.md", "B.md", "A.md"]);
  });
  it("uses the time for siblings, and the name across folders", () => {
    expect(order([f("C/a.md", 3), f("C/b.md", 1), f("C/c.md", 2)], "byModifiedTime")).toEqual(["C/b.md", "C/c.md", "C/a.md"]);
    expect(order([f("C/a.md", 3), f("C/b.md", 1)], "byModifiedTimeReverse")).toEqual(["C/a.md", "C/b.md"]);
    expect(order([f("Y/a.md", 1), f("X/b.md", 9)], "byModifiedTime")).toEqual(["X/b.md", "Y/a.md"]);
  });
  it("reads an unknown setting as name A to Z", () => {
    expect(explorerSortOf(undefined)).toBe("alphabetical");
    expect(explorerSortOf("byCreatedTime")).toBe("byCreatedTime");
  });
});
