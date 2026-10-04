// Obsidian's HTMLElement helpers, for the tests that run in happy-dom. In node
// there is no DOM and this does nothing.

interface ElOptions { cls?: string | string[]; text?: string; attr?: Record<string, string>; parent?: HTMLElement }

function applyOptions(el: HTMLElement, o?: string | ElOptions): HTMLElement {
  const opts: ElOptions = typeof o === "string" ? { cls: o } : o ?? {};
  if (opts.cls) el.classList.add(...(Array.isArray(opts.cls) ? opts.cls : opts.cls.split(" ")).filter(Boolean));
  if (opts.text !== undefined) el.textContent = opts.text;
  for (const [k, v] of Object.entries(opts.attr ?? {})) el.setAttribute(k, v);
  return el;
}

if (typeof HTMLElement !== "undefined") {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.createEl = function (this: HTMLElement, tag: string, o?: string | ElOptions): HTMLElement {
    const el = applyOptions(document.createElement(tag), o);
    this.appendChild(el);
    return el;
  };
  proto.createDiv = function (this: HTMLElement, o?: string | ElOptions): HTMLElement {
    return (this as unknown as { createEl(t: string, o?: string | ElOptions): HTMLElement }).createEl("div", o);
  };
  proto.createSpan = function (this: HTMLElement, o?: string | ElOptions): HTMLElement {
    return (this as unknown as { createEl(t: string, o?: string | ElOptions): HTMLElement }).createEl("span", o);
  };
  proto.addClass = function (this: HTMLElement, ...c: string[]): void { this.classList.add(...c); };
  proto.removeClass = function (this: HTMLElement, ...c: string[]): void { this.classList.remove(...c); };
  proto.toggleClass = function (this: HTMLElement, c: string | string[], on: boolean): void {
    for (const x of Array.isArray(c) ? c : [c]) this.classList.toggle(x, on);
  };
  proto.hasClass = function (this: HTMLElement, c: string): boolean { return this.classList.contains(c); };
  proto.setText = function (this: HTMLElement, text: string): void { this.textContent = text; };
  proto.empty = function (this: HTMLElement): void { this.replaceChildren(); };
  proto.setAttr = function (this: HTMLElement, k: string, v: string): void { this.setAttribute(k, v); };
  proto.setCssStyles = function (this: HTMLElement, styles: Record<string, string>): void { Object.assign(this.style, styles); };
  proto.toggle = function (this: HTMLElement, show: boolean): void { this.style.display = show ? "" : "none"; };
}
