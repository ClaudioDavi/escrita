// "Reveal on touch" (IMPROVEMENTS 38): a ViewPlugin for a marker that shows as a widget in
// Live Preview and as plain text when the cursor touches it or in Source mode. Used by the
// placeholders and the ghost beats; the next marker kind is one call.
//
// It scans the document when the text (or `key`) changes, and rebuilds the decorations on
// text, selection, viewport or mode changes. It only decorates; it never edits text.

import type { Extension, Range } from "@codemirror/state";
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";
import { isLivePreview } from "./editor-glue";

export interface TouchItem { from: number; to: number }

export interface RevealOptions<T extends TouchItem> {
  /** Finds the items in the whole document. Runs again only when the text or `key` changes. */
  scan(view: EditorView): T[];
  /** Decorations while the item is shown as typed (Source mode, or the selection touches it). */
  raw(item: T, view: EditorView): Range<Decoration>[];
  /** Decorations while it is drawn (Live Preview, selection elsewhere). Read on every rebuild. */
  rendered(item: T, view: EditorView): Range<Decoration>[];
  /** A value that, when it changes, makes the plugin scan again (a setting the scan reads). */
  key?(): unknown;
}

/** Whether any selection range touches the item (ends included, so a cursor at an edge reveals it). */
export function touches(item: TouchItem, ranges: readonly { from: number; to: number }[]): boolean {
  return ranges.some((r) => r.from <= item.to && r.to >= item.from);
}

export function revealOnTouch<T extends TouchItem>(opts: RevealOptions<T>): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private items: T[];
      private live: boolean;
      private key: unknown;

      constructor(view: EditorView) {
        this.key = opts.key?.();
        this.items = opts.scan(view);
        this.live = isLivePreview(view);
        this.decorations = this.build(view);
      }

      update(u: ViewUpdate): void {
        const key = opts.key?.();
        const live = isLivePreview(u.view);
        if (u.docChanged || key !== this.key) this.items = opts.scan(u.view);
        if (u.docChanged || u.viewportChanged || u.selectionSet || key !== this.key || live !== this.live) {
          this.key = key;
          this.live = live;
          this.decorations = this.build(u.view);
        }
      }

      private build(view: EditorView): DecorationSet {
        if (this.items.length === 0) return Decoration.none;
        const sel = view.state.selection.ranges;
        const out: Range<Decoration>[] = [];
        for (const item of this.items) {
          if (!view.visibleRanges.some((r) => item.to >= r.from && item.from <= r.to)) continue;
          out.push(...(!this.live || touches(item, sel) ? opts.raw(item, view) : opts.rendered(item, view)));
        }
        return Decoration.set(out, true);
      }
    },
    { decorations: (v) => v.decorations },
  );
}
