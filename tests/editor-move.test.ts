import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { moveParagraph, moveScene, sameStructure, swap } from "../src/editor/move";
import { paragraphBlocks, groupAt, type MoveResult, type Sel } from "../src/editor/move-blocks";

const cur = (p: number): Sel => ({ anchor: p, head: p });
const at = (t: string, needle: string, k = 0) => t.indexOf(needle) + k;
function apply(text: string, r: MoveResult): { text: string; selection: Sel } {
  if (!("change" in r)) throw new Error("refused: " + r.refused);
  const c = r.change;
  return { text: text.slice(0, c.from) + c.insert + text.slice(c.to), selection: r.selection };
}
const refused = (r: MoveResult) => ("refused" in r ? r.refused : null);

describe("moveParagraph, blank style", () => {
  const t = "One\n\nTwo\ntwo\n\nThree";
  it("swaps down and the cursor goes along", () => {
    const r = apply(t, moveParagraph(segment(t), "blank", cur(at(t, "Two", 1)), "down"));
    expect(r.text).toBe("One\n\nThree\n\nTwo\ntwo");
    expect(r.selection).toEqual(cur(r.text.indexOf("Two") + 1));
  });
  it("swaps up and the cursor goes along", () => {
    const r = apply(t, moveParagraph(segment(t), "blank", cur(at(t, "Two", 1)), "up"));
    expect(r.text).toBe("Two\ntwo\n\nOne\n\nThree");
    expect(r.selection).toEqual(cur(1));
  });
  it("keeps the length and the separator", () => {
    const r = moveParagraph(segment(t), "blank", cur(at(t, "One")), "down");
    if (!("change" in r)) throw new Error();
    expect(r.change.insert.length).toBe(r.change.to - r.change.from);
  });
  it("is silent at the edges", () => {
    expect(refused(moveParagraph(segment(t), "blank", cur(0), "up"))).toBe("edge");
    expect(refused(moveParagraph(segment(t), "blank", cur(t.length), "down"))).toBe("edge");
  });
  it("keeps a selection's direction and maps both ends", () => {
    const a = at(t, "Two", 1);
    const b = at(t, "two", 2);
    const r = apply(t, moveParagraph(segment(t), "blank", { anchor: b, head: a }, "down"));
    expect(r.text).toBe("One\n\nThree\n\nTwo\ntwo");
    expect(r.selection.head).toBe(r.text.indexOf("Two") + 1);
    expect(r.selection.anchor).toBe(r.text.lastIndexOf("two") + 2);
    expect(r.selection.anchor).toBeGreaterThan(r.selection.head);
  });
  it("moves a group of paragraphs as one", () => {
    const u = "A\n\nB\n\nC\n\nD";
    const r = apply(u, moveParagraph(segment(u), "blank", { anchor: at(u, "B"), head: at(u, "C", 1) }, "down"));
    expect(r.text).toBe("A\n\nD\n\nB\n\nC");
  });
  it("moves headings like blocks", () => {
    const u = "# H\n\nText";
    expect(apply(u, moveParagraph(segment(u), "blank", cur(1), "down")).text).toBe("Text\n\n# H");
  });
});

describe("moveParagraph, single style", () => {
  it("moves one line at a time", () => {
    const t = "A\nB\nC";
    expect(apply(t, moveParagraph(segment(t), "single", cur(at(t, "B")), "down")).text).toBe("A\nC\nB");
    expect(apply(t, moveParagraph(segment(t), "single", cur(at(t, "B")), "up")).text).toBe("B\nA\nC");
  });
});

describe("moveParagraph, units, breaks and refusals", () => {
  it("steps over a beat as one neighbour", () => {
    const t = "A\n\n%% beat: x %%\n\nB";
    expect(apply(t, moveParagraph(segment(t), "blank", cur(0), "down")).text).toBe("%% beat: x %%\n\nA\n\nB");
  });
  it("steps over a comment and a code block", () => {
    const t = "A\n\n```\ncode\n```\n\nB";
    expect(apply(t, moveParagraph(segment(t), "blank", cur(at(t, "B")), "up")).text).toBe("A\n\nB\n\n```\ncode\n```");
  });
  it("refuses a cursor inside a unit", () => {
    const t = "A\n\n%% beat: x %%\n\nB";
    expect(refused(moveParagraph(segment(t), "blank", cur(at(t, "beat")), "down"))).toBe("inUnit");
  });
  it("crosses a scene break", () => {
    const t = "X\n\nA\n\n---\n\nB";
    const r = apply(t, moveParagraph(segment(t), "blank", cur(at(t, "A")), "down"));
    expect(r.text).toBe("X\n\n---\n\nA\n\nB");
  });
  it("refuses as unsafe when a break would land on the first line (frontmatter)", () => {
    const t = "A\n\n---\n\nB";
    expect(refused(moveParagraph(segment(t), "blank", cur(0), "down"))).toBe("unsafe");
  });
  it("treats the trailing break as a wall", () => {
    const t = "A\n\nB\n\n---";
    expect(refused(moveParagraph(segment(t), "blank", cur(at(t, "B")), "down"))).toBe("edge");
  });
  it("refuses in the properties", () => {
    const t = "---\nstatus: x\n---\n\nA\n\nB";
    expect(refused(moveParagraph(segment(t), "blank", cur(5), "down"))).toBe("properties");
  });
  it("refuses with noBlock on a break or an empty note", () => {
    const t = "A\n\n---\n\nB";
    expect(refused(moveParagraph(segment(t), "blank", cur(at(t, "---", 1)), "down"))).toBe("noBlock");
    expect(refused(moveParagraph(segment(""), "blank", cur(0), "down"))).toBe("noBlock");
  });
  it("never moves into the properties", () => {
    const t = "---\nstatus: x\n---\n\nA\n\nB";
    expect(refused(moveParagraph(segment(t), "blank", cur(at(t, "A")), "up"))).toBe("edge");
  });
  it("moves a glued beat along with its prose (Q31)", () => {
    const t = "%% beat: x %%\nProse\n\nOther";
    const r = apply(t, moveParagraph(segment(t), "blank", cur(at(t, "Prose")), "down"));
    expect(r.text).toBe("Other\n\n%% beat: x %%\nProse");
    expect(refused(moveParagraph(segment(t), "blank", cur(at(t, "beat")), "down"))).toBe("inUnit");
  });
  it("refuses to move the last scene's only paragraph up over a break", () => {
    const t = "A\n\n---\n\nB";
    expect(refused(moveParagraph(segment(t), "blank", cur(at(t, "B")), "up"))).toBe("edge");
  });
  const glued = [
    "%% beat: x %%\nB",
    "# H\nB",
    "```\ncode\n```\nB",
    "%% note %%\nB",
    "%% XXX: fix %%\nB",
    "$$\nx\n$$\nB",
    "B\n%% beat: x %%",
    "B\n# H",
    "B\n```\ncode\n```",
    "B\n$$\nx\n$$",
  ];
  for (const g of glued) {
    it(`round-trips around a glued run ${JSON.stringify(g)}`, () => {
      for (const t of [`A\n\n${g}\n\nC`, `A\n\n${g}`, `${g}\n\nC`]) {
        for (const who of ["A", "C"]) {
          if (!t.includes(who)) continue;
          for (const [d, back] of [["down", "up"], ["up", "down"]] as const) {
            const r = moveParagraph(segment(t), "blank", cur(at(t, who)), d);
            if (!("change" in r)) continue;
            const one = apply(t, r);
            const again = apply(one.text, moveParagraph(segment(one.text), "blank", one.selection, back));
            expect(again.text).toBe(t);
            expect(again.selection).toEqual(cur(at(t, who)));
          }
        }
      }
    });
  }
});

describe("moveScene", () => {
  const t = "A1\n\nA2\n\n---\n\nB\n\n---\n\nC";
  it("swaps a scene with the next one across the break", () => {
    const r = apply(t, moveScene(segment(t), cur(at(t, "A2")), "down"));
    expect(r.text).toBe("B\n\n---\n\nA1\n\nA2\n\n---\n\nC");
    expect(r.selection).toEqual(cur(r.text.indexOf("A2")));
  });
  it("swaps up", () => {
    const r = apply(t, moveScene(segment(t), cur(at(t, "C")), "up"));
    expect(r.text).toBe("A1\n\nA2\n\n---\n\nC\n\n---\n\nB");
  });
  it("is silent at the edges, trailing break included", () => {
    expect(refused(moveScene(segment(t), cur(0), "up"))).toBe("edge");
    const u = "A\n\n---\n\nB\n\n---";
    expect(refused(moveScene(segment(u), cur(at(u, "B")), "down"))).toBe("edge");
  });
  it("refuses in the properties and on a break", () => {
    const u = "---\nstatus: x\n---\n\nA\n\n---\n\nB";
    expect(refused(moveScene(segment(u), cur(2), "down"))).toBe("properties");
    expect(refused(moveScene(segment(t), cur(at(t, "---", 1)), "down"))).toBe("noBlock");
  });
  it("carries a beat inside the scene", () => {
    const u = "A\n\n%% beat: x %%\n\n---\n\nB";
    expect(apply(u, moveScene(segment(u), cur(0), "down")).text).toBe("B\n\n---\n\nA\n\n%% beat: x %%");
  });
});

describe("swap", () => {
  it("returns edge when there is no neighbour", () => {
    const t = "A";
    const md = segment(t);
    const bs = paragraphBlocks(md, "blank");
    expect(refused(swap(md, bs, { i: 0, j: 0 }, "down", cur(0)))).toBe("edge");
  });
  it("works on a group computed by groupAt", () => {
    const t = "A\n\nB\n\nC";
    const md = segment(t);
    const bs = paragraphBlocks(md, "blank");
    const g = groupAt(bs, cur(at(t, "C")), "paragraph");
    if ("refused" in g) throw new Error();
    expect(apply(t, swap(md, bs, g, "up", cur(at(t, "C")))).text).toBe("A\n\nC\n\nB");
  });
});

describe("sameStructure", () => {
  const md = segment("A\n\nB");
  const ch = (t: string) => ({ from: 0, to: t.length, insert: t });
  it("accepts a plain permutation", () => {
    expect(sameStructure(md, ch("B\n\nA"), "B\n\nA")).toBe(true);
  });
  it("rejects a comment that loses its pair", () => {
    const m = segment("%% a %%\nx\n\n%% b %%");
    expect(sameStructure(m, ch("x"), "%% a\nx\n\n%% b %%")).toBe(false);
  });
  it("rejects an html comment that loses its pair", () => {
    const m = segment("<!-- a -->\n\nB");
    expect(sameStructure(m, ch("x"), "B\n\n<!-- a")).toBe(false);
  });
  it("rejects a break turning into frontmatter", () => {
    const m = segment("A\n\n---\n\nB");
    expect(sameStructure(m, ch("x"), "---\nA\n---\n\nB")).toBe(false);
  });
  it("rejects a break turning into a setext underline", () => {
    const m = segment("A\n\n---\nB");
    expect(sameStructure(m, ch("x"), "A\n---\n\nB")).toBe(false);
  });
  it("rejects $$ parity changes", () => {
    const m = segment("$$\nx\n$$\n\nB");
    expect(sameStructure(m, ch("x"), "$$\nx\n\nB")).toBe(false);
  });
});

describe("round trips", () => {
  const conto = [
    "---", "status: rascunho", "---", "", "# Title", "", "First para", "continues here.", "",
    "%% beat: storm %%", "", "Prose after the beat.", "", "Second para.", "", "---", "", "Scene two opens.",
    "", "```", "code", "```", "", "%% XXX: check %%", "", "Closing line.", "", "---", "", "Coda.", "",
  ];
  for (const eol of ["\n", "\r\n"]) {
    for (const style of ["single", "blank"] as const) {
      it(`down n then up n restores the bytes (${JSON.stringify(eol)}, ${style})`, () => {
        const original = conto.join(eol);
        let text = original;
        let pos = text.indexOf("First") + 1;
        let n = 0;
        for (; n < 40; n++) {
          const r = moveParagraph(segment(text), style, cur(pos), "down");
          if (!("change" in r)) break;
          const a = apply(text, r);
          expect(a.text.length).toBe(text.length);
          text = a.text;
          pos = a.selection.head;
        }
        expect(n).toBeGreaterThan(0);
        for (let k = 0; k < n; k++) {
          const r = moveParagraph(segment(text), style, cur(pos), "up");
          const a = apply(text, r);
          text = a.text;
          pos = a.selection.head;
        }
        expect(text).toBe(original);
      });
    }
    it(`scenes round trip (${JSON.stringify(eol)})`, () => {
      const original = conto.join(eol);
      let text = original;
      let pos = text.indexOf("First");
      let n = 0;
      for (; n < 10; n++) {
        const r = moveScene(segment(text), cur(pos), "down");
        if (!("change" in r)) break;
        const a = apply(text, r);
        text = a.text;
        pos = a.selection.head;
      }
      expect(n).toBe(2);
      for (let k = 0; k < n; k++) {
        const a = apply(text, moveScene(segment(text), cur(pos), "up"));
        text = a.text;
        pos = a.selection.head;
      }
      expect(text).toBe(original);
    });
  }
});
