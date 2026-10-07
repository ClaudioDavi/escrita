import { describe, expect, it } from "vitest";
import {
  POV_PALETTE, assignColors, canReorder, cleanPovColors, filterActive, hiddenByFilter, povValue, renamePovKey,
  rowMatches, statusTally, type PovColor, type RowFilter,
} from "../src/outline/pov";
import type { ChapterRow } from "../src/outline/rows";
import { vi } from "vitest";
import { OutlineModule } from "../src/outline";
import { fakePlugin } from "./support/fake-plugin";
import { DEFAULT_STAGES, type Stage } from "../src/core/stages";

const stages = {
  ...DEFAULT_STAGES,
  draft: { ...DEFAULT_STAGES.draft, words: "rascunho" },
  revision: { ...DEFAULT_STAGES.revision, words: "revisão\nrevision" },
};

function row(status: string, stage: Stage | null, pov: string | null = null): ChapterRow {
  return {
    path: "x.md", index: 0, label: "1", title: "t", summary: "", status, stage,
    pov: pov ? { key: pov, label: pov, path: null } : null,
    piece: null, pieceSource: null, unit: "words", words: 0, count: 0, progress: null,
    beats: [], placeholders: 0, bodyBlank: false,
  };
}
const filter = (stagesSet: string[] = [], povs: string[] = []): RowFilter => ({ stages: new Set(stagesSet), povs: new Set(povs) });

describe("povValue", () => {
  const resolve = (l: string) => (l === "Maria" ? { path: "Characters/Maria.md", name: "Maria" } : null);
  it("keys a link by the resolved note, whatever the form", () => {
    for (const v of ["[[Maria]]", "[[Maria|Mari]]", "Maria", ["[[Maria#h]]", "x"]]) {
      expect(povValue(v, resolve)).toEqual({ key: "Characters/Maria.md", label: "Maria", path: "Characters/Maria.md" });
    }
  });
  it("keys unresolved text by its folded form, keeping the label", () => {
    const a = povValue("Inês", resolve)!, b = povValue("[[Ines]]", resolve)!;
    expect(a.key).toBe(b.key);
    expect(a).toMatchObject({ label: "Inês", path: null });
    expect(b.label).toBe("Ines");
  });
  it("gives null for nothing", () => {
    for (const v of [undefined, null, "", "  ", [], 3, "[[ ]]"]) expect(povValue(v, resolve)).toBeNull();
  });
});

describe("assignColors", () => {
  it("assigns in order of first appearance and reports additions", () => {
    const s: Record<string, PovColor> = {};
    expect(assignColors(["a", "b"], s)).toBe(true);
    expect(s).toEqual({ a: "red", b: "orange" });
  });
  it("is stable across calls and orders, and never reassigns", () => {
    const s: Record<string, PovColor> = {};
    assignColors(["a", "b"], s);
    expect(assignColors(["b", "a"], s)).toBe(false);
    expect(assignColors(["c", "a"], s)).toBe(true);
    expect(s).toEqual({ a: "red", b: "orange", c: "yellow" });
  });
  it("fills a gap left by a colour no key uses", () => {
    const s: Record<string, PovColor> = { a: "red", b: "yellow" };
    assignColors(["c"], s);
    expect(s.c).toBe("orange");
  });
  it("repeats after eight", () => {
    const s: Record<string, PovColor> = {};
    assignColors(Array.from({ length: 10 }, (_, i) => `k${i}`), s);
    expect(s.k8).toBe(POV_PALETTE[0]);
    expect(s.k9).toBe(POV_PALETTE[1]);
    expect(s.k0).toBe("red");
  });
});

describe("cleanPovColors", () => {
  it("drops bad values and bad shapes", () => {
    expect(cleanPovColors({ a: "red", b: "mauve", c: 3, d: null, e: "pink" })).toEqual({ a: "red", e: "pink" });
    for (const r of [undefined, null, "red", 4, ["red"]]) expect(cleanPovColors(r)).toEqual({});
  });
});

describe("renamePovKey", () => {
  it("moves the colour", () => {
    const s: Record<string, PovColor> = { "a.md": "blue" };
    expect(renamePovKey(s, "a.md", "b.md")).toBe(true);
    expect(s).toEqual({ "b.md": "blue" });
  });
  it("does nothing for an unknown key or the same path", () => {
    const s: Record<string, PovColor> = { "a.md": "blue" };
    expect(renamePovKey(s, "z.md", "b.md")).toBe(false);
    expect(renamePovKey(s, "a.md", "a.md")).toBe(false);
    expect(s).toEqual({ "a.md": "blue" });
  });
  it("keeps the target's own colour on a clash", () => {
    const s: Record<string, PovColor> = { "a.md": "blue", "b.md": "red" };
    renamePovKey(s, "a.md", "b.md");
    expect(s).toEqual({ "b.md": "red" });
  });
});

describe("statusTally", () => {
  it("counts by stage in stage order with the writer's word", () => {
    const rows = [row("revision", "revision"), row("Rascunho", "draft"), row("rascunho", "draft"), row("revisão", "revision")];
    expect(statusTally(rows, stages)).toEqual([
      { stage: "draft", word: "rascunho", n: 2 },
      { stage: "revision", word: "revisão", n: 2 },
    ]);
  });
  it("puts unknown statuses after the stages and no status last", () => {
    const rows = [row("", null), row("xyz", null), row("rascunho", "draft"), row("XYZ", null), row("abc", null)];
    expect(statusTally(rows, stages)).toEqual([
      { stage: "draft", word: "rascunho", n: 1 },
      { stage: null, word: "xyz", n: 2 },
      { stage: null, word: "abc", n: 1 },
      { stage: null, word: "", n: 1 },
    ]);
  });
  it("is empty for no rows", () => expect(statusTally([], stages)).toEqual([]));
});

describe("rowMatches", () => {
  const a = row("rascunho", "draft", "maria");
  const b = row("pronto", "ready", "joao");
  const c = row("xyz", null);
  it("matches everything with no filter", () => {
    for (const r of [a, b, c]) expect(rowMatches(r, filter())).toBe(true);
  });
  it("ORs within a group", () => {
    expect(rowMatches(a, filter(["draft", "ready"]))).toBe(true);
    expect(rowMatches(b, filter(["draft", "ready"]))).toBe(true);
    expect(rowMatches(a, filter([], ["maria", "joao"]))).toBe(true);
    expect(rowMatches(c, filter([], ["maria", "joao"]))).toBe(false);
  });
  it("ANDs across groups", () => {
    expect(rowMatches(a, filter(["draft"], ["maria"]))).toBe(true);
    expect(rowMatches(a, filter(["draft"], ["joao"]))).toBe(false);
    expect(rowMatches(a, filter(["ready"], ["maria"]))).toBe(false);
  });
  it("matches other statuses by word, and never a row with no status or POV", () => {
    expect(rowMatches(c, filter(["other:xyz"]))).toBe(true);
    expect(rowMatches(c, filter(["other:abc"]))).toBe(false);
    expect(rowMatches(row("", null), filter(["draft"]))).toBe(false);
  });
});

describe("canReorder", () => {
  it("is false whenever a filter is on", () => {
    expect(canReorder(filter())).toBe(true);
    expect(filterActive(filter())).toBe(false);
    expect(canReorder(filter(["draft"]))).toBe(false);
    expect(canReorder(filter([], ["maria"]))).toBe(false);
    expect(canReorder(filter(["draft"], ["maria"]))).toBe(false);
  });
});

describe("hiddenByFilter", () => {
  it("is true only for a chapter the filter hides", () => {
    const draft = row("rascunho", "draft", "maria");
    expect(hiddenByFilter(draft, filter())).toBe(false);
    expect(hiddenByFilter(draft, filter(["draft"]))).toBe(false);
    expect(hiddenByFilter(draft, filter(["revision"]))).toBe(true);
    expect(hiddenByFilter(draft, filter([], ["joao"]))).toBe(true);
    expect(hiddenByFilter(undefined, filter(["revision"]))).toBe(false);
  });
});

describe("OutlineModule data followers and colorsFor", () => {
  function setup(colors: Record<string, PovColor> = {}) {
    const plugin = fakePlugin();
    plugin.data.povColors = colors;
    const save = vi.fn();
    plugin.requestSave = Object.assign(save, { cancel: () => {} });
    const mod = new OutlineModule(plugin.asPlugin);
    const [f] = mod.dataFollowers();
    return { plugin, mod, f, save };
  }
  it("moves the colour on a rename, without the module being loaded", () => {
    const { plugin, f, save } = setup({ "Characters/Maria.md": "blue" });
    f.moved!("Characters/Maria.md", "People/Maria.md");
    expect(plugin.data.povColors).toEqual({ "People/Maria.md": "blue" });
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("keeps the colour when the note is deleted", () => {
    const { plugin, f, save } = setup({ "a.md": "blue" });
    f.deleted!("a.md");   // 0.9: the follower now also drops "Read the book" positions, never colours
    expect(plugin.data.povColors).toEqual({ "a.md": "blue" });
    expect(save).not.toHaveBeenCalled();
  });
  it("saves only when a rename changed something", () => {
    const { f, save } = setup({ "a.md": "blue" });
    f.moved!("z.md", "y.md");
    expect(save).not.toHaveBeenCalled();
  });
  it("colorsFor assigns, returns the colours and saves only on a new key", () => {
    const { plugin, mod, save } = setup();
    expect(mod.colorsFor(["a", "b"])).toEqual({ a: "red", b: "orange" });
    expect(plugin.data.povColors).toEqual({ a: "red", b: "orange" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(mod.colorsFor(["b", "a"])).toEqual({ a: "red", b: "orange" });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
