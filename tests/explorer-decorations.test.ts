import { describe, it, expect, vi } from "vitest";
import { ExplorerDecorations, type DecoEl, type Drawer } from "../src/core/explorer-decorations";

let textWrites = 0;

class FakeEl implements DecoEl {
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  className = "";
  private text: string | null = "";
  private attrs = new Map<string, string>();
  ownerDocument = { createElement: () => new FakeEl() };

  constructor(public name = "span") {}

  get textContent(): string | null { return this.text; }
  set textContent(v: string | null) { textWrites++; this.text = v; }

  insertBefore(n: DecoEl, ref: DecoEl | null): unknown {
    const node = n as FakeEl;
    node.parent = this;
    const i = ref ? this.children.indexOf(ref as FakeEl) : -1;
    if (i < 0) this.children.push(node);
    else this.children.splice(i, 0, node);
    return node;
  }
  appendChild(n: DecoEl): unknown { return this.insertBefore(n, null); }
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  getAttribute(n: string): string | null { return this.attrs.get(n) ?? null; }
  setAttribute(n: string, v: string): void { this.attrs.set(n, v); }
  removeAttribute(n: string): void { this.attrs.delete(n); }

  /** "inner", "dot", "count": what the title holds, in order */
  get layout(): string[] { return this.children.map((c) => c.getAttribute("data-escrita-deco") ?? c.name); }
  span(id: string): FakeEl | undefined { return this.children.find((c) => c.getAttribute("data-escrita-deco") === id); }
}

function title(): FakeEl {
  const el = new FakeEl("title");
  el.appendChild(new FakeEl("inner"));
  return el;
}

function setup() {
  const a = title(), f = title(), b = title(), root = title();
  const view = {
    fileItems: {
      "": { selfEl: root, file: { children: [] } },
      "/": { selfEl: root, file: { children: [] } },
      "a.md": { selfEl: a, file: {} },
      "b.md": { selfEl: b, file: {} },
      F: { selfEl: f, file: { children: [] } },
      odd: { selfEl: "not an element", file: {} },
    },
  };
  const log = vi.fn();
  const tooltip = vi.fn((el: DecoEl, text: string | null) => {
    if (text) el.setAttribute("aria-label", text); else el.removeAttribute("aria-label");
  });
  const deco = new ExplorerDecorations(() => [view], { log, tooltip });
  return { a, b, f, root, view, deco, log, tooltip };
}

describe("ExplorerDecorations", () => {
  it("never passes the root, detects folders, skips non-elements", () => {
    const { deco, root } = setup();
    const seen: Array<[string, boolean]> = [];
    deco.add("count", (it) => { seen.push([it.path, it.folder]); return { text: "1" }; });
    expect(seen.sort()).toEqual([["F", true], ["a.md", false], ["b.md", false]]);
    expect(root.layout).toEqual(["inner"]);
  });

  it("draws in fixed order whatever order features register in", () => {
    for (const order of [["count", "dot"], ["dot", "count"]] as const) {
      const { deco, a } = setup();
      for (const id of order) deco.add(id, () => ({ text: id }));
      expect(a.layout).toEqual(["inner", "dot", "count"]);
      expect(a.span("count")!.className).toBe("escrita-explorer-count");
      expect(a.span("dot")!.textContent).toBe("dot");
    }
  });

  it("writes nothing when the output is unchanged", () => {
    const { deco } = setup();
    deco.add("count", () => ({ text: "5", cls: "is-over", tooltip: "5 words" }));
    const before = textWrites;
    deco.refresh();
    expect(textWrites).toBe(before);
  });

  it("applies modifier classes", () => {
    const { deco, a } = setup();
    deco.add("count", () => ({ text: "5", cls: "is-over" }));
    expect(a.span("count")!.className).toBe("escrita-explorer-count is-over");
  });

  it("removes the span when the drawer returns null", () => {
    const { deco, a } = setup();
    let on = true;
    deco.add("dot", () => (on ? {} : null));
    expect(a.layout).toEqual(["inner", "dot"]);
    on = false;
    deco.refresh("dot");
    expect(a.layout).toEqual(["inner"]);
  });

  it("clear(id) leaves the other ids alone; the disposer clears its id", () => {
    const { deco, a } = setup();
    const undot = deco.add("dot", () => ({}));
    deco.add("count", () => ({ text: "1" }));
    deco.clear("count");
    expect(a.layout).toEqual(["inner", "dot"]);
    deco.refresh();
    expect(a.layout).toEqual(["inner", "dot", "count"]);
    undot();
    expect(a.layout).toEqual(["inner", "count"]);
    deco.refresh();
    expect(a.layout).toEqual(["inner", "count"]);
    deco.clear();
    expect(a.layout).toEqual(["inner"]);
  });

  it("refresh with paths draws only those items; missing paths are no-ops", () => {
    const { deco } = setup();
    const draw = vi.fn<Drawer>(() => ({ text: "1" }));
    deco.add("count", draw);
    draw.mockClear();
    deco.refresh("count", ["a.md", "nope.md", "", "a.md", "toString"]);
    expect(draw.mock.calls.map((c) => c[0].path)).toEqual(["a.md"]);
  });

  it("does nothing for a view without fileItems", () => {
    const deco = new ExplorerDecorations(() => [{}, null, 3]);
    const draw = vi.fn(() => ({}));
    deco.add("dot", draw);
    expect(draw).not.toHaveBeenCalled();
    expect(deco.broken).toBe(false);
  });

  it("turns itself off, logging once, when the private API throws; other instances go on", () => {
    const log = vi.fn();
    const draw = vi.fn(() => ({}));
    const deco = new ExplorerDecorations(() => { throw new Error("changed"); }, { log });
    deco.add("dot", draw);
    deco.refresh();
    deco.clear();
    expect(deco.broken).toBe(true);
    expect(log).toHaveBeenCalledTimes(1);
    expect(draw).not.toHaveBeenCalled();

    const other = setup();
    other.deco.add("dot", () => ({}));
    expect(other.deco.broken).toBe(false);
    expect(other.a.layout).toEqual(["inner", "dot"]);
  });

  it("a drawer that throws on one item is a feature bug, not a broken explorer", () => {
    const { deco, b, log } = setup();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    deco.add("count", (it) => { if (it.path === "a.md") throw new Error("bug"); return { text: "2" }; });
    expect(b.layout).toEqual(["inner", "count"]);
    expect(deco.broken).toBe(false);
    expect(log).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("sets a tooltip once and removes it when gone", () => {
    const { deco, a, tooltip } = setup();
    let tip: string | undefined = "5 words";
    deco.add("count", (it) => (it.path === "a.md" ? { text: "5", tooltip: tip } : null));
    expect(tooltip).toHaveBeenCalledTimes(1);
    expect(a.span("count")!.getAttribute("aria-label")).toBe("5 words");
    deco.refresh();
    expect(tooltip).toHaveBeenCalledTimes(1);
    tip = undefined;
    deco.refresh();
    expect(tooltip).toHaveBeenCalledTimes(2);
    expect(a.span("count")!.getAttribute("aria-label")).toBeNull();
  });

  it("uses aria-label by default", () => {
    const a = title();
    const deco = new ExplorerDecorations(() => [{ fileItems: { "a.md": { selfEl: a, file: {} } } }]);
    deco.add("count", () => ({ text: "1", tooltip: "1 word" }));
    expect(a.span("count")!.getAttribute("aria-label")).toBe("1 word");
  });

  it("finds a span again after the explorer re-renders the item", () => {
    const { deco, view } = setup();
    deco.add("dot", () => ({}));
    const fresh = title();
    view.fileItems["a.md"] = { selfEl: fresh, file: {} };
    deco.refresh();
    expect(fresh.layout).toEqual(["inner", "dot"]);
  });
});
