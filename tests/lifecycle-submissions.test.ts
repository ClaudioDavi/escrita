import { beforeEach, describe, expect, it, vi } from "vitest";
import { TFile as StubFile, noticeLog } from "./support/obsidian";
import type { TFile } from "obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import type { FeatureModule } from "../src/core/module-context";
import type { SubmissionModalOptions } from "../src/submissions/modal";
import { registerStrings } from "../src/i18n";
import { SubmissionsModule } from "../src/submissions";
import { submissionsStrings } from "../src/submissions/strings";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

const captured: { opts: SubmissionModalOptions | null } = { opts: null };
vi.mock("../src/submissions/modal", () => ({
  SubmissionModal: class { constructor(_app: unknown, o: SubmissionModalOptions) { captured.opts = o; } open(): void {} },
}));

registerStrings(submissionsStrings);

let plugin: FakePlugin;
let module: SubmissionsModule;
let registry: FeatureRegistry;

const file = (path: string): TFile => {
  const f = new StubFile();
  f.path = path;
  f.basename = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
  return f as unknown as TFile;
};

beforeEach(() => {
  captured.opts = null;
  noticeLog.length = 0;
  plugin = fakePlugin();
  module = new SubmissionsModule(plugin.asPlugin);
  registry = new FeatureRegistry(plugin.asPlugin, new Map<FeatureId, FeatureModule>([["submissions", module]]));
  plugin.features = registry;
  registry.init();
  registry.apply();
  (plugin.app.metadataCache as unknown as { getFirstLinkpathDest: unknown }).getFirstLinkpathDest = () => null;
});

describe("submissions lifecycle", () => {
  it("loads with its command, one index and the file menu", () => {
    expect(registry.isOn("submissions")).toBe(true);
    expect([...plugin.commands.keys()]).toEqual(["escrita:record-submission"]);
    expect(plugin.indexAdded).toHaveLength(1);
    expect(plugin.indexAdded[0].spec.name).toBe("submissions");
    expect(plugin.app.workspace.liveListeners("file-menu")).toBe(1);
  });

  it("leaves nothing behind when switched off, and loads once more cleanly", () => {
    plugin.turn("submissions", false);
    expect(plugin.commands.size).toBe(0);
    expect(plugin.liveListeners()).toBe(0);
    expect(plugin.indexAdded.every((h) => h.disposed)).toBe(true);
    expect(module.pending.list()).toEqual([]);
    plugin.turn("submissions", true);
    expect(plugin.commands.size).toBe(1);
    expect(plugin.indexAdded.filter((h) => !h.disposed)).toHaveLength(1);
    expect(plugin.app.workspace.liveListeners("file-menu")).toBe(1);
  });

  it("every English string has a pt-BR twin with the same {vars}", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const [k, v] of Object.entries(submissionsStrings.en)) {
      expect(submissionsStrings["pt-BR"][k], k).toBeDefined();
      expect(vars(submissionsStrings["pt-BR"][k]), k).toBe(vars(v));
    }
  });
});

describe("the pending port", () => {
  const row = (o: object) => ({ work: "[[Domingo]]", market: "Sesc", sent: "2026-09-12", result: "pending", ...o });

  it("lists pending submissions, resolving the work through the metadata cache", () => {
    (plugin.app.metadataCache as unknown as { getFirstLinkpathDest: unknown }).getFirstLinkpathDest =
      (t: string) => (t === "Domingo" ? file("Contos/Domingo.md") : null);
    const h = plugin.indexAdded[0];
    h.values.set("Submissions/a.md", row({}));
    h.values.set("Submissions/b.md", row({ work: "[[Perdido]]", sent: "2026-10-05", market: "Pessoa" }));
    h.values.set("Submissions/c.md", row({ result: "accepted" }));
    expect(module.pending.list()).toEqual([
      { path: "Submissions/b.md", workPath: null, workTitle: "Perdido", market: "Pessoa", sent: "2026-10-05" },
      { path: "Submissions/a.md", workPath: "Contos/Domingo.md", workTitle: "Domingo", market: "Sesc", sent: "2026-09-12" },
    ]);
  });

  it("follows the first result value in the settings", () => {
    plugin.indexAdded[0].values.set("Submissions/a.md", row({ result: "enviado" }));
    expect(module.pending.list()).toHaveLength(0);
    plugin.settings.submissionResults = "enviado, aceito";
    module.settingsChanged?.();
    expect(module.pending.list()).toHaveLength(1);
  });

  it("tells subscribers when the index changes, and stops after unsubscribe or unload", () => {
    let n = 0;
    const off = module.pending.onChange(() => { n++; });
    plugin.indexAdded[0].emitChange([{ path: "Submissions/a.md", cause: "update" }]);
    expect(n).toBe(1);
    module.settingsChanged?.();
    expect(n).toBe(2);
    off();
    plugin.indexAdded[0].emitChange([]);
    expect(n).toBe(2);
    module.pending.onChange(() => { n++; });
    plugin.turn("submissions", false);
    module.settingsChanged?.();
    expect(n).toBe(2);
  });

  it("redraws when a work is renamed or deleted, but only if there are submissions", () => {
    let n = 0;
    module.pending.onChange(() => { n++; });
    const fs = [...plugin.followers];
    const f = { moved: (a: string, b: string) => fs.forEach((x) => x.moved?.(a, b)), deleted: (a: string) => fs.forEach((x) => x.deleted?.(a)) };
    f.moved("Contos/X.md", "Contos/Y.md");
    expect(n).toBe(0);
    plugin.indexAdded[0].values.set("Submissions/a.md", row({}));
    (plugin.indexAdded[0] as unknown as { size: number }).size = 1;
    f.moved("Contos/X.md", "Contos/Y.md");
    expect(n).toBe(1);
    f.deleted("Contos/Y.md");
    expect(n).toBe(2);
    f.deleted("Contos/cover.png");
    expect(n).toBe(2);
  });

  it("a created note redraws only when it could resolve an unresolved work link", () => {
    let n = 0;
    module.pending.onChange(() => { n++; });
    plugin.indexAdded[0].values.set("Submissions/a.md", row({ work: '"[[Contos/Cartas]]"', result: "pending" }));
    (plugin.indexAdded[0] as unknown as { size: number }).size = 1;
    plugin.app.vault.trigger("create", file("Contos/Other.md"));
    expect(n).toBe(0);
    plugin.app.vault.trigger("create", file("Elsewhere/cartas.md"));
    expect(n).toBe(1);
  });
});

describe("Record a submission", () => {
  const placement = (o: object) => ({
    path: "Contos/Cartas.md", kind: "note", markdown: true, tracked: true, submission: false, export: false,
    snapshot: false, stage: "ready", book: null, piece: null, ...o,
  });
  let created: { path: string; data: unknown; exists: string }[];

  beforeEach(() => {
    created = [];
    const work = file("Contos/Cartas.md");
    plugin.app.vault.files.set(work.path, work);
    (plugin.app.metadataCache as unknown as { fileToLinktext: unknown }).fileToLinktext = (f: TFile) => f.basename;
    (plugin as unknown as { books: unknown }).books = { classify: () => placement({}) };
    (plugin as unknown as { measure: unknown }).measure = { peek: () => ({ words: 5120 }), bookPeek: () => undefined };
    (plugin as unknown as { notes: unknown }).notes = {
      create: async (path: string, data: unknown, o: { exists: string }) => { created.push({ path, data, exists: o.exists }); return { file: file(path), outcome: "created" }; },
    };
  });

  it("opens the modal for a standalone note with a stage", async () => {
    await module.record(file("Contos/Cartas.md"));
    expect(captured.opts).not.toBeNull();
    expect(captured.opts!.workTitle).toBe("Cartas");
    expect(captured.opts!.workInfo).toMatch(/^ready · 5\D?120$/);
    expect(captured.opts!.result).toBe("pending");
  });

  it("creates the note with a link, the market, the date and the first result; notice after", async () => {
    await module.record(file("Contos/Cartas.md"));
    const ok = await captured.opts!.onRecord("Revista Pessoa", "2026-10-05");
    expect(ok).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0].path).toBe("Escrita/Submissions/2026-10-05 Cartas – Revista Pessoa.md");
    expect(created[0].exists).toBe("unique");
    expect(created[0].data).toBe('---\nwork: "[[Cartas]]"\nmarket: "Revista Pessoa"\nsent: 2026-10-05\nresult: pending\nresponded:\n---\n');
    expect(noticeLog.at(-1)).toBe("Submission recorded: Cartas → Revista Pessoa.");
  });

  it("a chapter records for its book", async () => {
    const bookNote = file("Livros/A Casa.md");
    plugin.app.vault.files.set(bookNote.path, bookNote);
    (plugin as unknown as { books: unknown }).books = {
      classify: (x: TFile) => x.path === bookNote.path
        ? placement({ path: bookNote.path, kind: "book-note", stage: "draft", book: { note: bookNote, title: "A Casa" } })
        : placement({ path: "Livros/A Casa/Chapters/1.md", kind: "chapter", stage: null, book: { note: bookNote, title: "A Casa" } }),
    };
    await module.record(file("Livros/A Casa/Chapters/1.md"));
    expect(captured.opts!.workTitle).toBe("A Casa");
    expect(captured.opts!.pathFor("M", "2026-10-05")).toBe("Escrita/Submissions/2026-10-05 A Casa – M.md");
  });

  it("a note with no stage, or no note at all, gets a notice and creates nothing", async () => {
    (plugin as unknown as { books: unknown }).books = { classify: () => placement({ stage: null, tracked: false }) };
    await module.record(file("Contos/Cartas.md"));
    expect(noticeLog.at(-1)).toBe("“Cartas” isn't a work: give it a stage to record a submission.");
    await module.record(null);
    expect(noticeLog.at(-1)).toBe("Open a story or a book to record a submission.");
    expect(captured.opts).toBeNull();
    expect(created).toHaveLength(0);
  });

  it("a failed create says so and reports false", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    (plugin as unknown as { notes: unknown }).notes = { create: async () => { throw new Error("disk"); } };
    await module.record(file("Contos/Cartas.md"));
    expect(await captured.opts!.onRecord("M", "2026-10-05")).toBe(false);
    expect(noticeLog.at(-1)).toBe("Couldn't record the submission. Nothing was changed; see the developer console.");
    err.mockRestore();
  });

  it("offers the three most recent markets from the notes", async () => {
    const h = plugin.indexAdded[0];
    (h as unknown as { size: number }).size = 4;
    const base = { work: "[[X]]", result: "pending" };
    h.values.set("S/1.md", { ...base, market: "A", sent: "2026-01-01" });
    h.values.set("S/2.md", { ...base, market: "B", sent: "2026-02-01" });
    h.values.set("S/3.md", { ...base, market: "C", sent: "2026-03-01" });
    h.values.set("S/4.md", { ...base, market: "D", sent: "2026-04-01" });
    await module.record(file("Contos/Cartas.md"));
    expect(captured.opts!.markets).toEqual(["D", "C", "B"]);
  });
});
