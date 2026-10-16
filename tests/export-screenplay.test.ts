import { beforeAll, describe, expect, it } from "vitest";
import { formatsFor, EXPORT_FORMATS } from "../src/core/export-formats";
import { SHUNN, PTBR } from "../src/core/presets";
import { measureText } from "../src/core/measure";
import { registerStrings } from "../src/i18n";
import { exportFileName, keepBothName, presetLabel } from "../src/export/logic";
import { propertyText, screenplayTitlePage, unsupportedWarning, withScreenplay, type ScreenplaySettings } from "../src/export/screenplay";
import { buildExport, needsConfirm, type ExportPlan } from "../src/export/source";
import { exportStrings } from "../src/export/strings";
import { WRITERS } from "../src/export/writers/table";
import { fountainOptions } from "../src/core/fountain";
import { screenplayPreset } from "../src/core/screenplay-presets";
import { DEFAULT_SETTINGS, defaultsFor } from "../src/settings";

beforeAll(() => registerStrings(exportStrings));

const AUTHOR = { name: "Ana Souza", surname: "Souza", contact: ["ana@exemplo.com", "(11) 99999-0000"] };
const SETTINGS = (over: Partial<ScreenplaySettings> = {}): ScreenplaySettings => ({
  ...defaultsFor("pt-BR"), placeholderMarker: "XXX", threadKeyword: "thread", ...over,
} as ScreenplaySettings);

describe("file names", () => {
  it("a PDF names its page, Fountain has none", () => {
    expect(exportFileName("O farol", "pdf", "letter")).toBe("O farol (Letter).pdf");
    expect(exportFileName("O farol", "pdf", "a4")).toBe("O farol (A4).pdf");
    expect(exportFileName("O farol", "fountain", "a4")).toBe("O farol.fountain");
    expect(exportFileName("O farol", "docx", "shunn")).toBe("O farol (Shunn).docx");
    expect(exportFileName("O farol", "md", "shunn")).toBe("O farol.md");
    expect(presetLabel("letter")).toBe("Letter");
  });
  it("the keep-both names follow", () => {
    const at = new Date(2026, 9, 15, 21, 4);
    expect(keepBothName("O farol", "pdf", "a4", at)).toBe("O farol (A4) 2026-10-15 21h04.pdf");
    expect(keepBothName("O farol", "fountain", "a4", at)).toBe("O farol 2026-10-15 21h04.fountain");
  });
});

describe("the writers by format", () => {
  it("has a writer for every format, of the kind the formats offered for a source need", () => {
    for (const f of EXPORT_FORMATS) expect(WRITERS[f]).toBeDefined();
    for (const f of formatsFor({ single: true, form: "screenplay" })) expect(WRITERS[f].kind).toBe("script");
    for (const f of formatsFor({ single: true, form: null })) expect(WRITERS[f].kind).toBe("prose");
    for (const f of formatsFor({ single: false, form: "screenplay" })) expect(WRITERS[f].kind).toBe("prose");
  });
  it("the script writers make a PDF and a Fountain file from the same input", async () => {
    const script = (await run("INT. FAROL - NOITE\n\nJOÃO\nOi.")).screenplay!;
    const input = {
      script: { script: script.script, titlePage: script.titlePage },
      page: screenplayPreset("a4", { screenplayMore: "(MAIS)", screenplayContinued: "(CONT.)", screenplaySceneNumbers: false }),
      words: fountainOptions(SETTINGS()), notes: [],
    };
    const pdf = WRITERS.pdf.write(input) as Uint8Array;
    expect(new TextDecoder("latin1").decode(pdf.slice(0, 8))).toBe("%PDF-1.4");
    const fountain = WRITERS.fountain.write(input) as string;
    expect(fountain).toBe("Title: O farol\nCredit: Roteiro de\nAuthor: Ana Souza\nContact:\n    ana@exemplo.com\n    (11) 99999-0000\n\nINT. FAROL - NOITE\n\nJOÃO\nOi.\n");
  });
});

describe("propertyText", () => {
  it("is text, numbers, lists and links as plain text", () => {
    expect(propertyText(" o conto \"A ilha\" ")).toBe("o conto \"A ilha\"");
    expect(propertyText(2026)).toBe("2026");
    expect(propertyText(["A", "[[B|bê]]", "[[C#x]]"])).toBe("A, bê, C");
    expect(propertyText(undefined)).toBe("");
    expect(propertyText({})).toBe("");
  });
});

describe("the title page", () => {
  const base = (over: Partial<Parameters<typeof screenplayTitlePage>[0]> = {}) => screenplayTitlePage({
    title: "O farol", author: AUTHOR, frontmatter: { source: "o conto \"A ilha\"", draftDate: "15/10/2026" }, block: null,
    settings: { screenplayCredit: "Roteiro de", screenplaySourceProperty: "source", screenplayDraftDateProperty: "draftDate" }, preset: PTBR, ...over,
  });

  it("is the board's: title, credit, author, source, date and the contact lines", () => {
    expect(base()).toEqual({
      title: "O farol", credit: "Roteiro de", author: "Ana Souza", source: "o conto \"A ilha\"", draftDate: "15/10/2026",
      contact: ["ana@exemplo.com", "(11) 99999-0000"],
    });
  });
  it("reads the properties without regard to case, and leaves a missing one out", () => {
    const tp = base({ frontmatter: { SOURCE: "x" } });
    expect(tp.source).toBe("x");
    expect(tp.draftDate).toBeUndefined();
    expect(base({ settings: { screenplayCredit: "Roteiro de", screenplaySourceProperty: "", screenplayDraftDateProperty: "" } }).source).toBeUndefined();
  });
  it("a Title: block fills only what is still empty", () => {
    const block = { title: "Outro", credit: "Escrito por", author: "Beto", source: "um romance", draftDate: "1/1", contact: ["b@c.d"] };
    expect(base({ block })).toMatchObject({ title: "O farol", credit: "Roteiro de", author: "Ana Souza", source: "o conto \"A ilha\"", draftDate: "15/10/2026", contact: ["ana@exemplo.com", "(11) 99999-0000"] });
    const bare = base({ author: { name: "", surname: "", contact: [] }, frontmatter: {}, block });
    expect(bare).toEqual({ title: "O farol", credit: "Roteiro de", author: "Beto", source: "um romance", draftDate: "1/1", contact: ["b@c.d"] });
  });
  it("has no credit line when nobody is credited, and no contact without lines", () => {
    const tp = base({ author: { name: "", surname: "", contact: [] }, frontmatter: {} });
    expect(tp).toEqual({ title: "O farol" });
  });
  it("a contact line with no name stays a contact line", () => {
    const tp = base({ author: { name: "", surname: "", contact: ["só@contato"] }, frontmatter: {} });
    expect(tp.contact).toEqual(["só@contato"]);
    expect(tp.author).toBeUndefined();
  });
  it("the English install's credit", () => {
    expect(base({ preset: SHUNN, settings: { screenplayCredit: DEFAULT_SETTINGS.screenplayCredit, screenplaySourceProperty: "source", screenplayDraftDateProperty: "draftDate" } }).credit).toBe("Written by");
  });
});

function planOf(): ExportPlan {
  return { title: "O farol", author: AUTHOR, unit: "words", single: true, placeholderMarker: "XXX", parts: [{ role: "body", path: "O farol.md", heading: null, title: null, label: "O farol" }] };
}
async function buildOf(text: string) {
  return buildExport(planOf(), { read: async () => ({ text, mtime: 1 }), count: async () => measureText(text), checkpoint: async () => {} });
}
const run = async (text: string, state: { format: string; preset: string; sceneNumbers?: boolean } = { format: "pdf", preset: "a4", sceneNumbers: false }, fm: Record<string, unknown> = {}) =>
  withScreenplay(await buildOf(text), { state, settings: SETTINGS(), title: "O farol", frontmatter: fm, preset: PTBR });

describe("the screenplay build", () => {
  it("parses the script, merges the title page and counts the pages (the title page too)", async () => {
    const b = await run("Title: Do bloco\n\nINT. FAROL - NOITE\n\nJOÃO\nOi.", { format: "pdf", preset: "a4" }, { source: "x" });
    expect(b.screenplay!.script.elements.map((e) => e.type)).toEqual(["scene", "character", "dialogue"]);
    expect(b.screenplay!.titlePage).toMatchObject({ title: "O farol", author: "Ana Souza", source: "x" });
    expect(b.screenplay!.pdf!.pages).toBe(2);
    expect(b.screenplay!.preset.id).toBe("a4");
    expect(b.warnings).toEqual([]);
  });
  it("Fountain has no pages and no PDF warning", async () => {
    const b = await run("EXT. A - DIA\n\nOlá ★", { format: "fountain", preset: "letter" });
    expect(b.screenplay!.pdf).toBeNull();
    expect(b.warnings).toEqual([]);
  });
  it("a PDF warns about the characters Courier cannot print, with their lines, and asks to confirm", async () => {
    const b = await run("EXT. A - DIA\n\nUma estrela ★.\n\nO ő voltou.\n\nÉ só ★ de novo.", { format: "pdf", preset: "letter" });
    const w = b.warnings.find((x) => x.id === "unsupported")!;
    expect(w).toMatchObject({ level: "warning", n: 3, names: ["★", "ő"] });
    expect(w.links.map((l) => [l.path, l.line, l.where])).toEqual([["O farol.md", 2, "O farol"], ["O farol.md", 4, "O farol"], ["O farol.md", 6, "O farol"]]);
    expect(needsConfirm(b.warnings)).toBe(true);
  });
  it("Portuguese prints without a warning", async () => {
    const b = await run("INT. CASA - DIA\n\nJOÃO\n“Não é só isso — é tudo…”", { format: "pdf", preset: "a4" });
    expect(b.warnings).toEqual([]);
  });
  it("keeps the placeholders and beats warnings, drops the embeds' note", async () => {
    const b = await run("%% beat: x %%\n\nINT. A - DIA\n\n%% XXX: cor %%\n\nVê ![[foto.png]]", { format: "pdf", preset: "a4" });
    expect(b.warnings.some((w) => w.id === "placeholders")).toBe(true);
    expect(b.warnings.some((w) => w.id === "embeds")).toBe(false);
  });
  it("scene numbers change the pages' rows, not the page count of a short script", async () => {
    const a = await run("INT. A - DIA\n\nx", { format: "pdf", preset: "letter", sceneNumbers: true });
    expect(a.screenplay!.preset.sceneNumbers).toBe(true);
    expect((await run("INT. A - DIA\n\nx", { format: "pdf", preset: "letter" })).screenplay!.preset.sceneNumbers).toBe(false);
  });
  it("keeps the writer's notes apart from Escrita's markers", async () => {
    const b = await run("INT. A - DIA\n\n%% lembrar da chuva %%\n\n%% beat: b %%\n\nx", { format: "fountain", preset: "a4" });
    expect(b.screenplay!.notes).toEqual([{ line: 2, text: "lembrar da chuva" }]);
  });
});

describe("unsupportedWarning", () => {
  it("is null when there is nothing, and lists each line once", () => {
    expect(unsupportedWarning({ bytes: new Uint8Array(), pages: 1, unsupported: [] }, "a.md", "a")).toBeNull();
    const w = unsupportedWarning({ bytes: new Uint8Array(), pages: 1, unsupported: [{ char: "★", line: 4 }, { char: "★", line: 4 }, { char: "ő", line: 1 }] }, "a.md", "a")!;
    expect(w.n).toBe(3);
    expect(w.links.map((l) => l.line)).toEqual([1, 4]);
  });
});
