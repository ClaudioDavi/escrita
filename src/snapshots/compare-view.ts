import { ItemView, TFile, WorkspaceLeaf, debounce, moment, setIcon, type ViewStateResult } from "obsidian";
import { fmt, t, unitAmount } from "../i18n";
import type { AnchoredChange } from "../core/note-text";
import { compareTexts, type Block, type Compare, type Part } from "./compare";
import type { SnapshotEntry } from "./index-format";
import type { SnapshotsModule } from "./index";

export const COMPARE_VIEW = "escrita-snapshot-compare";

/** Inline changes, the two texts side by side, or the snapshot's full text alone. */
export type CompareMode = "inline" | "side" | "view";

interface State {
  notePath: string;
  /** the snapshot file */
  a: string;
  /** "current" (the note now) or another snapshot file */
  b: string;
  mode: CompareMode;
}

const MODES: CompareMode[] = ["inline", "side", "view"];
/** Unchanged paragraphs shown around a change; longer unchanged runs collapse. */
const CONTEXT = 1;

type Row = { kind: "block"; block: Block } | { kind: "collapsed"; blocks: Block[] };

/** Main-area tab comparing a snapshot with the note now (or with another snapshot). */
export class CompareView extends ItemView {
  private state: State = { notePath: "", a: "", b: "current", mode: "inline" };
  private renderSeq = 0;
  /** collapsed runs the writer opened, by the offset of their first paragraph */
  private expanded = new Set<string>();
  /** the note text the rendered comparison shows ("Use the old version" refuses when the note differs now) */
  private shown: string | undefined;
  private soon = debounce(() => { void this.refresh(); }, 400, true);

  constructor(leaf: WorkspaceLeaf, private module: SnapshotsModule) {
    super(leaf);
  }

  getViewType(): string {
    return COMPARE_VIEW;
  }

  getDisplayText(): string {
    const f = this.module.noteFile(this.state.notePath);
    return t("snapshots.compare.title", { title: f?.basename ?? this.state.notePath.replace(/\.md$/, "") });
  }

  getIcon(): string {
    return "git-compare";
  }

  notePath(): string {
    return this.state.notePath;
  }

  mode(): CompareMode {
    return this.state.mode;
  }

  getState(): Record<string, unknown> {
    return { ...super.getState(), ...this.state };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = (state ?? {}) as Partial<State>;
    const next: State = {
      notePath: typeof s.notePath === "string" ? s.notePath : this.state.notePath,
      a: typeof s.a === "string" ? s.a : this.state.a,
      b: typeof s.b === "string" && s.b !== "" ? s.b : "current",
      mode: MODES.includes(s.mode as CompareMode) ? (s.mode as CompareMode) : "inline",
    };
    if (next.notePath !== this.state.notePath || next.a !== this.state.a || next.b !== this.state.b) this.expanded.clear();
    this.state = next;
    await super.setState(state, result);
    await this.refresh();
  }

  async onOpen(): Promise<void> {
    const { vault, workspace } = this.app;
    this.contentEl.addClass("escrita-compare");
    this.registerEvent(vault.on("modify", (f) => { if (f.path === this.state.notePath) this.requestRefresh(); }));
    this.registerEvent(workspace.on("editor-change", (_ed, info) => {
      if (this.state.b === "current" && info.file?.path === this.state.notePath) this.requestRefresh();
    }));
    this.registerEvent(vault.on("rename", (f, oldPath) => {
      if (oldPath === this.state.notePath) {
        this.state = { ...this.state, notePath: f.path };
        this.requestRefresh();
      } else if (this.state.notePath.startsWith(`${oldPath}/`)) {
        this.state = { ...this.state, notePath: f.path + this.state.notePath.slice(oldPath.length) };
        this.requestRefresh();
      }
    }));
    this.register(this.module.store.onChange((p) => { if (p === this.state.notePath) this.requestRefresh(); }));
  }

  async onClose(): Promise<void> {
    this.soon.cancel();
    this.contentEl.empty();
  }

  requestRefresh(): void {
    this.soon();
  }

  private setMode(mode: CompareMode): void {
    this.state = { ...this.state, mode };
    this.app.workspace.requestSaveLayout();
    void this.refresh();
  }

  private setAgainst(b: string): void {
    this.state = { ...this.state, b };
    this.expanded.clear();
    this.app.workspace.requestSaveLayout();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const seq = ++this.renderSeq;
    const st = this.state;
    const root = this.contentEl;
    const file = this.module.noteFile(st.notePath);
    if (!file) {
      // a deleted note: its snapshots can still be read (full text only)
      await this.refreshGone(seq);
      return;
    }
    let entries: SnapshotEntry[] = [];
    let old: string;
    let cur = "";
    try {
      entries = await this.module.list(file);
      old = await this.module.readSnapshot(file.path, st.a);
      if (st.mode !== "view") cur = st.b === "current" ? await this.module.currentText(file) : await this.module.readSnapshot(file.path, st.b);
    } catch (e) {
      console.error("Escrita: couldn't read the snapshot to compare", e);
      if (seq === this.renderSeq) this.renderMessage(t("snapshots.notice.missing"));
      return;
    }
    if (seq !== this.renderSeq) return;
    this.shown = st.b === "current" && st.mode !== "view" ? cur : undefined;
    const cmp = st.mode === "view" ? null : compareTexts(old, cur);
    const scroll = root.scrollTop;
    root.empty();
    this.toolbar(root, file, entries);
    if (cmp === null) {
      root.createDiv({ cls: "escrita-compare-full", text: old });
    } else {
      this.summary(root, cmp);
      this.frontmatter(root, file, cmp);
      const body = root.createDiv({ cls: `escrita-compare-body escrita-compare-${st.mode}` });
      for (const row of this.rows(cmp.blocks)) {
        if (row.kind === "collapsed") this.collapsed(body, row.blocks);
        else if (st.mode === "side") this.sideBlock(body, file, row.block);
        else this.inlineBlock(body, file, row.block);
      }
    }
    root.scrollTop = scroll;
  }

  /** The note is gone: one snapshot's full text, a picker for the others, nothing to compare or restore. */
  private async refreshGone(seq: number): Promise<void> {
    const st = this.state;
    let entries: SnapshotEntry[];
    let old: string;
    try {
      entries = await this.module.list(st.notePath);
      if (entries.length === 0) {
        if (seq === this.renderSeq) this.renderMessage(t("snapshots.notice.noteGone"));
        return;
      }
      old = await this.module.readSnapshot(st.notePath, st.a);
    } catch (e) {
      console.error("Escrita: couldn't read the snapshot of a deleted note", e);
      if (seq === this.renderSeq) this.renderMessage(t("snapshots.notice.missing"));
      return;
    }
    if (seq !== this.renderSeq) return;
    this.shown = undefined;
    const root = this.contentEl;
    root.empty();
    const bar = root.createDiv({ cls: "escrita-compare-toolbar" });
    const a = entries.find((e) => e.file === st.a);
    bar.createDiv({ cls: "escrita-compare-heading", text: a ? this.entryText(a) : st.a });
    const controls = bar.createDiv({ cls: "escrita-compare-controls" });
    const label = controls.createEl("label", { cls: "escrita-compare-against" });
    label.createSpan({ text: t("snapshots.compare.pick") });
    const select = label.createEl("select", { cls: "dropdown" });
    for (const e of entries) select.createEl("option", { value: e.file, text: this.entryText(e) });
    select.value = st.a;
    select.addEventListener("change", () => {
      this.state = { ...this.state, a: select.value };
      this.app.workspace.requestSaveLayout();
      void this.refresh();
    });
    root.createDiv({ cls: "escrita-compare-summary", text: t("snapshots.compare.noteGone") });
    root.createDiv({ cls: "escrita-compare-full", text: old });
  }

  private renderMessage(text: string): void {
    this.contentEl.empty();
    this.contentEl.createDiv({ cls: "escrita-compare-empty", text });
  }

  private entryText(e: SnapshotEntry): string {
    const when = e.taken > 0 ? moment(e.taken).format("ll LT") : "";
    return when ? `${this.module.labelOf(e)} · ${when}` : this.module.labelOf(e);
  }

  private toolbar(root: HTMLElement, file: TFile, entries: SnapshotEntry[]): void {
    const st = this.state;
    const bar = root.createDiv({ cls: "escrita-compare-toolbar" });
    const a = entries.find((e) => e.file === st.a);
    bar.createDiv({ cls: "escrita-compare-heading", text: a ? this.entryText(a) : st.a });

    const controls = bar.createDiv({ cls: "escrita-compare-controls" });
    if (st.mode !== "view") {
      const label = controls.createEl("label", { cls: "escrita-compare-against" });
      label.createSpan({ text: t("snapshots.compare.against") });
      const select = label.createEl("select", { cls: "dropdown" });
      select.createEl("option", { value: "current", text: t("snapshots.compare.current") });
      for (const e of entries) {
        if (e.file !== st.a) select.createEl("option", { value: e.file, text: this.entryText(e) });
      }
      select.value = entries.some((e) => e.file === st.b) ? st.b : "current";
      select.addEventListener("change", () => this.setAgainst(select.value));
    }

    const seg = controls.createDiv({ cls: "escrita-compare-modes", attr: { role: "group" } });
    const names: Record<CompareMode, string> = {
      inline: t("snapshots.compare.inline"), side: t("snapshots.compare.side"), view: t("snapshots.compare.view"),
    };
    for (const m of MODES) {
      const b = seg.createEl("button", { text: names[m], attr: { "aria-pressed": String(m === st.mode) } });
      b.toggleClass("is-active", m === st.mode);
      b.addEventListener("click", () => this.setMode(m));
    }

    const refresh = controls.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("snapshots.compare.refresh") } });
    setIcon(refresh, "refresh-cw");
    refresh.addEventListener("click", () => { void this.refresh(); });
    if (a) {
      const restore = controls.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("snapshots.action.restore") } });
      setIcon(restore, "rotate-ccw");
      restore.addEventListener("click", () => { void this.module.restoreAll(file, a); });
    }
  }

  private summary(root: HTMLElement, cmp: Compare): void {
    const line = root.createDiv({ cls: "escrita-compare-summary" });
    const s = cmp.summary;
    const same = cmp.frontmatter === null && cmp.blocks.every((b) => b.kind === "equal");
    line.createSpan({
      text: same ? t("snapshots.compare.identical") : t("snapshots.compare.summary", {
        added: unitAmount("words", s.added), removed: unitAmount("words", s.removed), percent: s.percent,
      }),
    });
    if (cmp.degraded) line.createDiv({ cls: "escrita-compare-degraded", text: t("snapshots.compare.degraded") });
  }

  private canRevert(): boolean {
    return this.state.b === "current";
  }

  private useOld(el: HTMLElement, file: TFile, change: AnchoredChange | null): void {
    const shown = this.shown;
    if (!change || !this.canRevert() || shown === undefined) return;
    const b = el.createEl("button", { cls: "escrita-compare-useold", text: t("snapshots.compare.useOld") });
    b.addEventListener("click", async () => {
      b.disabled = true;
      await this.module.revertBlock(file, change, shown, [this.state.a]);
      await this.refresh();
    });
  }

  private frontmatter(root: HTMLElement, file: TFile, cmp: Compare): void {
    const fm = cmp.frontmatter;
    if (!fm) return;
    const details = root.createEl("details", { cls: "escrita-compare-fm" });
    details.createEl("summary", { text: t("snapshots.compare.frontmatter") });
    const lines = details.createDiv({ cls: "escrita-compare-fm-lines" });
    for (const p of fm.lines) {
      const cls = p.kind === "added" ? "escrita-diff-ins" : p.kind === "removed" ? "escrita-diff-del" : "escrita-diff-eq";
      lines.createEl(p.kind === "added" ? "ins" : p.kind === "removed" ? "del" : "div", { cls: `escrita-compare-fm-line ${cls}`, text: p.text });
    }
    this.useOld(details, file, fm.revert);
  }

  /** Equal blocks far from any change collapse into one button. */
  private rows(blocks: Block[]): Row[] {
    const rows: Row[] = [];
    let i = 0;
    while (i < blocks.length) {
      if (blocks[i].kind !== "equal") {
        rows.push({ kind: "block", block: blocks[i++] });
        continue;
      }
      let j = i;
      while (j < blocks.length && blocks[j].kind === "equal") j++;
      const lead = i > 0 ? CONTEXT : 0;
      const tail = j < blocks.length ? CONTEXT : 0;
      const hidden = blocks.slice(i + lead, j - tail);
      const key = hidden.length ? String(hidden[0].at) : "";
      if (hidden.length < 2 || this.expanded.has(key)) {
        for (let k = i; k < j; k++) rows.push({ kind: "block", block: blocks[k] });
      } else {
        for (let k = i; k < i + lead; k++) rows.push({ kind: "block", block: blocks[k] });
        rows.push({ kind: "collapsed", blocks: hidden });
        for (let k = j - tail; k < j; k++) rows.push({ kind: "block", block: blocks[k] });
      }
      i = j;
    }
    return rows;
  }

  private collapsed(body: HTMLElement, blocks: Block[]): void {
    const b = body.createEl("button", {
      cls: "escrita-compare-collapsed",
      text: t("snapshots.compare.unchanged", { n: fmt(blocks.length) }),
    });
    b.addEventListener("click", () => {
      this.expanded.add(String(blocks[0].at));
      void this.refresh();
    });
  }

  private parts(el: HTMLElement, parts: Part[], keep: (p: Part) => boolean): void {
    for (const p of parts) {
      if (!keep(p)) continue;
      if (p.kind === "added") el.createEl("ins", { cls: "escrita-diff-ins", text: p.text });
      else if (p.kind === "removed") el.createEl("del", { cls: "escrita-diff-del", text: p.text });
      else el.createSpan({ text: p.text });
    }
  }

  private blockEl(body: HTMLElement, b: Block): HTMLElement {
    const el = body.createDiv({ cls: `escrita-compare-block is-${b.kind}` });
    if (b.kind === "moved-in" || b.kind === "moved-out") {
      el.addClass("escrita-diff-moved");
      el.createDiv({ cls: "escrita-compare-moved-label", text: t("snapshots.compare.moved") });
    }
    return el;
  }

  private inlineBlock(body: HTMLElement, file: TFile, b: Block): void {
    const el = this.blockEl(body, b);
    const text = el.createDiv({ cls: "escrita-compare-text" });
    if (b.kind === "equal") text.setText(b.cur?.text ?? "");
    else if (b.kind === "changed") this.parts(text, b.parts, () => true);
    else if (b.kind === "deleted" || b.kind === "moved-out") text.createEl("del", { cls: "escrita-diff-del", text: b.old?.text ?? "" });
    else text.createEl("ins", { cls: "escrita-diff-ins", text: b.cur?.text ?? "" });
    this.useOld(el, file, b.revert);
  }

  private sideBlock(body: HTMLElement, file: TFile, b: Block): void {
    const el = this.blockEl(body, b);
    const grid = el.createDiv({ cls: "escrita-compare-side" });
    const left = grid.createDiv({ cls: "escrita-compare-text escrita-compare-old" });
    const right = grid.createDiv({ cls: "escrita-compare-text escrita-compare-cur" });
    if (b.kind === "equal") {
      left.setText(b.old?.text ?? "");
      right.setText(b.cur?.text ?? "");
    } else if (b.kind === "changed") {
      this.parts(left, b.parts, (p) => p.kind !== "added");
      this.parts(right, b.parts, (p) => p.kind !== "removed");
    } else if (b.kind === "deleted" || b.kind === "moved-out") {
      left.createEl("del", { cls: "escrita-diff-del", text: b.old?.text ?? "" });
    } else {
      right.createEl("ins", { cls: "escrita-diff-ins", text: b.cur?.text ?? "" });
    }
    this.useOld(el, file, b.revert);
  }
}
