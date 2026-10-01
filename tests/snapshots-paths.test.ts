import { describe, it, expect } from "vitest";
import {
  foldedPath, isHiddenPath, isInside, labelPart, notePathOfDir, parseSnapshotFileName, renamedFileName, snapshotDir,
  snapshotFileName, stamp,
} from "../src/snapshots/paths";
import { DEFAULT_SNAPSHOTS_FOLDER, snapshotsRoot } from "../src/core/classify";

const when = new Date(2026, 8, 3, 7, 5); // 2026-09-03 07:05 local

describe("stamp", () => {
  it("uses local time with zero padding", () => {
    expect(stamp(when)).toBe("2026-09-03 0705");
    expect(stamp(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31 2359");
  });
});

describe("snapshotFileName", () => {
  const none = new Set<string>();
  it("drops the characters Obsidian rejects from a Portuguese label", () => {
    const name = snapshotFileName(when, "Antes do concurso: versão 2", none);
    expect(name).toBe("2026-09-03 0705 Antes do concurso versão 2.txt");
    expect(snapshotFileName(when, 'a/b\\c#d^e[f]g|h?i*j<k>l"m', none)).toBe("2026-09-03 0705 a b c d e f g h i j k l m.txt");
  });
  it("adds (2), (3) in the same minute, case-insensitively", () => {
    const first = snapshotFileName(when, "Rascunho", none);
    expect(snapshotFileName(when, "Rascunho", new Set([first]))).toBe("2026-09-03 0705 Rascunho (2).txt");
    expect(snapshotFileName(when, "rascunho", new Set([first, "2026-09-03 0705 rascunho (2).txt"])))
      .toBe("2026-09-03 0705 rascunho (3).txt");
  });
  it("an empty label gives the stamp alone", () => {
    expect(snapshotFileName(when, "", none)).toBe("2026-09-03 0705.txt");
    expect(snapshotFileName(when, "  :: ", none)).toBe("2026-09-03 0705.txt");
    expect(snapshotFileName(when, "", new Set(["2026-09-03 0705.txt"]))).toBe("2026-09-03 0705 (2).txt");
  });
  it("caps a long label at 80 code points without trailing dots or spaces", () => {
    const long = "é".repeat(200);
    const name = snapshotFileName(when, long, none);
    expect(Array.from(name.slice("2026-09-03 0705 ".length, -4))).toHaveLength(80);
    expect(labelPart("Fim... ")).toBe("Fim");
    expect(labelPart("a".repeat(79) + " b")).toBe("a".repeat(79));
  });
});

describe("parseSnapshotFileName", () => {
  it("round-trips the name, with and without a collision suffix", () => {
    for (const label of ["Antes do concurso versão 2", "Antes de publicar", ""]) {
      const n = snapshotFileName(when, label, new Set());
      expect(parseSnapshotFileName(n)).toEqual({ taken: when.getTime(), name: label });
    }
    expect(parseSnapshotFileName("2026-09-03 0705 Rascunho (3).txt")).toEqual({ taken: when.getTime(), name: "Rascunho" });
    expect(parseSnapshotFileName("2026-09-03 0705 (2).txt")).toEqual({ taken: when.getTime(), name: "" });
  });
  it("junk is null", () => {
    for (const n of ["index.json", "notes.txt", "2026-09-03 0705 x.md", "2026-13-03 0705.txt", "2026-02-30 0705.txt", "2026-09-03 2460.txt", ""]) {
      expect(parseSnapshotFileName(n)).toBeNull();
    }
  });
});

describe("renamedFileName", () => {
  it("keeps the stamp and avoids other names", () => {
    const file = "2026-09-03 0705 Rascunho.txt";
    expect(renamedFileName(file, "Versão final", new Set([file]))).toBe("2026-09-03 0705 Versão final.txt");
    expect(renamedFileName(file, "Outro", new Set([file, "2026-09-03 0705 Outro.txt"]))).toBe("2026-09-03 0705 Outro (2).txt");
    expect(renamedFileName(file, "RASCUNHO", new Set([file]))).toBe("2026-09-03 0705 RASCUNHO.txt");
    expect(() => renamedFileName("index.json", "x", new Set())).toThrow();
  });
});

describe("snapshotDir / notePathOfDir / foldedPath", () => {
  const root = "Escrita/Snapshots";
  it("keeps the note path's exact bytes and its .md", () => {
    const nested = "Contos/Concurso 2026/A Casa.md";
    const nbsp = "Contos/O porão.md";
    const nfd = "Contos/ninguém.md";
    for (const note of [nested, nbsp, nfd]) {
      const dir = snapshotDir(root, note);
      expect(dir).toBe(`${root}/${note}`);
      expect(notePathOfDir(root, dir)).toBe(note);
    }
  });
  it("notePathOfDir refuses other folders", () => {
    expect(notePathOfDir(root, "Escrita/Other/a.md")).toBeNull();
    expect(notePathOfDir(root, root)).toBeNull();
    expect(notePathOfDir(root, `${root}/Contos`)).toBeNull();
    expect(notePathOfDir(root, "Escrita/SnapshotsX/a.md")).toBeNull();
  });
  it("foldedPath folds what normalizePath and file systems fold: special spaces, NFD", () => {
    expect(foldedPath("A\u00A0B.md")).toBe("A B.md");
    expect(foldedPath("A\u202FB.md")).toBe("A B.md");
    expect(foldedPath("ningue\u0301m.md")).toBe("ningu\u00E9m.md");
    expect(foldedPath("Contos/A B.md")).toBe("Contos/A B.md");
  });
});

describe("isHiddenPath / isInside / core snapshotsRoot", () => {
  it("isHiddenPath", () => {
    expect(isHiddenPath(".escrita/snapshots")).toBe(true);
    expect(isHiddenPath("Escrita/.x")).toBe(true);
    expect(isHiddenPath("Escrita/Snapshots")).toBe(false);
  });
  it("isInside never means the whole vault", () => {
    expect(isInside("Escrita/Snapshots", "Escrita/Snapshots/a.md/x.txt")).toBe(true);
    expect(isInside("Escrita/Snapshots", "Escrita/Snapshots")).toBe(true);
    expect(isInside("Escrita/Snapshots", "Escrita/SnapshotsX/a.md")).toBe(false);
    expect(isInside("", "anything.md")).toBe(false);
  });
  it("snapshotsRoot (the one root rule) normalizes and falls back to the default", () => {
    expect(snapshotsRoot("")).toBe(DEFAULT_SNAPSHOTS_FOLDER);
    expect(snapshotsRoot("  /Escrita/Snapshots/ ")).toBe("Escrita/Snapshots");
    expect(snapshotsRoot(".escrita/snapshots")).toBe(".escrita/snapshots");
  });
});
