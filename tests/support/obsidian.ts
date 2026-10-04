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
export class Setting {
  constructor(public containerEl?: HTMLElement) {}
  setName(): this { return this; }
  setDesc(): this { return this; }
  setHeading(): this { return this; }
  addText(): this { return this; }
  addToggle(): this { return this; }
  addDropdown(): this { return this; }
  addButton(): this { return this; }
  addExtraButton(): this { return this; }
  addTextArea(): this { return this; }
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
  { locale: () => "en" },
);

export const editorInfoField = StateField.define<null>({ create: () => null, update: (v) => v });
export const editorLivePreviewField = StateField.define<boolean>({ create: () => true, update: (v) => v });
