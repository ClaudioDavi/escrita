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

describe("LensMarks after an options change", () => {
  const TEXT = "Mariana e Marianna.";
  /** A session whose name matches depend on a list the test changes. */
  function setup() {
    const timers = new ManualTimers();
    const o = { flagged: ["Mariana"] as string[] };
    const session = new LensSession({
      timers, settleMs: 400,
      analyze: (text, version) => ({
        version,
        pass: { mask: text },
        matches: o.flagged.map((w) => {
          const from = text.indexOf(w + " ") >= 0 ? text.indexOf(w + " ") : text.indexOf(w);
          return { rule: "name", kind: "base", from, to: from + w.length, text: w };
        }),
      }) as unknown as LensResult,
    });
    session.toggle(PATH);
    session.now(PATH, TEXT);
    const marks = new LensMarks(() => PATH, session, (p) => session.result(p));
    const st = EditorState.create({ doc: TEXT, extensions: [marks.extension] });
    const names = (s: EditorState) => marks.matchesFor(s).map((m) => m.text);
    return { timers, o, session, marks, st, names };
  }

  it("follows a list change on an idle note", () => {
    const { o, session, st, names } = setup();
    expect(names(st)).toEqual(["Mariana"]);
    o.flagged = ["Marianna"];
    session.invalidate();
    expect(names(st.update({}).state)).toEqual(["Marianna"]);
  });

  it("drops marks from older options while the new pass is pending", async () => {
    const { timers, o, session, st, names } = setup();
    expect(names(st)).toEqual(["Mariana"]);
    session.changed(PATH, () => TEXT); // a pass is waiting
    o.flagged = ["Marianna"];
    session.invalidate();
    const mid = st.update({}).state;
    expect(names(mid)).toEqual([]);
    await timers.advance(400);
    expect(names(mid.update({}).state)).toEqual(["Marianna"]);
  });

  it("drops marks from older options when the session has no new result", () => {
    const { o, session, st, names } = setup();
    o.flagged = ["Marianna"];
    (session as unknown as { opts: { analyze: unknown } }).opts.analyze = () => { throw new Error("boom"); };
    expect(() => session.invalidate()).toThrow();
    expect(names(st.update({}).state)).toEqual([]);
  });

  it("keeps the mapped marks while typing under the same options", () => {
    const { session, st, names } = setup();
    const typed = st.update({ changes: { from: 0, insert: "E " } }).state;
    session.changed(PATH, () => typed.doc.toString());
    expect(names(typed)).toEqual(["Mariana"]);
    expect(names(typed.update({}).state)).toEqual(["Mariana"]);
  });

  it("a refresh that fails once does not stop later refreshes reaching the editor", async () => {
    const { marks } = setup();
    let calls = 0;
    const view = { dispatch: () => { calls++; if (calls === 1) throw new Error("update in progress"); } };
    (marks as unknown as { views: Set<unknown> }).views.add(view);
    marks.refresh();
    await Promise.resolve();
    expect(calls).toBe(2);
    marks.refresh();
    expect(calls).toBe(3);
  });
});

describe("LensMarks refresh on invalidate", () => {
  it("asks every editor to re-read after an options change", () => {
    const session = new LensSession({ timers: new ManualTimers(), settleMs: 400, analyze: (t, v) => resultFor(t, v) });
    const marks = new LensMarks(() => PATH, session, (p) => session.result(p));
    let calls = 0;
    (marks as unknown as { views: Set<unknown> }).views.add({ dispatch: () => { calls++; } });
    session.invalidate();
    expect(calls).toBe(1);
  });
});
