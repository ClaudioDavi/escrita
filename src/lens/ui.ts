// The revision lens, Obsidian side (task 5.1): the view, the editor extension, the
// commands, the editor menu, stepping, and "Create the word lists note". Kept out of
// index.ts so the module's pure parts stay testable without an Obsidian runtime.

import {
  MarkdownView, Notice, Platform, TFile, editorInfoField, normalizePath,
  type Editor, type MarkdownFileInfo, type Menu, type WorkspaceLeaf,
} from "obsidian";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type EscritaPlugin from "../main";
import { t } from "../i18n";
import { LensMarks } from "./decorations";
import { starterNote } from "./lists";
import { stepTo } from "./panel-model";
import type { LensSession } from "./session";
import { listsTarget, selectionRange } from "./shown";
import type { LensLang, LensResult, Match, RuleId } from "./types";
import { LENS_VIEW, LensView } from "./view";

/** What the UI needs from the module. */
export interface LensHost {
  session: LensSession;
  shown(path: string): LensResult | undefined;
  lang(): LensLang | null;
  dismiss(path: string, text: string, m: Match): void;
}

function fileOf(state: EditorState): TFile | null {
  return state.field(editorInfoField, false)?.file ?? null;
}

/** CodeMirror's view behind an Obsidian editor; Obsidian does not type it. Only in editing mode. */
function cmOf(view: MarkdownView): EditorView | null {
  if (view.getMode() !== "source") return null;
  return (view.editor as unknown as { cm?: EditorView }).cm ?? null;
}

export class LensUi {
  private marks: LensMarks;
  /** the rule the next/previous commands step (echoes until one is chosen) */
  private lastRule: RuleId = "echo";
  private stepped: { path: string; from: number; to: number } | null = null;
  private selection: { path: string; from: number; to: number } | null = null;
  private selectionTimer: number | null = null;

  constructor(private plugin: EscritaPlugin, private host: LensHost) {
    this.marks = new LensMarks(
      (s) => { const f = fileOf(s); return f && f.extension === "md" ? f.path : null; },
      host.session,
      (path) => host.shown(path),
    );
  }

  load(): void {
    const p = this.plugin;
    const ws = p.app.workspace;

    p.registerView(LENS_VIEW, (leaf) => {
      const v = new LensView(leaf, p);
      v.hooks = {
        ignore: (rule) => this.ignoreCurrent(rule),
        openSettings: () => this.openSettings(),
      };
      return v;
    });
    p.registerEditorExtension(this.marks.extension);

    p.addCommand({
      id: "toggle-revision-lens",
      name: t("lens.cmd.toggle"),
      checkCallback: (checking) => {
        const v = ws.getActiveViewOfType(MarkdownView);
        if (!v?.file || v.file.extension !== "md") return false;
        if (!checking) void this.toggle(v);
        return true;
      },
    });
    for (const [id, dir, key, icon] of [
      ["next-revision-lens-match", 1, "lens.cmd.next", "chevron-down"],
      ["previous-revision-lens-match", -1, "lens.cmd.prev", "chevron-up"],
    ] as const) {
      p.addCommand({
        id,
        name: t(key),
        icon,
        checkCallback: (checking) => {
          const v = ws.getActiveViewOfType(MarkdownView);
          if (!v?.file || !this.host.session.isOn(v.file.path) || cmOf(v) === null) return false;
          if (!checking) this.stepCommand(dir);
          return true;
        },
      });
    }
    p.addCommand({
      id: "create-word-lists-note",
      name: t("lens.cmd.createLists"),
      callback: () => { void this.createLists(); },
    });

    p.registerEvent(ws.on("editor-menu", (menu, editor, info) => this.editorMenu(menu, editor, info)));

    p.register(this.host.session.onResult((path) => {
      this.marks.refresh();
      if (path === this.activePath()) this.refreshPanels();
    }));
    p.register(this.marks.onSelection((path, ranges) => this.onSelection(path, ranges)));
    p.register(() => { if (this.selectionTimer !== null) window.clearTimeout(this.selectionTimer); });
  }

  // ---------------------------------------------------------------- state for the panel

  /** The note the panel is about: the most recently used Markdown note. */
  private activeView(): MarkdownView | null {
    const v = this.plugin.app.workspace.getMostRecentLeaf()?.view;
    return v instanceof MarkdownView && v.file?.extension === "md" ? v : null;
  }

  activePath(): string | null {
    return this.activeView()?.file?.path ?? null;
  }

  /** The selection to measure for `path`, or null when there is none or it is out of date. */
  selectionFor(path: string, r: LensResult): { from: number; to: number } | null {
    const sel = this.selection;
    if (!sel || sel.path !== path) return null;
    const v = this.activeView();
    if (!v || v.file?.path !== path) return null;
    const len = cmOf(v)?.state.doc.length ?? v.editor.getValue().length;
    if (len !== r.pass.mask.length) return null;
    return { from: sel.from, to: sel.to };
  }

  /** The text of an open note, for a pass that starts from the panel. */
  textOf(path: string): string | null {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path) return leaf.view.editor.getValue();
    }
    return null;
  }

  /** Marks and panels re-read the shown result. */
  refresh(): void {
    this.marks.refresh();
    this.refreshPanels();
  }

  refreshPanels(): void {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType(LENS_VIEW)) {
      if (leaf.view instanceof LensView) leaf.view.refresh();
    }
  }

  private onSelection(path: string, ranges: { from: number; to: number }[]): void {
    const step = this.stepped && this.stepped.path === path ? this.stepped : null;
    const r = selectionRange(ranges, step);
    if (!step || (ranges[0] && (ranges[0].from !== step.from || ranges[0].to !== step.to))) this.stepped = null;
    const before = this.selection;
    this.selection = r ? { path, ...r } : null;
    const same = before === null ? this.selection === null
      : this.selection !== null && before.path === path && before.from === this.selection.from && before.to === this.selection.to;
    // nothing the panel shows changed, unless a stepped row's counter follows the cursor
    if (same && !(this.stepped && this.stepped.path === path)) return;
    if (this.selectionTimer !== null) window.clearTimeout(this.selectionTimer);
    this.selectionTimer = window.setTimeout(() => {
      this.selectionTimer = null;
      this.refreshPanels();
    }, 150);
  }

  // ---------------------------------------------------------------- commands

  private async toggle(v: MarkdownView): Promise<void> {
    const file = v.file;
    if (!file) return;
    const on = this.host.session.toggle(file.path);
    if (on && v.getMode() !== "source") new Notice(t("lens.notice.reading"));
    else if (on) {
      this.host.session.now(file.path, v.editor.getValue());
      await this.openPanel();
    }
    this.refresh();
  }

  /** Turns the lens on for a note from the panel's "Turn on" button. */
  turnOn(path: string): void {
    const text = this.textOf(path);
    if (text === null) return;
    if (!this.host.session.isOn(path)) this.host.session.toggle(path);
    this.host.session.now(path, text);
    if (this.activeView()?.getMode() === "preview") new Notice(t("lens.notice.reading"));
    this.refresh();
  }

  async openPanel(): Promise<void> {
    const ws = this.plugin.app.workspace;
    let leaf: WorkspaceLeaf | null = ws.getLeavesOfType(LENS_VIEW)[0] ?? null;
    if (!leaf) {
      leaf = ws.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: LENS_VIEW, active: true });
    }
    await ws.revealLeaf(leaf);
  }

  private openSettings(): void {
    try {
      const setting = (this.plugin.app as unknown as {
        setting?: { open(): void; openTabById(id: string): void };
      }).setting;
      setting?.open();
      setting?.openTabById(this.plugin.manifest.id);
    } catch { /* the settings tab is not reachable: nothing to do */ }
  }

  // ---------------------------------------------------------------- stepping

  /**
   * Selects the next or previous match of a rule in the active note. `fromPanel` closes the
   * phone drawer afterwards. Returns the position, or null when there is nothing to step to.
   */
  step(rule: RuleId, dir: 1 | -1, fromPanel: boolean): { index: number; of: number } | null {
    const v = this.activeView();
    const path = v?.file?.path;
    if (!v || !path || !this.host.session.isOn(path)) return null;
    const cm = cmOf(v);
    if (!cm) {
      if (fromPanel && v.getMode() === "preview") new Notice(t("lens.notice.reading"));
      return null;
    }
    const sel = cm.state.selection.main;
    const hit = stepTo(this.marks.matchesFor(cm.state), rule, dir === 1 ? sel.to : sel.from, dir);
    if (!hit) return null;
    const { match } = hit;
    const ed = v.editor;
    const from = ed.offsetToPos(match.from);
    const to = ed.offsetToPos(match.to);
    this.stepped = { path, from: match.from, to: match.to };
    this.lastRule = rule;
    ed.transaction({ selection: { from, to } });
    ed.scrollIntoView({ from, to }, true);
    this.marks.setCurrent(path, match);
    if (fromPanel && Platform.isPhone) this.plugin.app.workspace.rightSplit.collapse();
    return { index: hit.index, of: hit.of };
  }

  private stepCommand(dir: 1 | -1): void {
    const hit = this.step(this.lastRule, dir, false);
    if (hit && Platform.isPhone) {
      const name = t(this.lastRule === "gerund" && this.host.lang() === "en" ? "lens.rule.gerund.en" : `lens.rule.${this.lastRule}`);
      new Notice(t("lens.notice.step", { rule: name, n: hit.index + 1, of: hit.of }));
    }
  }

  // ---------------------------------------------------------------- ignoring

  private ignoreMatch(cm: EditorView, path: string, m: Match): void {
    // the key reads the matched text from the live doc at the mapped range, like its context
    const live = cm.state.doc.sliceString(m.from, m.to);
    this.host.dismiss(path, cm.state.doc.toString(), { ...m, text: live });
    this.refresh();
  }

  /** "Ignore here" from the panel: the match of `rule` under the selection. */
  private ignoreCurrent(rule: RuleId): void {
    const v = this.activeView();
    const path = v?.file?.path;
    const cm = v ? cmOf(v) : null;
    if (!v || !path) return;
    if (!cm) {
      if (v.getMode() === "preview") new Notice(t("lens.notice.reading"));
      return;
    }
    const sel = cm.state.selection.main;
    const m = this.marks.matchesFor(cm.state).find((x) => x.rule === rule && x.from <= sel.to && x.to >= sel.from);
    if (m) this.ignoreMatch(cm, path, m);
  }

  private editorMenu(menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
    const path = info.file?.path;
    if (!path || info.file?.extension !== "md" || !this.host.session.isOn(path)) return;
    const cm = (editor as unknown as { cm?: EditorView }).cm;
    if (!cm) return;
    const m = this.marks.matchAt(cm.state, cm.state.selection.main.head);
    if (!m) return;
    const rule = t(m.rule === "gerund" && this.host.lang() === "en" ? "lens.ruleOne.gerund.en" : `lens.ruleOne.${m.rule}`);
    menu.addSeparator();
    menu.addItem((item) => item.setTitle(t("lens.menu.header", { rule, word: m.text })).setDisabled(true));
    menu.addItem((item) => item
      .setTitle(t("lens.menu.ignore"))
      .setIcon("eye-off")
      .onClick(() => this.ignoreMatch(cm, path, m)));
  }

  // ---------------------------------------------------------------- the word lists note

  async createLists(): Promise<void> {
    const p = this.plugin;
    const l = this.host.lang();
    const path = normalizePath(listsTarget(p.settings.lensListsNote, l));
    try {
      const existing = p.app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) {
        new Notice(t("lens.notice.listsExists", { path }));
        await p.app.workspace.getLeaf(false).openFile(existing);
        return;
      }
      // getAbstractFileByPath is case-sensitive; the adapter's check is not on Windows/macOS
      if (await p.app.vault.adapter.exists(path)) {
        new Notice(t("lens.notice.listsExists", { path }));
        const low = path.toLowerCase();
        const same = p.app.vault.getMarkdownFiles().find((f) => f.path.toLowerCase() === low);
        if (same) await p.app.workspace.getLeaf(false).openFile(same);
        return;
      }
      const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (parent !== "") await p.notes.ensureFolder(parent);
      const file = await p.app.vault.create(path, starterNote(l ?? "en"));
      if (p.settings.lensListsNote.trim() === "") {
        p.settings.lensListsNote = path;
        await p.saveSettings();
      }
      new Notice(t("lens.notice.listsCreated", { path }));
      await p.app.workspace.getLeaf(false).openFile(file);
    } catch (e) {
      console.error("Escrita: couldn't create the word lists note", e);
      new Notice(t("lens.notice.listsFailed", { path }));
    }
  }
}
