// A new note gets the draft word in its status 1.5 s after it is created (draftNewNotes). Found by
// the 1.2 screenplay spec: the write read the file on disk while the editor still held unsaved
// typing, and replaced it (rule 1, never lose prose). The status is written after the editor is
// saved now; this types into a new conto across that moment and checks every word is still there.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { settle } from "../lib/more";
import { writer } from "../fixtures";

let ob: App;

test.beforeAll(async () => {
  ob = await App.launch({ vault: writer({ seeded: true }) });
  await ob.setSettings({ trackFolders: "Contos", draftNewNotes: true });
  await ob.dismissNotices();
});
test.afterAll(async () => { await ob?.close(); });

test("typing in a new note while its status is written loses nothing", async () => {
  test.setTimeout(60_000);
  await ob.page.evaluate(async () => {
    const file = await app.vault.create("Contos/Nova.md", "");
    await app.workspace.getLeaf(false).openFile(file, { active: true });
  });
  await ob.page.locator(".workspace-leaf.mod-active .cm-content").waitFor();
  await ob.page.evaluate(() => {
    const ed = app.workspace.activeEditor?.editor;
    ed?.focus();
    ed?.setCursor({ line: 0, ch: 0 });
  });
  // about 3.5 s of typing at 40 ms a key: the status write (1.5 s) lands in the middle
  const words = "A maré subiu devagar e ninguém viu o barco voltar sem o pescador naquela noite fria de julho no cais.";
  await ob.page.keyboard.type(words, { delay: 40 });
  await settle(2500);
  const text = await ob.page.evaluate(() => app.workspace.activeEditor?.editor?.getValue() ?? "");
  expect(text).toContain(words);
  expect(text).toMatch(/^status: rascunho$/m);
  // and on disk, once Obsidian has saved
  await ob.waitFor("the note saved with the status and the text", async () => {
    const disk = await ob.page.evaluate(() => app.vault.adapter.read("Contos/Nova.md"));
    return disk.includes(words) && /^status: rascunho$/m.test(disk);
  }, 10_000);
});
