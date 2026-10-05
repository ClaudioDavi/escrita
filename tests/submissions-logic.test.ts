import { describe, expect, it } from "vitest";
import {
  canRecord, dayOf, isPending, parseWorkLink, pendingList, recentMarkets, resultValues, rowOf,
  submissionFileName, submissionPath, submissionText, validDay, whereParts, workFor, yamlValue,
  type PlacementLike, type SubmissionRow,
} from "../src/submissions/logic";

const row = (o: Partial<SubmissionRow> = {}): SubmissionRow => ({ work: "[[A]]", market: "M", sent: "2026-10-01", result: "pending", ...o });

describe("rows", () => {
  it("reads frontmatter, tolerating junk", () => {
    expect(rowOf({ work: "[[A]]", market: " Pessoa ", sent: "2026-10-05", result: "pending" }))
      .toEqual({ work: "[[A]]", market: "Pessoa", sent: "2026-10-05", result: "pending" });
    expect(rowOf(undefined)).toEqual({ work: "", market: "", sent: null, result: "" });
    expect(rowOf({ sent: "ontem", market: 7, work: ["[[A]]"] })).toMatchObject({ sent: null, market: "7", work: "[[A]]" });
  });
  it("reads dates in the shapes YAML gives", () => {
    expect(dayOf("2026-10-05T10:00")).toBe("2026-10-05");
    expect(dayOf(new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(dayOf("2026-13-05")).toBeNull();
    expect(dayOf("2026-02-31")).toBeNull();
    expect(dayOf("2026-04-31")).toBeNull();
    expect(dayOf("2024-02-29")).toBe("2024-02-29");
    expect(dayOf(5)).toBeNull();
  });
  it("result values come from the setting, first is pending", () => {
    expect(resultValues("pending, accepted\nrejected, pending")).toEqual(["pending", "accepted", "rejected"]);
    expect(resultValues("")).toEqual(["pending"]);
    expect(isPending(row({ result: "Pending" }), "pending")).toBe(true);
    expect(isPending(row({ result: "" }), "pending")).toBe(false);
    expect(isPending(row({ result: "accepted" }), "pending")).toBe(false);
  });
});

describe("work links", () => {
  it("parses wikilinks with path, heading and alias", () => {
    expect(parseWorkLink("[[Cartas de Lisboa]]")).toEqual({ target: "Cartas de Lisboa", label: "Cartas de Lisboa" });
    expect(parseWorkLink('"[[Contos/Domingo#x|Dom]]"')).toEqual({ target: "Contos/Domingo", label: "Dom" });
    expect(parseWorkLink("Domingo")).toBeNull();
    expect(parseWorkLink("[[]]")).toBeNull();
  });
});

describe("pendingList", () => {
  const resolve = (target: string) => (target === "Gone" ? null : `Contos/${target}.md`);
  it("keeps pending only, newest sent first, undated last", () => {
    const list = pendingList([
      ["S/a.md", row({ work: "[[Cartas]]", sent: "2026-09-12", market: "Sesc" })],
      ["S/b.md", row({ work: "[[Domingo]]", sent: "2026-10-05", market: "Pessoa" })],
      ["S/c.md", row({ result: "accepted" })],
      ["S/d.md", row({ sent: null })],
    ], "pending", resolve);
    expect(list.map((p) => p.path)).toEqual(["S/b.md", "S/a.md", "S/d.md"]);
    expect(list[0]).toEqual({ path: "S/b.md", workPath: "Contos/Domingo.md", workTitle: "Domingo", market: "Pessoa", sent: "2026-10-05" });
  });
  it("a work sent twice counts twice; an unresolved link keeps its text", () => {
    const list = pendingList([
      ["S/a.md", row({ work: "[[Gone]]" })],
      ["S/b.md", row({ work: "[[Gone]]" })],
    ], "pending", resolve);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ workPath: null, workTitle: "Gone" });
  });
});

describe("recentMarkets", () => {
  it("three most recent, distinct, case-insensitive", () => {
    const rows = [
      row({ market: "A", sent: "2026-01-01" }), row({ market: "B", sent: "2026-03-01" }), row({ market: "a", sent: "2026-04-01" }),
      row({ market: "C", sent: "2026-02-01" }), row({ market: "D", sent: "2025-01-01" }), row({ market: "", sent: "2026-05-01" }),
      row({ market: "E", sent: null }),
    ];
    expect(recentMarkets(rows)).toEqual(["a", "B", "C"]);
    expect(recentMarkets([])).toEqual([]);
  });
});

describe("names and text", () => {
  it("names the file YYYY-MM-DD work – market", () => {
    expect(submissionFileName("2026-10-05", "Cartas de Lisboa", "Revista Pessoa")).toBe("2026-10-05 Cartas de Lisboa – Revista Pessoa.md");
    expect(submissionFileName("2026-10-05", "Cartas", "/")).toBe("2026-10-05 Cartas.md");
    expect(submissionFileName("2026-10-05", "A/B", 'Rev: "X"?')).toBe("2026-10-05 A B – Rev X.md");
    expect(submissionPath("Submissions/", "2026-10-05", "W", "M")).toBe("Submissions/2026-10-05 W – M.md");
  });
  it("writes plain frontmatter and an empty body", () => {
    expect(submissionText({ link: "[[Cartas de Lisboa]]", market: "Revista Pessoa", sent: "2026-10-05", result: "pending" })).toBe(
      '---\nwork: "[[Cartas de Lisboa]]"\nmarket: "Revista Pessoa"\nsent: 2026-10-05\nresult: pending\nresponded:\n---\n');
  });
  it("quotes what YAML would misread", () => {
    expect(yamlValue("pending")).toBe("pending");
    expect(yamlValue("aceito")).toBe("aceito");
    expect(yamlValue("no")).toBe('"no"');
    expect(yamlValue("em análise")).toBe('"em análise"');
    expect(submissionText({ link: "[[A]]", market: 'Say "hi": a\\b', sent: "2026-10-05", result: "x" })).toContain('market: "Say \\"hi\\": a\\\\b"');
  });
});

describe("form", () => {
  it("validates", () => {
    expect(validDay("2026-02-30")).toBe(false);
    expect(validDay("2026-10-05")).toBe(true);
    expect(canRecord("  ", "2026-10-05")).toBe(false);
    expect(canRecord("M", "")).toBe(false);
    expect(canRecord("M", "2026-10-05")).toBe(true);
  });
  it("splits the Creates line around its tokens", () => {
    expect(whereParts("Creates {path} with {work}, {result}.", { path: "p", work: "w", result: "r" })).toEqual([
      { text: "Creates ", code: false }, { text: "p", code: true }, { text: " with ", code: false },
      { text: "w", code: true }, { text: ", ", code: false }, { text: "r", code: true }, { text: ".", code: false },
    ]);
  });
});

describe("workFor", () => {
  const base: PlacementLike = { path: "Contos/A.md", kind: "note", markdown: true, tracked: true, submission: false, export: false, snapshot: false, stage: null, book: null };
  const book = { note: { path: "Livros/B.md" }, title: "B" };
  it("a chapter stands for its book", () => {
    expect(workFor({ ...base, kind: "chapter", book }, "c")).toEqual({ kind: "work", path: "Livros/B.md", title: "B", stage: null });
  });
  it("a book note is itself, with or without a stage", () => {
    expect(workFor({ ...base, kind: "book-note", book, stage: "draft" }, "B")).toMatchObject({ kind: "work", path: "Livros/B.md", stage: "draft" });
    expect(workFor({ ...base, kind: "book-note", book }, "B")).toMatchObject({ kind: "work" });
  });
  it("a tracked note with a stage is a work; without one it asks for a stage", () => {
    expect(workFor({ ...base, stage: "ready" }, "A")).toMatchObject({ kind: "work", path: "Contos/A.md" });
    expect(workFor(base, "Notas soltas")).toEqual({ kind: "no-stage", title: "Notas soltas" });
    expect(workFor({ ...base, tracked: false, stage: null }, "N")).toMatchObject({ kind: "no-stage" });
  });
  it("submissions, snapshots and non-notes are not works", () => {
    expect(workFor({ ...base, submission: true }, "S")).toEqual({ kind: "none" });
    expect(workFor({ ...base, snapshot: true }, "S")).toEqual({ kind: "none" });
    expect(workFor({ ...base, kind: "file", markdown: false }, "S")).toEqual({ kind: "none" });
    expect(workFor({ ...base, kind: "book-file", book }, "S")).toEqual({ kind: "none" });
  });
});
