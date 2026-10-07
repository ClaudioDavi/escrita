// Revision lens marks, CodeMirror glue (4.1), shaped like editor/dialogue-focus.ts.
// The state field holds the one list of positions: matches mapped through every
// edit until a result for the session's latest version arrives. Marks, `matchAt`
// and stepping read that list, never the session's result. The list remembers the
// options generation it came from: after a settings or lists change it is dropped
// rather than kept until a new result happens to be adopted (IMPROVEMENTS, 0.5.1).

import {
  StateEffect, StateField, type EditorState, type Extension, type Range, type TransactionSpec,
} from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import type { LensSession } from "./session";
import { mapMatches, markSpecs, sameMatch } from "./marks-model";
import { visible } from "./analyze";
import type { LensResult, Match } from "./types";

const refreshEffect = StateEffect.define<null>();
const currentEffect = StateEffect.define<Match | null>();

interface LensField {
  matches: Match[];
  current: Match | null;
  /** The result object the list came from, to adopt each result once. */
  source: LensResult | null;
  /** The session's options generation the list was computed under. */
  gen: number;
}

const EMPTY: LensField = { matches: [], current: null, source: null, gen: -1 };
const cache = new Map<string, Decoration>();
function deco(cls: string): Decoration {
  let d = cache.get(cls);
  if (!d) { d = Decoration.mark({ class: cls }); cache.set(cls, d); }
  return d;
}

export type SelectionCallback = (path: string, ranges: { from: number; to: number }[]) => void;

export class LensMarks {
  private views = new Set<EditorView>();
  private selectionCbs = new Set<SelectionCallback>();
  readonly extension: Extension;
  private field: StateField<LensField>;

  constructor(
    private pathOf: (s: EditorState) => string | null,
    private session: LensSession,
    private shown: (path: string) => LensResult | undefined,
  ) {
    const { views, selectionCbs } = this;
    const adopt = (state: EditorState, value: LensField): LensField => this.adopt(state, value);

    const field = StateField.define<LensField>({
      create: (state) => adopt(state, EMPTY),
      update(value, tr) {
        let next = value;
        if (tr.docChanged && (next.matches.length > 0 || next.current)) {
          const map = (pos: number, assoc: -1 | 1) => tr.changes.mapPos(pos, assoc);
          const cur = next.current ? mapMatches([next.current], map)[0] ?? null : null;
          next = { matches: mapMatches(next.matches, map), current: cur, source: next.source, gen: next.gen };
        }
        for (const e of tr.effects) {
          if (e.is(currentEffect)) next = { ...next, current: e.value };
        }
        return adopt(tr.state, next);
      },
    });
    this.field = field;

    const plugin = ViewPlugin.fromClass(class {
      decorations: DecorationSet = Decoration.none;
      constructor(private readonly view: EditorView) {
        views.add(view);
        // The note may have changed while no editor showed it (sync, a vault.process
        // edit): the session's old result is not trusted until a pass runs on this text.
        const path = pathOf(view.state);
        if (path !== null && session.isOn(path)) {
          session.changed(path, () => view.state.doc.toString());
        }
        this.decorations = this.build(view);
      }
      update(u: ViewUpdate): void {
        const path = pathOf(u.state);
        if (path !== null && u.docChanged && session.isOn(path)) {
          const state = u.state;
          session.changed(path, () => state.doc.toString());
        }
        if (path !== null && u.selectionSet && session.isOn(path)) {
          const ranges = u.state.selection.ranges.map((r) => ({ from: r.from, to: r.to }));
          for (const cb of [...selectionCbs]) cb(path, ranges);
        }
        if (u.docChanged || u.viewportChanged
          || u.state.field(field) !== u.startState.field(field)) {
          this.decorations = this.build(u.view);
        }
      }
      destroy(): void { views.delete(this.view); }
      private build(view: EditorView): DecorationSet {
        const f = view.state.field(field);
        if (f.matches.length === 0) return Decoration.none;
        const ranges: Range<Decoration>[] = [];
        for (const r of view.visibleRanges) {
          for (const s of markSpecs(f.matches, f.current, r.from, r.to)) {
            ranges.push(deco(s.cls).range(s.from, s.to));
          }
        }
        return Decoration.set(ranges, true);
      }
    }, { decorations: (v) => v.decorations });

    this.extension = [field, plugin];
    // a pending or failed pass emits nothing: still make every editor drop old-options marks
    session.onInvalidate(() => this.refresh());
  }

  /** Takes the shown result when it is for the session's latest version of the note. */
  private adopt(state: EditorState, value: LensField): LensField {
    const path = this.pathOf(state);
    if (path === null || !this.session.isOn(path)) {
      return value.matches.length === 0 && !value.current && !value.source ? value : EMPTY;
    }
    const gen = this.session.generation();
    // the session returns only results computed under the current options
    const r = this.shown(path);
    if (r && (r !== value.source || value.gen !== gen) && r.version === this.session.version(path)
      && r.pass.mask.length === state.doc.length
      && this.session.cachedText(path) === state.doc.toString()) {
      const current = value.current && r.matches.some((m) => sameMatch(m, value.current))
        ? value.current : null;
      return { matches: r.matches, current, source: r, gen };
    }
    // marks computed under older options are wrong now: drop them until the new pass lands
    if (value.gen !== gen && (value.matches.length > 0 || value.current || value.source)) {
      return { matches: [], current: null, source: null, gen };
    }
    return value;
  }

  /** The match at (or touching the end of) a position, from the mapped list. */
  matchAt(state: EditorState, pos: number): Match | null {
    const list = state.field(this.field, false)?.matches ?? [];
    const hit = visible(list, pos, pos + 1)[0] ?? visible(list, pos - 1, pos)[0];
    return hit ?? null;
  }

  /** The mapped match list of an editor state. */
  matchesFor(state: EditorState): readonly Match[] {
    return state.field(this.field, false)?.matches ?? [];
  }

  /** Marks one match as current in every editor on the note; `reveal` scrolls it into view. */
  setCurrent(path: string, m: Match | null, reveal = false): void {
    for (const view of [...this.views]) {
      if (this.pathOf(view.state) !== path) continue;
      this.send(view, () => ({
        effects: [currentEffect.of(m),
          ...(reveal && m ? [EditorView.scrollIntoView(m.from, { y: "center" })] : [])],
      }));
    }
  }

  /** Called with the cursor ranges whenever the selection changes in a note with the lens on. */
  onSelection(cb: SelectionCallback): () => void {
    this.selectionCbs.add(cb);
    return () => { this.selectionCbs.delete(cb); };
  }

  /** Makes every editor re-read the shown result (a result arrived, a dismissal changed, the lens toggled). */
  refresh(): void {
    for (const view of [...this.views]) this.send(view, () => ({ effects: refreshEffect.of(null) }));
  }

  /**
   * Dispatches to one editor. A dispatch can fail while that editor is in the middle of
   * an update; it is tried once more after the update instead of dropping the editor,
   * which would leave its marks on an old result (only typing in it would update them).
   * Editors leave the set when they are destroyed.
   */
  private send(view: EditorView, spec: () => TransactionSpec): void {
    try {
      view.dispatch(spec());
    } catch {
      queueMicrotask(() => {
        if (!this.views.has(view)) return;
        try { view.dispatch(spec()); } catch { this.views.delete(view); }
      });
    }
  }
}
