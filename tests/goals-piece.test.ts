import { describe, it, expect } from "vitest";
import type { DayRecord } from "../src/data";
import { dailyAverage, dayStates, goalMetSummary, streak, type History } from "../src/goals/tracker";
import { afterWritingDays, pacing } from "../src/goals/pacing";
import { chartGeometry } from "../src/goals/chart";
import { paceInUnit, pieceBar } from "../src/goals/piece";
import { measureText, pieceProgress, progressOf, readPiece } from "../src/core/measure";
import { dayOffPredicate } from "../src/core/daysoff";
import { lastDays } from "../src/core/dates";

const rec = (added: number, deleted = 0): DayRecord => ({ added, deleted, books: {} });
const PROPS = { targetProperty: "target", limitProperty: "limit", unitProperty: "unit" };

// 2026-09-26 is a Saturday, 2026-09-27 a Sunday, 2026-09-29 a Tuesday.
const weekendsOff = dayOffPredicate({ weekdaysOff: [0, 6], datesOff: "" });

describe("a conto with a character limit (hand-checked)", () => {
  // "ninguém" is typed decomposed (e + combining acute) to prove it counts once.
  const md = [
    "---",
    "limit: 15000",
    "unit: characters",
    "---",
    "# O porão",
    "",
    "A **casa** tinha um porão — e ninguém descia lá.",
    "",
    "%% beat: a lata %%",
    "Ela abriu a porta.",
    "",
  ].join("\n");
  const piece = readPiece({ limit: 15000, unit: "characters" }, PROPS)!;

  it("reads the piece", () => {
    expect(piece).toEqual({ limit: 15000, unit: "characters" });
  });

  it("counts characters with spaces on what a reader sees", () => {
    // Reader text: "O porão A casa tinha um porão — e ninguém descia lá. Ela abriu a porta."
    //   "O porão" 7 + 1 space + "A casa tinha um porão — e ninguém descia lá." 44 + 1 space + "Ela abriu a porta." 18 = 71
    expect(measureText(md).characters).toBe(71);
    // 15 spaces in all: 1 + 1 + 9 + 1 + 3
    expect(measureText(md).charactersNoSpaces).toBe(56);
    expect(measureText(md).words).toBe(15);
    expect(measureText(md)).toEqual({ words: 15, characters: 71, charactersNoSpaces: 56 });
  });

  it("is well under its limit, with the right numbers for the status bar", () => {
    const s = progressOf(71, piece);
    expect(s).toEqual({
      unit: "characters", count: 71, of: 15000, kind: "limit", limit: 15000, state: "under", over: 0, reached: false, fraction: 71 / 15000,
    });
  });
});

describe("progressOf", () => {
  it("shows the count against the target when there is one, else the limit", () => {
    expect(progressOf(4210, { target: 5000, limit: 6000 }).of).toBe(5000);
    expect(progressOf(12800, { limit: 15000 }).of).toBe(15000);
    expect(progressOf(10, {}).of).toBeNull();
    expect(progressOf(10, {}).state).toBe("none");
  });
  it("turns near at 95% of the limit and over past it, with the excess", () => {
    expect(progressOf(14249, { limit: 15000 }).state).toBe("under");
    expect(progressOf(14250, { limit: 15000 }).state).toBe("near");
    expect(progressOf(15000, { limit: 15000 }).state).toBe("near");
    const over = progressOf(15312, { limit: 15000 });
    expect(over.state).toBe("over");
    expect(over.over).toBe(312);
    expect(over.fraction).toBe(1);
  });
  it("flags a reached target and guards bad counts", () => {
    expect(progressOf(5000, { target: 5000 }).reached).toBe(true);
    expect(progressOf(NaN, { target: 5000 })).toMatchObject({ count: 0, fraction: 0, reached: false });
    expect(progressOf(-4, { limit: 10 })).toMatchObject({ count: 0, state: "under" });
  });
  it("agrees with pieceProgress", () => {
    const p = pieceProgress({ count: 4210, target: 5000, limit: 6000 });
    const s = progressOf(4210, { target: 5000, limit: 6000 });
    expect(s.state).toBe(p.state);
    expect(s.fraction).toBeCloseTo(p.ratio);
  });
});

describe("pieceBar", () => {
  it("fills against the target alone", () => {
    expect(pieceBar(4210, { target: 5000 })).toEqual({ fill: 0.842, targetMark: null, limitMark: null });
  });
  it("marks the target on the way to a larger limit", () => {
    const b = pieceBar(4200, { target: 5000, limit: 6000 });
    expect(b.fill).toBeCloseTo(0.7);
    expect(b.targetMark).toBeCloseTo(5000 / 6000);
    expect(b.limitMark).toBeNull();
  });
  it("marks the limit when over it", () => {
    const b = pieceBar(16000, { limit: 15000 });
    expect(b.fill).toBe(1);
    expect(b.limitMark).toBeCloseTo(15000 / 16000);
  });
  it("marks the target when past it", () => {
    expect(pieceBar(6000, { target: 5000 }).targetMark).toBeCloseTo(5 / 6);
  });
  it("is empty with nothing to measure", () => {
    expect(pieceBar(0, {})).toEqual({ fill: 0, targetMark: null, limitMark: null });
    expect(pieceBar(NaN, { target: 0, limit: -1 })).toEqual({ fill: 0, targetMark: null, limitMark: null });
  });
});

describe("paceInUnit", () => {
  it("is the words pace for words", () => {
    expect(paceInUnit(300, "words", 1000, 1000)).toBe(300);
    expect(paceInUnit(NaN, "words", 1, 1)).toBe(0);
  });
  it("estimates characters with the piece's characters per word", () => {
    expect(paceInUnit(300, "characters", 5800, 1000)).toBe(1740);
    expect(paceInUnit(300, "characters-no-spaces", 4800, 1000)).toBe(1440);
  });
  it("is unknown without words to measure the ratio", () => {
    expect(paceInUnit(300, "characters", 0, 0)).toBeNull();
    expect(paceInUnit(300, "characters", 10, 0)).toBeNull();
  });
});

describe("streak with days off", () => {
  it("a weekend off leaves the streak intact", () => {
    // Thu, Fri written; Sat, Sun off; Mon, Tue written.
    const h: History = {
      "2026-09-24": rec(100), "2026-09-25": rec(100),
      "2026-09-28": rec(100), "2026-09-29": rec(100),
    };
    expect(streak(h, "2026-09-29")).toBe(2); // old behavior: the weekend breaks it
    expect(streak(h, "2026-09-29", weekendsOff)).toBe(4);
  });
  it("writing on a day off counts and extends the streak", () => {
    const h: History = { "2026-09-25": rec(1), "2026-09-26": rec(50), "2026-09-28": rec(1) };
    // Fri, Sat (off, written), Sun (off, skipped), Mon
    expect(streak(h, "2026-09-28", weekendsOff)).toBe(3);
  });
  it("still breaks on a missed writing day", () => {
    const h: History = { "2026-09-24": rec(1), "2026-09-28": rec(1), "2026-09-29": rec(1) };
    // Fri 25 is a writing day with nothing
    expect(streak(h, "2026-09-29", weekendsOff)).toBe(2);
  });
  it("ends yesterday when today has nothing yet, skipping days off before it", () => {
    const h: History = { "2026-09-25": rec(1) }; // Friday
    expect(streak(h, "2026-09-28", weekendsOff)).toBe(1); // Monday morning
    expect(streak(h, "2026-09-29", weekendsOff)).toBe(0); // Monday missed
  });
  it("specific dates off work too", () => {
    const off = dayOffPredicate({ weekdaysOff: [], datesOff: "2026-09-28" });
    const h: History = { "2026-09-27": rec(1), "2026-09-29": rec(1) };
    expect(streak(h, "2026-09-29", off)).toBe(2);
  });
  it("ends when every day is off, and with an empty history", () => {
    const all = dayOffPredicate({ weekdaysOff: [0, 1, 2, 3, 4, 5, 6], datesOff: "" });
    expect(streak({}, "2026-09-29", all)).toBe(0);
    expect(streak({ "2026-09-20": rec(3) }, "2026-09-29", all)).toBe(1);
  });
  it("matches the old behavior when nothing is off", () => {
    const none = dayOffPredicate({ weekdaysOff: [], datesOff: "" });
    const h: History = { "2026-09-25": rec(5), "2026-09-26": rec(0, 10), "2026-09-27": rec(3), "2026-09-28": rec(3) };
    expect(streak(h, "2026-09-28", none)).toBe(streak(h, "2026-09-28"));
    expect(streak(h, "2026-09-30", none)).toBe(0);
  });
});

describe("goal-met days and averages with days off", () => {
  const days = lastDays("2026-09-29", 7); // Wed 23 .. Tue 29
  const h: History = {
    "2026-09-23": rec(1000), "2026-09-24": rec(200), "2026-09-25": rec(1000),
    "2026-09-26": rec(1500), // Saturday, off, written
    "2026-09-28": rec(1000), "2026-09-29": rec(300),
  };
  it("goalMetSummary leaves out days off where the goal wasn't met", () => {
    expect(goalMetSummary(h, days, 1000)).toEqual({ met: 4, of: 7 });
    expect(goalMetSummary(h, days, 1000, weekendsOff)).toEqual({ met: 4, of: 6 });
    expect(goalMetSummary({}, days, 1000, weekendsOff)).toEqual({ met: 0, of: 5 });
  });
  it("dailyAverage is per writing day with days off", () => {
    expect(dailyAverage(h, "2026-09-29")).toBeCloseTo(5000 / 7);
    // Sunday (off, empty) leaves the window; Saturday (off, written) stays.
    expect(dailyAverage(h, "2026-09-29", { isDayOff: weekendsOff })).toBeCloseTo(5000 / 6);
  });
  it("dailyAverage keeps a day off with only cuts in a net average", () => {
    const g: History = { "2026-09-27": rec(0, 600), "2026-09-29": rec(600) };
    expect(dailyAverage(g, "2026-09-29", { net: true, isDayOff: weekendsOff })).toBe(0);
    expect(dailyAverage(g, "2026-09-29", { isDayOff: weekendsOff })).toBe(100);
  });
  it("dailyAverage is 0 when the whole window is off and empty", () => {
    const all = dayOffPredicate({ weekdaysOff: [0, 1, 2, 3, 4, 5, 6], datesOff: "" });
    expect(dailyAverage({}, "2026-09-29", { isDayOff: all })).toBe(0);
  });
  it("dayStates marks empty days off", () => {
    expect(dayStates(h, days, 1000, weekendsOff)).toEqual(["met", "wrote", "met", "met", "off", "met", "wrote"]);
    expect(dayStates(h, days, 1000)).toEqual(["met", "wrote", "met", "met", "none", "met", "wrote"]);
  });
});

describe("pacing with days off", () => {
  // Tuesday 2026-09-29; deadline Sunday 2026-10-11: 12 days from tomorrow, 4 of them weekend days.
  const base = { today: "2026-09-29", total: 2000, goal: 10000, deadline: "2026-10-11", average: 500 };

  it("counts only writing days until the deadline", () => {
    const plain = pacing(base)!;
    expect(plain.daysLeft).toBe(12);
    expect(plain.writingDaysLeft).toBe(12);
    expect(plain.neededPerDay).toBe(667);
    const p = pacing({ ...base, isDayOff: weekendsOff })!;
    expect(p.daysLeft).toBe(12);
    expect(p.writingDaysLeft).toBe(8);
    expect(p.neededPerDay).toBe(1000);
  });

  it("projects the finish over writing days only", () => {
    // 8000 left at 500 a day = 16 days. Every day: Thu 15 Oct. Weekdays only, from Wed 30 Sep: Wed 21 Oct.
    expect(pacing(base)!.projectedFinish).toBe("2026-10-15");
    const p = pacing({ ...base, isDayOff: weekendsOff })!;
    expect(p.projectedFinish).toBe("2026-10-21");
    expect(p.daysEarly).toBe(-10);
    expect(p.onTrack).toBe(false);
  });

  it("leaves today as the only writing day when the rest are off", () => {
    // Friday, deadline Sunday, weekend off
    const p = pacing({ ...base, today: "2026-10-09", deadline: "2026-10-11", isDayOff: weekendsOff })!;
    expect(p.daysLeft).toBe(2);
    expect(p.writingDaysLeft).toBe(1);
    expect(p.neededPerDay).toBe(8000);
  });

  it("is unchanged when nothing is off", () => {
    const none = dayOffPredicate({ weekdaysOff: [], datesOff: "" });
    expect(pacing({ ...base, isDayOff: none })).toEqual(pacing(base));
  });

  it("keeps overdue and done as before", () => {
    const over = pacing({ ...base, today: "2026-10-12", isDayOff: weekendsOff })!;
    expect(over.overdue).toBe(true);
    expect(over.neededPerDay).toBeNull();
    const done = pacing({ ...base, total: 10000, isDayOff: weekendsOff })!;
    expect(done.done).toBe(true);
    expect(done.neededPerDay).toBeNull();
  });

  it("afterWritingDays skips days off and gives up when all are off", () => {
    expect(afterWritingDays("2026-09-25", 1, weekendsOff)).toBe("2026-09-28");
    expect(afterWritingDays("2026-09-29", 3, weekendsOff)).toBe("2026-10-02");
    expect(afterWritingDays("2026-09-29", 0, weekendsOff)).toBe("2026-09-29");
    const all = dayOffPredicate({ weekdaysOff: [0, 1, 2, 3, 4, 5, 6], datesOff: "" });
    expect(afterWritingDays("2026-09-29", 1, all)).toBeNull();
  });

  it("with no projection when every day is off", () => {
    const all = dayOffPredicate({ weekdaysOff: [0, 1, 2, 3, 4, 5, 6], datesOff: "" });
    const p = pacing({ ...base, isDayOff: all })!;
    expect(p.projectedFinish).toBeNull();
    expect(p.writingDaysLeft).toBe(1);
  });
});

describe("chart day-off bands", () => {
  const values = [100, 0, 0, 300, 0, 200, 0];
  it("merges consecutive days off into full-height bands", () => {
    const off = [false, true, true, false, true, false, true];
    const g = chartGeometry({ width: 380, height: 150, values, goal: 0, off });
    const slot = (g.plot.right - g.plot.left) / values.length;
    expect(g.offBands.map((b) => [b.from, b.to])).toEqual([[1, 2], [4, 4], [6, 6]]);
    const [a, b, c] = g.offBands;
    expect(a.x).toBeCloseTo(g.plot.left + slot, 1);
    expect(a.width).toBeCloseTo(2 * slot, 1);
    expect(b.width).toBeCloseTo(slot, 1);
    expect(c.x + c.width).toBeCloseTo(g.plot.right, 1);
    for (const band of g.offBands) {
      expect(band.y).toBe(g.plot.top);
      expect(band.y + band.height).toBeCloseTo(g.plot.bottom, 1);
    }
  });
  it("each band covers its days' bars", () => {
    const off = [false, true, true, false, false, false, false];
    const g = chartGeometry({ width: 380, height: 150, values, goal: 0, off });
    const band = g.offBands[0];
    for (const i of [1, 2]) {
      const bar = g.bars[i];
      expect(bar.x).toBeGreaterThanOrEqual(band.x);
      expect(bar.x + bar.width).toBeLessThanOrEqual(band.x + band.width + 0.01);
    }
  });
  it("has no bands without days off or with a mismatched list", () => {
    expect(chartGeometry({ width: 380, height: 150, values, goal: 0 }).offBands).toEqual([]);
    expect(chartGeometry({ width: 380, height: 150, values, goal: 0, off: [true] }).offBands).toEqual([]);
    expect(chartGeometry({ width: 380, height: 150, values, goal: 0, off: values.map(() => false) }).offBands).toEqual([]);
  });
  it("covers the whole plot when every day is off", () => {
    const g = chartGeometry({ width: 380, height: 150, values, goal: 0, off: values.map(() => true) });
    expect(g.offBands).toHaveLength(1);
    expect(g.offBands[0].x).toBe(g.plot.left);
    expect(g.offBands[0].width).toBeCloseTo(g.plot.right - g.plot.left, 1);
  });
});
