// The typewriter scroll's decisions (1.2.5, SF 17; PLAN-1.2.5 D3, D5). In writing mode the line
// being typed stays two thirds of the way down the editor once it gets there (two thirds of the
// screen show the text above it; a short note never scrolls, no space is added above the title) and the note scrolls instead. The desk's
// extension (desk/typewriter.ts) reads a CodeMirror transaction into a `TypewriterTransaction`
// and asks `recenters`; when it says yes, the extender adds a `scrollIntoView` at the cursor with
// `typewriterMargin` of the editor's height. Pure, no Obsidian or CodeMirror imports: the input is
// a plain object, so the tests build it by hand.
//
// What CodeMirror sends (checked in @codemirror/commands and @codemirror/view, the versions in
// node_modules on 2026-11-21):
// - typing is "input.type" (also "input", "input.paste", "input.indent", "input.copyline"…);
// - Backspace, Delete and cut are "delete" and "delete.*" ("delete.backward", "delete.cut"…);
// - the arrow keys, Home, End, Page Up/Down and their Shift forms are plain "select" (the
//   commands' `setSel`), not "move";
// - "move" is moving lines ("move.line", "move.character") and a drag inside the editor
//   ("move.drop");
// - undo and redo are "undo" and "redo";
// - a click or a drag of the mouse is "select.pointer"; a drop from outside is "input.drop".
// A transaction with no user event (another plugin, Obsidian itself, a sync) never recenters.

/** The line sits this far down the editor: two thirds (decided by the author 2026-11-21, not a setting). */
export const TYPEWRITER_FRACTION = 2 / 3;

/**
 * What `recenters` needs from one CodeMirror transaction, as plain values. The extension fills it
 * from `tr.annotation(Transaction.userEvent)`, `tr.docChanged` and a comparison of
 * `tr.startState.selection.main.head` with `tr.newSelection.main.head`.
 */
export interface TypewriterTransaction {
  /** the transaction's user event ("input.type", "select", "select.pointer"…); undefined when it has none */
  userEvent: string | undefined;
  /** the transaction changes the document */
  docChanged: boolean;
  /** the main cursor's head is somewhere else after the transaction */
  selectionMoved: boolean;
}

/**
 * Whether this transaction brings the cursor's line back to two thirds of the way down.
 *
 * - Never while `active` is false (writing mode off, the setting off, a phone, or a note the setting
 *   leaves out: with "tracked", a note outside the track folders such as the home note).
 * - Never without a user event, and never for a pointer event: "select.pointer" (a click or a
 *   mouse drag), "move.drop" and "input.drop" (drag and drop). The next keystroke recenters.
 * - Yes for "input", "delete", "move", "undo" and "redo" and their sub-events ("input.type",
 *   "delete.backward"…), when the document changed or the cursor moved.
 * - Yes for a plain "select" (the arrow keys, Home, End, Page Up/Down, with or without Shift)
 *   when the cursor moved.
 * - Any other event (another plugin's own name, "select.*" other than the above) does not.
 *
 * An event matches a name when it equals it or starts with it followed by a dot, as
 * `Transaction.isUserEvent` does.
 */
export function recenters(tr: TypewriterTransaction, active: boolean): boolean {
  void tr;
  void active;
  throw new Error("1.2.5 Wave 1");
}

/**
 * The space kept above the cursor's line, in pixels: `TYPEWRITER_FRACTION` (two thirds) of the editor's visible height,
 * rounded to a whole pixel, never negative (0 for a zero, negative or non-finite height, as
 * before the first measure). The extension passes it as `yMargin` with `y: "start"`.
 */
export function typewriterMargin(editorHeight: number): number {
  void editorHeight;
  throw new Error("1.2.5 Wave 1");
}
