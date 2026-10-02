import { describe, expect, it } from "vitest";
import { CONTEXT, contextAt, findRestoreOffset } from "../src/core/anchor";
import * as darlings from "../src/darlings/format";

describe("contextAt", () => {
  it("slices before and after the offset", () => {
    const doc = "a".repeat(200) + "|" + "b".repeat(200);
    const c = contextAt(doc, 200);
    expect(c.offset).toBe(200);
    expect(c.before).toBe("a".repeat(CONTEXT));
    expect(c.after).toBe("|" + "b".repeat(CONTEXT - 1));
  });
  it("clamps at the start and the end", () => {
    expect(contextAt("hello", 0)).toEqual({ offset: 0, before: "", after: "hello" });
    expect(contextAt("hello", 5)).toEqual({ offset: 5, before: "hello", after: "" });
    expect(contextAt("hello", 99).offset).toBe(5);
    expect(contextAt("hello", -3).offset).toBe(0);
  });
  it("keeps CRLF as is", () => {
    const c = contextAt("ab\r\ncd", 4, 3);
    expect(c.before).toBe("b\r\n");
    expect(c.after).toBe("cd");
  });
  it("honours a custom size", () => {
    expect(contextAt("abcdefgh", 4, 2)).toEqual({ offset: 4, before: "cd", after: "ef" });
  });
});

describe("shared with darlings", () => {
  it("re-exports the same function objects", () => {
    expect(darlings.findRestoreOffset).toBe(findRestoreOffset);
    expect(darlings.CONTEXT).toBe(CONTEXT);
  });
});
