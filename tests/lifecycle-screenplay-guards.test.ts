// The two checks the screenplay editor puts in the editor module: Enter flow stays out of a
// screenplay note (PLAN-1.2 Q9) and dialogue focus is off in one (Q12), whether or not the
// screenplay switch is on.
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import { DialogueFocusFeature, TypingFeature } from "../src/editor/features";
import { fakePlugin } from "./support/fake-plugin";

const file = { path: "Roteiros/Curta.md", extension: "md" };

function setup(form: string) {
  const plugin = fakePlugin();
  plugin.settings.enterFlow = true;
  plugin.books = { classify: () => ({ form, kind: "chapter", tracked: true }) };
  const typing = new TypingFeature(plugin.asPlugin);
  const doc = "Prose.\n\n\n";
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc, selection: { anchor: doc.length }, extensions: [editorInfoField.init(() => ({ file }) as never)] }),
  });
  return { plugin, typing, view };
}

describe("Enter flow in a screenplay", () => {
  it("acts in a chapter that is not a screenplay (the control)", () => {
    const { typing, view } = setup("shortStory");
    expect((typing as unknown as { onEnter(v: EditorView): boolean }).onEnter(view)).toBe(true);
    view.destroy();
  });

  it("returns false in a screenplay note and changes nothing", () => {
    const { typing, view } = setup("screenplay");
    expect((typing as unknown as { onEnter(v: EditorView): boolean }).onEnter(view)).toBe(false);
    expect(view.state.doc.toString()).toBe("Prose.\n\n\n");
    view.destroy();
  });
});

describe("dialogue focus in a screenplay", () => {
  function isOn(form: string): boolean {
    const plugin = fakePlugin();
    plugin.books = { classify: () => ({ form }) };
    const feature = new DialogueFocusFeature(plugin.asPlugin);
    (feature as unknown as { dialogueOn: Set<string> }).dialogueOn.add(file.path);
    // the model's own on/off check, as its plugin asks it
    const dialogue = (feature as unknown as { dialogue: { views: unknown } }).dialogue;
    expect(dialogue).toBeDefined();
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc: "“Hello,” she said.\n", extensions: [editorInfoField.init(() => ({ file }) as never), (dialogue as unknown as { extension: never }).extension] }),
    });
    const dimmed = view.dom.classList.contains("escrita-dialogue-focus");
    view.destroy();
    return dimmed;
  }

  it("dims in a story and not in a screenplay", () => {
    expect(isOn("shortStory")).toBe(true);
    expect(isOn("screenplay")).toBe(false);
  });
});
