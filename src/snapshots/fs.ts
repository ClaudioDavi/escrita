// SnapshotFs over Obsidian. A visible snapshots folder goes through the Vault
// API (create, process, rename, fileManager.trashFile), so Obsidian's own index
// stays right. A hidden one (any segment starting with ".") isn't indexed by
// Obsidian, so it goes through vault.adapter: the one place Escrita uses the
// adapter. Two documented exceptions to the trashFile rule: an empty folder
// left behind by a move is removed (vault.delete / adapter.rmdir), since it
// holds nothing to lose; and on the adapter, trash is trashSystem, then
// trashLocal (mobile has no system trash).
//
// Paths: the root is normalized once (core's snapshotsRoot) and a note's part
// keeps its exact bytes (paths.ts). Lookups try the exact path first and the
// normalized one only as a fallback (core's lookupPath), since the Vault API
// normalizes every path it creates. The adapter takes paths as they are, so a
// hidden root keeps the exact bytes on disk. Two notes that still fold into one
// folder are caught by the store (SharedFolderError), never mixed.

import { TFile, TFolder, normalizePath, type App, type TAbstractFile } from "obsidian";
import { lookupPath } from "../core/classify";
import type { SnapshotFs } from "./store";
import { isHiddenPath } from "./paths";

function parentOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** The file system for snapshots under `root`: the adapter for hidden folders, else the vault. */
export function createSnapshotFs(app: App, root: string, ensureFolder: (path: string) => Promise<void>): SnapshotFs {
  return isHiddenPath(root) ? adapterFs(app) : vaultFs(app, ensureFolder);
}

function vaultFs(app: App, ensureFolder: (path: string) => Promise<void>): SnapshotFs {
  const { vault } = app;
  const get = lookupPath<TAbstractFile>((p) => vault.getAbstractFileByPath(p), normalizePath);
  const file = (p: string): TFile => {
    const f = get(p);
    if (!(f instanceof TFile)) throw new Error(`not a file: ${p}`);
    return f;
  };
  return {
    exists: async (p) => get(p) !== null,
    list: async (dir) => {
      const f = get(dir);
      if (!(f instanceof TFolder)) return { files: [], folders: [] };
      const files: string[] = [], folders: string[] = [];
      for (const c of f.children) (c instanceof TFolder ? folders : files).push(c.name);
      return { files, folders };
    },
    read: (p) => vault.read(file(p)),
    write: async (p, text) => {
      const f = get(p);
      if (f instanceof TFile) {
        await vault.process(f, () => text);
        return;
      }
      if (f) throw new Error(`not a file: ${p}`);
      await ensureFolder(parentOf(p));
      await vault.create(p, text);
    },
    rename: async (from, to) => {
      const f = get(from);
      if (!f) throw new Error(`missing: ${from}`);
      if (get(to)) throw new Error(`already exists: ${to}`);
      await ensureFolder(parentOf(to));
      // .txt snapshots hold no links, so no link updating (fileManager.renameFile) is needed
      await vault.rename(f, to);
    },
    trash: async (p) => {
      const f = get(p);
      if (f) await app.fileManager.trashFile(f);
    },
    removeIfEmpty: async (dir) => {
      const f = get(dir);
      if (f instanceof TFolder && f.children.length === 0 && !f.isRoot()) await app.fileManager.trashFile(f);
    },
  };
}

function adapterFs(app: App): SnapshotFs {
  const a = app.vault.adapter;
  // exact paths: the adapter doesn't normalize, so notes that differ only in special spaces or accents stay apart
  const n = (p: string) => p;
  const mkdirs = async (dir: string) => {
    let cur = "";
    for (const part of n(dir).split("/")) {
      if (part === "") continue;
      cur = cur ? `${cur}/${part}` : part;
      if (!(await a.exists(cur))) await a.mkdir(cur);
    }
  };
  return {
    exists: (p) => a.exists(n(p)),
    list: async (dir) => {
      if (!(await a.exists(n(dir)))) return { files: [], folders: [] };
      const l = await a.list(n(dir));
      return { files: l.files.map(baseName), folders: l.folders.map(baseName) };
    },
    read: (p) => a.read(n(p)),
    write: async (p, text) => {
      await mkdirs(parentOf(n(p)));
      await a.write(n(p), text);
    },
    rename: async (from, to) => {
      if (await a.exists(n(to))) throw new Error(`already exists: ${to}`);
      await mkdirs(parentOf(n(to)));
      await a.rename(n(from), n(to));
    },
    trash: async (p) => {
      if (!(await a.exists(n(p)))) return;
      if (!(await a.trashSystem(n(p)))) await a.trashLocal(n(p));
    },
    removeIfEmpty: async (dir) => {
      if (!(await a.exists(n(dir)))) return;
      const l = await a.list(n(dir));
      if (l.files.length === 0 && l.folders.length === 0) await a.rmdir(n(dir), false);
    },
  };
}
