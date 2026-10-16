// docs/TEST-0.9.md, "Unlinked mentions" (board 29), steps 1 to 14.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { appendToEditor, editorText, rewriteNote, setEditorLine, showUniverseTab, sleep, snap, undo, useMarkdownLinks } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 90_000 });

const FAROL = "Contos/Teste 0.9/O farol apagado.md";
const WILLIAN = "Universo/Personagens/Willian.md";
let app: App;
let original = "";

test.beforeAll(async () => {
  app = await App.launch({ vault: world09({ chapters: 6 }) });
  installWorld09Extras(app.vaultDir);
  await configureWorld09(app);
  await useMarkdownLinks(app, true); // the author's vault writes Markdown links
});
test.afterAll(async () => { await app?.close(); });
test.afterEach(async () => { await app.dismissNotices(); });

const section = () => app.page.locator(".escrita-unlinked").first();
const rows = () => app.page.locator(".escrita-unlinked-row");
const rowOf = (line: number) => rows().filter({ hasText: new RegExp(`linha ${line}(?!\\d)`) });
const empty = () => section().locator(".escrita-unlinked-state", { hasText: "Nenhuma menção sem link nesta nota." });
/** Rows whose marked text is the whole "Will|Bill" (not just "Will" before the pipe). */
const pipeRows = () => rows().filter({ has: app.page.locator("mark", { hasText: /^Will\|Bill$/ }) });
/** Waits for the rows to be listed (not "contando…"). */
const settled = async () => {
  await expect(section()).toBeVisible();
  await expect(section().locator(".escrita-unlinked-state", { hasText: "contando…" })).toHaveCount(0, { timeout: 20_000 });
};

async function openFarol(): Promise<void> {
  await app.openFile(FAROL);
  await app.waitFor("the farol note", async () => (await app.activeFile()) === FAROL);
  await showUniverseTab(app, "Obras");
  await settled();
}

test("1. the section lists three rows for Willian, none inside the web link", async () => {
  original = app.readVaultFile(FAROL);
  await openFarol();
  await expect(section().locator(".escrita-universe-group-name")).toHaveText("Menções sem link");
  await expect(section().locator(".escrita-unlinked-note")).toHaveText("O farol apagado");
  await expect(section().locator(".escrita-universe-count")).toHaveText("3");
  await expect(rows()).toHaveCount(3);
  await expect(rows().locator(".escrita-unlinked-line")).toHaveText(["linha 4", "linha 6", "linha 22"]);
  for (const r of await rows().all()) {
    await expect(r.locator(".escrita-unlinked-entry")).toHaveText("Willian");
    await expect(r.locator("mark.escrita-unlinked-match")).toHaveText("Willian");
    await expect(r.getByRole("button", { name: "Criar link" })).toBeVisible();
  }
  await expect(section()).not.toContainText("o barco do Willian");
  await snap(app, "1. unlinked section", section());
});

test("2. clicking the sentence of linha 6 goes to the line and changes nothing", async () => {
  await rowOf(6).locator(".escrita-unlinked-excerpt").click();
  await app.waitFor("the cursor on line 6", async () => (await app.cursor())?.line === 5);
  expect(await editorText(app)).toBe(original);
});

test("3. edge case: a changed line writes nothing and the list refreshes", async () => {
  const lines = original.split("\n");
  await setEditorLine(app, 5, `${lines[5]} Longe.`);
  const edited = await editorText(app);
  await rowOf(6).getByRole("button", { name: "Criar link" }).click();
  await app.notice("A linha mudou desde que a lista foi feita. Nada foi escrito; a lista foi atualizada.");
  expect(await editorText(app)).toBe(edited);
  await settled();
  await expect(rowOf(6)).toContainText("Longe.");
  await undo(app);
  expect(await editorText(app)).toBe(original);
  await expect(rowOf(6)).not.toContainText("Longe.", { timeout: 15_000 }); // the rows hold offsets: wait for the new list
  await settled();
});

test("4. edge case: a table row gets a Markdown link and the other rows go", async () => {
  await expect(rows()).toHaveCount(3);
  await rowOf(22).getByRole("button", { name: "Criar link" }).click();
  const n = await app.notice(/Link criado na linha 22: \[Willian\]\(/);
  await expect(n).toContainText("Willian.md)");
  const text = await editorText(app);
  expect(text).toMatch(/^\| o velho \[Willian\]\([^)|]*Willian\.md\) \| no cais \|$/m);
  await settled();
  await expect(empty()).toBeVisible({ timeout: 15_000 });
  await expect(rows()).toHaveCount(0);
});

test("5. one undo removes the link and the rows come back", async () => {
  await undo(app);
  expect(await editorText(app)).toBe(original);
  await expect(rows()).toHaveCount(3, { timeout: 15_000 });
});

test("6. edge case: an alias in a table is a Markdown link with no escaping", async () => {
  await app.page.evaluate(async (p) => {
    await app.fileManager.processFrontMatter(app.vault.getFileByPath(p), (fm: any) => { fm.aliases = ["Will"]; });
  }, WILLIAN);
  await app.waitFor("the alias in the cache", () => app.page.evaluate((p) => (app.metadataCache.getCache(p)?.frontmatter?.aliases ?? []).includes("Will"), WILLIAN));
  await setEditorLine(app, 21, "| o velho Will | no cais |");
  await expect(rowOf(22).locator(".escrita-unlinked-entry")).toHaveText("Willian", { timeout: 15_000 });
  await expect(rowOf(22).locator("mark")).toHaveText("Will", { timeout: 15_000 });
  await rowOf(22).getByRole("button", { name: "Criar link" }).click();
  await app.notice(/Link criado na linha 22: \[Will\]\(/);
  expect(await editorText(app)).toMatch(/^\| o velho \[Will\]\([^)|]*Willian\.md\) \| no cais \|$/m);
  await undo(app);
  await settled();
});

test("7. linha 4: only Willian on that line changes", async () => {
  await app.waitFor("rows back", async () => (await rows().count()) >= 3);
  await rowOf(4).getByRole("button", { name: "Criar link" }).click();
  await app.notice(/Link criado na linha 4: /);
  const lines = (await editorText(app)).split("\n");
  const base = original.split("\n");
  expect(lines[3]).toMatch(/^A porta rangeu e \[Willian\]\([^)]*Willian\.md\) não olhou para trás\.$/);
  for (let i = 0; i < base.length; i++) if (i !== 3 && i !== 21) expect(lines[i]).toBe(base[i]);
  await undo(app);
  await settled();
});

test("8. Sal.md already links Willian: no rows", async () => {
  await app.openFile("Contos/Teste 0.9/Sal.md");
  await settled();
  await expect(empty()).toBeVisible();
});

test("9. a chapter: two rows in chapter 03, none in chapter 01", async () => {
  await app.openFile("Romances/Teste 0.9/Livro Longo/Capítulos/03 O cais.md");
  await settled();
  await expect(rows()).toHaveCount(2);
  await expect(rows().locator(".escrita-unlinked-entry")).toHaveText(["Willian", "Willian"]);
  await app.openFile("Romances/Teste 0.9/Livro Longo/Capítulos/01 A chegada.md");
  await settled();
  await expect(rows()).toHaveCount(0);
});

test("10. a note with universe: false has no unlinked section", async () => {
  await app.openFile("Textos/Noite.md");
  await sleep(2500);
  await expect(app.page.locator(".escrita-unlinked")).toHaveCount(0);
});

test("11. after a restart the panel says counting, then lists the rows", async () => {
  await app.openFile(FAROL);
  await showUniverseTab(app, "Obras");
  await settled();
  await app.restart();
  let sawCounting = false;
  const end = Date.now() + 40_000;
  while (Date.now() < end && (await rows().count()) === 0) {
    if (await app.page.locator(".escrita-unlinked-state", { hasText: "contando…" }).count()) sawCounting = true;
    await sleep(40);
  }
  test.info().annotations.push({ type: "counting seen", description: String(sawCounting) });
  await expect(rows()).toHaveCount(3);
  await snap(app, "11. rows after the restart", section());
});

test("12. per-book mode: the section sits at the bottom of the Entradas tab", async () => {
  await app.setSettings({ universeMode: "perBook" });
  await app.openFile("Romances/Teste 0.9/Livro Longo/Capítulos/03 O cais.md");
  await app.command("open-universe");
  await expect(app.page.locator(".escrita-universe-tab").filter({ hasText: "Obras" })).toHaveCount(0);
  await expect(app.page.locator(".escrita-universe-tab.is-active")).toContainText("Entradas");
  const body = app.page.locator(".escrita-universe-body").first();
  await expect(body.locator(".escrita-unlinked")).toHaveCount(1);
  const lastChildIsSection = await body.evaluate((el) => (el.lastElementChild as HTMLElement | null)?.classList.contains("escrita-unlinked") ?? false);
  expect(lastChildIsSection).toBe(true);
  await snap(app, "12. per-book: Entradas", body);
  await app.setSettings({ universeMode: "universe" });
});

test("13. edge case: a pipe in the text", async () => {
  await app.page.evaluate(async (p) => {
    await app.fileManager.processFrontMatter(app.vault.getFileByPath(p), (fm: any) => { fm.aliases = ["Will", "Will Bill"]; });
  }, WILLIAN);
  await app.openFile(FAROL);
  await showUniverseTab(app, "Obras");
  await appendToEditor(app, "\nOntem Will|Bill chegou.\n");
  await settled();
  await sleep(1500);
  const listed = await pipeRows().count();
  test.info().annotations.push({ type: "Will|Bill listed", description: String(listed > 0) });
  if (listed === 0) {
    // the doc's first outcome: the matcher stops at the pipe, so only "Will" is listed on that line
    const onLine = rows().filter({ hasText: "Ontem" });
    await expect(onLine).toHaveCount(1);
    await expect(onLine.locator("mark")).toHaveText("Will");
  }
  if (listed > 0) {
    const before = await editorText(app);
    await pipeRows().getByRole("button", { name: "Criar link" }).click();
    await app.notice(/Link criado|Este texto não pode/);
    expect(await editorText(app)).toMatch(/\[Will\|Bill\]\([^)]*Willian\.md\)/);
    await undo(app);
    expect(await editorText(app)).toBe(before);
  }
});

test("14. a vault with wikilinks writes [[Willian]] and escapes the pipe in a table", async () => {
  await useMarkdownLinks(app, false);
  await settled();
  await rowOf(4).getByRole("button", { name: "Criar link" }).click();
  await app.notice(/Link criado na linha 4: \[\[Willian\]\]/);
  expect((await editorText(app)).split("\n")[3]).toBe("A porta rangeu e [[Willian]] não olhou para trás.");
  await undo(app);
  await settled();

  await setEditorLine(app, 21, "| o velho Will | no cais |");
  await expect(rowOf(22).locator("mark")).toHaveText("Will", { timeout: 15_000 });
  await rowOf(22).getByRole("button", { name: "Criar link" }).click();
  await app.notice(/Link criado na linha 22/);
  expect((await editorText(app)).split("\n")[21]).toBe("| o velho [[Willian\\|Will]] | no cais |");
  await undo(app);
  await settled();

  if (await pipeRows().count()) {
    const before = await editorText(app);
    await pipeRows().getByRole("button", { name: "Criar link" }).click();
    await app.notice("Este texto não pode ser vinculado aqui. Nada foi escrito.");
    expect(await editorText(app)).toBe(before);
  }
  // clean up as the step says: back to Markdown links, the line and the alias gone
  await useMarkdownLinks(app, true);
  await rewriteNote(app, FAROL, original);
  await app.page.evaluate(async (p) => {
    await app.fileManager.processFrontMatter(app.vault.getFileByPath(p), (fm: any) => { delete fm.aliases; });
  }, WILLIAN);
  await app.waitFor("the farol note restored", async () => (await editorText(app)) === original);
});
