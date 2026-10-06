// Unlinked mentions (0.9 task 1.2, U 2.5, Q1, Q17, Q22): the model over the real matcher and
// computeMentions, pinned to tests/fixtures/universe-names/expected.json.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { compileTerms, findNames, type NameSource } from "../src/core/names";
import { computeMentions, type NoteMentions } from "../src/universe/mentions";
import { unlinkedIn } from "../src/universe/unlinked";

const dir = new URL("./fixtures/universe-names/", import.meta.url);
const expected = JSON.parse(readFileSync(new URL("expected.json", dir), "utf8")) as {
  unlinked: Record<string, { entry: string; text: string; line: number }[]>;
};

const src = (path: string, aliases: string[], person: boolean): NameSource => ({
  id: path,
  name: path.replace(/^.*\//, "").replace(/\.md$/, ""),
  aliases,
  person,
  firstName: true,
  caseSensitive: false,
  ignore: [],
});
const sources = [
  src("Universo/Personagens/Beatriz Lemos.md", ["Bia"], true),
  src("Universo/Personagens/Teodoro Ramos.md", ["Teo"], true),
  src("Universo/Lugares/Porto Alto.md", ["Portinho"], false),
  src("Universo/Lugares/Serra Azul.md", [], false),
];
const table = compileTerms(sources, { lang: "pt", extraTitles: [] });
const byName = (linkpath: string): string | null => sources.find((s) => s.name === linkpath)?.id ?? null;

function run(text: string, inScope?: (id: string) => boolean) {
  const mentions = computeMentions(segment(text), (mask) => findNames(mask, table));
  const linked = new Set(mentions.links.map((l) => byName(l.linkpath)).filter((x): x is string => !!x));
  return unlinkedIn(mentions, linked, { text, inScope });
}

describe("unlinkedIn on the fixtures", () => {
  for (const [path, items] of Object.entries(expected.unlinked)) {
    it(`${path}`, () => {
      const text = readFileSync(new URL(path, dir), "utf8");
      const got = run(text).map((u) => ({ entry: u.entry, text: u.text, line: u.line + 1 }));
      expect(got).toEqual(items);
    });
  }

  it("offsets point at the text as written", () => {
    const text = readFileSync(new URL("Contos/A travessia.md", dir), "utf8");
    for (const u of run(text)) expect(text.slice(u.from, u.to)).toBe(u.text);
  });
});

describe("unlinkedIn rules", () => {
  const entry = "Universo/Personagens/Teodoro Ramos.md";
  const occ = (from: number, to: number, text: string, ids: string[]) => ({
    from, to, text, candidates: ids.map((id) => ({ id, exact: true, origin: "alias" as const })),
  });

  it("lists nothing for an entry the note links anywhere, even after the mention", () => {
    const text = "Teo veio.\nDepois [[Teodoro Ramos]].";
    expect(run(text)).toEqual([]);
  });

  it("is empty with no occurrences", () => {
    const m: NoteMentions = { occurrences: [], links: [] };
    expect(unlinkedIn(m, new Set(), { text: "" })).toEqual([]);
  });

  it("leaves out an occurrence that is still ambiguous, and honours the scope", () => {
    const other = "Universo/Personagens/Outro.md";
    const m: NoteMentions = { occurrences: [occ(0, 3, "Teo", [entry, other]), occ(4, 7, "Teo", [entry])], links: [] };
    const text = "Teo Teo";
    expect(unlinkedIn(m, new Set(), { text }).map((u) => u.from)).toEqual([4]);
    expect(unlinkedIn(m, new Set(), { text, inScope: (id) => id === entry }).map((u) => u.from)).toEqual([0, 4]);
    expect(unlinkedIn(m, new Set(), { text, inScope: () => false })).toEqual([]);
  });

  it("counts lines from the start of the text, frontmatter included", () => {
    const text = "---\na: b\n---\n\nTeo\n\n\nTeo";
    expect(run(text).map((u) => u.line)).toEqual([4, 7]);
  });
});
