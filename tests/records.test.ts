import { describe, it, expect } from "vitest";
import { safeEntries, isRecord, resolveTemplate } from "../src/core/records";
import { cleanExportChoices, cleanReadPositions } from "../src/data";
import { cleanLeftOff } from "../src/core/left-off";
import { cleanPovColors } from "../src/outline/pov";
import { cleanDismissed } from "../src/lens/dismiss";
import { cleanSeen } from "../src/universe/first-seen";

const evil = (inner: unknown) => JSON.parse(`{"__proto__": ${JSON.stringify(inner)}, "ok": ${JSON.stringify(inner)}}`);

describe("saved-data cleaners skip __proto__", () => {
  it("safeEntries drops the key and non-records give nothing", () => {
    expect(safeEntries(evil(1)).map(([k]) => k)).toEqual(["ok"]);
    expect(safeEntries([1, 2])).toEqual([]);
    expect(safeEntries(null)).toEqual([]);
    expect(isRecord([])).toBe(false);
  });
  const clean = (out: object) => {
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.keys(out)).not.toContain("__proto__");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  };
  it("export choices", () => {
    const c = { format: "docx", preset: "shunn", whole: true };
    const out = cleanExportChoices(evil(c));
    expect(Object.keys(out)).toEqual(["ok"]);
    clean(out);
  });
  it("read positions", () => {
    const out = cleanReadPositions(evil({ chapter: "a.md", line: 1 }));
    expect(Object.keys(out)).toEqual(["ok"]);
    clean(out);
  });
  it("left off", () => {
    const out = cleanLeftOff(evil({ offset: 1, before: "a", after: "b", at: 2 }));
    expect(Object.keys(out)).toEqual(["ok"]);
    clean(out);
  });
  it("pov colours", () => {
    const out = cleanPovColors(JSON.parse('{"__proto__": "red", "a": "red"}'));
    expect(Object.keys(out)).not.toContain("__proto__");
    clean(out);
  });
  it("dismissed", () => {
    const d = [{ rule: "repeats", text: "x", before: "", after: "" }];
    const out = cleanDismissed(evil(d));
    expect(Object.keys(out)).not.toContain("__proto__");
    clean(out);
  });
  it("first seen", () => {
    const out = cleanSeen(JSON.parse('{"__proto__": {"a": 5}, "n.md": {"__proto__": 5, "k": 7}}'));
    expect(out).toEqual({ "n.md": { k: 7 } });
    clean(out);
  });
});

describe("resolveTemplate", () => {
  type F = { md: boolean };
  const isMd = (f: unknown): f is F => !!f && (f as F).md === true;
  const files: Record<string, unknown> = {};
  const get = (p: string) => files[p];
  it("prefers the .md file over a folder or other file of the same name", () => {
    const md = { md: true };
    expect(resolveTemplate("T", get, isMd)).toBeNull();
    files["T"] = { folder: true };
    expect(resolveTemplate("T", get, isMd)).toBeNull();
    files["T.md"] = md;
    expect(resolveTemplate("T", get, isMd)).toBe(md);
    delete files["T.md"];
    files["T"] = { md: false };
    expect(resolveTemplate("T", get, isMd)).toBeNull();
  });
  it("accepts a path that already ends in .md", () => {
    const md = { md: true };
    files["X/T.md"] = md;
    expect(resolveTemplate("X/T.md", get, isMd)).toBe(md);
  });
});
