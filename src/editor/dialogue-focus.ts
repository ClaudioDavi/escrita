// Dialogue focus — CodeMirror glue. Dims everything but speech (see dialogue.ts)
// in the visible lines of notes where it's turned on. Zero work while off.

import { dispatchWithRetry } from "../core/dispatch-retry";
import { RangeSetBuilder, StateEffect, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { segmentDoc } from "../core/markdown";
import { dimPlan, type DialogueOptions } from "../core/dialogue";

/** Dispatched to every editor to re-read the on/off state and options. */
const refreshEffect = StateEffect.define<null>();

const DIM = "escrita-dialogue-dim";
const dimLine = Decoration.line({ class: DIM });
const dimMark = Decoration.mark({ class: DIM });

export class DialogueFocus {
  /** The editors running the plugin, so a toggle can reach them with a StateEffect. */
  private views = new Set<EditorView>();
  readonly extension: Extension;

  constructor(
    pathOf: (s: EditorState) => string | null,
    isOn: (path: string) => boolean,
    opts: () => DialogueOptions,
  ) {
    const views = this.views;
    const onFor = (s: EditorState) => {
      const p = pathOf(s);
      return p !== null && isOn(p);
    };

    class DialogueFocusPlugin {
      on: boolean;
      opts: DialogueOptions;
      decorations: DecorationSet;

      constructor(private readonly view: EditorView) {
        views.add(view);
        this.on = onFor(view.state);
        this.opts = opts();
        this.decorations = this.build(view);
      }

      update(u: ViewUpdate): void {
        const on = onFor(u.state);
        const o = opts();
        const changed = on !== this.on
          || o.quoteStyle !== this.opts.quoteStyle
          || o.paragraphStyle !== this.opts.paragraphStyle;
        this.on = on;
        this.opts = o;
        // selection changes don't matter: no rebuild on cursor moves
        if (changed || (on && (u.docChanged || u.viewportChanged))) this.decorations = this.build(u.view);
      }

      destroy(): void {
        views.delete(this.view);
      }

      private build(view: EditorView): DecorationSet {
        if (!this.on) return Decoration.none;
        const { doc } = view.state;
        // segmented once per document version, shared with the other editor features
        const md = segmentDoc(doc);
        const builder = new RangeSetBuilder<Decoration>();
        let done = -1; // last line added: visible ranges may share a line
        for (const r of view.visibleRanges) {
          const first = Math.max(doc.lineAt(r.from).number - 1, done + 1);
          const last = doc.lineAt(r.to).number - 1;
          if (first > last) continue;
          const plan = dimPlan(md, first, last, this.opts);
          let m = 0;
          let li = 0;
          for (let l = first; l <= last; l++) {
            const from = doc.line(l + 1).from;
            if (plan.lines[li] === l) {
              builder.add(from, from, dimLine);
              li++;
            }
            const end = doc.line(l + 1).to;
            while (m < plan.marks.length && plan.marks[m].from < end) {
              const mk = plan.marks[m++];
              builder.add(mk.from, mk.to, dimMark);
            }
          }
          done = last;
        }
        return builder.finish();
      }
    }

    const plugin = ViewPlugin.fromClass(DialogueFocusPlugin, {
      decorations: (v) => v.decorations,
      // line decorations can't reach block widgets (embeds, the properties box)
      provide: (p) => EditorView.editorAttributes.of((view) =>
        view.plugin(p)?.on ? { class: "escrita-dialogue-focus" } : null),
    });
    this.extension = plugin;
  }

  /** Make every editor re-read the toggle state and options. */
  refresh(): void {
    // A dispatch can fail mid-update: retried once, and only a second failure drops the editor.
    for (const view of [...this.views]) {
      dispatchWithRetry(view, () => ({ effects: refreshEffect.of(null) }), () => this.views.has(view), (e) => {
        this.views.delete(view);
        console.error("Escrita: couldn't refresh dialogue focus", e);
      });
    }
  }
}
