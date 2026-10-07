import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ getLanguage: () => "en", moment: { locale: () => "en" }, Notice: class { constructor(public m: string) { notices.push(m); } } }));
const notices: string[] = [];

// A tiny stand-in for the DOM (no jsdom here): a body with classes and appended elements.
class FakeEl {
  classes = new Set<string>();
  kids: FakeEl[] = [];
  textContent = "";
  cls = "";
  constructor(public parent: FakeBody | null = null) {}
  setText(v: string) { this.textContent = v; }
  addEventListener() {}
  remove() { if (this.parent) this.parent.kids = this.parent.kids.filter((k) => k !== this); }
}
class FakeBody extends FakeEl {
  classList = { add: (c: string) => this.classes.add(c), remove: (c: string) => this.classes.delete(c), contains: (c: string) => this.classes.has(c) };
  private mk(o: { cls?: string; text?: string }) { const e = new FakeEl(this); e.cls = o.cls ?? ""; e.textContent = o.text ?? ""; this.kids.push(e); return e; }
  createEl(_t: string, o: { cls?: string; text?: string }) { return this.mk(o); }
  createDiv(o: { cls?: string }) { return this.mk(o); }
}
const body = new FakeBody();
(globalThis as unknown as { document: unknown }).document = {
  body,
  querySelector: (sel: string) => body.kids.find((k) => k.cls === sel.slice(1)) ?? null,
};

import { beforeAll } from "vitest";
import { registerStrings } from "../src/i18n";
import { deskStrings } from "../src/desk/strings";
import { WritingMode } from "../src/desk/writing-mode";

function dock(collapsed: boolean) {
  return { collapsed, collapse: vi.fn(function (this: { collapsed: boolean }) { this.collapsed = true; }), expand: vi.fn(function (this: { collapsed: boolean }) { this.collapsed = false; }) };
}

function make(opts: { left: boolean; right: boolean; progress?: { words: number; goal: number } }) {
  const left = dock(opts.left), right = dock(opts.right);
  const cbs = new Set<() => void>();
  const progress = opts.progress;
  const plugin = {
    app: { workspace: { leftSplit: left, rightSplit: right } },
    settings: { openInWritingMode: false },
    features: {
      get: (id: string) => (id === "goals" && progress ? { dailyProgress: { current: () => progress, onChange: (cb: () => void) => { cbs.add(cb); return () => cbs.delete(cb); } } } : undefined),
      onChange: () => () => undefined,
    },
  };
  const mode = new WritingMode(plugin as never);
  return { mode, left, right, plugin, cbs };
}

beforeAll(() => registerStrings(deskStrings));

describe("writing mode", () => {
  it("restores only the sidebars it collapsed", () => {
    const { mode, left, right } = make({ left: false, right: true });
    mode.enter();
    expect(document.body.classList.contains("escrita-writing-mode")).toBe(true);
    expect(left.collapse).toHaveBeenCalled();
    expect(right.collapse).not.toHaveBeenCalled();
    mode.exit();
    expect(left.expand).toHaveBeenCalled();
    expect(right.expand).not.toHaveBeenCalled();
    expect(document.body.classList.contains("escrita-writing-mode")).toBe(false);
    expect(document.querySelector(".escrita-writing-exit")).toBeNull();
  });

  it("shows the counter only with a daily goal and follows progress", () => {
    const { mode, cbs } = make({ left: true, right: true, progress: { words: 312, goal: 500 } });
    mode.enter();
    expect(document.querySelector(".escrita-writing-goal")?.textContent).toMatch(/312.*500/);
    expect(cbs.size).toBe(1);
    mode.exit();
    expect(document.querySelector(".escrita-writing-goal")).toBeNull();
    expect(cbs.size).toBe(0);
  });

  it("has no counter with goals off", () => {
    const { mode } = make({ left: true, right: true });
    mode.enter();
    expect(document.querySelector(".escrita-writing-goal")).toBeNull();
    mode.exit();
  });

  it("notifies once per session and on each change; enter and exit are idempotent", () => {
    notices.length = 0;
    const { mode } = make({ left: true, right: true });
    const seen: boolean[] = [];
    mode.onChange((a) => seen.push(a));
    mode.enter(); mode.enter(); mode.exit(); mode.exit(); mode.toggle(); mode.unload();
    expect(seen).toEqual([true, false, true, false]);
    expect(notices.length).toBe(1);
    expect(document.body.classList.contains("escrita-writing-mode")).toBe(false);
  });
});
