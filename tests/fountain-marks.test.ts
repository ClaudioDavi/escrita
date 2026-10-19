import { describe, expect, it } from "vitest";
import { underlineRanges } from "../src/core/fountain-marks";
import { parseRuns } from "../src/core/fountain";

const marked = (s: string) => underlineRanges(s).map(([a, b]) => s.slice(a, b));

describe("underlineRanges", () => {
  it("finds a run and keeps its underscores", () => {
    expect(marked("Mara _waits_ here.")).toEqual(["_waits_"]);
    expect(marked("_a_ and _b c_")).toEqual(["_a_", "_b c_"]);
  });

  it("leaves words with underscores inside, spaced underscores and escaped ones", () => {
    expect(marked("snake_case_name")).toEqual([]);
    expect(marked("a _ b _ c")).toEqual([]);
    expect(marked("a \\_b_ c")).toEqual([]);
    expect(marked("_open")).toEqual([]);
  });

  it("handles accents and a run at either end of the line", () => {
    expect(marked("_não_")).toEqual(["_não_"]);
    expect(marked("(_baixo_)")).toEqual(["_baixo_"]);
  });

  it("agrees with parseRuns on which text is underlined", () => {
    for (const s of ["Mara _waits_ here.", "a_b_c", "_x_ _y_", "x _ y_"]) {
      const underlined = parseRuns(s).filter((r) => r.underline).map((r) => r.text);
      expect(marked(s).map((m) => m.slice(1, -1))).toEqual(underlined);
    }
  });
});
