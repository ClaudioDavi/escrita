// plugin.decorations: the one place that draws into the file explorer. The
// explorer has no public API for this, so it walks the private
// `view.fileItems[path].selfEl`, guarded: a future Obsidian change turns the
// decorations off (logged once) instead of breaking anything. No runtime
// Obsidian import, so the walk is tested in node with fake elements.
//
// ── Interface ────────────────────────────────────────────────────────────
//
//   add(id, drawer) → dispose
//       A feature registers one drawer per id ("dot", "count"). The drawer is
//       called with { path, folder } and returns what to show ({ text?,
//       tooltip?, cls? }) or null for nothing. It must be cheap and never do
//       I/O. dispose() removes the drawer and every span it drew.
//   refresh(id?, paths?)
//       Redraw one id or all, on every item or only on the given paths.
//       main.ts calls refresh() on layout-change (the explorer re-renders).
//   clear(id?)
//       Remove the owned spans (plugin unload).
//
// Each id owns one <span class="escrita-explorer-<id>" data-escrita-deco=<id>>
// inside the item's title, appended after the name, in DECORATION_ORDER
// whatever order features registered in. Writes happen only when something
// changed. No pseudo-elements, no innerHTML.

export type DecorationId = "dot" | "count";

/** Fixed drawing order inside a title, whatever order features register in. */
export const DECORATION_ORDER: readonly DecorationId[] = ["dot", "count"];

export interface ExplorerItem {
  path: string;
  folder: boolean;
}

/** What to draw for one id on one item. */
export interface Decoration {
  text?: string;
  tooltip?: string;
  /** space-separated modifier classes */
  cls?: string;
}

/** null: nothing (the span is removed). */
export type Drawer = (item: ExplorerItem) => Decoration | null;

/** The DOM surface the adapter uses. A real HTMLElement satisfies it; tests pass fakes. */
export interface DecoEl {
  readonly children: ArrayLike<DecoEl>;
  readonly ownerDocument: { createElement(tag: "span"): DecoEl } | null;
  insertBefore(node: DecoEl, ref: DecoEl | null): unknown;
  appendChild(node: DecoEl): unknown;
  remove(): void;
  textContent: string | null;
  className: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface DecorationsOptions {
  /** Sets (text) or removes (null) an element's tooltip. Default: aria-label. main.ts passes Obsidian's setTooltip. */
  tooltip?: (el: DecoEl, text: string | null) => void;
  /** Default: console.error */
  log?: (msg: string, e: unknown) => void;
}

const ATTR = "data-escrita-deco";
const TIP = "data-escrita-tip";

type Item = { selfEl?: unknown; file?: unknown } | undefined;
type FileItems = Record<string, Item>;

function fileItemsOf(view: unknown): FileItems | null {
  if (!view || typeof view !== "object") return null;
  const items = (view as { fileItems?: unknown }).fileItems;
  return items && typeof items === "object" ? (items as FileItems) : null;
}

function isEl(x: unknown): x is DecoEl {
  if (!x || typeof x !== "object") return false;
  const e = x as Partial<DecoEl>;
  return typeof e.insertBefore === "function" && typeof e.appendChild === "function" && typeof e.getAttribute === "function";
}

function isFolder(item: Item): boolean {
  const file = item?.file as { children?: unknown } | undefined;
  return !!file && Array.isArray(file.children);
}

function isRoot(path: string): boolean {
  return path === "" || path === "/";
}

function defaultTooltip(el: DecoEl, text: string | null): void {
  if (text) el.setAttribute("aria-label", text);
  else el.removeAttribute("aria-label");
}

export class ExplorerDecorations {
  private drawers = new Map<DecorationId, Drawer>();
  private isBroken = false;
  private tooltip: (el: DecoEl, text: string | null) => void;
  private log: (msg: string, e: unknown) => void;

  /** `views()`: the file explorer leaves' views, e.g. () => workspace.getLeavesOfType("file-explorer").map((l) => l.view). */
  constructor(private views: () => unknown[], opts: DecorationsOptions = {}) {
    this.tooltip = opts.tooltip ?? defaultTooltip;
    this.log = opts.log ?? ((msg, e) => console.error(msg, e));
  }

  /** True once the private API failed in this instance; refresh and clear are then no-ops. */
  get broken(): boolean {
    return this.isBroken;
  }

  /** Registers a feature's drawer (one per id) and draws it. Returns the disposer, which removes every span of that id. */
  add(id: DecorationId, draw: Drawer): () => void {
    this.drawers.set(id, draw);
    this.refresh(id);
    return () => {
      if (this.drawers.get(id) !== draw) return;
      this.drawers.delete(id);
      this.clear(id);
    };
  }

  /** Redraws one id or all; on every item, or only on `paths`. */
  refresh(id?: DecorationId, paths?: Iterable<string>): void {
    const ids = DECORATION_ORDER.filter((d) => (id === undefined || d === id) && this.drawers.has(d));
    if (ids.length === 0) return;
    const wanted = paths ? [...new Set(paths)] : null;
    this.walk(wanted, (path, el, item) => {
      const it: ExplorerItem = { path, folder: isFolder(item) };
      for (const d of ids) this.write(el, d, this.draw(d, it));
    });
  }

  /** Removes the owned spans of one id, or of all. */
  clear(id?: DecorationId): void {
    const ids = id === undefined ? DECORATION_ORDER : [id];
    this.walk(null, (_path, el) => {
      for (const d of ids) this.owned(el, d)?.remove();
    });
  }

  private draw(id: DecorationId, item: ExplorerItem): Decoration | null {
    const drawer = this.drawers.get(id);
    if (!drawer) return null;
    try {
      return drawer(item);
    } catch (e) {
      // a feature bug: draw nothing for this item, keep the explorer on
      console.error(`Escrita: could not draw "${id}" for ${item.path}`, e);
      return null;
    }
  }

  private walk(paths: string[] | null, fn: (path: string, el: DecoEl, item: Item) => void): void {
    if (this.isBroken) return;
    try {
      for (const view of this.views()) {
        const items = fileItemsOf(view);
        if (!items) continue;
        for (const path of paths ?? Object.keys(items)) {
          if (isRoot(path) || !Object.prototype.hasOwnProperty.call(items, path)) continue;
          const item = items[path];
          const el = item?.selfEl;
          if (isEl(el)) fn(path, el, item);
        }
      }
    } catch (e) {
      this.isBroken = true;
      this.log("Escrita: could not update the file explorer; turning explorer decorations off", e);
    }
  }

  private owned(el: DecoEl, id: DecorationId): DecoEl | null {
    for (const c of Array.from(el.children)) if (c.getAttribute(ATTR) === id) return c;
    return null;
  }

  private write(el: DecoEl, id: DecorationId, d: Decoration | null): void {
    let span = this.owned(el, id);
    if (!d) {
      span?.remove();
      return;
    }
    if (!span) {
      const doc = el.ownerDocument;
      if (!doc) return;
      span = doc.createElement("span");
      span.setAttribute(ATTR, id);
      el.insertBefore(span, this.nextOwned(el, id));
    }
    const cls = `escrita-explorer-${id}${d.cls ? ` ${d.cls}` : ""}`;
    if (span.className !== cls) span.className = cls;
    const text = d.text ?? "";
    if ((span.textContent ?? "") !== text) span.textContent = text;
    const tip = d.tooltip ?? "";
    if ((span.getAttribute(TIP) ?? "") !== tip) {
      this.tooltip(span, tip || null);
      if (tip) span.setAttribute(TIP, tip);
      else span.removeAttribute(TIP);
    }
  }

  /** The first owned span whose id comes after `id` (insert before it), else null (append). */
  private nextOwned(el: DecoEl, id: DecorationId): DecoEl | null {
    const rank = DECORATION_ORDER.indexOf(id);
    for (const c of Array.from(el.children)) {
      const other = c.getAttribute(ATTR) as DecorationId | null;
      if (other && DECORATION_ORDER.indexOf(other) > rank) return c;
    }
    return null;
  }
}
