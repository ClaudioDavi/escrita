import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  countIn, measureText, noteProgress, parseAmount, parseDeadline, pieceProgress, pluralKey, progressOf,
  readBookGoal, readPiece, readUnit, sameCounts, sumCounts, unitKey, ZERO, type PieceUnit,
} from "../src/core/measure";
import { countCharacters, countWords } from "../src/core/wordcount";
import { coreStrings } from "../src/strings";
import { publishStrings } from "../src/publish/strings";

const PROPS = { targetProperty: "target", limitProperty: "limit", unitProperty: "unit" };
const UNITS: PieceUnit[] = ["words", "characters", "characters-no-spaces"];

describe("measureText", () => {
  it("counts words and characters in one pass, like countWords and countCharacters", () => {
    const md = "---\nlimit: 15000\nunit: characters\n---\nA   chave\n\n—  dentro. %% XXX: ver %%\n";
    expect(measureText(md)).toEqual({ words: 3, characters: 17, charactersNoSpaces: 14 });
    for (const s of ["", "um dois", "**Ela** viu *tudo*", "ação é", "—…😀", "Price 5 * 3 = 15", "`code` e [[Maria|ela]]."]) {
      expect(measureText(s)).toEqual({
        words: countWords(s), characters: countCharacters(s, { spaces: true }), charactersNoSpaces: countCharacters(s, { spaces: false }),
      });
    }
  });
  it("gives zeros for an empty note or one with only frontmatter and comments", () => {
    expect(measureText("")).toEqual(ZERO);
    expect(measureText("---\na: 1\n---\n%% beat: a %%\n<!-- x -->\n")).toEqual(ZERO);
  });
  it("reads the characters lazily and remembers them", () => {
    const c = measureText("um dois");
    expect(c.words).toBe(2);
    expect(Object.keys(c)).toEqual(["words", "characters", "charactersNoSpaces"]);
    expect(c.characters).toBe(7);
    expect(c.characters).toBe(7);
    expect(c.charactersNoSpaces).toBe(6);
  });
});

describe("countIn / sumCounts / sameCounts", () => {
  const a = measureText("um dois"), b = measureText("três");
  it("picks the unit", () => {
    expect(countIn(a, "words")).toBe(2);
    expect(countIn(a, "characters")).toBe(7);
    expect(countIn(a, "characters-no-spaces")).toBe(6);
  });
  it("sums, and an empty list is zero", () => {
    expect(sumCounts([a, b])).toEqual({ words: 3, characters: 11, charactersNoSpaces: 10 });
    expect(sumCounts([])).toEqual(ZERO);
  });
  it("compares", () => {
    expect(sameCounts(a, measureText("um dois"))).toBe(true);
    expect(sameCounts(a, measureText("um  dois"))).toBe(true);
    expect(sameCounts(a, measureText("um doiss"))).toBe(false);
    expect(sameCounts(a, b)).toBe(false);
  });
});

describe("parseAmount", () => {
  it("reads book goals and lengths in any grouping", () => {
    for (const v of ["80.000", "80,000", " 80 000 ", "80_000", 80000, "80000"]) expect(parseAmount(v), String(v)).toBe(80000);
    expect(parseAmount(80000.4)).toBe(80000);
  });
  it("reads a single separator as a decimal point (documented change: '80.5' is 81, not 805)", () => {
    expect(parseAmount("80.5")).toBe(81);
  });
  it("an unquoted YAML 80.000 arrives as the number 80 and stays 80 (quote amounts with separators)", () => {
    expect(parseAmount(80.0)).toBe(80);
    expect(parseAmount(1.5)).toBe(2);
    expect(parseAmount("80.000")).toBe(80000);
  });
  it("rejects anything else", () => {
    for (const bad of ["1.000,5", "", "abc", "-5", 0, null, undefined, Infinity, NaN]) expect(parseAmount(bad), String(bad)).toBeUndefined();
  });
});

describe("readBookGoal", () => {
  it("reads goal and deadline with the default names", () => {
    expect(readBookGoal({ goal: "80.000", deadline: "2027-03-01" }, {})).toEqual({ goal: 80000, deadline: "2027-03-01" });
  });
  it("uses the configured names and ignores the defaults then", () => {
    const props = { goalProperty: "meta", deadlineProperty: "prazo" };
    expect(readBookGoal({ meta: "50.000", prazo: "2027-01-10" }, props)).toEqual({ goal: 50000, deadline: "2027-01-10" });
    expect(readBookGoal({ goal: 1000, deadline: "2027-01-10" }, props)).toEqual({ goal: null, deadline: null });
  });
  it("is empty for invalid values or no frontmatter", () => {
    expect(readBookGoal({ goal: "lots", deadline: "2026-02-31" }, {})).toEqual({ goal: null, deadline: null });
    expect(readBookGoal(null, {})).toEqual({ goal: null, deadline: null });
  });
});

describe("parseDeadline", () => {
  it("takes YYYY-MM-DD strings literally and rejects the rest", () => {
    expect(parseDeadline("2027-03-01")).toBe("2027-03-01");
    expect(parseDeadline(" 2027-03-01 ")).toBe("2027-03-01");
    expect(parseDeadline("2027-03-01T10:00")).toBe("2027-03-01");
    expect(parseDeadline("2027-03-01 10:00")).toBe("2027-03-01");
    for (const bad of ["2026-02-31", "March 1", "", undefined, 20270301, "2027-03-01xyz"]) expect(parseDeadline(bad), String(bad)).toBeUndefined();
    expect(parseDeadline(new Date(NaN))).toBeUndefined();
  });

  // Node applies a runtime TZ change; every Date is built inside its `it`.
  for (const tz of ["America/Sao_Paulo", "Asia/Tokyo"]) {
    describe(`Dates in ${tz}`, () => {
      let saved: string | undefined;
      beforeAll(() => { saved = process.env.TZ; process.env.TZ = tz; });
      afterAll(() => { if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved; });

      it("the timezone took effect", () => {
        const utcMidnight = new Date(Date.UTC(2027, 2, 1));
        expect(utcMidnight.getDate()).toBe(tz === "America/Sao_Paulo" ? 28 : 1);
        expect(utcMidnight.getHours()).toBe(tz === "America/Sao_Paulo" ? 21 : 9);
      });
      it("a YAML date (UTC midnight) is its UTC day — no longer a day early west of UTC", () => {
        expect(parseDeadline(new Date(Date.UTC(2027, 2, 1)))).toBe("2027-03-01");
      });
      it("a local-midnight Date is its local day", () => {
        expect(parseDeadline(new Date(2027, 2, 1))).toBe("2027-03-01");
      });
      it("any other time is its UTC day", () => {
        expect(parseDeadline(new Date(Date.UTC(2027, 2, 1, 15, 30)))).toBe("2027-03-01");
      });
    });
  }
});

describe("readPiece / readUnit", () => {
  it("reads the deadline from the configured property, else 'deadline'", () => {
    expect(readPiece({ prazo: "2027-01-10", deadline: "2027-02-02" }, { ...PROPS, deadlineProperty: "prazo" }))
      .toEqual({ unit: "words", deadline: "2027-01-10" });
    expect(readPiece({ deadline: "2027-02-02" }, PROPS)).toEqual({ unit: "words", deadline: "2027-02-02" });
  });
  it("a unit alone is not a piece, but readUnit still reads it", () => {
    expect(readPiece({ unit: "characters" }, PROPS)).toBeNull();
    expect(readUnit({ unit: "characters" }, PROPS)).toBe("characters");
    expect(readUnit({ u: "caracteres sem espaços" }, { unitProperty: "u" })).toBe("characters-no-spaces");
    expect(readUnit({}, PROPS)).toBe("words");
    expect(readUnit(null, PROPS)).toBe("words");
  });
});

describe("progressOf", () => {
  it("counts against the target, else the limit", () => {
    expect(progressOf(4210, { target: 5000, limit: 6000 }).of).toBe(5000);
    expect(progressOf(12800, { limit: 15000 }).of).toBe(15000);
    expect(progressOf(10, {})).toMatchObject({ of: null, kind: "none", state: "none" });
    expect(progressOf(1234, null)).toEqual({
      unit: "words", count: 1234, of: null, kind: "none", state: "none", over: 0, reached: false, fraction: 0,
    });
  });
  it("against the target", () => {
    expect(progressOf(1500, { target: 3000 })).toEqual({
      unit: "words", count: 1500, of: 3000, kind: "target", target: 3000, state: "under", over: 0, reached: false, fraction: 0.5,
    });
    expect(progressOf(3500, { target: 3000 })).toMatchObject({ fraction: 1, reached: true, state: "under" });
  });
  it("against the limit: near at 95%, over past it", () => {
    expect(progressOf(960, { limit: 1000 })).toMatchObject({ of: 1000, kind: "limit", state: "near", fraction: 0.96 });
    expect(progressOf(14249, { limit: 15000 }).state).toBe("under");
    expect(progressOf(15000, { limit: 15000 }).state).toBe("near");
    expect(progressOf(15312, { limit: 15000 })).toMatchObject({ state: "over", over: 312, fraction: 1 });
  });
  it("target and limit: shown against the target, the limit kept for the state", () => {
    expect(progressOf(2000, { target: 1800, limit: 2000 })).toEqual({
      unit: "words", count: 2000, of: 1800, kind: "target", target: 1800, limit: 2000, state: "near", fraction: 1, reached: true, over: 0,
    });
  });
  it("clamps bad counts", () => {
    expect(progressOf(NaN, { target: 5000 })).toMatchObject({ count: 0, fraction: 0, reached: false });
    expect(progressOf(-4, { limit: 10 })).toMatchObject({ count: 0, state: "under" });
  });
  it("carries the unit and the deadline", () => {
    expect(progressOf(10, { unit: "characters", target: 100, deadline: "2027-01-01" }))
      .toMatchObject({ unit: "characters", deadline: "2027-01-01" });
  });
  it("agrees with pieceProgress", () => {
    const p = pieceProgress({ count: 4210, target: 5000, limit: 6000 });
    const s = progressOf(4210, { target: 5000, limit: 6000 });
    expect(s.state).toBe(p.state);
    expect(s.fraction).toBeCloseTo(p.ratio);
  });
});

describe("noteProgress", () => {
  const c = measureText("um dois três");
  it("counts in the piece's unit", () => {
    expect(noteProgress(c, { unit: "characters", limit: 10 })).toMatchObject({ unit: "characters", count: 12, state: "over", over: 2 });
  });
  it("a unit without a piece still applies", () => {
    expect(noteProgress(c, null, "characters-no-spaces")).toMatchObject({ unit: "characters-no-spaces", count: 10, kind: "none" });
    expect(noteProgress(c, null)).toMatchObject({ unit: "words", count: 3 });
  });
  it("the piece's unit wins over the fallback", () => {
    expect(noteProgress(c, { unit: "words", target: 5 }, "characters")).toMatchObject({ unit: "words", count: 3 });
  });
});

describe("labels", () => {
  it("picks .one only for exactly one", () => {
    expect(pluralKey("outline.beats", 1)).toBe("outline.beats.one");
    expect(pluralKey("outline.beats", 0)).toBe("outline.beats.other");
    expect(pluralKey("outline.beats", 2)).toBe("outline.beats.other");
    expect(pluralKey("outline.beats", 1.2)).toBe("outline.beats.one");
  });
  it("has .one and .other strings for every unit in every language", () => {
    for (const lang of Object.keys(coreStrings)) {
      for (const u of UNITS) {
        for (const form of ["one", "other"]) expect(coreStrings[lang][`${unitKey(u)}.${form}`], `${lang} ${u} ${form}`).toBeTruthy();
      }
    }
  });
  it("uses the singular for one", () => {
    const render = (lang: string, u: PieceUnit, n: number) => coreStrings[lang][pluralKey(unitKey(u), n)].replace("{n}", String(n));
    expect(render("en", "words", 1)).toBe("1 word");
    expect(render("en", "characters", 1)).toBe("1 character");
    expect(render("en", "characters-no-spaces", 1)).toBe("1 character (no spaces)");
    expect(render("pt-BR", "words", 1)).toBe("1 palavra");
    expect(render("pt-BR", "characters", 1)).toBe("1 caractere");
    expect(render("pt-BR", "characters-no-spaces", 1)).toBe("1 caractere sem espaços");
    expect(render("en", "characters", 2)).toBe("2 characters");
  });
  it("the publish limit check puts the unit inside {limit}", () => {
    for (const lang of Object.keys(publishStrings)) {
      for (const form of ["bad", "ok"]) {
        const s = publishStrings[lang][`publish.check.overLimit.${form}`];
        expect(s, `${lang} ${form}`).toContain("{limit}");
        expect(s, `${lang} ${form}`).not.toContain("{unit}");
      }
    }
  });
});
