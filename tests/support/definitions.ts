// Renders setting definitions into the DOM the way Obsidian 1.14 does (app.js: x4, T4, D4, O4,
// w4, C4, E4), with the `Setting` and `SettingGroup` stubs of tests/support/obsidian.ts:
//
// - loose top-level rows are wrapped in an unnamed group, consecutive ones together;
// - a row is kept only with a name, a render, a control or an action;
// - each row runs setName and setDesc from its definition, then `render(setting, group)`;
// - on a re-render, groups are matched by key (type and heading, or index) and rows by key
//   (id, control key, name, or index when the name is empty); a matched row has its cleanup run,
//   is cleared (`Setting.clear`) and rendered again; an unmatched one is torn down;
// - `visible` is read after each render: a hidden row is hidden, and a group whose rows are
//   all hidden hides too.
//
// Obsidian logs an error for a duplicate key in a group (and mis-matches rows on re-render);
// here it throws, so a test fails on it.

import type { SettingDefinition, SettingDefinitionGroup, SettingDefinitionItem, SettingGroupItem } from "obsidian";
import { Setting, SettingGroup } from "./obsidian";
import type { SettingsBlock } from "../../src/ui/settings-rows";
import { slotGroups } from "../../src/settings-tab";

export interface RenderedRow {
  key: string;
  def: SettingDefinition;
  setting: Setting;
  cleanup?: () => void;
}

export interface RenderedGroup {
  key: string;
  def: SettingDefinitionGroup;
  group: SettingGroup;
  rows: RenderedRow[];
}

const isGroup = (item: SettingDefinitionItem): item is SettingDefinitionGroup =>
  "type" in item && (item.type === "group" || item.type === "list");

const read = <T>(v: T | (() => T) | undefined, fallback: T): T =>
  v === undefined ? fallback : typeof v === "function" ? (v as () => T)() : v;

/** C4: a row's key in its group. */
export function rowKey(def: SettingGroupItem, index: number): string {
  if ("type" in def) return `page:${def.name || index}`;
  const id = (def as { id?: string }).id;
  if (id) return `id:${id}`;
  if (def.control) return `ctrl:${def.control.key}`;
  if (def.name) return `name:${def.name}`;
  return `item#${index}`;
}

/** E4: a group's key among the groups. */
export function groupKey(def: SettingDefinitionGroup, index: number): string {
  return def.heading ? `${def.type}:${def.heading}` : `${def.type}#${index}`;
}

function unique(keys: readonly string[], where: string): void {
  const seen = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) throw new Error(`${where}: duplicate setting key "${k}"`);
    seen.add(k);
  }
}

/** M4: what Obsidian keeps of a group's items. */
const kept = (def: SettingGroupItem): boolean =>
  "type" in def ? !!(def.items || def.page) : !!(def.name || def.render || def.control || def.action);

function runCleanup(row: RenderedRow): void {
  const c = row.cleanup;
  row.cleanup = undefined;
  c?.();
}

function teardown(g: RenderedGroup): void {
  for (const r of g.rows) runCleanup(r);
}

/** D4 and O4: the rows of one group, reusing the previous render's rows by key. */
function renderRows(g: RenderedGroup): RenderedRow[] {
  const items = (g.def.items ?? []).filter(kept);
  const keyed = items.map((def, i) => ({ def, key: rowKey(def, i) }));
  unique(keyed.map((k) => k.key), `group "${g.def.heading ?? g.key}"`);
  const old = new Map(g.rows.map((r) => [r.key, r]));
  const rows: RenderedRow[] = [];
  for (const { def, key } of keyed) {
    if ("type" in def) throw new Error("pages are not used in Escrita's settings tab");
    if (def.control || def.action) throw new Error("control and action rows are not used (PLAN-1.0.3 Q3)");
    const prev = old.get(key);
    let row: RenderedRow;
    if (prev) {
      old.delete(key);
      runCleanup(prev);
      prev.setting.clear();
      prev.def = def;
      row = prev;
    } else {
      row = { key, def, setting: new Setting(g.group.listEl) };
    }
    // O4: name and description from the definition (setText: what the elements showed goes), then render
    const desc = typeof def.desc === "string" ? def.desc : def.desc?.textContent ?? "";
    row.setting.setName(def.name ?? "");
    row.setting.setDesc(desc);
    row.setting.nameEl.textContent = def.name ?? "";
    row.setting.descEl.textContent = desc;
    const cleanup = def.render?.(row.setting as never, g.group as never);
    if (cleanup) row.cleanup = cleanup;
    rows.push(row);
  }
  for (const r of old.values()) {
    runCleanup(r);
    r.setting.settingEl.remove();
  }
  for (const r of rows) g.group.listEl.appendChild(r.setting.settingEl);
  return rows;
}

/** w4 and k4: visibility after a render. */
function applyVisibility(groups: readonly RenderedGroup[]): void {
  for (const g of groups) {
    let any = false;
    for (const r of g.rows) {
      const shown = read(r.def.visible, true);
      r.setting.settingEl.toggle(shown);
      any ||= shown;
    }
    g.group.groupEl.toggle(read(g.def.visible, true) && (g.rows.length === 0 || any));
  }
}

/**
 * Renders `items` into `el` (x4), reusing `previous` (what the last call returned) the way a
 * re-render does. Returns the rendered groups.
 */
export function renderDefinitions(items: readonly SettingDefinitionItem[], el: HTMLElement, previous: readonly RenderedGroup[] = []): RenderedGroup[] {
  if (previous.length === 0) el.replaceChildren();
  const defs: SettingDefinitionGroup[] = [];
  let loose: SettingGroupItem[] | null = null;
  for (const item of items) {
    if (isGroup(item)) {
      defs.push(item);
      loose = null;
    } else {
      if (!loose) defs.push({ type: "group", items: loose = [] });
      loose.push(item);
    }
  }
  const keyed = defs.map((def, i) => ({ def, key: groupKey(def, i) }));
  unique(keyed.map((k) => k.key), "settings tab");
  const old = new Map(previous.map((g) => [g.key, g]));
  const out: RenderedGroup[] = [];
  for (const { def, key } of keyed) {
    const prev = old.get(key);
    let g: RenderedGroup;
    if (prev && prev.def.type === def.type) {
      old.delete(key);
      prev.group.setHeading(def.heading ?? "");
      prev.def = def;
      g = prev;
    } else {
      const group = new SettingGroup(el);
      if (def.heading) group.setHeading(def.heading);
      if (def.cls) group.addClass(...def.cls.split(" ").filter(Boolean));
      g = { key, def, group, rows: [] };
    }
    g.rows = renderRows(g);
    out.push(g);
  }
  for (const g of old.values()) {
    teardown(g);
    g.group.groupEl.remove();
  }
  for (const g of out) el.appendChild(g.group.groupEl);
  applyVisibility(out);
  return out;
}

/**
 * Renders a module's blocks as the tab groups them (`slotGroups`): a block with a heading opens a
 * group, one without continues the group above, so a duplicate name across blocks of one group
 * fails here as it would in Obsidian. A clash with the core's rows of the slot shows only when the
 * whole tab is opened (`openTab`).
 */
export function renderBlocks(blocks: readonly SettingsBlock[], el: HTMLElement = document.createElement("div")): { el: HTMLElement; groups: RenderedGroup[] } {
  const groups = renderDefinitions(slotGroups([{ slot: { heading: null }, blocks, drawsHeading: false }]), el);
  return { el, groups };
}

/** The rendered row named `name`, in any group. */
export function rowNamed(groups: readonly RenderedGroup[], name: string): RenderedRow | undefined {
  for (const g of groups) for (const r of g.rows) if (r.def.name === name) return r;
  return undefined;
}

/** What a settings tab offers the harness (Obsidian's SettingTab, 1.13+). */
export interface TabLike {
  containerEl: HTMLElement;
  settingItems: SettingDefinitionItem[];
  update(): void;
}

export interface OpenTab {
  el: HTMLElement;
  /** The groups as last rendered. */
  groups(): RenderedGroup[];
  /** Hides the tab: every row's cleanup runs. */
  close(): void;
}

/**
 * Opens a tab: builds its rows (update) and renders them into a fresh `containerEl`. While it is
 * open, each `update()` re-renders it, as Obsidian's does for the open tab. Spy on `update`
 * after this call to count only later updates.
 */
export function openTab(tab: TabLike): OpenTab {
  const el = document.createElement("div");
  tab.containerEl = el;
  let groups: RenderedGroup[] = [];
  const update = tab.update.bind(tab);
  tab.update = () => {
    update();
    groups = renderDefinitions(tab.settingItems, el, groups);
  };
  tab.update();
  return {
    el,
    groups: () => groups,
    close: () => {
      for (const g of groups) teardown(g);
      groups = [];
      tab.update = update;
    },
  };
}
