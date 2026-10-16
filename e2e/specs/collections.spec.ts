// docs/TEST-0.9.md, "Collections" (board 34), steps 1 to 14. The DOCX and the EPUB are opened
// with the zip reader; reading them in LibreOffice or a reader app stays by eye.
import { expect, test, type Locator } from "@playwright/test";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { buildSettled, chip, explorerRow, exportModal, menuItems, openExport, primary, revealInExplorer, runExport, setProperty, vaultBytes } from "../lib/export-ui";
import { showUniverseTab, sleep, snap } from "../lib/panels";
import { zipFiles } from "../lib/zip-read";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const DIR = "Contos/Teste 0.9";
const SAL = `${DIR}/Sal.md`;
const FAROL = `${DIR}/O farol apagado.md`;
const MARE = `${DIR}/Maré.md`;
const COLL = `${DIR}/Marés e outros contos.md`;
const OUT = "Escrita/Exportações";
let app: App;

test.beforeAll(async () => {
  app = await App.launch({ vault: world09({ chapters: 6 }) });
  installWorld09Extras(app.vaultDir);
  await configureWorld09(app);
  await app.setSettings({ collectionProperty: "contents" });
});
test.afterAll(async () => { await app?.close(); });
test.afterEach(async () => { await app.closeModals(); await app.dismissNotices(); });

const modal = () => exportModal(app);
const COLLECTION_TEXT = '---\ncontents:\n  - "[[Maré]]"\n  - "[[O farol apagado]]"\n  - "[[Sal]]"\n---\n';

/**
 * Selects rows of the file explorer the way Ctrl-click does. A real Ctrl-click sent over the
 * DevTools protocol does not reach the explorer's multi-select in this Obsidian, so the
 * explorer's own selection is set (tree.selectItem), and the right-click is real.
 */
async function selectNotes(paths: string[]): Promise<void> {
  await revealInExplorer(app, paths);
  await app.page.evaluate((ps) => {
    const v = app.workspace.getLeavesOfType("file-explorer")[0].view;
    v.tree.clearSelectedDoms();
    for (const p of ps) v.tree.selectItem(v.fileItems[p]);
  }, paths);
}

/** Right-click on the last selected row; returns the menu's item titles. */
async function menuOn(path: string): Promise<string[]> {
  await explorerRow(app, path).click({ button: "right" });
  await app.page.locator(".menu").first().waitFor({ state: "visible" });
  return menuItems(app);
}

/** The three contos selected, then the menu's item. */
async function openCollectionWindow(): Promise<Locator> {
  await selectNotes([SAL, FAROL, MARE]);
  await menuOn(MARE);
  await app.page.locator(".menu .menu-item", { hasText: "Criar uma coleção…" }).click();
  const dlg = app.page.locator(".modal", { hasText: "Criar uma coleção" });
  await dlg.waitFor({ state: "visible" });
  return dlg;
}

test("1. three notes selected: the menu offers Criar uma coleção…", async () => {
  await selectNotes([SAL, FAROL, MARE]);
  const items = await menuOn(MARE);
  expect(items).toContain("Criar uma coleção…");
  await snap(app, "1. explorer menu");
  await app.page.keyboard.press("Escape");
});

test("2. edge case: a mixed selection, or one note, has no such item", async () => {
  await selectNotes([SAL, FAROL, MARE, "Anexos/capa-teste.jpg"]);
  expect(await menuOn("Anexos/capa-teste.jpg")).not.toContain("Criar uma coleção…");
  await app.page.keyboard.press("Escape");
  await selectNotes([SAL]);
  expect(await menuOn(SAL)).not.toContain("Criar uma coleção…");
  await app.page.keyboard.press("Escape");
});

test("3. the window: empty title, the count line, Criar greyed out until you type", async () => {
  const dlg = await openCollectionWindow();
  await expect(dlg.locator(".modal-title")).toHaveText("Criar uma coleção");
  await expect(dlg.locator("input")).toHaveValue("");
  await expect(dlg.locator(".escrita-export-label")).toHaveText("Título");
  await expect(dlg).toContainText("3 contos, nesta ordem, vão na propriedade “contents”.");
  await expect(dlg.getByRole("button", { name: "Criar", exact: true })).toBeDisabled();
  await snap(app, "3. the collection window", dlg);
});

test("4. Enter creates the note, in the explorer's order, with no status", async () => {
  const dlg = await openCollectionWindow();
  await dlg.locator("input").fill("Marés e outros contos");
  await app.page.keyboard.press("Enter");
  const text = await app.waitForFile(COLL);
  expect(text).toBe(COLLECTION_TEXT);
  await app.waitFor("the new note open", async () => (await app.activeFile()) === COLL);
  await sleep(2500);
  expect(app.readVaultFile(COLL)).toBe(COLLECTION_TEXT); // "New notes start as draft" skips a note with contents
  await showUniverseTab(app, "Obras");
  await expect(app.page.locator(".escrita-universe-work-name", { hasText: "Marés e outros contos" })).toHaveCount(0);
  // Q27: a collection with a status is a work
  await setProperty(app, COLL, "status", "rascunho");
  await expect(app.page.locator(".escrita-universe-work-name", { hasText: "Marés e outros contos" })).toHaveCount(1, { timeout: 15_000 });
  await setProperty(app, COLL, "status", null);
  await expect(app.page.locator(".escrita-universe-work-name", { hasText: "Marés e outros contos" })).toHaveCount(0, { timeout: 15_000 });
  expect(app.readVaultFile(COLL)).toBe(COLLECTION_TEXT);
});

test("5. edge case: a name clash makes a second note, never overwriting the first", async () => {
  const dlg = await openCollectionWindow();
  await dlg.locator("input").fill("Marés e outros contos");
  await app.page.keyboard.press("Enter");
  await app.waitFor("a second note", () => app.listVaultFolder(DIR).filter((n) => n.startsWith("Marés e outros contos")).length === 2);
  const names = app.listVaultFolder(DIR).filter((n) => n.startsWith("Marés e outros contos"));
  expect(names).toContain("Marés e outros contos.md");
  const second = names.find((n) => n !== "Marés e outros contos.md")!;
  expect(second).toMatch(/^Marés e outros contos \d+\.md$/);
  expect(app.readVaultFile(COLL)).toBe(COLLECTION_TEXT);
  await app.page.evaluate(async (p) => { await app.fileManager.trashFile(app.vault.getFileByPath(p)); }, `${DIR}/${second}`);
  await app.waitFor("the second note gone", () => !app.vaultFileExists(`${DIR}/${second}`));
});

test("6. Exportar… on the collection: the Coleção line, a Contos row, no book chips", async () => {
  await openExport(app, COLL);
  await expect(modal().locator(".escrita-export-field").filter({ hasText: "Coleção: 3 contos" })).toBeVisible();
  await expect(modal().locator(".escrita-export-label", { hasText: /^Contos$/ })).toBeVisible();
  await expect(modal().locator(".escrita-export-label", { hasText: /^Capítulos$/ })).toHaveCount(0);
  await expect(modal().locator(".escrita-export-radio")).toHaveCount(3);
  const radios = await modal().locator(".escrita-export-radio").allTextContents();
  expect(radios[0]).toBe("Todos (3)");
  expect(radios.join("|")).toContain("Do");
  expect(radios.join("|")).toContain("Escolher…");
  // the "O quê" label stays, but it only states what the collection is: no "Este capítulo" / "O livro inteiro" chips
  await expect(modal().getByText("O livro inteiro")).toHaveCount(0);
  await expect(modal().getByText("Este capítulo")).toHaveCount(0);
  test.info().annotations.push({ type: "doc wording", description: "TEST-0.9 says there is no 'O quê' row; the row is drawn and holds the 'Coleção: 3 contos' line (modal.ts renderWhat). Read as: no choice there." });
  await snap(app, "6. export window for the collection", modal());
});

test("7. DOCX pt-BR: title page, each conto on a new page under its title, header from page 2, FIM", async () => {
  await openExport(app, COLL);
  await chip(app, "DOCX");
  await chip(app, "pt-BR");
  await runExport(app);
  await app.notice("Exportado: Marés e outros contos (pt-BR).docx.");
  const zip = zipFiles(vaultBytes(app, `${OUT}/Marés e outros contos (pt-BR).docx`));
  const doc = zip.text("word/document.xml");
  expect(doc).toContain("Marés e outros contos");
  for (const title of ["Maré", "O farol apagado", "Sal"]) expect(doc).toContain(`>${title}<`);
  expect(doc).not.toMatch(/Capítulo \d/);
  expect(doc.match(/<w:pageBreakBefore\/>/g)?.length).toBe(3);
  expect(doc.indexOf(">Maré<")).toBeLessThan(doc.indexOf(">O farol apagado<"));
  expect(doc.indexOf(">O farol apagado<")).toBeLessThan(doc.indexOf(">Sal<"));
  expect(doc).toContain(">FIM<");
  expect(doc).toMatch(/<w:titlePg\/>/); // the first page has its own, empty header: the running header starts on page 2
  expect(zip.text("word/header1.xml")).toContain("PAGE");
  expect(doc).toMatch(/cerca de|aproximadamente|palavras/i);
  test.info().annotations.push({ type: "by eye", description: "open the .docx in LibreOffice or Word; the '#' between scenes needs a conto with a scene break" });
});

test("8. EPUB: the contents lists the three contos, each on its own page under its title", async () => {
  await openExport(app, COLL);
  await chip(app, "EPUB");
  await chip(app, "pt-BR");
  await runExport(app);
  await app.notice("Exportado: Marés e outros contos (pt-BR).epub.");
  const zip = zipFiles(vaultBytes(app, `${OUT}/Marés e outros contos (pt-BR).epub`));
  const nav = zip.text("OEBPS/nav.xhtml");
  const labels = [...nav.matchAll(/<li><a href="[^"]+">([^<]+)<\/a><\/li>/g)].map((m) => m[1]);
  expect(labels).toEqual(expect.arrayContaining(["Maré", "O farol apagado", "Sal"]));
  expect(nav).toContain("<h1>Sumário</h1>");
  const pages = zip.names.filter((n) => /\.xhtml$/.test(n) && !/nav|title|cover/.test(n));
  expect(pages).toHaveLength(3);
  expect(zip.text(pages[0])).toContain("A maré subiu cedo.");
});

test("9. a dedication and a cover on the collection note come into the EPUB", async () => {
  await setProperty(app, COLL, "dedication", "[[Dedicatória 0.9]]");
  await setProperty(app, COLL, "cover", "[[capa-teste.jpg]]");
  await openExport(app, COLL);
  await chip(app, "EPUB");
  await chip(app, "pt-BR");
  await runExport(app, "Substituir");
  await app.notice("Exportado:");
  const zip = zipFiles(vaultBytes(app, `${OUT}/Marés e outros contos (pt-BR).epub`));
  expect(zip.text("OEBPS/content.opf")).toContain('properties="cover-image"');
  const all = zip.names.filter((n) => n.endsWith(".xhtml")).map((n) => zip.text(n)).join("\n");
  expect(all).toContain("Para quem lê até o fim.");
});

test("10. edge case: a dangling link warns, the button says anyway, the real contos export", async () => {
  await setProperty(app, COLL, "contents", ["[[Maré]]", "[[O farol apagado]]", "[[Sal]]", "[[Conto que não existe]]"]);
  await openExport(app, COLL);
  await chip(app, "EPUB");
  await expect(modal().locator(".escrita-export-field").filter({ hasText: "Coleção: 3 contos" })).toBeVisible();
  await expect(modal().locator(".escrita-export-warn")).toContainText("Conto não encontrado: [[Conto que não existe]]. Fica de fora."); // the doc omits the brackets the warning shows
  await expect(primary(app)).toHaveText("Exportar mesmo assim");
  await snap(app, "10. dangling link", modal());
  await runExport(app, "Substituir");
  await app.notice("Exportado:");
  const zip = zipFiles(vaultBytes(app, `${OUT}/Marés e outros contos (pt-BR).epub`));
  const labels = [...zip.text("OEBPS/nav.xhtml").matchAll(/<li><a href="[^"]+">([^<]+)<\/a><\/li>/g)].map((m) => m[1]);
  expect(labels.filter((l) => ["Maré", "O farol apagado", "Sal"].includes(l))).toHaveLength(3);
  expect(labels).not.toContain("Conto que não existe");
});

const storyLabels = (name: string) => {
  const zip = zipFiles(vaultBytes(app, `${OUT}/${name}`));
  return [...zip.text("OEBPS/nav.xhtml").matchAll(/<li><a href="[^"]+">([^<]+)<\/a><\/li>/g)].map((m) => m[1]).filter((l) => ["Maré", "O farol apagado", "Sal"].includes(l));
};

test("11. edge case: a reordered list puts Sal first in the file", async () => {
  await setProperty(app, COLL, "contents", ["[[Sal]]", "[[Maré]]", "[[O farol apagado]]"]);
  await openExport(app, COLL);
  await chip(app, "EPUB");
  await expect(modal().locator(".escrita-export-warn")).toHaveCount(0);
  await runExport(app, "Substituir");
  await app.notice("Exportado:");
  expect(storyLabels("Marés e outros contos (pt-BR).epub")).toEqual(["Sal", "Maré", "O farol apagado"]);
});

test("12. Escolher… with Maré unticked: 2 de 3 escolhidos, two contos in the file", async () => {
  await openExport(app, COLL);
  await chip(app, "EPUB");
  await modal().locator(".escrita-export-radio", { hasText: "Escolher…" }).click();
  const picker = app.page.locator(".modal.escrita-export-picker");
  await expect(picker).toBeVisible();
  await picker.locator("label.escrita-export-pick", { hasText: "Maré" }).locator("input").uncheck();
  await picker.getByRole("button", { name: "OK" }).click();
  await expect(modal().locator(".escrita-export-radio", { hasText: "Escolher…" })).toContainText("2 de 3 escolhidos");
  await buildSettled(app);
  await runExport(app, "Substituir");
  await app.notice("Exportado:");
  expect(storyLabels("Marés e outros contos (pt-BR).epub")).toEqual(["Sal", "O farol apagado"]);
});

test("13. Do … ao …: the range counts in the contents order, not by file names", async () => {
  await openExport(app, COLL);
  await chip(app, "EPUB");
  await modal().locator(".escrita-export-range label.escrita-export-radio").click();
  await modal().locator("input[aria-label='Do capítulo']").fill("2");
  await modal().locator("input[aria-label='Do capítulo']").dispatchEvent("change");
  await modal().locator("input[aria-label='Ao capítulo']").fill("3");
  await modal().locator("input[aria-label='Ao capítulo']").dispatchEvent("change");
  await buildSettled(app);
  await runExport(app, "Substituir");
  await app.notice("Exportado:");
  expect(storyLabels("Marés e outros contos (pt-BR).epub")).toEqual(["Maré", "O farol apagado"]);
  await openExport(app, COLL);
  await modal().locator(".escrita-export-radio", { hasText: /^Todos/ }).click();
  await buildSettled(app);
});

test("14. renaming a conto updates the link in contents; the collection still exports three", async () => {
  // a fresh vault does not rewrite links on rename (Settings, Files and links); the author's does
  await app.page.evaluate(() => { app.vault.setConfig("alwaysUpdateLinks", true); });
  // renameFile is Obsidian's own (it updates the links); the promise is not awaited in the page
  await app.page.evaluate(([from, to]) => { void app.fileManager.renameFile(app.vault.getFileByPath(from), to); }, [SAL, `${DIR}/Sal grosso.md`]);
  await app.waitFor("the file renamed", () => app.vaultFileExists(`${DIR}/Sal grosso.md`));
  await app.waitFor("the link follows", () => app.readVaultFile(COLL).includes("[[Sal grosso]]"));
  expect(app.readVaultFile(COLL)).not.toContain("[[Sal]]");
  await openExport(app, COLL);
  await chip(app, "EPUB");
  await expect(modal().locator(".escrita-export-field").filter({ hasText: "Coleção: 3 contos" })).toBeVisible();
  await expect(modal().locator(".escrita-export-warn")).toHaveCount(0);
  await expect(modal().locator(".escrita-export-radio").first()).toContainText("Todos (3)");
});
