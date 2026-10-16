import { describe, expect, it } from "vitest";
import { formatsFor, isScreenplayFormat, PROSE_FORMATS, SCREENPLAY_FORMATS } from "../src/core/export-formats";
import { fountainOptions } from "../src/core/fountain";
import { screenplayPreset } from "../src/core/screenplay-presets";

// PLAN-1.1 Q3, Q4: the contracts Wave 1 builds on.

describe("formatsFor", () => {
  it("a single screenplay note offers PDF then Fountain; anything else the prose formats", () => {
    expect(formatsFor({ single: true, form: "screenplay" })).toEqual(["pdf", "fountain"]);
    expect(formatsFor({ single: true, form: "shortStory" })).toBe(PROSE_FORMATS);
    expect(formatsFor({ single: true, form: null })).toBe(PROSE_FORMATS);
    expect(formatsFor({ single: false, form: "screenplay" })).toBe(PROSE_FORMATS);
    expect(SCREENPLAY_FORMATS.every(isScreenplayFormat)).toBe(true);
    expect(PROSE_FORMATS.some(isScreenplayFormat)).toBe(false);
  });
});

describe("fountainOptions", () => {
  it("splits the settings lists on commas and lines, dropping blanks", () => {
    expect(fountainOptions({ screenplaySceneHeadings: "INT, EXT,\nINT./EXT, ,I/E", screenplayTransitions: "TO:, PARA:" }))
      .toEqual({ sceneHeadings: ["INT", "EXT", "INT./EXT", "I/E"], transitions: ["TO:", "PARA:"] });
  });
});

describe("screenplayPreset", () => {
  const s = { screenplayMore: "(MAIS)", screenplayContinued: "(CONT.)", screenplaySceneNumbers: true };
  it("carries the writer's labels and never shares its columns", () => {
    const a = screenplayPreset("a4", s);
    const b = screenplayPreset("a4", s);
    expect(a.more).toBe("(MAIS)");
    expect(a.continued).toBe("(CONT.)");
    expect(a.sceneNumbers).toBe(true);
    expect(a.columns).not.toBe(b.columns);
    expect(screenplayPreset("letter", s).linesPerPage).toBe(55);
    expect(screenplayPreset("letter", s).page).toEqual({ width: 612, height: 792 });
  });
  it("every column fits its page at 10 characters per inch", () => {
    for (const id of ["letter", "a4"] as const) {
      const p = screenplayPreset(id, s);
      for (const c of Object.values(p.columns)) {
        expect(c.left).toBeLessThan(c.right);
        expect(c.right / 10 * 72).toBeLessThanOrEqual(p.page.width - 72 + 0.5);
      }
    }
  });
});
