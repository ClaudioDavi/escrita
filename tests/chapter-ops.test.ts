import { describe, it, expect } from "vitest";
import {
  orderRenames, planInsert, retitledName, renderTemplate, templateVars, hasFrontmatter, buildChapterContent,
  planRenumberNames, titlePart, chapterName, ChapterError,
} from "../src/core/chapter-plan";
import { planRenumber, type RenamePlan } from "../src/core/book";

/** Apply renames to a set of names, failing on any collision, like a file system would. */
function simulate(existing: string[], steps: RenamePlan[]): string[] {
  const names = new Set(existing.map((n) => n.toLowerCase()));
  const actual = new Map(existing.map((n) => [n.toLowerCase(), n]));
  for (const s of steps) {
    const f = s.from.toLowerCase(), t = s.to.toLowerCase();
    if (!names.has(f)) throw new Error(`missing ${s.from}`);
    if (names.has(t) && t !== f) throw new Error(`collision ${s.to}`);
    names.delete(f); actual.delete(f);
    names.add(t); actual.set(t, s.to);
  }
  return [...actual.values()].sort();
}

describe("orderRenames", () => {
  it("shifts up from the last one backwards", () => {
    const existing = ["01 A", "02 B", "03 C"];
    const plan = [{ from: "02 B", to: "03 B" }, { from: "03 C", to: "04 C" }];
    const steps = orderRenames(plan, existing);
    expect(steps).toEqual([{ from: "03 C", to: "04 C" }, { from: "02 B", to: "03 B" }]);
    expect(simulate(existing, steps)).toEqual(["01 A", "03 B", "04 C"]);
  });

  it("chains where each target is the next file's current name", () => {
    const existing = ["01 X", "02 X", "03 X"];
    const plan = [{ from: "01 X", to: "02 X" }, { from: "02 X", to: "03 X" }, { from: "03 X", to: "04 X" }];
    const steps = orderRenames(plan, existing);
    expect(simulate(existing, steps)).toEqual(["02 X", "03 X", "04 X"]);
    expect(steps.every((s) => !s.to.startsWith("escrita-tmp"))).toBe(true);
  });

  it("swaps through a temporary name", () => {
    const existing = ["01 X", "02 X"];
    const plan = [{ from: "01 X", to: "02 X" }, { from: "02 X", to: "01 X" }];
    const steps = orderRenames(plan, existing);
    expect(steps).toHaveLength(3);
    expect(steps.some((s) => s.to.startsWith("escrita-tmp"))).toBe(true);
    expect(simulate(existing, steps)).toEqual(["01 X", "02 X"]);
    // the original "01 X" ends as "02 X": follow the chain
    let name = "01 X";
    for (const s of steps) if (s.from === name) name = s.to;
    expect(name).toBe("02 X");
  });

  it("rotations of three", () => {
    const existing = ["1 A", "2 A", "3 A"];
    const plan = [{ from: "1 A", to: "2 A" }, { from: "2 A", to: "3 A" }, { from: "3 A", to: "1 A" }];
    const steps = orderRenames(plan, existing);
    expect(simulate(existing, steps)).toEqual(["1 A", "2 A", "3 A"]);
    for (const p of plan) {
      let name = p.from;
      for (const s of steps) if (s.from === name) name = s.to;
      expect(name).toBe(p.to);
    }
  });

  it("drag-and-drop reorder via planRenumber", () => {
    const existing = ["01 A", "02 B", "03 C", "04 D"];
    const ordered = ["04 D", "01 A", "02 B", "03 C"];
    const steps = orderRenames(planRenumber(ordered, 2), existing);
    expect(simulate(existing, steps)).toEqual(["01 D", "02 A", "03 B", "04 C"]);
  });

  it("temporary names avoid existing names", () => {
    const existing = ["01 X", "02 X", "escrita-tmp-1 02 X", "escrita-tmp-1 01 X"];
    const plan = [{ from: "01 X", to: "02 X" }, { from: "02 X", to: "01 X" }];
    const steps = orderRenames(plan, existing);
    expect(simulate(existing, steps)).toEqual(existing.slice().sort());
  });

  it("case-insensitive collisions", () => {
    const existing = ["01 a", "02 A"];
    const plan = [{ from: "01 a", to: "02 A" }, { from: "02 A", to: "01 a" }];
    const steps = orderRenames(plan, existing);
    expect(simulate(existing, steps)).toEqual(["01 a", "02 A"]);
    // case-only change is direct
    expect(orderRenames([{ from: "01 a", to: "01 A" }], ["01 a"])).toEqual([{ from: "01 a", to: "01 A" }]);
  });

  it("refuses to overwrite a file that isn't moving", () => {
    expect(() => orderRenames([{ from: "01 A", to: "02 B" }], ["01 A", "02 B"])).toThrow();
    expect(() => orderRenames([{ from: "01 A", to: "02 b" }], ["01 A", "02 B"])).toThrow();
  });

  it("refuses duplicate targets", () => {
    expect(() => orderRenames([{ from: "1 A", to: "3 A" }, { from: "2 A", to: "3 A" }], ["1 A", "2 A"])).toThrow();
  });

  it("drops no-op renames and handles an empty plan", () => {
    expect(orderRenames([{ from: "01 A", to: "01 A" }], ["01 A"])).toEqual([]);
    expect(orderRenames([], [])).toEqual([]);
  });
});

describe("planInsert", () => {
  const names = ["01 Chegada", "02 A porta", "03 O porão"];

  it("in the middle", () => {
    expect(planInsert(names, 1, "Nova", 2)).toEqual({
      name: "02 Nova",
      renames: [{ from: "02 A porta", to: "03 A porta" }, { from: "03 O porão", to: "04 O porão" }],
    });
  });

  it("append and prepend", () => {
    expect(planInsert(names, 3, "Fim", 2)).toEqual({ name: "04 Fim", renames: [] });
    expect(planInsert(names, 99, "Fim", 2).name).toBe("04 Fim");
    const first = planInsert(names, 0, "Início", 2);
    expect(first.name).toBe("01 Início");
    expect(first.renames.map((r) => r.to)).toEqual(["02 Chegada", "03 A porta", "04 O porão"]);
    expect(planInsert(names, -4, "X", 2).name).toBe("01 X");
  });

  it("empty book", () => {
    expect(planInsert([], 0, "Um", 2)).toEqual({ name: "01 Um", renames: [] });
    expect(planInsert([], 0, "Um", 0)).toEqual({ name: "1 Um", renames: [] });
  });

  it("widens every prefix when the count gains a digit", () => {
    const nine = Array.from({ length: 9 }, (_, i) => `${i + 1} C${i + 1}`);
    const p = planInsert(nine, 9, "Dez", 1);
    expect(p.name).toBe("10 Dez");
    expect(p.renames).toHaveLength(9);
    expect(p.renames[0]).toEqual({ from: "1 C1", to: "01 C1" });
  });

  it("numbers unnumbered chapters and fixes gaps", () => {
    const p = planInsert(["01 A", "05 B", "Loose"], 1, "N", 2);
    expect(p.name).toBe("02 N");
    expect(p.renames).toEqual([{ from: "05 B", to: "03 B" }, { from: "Loose", to: "04 Loose" }]);
  });

  it("the plan applies without collisions and leaves the new name free", () => {
    const existing = ["01 X", "02 X", "03 X"];
    const p = planInsert(existing, 0, "X", 2);
    const after = simulate(existing, orderRenames(p.renames, existing));
    expect(after).toEqual(["02 X", "03 X", "04 X"]);
    expect(after).not.toContain(p.name);
  });
});

describe("retitledName", () => {
  it("keeps the prefix", () => {
    expect(retitledName("03 O porão", "A adega")).toBe("03 A adega");
    expect(retitledName("3-Old", "New")).toBe("3 New");
    expect(retitledName("007", "Bond")).toBe("007 Bond");
    expect(retitledName("Prologue", "Prólogo")).toBe("Prólogo");
  });
  it("empty titles are refused", () => {
    expect(retitledName("01 A", "   ")).toBeNull();
    expect(retitledName("01 A", "")).toBeNull();
  });
});

describe("templates", () => {
  const vars = templateVars("Chegada", new Date(2026, 8, 9, 7, 5));

  it("templateVars", () => {
    expect(vars).toEqual({ title: "Chegada", date: "2026-09-09", time: "07:05" });
  });

  it("renderTemplate", () => {
    expect(renderTemplate("# {{title}}\n{{date}} {{ time }} {{TITLE}} {{other}}", vars))
      .toBe("# Chegada\n2026-09-09 07:05 Chegada {{other}}");
    expect(renderTemplate("{{title}}", { ...vars, title: "$& $1" })).toBe("$& $1");
  });

  it("hasFrontmatter", () => {
    expect(hasFrontmatter("---\na: 1\n---\n")).toBe(true);
    expect(hasFrontmatter("---\na: 1\n---")).toBe(true);
    expect(hasFrontmatter("---\n---\n")).toBe(true);
    expect(hasFrontmatter("---\r\na: 1\r\n...\r\nx")).toBe(true);
    expect(hasFrontmatter("---\na: 1\n")).toBe(false);
    expect(hasFrontmatter("text\n---\na\n---")).toBe(false);
    expect(hasFrontmatter("")).toBe(false);
  });

  it("no template: frontmatter with an empty summary", () => {
    expect(buildChapterContent(null, vars, "summary")).toBe('---\nsummary: ""\n---\n');
    expect(buildChapterContent(null, vars, "resumo", "Body.")).toBe('---\nresumo: ""\n---\nBody.');
    expect(buildChapterContent(null, vars, "my summary")).toBe('---\n"my summary": ""\n---\n');
    expect(buildChapterContent(null, vars, "")).toBe('---\nsummary: ""\n---\n');
  });

  it("template with frontmatter is used as is", () => {
    const tpl = "---\nstatus: idea\ncreated: {{date}}\n---\n# {{title}}\n";
    expect(buildChapterContent(tpl, vars, "summary")).toBe("---\nstatus: idea\ncreated: 2026-09-09\n---\n# Chegada\n");
    expect(buildChapterContent(tpl, vars, "summary", "%% beat: x %%")).toBe("---\nstatus: idea\ncreated: 2026-09-09\n---\n# Chegada\n%% beat: x %%");
  });

  it("template without frontmatter gets one", () => {
    expect(buildChapterContent("# {{title}}", vars, "summary", "B")).toBe('---\nsummary: ""\n---\n# Chegada\nB');
    expect(buildChapterContent("", vars, "summary")).toBe('---\nsummary: ""\n---\n');
  });

  it("CRLF templates stay CRLF", () => {
    expect(buildChapterContent("# {{title}}\r\n", vars, "summary", "B")).toBe('---\r\nsummary: ""\r\n---\r\n# Chegada\r\nB');
  });
});

describe("number-only chapter names (regressions)", () => {
  it("planInsert keeps a number-only name a number", () => {
    expect(planInsert(["01", "02"], 0, "New", 2)).toEqual({
      name: "01 New",
      renames: [{ from: "01", to: "02" }, { from: "02", to: "03" }],
    });
    expect(planInsert(["1-", "02 B"], 0, "N", 2).renames[0]).toEqual({ from: "1-", to: "02" });
  });

  it("planRenumberNames swaps number-only names without adding titles", () => {
    expect(planRenumberNames(["02", "01"], 2)).toEqual([{ from: "02", to: "01" }, { from: "01", to: "02" }]);
    expect(planRenumberNames(["01 A", "3", "Loose"], 2)).toEqual([{ from: "3", to: "02" }, { from: "Loose", to: "03 Loose" }]);
  });

  it("titlePart / chapterName", () => {
    expect(titlePart("01")).toBe("");
    expect(titlePart("01 Chegada")).toBe("Chegada");
    expect(titlePart("Prologue")).toBe("Prologue");
    expect(chapterName(3, "", 2)).toBe("03");
    expect(chapterName(3, "X", 2)).toBe("03 X");
  });
});

describe("ChapterError", () => {
  it("orderRenames throws typed errors with the name", () => {
    let err: unknown;
    try { orderRenames([{ from: "01 A", to: "02 B" }], ["01 A", "02 B"]); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ChapterError);
    expect((err as ChapterError).code).toBe("exists");
    expect((err as ChapterError).subject).toBe("02 B");
    try { orderRenames([{ from: "1 A", to: "3 A" }, { from: "2 A", to: "3 A" }], ["1 A", "2 A"]); } catch (e) { err = e; }
    expect((err as ChapterError).code).toBe("duplicate");
  });
});
