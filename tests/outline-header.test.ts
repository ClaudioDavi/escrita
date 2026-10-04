import { beforeAll, describe, expect, it } from "vitest";
import { registerStrings } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { outlineStrings } from "../src/outline/strings";
import { noteProgress, type Counts, type Piece } from "../src/core/measure";
import { DEFAULT_STAGES, type Stage } from "../src/core/stages";
import { barModel } from "../src/outline/bar";
import { headerModel, fitPovChips, povCss, pruneFilter, summaryText, visiblePovChips } from "../src/outline/header";
import type { ChapterRow } from "../src/outline/rows";

beforeAll(() => { registerStrings(coreStrings); registerStrings(outlineStrings); });

const stages = {
  ...DEFAULT_STAGES,
  draft: { ...DEFAULT_STAGES.draft, words: "rascunho" },
  revision: { ...DEFAULT_STAGES.revision, words: "revisão" },
};

function row(status: string, stage: Stage | null, pov: string | null = null): ChapterRow {
  return {
    path: "x.md", index: 0, label: "1", title: "t", summary: "", status, stage,
    pov: pov ? { key: pov, label: pov.toUpperCase(), path: pov === "maria" ? "Maria.md" : null } : null,
    piece: null, pieceSource: null, unit: "words", words: 0, count: 0, progress: null,
    beats: [], placeholders: 0, bodyBlank: false,
  };
}

describe("headerModel", () => {
  const rows = [
    row("rascunho", "draft", "maria"), row("revisão", "revision", "teo"), row("rascunho", "draft", "maria"),
    row("", null), row("esboço", null, "lurdes"),
  ];
  const m = headerModel(rows, stages, (w) => (w === "rascunho" ? "#888" : undefined), { maria: "orange", teo: "blue" });

  it("has one stage chip per stage present, then unknown words, never one for no status", () => {
    expect(m.stages.map((c) => [c.key, c.label, c.color])).toEqual([
      ["draft", "rascunho", "#888"], ["revision", "revisão", null], ["other:esboço", "esboço", null],
    ]);
  });
  it("has one POV chip per POV, in order, with the palette colour as a theme variable", () => {
    expect(m.povs.map((c) => [c.key, c.label, c.color, c.path])).toEqual([
      ["maria", "MARIA", povCss("orange"), "Maria.md"], ["teo", "TEO", "var(--color-blue)", null], ["lurdes", "LURDES", null, null],
    ]);
  });
  it("tells the summary in the writer's words, no status last", () => {
    expect(summaryText(5, m.tally)).toBe("5 chapters · 2 rascunho · 1 revisão · 1 esboço · 1 no status");
  });
});

describe("pruneFilter", () => {
  it("drops keys no chip offers any more", () => {
    const m = headerModel([row("rascunho", "draft", "maria")], stages, () => undefined, {});
    const f = { stages: new Set(["draft", "ready"]), povs: new Set(["maria", "gone"]) };
    expect(pruneFilter(m, f)).toBe(true);
    expect([...f.stages]).toEqual(["draft"]);
    expect([...f.povs]).toEqual(["maria"]);
    expect(pruneFilter(m, f)).toBe(false);
  });
});

describe("visiblePovChips", () => {
  const chips = ["a", "b", "c", "d", "e", "f"].map((key) => ({ key, label: key, color: null, path: null }));
  it("caps at four, keeps selected ones, expands on request", () => {
    expect(visiblePovChips(chips, new Set(), false).map((c) => c.key)).toEqual(["a", "b", "c", "d"]);
    expect(visiblePovChips(chips, new Set(["f"]), false).map((c) => c.key)).toEqual(["a", "b", "c", "d", "f"]);
    expect(visiblePovChips(chips, new Set(), true)).toHaveLength(6);
    expect(visiblePovChips(chips.slice(0, 4), new Set(), false)).toHaveLength(4);
  });
});

describe("barModel", () => {
  const counts = (words: number): Counts => ({ words, characters: words * 6, charactersNoSpaces: words * 5 } as Counts);
  const model = (words: number, piece: Piece | null, own = false) =>
    barModel(piece ? noteProgress(counts(words), piece) : null, words, piece, "words", own);
  const target = (n: number, limit?: number): Piece => ({ unit: "words", target: n, ...(limit ? { limit } : {}) });

  it("has no bar without a target or limit", () => {
    expect(model(500, null)).toBeNull();
    expect(model(500, { unit: "words" })).toBeNull();
  });
  it("is part, met and over by the goals tile's rules", () => {
    expect(model(1120, target(2000))!.state).toBe("part");
    expect(model(2210, target(2000))!.state).toBe("met");
    expect(model(2640, target(2000, 2500))!.state).toBe("over");
  });
  it("is near the limit from 95% of it, with a limit mark on the way", () => {
    const m = model(2380, target(2000, 2500))!;
    expect(m.state).toBe("near");
    expect(m.limitMark).toBeNull();   // the limit is the bar's end, so no mark
    expect(m.targetMark).toBeCloseTo(0.8, 5);
    expect(model(1500, target(2000, 3000))!.limitMark).toBeNull();
    expect(model(1500, target(2000, 4000))!.limitMark).toBeNull();
  });
  it("writes the value, the limit, the overshoot and where the target came from", () => {
    expect(model(1840, target(2000))!.label).toBe("1,840 / 2,000 words");
    expect(model(2380, target(2000, 2500))!.label).toBe("2,380 / 2,000 words · limit 2,500");
    expect(model(2640, target(2000, 2500))!.label).toBe("2,640 / 2,000 words · 140 over the limit");
    expect(model(640, target(1500), true)!.label).toBe("640 / 1,500 words · chapter target");
    expect(model(640, target(1500), true)!.value).toBe("640 / 1,500 words");
  });
  it("marks the target when a larger limit sets the scale", () => {
    const m = model(1000, target(2000, 4000))!;
    expect(m.targetMark).toBeCloseTo(0.5, 5);
    expect(m.fill).toBeCloseTo(0.25, 5);
  });
});

describe("fitPovChips", () => {
  /** a chip that wraps to row 1 once `perRow` chips before it are showing */
  function fake(perRow: number, n: number) {
    const hiddenSet = new Set<number>();
    const chips = Array.from({ length: n }, (_, i) => ({
      get offsetTop() { return visibleBefore(i) >= perRow ? 30 : 0; },
      hasClass: () => hiddenSet.has(i),
      toggleClass: (_c: string, on: boolean) => { if (on) hiddenSet.add(i); else hiddenSet.delete(i); },
    }));
    const visibleBefore = (i: number) => [...Array(i).keys()].filter((j) => !hiddenSet.has(j)).length;
    let moreHidden = true;
    let text = "";
    const more = {
      get offsetTop() { return visibleBefore(n) >= perRow ? 30 : 0; },
      toggleClass: (_c: string, on: boolean) => { moreHidden = on; },
      setText: (v: string) => { text = v; },
      setAttr: () => {},
    };
    return { chips, more, hiddenSet, state: () => ({ moreHidden, text }) };
  }
  const input = (f: ReturnType<typeof fake>, over: object = {}) => ({
    group: { clientWidth: 260 } as unknown as HTMLElement,
    chips: f.chips as unknown as HTMLElement[], more: f.more as unknown as HTMLElement,
    keys: f.chips.map((_, i) => `k${i}`), selected: new Set<string>(), expanded: false, fallback: new Set<string>(), ...over,
  });

  beforeAll(() => registerStrings(outlineStrings));

  it("shows everything when it fits", () => {
    const f = fake(5, 3);
    fitPovChips(input(f));
    expect(f.hiddenSet.size).toBe(0);
    expect(f.state().moreHidden).toBe(true);
  });
  it("collapses to +N by the room, leaving space for the button", () => {
    const f = fake(3, 6);
    fitPovChips(input(f));
    expect([...f.hiddenSet].sort()).toEqual([2, 3, 4, 5]);
    expect(f.state().moreHidden).toBe(false);
    expect(f.state().text).toBe("+4");
  });
  it("never hides a selected chip", () => {
    const f = fake(3, 6);
    fitPovChips(input(f, { selected: new Set(["k5"]) }));
    expect(f.hiddenSet.has(5)).toBe(false);
  });
});
