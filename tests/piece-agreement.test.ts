import { describe, expect, it } from "vitest";
import { classify, type ClassifySettings, type VaultTree } from "../src/core/classify";
import { loadRows, type RowsPort, type RowSettings } from "../src/outline/rows";
import { readChapterDefault } from "../src/core/measure";
import { DEFAULT_STAGES } from "../src/core/stages";

// IMPROVEMENTS 8 (Wave 1b judge): the outline's chapter rows still compute the effective
// piece themselves (outline/rows.ts, through effectivePiece); the explorer, the goals modal
// and the outline's note view read the classifier's `piece`. One table of cases pins that
// both give the same piece and source for a chapter.

interface N { path: string; name: string; extension: string; parent: N | null; children: N[] }

const CH = "B/Chapters/01.md";
const FILES = ["B.md", CH];

function tree(fm: Record<string, Record<string, unknown>>): VaultTree<N, N> {
  const root: N = { path: "B", name: "B", extension: "", parent: null, children: [] };
  const chapters: N = { path: "B/Chapters", name: "Chapters", extension: "", parent: root, children: [] };
  root.children.push(chapters);
  const note: N = { path: "B.md", name: "B.md", extension: "md", parent: null, children: [] };
  const ch: N = { path: CH, name: "01.md", extension: "md", parent: chapters, children: [] };
  chapters.children.push(ch);
  const files = new Map([[note.path, note], [ch.path, ch]]);
  const folders = new Map([[root.path, root], [chapters.path, chapters]]);
  return {
    file: (p) => files.get(p) ?? null,
    folder: (p) => folders.get(p) ?? null,
    folders: () => [...folders.values()],
    frontmatter: (f) => fm[f.path],
    resolve: (l) => (FILES.includes(l) ? l : null),
  };
}

const S: ClassifySettings = {
  chaptersFolder: "Chapters", trackFolders: "", excludeFolders: "", chapterTemplate: "",
  targetProperty: "target", limitProperty: "limit", unitProperty: "unit", chapterTargetProperty: "chapterTarget",
  snapshotsFolder: "Escrita/Snapshots",
};
const R: RowSettings = {
  summaryProperty: "summary", statusProperty: "status", povProperty: "pov", targetProperty: "target",
  limitProperty: "limit", unitProperty: "unit", deadlineProperty: "deadline", chapterTargetProperty: "chapterTarget",
};

function rowsPort(fm: Record<string, Record<string, unknown>>): RowsPort<string> {
  return {
    chapters: () => [{ path: CH, title: "01", number: 1, include: true }],
    read: async () => ({ text: "a b c", mtime: 1 }),
    frontmatter: (p) => fm[p] ?? {},
    counts: async () => ({ words: 3, characters: 5, charactersNoSpaces: 3 }),
    placeholders: () => 0,
    chapterDefault: () => readChapterDefault(fm["B.md"], R),
    resolvePov: () => null,
    settings: () => R,
    stages: () => DEFAULT_STAGES,
  };
}

const CASES: Record<string, Record<string, Record<string, unknown>>> = {
  "book default only": { "B.md": { chapterTarget: 2000, unit: "characters" } },
  "own target wins": { "B.md": { chapterTarget: 2000 }, [CH]: { target: 500, deadline: "2026-12-01" } },
  "limit only takes the book target": { "B.md": { chapterTarget: 2000 }, [CH]: { limit: 900 } },
  "own unit wins": { "B.md": { chapterTarget: 2000, unit: "characters" }, [CH]: { unit: "words" } },
  "blank own unit": { "B.md": { chapterTarget: 2000, unit: "characters" }, [CH]: { unit: " " } },
  "no default": { "B.md": {}, [CH]: { target: 300 } },
  "nothing": { "B.md": {} },
  "invalid default": { "B.md": { chapterTarget: "abc" } },
};

describe("a chapter's piece: the outline rows and the classifier agree", () => {
  for (const [name, fm] of Object.entries(CASES)) {
    it(name, async () => {
      const p = classify(tree(fm), S, CH);
      expect(p.kind).toBe("chapter");
      const [row] = await loadRows(rowsPort(fm), "B");
      expect(row.piece).toEqual(p.piece);
      expect(row.pieceSource).toBe(p.pieceSource);
    });
  }
});
