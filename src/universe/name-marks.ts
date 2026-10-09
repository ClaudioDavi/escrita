// Name marks in the editor (0.7 plan 4.4, Q37, Q38): `spellcheck="false"` over every
// capitalized name of the note's scope, and an optional underline. One full pass when the
// note opens (and when the names change), then a debounced re-match of the paragraphs the
// edits touched. Marks are mapped through edits in between. Decorations only: it never
// changes text (rule 2).

import { dispatchWithRetry } from "../core/dispatch-retry";
import { StateEffect, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { Keymap, Platform, editorInfoField } from "obsidian";
import { findNames } from "../core/names";
import { segmentDoc } from "../core/markdown";
import type { NamesProvider } from "../core/names-source";
import { readerMask } from "../core/wordcount";
import {
  entryAt, hasMarks, mapDirty, mapMarks, markAt, markableTable, marksOf, rematch, visibleMarks,
  type Range,
} from "./name-marks-model";

export interface NameMarksDeps {
  names: Pick<NamesProvider, "tableFor" | "version" | "onChange">;
  /** The "Underline names in the editor" setting. */
  underline: () => boolean;
  /** Gate G0c: whether `spellcheck="false"` removes the squiggle on this platform. Default yes. */
  spellcheckWorks?: () => boolean;
  /** The note's path, or null. Default: the editor's file. */
  pathOf?: (state: EditorState) => string | null;
  /** Ctrl/Cmd-click on a marked name opens its entry (board AppearsInStates g). Without it the click does nothing special. */
  open?: (entryPath: string, evt: MouseEvent) => void;
}

/** Gate G0c: whether `spellcheck="false"` on a span removes the squiggle. True until a device says otherwise; flip it here. */
export const SPELLCHECK_MARKS_WORK = true;

export const DEBOUNCE_MS = 400;
export const DEBOUNCE_MOBILE_MS = 800;

const refreshEffect = StateEffect.define<{ full: boolean }>();

const defaultPathOf = (s: EditorState): string | null => s.field(editorInfoField, false)?.file?.path ?? null;

const decos = new Map<string, Decoration>();
function deco(spellcheck: boolean, underline: boolean): Decoration | null {
  if (!spellcheck && !underline) return null;
  const key = `${spellcheck}:${underline}`;
  let d = decos.get(key);
  if (!d) {
    d = Decoration.mark({
      class: underline ? "escrita-name-mark escrita-name-underline" : "escrita-name-mark",
      ...(spellcheck ? { attributes: { spellcheck: "false" } } : {}),
    });
    decos.set(key, d);
  }
  return d;
}

export class NameMarks {
  private views = new Set<EditorView>();
  readonly extension: Extension;
  private off: () => void;

  constructor(private deps: NameMarksDeps) {
    const { views, deps: markDeps } = this;
    const pathOf = deps.pathOf ?? defaultPathOf;

    const plugin = ViewPlugin.fromClass(class {
      decorations: DecorationSet = Decoration.none;
      private marks: Range[] = [];
      private dirty: Range[] = [];
      private path: string | null = null;
      private tableSig: string | null = null;
      private version = -1;
      private full = true;
      private timer: number | null = null;

      constructor(private readonly view: EditorView) {
        views.add(view);
        this.pass();
        this.decorations = this.build();
      }

      update(u: ViewUpdate): void {
        const path = pathOf(u.state);
        let redraw = u.viewportChanged;
        if (path !== this.path) this.full = true;
        if (u.docChanged) {
          this.marks = mapMarks(this.marks, (p, a) => u.changes.mapPos(p, a));
          this.dirty = mapDirty(this.dirty, (p, a) => u.changes.mapPos(p, a));
          u.changes.iterChangedRanges((_fa, _ta, fromB, toB) => { this.dirty.push({ from: fromB, to: toB }); });
          redraw = true;
        }
        for (const tr of u.transactions) {
          for (const e of tr.effects) {
            if (e.is(refreshEffect)) {
              if (e.value.full) this.full = true;
              redraw = true;
            }
          }
        }
        if (this.full || this.dirty.length > 0 || path !== this.path) this.schedule();
        if (redraw) this.decorations = this.build();
      }

      /** The mark under a document position, as its range. */
      markAt(pos: number): { from: number; to: number } | null { return markAt(this.marks, pos); }

      destroy(): void {
        views.delete(this.view);
        if (this.timer !== null) window.clearTimeout(this.timer);
      }

      private schedule(): void {
        if (this.timer !== null) window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => {
          this.timer = null;
          this.pass();
          this.view.dispatch({ effects: refreshEffect.of({ full: false }) });
        }, Platform.isMobile ? DEBOUNCE_MOBILE_MS : DEBOUNCE_MS);
      }

      /** The full pass when the note, or the names, changed; else only the touched paragraphs. */
      private pass(): void {
        const state = this.view.state;
        const path = pathOf(state);
        const names = markDeps.names;
        const version = names.version();
        const table = path === null ? null : markableTable(names.tableFor(path));
        const live = table !== null && hasMarks(table);
        if (!live || table === null) {
          this.marks = [];
          this.dirty = [];
          this.path = path;
          this.tableSig = table?.signature ?? null;
          this.version = version;
          this.full = false;
          return;
        }
        const mask = readerMask(segmentDoc(state.doc));
        const find = (from: number, to: number) => findNames(mask, table, from, to);
        if (this.full || path !== this.path || version !== this.version || table.signature !== this.tableSig) {
          this.marks = marksOf(find(0, mask.length));
        } else if (this.dirty.length > 0) {
          this.marks = rematch(this.marks, mask, this.dirty, find);
        }
        this.dirty = [];
        this.path = path;
        this.tableSig = table.signature;
        this.version = version;
        this.full = false;
      }

      private build(): DecorationSet {
        const d = deco(markDeps.spellcheckWorks?.() ?? true, markDeps.underline());
        if (d === null || this.marks.length === 0) return Decoration.none;
        const windows = this.view.visibleRanges.map((r) => ({ from: r.from, to: r.to }));
        return Decoration.set(visibleMarks(this.marks, windows).map((m) => d.range(m.from, m.to)), true);
      }
    }, { decorations: (v) => v.decorations });

    const click = EditorView.domEventHandlers({
      mousedown(evt, view) {
        if (!markDeps.open || !Keymap.isModEvent(evt)) return false;
        const target = evt.target;
        if (!(target instanceof HTMLElement)) return false;
        const el = target.closest(".escrita-name-mark");
        if (!el) return false;
        const inst = view.plugin(plugin);
        const path = pathOf(view.state);
        if (!inst || path === null) return false;
        const mark = inst.markAt(view.posAtDOM(el, 0));
        if (!mark) return false;
        const entry = entryAt(view.state.sliceDoc(mark.from, mark.to), markDeps.names.tableFor(path));
        if (!entry) return false;
        evt.preventDefault();
        markDeps.open(entry, evt);
        return true;
      },
    });
    this.extension = [plugin, click];
    // A change of names (an entry added, renamed, the language) means a full pass.
    this.off = deps.names.onChange(() => this.refresh(true));
  }

  /** Redraws every editor; `full` also re-matches the whole note (names changed). */
  refresh(full = false): void {
    // Called from the names provider's emitter: never throws into it; a failed dispatch is retried once.
    for (const v of [...this.views]) {
      dispatchWithRetry(v, () => ({ effects: refreshEffect.of({ full }) }), () => this.views.has(v), () => { /* the ViewPlugin's destroy() removes it; a typing pass redraws it meanwhile */ });
    }
  }

  /** Stops listening for name changes. The per-editor timers go with each ViewPlugin's destroy, when the slot empties. */
  dispose(): void {
    this.off();
    this.views.clear();
  }
}
