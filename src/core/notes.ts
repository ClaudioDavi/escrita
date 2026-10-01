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

import { MarkdownView, TFile, TFolder, normalizePath, type App } from "obsidian";
import { editorText, vaultText, type NoteText } from "./note-text";

/** A path segment that should be a folder is a file. */
export class FolderBlockedError extends Error {
  constructor(readonly path: string) {
    super(`${path} is a file, not a folder`);
    this.name = "FolderBlockedError";
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
