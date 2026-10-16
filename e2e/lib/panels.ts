// Helpers shared by the 0.9 specs (TEST-0.9): the active editor's text, the universe panel,
// a stand-in for the vault's link setting. Kept apart from app.ts, which other tasks extend.
import type { Locator } from "@playwright/test";
import type { App } from "./app";

// The editor of the note that is open, even when a side panel has the focus (a click on a
// panel button makes the panel the active leaf, and `activeEditor` is then empty).
const EDITOR = `(() => {
  const path = app.workspace.getActiveFile()?.path;
  const view = app.workspace.getLeavesOfType("markdown").map((l) => l.view).find((v) => v.file?.path === path);
  return view?.editor;
})()`;

/** The open note's whole text (the live buffer, not the file on disk). */
export function editorText(app: App): Promise<string> {
  return app.page.evaluate(`${EDITOR}?.getValue() ?? ""`) as Promise<string>;
}

/** Replaces one line (0-based) of the active editor. */
export function setEditorLine(app: App, line: number, text: string): Promise<void> {
  return app.page.evaluate(`((n, s) => {
    const ed = ${EDITOR};
    ed.replaceRange(s, { line: n, ch: 0 }, { line: n, ch: ed.getLine(n).length });
  })(${line}, ${JSON.stringify(text)})`) as Promise<void>;
}

/** Adds text at the end of the active editor. */
export function appendToEditor(app: App, text: string): Promise<void> {
  return app.page.evaluate(`((s) => {
    const ed = ${EDITOR};
    ed.replaceRange(s, { line: ed.lastLine(), ch: ed.getLine(ed.lastLine()).length });
  })(${JSON.stringify(text)})`) as Promise<void>;
}

/** One undo in the active editor. */
export function undo(app: App): Promise<void> {
  return app.page.evaluate(`${EDITOR}.undo()`) as Promise<void>;
}

/** Replaces the whole text of a vault note through the app (the editor when open), then lets the cache catch up. */
export async function rewriteNote(app: App, vaultPath: string, text: string): Promise<void> {
  await app.page.evaluate(async ([p, s]) => {
    await app.vault.modify(app.vault.getFileByPath(p), s);
  }, [vaultPath, text] as const);
}

/** The vault's own link setting: Markdown links (the author's vault) or wikilinks (the default). */
export function useMarkdownLinks(app: App, on: boolean): Promise<void> {
  return app.page.evaluate((v) => { app.vault.setConfig("useMarkdownLinks", v); }, on);
}

/** Opens the universe panel and shows one tab (by its visible label, "Obras" or "Entradas"). */
export async function showUniverseTab(app: App, label: string): Promise<void> {
  await app.command("open-universe");
  const tab = app.page.locator(".escrita-universe-tab").filter({ hasText: label }).first();
  await tab.waitFor({ state: "visible" });
  if (!(await tab.getAttribute("class"))?.includes("is-active")) await tab.click();
}

/** The universe panel's element (the first leaf of the view). */
export function universePanel(app: App): Locator {
  return app.page.locator(".escrita-universe-body").first();
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A screenshot of an element that may redraw under us; falls back to the whole window. */
export async function snap(app: App, name: string, element?: Locator): Promise<void> {
  try {
    await app.screenshot(name, element);
  } catch {
    await app.screenshot(name);
  }
}

/** The cursor (0-based line, ch) of the open note's editor, even when a panel has the focus. */
export function editorCursor(app: App): Promise<{ line: number; ch: number } | null> {
  return app.page.evaluate(`(() => { const ed = ${EDITOR}; if (!ed) return null; const c = ed.getCursor(); return { line: c.line, ch: c.ch }; })()`) as Promise<{ line: number; ch: number } | null>;
}

/** The settings window: Obsidian 1.14 opens it as its own about:blank page, not in the vault window. */
export async function settingsPage(app: App) {
  for (let i = 0; i < 50; i++) {
    for (const p of app.page.context().pages()) {
      if (p !== app.page && !p.isClosed() && (await p.locator(".setting-item").count()) > 0) return p;
    }
    await sleep(100);
  }
  throw new Error("the settings window did not open");
}
