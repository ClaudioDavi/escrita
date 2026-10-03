import { describe, it, expect } from "vitest";
import { closeThreadPlan, parseThreads, reopenThreadPlan, threadComment } from "../src/core/markers";
import { applyChange } from "../src/core/note-text";

const K = "thread";
const C = "closed";

describe("parseThreads", () => {
  it("reads an open thread with its place", () => {
    const src = "Intro\n%% thread: quem escreveu as cartas? %%\nMais.";
    const [t] = parseThreads(src, K, C);
    expect(t).toMatchObject({ line: 1, text: "quem escreveu as cartas?", closed: false, answeredBy: null });
    expect(src.slice(t.from, t.to)).toBe("%% thread: quem escreveu as cartas? %%");
    expect(t.raw).toBe("%% thread: quem escreveu as cartas? %%");
  });
  it("reads the closed form and an answer link with → or ->", () => {
    const src = "%% thread closed: quem? → [[A Casa]] %%\n%% thread: onde? -> [[O Farol]] %%\n%% thread closed: sem link %%";
    const ts = parseThreads(src, K, C);
    expect(ts.map((t) => [t.text, t.closed, t.answeredBy])).toEqual([
      ["quem?", true, "A Casa"],
      ["onde?", false, "O Farol"],
      ["sem link", true, null],
    ]);
  });
  it("takes the link target without alias or heading", () => {
    const [a, b] = parseThreads("%% thread: x → [[A Casa|a casa]] %%\n%% thread: y → [[A Casa#Cap 1]] %%", K, C);
    expect(a.answeredBy).toBe("A Casa");
    expect(b.answeredBy).toBe("A Casa");
  });
  it("a link in the middle is part of the text, not an answer", () => {
    const [t] = parseThreads("%% thread: see [[A Casa]] later %%", K, C);
    expect(t.answeredBy).toBeNull();
    expect(t.text).toBe("see [[A Casa]] later");
  });
  it("closed needs its colon, so a question starting with the word stays open", () => {
    const [t] = parseThreads("%% thread closed door, who? %%", K, C);
    expect(t.closed).toBe(false);
    expect(t.text).toBe("closed door, who?");
    expect(parseThreads("%% thread: closed door %%", K, C)[0].closed).toBe(false);
  });
  it("uses the configured keyword and ignores the others", () => {
    const src = "%% fio: quem? %%\n%% thread: outro %%\n%% fio fechado: feito %%";
    expect(parseThreads(src, "fio", "fechado").map((t) => t.text)).toEqual(["quem?", "feito"]);
    expect(parseThreads(src, "fio", "fechado")[1].closed).toBe(true);
    expect(parseThreads(src, K, C).map((t) => t.text)).toEqual(["outro"]);
  });
  it("does not match a longer word or a beat/placeholder", () => {
    expect(parseThreads("%% threads: x %%\n%% thread-x: y %%\n%% beat: a %%\n%% XXX: b %%", K, C)).toEqual([]);
  });
  it("an empty keyword reads nothing", () => {
    expect(parseThreads("%% : x %%", "", C)).toEqual([]);
  });
  it("skips code, frontmatter, html comments and multi-line comments", () => {
    const src = [
      "---", "a: %% thread: in frontmatter %%", "---",
      "`%% thread: inline %%`",
      "```", "%% thread: fenced %%", "```",
      "<!-- %% thread: html %% -->",
      "%% thread: multi", "line %%",
      "%% thread: real %%",
    ].join("\n");
    const ts = parseThreads(src, K, C);
    expect(ts.map((t) => t.text)).toEqual(["real"]);
    expect(ts[0].line).toBe(10);
  });
  it("accepts a prepared Markdown and counts several per line", () => {
    const ts = parseThreads("%% thread: a %% e %% thread: b %%", K, C);
    expect(ts.map((t) => t.text)).toEqual(["a", "b"]);
  });
  it("handles CRLF", () => {
    const ts = parseThreads("x\r\n%% thread: a %%\r\ny", K, C);
    expect(ts[0]).toMatchObject({ line: 1, text: "a" });
  });
});

describe("threadComment", () => {
  it("writes open and closed forms and keeps the text safe", () => {
    expect(threadComment(K, C, "quem?", false)).toBe("%% thread: quem? %%");
    expect(threadComment(K, C, "quem?", true, "A Casa")).toBe("%% thread closed: quem? → [[A Casa]] %%");
    expect(threadComment(K, C, "a %% b\nc", false)).toBe("%% thread: a % b c %%");
  });
});

describe("closeThreadPlan", () => {
  const src = "um\n%% thread: quem escreveu as cartas? %%\ndois\n";
  it("rewrites the marker and nothing else", () => {
    const [t] = parseThreads(src, K, C);
    const c = closeThreadPlan(t, K, C)(src)!;
    expect(applyChange(src, c)).toBe("um\n%% thread closed: quem escreveu as cartas? %%\ndois\n");
  });
  it("records the answering note, keeping an existing one when none is given", () => {
    const [t] = parseThreads(src, K, C);
    expect(applyChange(src, closeThreadPlan(t, K, C, "A Casa")(src)!)).toContain("%% thread closed: quem escreveu as cartas? → [[A Casa]] %%");
    const withLink = "%% thread: x → [[Velha]] %%";
    const [u] = parseThreads(withLink, K, C);
    expect(applyChange(withLink, closeThreadPlan(u, K, C)(withLink)!)).toBe("%% thread closed: x → [[Velha]] %%");
  });
  it("refuses when the comment changed or moved since it was parsed", () => {
    const [t] = parseThreads(src, K, C);
    const plan = closeThreadPlan(t, K, C);
    expect(plan(src.replace("cartas", "cartões"))).toBeNull();
    expect(plan("novo\n" + src)).toBeNull();
    expect(plan(src.replace("%% thread:", "%% fio:"))).toBeNull();
  });
  it("is a no-op plan for a thread already closed", () => {
    const closed = "%% thread closed: x %%";
    const [t] = parseThreads(closed, K, C);
    expect(closeThreadPlan(t, K, C)(closed)).toBeNull();
  });
});

describe("the configured closed word", () => {
  it("is the only closed word read and the one written", () => {
    const src = "%% fio fechado: a %%\n%% fio closed: b %%";
    const ts = parseThreads(src, "fio", "fechado");
    expect(ts.map((t) => [t.text, t.closed])).toEqual([["a", true], ["closed: b", false]]);
    const open = "%% fio: quem? %%";
    const [t] = parseThreads(open, "fio", "fechado");
    expect(applyChange(open, closeThreadPlan(t, "fio", "fechado")(open)!)).toBe("%% fio fechado: quem? %%");
  });
});

describe("reopenThreadPlan", () => {
  const src = "um\n%% thread closed: quem? → [[A Casa]] %%\ndois";
  it("drops the closed word and keeps the answer link", () => {
    const [t] = parseThreads(src, K, C);
    expect(applyChange(src, reopenThreadPlan(t, K, C)(src)!)).toBe("um\n%% thread: quem? → [[A Casa]] %%\ndois");
  });
  it("refuses a marker that changed or moved, and does nothing for an open thread", () => {
    const [t] = parseThreads(src, K, C);
    expect(reopenThreadPlan(t, K, C)("x\n" + src)).toBeNull();
    expect(reopenThreadPlan(t, K, C)(src.replace("quem?", "onde?"))).toBeNull();
    const open = "%% thread: a %%";
    expect(reopenThreadPlan(parseThreads(open, K, C)[0], K, C)(open)).toBeNull();
  });
});

describe("closing against another reading of the same text", () => {
  it("finds the marker in an LF buffer when the offsets came from CRLF text", () => {
    const disk = "um\r\ndois\r\n%% thread: quem? %%\r\nfim";
    const buffer = disk.replace(/\r\n/g, "\n");
    const [t] = parseThreads(disk, K, C);
    const c = closeThreadPlan(t, K, C)(buffer)!;
    expect(applyChange(buffer, c)).toBe("um\ndois\n%% thread closed: quem? %%\nfim");
    expect(applyChange(disk, closeThreadPlan(t, K, C)(disk)!)).toBe("um\r\ndois\r\n%% thread closed: quem? %%\r\nfim");
  });
  it("accepts typing earlier on the same line count, refuses a changed marker", () => {
    const src = "um\n%% thread: quem? %%";
    const [t] = parseThreads(src, K, C);
    expect(closeThreadPlan(t, K, C)("um, mais\n%% thread: quem? %%")).not.toBeNull();
    expect(closeThreadPlan(t, K, C)("um\n%% thread: quem foi? %%")).toBeNull();
  });
});

describe("the answer link written into a marker", () => {
  it("cuts alias, heading and block, and cannot hold %%", () => {
    expect(threadComment(K, C, "q", true, "A Casa#Capítulo 3")).toBe("%% thread closed: q → [[A Casa]] %%");
    expect(threadComment(K, C, "q", true, "[[A Casa|casa]]")).toBe("%% thread closed: q → [[A Casa]] %%");
    expect(threadComment(K, C, "q", true, "Casa %% 2")).toBe("%% thread closed: q → [[Casa % 2]] %%");
    const [t] = parseThreads("%% thread: a %%\n" + threadComment(K, C, "q", true, "Casa %% 2") + "\n%% thread: b %%", K, C);
    expect(t.text).toBe("a");
    expect(parseThreads(threadComment(K, C, "q", true, "Casa %% 2") + "\n%% thread: b %%", K, C)).toHaveLength(2);
  });
});
