import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile, TFolder, noticeLog } from "./support/obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import type { FeatureModule } from "../src/core/module-context";
import { collectionOf } from "../src/core/collection";
import { registerStrings } from "../src/i18n";
import { exportStrings } from "../src/export/strings";
import type { ExportHost, ExportModalOptions, ModalState } from "../src/export/modal";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

const modal = vi.hoisted(() => ({ opened: [] as unknown[] }));
vi.mock("../src/export/modal", async () => {
  const actual = await vi.importActual<typeof import("../src/export/modal")>("../src/export/modal");
  return { ...actual, ExportModal: class { constructor(_a: unknown, public o: unknown) { modal.opened.push(o); } open(): void {} } };
});
const { ExportModule } = await import("../src/export");
const { createCollection: create } = await import("../src/export/collection-menu");
const createCollection = (p: unknown, stories: TFile[], title: string): Promise<void> => create(p as never, stories as never, title);

beforeAll(() => registerStrings(exportStrings));

const file = (path: string): TFile => {
  const f = new TFile();
  f.path = path;
  f.name = path.split("/").pop()!;
  f.basename = f.name.replace(/\.md$/, "");
  f.extension = "md";
  f.stat = { ctime: 0, mtime: 5, size: 0 };
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/";
  f.parent = Object.assign(new TFolder(), { path: dir }) as never;
  return f;
};

let plugin: FakePlugin;
let registry: FeatureRegistry;
let vaultFiles: Map<string, TFile>;
let texts: Record<string, string>;
let fm: Record<string, Record<string, unknown>>;
let active: TFile | null;
let created: { path: string; data: unknown; exists: string }[];
let opened: TFile[];

function add(path: string, text: string, frontmatter: Record<string, unknown> = {}): TFile {
  const f = file(path);
  vaultFiles.set(path, f);
  plugin.app.vault.files.set(path, f);
  texts[path] = text;
  fm[path] = frontmatter;
  return f;
}

const COLL = "Contos/Coleção.md";

beforeEach(() => {
  modal.opened = [];
  noticeLog.length = 0;
  plugin = fakePlugin();
  plugin.data.exportChoices = {};
  vaultFiles = new Map();
  texts = {};
  fm = {};
  active = null;
  created = [];
  opened = [];
  const app = plugin.app as unknown as Record<string, any>;
  app.workspace.getActiveFile = () => active;
  app.workspace.getLeaf = () => ({ openFile: async (f: TFile) => { opened.push(f); } });
  app.metadataCache.getFileCache = (f: TFile) => ({ frontmatter: fm[f.path] });
  app.metadataCache.getFirstLinkpathDest = (link: string) => [...vaultFiles.values()].find((f) => f.basename === link || f.path.replace(/\.md$/, "") === link) ?? null;
  plugin.books = {
    classify: (x: TFile | string) => ({ path: typeof x === "string" ? x : x.path, kind: "note", book: null, snapshot: false, submission: false, export: false }),
  } as never;
  plugin.measure = { unit: () => "words", counts: vi.fn(async () => ({ words: 3, characters: 10 })) } as never;
  plugin.notes = {
    text: (f: TFile) => ({ read: async () => texts[f.path] }),
    editorView: () => null,
    create: vi.fn(async (path: string, data: unknown, o: { exists: string }) => {
      created.push({ path, data, exists: o.exists });
      const f = add(path, String(data));
      return { file: f, outcome: "created" };
    }),
  } as never;
  const module = new ExportModule(plugin.asPlugin);
  registry = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, FeatureModule>([["export", module]]));
  plugin.features = registry;
  registry.init();
  registry.apply();
  add("Contos/A visita.md", "Ela veio.");
  add("Contos/O porão.md", "Desceu a escada.");
  add("Contos/Zé.md", "Zé ficou.");
});

const menuOf = (files: unknown[]): string[] => {
  const titles: string[] = [];
  const menu = { addItem: (cb: (i: unknown) => void) => {
    const item = { setTitle(t: string) { titles.push(t); return this; }, setIcon() { return this; }, onClick() { return this; } };
    cb(item);
  } };
  plugin.app.workspace.trigger("files-menu", menu, files, "file-explorer");
  return titles;
};
const state = (over: Partial<ModalState> = {}): ModalState => ({ whole: true, selection: { mode: "all" }, format: "md", preset: "ptbr", ...over });

describe("collections: the explorer menu", () => {
  it("offers Create a collection only for two or more Markdown notes, and unloads cleanly", () => {
    const [a, b] = ["Contos/A visita.md", "Contos/O porão.md"].map((p) => vaultFiles.get(p)!);
    expect(plugin.app.workspace.liveListeners("files-menu")).toBe(1);
    expect(menuOf([a, b])).toEqual(["Create a collection…"]);
    expect(menuOf([a])).toEqual([]);
    expect(menuOf([a, Object.assign(new TFolder(), { path: "Contos" })])).toEqual([]);
    expect(menuOf([a, file("img.png")].map((f, i) => (i ? Object.assign(f, { extension: "png" }) : f)))).toEqual([]);
    plugin.settings.features = { ...plugin.settings.features, export: false };
    registry.apply();
    expect(plugin.liveListeners()).toBe(0);
    expect(plugin.app.workspace.liveListeners("files-menu")).toBe(0);
  });

  it("writes the note beside the first one with the links in order, then opens it", async () => {
    const stories = ["Contos/Zé.md", "Contos/A visita.md"].map((p) => vaultFiles.get(p)!);
    await createCollection(plugin.asPlugin, stories, "Meus contos");
    expect(created).toEqual([{ path: "Contos/Meus contos.md", exists: "unique", data: '---\ncontents:\n  - "[[Zé]]"\n  - "[[A visita]]"\n---\n' }]);
    expect(opened.map((f) => f.path)).toEqual(["Contos/Meus contos.md"]);
  });

  it("lists a story by its path when another note shares its name", async () => {
    add("Outros/A visita.md", "Outra.");
    const stories = ["Contos/A visita.md", "Contos/Zé.md"].map((p) => vaultFiles.get(p)!);
    // the first note named "A visita" wins the lookup, so only the other one needs its path
    await createCollection(plugin.asPlugin, [stories[1], vaultFiles.get("Outros/A visita.md")!], "Duas");
    expect(String(created[0].data)).toContain('"[[Zé]]"');
    expect(String(created[0].data)).toContain('"[[Outros/A visita]]"');
  });

  it("makes a note that collectionOf reads back, in order", async () => {
    await createCollection(plugin.asPlugin, ["Contos/Zé.md", "Contos/O porão.md"].map((p) => vaultFiles.get(p)!), "Ordem");
    const links = String(created[0].data).split("\n").filter((l) => l.startsWith("  - ")).map((l) => JSON.parse(l.slice(4)) as string);
    const found = collectionOf({ contents: links }, "contents", (l) => `Contos/${l.replace(/^\[\[|\]\]$/g, "")}.md`);
    expect(found?.stories).toEqual(["Contos/Zé.md", "Contos/O porão.md"]);
  });
});

describe("collections: the export", () => {
  const open = (): ExportHost => {
    active = vaultFiles.get(COLL)!;
    (plugin.commands.get("escrita:export") as unknown as { checkCallback(c: boolean): boolean }).checkCallback(false);
    return (modal.opened.at(-1) as ExportModalOptions).host;
  };

  it("opens the modal as a collection: the stories, no 'this chapter', the front pages", () => {
    add("Contos/Dedicatória.md", "Para Ana.");
    add(COLL, "", { contents: ["[[A visita]]", "[[Zé]]", "[[Sumiu]]"], dedication: "[[Dedicatória]]", author: "Beto Lima" });
    open();
    const o = modal.opened.at(-1) as ExportModalOptions;
    expect(o.book).toMatchObject({ collection: true, offerChapter: false, front: ["dedication"] });
    expect(o.book!.chapters.map((c) => [c.path, c.title, c.number, c.include])).toEqual([
      ["Contos/A visita.md", "A visita", null, true],
      ["Contos/Zé.md", "Zé", null, true],
    ]);
    expect(o.state.whole).toBe(true);
  });

  it("builds the whole collection: each story's title alone as its heading, a warning for a missing one", async () => {
    add(COLL, "", { contents: ["[[A visita]]", "[[Sumiu]]", "[[Zé]]"], author: "Beto Lima" });
    const h = open();
    const built = await h.build(state());
    expect(built.source.title).toBe("Coleção");
    expect(built.source.author.name).toBe("Beto Lima");
    expect(built.source.parts.map((p) => [p.role, p.heading])).toEqual([["body", "A visita"], ["body", "Zé"]]);
    expect(built.warnings).toEqual([{ id: "missingStories", level: "warning", n: 1, names: ["Sumiu"], links: [] }]);
    expect(h.pathFor(state())).toBe("Escrita/Exports/Coleção.md");
  });

  it("writes it, remembers it as a whole export of the collection note", async () => {
    add(COLL, "", { contents: ["[[A visita]]", "[[Zé]]"] });
    const h = open();
    const s = state({ format: "docx", preset: "ptbr" });
    expect(await h.write(s, await h.build(s))).toBe(true);
    expect(created.at(-1)!.path).toBe("Escrita/Exports/Coleção (pt-BR).docx");
    expect(plugin.data.exportChoices[COLL]).toMatchObject({ format: "docx", whole: true, last: { whole: true, chapterCount: 2 } });
  });

  it("a note with no list stays a note", () => {
    add(COLL, "Texto.");
    open();
    expect((modal.opened.at(-1) as ExportModalOptions).book).toBeNull();
  });
});
