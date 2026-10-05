import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile, noticeLog, resetSettingLog, settingLog } from "./support/obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import type { FeatureModule, SettingsUi } from "../src/core/module-context";
import { NoteExistsError } from "../src/core/notes";
import { measureText } from "../src/core/measure";
import { registerStrings } from "../src/i18n";
import type { ExportChoice } from "../src/data";
import { exportStrings } from "../src/export/strings";
import type { ExportHost, ExportModalOptions, ModalState } from "../src/export/modal";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

// The modal is replaced by one that records what it was opened with; the "file exists" dialog answers on cue.
const modal = vi.hoisted(() => ({ opened: [] as unknown[], answer: "cancel" as "cancel" | "both" | "replace", asked: [] as unknown[][] }));
vi.mock("../src/export/modal", async () => {
  const actual = await vi.importActual<typeof import("../src/export/modal")>("../src/export/modal");
  return {
    ...actual,
    ExportModal: class { constructor(_app: unknown, public o: unknown) { modal.opened.push(o); } open(): void {} },
    askExists: async (...args: unknown[]) => { modal.asked.push(args); return modal.answer; },
  };
});
const { ExportModule } = await import("../src/export");

beforeAll(() => registerStrings(exportStrings));

const file = (path: string, mtime = 5): TFile => {
  const f = new TFile();
  f.path = path;
  f.name = path.split("/").pop()!;
  f.basename = f.name.replace(/\.md$/, "");
  f.extension = path.endsWith(".md") ? "md" : path.split(".").pop()!;
  f.stat = { ctime: 0, mtime, size: 0 };
  return f;
};

let plugin: FakePlugin;
let module: InstanceType<typeof ExportModule>;
let registry: FeatureRegistry;
let created: { path: string; data: unknown; exists: string }[];
let vaultFiles: Map<string, TFile>;
let placement: Record<string, unknown>;
let texts: Record<string, string>;
let fm: Record<string, Record<string, unknown>>;
let active: TFile | null;

const CONTO = "Contos/O porão.md";
const BOOK_NOTE = "Novels/A Casa.md";
const CH = ["Prólogo", "01 A chegada", "02 Rascunho", "03 A casa"].map((n) => `Novels/A Casa/Chapters/${n}.md`);

function addFile(path: string, text: string, frontmatter: Record<string, unknown> = {}): TFile {
  const f = file(path);
  vaultFiles.set(path, f);
  plugin.app.vault.files.set(path, f);
  texts[path] = text;
  fm[path] = frontmatter;
  return f;
}

beforeEach(() => {
  modal.opened = [];
  modal.answer = "cancel";
  modal.asked = [];
  noticeLog.length = 0;
  plugin = fakePlugin();
  plugin.data.exportChoices = {};
  plugin.settings.authorName = "Ana Souza";
  created = [];
  vaultFiles = new Map();
  placement = {};
  texts = {};
  fm = {};
  active = null;

  const app = plugin.app as unknown as Record<string, unknown> & { workspace: Record<string, unknown>; metadataCache: Record<string, unknown> };
  app.workspace.getActiveFile = () => active;
  app.metadataCache.getFileCache = (f: TFile) => ({ frontmatter: fm[f.path] });
  app.metadataCache.getFirstLinkpathDest = (link: string) => [...vaultFiles.values()].find((f) => f.basename === link) ?? null;

  const book = {
    note: file(BOOK_NOTE), title: "A Casa",
    folder: { path: "Novels/A Casa" }, chaptersFolder: { path: "Novels/A Casa/Chapters" },
  };
  plugin.books = {
    classify: (x: TFile | string) => {
      const path = typeof x === "string" ? x : x.path;
      return placement[path] ?? { path, kind: "note", book: null, snapshot: false, submission: false, export: false };
    },
    chapters: () => CH.map((p, i) => ({ file: vaultFiles.get(p)!, index: i + 1, number: i === 0 ? null : i, title: p.split("/").pop()!.replace(/\.md$/, "").replace(/^\d+ /, "") })),
    frontmatter: (f: TFile) => fm[f.path] ?? {},
    _book: book,
  } as never;
  plugin.measure = {
    unit: () => "words",
    counts: vi.fn(async (f: TFile) => measureText(texts[f.path])),
  } as never;
  plugin.notes = {
    text: (f: TFile) => ({ read: async () => texts[f.path] }),
    editorView: () => null,
    create: vi.fn(async (path: string, data: unknown, o: { exists: string }) => {
      created.push({ path, data, exists: o.exists });
      const there = vaultFiles.get(path);
      if (there && o.exists === "fail") throw new NoteExistsError(path, path, false);
      if (there && o.exists === "replace") return { file: there, outcome: "replaced" };
      const dest = there && o.exists === "unique" ? path.replace(/(\.\w+)$/, " 1$1") : path;
      const f = file(dest);
      vaultFiles.set(dest, f);
      plugin.app.vault.files.set(dest, f);
      return { file: f, outcome: "created" };
    }),
  } as never;

  module = new ExportModule(plugin.asPlugin);
  registry = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, FeatureModule>([["export", module]]));
  plugin.features = registry;
  registry.init();
  registry.apply();

  addFile(CONTO, "Um dia chegou.\n\nDois dias depois, foi embora.", { target: 4200 });
});

const run = (id: string, checking = false): boolean | void =>
  (plugin.commands.get(`escrita:${id}`) as unknown as { checkCallback(c: boolean): boolean }).checkCallback(checking);
const host = (): ExportHost => (modal.opened.at(-1) as ExportModalOptions).host;
const opts = (): ExportModalOptions => modal.opened.at(-1) as ExportModalOptions;
const state = (over: Partial<ModalState> = {}): ModalState => ({ whole: false, selection: { mode: "all" }, format: "docx", preset: "shunn", ...over });

function addBook(): void {
  addFile(BOOK_NOTE, "", { dedication: "[[Dedicatória]]", epigraph: "[[Inexistente]]", author: "Beto Lima" });
  addFile("Novels/Dedicatória.md", "Para a minha avó.");
  addFile(CH[0], "Antes da casa.");
  addFile(CH[1], "Chegou.\n\n%% XXX: depois %%\n\nFicou.");
  addFile(CH[2], "Rascunho solto.", { compile: false });
  addFile(CH[3], "A casa estava vazia.");
  const book = (plugin.books as unknown as { _book: { note: TFile } })._book;
  book.note = vaultFiles.get(BOOK_NOTE)!;
  for (const p of [BOOK_NOTE, ...CH]) {
    placement[p] = { path: p, kind: p === BOOK_NOTE ? "book-note" : "chapter", book, snapshot: false, submission: false, export: false };
  }
}

describe("export lifecycle", () => {
  it("loads with its two commands and the file menu, and unloads to the follower alone", () => {
    expect([...plugin.commands.keys()].sort()).toEqual(["escrita:export", "escrita:export-again"]);
    expect(plugin.app.workspace.liveListeners("file-menu")).toBe(1);
    plugin.settings.features = { ...plugin.settings.features, export: false };
    registry.apply();
    expect(plugin.commands.size).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(plugin.followers.size).toBe(1);
    plugin.settings.features = { ...plugin.settings.features, export: true };
    registry.apply();
    expect([...plugin.commands.keys()]).toHaveLength(2);
    expect(plugin.app.workspace.liveListeners("file-menu")).toBe(1);
    expect(plugin.followers.size).toBe(1);
  });

  it("keeps the choices following renames and deletes while it is off", () => {
    plugin.settings.features = { ...plugin.settings.features, export: false };
    registry.apply();
    const c: ExportChoice = { format: "docx", preset: "shunn", whole: false, last: { format: "docx", preset: "shunn", whole: false, chapters: { mode: "all" }, at: "t", path: "Escrita/Exports/a.docx" } };
    plugin.data.exportChoices = { "a.md": c, "b.md": { format: "md", preset: "shunn", whole: false } };
    const [f] = [...plugin.followers];
    f.moved?.("a.md", "c.md");
    expect(Object.keys(plugin.data.exportChoices).sort()).toEqual(["b.md", "c.md"]);
    f.moved?.("Escrita/Exports/a.docx", "Escrita/Exports/z.docx");
    expect(plugin.data.exportChoices["c.md"].last!.path).toBe("Escrita/Exports/z.docx");
    f.deleted?.("b.md");
    expect(Object.keys(plugin.data.exportChoices)).toEqual(["c.md"]);
    expect(plugin.requestSave).toBeDefined();
  });

  it("starts with the feature off: nothing registered, the follower still on", () => {
    const p = fakePlugin();
    p.settings.features = { export: false };
    const m = new ExportModule(p.asPlugin);
    const r = new FeatureRegistry(p.asPlugin, new Map<FeatureId, FeatureModule>([["export", m]]));
    p.features = r;
    r.init();
    r.apply();
    expect(r.isOn("export")).toBe(false);
    expect(p.commands.size).toBe(0);
    expect(p.liveListeners()).toBe(0);
    expect(p.followers.size).toBe(1);
    const last = { format: "docx" as const, preset: "shunn", whole: false, chapters: { mode: "all" as const }, at: "t", path: "Escrita/Exports/a.docx" };
    p.data.exportChoices = { "a.md": { format: "docx", preset: "shunn", whole: false, last } as ExportChoice };
    const [f] = [...p.followers];
    f.moved?.("a.md", "c.md");
    expect(Object.keys(p.data.exportChoices)).toEqual(["c.md"]);
    f.moved?.("Escrita/Exports/a.docx", "Escrita/Exports/z.docx");
    expect(p.data.exportChoices["c.md"].last!.path).toBe("Escrita/Exports/z.docx");
    p.settings.features = { export: true };
    r.apply();
    expect([...p.commands.keys()].sort()).toEqual(["escrita:export", "escrita:export-again"]);
    expect(p.followers.size).toBe(1);
  });

  it("draws its settings section, one row per key", () => {
    resetSettingLog();
    const el = document.createElement("div");
    module.settingsSection(el, { saveOnCommit: () => {}, save: async () => {}, redraw: () => {}, num: (v: string) => Number(v) } as unknown as SettingsUi);
    expect(settingLog.map((r) => r.name)).toEqual([
      "Export", "Export folder", "Left-out property", "Dedication property", "Epigraph property", "Author property",
      "Author name", "Surname for the header", "Contact lines", "Chapter heading",
    ]);
    expect(settingLog[0].heading).toBe(true);
  });
});

describe("the commands", () => {
  it("offers Export… for a Markdown note, not for a snapshot, a submission, an export or another file", () => {
    expect(run("export", true)).toBe(false);          // nothing active
    active = vaultFiles.get(CONTO)!;
    expect(run("export", true)).toBe(true);
    for (const flag of ["snapshot", "submission", "export"]) {
      placement[CONTO] = { path: CONTO, kind: "note", book: null, snapshot: false, submission: false, export: false, [flag]: true };
      expect(run("export", true)).toBe(false);
    }
    delete placement[CONTO];
    active = file("Contos/imagem.png");
    expect(run("export", true)).toBe(false);
  });

  it("opens the modal for a note with its remembered choices, or the defaults", () => {
    active = vaultFiles.get(CONTO)!;
    run("export");
    expect(opts().book).toBeNull();
    expect(opts().state).toEqual({ whole: false, selection: { mode: "all" }, format: "docx", preset: "shunn" });
    expect(opts().last).toBeNull();
    expect(opts().marker).toBe("XXX");
    plugin.data.exportChoices[CONTO] = { format: "md", preset: "ptbr", whole: false };
    run("export");
    expect(opts().state).toMatchObject({ format: "md", preset: "ptbr" });
  });

  it("offers Export again only for a work that has a last export", () => {
    active = vaultFiles.get(CONTO)!;
    expect(run("export-again", true)).toBe(false);
    plugin.data.exportChoices[CONTO] = { format: "docx", preset: "shunn", whole: false, last: { format: "docx", preset: "shunn", whole: false, chapters: { mode: "all" }, at: "2026-10-05T10:00:00.000Z", path: "x.docx" } };
    expect(run("export-again", true)).toBe(true);
  });

  it("opens from the file menu for an exportable note only", () => {
    const items: { title: string; click: () => void }[] = [];
    const menu = { addItem: (cb: (i: unknown) => void) => {
      const item = { title: "", click: () => {}, setTitle(t: string) { this.title = t; return this; }, setIcon() { return this; }, onClick(f: () => void) { this.click = f; return this; } };
      cb(item);
      items.push(item);
    } };
    plugin.app.workspace.trigger("file-menu", menu, vaultFiles.get(CONTO));
    plugin.app.workspace.trigger("file-menu", menu, file("a.png"));
    placement["Escrita/Exports/x.md"] = { export: true };
    plugin.app.workspace.trigger("file-menu", menu, file("Escrita/Exports/x.md"));
    expect(items.map((i) => i.title)).toEqual(["Export…"]);
    items[0].click();
    expect(modal.opened).toHaveLength(1);
  });
});

describe("a note's export", () => {
  async function write(s: ModalState = state()): Promise<boolean> {
    active = vaultFiles.get(CONTO)!;
    run("export");
    const built = await host().build(s);
    return host().write(s, built);
  }

  it("builds the source through plugin.notes and measures through plugin.measure", async () => {
    active = vaultFiles.get(CONTO)!;
    run("export");
    const built = await host().build(state());
    expect(built.source).toMatchObject({ title: "O porão", author: { name: "Ana Souza", surname: "Souza" } });
    expect(built.source.count).toEqual({ amount: 8, unit: "words" });
    expect(built.source.parts).toHaveLength(1);
    const counts = (plugin.measure as unknown as { counts: ReturnType<typeof vi.fn> }).counts;
    expect(counts).toHaveBeenCalledTimes(1);
    expect(host().titleFor(state())).toBe("O porão");
    expect(host().pathFor(state())).toBe("Escrita/Exports/O porão (Shunn).docx");
    expect(host().pathFor(state({ format: "md", preset: "ptbr" }))).toBe("Escrita/Exports/O porão.md");
    // the saved file's mtime seeds the measurer (the text is the file's)...
    expect(counts.mock.calls[0][1]).toEqual({ text: texts[CONTO], mtime: 5 });
    // ...but text from an open editor never does: it may be unsaved
    (plugin.notes as unknown as { editorView: unknown }).editorView = () => ({});
    await host().build(state());
    expect(counts.mock.calls[1][1]).toBeUndefined();
  });

  it("writes a DOCX through notes.create, remembers it and says so", async () => {
    expect(await write()).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0].path).toBe("Escrita/Exports/O porão (Shunn).docx");
    expect(created[0].exists).toBe("fail");
    const bytes = created[0].data as Uint8Array;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    const saved = plugin.data.exportChoices[CONTO];
    expect(saved).toMatchObject({ format: "docx", preset: "shunn", whole: false });
    expect(saved.last).toMatchObject({ format: "docx", preset: "shunn", whole: false, path: "Escrita/Exports/O porão (Shunn).docx" });
    expect(saved.last!.chapterCount).toBeUndefined();
    expect(new Date(saved.last!.at).toISOString()).toBe(saved.last!.at);
    expect(noticeLog.length).toBe(1);
  });

  it("writes Markdown text with the title and byline", async () => {
    expect(await write(state({ format: "md", preset: "ptbr" }))).toBe(true);
    expect(created[0].path).toBe("Escrita/Exports/O porão.md");
    expect(typeof created[0].data).toBe("string");
    expect(created[0].data).toContain("por Ana Souza");
    expect(created[0].data).toContain("Dois dias depois, foi embora.");
  });

  it("uses the export folder setting, normalized", async () => {
    plugin.settings.exportFolder = "Saídas/";
    await write();
    expect(created[0].path).toBe("Saídas/O porão (Shunn).docx");
  });

  it("asks when the file exists: cancel writes nothing and remembers nothing", async () => {
    vaultFiles.set("Escrita/Exports/O porão (Shunn).docx", file("Escrita/Exports/O porão (Shunn).docx", 1759400000000));
    plugin.app.vault.files.set("Escrita/Exports/O porão (Shunn).docx", vaultFiles.get("Escrita/Exports/O porão (Shunn).docx")!);
    modal.answer = "cancel";
    expect(await write()).toBe(false);
    expect(modal.asked[0].slice(1)).toEqual(["Escrita/Exports/O porão (Shunn).docx", 1759400000000]);
    expect(created.map((c) => c.exists)).toEqual(["fail"]);
    expect(plugin.data.exportChoices[CONTO]).toBeUndefined();
    expect(noticeLog).toEqual([]);
  });

  it("replaces on Replace", async () => {
    const there = file("Escrita/Exports/O porão (Shunn).docx");
    vaultFiles.set(there.path, there);
    plugin.app.vault.files.set(there.path, there);
    modal.answer = "replace";
    expect(await write()).toBe(true);
    expect(created.map((c) => [c.path, c.exists])).toEqual([[there.path, "fail"], [there.path, "replace"]]);
    expect(plugin.data.exportChoices[CONTO].last!.path).toBe(there.path);
  });

  it("keeps both with this export's date and time", async () => {
    const there = file("Escrita/Exports/O porão (Shunn).docx");
    vaultFiles.set(there.path, there);
    plugin.app.vault.files.set(there.path, there);
    modal.answer = "both";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 5, 14, 32));
    try {
      expect(await write()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
    expect(created[1]).toMatchObject({ path: "Escrita/Exports/O porão (Shunn) 2026-10-05 14h32.docx", exists: "unique" });
    expect(plugin.data.exportChoices[CONTO].last!.path).toBe("Escrita/Exports/O porão (Shunn) 2026-10-05 14h32.docx");
  });

  it("says so when the path is a folder", async () => {
    (plugin.notes as unknown as { create: unknown }).create = vi.fn(async (p: string) => { throw new NoteExistsError(p, p, true); });
    expect(await write()).toBe(false);
    expect(noticeLog[0]).toBe("Couldn't write the export: Escrita/Exports/O porão (Shunn).docx is a folder.");
  });

  it("says so, and changes nothing, when the vault refuses", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    (plugin.notes as unknown as { create: unknown }).create = vi.fn(async () => { throw new Error("disk"); });
    expect(await write()).toBe(false);
    expect(noticeLog[0]).toMatch(/^Couldn't write the export\. Nothing was changed/);
    expect(plugin.data.exportChoices[CONTO]).toBeUndefined();
    err.mockRestore();
  });

  it("opens the last file when it is there, and says when it is gone", async () => {
    await write();
    const path = plugin.data.exportChoices[CONTO].last!.path;
    expect(host().fileExists(path)).toBe(true);
    expect(host().fileExists("nowhere.docx")).toBe(false);
    expect(host().openLast("nowhere.docx")).toBe(false);
  });

  it("names a chapter exported alone by its title", async () => {
    addBook();
    active = vaultFiles.get(CH[3])!;
    run("export");
    expect(host().titleFor(state({ whole: false }))).toBe("A casa");
    expect(host().titleFor(state({ whole: true }))).toBe("A Casa");
  });
});

describe("a book's export", () => {
  async function open(s: Partial<ModalState> = {}, from = CH[3]) {
    addBook();
    active = vaultFiles.get(from)!;
    run("export");
    const st = state({ whole: true, preset: "ptbr", ...s });
    const built = await host().build(st);
    return { st, built };
  }

  it("opens with the book's chapters, its front pages that exist and the settings", async () => {
    plugin.settings.chapterHeadingFormat = "Cap. {n}";
    await open();
    const o = opts();
    expect(o.book!.chapters.map((c) => [c.path.split("/").pop(), c.include])).toEqual([
      ["Prólogo.md", true], ["01 A chegada.md", true], ["02 Rascunho.md", false], ["03 A casa.md", true],
    ]);
    expect(o.book).toMatchObject({ compileProperty: "compile", headingOverride: "Cap. {n}", offerChapter: true, front: ["dedication"] });
    expect(o.state).toMatchObject({ whole: true });
  });

  it("offers no 'This chapter' from the book note, which is always the whole book", async () => {
    await open({}, BOOK_NOTE);
    expect(opts().book!.offerChapter).toBe(false);
    expect(opts().state.whole).toBe(true);
    plugin.data.exportChoices[BOOK_NOTE] = { format: "md", preset: "shunn", whole: false };
    run("export");
    expect(opts().state.whole).toBe(true);
  });

  it("builds front matter and chapters with manuscript headings, leaving compile: false out", async () => {
    const { built } = await open();
    expect(built.source.title).toBe("A Casa");
    expect(built.source.parts.map((p) => [p.role, p.heading, p.title ?? null])).toEqual([
      ["dedication", null, null],
      ["body", "Prólogo", "Prólogo"],
      ["body", "Capítulo 1 — A chegada", "A chegada"],
      ["body", "Capítulo 2 — A casa", "A casa"],
    ]);
    expect(built.labels).toEqual(["Dedicatória", "Prólogo", "01 A chegada", "03 A casa"]);
    // the author property on the book note overrides the settings
    expect(built.source.author).toMatchObject({ name: "Beto Lima", surname: "Lima" });
    // the title page counts the body only, from the measurer
    expect(built.source.count.amount).toBe(["Antes da casa.", "Chegou.\n\n%% XXX: depois %%\n\nFicou.", "A casa estava vazia."].reduce((n, t) => n + measureText(t).words, 0));
    expect(built.warnings.map((w) => [w.id, w.links[0]?.path])).toEqual([["placeholders", CH[1]]]);
  });

  it("applies the heading format setting over the template's", async () => {
    plugin.settings.chapterHeadingFormat = "Cap. {n}: {title}";
    const { built } = await open();
    expect(built.source.parts.filter((p) => p.role === "body").map((p) => p.heading)).toEqual(["Prólogo", "Cap. 1: A chegada", "Cap. 2: A casa"]);
  });

  it("keeps a chapter's number when a range or a pick narrows the list", async () => {
    const { built } = await open({ selection: { mode: "pick", paths: [CH[3]] } });
    expect(built.source.parts.map((p) => p.heading)).toEqual([null, "Capítulo 2 — A casa"]);
    expect(built.source.count.amount).toBe(4);
  });

  it("writes the book, remembers the selection and the chapter count", async () => {
    const { st, built } = await open({ selection: { mode: "range", from: 2, to: 3 } });
    expect(await host().write(st, built)).toBe(true);
    expect(created[0].path).toBe("Escrita/Exports/A Casa (pt-BR).docx");
    const saved = plugin.data.exportChoices[BOOK_NOTE];
    expect(saved).toMatchObject({ format: "docx", preset: "ptbr", whole: true, chapters: { mode: "range", from: 2, to: 3 } });
    expect(saved.last).toMatchObject({ whole: true, chapterCount: 2, chapters: { mode: "range", from: 2, to: 3 } });
    // the key is the book note's, whichever chapter it was opened from
    expect(plugin.data.exportChoices[CH[3]]).toBeUndefined();
  });

  it("remembers a chapter exported alone without losing the book's selection", async () => {
    plugin.data.exportChoices[BOOK_NOTE] = { format: "docx", preset: "ptbr", whole: true, chapters: { mode: "range", from: 2, to: 3 } };
    addBook();
    active = vaultFiles.get(CH[3])!;
    run("export");
    const st = state({ whole: false });
    expect(await host().write(st, await host().build(st))).toBe(true);
    expect(plugin.data.exportChoices[BOOK_NOTE]).toMatchObject({ whole: false, chapters: { mode: "range", from: 2, to: 3 } });
    expect(plugin.data.exportChoices[BOOK_NOTE].last).toMatchObject({ whole: false, chapters: { mode: "all" } });
  });

  it("yields between chapters of a long book", async () => {
    addBook();
    const many = 60;
    const paths: string[] = [];
    for (let i = 0; i < many; i++) {
      const p = `Novels/A Casa/Chapters/${String(i + 10)} Cap ${i}.md`;
      addFile(p, "Texto. ".repeat(50));
      paths.push(p);
    }
    (plugin.books as unknown as { chapters: unknown }).chapters = () => paths.map((p, i) => ({ file: vaultFiles.get(p)!, index: i + 1, number: i + 10, title: `Cap ${i}` })) as never;
    for (const p of paths) placement[p] = { kind: "chapter", book: (plugin.books as unknown as { _book: unknown })._book, snapshot: false, submission: false, export: false };
    active = vaultFiles.get(paths[0])!;
    run("export");
    const yields = vi.fn();
    const orig = globalThis.MessageChannel;
    // macrotaskYield posts a message; count how many times the build gave the loop a turn
    globalThis.MessageChannel = class { port1: { onmessage: (() => void) | null; close(): void } = { onmessage: null, close() {} }; port2 = { postMessage: () => { yields(); queueMicrotask(() => this.port1.onmessage?.()); } }; } as never;
    try {
      let t = 0;
      const now = vi.spyOn(performance, "now").mockImplementation(() => (t += 3));
      const built = await host().build(state({ whole: true }));
      now.mockRestore();
      expect(built.source.parts).toHaveLength(many + 1);   // and the dedication
    } finally {
      globalThis.MessageChannel = orig;
    }
    expect(yields.mock.calls.length).toBeGreaterThan(10);
  });
});

describe("Export again from the palette (Q17)", () => {
  const last = (over: Partial<NonNullable<ExportChoice["last"]>> = {}) => ({
    format: "docx" as const, preset: "ptbr", whole: true, chapters: { mode: "all" as const }, chapterCount: 3,
    at: "2026-10-03T14:32:00.000Z", path: "Escrita/Exports/A Casa (pt-BR).docx", ...over,
  });

  it("writes at once with the last choices when nothing needs a confirmation", async () => {
    addBook();
    addFile(CH[1], "Chegou.\n\nFicou.");
    addFile("Elsewhere/kept.docx", "");
    plugin.data.exportChoices[BOOK_NOTE] = { format: "docx", preset: "ptbr", whole: true, last: last({ path: "Elsewhere/kept.docx" }) };
    active = vaultFiles.get(CH[3])!;
    run("export-again");
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].path).toBe("Escrita/Exports/A Casa (pt-BR).docx");
    expect(modal.opened).toHaveLength(0);
    expect(plugin.data.exportChoices[BOOK_NOTE].last!.at).not.toBe("2026-10-03T14:32:00.000Z");
  });

  it("opens the modal and writes nothing when the last file is gone", async () => {
    addBook();
    addFile(CH[1], "Chegou.\n\nFicou.");
    plugin.data.exportChoices[BOOK_NOTE] = { format: "docx", preset: "ptbr", whole: true, last: last({ path: "Elsewhere/gone.docx" }) };
    active = vaultFiles.get(CH[3])!;
    run("export-again");
    await vi.waitFor(() => expect(modal.opened).toHaveLength(1));
    expect(created).toHaveLength(0);
  });

  it("opens the modal with the last choices and the warnings when something needs a confirmation", async () => {
    addBook();
    plugin.data.exportChoices[BOOK_NOTE] = { format: "md", preset: "shunn", whole: true, last: last({ format: "docx", preset: "ptbr", chapters: { mode: "pick", paths: [CH[1]] } }) };
    active = vaultFiles.get(CH[3])!;
    run("export-again");
    await vi.waitFor(() => expect(modal.opened).toHaveLength(1));
    expect(created).toHaveLength(0);
    expect(opts().state).toEqual({ whole: true, selection: { mode: "pick", paths: [CH[1]] }, format: "docx", preset: "ptbr" });
    expect(opts().last).toMatchObject({ format: "docx" });
  });

  it("reopens the modal and writes nothing when the last choice gives zero parts", async () => {
    addBook();
    plugin.data.exportChoices[BOOK_NOTE] = { format: "docx", preset: "ptbr", whole: true, last: last({ chapters: { mode: "pick", paths: [] } }) };
    active = vaultFiles.get(CH[3])!;
    run("export-again");
    await vi.waitFor(() => expect(modal.opened).toHaveLength(1));
    expect(created).toHaveLength(0);
    expect(opts().state.selection).toEqual({ mode: "pick", paths: [] });
  });

  it("repeats the whole book from the book note after a 'This chapter' export", async () => {
    addBook();
    addFile(CH[1], "Chegou.\n\nFicou.");
    addFile("Elsewhere/kept.docx", "");
    plugin.data.exportChoices[BOOK_NOTE] = { format: "docx", preset: "ptbr", whole: false, last: last({ whole: false, path: "Elsewhere/kept.docx" }) };
    active = vaultFiles.get(BOOK_NOTE)!;
    run("export-again");
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].path).toBe("Escrita/Exports/A Casa (pt-BR).docx");
    expect(plugin.data.exportChoices[BOOK_NOTE].last!.whole).toBe(true);
  });

  it("opens the modal when only front matter is left after the ticked chapters are gone", async () => {
    addBook();
    plugin.data.exportChoices[BOOK_NOTE] = { format: "docx", preset: "ptbr", whole: true, last: last({ chapters: { mode: "pick", paths: ["Novels/A Casa/Chapters/gone.md"] } }) };
    active = vaultFiles.get(CH[3])!;
    run("export-again");
    await vi.waitFor(() => expect(modal.opened).toHaveLength(1));
    expect(created).toHaveLength(0);
  });

  it("repeats a note's export", async () => {
    addFile("Elsewhere/kept.md", "");
    plugin.data.exportChoices[CONTO] = { format: "md", preset: "shunn", whole: false, last: last({ format: "md", preset: "shunn", whole: false, path: "Elsewhere/kept.md" }) };
    active = vaultFiles.get(CONTO)!;
    run("export-again");
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].path).toBe("Escrita/Exports/O porão.md");
    expect(typeof created[0].data).toBe("string");
  });

  it("says so, and opens nothing, when the text can't be read", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    plugin.data.exportChoices[CONTO] = { format: "md", preset: "shunn", whole: false, last: last({ format: "md", whole: false }) };
    active = vaultFiles.get(CONTO)!;
    (plugin.notes as unknown as { text: unknown }).text = () => ({ read: async () => { throw new Error("gone"); } });
    run("export-again");
    await vi.waitFor(() => expect(noticeLog).toHaveLength(1));
    expect(noticeLog[0]).toMatch(/^Couldn't read the text to export/);
    expect(modal.opened).toHaveLength(0);
    err.mockRestore();
  });
});
