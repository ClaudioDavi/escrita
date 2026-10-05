import { describe, expect, it } from "vitest";
import { readinessOf, unclosedComment, unclosedHtmlComment } from "../src/core/readiness";
import { segment } from "../src/core/markdown";
import { runChecks } from "../src/publish/checks";

const o = { placeholderMarker: "XXX" };
const find = (r: ReturnType<typeof readinessOf>, id: string) => r.checks.find((c) => c.id === id)!;

describe("unclosedHtmlComment", () => {
  it("is null for closed comments and plain text", () => {
    expect(unclosedHtmlComment("a <!-- b --> c")).toBeNull();
    expect(unclosedHtmlComment("a\n<!--\nlong\n\nnote\n-->\nb")).toBeNull();
    expect(unclosedHtmlComment("")).toBeNull();
  });
  it("finds the line of an unclosed opener", () => {
    expect(unclosedHtmlComment("um\n<!-- três\nquatro")).toBe(1);
    expect(unclosedHtmlComment("um\n   <!-- três")).toBe(1);
    expect(unclosedHtmlComment("<!-- a -->\nb\n<!-- c")).toBe(2);
  });
  it("ignores a mid-line or deeply indented opener (D19: literal text)", () => {
    expect(unclosedHtmlComment("um\ndois <!-- três\nquatro")).toBeNull();
    expect(unclosedHtmlComment("um\n    <!-- três")).toBeNull();
    expect(unclosedHtmlComment("a <!-- x\n<!-- y")).toBe(1);
  });
  it("ignores code, frontmatter and %% comments", () => {
    expect(unclosedHtmlComment("use `<!--` aqui")).toBeNull();
    expect(unclosedHtmlComment("a\n```\n<!--\n```\nb")).toBeNull();
    expect(unclosedHtmlComment("---\nx: \"<!--\"\n---\ntexto")).toBeNull();
    expect(unclosedHtmlComment("a %% <!-- %% b")).toBeNull();
    expect(unclosedHtmlComment("---\nx: 1\n---\n<!-- aberto")).toBe(3);
  });
  it("accepts a segmented Markdown", () => {
    expect(unclosedHtmlComment(segment("a\n<!-- b"))).toBe(1);
  });
});

describe("readinessOf", () => {
  it("passes a clean note, every check listed", () => {
    const r = readinessOf("Um farol.", o);
    expect(r.checks.map((c) => [c.id, c.level])).toEqual([
      ["unclosedComment", "passed"], ["unclosedHtmlComment", "passed"], ["placeholders", "passed"],
      ["unwrittenBeats", "passed"], ["emptyBody", "passed"],
    ]);
    expect(r.blocked).toBe(false);
  });
  it("blocks on unclosed %% and <!--", () => {
    expect(find(readinessOf("a\n%% b", o), "unclosedComment")).toMatchObject({ level: "blocker", line: 1, vars: { line: 2 } });
    const r = readinessOf("a\n<!-- c", o);
    expect(find(r, "unclosedHtmlComment")).toMatchObject({ level: "blocker", line: 1, vars: { line: 2 } });
    expect(r.blocked).toBe(true);
  });
  it("blocks placeholders, warns on unwritten beats, blocks an empty body", () => {
    const r = readinessOf("texto\n\n%% XXX: nome %%\n\n%% beat: chegada %%\n", o);
    expect(find(r, "placeholders")).toMatchObject({ level: "blocker", vars: { n: 1 } });
    expect(find(r, "unwrittenBeats").level).toBe("warning");
    expect(readinessOf("---\na: 1\n---\n", o)).toMatchObject({ blocked: true });
    expect(find(readinessOf("", o), "emptyBody").level).toBe("blocker");
  });
  it("uses the marker word it is given", () => {
    expect(find(readinessOf("t\n\n%% TODO: x %%\n", { placeholderMarker: "TODO" }), "placeholders").level).toBe("blocker");
    expect(find(readinessOf("t\n\n%% TODO: x %%\n", o), "placeholders").level).toBe("passed");
  });
  it("keeps the odd %% inside <!-- --> a blocker", () => {
    expect(unclosedComment("a <!-- %% --> b")).toBe(0);
  });
});

describe("publish uses readiness", () => {
  const ctx = { placeholderMarker: "XXX", recommendedProperties: [] };
  it("lists the html check only when it blocks", () => {
    expect(runChecks("Texto.", {}, ctx).some((c) => c.id === "unclosedHtmlComment")).toBe(false);
    const c = runChecks("Texto\n\n<!-- aberto", {}, ctx).find((x) => x.id === "unclosedHtmlComment")!;
    expect(c.level).toBe("blocker");
  });
});
