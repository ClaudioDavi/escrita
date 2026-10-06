import { describe, expect, it } from "vitest";
import cases from "./fixtures/serial/cases.json";
import { chapterNumber, chapterTitle } from "../src/core/book";
import { cloneDefaultStages } from "../src/core/stages";
import { serialState, type SerialChapter } from "../src/publish/serial";

const stages = cloneDefaultStages();
for (const k of Object.keys(cases.stageWords) as (keyof typeof cases.stageWords)[]) stages[k].words = cases.stageWords[k];

interface FixtureChapter { file: string; status: string; date: string | null; compile: boolean }

function build(c: FixtureChapter): SerialChapter {
  return {
    path: `Book/Chapters/${c.file}.md`, title: chapterTitle(c.file), number: chapterNumber(c.file),
    include: c.compile, status: c.status === "" ? null : c.status, date: c.date,
  };
}

const file = (x: SerialChapter | null) => (x ? x.path.replace(/^.*\//, "").replace(/\.md$/, "") : null);

describe("serialState fixtures", () => {
  for (const c of cases.cases as any[]) {
    it(c.name, () => {
      const r = serialState(c.chapters.map(build), stages, c.unnumberedTitles ?? []);
      expect(r.sequence.map(file)).toEqual(c.expected.sequence);
      expect(file(r.next)).toBe(c.expected.next);
      expect(r.last ? { chapter: file(r.last.chapter), date: r.last.date } : null).toEqual(c.expected.last);
      expect(r.gaps.map(file)).toEqual(c.expected.gaps);
    });
  }
  it("handles an empty book", () => {
    expect(serialState([], stages)).toEqual({ sequence: [], next: null, last: null, gaps: [] });
  });
});
