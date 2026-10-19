// What the screenplay editor suggests as you type (1.2, SP 2, PLAN-1.2 Q11; board 45): the cues
// already in the script and the universe's names on a cue line, the locations used after "INT. ",
// the times of day after " - ". The choices are core/screenplay-suggest.ts, pure; this is the
// EditorSuggest around them. Obsidian cannot unregister a suggest, so it stays registered and is
// inert (`enabled` false) while the feature is off.

import { EditorSuggest, type App, type Editor, type EditorPosition, type EditorSuggestContext, type EditorSuggestTriggerInfo, type TFile } from "obsidian";
import { fountainDoc, fountainDocLines } from "../core/fountain-doc";
import type { FountainOptions } from "../core/fountain";
import { candidates, cueNames, triggerAt, type SuggestKind } from "../core/screenplay-suggest";
import type { TermTable } from "../core/names";
import { plural, t } from "../i18n";
import { cmOf } from "../ui/editor-glue";

export interface SuggestHost {
  /** is this file a screenplay (its form)? */
  isScreenplay(file: TFile): boolean;
  opts(): FountainOptions;
  /** the time-of-day words of the settings */
  times(): string[];
  /** the universe's names for the note (`plugin.names.tableFor`) */
  names(path: string): TermTable;
}

export interface ScreenplayItem {
  kind: SuggestKind;
  text: string;
  /** the small line beside the name: "12 speeches", "universe", or "" */
  note: string;
}

export class ScreenplaySuggest extends EditorSuggest<ScreenplayItem> {
  /** false while the feature is off: the suggest answers nothing */
  enabled = true;
  private kind: SuggestKind = "cue";

  constructor(app: App, private readonly host: SuggestHost) {
    super(app);
    this.limit = 12;
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!this.enabled || !file || !this.host.isScreenplay(file)) return null;
    const cm = cmOf(editor);
    if (!cm) return null;
    const { doc } = cm.state;
    if (cursor.line >= doc.lines) return null;
    const opts = this.host.opts();
    const kinds = fountainDocLines(doc, opts);
    const trigger = triggerAt({
      line: doc.line(cursor.line + 1).text,
      column: cursor.ch,
      kind: kinds[cursor.line],
      blankAbove: cursor.line === 0 || kinds[cursor.line - 1] === null,
      sceneHeadings: opts.sceneHeadings,
    });
    if (!trigger) return null;
    this.kind = trigger.kind;
    return { start: { line: cursor.line, ch: trigger.start }, end: cursor, query: trigger.query };
  }

  getSuggestions(context: EditorSuggestContext): ScreenplayItem[] {
    const cm = cmOf(context.editor);
    if (!cm) return [];
    const opts = this.host.opts();
    const script = fountainDoc(cm.state.doc, opts);
    const table = this.host.names(context.file.path);
    // the characters' own names (not aliases, first names, places or objects): what a writer would put on a cue
    const names = this.kind === "cue" ? cueNames(table) : [];
    const trigger = { kind: this.kind, start: context.start.ch, query: context.query };
    const found = candidates(trigger, script, names, this.host.times(), opts.sceneHeadings);
    const speeches = new Map<string, number>();
    if (this.kind === "cue") {
      for (const e of script.elements) {
        if (e.type === "character") speeches.set(e.name.trim().toLocaleUpperCase(), (speeches.get(e.name.trim().toLocaleUpperCase()) ?? 0) + 1);
      }
    }
    return found.map((text) => {
      let note = "";
      if (this.kind === "cue") {
        const n = speeches.get(text.toLocaleUpperCase()) ?? 0;
        note = n > 0 ? plural("screenplay.suggest.speeches", n) : t("screenplay.suggest.universe");
      }
      return { kind: this.kind, text, note };
    });
  }

  renderSuggestion(item: ScreenplayItem, el: HTMLElement): void {
    el.addClass("escrita-sp-suggest");
    el.createSpan({ cls: "escrita-sp-suggest-name", text: item.text });
    if (item.note) el.createSpan({ cls: "escrita-sp-suggest-note", text: item.note });
  }

  selectSuggestion(item: ScreenplayItem): void {
    const context = this.context;
    if (!context) return;
    // up to the cursor as it is now: keys typed since the list was drawn are part of what is replaced
    const cursor = context.editor.getCursor();
    const end = cursor.line === context.start.line && cursor.ch >= context.start.ch ? cursor : context.end;
    context.editor.replaceRange(item.text, context.start, end);
    // the cursor goes after the name, ready for what comes next (" - ", Enter)
    context.editor.setCursor({ line: context.start.line, ch: context.start.ch + item.text.length });
  }

  /** The feature went off: close an open popup and answer nothing from now on. */
  disable(): void {
    this.enabled = false;
    this.close();
  }
}
