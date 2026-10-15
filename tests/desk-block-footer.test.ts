// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Keymap } from "obsidian";
import "./support/dom-setup";
import { registerStrings } from "../src/i18n";
import { deskStrings } from "../src/desk/strings";
import { DeskBlock } from "../src/desk/render";
import type { Gathered } from "../src/desk/gather";
import type EscritaPlugin from "../src/main";

// the test stand-in for obsidian has no Keymap.isModifier (render.ts reads it on a click)
beforeAll(() => {
  registerStrings(deskStrings);
  (Keymap as unknown as { isModifier: () => boolean }).isModifier = () => false;
});

const line = { path: "Contos/A.md", title: "A", fact: { kind: "none" } };

function render(opts: { works: boolean; book: boolean; notice?: boolean }) {
  const start = vi.fn();
  const plugin = {
    settings: { stages: {} },
    newWork: { start, offers: (k: string) => k !== "book" || opts.book },
    works: { onChange: () => () => {}, onReady: () => () => {}, isReady: () => false },
    measure: { onChange: () => () => {} },
    features: { onChange: () => () => {}, get: () => undefined, isOn: () => false },
  } as unknown as EscritaPlugin;
  const el = document.createElement("div");
  const block = new DeskBlock(plugin, el, "", { onChange: () => () => {} } as never);
  const g: Gathered = {
    model: { writing: opts.works ? [line as never] : [], revising: [], counts: [] },
    folders: [],
    notices: opts.notice ? [{ kind: "noWorks" }] : [],
    shown: new Set(),
  };
  const b = block as unknown as { last: Gathered; paint(): void; onload(): void };
  b.onload();
  b.last = g;
  b.paint();
  return { el, start };
}

const buttons = (el: HTMLElement) => Array.from(el.querySelectorAll(".escrita-desk-new button")).map((b) => b.textContent);

describe("the home block footer", () => {
  it("is drawn with works, with an empty model and with a notice", () => {
    for (const o of [{ works: true }, { works: false }, { works: false, notice: true }]) {
      const { el } = render({ ...o, book: true });
      expect(el.querySelector(".escrita-desk-new")).not.toBeNull();
      expect(buttons(el)).toEqual(["+ New short story", "+ New book"]);
    }
  });
  it("hides the book button when books are not offered", () => {
    const { el } = render({ works: true, book: false });
    expect(buttons(el)).toEqual(["+ New short story"]);
    expect(el.querySelector(".escrita-desk-new .escrita-desk-dot")).toBeNull();
  });
  it("starts the right kind on click", () => {
    const { el, start } = render({ works: false, book: true });
    el.querySelector<HTMLElement>('[data-escrita-key="new:book"]')!.click();
    expect(start).toHaveBeenLastCalledWith("book");
    el.querySelector<HTMLElement>('[data-escrita-key="new:story"]')!.click();
    expect(start).toHaveBeenLastCalledWith("story");
  });
});
