// Gathers what the home block shows from the plugin's services. The pure
// helpers below take plain values, so tests need no Obsidian.

import type EscritaPlugin from "../main";
import { countIn } from "../core/measure";
import { readStatus } from "../core/stages";
import { bookChapterProgress, type DeskEntry } from "../core/works";
import { buildDesk, filterByFolders, type DeskModel, type WorkSource } from "./works";
import { parseBlock } from "./block";
import type { PendingSource } from "../core/pending";

/** The pending-submissions port, only while the submissions feature is on (never imports that module). */
export function pendingSource(plugin: EscritaPlugin): PendingSource | null {
  if (!plugin.features.isOn("submissions")) return null;
  return plugin.features.get<{ pending?: PendingSource }>("submissions")?.pending ?? null;
}

export type DeskNotice =
  | { kind: "noWorks" }
  | { kind: "nothingActive" }
  | { kind: "noFolder"; folder: string }
  | { kind: "noneInFolder"; folder: string };

/** The muted lines the block shows instead of (or above) the lists. */
export function deskNotices(i: { folders: string[]; folderExists(f: string): boolean; model: DeskModel }): DeskNotice[] {
  const out: DeskNotice[] = [];
  const present: string[] = [];
  for (const f of i.folders) {
    if (i.folderExists(f)) present.push(f);
    else out.push({ kind: "noFolder", folder: f });
  }
  const { writing, revising, counts } = i.model;
  const any = writing.length + revising.length + counts.length > 0;
  if (!any) {
    if (i.folders.length === 0) out.push({ kind: "noWorks" });
    else if (present.length > 0) out.push({ kind: "noneInFolder", folder: present.join(", ") });
  } else if (writing.length + revising.length === 0) {
    out.push({ kind: "nothingActive" });
  }
  return out;
}

/** When the writer last edited each work: a note's own record, a book's newest chapter. */
export function editedAtOf(
  leftOff: Readonly<Record<string, { at: number }>>,
  get: (path: string) => { role: string; book?: string } | undefined,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [path, rec] of Object.entries(leftOff)) {
    const e = get(path);
    if (!e) continue;
    const key = e.role === "chapter" ? e.book : path;
    if (!key) continue;
    out.set(key, Math.max(out.get(key) ?? 0, rec.at));
  }
  return out;
}

export interface Gathered {
  model: DeskModel;
  folders: string[];
  notices: DeskNotice[];
  /** every path whose change can alter the block: the shown works and their chapters */
  shown: Set<string>;
}

const hasBook = (e: DeskEntry | undefined): e is DeskEntry & { book: string } => !!e?.book;

export async function gatherDesk(plugin: EscritaPlugin, source: string, today: string): Promise<Gathered> {
  const { works, measure, books, app, settings } = plugin;
  const { folders } = parseBlock(source);
  const entries = [...works.list()];
  const edited = editedAtOf(plugin.data.leftOff, (p) => works.get(p));
  const statusProp = settings.statusProperty || "status";

  const make = async ([path, e]: [string, DeskEntry]): Promise<WorkSource | null> => {
    if (e.role === "chapter") return null;
    const file = app.vault.getFileByPath(path);
    if (!file) return null;
    const base = { path, role: e.role, stage: e.stage ?? "none" as const, title: e.title, editedAt: edited.get(path) ?? 0 };
    if (e.role === "unstaged") {
      const word = readStatus(books.frontmatter(file), statusProp) ?? undefined;
      return { ...base, count: 0, unit: "words", statusWord: word };
    }
    if (e.role === "book") {
      const book = books.classify(file).book;
      if (!book) return null;
      const m = await measure.book(book);
      return {
        ...base, count: m.counts.words, unit: "words",
        goal: e.goal ?? m.goal ?? undefined,
        deadline: e.deadline ?? m.deadline ?? undefined,
        chapters: bookChapterProgress(entries, path, "ready"),
      };
    }
    const nm = await measure.note(file);
    const unit = e.unit ?? nm.unit;
    return { ...base, count: countIn(nm.counts, unit), unit, target: e.target, limit: e.limit, deadline: e.deadline };
  };

  const all = (await Promise.all(entries.map(make))).filter((w): w is WorkSource => w !== null);
  const bookFolderOf = (p: string) => books.classify(p).book?.folder.path ?? null;
  const kept = filterByFolders(all, folders, bookFolderOf);
  const pending = pendingSource(plugin)?.list() ?? [];
  const keptPaths = folders.length > 0 ? new Set(kept.map((w) => w.path)) : undefined;
  const model = buildDesk(kept, today, pending, keptPaths);
  const folderExists = (f: string) => app.vault.getFolderByPath(f) !== null;
  const shown = new Set<string>();
  for (const w of kept) shown.add(w.path);
  for (const [p, e] of entries) if (hasBook(e) && shown.has(e.book)) shown.add(p);
  return { model, folders, notices: deskNotices({ folders, folderExists, model }), shown };
}
