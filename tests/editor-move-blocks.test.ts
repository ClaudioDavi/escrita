import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import {
  groupAt,
  inProperties,
  paragraphBlocks,
  sceneBlocks,
  type Block,
} from "../src/editor/move-blocks";

const cut = (text: string, bs: Block[]) => bs.map((b) => [b.kind, text.slice(b.from, b.to)]);
const para = (text: string, style: "single" | "blank" = "blank") => paragraphBlocks(segment(text), style);
const at = (text: string, needle: string, k = 0) => text.indexOf(needle) + k;
const cur = (p: number) => ({ anchor: p, head: p });

describe("paragraphBlocks, blank style", () => {
  it("splits on blank lines and keeps multi-line paragraphs whole", () => {
    const t = "One\ntwo\n\nThree\n\n\nFour\n";
    expect(cut(t, para(t))).toEqual([
      ["paragraph", "One\ntwo"],
      ["paragraph", "Three"],
      ["paragraph", "Four"],
    ]);
  });
  it("is empty for empty and blank text", () => {
    expect(para("")).toEqual([]);
    expect(para("\n\n  \n")).toEqual([]);
  });
  it("skips frontmatter", () => {
    const t = "---\nstatus: x\n---\n\nBody\n";
    expect(cut(t, para(t))).toEqual([["paragraph", "Body"]]);
  });
  it("keeps a heading glued to prose in the same block", () => {
    const t = "# Title\nFirst\nsecond\n\n## Sub\n\nLast";
    expect(cut(t, para(t))).toEqual([
      ["paragraph", "# Title\nFirst\nsecond"],
      ["heading", "## Sub"],
      ["paragraph", "Last"],
    ]);
  });
  it("makes scene breaks break blocks", () => {
    const t = "A\n\n---\n\nB";
    expect(cut(t, para(t))).toEqual([["paragraph", "A"], ["break", "---"], ["paragraph", "B"]]);
  });
  it("does not read a setext underline as a break", () => {
    const t = "Title\n---\n\nB";
    expect(cut(t, para(t))).toEqual([["paragraph", "Title\n---"], ["paragraph", "B"]]);
  });
  it("keeps a glued beat in the same block as its prose", () => {
    const t = "%% beat: x %%\nProse here\n\nMore";
    expect(cut(t, para(t))).toEqual([
      ["paragraph", "%% beat: x %%\nProse here"],
      ["paragraph", "More"],
    ]);
  });
  it("makes a lone beat line a unit", () => {
    const t = "A\n\n%% beat: x %%\n\nB";
    expect(cut(t, para(t))[1]).toEqual(["unit", "%% beat: x %%"]);
  });
  it("makes comment-only lines and multi-line comments units", () => {
    const t = "A\n\n%% XXX: check %%\n\n%% long\n\ncomment %%\n\nB";
    expect(cut(t, para(t))).toEqual([
      ["paragraph", "A"],
      ["unit", "%% XXX: check %%"],
      ["unit", "%% long\n\ncomment %%"],
      ["paragraph", "B"],
    ]);
  });
  it("makes html comments units", () => {
    const t = "A\n\n<!-- note -->\n\nB";
    expect(cut(t, para(t))[1]).toEqual(["unit", "<!-- note -->"]);
  });
  it("makes a fenced code block one unit, blank lines inside included", () => {
    const t = "A\n\n```\ncode\n\nmore\n```\n\nB";
    expect(cut(t, para(t))).toEqual([
      ["paragraph", "A"],
      ["unit", "```\ncode\n\nmore\n```"],
      ["paragraph", "B"],
    ]);
  });
  it("trims blank lines off an unclosed fence", () => {
    const t = "A\n\n```\ncode\n\n";
    expect(cut(t, para(t))[1]).toEqual(["unit", "```\ncode"]);
  });
  it("makes math blocks units", () => {
    const t = "A\n\n$$\nx = 1\n\ny = 2\n$$\n\nB\n\n$$z$$\n";
    expect(cut(t, para(t))).toEqual([
      ["paragraph", "A"],
      ["unit", "$$\nx = 1\n\ny = 2\n$$"],
      ["paragraph", "B"],
      ["unit", "$$z$$"],
    ]);
  });
  it("keeps inline code and inline comments inside a paragraph", () => {
    const t = "Use `code` here and %% side %% more\n\nB";
    expect(cut(t, para(t))[0]).toEqual(["paragraph", "Use `code` here and %% side %% more"]);
  });
  it("treats a line that opens a multi-line comment as a unit", () => {
    const t = "Start %% open\nstill\nend %%\n\nB";
    expect(cut(t, para(t))[0]).toEqual(["unit", "Start %% open\nstill\nend %%"]);
  });
  it("offsets are exact with CRLF", () => {
    const t = "One\r\ntwo\r\n\r\n---\r\n\r\nThree\r\n";
    const bs = para(t);
    expect(cut(t, bs)).toEqual([["paragraph", "One\r\ntwo"], ["break", "---"], ["paragraph", "Three"]]);
  });
});

describe("paragraphBlocks, single style", () => {
  it("makes every non-empty line a paragraph", () => {
    const t = "One\ntwo\n\nThree\nfour";
    expect(cut(t, para(t, "single"))).toEqual([
      ["paragraph", "One"],
      ["paragraph", "two"],
      ["paragraph", "Three"],
      ["paragraph", "four"],
    ]);
  });
  it("still keeps units whole", () => {
    const t = "A\n```\nx\ny\n```\nB";
    expect(cut(t, para(t, "single"))).toEqual([
      ["paragraph", "A"],
      ["unit", "```\nx\ny\n```"],
      ["paragraph", "B"],
    ]);
  });
  it("CRLF", () => {
    const t = "One\r\ntwo\r\n";
    expect(cut(t, para(t, "single"))).toEqual([["paragraph", "One"], ["paragraph", "two"]]);
  });
});

describe("sceneBlocks", () => {
  it("splits at breaks and trims blank lines", () => {
    const t = "A\n\nB\n\n---\n\nC\n";
    expect(cut(t, sceneBlocks(segment(t)))).toEqual([
      ["scene", "A\n\nB"],
      ["break", "---"],
      ["scene", "C"],
    ]);
  });
  it("is one scene without breaks, after frontmatter", () => {
    const t = "---\na: 1\n---\n\n# H\n\nText\n";
    expect(cut(t, sceneBlocks(segment(t)))).toEqual([["scene", "# H\n\nText"]]);
  });
  it("keeps a trailing break as a break block with no scene after", () => {
    const t = "A\n\n---\n\n";
    expect(cut(t, sceneBlocks(segment(t)))).toEqual([["scene", "A"], ["break", "---"]]);
  });
  it("ignores --- inside code and comments", () => {
    const t = "A\n\n```\n---\n```\n\n%% x\n\n---\n\n%%\n\nB";
    expect(sceneBlocks(segment(t)).map((b) => b.kind)).toEqual(["scene"]);
  });
  it("makes no scene between two adjacent breaks", () => {
    const t = "A\n\n---\n\n---\n\nB";
    expect(sceneBlocks(segment(t)).map((b) => b.kind)).toEqual(["scene", "break", "break", "scene"]);
  });
  it("is empty for empty text; CRLF offsets are exact", () => {
    expect(sceneBlocks(segment(""))).toEqual([]);
    const t = "A\r\n\r\n---\r\n\r\nB\r\n";
    expect(cut(t, sceneBlocks(segment(t)))).toEqual([["scene", "A"], ["break", "---"], ["scene", "B"]]);
  });
});

describe("groupAt, paragraph mode", () => {
  const t = "# H\n\nOne\ntwo\n\n%% beat: b %%\n\n---\n\nThree\n\nFour";
  const bs = para(t);
  it("finds the block under the cursor", () => {
    expect(groupAt(bs, cur(at(t, "One", 1)), "paragraph")).toEqual({ i: 1, j: 1 });
    expect(groupAt(bs, cur(at(t, "two", 3)), "paragraph")).toEqual({ i: 1, j: 1 });
    expect(groupAt(bs, cur(at(t, "# H")), "paragraph")).toEqual({ i: 0, j: 0 });
  });
  it("accepts the start and end offsets of a block", () => {
    expect(groupAt(bs, cur(bs[1].from), "paragraph")).toEqual({ i: 1, j: 1 });
    expect(groupAt(bs, cur(bs[1].to), "paragraph")).toEqual({ i: 1, j: 1 });
  });
  it("refuses a cursor inside a unit", () => {
    expect(groupAt(bs, cur(at(t, "beat", 2)), "paragraph")).toEqual({ refused: "inUnit" });
  });
  it("refuses a cursor on a break or in blank space", () => {
    expect(groupAt(bs, cur(at(t, "---", 1)), "paragraph")).toEqual({ refused: "noBlock" });
    expect(groupAt(bs, cur(at(t, "One") - 1), "paragraph")).toEqual({ refused: "noBlock" });
  });
  it("refuses when there are no blocks", () => {
    expect(groupAt([], cur(0), "paragraph")).toEqual({ refused: "noBlock" });
  });
  it("groups a selection over several paragraphs", () => {
    const sel = { anchor: at(t, "One"), head: at(t, "Three", 2) };
    // One/two, beat, break, Three: a unit in the middle goes along
    expect(groupAt(bs, sel, "paragraph")).toEqual({ i: 1, j: 4 });
  });
  it("uses the direction of the selection indifferently", () => {
    const a = at(t, "One");
    const b = at(t, "Three", 2);
    expect(groupAt(bs, { anchor: b, head: a }, "paragraph")).toEqual(groupAt(bs, { anchor: a, head: b }, "paragraph"));
  });
  it("does not count a block the selection only touches at its edge", () => {
    // whole-line selection of "One\ntwo" ending at the start of the next line
    const sel = { anchor: bs[1].from, head: bs[1].to + 1 };
    expect(groupAt(bs, sel, "paragraph")).toEqual({ i: 1, j: 1 });
  });
  it("refuses a selection that starts or ends in a unit", () => {
    const sel = { anchor: at(t, "One"), head: at(t, "beat", 1) };
    expect(groupAt(bs, sel, "paragraph")).toEqual({ refused: "inUnit" });
  });
  it("checks inUnit after the breaks are dropped from the ends", () => {
    const u = "A\n\n---\n\n%% beat: b %%\n\nB";
    const ub = para(u);
    const sel = { anchor: at(u, "---"), head: at(u, "B", 1) };
    expect(groupAt(ub, sel, "paragraph")).toEqual({ refused: "inUnit" });
  });
  it("trims breaks off the ends of a group", () => {
    const sel = { anchor: at(t, "---"), head: at(t, "Three", 2) };
    expect(groupAt(bs, sel, "paragraph")).toEqual({ i: 4, j: 4 });
  });
});

describe("groupAt, scene mode", () => {
  const t = "A1\n\nA2\n\n---\n\nB1\n\n---\n\nC";
  const bs = sceneBlocks(segment(t));
  it("finds the scene under the cursor, blank lines inside included", () => {
    expect(groupAt(bs, cur(at(t, "A2", 1)), "scene")).toEqual({ i: 0, j: 0 });
    expect(groupAt(bs, cur(at(t, "A1") + 3), "scene")).toEqual({ i: 0, j: 0 });
    expect(groupAt(bs, cur(at(t, "C")), "scene")).toEqual({ i: 4, j: 4 });
  });
  it("refuses on a break", () => {
    expect(groupAt(bs, cur(at(t, "---", 1)), "scene")).toEqual({ refused: "noBlock" });
  });
  it("groups scenes under a selection, breaks between them included", () => {
    const sel = { anchor: at(t, "A2"), head: at(t, "C", 1) };
    expect(groupAt(bs, sel, "scene")).toEqual({ i: 0, j: 4 });
  });
  it("a unit in a scene is not a refusal", () => {
    const u = "A\n\n%% beat: x %%\n\n---\n\nB";
    const sb = sceneBlocks(segment(u));
    expect(groupAt(sb, cur(u.indexOf("beat")), "scene")).toEqual({ i: 0, j: 0 });
  });
});

describe("inProperties", () => {
  const t = "---\nstatus: x\n---\n\nBody";
  const md = segment(t);
  it("is true in the frontmatter, including both fences", () => {
    expect(inProperties(md, cur(0))).toBe(true);
    expect(inProperties(md, cur(6))).toBe(true);
    expect(inProperties(md, cur(t.indexOf("---", 4) + 3))).toBe(true);
  });
  it("is false in the body and without frontmatter", () => {
    expect(inProperties(md, cur(t.indexOf("Body")))).toBe(false);
    expect(inProperties(segment("A\n\nB"), cur(0))).toBe(false);
  });
  it("is true when the selection starts in the properties", () => {
    expect(inProperties(md, { anchor: 5, head: t.length })).toBe(true);
  });
});
