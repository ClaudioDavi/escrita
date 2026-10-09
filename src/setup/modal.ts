import { Modal, TFolder, type App } from "obsidian";
import type EscritaPlugin from "../main";
import { locale, plural, t } from "../i18n";
import { DEFAULTS_LANGUAGES, languageOf, type DefaultsLanguage } from "../core/defaults";
import { PRESET_IDS, type PresetId } from "../core/feature-presets";
import type { UniverseMode } from "../universe/settings";
import { performSetup } from "./apply";
import {
  initialChoices, planCounts, planFor, presetCount, previewGroups, reasonFor, tickOn, valueText,
  type PreviewGroup, type PreviewRow,
} from "./model";
import type { SetupChoices, SetupItem, SetupLayout, SetupTick, SetupTicks, SetupVault, SetupWrites } from "./plan";

const WRITES: SetupWrites[] = ["stories", "books", "both"];
const WORLDS: UniverseMode[] = ["off", "perBook", "universe"];
const LAYOUTS: SetupLayout[] = ["desk", "focus"];

/** What the vault holds when the preview opens (read once per visit to step 2). */
function readVault(plugin: EscritaPlugin): SetupVault {
  const { vault, workspace } = plugin.app;
  const folders: string[] = [];
  for (const f of vault.getAllLoadedFiles()) if (f instanceof TFolder && f.path !== "/" && f.path !== "") folders.push(f.path);
  const files = vault.getFiles();
  const noteCounts: Record<string, number> = {};
  for (const f of files) {
    if (f.extension !== "md") continue;
    for (let i = f.path.indexOf("/"); i > 0; i = f.path.indexOf("/", i + 1)) {
      const dir = f.path.slice(0, i);
      noteCounts[dir] = (noteCounts[dir] ?? 0) + 1;
    }
  }
  // Only the writer's main-area tabs that hold something: a fresh vault opens with sidebar
  // panels and an empty tab, and those are not the writer's work.
  let openLeaves = 0;
  workspace.iterateRootLeaves((leaf) => { if (leaf.getViewState().type !== "empty") openLeaves += 1; });
  const hasWorks = plugin.works.list()[Symbol.iterator]().next().done === false;
  return { folders, files: files.map((f) => f.path), noteCounts, openLeaves, hasWorks };
}

/**
 * "Set up a writing vault" (boards 35 and 36): step 1 asks, step 2 lists what `planSetup`
 * found with a tick per row, "Create" runs exactly that list. The plan is made again whenever
 * a choice or a tick changes (Wave 1b: the language tick moves the example chapters' folder).
 * Nothing is written before "Create".
 */
export class SetupModal extends Modal {
  private step: 1 | 2 = 1;
  private choices: SetupChoices;
  private ticks: SetupTicks = {};
  private vault: SetupVault | null = null;
  private running = false;

  constructor(app: App, private readonly plugin: EscritaPlugin) {
    super(app);
    this.choices = initialChoices(languageOf(locale()));
  }

  onOpen(): void {
    this.modalEl.addClass("escrita-setup-modal");
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private plan(): SetupItem[] {
    this.vault ??= readVault(this.plugin);
    return planFor(this.choices, this.vault, this.plugin.settings, this.ticks);
  }

  private render(focus?: string): void {
    const el = this.contentEl;
    const scroller = el.querySelector<HTMLElement>(".escrita-setup-scroll");
    const top = scroller?.scrollTop ?? 0;
    el.empty();
    el.addClass("escrita-setup");
    this.setTitle(t("setup.title"));
    const steps = el.createDiv({ cls: "escrita-setup-steps" });
    steps.createSpan({ text: t("setup.step.one"), cls: this.step === 1 ? "is-on" : "" });
    steps.createSpan({ text: "›" });
    steps.createSpan({ text: t("setup.step.two"), cls: this.step === 2 ? "is-on" : "" });
    if (this.step === 1) this.renderChoices(el);
    else this.renderPreview(el);
    const next = el.querySelector<HTMLElement>(".escrita-setup-scroll");
    if (next) next.scrollTop = top;
    if (focus) el.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus();
  }

  // ── step 1 ──

  private renderChoices(el: HTMLElement): void {
    const c = this.choices;
    const field = (label: string): HTMLElement => {
      const f = el.createDiv({ cls: "escrita-setup-field" });
      f.createDiv({ text: label, cls: "escrita-setup-label" });
      return f;
    };

    const writes = field(t("setup.writes.q")).createDiv({ cls: "escrita-setup-seg" });
    for (const w of WRITES) {
      this.chip(writes, t(`setup.writes.${w}`), c.writes === w, `writes-${w}`, () => { c.writes = w; this.render(`writes-${w}`); });
    }

    const lang = field(t("setup.language.q"));
    const select = lang.createEl("select", { cls: "dropdown escrita-setup-select" });
    for (const l of DEFAULTS_LANGUAGES) {
      const o = select.createEl("option", { text: t(`setup.language.${l}`), value: l });
      o.selected = c.language === l;
    }
    select.addEventListener("change", () => { c.language = select.value as DefaultsLanguage; this.render("language"); });
    select.dataset.focus = "language";
    lang.createDiv({ text: t("setup.language.hint"), cls: "escrita-setup-hint" });

    const presets = field(t("setup.preset.q")).createDiv({ cls: "escrita-setup-cards" });
    for (const p of PRESET_IDS) {
      const card = this.card(presets, t(`setup.preset.${p}`), t(`setup.preset.${p}.text`, { n: presetCount(p) }), c.preset === p, `preset-${p}`);
      card.addEventListener("click", () => { c.preset = p; this.render(`preset-${p}`); });
    }
    el.createDiv({ text: t("setup.preset.hint"), cls: "escrita-setup-hint" });

    // "Shared world" changes folders, so it is its own question, asked only with Everything.
    if (c.preset === "everything") {
      const world = field(t("setup.world.q"));
      const seg = world.createDiv({ cls: "escrita-setup-seg" });
      for (const w of WORLDS) {
        this.chip(seg, t(`setup.world.${w}`), c.universeMode === w, `world-${w}`, () => {
          c.universeMode = c.universeMode === w ? null : w;
          this.render(`world-${w}`);
        });
      }
      world.createDiv({ text: t("setup.world.hint"), cls: "escrita-setup-hint" });
    }

    const buttons = el.createDiv({ cls: "escrita-setup-buttons" });
    this.button(buttons, t("setup.btn.cancel"), () => this.close());
    this.button(buttons, t("setup.btn.preview"), () => { this.vault = null; this.step = 2; this.render("create"); }, true);
  }

  // ── step 2 ──

  private renderPreview(el: HTMLElement): void {
    const items = this.plan();
    const counts = planCounts(items, this.ticks);
    const groups = previewGroups(items, this.ticks, (i) => this.labelOf(i), (i) => this.valueOf(i));
    el.createDiv({ text: t("setup.preview.title"), cls: "escrita-setup-heading" });
    const scroll = el.createDiv({ cls: "escrita-setup-scroll" });
    for (const g of groups) this.renderGroup(scroll, g, items);

    const summary = el.createDiv({ cls: "escrita-setup-summary" });
    if (counts.available === 0) summary.setText(t("setup.summary.nothing"));
    else if (counts.items + counts.settings === 0 && !items.some((i) => i.kind === "layout" && this.isOn(i))) summary.setText(t("setup.summary.noneTicked"));
    else {
      summary.createDiv({ text: t("setup.summary.note") });
      summary.createDiv({ text: t("setup.summary.count", { items: plural("setup.summary.items", counts.items), settings: plural("setup.summary.settings", counts.settings) }) });
    }

    const buttons = el.createDiv({ cls: "escrita-setup-buttons" });
    this.button(buttons, t("setup.btn.back"), () => { this.step = 1; this.render(); });
    if (counts.available === 0) {
      this.button(buttons, t("setup.btn.close"), () => this.close(), true, "create");
      return;
    }
    this.button(buttons, t("setup.btn.cancel"), () => this.close());
    const canRun = items.some((i) => this.isOn(i));
    const create = this.button(buttons, t("setup.btn.create"), () => { void this.create(items); }, true, "create");
    create.disabled = !canRun || this.running;
  }

  private isOn(item: SetupItem): boolean {
    return tickOn(item, this.ticks);
  }

  private renderGroup(parent: HTMLElement, g: PreviewGroup, items: readonly SetupItem[]): void {
    parent.createDiv({ text: t(`setup.group.${g.kind}`), cls: "escrita-setup-group" });
    for (const row of g.rows) this.renderRow(parent, row);
    if (g.kind === "layout") this.renderScreens(parent, items);
  }

  private renderRow(parent: HTMLElement, row: PreviewRow): void {
    const el = parent.createDiv({ cls: "escrita-setup-row" });
    if (!row.on && row.item.state !== "kept") el.addClass("is-off");
    const lead = el.createDiv({ cls: "escrita-setup-lead" });
    if (row.box) {
      const tick = row.box;
      const box = lead.createEl("button", { cls: "escrita-setup-ck", attr: { role: "checkbox", "aria-checked": String(row.on), "aria-label": t("setup.tick", { name: row.label }) } });
      box.dataset.focus = `tick-${tick}`;
      box.createSpan({ cls: row.on ? "escrita-setup-box is-on" : "escrita-setup-box" });
      box.addEventListener("click", () => this.flip(tick, row.on));
    } else {
      const label = row.mark === "+" ? "setup.mark.new" : row.mark === "=" ? "setup.mark.kept" : "setup.mark.setting";
      lead.createSpan({ text: row.mark, cls: "escrita-setup-mark", attr: { "aria-label": t(label), title: t(label) } });
    }
    const body = el.createDiv({ cls: "escrita-setup-body" });
    const line = body.createDiv({ cls: "escrita-setup-line" });
    line.createSpan({ text: row.label, cls: row.item.kind === "setting" || row.item.kind === "features" ? "" : "escrita-setup-path" });
    if (row.item.kind === "example" && row.item.content !== undefined) line.createSpan({ text: t("setup.pill.example"), cls: "escrita-setup-pill is-example" });
    if (row.item.state === "kept" && row.item.kind !== "setting") line.createSpan({ text: t("setup.pill.kept"), cls: "escrita-setup-pill" });
    if (row.value) body.createDiv({ text: row.value, cls: "escrita-setup-value" });
    body.createDiv({ text: this.reasonOf(row.item, row.on), cls: "escrita-setup-reason" });
  }

  /** The layout cards (board 37), shown while the layout row is ticked. */
  private renderScreens(parent: HTMLElement, items: readonly SetupItem[]): void {
    const layout = items.find((i) => i.kind === "layout");
    if (!layout || !this.isOn(layout)) return;
    const box = parent.createDiv({ cls: "escrita-setup-screens" });
    box.createDiv({ text: t("setup.screen.title"), cls: "escrita-setup-label" });
    box.createDiv({ text: t("setup.screen.hint"), cls: "escrita-setup-hint" });
    const cards = box.createDiv({ cls: "escrita-setup-cards" });
    const universe = this.choices.preset === "everything" ? t("setup.screen.desk.universe") : "";
    for (const l of LAYOUTS) {
      const text = l === "desk" ? t("setup.screen.desk.text", { universe }) : t("setup.screen.focus.text");
      const card = this.card(cards, t(`setup.screen.${l}`), text, this.choices.layout === l, `screen-${l}`);
      card.addEventListener("click", () => { this.choices.layout = l; this.render(`screen-${l}`); });
    }
  }

  private flip(tick: SetupTick, on: boolean): void {
    this.ticks = { ...this.ticks, [tick]: !on };
    this.render(`tick-${tick}`);
  }

  private async create(items: readonly SetupItem[]): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.render("create");
    try {
      await performSetup(this.plugin, items, this.ticks);
    } finally {
      this.running = false;
      this.close();
    }
  }

  // ── words ──

  private labelOf(item: SetupItem): string {
    switch (item.kind) {
      case "folder": case "example": case "home": case "universe": return item.target;
      case "features": return t("setup.setting.features");
      case "layout": return t("setup.setting.layout");
      default: return t(`setup.setting.${item.target}`);
    }
  }

  private valueOf(item: SetupItem): string {
    if (item.kind === "features") {
      return t("setup.preset.count", { preset: t(`setup.preset.${this.choices.preset}`), n: presetCount(this.choices.preset) });
    }
    if (item.kind !== "setting") return "";
    if (item.target === "defaultsLanguage") return t(`setup.language.${String(item.value)}`);
    if (item.target === "universeMode") return t(`setup.world.${String(item.value)}`);
    if (typeof item.value === "boolean") return "";
    return valueText(item.value);
  }

  private reasonOf(item: SetupItem, on: boolean): string {
    const reason = reasonFor(item, on);
    const vars: Record<string, string | number> = { ...reason.vars };
    // the plan gives the preset's id; the writer reads its name
    if (typeof vars.preset === "string") vars.preset = t(`setup.preset.${vars.preset as PresetId}`);
    return t(reason.key, vars);
  }

  // ── controls ──

  private chip(parent: HTMLElement, text: string, on: boolean, focus: string, cb: () => void): void {
    const b = parent.createEl("button", { text, cls: on ? "escrita-setup-chip is-on" : "escrita-setup-chip", attr: { "aria-pressed": String(on) } });
    b.dataset.focus = focus;
    b.addEventListener("click", cb);
  }

  private card(parent: HTMLElement, title: string, text: string, on: boolean, focus: string): HTMLElement {
    const b = parent.createEl("button", { cls: on ? "escrita-setup-card is-on" : "escrita-setup-card", attr: { "aria-pressed": String(on) } });
    b.dataset.focus = focus;
    b.createEl("b", { text: title });
    b.createSpan({ text });
    return b;
  }

  private button(parent: HTMLElement, text: string, cb: () => void, cta = false, focus?: string): HTMLButtonElement {
    const b = parent.createEl("button", { text, cls: cta ? "mod-cta" : "" });
    if (focus) b.dataset.focus = focus;
    b.addEventListener("click", cb);
    return b;
  }
}
