import { describe, it, expect, beforeEach } from "vitest";
import {
  SerialQueue, createChapter, renumberChapters, type ChapterFs, type CreateOptions,
} from "../src/core/chapter-engine";
import { compareChapters } from "../src/core/book";

/** One file in the fake folder; the object keeps its identity across renames, like a TFile. */
interface FakeFile { name: string; content: string }

/** An in-memory chapters folder with case-insensitive names and slow, collision-checked renames. */
class FakeFolder implements ChapterFs<FakeFile> {
  files: FakeFile[] = [];
  renames: Array<[string, string]> = [];
  templateText: string | null = null;

  constructor(names: string[]) {
    this.files = names.map((n) => ({ name: n, content: `text of ${n}` }));
  }

  private find(name: string) { return this.files.find((f) => f.name.toLowerCase() === name.toLowerCase()); }

  chapters(): string[] { return this.files.map((f) => f.name).sort(compareChapters); }
  names(): string[] { return this.files.map((f) => f.name); }

  async rename(from: string, to: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 1));
    const f = this.files.find((x) => x.name === from);
    if (!f) throw new Error(`missing ${from}`);
    const clash = this.find(to);
    if (clash && clash !== f) throw new Error(`Destination file already exists: ${to}`);
    this.renames.push([from, to]);
    f.name = to;
  }

  async create(name: string, content: string): Promise<FakeFile> {
    await new Promise((r) => setTimeout(r, 1));
    if (this.find(name)) throw new Error(`exists ${name}`);
    const f = { name, content };
    this.files.push(f);
    return f;
  }

  async template(): Promise<string | null> { return this.templateText; }

  get(name: string): FakeFile | undefined { return this.find(name); }
}

const opts: CreateOptions = { pad: 2, summaryProperty: "summary", untitled: "Untitled", now: new Date(2026, 8, 29, 21, 4) };

describe("createChapter", () => {
  let fs: FakeFolder;
  beforeEach(() => { fs = new FakeFolder(["01 Chegada", "02 A porta", "03 O porão"]); });

  it("in the middle: shifts later chapters last-first, never colliding", async () => {
    const f = await createChapter(fs, 1, "Nova: cena?", opts);
    expect(f.name).toBe("02 Nova cena");
    expect(f.content).toBe('---\nsummary: ""\n---\n');
    expect(fs.chapters()).toEqual(["01 Chegada", "02 Nova cena", "03 A porta", "04 O porão"]);
    expect(fs.renames).toEqual([["03 O porão", "04 O porão"], ["02 A porta", "03 A porta"]]);
    expect(fs.get("03 A porta")?.content).toBe("text of 02 A porta");
  });

  it("appends and prepends, with a body", async () => {
    const last = await createChapter(fs, 3, "Fim", opts, "%% beat: x %%");
    expect(last.name).toBe("04 Fim");
    expect(last.content).toBe('---\nsummary: ""\n---\n%% beat: x %%');
    const first = await createChapter(fs, 0, "Prólogo", opts);
    expect(first.name).toBe("01 Prólogo");
    expect(fs.chapters()).toEqual(["01 Prólogo", "02 Chegada", "03 A porta", "04 O porão", "05 Fim"]);
  });

  it("an unusable title becomes the untitled name", async () => {
    expect((await createChapter(fs, 3, "  / ", opts)).name).toBe("04 Untitled");
    expect((await createChapter(fs, 4, "", { ...opts, untitled: "Sem título" })).name).toBe("05 Sem título");
  });

  it("uses the template", async () => {
    fs.templateText = "---\nstatus: idea\ncreated: {{date}} {{time}}\n---\n# {{title}}\n";
    const f = await createChapter(fs, 3, "B", opts);
    expect(f.content).toBe("---\nstatus: idea\ncreated: 2026-09-29 21:04\n---\n# B\n");
  });

  it("widens every number when the count gains a digit", async () => {
    const nine = new FakeFolder(Array.from({ length: 9 }, (_, i) => `${i + 1} C${i + 1}`));
    const f = await createChapter(nine, 0, "Zero", { ...opts, pad: 1 });
    expect(f.name).toBe("01 Zero");
    expect(nine.chapters()).toEqual(["01 Zero", ...Array.from({ length: 9 }, (_, i) => `${String(i + 2).padStart(2, "0")} C${i + 1}`)]);
  });

  it("chapters sharing a title shift without temporary names", async () => {
    const same = new FakeFolder(["01 X", "02 X", "03 X"]);
    const f = await createChapter(same, 0, "X", opts);
    expect(f.name).toBe("01 X");
    expect(f.content).toBe('---\nsummary: ""\n---\n');
    expect(same.get("02 X")?.content).toBe("text of 01 X");
    expect(same.get("03 X")?.content).toBe("text of 02 X");
    expect(same.get("04 X")?.content).toBe("text of 03 X");
    expect(same.renames.some(([, to]) => to.startsWith("escrita-tmp"))).toBe(false);
  });

  it("empty book", async () => {
    const empty = new FakeFolder([]);
    expect((await createChapter(empty, 0, "Um", opts)).name).toBe("01 Um");
  });
});

describe("createChapter with number-only names", () => {
  it("inserting before \"01\" shifts it to \"02\", not \"02 01\"", async () => {
    const fs = new FakeFolder(["01", "02"]);
    await createChapter(fs, 0, "New", opts);
    expect(fs.chapters()).toEqual(["01 New", "02", "03"]);
    expect(fs.get("02")?.content).toBe("text of 01");
  });
});

describe("renumberChapters", () => {
  it("reorders with a rotation", async () => {
    const fs = new FakeFolder(["01 Chegada", "02 A porta", "03 O porão"]);
    await renumberChapters(fs, ["03 O porão", "01 Chegada", "02 A porta"], 2);
    expect(fs.chapters()).toEqual(["01 O porão", "02 Chegada", "03 A porta"]);
    expect(fs.get("01 O porão")?.content).toBe("text of 03 O porão");
  });

  it("swaps identical titles through a temporary name", async () => {
    const fs = new FakeFolder(["01 X", "02 X"]);
    await renumberChapters(fs, ["02 X", "01 X"], 2);
    expect(fs.get("01 X")?.content).toBe("text of 02 X");
    expect(fs.get("02 X")?.content).toBe("text of 01 X");
    expect(fs.renames.some(([, to]) => to.startsWith("escrita-tmp"))).toBe(true);
    expect(fs.files.every((f) => !f.name.startsWith("escrita-tmp"))).toBe(true);
  });

  it("closes gaps; a second run does nothing", async () => {
    const fs = new FakeFolder(["1 A", "5 B", "C"]);
    await renumberChapters(fs, fs.chapters(), 1);
    expect(fs.chapters()).toEqual(["1 A", "2 B", "3 C"]);
    const n = fs.renames.length;
    await renumberChapters(fs, fs.chapters(), 1);
    expect(fs.renames.length).toBe(n);
  });

  it("refuses, touching nothing, when a file outside the order holds a target", async () => {
    const fs = new FakeFolder(["01 A", "02 B", "03 C"]);
    // after deleting "01 A" from the order only, "01 B"… is fine, but ordering B, C while
    // a stray "01 C" exists must fail before any rename
    fs.files.push({ name: "01 C", content: "stray" });
    await expect(renumberChapters(fs, ["03 C", "02 B"], 2)).rejects.toThrow();
    expect(fs.renames).toEqual([]);
  });

  it("number-only names stay number-only (no old number as a title)", async () => {
    const fs = new FakeFolder(["01", "02"]);
    await renumberChapters(fs, ["02", "01"], 2);
    expect(fs.chapters()).toEqual(["01", "02"]);
    expect(fs.get("01")?.content).toBe("text of 02");
  });
});

describe("SerialQueue", () => {
  it("runs jobs one at a time in call order", async () => {
    const q = new SerialQueue();
    const log: string[] = [];
    const job = (name: string, ms: number) => q.run(async () => {
      log.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, ms));
      log.push(`end ${name}`);
      return name;
    });
    const results = await Promise.all([job("a", 10), job("b", 1), job("c", 5)]);
    expect(results).toEqual(["a", "b", "c"]);
    expect(log).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
  });

  it("a failure rejects its own promise but doesn't block later jobs", async () => {
    const q = new SerialQueue();
    const bad = q.run(async () => { throw new Error("boom"); });
    const good = q.run(async () => 42);
    await expect(bad).rejects.toThrow("boom");
    await expect(good).resolves.toBe(42);
  });

  it("quick consecutive creates through the queue number consistently", async () => {
    const fs = new FakeFolder(["01 A", "02 B"]);
    const q = new SerialQueue();
    const made = await Promise.all([
      q.run(() => createChapter(fs, 0, "X", opts)),
      q.run(() => createChapter(fs, 0, "Y", opts)),
      q.run(() => createChapter(fs, 4, "Z", opts)),
    ]);
    // file objects follow their renames: X was shifted down when Y went in before it
    expect(made.map((f) => f.name)).toEqual(["02 X", "01 Y", "05 Z"]);
    expect(fs.chapters()).toEqual(["01 Y", "02 X", "03 A", "04 B", "05 Z"]);
  });
});
