import { describe, it, expect } from "vitest";
import type { DayRecord } from "../src/data";
import {
  addedOn, applyDelta, bookTotalSeries, countsAsWriting, dailyAverage, dailySeries, dayStates, deletedOn,
  ActiveFiles, goalMet, goalMetDays, inFolder, isTrackedPath, netOn, num, recordBookTotal, renameBook, streak, sumAdded,
  type History,
} from "../src/goals/tracker";
import { normalizeDeadline, pacing, parseGoal, readNumberField } from "../src/goals/pacing";
import { chartGeometry, CHART_PAD } from "../src/goals/chart";
import { Sprint, formatClock, sprintMinutes, wordsPerHour } from "../src/goals/sprint";
import { lastDays } from "../src/core/dates";

const BOOK = "Novels/A Casa.md";

function rec(added: number, deleted = 0, books: DayRecord["books"] = {}): DayRecord {
  return { added, deleted, books };
}

describe("applyDelta", () => {
  it("creates the day and splits positive and negative deltas", () => {
    const h: History = {};
    applyDelta(h, "2026-09-29", 120);
    applyDelta(h, "2026-09-29", -30);
    applyDelta(h, "2026-09-29", 5);
    expect(h["2026-09-29"]).toEqual({ added: 125, deleted: 30, books: {} });
  });

  it("records per-book deltas and the book's latest total", () => {
    const h: History = {};
    applyDelta(h, "2026-09-29", 100, { path: BOOK, total: 1100 });
    applyDelta(h, "2026-09-29", -20, { path: BOOK, total: 1080 });
    expect(h["2026-09-29"].books[BOOK]).toEqual({ added: 100, deleted: 20, total: 1080 });
    expect(h["2026-09-29"].added).toBe(100);
    expect(h["2026-09-29"].deleted).toBe(20);
  });

  it("keeps books separate and vault totals cumulative", () => {
    const h: History = {};
    applyDelta(h, "2026-09-29", 10, { path: "A.md", total: 10 });
    applyDelta(h, "2026-09-29", 20, { path: "B.md", total: 20 });
    applyDelta(h, "2026-09-29", 5);
    expect(h["2026-09-29"].added).toBe(35);
    expect(h["2026-09-29"].books["A.md"].added).toBe(10);
    expect(h["2026-09-29"].books["B.md"].added).toBe(20);
  });

  it("ignores zero and non-finite deltas but still creates the day", () => {
    const h: History = {};
    applyDelta(h, "2026-09-29", 0);
    applyDelta(h, "2026-09-29", NaN);
    applyDelta(h, "2026-09-29", Infinity);
    expect(h["2026-09-29"]).toEqual({ added: 0, deleted: 0, books: {} });
  });

  it("repairs malformed records instead of producing NaN", () => {
    const h = {
      "2026-09-29": { added: "12", deleted: null, books: null },
    } as unknown as History;
    applyDelta(h, "2026-09-29", 3, { path: BOOK, total: -5 });
    expect(h["2026-09-29"].added).toBe(3);
    expect(h["2026-09-29"].deleted).toBe(0);
    expect(h["2026-09-29"].books[BOOK]).toEqual({ added: 3, deleted: 0, total: 0 });
  });

  it("does not touch other days", () => {
    const h: History = { "2026-09-28": rec(50) };
    applyDelta(h, "2026-09-29", 10);
    expect(h["2026-09-28"]).toEqual(rec(50));
  });
});

describe("recordBookTotal", () => {
  it("updates only the total", () => {
    const h: History = {};
    recordBookTotal(h, "2026-09-29", { path: BOOK, total: 5000 });
    expect(h["2026-09-29"]).toEqual({ added: 0, deleted: 0, books: { [BOOK]: { added: 0, deleted: 0, total: 5000 } } });
    applyDelta(h, "2026-09-29", 10, { path: BOOK, total: 5010 });
    recordBookTotal(h, "2026-09-29", { path: BOOK, total: 7010 });
    expect(h["2026-09-29"].books[BOOK]).toEqual({ added: 10, deleted: 0, total: 7010 });
    expect(h["2026-09-29"].added).toBe(10);
  });
});

describe("renameBook", () => {
  it("moves records to the new path and merges collisions", () => {
    const h: History = {
      "2026-09-27": rec(10, 0, { "Old.md": { added: 10, deleted: 0, total: 100 } }),
      "2026-09-28": rec(5, 1, { "Old.md": { added: 5, deleted: 1, total: 104 }, "New.md": { added: 2, deleted: 0, total: 50 } }),
      "2026-09-29": rec(3),
    };
    expect(renameBook(h, "Old.md", "New.md")).toBe(true);
    expect(h["2026-09-27"].books).toEqual({ "New.md": { added: 10, deleted: 0, total: 100 } });
    expect(h["2026-09-28"].books).toEqual({ "New.md": { added: 7, deleted: 1, total: 50 } });
    expect(renameBook(h, "Old.md", "New.md")).toBe(false);
    expect(renameBook(h, "New.md", "New.md")).toBe(false);
  });
});

describe("reading history", () => {
  const h: History = {
    "2026-09-29": rec(400, 180, { [BOOK]: { added: 300, deleted: 100, total: 18420 } }),
  };
  it("reads vault-wide and per-book values, with 0 for missing data", () => {
    expect(addedOn(h, "2026-09-29")).toBe(400);
    expect(deletedOn(h, "2026-09-29")).toBe(180);
    expect(addedOn(h, "2026-09-29", BOOK)).toBe(300);
    expect(netOn(h, "2026-09-29", BOOK)).toBe(200);
    expect(addedOn(h, "2026-09-29", "Other.md")).toBe(0);
    expect(addedOn(h, "2026-01-01")).toBe(0);
    expect(deletedOn(h, "2026-01-01", BOOK)).toBe(0);
  });
  it("num() rejects junk", () => {
    expect(num(5)).toBe(5);
    expect(num(-5)).toBe(0);
    expect(num(NaN)).toBe(0);
    expect(num("5")).toBe(0);
    expect(num(undefined)).toBe(0);
  });
});

describe("goalMet", () => {
  it("compares against a positive goal, or any writing without a goal", () => {
    expect(goalMet(1000, 1000)).toBe(true);
    expect(goalMet(999, 1000)).toBe(false);
    expect(goalMet(1, 0)).toBe(true);
    expect(goalMet(0, 0)).toBe(false);
    expect(goalMet(0, -5)).toBe(false);
  });
});

describe("streak", () => {
  it("counts consecutive days ending today", () => {
    const h: History = { "2026-09-27": rec(1), "2026-09-28": rec(10), "2026-09-29": rec(5) };
    expect(streak(h, "2026-09-29")).toBe(3);
  });
  it("ends yesterday when today has nothing yet", () => {
    const h: History = { "2026-09-27": rec(1), "2026-09-28": rec(10) };
    expect(streak(h, "2026-09-29")).toBe(2);
    h["2026-09-29"] = rec(0, 40); // only deletions today
    expect(streak(h, "2026-09-29")).toBe(2);
  });
  it("breaks on a gap or a day with only deletions", () => {
    const h: History = { "2026-09-25": rec(5), "2026-09-26": rec(0, 10), "2026-09-27": rec(3), "2026-09-28": rec(3) };
    expect(streak(h, "2026-09-28")).toBe(2);
    expect(streak(h, "2026-09-30")).toBe(0);
  });
  it("is 0 with an empty history and crosses months and years", () => {
    expect(streak({}, "2026-09-29")).toBe(0);
    const h: History = { "2026-12-30": rec(1), "2026-12-31": rec(1), "2027-01-01": rec(1) };
    expect(streak(h, "2027-01-01")).toBe(3);
    const m: History = { "2026-02-28": rec(1), "2026-03-01": rec(1) };
    expect(streak(m, "2026-03-01")).toBe(2);
  });
  it("ignores per-book writing (streak is vault-wide)", () => {
    const h: History = { "2026-09-29": rec(0, 0, { [BOOK]: { added: 50, deleted: 0, total: 50 } }) };
    expect(streak(h, "2026-09-29")).toBe(0);
  });
});

describe("windows", () => {
  const h: History = {
    "2026-09-26": rec(1200, 0, { [BOOK]: { added: 1000, deleted: 0, total: 1000 } }),
    "2026-09-27": rec(300),
    "2026-09-29": rec(1000, 50, { [BOOK]: { added: 600, deleted: 50, total: 1550 } }),
  };
  const days = lastDays("2026-09-29", 5); // 25..29
  it("dailySeries is vault-wide or per book, oldest first", () => {
    expect(dailySeries(h, days)).toEqual([0, 1200, 300, 0, 1000]);
    expect(dailySeries(h, days, BOOK)).toEqual([0, 1000, 0, 0, 600]);
    expect(dailySeries(h, [])).toEqual([]);
  });
  it("goalMetDays counts days at or above goal", () => {
    expect(goalMetDays(h, days, 1000)).toBe(2);
    expect(goalMetDays(h, days, 0)).toBe(3);
    expect(goalMetDays(h, [], 1000)).toBe(0);
  });
  it("sumAdded", () => {
    expect(sumAdded(h, days)).toBe(2500);
    expect(sumAdded(h, days, BOOK)).toBe(1600);
  });
  it("dayStates", () => {
    expect(dayStates(h, days, 1000)).toEqual(["none", "met", "wrote", "none", "met"]);
  });
});

describe("dailyAverage", () => {
  it("averages the 7 days ending today", () => {
    const h: History = {};
    for (const d of lastDays("2026-09-29", 7)) h[d] = rec(700);
    expect(dailyAverage(h, "2026-09-29")).toBe(700);
  });
  it("uses the window ending yesterday when today is empty", () => {
    const h: History = {};
    for (const d of lastDays("2026-09-28", 7)) h[d] = rec(140);
    expect(dailyAverage(h, "2026-09-29")).toBe(140);
  });
  it("counts missing days as zero", () => {
    const h: History = { "2026-09-29": rec(700) };
    expect(dailyAverage(h, "2026-09-29")).toBe(100);
  });
  it("net per book, floored at zero", () => {
    const h: History = {
      "2026-09-28": rec(0, 0, { [BOOK]: { added: 100, deleted: 800, total: 10 } }),
      "2026-09-29": rec(0, 0, { [BOOK]: { added: 70, deleted: 0, total: 80 } }),
    };
    expect(dailyAverage(h, "2026-09-29", { bookPath: BOOK, net: true })).toBe(0);
    expect(dailyAverage(h, "2026-09-29", { bookPath: BOOK })).toBeCloseTo(170 / 7);
  });
  it("is 0 on an empty history and guards a bad window", () => {
    expect(dailyAverage({}, "2026-09-29")).toBe(0);
    const h: History = { "2026-09-29": rec(30) };
    expect(dailyAverage(h, "2026-09-29", { days: 0 })).toBe(30);
    expect(dailyAverage(h, "2026-09-29", { days: -3 })).toBe(30);
  });
});

describe("bookTotalSeries", () => {
  const days = lastDays("2026-09-29", 6); // 24..29
  it("carries totals forward and back-fills before the first record", () => {
    const h: History = {
      "2026-09-26": rec(300, 0, { [BOOK]: { added: 300, deleted: 100, total: 1200 } }),
      "2026-09-28": rec(50, 0, { [BOOK]: { added: 50, deleted: 0, total: 1250 } }),
    };
    // before the first record: 1200 - (300 - 100) = 1000
    expect(bookTotalSeries(h, days, BOOK)).toEqual([1000, 1000, 1200, 1200, 1250, 1250]);
  });
  it("uses records older than the window", () => {
    const h: History = { "2026-01-01": rec(0, 0, { [BOOK]: { added: 0, deleted: 0, total: 900 } }) };
    expect(bookTotalSeries(h, days, BOOK)).toEqual([900, 900, 900, 900, 900, 900]);
  });
  it("falls back when the book has no records", () => {
    expect(bookTotalSeries({}, days, BOOK, 4321)).toEqual(new Array(6).fill(4321));
    expect(bookTotalSeries({ "2026-09-29": rec(5) }, days, BOOK)).toEqual(new Array(6).fill(0));
  });
  it("never back-fills below zero", () => {
    const h: History = { "2026-09-29": rec(500, 0, { [BOOK]: { added: 500, deleted: 0, total: 300 } }) };
    expect(bookTotalSeries(h, days, BOOK)).toEqual([0, 0, 0, 0, 0, 300]);
  });
  it("keeps the order of unsorted input days", () => {
    const h: History = { "2026-09-27": rec(0, 0, { [BOOK]: { added: 10, deleted: 0, total: 110 } }) };
    expect(bookTotalSeries(h, ["2026-09-29", "2026-09-25"], BOOK)).toEqual([110, 100]);
  });
  it("ignores other books' records", () => {
    const h: History = { "2026-09-27": rec(0, 0, { "Other.md": { added: 10, deleted: 0, total: 110 } }) };
    expect(bookTotalSeries(h, days, BOOK, 7)).toEqual(new Array(6).fill(7));
  });
});

describe("tracking filters", () => {
  it("inFolder matches the folder and its descendants only", () => {
    expect(inFolder("Novels/A.md", "Novels")).toBe(true);
    expect(inFolder("Novels/A/B.md", "Novels/")).toBe(true);
    expect(inFolder("Novels2/A.md", "Novels")).toBe(false);
    expect(inFolder("A.md", "")).toBe(true);
  });
  it("isTrackedPath honors track, exclude and the template", () => {
    expect(isTrackedPath("Notes/x.md", [], [])).toBe(true);
    expect(isTrackedPath("Notes/x.canvas", [], [])).toBe(false);
    expect(isTrackedPath("Notes/x.MD", [], [])).toBe(true);
    expect(isTrackedPath("Notes/x.md", ["Novels"], [])).toBe(false);
    expect(isTrackedPath("Novels/A/Chapters/01 A.md", ["Fiction", "Novels"], [])).toBe(true);
    expect(isTrackedPath("Templates/Chapter.md", [], ["Templates"])).toBe(false);
    expect(isTrackedPath("Novels/Templates/x.md", ["Novels"], ["Novels/Templates"])).toBe(false);
    expect(isTrackedPath("Novels/x.md", [], [""])).toBe(true);
    expect(isTrackedPath("Tpl/Chapter.md", [], [], "Tpl/Chapter.md")).toBe(false);
    expect(isTrackedPath("Tpl/Chapter.md", [], [], "Tpl/Chapter")).toBe(false);
    expect(isTrackedPath("Tpl/Chapter 2.md", [], [], "Tpl/Chapter")).toBe(true);
  });
  it("countsAsWriting skips zero and jumps bigger than the limit", () => {
    expect(countsAsWriting(0, 1500)).toBe(false);
    expect(countsAsWriting(1500, 1500)).toBe(true);
    expect(countsAsWriting(-1500, 1500)).toBe(true);
    expect(countsAsWriting(1501, 1500)).toBe(false);
    expect(countsAsWriting(-4000, 1500)).toBe(false);
    expect(countsAsWriting(99999, 0)).toBe(true);
    expect(countsAsWriting(NaN, 1500)).toBe(false);
  });
});

describe("ActiveFiles", () => {
  it("accepts the active file", () => {
    const a = new ActiveFiles(5000);
    a.focus("A.md", 0);
    expect(a.accepts("A.md", "A.md", 100_000)).toBe(true);
    expect(a.accepts("B.md", "A.md", 100_000)).toBe(false);
  });

  it("accepts a debounced save from a file left moments ago (regression)", () => {
    const a = new ActiveFiles(5000);
    a.focus("A.md", 0);
    a.focus("B.md", 10_000);
    expect(a.accepts("A.md", "B.md", 12_000)).toBe(true);
    expect(a.accepts("A.md", "B.md", 15_000)).toBe(false);
    expect(a.accepts("C.md", "B.md", 12_000)).toBe(false);
  });

  it("forgets stale files, follows renames and deletes", () => {
    const a = new ActiveFiles(5000);
    a.focus("A.md", 0);
    a.focus(null, 1000);
    a.rename("A.md", "A2.md");
    expect(a.accepts("A2.md", null, 2000)).toBe(true);
    expect(a.accepts("A.md", null, 2000)).toBe(false);
    a.forget("A2.md");
    expect(a.accepts("A2.md", null, 2000)).toBe(false);
    a.focus("B.md", 3000);
    a.focus("C.md", 20_000); // B left at 20s; nothing stale lingers
    expect(a.accepts("B.md", "C.md", 21_000)).toBe(true);
  });

  it("refocusing a file makes it active again, not merely recent", () => {
    const a = new ActiveFiles(5000);
    a.focus("A.md", 0);
    a.focus("B.md", 1000);
    a.focus("A.md", 2000);
    a.focus("C.md", 60_000);
    expect(a.accepts("A.md", "C.md", 61_000)).toBe(true);
    expect(a.accepts("B.md", "C.md", 61_000)).toBe(false);
  });
});

describe("pacing", () => {
  const base = { today: "2026-09-29", total: 18420, goal: 80000 };

  it("returns null without a goal", () => {
    expect(pacing({ ...base, goal: 0, average: 500 })).toBeNull();
    expect(pacing({ ...base, goal: NaN, average: 500 })).toBeNull();
  });

  it("on track: matches the approved design (153 days, 403/day, Jan 26, 34 days early)", () => {
    const p = pacing({ ...base, deadline: "2027-03-01", average: 520 })!;
    expect(p.remaining).toBe(61580);
    expect(p.daysLeft).toBe(153);
    expect(p.neededPerDay).toBe(403);
    // ceil(61580 / 520) = 119 days from today
    expect(p.projectedFinish).toBe("2027-01-26");
    expect(p.daysEarly).toBe(34);
    expect(p.onTrack).toBe(true);
    expect(p.overdue).toBe(false);
    expect(p.fraction).toBeCloseTo(18420 / 80000);
  });

  it("behind when the projection passes the deadline", () => {
    const p = pacing({ ...base, deadline: "2026-12-01", average: 300 })!;
    expect(p.onTrack).toBe(false);
    expect(p.daysEarly!).toBeLessThan(0);
  });

  it("exactly on the deadline is on track", () => {
    const p = pacing({ today: "2026-09-29", total: 0, goal: 1000, deadline: "2026-10-09", average: 100 })!;
    expect(p.projectedFinish).toBe("2026-10-09");
    expect(p.daysEarly).toBe(0);
    expect(p.onTrack).toBe(true);
  });

  it("on the deadline day there is one day left", () => {
    const p = pacing({ today: "2026-09-29", total: 900, goal: 1000, deadline: "2026-09-29", average: 0 })!;
    expect(p.daysLeft).toBe(1);
    expect(p.neededPerDay).toBe(100);
    expect(p.overdue).toBe(false);
    expect(p.onTrack).toBe(false);
  });

  it("the day after the deadline is overdue", () => {
    const p = pacing({ today: "2026-09-30", total: 900, goal: 1000, deadline: "2026-09-29", average: 0 })!;
    expect(p.daysLeft).toBe(-1);
    expect(p.overdue).toBe(true);
  });

  it("overdue after the deadline", () => {
    const p = pacing({ ...base, deadline: "2026-09-01", average: 500 })!;
    expect(p.overdue).toBe(true);
    expect(p.daysLeft).toBeLessThanOrEqual(0);
    expect(p.neededPerDay).toBeNull();
    expect(p.onTrack).toBe(false);
  });

  it("no pace: no projection, not on track", () => {
    const p = pacing({ ...base, deadline: "2027-03-01", average: 0 })!;
    expect(p.projectedFinish).toBeNull();
    expect(p.daysEarly).toBeNull();
    expect(p.onTrack).toBe(false);
    expect(p.neededPerDay).toBe(403);
  });

  it("without a deadline: projection only, onTrack unknown", () => {
    const p = pacing({ ...base, average: 1000 })!;
    expect(p.daysLeft).toBeNull();
    expect(p.neededPerDay).toBeNull();
    expect(p.projectedFinish).toBe("2026-11-30"); // 62 days from today
    expect(p.onTrack).toBeNull();
  });

  it("done when the total reaches the goal", () => {
    const p = pacing({ ...base, total: 81000, deadline: "2026-01-01", average: 0 })!;
    expect(p.done).toBe(true);
    expect(p.remaining).toBe(0);
    expect(p.fraction).toBe(1);
    expect(p.overdue).toBe(false);
    expect(p.onTrack).toBe(true);
    expect(p.projectedFinish).toBeNull();
    expect(p.neededPerDay).toBeNull();
  });

  it("guards junk input and absurd projections", () => {
    const p = pacing({ today: "2026-09-29", total: NaN, goal: 1000000, deadline: "not a date", average: 0.001 })!;
    expect(p.total).toBe(0);
    expect(p.deadline).toBeNull();
    expect(p.projectedFinish).toBeNull();
    const q = pacing({ today: "2026-09-29", total: -50, goal: 100, average: -10 })!;
    expect(q.remaining).toBe(100);
    expect(q.average).toBe(0);
  });

  it("parseGoal accepts numbers and formatted strings", () => {
    expect(parseGoal(80000)).toBe(80000);
    expect(parseGoal(80000.4)).toBe(80000);
    expect(parseGoal("80,000")).toBe(80000);
    expect(parseGoal("80.000")).toBe(80000);
    expect(parseGoal(" 80 000 ")).toBe(80000);
    expect(parseGoal("")).toBeNull();
    expect(parseGoal("abc")).toBeNull();
    expect(parseGoal("-5")).toBeNull();
    expect(parseGoal(0)).toBeNull();
    expect(parseGoal(null)).toBeNull();
    expect(parseGoal(Infinity)).toBeNull();
  });

  it("readNumberField reads number inputs with '.' as a decimal point", () => {
    expect(readNumberField("80000")).toEqual({ kind: "value", n: 80000 });
    // Regression: parseGoal would read this as 800005.
    expect(readNumberField("80000.5")).toEqual({ kind: "value", n: 80001 });
    expect(readNumberField("80000.4")).toEqual({ kind: "value", n: 80000 });
    expect(readNumberField("1e5")).toEqual({ kind: "value", n: 100000 });
    expect(readNumberField("0")).toEqual({ kind: "value", n: 0 });
    expect(readNumberField("  ")).toEqual({ kind: "clear" });
    expect(readNumberField("")).toEqual({ kind: "clear" });
    // Regression: "80,000" in a number input gives "" + badInput; that must not clear the goal.
    expect(readNumberField("", true)).toEqual({ kind: "invalid" });
    expect(readNumberField("-5")).toEqual({ kind: "invalid" });
    expect(readNumberField("abc")).toEqual({ kind: "invalid" });
    expect(readNumberField("Infinity")).toEqual({ kind: "invalid" });
  });

  it("normalizeDeadline accepts days and dates, rejects impossible ones", () => {
    expect(normalizeDeadline("2027-03-01")).toBe("2027-03-01");
    expect(normalizeDeadline(" 2027-03-01 ")).toBe("2027-03-01");
    expect(normalizeDeadline("2027-03-01T10:00")).toBe("2027-03-01");
    expect(normalizeDeadline(new Date(2027, 2, 1))).toBe("2027-03-01");
    expect(normalizeDeadline(new Date(NaN))).toBeNull();
    expect(normalizeDeadline("2026-02-31")).toBeNull();
    expect(normalizeDeadline("March 1")).toBeNull();
    expect(normalizeDeadline("")).toBeNull();
    expect(normalizeDeadline(undefined)).toBeNull();
    expect(normalizeDeadline(20270301)).toBeNull();
  });
});

describe("chartGeometry", () => {
  const values = [0, 500, 1000, 1500];
  const g = chartGeometry({ width: 400, height: 150, values, goal: 1000 });

  it("lays bars out left to right inside the plot", () => {
    expect(g.bars).toHaveLength(4);
    for (let i = 1; i < g.bars.length; i++) expect(g.bars[i].x).toBeGreaterThan(g.bars[i - 1].x);
    for (const b of g.bars) {
      expect(b.x).toBeGreaterThanOrEqual(g.plot.left);
      expect(b.x + b.width).toBeLessThanOrEqual(g.plot.right + 0.01);
      expect(b.y + b.height).toBeCloseTo(g.plot.bottom, 1);
      expect(b.y).toBeGreaterThanOrEqual(g.plot.top);
    }
    expect(g.plot.right).toBe(400 - CHART_PAD.right);
  });

  it("scales bars and the goal line on the same axis", () => {
    expect(g.bars[0].height).toBe(0);
    expect(g.bars[2].height).toBeCloseTo(2 * g.bars[1].height, 1);
    expect(g.goalY).toBeCloseTo(g.bars[2].y, 1);
    expect(g.bars.map((b) => b.met)).toEqual([false, false, true, true]);
  });

  it("keeps tiny days visible", () => {
    const t = chartGeometry({ width: 400, height: 150, values: [1, 100000], goal: 0 });
    expect(t.bars[0].height).toBeGreaterThanOrEqual(1.5);
    expect(t.goalY).toBeNull();
    expect(t.bars.every((b) => !b.met)).toBe(true);
  });

  it("handles all zeros, empty input and junk", () => {
    const z = chartGeometry({ width: 400, height: 150, values: [0, 0, 0], goal: 0 });
    expect(z.bars.every((b) => b.height === 0 && Number.isFinite(b.y))).toBe(true);
    const e = chartGeometry({ width: 0, height: NaN, values: [], goal: 1000 });
    expect(e.bars).toEqual([]);
    expect(e.xLabels).toEqual([]);
    expect(e.width).toBeGreaterThan(0);
    expect(Number.isFinite(e.goalY!)).toBe(true);
    const j = chartGeometry({ width: 300, height: 100, values: [NaN, -5, 10], goal: 10 });
    expect(j.bars.map((b) => b.value)).toEqual([0, 0, 10]);
  });

  it("draws the running total with room for its label", () => {
    const tg = chartGeometry({ width: 400, height: 150, values, goal: 1000, totals: [100, 600, 1600, 3100] });
    expect(tg.plot.right).toBe(400 - CHART_PAD.label);
    expect(tg.totalPath).toMatch(/^M[\d.]+ [\d.]+( L[\d.]+ [\d.]+){3}$/);
    expect(tg.totalEnd!.value).toBe(3100);
    expect(tg.totalEnd!.x).toBeLessThanOrEqual(tg.plot.right);
    // higher totals are drawn higher up
    const ys = tg.totalPath!.split(/[ML]/).filter(Boolean).map((p) => Number(p.trim().split(" ")[1]));
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1]);
  });

  it("draws a flat total without dividing by zero and ignores mismatched totals", () => {
    const flat = chartGeometry({ width: 400, height: 150, values: [1, 2], goal: 0, totals: [500, 500] });
    expect(flat.totalPath).not.toMatch(/NaN|Infinity/);
    const bad = chartGeometry({ width: 400, height: 150, values: [1, 2], goal: 0, totals: [500] });
    expect(bad.totalPath).toBeNull();
    expect(bad.totalEnd).toBeNull();
  });

  it("labels the first, middle and last day", () => {
    const thirty = chartGeometry({ width: 600, height: 150, values: new Array(30).fill(10), goal: 0 });
    expect(thirty.xLabels.map((l) => [l.index, l.anchor])).toEqual([[0, "start"], [14, "middle"], [29, "end"]]);
    expect(thirty.xLabels[2].x).toBeCloseTo(thirty.plot.right, 1);
    const one = chartGeometry({ width: 600, height: 150, values: [10], goal: 0 });
    expect(one.xLabels).toEqual([{ index: 0, x: expect.any(Number), anchor: "middle" }]);
    const two = chartGeometry({ width: 600, height: 150, values: [10, 20], goal: 0 });
    expect(two.xLabels.map((l) => l.index)).toEqual([0, 1]);
  });
});

describe("Sprint", () => {
  const t0 = 1_000_000;

  it("counts only positive deltas and reports the target once", () => {
    const s = new Sprint(25, 500, t0);
    expect(s.add(-50)).toBeNull();
    expect(s.add(NaN)).toBeNull();
    expect(s.add(300)).toBeNull();
    expect(s.add(250)).toEqual({ type: "target", words: 550 });
    expect(s.add(10)).toBeNull();
    expect(s.words).toBe(560);
    expect(s.progress(t0)).toBe(1);
  });

  it("finishes once when time is up", () => {
    const s = new Sprint(25, 500, t0);
    s.add(540);
    expect(s.tick(t0 + 60_000)).toBeNull();
    expect(s.remainingMs(t0 + 60_000)).toBe(24 * 60_000);
    const ev = s.tick(t0 + 25 * 60_000);
    expect(ev).toEqual({ type: "done", words: 540, minutes: 25, perHour: 1296 });
    expect(s.tick(t0 + 26 * 60_000)).toBeNull();
    expect(s.finish(t0 + 26 * 60_000)).toBeNull();
    expect(s.add(100)).toBeNull();
    expect(s.isFinished).toBe(true);
  });

  it("a late tick still reports the full duration", () => {
    const s = new Sprint(15, 0, t0);
    s.add(150);
    expect(s.tick(t0 + 40 * 60_000)).toEqual({ type: "done", words: 150, minutes: 15, perHour: 600 });
  });

  it("stopping early uses the elapsed time", () => {
    const s = new Sprint(45, 1000, t0);
    s.add(100);
    expect(s.finish(t0 + 10 * 60_000)).toEqual({ type: "done", words: 100, minutes: 10, perHour: 600 });
  });

  it("guards bad durations and targets", () => {
    const s = new Sprint(0, -5, t0);
    expect(s.minutes).toBe(25);
    expect(s.target).toBe(0);
    expect(s.add(10_000)).toBeNull(); // no target, no target event
    expect(s.progress(t0 + 12.5 * 60_000)).toBeCloseTo(0.5);
    expect(new Sprint(NaN, NaN, t0).minutes).toBe(25);
  });

  it("clock never goes negative", () => {
    const s = new Sprint(1, 0, t0);
    expect(s.remainingMs(t0 - 5000)).toBe(60_000 + 5000);
    expect(s.remainingMs(t0 + 120_000)).toBe(0);
    expect(s.elapsedMs(t0 - 5000)).toBe(0);
  });
});

describe("sprint helpers", () => {
  it("formatClock", () => {
    expect(formatClock(760_000)).toBe("12:40");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-100)).toBe("00:00");
    expect(formatClock(59_001)).toBe("01:00");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(NaN)).toBe("00:00");
  });
  it("wordsPerHour guards short or empty sprints", () => {
    expect(wordsPerHour(540, 25 * 60_000)).toBe(1296);
    expect(wordsPerHour(100, 0)).toBe(0);
    expect(wordsPerHour(0, 60_000)).toBe(0);
    expect(wordsPerHour(30, 20_000)).toBe(1800); // floors the duration at a minute
    expect(wordsPerHour(NaN, 60_000)).toBe(0);
  });
  it("sprintMinutes is at least 1", () => {
    expect(sprintMinutes(0)).toBe(1);
    expect(sprintMinutes(20_000)).toBe(1);
    expect(sprintMinutes(25 * 60_000)).toBe(25);
    expect(sprintMinutes(NaN)).toBe(1);
  });
});

describe("goals strings", async () => {
  const { goalsStrings } = await import("../src/goals/strings");
  const { readFileSync, readdirSync } = await import("fs");
  it("English and Brazilian Portuguese have the same keys", () => {
    expect(Object.keys(goalsStrings["pt-BR"]).sort()).toEqual(Object.keys(goalsStrings.en).sort());
  });
  it("every key used in the module exists", () => {
    const dir = "src/goals";
    const src = readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
    const direct = [...src.matchAll(/\bt\("(goals\.[\w.]+)"/g)].map((m) => m[1]);
    const plurals = [...src.matchAll(/plural\("(goals\.[\w.]+)"/g)].flatMap((m) => [`${m[1]}.one`, `${m[1]}.other`]);
    expect(direct.length + plurals.length).toBeGreaterThan(20);
    for (const k of [...direct, ...plurals]) expect(goalsStrings.en[k], k).toBeDefined();
  });
});
