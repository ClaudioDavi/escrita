// The typewriter scroll's extension (1.2.5, SF 17; PLAN-1.2.5 D3, D5, D7). In writing mode, for the
// notes the setting takes, a keystroke that `recenters` (core/typewriter.ts) brings the cursor's
// line to two thirds of the way down. The scroll is made by an `EditorState.transactionExtender`
// adding `EditorView.scrollIntoView(head, { y: "start", yMargin })` to the transaction itself, so it
// wins over Obsidian's and CodeMirror's own scroll with no flicker (measured in the S0 spike).
//
// The margin needs the editor's height, which a transaction extender cannot read (it has no
// view). A small ViewPlugin measures `scrollDOM.clientHeight` in a `requestMeasure` (key "tw") and
// keeps it per view. The extender finds the view its transaction belongs to by state identity:
// a transaction is built by `view.state.update(...)` before the view applies it, so
// `tr.startState === view.state` for exactly one view. That makes it right in splits and pop-out
// windows with no focus tracking. If no view matches (a state dispatched out of the usual way) or
// the height is not measured yet, the extender does nothing.
//
// Which editors: only a MarkdownView's own editor (`editorInfoField` holds a MarkdownView; an
// embed, a hover popover or a canvas card holds something else), on a Markdown file, and never
// on a phone. With "tracked" the file must be `books.classify(file).tracked`; the answer is cached
// by path and forgotten when the settings change (the track folders may have moved).
// Writing mode is read live from the port (`isActive()`), so there is nothing to subscribe to or
// to undo: leaving the mode or setting "off" simply makes the extender return null.

import { EditorState, Transaction, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { editorInfoField, MarkdownView, Platform } from "obsidian";
import type EscritaPlugin from "../main";
import type { WritingModePort } from "../core/writing-mode";
import { recenters, typewriterMargin, type TypewriterTransaction } from "../core/typewriter";
import { EditorSet } from "../ui/editor-glue";

export class Typewriter {
  private readonly views = new EditorSet();
  private readonly heights = new WeakMap<EditorView, number>();
  private readonly tracked = new Map<string, boolean>();
  readonly extension: Extension;

  constructor(private readonly plugin: EscritaPlugin, private readonly mode: WritingModePort) {
    const { views, heights } = this;
    const measurer = ViewPlugin.fromClass(class {
      constructor(private readonly view: EditorView) {
        views.add(view);
        this.measure();
      }
      update(u: ViewUpdate): void {
        if (u.geometryChanged || u.viewportChanged || u.focusChanged) this.measure();
      }
      destroy(): void { views.delete(this.view); }
      private measure(): void {
        this.view.requestMeasure({
          read: (v) => v.scrollDOM.clientHeight,
          write: (h, v) => { heights.set(v, h); },
          key: "tw",
        });
      }
    });
    const extender = EditorState.transactionExtender.of((tr) => {
      const userEvent = tr.annotation(Transaction.userEvent);
      if (userEvent === undefined) return null;
      if (!this.modeOn()) return null;
      const input: TypewriterTransaction = {
        userEvent,
        docChanged: tr.docChanged,
        selectionMoved: tr.startState.selection.main.head !== tr.newSelection.main.head,
        selectionEmpty: tr.newSelection.main.empty,
      };
      // `recenters` is asked only for an editor the setting takes, so `active` is true here
      const view = this.viewOf(tr.startState);
      if (!view || !this.qualifies(tr.startState) || !recenters(input, true)) return null;
      const height = this.heights.get(view);
      if (!height) return null;
      const head = tr.newSelection.main.head;
      return { effects: EditorView.scrollIntoView(head, { y: "start", yMargin: typewriterMargin(height) }) };
    });
    this.extension = [extender, measurer];
  }

  /** The settings changed (the setting itself, the track folders): decide again for every note. */
  settingsChanged(): void {
    this.tracked.clear();
  }

  /** The cheap part of "active": a desktop, writing mode on, the setting not off. */
  private modeOn(): boolean {
    return !Platform.isMobile && this.mode.isActive() && this.plugin.settings.writingModeTypewriter !== "off";
  }

  private viewOf(state: EditorState): EditorView | null {
    for (const v of this.views) if (v.state === state) return v;
    return null;
  }

  /** Whether the setting takes this editor's note (D7): a note's own editor, Markdown, and tracked when asked. */
  private qualifies(state: EditorState): boolean {
    const info = state.field(editorInfoField, false);
    if (!(info instanceof MarkdownView)) return false;
    const file = info.file;
    if (!file || file.extension !== "md") return false;
    if (this.plugin.settings.writingModeTypewriter === "all") return true;
    let tracked = this.tracked.get(file.path);
    if (tracked === undefined) {
      tracked = this.plugin.books.classify(file).tracked;
      this.tracked.set(file.path, tracked);
    }
    return tracked;
  }
}
