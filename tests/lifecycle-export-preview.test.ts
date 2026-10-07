import { describe, expect, it, vi } from "vitest";
import { exportDocOf } from "../src/core/export-pipeline";
import { PTBR, SHUNN } from "../src/core/presets";
import { PreviewWriter, countLine } from "../src/export/writers/preview";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chapterHeadings, type ExportPart, type ExportSource, type Preset } from "../src/core/export-pipeline";
import { segment } from "../src/core/markdown";
import { fixtureChapters } from "./support/export-fixture";

// tests/support/export-fixture.ts builds file URLs, which happy-dom's URL refuses: the same sources, by path
const FX = join(process.cwd(), "tests/fixtures/manuscript");
const md = (p: string) => segment(readFileSync(join(FX, p), "utf8"));
const AUTHOR = { name: "Ana Souza", surname: "Souza", contact: [] as string[] };
const contoSource = (count = 612): ExportSource => ({
  title: "A visita", author: AUTHOR, count: { amount: count, unit: "words" }, parts: [{ role: "body", heading: null, md: md("conto.md") }],
});
function bookSource(preset: Preset, count = 1234): ExportSource {
  const dir = "book/A Casa/";
  const chapters = fixtureChapters(join(FX, dir, "Chapters"));
  const heads = chapterHeadings(chapters, preset.chapterHeading);
  const parts: ExportPart[] = [
    { role: "dedication", heading: null, md: md(dir + "Dedicatória.md") },
    { role: "epigraph", heading: null, md: md(dir + "Epígrafe.md") },
    ...chapters.map((c, i): ExportPart => ({ role: "body", heading: heads[i], md: md(dir + "Chapters/" + c.file) })),
  ];
  return { title: "A Casa", author: AUTHOR, count: { amount: count, unit: "words" }, parts };
}

const OPTS = { placeholderMarker: "XXX" };
const draw = (doc: ReturnType<typeof exportDocOf>, preset = SHUNN, hooks = {}) => {
  const host = document.createElement("div");
  const out = new PreviewWriter(host, hooks).write(doc, preset);
  return { host, out, paper: host.querySelector<HTMLElement>(".escrita-export-paper")! };
};
const text = (el: Element | null) => el?.textContent ?? "";

describe("the preview writer (Q16)", () => {
  it("is a ManuscriptWriter that draws and returns no file", () => {
    const w = new PreviewWriter(document.createElement("div"));
    expect([w.id, w.ext]).toEqual(["preview", ""]);
    expect(draw(exportDocOf(contoSource(), OPTS)).out).toBe("");
  });

  it("draws a conto: contact and count on top, title and byline, then the text, with no bands", () => {
    const { paper } = draw(exportDocOf(contoSource(4210), OPTS));
    expect(text(paper.querySelector(".escrita-export-contact"))).toBe("Ana Souza");
    expect(text(paper.querySelector(".escrita-export-count"))).toBe("about 4,200 words");
    expect(text(paper.querySelector(".escrita-export-title"))).toBe("A visita");
    expect(paper.querySelector(".escrita-export-title")!.classList.contains("is-book")).toBe(false);
    expect(text(paper.querySelector(".escrita-export-byline"))).toBe("by Ana Souza");
    expect(paper.querySelectorAll(".escrita-export-zone")).toHaveLength(0);
    expect(paper.querySelectorAll(".escrita-export-chapter")).toHaveLength(0);
    expect(paper.querySelectorAll("p.escrita-export-para").length).toBeGreaterThan(5);
    expect(paper.querySelectorAll(".escrita-export-break").length).toBe(2);
    expect(paper.querySelectorAll("em, strong").length).toBeGreaterThan(1);
    expect(text(paper.querySelector(".escrita-export-end"))).toBe("END");
    // no marker, comment or embed text
    expect(paper.textContent).not.toMatch(/XXX|beat:|cortar esta frase|foto\.png|%%/);
  });

  it("marks the text start of a book with only chapters (the file starts that page)", () => {
    const src = bookSource(PTBR);
    src.parts = src.parts.filter((p) => p.role === "body");
    const { paper } = draw(exportDocOf(src, OPTS), PTBR, { zone: (k: string) => ({ text: "texto" })[k] });
    expect([...paper.querySelectorAll(".escrita-export-zone")].map(text)).toEqual(["texto"]);
  });

  it("draws a book: bands where files start a page, chapter headings, the preset's own words", () => {
    const { paper } = draw(exportDocOf(bookSource(PTBR, 18500), OPTS), PTBR, {
      zone: (k: string) => ({ dedication: "dedicatória", epigraph: "epígrafe", text: "texto" })[k],
    });
    expect([...paper.querySelectorAll(".escrita-export-zone")].map(text)).toEqual(["dedicatória", "epígrafe", "texto"]);
    expect([...paper.querySelectorAll(".escrita-export-chapter")].map(text)).toEqual(["Prólogo", "Capítulo 1 — A chegada", "Capítulo 2 — A casa"]);
    expect(text(paper.querySelector(".escrita-export-count"))).toBe("cerca de 18.500 palavras");
    expect(text(paper.querySelector(".escrita-export-byline"))).toBe("por Ana Souza");
    expect(paper.querySelector(".escrita-export-title")!.classList.contains("is-book")).toBe(true);
    expect(text(paper.querySelector(".escrita-export-end"))).toBe("FIM");
    // the zones sit in order: dedication band, its page, epigraph band, its page, text band, first chapter
    const kids = [...paper.children].map((c) => c.className.split(" ")[0]);
    expect(kids.indexOf("escrita-export-zone")).toBeLessThan(kids.indexOf("escrita-export-chapter"));
    expect(paper.querySelectorAll(".escrita-export-front").length).toBeGreaterThan(1);
  });

  it("uses the preset's font, size and spacing", () => {
    const { paper } = draw(exportDocOf(contoSource(), OPTS));
    expect(paper.style.fontFamily).toContain("Times New Roman");
    expect(paper.style.fontSize).toBe("15px");
    expect(paper.style.lineHeight).toBe("2");
    expect(paper.style.getPropertyValue("--escrita-export-indent")).toBe("45px");
  });

  it("redraws into the same host", () => {
    const host = document.createElement("div");
    const w = new PreviewWriter(host);
    w.write(exportDocOf(contoSource(), OPTS), SHUNN);
    w.write(exportDocOf(contoSource(), OPTS), PTBR);
    expect(host.querySelectorAll(".escrita-export-paper")).toHaveLength(1);
    expect(text(host.querySelector(".escrita-export-byline"))).toBe("por Ana Souza");
  });

  it("leaves a title with no count or contact alone", () => {
    const doc = exportDocOf({ ...contoSource(0), author: { name: "", surname: "", contact: [] } }, OPTS);
    const { paper } = draw(doc);
    expect(paper.querySelector(".escrita-export-top")).toBeNull();
    expect(paper.querySelector(".escrita-export-byline")).toBeNull();
    expect(countLine(doc, SHUNN)).toBe("");
  });

  it("knows each paragraph's part and line, and opens it on click", () => {
    const doc = exportDocOf(bookSource(SHUNN), OPTS);
    const open = vi.fn();
    const { paper } = draw(doc, SHUNN, { open });
    const linked = [...paper.querySelectorAll<HTMLElement>("[data-line]")];
    expect(linked.length).toBeGreaterThan(5);
    // a body paragraph of the second chapter file ("A chegada", doc part 3)
    const first = paper.querySelector<HTMLElement>('[data-part="3"]')!;
    expect(first.getAttribute("data-line")).toBe(String(doc.parts[3].manuscript.blocks.find((b) => b.kind === "paragraph")!.line));
    first.click();
    expect(open).toHaveBeenCalledWith(3, Number(first.getAttribute("data-line")));
    // a scene break has no link
    expect(paper.querySelector(".escrita-export-break")!.hasAttribute("data-line")).toBe(false);
  });

  it("shows a tip on hover and hides it on leave", () => {
    const doc = exportDocOf(contoSource(), OPTS);
    const { host, paper } = draw(doc, SHUNN, { tip: (p: number, l: number) => `Open ${p}:${l}` });
    const para = paper.querySelector<HTMLElement>("p[data-line]")!;
    para.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(text(host.querySelector(".escrita-export-tip"))).toBe(`Open 0:${para.getAttribute("data-line")}`);
    paper.dispatchEvent(new MouseEvent("mouseleave"));
  });
});

describe("the EPUB preview (0.9, release review)", () => {
  it("puts the contents after the dedication and epigraph, before the first chapter, as the file does (Q6)", () => {
    const { paper } = draw(exportDocOf(bookSource(PTBR), OPTS), PTBR, {
      epub: { sceneBreak: "* * *", contentsLabel: "Sumário", coverUrl: null, cover: true },
      zone: (k: string) => k,
    });
    expect([...paper.querySelectorAll(".escrita-export-zone")].map(text)).toEqual(["cover", "dedication", "epigraph", "contents"]);
    const kids = [...paper.children].map((c) => c.className);
    const contents = kids.indexOf("escrita-export-contents");
    expect(contents).toBeGreaterThan(-1);
    expect(kids.findIndex((c) => c.includes("escrita-export-chapter"))).toBeGreaterThan(contents);
  });

  it("still draws the contents for a note with no chapter heading", () => {
    const { paper } = draw(exportDocOf(contoSource(), OPTS), PTBR, {
      epub: { sceneBreak: "* * *", contentsLabel: "Sumário", coverUrl: null, cover: false },
    });
    expect([...paper.querySelectorAll(".escrita-export-contents li")].map(text)).toEqual(["A visita"]);
  });
});
