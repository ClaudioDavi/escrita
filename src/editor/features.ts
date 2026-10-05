// The editor's five switchable features (0.7 plan Q9, task 2.5), split out of the
// old EditorModule: typing (smart typography, Enter flow, scene break), dialogue
// focus, move blocks, templates and spellcheck on demand. Each registers through
// its ModuleContext; nothing here calls the plugin's register* methods.

import { MarkdownView, Notice, TFile, editorInfoField, type Editor, type WorkspaceLeaf } from "obsidian";
import { Prec, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type EscritaPlugin from "../main";
import { FeatureModule } from "../core/module-context";
import type { EditorSlot, SettingsUi } from "../core/module-context";
import { typingSettingsSection } from "./settings-ui";
import { t } from "../i18n";
import { renameInSet, dropFromSet } from "../core/path-keys";
import { segment, segmentDoc } from "../core/markdown";
import { blockStateIn, bodyLineIn, inBlock } from "./context";
import { breakEdit, decideEnter, trailingBreakKeep, withoutTrailingBreak } from "./enter-flow";
import { typographyFor } from "./typography";
import { sceneBreakEdit } from "./scene-break";
import { spellcheckExtensions, spellcheckSuppressed } from "./spellcheck";
import { DialogueFocus } from "./dialogue-focus";
import { insertFromTemplate } from "./template-insert";
import { moveParagraph, moveScene } from "./move";
import type { MoveDir } from "./move-blocks";

/** The last automatic typography replacement, so Backspace can undo it. */
interface LastReplacement {
  from: number;
  to: number;
  insert: string;
  original: string;
}

const setLast = StateEffect.define<LastReplacement | null>();

const lastReplacement = StateField.define<LastReplacement | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setLast)) return e.value;
    if (tr.docChanged || tr.selection) return null;
    return value;
  },
});

function fileOf(state: EditorState): TFile | null {
  const info = state.field(editorInfoField, false);
  return info?.file ?? null;
}

export class TypingFeature extends FeatureModule {
  readonly id = "typing" as const;
  readonly slots = { editors: 1 };
  /** A chapter is being created by Enter, Enter, Enter. */
  private creatingChapter = false;

  constructor(private plugin: EscritaPlugin) { super(); }

  onload(): void {
    this.ctx.editor([
      lastReplacement,
      Prec.high(keymap.of([
        { key: "Enter", run: (view) => this.onEnter(view) },
        { key: "Backspace", run: (view) => this.onBackspace(view) },
      ])),
      Prec.high(EditorView.inputHandler.of((view, from, to, text) => this.onInput(view, from, to, text))),
    ]);
    this.ctx.command({
      id: "insert-scene-break",
      name: t("editor.cmd.insertSceneBreak"),
      editorCallback: (editor) => this.insertSceneBreak(editor),
    });
  }

  // ---- scene break command --------------------------------------------------

  private insertSceneBreak(editor: Editor): void {
    const cursor = editor.getCursor("to");
    const doc = editor.getValue();
    // the whole properties block, its opening and closing --- included
    if (cursor.line < bodyLineIn(segment(doc))) {
      new Notice(t("editor.noBreakInProperties"));
      return;
    }
    const edit = sceneBreakEdit(doc, editor.posToOffset(cursor));
    const from = editor.offsetToPos(edit.from);
    editor.replaceRange(edit.insert, from, editor.offsetToPos(edit.to));
    // text before edit.from is unchanged, so the cursor offset is valid after the edit
    editor.setCursor(editor.offsetToPos(edit.cursor));
  }

  // ---- Enter, Enter, Enter --------------------------------------------------

  private onEnter(view: EditorView): boolean {
    if (!this.plugin.settings.enterFlow) return false;
    const { state } = view;
    const sel = state.selection;
    if (sel.ranges.length !== 1 || !sel.main.empty) return false;
    const file = fileOf(state);
    if (!file) return false;
    // Chapters get breaks and new chapters; other tracked writing (a conto,
    // an essay) gets scene breaks only.
    const p = this.plugin.books.classify(file);
    const chapter = p.kind === "chapter";
    if (!chapter && !p.tracked) return false;

    const cursorLine = state.doc.lineAt(sel.main.head).number - 1;
    // segmented once per document version (shared with the other editor features)
    const decision = decideEnter(segmentDoc(state.doc), cursorLine, this.plugin.settings.paragraphStyle);
    if (decision === "normal" || (decision === "chapter" && !chapter)) return false;
    if (this.creatingChapter) return true; // swallow repeats while the chapter is being made

    if (decision === "break") {
      const edit = breakEdit(segmentDoc(state.doc), cursorLine);
      const from = state.doc.line(edit.fromLine + 1).from;
      const to = state.doc.line(edit.toLine + 1).to;
      view.dispatch({
        changes: { from, to, insert: edit.insert },
        selection: { anchor: from + edit.insert.length },
        scrollIntoView: true,
        userEvent: "input",
      });
      return true;
    }

    // only from a real note tab (not a popover, embed or canvas card), which the new chapter replaces
    const info = state.field(editorInfoField, false);
    if (!(info instanceof MarkdownView) || info.file?.path !== file.path) return false;
    void this.nextChapter(view, file, info.leaf);
    return true;
  }

  private async nextChapter(view: EditorView, file: TFile, leaf: WorkspaceLeaf): Promise<void> {
    if (this.plugin.books.classify(file).kind !== "chapter") return;
    this.creatingChapter = true;
    try {
      // create first: if that fails, the current chapter is left untouched
      let created: TFile;
      try {
        created = await this.plugin.chapterOps.createChapterAfter(file, t("common.untitled"));
      } catch (e) {
        console.error("Escrita: couldn't create the next chapter", e);
        new Notice(t("editor.chapterFailed", { error: e instanceof Error ? e.message : String(e) }));
        return;
      }
      // the chapter exists from here on: a failure below must not hide it
      try {
        await this.removeTrailingBreak(view, file);
      } catch (e) {
        console.error("Escrita: couldn't remove the scene break ending the chapter", e);
      }
      try {
        // same leaf, unless it moved on to another note meanwhile
        const cur = leaf.view;
        const target = cur instanceof MarkdownView && cur.file?.path === file.path
          ? leaf
          : this.plugin.app.workspace.getLeaf("tab");
        await target.openFile(created);
        const v = target.view;
        if (v instanceof MarkdownView) {
          const ed = v.editor;
          const last = ed.lastLine();
          ed.setCursor({ line: last, ch: ed.getLine(last).length });
          ed.focus();
        }
      } catch (e) {
        console.error("Escrita: couldn't open the new chapter", e);
        new Notice(t("editor.chapterOpenFailed", { name: created.basename }));
      }
    } finally {
      this.creatingChapter = false;
    }
  }

  /** Drop the scene break (and blank lines) ending the chapter, if it's still there. */
  private async removeTrailingBreak(view: EditorView, file: TFile): Promise<void> {
    if (fileOf(view.state)?.path === file.path) {
      const doc = view.state.doc;
      const keep = trailingBreakKeep(segmentDoc(doc));
      if (keep === null) return;
      const from = keep > 0 ? doc.line(keep).to : 0;
      view.dispatch({ changes: { from, to: doc.length, insert: keep > 0 ? "\n" : "" }, userEvent: "delete" });
      return;
    }
    await this.plugin.app.vault.process(file, (text) => withoutTrailingBreak(text));
  }

  // ---- smart typography -----------------------------------------------------

  private typographyApplies(state: EditorState): boolean {
    const s = this.plugin.settings;
    // the scope is the editor's policy; what the file is comes from the classifier
    const p = this.plugin.books.classify(fileOf(state));
    return p.markdown && (s.typographyScope === "all" || p.kind === "chapter");
  }

  private onInput(view: EditorView, from: number, to: number, text: string): boolean {
    const s = this.plugin.settings;
    if (!s.smartTypography || from !== to || text.length !== 1 || view.composing) return false;
    const { state } = view;
    if (state.selection.ranges.length !== 1) return false;
    const line = state.doc.lineAt(from);
    const before = state.doc.sliceString(line.from, from);
    // cheap line-level decision first; the file and block checks only run when it fires
    const r = typographyFor(before, text, { quoteStyle: s.quoteStyle, dialogueDash: s.dialogueDash });
    if (!r || !this.typographyApplies(state)) return false;
    // segmented once per document version (shared with the other editor features)
    if (inBlock(blockStateIn(segmentDoc(state.doc), line.number - 1))) return false;

    const start = from - r.deleteBefore;
    view.dispatch({
      changes: { from: start, to, insert: r.insert },
      selection: { anchor: start + r.insert.length },
      effects: setLast.of({ from: start, to: start + r.insert.length, insert: r.insert, original: r.original }),
      scrollIntoView: true,
      userEvent: "input.type",
    });
    return true;
  }

  /** Backspace right after an automatic replacement brings back what was typed. */
  private onBackspace(view: EditorView): boolean {
    const last = view.state.field(lastReplacement, false);
    if (!last) return false;
    const sel = view.state.selection;
    if (sel.ranges.length !== 1 || !sel.main.empty || sel.main.head !== last.to) return false;
    if (view.state.doc.sliceString(last.from, last.to) !== last.insert) return false;
    view.dispatch({
      changes: { from: last.from, to: last.to, insert: last.original },
      selection: { anchor: last.from + last.original.length },
      effects: setLast.of(null),
      userEvent: "delete.backward",
    });
    return true;
  }

  settingsSection(el: HTMLElement, ui: SettingsUi): void { typingSettingsSection(el, ui, this.plugin); }
}

export class DialogueFocusFeature extends FeatureModule {
  readonly id = "dialogueFocus" as const;
  readonly slots = { editors: 1 };
  /** Notes with dialogue focus on (paths, this session only). */
  private dialogueOn = new Set<string>();
  private dialogue: DialogueFocus;

  constructor(private plugin: EscritaPlugin) {
    super();
    this.dialogue = new DialogueFocus(
      (s) => fileOf(s)?.path ?? null,
      (p) => this.dialogueOn.has(p),
      () => ({ quoteStyle: this.plugin.settings.quoteStyle, paragraphStyle: this.plugin.settings.paragraphStyle }),
    );
  }

  onload(): void {
    this.ctx.editor([this.dialogue.extension]);
    this.ctx.command({
      id: "toggle-dialogue-focus",
      name: t("editor.cmd.toggleDialogueFocus"),
      checkCallback: (checking) => {
        const v = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!v?.file) return false;
        if (!checking) this.toggleDialogueFocus(v);
        return true;
      },
    });
    // the toggle follows the note (this session only)
    this.ctx.follow({
      moved: (old, path) => { renameInSet(this.dialogueOn, old, path); },
      deleted: (path) => { dropFromSet(this.dialogueOn, path); },
    });
  }

  onunload(): void {
    // session state: the extension is gone, so a later load starts with nothing dimmed
    this.dialogueOn.clear();
  }

  settingsChanged(): void {
    // quote and paragraph style drive the dimming
    if (this.dialogueOn.size > 0) this.dialogue.refresh();
  }

  private toggleDialogueFocus(v: MarkdownView): void {
    const path = v.file!.path;
    const on = !this.dialogueOn.has(path);
    if (on) this.dialogueOn.add(path);
    else this.dialogueOn.delete(path);
    this.dialogue.refresh();
    if (on && v.getMode() === "preview") new Notice(t("editor.dialogueFocusReading"));
    else new Notice(t(on ? "editor.dialogueFocusOn" : "editor.dialogueFocusOff"));
  }
}

export class MoveBlocksFeature extends FeatureModule {
  readonly id = "moveBlocks" as const;

  constructor(private plugin: EscritaPlugin) { super(); }

  onload(): void {
    for (const [id, kind, dir, key] of [
      ["move-paragraph-up", "paragraph", "up", "editor.cmd.moveParagraphUp"],
      ["move-paragraph-down", "paragraph", "down", "editor.cmd.moveParagraphDown"],
      ["move-scene-up", "scene", "up", "editor.cmd.moveSceneUp"],
      ["move-scene-down", "scene", "down", "editor.cmd.moveSceneDown"],
    ] as const) {
      this.ctx.command({
        id,
        name: t(key),
        editorCheckCallback: (checking, editor, ctx) => {
          // only in the editor (Live Preview or Source), not Reading view
          if (!(ctx instanceof MarkdownView) || ctx.getMode() !== "source") return false;
          if (!checking) this.moveBlock(editor, kind, dir);
          return true;
        },
      });
    }
  }

  private moveBlock(editor: Editor, kind: "paragraph" | "scene", dir: MoveDir): void {
    const md = segment(editor.getValue());
    const sel = {
      anchor: editor.posToOffset(editor.getCursor("anchor")),
      head: editor.posToOffset(editor.getCursor("head")),
    };
    const r = kind === "paragraph"
      ? moveParagraph(md, this.plugin.settings.paragraphStyle, sel, dir)
      : moveScene(md, sel, dir);
    if ("refused" in r) {
      if (r.refused !== "edge") new Notice(t(`editor.move.${r.refused}`));
      return;
    }
    const { change, selection } = r;
    // one transaction, so one undo puts it back
    editor.transaction({
      changes: [{ from: editor.offsetToPos(change.from), to: editor.offsetToPos(change.to), text: change.insert }],
      selection: { from: editor.offsetToPos(selection.anchor), to: editor.offsetToPos(selection.head) },
    });
    const from = editor.offsetToPos(Math.min(selection.anchor, selection.head));
    const to = editor.offsetToPos(Math.max(selection.anchor, selection.head));
    editor.scrollIntoView({ from, to }, true);
  }
}

export class TemplatesFeature extends FeatureModule {
  readonly id = "templates" as const;

  constructor(private plugin: EscritaPlugin) { super(); }

  onload(): void {
    this.ctx.command({
      id: "insert-from-template",
      name: t("editor.cmd.insertTemplate"),
      editorCheckCallback: (checking, editor, ctx) => {
        // only in the editor (Live Preview or Source), not Reading view
        if (!(ctx instanceof MarkdownView) || ctx.getMode() !== "source") return false;
        if (!checking) insertFromTemplate(this.plugin, editor, ctx.file);
        return true;
      },
    });
  }
}

/** Its switch is `spellcheckOnDemand` (Q10): loaded, spellcheck is suppressed until toggled; unloaded, it is Obsidian's own. */
export class SpellcheckFeature extends FeatureModule {
  readonly id = "spellcheck" as const;
  readonly slots = { editors: 1 };
  /** Spellcheck turned on with the command (this session only). */
  private spellcheckOn = false;
  private slot: EditorSlot | null = null;

  constructor(private plugin: EscritaPlugin) { super(); }

  onload(): void {
    this.spellcheckOn = false;
    this.slot = this.ctx.editor(this.extensions());
    this.ctx.command({
      id: "toggle-spellcheck",
      name: t("editor.cmd.toggleSpellcheck"),
      callback: () => this.toggleSpellcheck(),
    });
  }

  onunload(): void {
    this.slot = null;
  }

  private extensions(): Extension[] {
    // loaded means on demand is on
    return spellcheckExtensions(spellcheckSuppressed(true, this.spellcheckOn));
  }

  private toggleSpellcheck(): void {
    this.spellcheckOn = !this.spellcheckOn;
    this.slot?.set(this.extensions());
    this.plugin.app.workspace.updateOptions();
    new Notice(t(this.spellcheckOn ? "editor.spellcheckOn" : "editor.spellcheckOff"));
  }
}
