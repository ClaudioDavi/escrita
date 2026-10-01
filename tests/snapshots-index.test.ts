import { describe, it, expect } from "vitest";
import {
  addEntry, AUTO_KINDS, emptyIndex, fnv1a, label, latest, mergeIndexes, newestFirst, parseIndex, reconcile, removeEntry,
  sameText, serializeIndex, updateEntry, type SnapshotEntry, type SnapshotIndex,
} from "../src/snapshots/index-format";

const NOTE = "Contos/A Casa.md";

function entry(file: string, patch: Partial<SnapshotEntry> = {}): SnapshotEntry {
  return {
    file, name: "", kind: "manual", taken: 1000, day: "2026-09-03", words: 10, notePath: NOTE, hash: fnv1a("x"), length: 1,
    ...patch,
  };
}

function index(entries: SnapshotEntry[]): SnapshotIndex {
  return { version: 1, note: NOTE, entries };
}

describe("parseIndex", () => {
  it("never throws on junk", () => {
    for (const j of [null, "", "   ", "{", "[]", "42", "null", '{"version":2}', '{"entries":{}}']) {
      expect(parseIndex(j, NOTE)).toEqual(emptyIndex(NOTE));
    }
  });
  it("salvages valid entries whatever the version, drops invalid ones", () => {
    const good = entry("2026-09-03 0705 Rascunho.txt", { name: "Rascunho" });
    const json = JSON.stringify({
      version: 7, note: "whatever",
      entries: [good, { file: "../escape.txt" }, { file: "a.md" }, "x", null, { name: "no file" }, { ...good }],
    });
    const i = parseIndex(json, NOTE);
    expect(i.version).toBe(1);
    expect(i.note).toBe(NOTE);
    expect(i.entries).toEqual([good]);
  });
  it("coerces an unknown kind to manual and fills missing fields", () => {
    const i = parseIndex(JSON.stringify({ entries: [{ file: "2026-09-03 0705 X.txt", kind: "weekly" }] }), NOTE);
    expect(i.entries[0]).toEqual({
      file: "2026-09-03 0705 X.txt", name: "X", kind: "manual", taken: new Date(2026, 8, 3, 7, 5).getTime(),
      day: "2026-09-03", words: -1, notePath: NOTE, hash: "", length: -1,
    });
  });
  it("serialize then parse round-trips", () => {
    const i = index([entry("a.txt", { kind: "daily" }), entry("b.txt", { name: "Versão 2", words: 1234 })]);
    const s = serializeIndex(i);
    expect(s.endsWith("}\n")).toBe(true);
    expect(parseIndex(s, NOTE)).toEqual(i);
  });
});

describe("reconcile", () => {
  it("adds a .txt without an entry as manual with the parsed name and date", () => {
    const { index: i, changed } = reconcile(emptyIndex(NOTE), ["2026-09-03 0705 Antes de publicar.txt", "index.json"]);
    expect(changed).toBe(true);
    expect(i.entries).toEqual([{
      file: "2026-09-03 0705 Antes de publicar.txt", name: "Antes de publicar", kind: "manual",
      taken: new Date(2026, 8, 3, 7, 5).getTime(), day: "2026-09-03", words: -1, notePath: NOTE, hash: "", length: -1,
    }]);
  });
  it("drops entries without a file and duplicates", () => {
    const a = entry("a.txt"), b = entry("b.txt");
    const r = reconcile(index([a, b, { ...a, name: "dup" }]), ["a.txt"]);
    expect(r.changed).toBe(true);
    expect(r.index.entries).toEqual([a]);
  });
  it("keeps an unparseable .txt with taken 0", () => {
    const r = reconcile(emptyIndex(NOTE), ["minhas notas.txt"]);
    expect(r.index.entries[0]).toMatchObject({ file: "minhas notas.txt", name: "minhas notas", taken: 0, kind: "manual" });
  });
  it("changed is false when files and index agree", () => {
    const i = index([entry("a.txt"), entry("b.txt")]);
    const r = reconcile(i, ["b.txt", "a.txt"]);
    expect(r.changed).toBe(false);
    expect(r.index.entries).toEqual(i.entries);
  });
});

describe("add / remove / update / merge", () => {
  it("addEntry replaces the same file", () => {
    const i = addEntry(index([entry("a.txt")]), entry("a.txt", { name: "novo" }));
    expect(i.entries).toEqual([entry("a.txt", { name: "novo" })]);
  });
  it("removeEntry and updateEntry", () => {
    const i = index([entry("a.txt"), entry("b.txt")]);
    expect(removeEntry(i, "a.txt").entries.map((e) => e.file)).toEqual(["b.txt"]);
    expect(updateEntry(i, "b.txt", { kind: "manual", name: "Marco" }).entries[1]).toMatchObject({ name: "Marco" });
    expect(i.entries).toHaveLength(2); // not mutated
  });
  it("mergeIndexes uses the renames map on colliding names", () => {
    const into = index([entry("2026-09-03 0705.txt", { name: "destino" })]);
    const from: SnapshotIndex = { version: 1, note: "old.md", entries: [entry("2026-09-03 0705.txt", { name: "origem" }), entry("b.txt")] };
    const m = mergeIndexes(into, from, { "2026-09-03 0705.txt": "2026-09-03 0705 (2).txt" });
    expect(m.note).toBe(NOTE);
    expect(m.entries.map((e) => [e.file, e.name])).toEqual([
      ["2026-09-03 0705.txt", "destino"], ["2026-09-03 0705 (2).txt", "origem"], ["b.txt", ""],
    ]);
  });
});

describe("ordering, hashing, labels", () => {
  it("newestFirst breaks ties by file name, descending", () => {
    const es = [entry("a.txt", { taken: 1 }), entry("b (2).txt", { taken: 5 }), entry("b.txt", { taken: 5 })];
    expect(newestFirst(es).map((e) => e.file)).toEqual(["b.txt", "b (2).txt", "a.txt"]);
    expect(latest(index(es))?.file).toBe("b.txt");
    expect(latest(emptyIndex(NOTE))).toBeNull();
  });
  it("fnv1a is stable", () => {
    expect(fnv1a("")).toBe("811c9dc5");
    expect(fnv1a("a")).toBe("e40c292c");
    expect(fnv1a("O vento")).toBe(fnv1a("O vento"));
    expect(fnv1a("O vento")).not.toBe(fnv1a("O venta"));
  });
  it("sameText gates on length and hash", () => {
    const text = "O vento soprava forte.";
    const e = entry("a.txt", { hash: fnv1a(text), length: text.length });
    expect(sameText(null, text)).toBe("no");
    expect(sameText(e, text + "!")).toBe("no");
    expect(sameText(e, "O vento soprava fraco.")).toBe("no");
    expect(sameText(e, text)).toBe("maybe");
    expect(sameText(entry("b.txt", { hash: "", length: -1 }), text)).toBe("maybe");
  });
  it("label: the name, else the kind's label", () => {
    const kl = (k: string) => `<${k}>`;
    expect(label(entry("a.txt", { name: "Marco" }), kl)).toBe("Marco");
    expect(label(entry("a.txt", { kind: "publish" }), kl)).toBe("<publish>");
  });
  it("AUTO_KINDS", () => {
    expect([...AUTO_KINDS].sort()).toEqual(["daily", "publish", "restore"]);
  });
});
