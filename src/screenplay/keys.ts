// Tab, Shift-Tab and Enter in a screenplay note, the caps of cues, headings and transitions, and
// the element's name on an empty line (1.2, SP 2, PLAN-1.2 Q7, Q8; board 45). The rules are
// core/screenplay-keys.ts, pure; this file reads the editor into a `KeyContext`, dispatches the
// edit as one transaction, and keeps what the writer chose with Tab: the mode of a line.
//
// The mode of a line (an `ElementMode`) is state, not text: it says what an empty or half-typed
// line is going to be, before the parser can know. It maps through changes. It ends when the line
// reads as that element, or when the cursor leaves the line: an empty line forgets it, a typed
// line gets Fountain's forced mark if it needs one (`forcedMarkFor`), in a transaction of its own.

import { StateEffect, StateField, Prec, type EditorState, type Extension, type Text } from "@codemirror/state";
import { invertedEffects, isolateHistory } from "@codemirror/commands";
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, type ViewUpdate } from "@codemirror/view";
import { fountainDocLines } from "../core/fountain-doc";
import { segmentDoc } from "../core/markdown";
import type { FountainOptions, LineKind } from "../core/fountain";
import { capsFor, decideKey, forcedMarkFor, type ElementMode, type KeyContext, type ScriptKey } from "../core/screenplay-keys";
import { t } from "../i18n";

export interface KeysHost {
  /** is the note of this state a screenplay (its form)? */
  isScreenplay(state: EditorState): boolean;
  opts(): FountainOptions;
}

export interface Entry { pos: number; mode: ElementMode }

/** Sets (or, with a null mode, ends) the mode of the line starting at `pos`, in the new document's offsets. */
const setMode = StateEffect.define<{ pos: number; mode: ElementMode | null }>();
/** The cursor has left lines typed in a mode: they let go of it (their forced marks went in the same transaction). */
const settle = StateEffect.define<null>();

const blank = (s: string) => s.trim() === "";

class GhostWidget extends WidgetType {
  constructor(private readonly mode: ElementMode) { super(); }
  eq(other: GhostWidget): boolean { return other.mode === this.mode; }
  toDOM(): HTMLElement {
    const el = createSpan({ cls: "escrita-sp-ghost", text: t(`screenplay.mode.${this.mode}`) });
    el.setAttribute("aria-hidden", "true");
    return el;
  }
  ignoreEvent(): boolean { return true; }
}

/** Does `text` after `from` begin with a Fountain forced mark? Then the writer chose its case. */
const FORCED = /^\s*[@.>]/;

export class ScreenplayKeys {
  readonly extension: Extension;
  private readonly modes: StateField<readonly Entry[]>;

  constructor(private readonly host: KeysHost) {
    const modes = StateField.define<readonly Entry[]>({
      create: () => [],
      update: (entries, tr) => {
        let next = entries;
        if (tr.docChanged && next.length > 0) next = next.map((e) => ({ pos: tr.changes.mapPos(e.pos, -1), mode: e.mode }));
        let settled = false;
        let touched = false;
        for (const e of tr.effects) {
          if (e.is(setMode)) {
            touched = true;
            next = [...next.filter((x) => x.pos !== e.value.pos), ...(e.value.mode ? [{ pos: e.value.pos, mode: e.value.mode }] : [])];
          } else if (e.is(settle)) settled = true;
        }
        if (next.length === 0) return next;
        if (!tr.docChanged && !tr.selection && !settled && !touched) return entries;
        return this.prune(next, tr.newDoc, tr.newSelection.main.head, settled);
      },
    });
    this.modes = modes;

    // undo gives a line back the mode a step took from it: Tab after a cue opens "()" and the cue
    // line, now read as a cue by the parser, lets go of its mode; undoing the step removes the "()"
    // and the cue (not a cue yet, nothing follows it) must be held in its mode again
    const giveBack = invertedEffects.of((tr) => {
      // only a step that changes the text: a mode ended by the cursor leaving is not an undo step of its own
      if (!tr.docChanged) return [];
      const before = tr.startState.field(modes, false) ?? [];
      if (before.length === 0) return [];
      const after = tr.state.field(modes, false) ?? [];
      const back: StateEffect<unknown>[] = [];
      for (const e of before) {
        const to = tr.changes.mapPos(e.pos, -1);
        if (!after.some((x) => x.pos === to && x.mode === e.mode)) back.push(setMode.of({ pos: e.pos, mode: e.mode }));
      }
      return back;
    });

    // the element's name, faint, on an empty line in a mode
    const ghosts = EditorView.decorations.compute([modes, "doc"], (state) => {
      const entries = state.field(modes);
      const ranges = [];
      for (const e of entries) {
        if (e.pos > state.doc.length) continue;
        const line = state.doc.lineAt(e.pos);
        if (line.from !== e.pos || line.text !== "") continue;
        ranges.push(Decoration.widget({ widget: new GhostWidget(e.mode), side: 1 }).range(e.pos));
      }
      return Decoration.set(ranges, true);
    });

    // lines the cursor left: the forced mark, then the mode is let go (a microtask: no dispatch inside an update)
    const leaving = ViewPlugin.fromClass(class {
      dead = false;
      constructor(private readonly view: EditorView) {}
      update(u: ViewUpdate): void {
        if ((u.docChanged || u.selectionSet) && pending(u.state).length > 0) queueMicrotask(() => this.settle());
      }
      destroy(): void { this.dead = true; }
      private settle(): void {
        const { view } = this;
        if (this.dead || view.composing) return;
        const left = pending(view.state);
        if (left.length === 0) return;
        const opts = host.opts();
        const changes = [];
        for (const e of left) {
          const line = view.state.doc.lineAt(e.pos);
          const mark = forcedMarkFor(line.text, e.mode, opts);
          if (mark) changes.push({ from: line.from, insert: mark });
        }
        view.dispatch({ changes, effects: settle.of(null), userEvent: "input" });
      }
    });

    const pending = (state: EditorState): Entry[] => {
      const entries = state.field(modes, false) ?? [];
      if (entries.length === 0) return [];
      const at = state.doc.lineAt(state.selection.main.head).from;
      return entries.filter((e) => e.pos !== at && e.pos <= state.doc.length && !blank(state.doc.lineAt(e.pos).text));
    };

    this.extension = [
      modes,
      giveBack,
      ghosts,
      leaving,
      Prec.highest(keymap.of([
        { key: "Enter", run: (view) => this.run(view, "Enter") },
        { key: "Tab", run: (view) => this.run(view, "Tab") },
        { key: "Shift-Tab", run: (view) => this.run(view, "Shift-Tab") },
      ])),
      Prec.highest(EditorView.inputHandler.of((view, from, to, text) => this.onInput(view, from, to, text))),
    ];
  }

  /** The entries still true after a change: line starts that hold, not read as their mode yet, and (empty ones) under the cursor. */
  private prune(entries: readonly Entry[], doc: Text, head: number, settled: boolean): readonly Entry[] {
    const at = doc.lineAt(head).from;
    let kinds: (LineKind | null)[] | null = null;
    const keep: Entry[] = [];
    for (const e of entries) {
      if (e.pos > doc.length) continue;
      const line = doc.lineAt(e.pos);
      if (line.from !== e.pos) continue;
      const here = e.pos === at;
      if (blank(line.text)) {
        if (here) keep.push(e);
        continue;
      }
      if (settled && !here) continue;
      // typed far enough that the parser reads the element: the mode has done its job
      kinds ??= fountainDocLines(doc, this.host.opts());
      if (kinds[line.number - 1] === e.mode) continue;
      keep.push(e);
    }
    return keep.length === entries.length && keep.every((e, i) => e === entries[i]) ? entries : keep;
  }

  /** The lines held in a mode, by their start offset (the same array until a mode changes). */
  modesOf(state: EditorState): readonly Entry[] {
    return state.field(this.modes, false) ?? [];
  }

  /** The mode held for the line starting at `from`. */
  modeAt(state: EditorState, from: number): ElementMode | null {
    return state.field(this.modes, false)?.find((e) => e.pos === from)?.mode ?? null;
  }

  /** What the cursor's line is, for the rules. Null when the selection is not a single cursor. */
  private contextOf(state: EditorState): { ctx: KeyContext; lineFrom: number } | null {
    const sel = state.selection;
    if (sel.ranges.length !== 1 || !sel.main.empty) return null;
    const { doc } = state;
    const opts = this.host.opts();
    const kinds = fountainDocLines(doc, opts);
    const line = doc.lineAt(sel.main.head);
    const i = line.number - 1;
    let j = i - 1;
    while (j >= 0 && kinds[j] === null) j--;
    return {
      lineFrom: line.from,
      ctx: {
        line: line.text,
        column: sel.main.head - line.from,
        kind: kinds[i],
        above: j >= 0 ? kinds[j] : null,
        blankAbove: i === 0 || kinds[i - 1] === null,
        mode: this.modeAt(state, line.from),
        sceneHeadings: opts.sceneHeadings,
        transitions: opts.transitions,
      },
    };
  }

  /** Runs a key's rule in `view`: true when it did something (the key is ours), false to let Obsidian have it. */
  run(view: EditorView, key: ScriptKey): boolean {
    const { state } = view;
    if (!this.host.isScreenplay(state)) return false;
    const got = this.contextOf(state);
    if (!got) return false;
    // an empty line in the properties, a code block or a comment is not the script's
    if (blank(got.ctx.line) && segmentDoc(state.doc).startsIn(state.doc.lineAt(state.selection.main.head).number - 1) !== "prose") return false;
    const edit = decideKey(key, got.ctx);
    if (!edit) return false;
    const { lineFrom } = got;
    const text = got.ctx.line;
    // where the cursor lands, and the start of the line it lands on
    const after = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
    const landing = edit.cursor === 0 ? 0 : after.lastIndexOf("\n", edit.cursor - 1) + 1;
    view.dispatch({
      changes: edit.from === edit.to && edit.insert === "" ? undefined : { from: lineFrom + edit.from, to: lineFrom + edit.to, insert: edit.insert },
      selection: { anchor: lineFrom + edit.cursor },
      effects: setMode.of({ pos: lineFrom + landing, mode: edit.mode }),
      scrollIntoView: true,
      // a key is one undo step: not "input.type", and isolated, so the history never joins it to the typing before or after it
      userEvent: "input",
      annotations: isolateHistory.of("full"),
    });
    return true;
  }

  /** Uppercases the letters typed on a cue, a scene heading or a transition; only what is being typed. */
  private onInput(view: EditorView, from: number, to: number, text: string): boolean {
    if (view.composing || text === "" || text.includes("\n")) return false;
    const upper = text.toLocaleUpperCase();
    if (upper === text) return false;
    const { state } = view;
    if (state.selection.ranges.length !== 1 || !this.host.isScreenplay(state)) return false;
    const line = state.doc.lineAt(from);
    // a forced line (`@name`, `.HEADING`, `>`) is the writer's own case
    if (FORCED.test(line.text.slice(0, from - line.from))) return false;
    const kinds = fountainDocLines(state.doc, this.host.opts());
    if (!capsFor(kinds[line.number - 1], this.modeAt(state, line.from))) return false;
    view.dispatch({
      changes: { from, to, insert: upper },
      selection: { anchor: from + upper.length },
      scrollIntoView: true,
      userEvent: "input.type",
    });
    return true;
  }
}
