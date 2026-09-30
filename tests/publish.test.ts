import { describe, it, expect } from "vitest";
import {
  hasBlockers, isFilled, isPublished, runChecks, sortChecks,
  unclosedComment, type Check, type CheckContext, type CheckId,
} from "../src/publish/checks";

const PIECE = { targetProperty: "target", limitProperty: "limit", unitProperty: "unit" };
const ctx = (over: Partial<CheckContext> = {}): CheckContext => ({
  placeholderMarker: "XXX",
  recommendedProperties: ["description"],
  piece: PIECE,
  ...over,
});
const find = (checks: Check[], id: CheckId) => checks.find((c) => c.id === id);
const CLEAN = "---\nstatus: pronto\ndescription: Um farol.\n---\nA luz girava sobre o mar.\n";

describe("unclosedComment", () => {
  it("is null when every comment is closed, even across lines", () => {
    expect(unclosedComment("a %% b %% c")).toBeNull();
    expect(unclosedComment("a %%\nlonga\n\nnota\n%% b")).toBeNull();
    expect(unclosedComment("")).toBeNull();
  });
  it("returns the line where the unclosed comment opens", () => {
    expect(unclosedComment("um\ndois %% três\nquatro")).toBe(1);
    expect(unclosedComment("%% a %%\nb\n%% c")).toBe(2);
  });
  it("counts lines from the top of the file, frontmatter included, and ignores %% in it", () => {
    expect(unclosedComment("---\nx: \"%%\"\n---\ntexto %% aberto")).toBe(3);
    expect(unclosedComment("---\nx: \"%%\"\n---\ntexto")).toBeNull();
  });
  it("handles CRLF", () => {
    expect(unclosedComment("---\r\na: 1\r\n---\r\num\r\n%% dois\r\n")).toBe(4);
    expect(unclosedComment("um %%\r\ndois %%\r\n")).toBeNull();
  });
  it("ignores %% inside inline code", () => {
    expect(unclosedComment("use `%%` para comentar")).toBeNull();
    expect(unclosedComment("use `%%` e %% isto")).toBe(0);
  });
  it("ignores %% inside fenced code", () => {
    expect(unclosedComment("a\n```\n%% not a comment\n```\nb")).toBeNull();
    expect(unclosedComment("a\n~~~\n%%\n~~~\n%% open")).toBe(4);
  });
});

describe("isPublished, isFilled", () => {
  it("compares status trimmed and case-insensitive", () => {
    expect(isPublished(" Publicado ", "publicado")).toBe(true);
    expect(isPublished("pronto", "publicado")).toBe(false);
    expect(isPublished(undefined, "publicado")).toBe(false);
    expect(isPublished("", "")).toBe(false);
  });
  it("treats blank, null and empty lists as missing", () => {
    expect(isFilled("x")).toBe(true);
    expect(isFilled(0)).toBe(true);
    expect(isFilled(" ")).toBe(false);
    expect(isFilled(null)).toBe(false);
    expect(isFilled([])).toBe(false);
    expect(isFilled([""])).toBe(false);
  });
});

describe("runChecks", () => {
  it("passes a clean note", () => {
    const checks = runChecks(CLEAN, { description: "Um farol." }, ctx());
    expect(checks.map((c) => [c.id, c.level])).toEqual([
      ["unclosedComment", "passed"],
      ["placeholders", "passed"],
      ["unwrittenBeats", "passed"],
      ["emptyBody", "passed"],
      ["recommended", "passed"],
    ]);
    expect(hasBlockers(checks)).toBe(false);
  });

  it("counts past a %% inside code for the limit and empty-body checks", () => {
    const words = Array.from({ length: 200 }, (_, i) => `w${i}`).join(" ");
    const inline = runChecks(`---\nlimit: 50\n---\nIntro \`%%\` here.\n\n${words}\n`, { limit: 50 }, ctx());
    expect(find(inline, "overLimit")!.level).not.toBe("passed");
    expect(find(inline, "overLimit")!.vars.count).toBe(202);
    expect(find(inline, "unclosedComment")!.level).toBe("passed");
    const fenced = runChecks(`---\nlimit: 50\n---\n\`\`\`\n%%\n\`\`\`\n\n${words}\n`, { limit: 50 }, ctx());
    expect(find(fenced, "emptyBody")!.level).toBe("passed");
    expect(find(fenced, "overLimit")!.vars.count).toBe(200);
  });

  it("blocks an unclosed comment and shows its line", () => {
    const c = find(runChecks("---\na: 1\n---\nA luz.\n\n%% resto escondido\nMais.", {}, ctx()), "unclosedComment")!;
    expect(c.level).toBe("blocker");
    expect(c.line).toBe(5);
    expect(c.vars.line).toBe(6);
  });

  it("blocks placeholders and lists them with lines", () => {
    const text = "---\na: 1\n---\nA luz %% XXX: conferir %% girava.\n\nO mar %% XXX %%.\n";
    const c = find(runChecks(text, {}, ctx()), "placeholders")!;
    expect(c.level).toBe("blocker");
    expect(c.items).toEqual([{ text: "conferir", line: 3 }, { text: "", line: 5 }]);
    expect(c.line).toBe(3);
    expect(c.vars.n).toBe(2);
  });

  it("uses the configured placeholder marker and ignores ones in code", () => {
    const text = "A luz %% TODO: ver %% girava.\n`%% TODO: exemplo %%`\n```\n%% TODO: código %%\n```\n";
    const c = find(runChecks(text, {}, ctx({ placeholderMarker: "TODO" })), "placeholders")!;
    expect(c.items).toEqual([{ text: "ver", line: 0 }]);
  });

  it("warns about unwritten beats only", () => {
    const text = "%% beat: Chegada %%\nEla chegou.\n\n---\n\n%% beat: Partida %%\n";
    const c = find(runChecks(text, {}, ctx()), "unwrittenBeats")!;
    expect(c.level).toBe("warning");
    expect(c.items).toEqual([{ text: "Partida", line: 5 }]);
  });

  it("blocks an empty body, including a note whose only content is comments", () => {
    expect(find(runChecks("---\ndescription: x\n---\n", { description: "x" }, ctx()), "emptyBody")!.level).toBe("blocker");
    expect(find(runChecks("", {}, ctx()), "emptyBody")!.level).toBe("blocker");
    const onlyComments = "%% uma ideia\nsolta %%\n%% beat: A %%\n%% XXX: escrever %%\n";
    const checks = runChecks(onlyComments, {}, ctx());
    expect(find(checks, "emptyBody")!.level).toBe("blocker");
    expect(find(checks, "unclosedComment")!.level).toBe("passed");
    expect(find(checks, "placeholders")!.level).toBe("blocker");
    expect(find(checks, "unwrittenBeats")!.level).toBe("warning");
  });

  it("treats text after an unclosed comment as hidden", () => {
    const checks = runChecks("%% tudo\nescondido", {}, ctx());
    expect(find(checks, "emptyBody")!.level).toBe("blocker");
    expect(find(checks, "unclosedComment")!.level).toBe("blocker");
  });

  it("works with CRLF line endings", () => {
    const text = "---\r\ndescription: x\r\n---\r\nA luz.\r\n\r\n%% XXX: ver %%\r\n%% beat: B %%\r\n";
    const checks = runChecks(text, { description: "x" }, ctx());
    expect(find(checks, "placeholders")!.items).toEqual([{ text: "ver", line: 5 }]);
    expect(find(checks, "unwrittenBeats")!.items).toEqual([{ text: "B", line: 6 }]);
    expect(find(checks, "emptyBody")!.level).toBe("passed");
  });

  it("warns about missing recommended properties, and is off with an empty list", () => {
    const c = find(runChecks(CLEAN, { description: " ", title: "x" }, ctx({ recommendedProperties: ["description", "Title", "tags"] })), "recommended")!;
    expect(c.level).toBe("warning");
    expect(c.vars.names).toBe("description, tags");
    expect(find(runChecks(CLEAN, {}, ctx({ recommendedProperties: [] })), "recommended")).toBeUndefined();
  });

  it("warns when over the piece's limit, in the piece's unit", () => {
    const text = "---\nlimit: 10\nunit: characters\n---\nA luz girava.\n"; // 13 characters
    const over = find(runChecks(text, { limit: 10, unit: "characters" }, ctx()), "overLimit")!;
    expect(over.level).toBe("warning");
    expect(over.vars).toEqual({ count: 13, limit: 10, over: 3, unit: "characters" });
    const ok = find(runChecks(text, { limit: "15.000", unit: "caracteres" }, ctx()), "overLimit")!;
    expect(ok.level).toBe("passed");
    expect(find(runChecks(text, { target: 5 }, ctx()), "overLimit")).toBeUndefined();
    expect(find(runChecks(text, { limit: 1 }, ctx({ piece: undefined })), "overLimit")).toBeUndefined();
  });

  it("sorts blockers first, keeping the order otherwise", () => {
    const checks = runChecks("%% beat: A %%\n", {}, ctx());
    expect(sortChecks(checks).map((c) => c.level)).toEqual(["blocker", "warning", "warning", "passed", "passed"]);
    expect(sortChecks(checks)[0].id).toBe("emptyBody");
  });
});
