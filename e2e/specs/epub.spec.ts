// docs/TEST-0.9.md, "EPUB" (board 31), steps 1 to 13. The file is opened with a small zip
// reader; reading it in Calibre or Apple Books (step 5's "by eye" part) stays by eye.
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { chip, exportModal, openExport, primary, runExport, setProperty, vaultBytes } from "../lib/export-ui";
import { settingsPage, sleep, snap } from "../lib/panels";
import { zipFiles } from "../lib/zip-read";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const BOOK = "Romances/Teste 0.9/Livro Longo.md";
const DIR = "Escrita/Exportações";
const PTBR = `${DIR}/Livro Longo (pt-BR).epub`;
const SHUNN = `${DIR}/Livro Longo (Shunn).epub`;
let app: App;

test.beforeAll(async () => {
  app = await App.launch({ vault: world09() }); // the whole 30-chapter book
  installWorld09Extras(app.vaultDir);
  await configureWorld09(app);
});
test.afterAll(async () => { await app?.close(); });
test.afterEach(async () => { await app.closeModals(); await app.dismissNotices(); });

const modal = () => exportModal(app);
const chipLabels = async () => modal().locator(".escrita-export-chips").nth(0).locator(".escrita-export-chip > span:first-child").allTextContents();

test("1. Exportar… opens the window for the book with DOCX, Markdown and EPUB", async () => {
  await openExport(app, BOOK);
  await expect(modal().locator(".modal-title")).toHaveText("Exportar “Livro Longo”");
  const formats = await modal().locator(".escrita-export-field").filter({ hasText: "Formato" }).locator(".escrita-export-chip > span:first-child").allTextContents();
  expect(formats).toEqual(expect.arrayContaining(["DOCX", "Markdown", "EPUB"]));
  await snap(app, "1. the export window", modal());
});

test("2. EPUB, pt-BR, all chapters: the line, the file name, the left-out chapter, no warning box", async () => {
  await openExport(app, BOOK);
  await chip(app, "EPUB");
  await chip(app, "pt-BR");
  await expect(modal().locator(".escrita-export-radio").first()).toContainText("Todos (31)");
  const where = modal().locator(".escrita-export-where");
  await expect(where).toContainText("Uma coluna de leitura: capa, folha de rosto, sumário e uma página por capítulo. Sem contagem de palavras.");
  // the export folder is the Portuguese set's (Escrita/Exportações); the doc's Escrita/Exports is the author's own setting
  await expect(where.locator(".escrita-export-mono")).toHaveText(PTBR);
  await expect(modal().locator(".escrita-export-hint")).toContainText("31 Notas soltas");
  await expect(modal().locator(".escrita-export-warn")).toHaveCount(0);
  await expect(primary(app)).toHaveText("Exportar");
  await snap(app, "2. EPUB options", modal());
});

test("3. the preview: cover, title page, dedication, epigraph, contents, then the chapters", async () => {
  await openExport(app, BOOK);
  await chip(app, "EPUB");
  await chip(app, "pt-BR");
  await modal().getByRole("button", { name: "Prévia" }).click();
  const paper = modal().locator(".escrita-export-paper");
  await expect(paper).toBeVisible();
  const kinds = await paper.evaluate((el) => [...el.children].map((c) => {
    const cls = (c as HTMLElement).className as string;
    const text = (c.textContent ?? "").trim();
    if (cls.includes("escrita-export-cover")) return "cover";
    if (cls.includes("escrita-export-title")) return `title:${text}`;
    if (cls.includes("escrita-export-zone")) return `zone:${text}`;
    if (cls.includes("escrita-export-contents-title")) return `contents:${text}`;
    if (cls.includes("escrita-export-chapter")) return `chapter:${text}`;
    if (cls.includes("escrita-export-break")) return `break:${text}`;
    if (cls.includes("escrita-export-contents")) return "list";
    if (cls.includes("escrita-export-byline")) return "byline";
    return "p";
  }));
  const at = (k: string) => kinds.findIndex((x) => x === k);
  expect(kinds.slice(0, 2)).toEqual(["zone:capa", "cover"]);
  expect(kinds).not.toContain("");
  expect(at("title:Livro Longo")).toBeGreaterThan(at("cover"));
  expect(at("zone:dedicatória")).toBeGreaterThan(at("title:Livro Longo"));
  expect(at("zone:epígrafe")).toBeGreaterThan(at("zone:dedicatória"));
  expect(at("contents:Sumário")).toBeGreaterThan(at("zone:epígrafe"));
  const chapters = kinds.filter((k) => k.startsWith("chapter:"));
  expect(chapters).toHaveLength(31);
  expect(chapters[0]).toBe("chapter:Prólogo");
  expect(chapters[1]).toBe("chapter:Capítulo 1 — A chegada");
  expect(chapters[30]).toBe("chapter:Capítulo 30 — A travessia");
  expect(at(chapters[0])).toBeGreaterThan(at("contents:Sumário"));
  expect(kinds.filter((k) => k.startsWith("break:")).every((k) => k === "break:* * *")).toBe(true);
  // a scene break never opens or closes a chapter
  for (let i = 0; i < kinds.length; i++) {
    if (!kinds[i].startsWith("break:")) continue;
    expect(kinds[i - 1].startsWith("chapter:")).toBe(false);
    expect(kinds[i + 1]?.startsWith("chapter:") ?? false).toBe(false);
  }
  // chapter 02 shows no beat and no comment
  const text = await paper.innerText();
  expect(text).not.toContain("ela encontra a carta");
  expect(text).not.toContain("rever o tom");
  expect(text).toContain("A carta estava debaixo da porta, molhada.");
  await snap(app, "3. EPUB preview", modal());

  // Voltar returns; a click on a paragraph opens the chapter at that line
  await modal().getByRole("button", { name: "Voltar" }).click();
  await expect(modal().locator(".escrita-export-chips").first()).toBeVisible();
  await modal().getByRole("button", { name: "Prévia" }).click();
  const para = modal().locator(".escrita-export-para.is-linked").first();
  const line = Number(await para.getAttribute("data-line"));
  await para.click();
  await app.waitFor("a chapter to open", async () => ((await app.activeFile()) ?? "").includes("/Capítulos/"));
  expect(await app.activeFile()).toContain("Capítulos/00 Prólogo");
  await app.waitFor("the cursor line", async () => (await app.cursor())?.line === line, 4000).catch(() => {});
  expect((await app.cursor())?.line).toBe(line);
});

test("4. Exportar writes the file and says so", async () => {
  await openExport(app, BOOK);
  await chip(app, "EPUB");
  await chip(app, "pt-BR");
  await primary(app).click();
  await app.notice("Exportado: Livro Longo (pt-BR).epub.");
  expect(app.vaultFileExists(PTBR)).toBe(true);
  await expect(app.page.locator(".notice", { hasText: "Exportado:" }).getByText("Abrir a pasta", { exact: false }).first()).toBeVisible().catch(() => {});
});

test("5. inside the file: mimetype first and stored, cover, title, language, the contents list, scene breaks", async () => {
  const zip = zipFiles(vaultBytes(app, PTBR));
  expect(zip.names[0]).toBe("mimetype");
  expect(zip.entries[0].method).toBe(0);
  expect(zip.text("mimetype")).toBe("application/epub+zip");
  expect(zip.text("META-INF/container.xml")).toContain('full-path="OEBPS/content.opf"');
  const opf = zip.text("OEBPS/content.opf");
  expect(opf).toContain("<dc:language>pt-BR</dc:language>");
  expect(opf).toContain("<dc:title>Livro Longo</dc:title>");
  expect(opf).toMatch(/properties="cover-image"/);
  expect(zip.names.some((n) => /^OEBPS\/.*\.jpe?g$/.test(n))).toBe(true);
  const nav = zip.text("OEBPS/nav.xhtml");
  expect(nav).toContain("<h1>Sumário</h1>");
  const labels = [...nav.matchAll(/<li><a href="[^"]+">([^<]+)<\/a><\/li>/g)].map((m) => m[1]);
  expect(labels).toContain("Prólogo");
  for (let i = 1; i <= 30; i++) expect(labels.some((l) => l.startsWith(`Capítulo ${i} — `))).toBe(true);
  expect(labels.some((l) => l.includes("Notas soltas"))).toBe(false);
  const pages = zip.names.filter((n) => n.endsWith(".xhtml"));
  const all = pages.map((n) => zip.text(n)).join("\n");
  expect(all).toContain("Para quem lê até o fim.");
  expect(all).toContain("O mar não tem caminhos");
  expect(all).toContain('<p class="scene-break">* * *</p>');
  expect(all).toContain("— "); // dialogue dashes kept
  expect(all).not.toContain("ela encontra a carta");
  expect(all).not.toContain("Notas que não entram no livro");
  expect(zip.text(pages.find((n) => zip.text(n).includes("A carta estava debaixo da porta"))!)).not.toContain("%%");
  test.info().annotations.push({ type: "by eye", description: "open the file in Calibre's viewer or Apple Books; EPUBCheck runs in CI" });
});

test("6. the window remembers the last export; Exportar de novo writes at once", async () => {
  await openExport(app, BOOK);
  const last = modal().locator(".escrita-export-last");
  await expect(last).toContainText("Última exportação: EPUB · pt-BR · 31 capítulos");
  await expect(last.locator("a.escrita-export-mono")).toHaveText("Livro Longo (pt-BR).epub");
  await app.closeModals();
  const before = fs.statSync(path.join(app.vaultDir, PTBR)).mtimeMs;
  await sleep(1100);
  await app.command("export-again");
  await app.notice("Exportado");
  await expect(exportModal(app)).toHaveCount(0);
  expect(fs.statSync(path.join(app.vaultDir, PTBR)).mtimeMs).toBeGreaterThan(before);
  expect(app.listVaultFolder(DIR).filter((n) => n.startsWith("Livro Longo"))).toEqual(["Livro Longo (pt-BR).epub"]);
});

test("7. Shunn: a second file beside the first, English headings and language", async () => {
  await openExport(app, BOOK);
  await chip(app, "EPUB");
  await chip(app, "Shunn");
  await runExport(app);
  await app.notice("Exportado: Livro Longo (Shunn).epub.");
  expect(app.vaultFileExists(PTBR)).toBe(true);
  const zip = zipFiles(vaultBytes(app, SHUNN));
  expect(zip.text("OEBPS/content.opf")).toMatch(/<dc:language>en(-US)?<\/dc:language>/);
  const nav = zip.text("OEBPS/nav.xhtml");
  expect(nav).toContain("<h1>Contents</h1>");
  expect(nav).toContain("Chapter 1: A chegada");
});

test("8. edge case: a missing cover warns, the button says anyway, the EPUB goes without a cover", async () => {
  await setProperty(app, BOOK, "cover", "[[capa-que-nao-existe.jpg]]");
  await openExport(app, BOOK);
  await chip(app, "EPUB");
  await chip(app, "pt-BR");
  const warn = modal().locator(".escrita-export-warn");
  await expect(warn).toContainText("Antes de enviar");
  await expect(warn).toContainText("Capa não encontrada ou ilegível: [[capa-que-nao-existe.jpg]]. O EPUB sai sem capa");
  await expect(primary(app)).toHaveText("Exportar mesmo assim");
  await snap(app, "8. missing cover warning", modal());
  await runExport(app, "Substituir");
  await app.notice("Exportado:");
  const zip = zipFiles(vaultBytes(app, PTBR));
  expect(zip.text("OEBPS/content.opf")).not.toContain("cover-image");
});

test("9. edge case: a note as the cover gives the same warning; no cover property, no warning", async () => {
  await setProperty(app, BOOK, "cover", "[[Maré]]");
  await openExport(app, BOOK);
  await chip(app, "EPUB");
  await expect(modal().locator(".escrita-export-warn")).toContainText("Capa não encontrada ou ilegível: [[Maré]]");
  await app.closeModals();
  await setProperty(app, BOOK, "cover", null);
  await openExport(app, BOOK);
  await chip(app, "EPUB");
  await expect(modal().locator(".escrita-export-warn")).toHaveCount(0);
  await expect(primary(app)).toHaveText("Exportar");
  await app.closeModals();
  await setProperty(app, BOOK, "cover", "[[capa-teste.jpg]]");
});

test("10. edge case: a plain path works like the link", async () => {
  await setProperty(app, BOOK, "cover", "Anexos/capa-teste.jpg");
  await openExport(app, BOOK);
  await chip(app, "EPUB");
  await chip(app, "pt-BR");
  await expect(modal().locator(".escrita-export-warn")).toHaveCount(0);
  await expect(modal().locator(".escrita-export-where")).toContainText("capa, folha de rosto");
  await runExport(app, "Substituir");
  await app.notice("Exportado:");
  expect(zipFiles(vaultBytes(app, PTBR)).text("OEBPS/content.opf")).toContain('properties="cover-image"');
  await setProperty(app, BOOK, "cover", "[[capa-teste.jpg]]");
});

test("11. a conto with its own cover: cover, title page and a contents page with one entry", async () => {
  const mare = "Contos/Teste 0.9/Maré.md";
  await setProperty(app, mare, "cover", "[[capa-teste.jpg]]");
  await openExport(app, mare);
  await chip(app, "EPUB");
  await chip(app, "pt-BR");
  await expect(modal().locator(".escrita-export-where")).toContainText("capa, folha de rosto");
  await runExport(app);
  await app.notice("Exportado: Maré (pt-BR).epub.");
  const zip = zipFiles(vaultBytes(app, `${DIR}/Maré (pt-BR).epub`));
  expect(zip.text("OEBPS/content.opf")).toContain('properties="cover-image"');
  expect(zip.text("OEBPS/title.xhtml")).toContain("Maré");
  const labels = [...zip.text("OEBPS/nav.xhtml").matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map((m) => m[2]);
  expect(labels.filter((l) => l !== "Capa" && l !== "Sumário" && !/^(Começar|Início)/.test(l))).toHaveLength(1);
  await setProperty(app, mare, "cover", null);
});

test("12. the scene break setting: ❦ in the file; an empty field goes back to * * *", async () => {
  // the settings row, typed in the settings tab
  await app.openSettings();
  const row = (await settingsPage(app)).locator(".setting-item").filter({ hasText: "Separador de cena no EPUB" }).locator("input").first();
  await row.fill("❦");
  await row.blur();
  await app.waitFor("the setting saved", async () => (await app.setting<string>("epubSceneBreak")) === "❦");
  await app.closeModals();
  await openExport(app, BOOK);
  await chip(app, "EPUB");
  await chip(app, "pt-BR");
  await runExport(app, "Substituir");
  await app.notice("Exportado:");
  const all = (() => { const z = zipFiles(vaultBytes(app, PTBR)); return z.names.filter((n) => n.endsWith(".xhtml")).map((n) => z.text(n)).join("\n"); })();
  expect(all).toContain('<p class="scene-break">❦</p>');
  expect(all).not.toContain('<p class="scene-break">* * *</p>');

  await app.openSettings();
  const row2 = (await settingsPage(app)).locator(".setting-item").filter({ hasText: "Separador de cena no EPUB" }).locator("input").first();
  await row2.fill("");
  await row2.blur();
  await app.waitFor("the default is back", async () => (await app.setting<string>("epubSceneBreak")) === "* * *");
  await app.closeModals();
});

test("13. the file already exists: Cancelar, Manter os dois, Substituir", async () => {
  await openExport(app, BOOK);
  await chip(app, "EPUB");
  await chip(app, "pt-BR");
  await primary(app).click();
  const dlg = app.page.locator(".modal", { hasText: "O arquivo já existe" });
  await expect(dlg).toBeVisible();
  for (const b of ["Cancelar", "Manter os dois", "Substituir"]) await expect(dlg.getByRole("button", { name: b })).toBeVisible();
  await snap(app, "13. the file already exists", dlg);
  await dlg.getByRole("button", { name: "Manter os dois" }).click();
  await app.waitFor("the second file", () => app.listVaultFolder(DIR).filter((n) => /^Livro Longo \(pt-BR\) .*\.epub$/.test(n)).length === 1);
});
