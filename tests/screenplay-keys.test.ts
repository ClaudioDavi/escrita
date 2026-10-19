// Tab and Enter in a screenplay note (1.2, SP 2, PLAN-1.2 Q7, Q8): one case per rule, in pt-BR.
// Each edit is applied to the text, the typed words follow, and the parser (`fountainLines`) must
// read the cursor's line as the element the rule chose.

import { describe, expect, it } from "vitest";
import { fountainLines, type FountainOptions, type LineKind } from "../src/core/fountain";
import { segment } from "../src/core/markdown";
import { capsFor, decideKey, forcedMarkFor, type ElementMode, type KeyContext, type KeyEdit, type ScriptKey } from "../src/core/screenplay-keys";

const PT: FountainOptions = { sceneHeadings: ["INT", "EXT", "INT./EXT", "I/E"], transitions: ["TO:", "PARA:"] };

const kindsOf = (text: string) => fountainLines(text, segment(text), PT);

/** `doc` holds one "|" for the cursor. The context is what the module would build from the editor. */
function ctxOf(doc: string, mode: ElementMode | null = null): { ctx: KeyContext; text: string; lineStart: number } {
  const at = doc.indexOf("|");
  const text = doc.replace("|", "");
  const lines = text.split("\n");
  const upTo = text.slice(0, at).split("\n");
  const i = upTo.length - 1;
  const kinds = kindsOf(text);
  let j = i - 1;
  while (j >= 0 && lines[j].trim() === "") j--;
  const lineStart = text.slice(0, at).length - upTo[i].length;
  return {
    text, lineStart,
    ctx: {
      line: lines[i], column: upTo[i].length, kind: kinds[i], above: j >= 0 ? kinds[j] : null,
      blankAbove: i === 0 || lines[i - 1].trim() === "", mode, sceneHeadings: PT.sceneHeadings, transitions: PT.transitions,
    },
  };
}

/** Run a key, apply the edit, type `typed` at the cursor, and say what the cursor's line reads as. */
function run(doc: string, key: ScriptKey, mode: ElementMode | null, typed = "") {
  const { ctx, text, lineStart } = ctxOf(doc, mode);
  const edit = decideKey(key, ctx);
  if (!edit) return { edit, text, kind: null as LineKind | null, mode: null as ElementMode | null };
  const cursor = lineStart + edit.cursor;
  const after = text.slice(0, lineStart + edit.from) + edit.insert + text.slice(lineStart + edit.to);
  const typedText = after.slice(0, cursor) + typed + after.slice(cursor);
  const line = typedText.slice(0, cursor).split("\n").length - 1;
  return { edit, text: typedText, kind: kindsOf(typedText)[line], mode: edit.mode };
}

const same = (e: KeyEdit | null) => e && e.insert === "" && e.cursor === 0;

describe("Enter", () => {
  it("after a cue: one line break, dialogue", () => {
    const r = run("Ele entra.\n\nJOÃO|", "Enter", "character", "Oi.");
    expect(r.edit).toEqual({ from: 4, to: 4, insert: "\n", cursor: 5, mode: "dialogue" });
    expect(r.kind).toBe("dialogue");
    expect(r.text).toBe("Ele entra.\n\nJOÃO\nOi.");
    expect(kindsOf(r.text)[2]).toBe("character");
  });
  it("after a cue the parser already reads, with no mode", () => {
    expect(run("JOÃO|\nOi.", "Enter", null).edit?.mode).toBe("dialogue");
  });
  it("after a parenthetical: one line break, dialogue", () => {
    const r = run("JOÃO\n(rindo)|", "Enter", null, "Oi.");
    expect(r.edit?.insert).toBe("\n");
    expect(r.kind).toBe("dialogue");
  });
  it("after dialogue: a blank line, then a cue", () => {
    const r = run("JOÃO\nOi.|", "Enter", null, "MARIA\nTchau.");
    expect(r.edit).toEqual({ from: 3, to: 3, insert: "\n\n", cursor: 5, mode: "character" });
    expect(r.kind).toBe("character");
    expect(r.text).toBe("JOÃO\nOi.\n\nMARIA\nTchau.");
  });
  it("on an empty line in cue mode: back to action, no text change", () => {
    const r = run("JOÃO\nOi.\n\n|", "Enter", "character", "Ela sai.");
    expect(same(r.edit)).toBe(true);
    expect(r.edit?.mode).toBe("action");
    expect(r.kind).toBe("action");
  });
  it("on an empty line in scene or transition mode: back to action", () => {
    expect(run("|", "Enter", "scene").edit?.mode).toBe("action");
    expect(run("x\n\n|", "Enter", "transition").edit?.mode).toBe("action");
  });
  it("on an empty line with no such mode: Obsidian's", () => {
    expect(run("x\n\n|", "Enter", null).edit).toBeNull();
    expect(run("x\n\n|", "Enter", "action").edit).toBeNull();
    expect(run("JOÃO\n|", "Enter", "dialogue").edit).toBeNull();
  });
  it("after a scene heading: a blank line, action", () => {
    const r = run("INT. COZINHA - NOITE|", "Enter", null, "Ela entra.");
    expect(r.edit).toEqual({ from: 20, to: 20, insert: "\n\n", cursor: 22, mode: "action" });
    expect(r.kind).toBe("action");
    expect(kindsOf(r.text)[0]).toBe("scene");
  });
  it("after action: a blank line, action", () => {
    const r = run("Ela entra.|", "Enter", null, "Ele sai.");
    expect(r.edit?.insert).toBe("\n\n");
    expect(r.kind).toBe("action");
  });
  it("after a transition: a blank line, scene mode", () => {
    const r = run("Ela sai.\n\nCORTA PARA:|", "Enter", "transition", "INT. SALA - DIA");
    expect(r.edit?.mode).toBe("scene");
    expect(r.edit?.insert).toBe("\n\n");
    expect(r.kind).toBe("scene");
  });
  it("in the middle of a line, or after anything else, is Obsidian's", () => {
    expect(run("Ela| entra.", "Enter", null).edit).toBeNull();
    expect(run("# Ato um|", "Enter", null).edit).toBeNull();
    expect(run("= resumo|", "Enter", null).edit).toBeNull();
  });
  it("at the top of the body and in an empty note", () => {
    expect(run("INT. SALA - DIA|", "Enter", null).edit?.mode).toBe("action");
    expect(run("|", "Enter", null).edit).toBeNull();
  });
});

describe("Tab and Shift-Tab on an empty line", () => {
  it("cycle action, cue, transition, scene heading, and wrap", () => {
    const steps: Array<[ElementMode | null, ElementMode]> = [
      [null, "character"], ["action", "character"], ["character", "transition"], ["transition", "scene"], ["scene", "action"],
    ];
    for (const [from, to] of steps) {
      const r = run("Ela sai.\n\n|", "Tab", from);
      expect(same(r.edit)).toBe(true);
      expect(r.mode).toBe(to);
    }
  });
  it("Shift-Tab goes back", () => {
    const steps: Array<[ElementMode | null, ElementMode]> = [
      [null, "scene"], ["scene", "transition"], ["transition", "character"], ["character", "action"],
    ];
    for (const [from, to] of steps) expect(run("Ela sai.\n\n|", "Shift-Tab", from).mode).toBe(to);
  });
  it("what is typed in each mode reads as that element", () => {
    const base = "Ela sai.\n\n|";
    expect(run(base, "Tab", null, "JOÃO\nOi.").kind).toBe("character");
    expect(run(base, "Tab", "character", "CORTA PARA:").kind).toBe("transition");
    expect(run(base, "Tab", "transition", "INT. COZINHA - NOITE").kind).toBe("scene");
    expect(run(base, "Tab", "scene", "Ela anda.").kind).toBe("action");
  });
  it("works in an empty note", () => {
    expect(run("|", "Tab", null).mode).toBe("character");
    expect(run("|", "Shift-Tab", null).mode).toBe("scene");
  });
  it("clears the spaces on a blank line", () => {
    const r = run("x\n\n  |", "Tab", null);
    expect(r.edit).toMatchObject({ from: 0, to: 2, insert: "", cursor: 0 });
  });
  it("from dialogue mode it starts at action's next step", () => {
    expect(run("JOÃO\n|", "Tab", "dialogue").mode).toBe("character");
  });
});

describe("Tab after a cue", () => {
  it("opens a parenthetical with the cursor inside", () => {
    const r = run("Ele entra.\n\nJOÃO|", "Tab", "character", "rindo");
    expect(r.edit).toEqual({ from: 4, to: 4, insert: "\n()", cursor: 6, mode: "parenthetical" });
    expect(r.text).toBe("Ele entra.\n\nJOÃO\n(rindo)");
    expect(r.kind).toBe("parenthetical");
    expect(kindsOf(r.text)[2]).toBe("character");
  });
  it("works on a cue the parser already reads", () => {
    expect(run("JOÃO|\nOi.", "Tab", null).edit?.insert).toBe("\n()");
  });
  it("falls through elsewhere", () => {
    expect(run("Ela entra.|", "Tab", null).edit).toBeNull();
    expect(run("JO|ÃO\nOi.", "Tab", null).edit).toBeNull();
    expect(run("JOÃO\nOi.|", "Tab", null).edit).toBeNull();
    expect(run("Ela entra.|", "Shift-Tab", null).edit).toBeNull();
    expect(run("JOÃO|", "Shift-Tab", "character").edit).toBeNull();
  });
});

describe("capsFor", () => {
  it("is true for cues, scene headings and transitions, by kind or by mode", () => {
    for (const k of ["character", "scene", "transition"] as const) {
      expect(capsFor(k, null)).toBe(true);
      expect(capsFor(null, k)).toBe(true);
    }
  });
  it("is false for everything else, parentheticals included", () => {
    for (const k of ["action", "dialogue", "parenthetical", "section", "centered", null] as const) expect(capsFor(k, null)).toBe(false);
    for (const m of ["action", "dialogue", "parenthetical"] as const) expect(capsFor(null, m)).toBe(false);
    expect(capsFor("character", "parenthetical")).toBe(false);
  });
});

describe("forcedMarkFor", () => {
  it("leaves a line that already reads as its element", () => {
    expect(forcedMarkFor("JOÃO", "character", PT)).toBeNull();
    expect(forcedMarkFor("INT. COZINHA - NOITE", "scene", PT)).toBeNull();
    expect(forcedMarkFor("CORTA PARA:", "transition", PT)).toBeNull();
    expect(forcedMarkFor("@joão", "character", PT)).toBeNull();
    expect(forcedMarkFor(".COZINHA", "scene", PT)).toBeNull();
    expect(forcedMarkFor(">FUSÃO", "transition", PT)).toBeNull();
  });
  it("marks a cue with lowercase, or one that reads as a heading", () => {
    expect(forcedMarkFor("João", "character", PT)).toBe("@");
    expect(forcedMarkFor("INT. HOMEM", "character", PT)).toBe("@");
  });
  it("marks a heading with no known prefix", () => {
    expect(forcedMarkFor("COZINHA - NOITE", "scene", PT)).toBe(".");
    expect(forcedMarkFor("cena 2", "scene", PT)).toBe(".");
  });
  it("marks a transition with no known ending", () => {
    expect(forcedMarkFor("FUSÃO", "transition", PT)).toBe(">");
    expect(forcedMarkFor("Fade out.", "transition", PT)).toBe(">");
  });
  it("is null for other modes, blank lines and no mode", () => {
    expect(forcedMarkFor("ela anda", "action", PT)).toBeNull();
    expect(forcedMarkFor("oi", "dialogue", PT)).toBeNull();
    expect(forcedMarkFor("(rindo)", "parenthetical", PT)).toBeNull();
    expect(forcedMarkFor("João", null, PT)).toBeNull();
    expect(forcedMarkFor("  ", "character", PT)).toBeNull();
    expect(forcedMarkFor("", "scene", PT)).toBeNull();
  });
  it("gives a line the parser reads as the element once the mark is on", () => {
    const cases: Array<[string, ElementMode, LineKind, string]> = [
      ["João", "character", "character", "\nOi."],
      ["COZINHA - NOITE", "scene", "scene", ""],
      ["FUSÃO", "transition", "transition", "\n"],
    ];
    for (const [line, mode, kind, after] of cases) {
      const mark = forcedMarkFor(line, mode, PT);
      expect(mark).not.toBeNull();
      const text = `Ela sai.\n\n${mark}${line}${after}`;
      expect(kindsOf(text)[2]).toBe(kind);
    }
  });
});
