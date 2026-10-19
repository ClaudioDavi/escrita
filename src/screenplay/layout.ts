// The screenplay layout (1.2, SP 2, PLAN-1.2 Q4, Q5): in a screenplay note in Live Preview each
// line gets `escrita-sp-<kind>` and the editor gets `escrita-screenplay`, and the CSS (styles.css)
// does the rest, so the text stays as typed. The kinds come from `fountainDocLines`, cached per
// document version, so the reading is the export's. `_x_` ranges get a mark (Obsidian draws them
// as `*x*` italics, the same `.cm-em`).

import { RangeSetBuilder, StateEffect, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { fountainDocLines } from "../core/fountain-doc";
import type { FountainOptions, LineKind } from "../core/fountain";
import { underlineRanges } from "../core/fountain-marks";
import { EditorSet, isLivePreview } from "../ui/editor-glue";

/** Dispatched to every editor to re-read whether the note is a screenplay, the font and the options. */
const refreshEffect = StateEffect.define<null>();

export interface LayoutHost {
  /** is the note of this state a screenplay (its form)? */
  isScreenplay(state: EditorState): boolean;
  /** the parser's options: the same object until the settings words change (the per-version cache keys on it) */
  opts(): FountainOptions;
  font(): "courier" | "theme";
  /** the lines held in a mode (Tab on an empty line): they take that element's column before the parser can read it */
  modes(state: EditorState): readonly { pos: number; mode: LineKind }[];
}

const lineDecos = new Map<LineKind, Decoration>();
function lineDeco(kind: LineKind): Decoration {
  let d = lineDecos.get(kind);
  if (!d) {
    d = Decoration.line({ class: `escrita-sp-${kind}` });
    lineDecos.set(kind, d);
  }
  return d;
}

const underlineMark = Decoration.mark({ class: "escrita-sp-underline" });

/** The line kinds where a writer underlines. */
const UNDERLINES: ReadonlySet<LineKind> = new Set<LineKind>(["action", "dialogue", "centered", "lyric"]);

export class ScreenplayLayout {
  private views = new EditorSet();
  readonly extension: Extension;

  constructor(host: LayoutHost) {
    const views = this.views;
    const on = (s: EditorState) => isLivePreview(s) && host.isScreenplay(s);

    class LayoutPlugin {
      on: boolean;
      attrs: string;
      opts: FountainOptions;
      decorations: DecorationSet;

      constructor(private readonly view: EditorView) {
        views.add(view);
        this.on = on(view.state);
        this.opts = host.opts();
        this.attrs = this.attrsFor();
        this.decorations = this.build(view);
      }

      update(u: ViewUpdate): void {
        const now = on(u.state);
        const opts = host.opts();
        const forced = u.transactions.some((tr) => tr.effects.some((e) => e.is(refreshEffect)));
        const changed = forced || now !== this.on || opts !== this.opts || (now && host.modes(u.state) !== host.modes(u.startState));
        this.on = now;
        this.opts = opts;
        this.attrs = this.attrsFor();
        // selection changes don't matter: no rebuild on cursor moves
        if (changed || (now && (u.docChanged || u.viewportChanged))) this.decorations = this.build(u.view);
      }

      destroy(): void {
        views.delete(this.view);
      }

      private attrsFor(): string {
        return host.font() === "courier" ? "escrita-screenplay escrita-screenplay-courier" : "escrita-screenplay";
      }

      private build(view: EditorView): DecorationSet {
        if (!this.on) return Decoration.none;
        const { doc } = view.state;
        const kinds = fountainDocLines(doc, this.opts);
        const held = new Map<number, LineKind>();
        for (const m of host.modes(view.state)) if (m.pos <= doc.length) held.set(doc.lineAt(m.pos).number, m.mode);
        const builder = new RangeSetBuilder<Decoration>();
        let done = 0; // last line number added: visible ranges may share a line
        for (const r of view.visibleRanges) {
          const first = Math.max(doc.lineAt(r.from).number, done + 1);
          const last = doc.lineAt(r.to).number;
          for (let n = first; n <= last; n++) {
            const kind = held.get(n) ?? kinds[n - 1];
            if (!kind) continue;
            const line = doc.line(n);
            builder.add(line.from, line.from, lineDeco(kind));
            if (UNDERLINES.has(kind) && line.text.includes("_")) {
              for (const [a, b] of underlineRanges(line.text)) builder.add(line.from + a, line.from + b, underlineMark);
            }
          }
          done = Math.max(done, last);
        }
        return builder.finish();
      }
    }

    this.extension = ViewPlugin.fromClass(LayoutPlugin, {
      decorations: (v) => v.decorations,
      // line decorations can't reach block widgets (the rule between scenes, the properties box), so the editor carries the class
      provide: (p) => EditorView.editorAttributes.of((view) => {
        const plugin = view.plugin(p);
        return plugin?.on ? { class: plugin.attrs } : null;
      }),
    });
  }

  /** Make every editor re-read the note's form, the font and the options (settings and metadata changes). */
  refresh(): void {
    this.views.broadcast({ effects: refreshEffect.of(null) }, (e) => {
      console.error("Escrita: couldn't refresh the screenplay layout", e);
    });
  }
}
