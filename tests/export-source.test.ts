import { describe, expect, it, vi } from "vitest";
import { buildExport, needsConfirm, type ExportPlan, type ExportPorts } from "../src/export/source";
import { measureText } from "../src/core/measure";
import { read } from "./support/export-fixture";

const AUTHOR = { name: "Ana Souza", surname: "Souza", contact: [] as string[] };
const file = (p: string) => read(p);

function ports(files: Record<string, string>, over: Partial<ExportPorts> = {}): ExportPorts & { reads: string[]; checks: number } {
  const state = { reads: [] as string[], checks: 0 };
  return Object.assign(state, {
    read: async (path: string) => { state.reads.push(path); return { text: files[path], mtime: 7 }; },
    count: async (path: string) => measureText(files[path]),
    checkpoint: async () => { state.checks++; },
    ...over,
  });
}

const conto: ExportPlan = {
  title: "A visita", author: AUTHOR, unit: "words", single: true, placeholderMarker: "XXX",
  parts: [{ role: "body", path: "conto.md", heading: null, title: null, label: "A visita" }],
};

describe("buildExport: a single note", () => {
  it("reads the note once, counts it from the port and builds the model", async () => {
    const p = ports({ "conto.md": file("conto.md") });
    const b = await buildExport(conto, p);
    expect(p.reads).toEqual(["conto.md"]);
    expect(b.source.count).toEqual({ amount: measureText(file("conto.md")).words, unit: "words" });
    expect(b.paths).toEqual(["conto.md"]);
    expect(b.labels).toEqual(["A visita"]);
    expect(b.doc.parts[0].manuscript.blocks.length).toBeGreaterThan(5);
  });

  it("warns about the placeholder and the embed, each with its line", async () => {
    const b = await buildExport(conto, ports({ "conto.md": file("conto.md") }));
    const by = Object.fromEntries(b.warnings.map((w) => [w.id, w]));
    expect(b.warnings.map((w) => w.id)).toEqual(["placeholders", "embeds"]);
    expect(by.placeholders).toMatchObject({ level: "blocker", n: 1 });
    expect(by.placeholders.links).toEqual([{ path: "conto.md", line: 14, where: "A visita" }]);
    expect(by.embeds).toMatchObject({ level: "info", n: 1, names: ["foto.png"] });
    expect(by.embeds.links[0].line).toBe(file("conto.md").split("\n").findIndex((l) => l.startsWith("![[")));
    expect(needsConfirm(b.warnings)).toBe(true);
  });

  it("warns, without blocking, about a beat with no prose after it", async () => {
    const b = await buildExport(conto, ports({ "conto.md": "Um.\n\n%% beat: falta %%" }));
    expect(b.warnings).toEqual([{ id: "unwrittenBeats", level: "warning", n: 1, names: [], links: [{ path: "conto.md", line: 2, where: "A visita" }] }]);
    expect(needsConfirm(b.warnings)).toBe(true);
  });

  it("is clean when nothing is wrong, and info alone needs no confirmation", async () => {
    const clean = await buildExport(conto, ports({ "conto.md": "Uma frase.\n\nOutra frase." }));
    expect(clean.warnings).toEqual([]);
    expect(needsConfirm(clean.warnings)).toBe(false);
    const embed = await buildExport(conto, ports({ "conto.md": "Uma frase.\n\n![[a.png]]\n\nOutra." }));
    expect(embed.warnings.map((w) => w.id)).toEqual(["embeds"]);
    expect(needsConfirm(embed.warnings)).toBe(false);
  });

  it("blocks an unclosed comment and an unclosed <!--, and an empty note", async () => {
    const open = await buildExport(conto, ports({ "conto.md": "Um.\n\n%% sem fim\n\nDois." }));
    expect(open.warnings.find((w) => w.id === "unclosedComment")).toMatchObject({ level: "blocker", links: [{ line: 2 }] });
    const html = await buildExport(conto, ports({ "conto.md": "Um.\n\n<!-- sem fim\n\nDois." }));
    expect(html.warnings.find((w) => w.id === "unclosedHtmlComment")?.links[0].line).toBe(2);
    const empty = await buildExport(conto, ports({ "conto.md": "%% só comentário %%\n" }));
    expect(empty.warnings.map((w) => w.id)).toContain("emptyBody");
  });
});

describe("buildExport: a book", () => {
  const dir = "book/A Casa/";
  const files: Record<string, string> = {
    "ded.md": file(dir + "Dedicatória.md"),
    "epi.md": file(dir + "Epígrafe.md"),
    "p.md": file(dir + "Chapters/00 Prólogo.md"),
    "c1.md": file(dir + "Chapters/01 A chegada.md"),
    "c3.md": file(dir + "Chapters/03 A casa.md"),
  };
  const plan: ExportPlan = {
    title: "A Casa", author: AUTHOR, unit: "words", single: false, placeholderMarker: "XXX",
    parts: [
      { role: "dedication", path: "ded.md", heading: null, title: null, label: "Dedicatória" },
      { role: "epigraph", path: "epi.md", heading: null, title: null, label: "Epígrafe" },
      { role: "body", path: "p.md", heading: "Prólogo", title: "Prólogo", label: "00 Prólogo" },
      { role: "body", path: "c1.md", heading: "Capítulo 1 — A chegada", title: "A chegada", label: "01 A chegada" },
      { role: "body", path: "c3.md", heading: "Capítulo 2 — A casa", title: "A casa", label: "03 A casa" },
    ],
  };

  it("sums the body's counts only, never the front matter, and yields after each part", async () => {
    const counted: string[] = [];
    const p = ports(files, { count: async (path: string) => { counted.push(path); return measureText(files[path]); } });
    const b = await buildExport(plan, p);
    expect(counted).toEqual(["p.md", "c1.md", "c3.md"]);
    expect(b.source.count.amount).toBe(["p.md", "c1.md", "c3.md"].reduce((n, k) => n + measureText(files[k]).words, 0));
    expect(p.checks).toBe(5);
    expect(b.source.parts.map((x) => [x.role, x.heading, x.title ?? null])).toEqual([
      ["dedication", null, null], ["epigraph", null, null], ["body", "Prólogo", "Prólogo"],
      ["body", "Capítulo 1 — A chegada", "A chegada"], ["body", "Capítulo 2 — A casa", "A casa"],
    ]);
  });

  it("drops a leading # title that repeats the chapter's own", async () => {
    const f = { ...files, "c1.md": "# A chegada\n\nChegou." };
    const b = await buildExport(plan, ports(f));
    const c1 = b.doc.parts[3].manuscript.blocks;
    expect(c1.map((x) => x.kind)).toEqual(["paragraph"]);
  });

  it("labels warnings by chapter and gives each link its own file and line", async () => {
    const f = { ...files, "c1.md": "Um.\n\n%% XXX: um %%\n\nDois %% XXX: outro %%.", "c3.md": "Três.\n\n%% XXX: três %%" };
    const b = await buildExport(plan, ports(f));
    const w = b.warnings.find((x) => x.id === "placeholders")!;
    expect(w.n).toBe(3);
    expect(w.links).toEqual([
      { path: "c1.md", line: 2, where: "01 A chegada" },
      { path: "c1.md", line: 4, where: "01 A chegada" },
      { path: "c3.md", line: 2, where: "03 A casa" },
    ]);
  });

  it("does not warn about an empty chapter of a book", async () => {
    const b = await buildExport(plan, ports({ ...files, "c3.md": "" }));
    expect(b.warnings.map((w) => w.id)).not.toContain("emptyBody");
  });

  it("passes the read's mtime to the count port (null for editor text)", async () => {
    const seen = vi.fn(async (_p: string, r: { mtime: number | null }) => { void r; return measureText("a b"); });
    const p = ports({ "conto.md": "a b" }, {
      read: async () => ({ text: "a b", mtime: null }),
      count: seen,
    });
    await buildExport(conto, p);
    expect(seen.mock.calls[0][1].mtime).toBeNull();
  });
});
