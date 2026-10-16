// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { measureText } from "../src/core/measure";
import { PTBR } from "../src/core/presets";
import { registerStrings } from "../src/i18n";
import type { LastExport } from "../src/data";
import { ExportModal, type ExportHost, type ExportModalOptions, type ModalState } from "../src/export/modal";
import { withScreenplay, type ScreenplaySettings } from "../src/export/screenplay";
import { exportStrings } from "../src/export/strings";
import { buildExport, type Built } from "../src/export/source";
import { defaultsFor } from "../src/settings";

// The export modal for a screenplay note (boards 43 a to d).

beforeAll(() => registerStrings(exportStrings));
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const AUTHOR = { name: "Ana Souza", surname: "Souza", contact: ["ana@exemplo.com"] };
const SETTINGS = { ...defaultsFor("pt-BR"), placeholderMarker: "XXX", threadKeyword: "thread" } as unknown as ScreenplaySettings;
const TEXT = "EXT. FAROL - NOITE\n\nO vento empurra a porta.\n\nJOÃO\n(sem fôlego)\nTrinta anos subindo isso.\n\nINT. CASA - NOITE\n\nUma estrela ★ no teto.";

async function buildFor(s: ModalState, text = TEXT): Promise<Built> {
  const built = await buildExport(
    { title: "O farol", author: AUTHOR, unit: "words", single: true, placeholderMarker: "XXX", parts: [{ role: "body", path: "Roteiros/O farol.md", heading: null, title: null, label: "O farol" }] },
    { read: async () => ({ text, mtime: 1 }), count: async () => measureText(text), checkpoint: async () => {} },
  );
  return withScreenplay(built, { state: s, settings: SETTINGS, title: "O farol", frontmatter: {}, preset: PTBR });
}

function fakeHost(over: Partial<ExportHost> = {}) {
  const build = vi.fn((s: ModalState) => buildFor(s));
  const written = vi.fn(async () => true);
  const jumped = vi.fn();
  return Object.assign({
    titleFor: () => "O farol",
    build,
    pathFor: (s: ModalState) => s.format === "fountain" ? "Escrita/Exports/O farol.fountain" : `Escrita/Exports/O farol (${s.preset === "a4" ? "A4" : "Letter"}).pdf`,
    write: written,
    jump: jumped,
    openLast: () => true,
    fileExists: () => true,
  }, over, { build, written, jumped }) as ExportHost & { build: typeof build; written: ReturnType<typeof vi.fn>; jumped: ReturnType<typeof vi.fn> };
}

const START: ModalState = { whole: false, selection: { mode: "all" }, format: "pdf", preset: "a4", sceneNumbers: false, keepNotes: false };
function open(o: Partial<ExportModalOptions> & { host: ExportHost }) {
  const m = new ExportModal({} as never, {
    book: null, state: START, last: null, marker: "XXX", epubSceneBreak: "* * *", formats: ["pdf", "fountain"], script: { credit: "Roteiro de" }, ...o,
  });
  vi.spyOn(m, "close").mockImplementation(() => {});
  m.onOpen();
  return { m, el: m.contentEl };
}
const settle = async () => { await vi.advanceTimersByTimeAsync(300); };
const labels = (el: HTMLElement) => [...el.querySelectorAll(".escrita-export-label")].map((l) => l.textContent);
const chips = (el: HTMLElement, group: string) => [...el.querySelectorAll(`[aria-label='${group}'] button`)].map((b) => b.textContent);
const btn = (el: HTMLElement, text: string) => [...el.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(text))!;
const footer = (el: HTMLElement) => [...el.querySelectorAll(".escrita-export-footer button")].map((b) => b.textContent);
const checks = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>("button[role=checkbox]")];

describe("a screenplay as a PDF (board 43 a)", () => {
  it("offers PDF and Fountain, the page and the scene numbers, and no template", async () => {
    const { el } = open({ host: fakeHost() });
    await settle();
    expect(labels(el)).toEqual(["Format", "Page"]);
    expect(chips(el, "Format")).toEqual(["PDF", "Fountain"]);
    expect(chips(el, "Page")).toEqual(["US LetterUS", "A4Brazil, Europe"]);
    expect(el.querySelector("[aria-label='Page'] .is-on")!.textContent).toContain("A4");
    expect(checks(el).map((c) => [c.textContent, c.getAttribute("aria-checked")])).toEqual([["Scene numbers in the margins", "false"]]);
    expect(el.querySelector("[aria-label='Template']")).toBeNull();
  });

  it("says where it writes, the file name and the page count, with the credit from the settings", async () => {
    const { el } = open({ host: fakeHost() });
    await settle();
    expect(el.querySelector(".escrita-export-where")!.textContent)
      .toBe("Writes Escrita/Exports/O farol (A4).pdf. Courier 12, about 2 pages. Title page with the title, “Roteiro de”, the author and the contact from the settings.");
  });

  it("the last export line has the page count and Export again comes first", async () => {
    const last: LastExport = { format: "pdf", preset: "a4", whole: false, chapters: { mode: "all" }, chapterCount: 14, at: "2026-10-15T21:04:00", path: "Escrita/Exports/O farol (A4).pdf" };
    const { el } = open({ host: fakeHost(), last });
    await settle();
    expect(el.querySelector(".escrita-export-last")!.textContent).toMatch(/^Last export: PDF · A4 · 14 pages · .*21:04 · O farol \(A4\)\.pdf$/);
    expect(footer(el)).toEqual(["Export again", "Cancel", "Preview", "Export anyway"]);
  });

  it("builds again when the page or the scene numbers change, not for the format between PDF and itself", async () => {
    const host = fakeHost();
    const { m, el } = open({ host });
    await settle();
    expect(host.build).toHaveBeenCalledTimes(1);
    btn(el, "US Letter").click();
    await settle();
    expect(host.build).toHaveBeenCalledTimes(2);
    expect((m as unknown as { state: ModalState }).state.preset).toBe("letter");
    checks(el)[0].click();
    await settle();
    expect(host.build).toHaveBeenCalledTimes(3);
    expect((m as unknown as { state: ModalState }).state.sceneNumbers).toBe(true);
    expect(checks(el)[0].getAttribute("aria-checked")).toBe("true");
  });

  it("exports with the state it shows", async () => {
    const host = fakeHost();
    const { el } = open({ host });
    await settle();
    el.querySelector<HTMLElement>(".escrita-export-footer .mod-cta, .escrita-export-footer button.mod-cta")!.click();
    await vi.waitFor(() => expect(host.written).toHaveBeenCalled());
    expect(host.written.mock.calls[0][0]).toMatchObject({ format: "pdf", preset: "a4", sceneNumbers: false });
  });
});

describe("the warnings (board 43 c)", () => {
  it("lists the characters Courier cannot print with their lines, and asks to export anyway", async () => {
    const host = fakeHost();
    const { el } = open({ host });
    await settle();
    const rows = [...el.querySelectorAll(".escrita-export-wl")];
    expect(rows.map((r) => r.querySelector(".escrita-export-wtext")!.textContent)).toEqual(["1 character Courier can't print comes out as “?”: ★"]);
    expect([...rows[0].querySelectorAll(".escrita-export-go")].map((b) => b.textContent)).toEqual(["line 11"]);
    expect(btn(el, "Export anyway")).toBeDefined();
    (rows[0].querySelector(".escrita-export-go") as HTMLElement).click();
    expect(host.jumped).toHaveBeenCalledWith("Roteiros/O farol.md", 10);
  });
  it("only a PDF has it: Fountain takes any character", async () => {
    const { el } = open({ host: fakeHost(), state: { ...START, format: "fountain" } });
    await settle();
    expect(el.querySelector(".escrita-export-warn")).toBeNull();
    expect(btn(el, "Export")).toBeDefined();
  });
});

describe("a screenplay as Fountain (board 43 b)", () => {
  const fountain = { ...START, format: "fountain" as const };
  it("has no page and no preview; the notes checkbox instead", async () => {
    const { el } = open({ host: fakeHost(), state: fountain });
    await settle();
    expect(labels(el)).toEqual(["Format"]);
    expect(checks(el).map((c) => c.textContent)).toEqual(["Keep the %% … %% notes as Fountain notes"]);
    expect(footer(el)).toEqual(["Cancel", "Export"]);
    expect(el.querySelector(".escrita-export-where")!.textContent)
      .toBe("Writes Escrita/Exports/O farol.fountain, plain text for Highland, Fade In, WriterDuet or Final Draft. The title page becomes the Title: block.");
  });
  it("ticking the notes does not read the note again", async () => {
    const host = fakeHost();
    const { m, el } = open({ host, state: fountain });
    await settle();
    checks(el)[0].click();
    await settle();
    expect(host.build).toHaveBeenCalledTimes(1);
    expect((m as unknown as { state: ModalState }).state.keepNotes).toBe(true);
  });
  it("switching format crosses the PDF line and builds again", async () => {
    const host = fakeHost();
    const { el } = open({ host });
    await settle();
    btn(el, "Fountain").click();
    await settle();
    expect(host.build).toHaveBeenCalledTimes(2);
    expect(footer(el)).toEqual(["Cancel", "Export"]);
    btn(el, "PDF").click();
    await settle();
    expect(host.build).toHaveBeenCalledTimes(3);
    expect(footer(el)).toContain("Preview");
  });
});

describe("the PDF preview (board 43 d)", () => {
  it("draws the title page first, then the pages, with the page count in the head", async () => {
    const { el } = open({ host: fakeHost() });
    await settle();
    btn(el, "Preview").click();
    const pages = [...el.querySelectorAll(".escrita-sp-page")];
    expect(pages).toHaveLength(2);
    expect(pages[0].querySelector(".escrita-sp-tag")!.textContent).toBe("Title page");
    expect(pages[0].querySelector(".escrita-sp-title")!.textContent).toContain("O FAROL");
    expect(pages[0].querySelector(".escrita-sp-title")!.textContent).toContain("Ana Souza");
    expect(pages[1].querySelector(".escrita-sp-tag")!.textContent).toBe("Page 2");
    expect(pages[1].textContent).toContain("EXT. FAROL - NOITE");
    expect(pages[1].textContent).toContain("JOÃO");
    expect(el.querySelector(".escrita-export-psummary")!.textContent).toBe("PDF · A4 · 2 pages");
  });
  it("a click on a line opens the note there", async () => {
    const host = fakeHost();
    const { m, el } = open({ host });
    await settle();
    btn(el, "Preview").click();
    const row = [...el.querySelectorAll<HTMLElement>(".escrita-sp-row")].find((r) => r.textContent === "INT. CASA - NOITE")!;
    row.click();
    expect(m.close).toHaveBeenCalled();
    expect(host.jumped).toHaveBeenCalledWith("Roteiros/O farol.md", 8);
  });
});
