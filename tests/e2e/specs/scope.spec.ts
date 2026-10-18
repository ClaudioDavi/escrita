// docs/TEST-0.9.md, "Scope and no-regression checks" (IMPROVEMENTS 9 moved scope into the
// classifier; nothing should look different), steps 1 to 8. "As before" is read from the
// first test: the explorer's counts and dots are recorded then and compared at the end.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { revealInExplorer, setProperty } from "../lib/export-ui";

import { round, Trace } from "../lib/measure";
import { showUniverseTab, sleep, snap } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 90_000 });

const WILLIAN = "Universo/Personagens/Willian.md";
const MARE = "Contos/Teste 0.9/Maré.md";
const NOITE = "Textos/Noite.md";
let ob: App;
let explorerBefore: Record<string, string[]> = {};

test.beforeAll(async () => {
  ob = await App.launch({ vault: world09({ chapters: 6 }) });
  installWorld09Extras(ob.vaultDir);
  await configureWorld09(ob);
});
test.afterAll(async () => { await ob?.close(); });
test.afterEach(async () => { await ob.closeModals(); await ob.dismissNotices(); });

const workNames = async () => (await ob.page.locator(".escrita-universe-work-name").allTextContents()).sort();
const rename = (from: string, to: string) => ob.page.evaluate(([a, b]) => { void app.fileManager.renameFile(app.vault.getAbstractFileByPath(a), b); }, [from, to] as const);
/** What the explorer's decorations say for some rows: the text of each owned span, in order. */
const explorerDecorations = (paths: string[]) => ob.page.evaluate((ps) => {
  const out: Record<string, string[]> = {};
  for (const p of ps) {
    const row = document.querySelector(`.nav-file-title[data-path="${p}"], .nav-folder-title[data-path="${p}"]`);
    out[p] = row ? [...row.querySelectorAll("[data-escrita-deco]")].map((s) => `${s.getAttribute("data-escrita-deco")}:${(s.textContent ?? "").trim()}:${(s as HTMLElement).className}`) : ["(no row)"];
  }
  return out;
}, paths);
const EXPLORER_PATHS = [MARE, "Contos/Teste 0.9/O farol apagado.md", "Contos/Teste 0.9/Sal.md", "Romances/Teste 0.9/Livro Teste.md", "Contos/Teste 0.9"];

test("1. Willian in Live Preview: three works, and Maré is not one of them", async () => {
  await ob.openFile(WILLIAN);
  const wrap = ob.page.locator(".escrita-ai-wrap");
  await expect(wrap).toHaveCount(1, { timeout: 20_000 });
  await expect(wrap.locator(".escrita-ai-summary")).toContainText("3 obras", { timeout: 20_000 });
  await wrap.locator("button.escrita-ai-head").click();
  const works = wrap.locator(".escrita-ai-row.is-work .escrita-ai-name");
  await expect(works).toHaveCount(3);
  expect((await works.allTextContents()).sort()).toEqual(["Livro Longo", "O farol apagado", "Sal"]);
  await expect(wrap.locator(".escrita-ai-row.is-chapter")).toContainText(["03"]);
  await expect(wrap).not.toContainText("Maré");
  await snap(ob, "1. Appears in, Willian", wrap);
  await wrap.locator("button.escrita-ai-head").click(); // back to collapsed
  // the explorer, recorded for step 7
  await revealInExplorer(ob, EXPLORER_PATHS.slice(0, 4));
  await sleep(1500);
  explorerBefore = await explorerDecorations(EXPLORER_PATHS);
  expect(explorerBefore[MARE].length).toBeGreaterThan(0);
});

test("2. the Obras tab lists the test contos and the books; Noite is not there", async () => {
  await showUniverseTab(ob, "Obras");
  await expect.poll(workNames, { timeout: 20_000 }).toEqual(expect.arrayContaining(["Maré", "O farol apagado", "Sal", "Livro Teste", "Livro Vazio"]));
  expect(await workNames()).not.toContain("Noite");
  // TEST-0.9 expects "the two test books", but its generator gives Livro Longo's note no status, and a
  // book is a work only with a known stage (Works tab: WorkInfo.stage). Livro Vazio has one. Not a regression.
  expect(await workNames()).not.toContain("Livro Longo");
  await snap(ob, "2. Obras tab", ob.page.locator(".escrita-universe-body"));
});

test("3. removing universe: false from Noite brings it to Obras without a restart; putting it back removes it", async () => {
  await setProperty(ob, NOITE, "universe", null);
  await expect.poll(workNames, { timeout: 20_000 }).toContain("Noite");
  await setProperty(ob, NOITE, "universe", false);
  await expect.poll(workNames, { timeout: 20_000 }).not.toContain("Noite");
});

test("4. a conto moved to a tracked folder outside the universe leaves Obras; Willian's counts stay", async () => {
  await ob.openFile(WILLIAN);
  const summary = ob.page.locator(".escrita-ai-wrap .escrita-ai-summary");
  const before = await summary.innerText();
  await ob.page.evaluate(async () => { if (!app.vault.getAbstractFileByPath("Ideias")) await app.vault.createFolder("Ideias"); });
  await rename(MARE, "Ideias/Maré.md");
  await ob.waitFor("moved", () => ob.vaultFileExists("Ideias/Maré.md"));
  await showUniverseTab(ob, "Obras");
  await expect.poll(workNames, { timeout: 20_000 }).not.toContain("Maré");
  await ob.openFile(WILLIAN);
  await expect(summary).toHaveText(before);
  await rename("Ideias/Maré.md", MARE);
  await ob.waitFor("moved back", () => ob.vaultFileExists(MARE));
  await showUniverseTab(ob, "Obras");
  await expect.poll(workNames, { timeout: 20_000 }).toContain("Maré");
});

test("5. folders in the universe: taking Textos out and putting it back updates Obras each time, with no freeze", async () => {
  await showUniverseTab(ob, "Obras");
  await expect.poll(workNames, { timeout: 20_000 }).toContain("Sobre o mar");
  await ob.observeLongTasks();
  // how many bursts of DOM changes the list goes through (one change = one burst, 300 ms apart or more)
  await ob.page.evaluate(() => {
    const w = window as any;
    w.__bursts = 0; let last = 0;
    w.__mo?.disconnect();
    w.__mo = new MutationObserver(() => { const now = performance.now(); if (now - last > 300) w.__bursts++; last = now; });
    w.__mo.observe(document.querySelector(".escrita-universe-body")!.parentElement!, { childList: true, subtree: true });
  });
  const bursts = () => ob.page.evaluate(() => (window as any).__bursts as number);
  await ob.setSettings({ defaultUniverseFolders: "Contos\nRomances" });
  await expect.poll(workNames, { timeout: 20_000 }).not.toContain("Sobre o mar");
  await sleep(1200);
  const out = await bursts();
  await ob.setSettings({ defaultUniverseFolders: "Contos\nRomances\nTextos" });
  await expect.poll(workNames, { timeout: 20_000 }).toContain("Sobre o mar");
  await sleep(1200);
  const back = (await bursts()) - out;
  test.info().annotations.push({ type: "redraw bursts", description: `taking Textos out: ${out}; putting it back: ${back}` });
  expect(out).toBeLessThanOrEqual(2);
  expect(back).toBeLessThanOrEqual(2);
  expect(await ob.longTasks()).toEqual([]);
});

test("6. the outline of Livro Teste: the POV chip's menu has Abrir a entrada", async () => {
  await ob.openFile("Romances/Teste 0.9/Livro Teste.md");
  await ob.command("open-outline");
  const chip = ob.page.locator(".escrita-outline-chip", { hasText: "Willian" }).first();
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await chip.click({ button: "right" });
  const item = ob.page.locator(".escrita-outline-menu-item", { hasText: "Abrir a entrada" });
  await expect(item).toBeVisible();
  await snap(ob, "6. POV chip menu");
  await item.click();
  await ob.waitFor("Willian opens", async () => (await ob.activeFile()) === WILLIAN);
});

test("7. the explorer's counts and stage dots are what they were at the start", async () => {
  await revealInExplorer(ob, EXPLORER_PATHS.slice(0, 4));
  await sleep(1500);
  const now = await explorerDecorations(EXPLORER_PATHS);
  expect(now).toEqual(explorerBefore);
  test.info().annotations.push({ type: "by eye", description: "startup time feels the same (TEST-0.9 'Before you start' 3)" });
});

test("8. typing in a long chapter with the lens off: no long task, no lag", async () => {
  const chapter = "Romances/Teste 0.9/Livro Longo/Capítulos/03 O cais.md";
  await ob.openFile(chapter);
  await ob.waitFor("the chapter", async () => (await ob.activeFile()) === chapter);
  expect(await ob.page.locator(".escrita-lens-head").count()).toBe(0);
  await ob.page.locator(".cm-content").first().click();
  await ob.page.keyboard.press("Control+End");
  await ob.observeLongTasks();
  const trace = new Trace();
  const tracing = await trace.start(ob);
  const t0 = Date.now();
  await ob.page.keyboard.type("Depois ela ouviu o mar e esperou a maré subir de novo. ", { delay: 25 });
  const typedMs = Date.now() - t0;
  await sleep(300);
  const traced = tracing ? await trace.stop() : null;
  const long = await ob.longTasks();
  const text = await ob.page.evaluate(() => app.workspace.getLeavesOfType("markdown")[0].view.editor.getValue());
  expect(text).toContain("Depois ela ouviu o mar e esperou a maré subir de novo.");
  test.info().annotations.push({ type: "typing", description: `${typedMs} ms for 56 characters at 25 ms; longest task ${traced ? round(traced.longestMs) : "n/a"} ms; long tasks ${long.length}` });
  console.log(`SCOPE typing: ${typedMs} ms, longest task ${traced ? round(traced.longestMs) : "n/a"} ms, tasks over 20 ms ${traced?.over20 ?? "n/a"}, long tasks ${long.length}`);
  expect(long).toEqual([]);
});
