import { describe, expect, it } from "vitest";
import { DEFAULT_STAGES, type StageMapping } from "../src/core/stages";
import { NEW_BOOK_GOAL, newBookNote } from "../src/outline/new-book";

const base = { goalProperty: "goal", deadlineProperty: "deadline", statusProperty: "status", stages: DEFAULT_STAGES };

describe("newBookNote", () => {
  it("starts the book in the draft stage, with a goal and an empty deadline", () => {
    expect(newBookNote(base)).toBe(`---\nstatus: draft\ngoal: ${NEW_BOOK_GOAL}\ndeadline: \n---\n`);
  });

  it("writes the writer's first draft word and property names", () => {
    const stages: StageMapping = { ...DEFAULT_STAGES, draft: { ...DEFAULT_STAGES.draft, words: "rascunho\nesboço" } };
    const note = newBookNote({ goalProperty: "meta", deadlineProperty: "prazo", statusProperty: "estado", stages });
    expect(note).toContain("estado: rascunho\n");
    expect(note).toContain(`meta: ${NEW_BOOK_GOAL}\n`);
    expect(note).toContain("prazo: \n");
  });

  it("quotes names and words YAML would misread", () => {
    const stages: StageMapping = { ...DEFAULT_STAGES, draft: { ...DEFAULT_STAGES.draft, words: "first draft" } };
    const note = newBookNote({ ...base, statusProperty: "book status", stages });
    expect(note).toContain('"book status": "first draft"\n');
  });

  it("falls back to the stage id and the status property when they are blank", () => {
    const stages: StageMapping = { ...DEFAULT_STAGES, draft: { ...DEFAULT_STAGES.draft, words: "" } };
    expect(newBookNote({ ...base, statusProperty: " ", stages })).toContain("status: draft\n");
  });
});
