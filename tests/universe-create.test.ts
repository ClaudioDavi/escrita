import { describe, it, expect } from "vitest";
import { fence, findDuplicate, linkFor, nameFromSelection, plantThreadPlan, resolveAnswer, splitFenced, suggestWorks, threadAtLine } from "../src/universe/create-logic";
import { parseThreads } from "../src/core/markers";
import type { Entry } from "../src/universe/entries";

const U = { kind: "universe" as const, root: "Universo", note: "Universo.md" };
const e = (name: string, aliases: string[] = [], kind: Entry["kind"] = "character"): Entry => ({ path: `Universo/${name}.md`, name, aliases, kind, scope: U });

describe("nameFromSelection", () => {
  it("takes one trimmed line up to 60 characters", () => {
    expect(nameFromSelection("  Mariana ")).toBe("Mariana");
    expect(nameFromSelection("a\nb")).toBeNull();
    expect(nameFromSelection("   ")).toBeNull();
    expect(nameFromSelection("x".repeat(60))).not.toBeNull();
    expect(nameFromSelection("x".repeat(61))).toBeNull();
  });
});

describe("findDuplicate", () => {
  const all = [e("Mariana Ferraz", ["Mari"]), e("Mãe"), e("Mari Lu")];
  it("matches names and aliases without case or accents", () => {
    expect(findDuplicate(all, "mari")?.via).toBe("alias");
    expect(findDuplicate(all, "mari")?.entry.name).toBe("Mariana Ferraz");
    expect(findDuplicate(all, "MAE")?.entry.name).toBe("Mãe");
    expect(findDuplicate(all, "Mari Lu")?.via).toBe("name");
  });
  it("is exact, not a substring, and ignores an empty name", () => {
    expect(findDuplicate(all, "Maria")).toBeNull();
    expect(findDuplicate(all, "  ")).toBeNull();
  });
  it("prefers a name over an alias", () => {
    expect(findDuplicate([e("A", ["Bia"]), e("Bia")], "bia")?.entry.name).toBe("Bia");
  });
});

describe("linkFor", () => {
  it("is plain when the text reads as the name", () => {
    expect(linkFor("Mariana", "Mariana")).toBe("[[Mariana]]");
  });
  it("keeps the text of the story as the alias", () => {
    expect(linkFor("Mariana Ferraz", "Mariana")).toBe("[[Mariana Ferraz|Mariana]]");
    expect(linkFor("X", "a|b]]")).toBe("[[X|a b]]");
  });
});

describe("splitFenced", () => {
  it("splits plain and code fragments", () => {
    expect(splitFenced(`Creates ${fence("A/B.md")} now.`)).toEqual([
      { text: "Creates ", code: false }, { text: "A/B.md", code: true }, { text: " now.", code: false },
    ]);
    expect(splitFenced("plain")).toEqual([{ text: "plain", code: false }]);
  });
});

describe("plantThreadPlan", () => {
  const apply = (doc: string, p: { change: { from: number; to: number; insert: string } }) => doc.slice(0, p.change.from) + p.change.insert + doc.slice(p.change.to);
  const plant = (doc: string, from: number, to = from) => plantThreadPlan(doc, from, to, "thread", "closed");
  it("goes at the cursor, padded, with the cursor inside it", () => {
    const doc = "Line one.\nLine two.\n";
    const p = plant(doc, 4)!;
    expect(apply(doc, p)).toBe("Line %% thread:  %% one.\nLine two.\n");
    expect(apply(doc, p).slice(0, p.cursor).endsWith("%% thread: ")).toBe(true);
  });
  it("needs no space at the end of a line", () => {
    expect(apply("abc", plant("abc", 3)!)).toBe("abc %% thread:  %%");
  });
  it("fills an empty line between blank lines", () => {
    const doc = "a\n\n\n\nb";
    expect(apply(doc, plant(doc, 3)!)).toBe("a\n\n%% thread:  %%\n\nb");
  });
  it("keeps a paragraph break when the empty line separates two paragraphs", () => {
    const doc = "p1\n\np2";
    const out = apply(doc, plant(doc, 3)!);
    expect(out).toBe("p1\n\n%% thread:  %%\n\np2");
  });
  it("does not turn a scene break into a heading underline", () => {
    const doc = "p1\n\n---\n\np2";
    const out = apply(doc, plant(doc, 3)!);
    expect(out).toBe("p1\n\n%% thread:  %%\n\n---\n\np2");
  });
  it("goes after a scene break or a table row, in its own paragraph", () => {
    const sb = "p1\n\n---\n\np2";
    expect(apply(sb, plant(sb, 5)!)).toBe("p1\n\n---\n\n%% thread:  %%\n\np2");
    const tb = "| a | b |\n|---|---|\n| 1 | 2 |\nafter";
    expect(apply(tb, plant(tb, 2)!)).toBe("| a | b |\n|---|---|\n| 1 | 2 |\n\n%% thread:  %%\n\nafter");
  });
  it("copies a selection into the marker and keeps the prose", () => {
    const doc = "Quem escreveu as cartas? Ninguem sabe.\nNext";
    const p = plantThreadPlan(doc, 0, 24, "fio", "fechado")!;
    expect(apply(doc, p)).toBe("Quem escreveu as cartas? %% fio: Quem escreveu as cartas? %% Ninguem sabe.\nNext");
    expect(p.cursor).toBe(p.change.from + 1 + "%% fio: Quem escreveu as cartas? %%".length);
  });
  it("treats a selection ending at a line start as ending on the line before", () => {
    const doc = "one\ntwo\n";
    expect(apply(doc, plant(doc, 0, 4)!)).toBe("one %% thread: one %%\ntwo\n");
  });
  it("moves a cursor inside a wikilink to after it", () => {
    const doc = "see [[A Casa]] now";
    expect(apply(doc, plant(doc, 8)!)).toBe("see [[A Casa]] %% thread:  %% now");
  });
  it("produces a marker parseThreads reads", () => {
    const doc = "x\n";
    expect(parseThreads(apply(doc, plant(doc, 0, 1)!), "thread", "closed")).toHaveLength(1);
  });
  it("refuses frontmatter and code, where it would not count", () => {
    expect(plant("---\ntitle: x\n---\nbody", 5)).toBeNull();
    expect(plant("```\ncode\n```\n", 5)).toBeNull();
    expect(plantThreadPlan("text", 0, 0, "", "closed")).toBeNull();
  });
});

describe("threadAtLine", () => {
  const doc = "p\n%% thread: a %% %% thread closed: b %%\nz";
  const ts = parseThreads(doc, "thread", "closed");
  it("finds the thread under the cursor, else the first on the line", () => {
    expect(threadAtLine(ts, 1, ts[1].from + 3)?.text).toBe("b");
    expect(threadAtLine(ts, 1, 2)?.text).toBe("a");
    expect(threadAtLine(ts, 0, 0)).toBeNull();
  });
});

describe("resolveAnswer", () => {
  const works = [{ path: "Contos/A Casa.md", title: "A Casa" }, { path: "Contos/Sal.md", title: "Sal" }];
  it("is none for blank, a work by title or path, else the text", () => {
    expect(resolveAnswer("  ", works)).toEqual({ kind: "none" });
    expect(resolveAnswer("a casa", works)).toMatchObject({ kind: "work", work: { title: "A Casa" } });
    expect(resolveAnswer("[[Sal]]", works)).toMatchObject({ kind: "work" });
    expect(resolveAnswer("Contos/Sal", works)).toMatchObject({ kind: "work" });
    expect(resolveAnswer("Outra", works)).toEqual({ kind: "text", text: "Outra" });
  });
});

describe("suggestWorks", () => {
  it("filters without accents and puts prefix matches first", () => {
    const w = [{ path: "a", title: "O farol" }, { path: "b", title: "Farol do fim" }, { path: "c", title: "Sal" }];
    expect(suggestWorks(w, "FAROL").map((x) => x.title)).toEqual(["Farol do fim", "O farol"]);
    expect(suggestWorks(w, "").length).toBe(3);
  });
});
