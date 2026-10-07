// Pieces shared by the panel's tabs and the standalone threads view: the context a
// tab renders from, and the two things every tab does (open a note, show a message).

import { Keymap, Notice, TFile, type Editor } from "obsidian";
import type EscritaPlugin from "../main";
import { t } from "../i18n";
import type { Scope } from "../core/scope";
import type { AppearsIn } from "./mentions";
import type { AppearsInLabels } from "./appears-in";

/** The thread whose close form is open: its key (path and offset), the typed answer, and whether the input still needs focus. */
export interface ClosingForm {
  key: string;
  answer: string;
  focus: boolean;
}

/** What a tab renders from. The view owns it and rebuilds it on every refresh. */
export interface PanelCtx {
  plugin: EscritaPlugin;
  /** kind "none" only in the standalone threads view (tracked works) */
  scope: Scope;
  /** the entries search, typed by the writer (kept across refreshes) */
  query: string;
  collapsed: ReadonlySet<string>;
  showClosed: boolean;
  closing: ClosingForm | null;
  toggleCollapsed(kind: string): void;
  toggleClosed(): void;
  openClose(key: string | null): void;
  /** re-render the whole panel now */
  refresh(): void;
  /** works an entry appears in; null while unknown (index building) or not wired. Beside the name in the Entries tab (4.2). */
  counts?: (path: string) => number | null;
  /** the mentions of an entry, grouped; null while unknown. Opened from the count under the entry's row. */
  appearsIn?: (path: string) => AppearsIn | null;
  /** how the list names works and chapters */
  appearsLabels?: AppearsInLabels;
  /** the editor of the last markdown note the writer had open, with its path */
  lastEditor(): { editor: Editor; path: string } | null;
}

/** Marks the element that keeps focus across a re-render (the search box, the close form's input). */
export const FOCUS_ATTR = "data-escrita-focus";

/**
 * Opens a note in the main area (the panel lives in the sidebar, so never in its own
 * leaf). Ctrl/Cmd-click opens beside. `line` lands the cursor on that line.
 */
export async function openNote(plugin: EscritaPlugin, path: string, evt: MouseEvent | KeyboardEvent | null, line?: number, forceSide = false): Promise<void> {
  const { workspace, vault } = plugin.app;
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    new Notice(t("universe.view.notice.missing", { path }));
    return;
  }
  const side = forceSide || (evt !== null && !!Keymap.isModEvent(evt));
  const recent = workspace.getMostRecentLeaf(workspace.rootSplit);
  const leaf = recent
    ? (side ? workspace.createLeafBySplit(recent, "vertical") : recent)
    : workspace.getLeaf("tab");
  const pos = line === undefined ? null : { line, ch: 0 };
  await leaf.openFile(file, { active: true, eState: pos ? { line: pos.line, cursor: { from: pos, to: pos } } : undefined });
  await workspace.revealLeaf(leaf);
}

/** A block of explanation, optionally with a mono sample line and buttons. */
export function messageBlock(el: HTMLElement, text: string): HTMLElement {
  const box = el.createDiv({ cls: "escrita-universe-empty" });
  box.createSpan({ text });
  return box;
}

export function button(el: HTMLElement, text: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const b = el.createEl("button", { cls: primary ? "escrita-universe-btn mod-cta" : "escrita-universe-btn", text });
  b.setAttribute("type", "button");
  b.addEventListener("click", onClick);
  return b;
}
