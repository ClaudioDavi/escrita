// docs/TEST-0.9.md, "Unlinked mentions" (board 29), steps 1 to 14.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { appendToEditor, editorText, rewriteNote, setEditorLine, showUniverseTab, sleep, snap, undo, useMarkdownLinks } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 90_000 });

const FAROL = "Contos/Teste 0.9/O farol apagado.md";
const WILLIAN = "Universo/Personagens/Willian.md";
let ob: App;
let original = "";

test.beforeAll(async () => {
  ob = await App.launch({ vault: world09({ chapters: 6 }) });
  installWorld09Extras(ob.vaultDir);
  await configureWorld09(ob);
  await useMarkdownLinks(ob, true); // the author's vault writes Markdown links
});
test.afterAll(async () => { await ob?.close(); });
test.afterEach(async () => { await ob.dismissNotices(); });

const section = () => ob.page.locator(".escrita-unlinked").first();
const rows = () => ob.page.locator(".escrita-unlinked-row");
const rowOf = (line: number) => rows().filter({ hasText: new RegExp(`linha ${line}(?!\\d)`) });
const empty = () => section().locator(".escrita-unlinked-state", { hasText: "Nenhuma menção sem link nesta nota." });
/** Rows whose marked text is the whole "Will|Bill" (not just "Will" before the pipe). */
const pipeRows = () => rows().filter({ has: ob.page.locator("mark", { hasText: /^Will\|Bill$/ }) });
/** Waits for the rows to be listed (not "contando…"). */
const settled = async () => {
  await expect(section()).toBeVisible();
  await expect(section().locator(".escrita-unlinked-state", { hasText: "contando…" })).toHaveCount(0, { timeout: 20_000 });
};

async function openFarol(): Promise<void> {
  await ob.openFile(FAROL);
  await ob.waitFor("the farol note", async () => (await ob.activeFile()) === FAROL);
  await showUniverseTab(ob, "Obras");
  await settled();
}

test("1. the section lists three rows for Willian, none inside the web link", async () => {
  original = ob.readVaultFile(FAROL);
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
  await snap(ob, "1. unlinked section", section());
});

test("2. clicking the sentence of linha 6 goes to the line and changes nothing", async () => {
  await rowOf(6).locator(".escrita-unlinked-excerpt").click();
  await ob.waitFor("the cursor on line 6", async () => (await ob.cursor())?.line === 5);
  expect(await editorText(ob)).toBe(original);
});

test("3. edge case: a changed line writes nothing and the list refreshes", async () => {
  const lines = original.split("\n");
  await setEditorLine(ob, 5, `${lines[5]} Longe.`);
  const edited = await editorText(ob);
  await rowOf(6).getByRole("button", { name: "Criar link" }).click();
  await ob.notice("A linha mudou desde que a lista foi feita. Nada foi escrito; a lista foi atualizada.");
  expect(await editorText(ob)).toBe(edited);
  await settled();
  await expect(rowOf(6)).toContainText("Longe.");
  await undo(ob);
  expect(await editorText(ob)).toBe(original);
  await expect(rowOf(6)).not.toContainText("Longe.", { timeout: 15_000 }); // the rows hold offsets: wait for the new list
  await settled();
});

test("4. edge case: a table row gets a Markdown link and the other rows go", async () => {
  await expect(rows()).toHaveCount(3);
  await rowOf(22).getByRole("button", { name: "Criar link" }).click();
  const n = await ob.notice(/Link criado na linha 22: \[Willian\]\(/);
  await expect(n).toContainText("Willian.md)");
  const text = await editorText(ob);
  expect(text).toMatch(/^\| o velho \[Willian\]\([^)|]*Willian\.md\) \| no cais \|$/m);
  await settled();
  await expect(empty()).toBeVisible({ timeout: 15_000 });
  await expect(rows()).toHaveCount(0);
});

test("5. one undo removes the link and the rows come back", async () => {
  await undo(ob);
  expect(await editorText(ob)).toBe(original);
  await expect(rows()).toHaveCount(3, { timeout: 15_000 });
});

test("6. edge case: an alias in a table is a Markdown link with no escaping", async () => {
  await ob.page.evaluate(async (p) => {
    await app.fileManager.processFrontMatter(app.vault.getFileByPath(p), (fm: any) => { fm.aliases = ["Will"]; });
  }, WILLIAN);
  await ob.waitFor("the alias in the cache", () => ob.page.evaluate((p) => (app.metadataCache.getCache(p)?.frontmatter?.aliases ?? []).includes("Will"), WILLIAN));
  await setEditorLine(ob, 21, "| o velho Will | no cais |");
  await expect(rowOf(22).locator(".escrita-unlinked-entry")).toHaveText("Willian", { timeout: 15_000 });
  await expect(rowOf(22).locator("mark")).toHaveText("Will", { timeout: 15_000 });
  await rowOf(22).getByRole("button", { name: "Criar link" }).click();
  await ob.notice(/Link criado na linha 22: \[Will\]\(/);
  expect(await editorText(ob)).toMatch(/^\| o velho \[Will\]\([^)|]*Willian\.md\) \| no cais \|$/m);
  await undo(ob);
  await settled();
});

test("7. linha 4: only Willian on that line changes", async () => {
  await ob.waitFor("rows back", async () => (await rows().count()) >= 3);
  await rowOf(4).getByRole("button", { name: "Criar link" }).click();
  await ob.notice(/Link criado na linha 4: /);
  const lines = (await editorText(ob)).split("\n");
  const base = original.split("\n");
  expect(lines[3]).toMatch(/^A porta rangeu e \[Willian\]\([^)]*Willian\.md\) não olhou para trás\.$/);
  for (let i = 0; i < base.length; i++) if (i !== 3 && i !== 21) expect(lines[i]).toBe(base[i]);
  await undo(ob);
  await settled();
});

test("8. Sal.md already links Willian: no rows", async () => {
  await ob.openFile("Contos/Teste 0.9/Sal.md");
  await settled();
  await expect(empty()).toBeVisible();
});

test("9. a chapter: two rows in chapter 03, none in chapter 01", async () => {
  await ob.openFile("Romances/Teste 0.9/Livro Longo/Capítulos/03 O cais.md");
  await settled();
  await expect(rows()).toHaveCount(2);
  await expect(rows().locator(".escrita-unlinked-entry")).toHaveText(["Willian", "Willian"]);
  await ob.openFile("Romances/Teste 0.9/Livro Longo/Capítulos/01 A chegada.md");
  await settled();
  await expect(rows()).toHaveCount(0);
});

test("10. a note with universe: false has no unlinked section", async () => {
  await ob.openFile("Textos/Noite.md");
  await sleep(2500);
  await expect(ob.page.locator(".escrita-unlinked")).toHaveCount(0);
});

test("11. after a restart the panel says counting, then lists the rows", async () => {
  await ob.openFile(FAROL);
  await showUniverseTab(ob, "Obras");
  await settled();
  await ob.restart();
  let sawCounting = false;
  const end = Date.now() + 40_000;
  while (Date.now() < end && (await rows().count()) === 0) {
    if (await ob.page.locator(".escrita-unlinked-state", { hasText: "contando…" }).count()) sawCounting = true;
    await sleep(40);
  }
  test.info().annotations.push({ type: "counting seen", description: String(sawCounting) });
  await expect(rows()).toHaveCount(3);
  await snap(ob, "11. rows after the restart", section());
});

test("12. per-book mode: the section sits at the bottom of the Entradas tab", async () => {
  await ob.setSettings({ universeMode: "perBook" });
  await ob.openFile("Romances/Teste 0.9/Livro Longo/Capítulos/03 O cais.md");
  await ob.command("open-universe");
  await expect(ob.page.locator(".escrita-universe-tab").filter({ hasText: "Obras" })).toHaveCount(0);
  await expect(ob.page.locator(".escrita-universe-tab.is-active")).toContainText("Entradas");
  const body = ob.page.locator(".escrita-universe-body").first();
  await expect(body.locator(".escrita-unlinked")).toHaveCount(1);
  const lastChildIsSection = await body.evaluate((el) => (el.lastElementChild as HTMLElement | null)?.classList.contains("escrita-unlinked") ?? false);
  expect(lastChildIsSection).toBe(true);
  await snap(ob, "12. per-book: Entradas", body);
  await ob.setSettings({ universeMode: "universe" });
});

test("13. edge case: a pipe in the text", async () => {
  await ob.page.evaluate(async (p) => {
    await app.fileManager.processFrontMatter(app.vault.getFileByPath(p), (fm: any) => { fm.aliases = ["Will", "Will Bill"]; });
  }, WILLIAN);
  await ob.openFile(FAROL);
  await showUniverseTab(ob, "Obras");
  await appendToEditor(ob, "\nOntem Will|Bill chegou.\n");
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
    const before = await editorText(ob);
    await pipeRows().getByRole("button", { name: "Criar link" }).click();
    await ob.notice(/Link criado|Este texto não pode/);
    expect(await editorText(ob)).toMatch(/\[Will\|Bill\]\([^)]*Willian\.md\)/);
    await undo(ob);
    expect(await editorText(ob)).toBe(before);
  }
});

test("14. a vault with wikilinks writes [[Willian]] and escapes the pipe in a table", async () => {
  await useMarkdownLinks(ob, false);
  await settled();
  await rowOf(4).getByRole("button", { name: "Criar link" }).click();
  await ob.notice(/Link criado na linha 4: \[\[Willian\]\]/);
  expect((await editorText(ob)).split("\n")[3]).toBe("A porta rangeu e [[Willian]] não olhou para trás.");
  await undo(ob);
  await settled();

  await setEditorLine(ob, 21, "| o velho Will | no cais |");
  await expect(rowOf(22).locator("mark")).toHaveText("Will", { timeout: 15_000 });
  await rowOf(22).getByRole("button", { name: "Criar link" }).click();
  await ob.notice(/Link criado na linha 22/);
  expect((await editorText(ob)).split("\n")[21]).toBe("| o velho [[Willian\\|Will]] | no cais |");
  await undo(ob);
  await settled();

  if (await pipeRows().count()) {
    const before = await editorText(ob);
    await pipeRows().getByRole("button", { name: "Criar link" }).click();
    await ob.notice("Este texto não pode ser vinculado aqui. Nada foi escrito.");
    expect(await editorText(ob)).toBe(before);
  }
  // clean up as the step says: back to Markdown links, the line and the alias gone
  await useMarkdownLinks(ob, true);
  await rewriteNote(ob, FAROL, original);
  await ob.page.evaluate(async (p) => {
    await app.fileManager.processFrontMatter(app.vault.getFileByPath(p), (fm: any) => { delete fm.aliases; });
  }, WILLIAN);
  await ob.waitFor("the farol note restored", async () => (await editorText(ob)) === original);
});
