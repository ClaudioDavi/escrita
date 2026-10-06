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
const CH = ["00 Prólogo", "01 A chegada", "02 Rascunho", "03 A casa"].map((n) => `Novels/A Casa/Chapters/${n}.md`);

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

describe("a work changed while the export modal is open", () => {
  it("follows a renamed book note and chapter, and drops a deleted chapter", async () => {
    addBook();
    const book = (plugin.books as unknown as { _book: { note: TFile } })._book;
    let chapterFiles = CH.map((p) => vaultFiles.get(p)!);
    (plugin.books as unknown as { chapters: unknown }).chapters = () => chapterFiles.map((f, i) => ({ file: f, index: i + 1, number: i, title: f.basename.replace(/^\d+ /, "") }));
    const reads: string[] = [];
    (plugin.notes as unknown as { text: unknown }).text = (f: TFile) => ({ read: async () => { reads.push(f.path); return texts[f.path]; } });
    plugin.data.exportChoices = { [BOOK_NOTE]: { format: "docx", preset: "shunn", whole: true, chapters: { mode: "all" } } };
    active = vaultFiles.get(BOOK_NOTE)!;
    run("export");
    const s = state({ whole: true, selection: { mode: "pick", paths: [CH[0], CH[3]] } });
    const [follow] = [...plugin.followers];

    const rename = (f: TFile, to: string): void => {
      const old = f.path;
      vaultFiles.delete(old); plugin.app.vault.files.delete(old);
      placement[to] = { ...(placement[old] as object), path: to };
      delete placement[old];
      texts[to] = texts[old]; fm[to] = fm[old];
      f.path = to; f.name = to.split("/").pop()!; f.basename = f.name.replace(/\.md$/, "");
      vaultFiles.set(to, f); plugin.app.vault.files.set(to, f);
      follow.moved?.(old, to);
    };
    const NEW_NOTE = "Novels/Livro.md";
    const NEW_CH = "Novels/A Casa/Chapters/Abertura.md";
    rename(book.note, NEW_NOTE);
    rename(chapterFiles[0], NEW_CH);
    const gone = chapterFiles[3];
    vaultFiles.delete(gone.path); plugin.app.vault.files.delete(gone.path);
    chapterFiles = chapterFiles.slice(0, 3);
    follow.deleted?.(gone.path);

    const built = await host().build(s);
    expect(reads).toContain(NEW_CH);
    expect(reads).not.toContain(CH[0]);
    expect(reads).not.toContain(CH[3]);
    expect(await host().write(s, built)).toBe(true);

    expect(Object.keys(plugin.data.exportChoices)).toEqual([NEW_NOTE]);
    const last = plugin.data.exportChoices[NEW_NOTE].last!;
    expect(last.path).toBe(created.at(-1)!.path);
    expect(last.chapters).toEqual({ mode: "pick", paths: [NEW_CH] });
    expect(plugin.data.exportChoices[NEW_NOTE].chapters).toEqual({ mode: "pick", paths: [NEW_CH] });
  });
});
