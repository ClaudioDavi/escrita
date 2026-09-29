import { describe, it, expect } from "vitest";
import { countCharacters, countWords, charLength, readerText } from "../src/core/wordcount";
import { readPiece, pieceCount, pieceProgress, parseAmount, parseUnit, parseDeadline, NEAR_LIMIT } from "../src/core/piece";
import { dayOffPredicate, weekdayOf, parseDatesOff, invalidDatesOff, hasDaysOff } from "../src/core/daysoff";
import { mergeDefaults, cleanWeekdays } from "../src/core/merge";
import { lineList } from "../src/core/lists";

describe("countCharacters", () => {
  it("counts a hand-checked sample with and without spaces", () => {
    // "A chave — dentro." = 17 characters with spaces, 14 without.
    const md = "---\nlimit: 15000\nunit: characters\n---\nA   chave\n\n—  dentro. %% XXX: ver %%\n";
    expect(countCharacters(md, { spaces: true })).toBe(17);
    expect(countCharacters(md, { spaces: false })).toBe(14);
  });
  it("counts accents as one character, precomposed or decomposed", () => {
    expect(countCharacters("ação é", { spaces: true })).toBe(6);
    expect(countCharacters("ação é", { spaces: true })).toBe(6);
    expect(charLength("é")).toBe(1);
  });
  it("counts em dash, ellipsis and emoji as one", () => {
    expect(countCharacters("—…😀", { spaces: true })).toBe(3);
  });
  it("ignores frontmatter, comments, code and markup", () => {
    const md = "---\na: 1\n---\n# Título\n\n**Ela** viu *tudo* e ~~nada~~ ==isso== `code` [[Maria|ela]].\n\n---\n\n%% beat: b %%\n```\nx = 1\n```\n";
    expect(readerText(md)).toBe("Título Ela viu tudo e nada isso ela.");
    expect(countCharacters(md, { spaces: true })).toBe("Título Ela viu tudo e nada isso ela.".length);
  });
  it("keeps escaped marks and snake_case, drops _emphasis_", () => {
    expect(readerText("2 \\* 3 _sim_ a_b")).toBe("2 * 3 sim a_b");
  });
  it("handles CRLF, empty and comment-only notes", () => {
    expect(countCharacters("um\r\n\r\ndois", { spaces: true })).toBe(7);
    expect(countCharacters("", { spaces: true })).toBe(0);
    expect(countCharacters("%% só comentário %%\n%% beat: a %%", { spaces: false })).toBe(0);
  });
  it("counts literal asterisks and == a reader sees, drops only paired marks", () => {
    expect(countCharacters("Price 5 * 3 = 15", { spaces: true })).toBe(16);
    expect(countCharacters("Que m*** é essa?", { spaces: true })).toBe(16);
    expect(countCharacters("a == b", { spaces: true })).toBe(6);
    expect(countCharacters("a ~~ b", { spaces: true })).toBe(6);
    expect(countCharacters("*itálico* e **negrito**", { spaces: true })).toBe(17);
    expect(countCharacters("***ambos***", { spaces: true })).toBe(5);
    expect(countCharacters("**um *dois* três**", { spaces: true })).toBe(12);
    expect(countCharacters("==marca==", { spaces: true })).toBe(5);
    expect(countCharacters("~~risco~~", { spaces: true })).toBe(5);
  });
  it("treats %% inside inline or fenced code as literal, not a comment", () => {
    const words = Array.from({ length: 200 }, (_, i) => `w${i}`).join(" ");
    expect(countWords(`Intro \`%%\` here.\n\n${words}`)).toBe(202);
    expect(countWords(`Intro \`\`a \` %%\`\` here.\n\n${words}`)).toBe(202);
    expect(countWords(`\`\`\`\n%%\n\`\`\`\n\n${words}`)).toBe(200);
    expect(countWords(`~~~\n%%\n~~~\n\n${words}`)).toBe(200);
    expect(countCharacters("Intro `%%` here.\n\nabc", { spaces: true })).toBe("Intro here. abc".length);
    expect(countCharacters("```\n%%\n```\n\nabc", { spaces: true })).toBe(3);
    // A real comment still hides its text.
    expect(countWords("a %% b `c` %% d")).toBe(2);
  });
  it("leaves countWords alone", () => {
    expect(countWords("**Ela** viu *tudo*")).toBe(3);
  });
});

describe("piece", () => {
  const props = { targetProperty: "target", limitProperty: "limit", unitProperty: "unit" };
  it("reads target, limit, unit and deadline", () => {
    expect(readPiece({ target: 5000, limit: "15.000", unit: "characters", deadline: "2026-10-15" }, props))
      .toEqual({ target: 5000, limit: 15000, unit: "characters", deadline: "2026-10-15" });
  });
  it("is null when nothing is set or everything is invalid", () => {
    expect(readPiece(null, props)).toBeNull();
    expect(readPiece({}, props)).toBeNull();
    expect(readPiece({ unit: "characters" }, props)).toBeNull();
    expect(readPiece({ target: "lots", limit: -3, deadline: "2026-02-31" }, props)).toBeNull();
  });
  it("uses configured property names", () => {
    expect(readPiece({ meta: "15,000", prazo: "2026-12-01" }, { targetProperty: "x", limitProperty: "meta", unitProperty: "u", deadlineProperty: "prazo" }))
      .toEqual({ limit: 15000, unit: "words", deadline: "2026-12-01" });
  });
  it("parses amounts tolerantly", () => {
    expect(parseAmount("15000")).toBe(15000);
    expect(parseAmount("15.000")).toBe(15000);
    expect(parseAmount("15,000")).toBe(15000);
    expect(parseAmount("1.500.000")).toBe(1500000);
    expect(parseAmount("15 000")).toBe(15000);
    expect(parseAmount(4200.4)).toBe(4200);
    for (const bad of [0, -1, "", "abc", "15.00.0", null, undefined, NaN, Infinity, "1.000,5"]) expect(parseAmount(bad)).toBeUndefined();
  });
  it("parses units", () => {
    expect(parseUnit("characters")).toBe("characters");
    expect(parseUnit("Caracteres")).toBe("characters");
    expect(parseUnit("characters-no-spaces")).toBe("characters-no-spaces");
    expect(parseUnit("caracteres sem espaços")).toBe("characters-no-spaces");
    expect(parseUnit("words")).toBe("words");
    expect(parseUnit("banana")).toBe("words");
    expect(parseUnit(undefined)).toBe("words");
  });
  it("parses deadlines", () => {
    expect(parseDeadline("2026-10-15")).toBe("2026-10-15");
    expect(parseDeadline(new Date(Date.UTC(2026, 9, 15)))).toBe("2026-10-15");
    expect(parseDeadline("15/10/2026")).toBeUndefined();
  });
  it("counts in the piece's unit", () => {
    expect(pieceCount("um dois", "words")).toBe(2);
    expect(pieceCount("um dois", "characters")).toBe(7);
    expect(pieceCount("um dois", "characters-no-spaces")).toBe(6);
  });
  it("computes progress and limit states", () => {
    expect(pieceProgress({ count: 4210, target: 5000 })).toMatchObject({ ratio: 0.842, state: "under", over: 0, reached: false });
    expect(pieceProgress({ count: 14000, limit: 15000 }).state).toBe("under");
    expect(pieceProgress({ count: 15000 * NEAR_LIMIT, limit: 15000 }).state).toBe("near");
    expect(pieceProgress({ count: 15000, limit: 15000 }).state).toBe("near");
    expect(pieceProgress({ count: 15312, limit: 15000 })).toMatchObject({ state: "over", over: 312 });
    const both = pieceProgress({ count: 6000, target: 5000, limit: 8000 });
    expect(both).toMatchObject({ ratio: 1.2, targetRatio: 1.2, limitRatio: 0.75, reached: true, state: "under" });
  });
  it("guards zero and missing values", () => {
    expect(pieceProgress({ count: 10 })).toEqual({ ratio: 0, state: "none", over: 0, reached: false });
    expect(pieceProgress({ count: 10, target: 0, limit: 0 }).state).toBe("none");
    expect(pieceProgress({ count: NaN, target: 100 }).ratio).toBe(0);
  });
});

describe("days off", () => {
  it("computes weekdays without timezone drift", () => {
    expect(weekdayOf("2026-09-27")).toBe(0); // Sunday
    expect(weekdayOf("2026-09-29")).toBe(2); // Tuesday
    expect(weekdayOf("2024-02-29")).toBe(4);
    expect(weekdayOf("2026-02-29")).toBeNull();
    expect(weekdayOf("nope")).toBeNull();
  });
  it("parses dates off, skipping invalid lines", () => {
    expect(parseDatesOff("2026-12-25\n\n bad \n2026-12-25, 2027-01-01\r\n2026-13-01")).toEqual(["2026-12-25", "2027-01-01"]);
    expect(invalidDatesOff("2026-12-25\nbad\n2026-13-01")).toEqual(["bad", "2026-13-01"]);
  });
  it("combines weekdays and dates", () => {
    const off = dayOffPredicate({ weekdaysOff: [0, 6], datesOff: "2026-10-12" });
    expect(off("2026-10-10")).toBe(true);  // Saturday
    expect(off("2026-10-11")).toBe(true);  // Sunday
    expect(off("2026-10-12")).toBe(true);  // date off (Monday)
    expect(off("2026-10-13")).toBe(false);
    expect(off("garbage")).toBe(false);
  });
  it("is always false with nothing off", () => {
    const off = dayOffPredicate({ weekdaysOff: [], datesOff: "" });
    expect(off("2026-10-10")).toBe(false);
    expect(dayOffPredicate(undefined)("2026-10-10")).toBe(false);
    expect(hasDaysOff({ weekdaysOff: [], datesOff: "x" })).toBe(false);
    expect(hasDaysOff({ weekdaysOff: [3], datesOff: "" })).toBe(true);
  });
});

describe("settings merge", () => {
  const defaults = { a: "x", n: 1, flag: true, days: [] as number[], list: ["q"] };
  it("fills missing keys and rejects wrong types", () => {
    const m = mergeDefaults(defaults, { a: 3, n: "7", flag: null, days: "1,2", extra: "kept" });
    expect(m).toEqual({ a: "x", n: 1, flag: true, days: [], list: ["q"], extra: "kept" });
  });
  it("keeps valid values and never shares default arrays", () => {
    const m = mergeDefaults(defaults, { a: "y", n: 0, flag: false, days: [1, 2] });
    expect(m).toMatchObject({ a: "y", n: 0, flag: false, days: [1, 2] });
    expect(m.list).not.toBe(defaults.list);
    expect(mergeDefaults(defaults, undefined).days).not.toBe(defaults.days);
  });
  it("cleans weekdays", () => {
    expect(cleanWeekdays([6, 0, 0, 7, -1, 2.5, "3", null])).toEqual([0, 3, 6]);
    expect(cleanWeekdays("0,6")).toEqual([]);
  });
});

describe("lineList", () => {
  it("splits on newlines and commas", () => {
    expect(lineList("description,\n title \r\n\ndescription")).toEqual(["description", "title"]);
    expect(lineList("")).toEqual([]);
    expect(lineList(undefined)).toEqual([]);
  });
});
