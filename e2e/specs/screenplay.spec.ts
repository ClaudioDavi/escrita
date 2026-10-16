// PLAN-1.1 G2 (Wave 2, J): screenplay export in a real Obsidian. Board 43: the modal, Fountain,
// the warnings, the PDF preview. Reading the PDF in a reader app stays by eye (docs/TESTING.md).
import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { App } from "../lib/app";
import { BY_PROPERTY, LONG, NOTES, PROSE, SCRIPT, screenplays } from "../fixtures/screenplays";
import { chip, exportModal, openExport, runExport, vaultBytes } from "../lib/export-ui";
import { settingsPage } from "../lib/more";
import { snap } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const DIR = "Escrita/Exportações";
const TITLE = "A lata do faroleiro";
let ob: App;

test.beforeAll(async () => {
  ob = await App.launch({ vault: screenplays() });
  await ob.setSettings({ formFolders: "Roteiros: roteiro" });
});
test.afterAll(async () => { await ob?.close(); });
test.afterEach(async () => { await ob.closeModals(); await ob.dismissNotices(); });

const modal = () => exportModal(ob);
const formats = () => modal().locator(".escrita-export-field").filter({ hasText: "Formato" }).locator(".escrita-export-chip > span:first-child").allTextContents();
const where = () => modal().locator(".escrita-export-where");
const abs = (rel: string) => path.join(ob.vaultDir, rel);

/** The count the "where" line promised ("cerca de N páginas"). */
async function promisedPages(): Promise<number> {
  const m = /cerca de (\d+) página/.exec((await where().innerText()) ?? "");
  if (!m) throw new Error("no page count in the where line");
  return Number(m[1]);
}

test("1. a screenplay note offers only PDF and Fountain, and the Página row", async () => {
  await openExport(ob, SCRIPT);
  expect(await formats()).toEqual(["PDF", "Fountain"]);
  await expect(modal().locator(".escrita-export-field").filter({ hasText: "Página" })).toBeVisible();
  await snap(ob, "1. a screenplay: PDF and Fountain", modal());
  // the form property reaches the same window
  await openExport(ob, BY_PROPERTY);
  expect(await formats()).toEqual(["PDF", "Fountain"]);
});

test("2. a prose note in the same vault still offers DOCX, Markdown and EPUB", async () => {
  await openExport(ob, PROSE);
  expect(await formats()).toEqual(["DOCX", "Markdown", "EPUB"]);
  await expect(modal().locator(".escrita-export-field").filter({ hasText: "Página" })).toHaveCount(0);
  await snap(ob, "2. prose: unchanged", modal());
});

test("3. PDF on A4 writes '<title> (A4).pdf': header, trailer and the page count of the where line", async () => {
  await openExport(ob, SCRIPT);
  await chip(ob, "PDF");
  await chip(ob, "A4");
  const pages = await promisedPages();
  await snap(ob, "3. PDF, A4", modal());
  await runExport(ob);
  const rel = `${DIR}/${TITLE} (A4).pdf`;
  await ob.waitForFile(rel).catch(() => undefined); // binary: waitForFile reads text, the bytes are checked below
  const bytes = vaultBytes(ob, rel);
  expect(bytes.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
  expect(bytes.subarray(-12).toString("latin1")).toContain("%%EOF");
  const info = execFileSync("pdfinfo", [abs(rel)], { encoding: "utf8" });
  expect(Number(/^Pages:\s+(\d+)/m.exec(info)![1])).toBe(pages);
  expect(info).toMatch(/Page size:\s+595\.\d+ x 841\.\d+ pts \(A4\)/);
  const fonts = execFileSync("pdffonts", [abs(rel)], { encoding: "utf8" });
  expect(fonts).toContain("Courier");
  await test.info().attach("3. pdfinfo and pdffonts", { body: `${info}\n${fonts}`, contentType: "text/plain" });
});

test("4. Letter writes '(Letter).pdf' at 612 x 792", async () => {
  await openExport(ob, SCRIPT);
  await chip(ob, "PDF");
  await chip(ob, "US Letter");
  await runExport(ob);
  const rel = `${DIR}/${TITLE} (Letter).pdf`;
  await ob.waitFor("the Letter file", () => fs.existsSync(abs(rel)));
  const info = execFileSync("pdfinfo", [abs(rel)], { encoding: "utf8" });
  expect(info).toMatch(/Page size:\s+612 x 792 pts \(letter\)/);
});

test("5. the page choice is remembered for that work, not for another", async () => {
  await openExport(ob, SCRIPT);
  // the last export was Letter; choose A4, export, and the window opens on A4 next time
  await chip(ob, "PDF");
  await chip(ob, "A4");
  await runExport(ob);
  await ob.closeModals();
  await openExport(ob, SCRIPT);
  await expect(modal().locator('.escrita-export-chip[aria-checked="true"]').filter({ hasText: /^A4/ })).toHaveCount(1);
  await snap(ob, "5. A4 remembered", modal());
  await openExport(ob, BY_PROPERTY);
  await expect(modal().locator('.escrita-export-chip[aria-checked="true"]').filter({ hasText: /^US Letter/ })).toHaveCount(1);
});

test("6. Fountain writes '<title>.fountain' with a Title: block and no %% beats; Keep notes turns a comment into [[…]]", async () => {
  await openExport(ob, NOTES);
  await chip(ob, "Fountain");
  await expect(where().locator(".escrita-export-mono")).toHaveText(`${DIR}/Com notas.fountain`);
  await runExport(ob);
  const rel = `${DIR}/Com notas.fountain`;
  const plain = await ob.waitForFile(rel);
  expect(plain).toMatch(/^Title: Com notas/m);
  expect(plain).not.toContain("%%");
  expect(plain).not.toContain("[[");
  expect(plain).not.toContain("Tomé chega");

  await openExport(ob, NOTES);
  await chip(ob, "Fountain");
  await modal().getByRole("checkbox", { name: /Levar as notas/ }).click();
  await snap(ob, "6. Fountain, Keep notes", modal());
  await runExport(ob);
  await ob.waitFor("the notes in the file", () => fs.readFileSync(abs(rel), "utf8").includes("[["));
  const kept = fs.readFileSync(abs(rel), "utf8");
  expect(kept).toContain("[[reescrever esta cena depois]]");
  expect(kept).not.toContain("%%");

  // the title-page script too
  await openExport(ob, SCRIPT);
  await chip(ob, "Fountain");
  await runExport(ob);
  const full = await ob.waitForFile(`${DIR}/${TITLE}.fountain`);
  expect(full).toMatch(/^Title: A lata do faroleiro/m);
});

test("7. a character outside WinAnsi is named in 'Antes de enviar' with its line, and the PDF prints '?'", async () => {
  await openExport(ob, NOTES);
  await chip(ob, "PDF");
  const warn = modal().locator(".escrita-export-warn");
  await expect(warn).toContainText("Antes de enviar");
  await expect(warn).toContainText("★");
  await expect(warn).toContainText(/linha 8\b/);
  await snap(ob, "7. the ★ warning", modal());
  await runExport(ob);
  const rel = `${DIR}/Com notas (Letter).pdf`;
  await ob.waitFor("the PDF", () => fs.existsSync(abs(rel)) || fs.existsSync(abs(`${DIR}/Com notas (A4).pdf`)));
  const file = fs.existsSync(abs(rel)) ? rel : `${DIR}/Com notas (A4).pdf`;
  const text = execFileSync("pdftotext", ["-layout", abs(file), "-"], { encoding: "utf8" });
  expect(text).toContain("Estrela ? no céu");
  expect(text).not.toContain("★");
});

test("8. the PDF preview opens and shows (MAIS) and (CONT.) on a speech that breaks", async () => {
  // pt-short.fountain breaks only between elements, so a script with one speech longer than a page
  await openExport(ob, LONG);
  await chip(ob, "PDF");
  await modal().getByRole("button", { name: "Prévia" }).click();
  const pages = modal().locator(".escrita-sp-pages");
  await expect(pages).toBeVisible();
  await expect(pages).toContainText("(MAIS)");
  await expect(pages).toContainText("(CONT.)");
  await snap(ob, "8. the preview", modal());
});

test("9. the Roteiros settings group shows its nine rows in pt-BR", async () => {
  const s = await settingsPage(ob);
  const group = s.locator(".setting-item").filter({ hasText: /Começos de cabeçalho de cena/ });
  await expect(group).toHaveCount(1);
  const names = [
    "Começos de cabeçalho de cena", "Finais de transição", "Tamanho da página", "Números de cena",
    "Rótulo de continua", "Rótulo de continuação", "Linha de crédito", "Propriedade da fonte", "Propriedade da data da versão",
  ];
  for (const n of names) await expect(s.locator(".setting-item-name", { hasText: new RegExp(`^${n}$`) })).toHaveCount(1);
  await expect(s.locator(".setting-item-heading, .setting-item-name", { hasText: /^Roteiros$/ }).first()).toBeVisible();
  await group.scrollIntoViewIfNeeded();
  await ob.screenshot("9. the Roteiros group (window)");
  await s.screenshot().then((body) => test.info().attach("9. settings window", { body, contentType: "image/png" }));
});

test("10. with the export switch off the group and the formats are gone", async () => {
  await ob.closeModals();
  await ob.setFeature("export", false);
  expect(await ob.commandListed("export")).toBe(false);
  const s = await settingsPage(ob);
  await expect(s.locator(".setting-item-name", { hasText: /Começos de cabeçalho de cena/ })).toHaveCount(0);
  await expect(s.locator(".setting-item-name", { hasText: /^Roteiros$/ })).toHaveCount(0);
  await ob.closeModals();
  await ob.setFeature("export", true);
  expect(await ob.commandListed("export")).toBe(true);
});
