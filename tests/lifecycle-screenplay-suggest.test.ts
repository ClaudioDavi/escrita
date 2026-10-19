// The screenplay EditorSuggest around core/screenplay-suggest.ts: when it triggers, what it
// offers and the small note beside each name.
import { afterEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fountainOptions } from "../src/core/fountain";
import { DEFAULT_SETTINGS } from "../src/settings";
import { ScreenplaySuggest } from "../src/screenplay/suggest";
import { screenplayStrings } from "../src/screenplay/strings";
import { registerStrings } from "../src/i18n";
import type { TermTable } from "../src/core/names";

registerStrings(screenplayStrings);
const opts = fountainOptions(DEFAULT_SETTINGS);
const file = { path: "Roteiros/Curta.md" } as never;
const table = { terms: [{ id: "Mundo/Nina.md", text: "Nina", origin: "name" }, { id: "Mundo/Nina.md", text: "Nin", origin: "alias" }], lang: null, signature: "" } as unknown as TermTable;

let view: EditorView | null = null;
afterEach(() => { view?.destroy(); view = null; });

function setup(doc: string, screenplay = true) {
  const suggest = new ScreenplaySuggest({} as never, {
    isScreenplay: () => screenplay, opts: () => opts, times: () => ["DAY", "NIGHT"], names: () => table,
  });
  view = new EditorView({ parent: document.body, state: EditorState.create({ doc }) });
  const editor = { cm: view } as never;
  const at = (line: number, ch: number) => {
    const info = suggest.onTrigger({ line, ch }, editor, file);
    if (!info) return null;
    return { info, items: suggest.getSuggestions({ ...info, editor, file } as never) };
  };
  return { suggest, at };
}

const SCRIPT = "INT. KITCHEN - DAY\n\nMARA\nHi.\n\nJOE\nHey.\n\nMARA\nBye.\n\n";

describe("screenplay suggest", () => {
  it("offers the script's cues by use, then the universe's names, with a note each", () => {
    const { at } = setup(SCRIPT + "N");
    const got = at(11, 1)!;
    expect(got.info.query).toBe("N");
    expect(got.items).toEqual([{ kind: "cue", text: "NINA", note: "universe" }]);
    const all = setup(SCRIPT + "J").at(11, 1)!;
    expect(all.items).toEqual([{ kind: "cue", text: "JOE", note: "1 speech" }]);
  });

  it("offers the locations used after a scene prefix and the times after a dash", () => {
    const { at } = setup(SCRIPT + "INT. K");
    const loc = at(11, 6)!;
    expect(loc.info.start).toEqual({ line: 11, ch: 5 });
    expect(loc.items.map((i) => i.text)).toEqual(["KITCHEN"]);
    const t = setup("INT. KITCHEN - ").at(0, 15)!;
    expect(t.items.map((i) => i.text)).toEqual(["DAY", "NIGHT"]);
  });

  it("is quiet in a note that is not a screenplay, while off and where nothing is asked", () => {
    expect(setup(SCRIPT + "N", false).at(11, 1)).toBeNull();
    const off = setup(SCRIPT + "N");
    off.suggest.disable();
    expect(off.at(11, 1)).toBeNull();
    expect(setup("Mara waits.").at(0, 5)).toBeNull();
  });

  it("picking replaces up to the cursor as it is now, and leaves the cursor after the name", () => {
    const { suggest } = setup("INT. KIT");
    const calls: unknown[] = [];
    // the list was drawn at "K" (end at ch 6); two more letters were typed since
    const editor = {
      getCursor: () => ({ line: 0, ch: 8 }),
      replaceRange: (...a: unknown[]) => calls.push(["replace", ...a]),
      setCursor: (...a: unknown[]) => calls.push(["cursor", ...a]),
    };
    (suggest as unknown as { context: unknown }).context = { editor, start: { line: 0, ch: 5 }, end: { line: 0, ch: 6 } };
    suggest.selectSuggestion({ kind: "location", text: "KITCHEN", note: "" });
    expect(calls).toEqual([
      ["replace", "KITCHEN", { line: 0, ch: 5 }, { line: 0, ch: 8 }],
      ["cursor", { line: 0, ch: 12 }],
    ]);
  });
});
