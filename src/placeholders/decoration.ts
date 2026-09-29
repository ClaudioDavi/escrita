// Editor decoration for `%% XXX: … %%`: a small red-tinted pill.
// Source mode, or the cursor touching it: the raw text keeps a pill-colored mark.
// Live Preview with the cursor elsewhere: the `%% XXX:` and `%%` are hidden and a
// small marker label is shown before the note.

import { editorLivePreviewField } from "obsidian";
import type { Extension, Range as CMRange } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { placeholderSpans } from "./logic";

class LabelWidget extends WidgetType {
  constructor(private marker: string, private empty: boolean) { super(); }

  eq(other: LabelWidget): boolean {
    return other.marker === this.marker && other.empty === this.empty;
  }

  toDOM(): HTMLElement {
    const el = createSpan({
      cls: this.empty ? "escrita-placeholder-label escrita-placeholder-empty" : "escrita-placeholder-label",
      text: this.marker,
    });
    el.setAttr("aria-hidden", "true");
    return el;
  }

  /** Let clicks through so the cursor lands in the placeholder and reveals it. */
  ignoreEvent(): boolean {
    return false;
  }
}

const rawMark = Decoration.mark({ class: "escrita-placeholder escrita-placeholder-raw" });
const noteMark = Decoration.mark({ class: "escrita-placeholder escrita-placeholder-note" });
const hide = Decoration.replace({});

function livePreview(view: EditorView): boolean {
  try {
    return view.state.field(editorLivePreviewField, false) === true;
  } catch {
    return false;
  }
}

function build(view: EditorView, marker: string): DecorationSet {
  if (!marker) return Decoration.none;
  const lp = livePreview(view);
  const sel = view.state.selection.ranges;
  const doc = view.state.doc;
  const out: CMRange<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      for (const s of placeholderSpans(line.text, marker, line.from)) {
        const touched = sel.some((r) => r.from <= s.to && r.to >= s.from);
        if (!lp || touched) {
          out.push(rawMark.range(s.from, s.to));
        } else if (s.noteFrom === s.noteTo) {
          out.push(Decoration.replace({ widget: new LabelWidget(marker, true) }).range(s.from, s.to));
        } else {
          out.push(Decoration.replace({ widget: new LabelWidget(marker, false) }).range(s.from, s.noteFrom));
          out.push(noteMark.range(s.noteFrom, s.noteTo));
          out.push(hide.range(s.noteTo, s.to));
        }
      }
      if (line.to >= to) break;
      pos = line.to + 1;
    }
  }
  return Decoration.set(out, true);
}

/** `marker` is read on every rebuild, so a settings change applies on the next update. */
export function placeholderDecorations(marker: () => string): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private marker: string;
      private lp: boolean;

      constructor(view: EditorView) {
        this.marker = marker();
        this.lp = livePreview(view);
        this.decorations = build(view, this.marker);
      }

      update(u: ViewUpdate): void {
        const m = marker();
        const lp = livePreview(u.view);
        if (u.docChanged || u.viewportChanged || u.selectionSet || m !== this.marker || lp !== this.lp) {
          this.marker = m;
          this.lp = lp;
          this.decorations = build(u.view, m);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
