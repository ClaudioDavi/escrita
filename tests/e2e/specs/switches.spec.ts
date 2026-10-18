// docs/TEST-0.9.md, "Feature switches on and off": each switch off, check, on again, check that
// nothing was lost; and the two renames made while a feature is off. The switches are set the way
// the Features page sets them (settings.features, saved); the universe is a mode.
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { chip, exportModal, openExport, runExport, setProperty } from "../lib/export-ui";
import { showUniverseTab, sleep, snap } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 90_000 });

const FAROL = "Contos/Teste 0.9/O farol apagado.md";
const MARE = "Contos/Teste 0.9/Maré.md";
const BOOK = "Romances/Teste 0.9/Livro Longo.md";
const CH = (n: string) => `Romances/Teste 0.9/Livro Longo/Capítulos/${n}.md`;
let ob: App;

test.beforeAll(async () => {
  ob = await App.launch({ vault: world09({ chapters: 6 }) });
  installWorld09Extras(ob.vaultDir);
  await configureWorld09(ob);
  await ob.waitFor("the metadata cache", () => ob.page.evaluate((p) => app.metadataCache.getCache(p)?.frontmatter?.compile === false, CH("31 Notas soltas")), 30_000);
});
test.afterAll(async () => { await ob?.close(); });
test.afterEach(async () => { await ob.closeModals(); await ob.dismissNotices(); });

/** Whether a command is in the palette, with a note open and in front (most check the active note). */
const listed = async (id: string, note = FAROL) => {
  await ob.openFile(note);
  return ob.commandListed(id);
};
const leaves = (type: string) => ob.page.evaluate((t) => app.workspace.getLeavesOfType(t).length, type);
/** The lens panel open with the lens on for the open note. */
async function lensShown(): Promise<void> {
  await ob.command("toggle-revision-lens");
  const turnOn = ob.page.locator(".escrita-lens").getByRole("button", { name: "Ligar" });
  await ob.page.locator(".escrita-lens-head").waitFor({ state: "visible" });
  if (await turnOn.count()) await turnOn.click();
}
const settingsText = () => ob.openSettings().then(async (t) => { await ob.closeModals(); return t; });

test("lens off: no lens, no names rule, Não são nomes gone from the settings; on again: all kept", async () => {
  await ob.setSettings({ lensRulesOn: ["newName"], notNames: "Natal" });
  await ob.openFile(FAROL);
  await ob.command("toggle-revision-lens");
  await expect(ob.page.locator(".escrita-lens-head")).toBeVisible();
  await expect.poll(() => ob.page.locator(".cm-content .escrita-lens-newName >> visible=true").count(), { timeout: 20_000 }).toBeGreaterThan(0);
  expect(await settingsText()).toContain("Não são nomes");

  await ob.setFeature("lens", false);
  await expect.poll(() => listed("toggle-revision-lens"), { timeout: 10_000 }).toBe(false);
  expect(await leaves("escrita-lens")).toBe(0);
  await expect(ob.page.locator(".cm-content .escrita-lens-newName >> visible=true")).toHaveCount(0);
  expect(await settingsText()).not.toContain("Não são nomes");
  await snap(ob, "lens off");

  await ob.setFeature("lens", true);
  await expect.poll(() => listed("toggle-revision-lens"), { timeout: 10_000 }).toBe(true);
  expect(await ob.setting("lensRulesOn")).toEqual(["newName"]);
  expect(await ob.setting("notNames")).toBe("Natal");
  expect(await settingsText()).toContain("Não são nomes");
  await ob.command("toggle-revision-lens");
  await expect.poll(() => ob.page.locator(".cm-content .escrita-lens-newName >> visible=true").count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await ob.command("toggle-revision-lens");
});

test("universe off: no panel, no unlinked section, the names rule asks for the universe; on again: all back", async () => {
  await ob.openFile(FAROL);
  await showUniverseTab(ob, "Obras");
  await expect(ob.page.locator(".escrita-unlinked .escrita-unlinked-row").first()).toBeVisible({ timeout: 20_000 });

  await ob.setSettings({ universeMode: "off" });
  await expect.poll(() => listed("open-universe"), { timeout: 10_000 }).toBe(false);
  expect(await leaves("escrita-universe")).toBe(0);
  await expect(ob.page.locator(".escrita-unlinked")).toHaveCount(0);
  await lensShown();
  await expect(ob.page.locator(".escrita-lens-row-wait", { hasText: "Nomes sem entrada" })).toContainText("Precisa do universo ligado.");

  await ob.setSettings({ universeMode: "universe" });
  await expect.poll(() => listed("open-universe"), { timeout: 10_000 }).toBe(true);
  await showUniverseTab(ob, "Obras");
  await expect(ob.page.locator(".escrita-unlinked .escrita-unlinked-row").first()).toBeVisible({ timeout: 20_000 });
  await ob.command("toggle-revision-lens");
});

test("export off: no export commands, no collection item; the collection stays a note; on again: Export again writes the same file", async () => {
  // an EPUB of a conto, and a collection note written by hand
  await openExport(ob, MARE);
  await chip(ob, "EPUB");
  await chip(ob, "pt-BR");
  await runExport(ob);
  await ob.notice("Exportado: Maré (pt-BR).epub.");
  const file = "Escrita/Exportações/Maré (pt-BR).epub";
  expect(ob.vaultFileExists(file)).toBe(true);
  ob.writeVaultFile("Contos/Teste 0.9/Coleção.md", '---\ncontents:\n  - "[[Maré]]"\n  - "[[Sal]]"\n---\n');
  await ob.waitFor("the collection note", () => ob.page.evaluate(() => !!app.vault.getFileByPath("Contos/Teste 0.9/Coleção.md")));
  expect(await ob.page.evaluate(() => app.plugins.plugins.escrita.settings.features.export)).not.toBe(false);

  await ob.setFeature("export", false);
  await ob.openFile(MARE);
  await expect.poll(() => listed("export", MARE), { timeout: 10_000 }).toBe(false);
  expect(await listed("export-again", MARE)).toBe(false);
  await ob.page.evaluate((ps) => {
    const v = app.workspace.getLeavesOfType("file-explorer")[0].view;
    for (const p of ps) v.revealInFolder(app.vault.getFileByPath(p));
    v.tree.clearSelectedDoms();
    for (const p of ps) v.tree.selectItem(v.fileItems[p]);
  }, [MARE, "Contos/Teste 0.9/Sal.md"]);
  await ob.page.locator('.nav-file-title[data-path="Contos/Teste 0.9/Sal.md"]').click({ button: "right" });
  await ob.page.locator(".menu").first().waitFor({ state: "visible" });
  expect(await ob.page.locator(".menu .menu-item-title").allTextContents()).not.toContain("Criar uma coleção…");
  await ob.page.keyboard.press("Escape");
  await ob.openFile("Contos/Teste 0.9/Coleção.md");
  expect(await listed("export", "Contos/Teste 0.9/Coleção.md")).toBe(false);
  expect(await ob.bookOf("Contos/Teste 0.9/Coleção.md")).toEqual({ isBook: false, chapters: 0 });

  // rename the exported work while the feature is off
  await ob.page.evaluate(() => { void app.fileManager.renameFile(app.vault.getFileByPath("Contos/Teste 0.9/Maré.md"), "Contos/Teste 0.9/Maré alta.md"); });
  await ob.waitFor("renamed", () => ob.vaultFileExists("Contos/Teste 0.9/Maré alta.md"));

  await ob.setFeature("export", true);
  await expect.poll(() => listed("export", "Contos/Teste 0.9/Coleção.md"), { timeout: 10_000 }).toBe(true); // the collection exports again
  await expect.poll(() => listed("export-again", "Contos/Teste 0.9/Maré alta.md"), { timeout: 10_000 }).toBe(true);
  const keys = await ob.page.evaluate(() => Object.keys(app.plugins.plugins.escrita.data.exportChoices));
  expect(keys).toContain("Contos/Teste 0.9/Maré alta.md");
  expect(keys).not.toContain(MARE);
  await openExport(ob, "Contos/Teste 0.9/Maré alta.md");
  await expect(exportModal(ob).locator(".escrita-export-last")).toContainText("Última exportação: EPUB · pt-BR");
  await ob.closeModals();
  const before = fs.statSync(path.join(ob.vaultDir, file)).mtimeMs;
  await sleep(1100);
  await ob.command("export-again");
  await ob.notice("Exportado");
  expect(fs.statSync(path.join(ob.vaultDir, file)).mtimeMs).toBeGreaterThan(before);
  expect(ob.listVaultFolder("Escrita/Exportações").filter((n) => n.startsWith("Maré"))).toEqual(["Maré (pt-BR).epub"]);
});

test("export switch text: the Features page describes DOCX, EPUB and Markdown for a note, a book or a collection", async () => {
  expect(await settingsText()).toContain("DOCX, EPUB e Markdown no formato de manuscrito, para uma nota, um livro ou uma coleção.");
});

test("publish check off: no serial line, no Publicar o próximo, no command; on again: the line and the button come back", async () => {
  await setProperty(ob, CH("01 A chegada"), "status", "publicado");
  await setProperty(ob, CH("01 A chegada"), "date", "2026-10-01");
  await ob.openFile(BOOK);
  await ob.command("open-outline");
  const serial = ob.page.locator(".escrita-outline-serial");
  await expect(serial).toContainText("Próximo: 02 A carta", { timeout: 15_000 });
  await expect(ob.page.locator(".escrita-outline-action", { hasText: "Publicar o próximo" })).toBeVisible();

  await ob.setFeature("publish", false);
  await expect.poll(() => listed("publish-next-chapter", BOOK), { timeout: 10_000 }).toBe(false);
  await expect(ob.page.locator(".escrita-outline-action", { hasText: "Publicar o próximo" })).toHaveCount(0);
  await expect(ob.page.locator(".escrita-outline-serial:not(.is-hidden)")).toHaveCount(0);

  await ob.setFeature("publish", true);
  await expect.poll(() => listed("publish-next-chapter", BOOK), { timeout: 10_000 }).toBe(true);
  await ob.openFile(BOOK);
  await ob.command("open-outline");
  await expect(ob.page.locator(".escrita-outline-serial")).toContainText("Próximo: 02 A carta", { timeout: 15_000 });
  await expect(ob.page.locator(".escrita-outline-action", { hasText: "Publicar o próximo" })).toBeVisible();
});

test("outline off: no Ler o livro, the reading tab closes; a chapter renamed meanwhile; on again: it opens at the saved place", async () => {
  const c04 = CH("04 A escada");
  const renamed = CH("04 A escada nova");
  await ob.openFile(BOOK);
  await ob.command("read-book");
  const section = (p: string) => ob.page.locator(`.escrita-reader-chapter[data-path="${p}"]`);
  await expect(section(c04)).toBeAttached({ timeout: 15_000 });
  await sleep(700); // the view ignores scrolls for a moment after it is built (the restore)
  for (let i = 0; i < 4; i++) {
    await ob.page.evaluate((p) => {
      const el = document.querySelector(".escrita-reader") as HTMLElement;
      const sec = el.querySelector(`.escrita-reader-chapter[data-path="${p}"]`) as HTMLElement;
      el.scrollTop = sec.offsetTop - ((el.querySelector(".escrita-reader-bar") as HTMLElement | null)?.offsetHeight ?? 0);
    }, c04);
    await sleep(250);
  }
  await sleep(1200); // the position is saved after the scroll settles
  expect((await ob.page.evaluate(() => app.plugins.plugins.escrita.data.readPosition))[BOOK].chapter).toBe(c04);

  await ob.setFeature("outline", false);
  await expect.poll(() => listed("read-book", BOOK), { timeout: 10_000 }).toBe(false);
  await expect.poll(() => leaves("escrita-reader"), { timeout: 10_000 }).toBe(0);

  await ob.page.evaluate(([a, b]) => { void app.fileManager.renameFile(app.vault.getFileByPath(a), b); }, [c04, renamed] as const);
  await ob.waitFor("renamed", () => ob.vaultFileExists(renamed));
  await ob.waitFor("the position follows", async () => (await ob.page.evaluate(() => app.plugins.plugins.escrita.data.readPosition))[BOOK]?.chapter === renamed, 5000);

  await ob.setFeature("outline", true);
  await expect.poll(() => listed("read-book", BOOK), { timeout: 10_000 }).toBe(true);
  await ob.openFile(BOOK);
  await ob.command("read-book");
  await expect(section(renamed)).toBeAttached({ timeout: 15_000 });
  await expect.poll(() => ob.page.evaluate(() => {
    const el = document.querySelector(".escrita-reader") as HTMLElement;
    const edge = el.getBoundingClientRect().top + ((el.querySelector(".escrita-reader-bar") as HTMLElement | null)?.offsetHeight ?? 0) + 1;
    for (const s of el.querySelectorAll<HTMLElement>(".escrita-reader-chapter")) if (s.getBoundingClientRect().bottom > edge) return s.dataset.path;
    return null;
  }), { timeout: 15_000 }).toBe(renamed);
});
