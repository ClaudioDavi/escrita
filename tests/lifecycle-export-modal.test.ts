import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChapterRef } from "../src/core/book-source";
import { measureText } from "../src/core/measure";
import { registerStrings } from "../src/i18n";
import type { LastExport } from "../src/data";
import { ChaptersModal, ExportModal, type BookOptions, type ExportHost, type ExportModalOptions, type ModalState } from "../src/export/modal";
import { exportStrings } from "../src/export/strings";
import { buildExport, withWarning, type Built, type ExportPlan } from "../src/export/source";

beforeAll(() => registerStrings(exportStrings));
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const AUTHOR = { name: "Ana Souza", surname: "Souza", contact: [] as string[] };
const ch = (path: string, title: string, number: number | null, include = true): ChapterRef => ({ path, title, number, include });
const CHAPTERS = [
  ch("A/Chapters/Prólogo.md", "Prólogo", null),
  ch("A/Chapters/01 A chegada.md", "A chegada", 1),
  ch("A/Chapters/02 Rascunho.md", "Rascunho", 2, false),
  ch("A/Chapters/03 A casa.md", "A casa", 3),
];
const TEXT: Record<string, string> = {
  "A/Chapters/Prólogo.md": "Antes de haver casa.\n\nHavia o vento.",
  "A/Chapters/01 A chegada.md": "Um.\n\n%% XXX: um %%\n\nDois.",
  "A/Chapters/03 A casa.md": "Três.\n\n![[a.png]]\n\nQuatro.",
  "conto.md": "Uma frase.\n\nOutra frase.",
  "ded.md": "Para alguém.",
};

function planOf(paths: string[], single = false): ExportPlan {
  return {
    title: single ? "O porão" : "A Casa", author: AUTHOR, unit: "words", single, placeholderMarker: "XXX",
    parts: paths.map((path, i) => ({
      role: "body" as const, path, heading: single ? null : `Heading ${i}`, title: null, label: path.split("/").pop()!.replace(/\.md$/, ""),
    })),
  };
}
const build = (paths: string[], single = false): Promise<Built> => buildExport(planOf(paths, single), {
  read: async (p) => ({ text: TEXT[p], mtime: 1 }),
  count: async (p) => measureText(TEXT[p]),
  checkpoint: async () => {},
});

function fakeHost(over: Partial<ExportHost> = {}): ExportHost & { built: ReturnType<typeof vi.fn>; written: ReturnType<typeof vi.fn>; jumped: ReturnType<typeof vi.fn> } {
  const built = vi.fn(async (s: ModalState) => {
    if (!s.whole) return build(["conto.md"], true);
    return build(["A/Chapters/Prólogo.md", "A/Chapters/03 A casa.md"]);   // clean, bar an embed (info only)
  });
  const written = vi.fn(async () => true);
  const jumped = vi.fn();
  return Object.assign({
    titleFor: (s: ModalState) => (s.whole ? "A Casa" : "O porão"),
    build: built,
    pathFor: (s: ModalState) => `Escrita/Exports/${s.whole ? "A Casa" : "O porão"} (${s.preset === "ptbr" ? "pt-BR" : "Shunn"}).${s.format}`,
    write: written,
    jump: jumped,
    openLast: () => true,
    fileExists: () => true,
  }, over, { built, written, jumped }) as never;
}

const BOOK: BookOptions = { chapters: CHAPTERS, compileProperty: "compile", headingOverride: "", unnumberedTitles: "", offerChapter: true, front: ["dedication", "epigraph"] };
const LAST: LastExport = {
  format: "docx", preset: "ptbr", whole: true, chapters: { mode: "all" }, chapterCount: 14,
  at: "2026-10-03T14:32:00", path: "Escrita/Exports/A Casa (pt-BR).docx",
};

function open(o: Partial<ExportModalOptions> & { host: ExportHost }): { m: ExportModal; el: HTMLElement } {
  const m = new ExportModal({} as never, {
    book: BOOK, state: { whole: true, selection: { mode: "all" }, format: "docx", preset: "ptbr" }, last: null, marker: "XXX", epubSceneBreak: "* * *", ...o,
  });
  vi.spyOn(m, "close").mockImplementation(() => {});
  m.onOpen();
  return { m, el: m.contentEl };
}
const settle = async () => { await vi.advanceTimersByTimeAsync(300); };
const buttons = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>(".escrita-export-footer button")].map((b) => b.textContent);
const btn = (el: HTMLElement, text: string) => [...el.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === text)!;

describe("the export modal: a book (board 26 a)", () => {
  it("draws what, chapters, format, template and where it writes", async () => {
    const host = fakeHost();
    const { el } = open({ host, last: LAST });
    await settle();
    expect([...el.querySelectorAll(".escrita-export-label")].map((l) => l.textContent)).toEqual(["What", "Chapters", "Format", "Template"]);
    expect([...el.querySelectorAll("[aria-label='What'] button")].map((b) => b.textContent)).toEqual(["This chapter", "The whole book"]);
    expect(el.textContent).toContain("All (3)");
    expect(el.querySelector(".escrita-export-hint")!.textContent).toBe("1 chapter is always left out: 02 Rascunho (compile: false).");
    expect([...el.querySelectorAll("[aria-label='Template'] button")].map((b) => b.textContent)).toEqual(["ShunnLetter, English", "pt-BRA4, dialogue dash"]);
    expect(el.querySelector(".escrita-export-where")!.textContent)
      .toBe("Writes Escrita/Exports/A Casa (pt-BR).docx. Title page with about 100 words, dedication and epigraph from the book note.");
  });

  it("puts the last export under the box, and Export again first in the footer", async () => {
    const { el } = open({ host: fakeHost(), last: LAST });
    await settle();
    expect(el.querySelector(".escrita-export-last")!.textContent).toMatch(/^Last export: DOCX · pt-BR · 14 chapters · .*14:32 · A Casa \(pt-BR\)\.docx$/);
    expect(buttons(el)).toEqual(["Export again", "Cancel", "Preview", "Export"]);
  });

  it("has no caption and no Export again before a first export", async () => {
    const { el } = open({ host: fakeHost() });
    await settle();
    expect(el.querySelector(".escrita-export-last")!.textContent).toBe("");
    expect(buttons(el)).toEqual(["Cancel", "Preview", "Export"]);
  });

  it("says when the last file is gone", async () => {
    const { el } = open({ host: fakeHost({ fileExists: () => false }), last: LAST });
    await settle();
    expect(el.querySelector(".escrita-export-last a")).toBeNull();
    expect(el.querySelector(".escrita-export-last")!.textContent).toContain("(file moved or gone)");
  });

  it("opens the last file from its link and closes", async () => {
    const openLast = vi.fn(() => true);
    const { m, el } = open({ host: fakeHost({ openLast }), last: LAST });
    await settle();
    el.querySelector<HTMLElement>(".escrita-export-last a")!.click();
    expect(openLast).toHaveBeenCalledWith(LAST.path);
    expect(m.close).toHaveBeenCalled();
  });

  it("builds once for the open, and again only when what is read changes", async () => {
    const host = fakeHost();
    const { el } = open({ host });
    await settle();
    expect(host.built).toHaveBeenCalledTimes(1);
    btn(el, "Markdown").click();           // the format changes the file, not what is read
    await settle();
    expect(host.built).toHaveBeenCalledTimes(1);
    el.querySelector<HTMLElement>("[aria-label='Template'] button:not(.is-on)")!.click();
    await settle();
    expect(host.built).toHaveBeenCalledTimes(2);
  });

  describe("EPUB (board 31)", () => {
    const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const builds = vi.fn();
    beforeEach(() => builds.mockClear());
    const epubHost = (cover: boolean) => fakeHost({
      build: async (s: ModalState) => {
        builds();
        const b = await build(["A/Chapters/Prólogo.md", "A/Chapters/03 A casa.md"]);
        if (s.format !== "epub") return b;
        return cover ? { ...b, cover: { data: PNG, mediaType: "image/png" as const } } : { ...b, cover: null, warnings: withWarning(b.warnings, { id: "cover", level: "warning", n: 1, names: ["capa.png"], links: [] }) };
      },
    });

    it("offers EPUB as the third format, and reads the cover only when it is chosen", async () => {
      const host = epubHost(true);
      const { el } = open({ host });
      await settle();
      expect([...el.querySelectorAll("[aria-label='Format'] button")].map((b) => b.textContent)).toEqual(["DOCX", "Markdown", "EPUB"]);
      expect(builds).toHaveBeenCalledTimes(1);
      btn(el, "EPUB").click();
      await settle();
      expect(builds).toHaveBeenCalledTimes(2);
      expect(el.querySelector(".escrita-export-where")!.textContent).toContain("cover, title page, contents");
      btn(el, "DOCX").click();
      await settle();
      expect(builds).toHaveBeenCalledTimes(3);
    });

    it("warns about a cover that can't be used, and the button reads Exportar mesmo assim in pt-BR", async () => {
      const host = epubHost(false);
      const { el } = open({ host, state: { whole: true, selection: { mode: "all" }, format: "epub", preset: "ptbr" } });
      await settle();
      const rows = [...el.querySelectorAll(".escrita-export-wl")].map((r) => r.querySelector(".escrita-export-wtext")!.textContent);
      expect(rows).toContain("Cover not found or unreadable: [[capa.png]]. The EPUB goes without a cover");
      expect(btn(el, "Export anyway")).toBeDefined();
      expect(exportStrings["pt-BR"]["export.buttonAnyway"]).toBe("Exportar mesmo assim");
    });

    it("previews the reading column: contents and chapter openers, the EPUB scene break", async () => {
      const host = epubHost(true);
      const { el } = open({ host, epubSceneBreak: "◆", state: { whole: true, selection: { mode: "all" }, format: "epub", preset: "ptbr" } });
      await settle();
      btn(el, "Preview").click();
      const paper = el.querySelector(".escrita-export-paper")!;
      expect(paper.classList.contains("is-epub")).toBe(true);
      expect(paper.querySelector(".escrita-export-cover")).not.toBeNull();
      expect(paper.querySelector(".escrita-export-contents-title")!.textContent).toBe("Sumário");
      expect([...paper.querySelectorAll(".escrita-export-contents li")].map((l) => l.textContent)).toEqual(["Heading 0", "Heading 1"]);
      expect(paper.querySelectorAll(".escrita-export-chapter.is-opener")).toHaveLength(2);
      expect(paper.querySelector(".escrita-export-count")).toBeNull();
      expect(paper.querySelector(".escrita-export-end")).toBeNull();
    });
  });

  it("rebuilds after a pause when a range input changes", async () => {
    const host = fakeHost();
    const { el } = open({ host });
    await settle();
    const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
    radios[1].checked = true;
    radios[1].dispatchEvent(new Event("change"));
    await settle();
    const inputs = el.querySelectorAll<HTMLInputElement>("input.escrita-export-num");
    expect([inputs[0].value, inputs[1].value]).toEqual(["1", "3"]);
    const calls = host.built.mock.calls.length;
    inputs[1].value = "2";
    inputs[1].dispatchEvent(new Event("change"));
    inputs[1].value = "2";
    inputs[1].dispatchEvent(new Event("change"));
    await vi.advanceTimersByTimeAsync(100);
    expect(host.built.mock.calls.length).toBe(calls);
    await settle();
    expect(host.built.mock.calls.length).toBe(calls + 1);
    expect((host.built.mock.calls.at(-1)![0] as ModalState).selection).toEqual({ mode: "range", from: 1, to: 2 });
  });

  it("says so when a range leaves no chapter, with Preview and Export off", async () => {
    const host = fakeHost();
    const { el } = open({ host });
    await settle();
    const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
    radios[1].checked = true;
    radios[1].dispatchEvent(new Event("change"));
    await settle();
    const inputs = el.querySelectorAll<HTMLInputElement>("input.escrita-export-num");
    inputs[0].value = "99";
    inputs[0].dispatchEvent(new Event("change"));
    inputs[1].value = "99";
    inputs[1].dispatchEvent(new Event("change"));
    await settle();
    expect(el.textContent).toContain("No chapter is chosen.");
    expect(btn(el, "Export").disabled).toBe(true);
    expect(btn(el, "Preview").disabled).toBe(true);
  });
});

describe("the export modal: an empty selection", () => {
  const emptyCases: [string, Partial<ExportModalOptions>][] = [
    ["a pick of no chapters", { state: { whole: true, selection: { mode: "pick", paths: [] }, format: "docx", preset: "ptbr" } }],
    ["a book where every chapter is compile: false", { book: { ...BOOK, chapters: CHAPTERS.map((c) => ({ ...c, include: false })) } }],
  ];
  for (const [name, o] of emptyCases) {
    it(`disables Export, says so and never builds for ${name}`, async () => {
      const host = fakeHost();
      const { el } = open({ host, ...o });
      await settle();
      expect(btn(el, "Export").disabled).toBe(true);
      expect(el.querySelector(".escrita-export-warnings")!.textContent).toBe("No chapter is chosen.");
      expect(host.built).not.toHaveBeenCalled();
    });
  }
});

describe("the export modal: a note with warnings (board 26 c)", () => {
  const note: Partial<ExportModalOptions> = { book: null, state: { whole: false, selection: { mode: "all" }, format: "docx", preset: "shunn" } };

  it("has no What and no Chapters, and Exports as is when nothing is wrong", async () => {
    const written = vi.fn(async () => true);
    const host = fakeHost({ write: written, build: async () => build(["conto.md"], true) });
    const { m, el } = open({ host, ...note });
    await settle();
    expect([...el.querySelectorAll(".escrita-export-label")].map((l) => l.textContent)).toEqual(["Format", "Template"]);
    expect(el.querySelector(".escrita-export-warn")).toBeNull();
    expect(btn(el, "Export")).toBeDefined();
    expect(el.querySelector(".escrita-export-where")!.textContent).toContain("Short story: the title opens the first page, below the contact, with about 100 words.");
    btn(el, "Export").click();
    await vi.advanceTimersByTimeAsync(10);
    expect(written).toHaveBeenCalledTimes(1);
    expect(m.close).toHaveBeenCalled();
  });

  it("lists the warnings, reads Export anyway, and links to the line", async () => {
    const host = fakeHost({ build: async () => build(["A/Chapters/01 A chegada.md", "A/Chapters/03 A casa.md"]) });
    const { m, el } = open({ host });
    await settle();
    const rows = [...el.querySelectorAll(".escrita-export-wl")].map((r) => r.querySelector(".escrita-export-wtext")!.textContent);
    expect(rows).toEqual(["1 XXX marker is left in the text", "1 embedded item is left out (a.png)"]);
    expect(btn(el, "Export anyway")).toBeDefined();
    const go = el.querySelector<HTMLButtonElement>(".escrita-export-go")!;
    expect(go.textContent).toBe("01 A chegada, line 3");
    go.click();
    expect(m.close).toHaveBeenCalled();
    expect(host.jumped).toHaveBeenCalledWith("A/Chapters/01 A chegada.md", 2);
  });

  it("names the line alone in a single note", async () => {
    const host = fakeHost({ build: async () => build(["A/Chapters/01 A chegada.md"], true) });
    const { el } = open({ host, ...note });
    await settle();
    expect(el.querySelector(".escrita-export-go")!.textContent).toBe("line 3");
  });

  it("shows Reading… while it builds, and Export waits", async () => {
    let release!: (b: Built) => void;
    const host = fakeHost({ build: () => new Promise<Built>((r) => { release = r; }) });
    const { el } = open({ host, ...note });
    expect(el.querySelector(".escrita-export-warnings")!.textContent).toBe("Reading the text…");
    expect(btn(el, "Export").disabled).toBe(true);
    release(await build(["conto.md"], true));
    await vi.advanceTimersByTimeAsync(10);
    expect(el.querySelector(".escrita-export-warnings")!.textContent).toBe("");
    expect(btn(el, "Export").disabled).toBe(false);
  });

  it("says so when the text can't be read, and exports nothing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = fakeHost({ build: async () => { throw new Error("boom"); } });
    const { el } = open({ host, ...note });
    await settle();
    expect(el.querySelector(".escrita-export-warnings")!.textContent).toMatch(/^Couldn't read the text to export/);
    expect(btn(el, "Export").disabled).toBe(true);
    err.mockRestore();
  });

  it("stays open when the writer cancels the write", async () => {
    const host = fakeHost({ write: async () => false, build: async () => build(["conto.md"], true) });
    const { m, el } = open({ host, ...note });
    await settle();
    btn(el, "Export").click();
    await vi.advanceTimersByTimeAsync(10);
    expect(m.close).not.toHaveBeenCalled();
    expect(btn(el, "Export").disabled).toBe(false);
  });
});

describe("Export again in the modal (Q17)", () => {
  it("loads the last choices and writes at once when nothing needs a confirmation", async () => {
    const host = fakeHost({ build: async () => build(["A/Chapters/Prólogo.md"]) });
    const { m, el } = open({ host, last: LAST, state: { whole: true, selection: { mode: "all" }, format: "md", preset: "shunn" } });
    await settle();
    btn(el, "Export again").click();
    await vi.advanceTimersByTimeAsync(300);
    expect(host.written).toHaveBeenCalledTimes(1);
    const state = host.written.mock.calls[0][0] as ModalState;
    expect(state).toMatchObject({ format: "docx", preset: "ptbr", whole: true, selection: { mode: "all" } });
    expect(m.close).toHaveBeenCalled();
  });

  it("writes through the host's again path even when the last file is gone: the host asks where", async () => {
    const host = fakeHost({ build: async () => build(["A/Chapters/Prólogo.md"]), fileExists: () => false });
    const { el } = open({ host, last: LAST, state: { whole: true, selection: { mode: "all" }, format: "md", preset: "shunn" } });
    await settle();
    btn(el, "Export again").click();
    await vi.advanceTimersByTimeAsync(300);
    expect(host.written).toHaveBeenCalledTimes(1);
    expect(host.written.mock.calls[0][2]).toBe(true);
  });

  it("does not write when the host says this is a different export (a chapter named by the last one)", async () => {
    const host = fakeHost({ build: async () => build(["A/Chapters/Prólogo.md"]), canRepeat: () => false });
    const { m, el } = open({ host, last: { ...LAST, whole: false, source: "A/Chapters/01 A chegada.md" } });
    await settle();
    btn(el, "Export again").click();
    await vi.advanceTimersByTimeAsync(300);
    expect(host.written).not.toHaveBeenCalled();
    expect(m.close).not.toHaveBeenCalled();
  });

  it("still writes when the build yields to the event loop", async () => {
    const host = fakeHost({ build: async () => { await new Promise((r) => setTimeout(r, 0)); return build(["A/Chapters/Prólogo.md"]); } });
    const { el } = open({ host, last: LAST });
    await settle();
    btn(el, "Export again").click();
    await vi.advanceTimersByTimeAsync(300);
    expect(host.written).toHaveBeenCalledTimes(1);
  });

  it("keeps the warnings and waits for Export anyway", async () => {
    const host = fakeHost({ build: async () => build(["A/Chapters/01 A chegada.md"]) });
    const { m, el } = open({ host, last: LAST });
    await settle();
    btn(el, "Export again").click();
    await vi.advanceTimersByTimeAsync(300);
    expect(host.written).not.toHaveBeenCalled();
    expect(m.close).not.toHaveBeenCalled();
    expect(btn(el, "Export anyway")).toBeDefined();
  });
});

describe("the preview (board 27)", () => {
  it("swaps the options for the document, and Back returns", async () => {
    const host = fakeHost();
    const { el } = open({ host });
    await settle();
    btn(el, "Preview").click();
    expect(el.querySelector(".escrita-export-phead")!.textContent).toContain("Options › Preview");
    expect(el.querySelector(".escrita-export-psummary")!.textContent).toBe("DOCX · pt-BR · 3 chapters");
    const paper = el.querySelector(".escrita-export-paper")!;
    expect([...paper.querySelectorAll(".escrita-export-zone")].map((z) => z.textContent)).toEqual(["text"]);
    expect(paper.textContent).toContain("Antes de haver casa.");
    expect(el.querySelector(".escrita-export-phint")!.textContent).toBe("Click a paragraph to open the note there.");
    expect(el.querySelector(".escrita-export-pgo")!.textContent).toBe("Export");
    btn(el, "Back").click();
    expect(el.querySelector(".escrita-export-paper")).toBeNull();
    expect(btn(el, "Preview")).toBeDefined();
  });

  it("opens the note at the clicked paragraph and closes", async () => {
    const host = fakeHost({ build: async () => build(["A/Chapters/Prólogo.md", "A/Chapters/03 A casa.md"]) });
    const { m, el } = open({ host });
    await settle();
    btn(el, "Preview").click();
    const p = [...el.querySelectorAll<HTMLElement>("p[data-line]")].find((x) => x.textContent === "Quatro.")!;
    p.click();
    expect(m.close).toHaveBeenCalled();
    expect(host.jumped).toHaveBeenCalledWith("A/Chapters/03 A casa.md", 4);
  });

  it("exports from the preview", async () => {
    const host = fakeHost();
    const { el } = open({ host });
    await settle();
    btn(el, "Preview").click();
    el.querySelector<HTMLButtonElement>(".escrita-export-pgo")!.click();
    await vi.advanceTimersByTimeAsync(10);
    expect(host.written).toHaveBeenCalledTimes(1);
  });
});

describe("the chapter picker (board 26 b)", () => {
  function picker(checked: string[]) {
    let answer: string[] | null | undefined;
    const heads = new Map([["A/Chapters/Prólogo.md", "Prólogo"], ["A/Chapters/01 A chegada.md", "Capítulo 1 — A chegada"], ["A/Chapters/03 A casa.md", "Capítulo 2 — A casa"]]);
    const m = new ChaptersModal({} as never, CHAPTERS, heads, new Set(checked), (v) => { answer = v; });
    m.onOpen();
    return { m, el: m.contentEl, answer: () => answer };
  }
  it("lists every chapter in book order with its heading, and greys the left-out one", () => {
    const { el } = picker(["A/Chapters/Prólogo.md"]);
    const rows = [...el.querySelectorAll(".escrita-export-pick")];
    expect(rows.map((r) => r.textContent)).toEqual(["PrólogoPrólogo", "01 A chegadaCapítulo 1 — A chegada", "02 Rascunhocompile: false", "03 A casaCapítulo 2 — A casa"]);
    const boxes = rows.map((r) => r.querySelector("input")!);
    expect(boxes.map((b) => b.checked)).toEqual([true, false, false, false]);
    expect(boxes[2].disabled).toBe(true);
  });
  it("labels a left-out chapter with the setting's property name", () => {
    const m = new ChaptersModal({} as never, CHAPTERS, new Map(), new Set(), () => {}, "incluir");
    m.onOpen();
    expect(m.contentEl.textContent).toContain("incluir: false");
    expect(m.contentEl.textContent).not.toContain("compile: false");
  });
  it("answers null when dismissed", () => {
    const p = picker(["A/Chapters/Prólogo.md"]);
    p.m.onClose();
    expect(p.answer()).toBeNull();
  });
  it("returns All, then None, then a few", () => {
    const a = picker([]);
    btn(a.el, "All").click(); btn(a.el, "OK").click(); a.m.onClose();
    expect(a.answer()).toEqual(["A/Chapters/Prólogo.md", "A/Chapters/01 A chegada.md", "A/Chapters/03 A casa.md"]);
    const b = picker(["A/Chapters/Prólogo.md"]);
    btn(b.el, "None").click(); btn(b.el, "OK").click(); b.m.onClose();
    expect(b.answer()).toEqual([]);
  });
});

describe("the export modal: Enter exports", () => {
  it("keeps the primary button focused after an option change", async () => {
    const { el } = open({ host: fakeHost() });
    document.body.appendChild(el);
    await settle();
    const cta = () => el.querySelector<HTMLButtonElement>("button.mod-cta")!;
    expect(document.activeElement).toBe(cta());
    btn(el, "Markdown").click();
    expect(document.activeElement).toBe(cta());
    await settle();
    btn(el, "pt-BRA4, dialogue dash").click();
    await settle();
    expect(document.activeElement).toBe(cta());
    btn(el, "ShunnLetter, English").click();
    await settle();
    expect(document.activeElement).toBe(cta());
    el.remove();
  });
});

describe("the export modal: a collection (board 34)", () => {
  const STORIES = [ch("C/A visita.md", "A visita", null), ch("C/Zé.md", "Zé", null)];
  const COLLECTION: BookOptions = { ...BOOK, chapters: STORIES, offerChapter: false, front: [], collection: true };

  it("says what it is, lists the stories and offers no 'this chapter'", async () => {
    const { el } = open({ host: fakeHost(), book: COLLECTION });
    await settle();
    expect([...el.querySelectorAll(".escrita-export-label")].map((l) => l.textContent)).toEqual(["What", "Stories", "Format", "Template"]);
    expect(el.textContent).toContain("Collection: 2 stories");
    expect(el.textContent).toContain("All (2)");
    expect(el.querySelector("[aria-label='What'] button")).toBeNull();
  });

  it("names the missing stories in a warning that asks for confirmation", async () => {
    const warn = { id: "missingStories" as const, level: "warning" as const, n: 2, names: ["X", "Y"], links: [] };
    const host = fakeHost({ build: async () => ({ ...(await build(["A/Chapters/Prólogo.md"])), warnings: [warn] }) });
    const { el } = open({ host, book: COLLECTION });
    await settle();
    expect(el.querySelector(".escrita-export-wl")!.textContent).toBe("Stories not found: [[X]], [[Y]]. They are left out.");
    expect(buttons(el)).toContain("Export anyway");
  });
});
