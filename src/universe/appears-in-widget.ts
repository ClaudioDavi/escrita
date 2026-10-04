// "Appears in" in the entry note (0.7 plan 4.2, Q34, board 24): a block widget at the end of
// the document in Live Preview and Source mode, drawn from a StateField (block widgets can't
// come from a ViewPlugin). It is never written into the file, so it is not selectable text,
// not exported and not counted. Only in a note that is an entry in the current mode.
//
// The universe module (5.1) builds the deps and registers `appearsInExtension` in an editor
// slot, so this file never touches `index.ts`.
//
// G0d stays open (author, 5.1): Reading view stays out and the TODO stands.
// TODO(G0d, open): Reading view. A Markdown post-processor would find the note's last
// section (`ctx.getSectionInfo`) and append `renderAppearsInSection` after it. Gate G0d
// (does it survive re-renders, long notes and a split pane?) is not run yet, so Reading view
// shows nothing for now and the panel's Entries tab has the list (Q34). When G0d passes, add
// the post-processor here and declare `postProcessor: true` in the universe module's slots.

import { Platform, editorInfoField } from "obsidian";
import { StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from "@codemirror/view";
import { sameAppearsIn } from "./appears-in-model";
import { appearsInOpen, renderAppearsInSection, type AppearsInLabels, type MentionRange } from "./appears-in";
import type { AppearsIn } from "./mentions";

/** `AppearsIn` when ready; "counting" while the index builds (board 24d); null when the note is not an entry in this mode (no section). */
export type AppearsInAnswer = AppearsIn | "counting" | null;

/** What the universe module offers (5.1: `appearsInSource()`): the panel's counts and lists read it, and the widget too. */
export interface AppearsInSource {
  appearsIn(path: string): AppearsInAnswer;
  labels(): AppearsInLabels;
}

export interface AppearsInWidgetDeps extends AppearsInSource {
  /** open `path` at the entry's first mention there (appears-in.ts `openMention`) */
  open(entry: string, path: string, range: MentionRange, evt: MouseEvent | KeyboardEvent): void;
  /** fires when the answers may have changed (the mentions index, the entries, the mode) */
  onChange(cb: () => void): () => void;
}

const refresh = StateEffect.define<null>();

class SectionWidget extends WidgetType {
  constructor(
    private entry: string,
    private answer: AppearsIn | "counting",
    private open: boolean,
    private other: boolean,
    private more: boolean,
    private compact: boolean,
    private deps: AppearsInWidgetDeps,
  ) { super(); }

  /** By value: the answer cache hands out a new object after any edit, and the DOM should survive that. */
  eq(o: SectionWidget): boolean {
    return o.entry === this.entry && o.open === this.open && o.other === this.other && o.more === this.more
      && o.compact === this.compact && sameAppearsIn(o.answer, this.answer);
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = view.dom.ownerDocument.createElement("div");
    wrap.className = "escrita-ai-wrap";
    const redraw = () => view.dispatch({ effects: refresh.of(null) });
    renderAppearsInSection(wrap, this.answer === "counting" ? null : this.answer, {
      labels: this.deps.labels(),
      open: (path, range, evt) => this.deps.open(this.entry, path, range, evt),
      toggle: () => { appearsInOpen.note = !appearsInOpen.note; redraw(); },
      toggleOther: () => { appearsInOpen.other = !appearsInOpen.other; redraw(); },
      toggleMore: () => { appearsInOpen.more = !appearsInOpen.more; redraw(); },
      compact: this.compact,
    });
    return wrap;
  }

  ignoreEvent(): boolean { return true; }
}

function build(state: EditorState, deps: AppearsInWidgetDeps): DecorationSet {
  const path = state.field(editorInfoField, false)?.file?.path;
  if (!path) return Decoration.none;
  const answer = deps.appearsIn(path);
  if (answer === null) return Decoration.none;
  const widget = new SectionWidget(path, answer, appearsInOpen.note, appearsInOpen.other, appearsInOpen.more, Platform.isMobile, deps);
  return Decoration.set([Decoration.widget({ widget, block: true, side: 1 }).range(state.doc.length)]);
}

export function appearsInExtension(deps: AppearsInWidgetDeps): Extension {
  const field = StateField.define<DecorationSet>({
    create: (state) => build(state, deps),
    // rebuilt on every transaction: it is one decoration, and `eq` keeps the DOM when nothing changed
    update: (_value, tr) => build(tr.state, deps),
    provide: (f) => EditorView.decorations.from(f),
  });
  // `editorInfoField` may not hold the file when the state is created, and the answers change
  // outside any transaction: this nudges the field once after creation and on every change.
  const nudge = ViewPlugin.define((view) => {
    let dead = false;
    const kick = () => { if (!dead) view.dispatch({ effects: refresh.of(null) }); };
    const timer = window.setTimeout(kick, 0);
    const stop = deps.onChange(kick);
    return {
      destroy() {
        dead = true;
        window.clearTimeout(timer);
        stop();
      },
    };
  });
  return [field, nudge];
}
