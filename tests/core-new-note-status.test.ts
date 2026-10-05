import { describe, expect, it } from "vitest";
import { needsDraftStatus, type NewNoteOptions, type NewNotePlace } from "../src/core/new-note-status";
import { withProperty } from "../src/core/chapter-plan";

const o: NewNoteOptions = {
  statusProperty: "status", typeProperty: "tipo",
  templateFolders: ["Modelos"], ownNotes: ["Início.md", "Listas de palavras", "Universo.md", "Modelos/Capítulo.md"],
};
const place = (p: Partial<NewNotePlace> = {}): NewNotePlace =>
  ({ kind: "note", markdown: true, tracked: true, snapshot: false, path: "Contos/Novo.md", ...p });

describe("needsDraftStatus", () => {
  it("a new tracked note, chapter or book note without status gets one", () => {
    expect(needsDraftStatus(place(), {}, o)).toBe(true);
    expect(needsDraftStatus(place(), null, o)).toBe(true);
    expect(needsDraftStatus(place({ kind: "chapter" }), { summary: "" }, o)).toBe(true);
    expect(needsDraftStatus(place({ kind: "book-note" }), {}, o)).toBe(true);
    expect(needsDraftStatus(place(), { status: "" }, o)).toBe(true);
  });

  it("keeps a status the note or its template already has", () => {
    expect(needsDraftStatus(place(), { status: "ideia" }, o)).toBe(false);
    expect(needsDraftStatus(place(), { status: ["revisão"] }, o)).toBe(false);
  });

  it("skips untracked notes, snapshots, non-markdown files and book files", () => {
    expect(needsDraftStatus(place({ tracked: false }), {}, o)).toBe(false);
    expect(needsDraftStatus(place({ snapshot: true }), {}, o)).toBe(false);
    expect(needsDraftStatus(place({ markdown: false }), {}, o)).toBe(false);
    expect(needsDraftStatus(place({ kind: "book-file", path: "Romances/A/Darlings.md" }), {}, o)).toBe(false);
  });

  it("skips templates, universe entries and Escrita's own notes", () => {
    expect(needsDraftStatus(place({ path: "Modelos/Conto.md" }), {}, o)).toBe(false);
    expect(needsDraftStatus(place({ path: "Universo/Personagens/Teo.md" }), { tipo: "personagem" }, o)).toBe(false);
    expect(needsDraftStatus(place({ path: "Início.md" }), {}, o)).toBe(false);
    expect(needsDraftStatus(place({ path: "Listas de palavras.md" }), {}, o)).toBe(false);
    expect(needsDraftStatus(place({ path: "Universo.md" }), {}, o)).toBe(false);
  });
});

describe("withProperty", () => {
  it("adds the property first when the frontmatter lacks it", () => {
    expect(withProperty("---\nsummary: \"\"\n---\nText", "status", "rascunho")).toBe("---\nstatus: rascunho\nsummary: \"\"\n---\nText");
  });
  it("keeps a template's own value, keys compared without case", () => {
    const t = "---\nStatus: ideia\n---\n";
    expect(withProperty(t, "status", "rascunho")).toBe(t);
  });
  it("quotes values and keys YAML would misread, and keeps CRLF", () => {
    expect(withProperty("---\r\na: 1\r\n---\r\n", "book status", "first draft")).toBe("---\r\n\"book status\": \"first draft\"\r\na: 1\r\n---\r\n");
  });
  it("leaves text without frontmatter alone", () => {
    expect(withProperty("Just text", "status", "draft")).toBe("Just text");
  });
});

describe("needsDraftStatus: submissions and exports", () => {
  it("skips a note in the submissions or export folder", () => {
    const p = (x: Partial<NewNotePlace>): NewNotePlace =>
      ({ kind: "note", markdown: true, tracked: true, snapshot: false, path: "Contos/Novo.md", ...x });
    expect(needsDraftStatus(p({ submission: true }), {}, o)).toBe(false);
    expect(needsDraftStatus(p({ export: true }), {}, o)).toBe(false);
    expect(needsDraftStatus(p({ submission: false, export: false }), {}, o)).toBe(true);
  });
});
