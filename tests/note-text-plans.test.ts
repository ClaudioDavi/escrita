import { describe, it, expect } from "vitest";
import { applyChange, guardedEdit, replaceIfExact, vaultText } from "../src/core/note-text";

const text = "one\ntwo\nthree\n";

describe("guardedEdit", () => {
  it("applies the edit as the smallest change when the guard holds", () => {
    const plan = guardedEdit((t) => t.includes("two"), (t) => t.replace("two", "2"));
    const c = plan(text)!;
    expect(c).toEqual({ from: 4, to: 7, insert: "2" });
    expect(applyChange(text, c)).toBe("one\n2\nthree\n");
  });
  it("refuses when the guard fails, without running the edit", () => {
    let ran = false;
    const plan = guardedEdit(() => false, (t) => { ran = true; return t; });
    expect(plan(text)).toBeNull();
    expect(ran).toBe(false);
  });
  it("runs without a guard", () => {
    expect(guardedEdit(null, (t) => t + "x")(text)).toEqual({ from: text.length, to: text.length, insert: "x" });
  });
  it("refuses when the edit answers null, and lets it throw to refuse with a message", () => {
    expect(guardedEdit(null, () => null)(text)).toBeNull();
    expect(() => guardedEdit(null, () => { throw new Error("blocked"); })(text)).toThrow("blocked");
  });
  it("an unchanged text is an identity change", () => {
    expect(guardedEdit(null, (t) => t)(text)).toEqual({ from: text.length, to: text.length, insert: "" });
  });
  it("works through a vault port and leaves the text alone on refusal", async () => {
    let doc = text;
    const port = vaultText({ read: async () => doc, process: async (fn) => (doc = fn(doc)) });
    const refused = await port.apply(guardedEdit(() => false, () => "zzz"));
    expect(refused.ok).toBe(false);
    expect(doc).toBe(text);
    const done = await port.apply(guardedEdit(null, (t) => t.toUpperCase()));
    expect(done.ok).toBe(true);
    expect(doc).toBe("ONE\nTWO\nTHREE\n");
  });
});

describe("replaceIfExact", () => {
  it("replaces only while the exact text is at the place", () => {
    const plan = replaceIfExact(4, 7, "two", "2");
    expect(plan(text)).toEqual({ from: 4, to: 7, insert: "2" });
    expect(plan("one\ntwx\nthree\n")).toBeNull();
    expect(plan("XX" + text)).toBeNull(); // moved: not searched for
    expect(plan("one")).toBeNull(); // offsets outside the text
  });
});
