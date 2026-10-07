import { describe, expect, it } from "vitest";
import { IndexHub, type HubEvents } from "../src/core/index-hub";
import { NamesIndex, NAMES_NOTIFY_MS, runsOf } from "../src/universe/names-index";
import type { MentionCtx } from "../src/universe/mentions";
import { settings } from "./support/mentions-setup";
import { ManualTimers, MemoryVault, settle, type MemFile } from "./support/memory-vault";

const TEXT = (name: string, n = 1): string => Array.from({ length: n }, () => `Ele viu ${name} na praia.`).join(" ");

/** a conto is its own work; a chapter belongs to the book folder it is in */
function workOf(path: string): { work: string; chapter: number | null } | null {
  if (!path.startsWith("Contos/")) return null;
  const m = /^(Contos\/[^/]+)\/[^/]+\.md$/.exec(path);
  return { work: m ? m[1] : path, chapter: null };
}

function setup(files: Record<string, string>) {
  const vault = new MemoryVault(files);
  const timers = new ManualTimers();
  const cbs = { modify: [] as ((f: MemFile) => void)[], rename: [] as ((f: MemFile, o: string) => void)[], del: [] as ((f: MemFile) => void)[], create: [] as ((f: MemFile) => void)[] };
  const events: HubEvents<MemFile> = {
    onCreate: (cb) => void cbs.create.push(cb),
    onModify: (cb) => void cbs.modify.push(cb),
    onDelete: (cb) => void cbs.del.push(cb),
    onRename: (cb) => void cbs.rename.push(cb),
    onMetaChanged: () => {}, onResolved: () => {}, onLayoutReady: (cb) => cb(), layoutReady: () => true, hasCache: () => true,
  };
  vault.onEvent((e) => {
    if (e.type === "modify") cbs.modify.forEach((c) => c(e.file));
    else if (e.type === "delete") cbs.del.forEach((c) => c({ path: e.path, extension: "", text: "" }));
    else if (e.type === "rename") cbs.rename.forEach((c) => c({ path: e.path, extension: "", text: "" }, e.oldPath));
  });
  const hub = new IndexHub<MemFile>(events, vault, timers, { snapshotsRoot: () => "Escrita/Snapshots" });
  const index = new NamesIndex<MemFile>({
    add: (spec) => hub.add(spec),
    remove: (ix) => hub.remove(ix),
    settings,
    lang: () => "pt",
    ctx: () => ({ inScope: (n) => !n.startsWith("Fora/"), workOf: (n) => workOf(n) }) as Pick<MentionCtx, "inScope" | "workOf">,
    timers,
  });
  let told = 0;
  index.onChange(() => told++);
  return { vault, timers, index, told: () => told };
}

describe("runsOf", () => {
  it("keys the runs not at a sentence start, never headings or comments", () => {
    expect(runsOf("# Zeferino\n\nEle viu Zefa na praia. %% Teodoro %%\n", "pt")).toEqual(["zefa"]);
    expect(runsOf("Nada aqui.", "pt")).toBeUndefined();
  });
});

describe("NamesIndex", () => {
  it("reads nothing until the rule asks, then builds once and tells the listeners once", async () => {
    const s = setup({ "Contos/a.md": TEXT("Zefa"), "Contos/b.md": TEXT("Zefa"), "Modelos/t.md": TEXT("Zefa"), "Escrita/Snapshots/x.md": TEXT("Zefa") });
    s.index.start();
    await settle();
    expect(s.vault.readCount).toBe(0);
    expect(s.index.isReady()).toBe(false);
    expect(s.index.workCount("Zefa", "Contos/a.md")).toBe(0);
    s.index.want();
    s.index.want();
    await settle();
    expect(s.index.isReady()).toBe(true);
    expect(s.vault.readCount).toBe(2);               // templates and snapshots are not read
    expect(s.told()).toBe(1);
    expect(s.index.get("Contos/a.md")).toEqual(["zefa"]);
    await s.timers.advance(NAMES_NOTIFY_MS * 2);
    expect(s.told()).toBe(1);
  });

  it("a want before start is kept and fires at start", async () => {
    const s = setup({ "Contos/a.md": TEXT("Zefa") });
    s.index.want();
    s.index.start();
    await settle();
    expect(s.index.isReady()).toBe(true);
  });

  it("counts works, not notes: chapters of one book are one work; notes outside the scope never count", async () => {
    const s = setup({
      "Contos/Livro/c1.md": TEXT("Zefa"), "Contos/Livro/c2.md": TEXT("Zefa"),
      "Contos/b.md": TEXT("Zefa"), "Contos/c.md": TEXT("Teo"), "Fora/d.md": TEXT("Zefa"), "Universo/Zefa.md": TEXT("Zefa"),
    });
    s.index.start();
    s.index.want();
    await settle();
    expect(s.index.workCount("Zefa", "Contos/b.md")).toBe(2);   // the book and the conto
    expect(s.index.workCount("zefa", "Contos/b.md")).toBe(2);   // by the fold, as the rule asks
    expect(s.index.workCount("Teo", "Contos/b.md")).toBe(1);
    expect(s.index.workCount("Ninguém", "Contos/b.md")).toBe(0);
  });

  it("an edit that changes the runs tells the listeners once, after a quiet time", async () => {
    const s = setup({ "Contos/a.md": TEXT("Zefa"), "Contos/b.md": "Nada." });
    s.index.start();
    s.index.want();
    await settle();
    expect(s.index.workCount("Teo", "Contos/a.md")).toBe(0);
    s.vault.modify("Contos/b.md", TEXT("Teo"));
    await s.timers.advance(4000);                     // the index settles
    expect(s.index.workCount("Teo", "Contos/a.md")).toBe(1);
    expect(s.told()).toBe(1);
    await s.timers.advance(NAMES_NOTIFY_MS);
    expect(s.told()).toBe(2);
    s.vault.modify("Contos/b.md", TEXT("Teo") + " Mais um texto.");   // same runs: nothing changes
    await s.timers.advance(4000 + NAMES_NOTIFY_MS);
    expect(s.told()).toBe(2);
  });

  it("follows a rename and a delete", async () => {
    const s = setup({ "Contos/a.md": TEXT("Zefa"), "Contos/b.md": TEXT("Zefa") });
    s.index.start();
    s.index.want();
    await settle();
    expect(s.index.workCount("Zefa", "Contos/a.md")).toBe(2);
    s.vault.rename("Contos/b.md", "Contos/c.md");
    await s.timers.advance(4000);
    expect(s.index.workCount("Zefa", "Contos/a.md")).toBe(2);
    s.vault.delete("Contos/c.md");
    await s.timers.advance(4000);
    expect(s.index.workCount("Zefa", "Contos/a.md")).toBe(1);
  });

  it("dispose takes the index out of the hub and answers nothing", async () => {
    const s = setup({ "Contos/a.md": TEXT("Zefa"), "Contos/b.md": TEXT("Zefa") });
    s.index.start();
    s.index.want();
    await settle();
    s.index.dispose();
    expect(s.index.started).toBe(false);
    expect(s.index.isReady()).toBe(false);
    expect(s.index.workCount("Zefa", "Contos/a.md")).toBe(0);
  });
});
