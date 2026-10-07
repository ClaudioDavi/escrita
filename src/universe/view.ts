// The universe panel (view type `escrita-universe`: tabs Entries / Threads / Works) and
// the standalone Open threads view (`escrita-threads`, used when the mode is off).
// Boards 15 and 16 are the spec. Everything comes from the module API
// (`plugin.universe`); this file only decides what to show and draws it.
//
// The tabs live in view-entries.ts, view-threads.ts and view-works.ts; the pure logic
// (highlighting, grouping, counts) in panel-model.ts. The tab, the collapsed groups and
// "show closed" are kept in the leaf's state, so they come back with the workspace.

import { ItemView, MarkdownView, Menu, Notice, TFile, debounce, setIcon, type Editor, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import type EscritaPlugin from "../main";
import { fmt, plural, t } from "../i18n";
import { isTemplatePath } from "./entries";
import { countThreads, pickStillValid, readPanelState, toggled, type PanelState } from "./panel-model";
import { NO_SCOPE, universeNotePath, universeRootOf, type Scope } from "../core/scope";
import type { UniverseInfo } from "./index";
import { FOCUS_ATTR, button, messageBlock, type ClosingForm, type PanelCtx } from "./view-parts";
import { renderEntries } from "./view-entries";
import type { AppearsInSource } from "./appears-in-widget";
import { renderThreads, workResolver } from "./view-threads";
import { renderUnlinked } from "./view-unlinked";
import { countMissing, renderWorks, totalWords, wordsLabel } from "./view-works";
import { VIEW_TYPES } from "../core/view-types";

export const UNIVERSE_VIEW = VIEW_TYPES.universe;
export const THREADS_VIEW = "escrita-threads";

export type UniverseTab = "entries" | "threads" | "works";

/** how long the panel waits for the indexes to settle before redrawing */
const REFRESH_MS = 150;

/** What both views share: the live refresh, the focus kept across redraws, the context the tabs draw from. */
abstract class PanelBase extends ItemView {
  protected state: PanelState = { tab: "entries", collapsed: [], showClosed: false };
  protected query = "";
  protected closing: ClosingForm | null = null;
  private lastMarkdown: WorkspaceLeaf | null = null;
  private counting = false;
  private schedule = debounce(() => this.render(), REFRESH_MS, true);

  constructor(leaf: WorkspaceLeaf, protected plugin: EscritaPlugin) {
    super(leaf);
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("escrita-universe-view");
    const { workspace } = this.app;
    this.lastMarkdown = workspace.getMostRecentLeaf(workspace.rootSplit)?.view instanceof MarkdownView ? workspace.getMostRecentLeaf(workspace.rootSplit) : null;
    // stay in step with the vault: the module fires after entries, threads, mode or settings change
    this.register(this.plugin.universe.onChange(() => this.schedule()));
    this.registerEvent(workspace.on("active-leaf-change", (leaf) => {
      if (leaf?.view instanceof MarkdownView) this.lastMarkdown = leaf;
      this.schedule();
    }));
    this.registerEvent(workspace.on("file-open", () => this.schedule()));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.schedule()));
    this.register(this.plugin.measure.onChange(() => { if (this.wantsCounts()) this.schedule(); }));
    this.render();
  }

  async onClose(): Promise<void> {
    this.schedule.cancel();
    this.contentEl.empty();
  }

  protected wantsCounts(): boolean { return false; }

  getState(): Record<string, unknown> {
    return { ...super.getState(), tab: this.state.tab, collapsed: this.state.collapsed, showClosed: this.state.showClosed };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    this.state = readPanelState(state);
    await super.setState(state, result);
    if (this.contentEl.isConnected) this.render();
  }

  protected save(): void {
    this.app.workspace.requestSaveLayout();
  }

  protected ctx(scope: Scope): PanelCtx {
    const source: AppearsInSource | null = this.plugin.universe.appearsInSource();
    return {
      counts: source ? (path) => { const a = source.appearsIn(path); return a && a !== "counting" ? a.workCount : null; } : undefined,
      appearsIn: source ? (path) => { const a = source.appearsIn(path); return a === "counting" ? null : a; } : undefined,
      appearsLabels: source?.labels(),
      plugin: this.plugin,
      scope,
      query: this.query,
      collapsed: new Set(this.state.collapsed),
      showClosed: this.state.showClosed,
      closing: this.closing,
      toggleCollapsed: (kind) => {
        this.state.collapsed = toggled(this.state.collapsed, kind);
        this.save();
        this.render();
      },
      toggleClosed: () => {
        this.state.showClosed = !this.state.showClosed;
        this.save();
        this.render();
      },
      openClose: (key) => {
        this.closing = key === null ? null : { key, answer: "", focus: true };
        this.render();
      },
      refresh: () => this.render(),
      lastEditor: () => this.lastEditor(),
    };
  }

  /** Keeps the search text, the close form's answer and focus across a redraw. */
  protected render(): void {
    const el = this.contentEl;
    const active = this.contentEl.doc.activeElement;
    const focusKey = active instanceof HTMLInputElement && el.contains(active) ? active.getAttribute(FOCUS_ATTR) : null;
    const caret = active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null;
    if (focusKey === "search" && active instanceof HTMLInputElement) this.query = active.value;
    if (focusKey === "close" && active instanceof HTMLInputElement && this.closing) this.closing.answer = active.value;
    const scroll = el.scrollTop;
    el.empty();
    this.build(el);
    el.scrollTop = scroll;
    if (focusKey) {
      const input = el.querySelector<HTMLInputElement>(`[${FOCUS_ATTR}="${focusKey}"]`);
      if (input) {
        input.focus();
        if (caret?.[0] != null && caret[1] != null) input.setSelectionRange(caret[0], caret[1]);
      }
    }
  }

  protected abstract build(el: HTMLElement): void;

  /** The editor of the last markdown note the writer had open, when it is in the editing view. */
  private lastEditor(): { editor: Editor; path: string } | null {
    const view = this.lastMarkdown?.view;
    if (!(view instanceof MarkdownView) || !view.file || view.getMode() !== "source") return null;
    return { editor: view.editor, path: view.file.path };
  }

  /** After drawing the Works tab: counts what isn't counted yet, then draws once more. */
  protected countThen(works: Parameters<typeof countMissing>[1], ctx: PanelCtx): void {
    if (this.counting) return;
    this.counting = true;
    void countMissing(ctx, works).then((did) => { if (did) this.schedule(); }).finally(() => { this.counting = false; });
  }
}

/** The universe panel. */
export class UniverseView extends PanelBase {
  /** the tab to show; activateUniverseView sets it before revealing */
  get tab(): UniverseTab { return this.state.tab; }

  private last: Scope | null = null;
  private lastKey: string | null = null;
  private pick: { note: string; at: string | null } | null = null;

  getViewType(): string { return UNIVERSE_VIEW; }
  getDisplayText(): string { return t("universe.view.title"); }
  getIcon(): string { return "globe"; }

  protected wantsCounts(): boolean { return this.state.tab === "works"; }

  /** Show a tab (called by activateUniverseView on an open panel). */
  showTab(tab: UniverseTab): void {
    this.state.tab = tab;
    this.save();
    this.render();
  }

  /** Which scope to show: the active note's; else the last one shown; a hand-picked universe holds until the active note changes universe. */
  private resolve(): { scope: Scope | null; info: UniverseInfo | null; universes: UniverseInfo[] } {
    const u = this.plugin.universe;
    const mode = u.mode();
    const active = u.scopeOfActive();
    if (active !== null) {
      const key = active.kind === "universe" ? active.note : active.kind === "book" && u.mode() === "perBook" ? active.note : null;
      if (!pickStillValid(this.pick, key)) this.pick = null;
      this.lastKey = key;
      // a standalone book in a universe vault has a book scope: the universe panel keeps its universe
      const mine = u.mode() === "universe" ? active.kind === "universe" : active.kind === "book";
      if (mine) this.last = active;
    }
    const universes = mode === "universe" ? u.universes() : [];
    let scope = this.last;
    let info: UniverseInfo | null = null;
    if (mode === "universe") {
      const wanted = this.pick ? universes.find((x) => x.note === this.pick?.note) : undefined;
      info = wanted ?? universes.find((x) => x.note === scope?.note) ?? null;
      if (!info && scope === null) info = universes[0] ?? this.fallbackInfo();
      if (info && (wanted || scope === null || scope.note !== info.note)) {
        scope = { kind: "universe", root: info.root, note: info.note };
      }
    }
    if (mode !== "universe" && scope && scope.kind !== "book") scope = null;
    return { scope, info, universes };
  }

  /** The settings' universe, when nothing else is known (an empty vault). */
  private fallbackInfo(): UniverseInfo {
    const note = universeNotePath(this.plugin.settings.universeNote);
    const name = note.replace(/\.md$/i, "").split("/").pop() ?? note;
    return { note, name, root: universeRootOf(note), exists: this.app.vault.getAbstractFileByPath(note) instanceof TFile, isDefault: true };
  }

  protected build(el: HTMLElement): void {
    const u = this.plugin.universe;
    if (!u.enabled()) {
      messageBlock(el, t("universe.view.off"));
      return;
    }
    const { scope, info, universes } = this.resolve();
    const perBook = u.mode() === "perBook";
    if (!scope) {
      const head = el.createDiv({ cls: "escrita-universe-head" });
      head.createSpan({ cls: "escrita-universe-title", text: t("universe.view.title") });
      if (info && !info.exists) this.noteMissing(el, info);
      else messageBlock(el, t(perBook ? "universe.view.noBook" : "universe.view.empty.entries", { command: t("universe.cmd.createEntry") }));
      return;
    }

    const entries = u.entries(scope);
    const works = perBook ? [] : u.worksIn(scope);
    const threads = u.threads(scope);
    const openThreads = threads.filter((x) => !x.thread.closed).length;
    const closedThreads = threads.length - openThreads;
    const ctx = this.ctx(scope);
    const name = info?.name ?? (scope.note ?? "").replace(/\.md$/i, "").split("/").pop() ?? "";

    const head = el.createDiv({ cls: "escrita-universe-head" });
    if (universes.length > 1) this.picker(head, universes, info, name);
    else head.createSpan({ cls: "escrita-universe-title", text: name });

    // a universe note that isn't there yet, and nothing in the universe: offer to make it
    if (info && !info.exists && entries.length === 0 && works.length === 0) {
      this.noteMissing(el, info);
      return;
    }

    const threadsOn = this.plugin.features.isOn("threads");
    let tab = this.state.tab;
    if (tab === "works" && perBook) tab = "entries";
    if (tab === "threads" && !threadsOn) tab = "entries";
    const sub = head.createSpan({ cls: "escrita-universe-sub" });
    if (tab === "threads") {
      sub.setText(this.state.showClosed && closedThreads > 0
        ? t("universe.view.sub.join", { a: plural("universe.view.count.open", openThreads), b: plural("universe.view.count.closed", closedThreads) })
        : plural("universe.view.count.threadsOpen", openThreads));
    } else if (tab === "works") {
      sub.setText(t("universe.view.sub.join", { a: plural("universe.view.count.works", works.length), b: wordsLabel(totalWords(ctx, works)) }));
    } else if (perBook) {
      sub.setText(t("universe.view.sub.bookEntries", { n: fmt(entries.length) }));
    } else {
      sub.setText(t("universe.view.sub.join", { a: plural("universe.view.count.entries", entries.length), b: plural("universe.view.count.works", works.length) }));
    }

    const tabs = el.createDiv({ cls: "escrita-universe-tabs" });
    tabs.setAttribute("role", "tablist");
    const add = (id: UniverseTab, n: number) => {
      const b = tabs.createEl("button", { cls: id === tab ? "escrita-universe-tab is-active" : "escrita-universe-tab" });
      b.setAttribute("type", "button");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === tab));
      b.createSpan({ text: t(`universe.view.tab.${id}`) });
      if (n > 0) b.createSpan({ cls: "escrita-universe-tab-n", text: fmt(n) });
      b.addEventListener("click", () => this.showTab(id));
    };
    add("entries", 0);
    if (threadsOn) add("threads", openThreads);
    if (!perBook) add("works", works.length);

    // the Entries and Works tabs show counts: start them (Q15); the panel redraws when they are ready
    if (tab === "entries" || tab === "works") this.plugin.universe.demandMentions();

    const body = el.createDiv({ cls: "escrita-universe-body" });
    if (tab === "entries") {
      if (!perBook) this.addToUniverse(body, info);
      else this.notInBook(body);
      renderEntries(body, ctx, entries);
      if (perBook) renderUnlinked(body, ctx);   // D1: no Works tab in per-book mode
    } else if (tab === "threads") {
      renderThreads(body, ctx, threads);
    } else {
      renderWorks(body, ctx, works);
      renderUnlinked(body, ctx);
      this.countThen(works, ctx);
    }
  }

  /** Board 15f: the universe note isn't there. */
  private noteMissing(el: HTMLElement, info: UniverseInfo): void {
    const box = messageBlock(el, t("universe.view.empty.noNote", { path: info.note }));
    button(box, t("universe.view.createNote"), true, () => { void this.createNote(); });
    button(box, t("universe.view.openSettings"), false, () => this.openSettings());
  }

  private async createNote(): Promise<void> {
    try {
      const r = await this.plugin.universe.createUniverseNote();
      if (r.created) new Notice(t("universe.view.noteCreated", { path: r.file.path }));
    } catch (e) {
      console.error("Escrita: couldn't create the universe note", e);
      new Notice(t("universe.view.noteFailed"));
    }
    this.render();
  }

  private openSettings(): void {
    try {
      const setting = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
      setting?.open();
      setting?.openTabById(this.plugin.manifest.id);
    } catch { /* the settings tab is not reachable: nothing to do */ }
  }

  /** Board 15d: the universe picker, only with more than one universe. */
  private picker(head: HTMLElement, universes: UniverseInfo[], info: UniverseInfo | null, name: string): void {
    const b = head.createEl("button", { cls: "escrita-universe-pick" });
    b.setAttribute("type", "button");
    b.setAttribute("aria-haspopup", "menu");
    b.setAttribute("aria-label", t("universe.view.pickUniverse"));
    b.createSpan({ text: name });
    setIcon(b.createSpan({ cls: "escrita-universe-chevron" }), "chevron-down");
    const activeNote = this.lastKey;
    b.addEventListener("click", (evt) => {
      const menu = new Menu();
      for (const x of universes) {
        menu.addItem((i) => i
          .setTitle(x.note === activeNote ? `${x.name} (${t("universe.view.activeNote")})` : x.name)
          .setChecked(x.note === info?.note)
          .onClick(() => {
            this.pick = { note: x.note, at: this.lastKey };
            this.render();
          }));
      }
      menu.showAtMouseEvent(evt);
    });
  }

  /** Board 15g: the active note is a work outside any universe; the button is an explicit click. */
  private addToUniverse(body: HTMLElement, info: UniverseInfo | null): void {
    const file = this.app.workspace.getActiveFile();
    if (!info || !file || file.extension !== "md") return;
    if (this.plugin.universe.scopeOf(file).kind === "universe") return;
    if (this.plugin.universe.keptOut(file)) return;   // `universe: false`: the writer said no
    if (!this.isWorkLike(file)) return;
    const row = body.createDiv({ cls: "escrita-universe-notin" });
    row.createSpan({ cls: "escrita-universe-muted", text: t("universe.view.notInUniverse", { title: file.basename }) });
    button(row, t("universe.view.addTo", { universe: info.name }), false, () => {
      void this.plugin.universe.addToUniverse(file, info).then((wrote) => {
        new Notice(t(wrote ? "universe.view.addedTo" : "universe.view.alreadyIn", { title: file.basename, universe: info.name }));
        this.render();
      }).catch(() => { new Notice(t("universe.view.addFailed")); });
    });
  }

  /** Per-book mode: the active note belongs to no book, so the panel keeps showing the last one. */
  private notInBook(body: HTMLElement): void {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md" || this.plugin.universe.scopeOf(file).kind !== "none" || !this.isWorkLike(file)) return;
    body.createDiv({ cls: "escrita-universe-notin" }).createSpan({ cls: "escrita-universe-muted", text: t("universe.view.notInBook", { title: file.basename }) });
  }

  /** Not a chapter, a template or an entry: a note that could be a work. */
  private isWorkLike(file: TFile): boolean {
    const s = this.plugin.settings;
    if (isTemplatePath(file.path, s)) return false;
    if (this.plugin.universe.entry(file.path)) return false;
    const kind = this.plugin.books.classify(file).kind;
    return kind === "note" || kind === "book-note";
  }
}

/** The Open threads view for mode off (board 16e): the tracked works' threads, no tabs. */
export class ThreadsView extends PanelBase {
  getViewType(): string { return THREADS_VIEW; }
  getDisplayText(): string { return t("universe.view.threadsTitle"); }
  getIcon(): string { return "git-branch"; }

  protected build(el: HTMLElement): void {
    const u = this.plugin.universe;
    // with a mode on, the threads of the active note's scope; off, every tracked work
    const active = u.enabled() ? u.scopeOfActive() : null;
    const scope = active && active.kind !== "none" ? active : NO_SCOPE;
    const threads = u.threads(scope);
    const open = threads.filter((x) => !x.thread.closed);
    const ctx = this.ctx(scope);
    const works = countThreads(threads, workResolver(ctx)).works;
    const head = el.createDiv({ cls: "escrita-universe-head" });
    head.createSpan({ cls: "escrita-universe-title", text: t("universe.view.threadsTitle") });
    head.createSpan({ cls: "escrita-universe-sub", text: t("universe.view.sub.join", { a: plural("universe.view.count.threads", open.length), b: plural("universe.view.count.inWorks", works) }) });
    renderThreads(el.createDiv({ cls: "escrita-universe-body" }), ctx, threads);
  }
}

/** Reveal the universe panel in the right sidebar (creating it if needed) on a tab. */
export async function activateUniverseView(plugin: EscritaPlugin, tab: UniverseTab = "entries"): Promise<void> {
  await reveal(plugin, UNIVERSE_VIEW, (view) => { if (view instanceof UniverseView) view.showTab(tab); });
}

/** Reveal the standalone Open threads view in the right sidebar (creating it if needed). */
export async function activateThreadsView(plugin: EscritaPlugin): Promise<void> {
  await reveal(plugin, THREADS_VIEW, () => undefined);
}

async function reveal(plugin: EscritaPlugin, type: string, after: (view: unknown) => void): Promise<void> {
  const { workspace } = plugin.app;
  let leaf = workspace.getLeavesOfType(type)[0];
  if (!leaf) {
    const right = workspace.getRightLeaf(false);
    if (!right) return;
    await right.setViewState({ type, active: true });
    leaf = right;
  }
  await workspace.revealLeaf(leaf);
  after(leaf.view);
}
