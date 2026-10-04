import { describe, expect, it } from "vitest";
import { ChangeSet } from "@codemirror/state";
import { compileTerms, findNames, EMPTY_TABLE, type NameSource } from "../src/core/names";
import { segment } from "../src/core/markdown";
import { readerMask } from "../src/core/wordcount";
import {
  dirtyParagraphs, hasMarks, mapDirty, mapMarks, markableTable, marksOf, paragraphAt, rematch, visibleMarks,
} from "../src/universe/name-marks-model";

const src = (id: string, name: string, aliases: string[] = [], over: Partial<NameSource> = {}): NameSource => ({
  id, name, aliases, person: true, firstName: true, caseSensitive: false, ignore: [], ...over,
});
const table = compileTerms(
  [src("m.md", "Mariana", ["a menina"]), src("t.md", "Teodoro", ["Teo"]), src("l.md", "Dona Lurdes", [], { person: false })],
  { lang: "pt", extraTitles: [] },
);
const maskOf = (text: string) => readerMask(segment(text));
const marked = (text: string, tb = table) => {
  const mask = maskOf(text);
  return marksOf(findNames(mask, markableTable(tb), 0, mask.length)).map((r) => text.slice(r.from, r.to));
};

describe("which names are marked (Q38)", () => {
  it("marks capitalized names, aliases and derived terms", () => {
    expect(marked("Mariana viu Teo e Teodoro com Dona Lurdes.")).toEqual(["Mariana", "Teo", "Teodoro", "Dona Lurdes"]);
  });

  it("does not mark a lowercase alias, even capitalized at a sentence start", () => {
    expect(marked("A menina riu. A Menina saiu.")).toEqual([]);
    expect(marked("Mariana e a menina.")).toEqual(["Mariana"]);
  });

  it("nothing for an empty table", () => {
    expect(hasMarks(EMPTY_TABLE)).toBe(false);
    expect(marked("Mariana", EMPTY_TABLE)).toEqual([]);
  });

  it("a table with only lowercase aliases has nothing to mark", () => {
    const t = compileTerms([src("c.md", "menino", [], { person: false })], { lang: "pt", extraTitles: [] });
    expect(hasMarks(t)).toBe(false);
  });

  it("is cached per table", () => {
    expect(markableTable(table)).toBe(markableTable(table));
  });
});

describe("marks through edits", () => {
  const map = (changes: ChangeSet) => (p: number, a: -1 | 1) => changes.mapPos(p, a);

  it("shifts on an insertion before, keeps the edges on one beside", () => {
    const ch = ChangeSet.of([{ from: 0, insert: "xx" }, { from: 7, insert: "!" }], 10);
    expect(mapMarks([{ from: 0, to: 7 }, { from: 8, to: 10 }], map(ch))).toEqual([{ from: 2, to: 9 }, { from: 11, to: 13 }]);
  });

  it("widens on an insertion inside a mark", () => {
    const ch = ChangeSet.of([{ from: 3, insert: "zz" }], 10);
    expect(mapMarks([{ from: 0, to: 7 }], map(ch))).toEqual([{ from: 0, to: 9 }]);
  });

  it("shifts on a deletion and drops a mark the deletion emptied", () => {
    const ch = ChangeSet.of([{ from: 0, to: 3 }, { from: 8, to: 10 }], 12);
    expect(mapMarks([{ from: 3, to: 6 }, { from: 8, to: 10 }], map(ch))).toEqual([{ from: 0, to: 3 }]);
  });

  it("dirty ranges survive a deletion without shrinking away", () => {
    const ch = ChangeSet.of([{ from: 2, to: 4 }], 10);
    expect(mapDirty([{ from: 2, to: 4 }], map(ch))).toEqual([{ from: 2, to: 2 }]);
  });
});

describe("visible window", () => {
  const marks = [{ from: 0, to: 5 }, { from: 20, to: 25 }, { from: 40, to: 45 }];
  it("keeps the marks that touch a window", () => {
    expect(visibleMarks(marks, [{ from: 18, to: 30 }])).toEqual([marks[1]]);
    expect(visibleMarks(marks, [{ from: 0, to: 3 }, { from: 44, to: 60 }])).toEqual([marks[0], marks[2]]);
  });
  it("drops marks that only touch the edge, and everything for no window", () => {
    expect(visibleMarks(marks, [{ from: 5, to: 20 }])).toEqual([]);
    expect(visibleMarks(marks, [])).toEqual([]);
  });
});

describe("paragraphs", () => {
  const text = "um dois\ntres\n\nquatro\n \ncinco seis";
  it("finds the run of non-blank lines", () => {
    expect(paragraphAt(text, 2)).toEqual({ from: 0, to: 12 });
    expect(paragraphAt(text, 15)).toEqual({ from: 14, to: 20 });
    expect(paragraphAt(text, text.length)).toEqual({ from: 23, to: text.length });
  });
  it("merges dirty ranges in one paragraph", () => {
    expect(dirtyParagraphs(text, [{ from: 1, to: 2 }, { from: 9, to: 10 }])).toEqual([{ from: 0, to: 12 }]);
  });
});

describe("re-matching only what changed", () => {
  it("a typing pause re-matches the changed paragraph, never the whole note", () => {
    const before = "Mariana desceu.\n\nTeo esperou.\n\nNinguém aqui.";
    const after = "Mariana desceu.\n\nTeo esperou Mariana.\n\nNinguém aqui.";
    const mask0 = maskOf(before);
    const marks0 = marksOf(findNames(mask0, markableTable(table)));
    expect(marks0.map((r) => before.slice(r.from, r.to))).toEqual(["Mariana", "Teo"]);

    const mask = maskOf(after);
    const calls: [number, number][] = [];
    const find = (from: number, to: number) => {
      calls.push([from, to]);
      return findNames(mask, markableTable(table), from, to);
    };
    const at = before.indexOf("esperou") + "esperou".length;
    const ch = ChangeSet.of([{ from: at, insert: " Mariana" }], before.length);
    const mapped = mapMarks(marks0, (p, a) => ch.mapPos(p, a));
    const next = rematch(mapped, mask, [{ from: at, to: at + 8 }], find);

    expect(calls).toHaveLength(1);
    const [from, to] = calls[0];
    expect(after.slice(from, to)).toBe("Teo esperou Mariana.");
    expect(next.map((r) => after.slice(r.from, r.to))).toEqual(["Mariana", "Teo", "Mariana"]);
  });

  it("takes a mark off a paragraph that no longer has the name, and keeps the others", () => {
    const text = "Mariana ria.\n\nTeo saiu.";
    const marks = marksOf(findNames(maskOf(text), markableTable(table)));
    const after = "ria.\n\nTeo saiu.";
    const mask = maskOf(after);
    const ch = ChangeSet.of([{ from: 0, to: 8 }], text.length);
    const mapped = mapMarks(marks, (p, a) => ch.mapPos(p, a));
    const next = rematch(mapped, mask, [{ from: 0, to: 0 }], (f, t) => findNames(mask, markableTable(table), f, t));
    expect(next.map((r) => after.slice(r.from, r.to))).toEqual(["Teo"]);
  });

  it("no dirty ranges, no matching", () => {
    let called = 0;
    const marks = [{ from: 0, to: 3 }];
    expect(rematch(marks, "abc", [], () => { called++; return []; })).toEqual(marks);
    expect(called).toBe(0);
  });
});
