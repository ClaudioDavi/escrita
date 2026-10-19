// Ghost beats: in Live Preview, a beat comment line renders as a small label
// ("Beat b · from outline") above its text in faint italics, until the cursor
// touches the line. In Source mode, or with the cursor on it, the raw line
// just gets a faint class.

import type { Extension } from "@codemirror/state";
import { Decoration, type EditorView, WidgetType } from "@codemirror/view";
import { t } from "../i18n";
import { segmentDoc } from "../core/markdown";
import { revealOnTouch } from "../ui/reveal-on-touch";
import { scanBeats, type GhostBeat } from "./model";

class GhostBeatWidget extends WidgetType {
  constructor(readonly letter: string, readonly text: string) {
    super();
  }

  eq(other: GhostBeatWidget): boolean {
    return other.letter === this.letter && other.text === this.text;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = createSpan();
    wrap.className = "escrita-ghost-beat";
    wrap.createSpan({ cls: "escrita-ghost-label", text: t("outline.ghostLabel", { letter: this.letter }) });
    wrap.createSpan({ cls: "escrita-ghost-text", text: this.text || "…" });
    return wrap;
  }

  /** Let clicks reach the editor so they place the cursor (which reveals the raw line). */
  ignoreEvent(): boolean {
    return false;
  }
}

const rawLine = Decoration.line({ class: "escrita-beat-raw" });

interface GhostItem extends GhostBeat { from: number; to: number }

/** The beats with the span of their line; segmented once per document version, shared with the other editor features. */
function scan(view: EditorView): GhostItem[] {
  const { doc } = view.state;
  const out: GhostItem[] = [];
  for (const b of scanBeats(segmentDoc(doc))) {
    if (b.line + 1 > doc.lines) continue;
    const line = doc.line(b.line + 1);
    out.push({ ...b, from: line.from, to: line.to });
  }
  return out;
}

export function ghostBeats(): Extension {
  return revealOnTouch<GhostItem>({
    scan,
    raw: (b) => [rawLine.range(b.from)],
    rendered: (b) => [Decoration.replace({ widget: new GhostBeatWidget(b.letter, b.text) }).range(b.from, b.to)],
  });
}
