import { describe, expect, it } from "vitest";
import { SharedFolderError, SnapshotStore, type SnapshotFs } from "../src/snapshots/store";
import { parseIndex } from "../src/snapshots/index-format";
import type { SnapshotKind } from "../src/snapshots/index-format";

/** In-memory SnapshotFs: files by path, folders implied by paths plus explicit ones. */
class MemFs implements SnapshotFs {
  files = new Map<string, string>();
  dirs = new Set<string>();
  trashed: string[] = [];

  private addDirs(path: string): void {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) this.dirs.add(parts.slice(0, i).join("/"));
  }

  async exists(p: string): Promise<boolean> {
    return this.files.has(p) || this.dirs.has(p);
  }

  async list(dir: string): Promise<{ files: string[]; folders: string[] }> {
    const files: string[] = [], folders: string[] = [];
    for (const f of this.files.keys()) if (f.startsWith(`${dir}/`) && !f.slice(dir.length + 1).includes("/")) files.push(f.slice(dir.length + 1));
    for (const d of this.dirs) if (d.startsWith(`${dir}/`) && !d.slice(dir.length + 1).includes("/")) folders.push(d.slice(dir.length + 1));
    return { files, folders };
  }

  async read(p: string): Promise<string> {
    const v = this.files.get(p);
    if (v === undefined) throw new Error(`missing ${p}`);
    return v;
  }

  async write(p: string, text: string): Promise<void> {
    this.addDirs(p);
    this.files.set(p, text);
  }

  async rename(from: string, to: string): Promise<void> {
    if (await this.exists(to)) throw new Error(`exists ${to}`);
    this.addDirs(to);
    if (this.files.has(from)) {
      this.files.set(to, this.files.get(from) as string);
      this.files.delete(from);
      return;
    }
    if (!this.dirs.has(from)) throw new Error(`missing ${from}`);
    for (const [k, v] of [...this.files]) {
      if (k.startsWith(`${from}/`)) { this.files.delete(k); this.files.set(to + k.slice(from.length), v); }
    }
    for (const d of [...this.dirs]) {
      if (d === from || d.startsWith(`${from}/`)) { this.dirs.delete(d); this.dirs.add(to + d.slice(from.length)); }
    }
  }

  async trash(p: string): Promise<void> {
    this.trashed.push(p);
    this.files.delete(p);
  }

  async removeIfEmpty(dir: string): Promise<void> {
    const l = await this.list(dir);
    if (l.files.length === 0 && l.folders.length === 0) this.dirs.delete(dir);
  }
}

const ROOT = "Escrita/Snapshots";
const labels: Record<SnapshotKind, string> = {
  manual: "Snapshot", publish: "Before publishing", restore: "Before restoring", daily: "Before the day's first edit",
};

function setup(keepAuto = 20, notes: Set<string> | null = null) {
  const fs = new MemFs();
  let clock = new Date(2026, 8, 30, 10, 0).getTime();
  const store = new SnapshotStore(
    () => fs,
    () => ({ root: ROOT, keepAuto, noteExists: notes ? (p: string) => notes.has(p) : undefined }),
    (k) => labels[k],
    (text) => text.split(/\s+/).filter(Boolean).length,
    () => new Date((clock += 60_000)),
  );
  const take = (note: string | { path: string }, text: string, kind: SnapshotKind = "manual", name?: string, day = "2026-09-30") =>
    store.take(note, text, { kind, name, day, words: text.split(/\s+/).filter(Boolean).length });
  return { fs, store, take };
}

const dirOf = (note: string) => `${ROOT}/${note}`;

describe("SnapshotStore.take", () => {
  it("writes a .txt and an index.json in root/<note>.md/", async () => {
    const { fs, take } = setup();
    const r = await take("Contos/A.md", "O vento soprava.", "manual", "Primeira");
    expect(r.status).toBe("taken");
    const files = (await fs.list(dirOf("Contos/A.md"))).files.sort();
    expect(files).toEqual(["2026-09-30 1001 Primeira.txt", "index.json"]);
    expect(fs.files.get(`${dirOf("Contos/A.md")}/2026-09-30 1001 Primeira.txt`)).toBe("O vento soprava.");
    const index = parseIndex(fs.files.get(`${dirOf("Contos/A.md")}/index.json`) ?? null, "Contos/A.md");
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]).toMatchObject({ kind: "manual", name: "Primeira", words: 3, notePath: "Contos/A.md" });
  });

  it("an identical take is unchanged and writes nothing", async () => {
    const { fs, take } = setup();
    await take("A.md", "texto", "manual", "Um");
    const before = fs.files.size;
    const r = await take("A.md", "texto", "manual", "Dois");
    expect(r.status).toBe("unchanged");
    expect(fs.files.size).toBe(before);
  });

  it("a named manual take identical to an automatic one promotes it", async () => {
    const { store, take } = setup();
    await take("A.md", "texto", "publish");
    const r = await take("A.md", "texto", "manual", "Enviado ao concurso");
    expect(r.status).toBe("promoted");
    const list = await store.list("A.md");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "manual", name: "Enviado ao concurso", file: "2026-09-30 1001 Enviado ao concurso.txt" });
  });

  it("take, edit, take gives two entries, newest first", async () => {
    const { store, take } = setup();
    await take("A.md", "um", "manual", "Um");
    await take("A.md", "um dois", "manual", "Dois");
    const list = await store.list("A.md");
    expect(list.map((e) => e.name)).toEqual(["Dois", "Um"]);
  });

  it("keeps at most keepAuto automatic snapshots; manual ones are never pruned", async () => {
    const { fs, store, take } = setup(20);
    await take("A.md", "manual text", "manual", "Marco");
    for (let i = 0; i < 25; i++) await take("A.md", `daily ${i}`, "daily");
    const list = await store.list("A.md");
    expect(list.filter((e) => e.kind === "daily")).toHaveLength(20);
    expect(list.filter((e) => e.kind === "manual")).toHaveLength(1);
    expect(fs.trashed).toHaveLength(5);
    // the oldest went first
    expect(list.some((e) => fs.trashed.includes(`${dirOf("A.md")}/${e.file}`))).toBe(false);
  });

  it("resolves the note path inside the queue, so a take follows a rename queued before it", async () => {
    const { fs, store, take } = setup();
    await take("A.md", "one", "manual", "Um");
    const file = { path: "A.md" };
    const move = store.moveNote("A.md", "B.md");
    file.path = "B.md"; // Obsidian updates the TFile before the take runs
    const r = take(file, "two", "manual", "Dois");
    await Promise.all([move, r]);
    expect(await fs.exists(dirOf("A.md"))).toBe(false);
    expect((await store.list("B.md")).map((e) => e.name)).toEqual(["Dois", "Um"]);
  });

  it("serializes concurrent takes (no lost index entries)", async () => {
    const { store, take } = setup();
    await Promise.all([1, 2, 3, 4, 5].map((i) => take("A.md", `text ${i}`, "manual", `N${i}`)));
    expect(await store.list("A.md")).toHaveLength(5);
  });
});

describe("SnapshotStore rename, trash, list", () => {
  it("rename changes the name and the file, keeping the stamp", async () => {
    const { fs, store, take } = setup();
    await take("A.md", "x", "manual", "Velho");
    const e = await store.rename("A.md", "2026-09-30 1001 Velho.txt", "Novo");
    expect(e).toMatchObject({ file: "2026-09-30 1001 Novo.txt", name: "Novo" });
    expect(fs.files.has(`${dirOf("A.md")}/2026-09-30 1001 Novo.txt`)).toBe(true);
    expect(fs.files.has(`${dirOf("A.md")}/2026-09-30 1001 Velho.txt`)).toBe(false);
  });

  it("a \"Before restoring\" take never prunes the snapshot being restored or compared", async () => {
    const { fs, store, take } = setup(3);
    for (let i = 0; i < 3; i++) await take("A.md", `daily ${i}`, "daily");
    const oldest = (await store.list("A.md")).at(-1)?.file as string;
    const r = await store.take("A.md", "current text", { kind: "restore", day: "2026-09-30", words: 2, protect: [oldest] });
    expect(r.status).toBe("taken");
    const files = (await store.list("A.md")).map((e) => e.file);
    expect(files).toContain(oldest);
    expect(files).toHaveLength(3);
    expect(fs.trashed).toHaveLength(1);
    expect(fs.trashed[0]).not.toBe(`${dirOf("A.md")}/${oldest}`);
  });

  it("two notes folded into one folder (NBSP vs space) are never mixed", async () => {
    const space = "Contos/A B.md", nbsp = "Contos/A\u00A0B.md";
    const notes = new Set([space, nbsp]);
    // a MemFs that folds paths the way Obsidian's vault.create does
    const { fs, store, take } = setup(20, notes);
    const fold = (p: string) => p.replace(/\u00A0/g, " ");
    for (const m of ["exists", "list", "read", "write", "trash", "removeIfEmpty"] as const) {
      const orig = (fs[m] as (...a: unknown[]) => unknown).bind(fs);
      (fs as unknown as Record<string, unknown>)[m] = (p: string, ...rest: unknown[]) => orig(fold(p), ...rest);
    }
    await take(space, "texto da nota com espaço", "manual", "Um");
    await expect(take(nbsp, "texto da outra nota", "manual", "Dois")).rejects.toBeInstanceOf(SharedFolderError);
    await expect(store.list(nbsp)).rejects.toBeInstanceOf(SharedFolderError);
    expect((await store.list(space)).map((e) => e.name)).toEqual(["Um"]);
    // once the other spelling is gone (renamed while Escrita was off), its folder is adopted
    notes.delete(space);
    expect((await store.list(nbsp)).map((e) => e.name)).toEqual(["Um"]);
  });

  it("notesWithSnapshots finds every note with snapshot files, nested ones included", async () => {
    const { store, take } = setup();
    await take("A.md", "um", "manual", "Um");
    await take("Contos/B.md", "dois", "daily");
    await take("Contos/Sub/C.md", "três", "manual", "Três");
    expect((await store.notesWithSnapshots()).sort()).toEqual(["A.md", "Contos/B.md", "Contos/Sub/C.md"]);
  });

  it("naming an automatic snapshot makes it manual (never pruned)", async () => {
    const { store, take } = setup();
    await take("A.md", "x", "daily");
    const [e] = await store.list("A.md");
    const renamed = await store.rename("A.md", e.file, "Guardar");
    expect(renamed.kind).toBe("manual");
  });

  it("trash removes the file and the entry", async () => {
    const { fs, store, take } = setup();
    await take("A.md", "x", "manual", "Um");
    await take("A.md", "y", "manual", "Dois");
    await store.trash("A.md", "2026-09-30 1001 Um.txt");
    expect(fs.trashed).toEqual([`${dirOf("A.md")}/2026-09-30 1001 Um.txt`]);
    expect((await store.list("A.md")).map((e) => e.name)).toEqual(["Dois"]);
  });

  it("list reconciles a .txt deleted outside Escrita", async () => {
    const { fs, store, take } = setup();
    await take("A.md", "x", "manual", "Um");
    await take("A.md", "y", "manual", "Dois");
    fs.files.delete(`${dirOf("A.md")}/2026-09-30 1001 Um.txt`);
    expect((await store.list("A.md")).map((e) => e.name)).toEqual(["Dois"]);
    const index = parseIndex(fs.files.get(`${dirOf("A.md")}/index.json`) ?? null, "A.md");
    expect(index.entries).toHaveLength(1);
  });

  it("a corrupt index.json is rebuilt from the files; no file is lost", async () => {
    const { fs, store, take } = setup();
    await take("A.md", "x", "daily");
    await take("A.md", "y", "manual", "Dois");
    fs.files.set(`${dirOf("A.md")}/index.json`, "{ not json");
    const list = await store.list("A.md");
    expect(list).toHaveLength(2);
    // orphans come back as manual: the safe direction
    expect(list.every((e) => e.kind === "manual")).toBe(true);
    expect([...fs.files.keys()].filter((k) => k.endsWith(".txt"))).toHaveLength(2);
  });

  it("read fills in the words of an entry adopted from a bare file", async () => {
    const { fs, store } = setup();
    await fs.write(`${dirOf("A.md")}/2026-01-02 0304 Antigo.txt`, "três palavras aqui");
    const [e] = await store.list("A.md");
    expect(e.words).toBe(-1);
    expect(await store.read("A.md", e.file)).toBe("três palavras aqui");
    const [again] = await store.list("A.md");
    expect(again.words).toBe(3);
  });

  it("hasDaily", async () => {
    const { store, take } = setup();
    expect(await store.hasDaily("A.md", "2026-09-30")).toBe(false);
    await take("A.md", "x", "daily", undefined, "2026-09-30");
    expect(await store.hasDaily("A.md", "2026-09-30")).toBe(true);
    expect(await store.hasDaily("A.md", "2026-10-01")).toBe(false);
  });
});

describe("SnapshotStore moves", () => {
  it("moveNote into an empty target moves the folder and sets index.note", async () => {
    const { fs, store, take } = setup();
    await take("Contos/A.md", "x", "manual", "Um");
    await store.moveNote("Contos/A.md", "Livro/B.md");
    expect(await fs.exists(dirOf("Contos/A.md"))).toBe(false);
    expect(await fs.exists(`${ROOT}/Contos`)).toBe(false); // empty parent removed
    const index = parseIndex(fs.files.get(`${dirOf("Livro/B.md")}/index.json`) ?? null, "?");
    expect(JSON.parse(fs.files.get(`${dirOf("Livro/B.md")}/index.json`) as string).note).toBe("Livro/B.md");
    expect(index.entries).toHaveLength(1);
  });

  it("moveNote into an existing target merges, renaming colliding files", async () => {
    const { fs, store, take } = setup();
    await take("A.md", "a", "manual", "Um");
    // same stamp and label in B's folder
    await fs.write(`${dirOf("B.md")}/2026-09-30 1001 Um.txt`, "b");
    await store.moveNote("A.md", "B.md");
    const list = await store.list("B.md");
    expect(list.map((e) => e.file).sort()).toEqual(["2026-09-30 1001 Um (2).txt", "2026-09-30 1001 Um.txt"]);
    expect(fs.files.get(`${dirOf("B.md")}/2026-09-30 1001 Um (2).txt`)).toBe("a");
    expect(fs.files.get(`${dirOf("B.md")}/2026-09-30 1001 Um.txt`)).toBe("b");
    expect(await fs.exists(dirOf("A.md"))).toBe(false);
  });

  it("moveNote of a note without snapshots does nothing", async () => {
    const { fs, store } = setup();
    await store.moveNote("A.md", "B.md");
    expect(fs.files.size).toBe(0);
  });

  it("moveFolder then the per-note moves is idempotent and leaves no empty folders", async () => {
    const { fs, store, take } = setup();
    await take("Contos/A.md", "a", "manual", "Um");
    await take("Contos/Sub/C.md", "c", "manual", "Um");
    await store.moveFolder("Contos", "Histórias");
    await store.moveNote("Contos/A.md", "Histórias/A.md");
    await store.moveNote("Contos/Sub/C.md", "Histórias/Sub/C.md");
    expect(await fs.exists(`${ROOT}/Contos`)).toBe(false);
    expect(await store.list("Histórias/A.md")).toHaveLength(1);
    expect(await store.list("Histórias/Sub/C.md")).toHaveLength(1);
  });

  it("per-note moves first, then the folder move, merges what is left", async () => {
    const { fs, store, take } = setup();
    await take("Contos/A.md", "a", "manual", "Um");
    await take("Contos/B.md", "b", "manual", "Um");
    await store.moveNote("Contos/A.md", "Histórias/A.md");
    await store.moveFolder("Contos", "Histórias");
    expect(await fs.exists(`${ROOT}/Contos`)).toBe(false);
    expect(await store.list("Histórias/A.md")).toHaveLength(1);
    expect(await store.list("Histórias/B.md")).toHaveLength(1);
  });

  it("emits both paths on a move", async () => {
    const { store, take } = setup();
    await take("A.md", "a", "manual", "Um");
    const seen: string[] = [];
    store.onChange((p) => seen.push(p));
    await store.moveNote("A.md", "B.md");
    expect(seen).toEqual(["A.md", "B.md"]);
  });
});
