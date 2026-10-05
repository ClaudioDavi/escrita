// A stand-in for the `obsidian` module, aliased in vitest.config.ts. `Component`
// works like Obsidian's (load, unload, children, register* with real cleanup);
// everything else is the smallest no-op that lets `src/` import and construct.

import { StateField } from "@codemirror/state";

type Cb = () => unknown;

export class Component {
  private _loaded = false;
  private _children: Component[] = [];
  private _callbacks: Cb[] = [];

  load(): void {
    if (this._loaded) return;
    this._loaded = true;
    this.onload();
    for (const c of this._children.slice()) c.load();
  }
  onload(): void {}

  /** Obsidian's order: children (last added first), then registered callbacks (last first), then onunload. */
  unload(): void {
    if (!this._loaded) return;
    this._loaded = false;
    while (this._children.length) this._children.pop()!.unload();
    const cbs = this._callbacks.slice();
    this._callbacks = [];
    while (cbs.length) cbs.pop()!();
    this.onunload();
  }
  onunload(): void {}

  addChild<T extends Component>(c: T): T {
    this._children.push(c);
    if (this._loaded) c.load();
    return c;
  }
  removeChild<T extends Component>(c: T): T {
    const i = this._children.indexOf(c);
    if (i >= 0) this._children.splice(i, 1);
    c.unload();
    return c;
  }
  register(cb: Cb): void { this._callbacks.push(cb); }
  registerEvent(ref: { off?: Cb } | unknown): void {
    this.register(() => (ref as { off?: Cb } | undefined)?.off?.());
  }
  registerDomEvent(el: EventTarget, type: string, cb: EventListener, opts?: AddEventListenerOptions | boolean): void {
    el.addEventListener(type, cb, opts);
    this.register(() => el.removeEventListener(type, cb, opts));
  }
  registerInterval(id: number): number {
    this.register(() => clearInterval(id));
    return id;
  }
}

export class Plugin extends Component {}
export class MarkdownRenderChild extends Component {
  constructor(public containerEl: HTMLElement) { super(); }
}

export class TAbstractFile {
  path = "";
  name = "";
  parent: TFolder | null = null;
}
export class TFile extends TAbstractFile {
  basename = "";
  extension = "md";
  stat = { ctime: 0, mtime: 0, size: 0 };
}
export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export const noticeLog: string[] = [];
export class Notice {
  constructor(message: string | DocumentFragment, _timeout?: number) { noticeLog.push(String(message)); }
  setMessage(): this { return this; }
  hide(): void {}
}

export class App {}
export class WorkspaceLeaf {}
export class Menu {
  addItem(): this { return this; }
  addSeparator(): this { return this; }
  showAtMouseEvent(): this { return this; }
  showAtPosition(): this { return this; }
}
export class Keymap {
  static isModEvent(): boolean { return false; }
}
export class MarkdownView {}
export class Editor {}
/** One row a `Setting` drew, in order: what the settings tab tests read (name, line under it, heading or not). */
export interface SettingRow { name: string; desc: string; heading: boolean }
export const settingLog: SettingRow[] = [];
export function resetSettingLog(): void { settingLog.length = 0; }

/** A control inside a `Setting`: remembers its value, ignores the rest. Elements exist only where there is a DOM. */
class StubControl {
  inputEl: HTMLInputElement = undefined as unknown as HTMLInputElement;
  selectEl: HTMLSelectElement = undefined as unknown as HTMLSelectElement;
  toggleEl: HTMLElement = undefined as unknown as HTMLElement;
  buttonEl: HTMLElement = undefined as unknown as HTMLElement;
  extraSettingsEl: HTMLElement = undefined as unknown as HTMLElement;
  value: unknown = "";
  private changed: ((v: never) => unknown) | null = null;
  constructor() {
    if (typeof document !== "undefined") {
      this.inputEl = document.createElement("input");
      this.selectEl = document.createElement("select");
      this.toggleEl = document.createElement("div");
      this.buttonEl = document.createElement("button");
      this.extraSettingsEl = document.createElement("div");
    }
  }
  setValue(v: unknown): this { this.value = v; if (this.inputEl && typeof v === "string") this.inputEl.value = v; return this; }
  getValue(): unknown { return this.inputEl && typeof this.value === "string" ? this.inputEl.value : this.value; }
  setPlaceholder(): this { return this; }
  setDisabled(): this { return this; }
  setIcon(): this { return this; }
  setTooltip(): this { return this; }
  setButtonText(): this { return this; }
  addOption(): this { return this; }
  onChange(cb: (v: never) => unknown): this { this.changed = cb; return this; }
  onClick(): this { return this; }
  /** Test helper: what typing `v` into the control would run. */
  fire(v: unknown): unknown { return this.changed?.(v as never); }
}

export class Setting {
  readonly row: SettingRow = { name: "", desc: "", heading: false };
  settingEl: HTMLElement = undefined as unknown as HTMLElement;
  nameEl: HTMLElement = undefined as unknown as HTMLElement;
  descEl: HTMLElement = undefined as unknown as HTMLElement;
  controlEl: HTMLElement = undefined as unknown as HTMLElement;
  constructor(public containerEl?: HTMLElement) {
    settingLog.push(this.row);
    if (typeof document !== "undefined") {
      this.settingEl = document.createElement("div");
      this.nameEl = this.settingEl.appendChild(document.createElement("div"));
      this.descEl = this.settingEl.appendChild(document.createElement("div"));
      this.controlEl = this.settingEl.appendChild(document.createElement("div"));
      containerEl?.appendChild(this.settingEl);
    }
  }
  setName(name: string): this { this.row.name = name; return this; }
  setDesc(desc: string): this { this.row.desc = desc; return this; }
  setHeading(): this { this.row.heading = true; return this; }
  private control(cb?: (c: never) => unknown): this {
    // Callbacks run only where there is a DOM: node tests that build a Setting get the old no-op.
    if (typeof document !== "undefined" && cb) cb(new StubControl() as never);
    return this;
  }
  addText(cb?: (c: never) => unknown): this { return this.control(cb); }
  addToggle(cb?: (c: never) => unknown): this { return this.control(cb); }
  addDropdown(cb?: (c: never) => unknown): this { return this.control(cb); }
  addButton(cb?: (c: never) => unknown): this { return this.control(cb); }
  addExtraButton(cb?: (c: never) => unknown): this { return this.control(cb); }
  addTextArea(cb?: (c: never) => unknown): this { return this.control(cb); }
  addColorPicker(cb?: (c: never) => unknown): this { return this.control(cb); }
}
export class PluginSettingTab {
  containerEl: unknown = {};
  constructor(public app?: unknown, public plugin?: unknown) {}
}

export class View extends Component {
  containerEl: HTMLElement | undefined;
  constructor(public leaf: WorkspaceLeaf) {
    super();
    if (typeof document !== "undefined") this.containerEl = document.createElement("div");
  }
}
export class ItemView extends View {
  contentEl: HTMLElement | undefined = this.containerEl;
}

export class Modal extends Component {
  contentEl: HTMLElement | undefined;
  constructor(public app?: unknown) {
    super();
    if (typeof document !== "undefined") this.contentEl = document.createElement("div");
  }
  open(): void {}
  close(): void {}
  setTitle(): this { return this; }
}
export class SuggestModal extends Modal {}
export class FuzzySuggestModal extends SuggestModal {}
export class AbstractInputSuggest {
  constructor(public app?: unknown, public inputEl?: unknown) {}
  setValue(): void {}
  close(): void {}
}

export const Platform = { isMobile: false, isDesktop: true, isMacOS: false };

export function setIcon(): void {}
export function setTooltip(): void {}
export function normalizePath(p: string): string {
  return p.replace(/[\\/]+/g, "/").replace(/^\/+|\/+$/g, "") || "/";
}

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
}
export function debounce<A extends unknown[]>(cb: (...args: A) => unknown, timeout = 0, resetTimer = false): Debounced<A> {
  let h: ReturnType<typeof setTimeout> | null = null;
  const fn = ((...args: A) => {
    if (h !== null && resetTimer) clearTimeout(h);
    if (h === null || resetTimer) h = setTimeout(() => { h = null; cb(...args); }, timeout);
  }) as Debounced<A>;
  fn.cancel = () => { if (h !== null) clearTimeout(h); h = null; };
  return fn;
}

export const moment = Object.assign(
  (..._args: unknown[]) => ({ isValid: () => false, format: () => "", localeData: () => ({ longDateFormat: () => "" }) }),
  {
    locale: () => "en",
    // the weekday checkboxes of the goals section
    localeData: () => ({ firstDayOfWeek: () => 0, longDateFormat: () => "" }),
    weekdaysShort: (d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d] ?? "",
    weekdays: (d: number) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d] ?? "",
  },
);

export const editorInfoField = StateField.define<null>({ create: () => null, update: (v) => v });
export const editorLivePreviewField = StateField.define<boolean>({ create: () => true, update: (v) => v });
