import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { universeViewStrings } from "../src/universe/view-strings";

const css = readFileSync("src/universe/view.css", "utf8");
const src = readFileSync("src/universe/view-entries.ts", "utf8");

describe("universe entry more button (MOBILE-1.0 F2)", () => {
  it("has an aria-label in both languages", () => {
    expect(universeViewStrings.en["universe.view.entryMore"]).toBeTruthy();
    expect(universeViewStrings["pt-BR"]["universe.view.entryMore"]).toBeTruthy();
    expect(src).toContain('t("universe.view.entryMore")');
  });
  it("opens the same menu as the context menu", () => {
    expect(src).toContain("moreButton(row, () => entryMenu(ctx, e))");
    expect(src).toContain("entryMenu(ctx, e).showAtMouseEvent");
  });
  it("is at least 32px, hidden only off mobile until hover or focus", () => {
    expect(css).toMatch(/\.escrita-universe-entry-more \{[^}]*min-width: 32px;[^}]*min-height: 32px;/);
    expect(css).toMatch(/body:not\(\.is-mobile\) \.escrita-universe-entry \.escrita-universe-entry-more \{\s*opacity: 0;/);
    expect(css).toContain(":focus-within .escrita-universe-entry-more");
  });
});
