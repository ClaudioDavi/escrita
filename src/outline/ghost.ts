// Ghost beats: in Live Preview, a beat comment line renders as a small label
// ("Beat b · from outline") above its text in faint italics, until the cursor
// touches the line. In Source mode, or with the cursor on it, the raw line
// just gets a faint class.

import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { t } from "../i18n";
import { scanBeats, type GhostBeat } from "./model";

class GhostBeatWidget extends WidgetType {
  constructor(readonly letter: string, readonly text: string) {
    super();
  }

  eq(other: GhostBeatWidget): boolean {
    return other.letter === this.letter && other.text === this.text;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = view.dom.ownerDocument.createElement("span");
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

function isLivePreview(view: EditorView): boolean {
  try {
    return view.state.field(editorLivePreviewField, false) ?? false;
  } catch {
    return false;
  }
}

function scan(view: EditorView): GhostBeat[] {
  const lines: string[] = [];
  const it = view.state.doc.iterLines();
  while (!it.next().done) lines.push(it.value);
  return scanBeats(lines);
}

class GhostBeatsPlugin {
  decorations: DecorationSet;
  private beats: GhostBeat[];
  private live: boolean;

  constructor(view: EditorView) {
    this.beats = scan(view);
    this.live = isLivePreview(view);
    this.decorations = this.build(view);
  }

  update(u: ViewUpdate): void {
    const live = isLivePreview(u.view);
    if (u.docChanged) this.beats = scan(u.view);
    if (u.docChanged || u.selectionSet || u.viewportChanged || live !== this.live) {
      this.live = live;
      this.decorations = this.build(u.view);
    }
  }

  private build(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    if (!this.beats.length) return builder.finish();
    const { doc, selection } = view.state;
    for (const b of this.beats) {
      if (b.line + 1 > doc.lines) continue;
      const line = doc.line(b.line + 1);
      const touched = selection.ranges.some((r) => r.from <= line.to && r.to >= line.from);
      if (this.live && !touched) {
        builder.add(line.from, line.to, Decoration.replace({ widget: new GhostBeatWidget(b.letter, b.text) }));
      } else {
        builder.add(line.from, line.from, rawLine);
      }
    }
    return builder.finish();
  }
}

export function ghostBeats(): Extension {
  return ViewPlugin.fromClass(GhostBeatsPlugin, { decorations: (v) => v.decorations });
}
