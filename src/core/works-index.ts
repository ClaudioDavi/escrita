// The works service: the live list of works on the vault index. `worksSpec` is
// the pure half (no Obsidian values, so it runs on a MemoryVault in tests);
// `WorksService` plugs it into the plugin and implements WorksReader.

import type { TFile } from "obsidian";
import type EscritaPlugin from "../main";
import type { VaultIndexes } from "../main";
import { chapterTitle } from "./book";
import { inFolder, snapshotsRoot } from "./classify";
import type { Piece } from "./measure";
import { stageOf, type Stage, type StageMapping } from "./stages";
import type { IndexChange, IndexFile, IndexSpec, VaultIndex } from "./vault-index";
import { deskEntry, sameDeskEntry, type DeskEntry, type WorksReader } from "./works";

/** The part of a classify() result the works index reads. */
export interface WorksPlacement {
  kind: string;
  tracked: boolean;
  snapshot: boolean;
  piece: Piece | null;
  stage: Stage | null;
  book: { note: { path: string }; title: string } | null;
}

/** The settings the entries depend on. */
export interface WorksSettings {
  trackFolders: string;
  excludeFolders: string;
  chaptersFolder: string;
  chapterTemplate: string;
  snapshotsFolder: string;
  statusProperty?: string;
  stages: StageMapping;
  targetProperty?: string;
  limitProperty?: string;
  unitProperty?: string;
  deadlineProperty?: string;
  goalProperty?: string;
}

export interface WorksDeps<F extends IndexFile> {
  settings(): WorksSettings;
  placement(f: F): WorksPlacement;
  frontmatter(f: F): Record<string, unknown> | undefined;
  /** the book's word goal, when it has one */
  bookGoal(f: F, p: WorksPlacement): number | undefined;
}

/** Changes whenever a setting that decides who is a work, or what its entry holds, changes. */
export function settingsKeyOf(s: WorksSettings): string {
  return JSON.stringify([
    s.trackFolders, s.excludeFolders, s.chaptersFolder, s.chapterTemplate, s.snapshotsFolder,
    s.statusProperty ?? "", s.stages,
    s.targetProperty ?? "", s.limitProperty ?? "", s.unitProperty ?? "", s.deadlineProperty ?? "", s.goalProperty ?? "",
  ]);
}

function basename(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.md$/, "");
}

export function worksSpec<F extends IndexFile>(deps: WorksDeps<F>): IndexSpec<F, DeskEntry> {
  return {
    name: "desk",
    mode: "metadata",
    structural: true,
    include: (f) => f.extension === "md" && !inFolder(f.path, snapshotsRoot(deps.settings().snapshotsFolder)),
    compute: (f) => {
      const s = deps.settings();
      const p = deps.placement(f);
      const status = deps.frontmatter(f)?.[s.statusProperty || "status"];
      const title = p.kind === "book-note" && p.book ? p.book.title
        : p.kind === "chapter" ? chapterTitle(basename(f.path))
        : basename(f.path);
      return deskEntry(
        { ...p, title, bookNotePath: p.book?.note.path },
        status,
        (v) => stageOf(v, s.stages),
        p.kind === "book-note" ? deps.bookGoal(f, p) : undefined,
      );
    },
    same: sameDeskEntry,
    settingsKey: () => settingsKeyOf(deps.settings()),
  };
}

export class WorksService implements WorksReader {
  private index: VaultIndex<TFile, DeskEntry>;

  constructor(plugin: EscritaPlugin, indexes: VaultIndexes) {
    this.index = indexes.add<TFile, DeskEntry>(worksSpec<TFile>({
      settings: () => plugin.settings,
      placement: (f) => plugin.books.classify(f),
      frontmatter: (f) => plugin.books.frontmatter(f),
      bookGoal: (_f, p) => (p.book ? plugin.measure.bookGoal(p.book as Parameters<typeof plugin.measure.bookGoal>[0]).goal ?? undefined : undefined),
    }));
  }

  get(path: string): DeskEntry | undefined { return this.index.get(path); }
  list(): Iterable<[string, DeskEntry]> { return this.index.entries(); }
  isReady(): boolean { return this.index.isReady(); }
  onReady(cb: () => void): () => void { return this.index.onReady(cb); }
  onChange(cb: (c: readonly IndexChange<DeskEntry>[]) => void): () => void { return this.index.onChange(cb); }
}
