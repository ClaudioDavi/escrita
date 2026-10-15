// The rows of the settings tab (IMPROVEMENTS 36, PLAN-1.0.3): each helper returns an Obsidian
// `SettingDefinition` whose `render` draws the row's control, so the row shows in Obsidian's
// settings search (1.13+). No helper draws anything by itself; the tab renders what it returns.
//
// Every row is a `render` row, never a `control` row (Q3): a control row saves through
// `saveData`, which skips `plugin.saveSettings()` (features.apply, settingsChanged) and the
// commit-on-blur rule for text fields. Text fields save when the writer commits them
// (`ui.saveOnCommit`); toggles and dropdowns save at once (`ui.save`).
//
// Obsidian runs `render` again on each `update()` of the tab, after clearing the row's control
// element and calling the cleanup `render` returned, so a render reads the settings each time.

import type { Setting, SettingDefinitionRender, SettingGroupItem, TextAreaComponent, TextComponent } from "obsidian";
import type { EscritaSettings } from "../settings";
import type { SettingsUi } from "../core/module-context";
import type { FolderProblem } from "../core/folder-problem";
import { addFolderField } from "../core/folder-setting";

/**
 * A part of a module's settings (Q4). The first block goes under the slot's heading, which the
 * tab draws (core/settings-order.ts). A block with a heading becomes a group of its own (the
 * lens's "Rules"); a block without one continues the group above.
 */
export interface SettingsBlock {
  heading?: string;
  items: SettingGroupItem[];
}

/** What every row takes. */
export interface RowOptions {
  /** The row's name: what it shows and what the settings search finds. Unique in its group (Obsidian matches rows by name). */
  name: string;
  /** The line under the name. A function is read again at each render; the search reads its value when the rows were built. */
  desc?: string | (() => string);
  /** Read at each render; a hidden row is left out of search, and a group whose rows are all hidden hides too. */
  visible?: boolean | (() => boolean);
  /** Classes for the row (`settingEl`). */
  cls?: string;
  /** Other words the settings search finds the row by. */
  aliases?: string[];
}

/**
 * The one commit path of a text field (`SettingsUi.saveOnCommit`; the tab and the tests' fake
 * both wire it here): on `change` (blur or Enter), trim, blank becomes `fallback()`, show what
 * was kept, `apply` it, then `save` (only if `read()` changed across `apply`, when given).
 */
export function wireCommit(
  c: TextComponent | TextAreaComponent | HTMLInputElement,
  fallback: () => string,
  apply: (v: string) => void,
  read: (() => string | number) | undefined,
  save: () => Promise<void>,
): void {
  const plain = c instanceof HTMLInputElement;
  const input = plain ? c : c.inputEl;
  input.addEventListener("change", () => {
    const v = (plain ? c.value : c.getValue()).trim() || fallback();
    if (plain) c.value = v; else c.setValue(v);
    const before = read?.();
    apply(v);
    if (!read || read() !== before) void save();
  });
}

/** The settings stored as text: the keys a text row can take its fallback from. */
export type TextKey = { [K in keyof EscritaSettings]-?: EscritaSettings[K] extends string ? K : never }[keyof EscritaSettings];

export interface TextRowOptions extends RowOptions {
  get: () => string;
  /** Stores a committed value (trimmed; a blank field gives the fallback). The field then shows `get()`, so a value `set` cleans shows cleaned. */
  set: (v: string) => void;
  /** The setting the field edits: a cleared field falls back to its default in the install's language (`ui.defaults()`). */
  key?: TextKey;
  /** What a cleared field becomes. Default: the key's default, or "" without a key. */
  fallback?: () => string;
  placeholder?: string;
  /** Classes for the input. */
  inputCls?: string;
  /** Attaches an input suggest to the field (ui/suggest.ts); called once per render with the field's input. */
  suggest?: (input: HTMLInputElement) => void;
}

export interface ToggleRowOptions extends RowOptions {
  get: () => boolean;
  set: (v: boolean) => void;
}

export interface DropdownRowOptions<T extends string | number> extends RowOptions {
  /** Value and label, in the order shown. A number value comes back to `set` as a number. */
  options: readonly (readonly [T, string])[];
  get: () => T;
  set: (v: T) => void;
}

export interface NumberRowOptions extends RowOptions {
  min: number;
  max: number;
  get: () => number;
  set: (v: number) => void;
  placeholder?: string;
  /** A word after the field ("words"). */
  unit?: string;
  /** Classes for the input. */
  inputCls?: string;
}

export interface FolderRowOptions extends RowOptions {
  /** What the empty field shows, and what a cleared field becomes. */
  placeholder: string;
  get: () => string;
  /** Stores a value that passed `problemOf`. */
  set: (v: string) => void;
  problemOf: (v: string) => FolderProblem | null;
  /** The warning for a problem; default: the shared folder warnings (core/folder-setting.ts). */
  problemText?: (p: FolderProblem) => string;
  /** Attaches an input suggest to the field (ui/suggest.ts); called once per render with the field's input. */
  suggest?: (input: HTMLInputElement) => void;
}

const classes = (cls: string | undefined): string[] => (cls ?? "").split(" ").filter(Boolean);

/**
 * A named, searchable row whose `draw` fills the control area of the row (the Features page, the
 * stage rows). Name, description and visibility are the helpers' own. Contrast with `customRow`,
 * which empties the whole row first. Returns `draw`'s cleanup, run before the next render.
 */
export function drawnRow(o: RowOptions, draw: (setting: Setting) => void | (() => void)): SettingDefinitionRender {
  const desc = o.desc;
  const def: SettingDefinitionRender = {
    name: o.name,
    render: (setting) => {
      if (typeof desc === "function") setting.setDesc(desc());
      if (o.cls) setting.settingEl.addClass(...classes(o.cls));
      return draw(setting);
    },
  };
  const text = typeof desc === "function" ? desc() : desc;
  if (text) def.desc = text;
  if (o.visible !== undefined) def.visible = o.visible;
  if (o.aliases) def.aliases = o.aliases;
  return def;
}

/** A text field or area wired to commit: the value, placeholder, classes and label, then saveOnCommit. */
function commitField(ui: SettingsUi, c: TextComponent | TextAreaComponent, o: TextRowOptions): void {
  const key = o.key;
  const fallback = o.fallback ?? (key ? () => ui.defaults()[key] : () => "");
  if (o.placeholder !== undefined) c.setPlaceholder(o.placeholder);
  c.setValue(o.get());
  if (o.inputCls) c.inputEl.addClass(...classes(o.inputCls));
  if (o.name) c.inputEl.setAttr("aria-label", o.name);
  if (c.inputEl instanceof HTMLInputElement) o.suggest?.(c.inputEl);
  ui.saveOnCommit(c, fallback, (v) => {
    o.set(v);
    c.setValue(o.get());
  }, o.get);
}

/** A one-line text field, saved when the writer commits it (blur or Enter). */
export function textRow(ui: SettingsUi, o: TextRowOptions): SettingDefinitionRender {
  return drawnRow(o, (s) => { s.addText((c) => commitField(ui, c, o)); });
}

/** A text area, saved when the writer commits it. */
export function textAreaRow(ui: SettingsUi, o: TextRowOptions): SettingDefinitionRender {
  return drawnRow(o, (s) => { s.addTextArea((c) => commitField(ui, c, o)); });
}

/** A toggle, saved at once. */
export function toggleRow(ui: SettingsUi, o: ToggleRowOptions): SettingDefinitionRender {
  return drawnRow(o, (s) => {
    s.addToggle((c) => {
      c.setValue(o.get()).onChange(async (v) => {
        o.set(v);
        await ui.save();
      });
      if (o.name) c.toggleEl.setAttr("aria-label", o.name);
    });
  });
}

/** A dropdown, saved at once. The values may be numbers: the row turns the chosen option back into one. */
export function dropdownRow<T extends string | number>(ui: SettingsUi, o: DropdownRowOptions<T>): SettingDefinitionRender {
  return drawnRow(o, (s) => {
    s.addDropdown((d) => {
      for (const [value, label] of o.options) d.addOption(String(value), label);
      d.setValue(String(o.get()));
      if (o.name) d.selectEl.setAttr("aria-label", o.name);
      d.onChange(async (raw) => {
        const hit = o.options.find(([value]) => String(value) === raw);
        if (!hit) return;
        o.set(hit[0]);
        await ui.save();
      });
    });
  });
}

/**
 * A whole number typed in a field, saved when committed: its digits (`ui.num`, the one parser),
 * kept between `min` and `max`. A field with no digit (blank, or only words) keeps the stored
 * number. The field then shows what was kept.
 */
export function numberRow(ui: SettingsUi, o: NumberRowOptions): SettingDefinitionRender {
  return drawnRow(o, (s) => {
    s.addText((c) => {
      c.inputEl.inputMode = "numeric";
      if (o.placeholder !== undefined) c.setPlaceholder(o.placeholder);
      if (o.inputCls) c.inputEl.addClass(...classes(o.inputCls));
      if (o.name) c.inputEl.setAttr("aria-label", o.name);
      c.setValue(String(o.get()));
      ui.saveOnCommit(c, () => String(o.get()), (v) => {
        o.set(Math.min(o.max, Math.max(o.min, ui.num(v, o.get(), o.min))));
        c.setValue(String(o.get()));
      }, o.get);
    });
    if (o.unit) s.controlEl.createSpan({ cls: "setting-item-description", text: o.unit });
  });
}

/**
 * A folder field that saves only a value that passes `problemOf`; otherwise the saved value
 * stays and a warning under the name says why, following the typing (addFolderField).
 */
export function folderRow(ui: SettingsUi, o: FolderRowOptions): SettingDefinitionRender {
  return drawnRow(o, (s) => {
    addFolderField(s, ui, { placeholder: o.placeholder, value: o.get(), read: o.get, problemOf: o.problemOf, problemText: o.problemText, save: o.set });
    const input = s.controlEl.querySelector("input");
    if (input) o.suggest?.(input);
  });
}

/**
 * A row of its own drawing: `render` empties the row and `draw` fills it (Obsidian's own
 * pattern for custom blocks). Returns `draw`'s cleanup, run before the next render. An empty
 * name keeps the row out of search; a name lets the search find and land on it.
 */
export function customRow(name: string, draw: (el: HTMLElement) => void | (() => void), o: Omit<RowOptions, "name"> = {}): SettingDefinitionRender {
  const def = drawnRow({ ...o, name }, (s) => {
    s.settingEl.empty();
    s.settingEl.addClass("escrita-custom-row");
    return draw(s.settingEl);
  });
  if (!name) def.searchable = false;
  return def;
}

/** A description paragraph between rows (a section's opening line): no name, not searched. */
export function noteRow(text: string | (() => string), cls?: string): SettingDefinitionRender {
  return customRow("", (el) => {
    el.addClass("escrita-note-row");
    el.createDiv({ cls: ["setting-item-description", ...classes(cls)], text: typeof text === "function" ? text() : text });
  });
}
