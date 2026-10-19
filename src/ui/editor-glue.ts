// Editor glue shared by the CodeMirror plugins (IMPROVEMENTS 38): the set of open
// editors with one failure policy for dispatching to them, the file of an editor
// state, the Live Preview check, and the one cast to CodeMirror's view.
//
// Used by the lens marks, dialogue focus, name marks, the appears-in widget, the
// placeholders and the ghost beats. Pure CodeMirror plus three Obsidian handles;
// it imports no module folder.

import type { EditorState, TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { editorInfoField, editorLivePreviewField, type Editor, type TFile } from "obsidian";
import { dispatchWithRetry } from "../core/dispatch-retry";

/**
 * The editors a plugin is running in. A ViewPlugin adds its view in the constructor and
 * deletes it in `destroy()`; the owner then reaches every editor with `broadcast`.
 *
 * Failure policy (the lens's, for everyone): a dispatch can throw while that editor is in
 * the middle of an update. It is tried once more in a microtask, and only a second failure
 * drops the editor from the set. `broadcast` and `send` never throw, so they are safe inside
 * another emitter's listener.
 */
export class EditorSet implements Iterable<EditorView> {
  private views = new Set<EditorView>();

  add(view: EditorView): void { this.views.add(view); }
  delete(view: EditorView): void { this.views.delete(view); }
  has(view: EditorView): boolean { return this.views.has(view); }
  get size(): number { return this.views.size; }
  clear(): void { this.views.clear(); }
  /** A copy, so the caller may add or drop editors while looping. */
  [Symbol.iterator](): Iterator<EditorView> { return [...this.views][Symbol.iterator](); }

  /**
   * Dispatches to every editor. `spec` is built again for the retry, because it may read the
   * editor's state. `onDrop` hears of an editor dropped after its second failure.
   */
  broadcast(spec: TransactionSpec | ((view: EditorView) => TransactionSpec), onDrop?: (err: unknown) => void): void {
    for (const view of this) this.send(view, spec, onDrop);
  }

  /** The same for one editor (a broadcast narrowed by the caller, for example to one note). */
  send(view: EditorView, spec: TransactionSpec | ((view: EditorView) => TransactionSpec), onDrop?: (err: unknown) => void): void {
    dispatchWithRetry(
      view,
      () => (typeof spec === "function" ? spec(view) : spec),
      () => this.views.has(view),
      (err) => {
        this.views.delete(view);
        onDrop?.(err);
      },
    );
  }
}

/** The file an editor state belongs to, or null (a popover, an embed, a state not yet attached). */
export function fileOfState(state: EditorState): TFile | null {
  return state.field(editorInfoField, false)?.file ?? null;
}

/** Whether the editor is in Live Preview (false in Source mode and when the field is missing). */
export function isLivePreview(target: EditorState | EditorView): boolean {
  const state = "state" in target ? target.state : target;
  try {
    return state.field(editorLivePreviewField, false) === true;
  } catch {
    return false;
  }
}

/**
 * CodeMirror's view behind an Obsidian editor, or null. Obsidian does not type `Editor.cm`,
 * so this is the one cast (ARCHITECTURE.md, "Conventions": documented exceptions).
 */
export function cmOf(editor: Editor): EditorView | null {
  return (editor as unknown as { cm?: EditorView }).cm ?? null;
}
