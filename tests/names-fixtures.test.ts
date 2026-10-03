// Well-formedness of the names fixtures (0.7 task 0.2). They are data for the matcher
// tests (task 1.2); this only checks that they parse and agree with each other.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (n: string) => readFileSync(new URL(`./fixtures/names/${n}`, import.meta.url), "utf8");
const rows = (s: string) => s.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));

interface Entry { id: string; name: string; aliases: string[]; kind: string; opts: Map<string, string> }

const KINDS = new Set(["character", "place", "object", "group", "event"]);
const OPT_KEYS = new Set(["lang", "scope", "caseSensitive", "firstName", "ignore"]);

const entries: Entry[] = rows(read("entries.tsv")).map((c) => {
  expect(c, c.join("|")).toHaveLength(5);
  const opts = new Map<string, string>();
  for (const kv of c[4].split(";")) {
    const i = kv.indexOf("=");
    expect(i, kv).toBeGreaterThan(0);
    opts.set(kv.slice(0, i), kv.slice(i + 1));
  }
  return { id: c[0], name: c[1], aliases: c[2] ? c[2].split("|") : [], kind: c[3], opts };
});

describe("names fixtures: entries.tsv", () => {
  it("has unique ids, known kinds and known option keys", () => {
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    for (const e of entries) {
      expect(KINDS.has(e.kind), e.id).toBe(true);
      expect(["pt", "en"]).toContain(e.opts.get("lang"));
      for (const k of e.opts.keys()) expect(OPT_KEYS.has(k), `${e.id}: ${k}`).toBe(true);
    }
  });
});

for (const lang of ["pt", "en"]) {
  const text = read(`${lang}-expected.tsv`);
  const scopes = new Map<string, string[]>();
  for (const l of text.split("\n")) {
    const c = l.split("\t");
    if (c[0] === "#scope") scopes.set(c[1], c[2].split(","));
  }
  const expected = rows(text);

  describe(`names fixtures: ${lang}-expected.tsv`, () => {
    it("starts with a header comment and every fixture file has one", () => {
      expect(text.startsWith("# ")).toBe(true);
      for (const f of new Set(expected.map((r) => r[0]))) {
        expect(read(f).split("\n").slice(0, 6).some((l) => l.startsWith("%% ")), f).toBe(true);
      }
    });

    it("points at real text and real entries, in order of position", () => {
      const last = new Map<string, { line: number; end: number }>();
      for (const [file, lineStr, raw, id] of expected) {
        const lines = read(file).split("\n");
        const line = Number(lineStr);
        expect(Number.isInteger(line) && line >= 1 && line <= lines.length, `${file}:${lineStr}`).toBe(true);
        const needle = raw.replace(/\\n/g, "\n");
        const rest = lines.slice(line - 1).join("\n");
        const prev = last.get(file);
        const from = prev && prev.line === line ? prev.end : 0;
        const at = rest.indexOf(needle, from);
        expect(at, `${file}:${line} "${raw}"`).toBeGreaterThanOrEqual(0);
        // The text starts on the stated line, not a later one.
        expect(rest.slice(0, at).includes("\n") && at > lines[line - 1].length, `${file}:${line} "${raw}" starts later`).toBe(false);
        last.set(file, { line, end: at + needle.length });
        if (id !== "-") {
          const e = entries.find((x) => x.id === id);
          expect(e, `${file}:${line} entry ${id}`).toBeTruthy();
          expect(e!.opts.get("lang")).toBe(lang);
          const loaded = scopes.get(file) ?? ["base"];
          const own = (e!.opts.get("scope") ?? "base").split("|");
          expect(own.some((s) => loaded.includes(s)), `${file}:${line} ${id} not in scope`).toBe(true);
        }
      }
    });

    it("has at least one mention and one non-mention", () => {
      expect(expected.some((r) => r[3] !== "-")).toBe(true);
      expect(expected.some((r) => r[3] === "-")).toBe(true);
    });
  });
}
