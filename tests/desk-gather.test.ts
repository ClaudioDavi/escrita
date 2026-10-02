import { describe, expect, it } from "vitest";
import { buildDesk, type WorkSource } from "../src/desk/works";
import { deskNotices, editedAtOf } from "../src/desk/gather";

const src = (o: Partial<WorkSource>): WorkSource => ({
  path: "A.md", role: "note", stage: "draft", title: "A", count: 10, unit: "words", editedAt: 0, ...o,
});

describe("deskNotices", () => {
  const all = () => true;
  it("says nothing when there is something to write", () => {
    const model = buildDesk([src({})]);
    expect(deskNotices({ folders: [], folderExists: all, model })).toEqual([]);
  });
  it("names no works in an empty vault", () => {
    expect(deskNotices({ folders: [], folderExists: all, model: buildDesk([]) })).toEqual([{ kind: "noWorks" }]);
  });
  it("says nothing is in progress when only other stages exist", () => {
    const model = buildDesk([src({ stage: "idea" }), src({ path: "B.md", stage: "published" })]);
    expect(deskNotices({ folders: [], folderExists: all, model })).toEqual([{ kind: "nothingActive" }]);
  });
  it("names a folder that matches nothing", () => {
    const n = deskNotices({ folders: ["Contoss"], folderExists: () => false, model: buildDesk([]) });
    expect(n).toEqual([{ kind: "noFolder", folder: "Contoss" }]);
  });
  it("names a folder without works", () => {
    const n = deskNotices({ folders: ["Textos"], folderExists: all, model: buildDesk([]) });
    expect(n).toEqual([{ kind: "noneInFolder", folder: "Textos" }]);
  });
  it("keeps a typo visible next to the works of another line", () => {
    const n = deskNotices({ folders: ["Contos", "Contoss"], folderExists: (f) => f === "Contos", model: buildDesk([src({})]) });
    expect(n).toEqual([{ kind: "noFolder", folder: "Contoss" }]);
  });
  it("one missing and one empty folder give both lines", () => {
    const n = deskNotices({ folders: ["X", "Textos"], folderExists: (f) => f === "Textos", model: buildDesk([]) });
    expect(n).toEqual([{ kind: "noFolder", folder: "X" }, { kind: "noneInFolder", folder: "Textos" }]);
  });
});

describe("editedAtOf", () => {
  const entries: Record<string, { role: string; book?: string }> = {
    "Book.md": { role: "book" },
    "Book/Ch/1.md": { role: "chapter", book: "Book.md" },
    "Book/Ch/2.md": { role: "chapter", book: "Book.md" },
    "Note.md": { role: "note" },
  };
  const get = (p: string) => entries[p] as never;
  it("a note uses its own record", () => {
    expect(editedAtOf({ "Note.md": { at: 5 } }, get).get("Note.md")).toBe(5);
  });
  it("a book uses its newest chapter", () => {
    const m = editedAtOf({ "Book/Ch/1.md": { at: 3 }, "Book/Ch/2.md": { at: 9 } }, get);
    expect(m.get("Book.md")).toBe(9);
    expect(m.has("Book/Ch/1.md")).toBe(false);
  });
  it("ignores paths that are not works", () => {
    expect(editedAtOf({ "Gone.md": { at: 1 } }, get).size).toBe(0);
  });
});
