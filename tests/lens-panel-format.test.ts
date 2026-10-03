import { describe, expect, it } from "vitest";
import { formatRate, noteName, positionOf, sharePercent } from "../src/lens/panel-format";
import type { Match } from "../src/lens/types";

const m = (rule: Match["rule"], from: number, to: number): Match => ({ rule, kind: "base", from, to, text: "x" });

describe("lens panel format", () => {
  it("formats the rate with one decimal in the locale", () => {
    expect(formatRate(2.4, "pt-BR")).toBe("2,4");
    expect(formatRate(2.4, "en")).toBe("2.4");
    expect(formatRate(0, "en")).toBe("0.0");
    expect(formatRate(9.26, "pt-BR")).toBe("9,3");
  });
  it("finds the position among one rule's matches", () => {
    const ms = [m("echo", 50, 55), m("gerund", 10, 15), m("gerund", 30, 38), m("gerund", 60, 66)];
    expect(positionOf(ms, "gerund", 30, 38)).toEqual({ n: 2, of: 3 });
    expect(positionOf(ms, "gerund", 62, 62)).toEqual({ n: 3, of: 3 });
    expect(positionOf(ms, "gerund", 40, 45)).toBeNull();
    expect(positionOf(ms, "adverb", 0, 100)).toBeNull();
  });
  it("rounds the dialogue share and names a note", () => {
    expect(sharePercent(41, 100)).toBe(41);
    expect(sharePercent(0, 0)).toBe(0);
    expect(noteName("Contos/Domingo.md")).toBe("Domingo");
  });
});
