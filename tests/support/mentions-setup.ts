import { IndexHub, type HubEvents } from "../../src/core/index-hub";
import { compileTerms, type NameSource, type TermTable } from "../../src/core/names";
import { MentionsIndex } from "../../src/universe/mentions-index";
import type { EntriesSettings } from "../../src/universe/entries";
import { defaultUniverseSettings } from "../../src/universe/settings";
import { ManualTimers, MemoryVault, type MemFile } from "./memory-vault";

export const src = (id: string, name: string, aliases: string[] = []): NameSource => ({
  id, name, aliases, person: true, firstName: false, caseSensitive: false, ignore: [],
});
export const table = (sources: NameSource[]): TermTable => compileTerms(sources, { lang: "pt", extraTitles: [] });

export function settings(): EntriesSettings {
  return { ...defaultUniverseSettings(), universeMode: "universe", chaptersFolder: "Chapters", snapshotsFolder: "Escrita/Snapshots", templatesFolder: "Modelos", chapterTemplate: "" };
}

export function setup(files: Record<string, string>, sources: NameSource[], opts: { batch?: number; resolve?: (l: string, from: string) => string | null; timers?: ManualTimers } = {}) {
  const vault = new MemoryVault(files);
  const timers = opts.timers ?? new ManualTimers();
  const cbs = { modify: [] as ((f: MemFile) => void)[], rename: [] as ((f: MemFile, o: string) => void)[], del: [] as ((f: MemFile) => void)[], create: [] as ((f: MemFile) => void)[] };
  const events: HubEvents<MemFile> = {
    onCreate: (cb) => void cbs.create.push(cb),
    onModify: (cb) => void cbs.modify.push(cb),
    onDelete: (cb) => void cbs.del.push(cb),
    onRename: (cb) => void cbs.rename.push(cb),
    onMetaChanged: () => {},
    onResolved: () => {},
    onLayoutReady: (cb) => cb(),
    layoutReady: () => true,
    hasCache: () => true,
  };
  vault.onEvent((e) => {
    if (e.type === "create") cbs.create.forEach((c) => c(e.file));
    else if (e.type === "modify") cbs.modify.forEach((c) => c(e.file));
    else if (e.type === "delete") cbs.del.forEach((c) => c({ path: e.path, extension: "", text: "" }));
    else if (e.type === "rename") cbs.rename.forEach((c) => c({ path: e.path, extension: "", text: "" }, e.oldPath));
  });
  const hub = new IndexHub<MemFile>(events, vault, timers, { snapshotsRoot: () => "Escrita/Snapshots", batch: opts.batch });
  const state = { table: table(sources) };
  const mentions = new MentionsIndex<MemFile>({
    add: (spec) => hub.add(spec),
    remove: (ix) => hub.remove(ix),
    rebuild: (n) => hub.rebuild(n),
    table: () => state.table,
    settings,
    resolve: opts.resolve ?? (() => null),
    timers,
  });
  return { vault, timers, hub, mentions, state };
}

