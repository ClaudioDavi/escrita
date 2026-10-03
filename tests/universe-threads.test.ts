import { describe, it, expect } from "vitest";
import { collectThreads, inScope, threadsSpec, type NoteThreads, type ThreadsSettings } from "../src/universe/threads";
import { cleanSeen, dropSeen, pruneSeen, recordSeen, renameSeen, seenAt, seenKey, type SeenStore } from "../src/universe/first-seen";
import { defaultUniverseSettings } from "../src/universe/settings";
import { VaultIndex } from "../src/core/vault-index";
import { MemoryVault, ManualTimers, type MemFile } from "./support/memory-vault";

const settings = (): ThreadsSettings => ({
  ...defaultUniverseSettings(), chaptersFolder: "Chapters", snapshotsFolder: "Escrita/Snapshots", templatesFolder: "Modelos", chapterTemplate: "", threadKeyword: "thread",
});

async function build(files: Record<string, string>, s = settings()) {
  const vault = new MemoryVault(files);
  const idx = new VaultIndex<MemFile, NoteThreads>(threadsSpec<MemFile>(() => s), vault, new ManualTimers());
  await idx.build();
  return idx;
}

describe("threads index", () => {
  it("holds notes that have threads only, skipping templates and snapshots", async () => {
    const idx = await build({
      "A.md": "x\n%% thread: um %%\n%% thread closed: dois → [[B]] %%", "B.md": "nada",
      "Modelos/T.md": "%% thread: modelo %%", "Escrita/Snapshots/A.md": "%% thread: velho %%", "img.png": "%% thread: x %%",
    });
    expect(idx.paths()).toEqual(["A.md"]);
    expect(idx.get("A.md")!.map((t) => [t.text, t.closed, t.answeredBy])).toEqual([["um", false, null], ["dois", true, "B"]]);
  });
  it("uses the configured words", async () => {
    const s = { ...settings(), threadKeyword: "fio", threadClosedWord: "fechado" };
    const idx = await build({ "A.md": "%% fio: a %%\n%% fio fechado: b %%\n%% thread: c %%" }, s);
    expect(idx.get("A.md")!.map((t) => [t.text, t.closed])).toEqual([["a", false], ["b", true]]);
  });
});

describe("collectThreads", () => {
  it("filters by note, optionally drops closed, adds first seen and sorts", async () => {
    const idx = await build({ "B.md": "%% thread: b %%", "A.md": "%% thread: a2 %%\n%% thread closed: a1 %%" });
    const seen: SeenStore = { "A.md": { a2: 5 } };
    const all = collectThreads(idx.entries(), () => true, seen);
    expect(all.map((r) => [r.path, r.thread.text, r.firstSeen, r.title])).toEqual([
      ["A.md", "a2", 5, "A"], ["A.md", "a1", null, "A"], ["B.md", "b", null, "B"],
    ]);
    expect(collectThreads(idx.entries(), (p) => p === "A.md", seen, true).map((r) => r.thread.text)).toEqual(["a2"]);
  });
  it("inScope compares kind and root; none never matches", () => {
    const u = { kind: "universe" as const, root: "U", note: "U.md" };
    expect(inScope({ ...u, note: null }, u)).toBe(true);
    expect(inScope({ kind: "book", root: "U", note: null }, u)).toBe(false);
    expect(inScope({ kind: "none", root: "", note: null }, { kind: "none", root: "", note: null })).toBe(false);
  });
});

describe("first-seen store", () => {
  it("records a thread once, ignoring spacing, and keeps it when it comes back", () => {
    const s: SeenStore = {};
    expect(recordSeen(s, "A.md", ["quem  escreveu?", "onde?"], 100)).toBe(true);
    expect(recordSeen(s, "A.md", ["quem escreveu?"], 200)).toBe(false);
    expect(seenAt(s, "A.md", " quem escreveu? ")).toBe(100);
    // the thread vanishes from the note and returns: the store still has it, and nothing was dropped
    expect(recordSeen(s, "A.md", ["onde?"], 300)).toBe(false);
    expect(seenAt(s, "A.md", "quem escreveu?")).toBe(100);
    expect(seenAt(s, "B.md", "x")).toBeNull();
    expect(seenKey("é")).toBe("é");
  });
  it("follows renames (earliest wins a collision) and deletes, also for folders", () => {
    const s: SeenStore = { "Dir/A.md": { x: 10 }, "Dir/B.md": { y: 20 }, "C.md": { x: 5 } };
    expect(renameSeen(s, "Dir", "Nova")).toBe(true);
    expect(Object.keys(s).sort()).toEqual(["C.md", "Nova/A.md", "Nova/B.md"]);
    expect(renameSeen(s, "Nova/A.md", "C.md")).toBe(true);
    expect(s["C.md"]).toEqual({ x: 5 });
    expect(dropSeen(s, "Nova")).toBe(true);
    expect(Object.keys(s)).toEqual(["C.md"]);
  });
  it("prunes notes that no longer exist", () => {
    const s: SeenStore = { "A.md": { x: 1 }, "B.md": { y: 2 } };
    expect(pruneSeen(s, (p) => p === "A.md")).toBe(true);
    expect(Object.keys(s)).toEqual(["A.md"]);
    expect(pruneSeen(s, () => true)).toBe(false);
  });
  it("cleans saved data of any shape", () => {
    expect(cleanSeen(undefined)).toEqual({});
    expect(cleanSeen([])).toEqual({});
    expect(cleanSeen({ "A.md": { a: 5.4, b: -1, c: "x", d: NaN }, "B.md": "no", "C.md": {} })).toEqual({ "A.md": { a: 5 } });
  });
});
