// PLAN-1.1 Q12, known issue 1: clicking a beat in the outline must put the editor's cursor on the
// beat's line, even when Obsidian would restore an older cursor for that note.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { emptyPt, type VaultSpec } from "../fixtures";

const FAR = "Livros/O farol/Capítulos/01 Chegada.md";
const OTHER = "Livros/O farol/Capítulos/02 A tempestade.md";

/** A chapter with 60 prose lines, then three beats at the end (lines 62, 66 and 70, 0-based). */
function fixture(): VaultSpec {
  const prose = Array.from({ length: 60 }, (_, i) => `Linha ${i + 1} da história.`).join("\n\n");
  const beats = ["a chegada", "a conversa", "a partida"].map((b) => `%% beat: ${b} %%\n\nTexto do beat ${b}.`).join("\n\n");
  const base = emptyPt({ seeded: true });
  return {
    ...base,
    files: {
      ...base.files,
      "Livros/O farol.md": "---\nstatus: rascunho\n---\n\nPremissa.\n",
      [FAR]: `${prose}\n\n${beats}\n`,
      [OTHER]: "%% beat: o vento vira %%\n",
    },
  };
}

test.describe("known issue 1: the beat click and the restored cursor", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;

  test.beforeAll(async () => {
    app = await App.launch({ vault: fixture() });
  });
  test.afterAll(async () => {
    await app?.close();
  });

  const setCursor = (line: number) => app.page.evaluate((l) => {
    const ed = window.app.workspace.activeEditor!.editor!;
    ed.setCursor({ line: l, ch: 0 });
    ed.scrollIntoView({ from: { line: l, ch: 0 }, to: { line: l, ch: 0 } }, true);
  }, line);

  const target = () => app.readVaultFile(FAR).split("\n").findIndex((l) => l.startsWith("%% beat: a partida"));

  async function clickBeat(): Promise<void> {
    await app.command("open-outline");
    const beat = app.page.locator(".escrita-outline-beat").filter({ hasText: "a partida" }).locator(".escrita-outline-letter");
    await expect(beat).toBeVisible();
    await beat.click();
    await app.waitFor("the chapter in the editor", async () => (await app.cursor())?.file === FAR);
    await new Promise((r) => setTimeout(r, 800)); // a late restore would show up now
  }

  async function expectOnBeat(): Promise<void> {
    const c = (await app.cursor())!;
    expect(target()).toBeGreaterThan(100);
    expect(c.line, `cursor on line ${c.line}: "${c.text}"`).toBe(target());
  }

  test("1. the chapter is open with the cursor near the top: the click moves the cursor to the beat", async () => {
    await app.openFile(FAR);
    await setCursor(2);
    await app.openFile(OTHER);
    await app.openFile(FAR);
    await setCursor(2);
    await app.screenshot("1. before the click");
    await clickBeat();
    await expectOnBeat();
    await app.screenshot("1. after the click");
  });

  test("2. the chapter was left and is open again by the leaf's history (Obsidian restores the old cursor)", async () => {
    await app.openFile(FAR);
    await setCursor(2);
    await app.openFile(OTHER);
    await app.page.evaluate(() => { void window.app.workspace.getLeaf(false).history.back(); });
    await app.waitFor("the chapter back", async () => (await app.cursor())?.file === FAR);
    await new Promise((r) => setTimeout(r, 500));
    // what Obsidian restored (recorded, not asserted: it is Obsidian's behavior)
    test.info().annotations.push({ type: "restored cursor line", description: String((await app.cursor())?.line) });
    await app.openFile(OTHER);
    await clickBeat();
    await expectOnBeat();
  });

  test("3. the chapter is open in a background tab with the cursor near the top", async () => {
    await app.openFile(FAR);
    await setCursor(2);
    await app.page.evaluate(async () => {
      const file = window.app.vault.getFileByPath("Livros/O farol/Capítulos/02 A tempestade.md")!;
      await window.app.workspace.getLeaf("tab").openFile(file, { active: true });
    });
    await clickBeat();
    await expectOnBeat();
  });
});
