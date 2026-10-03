import { describe, it, expect } from "vitest";
import {
  mergeProperties, missingProperties, planTemplateInsert, renderTemplate, splitTemplate, templateVars,
} from "../src/core/template";
import { applyChange } from "../src/core/note-text";

const vars = templateVars("Chegada", new Date(2026, 8, 9, 7, 5));

describe("variables", () => {
  it("fills title, date and time", () => {
    expect(vars).toEqual({ title: "Chegada", date: "2026-09-09", time: "07:05" });
    expect(renderTemplate("# {{title}} · {{ date }} {{TIME}} {{other}}", vars)).toBe("# Chegada · 2026-09-09 07:05 {{other}}");
  });
  it("does not treat $ in the title as a replacement pattern", () => {
    expect(renderTemplate("{{title}}", { ...vars, title: "a $& b" })).toBe("a $& b");
  });
});

describe("splitTemplate", () => {
  it("separates properties and body", () => {
    const { properties, body } = splitTemplate("---\nstatus: idea\ntags:\n  - a\n  - b\n\"my key\": x\n---\n# T\ntext\n");
    expect(properties.map((p) => p.key)).toEqual(["status", "tags", "my key"]);
    expect(properties[1].lines).toEqual(["tags:", "  - a", "  - b"]);
    expect(body).toBe("# T\ntext\n");
  });
  it("a template without properties is all body", () => {
    expect(splitTemplate("# T\n")).toEqual({ properties: [], body: "# T\n" });
  });
  it("an unclosed --- is body, not properties", () => {
    expect(splitTemplate("---\nstatus: idea\n").properties).toEqual([]);
  });
  it("frontmatter only leaves an empty body", () => {
    expect(splitTemplate("---\na: 1\n---").body).toBe("");
  });
  it("keeps blocks (multi-line values) with their key", () => {
    const { properties } = splitTemplate("---\nsummary: |\n  one\n  two\n\nnext: 1\n---\n");
    expect(properties.map((p) => [p.key, p.lines])).toEqual([["summary", ["summary: |", "  one", "  two"]], ["next", ["next: 1"]]]);
  });
});

describe("mergeProperties", () => {
  const props = splitTemplate("---\nstatus: idea\ncreated: 2026-09-09\n---\n").properties;
  it("adds only missing properties before the closing ---", () => {
    const note = "---\nstatus: revisão\n---\nTexto\n";
    const c = mergeProperties(note, props)!;
    expect(applyChange(note, c)).toBe("---\nstatus: revisão\ncreated: 2026-09-09\n---\nTexto\n");
  });
  it("never overwrites, and compares keys without case", () => {
    const note = "---\nStatus: x\ncreated:\n---\n";
    expect(mergeProperties(note, props)).toBeNull();
    expect(missingProperties(note, props)).toEqual([]);
  });
  it("creates a frontmatter when the note has none", () => {
    const c = mergeProperties("Texto\n", props)!;
    expect(applyChange("Texto\n", c)).toBe("---\nstatus: idea\ncreated: 2026-09-09\n---\nTexto\n");
    expect(applyChange("", mergeProperties("", props)!)).toBe("---\nstatus: idea\ncreated: 2026-09-09\n---\n");
  });
  it("leaves a note with an unclosed --- alone", () => {
    expect(mergeProperties("---\nstatus: x\ntexto", props)).toBeNull();
  });
  it("uses CRLF when the note does", () => {
    const note = "---\r\na: 1\r\n---\r\nT";
    expect(applyChange(note, mergeProperties(note, props)!)).toBe("---\r\na: 1\r\nstatus: idea\r\ncreated: 2026-09-09\r\n---\r\nT");
  });
  it("handles an empty frontmatter and adds each key once", () => {
    const note = "---\n---\nT";
    const dup = [...props, ...props];
    expect(applyChange(note, mergeProperties(note, dup)!)).toBe("---\nstatus: idea\ncreated: 2026-09-09\n---\nT");
  });
  it("keeps list values whole", () => {
    const p = splitTemplate("---\ntags:\n  - a\n  - b\n---\n").properties;
    expect(applyChange("---\n---\n", mergeProperties("---\n---\n", p)!)).toBe("---\ntags:\n  - a\n  - b\n---\n");
  });
});

describe("planTemplateInsert", () => {
  const tpl = "---\nstatus: idea\n---\n# {{title}}\n%% beat: x %%\n";
  it("merges properties and inserts the body at the cursor as two changes", () => {
    const note = "---\ntype: conto\n---\nUm.\nDois.\n";
    const cursor = note.indexOf("Dois");
    const changes = planTemplateInsert(note, cursor, tpl, vars);
    expect(changes).toHaveLength(2);
    expect(changes[0].to).toBeLessThanOrEqual(changes[1].from);
    let out = note;
    for (const c of [...changes].reverse()) out = applyChange(out, c);
    expect(out).toBe("---\ntype: conto\nstatus: idea\n---\nUm.\n# Chegada\n%% beat: x %%\nDois.\n");
  });
  it("a cursor in the properties inserts at the start of the body", () => {
    const note = "---\ntype: conto\n---\nUm.\n";
    const changes = planTemplateInsert(note, 5, "# {{title}}\n", vars);
    expect(changes).toEqual([{ from: 20, to: 20, insert: "# Chegada\n" }]);
  });
  it("joins the new frontmatter and body into one change in an empty note", () => {
    const changes = planTemplateInsert("", 0, tpl, vars);
    expect(changes).toEqual([{ from: 0, to: 0, insert: "---\nstatus: idea\n---\n# Chegada\n%% beat: x %%\n" }]);
  });
  it("fills variables in properties too", () => {
    const changes = planTemplateInsert("", 0, "---\ncreated: {{date}}\n---\n", vars);
    expect(changes[0].insert).toBe("---\ncreated: 2026-09-09\n---\n");
  });
  it("starts the body on its own line when the closing --- ends the note", () => {
    const note = "---\ntitle: x\n---";
    const changes = planTemplateInsert(note, 0, "---\ntag: a\n---\nHello", vars);
    let out = note;
    for (const c of [...changes].reverse()) out = applyChange(out, c);
    expect(out).toBe("---\ntitle: x\ntag: a\n---\nHello");
  });
  it("does nothing when there is nothing to add", () => {
    expect(planTemplateInsert("---\nstatus: x\n---\n", 0, "---\nstatus: idea\n---\n", vars)).toEqual([]);
  });
});
