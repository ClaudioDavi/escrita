import { DEFAULT_SETTINGS } from "../src/settings";
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
const modal = vi.hoisted(() => ({ opened: [] as unknown[], answer: "cancel" as "cancel" | "both" | "replace", asked: [] as unknown[][], where: true, whereAsked: [] as unknown[][] }));
vi.mock("../src/export/modal", async () => {
  const actual = await vi.importActual<typeof import("../src/export/modal")>("../src/export/modal");
  return {
    ...actual,
    ExportModal: class { constructor(_app: unknown, public o: unknown) { modal.opened.push(o); } open(): void {} },
    askExists: async (...args: unknown[]) => { modal.asked.push(args); return modal.answer; },
    askWhere: async (...args: unknown[]) => { modal.whereAsked.push(args); return modal.where; },
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
let created: { path: string; data: unknown; exists: string; trashOld?: boolean }[];
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
  modal.where = true;
  modal.whereAsked = [];
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
    create: vi.fn(async (path: string, data: unknown, o: { exists: string; trashOld?: boolean }) => {
      created.push({ path, data, exists: o.exists, trashOld: o.trashOld });
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
    module.settingsSection(el, { defaults: () => DEFAULT_SETTINGS, saveOnCommit: () => {}, save: async () => {}, redraw: () => {}, num: (v: string) => Number(v) } as unknown as SettingsUi);
    expect(settingLog.map((r) => r.name)).toEqual([
      "Export", "Left-out property", "Dedication property", "Epigraph property", "Author property",
      "Author name", "Surname for the header", "Contact lines", "Chapter heading",
      "Cover property", "EPUB scene break", "Collection property",
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

  describe("EPUB", () => {
    const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
    let binaries: Record<string, Uint8Array | Error>;
    const files = (z: Uint8Array): string => new TextDecoder("latin1").decode(z);

    beforeEach(() => {
      binaries = {};
      (plugin.app.vault as unknown as { readBinary: unknown }).readBinary = async (f: TFile) => {
        const b = binaries[f.path];
        if (!b || b instanceof Error) throw b ?? new Error("gone");
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      };
      plugin.settings.epubSceneBreak = "◆";
    });

    it("writes an EPUB named with its preset, through notes.create", async () => {
      expect(await write(state({ format: "epub", preset: "ptbr" }))).toBe(true);
      expect(created[0].path).toBe("Escrita/Exports/O porão (pt-BR).epub");
      expect(created[0].exists).toBe("fail");
      const bytes = created[0].data as Uint8Array;
      expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
      expect(files(bytes)).toContain("application/epub+zip");
      expect(plugin.data.exportChoices[CONTO]).toMatchObject({ format: "epub", preset: "ptbr" });
      expect(plugin.data.exportChoices[CONTO].last!.path).toBe("Escrita/Exports/O porão (pt-BR).epub");
    });

    it("reads no cover when the property is missing, and warns about nothing", async () => {
      active = vaultFiles.get(CONTO)!;
      run("export");
      const built = await host().build(state({ format: "epub" }));
      expect(built.cover).toBeNull();
      expect(built.warnings.map((w) => w.id)).not.toContain("cover");
    });

    it("reads a PNG or JPEG cover as binary and puts it in the book", async () => {
      addFile("Contos/capa.png", "");
      binaries["Contos/capa.png"] = PNG;
      fm[CONTO] = { cover: "[[capa.png]]" };
      active = vaultFiles.get(CONTO)!;
      run("export");
      const built = await host().build(state({ format: "epub" }));
      expect(built.cover).toMatchObject({ mediaType: "image/png" });
      expect([...built.cover!.data]).toEqual([...PNG]);
      expect(built.warnings.map((w) => w.id)).not.toContain("cover");
      await host().write(state({ format: "epub" }), built);
      expect(files(created[0].data as Uint8Array)).toContain("images/cover.png");
      binaries["Contos/capa.png"] = JPG;
      fm[CONTO] = { cover: "![[capa.png]]" };
      expect((await host().build(state({ format: "epub" }))).cover).toMatchObject({ mediaType: "image/jpeg" });
    });

    it.each([
      ["a link to nothing", () => { fm[CONTO] = { cover: "[[sumiu.png]]" }; }],
      ["an unreadable file", () => { addFile("Contos/capa.png", ""); binaries["Contos/capa.png"] = new Error("EIO"); fm[CONTO] = { cover: "[[capa.png]]" }; }],
      ["a file that is not JPEG or PNG", () => { addFile("Contos/capa.png", ""); binaries["Contos/capa.png"] = Uint8Array.from([0x47, 0x49, 0x46, 0x38]); fm[CONTO] = { cover: "[[capa.png]]" }; }],
    ])("warns and goes on without a cover for %s", async (_name, setup) => {
      setup();
      active = vaultFiles.get(CONTO)!;
      run("export");
      const built = await host().build(state({ format: "epub" }));
      expect(built.cover).toBeNull();
      const w = built.warnings.find((x) => x.id === "cover")!;
      expect(w).toMatchObject({ level: "warning", n: 1 });
      expect(w.names[0]).toMatch(/^(sumiu|capa)\.png$/);
      expect(await host().write(state({ format: "epub" }), built)).toBe(true);
      expect(files(created[0].data as Uint8Array)).not.toContain("images/cover");
    });

    it("reads the cover only for an EPUB", async () => {
      fm[CONTO] = { cover: "[[sumiu.png]]" };
      active = vaultFiles.get(CONTO)!;
      run("export");
      const built = await host().build(state({ format: "docx" }));
      expect(built.cover).toBeUndefined();
      expect(built.warnings.map((w) => w.id)).not.toContain("cover");
    });

    it("takes a book's cover from the book note, not from a chapter", async () => {
      addBook();
      addFile("Novels/capa.png", "");
      binaries["Novels/capa.png"] = PNG;
      fm[BOOK_NOTE] = { ...fm[BOOK_NOTE], cover: "[[capa.png]]" };
      active = vaultFiles.get(CH[1])!;
      placement[CH[1]] = { path: CH[1], kind: "chapter", book: (plugin.books as unknown as { _book: unknown })._book, snapshot: false, submission: false, export: false };
      run("export");
      const whole = await host().build(state({ whole: true, format: "epub" }));
      expect(whole.cover).toMatchObject({ mediaType: "image/png" });
      const alone = await host().build(state({ whole: false, format: "epub" }));
      expect(alone.cover).toBeNull();
    });

    it("keeps the identifier of a work across exports and repeats an EPUB with Export again", async () => {
      const s = state({ format: "epub", preset: "ptbr" });
      await write(s);
      await write(s);
      const id = (z: Uint8Array) => /urn:uuid:[0-9a-f-]+/.exec(files(z))![0];
      expect(id(created[1].data as Uint8Array)).toBe(id(created[0].data as Uint8Array));
      created.length = 0;
      active = vaultFiles.get(CONTO)!;
      vaultFiles.set("Escrita/Exports/O porão (pt-BR).epub", file("Escrita/Exports/O porão (pt-BR).epub"));
      placement["Escrita/Exports/O porão (pt-BR).epub"] = { export: true };
      plugin.app.vault.files.set("Escrita/Exports/O porão (pt-BR).epub", vaultFiles.get("Escrita/Exports/O porão (pt-BR).epub")!);
      run("export-again");
      await vi.waitFor(() => expect(created).toHaveLength(1));
      expect(created[0]).toMatchObject({ path: "Escrita/Exports/O porão (pt-BR).epub", exists: "replace" });
    });

    it("hands the modal the EPUB scene break", () => {
      active = vaultFiles.get(CONTO)!;
      run("export");
      expect(opts().epubSceneBreak).toBe("◆");
    });
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
    expect(modal.asked[0].slice(1)).toEqual(["Escrita/Exports/O porão (Shunn).docx", 1759400000000, false]);   // not classified as an export here: no Replace
    expect(created.map((c) => c.exists)).toEqual(["fail"]);
    expect(plugin.data.exportChoices[CONTO]).toBeUndefined();
    expect(noticeLog).toEqual([]);
  });

  it("replaces on Replace", async () => {
    const there = file("Escrita/Exports/O porão (Shunn).docx");
    vaultFiles.set(there.path, there);
    plugin.app.vault.files.set(there.path, there);
    placement[there.path] = { path: there.path, kind: "note", book: null, snapshot: false, submission: false, export: true };
    modal.answer = "replace";
    expect(await write()).toBe(true);
    expect(created.map((c) => [c.path, c.exists])).toEqual([[there.path, "fail"], [there.path, "replace"]]);
    // not a recorded export: it may be the writer's own file, so it goes to the trash, not over
    expect(created[1].trashOld).toBe(true);
    expect(plugin.data.exportChoices[CONTO].last!.path).toBe(there.path);
    // now it is the recorded last export: Replace writes over it
    created.length = 0;
    modal.answer = "replace";
    expect(await write()).toBe(true);
    expect(created.map((c) => [c.exists, c.trashOld])).toEqual([["fail", undefined], ["replace", false]]);
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
    expect(plugin.data.exportChoices[BOOK_NOTE].last).toMatchObject({ whole: false, chapters: { mode: "range", from: 2, to: 3 }, source: CH[3] });
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

const placeOf = (path: string) => ({ folder: path.slice(0, path.lastIndexOf("/")), name: path.split("/").pop()! });
/** an export file in the vault, classified as one */
function inPlace(path: string): void {
  addFile(path, "");
  placement[path] = { path, kind: "note", book: null, snapshot: false, submission: false, export: true };
}

describe("Export again from the palette (Q17)", () => {
  const last = (over: Partial<NonNullable<ExportChoice["last"]>> = {}) => ({
    format: "docx" as const, preset: "ptbr", whole: true, chapters: { mode: "all" as const }, chapterCount: 3,
    at: "2026-10-03T14:32:00.000Z", path: "Escrita/Exports/A Casa (pt-BR).docx", ...over,
  });

  it("writes at once with the last choices when nothing needs a confirmation", async () => {
    addBook();
    addFile(CH[1], "Chegou.\n\nFicou.");
    inPlace("Escrita/Exports/A Casa (pt-BR).docx");
    plugin.data.exportChoices[BOOK_NOTE] = { format: "docx", preset: "ptbr", whole: true, last: last({ ...placeOf("Escrita/Exports/A Casa (pt-BR).docx") }) };
    active = vaultFiles.get(CH[3])!;
    run("export-again");
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ path: "Escrita/Exports/A Casa (pt-BR).docx", exists: "replace" });
    expect(modal.opened).toHaveLength(0);
    expect(modal.asked).toHaveLength(0);
    expect(plugin.data.exportChoices[BOOK_NOTE].last!.at).not.toBe("2026-10-03T14:32:00.000Z");
  });

  it("asks where to write, and writes nothing on Cancel, when the last file is gone", async () => {
    addBook();
    addFile(CH[1], "Chegou.\n\nFicou.");
    plugin.data.exportChoices[BOOK_NOTE] = { format: "docx", preset: "ptbr", whole: true, last: last({ path: "Elsewhere/gone.docx" }) };
    active = vaultFiles.get(CH[3])!;
    modal.where = false;
    run("export-again");
    await vi.waitFor(() => expect(modal.whereAsked).toHaveLength(1));
    expect(modal.whereAsked[0][1]).toBe("Escrita/Exports/A Casa (pt-BR).docx");
    expect(created).toHaveLength(0);
    expect(modal.opened).toHaveLength(0);
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

  it("opens the modal, with the book's selection, instead of writing the whole book after a 'This chapter' export", async () => {
    addBook();
    addFile(CH[1], "Chegou.\n\nFicou.");
    inPlace("Escrita/Exports/03 A casa (pt-BR).docx");
    plugin.data.exportChoices[BOOK_NOTE] = {
      format: "docx", preset: "ptbr", whole: false, chapters: { mode: "range", from: 2, to: 3 },
      last: last({ whole: false, chapters: { mode: "all" }, source: CH[3], path: "Escrita/Exports/03 A casa (pt-BR).docx" }),
    };
    active = vaultFiles.get(BOOK_NOTE)!;
    run("export-again");
    await vi.waitFor(() => expect(modal.opened).toHaveLength(1));
    expect(created).toHaveLength(0);
    expect(opts().state).toMatchObject({ whole: true, selection: { mode: "range", from: 2, to: 3 } });
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
    inPlace("Escrita/Exports/O porão.md");
    plugin.data.exportChoices[CONTO] = { format: "md", preset: "shunn", whole: false, last: last({ format: "md", preset: "shunn", whole: false, path: "Escrita/Exports/O porão.md", ...placeOf("Escrita/Exports/O porão.md") }) };
    active = vaultFiles.get(CONTO)!;
    run("export-again");
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ path: "Escrita/Exports/O porão.md", exists: "replace" });
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

describe("Export again: where it writes and what it repeats", () => {
  const entry = (over: Partial<NonNullable<ExportChoice["last"]>>): NonNullable<ExportChoice["last"]> => ({
    format: "docx", preset: "shunn", whole: false, chapters: { mode: "all" }, at: "2026-10-03T14:32:00.000Z",
    path: "Escrita/Exports/O porão (Shunn).docx", folder: "Escrita/Exports", name: "O porão (Shunn).docx", source: CONTO, ...over,
  });
  const exportFile = (path: string) => {
    addFile(path, "");
    placement[path] = { path, kind: "note", book: null, snapshot: false, submission: false, export: true };
  };

  it("replaces the last file at once, with no question, when it sits where it was written", async () => {
    exportFile("Escrita/Exports/O porão (Shunn).docx");
    plugin.data.exportChoices[CONTO] = { format: "docx", preset: "shunn", whole: false, last: entry({}) };
    active = vaultFiles.get(CONTO)!;
    run("export-again");
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ path: "Escrita/Exports/O porão (Shunn).docx", exists: "replace" });
    expect(modal.asked).toHaveLength(0);
    expect(modal.whereAsked).toHaveLength(0);
  });

  it("replaces a keep-both file (the last one), not the base name", async () => {
    const dated = "Escrita/Exports/O porão (Shunn) 2026-10-05 14h32.docx";
    exportFile("Escrita/Exports/O porão (Shunn).docx");
    exportFile(dated);
    plugin.data.exportChoices[CONTO] = { format: "docx", preset: "shunn", whole: false, last: entry({ path: dated, name: "O porão (Shunn) 2026-10-05 14h32.docx" }) };
    active = vaultFiles.get(CONTO)!;
    run("export-again");
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ path: dated, exists: "replace" });
    expect(modal.asked).toHaveLength(0);
  });

  it("asks where to write when the file was renamed inside the export folder, and writes nothing on Cancel", async () => {
    exportFile("Escrita/Exports/final.docx");
    plugin.data.exportChoices[CONTO] = { format: "docx", preset: "shunn", whole: false, last: entry({ path: "Escrita/Exports/final.docx" }) };
    active = vaultFiles.get(CONTO)!;
    modal.where = false;
    run("export-again");
    await vi.waitFor(() => expect(modal.whereAsked).toHaveLength(1));
    expect(created).toHaveLength(0);
    expect(vaultFiles.get("Escrita/Exports/final.docx")).toBeDefined();
  });

  it("asks where when the file moved to another folder, and writes at the usual place on Write", async () => {
    exportFile("Elsewhere/O porão (Shunn).docx");
    plugin.data.exportChoices[CONTO] = { format: "docx", preset: "shunn", whole: false, last: entry({ path: "Elsewhere/O porão (Shunn).docx" }) };
    active = vaultFiles.get(CONTO)!;
    run("export-again");
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(modal.whereAsked).toHaveLength(1);
    expect(created[0]).toMatchObject({ path: "Escrita/Exports/O porão (Shunn).docx", exists: "fail" });
  });

  it("the modal's Export again path asks too when the file is gone (the button is never dead)", async () => {
    plugin.data.exportChoices[CONTO] = { format: "docx", preset: "shunn", whole: false, last: entry({ path: "Escrita/Exports/gone.docx" }) };
    active = vaultFiles.get(CONTO)!;
    run("export");
    const s = state();
    expect(await host().write(s, await host().build(s), true)).toBe(true);
    expect(modal.whereAsked).toHaveLength(1);
    expect(created).toHaveLength(1);
  });

  it("does not repeat a chapter on another chapter or from the book note: the modal opens and nothing is written", async () => {
    addBook();
    exportFile("Escrita/Exports/03 A casa (Shunn).docx");
    plugin.data.exportChoices[BOOK_NOTE] = {
      format: "docx", preset: "shunn", whole: false,
      last: entry({ path: "Escrita/Exports/03 A casa (Shunn).docx", folder: "Escrita/Exports", name: "03 A casa (Shunn).docx", source: CH[3] }),
    };
    for (const from of [CH[1], BOOK_NOTE]) {
      modal.opened = [];
      active = vaultFiles.get(from)!;
      run("export-again");
      await vi.waitFor(() => expect(modal.opened).toHaveLength(1));
    }
    expect(created).toHaveLength(0);
    // the modal's own button reads the same rule
    active = vaultFiles.get(CH[1])!;
    run("export");
    const h = host();
    expect(h.canRepeat!(plugin.data.exportChoices[BOOK_NOTE].last!, state({ whole: false }))).toBe(false);
    active = vaultFiles.get(CH[3])!;
    run("export");
    expect(host().canRepeat!(plugin.data.exportChoices[BOOK_NOTE].last!, state({ whole: false }))).toBe(true);
  });

  it("repeats a chapter from that chapter, replacing its own file", async () => {
    addBook();
    exportFile("Escrita/Exports/03 A casa (Shunn).docx");
    plugin.data.exportChoices[BOOK_NOTE] = {
      format: "docx", preset: "shunn", whole: false,
      last: entry({ path: "Escrita/Exports/03 A casa (Shunn).docx", name: "03 A casa (Shunn).docx", source: CH[3] }),
    };
    active = vaultFiles.get(CH[3])!;
    run("export-again");
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].exists).toBe("replace");
  });

  it("carries the book's selection after a chapter export, also from data saved before (last said all)", () => {
    addBook();
    plugin.data.exportChoices[BOOK_NOTE] = {
      format: "docx", preset: "shunn", whole: false, chapters: { mode: "range", from: 2, to: 3 },
      last: entry({ source: CH[3] }),
    };
    active = vaultFiles.get(BOOK_NOTE)!;
    run("export");
    expect(opts().last!.chapters).toEqual({ mode: "range", from: 2, to: 3 });
  });

  it("never replaces a note through a case-only path clash (Contos vs contos)", async () => {
    plugin.settings.exportFolder = "contos";
    (plugin.notes as unknown as { create: unknown }).create = vi.fn(async (path: string, data: unknown, o: { exists: string }) => {
      created.push({ path, data, exists: o.exists });
      const clash = [...vaultFiles.keys()].find((k) => k.toLowerCase() === path.toLowerCase());
      if (clash && o.exists === "fail") throw new NoteExistsError(path, clash, false);
      const f = file(clash && o.exists === "unique" ? path.replace(/\.md$/, " 1.md") : path);
      vaultFiles.set(f.path, f);
      return { file: f, outcome: "created" };
    });
    const before = texts[CONTO];
    modal.answer = "replace";
    active = vaultFiles.get(CONTO)!;
    run("export");
    const s = state({ format: "md" });
    await host().write(s, await host().build(s));
    expect(created.some((c) => c.exists === "replace")).toBe(false);
    expect(modal.asked[0][3]).toBe(false);          // the dialog offered no Replace
    expect(texts[CONTO]).toBe(before);
  });
});

describe("the export folder follows a rename", () => {
  it("rewrites the setting, saves it, and moves the last file's path with it", async () => {
    const folder = Object.assign(new (await import("./support/obsidian")).TFolder(), { path: "Saídas/Antigo" });
    plugin.app.vault.files.set("Saídas/Antigo", folder as never);
    plugin.settings.exportFolder = "Escrita/Exports";
    const renamed = Object.assign(new (await import("./support/obsidian")).TFolder(), { path: "Escrita/Saídas" });
    plugin.app.vault.files.set("Escrita/Saídas", renamed as never);
    plugin.data.exportChoices[CONTO] = { format: "docx", preset: "shunn", whole: false, last: { format: "docx", preset: "shunn", whole: false, chapters: { mode: "all" }, at: "t", path: "Escrita/Exports/a.docx" } };
    const save = vi.spyOn(plugin, "saveSettings");
    const [f] = [...plugin.followers];
    f.moved?.("Escrita/Exports", "Escrita/Saídas");
    expect(plugin.settings.exportFolder).toBe("Escrita/Saídas");
    expect(save).toHaveBeenCalled();
    expect(plugin.data.exportChoices[CONTO].last!.path).toBe("Escrita/Saídas/a.docx");
    // an unrelated folder leaves the setting alone
    f.moved?.("Other", "Other2");
    expect(plugin.settings.exportFolder).toBe("Escrita/Saídas");
  });
});
