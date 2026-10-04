// The outline header's parts (0.7 plan 4.3, board OutlinePov): the Status/POV toggle, the
// summary, the stage and POV chips, the filtered line and the POV colour menu. The model
// functions are pure; the render functions draw into a host element the view owns.

import { Component } from "obsidian";
import { fmt, plural, t } from "../i18n";
import type { StageMapping } from "../core/stages";
import { POV_PALETTE, statusTally, type PovColor, type RowFilter, type TallyItem } from "./pov";
import type { ChapterRow } from "./rows";

export type ColorBy = "status" | "pov";

export interface ChipModel {
  /** a stage id or "other:<word>" for stage chips; the POV key for POV chips */
  key: string;
  label: string;
  /** a CSS colour or variable for the dot; null draws none */
  color: string | null;
  /** the POV's note (or entry), for "Open the entry"; null for stages and plain-text POVs */
  path: string | null;
}

export interface HeaderModel {
  tally: TallyItem[];
  stages: ChipModel[];
  povs: ChipModel[];
}

/** The CSS colour of a palette name: an Obsidian variable, so themes and dark mode work. */
export function povCss(color: PovColor): string {
  return `var(--color-${color})`;
}

/** Q44/Q45: one chip per stage present (and per unknown status word), one per POV; the tally in stage order. */
export function headerModel(
  rows: readonly ChapterRow[], stages: StageMapping,
  colorOfStatus: (word: string) => string | undefined,
  povColors: Readonly<Record<string, PovColor>>,
): HeaderModel {
  const tally = statusTally(rows, stages);
  const stageChips: ChipModel[] = [];
  for (const it of tally) {
    if (!it.word) continue;   // "no status" is counted, not a chip
    const key = it.stage ?? `other:${it.word.trim().toLowerCase()}`;
    stageChips.push({ key, label: it.word, color: colorOfStatus(it.word) ?? null, path: null });
  }
  const povs: ChipModel[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.pov || seen.has(r.pov.key)) continue;
    seen.add(r.pov.key);
    const c = Object.prototype.hasOwnProperty.call(povColors, r.pov.key) ? povColors[r.pov.key] : null;
    povs.push({ key: r.pov.key, label: r.pov.label, color: c ? povCss(c) : null, path: r.pov.path });
  }
  return { tally, stages: stageChips, povs };
}

/** "6 chapters · 2 revision · 3 draft · 1 idea" */
export function summaryText(chapters: number, tally: readonly TallyItem[]): string {
  const parts = [plural("outline.chapters", chapters)];
  for (const it of tally) parts.push(`${fmt(it.n)} ${it.word || t("outline.noStatus")}`);
  return parts.join(" · ");
}

/** Filter keys that no chip offers any more (a stage or POV that left the book) drop out. True when something dropped. */
export function pruneFilter(model: HeaderModel, filter: { stages: Set<string>; povs: Set<string> }): boolean {
  const stages = new Set(model.stages.map((c) => c.key));
  const povs = new Set(model.povs.map((c) => c.key));
  let changed = false;
  for (const k of [...filter.stages]) if (!stages.has(k)) { filter.stages.delete(k); changed = true; }
  for (const k of [...filter.povs]) if (!povs.has(k)) { filter.povs.delete(k); changed = true; }
  return changed;
}

/** POV chips shown before "+N" (the narrow sidebar); selected ones always show. */
export const POV_CHIPS_VISIBLE = 4;

export function visiblePovChips(povs: readonly ChipModel[], selected: ReadonlySet<string>, expanded: boolean): ChipModel[] {
  if (expanded || povs.length <= POV_CHIPS_VISIBLE) return [...povs];
  return povs.filter((c, i) => i < POV_CHIPS_VISIBLE || selected.has(c.key));
}

// ------------------------------------------------------------------ drawing

/** The Status | POV segmented control, drawn into the header's tools. */
export function renderColorToggle(tools: HTMLElement, mode: ColorBy, set: (m: ColorBy) => void): void {
  const seg = tools.createDiv({ cls: "escrita-outline-seg", attr: { role: "group", "aria-label": t("outline.colorBy") } });
  for (const m of ["status", "pov"] as const) {
    const b = seg.createEl("button", { cls: "escrita-outline-seg-btn", text: t(`outline.colorBy.${m}`) });
    b.toggleClass("is-on", mode === m);
    b.setAttr("aria-pressed", mode === m ? "true" : "false");
    b.addEventListener("click", () => { if (mode !== m) set(m); });
  }
}

export interface ChipsInput {
  model: HeaderModel;
  filter: RowFilter;
  povExpanded: boolean;
  shown: number;
  total: number;
}

export interface ChipsActions {
  toggle(group: "stages" | "povs", key: string): void;
  clear(): void;
  togglePovExpanded(): void;
  povMenu(anchor: HTMLElement, chip: ChipModel): void;
}

const LONG_PRESS_MS = 500;

/** The stage chips, the POV chips and, while a filter is on, the "Showing 4 of 12" line. */
export function renderChips(host: HTMLElement, v: ChipsInput, a: ChipsActions): void {
  host.empty();
  const chip = (group: HTMLElement, c: ChipModel, on: boolean) => {
    const b = group.createEl("button", { cls: "escrita-outline-chip" });
    b.toggleClass("is-on", on);
    b.setAttr("aria-pressed", on ? "true" : "false");
    if (c.color) {
      const dot = b.createSpan({ cls: "escrita-outline-dot", attr: { "aria-hidden": "true" } });
      dot.setCssProps({ "--escrita-dot": c.color });
    }
    b.createSpan({ text: c.label });
    return b;
  };

  if (v.model.stages.length) {
    const g = host.createDiv({ cls: "escrita-outline-chips", attr: { role: "group", "aria-label": t("outline.chips.stages") } });
    for (const c of v.model.stages) {
      chip(g, c, v.filter.stages.has(c.key)).addEventListener("click", () => a.toggle("stages", c.key));
    }
  }

  if (v.model.povs.length) {
    const g = host.createDiv({ cls: "escrita-outline-chips", attr: { role: "group", "aria-label": t("outline.chips.povs") } });
    const shown = visiblePovChips(v.model.povs, v.filter.povs, v.povExpanded);
    for (const c of shown) {
      const b = chip(g, c, v.filter.povs.has(c.key));
      let pressed = false;
      let timer: number | null = null;
      const cancel = () => { if (timer !== null) { b.win.clearTimeout(timer); timer = null; } };
      b.addEventListener("click", (e) => {
        if (pressed) { pressed = false; e.preventDefault(); return; }
        a.toggle("povs", c.key);
      });
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); cancel(); a.povMenu(b, c); });
      // touch: a long press opens the menu (no right click on a phone)
      b.addEventListener("touchstart", () => {
        cancel();
        timer = b.win.setTimeout(() => { timer = null; pressed = true; a.povMenu(b, c); }, LONG_PRESS_MS);
      }, { passive: true });
      for (const ev of ["touchend", "touchmove", "touchcancel"]) b.addEventListener(ev, cancel, { passive: true });
    }
    const hidden = v.model.povs.length - shown.length;
    if (hidden > 0 || (v.povExpanded && v.model.povs.length > POV_CHIPS_VISIBLE)) {
      const more = g.createEl("button", {
        cls: "escrita-outline-chip is-more",
        text: hidden > 0 ? t("outline.chips.more", { n: fmt(hidden) }) : t("outline.chips.less"),
      });
      more.setAttr("aria-expanded", v.povExpanded ? "true" : "false");
      more.addEventListener("click", () => a.togglePovExpanded());
    }
  }

  if (v.filter.stages.size || v.filter.povs.size) {
    const line = host.createDiv({ cls: "escrita-outline-filtered", attr: { role: "status" } });
    line.createSpan({ text: t("outline.filter.showing", { shown: fmt(v.shown), total: fmt(v.total) }) });
    const clear = line.createEl("button", { cls: "escrita-outline-link", text: t("outline.filter.clear") });
    clear.addEventListener("click", () => a.clear());
  }
}

/**
 * The colour menu of a POV chip: eight swatches and, for a POV that names a note or an
 * entry, "Open the entry". `owner` holds its listeners, so they go when the menu closes.
 */
export function showPovMenu(
  owner: Component, anchor: HTMLElement, chip: ChipModel, current: PovColor | null,
  pick: (color: PovColor) => void, openEntry: (() => void) | null,
): () => void {
  const doc = anchor.doc;
  const menu = doc.body.createDiv({ cls: "escrita-outline-menu", attr: { role: "menu" } });
  const scope = new Component();
  owner.addChild(scope);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    owner.removeChild(scope);
    menu.remove();
    if (anchor.isConnected) anchor.focus();
  };
  menu.createDiv({ cls: "escrita-outline-menu-title", text: t("outline.menu.colorOf", { name: chip.label }) });
  const grid = menu.createDiv({ cls: "escrita-outline-swatches" });
  let first: HTMLElement | null = null;
  for (const c of POV_PALETTE) {
    const b = grid.createEl("button", {
      cls: "escrita-outline-swatch",
      attr: { role: "menuitemradio", "aria-label": t(`outline.color.${c}`), "aria-checked": c === current ? "true" : "false" },
    });
    b.toggleClass("is-selected", c === current);
    b.setCssProps({ "--escrita-swatch": povCss(c) });
    b.addEventListener("click", () => { close(); pick(c); });
    first ??= b;
  }
  if (openEntry) {
    const open = menu.createEl("button", { cls: "escrita-outline-menu-item", text: t("outline.menu.openEntry"), attr: { role: "menuitem" } });
    open.addEventListener("click", () => { close(); openEntry(); });
  }
  // below the chip, kept inside the window
  const r = anchor.getBoundingClientRect();
  const win = doc.defaultView;
  const w = menu.offsetWidth || 230;
  const left = Math.max(8, Math.min(r.left, (win?.innerWidth ?? r.left + w) - w - 8));
  menu.setCssProps({ left: `${Math.round(left)}px`, top: `${Math.round(r.bottom + 4)}px` });
  scope.registerDomEvent(doc, "pointerdown", (e) => { if (!menu.contains(e.target as Node)) close(); }, true);
  scope.registerDomEvent(doc, "keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } });
  first?.focus();
  return close;
}
