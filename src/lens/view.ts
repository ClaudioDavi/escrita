// The revision lens panel (SF 5, task 4.2): measures, one row per rule with step
// buttons, and the empty states. It only reads `LensModule` and draws; stepping,
// ignoring and the settings tab are done by the module (task 5.1) through the
// hooks below.

import { ItemView, MarkdownView, Notice, Platform, TFile, setIcon, type WorkspaceLeaf } from "obsidian";
import type EscritaPlugin from "../main";
import { fmt, lang, plural, t } from "../i18n";
import { EMPTY_TABLE } from "../core/names";
import { enabledRules, newNameGroups, ruleRows } from "./panel-model";
import { formatRate, noteName, positionOf, sharePercent } from "./panel-format";
import { MIN_SENTENCES, MIN_WORDS } from "./readability";
import type { LensLang, Measures, RuleId } from "./types";

export const LENS_VIEW = "escrita-lens";

/** data attribute naming each focusable control, so focus survives a re-render */
const FOCUS_KEY = "data-escrita-focus";

/** What the module wires in (5.1): the view cannot reach these through the 0.1 surface. */
export interface LensViewHooks {
  /** "Ignore here" for the current match of a rule, from the stepped row. */
  ignore?: (rule: RuleId) => void;
  /** Opens Escrita's settings tab (the no-language state). */
  openSettings?: () => void;
}

export class LensView extends ItemView {
  hooks: LensViewHooks = {};
  private stepped: RuleId | null = null;
  private confirming = false;
  private refreshTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: EscritaPlugin) {
    super(leaf);
  }

  getViewType(): string { return LENS_VIEW; }
  getDisplayText(): string { return t("lens.view.title"); }
  getIcon(): string { return "scan-search"; }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("escrita-lens");
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      // the panel's own leaf (a click inside it) or a non-note leaf changes nothing it shows
      if (leaf === this.leaf || !(leaf?.view instanceof MarkdownView)) return;
      this.refresh();
    }));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
    this.render();
  }

  async onClose(): Promise<void> {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.contentEl.empty();
  }

  /** Called by the module on a new result, a dismissal change or a selection change. */
  refresh(): void {
    if (this.refreshTimer !== null) return;
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.render();
    }, 0);
  }

  render(): void {
    const el = this.contentEl;
    const focused = el.querySelector<HTMLElement>(`:focus[${FOCUS_KEY}]`)?.getAttribute(FOCUS_KEY) ?? null;
    el.empty();
    this.build(el);
    if (focused) el.querySelector<HTMLElement>(`[${FOCUS_KEY}="${focused}"]`)?.focus();
  }

  // ---------------------------------------------------------------- building

  private build(el: HTMLElement): void {
    const st = this.plugin.lens.activeState();
    if (st.path === null) {
      this.header(el, null);
      el.createDiv({ cls: "escrita-lens-empty escrita-lens-empty-quiet" }).createSpan({ text: t("lens.empty.notMarkdown") });
      return;
    }
    const path = st.path;
    if (!st.on || !st.result) {
      this.header(el, noteName(path));
      const empty = el.createDiv({ cls: "escrita-lens-empty" });
      empty.createSpan({ text: t("lens.empty.off") });
      const on = empty.createEl("button", { cls: "mod-cta escrita-lens-btn", text: t("lens.empty.turnOn") });
      on.addEventListener("click", () => this.plugin.lens.turnOn(path));
      return;
    }
    const r = st.result;
    this.header(el, plural("lens.view.subtitle", r.words, { name: noteName(path) }));

    const noLang = st.lang === null;
    const m = st.selection ?? r.measures;
    if (noLang) {
      const sec = el.createDiv({ cls: "escrita-lens-section" });
      sec.createSpan({ cls: "escrita-lens-muted", text: t("lens.empty.noLang") });
      const b = sec.createEl("button", { cls: "escrita-lens-btn", text: t("lens.empty.openSettings") });
      b.addEventListener("click", () => this.hooks.openSettings?.());
    }
    this.measures(el, m, st.selection !== null, st.lang);

    const s = this.plugin.settings;
    const rows = ruleRows(r, enabledRules(s.lensRulesOff, s.lensRulesOn), this.plugin.lens.lists(), st.lang, this.plugin.names.hasProvider())
      .filter((row) => row.kind !== "needsLanguage");
    const list = el.createDiv({ cls: "escrita-lens-rules" });
    if (st.selection !== null) list.createDiv({ cls: "escrita-lens-muted escrita-lens-rules-note", text: t("lens.rules.heading") });
    else if (rows.some((row) => row.kind === "on")) list.createDiv({ cls: "escrita-lens-rate-header", text: t("lens.rate.header") });
    const cursor = this.cursorRange(path);
    for (const row of rows) {
      if (row.kind === "on") {
        this.ruleRow(list, row.rule, row.count, row.rate, st.lang, cursor, r.matches);
        if (row.rule === "newName") this.namesList(list, path, r.matches);
      } else this.needRow(list, row.rule, st.lang, st.listsState);
    }

    const n = this.plugin.lens.dismissedCount(path);
    if (n > 0) {
      const foot = el.createDiv({ cls: "escrita-lens-foot" });
      foot.createSpan({ text: plural("lens.ignored", n) + " · " });
      const clear = foot.createEl("button", { cls: "escrita-lens-link", text: t("lens.ignored.clear") });
      clear.setAttribute(FOCUS_KEY, "clear");
      clear.addEventListener("click", () => { this.confirming = true; this.render(); });
      if (this.confirming) this.confirm(el, path, n);
    } else this.confirming = false;
  }

  private header(el: HTMLElement, sub: string | null): void {
    const h = el.createDiv({ cls: "escrita-lens-head" });
    h.createSpan({ cls: "escrita-lens-title", text: t("lens.view.title") });
    if (sub !== null) h.createSpan({ cls: "escrita-lens-sub", text: sub });
  }

  private measures(el: HTMLElement, m: Measures, selection: boolean, lensLang: LensLang | null): void {
    const s = this.plugin.settings;
    if (!s.lensShowDialogue && !(s.lensShowReadability && lensLang)) return;
    const sec = el.createDiv({ cls: "escrita-lens-section" + (selection ? " escrita-lens-selection" : "") });
    if (selection) sec.createSpan({ cls: "escrita-lens-selection-title", text: plural("lens.selection", m.words) });
    if (s.lensShowDialogue) {
      const pct = sharePercent(m.speech, m.words);
      const row = sec.createDiv({ cls: "escrita-lens-line" });
      row.createSpan({ text: t("lens.measure.dialogue") });
      row.createSpan({ cls: "escrita-lens-num", text: `${fmt(pct)}%` });
      const bar = sec.createDiv({ cls: "escrita-lens-bar" });
      bar.createDiv({ cls: "escrita-lens-bar-fill" }).setCssProps({ "--escrita-lens-share": `${pct}%` });
      if (m.scenes.length > 1) {
        const scenes = sec.createDiv({ cls: "escrita-lens-scenes escrita-lens-detail" });
        m.scenes.forEach((sc, i) => {
          const line = scenes.createDiv({ cls: "escrita-lens-line" });
          line.createSpan({ text: t("lens.measure.scene", { n: i + 1 }) });
          line.createSpan({ text: `${fmt(sharePercent(sc.speech, sc.words))}%` });
        });
      }
    }
    if (s.lensShowReadability && lensLang) {
      const rd = m.readability;
      const row = sec.createDiv({ cls: "escrita-lens-line escrita-lens-readability" });
      row.createSpan({ text: t("lens.measure.readability") });
      const val = row.createSpan();
      if (rd) {
        val.createSpan({ cls: "escrita-lens-num", text: fmt(rd.score) });
        val.createSpan({ cls: "escrita-lens-band", text: ` · ${t(`lens.band.${lensLang === "pt-BR" ? "pt" : "en"}.${rd.band}`)}` });
        const key = `lens.band.${lensLang === "pt-BR" ? "pt" : "en"}.${rd.band}.meaning`;
        sec.createSpan({ cls: "escrita-lens-muted escrita-lens-detail", text: t(key) });
        sec.createSpan({
          cls: "escrita-lens-muted escrita-lens-faint escrita-lens-detail",
          text: t("lens.measure.perSentence", { asl: formatRate(rd.asl, lang()), asw: formatRate(rd.asw, lang()) }),
        });
      } else {
        val.setText("—");
        sec.createSpan({ cls: "escrita-lens-muted", text: t("lens.measure.short", { words: MIN_WORDS, sentences: MIN_SENTENCES }) });
      }
    }
  }

  private ruleName(rule: RuleId, lensLang: LensLang | null): string {
    return t(rule === "gerund" && lensLang === "en" ? "lens.rule.gerund.en" : `lens.rule.${rule}`);
  }

  private ruleOne(rule: RuleId, lensLang: LensLang | null): string {
    return t(rule === "gerund" && lensLang === "en" ? "lens.ruleOne.gerund.en" : `lens.ruleOne.${rule}`);
  }

  private ruleRow(
    list: HTMLElement,
    rule: RuleId,
    count: number,
    rate: number,
    lensLang: LensLang | null,
    cursor: { from: number; to: number } | null,
    matches: readonly import("./types").Match[],
  ): void {
    const active = this.stepped === rule;
    const row = list.createDiv({ cls: `escrita-lens-row${active ? " is-stepped" : ""}` });
    row.createSpan({ cls: `escrita-lens-key escrita-lens-key-${rule}` });
    const name = row.createEl("button", { cls: "escrita-lens-rulename", text: this.ruleName(rule, lensLang) });
    name.setAttribute(FOCUS_KEY, `name-${rule}`);
    name.disabled = count === 0;
    name.addEventListener("click", () => this.step(rule, 1, lensLang));
    row.createSpan({ cls: "escrita-lens-count", text: fmt(count) });
    row.createSpan({ cls: "escrita-lens-rate", text: formatRate(rate, lang()) });
    for (const dir of [-1, 1] as const) {
      const b = row.createEl("button", { cls: "escrita-lens-step clickable-icon" });
      setIcon(b, dir === -1 ? "chevron-left" : "chevron-right");
      b.setAttribute("aria-label", t(`lens.step.${dir === -1 ? "prev" : "next"}.${rule}`));
      b.setAttribute(FOCUS_KEY, `${dir === -1 ? "prev" : "next"}-${rule}`);
      b.disabled = count === 0;
      b.addEventListener("click", () => this.step(rule, dir, lensLang));
    }
    if (active && count > 0) {
      const pos = cursor ? positionOf(matches, rule, cursor.from, cursor.to) : null;
      const sub = row.createDiv({ cls: "escrita-lens-substep" });
      const counter = sub.createSpan({ cls: "escrita-lens-counter", text: pos ? t("lens.step.counter", { n: pos.n, of: pos.of }) : "" });
      counter.setAttribute("aria-live", "polite");
      const ig = sub.createEl("button", { cls: "escrita-lens-ignore", text: t("lens.step.ignore") });
      ig.setAttribute(FOCUS_KEY, `ignore-${rule}`);
      ig.disabled = pos === null;
      ig.addEventListener("click", () => this.hooks.ignore?.(rule));
    }
  }

  private needRow(list: HTMLElement, rule: RuleId, lensLang: LensLang | null, listsState: "ok" | "unset" | "missing"): void {
    const row = list.createDiv({ cls: "escrita-lens-row escrita-lens-row-wait" });
    row.createSpan({ cls: `escrita-lens-key escrita-lens-key-${rule} is-dim` });
    row.createSpan({ cls: "escrita-lens-rulename escrita-lens-rulename-dim", text: this.ruleName(rule, lensLang) });
    const hint = row.createDiv({ cls: "escrita-lens-hint" });
    if (rule === "newName") {
      // board 30d: the rule is on but the universe isn't; the link opens Escrita's settings (the Features page)
      hint.createSpan({ text: t("lens.newName.needsUniverse") + " " });
      const b = hint.createEl("button", { cls: "escrita-lens-link", text: t("lens.newName.openFeatures") });
      b.setAttribute(FOCUS_KEY, "features-newName");
      b.addEventListener("click", () => this.hooks.openSettings?.());
    } else if (listsState === "missing") {
      hint.addClass("is-error");
      hint.setText(t("lens.lists.missing", { path: this.plugin.settings.lensListsNote }));
    } else {
      hint.createSpan({ text: t("lens.lists.add") + " " });
      const b = hint.createEl("button", { cls: "escrita-lens-link", text: t("lens.lists.create") });
      b.setAttribute(FOCUS_KEY, `create-${rule}`);
      b.addEventListener("click", () => { void this.plugin.lens.createLists(); });
    }
  }

  /**
   * The names the `newName` rule marked in this note, one item each: how often it is marked and
   * in how many works, with "Create entry" and "Dismiss" (board 30). The cross-work count waits
   * for the names index, which starts the first time the rule runs.
   */
  private namesList(list: HTMLElement, path: string, matches: readonly import("./types").Match[]): void {
    const names = this.plugin.names;
    // a note in no universe gets no options (lens/index.ts): nothing marked, nothing counting
    if (names.tableFor(path) === EMPTY_TABLE) return;
    const ready = names.nameCountsReady();
    const groups = newNameGroups(matches);
    if (ready && groups.length === 0) return;
    const box = list.createDiv({ cls: "escrita-lens-names" });
    box.setAttribute("role", "list");
    box.setAttribute("aria-label", t("lens.newName.list"));
    if (!ready) box.createDiv({ cls: "escrita-lens-muted escrita-lens-names-wait", text: t("lens.newName.counting") });
    groups.forEach((g, i) => {
      const item = box.createDiv({ cls: "escrita-lens-name-item" });
      item.setAttribute("role", "listitem");
      const head = item.createDiv({ cls: "escrita-lens-name-head" });
      // board 30c: a click on the name goes to its next occurrence
      const name = head.createEl("button", { cls: "escrita-lens-name-text", text: g.text });
      name.setAttribute("aria-label", t("lens.newName.next.label", { name: g.text }));
      name.setAttribute(FOCUS_KEY, `next-name-${i}`);
      name.addEventListener("click", () => { this.stepped = "newName"; this.plugin.lens.step("newName", 1, g.key); this.render(); });
      const meta = [plural("lens.newName.inNote", g.count)];
      const works = ready ? names.workCount(g.text, path) : 0;
      if (works > 0) meta.push(plural("lens.newName.inWorks", works));
      head.createSpan({ cls: "escrita-lens-muted escrita-lens-name-meta", text: meta.join(" · ") });
      const actions = item.createDiv({ cls: "escrita-lens-name-actions" });
      const create = actions.createEl("button", { cls: "escrita-lens-btn", text: t("lens.newName.create") });
      create.setAttribute("aria-label", t("lens.newName.create.label", { name: g.text }));
      create.setAttribute(FOCUS_KEY, `create-name-${i}`);
      create.addEventListener("click", () => this.createEntry(path, g.text));
      const dismiss = actions.createEl("button", { cls: "escrita-lens-link escrita-lens-name-dismiss", text: t("lens.newName.dismiss") });
      dismiss.setAttribute("aria-label", t("lens.newName.dismiss.label", { name: g.text }));
      dismiss.setAttribute(FOCUS_KEY, `dismiss-name-${i}`);
      dismiss.addEventListener("click", () => { void this.dismissName(g.text); });
    });
  }

  /** "Create entry": the create-entry modal with the whole run filled in (D8). The note is not touched. */
  private createEntry(path: string, name: string): void {
    this.plugin.names.createEntry(name, path);
  }

  /** "Dismiss": the name goes to "Not names", in every note, with a notice. */
  private async dismissName(name: string): Promise<void> {
    const added = await this.plugin.lens.dismissName(name);
    new Notice(t(added ? "lens.notice.notName" : "lens.notice.notNameAlready", { word: name }));
  }

  private confirm(el: HTMLElement, path: string, n: number): void {
    const box = el.createDiv({ cls: "escrita-lens-confirm" });
    box.setAttribute("role", "alertdialog");
    box.createSpan({ text: plural("lens.confirm", n) });
    const btns = box.createDiv({ cls: "escrita-lens-confirm-buttons" });
    const cancel = btns.createEl("button", { cls: "escrita-lens-btn", text: t("lens.confirm.cancel") });
    cancel.addEventListener("click", () => { this.confirming = false; this.render(); });
    const show = btns.createEl("button", { cls: "mod-cta escrita-lens-btn", text: t("lens.confirm.show") });
    show.setAttribute(FOCUS_KEY, "confirm-show");
    show.addEventListener("click", () => {
      this.confirming = false;
      this.plugin.lens.clearDismissed(path);
      this.render();
    });
    window.setTimeout(() => show.focus(), 0);
  }

  // ---------------------------------------------------------------- actions

  private step(rule: RuleId, dir: 1 | -1, lensLang: LensLang | null): void {
    this.stepped = rule;
    this.plugin.lens.step(rule, dir);
    this.render();
    if (Platform.isPhone) {
      const st = this.plugin.lens.activeState();
      const c = st.path ? this.cursorRange(st.path) : null;
      const pos = st.result && c ? positionOf(st.result.matches, rule, c.from, c.to) : null;
      if (pos) new Notice(t("lens.notice.step", { rule: this.ruleName(rule, lensLang), n: pos.n, of: pos.of }));
    }
  }

  /** The selection of the most recent editor on `path`, as offsets. */
  private cursorRange(path: string): { from: number; to: number } | null {
    const view = this.app.workspace.getMostRecentLeaf()?.view;
    if (!(view instanceof MarkdownView) || view.file?.path !== path) return null;
    const ed = view.editor;
    return { from: ed.posToOffset(ed.getCursor("from")), to: ed.posToOffset(ed.getCursor("to")) };
  }
}
