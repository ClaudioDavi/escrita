// Helpers for the export window (docs/TEST-0.9.md: EPUB and Collections). The window's own
// `escrita-export-*` classes are the hooks; labels are the Portuguese ones.
import type { Locator } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import type { App } from "./app";

export const exportModal = (app: App): Locator => app.page.locator(".modal.escrita-export-modal");

/** Opens the export window for a note (the command works on the open note). */
export async function openExport(app: App, vaultPath: string): Promise<Locator> {
  await app.closeModals();
  await app.openFile(vaultPath);
  await app.waitFor("the note to be active", async () => (await app.activeFile()) === vaultPath);
  if (!(await app.command("export"))) throw new Error(`export is not offered for ${vaultPath}`);
  const modal = exportModal(app);
  await modal.waitFor({ state: "visible" });
  // the first build ("Lendo o texto…") is done when the primary button is enabled or a warning shows
  await app.page.waitForFunction(() => {
    const m = document.querySelector(".escrita-export-modal");
    return !!m && !m.textContent?.includes("Lendo o texto");
  }, null, { timeout: 30_000 });
  return modal;
}

/** Picks a chip of a row ("EPUB", "pt-BR", "Shunn", "DOCX") and waits for the rebuild. */
export async function chip(app: App, label: string): Promise<void> {
  const c = exportModal(app).locator(".escrita-export-chip").filter({ has: app.page.locator("span:first-child", { hasText: new RegExp(`^${label}$`) }) });
  if ((await c.getAttribute("aria-checked")) !== "true") await c.click();
  await app.page.waitForFunction(() => !document.querySelector(".escrita-export-modal")?.textContent?.includes("Lendo o texto"), null, { timeout: 30_000 });
}

export const primary = (app: App): Locator => exportModal(app).locator(".escrita-export-footer button.mod-cta");

/**
 * Presses the primary button. When the file is there already, the "O arquivo já existe" window
 * opens: `onExists` picks a button ("Substituir", "Manter os dois", "Cancelar").
 */
export async function runExport(app: App, onExists: string = "Substituir"): Promise<void> {
  await primary(app).click();
  const exists = app.page.locator(".modal", { hasText: "O arquivo já existe" });
  const first = await Promise.race([
    exists.waitFor({ state: "visible", timeout: 6000 }).then(() => "exists" as const).catch(() => "none" as const),
    app.page.locator(".notice", { hasText: /Exportado:/ }).first().waitFor({ state: "visible", timeout: 6000 }).then(() => "done" as const).catch(() => "none" as const),
  ]);
  if (first === "exists") await exists.getByRole("button", { name: onExists }).click();
}

/** The bytes of a vault file (binary). */
export function vaultBytes(app: App, rel: string): Buffer {
  return fs.readFileSync(path.join(app.vaultDir, rel));
}

/** Rewrites one frontmatter property of a note through Obsidian (null removes it). */
export function setProperty(app: App, vaultPath: string, key: string, value: unknown): Promise<void> {
  return app.page.evaluate(async ([p, k, v]) => {
    await app.fileManager.processFrontMatter(app.vault.getFileByPath(p as string), (fm: any) => {
      if (v === null) delete fm[k as string]; else fm[k as string] = v;
    });
  }, [vaultPath, key, value] as const);
}

/** Waits for the export window's build to finish after a change (the change starts it within 250 ms). */
export async function buildSettled(app: App): Promise<void> {
  await new Promise((r) => setTimeout(r, 450));
  await app.page.waitForFunction(() => !document.querySelector(".escrita-export-modal")?.textContent?.includes("Lendo o texto"), null, { timeout: 30_000 });
}

/** Shows files in the file explorer (opens the folders) and returns the locator of each row. */
export async function revealInExplorer(app: App, paths: string[]): Promise<void> {
  await app.page.evaluate(async (ps) => {
    app.workspace.leftSplit.expand();
    const leaf = app.workspace.getLeavesOfType("file-explorer")[0];
    await app.workspace.revealLeaf(leaf);
    for (const p of ps) leaf.view.revealInFolder(app.vault.getAbstractFileByPath(p));
  }, paths);
}

export const explorerRow = (app: App, p: string): Locator => app.page.locator(`.nav-file-title[data-path="${p}"]`);

/** The titles of the open context menu's items. */
export function menuItems(app: App): Promise<string[]> {
  return app.page.locator(".menu .menu-item-title").allTextContents();
}
