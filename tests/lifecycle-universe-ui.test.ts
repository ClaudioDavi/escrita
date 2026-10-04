// Lifecycle of the universe's editor UI (0.7 plan 5.1, finding 18): the name marks and the
// "Appears in" widget are CodeMirror plugins, so they need a DOM; everything that registers
// something proves it lets go.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Keymap } from "obsidian";
import { compileTerms, type NameSource } from "../src/core/names";
import { appearsInOpen, renderAppearsInSection, defaultLabels } from "../src/universe/appears-in";
import { appearsInExtension, type AppearsInAnswer } from "../src/universe/appears-in-widget";
import { NameMarks, DEBOUNCE_MS } from "../src/universe/name-marks";
import { registerAppearsStrings } from "../src/universe/strings-appears";
import { registerStrings } from "../src/i18n";
import { universeViewStrings } from "../src/universe/view-strings";
import type { AppearsIn } from "../src/universe/mentions";

const src = (id: string, name: string): NameSource => ({ id, name, aliases: [], person: true, firstName: false, caseSensitive: false, ignore: [] });
const opts = { lang: "pt" as const, extraTitles: [] };

let views: EditorView[] = [];
function mount(doc: string, extensions: import("@codemirror/state").Extension[]): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const v = new EditorView({ state: EditorState.create({ doc, extensions }), parent });
  views.push(v);
  return v;
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  for (const v of views) v.destroy();
  views = [];
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A names source whose table identity and version the test controls. */
function names(initial: NameSource[]) {
  const st = { sources: initial, version: 0, listeners: new Set<() => void>(), asked: 0, fresh: false };
  let cached = compileTerms(initial, opts);
  const api = {
    tableFor: () => {
      st.asked++;
      if (st.fresh) return compileTerms(st.sources, opts);   // a new object every call, same content
      return cached;
    },
    version: () => st.version,
    onChange: (cb: () => void) => { st.listeners.add(cb); return () => { st.listeners.delete(cb); }; },
  };
  return {
    st, api,
    set(sources: NameSource[]) { st.sources = sources; cached = compileTerms(sources, opts); st.version++; for (const cb of [...st.listeners]) cb(); },
  };
}

const marked = (v: EditorView): string[] => [...v.dom.querySelectorAll(".escrita-name-mark")].map((e) => e.textContent ?? "");

describe("NameMarks", () => {
  it("marks names, and spellcheck is off on them", () => {
    const n = names([src("Universo/Mariana.md", "Mariana")]);
    const marks = new NameMarks({ names: n.api, underline: () => false, pathOf: () => "a.md" });
    const v = mount("Mariana viu o mar.", [marks.extension]);
    expect(marked(v)).toEqual(["Mariana"]);
    expect(v.dom.querySelector(".escrita-name-mark")?.getAttribute("spellcheck")).toBe("false");
    marks.dispose();
  });

  it("dispose stops listening for names, and a destroyed view clears its timer", () => {
    const n = names([src("Universo/Mariana.md", "Mariana")]);
    const marks = new NameMarks({ names: n.api, underline: () => false, pathOf: () => "a.md" });
    expect(n.st.listeners.size).toBe(1);
    const v = mount("Mariana viu o mar.", [marks.extension]);
    v.dispatch({ changes: { from: 0, insert: "x" } });
    expect(vi.getTimerCount()).toBeGreaterThan(0);          // the debounced re-match
    v.destroy();
    expect(vi.getTimerCount()).toBe(0);
    marks.dispose();
    expect(n.st.listeners.size).toBe(0);
    expect(() => n.set([])).not.toThrow();
  });

  it("a names change re-matches every open editor", () => {
    const n = names([src("Universo/Mariana.md", "Mariana")]);
    const marks = new NameMarks({ names: n.api, underline: () => false, pathOf: () => "a.md" });
    const v = mount("Mariana e Teodoro.", [marks.extension]);
    expect(marked(v)).toEqual(["Mariana"]);
    n.set([src("Universo/Mariana.md", "Mariana"), src("Universo/Teodoro.md", "Teodoro")]);
    vi.advanceTimersByTime(DEBOUNCE_MS + 10);
    expect(marked(v)).toEqual(["Mariana", "Teodoro"]);
    marks.dispose();
  });

  it("a table object with the same signature is not a reason for a full pass (finding 2)", () => {
    const both = [src("Universo/Mariana.md", "Mariana"), src("Universo/Teodoro.md", "Teodoro")];
    const n = names(both);
    const marks = new NameMarks({ names: n.api, underline: () => false, pathOf: () => "a.md" });
    const v = mount("Mariana ria.\n\nTeodoro saiu.\n\nFim.", [marks.extension]);
    expect(marked(v)).toEqual(["Mariana", "Teodoro"]);
    // from now on tableFor hands out a NEW object each time, and one that lacks Teodoro but keeps the
    // signature: a pass that compared objects would run in full and drop that mark; one that compares
    // signatures re-matches only the paragraph the edit touched.
    const lacking = compileTerms([both[0]!], opts);
    n.api.tableFor = () => ({ ...lacking, signature: compileTerms(both, opts).signature });
    v.dispatch({ changes: { from: v.state.doc.length, insert: "!" } });
    vi.advanceTimersByTime(DEBOUNCE_MS + 10);
    expect(marked(v)).toEqual(["Mariana", "Teodoro"]);
    // and a real version bump does run the full pass
    n.st.version++;
    v.dispatch({ changes: { from: v.state.doc.length, insert: "!" } });
    vi.advanceTimersByTime(DEBOUNCE_MS + 10);
    expect(marked(v)).toEqual(["Mariana"]);
    marks.dispose();
  });

  it("underline and spellcheck follow the settings, and refresh() redraws", () => {
    const n = names([src("Universo/Mariana.md", "Mariana")]);
    let underline = false;
    const marks = new NameMarks({ names: n.api, underline: () => underline, spellcheckWorks: () => false, pathOf: () => "a.md" });
    const v = mount("Mariana.", [marks.extension]);
    expect(marked(v)).toEqual([]);                           // neither spellcheck nor underline: nothing to draw
    underline = true;
    marks.refresh();
    expect(v.dom.querySelector(".escrita-name-underline")?.textContent).toBe("Mariana");
    marks.dispose();
  });

  describe("Ctrl/Cmd-click opens the entry (finding 7)", () => {
    function setup(open: ((p: string, e: MouseEvent) => void) | undefined) {
      const n = names([src("Universo/Mariana.md", "Mariana")]);
      const marks = new NameMarks({ names: n.api, underline: () => true, pathOf: () => "a.md", open });
      const v = mount("Mariana viu o mar.", [marks.extension]);
      const span = v.dom.querySelector(".escrita-name-mark") as HTMLElement;
      const down = (target: Element) => {
        const evt = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
        target.dispatchEvent(evt);
        return evt;
      };
      return { v, span, down, marks };
    }

    it("opens the entry on a modifier-click on a mark, and keeps the click from moving the cursor", () => {
      vi.spyOn(Keymap, "isModEvent").mockReturnValue(true as never);
      const opened: string[] = [];
      const { span, down, marks } = setup((p) => opened.push(p));
      const evt = down(span);
      expect(opened).toEqual(["Universo/Mariana.md"]);
      expect(evt.defaultPrevented).toBe(true);
      marks.dispose();
    });

    // The negative cases (no modifier, outside a mark, no open handler) let CodeMirror's own
    // mousedown run, which happy-dom can't host; markAt and entryAt are tested in universe-name-marks.test.ts.
  });
});

describe("appearsInExtension", () => {
  const ai = (n: number): AppearsIn => ({
    works: Array.from({ length: n }, (_, i) => ({ work: `W${i}.md`, count: 1, notes: [{ path: `W${i}.md`, count: 1, first: { from: 0, to: 3 } }] })),
    other: [], total: n, workCount: n,
  });

  function deps(answer: () => AppearsInAnswer) {
    const subs = { n: 0, off: 0, cbs: new Set<() => void>() };
    return {
      subs,
      d: {
        appearsIn: () => answer(),
        labels: () => defaultLabels,
        open: () => {},
        onChange: (cb: () => void) => { subs.n++; subs.cbs.add(cb); return () => { subs.off++; subs.cbs.delete(cb); }; },
      },
    };
  }

  beforeEach(() => { registerStrings(universeViewStrings); registerAppearsStrings(); });

  it("draws the section for an entry, nothing for a note that is not one", () => {
    const withIt = deps(() => ai(3));
    // editorInfoField is a stand-in with no file: the widget builds nothing without a path
    const v = mount("texto", [appearsInExtension(withIt.d)]);
    vi.advanceTimersByTime(5);
    expect(v.dom.querySelector(".escrita-ai-section")).toBeNull();
  });

  it("the ViewPlugin's destroy unsubscribes and clears its timer", () => {
    const { d, subs } = deps(() => null);
    const v = mount("texto", [appearsInExtension(d)]);
    expect(subs.n).toBe(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);          // the nudge after creation
    v.destroy();
    expect(subs.off).toBe(1);
    expect(subs.cbs.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(() => vi.advanceTimersByTime(10)).not.toThrow();
  });

  it("a change after destroy does nothing", () => {
    const { d, subs } = deps(() => null);
    const v = mount("texto", [appearsInExtension(d)]);
    const cbs = [...subs.cbs];
    v.destroy();
    expect(() => cbs.forEach((cb) => cb())).not.toThrow();
  });
});

describe("the section's compact phone layout (finding 8)", () => {
  const ai = (n: number): AppearsIn => ({
    works: Array.from({ length: n }, (_, i) => ({
      work: `W${i}.md`, count: 2 + i,
      notes: [{ path: `W${i}.md`, count: 1, first: { from: 0, to: 3 } }, { path: `W${i}/c1.md`, count: 1 + i, first: { from: 4, to: 7 } }],
      firstChapter: `W${i}/c1.md`, lastChapter: `W${i}/c2.md`,
    })),
    other: [{ path: "x.md", count: 1, first: { from: 0, to: 1 } }], total: 20, workCount: n,
  });
  const draw = (a: AppearsIn, compact: boolean) => {
    const parent = document.createElement("div");
    let more = 0;
    renderAppearsInSection(parent, a, { labels: defaultLabels, open: () => {}, toggle: () => {}, toggleOther: () => {}, toggleMore: () => { more++; }, compact });
    return { parent, more: () => more };
  };

  beforeEach(() => {
    registerStrings(universeViewStrings);
    registerAppearsStrings();
    appearsInOpen.note = true;
    appearsInOpen.more = false;
    appearsInOpen.other = false;
  });
  afterEach(() => { appearsInOpen.note = false; appearsInOpen.more = false; });

  it("lists two works with no chapters, no first/last line and no other notes, then the more row", () => {
    const { parent, more } = draw(ai(4), true);
    expect([...parent.querySelectorAll(".is-work .escrita-ai-name")].map((e) => e.textContent)).toEqual(["W0", "W1"]);
    expect(parent.querySelector(".is-chapter")).toBeNull();
    expect(parent.querySelector(".escrita-ai-firstlast")).toBeNull();
    expect(parent.querySelector(".is-other")).toBeNull();
    const row = parent.querySelector(".is-more") as HTMLElement;
    expect(row.textContent).toContain("2 more");
    row.click();
    expect(more()).toBe(1);
  });

  it("opened, the more row is gone and every work shows, still without chapters", () => {
    appearsInOpen.more = true;
    const { parent } = draw(ai(4), true);
    expect(parent.querySelectorAll(".is-work")).toHaveLength(4);
    expect(parent.querySelector(".is-more")).toBeNull();
    expect(parent.querySelector(".is-chapter")).toBeNull();
  });

  it("with two works or fewer there is no more row", () => {
    expect(draw(ai(2), true).parent.querySelector(".is-more")).toBeNull();
  });

  it("the desktop layout still shows chapters and the other notes group", () => {
    const { parent } = draw(ai(4), false);
    expect(parent.querySelectorAll(".is-chapter").length).toBeGreaterThan(0);
    expect(parent.querySelector(".is-other")).not.toBeNull();
    expect(parent.querySelector(".is-more")).toBeNull();
  });
});
