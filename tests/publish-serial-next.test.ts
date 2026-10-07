import { describe, expect, it } from "vitest";
import { chapterNumber, chapterTitle } from "../src/core/book";
import { cloneDefaultStages } from "../src/core/stages";
import { runChecks } from "../src/publish/checks";
import { checkText } from "../src/publish/modal";
import {
  chapterLabel, earlierUnpublished, serialChapters, serialLine, serialState, type SerialChapter,
} from "../src/core/serial";
import { serialDateText, serialParts } from "../src/outline/header";
import { registerStrings } from "../src/i18n";
import { publishStrings } from "../src/publish/strings";
import { outlineStrings } from "../src/outline/strings";

registerStrings(publishStrings);
registerStrings(outlineStrings);

const stages = cloneDefaultStages();
const ch = (file: string, status: string | null, date: unknown = null, include = true): SerialChapter => ({
  path: `Book/Chapters/${file}.md`, title: chapterTitle(file), number: chapterNumber(file), include, status, date,
});

describe("serialLine (outline header)", () => {
  it("has no line while nothing is published", () => {
    expect(serialLine(serialState([ch("01 A", "draft")], stages))).toBeNull();
  });

  it("names the next chapter and the last published date", () => {
    const line = serialLine(serialState([
      ch("01 A", "published", "2026-09-01"), ch("02 B", "published", "2026-09-30"), ch("03 A escada", "draft"),
    ], stages))!;
    expect(line).toEqual({ next: "03 A escada", last: { label: "02 B", date: "2026-09-30" }, gaps: [] });
  });

  it("reports a gap by number", () => {
    const line = serialLine(serialState([
      ch("01 A", "published", "2026-09-01"), ch("02 B", "draft"), ch("03 C", "published", "2026-10-01"),
    ], stages))!;
    expect(line.gaps).toEqual(["02"]);
    expect(line.next).toBe("02 B");
  });

  it("shows the title when the last published chapter has no date (Q23)", () => {
    const line = serialLine(serialState([ch("01 A", "published", "2026-09-01"), ch("02 B", "published", null)], stages))!;
    expect(line.last).toEqual({ label: "02 B", date: null });
    expect(line.next).toBeNull();
  });

  it("keeps a future date as written (D5)", () => {
    const line = serialLine(serialState([ch("01 A", "published", "2099-12-31")], stages))!;
    expect(line.last.date).toBe("2099-12-31");
    expect(serialDateText("3 de maio")).toBe("3 de maio");
  });

  it("draws the parts, the gap first", () => {
    const parts = serialParts({ next: "02 B", last: { label: "03 C", date: "2026-10-01" }, gaps: ["02"] });
    expect(parts.map((p) => p.gap)).toEqual([true, false, false]);
    expect(parts[0].text).toContain("02");
    expect(parts[1].text).toContain("02 B");
  });
});

describe("earlierUnpublished and its check", () => {
  const state = serialState([
    ch("01 A", "published", "2026-09-01"), ch("02 B", "draft"), ch("03 C", "idea"), ch("04 D", "draft"),
    ch("Epilogo", "draft", null, false),
  ], stages);

  it("lists the earlier unpublished chapters", () => {
    expect(earlierUnpublished(state, "Book/Chapters/04 D.md")).toEqual(["02 B", "03 C"]);
    expect(earlierUnpublished(state, "Book/Chapters/02 B.md")).toEqual([]);
  });

  it("gives null for a chapter outside the sequence", () => {
    expect(earlierUnpublished(state, "Book/Chapters/Epilogo.md")).toBeNull();
    expect(earlierUnpublished(state, "Other.md")).toBeNull();
  });

  const ctx = { placeholderMarker: "XXX", recommendedProperties: [] as string[] };

  it("warns, never blocks", () => {
    const c = runChecks("texto", {}, { ...ctx, earlierUnpublished: ["04 A escada"] }).find((x) => x.id === "earlierChapter")!;
    expect(c.level).toBe("warning");
    expect(checkText(c)).toContain("04 A escada");
  });

  it("passes when the earlier chapters are published, and is absent without a sequence", () => {
    expect(runChecks("texto", {}, { ...ctx, earlierUnpublished: [] }).find((x) => x.id === "earlierChapter")!.level).toBe("passed");
    expect(runChecks("texto", {}, { ...ctx, earlierUnpublished: null }).some((x) => x.id === "earlierChapter")).toBe(false);
    expect(runChecks("texto", {}, ctx).some((x) => x.id === "earlierChapter")).toBe(false);
  });

  it("uses the plural sentence for several chapters", () => {
    const c = runChecks("texto", {}, { ...ctx, earlierUnpublished: ["02 B", "03 C"] }).find((x) => x.id === "earlierChapter")!;
    expect(checkText(c)).toContain("02 B, 03 C");
  });
});

describe("serialChapters and labels", () => {
  it("reads status and date from the frontmatter", () => {
    const refs = [{ path: "B/C/01 A.md", title: "A", number: 1, include: true }];
    const r = serialChapters(refs, () => ({ status: "published", date: "2026-01-02" }), "status", "date");
    expect(r[0]).toMatchObject({ status: "published", date: "2026-01-02" });
    expect(serialChapters(refs, () => ({}), "status", "date")[0]).toMatchObject({ status: null, date: null });
  });

  it("labels with the number as written in the file name", () => {
    expect(chapterLabel({ path: "B/C/04 A escada.md", title: "A escada" })).toBe("04 A escada");
    expect(chapterLabel({ path: "B/C/Prólogo.md", title: "Prólogo" })).toBe("Prólogo");
  });
});
