// The names fixtures (task 0.2) through the matcher (task 1.2). Expected values were
// written from the specs, not from the code.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileTerms, findNames, pickEntry, type NameSource } from "../src/core/names";
import { readerMask } from "../src/core/wordcount";
import { segment } from "../src/core/markdown";

const read = (n: string) => readFileSync(new URL(`./fixtures/names/${n}`, import.meta.url), "utf8");
const rows = (s: string) => s.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));

interface Entry { src: NameSource; lang: string; scopes: string[]; kind: string }

const entries: Entry[] = rows(read("entries.tsv")).map((c) => {
  const o = new Map(c[4].split(";").map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)] as const));
  return {
    lang: o.get("lang")!,
    scopes: (o.get("scope") ?? "base").split("|"),
    kind: c[3],
    src: {
      id: c[0], name: c[1], aliases: c[2] ? c[2].split("|") : [], person: c[3] === "character",
      firstName: o.get("firstName") !== "false", caseSensitive: o.get("caseSensitive") === "true",
      ignore: o.get("ignore") ? o.get("ignore")!.split("|") : [],
    },
  };
});

for (const lang of ["pt", "en"] as const) {
  const text = read(`${lang}-expected.tsv`);
  const scopeOf = new Map<string, string[]>();
  for (const l of text.split("\n")) {
    const c = l.split("\t");
    if (c[0] === "#scope") scopeOf.set(c[1], c[2].split(","));
  }
  const expected = rows(text);
  const files = [...new Set(expected.map((r) => r[0]))];

  describe(`names matcher on fixtures (${lang})`, () => {
    for (const file of files) {
      it(file, () => {
        const scopes = scopeOf.get(file) ?? ["base"];
        const sources = entries.filter((e) => e.lang === lang && e.scopes.some((s) => scopes.includes(s))).map((e) => e.src);
        const table = compileTerms(sources, { lang, extraTitles: [] });
        const src = read(file);
        const found = findNames(readerMask(segment(src)), table)
          .map((o) => ({ o, id: pickEntry(o, () => true) }))
          .filter((x) => x.id !== null);
        const lineStart = [0];
        for (let i = 0; i < src.length; i++) if (src[i] === "\n") lineStart.push(i + 1);

        const want = expected.filter((r) => r[0] === file);
        const claimed = new Set<number>();
        let prevEnd = new Map<number, number>();
        for (const [, lineStr, raw, id] of want) {
          const line = Number(lineStr);
          const needle = raw.replace(/\\n/g, "\n");
          const base = lineStart[line - 1];
          const at = src.indexOf(needle, base + (prevEnd.get(line) ?? 0));
          expect(at, `${file}:${line} ${raw}`).toBeGreaterThanOrEqual(0);
          prevEnd.set(line, at + needle.length - base);
          const end = at + needle.length;
          const inside = found.filter((x) => x.o.from >= at && x.o.to <= end);
          if (id === "-") {
            expect(inside.map((x) => `${x.o.text}->${x.id}`), `${file}:${line} "${raw}" must not match`).toEqual([]);
          } else {
            expect(inside.map((x) => x.id), `${file}:${line} "${raw}"`).toEqual([id]);
            inside.forEach((x) => claimed.add(found.indexOf(x)));
          }
        }
        const extra = found.filter((_, i) => !claimed.has(i)).map((x) => `${x.o.text}->${x.id}`);
        expect(extra, "mentions nobody expected").toEqual([]);
      });
    }
  });
}
