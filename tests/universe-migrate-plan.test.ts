import { describe, it, expect } from "vitest";
import { basename, dirname, effectiveMoves, folderHint, previewGroup, resultNotice, universeLink } from "../src/universe/migrate-plan";
import { planMigration } from "../src/universe/migration";
import { defaultUniverseSettings } from "../src/universe/settings";

const types = defaultUniverseSettings().entryTypes;
const plan = (files: { path: string; hasType: boolean }[], taken: string[] = [], bookHasUniverse = false) =>
  planMigration({
    bookFolder: "Casa", bookNote: "Casa.md", bookHasUniverse, universeRoot: "Universo",
    files, exists: (p) => taken.includes(p), types,
  });

describe("migrate preview", () => {
  it("path helpers", () => {
    expect(basename("a/b/Teo.md")).toBe("Teo.md");
    expect(dirname("a/b/Teo.md")).toBe("a/b");
    expect(dirname("Teo.md")).toBe("");
  });
  it("shows up to max moves, counts the hidden and always lists clashes", () => {
    const files = ["A", "B", "C", "D", "E", "F", "G"].map((n) => ({ path: `Casa/Characters/${n}.md`, hasType: n !== "B" }));
    const p = plan(files, ["Universo/Characters/G.md"]);
    const v = previewGroup(p.groups[0], true, 3);
    expect(v.rows.map((r) => r.name)).toEqual(["A.md", "B.md", "C.md", "G.md"]);
    expect(v.rows[1]).toMatchObject({ type: "move", addType: "character" });
    expect(v.rows[3]).toEqual({ type: "clash", name: "G.md", folder: "Universo/Characters" });
    expect(v.hidden).toBe(3);
    expect(v.moved).toBe(6);
    expect(v.total).toBe(7);
  });
  it("hides the type chip when the box is unticked and drops addType from the moves", () => {
    const p = plan([{ path: "Casa/Places/Porão.md", hasType: false }, { path: "Casa/Places/Sal.md", hasType: true }]);
    expect(previewGroup(p.groups[0], false).rows.every((r) => r.type === "move" && r.addType === null)).toBe(true);
    expect(effectiveMoves(p, false).map((m) => m.addType)).toEqual([null, null]);
    expect(effectiveMoves(p, true).map((m) => m.addType)).toEqual(["place", null]);
  });
  it("links the universe note by name", () => {
    expect(universeLink("Mundos/Universo.md")).toBe("[[Universo]]");
  });
  it("hints at the folders", () => {
    expect(folderHint(["Characters", "Places"])).toBe("Characters, Places");
    expect(folderHint(["Characters", "Places", "Objects"])).toBe("Characters, Places…");
    expect(folderHint([])).toBe("");
  });
});

describe("migrate result", () => {
  it("names the shared folder of the clashes, else the book folder", () => {
    const c = (from: string) => ({ kind: "character" as const, from, to: "x" });
    const one = resultNotice({ moved: 9, clashes: [c("Casa/Characters/Teo.md")], failed: [], typesAdded: 0, universeAdded: false }, "Casa");
    expect(one).toMatchObject({ moved: 9, clashCount: 1, clashFolder: "Casa/Characters", clashNames: "Teo.md", failedCount: 0 });
    const two = resultNotice({
      moved: 1, clashes: [c("Casa/Characters/Teo.md"), c("Casa/Places/Rua.md")], failed: ["Casa/Places/X.md"], typesAdded: 0, universeAdded: false,
    }, "Casa");
    expect(two.clashFolder).toBe("Casa");
    expect(two.clashNames).toBe("Teo.md, Rua.md");
    expect(two.failedNames).toBe("X.md");
  });
});
