// The outline header's parts (0.7 plan 4.3, board OutlinePov): the Status/POV toggle, the
// summary, the stage and POV chips, the filtered line and the POV colour menu. The model
// functions are pure; the render functions draw into a host element the view owns.

import { Component, moment, setIcon } from "obsidian";
import { fmt, lang, plural, t } from "../i18n";
import type { SerialLine } from "../publish/serial";
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

/**
 * POV chips shown before "+N" when the width cannot be measured (a hidden pane, a test);
 * with a width, fitPovChips decides. Selected ones always show.
 */
export const POV_CHIPS_VISIBLE = 4;

export function visiblePovChips(povs: readonly ChipModel[], selected: ReadonlySet<string>, expanded: boolean): ChipModel[] {
  if (expanded || povs.length <= POV_CHIPS_VISIBLE) return [...povs];
  return povs.filter((c, i) => i < POV_CHIPS_VISIBLE || selected.has(c.key));
}

// ------------------------------------------------------------------ drawing

interface FitInput {
  group: HTMLElement;
  chips: HTMLElement[];
  more: HTMLElement;
  keys: string[];
  selected: ReadonlySet<string>;
  expanded: boolean;
  /** which chips show when the width cannot be measured */
  fallback: ReadonlySet<string>;
}

/**
 * Collapses the POV chips to "+N" by the room the group has (Q44, board OutlinePov d): what
 * wraps onto a second row hides, except the selected chips. Re-run when the width changes.
 */
export function fitPovChips(f: FitInput): void {
  const setHidden = (i: number, hide: boolean) => f.chips[i].toggleClass("is-fit-hidden", hide);
  const label = (hidden: number) => {
    f.more.setText(hidden > 0 ? t("outline.chips.more", { n: fmt(hidden) }) : t("outline.chips.less"));
    f.more.setAttr("aria-expanded", f.expanded ? "true" : "false");
  };
  const show = (on: boolean) => f.more.toggleClass("is-fit-hidden", !on);
  f.chips.forEach((_, i) => setHidden(i, false));
  show(false);
  if (f.group.clientWidth === 0) {
    // not laid out: the fixed cap
    const hidden = f.keys.filter((k) => !f.fallback.has(k)).length;
    f.keys.forEach((k, i) => setHidden(i, !f.fallback.has(k)));
    show(hidden > 0 || (f.expanded && f.keys.length > POV_CHIPS_VISIBLE));
    label(hidden);
    return;
  }
  const row = f.chips[0]?.offsetTop ?? 0;
  const overflow = f.chips.filter((c) => c.offsetTop > row).length;
  if (overflow === 0) return;
  if (f.expanded) {
    show(true);
    label(0);
    return;
  }
  show(true);
  const hideable = f.keys.map((k, i) => i).filter((i) => !f.selected.has(f.keys[i]));
  let hidden = 0;
  // hide from the end until nothing wraps, the "+N" button included
  while (hidden < hideable.length) {
    label(hidden);
    const wraps = f.chips.some((c, i) => !c.hasClass("is-fit-hidden") && c.offsetTop > row) || f.more.offsetTop > row;
    if (!wraps) break;
    setHidden(hideable[hideable.length - 1 - hidden], true);
    hidden++;
  }
  label(hidden);
  if (hidden === 0) show(false);
}

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
  /** a phone: the filtered line drops its explanation */
  compact?: boolean;
}

export interface ChipsActions {
  toggle(group: "stages" | "povs", key: string): void;
  clear(): void;
  togglePovExpanded(): void;
  povMenu(anchor: HTMLElement, chip: ChipModel): void;
}

const LONG_PRESS_MS = 500;

/** The stage chips, the POV chips and, while a filter is on, the "Showing 4 of 12" line. */
export function renderChips(host: HTMLElement, v: ChipsInput, a: ChipsActions): () => void {
  host.empty();
  let refit: () => void = () => {};
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
    const fallback = new Set(visiblePovChips(v.model.povs, v.filter.povs, v.povExpanded).map((c) => c.key));
    const chips: HTMLElement[] = [];
    for (const c of v.model.povs) {
      const b = chip(g, c, v.filter.povs.has(c.key));
      chips.push(b);
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
    const more = g.createEl("button", { cls: "escrita-outline-chip is-more" });
    more.addEventListener("click", () => a.togglePovExpanded());
    refit = () => fitPovChips({
      group: g, chips, more, keys: v.model.povs.map((c) => c.key), selected: v.filter.povs,
      expanded: v.povExpanded, fallback,
    });
    refit();
  }

  if (v.filter.stages.size || v.filter.povs.size) {
    const line = host.createDiv({ cls: "escrita-outline-filtered", attr: { role: "status" } });
    line.createSpan({ text: t(v.compact ? "outline.filter.showing.short" : "outline.filter.showing", { shown: fmt(v.shown), total: fmt(v.total) }) });
    const clear = line.createEl("button", { cls: "escrita-outline-link", text: t("outline.filter.clear") });
    clear.addEventListener("click", () => a.clear());
  }
  return () => refit();
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

// ------------------------------------------------------------------ serial line (0.9, N 4)

/** "30 set" / "Sep 30" for a YYYY-MM-DD date; anything else as written (D5: a future date too). */
export function serialDateText(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const m = moment(date, "YYYY-MM-DD", true);
  return m.isValid() ? m.format(lang() === "pt-BR" ? "D MMM" : "MMM D") : date;
}

/** The serial line's parts, as text: "Gap: 04", "Next: 04 A escada", "last published 30 Sep" (the gap first, board 32b). */
export function serialParts(line: SerialLine): { text: string; gap: boolean }[] {
  const parts: { text: string; gap: boolean }[] = [];
  if (line.gaps.length) {
    parts.push({ text: plural("outline.serial.gap", line.gaps.length, { chapters: line.gaps.join(", ") }), gap: true });
  }
  parts.push({
    text: line.next ? t("outline.serial.next", { chapter: line.next }) : t("outline.serial.allDone"),
    gap: false,
  });
  parts.push({
    text: line.last.date !== null
      ? t("outline.serial.lastDate", { date: serialDateText(line.last.date) })
      : t("outline.serial.lastTitle", { chapter: line.last.label }),
    gap: false,
  });
  return parts;
}

/** One line under the summary; drawn only when a chapter is published (the line is null otherwise). */
export function renderSerialLine(host: HTMLElement, line: SerialLine | null): void {
  host.empty();
  host.toggleClass("is-hidden", !line);
  if (!line) return;
  host.setAttr("aria-label", t("outline.serial.line"));
  serialParts(line).forEach((p, i) => {
    if (i > 0) host.createSpan({ cls: "escrita-outline-serial-sep", text: " · ", attr: { "aria-hidden": "true" } });
    host.createSpan({ cls: p.gap ? "escrita-outline-serial-gap" : "escrita-outline-serial-part", text: p.text });
  });
}

/** The header's action row: "Publish next" when there is a chapter to publish, and "Read the book" (0.9, N 8). */
export function renderHeaderActions(host: HTMLElement, a: { publishNext: (() => void) | null; readBook?: (() => void) | null }): void {
  host.empty();
  const read = a.readBook ?? null;
  host.toggleClass("is-hidden", !a.publishNext && !read);
  if (a.publishNext) {
    const go = a.publishNext;
    const b = host.createEl("button", { cls: "escrita-outline-action", attr: { "aria-label": t("outline.serial.publishNextTip") } });
    setIcon(b.createSpan({ cls: "escrita-outline-action-icon", attr: { "aria-hidden": "true" } }), "send");
    b.createSpan({ text: t("outline.serial.publishNext") });
    b.addEventListener("click", go);
  }
  if (read) {
    const b = host.createEl("button", { cls: "escrita-outline-action", attr: { "aria-label": t("outline.reader.readBookTip") } });
    setIcon(b.createSpan({ cls: "escrita-outline-action-icon", attr: { "aria-hidden": "true" } }), "book-open");
    b.createSpan({ text: t("outline.reader.readBook") });
    b.addEventListener("click", read);
  }
}
