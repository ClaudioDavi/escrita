import { describe, it, expect } from "vitest";
import { recenters, typewriterMargin, type TypewriterTransaction } from "../src/core/typewriter";

function tr(userEvent: string | undefined, o: Partial<TypewriterTransaction> = {}): TypewriterTransaction {
  return { userEvent, docChanged: false, selectionMoved: false, selectionEmpty: true, ...o };
}

describe("recenters", () => {
  it("is true for the events that should recenter", () => {
    expect(recenters(tr("select", { selectionMoved: true }), true)).toBe(true);
    expect(recenters(tr("input.type", { docChanged: true }), true)).toBe(true);
    expect(recenters(tr("delete.backward", { docChanged: true }), true)).toBe(true);
    expect(recenters(tr("undo", { docChanged: true }), true)).toBe(true);
    expect(recenters(tr("redo", { docChanged: true }), true)).toBe(true);
    expect(recenters(tr("select.undo", { selectionMoved: true }), true)).toBe(true);
    expect(recenters(tr("move.line", { docChanged: true }), true)).toBe(true);
  });
  it("is false for pointer events", () => {
    expect(recenters(tr("select.pointer", { selectionMoved: true }), true)).toBe(false);
    expect(recenters(tr("move.drop", { docChanged: true, selectionMoved: true }), true)).toBe(false);
    expect(recenters(tr("input.drop", { docChanged: true, selectionMoved: true }), true)).toBe(false);
  });
  it("is false for a plain select that has a range or did not move", () => {
    expect(recenters(tr("select", { selectionMoved: true, selectionEmpty: false }), true)).toBe(false);
    expect(recenters(tr("select"), true)).toBe(false);
    expect(recenters(tr("select.search", { selectionMoved: true }), true)).toBe(false);
  });
  it("is false with no event, when inactive, with nothing changed, or for foreign events", () => {
    expect(recenters(tr(undefined, { docChanged: true, selectionMoved: true }), true)).toBe(false);
    expect(recenters(tr("input.type", { docChanged: true }), false)).toBe(false);
    expect(recenters(tr("input.type"), true)).toBe(false);
    expect(recenters(tr("escrita.foo", { docChanged: true, selectionMoved: true }), true)).toBe(false);
    expect(recenters(tr("inputx", { docChanged: true }), true)).toBe(false);
  });
});

describe("typewriterMargin", () => {
  it("is 0 for zero, negative or non-finite heights", () => {
    expect(typewriterMargin(0)).toBe(0);
    expect(typewriterMargin(NaN)).toBe(0);
    expect(typewriterMargin(-5)).toBe(0);
    expect(typewriterMargin(Infinity)).toBe(0);
  });
  it("is two thirds, rounded", () => {
    expect(typewriterMargin(762)).toBe(508);
    expect(typewriterMargin(100)).toBe(67);
  });
});
