import { describe, it, expect } from "vitest";
import { dateText, hasDate, initialDate, shouldWriteDate } from "../src/publish/date";

const TODAY = "2026-09-29";

describe("publish date: keep an existing date", () => {
  it("never overwrites an existing value the user didn't change, parseable or not", () => {
    for (const raw of ["2024-05-03", "2024-5-3", "3 de maio de 2024", new Date(Date.UTC(2024, 4, 3)), 20240503, "  x "]) {
      expect(shouldWriteDate(raw, false)).toBe(false);
    }
  });

  it("writes when the note has no date", () => {
    for (const raw of [undefined, null, "", "   ", []]) {
      expect(hasDate(raw)).toBe(false);
      expect(shouldWriteDate(raw, false)).toBe(true);
    }
  });

  it("writes when the user picked a date", () => {
    expect(shouldWriteDate("2024-5-3", true)).toBe(true);
    expect(shouldWriteDate("3 de maio de 2024", true)).toBe(true);
    expect(shouldWriteDate(undefined, true)).toBe(true);
  });

  it("shows YYYY-MM-DD dates in the field, today when there's none, and blanks unparseable ones", () => {
    expect(initialDate("2024-05-03", TODAY)).toEqual({ value: "2024-05-03" });
    expect(initialDate(new Date(Date.UTC(2024, 4, 3)), TODAY)).toEqual({ value: "2024-05-03" });
    expect(initialDate(undefined, TODAY)).toEqual({ value: TODAY });
    expect(initialDate("", TODAY)).toEqual({ value: TODAY });
    expect(initialDate("2024-5-3", TODAY)).toEqual({ value: "", unparsed: "2024-5-3" });
    expect(initialDate("3 de maio de 2024", TODAY)).toEqual({ value: "", unparsed: "3 de maio de 2024" });
  });

  it("reports a kept date as written", () => {
    expect(dateText("2024-05-03")).toBe("2024-05-03");
    expect(dateText(new Date(Date.UTC(2024, 4, 3)))).toBe("2024-05-03");
    expect(dateText(" 3 de maio de 2024 ")).toBe("3 de maio de 2024");
    expect(dateText(20240503)).toBe("20240503");
  });
});
