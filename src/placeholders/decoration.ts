// Editor decoration for `%% XXX: … %%`: a small red-tinted pill.
// Source mode, or the cursor touching it: the raw text keeps a pill-colored mark.
// Live Preview with the cursor elsewhere: the `%% XXX:` and `%%` are hidden and a
// small marker label is shown before the note.

import type { Extension } from "@codemirror/state";
import { Decoration, WidgetType } from "@codemirror/view";
import { segmentDoc } from "../core/markdown";
import { revealOnTouch } from "../ui/reveal-on-touch";
import { placeholderSpans, type PlaceholderSpan } from "./logic";

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

/**
 * `marker` is read on every rebuild, so a settings change applies on the next update.
 * Placeholders are found in the whole document (so code blocks and comments are
 * read right) once per change; viewport and selection changes only redecorate.
 */
export function placeholderDecorations(marker: () => string): Extension {
  return revealOnTouch<PlaceholderSpan>({
    scan: (view) => {
      const m = marker();
      return m ? placeholderSpans(segmentDoc(view.state.doc), m) : [];
    },
    key: marker,
    raw: (s) => [rawMark.range(s.from, s.to)],
    rendered: (s) => {
      const m = marker();
      if (s.noteFrom === s.noteTo) {
        return [Decoration.replace({ widget: new LabelWidget(m, true) }).range(s.from, s.to)];
      }
      return [
        Decoration.replace({ widget: new LabelWidget(m, false) }).range(s.from, s.noteFrom),
        noteMark.range(s.noteFrom, s.noteTo),
        hide.range(s.noteTo, s.to),
      ];
    },
  });
}
