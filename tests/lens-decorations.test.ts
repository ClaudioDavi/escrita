import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { LensMarks } from "../src/lens/decorations";
import { LensSession } from "../src/lens/session";
import type { LensResult } from "../src/lens/types";
import { ManualTimers } from "./support/memory-vault";

const PATH = "a.md";

function resultFor(text: string, version: number): LensResult {
  return {
    version,
    pass: { mask: text },
    matches: [{ rule: "adverb", kind: "base", from: 0, to: 3, text: text.slice(0, 3) }],
  } as unknown as LensResult;
}

describe("LensMarks adoption", () => {
  it("does not adopt a cached result computed on older text of the same length", () => {
    const session = new LensSession({
      timers: new ManualTimers(), settleMs: 400,
      analyze: (text, version) => resultFor(text, version),
    });
    session.toggle(PATH);
    session.now(PATH, "abc old text");
    const marks = new LensMarks(() => PATH, session, (p) => session.result(p));
    // reopened note: same length, different text
    const stale = EditorState.create({ doc: "xyz new text", extensions: [marks.extension] });
    expect(marks.matchesFor(stale)).toEqual([]);
    // the same text does adopt
    const fresh = EditorState.create({ doc: "abc old text", extensions: [marks.extension] });
    expect(marks.matchesFor(fresh)).toHaveLength(1);
  });
});
