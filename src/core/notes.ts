// plugin.notes: the Obsidian side of the note text port (core/note-text.ts).
// Every Escrita write into a note's text asks it for a NoteText and applies one
// plan through it.
//
// ── Interface ────────────────────────────────────────────────────────────
//
//   plugin.notes.text(file)        → NoteText
//       Through the editor when a MarkdownView shows the file in source or
//       Live Preview mode (its buffer may hold unsaved text, and the change
//       joins its undo history); otherwise through vault.process. The editor
//       port refuses once its view shows another note or leaves source mode,
//       so ask for a fresh port after any await. A view in
//       reading mode is flushed (view.save()) before the vault reads or
//       writes, so its pending text is never lost or overwritten.
//   plugin.notes.editorView(file)  → MarkdownView | null
//       The first view editing the file (source or Live Preview), if any.
//   plugin.notes.ensureFolder(path) → Promise<void>
//       Creates each missing folder of `path`; throws FolderBlockedError when
//       a segment is a file.
//   plugin.notes.create(path, data, { exists }) → Promise<CreateResult>
//       Find-or-create a note or a binary file (0.8, IMPROVEMENTS 17; filled by
//       task 1.7). One tested policy for an existing file instead of seven.

import { MarkdownView, TFile, TFolder, normalizePath, type App } from "obsidian";
import { editorText, findPathIgnoringCase, toArrayBuffer, uniquePath, vaultText, type FileData, type NoteText } from "./note-text";

/** A path segment that should be a folder is a file. */
export class FolderBlockedError extends Error {
  constructor(readonly path: string) {
    super(`${path} is a file, not a folder`);
    this.name = "FolderBlockedError";
  }
}

/**
 * What `create` does when something already sits at the path, or at a path that
 * differs only in case (a case clash: on a case-insensitive disk it is the same file).
 * - "return": keep it and return it. Text is not written.
 * - "fail": throw NoteExistsError.
 * - "unique": write next to it under the first free name, Obsidian's way:
 *   "Title 1.md", "Title 2.md"…
 * - "replace": overwrite its contents (vault.modify / modifyBinary), keeping the
 *   file (and its links). Only for derived files (an export) or after the writer
 *   said yes: rule 1 forbids replacing prose silently. Asking stays with the caller.
 */
export type ExistsPolicy = "return" | "fail" | "unique" | "replace";

export interface CreateOptions {
  exists: ExistsPolicy;
}

export interface CreateResult {
  /** the file now at the path (or at the unique path, or the clashing file kept or replaced) */
  file: TFile;
  /** "created": a new file; "existing": "return" found one and left it; "replaced": "replace" overwrote one */
  outcome: "created" | "existing" | "replaced";
}

/**
 * Something sits at the path: under "fail", or a folder at the path under any
 * policy but "unique". `existing` is the path found, which may differ from
 * `path` in case.
 */
export class NoteExistsError extends Error {
  constructor(readonly path: string, readonly existing: string, readonly folder: boolean) {
    super(`${existing} already exists`);
    this.name = "NoteExistsError";
  }
}

export class NoteService {
  constructor(private app: App) {}

  /** Every MarkdownView showing the file, in any mode. */
  private views(file: TFile): MarkdownView[] {
    const out: MarkdownView[] = [];
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const v = leaf.view;
      if (v instanceof MarkdownView && v.file?.path === file.path) out.push(v);
    }
    return out;
  }

  /** The first view editing the file (source or Live Preview), or null. */
  editorView(file: TFile): MarkdownView | null {
    return this.views(file).find((v) => v.getMode() === "source") ?? null;
  }

  text(file: TFile): NoteText {
    const view = this.editorView(file);
    // bound to this note: the view (and its editor) may move on to another note, or to reading mode
    if (view) return editorText(view.editor, undefined, () => view.file?.path === file.path && view.getMode() === "source");
    const { vault } = this.app;
    // Reading-mode views may still hold text not yet on disk: save it first.
    const flush = async () => {
      for (const v of this.views(file)) await v.save();
    };
    return vaultText({
      read: async () => { await flush(); return vault.read(file); },
      process: async (fn) => { await flush(); return vault.process(file, fn); },
    });
  }

  /**
   * Creates `path` (normalized) with `data`: text through vault.create, bytes
   * through vault.createBinary (modifyBinary under "replace"). A Uint8Array (what
   * zipStore and ManuscriptWriter.write return) may be a view into a larger
   * buffer: it is converted exactly once, here, to
   * `data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)`;
   * passing `u8.buffer` would write the wrong bytes. Makes the missing folders first
   * (ensureFolder; FolderBlockedError when a segment is a file). An existing file
   * or a case clash follows `o.exists`; so does a file that appears between the
   * check and the create (a race: the create's failure is checked again once).
   * Throws NoteExistsError as described there; other vault errors pass through.
   */
  async create(path: string, data: FileData, o: CreateOptions): Promise<CreateResult> {
    const norm = normalizePath(path);
    const { vault } = this.app;
    const slash = norm.lastIndexOf("/");
    if (slash > 0) await this.ensureFolder(norm.slice(0, slash));
    // bytes are converted once, so a retry after a race writes the same buffer
    const payload = typeof data === "string" ? data : toArrayBuffer(data);
    const allPaths = () => vault.getAllLoadedFiles().map((f) => f.path);

    for (let attempt = 0; ; attempt++) {
      const found = findPathIgnoringCase(norm, allPaths());
      const target = found === null ? null : vault.getAbstractFileByPath(found);
      const isFolder = target instanceof TFolder;
      if (found !== null && (isFolder || !(target instanceof TFile)) && o.exists !== "unique") {
        throw new NoteExistsError(norm, found, isFolder);
      }
      if (found !== null && target instanceof TFile && o.exists !== "unique") {
        if (o.exists === "return") return { file: target, outcome: "existing" };
        if (o.exists === "fail") throw new NoteExistsError(norm, found, false);
        if (typeof payload === "string") await vault.modify(target, payload);
        else await vault.modifyBinary(target, payload);
        return { file: target, outcome: "replaced" };
      }
      const dest = found === null ? norm : uniquePath(norm, allPaths());
      try {
        const file = typeof payload === "string"
          ? await vault.create(dest, payload)
          : await vault.createBinary(dest, payload);
        return { file, outcome: "created" };
      } catch (err) {
        // a file may have appeared since the check: look again once, else it is a real error
        if (attempt === 0 && findPathIgnoringCase(dest, allPaths()) !== null) continue;
        throw err;
      }
    }
  }

  async ensureFolder(path: string): Promise<void> {
    const norm = normalizePath(path);
    if (norm === "" || norm === "/") return;
    const { vault } = this.app;
    let cur = "";
    for (const part of norm.split("/")) {
      cur = cur ? `${cur}/${part}` : part;
      const f = vault.getAbstractFileByPath(cur);
      if (f instanceof TFolder) continue;
      if (f) throw new FolderBlockedError(cur);
      await vault.createFolder(cur);
    }
  }
}
