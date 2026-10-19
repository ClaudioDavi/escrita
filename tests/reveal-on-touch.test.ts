// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { revealOnTouch, touches } from "../src/ui/reveal-on-touch";

const raw = Decoration.mark({ class: "raw" });
const shown = Decoration.mark({ class: "shown" });

interface Item { from: number; to: number }

function classesOf(view: EditorView): string[] {
  const out: string[] = [];
  const found = (view as unknown as { plugins: { value?: { decorations?: DecorationSet } }[] }).plugins;
  for (const p of found) {
    const d = p.value?.decorations;
    d?.between(0, view.state.doc.length, (_f, _t, v) => { out.push((v.spec as { class: string }).class); });
  }
  return out;
}

function make(doc: string, live: boolean, scan: (v: EditorView) => Item[], key?: () => unknown, cursor = 0) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [
      editorLivePreviewField.init(() => live),
      revealOnTouch<Item>({
        scan,
        key,
        raw: (i) => [raw.range(i.from, i.to) as Range<Decoration>],
        rendered: (i) => [shown.range(i.from, i.to) as Range<Decoration>],
      }),
    ],
  });
  return new EditorView({ state, parent: document.body });
}

describe("touches", () => {
  const item = { from: 5, to: 10 };
  it("counts the edges", () => {
    expect(touches(item, [{ from: 5, to: 5 }])).toBe(true);
    expect(touches(item, [{ from: 10, to: 10 }])).toBe(true);
  });
  it("misses a cursor elsewhere and sees a range that covers it", () => {
    expect(touches(item, [{ from: 0, to: 4 }])).toBe(false);
    expect(touches(item, [{ from: 11, to: 12 }])).toBe(false);
    expect(touches(item, [{ from: 0, to: 20 }])).toBe(true);
  });
});

describe("revealOnTouch", () => {
  const doc = "aaa\n[x]\nbbb";
  const scan = () => [{ from: 4, to: 7 }];

  it("draws the item in Live Preview when the cursor is elsewhere", () => {
    const view = make(doc, true, scan);
    expect(classesOf(view)).toEqual(["shown"]);
    view.destroy();
  });

  it("shows the raw item when the cursor touches it", () => {
    const view = make(doc, true, scan, undefined, 5);
    expect(classesOf(view)).toEqual(["raw"]);
    view.dispatch({ selection: { anchor: 0 } });
    expect(classesOf(view)).toEqual(["shown"]);
    view.destroy();
  });

  it("shows the raw item in Source mode", () => {
    const view = make(doc, false, scan);
    expect(classesOf(view)).toEqual(["raw"]);
    view.destroy();
  });

  it("scans again on a text change and on a new key, not on a selection change", () => {
    const fn = vi.fn(scan);
    let k = 1;
    const view = make(doc, true, fn, () => k);
    expect(fn).toHaveBeenCalledTimes(1);
    view.dispatch({ selection: { anchor: 2 } });
    expect(fn).toHaveBeenCalledTimes(1);
    view.dispatch({ changes: { from: 0, insert: "z" } });
    expect(fn).toHaveBeenCalledTimes(2);
    k = 2;
    view.dispatch({ selection: { anchor: 3 } });
    expect(fn).toHaveBeenCalledTimes(3);
    view.destroy();
  });

  it("draws nothing when the scan finds nothing", () => {
    const view = make(doc, true, () => []);
    expect(classesOf(view)).toEqual([]);
    view.destroy();
  });
});
