// The screenplay module's CodeMirror parts in a real EditorView (happy-dom): the keys, the modes,
// the caps, the forced marks and the layout classes. The Obsidian-facing parts are in the e2e spec.
import { afterEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { fountainOptions } from "../src/core/fountain";
import { DEFAULT_SETTINGS } from "../src/settings";
import { ScreenplayKeys } from "../src/screenplay/keys";
import { ScreenplayLayout } from "../src/screenplay/layout";
import { screenplayStrings } from "../src/screenplay/strings";
import { registerStrings } from "../src/i18n";

registerStrings(screenplayStrings);

const opts = fountainOptions(DEFAULT_SETTINGS);
const host = { isScreenplay: () => true, opts: () => opts };

let view: EditorView | null = null;
afterEach(() => { view?.destroy(); view = null; });

function open(doc: string, cursor = doc.length) {
  const keys = new ScreenplayKeys(host);
  const layout = new ScreenplayLayout({
    ...host, font: () => "courier", modes: (s) => keys.modesOf(s),
  });
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc, selection: { anchor: cursor },
      extensions: [editorLivePreviewField, keys.extension, layout.extension],
    }),
  });
  return { view, keys, layout };
}

/** whether an input handler took the text, as CodeMirror asks them in turn */
const handled = (v: EditorView, from: number, to: number, ch: string) =>
  v.state.facet(EditorView.inputHandler).some((f) => f(v, from, to, ch, () => v.state.update({})));
const text = () => view!.state.doc.toString();
const head = () => view!.state.selection.main.head;
/** types one character the way the browser does: through the editor's input handlers, then plainly */
function type(ch: string): void {
  const v = view!;
  const { from, to } = v.state.selection.main;
  if (handled(v, from, to, ch)) return;
  v.dispatch({ changes: { from, to, insert: ch }, selection: { anchor: from + ch.length }, userEvent: "input.type" });
}
const typeAll = (s: string) => { for (const c of s) type(c); };

describe("keys", () => {
  it("Tab on an empty line starts a cue, which types in capitals", () => {
    const { view, keys } = open("The room.\n\n");
    expect(keys.run(view, "Tab")).toBe(true);
    expect(keys.modeAt(view.state, view.state.doc.line(3).from)).toBe("character");
    typeAll("mara");
    expect(text()).toBe("The room.\n\nMARA");
  });

  it("Enter after a cue goes to dialogue, which types as typed; Enter after dialogue goes to the next cue", () => {
    const { view, keys } = open("The room.\n\n");
    keys.run(view, "Tab");
    typeAll("mara");
    expect(keys.run(view, "Enter")).toBe(true);
    expect(text()).toBe("The room.\n\nMARA\n");
    typeAll("Hello.");
    expect(text()).toBe("The room.\n\nMARA\nHello.");
    expect(keys.run(view, "Enter")).toBe(true);
    expect(text()).toBe("The room.\n\nMARA\nHello.\n\n");
    // the next cue's mode, and the ghost's line
    expect(keys.modeAt(view.state, head())).toBe("character");
    typeAll("joe");
    expect(text().endsWith("\n\nJOE")).toBe(true);
  });

  it("Enter on an empty cue line goes back to action", () => {
    const { view, keys } = open("Mara waits.\n\n");
    keys.run(view, "Tab");
    expect(keys.run(view, "Enter")).toBe(true);
    expect(keys.modeAt(view.state, head())).toBe("action");
    expect(text()).toBe("Mara waits.\n\n");
  });

  it("Tab after a cue opens a parenthetical with the cursor inside", () => {
    const { view, keys } = open("Mara waits.\n\n");
    keys.run(view, "Tab");
    typeAll("mara");
    expect(keys.run(view, "Tab")).toBe(true);
    expect(text()).toBe("Mara waits.\n\nMARA\n()");
    expect(text().slice(head() - 1, head() + 1)).toBe("()");
  });

  it("Tab cycles action, character, transition, scene and Shift-Tab goes back", () => {
    const { view, keys } = open("A.\n\n");
    const at = () => keys.modeAt(view.state, view.state.doc.line(3).from);
    keys.run(view, "Tab"); expect(at()).toBe("character");
    keys.run(view, "Tab"); expect(at()).toBe("transition");
    keys.run(view, "Tab"); expect(at()).toBe("scene");
    keys.run(view, "Shift-Tab"); expect(at()).toBe("transition");
  });

  it("each key is one transaction", () => {
    const { view, keys } = open("The room.\n\n");
    let n = 0;
    const orig = view.dispatch.bind(view);
    view.dispatch = ((...a: Parameters<typeof orig>) => { n++; return orig(...a); }) as typeof view.dispatch;
    keys.run(view, "Tab");
    typeAll("mara");
    n = 0;
    keys.run(view, "Enter");
    expect(n).toBe(1);
  });

  it("falls through where the table has no answer", () => {
    const { view, keys } = open("Mara waits.");
    view.dispatch({ selection: { anchor: 3 } });
    expect(keys.run(view, "Enter")).toBe(false);
    expect(keys.run(view, "Tab")).toBe(false);
    expect(text()).toBe("Mara waits.");
  });

  it("does nothing outside a screenplay", () => {
    const keys = new ScreenplayKeys({ isScreenplay: () => false, opts: () => opts });
    view = new EditorView({ parent: document.body, state: EditorState.create({ doc: "A.\n\n", selection: { anchor: 4 }, extensions: [keys.extension] }) });
    expect(keys.run(view, "Tab")).toBe(false);
    expect(handled(view, 4, 4, "m")).toBe(false);
  });

  it("an empty line in the properties is not the script's", () => {
    const { view, keys } = open("---\nform: screenplay\n\nx: 1\n---\n\nBody.", 21);
    expect(view.state.doc.lineAt(21).text).toBe("");
    expect(keys.run(view, "Tab")).toBe(false);
  });
});

describe("caps", () => {
  it("only the typed characters change, never the text already there", () => {
    const { view } = open("The room.\n\nint. kitchen");
    typeAll("x");
    expect(text()).toBe("The room.\n\nint. kitchenX");
    view.dispatch({ selection: { anchor: 14 } });
    typeAll("y");
    expect(text()).toBe("The room.\n\nintY. kitchenX");
  });

  it("an action line is left alone", () => {
    open("The room.\n\nmara");
    typeAll("x");
    expect(text()).toBe("The room.\n\nmarax");
  });

  it("a scene heading typed in lowercase is uppercased", () => {
    const { view, keys } = open("The room.\n\n");
    keys.run(view, "Tab"); keys.run(view, "Tab"); keys.run(view, "Tab"); // scene
    typeAll("int. kitchen - day");
    expect(text()).toBe("The room.\n\nINT. KITCHEN - DAY");
  });

  it("a forced line keeps the writer's case", () => {
    const { view } = open("The room.\n\n@Mc");
    typeAll("x");
    expect(text()).toBe("The room.\n\n@Mcx");
  });

  it("a parenthetical stays as typed", () => {
    const { view, keys } = open("A.\n\n");
    keys.run(view, "Tab");
    typeAll("mara");
    keys.run(view, "Tab");
    typeAll("softly");
    expect(text()).toBe("A.\n\nMARA\n(softly)");
  });
});

describe("leaving a line", () => {
  it("an empty line in a mode lets it go when the cursor leaves", async () => {
    const { view, keys } = open("A.\n\nB.");
    view.dispatch({ selection: { anchor: 3 } });
    keys.run(view, "Tab");
    expect(keys.modesOf(view.state)).toHaveLength(1);
    view.dispatch({ selection: { anchor: 0 } });
    expect(keys.modesOf(view.state)).toHaveLength(0);
  });

  it("a cue typed in a mode that needs @ gets it in a transaction of its own", async () => {
    const { view, keys } = open("A.\n\n");
    keys.run(view, "Tab");
    // lowercase that caps does not touch (a pasted or forced entry): the cursor leaving adds the mark
    view.dispatch({ changes: { from: view.state.doc.length, insert: "McCloud" }, selection: { anchor: view.state.doc.length + 7 } });
    view.dispatch({ selection: { anchor: 0 } });
    await Promise.resolve();
    expect(text()).toBe("A.\n\n@McCloud");
    expect(keys.modesOf(view.state)).toHaveLength(0);
  });

  it("a cue that reads as a cue by itself gets no mark", async () => {
    const { view, keys } = open("A.\n\n");
    keys.run(view, "Tab");
    typeAll("mara");
    view.dispatch({ selection: { anchor: 0 } });
    await Promise.resolve();
    expect(text()).toBe("A.\n\nMARA");
    expect(keys.modesOf(view.state)).toHaveLength(0);
  });
});

describe("layout", () => {
  it("gives each line its kind and the editor its class", () => {
    const { view } = open("INT. KITCHEN - DAY\n\nMara waits.\n\nMARA\nHello _there_.\n\nCUT TO:\n", 0);
    const lines = [...view.dom.querySelectorAll(".cm-line")].map((l) => l.className);
    expect(lines[0]).toContain("escrita-sp-scene");
    expect(lines[2]).toContain("escrita-sp-action");
    expect(lines[4]).toContain("escrita-sp-character");
    expect(lines[5]).toContain("escrita-sp-dialogue");
    expect(lines[7]).toContain("escrita-sp-transition");
    expect(view.dom.classList.contains("escrita-screenplay")).toBe(true);
    expect(view.dom.classList.contains("escrita-screenplay-courier")).toBe(true);
    expect(view.dom.querySelector(".escrita-sp-underline")?.textContent).toBe("_there_");
  });

  it("a line in a mode takes the element's column before it has text", () => {
    const { view, keys } = open("A.\n\n");
    keys.run(view, "Tab");
    const last = [...view.dom.querySelectorAll(".cm-line")].pop()!;
    expect(last.className).toContain("escrita-sp-character");
    expect(view.dom.querySelector(".escrita-sp-ghost")?.textContent).toBe("Character");
  });

  it("Tab in a new, empty script gives its one line the column too (an empty note has no visible range)", () => {
    const { view, keys } = open("");
    keys.run(view, "Tab");
    expect(view.dom.querySelector(".cm-line")!.className).toContain("escrita-sp-character");
  });

  it("is plain in Source mode and in a note that is not a screenplay", () => {
    const keys = new ScreenplayKeys(host);
    const off = new ScreenplayLayout({ isScreenplay: () => false, opts: () => opts, font: () => "theme", modes: (s) => keys.modesOf(s) });
    view = new EditorView({ parent: document.body, state: EditorState.create({ doc: "MARA\nHi.", extensions: [editorLivePreviewField, off.extension] }) });
    expect(view.dom.classList.contains("escrita-screenplay")).toBe(false);
    expect(view.dom.querySelector("[class*=escrita-sp-]")).toBeNull();
    view.destroy();
    const on = new ScreenplayLayout({ ...host, font: () => "theme", modes: (s) => keys.modesOf(s) });
    view = new EditorView({ parent: document.body, state: EditorState.create({ doc: "MARA\nHi.", extensions: [on.extension] }) });
    expect(view.dom.classList.contains("escrita-screenplay")).toBe(false);
  });

  it("the theme font leaves the courier class off", () => {
    const keys = new ScreenplayKeys(host);
    const layout = new ScreenplayLayout({ ...host, font: () => "theme", modes: (s) => keys.modesOf(s) });
    view = new EditorView({ parent: document.body, state: EditorState.create({ doc: "MARA\nHi.", extensions: [editorLivePreviewField, layout.extension] }) });
    expect(view.dom.classList.contains("escrita-screenplay")).toBe(true);
    expect(view.dom.classList.contains("escrita-screenplay-courier")).toBe(false);
  });
});
