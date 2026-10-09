import { MarkdownView, Notice, TFile, type WorkspaceLeaf } from "obsidian";
import type EscritaPlugin from "../main";
import { t } from "../i18n";
import { writingModeOf } from "../core/writing-mode";
import { bookTarget, firstUnwrittenBeatOffset, spotPosition, type LeftOff } from "../core/left-off";

/**
 * Open a work, landing where the writer left off: a note at its record, else the
 * first unwritten beat, else the end. A book opens the chapter edited last, else
 * the first chapter with an unwritten beat, else the last chapter at its end.
 */
export async function openWork(plugin: EscritaPlugin, path: string, newTab: boolean): Promise<void> {
  // In writing mode there is no tab bar: "Continue" replaces the note in the same tab (board 39 a).
  if (writingModeOf(plugin.features)?.isActive()) newTab = false;
  const file = plugin.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    new Notice(t("desk.notice.missing", { path }));
    return;
  }
  // With the desk off the recorder isn't running, so the records are stale: ignore them (Q11).
  const deskOn = plugin.features.isOn("desk");
  const leftOff = deskOn ? plugin.data.leftOff : {};
  const record = (p: string): LeftOff | null => {
    const rec = leftOff;
    return rec && Object.prototype.hasOwnProperty.call(rec, p) ? rec[p] : null;
  };

  const place = plugin.books.classify(file);
  if (place.kind !== "book-note" || !place.book) {
    await openAt(plugin, file, record(path), newTab);
    return;
  }

  const chapters = plugin.books.chapters(place.book);
  const target = bookTarget(chapters.map((c) => c.file.path), leftOff ?? {});
  if (target === null) {
    await openAt(plugin, file, null, newTab);
    return;
  }
  if ("path" in target) {
    const chapter = chapters.find((c) => c.file.path === target.path);
    await openAt(plugin, chapter ? chapter.file : file, chapter ? target.spot : null, newTab);
    return;
  }
  for (const c of chapters) {
    const text = await plugin.notes.text(c.file).read();
    if (firstUnwrittenBeatOffset(text) !== null) {
      await openAt(plugin, c.file, null, newTab);
      return;
    }
  }
  await openAt(plugin, chapters[chapters.length - 1].file, null, newTab);
}

async function openAt(plugin: EscritaPlugin, file: TFile, rec: LeftOff | null, newTab: boolean): Promise<void> {
  // Work out the spot before opening and hand it to Obsidian as ephemeral state:
  // Obsidian restores a note's last scroll and cursor when it opens it, and that
  // restore would undo a cursor set afterwards.
  let pos: { line: number; ch: number } | null = null;
  try {
    pos = spotPosition(await plugin.notes.text(file).read(), rec);
  } catch (e) {
    console.error(`Escrita: couldn't read ${file.path}`, e);
  }
  const leaf: WorkspaceLeaf = plugin.app.workspace.getLeaf(newTab ? "tab" : false);
  const eState = pos ? { line: pos.line, cursor: { from: pos, to: pos } } : undefined;
  await leaf.openFile(file, { active: true, eState });
  const view = leaf.view;
  if (!pos || !(view instanceof MarkdownView) || view.getMode() === "preview") return;
  const editor = view.editor;
  const at = { line: Math.min(pos.line, editor.lastLine()), ch: pos.ch };
  editor.setCursor(at);
  editor.scrollIntoView({ from: at, to: at }, true);
  editor.focus();
}
