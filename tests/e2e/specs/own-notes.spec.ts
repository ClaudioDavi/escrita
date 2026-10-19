// 1.2.1: Escrita's own notes are never works. In a freshly set-up empty vault (which tracks the
// whole vault), cutting a passage to darlings creates the darlings note; it gets no status
// property (the draft status is written 1.5 s after a note is created) and the home block lists
// no "Darlings" work. Also: a fresh install has smart typography on for every note.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { SetupModal } from "../lib/setup-modal";
import { emptyPt } from "../fixtures";

test.describe("1.2.1: darlings and word lists notes are never works", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  let ob: App;

  test.beforeAll(async () => {
    ob = await App.launch({ vault: emptyPt() });
  });
  test.afterAll(async () => {
    await ob?.close();
  });

  test("1. set up the empty vault; smart typography applies to every note by default", async () => {
    await ob.command("setup");
    const setup = new SetupModal(ob);
    await expect(setup.root).toBeVisible();
    await setup.button("Ver o que vou criar").click();
    await setup.button("Criar").click();
    await ob.notice("Pronto. Criei");
    await expect(setup.root).toHaveCount(0);
    expect(await ob.setting("typographyScope")).toBe("all");
    expect(await ob.setting("draftNewNotes")).toBe(true);
  });

  test("2. cut a passage to darlings: the note has no status and is no work", async () => {
    const conto = (await ob.page.evaluate(() => app.vault.getMarkdownFiles().map((f: { path: string }) => f.path))).find((p: string) => p.startsWith("Contos/"))!;
    expect(conto).toBeTruthy();
    await ob.openFile(conto);
    await ob.page.locator(".workspace-leaf.mod-active .cm-content").first().waitFor();
    await ob.page.evaluate(() => {
      const ed = app.workspace.activeEditor!.editor!;
      let line = 0;
      for (let i = 0; i < ed.lineCount(); i++) {
        const l = ed.getLine(i);
        if (l.length > 20 && !l.startsWith("%%") && !/^\w+:/.test(l)) { line = i; break; }
      }
      ed.setSelection({ line, ch: 0 }, { line, ch: ed.getLine(line).length });
      ed.focus();
    });
    expect(await ob.page.evaluate(() => app.workspace.activeEditor!.editor!.getSelection().length)).toBeGreaterThan(5);
    expect(await ob.command("move-selection-to-darlings")).toBe(true);
    const note = await ob.setting<string>("globalDarlingsNote");
    const text = await ob.waitForFile(note);
    expect(text.length).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 3500)); // past the draft status delay (1.5 s) and then some
    const after = ob.readVaultFile(note);
    expect(after).not.toMatch(/^status:/m);
    const props = await ob.page.evaluate((p) => app.metadataCache.getCache(p)?.frontmatter ?? null, note);
    expect(props?.status).toBeUndefined();
  });

  test("3. the home block lists no Darlings work", async () => {
    const home = await ob.setting<string>("homeNote");
    await ob.openFile(home);
    await ob.waitFor("the works block", async () => (await ob.page.locator(".escrita-desk-row").count()) >= 1, 15_000);
    await new Promise((r) => setTimeout(r, 1000));
    const titles = await ob.page.locator(".escrita-desk-row").allInnerTexts();
    expect(titles.join("\n")).not.toMatch(/Darlings/);
  });
});
