// Creating things from the editor: the "Create universe entry" modal (board 17),
// "Plant a thread", the close-thread dialog and the thread marker in the editor
// (board 20), with their editor menu items. The data work is done by the module
// API: plugin.universe.createEntry(), closeThread(), reopenThread(), answerLink().
// This file is only the UI and the glue; the decisions live in create-logic.ts.

import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";
import {
  AbstractInputSuggest, MarkdownView, Modal, Notice, TFile, normalizePath,
  type App, type Editor, type MarkdownFileInfo, type Menu,
} from "obsidian";
import type EscritaPlugin from "../main";
import { segmentDoc } from "../core/markdown";
import { parseThreads, threadComment, type ThreadMarker } from "../core/markers";
import { replaceIfExact } from "../core/note-text";
import { t } from "../i18n";
import { entryFolder, entryPath } from "./new-entry";
import type { Scope } from "../core/scope";
import { ENTRY_KINDS, type EntryKind } from "./settings";
import {
  fence, findDuplicate, linkFor, nameFromSelection, plantThreadPlan, resolveAnswer, splitFenced,
  suggestWorks, threadAtLine, type WorkChoice,
} from "./create-logic";

const LAST_KIND_KEY = "escrita-universe-last-kind";

function lastKind(app: App): EntryKind {
  try {
    const v: unknown = app.loadLocalStorage(LAST_KIND_KEY);
    if (typeof v === "string" && (ENTRY_KINDS as readonly string[]).includes(v)) return v as EntryKind;
  } catch { /* storage may be unavailable: fall back to the first type */ }
  return ENTRY_KINDS[0];
}

function rememberKind(app: App, kind: EntryKind): void {
  try { app.saveLocalStorage(LAST_KIND_KEY, kind); } catch { /* a convenience only */ }
}

function kindLabel(plugin: EscritaPlugin, kind: EntryKind): string {
  return plugin.settings.entryTypes[kind].label.trim() || t(`universe.kind.${kind}`);
}

// --------------------------------------------------------------- create entry

/** The text the entry was made from, in the note it was written in: what "link this occurrence" replaces. */
interface Occurrence {
  file: TFile;
  from: number;
  to: number;
  text: string;
}

/** Writes the link over the occurrence through the note text port (the editor's undo covers it). False when the text there changed. */
async function linkOccurrence(plugin: EscritaPlugin, o: Occurrence, target: string): Promise<boolean> {
  const r = await plugin.notes.text(o.file).apply(replaceIfExact(o.from, o.to, o.text, linkFor(target, o.text)));
  return r.ok;
}

/** Opens the note in a split next to the writer's text without taking focus from it. */
async function openBeside(plugin: EscritaPlugin, file: TFile, editor: Editor | null): Promise<void> {
  const ws = plugin.app.workspace;
  try {
    const leaf = ws.getActiveViewOfType(MarkdownView) ? ws.getLeaf("split", "vertical") : ws.getLeaf(true);
    await leaf.openFile(file, { active: false });
  } catch {
    new Notice(t("universe.create.notice.failed"));
  }
  if (editor) editor.focus();
}

class NewEntryModal extends Modal {
  private name: string;
  private kind: EntryKind;
  private alias = "";
  private link = true;
  private nameInput!: HTMLInputElement;
  private extras!: HTMLElement;
  private chips!: HTMLElement;
  private dynamic!: HTMLElement;
  private busy = false;

  constructor(
    private plugin: EscritaPlugin,
    private entryScope: Scope,
    kind: EntryKind,
    name: string,
    private occurrence: Occurrence | null,
    private editor: Editor | null,
  ) {
    super(plugin.app);
    this.kind = kind;
    this.name = name;
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    this.modalEl.addClass("escrita-universe-create");
    titleEl.setText(t("universe.create.title"));

    const nameField = contentEl.createDiv({ cls: "escrita-universe-create-field" });
    nameField.createEl("label", { text: t("universe.create.name") });
    this.nameInput = nameField.createEl("input", { type: "text", value: this.name, attr: { "aria-label": t("universe.create.name") } });
    this.nameInput.addEventListener("input", () => { this.name = this.nameInput.value; this.refresh(); });

    const kindField = contentEl.createDiv({ cls: "escrita-universe-create-field" });
    kindField.createSpan({ text: t("universe.create.kind") });
    this.chips = kindField.createDiv({ cls: "escrita-universe-create-chips", attr: { role: "radiogroup", "aria-label": t("universe.create.kind") } });
    this.renderChips();

    this.extras = contentEl.createDiv({ cls: "escrita-universe-create-extras" });
    const aliasField = this.extras.createDiv({ cls: "escrita-universe-create-field" });
    aliasField.createEl("label", { text: t("universe.create.alias") });
    const aliasInput = aliasField.createEl("input", {
      type: "text", attr: { placeholder: t("universe.create.aliasPlaceholder"), "aria-label": t("universe.create.alias") },
    });
    aliasInput.addEventListener("input", () => { this.alias = aliasInput.value; });
    if (this.occurrence) {
      const row = this.extras.createEl("label", { cls: "escrita-universe-create-check" });
      const box = row.createEl("input", { type: "checkbox" });
      box.checked = this.link;
      box.addEventListener("change", () => { this.link = box.checked; });
      row.createSpan({ text: t("universe.create.link") });
    }

    this.dynamic = contentEl.createDiv({ cls: "escrita-universe-create-dynamic" });
    contentEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        void this.primary();
      }
    });
    this.refresh();
    this.nameInput.focus();
    this.nameInput.select();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderChips(): void {
    this.chips.empty();
    for (const k of ENTRY_KINDS) {
      const chip = this.chips.createEl("button", {
        cls: "escrita-universe-create-chip", text: kindLabel(this.plugin, k),
        attr: { type: "button", role: "radio", "aria-checked": String(k === this.kind) },
      });
      chip.toggleClass("is-active", k === this.kind);
      chip.addEventListener("click", () => { this.kind = k; this.renderChips(); this.refresh(); });
    }
  }

  /** What the current name means: a clash with an entry, a file already there, or nothing. */
  private state() {
    const s = this.plugin.settings;
    const name = this.name.trim();
    const dup = findDuplicate(this.plugin.universe.entries(this.entryScope), name);
    const path = entryPath(this.entryScope, this.kind, name, s.entryTypes);
    const there = path === null ? null : this.plugin.app.vault.getAbstractFileByPath(normalizePath(path));
    return { name, dup, path, file: there instanceof TFile ? there : null };
  }

  private refresh(): void {
    const st = this.state();
    const clash = st.dup !== null || st.file !== null;
    this.extras.toggleClass("escrita-universe-create-hidden", clash);
    this.dynamic.empty();
    if (clash) this.renderClash(st);
    else this.renderWhere(st.name);
    this.renderButtons(st);
  }

  private renderClash(st: ReturnType<NewEntryModal["state"]>): void {
    const box = this.dynamic.createDiv({ cls: "escrita-universe-create-warn", attr: { role: "alert" } });
    if (st.dup) {
      const key = st.dup.via === "name" ? "universe.create.dupName" : "universe.create.dupAlias";
      const { entry } = st.dup;
      const kind = kindLabel(this.plugin, entry.kind).toLowerCase();
      const parts = splitFenced(t(key, { name: st.name, entry: fence(entry.name), kind }));
      const p = box.createEl("p");
      for (const f of parts) f.code ? p.createEl("strong", { text: f.text }) : p.appendText(f.text);
    } else if (st.file) {
      box.createEl("p", { text: t("universe.create.fileExists", { path: st.file.path }) });
    }
    const target = st.dup ? this.plugin.app.vault.getAbstractFileByPath(st.dup.entry.path) : st.file;
    const row = box.createDiv({ cls: "escrita-universe-create-btns" });
    if (target instanceof TFile) {
      const open = row.createEl("button", { cls: "mod-cta", text: t("universe.create.open", { name: target.basename }), attr: { type: "button" } });
      open.addEventListener("click", () => { this.close(); void openBeside(this.plugin, target, this.editor); });
    }
    if (st.dup && target instanceof TFile && this.occurrence) {
      const only = row.createEl("button", { text: t("universe.create.justLink"), attr: { type: "button" } });
      only.addEventListener("click", () => { void this.justLink(target); });
    }
  }

  private renderWhere(name: string): void {
    const s = this.plugin.settings;
    const type = s.entryTypes[this.kind];
    const folder = entryFolder(this.entryScope, this.kind, s.entryTypes) ?? "";
    const path = entryPath(this.entryScope, this.kind, name, s.entryTypes) ?? `${folder}/….md`;
    const universe = this.entryScope.kind === "universe" && this.entryScope.note !== null;
    const tpl = type.template.trim();
    const typeProp = `${s.typeProperty}: ${type.value}`;
    const vars = {
      path: fence(normalizePath(path)),
      template: fence(tpl),
      type: fence(typeProp),
      universe: fence(`${s.universeProperty}: "[[${(this.entryScope.note ?? "").replace(/\.md$/i, "").split("/").pop()}]]"`),
      universeProp: fence(s.universeProperty),
    };
    const key = `universe.create.where${universe ? "Universe" : "Book"}${tpl !== "" ? "Tpl" : ""}`;
    const where = this.dynamic.createDiv({ cls: "escrita-universe-create-where" });
    for (const f of splitFenced(t(key, vars))) {
      if (f.code) where.createEl("code", { text: f.text });
      else where.appendText(f.text);
    }
  }

  private renderButtons(st: ReturnType<NewEntryModal["state"]>): void {
    const row = this.dynamic.createDiv({ cls: "escrita-universe-create-btns escrita-universe-create-footer" });
    const cancel = row.createEl("button", { text: t("universe.create.cancel"), attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    if (st.file) return; // never overwrites: Create is not offered
    const label = st.dup ? "universe.create.createAnyway" : "universe.create.create";
    const go = row.createEl("button", { cls: st.dup ? "" : "mod-cta", text: t(label), attr: { type: "button" } });
    go.disabled = st.path === null;
    go.addEventListener("click", () => { void this.create(); });
  }

  /** Enter: creates, unless the name clashes (then it waits for a deliberate click). */
  private async primary(): Promise<void> {
    const st = this.state();
    if (st.dup || st.file || st.path === null) return;
    await this.create();
  }

  private async justLink(target: TFile): Promise<void> {
    if (!this.occurrence || this.busy) return;
    this.busy = true;
    const ok = await linkOccurrence(this.plugin, this.occurrence, target.basename);
    if (!ok) new Notice(t("universe.create.notice.linkFailed"));
    this.close();
    if (this.editor) this.editor.focus();
  }

  private async create(): Promise<void> {
    if (this.busy) return;
    const name = this.name.trim();
    this.busy = true;
    try {
      const file = await this.plugin.universe.createEntry({ name, kind: this.kind, scope: this.entryScope, alias: this.alias.trim() || undefined });
      rememberKind(this.plugin.app, this.kind);
      if (this.occurrence && this.link) {
        const ok = await linkOccurrence(this.plugin, this.occurrence, file.basename);
        if (!ok) new Notice(t("universe.create.notice.linkFailed"));
      }
      const folder = file.parent?.path ?? "";
      new Notice(t("universe.create.notice.created", { name: file.basename, folder }));
      this.close();
      await openBeside(this.plugin, file, this.editor);
    } catch (e) {
      this.busy = false;
      // CreateEntryError("exists"): a file appeared meanwhile, so show the clash instead
      if (e instanceof Error && e.name === "CreateEntryError" && (e as { reason?: string }).reason === "exists") this.refresh();
      else new Notice(t("universe.create.notice.failed"));
    }
  }
}

/**
 * Command "Create universe entry" (also the panel's "New entry" with `editor` null:
 * empty name). Opens the modal; creates the entry through plugin.universe.createEntry;
 * the selection stays text unless the writer keeps "turn this occurrence into a link"
 * on. Options: `kind`, the type to start on (else the last one used); `given`, a scope the
 * caller already knows (the panel's), else it comes from the file; `named`, a name the caller
 * found (the lens's names rule, D8), filled in whole and editable, with no occurrence to link.
 * Only called when the mode is not off.
 */
export function createEntryFromSelection(
  plugin: EscritaPlugin, editor: Editor | null, file: TFile | null,
  { kind, given, named = "" }: { kind?: EntryKind; given?: Scope; named?: string } = {},
): void {
  const src = file ?? plugin.app.workspace.getActiveFile();
  // a scope the caller already shows (the panel's hand-picked universe) wins over the file's own
  const scope = given && given.kind !== "none" ? given : src ? plugin.universe.scopeOf(src) : plugin.universe.scopeOfActive();
  if (!scope || scope.kind === "none") {
    const name = src?.basename ?? "";
    new Notice(t(plugin.universe.mode() === "perBook" ? "universe.create.notice.perBook" : "universe.create.notice.noUniverse", { name }));
    return;
  }
  let name = named.trim();
  let occurrence: Occurrence | null = null;
  if (editor && src && name === "") {
    const raw = editor.getSelection();
    const picked = nameFromSelection(raw);
    if (picked !== null) {
      name = picked;
      const from = editor.posToOffset(editor.getCursor("from")) + (raw.length - raw.trimStart().length);
      occurrence = { file: src, from, to: from + picked.length, text: picked };
    }
  }
  new NewEntryModal(plugin, scope, kind ?? lastKind(plugin.app), name, occurrence, editor).open();
}

// --------------------------------------------------------------------- threads

/**
 * Command "Plant a thread": writes `%% <thread word>: <text> %%` on its own line at the
 * cursor (the selected text is copied into it and stays in the prose), in one editor
 * transaction so one undo takes it back. Without a selection the cursor lands inside.
 */
export function plantThread(plugin: EscritaPlugin, editor: Editor): void {
  const s = plugin.settings;
  const plan = plantThreadPlan(
    editor.getValue(), editor.posToOffset(editor.getCursor("from")), editor.posToOffset(editor.getCursor("to")),
    s.threadKeyword, s.threadClosedWord,
  );
  if (!plan) {
    new Notice(t("universe.create.plant.refused"));
    return;
  }
  const { change } = plan;
  editor.transaction({ changes: [{ from: editor.offsetToPos(change.from), to: editor.offsetToPos(change.to), text: change.insert }] });
  editor.setCursor(editor.offsetToPos(plan.cursor));
  new Notice(t("universe.create.plant.done"));
}

/** The thread marker the cursor is on (its line), or null. Used to enable "Close thread…" and its menu item. */
export function threadAtCursor(plugin: EscritaPlugin, editor: Editor): ThreadMarker | null {
  const s = plugin.settings;
  const doc = editor.getValue();
  if (!doc.includes("%%")) return null;
  const cursor = editor.getCursor("head");
  return threadAtLine(parseThreads(doc, s.threadKeyword, s.threadClosedWord), cursor.line, editor.posToOffset(cursor));
}

/** The works a thread can be answered in: the file's scope when it has one, else the tracked works. */
export function answerChoices(plugin: EscritaPlugin, file: TFile): WorkChoice[] {
  const scope = plugin.universe.scopeOf(file);
  if (scope.kind !== "none") return plugin.universe.worksIn(scope).map((w) => ({ path: w.path, title: w.title }));
  const out: WorkChoice[] = [];
  for (const [path, e] of plugin.works.list()) out.push({ path, title: e.title });
  return out;
}

/**
 * What a typed "answered in" value becomes: the link target to write (a work or any
 * existing note, through answerLink; typed text that resolves to nothing as is) and,
 * for that last case, the text to warn about. Shared by the editor's dialog and the panel.
 */
export function resolveAnswerLink(plugin: EscritaPlugin, file: TFile, works: WorkChoice[], typed: string): { link: string | undefined; unknown: string | null } {
  const target = resolveAnswer(typed, works);
  if (target.kind === "none") return { link: undefined, unknown: null };
  if (target.kind === "work") {
    const f = plugin.app.vault.getAbstractFileByPath(target.work.path);
    return { link: f instanceof TFile ? plugin.universe.answerLink(f, file.path) : target.work.title, unknown: null };
  }
  // a note that exists but isn't a "work" is a fine answer; only a link to nothing is flagged
  const note = plugin.app.metadataCache.getFirstLinkpathDest(target.text, file.path);
  return note ? { link: plugin.universe.answerLink(note, file.path), unknown: null } : { link: target.text, unknown: target.text };
}

class WorkSuggest extends AbstractInputSuggest<WorkChoice> {
  constructor(app: App, private input: HTMLInputElement, private works: WorkChoice[]) {
    super(app, input);
  }

  getSuggestions(query: string): WorkChoice[] {
    return suggestWorks(this.works, query);
  }

  renderSuggestion(w: WorkChoice, el: HTMLElement): void {
    el.setText(w.title);
  }

  selectSuggestion(w: WorkChoice): void {
    this.input.value = w.title;
    this.input.dispatchEvent(new Event("input"));
    this.close();
  }
}

class CloseThreadModal extends Modal {
  private answer = "";

  constructor(private plugin: EscritaPlugin, private file: TFile, private thread: ThreadMarker, private editor: Editor | null) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    const works = answerChoices(this.plugin, this.file);
    this.modalEl.addClass("escrita-thread-close");
    const text = this.thread.text.length > 80 ? `${this.thread.text.slice(0, 79)}…` : this.thread.text;
    titleEl.setText(t("universe.create.close.title", { text }));

    const field = contentEl.createDiv({ cls: "escrita-universe-create-field" });
    field.createEl("label", { text: t("universe.create.close.answer") });
    const input = field.createEl("input", {
      type: "text", attr: { placeholder: t("universe.create.close.placeholder"), "aria-label": t("universe.create.close.answer") },
    });
    new WorkSuggest(this.plugin.app, input, works);

    const preview = contentEl.createDiv({ cls: "escrita-universe-create-where" });
    const paint = () => {
      preview.empty();
      const target = resolveAnswer(this.answer, works);
      const link = target.kind === "work" ? this.linkOf(target.work) : target.kind === "text" ? target.text : null;
      const marker = threadComment(this.plugin.settings.threadKeyword, this.plugin.settings.threadClosedWord, "…", true, link);
      preview.appendText(`${t("universe.create.close.preview", { note: this.file.basename })} `);
      preview.createEl("code", { text: marker });
    };
    input.addEventListener("input", () => { this.answer = input.value; paint(); });
    paint();

    const row = contentEl.createDiv({ cls: "escrita-universe-create-btns" });
    row.createEl("button", { text: t("universe.create.cancel"), attr: { type: "button" } }).addEventListener("click", () => this.close());
    row.createEl("button", { cls: "mod-cta", text: t("universe.create.close.confirm"), attr: { type: "button" } })
      .addEventListener("click", () => { void this.confirm(works); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); void this.confirm(works); }
    });
    input.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private linkOf(w: WorkChoice): string {
    const f = this.plugin.app.vault.getAbstractFileByPath(w.path);
    return f instanceof TFile ? this.plugin.universe.answerLink(f, this.file.path) : w.title;
  }

  private async confirm(works: WorkChoice[]): Promise<void> {
    const { link, unknown } = resolveAnswerLink(this.plugin, this.file, works, this.answer);
    this.close();
    const ok = await this.plugin.universe.closeThread(this.file, this.thread, link);
    if (!ok) { new Notice(t("universe.create.close.changed")); return; }
    new Notice(t("universe.create.close.done", { note: this.file.basename }));
    if (unknown !== null) new Notice(t("universe.create.close.unknown", { target: unknown }));
    if (this.editor) this.editor.focus();
  }
}

/**
 * Command / menu "Close thread…": the dialog (a modal, which also fits phones) that asks
 * which work answers the thread (optional) and closes it with plugin.universe.closeThread.
 * A refused close (the marker moved or changed) says so in a notice and changes nothing.
 */
export function closeThreadAtCursor(plugin: EscritaPlugin, editor: Editor, file: TFile, thread: ThreadMarker): void {
  new CloseThreadModal(plugin, file, thread, editor).open();
}

async function reopenAtCursor(plugin: EscritaPlugin, file: TFile, thread: ThreadMarker): Promise<void> {
  const ok = await plugin.universe.reopenThread(file, thread);
  new Notice(ok ? t("universe.create.reopen.done", { note: file.basename }) : t("universe.create.close.changed"));
}

/** The command runs in the editor (Live Preview or Source), not Reading view. */
export function inSource(ctx: unknown): ctx is MarkdownView & { file: TFile } {
  return ctx instanceof MarkdownView && ctx.getMode() === "source";
}

// ------------------------------------------------------------------- menu

/**
 * The editor right-click menu, in two parts so each feature registers its own: the universe's
 * "Create universe entry" (only for a one-line selection of up to 60 characters), and the
 * threads' "Plant a thread", "Close thread…" / "Reopen thread" and "Show open threads" on a
 * thread's line. Registered by the universe module and the threads feature on the
 * workspace's editor-menu event.
 */
export function addUniverseEditorMenuItems(plugin: EscritaPlugin, menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
  const file = info.file;
  if (!file || file.extension !== "md") return;
  if (nameFromSelection(editor.getSelection()) !== null) {
    menu.addItem((item) => item
      .setTitle(t("universe.cmd.createEntry"))
      .setIcon("user")
      .setSection("escrita")
      .onClick(() => createEntryFromSelection(plugin, editor, file)));
  }
}

export function addThreadsEditorMenuItems(plugin: EscritaPlugin, menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
  const file = info.file;
  if (!file || file.extension !== "md") return;
  menu.addItem((item) => item
    .setTitle(t("universe.cmd.plantThread"))
    .setIcon("flag")
    .setSection("escrita")
    .onClick(() => plantThread(plugin, editor)));
  const thread = threadAtCursor(plugin, editor);
  if (!thread) return;
  menu.addItem((item) => item
    .setTitle(t(thread.closed ? "universe.create.menu.reopen" : "universe.create.menu.close"))
    .setIcon(thread.closed ? "rotate-ccw" : "check")
    .setSection("escrita")
    .onClick(() => {
      if (thread.closed) void reopenAtCursor(plugin, file, thread);
      else closeThreadAtCursor(plugin, editor, file, thread);
    }));
  menu.addItem((item) => item
    .setTitle(t("universe.cmd.showThreads"))
    .setIcon("list")
    .setSection("escrita")
    .onClick(() => { void plugin.universe.showThreads(); }));
}

// -------------------------------------------------------- thread marker styling

const flagLine = Decoration.line({ class: "escrita-thread-line" });
const flagLineClosed = Decoration.line({ class: "escrita-thread-line is-closed" });
const closedMark = Decoration.mark({ class: "escrita-thread-closed-mark" });

class ThreadMarkersPlugin {
  decorations: DecorationSet;
  private words = "";

  constructor(view: EditorView, private plugin: EscritaPlugin) {
    this.decorations = this.build(view);
  }

  update(u: ViewUpdate): void {
    const s = this.plugin.settings;
    if (u.docChanged || `${s.threadKeyword}\u0000${s.threadClosedWord}` !== this.words) this.decorations = this.build(u.view);
  }

  private build(view: EditorView): DecorationSet {
    const s = this.plugin.settings;
    this.words = `${s.threadKeyword}\u0000${s.threadClosedWord}`;
    const builder = new RangeSetBuilder<Decoration>();
    const doc = view.state.doc;
    const md = segmentDoc(doc);
    if (!md.text.includes("%%")) return builder.finish();
    // line decoration (the margin flag) first, then the marks; a RangeSetBuilder wants them sorted by position
    const found = parseThreads(md, s.threadKeyword, s.threadClosedWord).filter((th) => th.line + 1 <= doc.lines);
    const hasOpen = new Map<number, boolean>();
    const items: { from: number; to: number; deco: Decoration }[] = [];
    for (const th of found) {
      if (th.closed) items.push({ from: th.from, to: th.to, deco: closedMark });
      hasOpen.set(th.line, (hasOpen.get(th.line) ?? false) || !th.closed);
    }
    for (const [line, open] of hasOpen) {
      const at = doc.line(line + 1).from;
      items.push({ from: at, to: at, deco: open ? flagLine : flagLineClosed });
    }
    items.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide);
    for (const it of items) builder.add(it.from, it.to, it.deco);
    return builder.finish();
  }
}

/**
 * The thread marker in the editor (board 20c): a small flag in the margin on a line that
 * holds an open thread; a closed one is muted and struck through (the marker only, not the prose
 * around it). Decorations only, so the text is never touched. index.ts registers it with plugin.registerEditorExtension.
 */
export function threadMarkerExtension(plugin: EscritaPlugin): Extension {
  return ViewPlugin.define((view) => new ThreadMarkersPlugin(view, plugin), { decorations: (v) => v.decorations });
}
