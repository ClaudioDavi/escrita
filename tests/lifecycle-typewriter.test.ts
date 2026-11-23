// The typewriter scroll's wiring (1.3 W1 E): one editor slot on the desk, filled while the desk is
// on and empty after, and an extender that stays quiet in every case that must not scroll. What
// `recenters` answers is tested in typewriter.test.ts; here only the wiring is checked, so these
// tests never rely on the core's result.
import { beforeEach, describe, expect, it } from "vitest";
import { EditorState, Transaction, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Platform } from "./support/obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import { DeskModule } from "../src/desk";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let registry: FeatureRegistry;
let desk: DeskModule;

beforeEach(() => {
  Platform.isMobile = false;
  plugin = fakePlugin();
  desk = new DeskModule(plugin.asPlugin);
  registry = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, DeskModule>([["desk", desk]]));
  plugin.features = registry;
  registry.init();
});

const slot = () => plugin.extensions[0] as Extension[];

describe("typewriter slot", () => {
  it("is declared once, filled while the desk is on and empty after", () => {
    expect(plugin.extensions).toHaveLength(1);
    expect(slot()).toEqual([]);
    registry.apply();
    expect(slot()).toHaveLength(1);
    plugin.turn("desk", false);
    expect(plugin.extensions).toHaveLength(1);
    expect(slot()).toEqual([]);
    plugin.turn("desk", true);
    expect(slot()).toHaveLength(1);
    expect(plugin.extensions).toHaveLength(1);
  });

  it("adds no workspace listener and no command of its own", () => {
    registry.apply();
    // the desk's own five listeners and three commands, as in lifecycle-desk.test.ts
    expect(plugin.liveListeners()).toBe(5);
    expect(plugin.commands.size).toBe(3);
  });
});

describe("typewriter extender", () => {
  /** A real editor with the slot's extension; the fake info field holds null, so no note qualifies. */
  function editor(): EditorView {
    registry.apply();
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    return new EditorView({ parent, state: EditorState.create({ doc: "one\n\ntwo", extensions: [...slot()] }) });
  }

  it("adds no scroll effect when writing mode is off, whatever the event", () => {
    const view = editor();
    const tr = view.state.update({ changes: { from: 8, insert: "x" }, selection: { anchor: 9 }, userEvent: "input.type" });
    expect(tr.effects).toHaveLength(0);
    view.destroy();
  });

  it("adds no scroll effect in writing mode for an editor that is not a note's own (no MarkdownView in the state)", () => {
    const view = editor();
    desk.writingMode.enter();
    const tr = view.state.update({ changes: { from: 8, insert: "x" }, selection: { anchor: 9 }, userEvent: "input.type" });
    expect(tr.effects).toHaveLength(0);
    desk.writingMode.exit();
    view.destroy();
  });

  it("adds no scroll effect without a user event, or on a phone", () => {
    const view = editor();
    desk.writingMode.enter();
    expect(view.state.update({ changes: { from: 8, insert: "x" } }).effects).toHaveLength(0);
    Platform.isMobile = true;
    expect(view.state.update({ changes: { from: 8, insert: "x" }, annotations: Transaction.userEvent.of("input.type") }).effects).toHaveLength(0);
    desk.writingMode.exit();
    view.destroy();
  });

  it("settingsChanged forgets the tracked cache without throwing", () => {
    registry.apply();
    expect(() => desk.settingsChanged()).not.toThrow();
  });
});
