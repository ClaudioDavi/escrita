// docs/PLAN-1.0.4.md, "By-hand checks" 1-9: starting a new work, in a Portuguese vault
// shaped like the author's (contos in Contos/, books in Livros/).
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { writer } from "../fixtures";

test.describe.configure({ mode: "serial", timeout: 90_000 });

let app: App;

test.beforeAll(async () => {
  app = await App.launch({ vault: writer({ seeded: true }) });
  await app.setSettings({ storiesFolder: "Contos", screenplaysFolder: "Roteiros", booksFolder: "Livros" });
});

test.afterAll(async () => {
  await app?.close();
});

test.afterEach(async () => {
  await app.closeModals();
  await app.dismissNotices();
});

const rows = () => app.page.locator(".prompt .suggestion-item");
const modalTitle = () => app.page.locator(".modal .modal-title");

/** "Nova obra…", pick a kind from the list, type the title, Enter. */
async function startWork(kind: "Conto" | "Roteiro" | "Livro", title: string): Promise<void> {
  await app.command("new-work");
  await rows().filter({ hasText: new RegExp(`^${kind}`) }).click();
  await app.page.locator(".modal input").first().fill(title);
  await app.page.keyboard.press("Enter");
}

test("1. Nova obra… lists Conto, Roteiro and Livro with where each goes", async () => {
  await app.command("new-work");
  await expect(rows()).toHaveCount(3);
  await expect(rows().nth(0)).toContainText("Conto");
  await expect(rows().nth(0)).toContainText("Uma nota em Contos/");
  await expect(rows().nth(1)).toContainText("Roteiro");
  await expect(rows().nth(1)).toContainText("Uma nota em Roteiros/");
  await expect(rows().nth(2)).toContainText("Livro");
  await expect(rows().nth(2)).toContainText("Uma pasta com nota do livro e capítulos, em Livros/");
  await app.screenshot("1. the list");
});

test("2. Conto: the note opens in the stories folder, cursor under the beat, shown in Escrevendo", async () => {
  await startWork("Conto", "A volta");
  const text = await app.waitForFile("Contos/A volta.md");
  expect(text).toMatch(/^status: rascunho$/m);
  expect(text).toMatch(/^form: \S+$/m);
  expect(text).toMatch(/^target:\s*$/m);
  expect(text).toMatch(/^deadline:\s*$/m);
  expect(text).toMatch(/^%% beat: .+ %%$/m);

  await app.waitFor("the note to be active", async () => (await app.activeFile()) === "Contos/A volta.md");
  const last = text.split("\n").length - 1; // under the beat, on the empty last line
  await app.waitFor("the cursor under the beat", async () => (await app.cursor())?.line === last, 3000).catch(() => {});
  expect(await app.cursor()).toMatchObject({ file: "Contos/A volta.md", line: last, text: "", ch: 0 });

  await app.openFile("Início.md");
  await expect(app.page.locator(".escrita-desk-section", { hasText: "Escrevendo" }).locator(".escrita-desk-row", { hasText: "A volta" })).toBeVisible();
  await app.screenshot("2. the home block");
});

test("3. the same title again: a notice, nothing changed", async () => {
  const before = app.readVaultFile("Contos/A volta.md");
  const files = app.listVaultFolder("Contos");
  await startWork("Conto", "A volta");
  await app.notice("já existe");
  expect(app.readVaultFile("Contos/A volta.md")).toBe(before);
  expect(app.listVaultFolder("Contos")).toEqual(files);
  await expect(modalTitle()).toHaveText("Novo conto"); // the modal stays open
});

test("4. Livro: folder, chapters folder, book note, first chapter open, outline beside it", async () => {
  await startWork("Livro", "Maré alta");
  const note = await app.waitForFile("Livros/Maré alta.md");
  expect(note).toMatch(/^status: rascunho$/m);
  expect(note).toContain("## Premissa");
  expect(note).toContain("## Personagens");

  await app.waitFor("the first chapter", () => app.listVaultFolder("Livros/Maré alta/Capítulos").length === 1);
  const [chapter] = app.listVaultFolder("Livros/Maré alta/Capítulos");
  const chapterPath = `Livros/Maré alta/Capítulos/${chapter}`;
  const text = await app.waitForFile(chapterPath);
  await app.waitFor("the chapter to be active", async () => (await app.activeFile()) === chapterPath);
  expect(text).toMatch(/%% beat: .+ %%/);
  const last = text.split("\n").length - 1; // after the beat
  await app.waitFor("the cursor after the beat", async () => (await app.cursor())?.line === last, 3000).catch(() => {});
  expect(await app.cursor()).toMatchObject({ file: chapterPath, line: last });

  await expect(app.page.locator('.workspace-leaf-content[data-type="escrita-outline"]').first()).toBeVisible();
  await app.screenshot("4. the new book");
});

test("5. outline off: Livro leaves the list, the footer and the palette", async () => {
  await app.setFeature("outline", false);
  await app.command("new-work");
  await expect(rows()).toHaveCount(2);
  await expect(rows().nth(0)).toContainText("Conto");
  await expect(rows().nth(1)).toContainText("Roteiro");
  await app.closeModals();
  await app.openFile("Início.md");
  const footer = app.page.locator(".escrita-desk-new");
  await expect(footer.locator("button")).toHaveCount(1);
  await expect(footer).toContainText("Novo conto");
  await expect(footer).not.toContainText("Novo livro");
  expect(await app.commandListed("create-book")).toBe(false);

  await app.setFeature("outline", true);
  expect(await app.commandListed("create-book")).toBe(true);
  await expect(footer.locator("button")).toHaveCount(2);
});

test("6. story template: title filled and status added; a missing note falls back to the built-in", async () => {
  app.writeVaultFile("Modelos/Conto.md", "# {{title}}\n\nTexto do modelo.\n");
  await app.setSettings({ storyTemplate: "Modelos/Conto.md" });
  await startWork("Conto", "Com modelo");
  const filled = await app.waitForFile("Contos/Com modelo.md");
  expect(filled).toContain("# Com modelo");
  expect(filled).toContain("Texto do modelo.");
  expect(filled).toMatch(/^status: rascunho$/m);

  await app.setSettings({ storyTemplate: "Modelos/Nada.md" });
  await startWork("Conto", "Sem modelo");
  await app.notice("Modelo não encontrado");
  expect(await app.waitForFile("Contos/Sem modelo.md")).toMatch(/^%% beat: .+ %%$/m); // the built-in one
  await app.setSettings({ storyTemplate: "" });
});

test("7. a stories folder outside the track folders: the notice with Abrir configurações", async () => {
  await app.setSettings({ trackFolders: "Textos" });
  await startWork("Conto", "Fora das metas");
  const notice = await app.notice("fora das pastas acompanhadas");
  await app.waitFor("the note", () => app.vaultFileExists("Contos/Fora das metas.md")); // created anyway
  await notice.getByRole("button", { name: "Abrir configurações" }).click();
  await app.waitFor("the settings", async () => (await app.settingsWindow()).open);
  expect((await app.settingsWindow()).tab).toBe("escrita");
  await app.setSettings({ trackFolders: "" });
});

test("8. the home block footer: both buttons open the modal directly; light and dark", async () => {
  await app.openFile("Início.md");
  const footer = app.page.locator(".escrita-desk-new");
  await expect(footer).toBeVisible();
  await footer.getByRole("button", { name: "+ Novo conto" }).click();
  await expect(modalTitle()).toHaveText("Novo conto");
  await app.closeModals();
  await footer.getByRole("button", { name: "+ Novo livro" }).click();
  await expect(modalTitle()).toHaveText("Novo livro");
  await app.closeModals();

  for (const theme of ["light", "dark"] as const) {
    await app.setTheme(theme);
    await app.screenshot(`8. the footer, ${theme}`, app.page.locator(".escrita-desk").first());
  }
  await app.setTheme("light");
});

test("9. at phone width the footer wraps and its targets are 32 px or more", async () => {
  await app.emulateMobile(true); // reloads the window: the open notes come back or not, so open the home note after
  try {
    await app.openFile("Início.md");
    const footer = app.page.locator(".escrita-desk-new");
    await expect(footer).toBeVisible();
    const box = await footer.boundingBox();
    const buttons = await footer.locator("button").all();
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      const r = (await b.boundingBox())!;
      expect(r.height, "height").toBeGreaterThanOrEqual(32);
      expect(r.width, "width").toBeGreaterThanOrEqual(32);
      expect(r.x + r.width, "inside the footer").toBeLessThanOrEqual(box!.x + box!.width + 1);
    }
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await app.screenshot("9. the footer at phone width");
    await app.command("new-work");
    for (const row of await rows().all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(32);
    await app.screenshot("9. the list at phone width");
  } finally {
    await app.emulateMobile(false);
  }
});

test("10. Novo roteiro: the note opens in the screenplays folder, form roteiro, cursor on the empty line, Tab shows the ghost name", async () => {
  await app.setFeature("screenplay", true);
  await app.command("new-screenplay");
  await expect(modalTitle()).toHaveText("Novo roteiro");
  await app.page.locator(".modal input").first().fill("Curta");
  await app.page.keyboard.press("Enter");
  const text = await app.waitForFile("Roteiros/Curta.md");
  expect(text).toMatch(/^status: rascunho$/m);
  expect(text).toMatch(/^form: roteiro$/m);
  expect(text).not.toMatch(/^target:/m);
  expect(text).toMatch(/^%% beat: .+ %%$/m);

  await app.waitFor("the note to be active", async () => (await app.activeFile()) === "Roteiros/Curta.md");
  const last = text.split("\n").length - 1;
  await app.waitFor("the cursor on the empty line", async () => (await app.cursor())?.line === last, 3000).catch(() => {});
  expect(await app.cursor()).toMatchObject({ file: "Roteiros/Curta.md", line: last, text: "", ch: 0 });

  await expect(app.page.locator(".workspace-leaf.mod-active .cm-editor.escrita-screenplay")).toHaveCount(1);
  await app.page.keyboard.press("Tab");
  await expect(app.page.locator(".workspace-leaf.mod-active .escrita-sp-ghost")).toHaveCount(1);
  expect((await app.page.locator(".workspace-leaf.mod-active .escrita-sp-ghost").innerText()).toLowerCase()).toBe("personagem");
  await app.setFeature("screenplay", false);
});
