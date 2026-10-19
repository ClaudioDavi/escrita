// PLAN-1.2, "Sentence rhythm" (SF 16, board 47): the lens panel's Rhythm section on a conto with a
// paragraph of four sentences of similar length and one long one. The bars, the run label, the
// long-sentence line, a click on a bar selects that sentence and never changes the text; screenshots
// for the G2 review in light and dark.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { writer } from "../fixtures";
import { editorCursor, editorText, sleep, snap } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 90_000 });

const FILE = "Contos/Ritmo.md";
const S1 = "O vento entrou pela janela aberta da cozinha.";
const S2 = "A chaleira apitou duas vezes no fogão antigo.";
const S3 = "Ela deixou a xícara sobre a mesa de madeira.";
const S4 = "O cachorro dormia debaixo da cadeira velha.";
const LONG = "Quando finalmente se levantou para fechar a janela, depois de tanto tempo parada diante da chuva que caía sobre o telhado da casa vizinha e escorria pelas calhas enferrujadas até o quintal onde ninguém mais plantava nada desde que o velho morrera, ela percebeu que a noite já tinha chegado inteira.";
const PARA = [S1, S2, S3, S4, LONG].join(" ");
// a second paragraph with no run (the panel shows the run label or the long-sentence line, the run first)
const PARA2 = ["Ela riu.", "O cachorro latiu duas vezes seguidas no quintal vazio, sem motivo algum que ela pudesse ver.", "Nada.", LONG].join(" ");
const BODY = `---\nstatus: rascunho\n---\n\n${PARA}\n\n${PARA2}\n`;

let ob: App;
let original = "";

test.beforeAll(async () => {
  const vault = writer({ seeded: true });
  vault.files[FILE] = BODY;
  ob = await App.launch({ vault });
  await ob.setSettings({ trackFolders: "" });
  await ob.openFile(FILE);
  await ob.waitFor("the note", async () => (await ob.activeFile()) === FILE);
  await ob.page.locator(".workspace-leaf.mod-active .cm-content").waitFor();
  original = await editorText(ob);
  await ob.command("toggle-revision-lens");
  await expect(ob.page.locator(".escrita-lens-head")).toBeVisible();
  // the cursor in the paragraph
  await ob.page.evaluate((l) => {
    const leaf = app.workspace.getLeavesOfType("markdown").find((x: any) => x.view.file?.path === app.workspace.getActiveFile()?.path)!;
    (leaf.view as any).editor.setCursor({ line: l, ch: 10 });
  }, original.split("\n").findIndex((l) => l.startsWith(S1)));
});
test.afterAll(async () => { await ob?.close(); });

const section = () => ob.page.locator(".escrita-lens-rhythm");
const rows = () => ob.page.locator(".escrita-lens-rhythm-row");

test("1. the Rhythm section shows five bars, the long one flagged, with the run label", async () => {
  await expect(section()).toBeVisible({ timeout: 15_000 });
  await expect(rows()).toHaveCount(5);
  await expect(ob.page.locator(".escrita-lens-rhythm-row.is-long")).toHaveCount(1);
  await expect(ob.page.locator(".escrita-lens-rhythm-row.is-run")).not.toHaveCount(0);
  const note = await ob.page.locator(".escrita-lens-rhythm-note").allTextContents();
  expect(note.length).toBeGreaterThan(0);
  expect(note.join(" ")).toContain("4 frases de tamanho parecido");
});

test("1b. a paragraph with no run shows the long-sentence line with the limit", async () => {
  await ob.page.evaluate((l) => {
    (app.workspace.getLeavesOfType("markdown")[0].view as any).editor.setCursor({ line: l, ch: 3 });
  }, original.split("\n").findIndex((l) => l.startsWith("Ela riu.")));
  await expect(rows()).toHaveCount(4);
  await expect(ob.page.locator(".escrita-lens-rhythm-row.is-run")).toHaveCount(0);
  await expect(ob.page.locator(".escrita-lens-rhythm-note")).toContainText("45");
});

test("2. clicking a bar selects that sentence and leaves the text alone", async () => {
  await ob.page.evaluate((l) => {
    (app.workspace.getLeavesOfType("markdown")[0].view as any).editor.setCursor({ line: l, ch: 10 });
  }, original.split("\n").findIndex((l) => l.startsWith(S1)));
  await expect(rows()).toHaveCount(5);
  await rows().nth(1).click();
  await ob.waitFor("the selection", async () => (await ob.page.evaluate(() => {
    const leaf = app.workspace.getLeavesOfType("markdown")[0];
    return (leaf.view as any).editor.getSelection();
  })) === S2);
  expect(await editorText(ob)).toBe(original);
  await rows().nth(4).click();
  await ob.waitFor("the long selection", async () => (await ob.page.evaluate(() => (app.workspace.getLeavesOfType("markdown")[0].view as any).editor.getSelection())) === LONG);
  expect(await editorText(ob)).toBe(original);
  expect(await ob.readVaultFile(FILE)).toBe(BODY);
});

test("2b. stepping through a rule keeps its row where it was, though the panel redraws (1.2.1)", async () => {
  // a short window, so the panel scrolls and the rule rows sit below the Rhythm section
  await ob.page.setViewportSize({ width: 1280, height: 560 });
  try {
    await ob.page.evaluate((l) => {
      (app.workspace.getLeavesOfType("markdown")[0].view as any).editor.setCursor({ line: l, ch: 10 });
    }, original.split("\n").findIndex((l) => l.startsWith(S1)));
    await expect(rows()).toHaveCount(5);
    const row = ob.page.locator(".escrita-lens-row").filter({ has: ob.page.locator(".escrita-lens-step:not([disabled])") }).first();
    const next = row.locator(".escrita-lens-step").nth(1);
    await next.scrollIntoViewIfNeeded();
    const scrolled = await ob.page.locator(".escrita-lens").evaluate((el) => el.scrollTop);
    expect(scrolled, "the panel is scrolled to reach the row").toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) {
      const before = (await next.boundingBox())!.y;
      await next.click();
      await sleep(400); // the selection moves, the panel redraws
      const after = (await next.boundingBox())!.y;
      expect(Math.abs(after - before), `step ${i + 1}: the button stays under the pointer`).toBeLessThan(3);
    }
    expect(await editorText(ob)).toBe(original);
  } finally {
    await ob.page.setViewportSize({ width: 1280, height: 800 });
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`3. screenshots for G2, ${theme}`, async () => {
    await ob.setTheme(theme);
    await ob.page.evaluate((l) => {
      (app.workspace.getLeavesOfType("markdown")[0].view as any).editor.setCursor({ line: l, ch: 10 });
    }, original.split("\n").findIndex((l) => l.startsWith(S1)));
    await expect(rows()).toHaveCount(5);
    await sleep(500);
    await snap(ob, `the lens panel with the Rhythm section, ${theme}`, section());
    await ob.page.evaluate((l) => {
      (app.workspace.getLeavesOfType("markdown")[0].view as any).editor.setCursor({ line: l, ch: 3 });
    }, original.split("\n").findIndex((l) => l.startsWith("Ela riu.")));
    await expect(rows()).toHaveCount(4);
    await sleep(500);
    await snap(ob, `the Rhythm section with the long-sentence line, ${theme}`, section());
    await ob.page.evaluate((l) => {
      (app.workspace.getLeavesOfType("markdown")[0].view as any).editor.setCursor({ line: l, ch: 10 });
    }, original.split("\n").findIndex((l) => l.startsWith(S1)));
    await expect(rows()).toHaveCount(5);
    await snap(ob, `the lens panel, ${theme}`, ob.page.locator(".escrita-lens-head").locator("xpath=ancestor::*[contains(@class,'workspace-leaf-content')][1]"));
    await snap(ob, `the window, ${theme}`);
  });
}
