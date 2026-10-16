// docs/TEST-0.9.md, "Publish next chapter" (board 32), steps 1 to 11. The book is the long-book
// fixture cut to 8 chapters: the steps need chapters 00 to 06 and a 31 left out; step 11 ticks
// the two that are left instead of 24.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { setProperty } from "../lib/export-ui";
import { snap } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 90_000 });

const BOOK = "Romances/Teste 0.9/Livro Longo.md";
const CH = (n: string) => `Romances/Teste 0.9/Livro Longo/Capítulos/${n}.md`;
const C01 = CH("01 A chegada");
let ob: App;

test.beforeAll(async () => {
  ob = await App.launch({ vault: world09({ chapters: 8 }) });
  installWorld09Extras(ob.vaultDir);
  await configureWorld09(ob);
});
test.afterAll(async () => { await ob?.close(); });
test.afterEach(async () => { await ob.closeModals(); await ob.dismissNotices(); });

const serial = () => ob.page.locator(".escrita-outline-serial");
const nextButton = () => ob.page.locator(".escrita-outline-action", { hasText: "Publicar o próximo" });
const dlg = () => ob.page.locator(".modal.escrita-publish-modal");
const today = (): Promise<string> => ob.page.evaluate(() => (window as any).moment().format("YYYY-MM-DD"));
/** "16 out" for a YYYY-MM-DD date, as the line writes it. */
const short = (d: string): Promise<string> => ob.page.evaluate((x) => (window as any).moment(x, "YYYY-MM-DD").format("D MMM"), d);
const fm = (path: string, key: string): Promise<unknown> => ob.page.evaluate(([p, k]) => app.metadataCache.getCache(p)?.frontmatter?.[k], [path, key]);

async function publishDialog(): Promise<void> {
  await dlg().waitFor({ state: "visible" });
}

test("1. the outline of a book with nothing published has no serial line and no Publicar o próximo", async () => {
  await ob.openFile(BOOK);
  await ob.waitFor("the book", async () => (await ob.activeFile()) === BOOK);
  await ob.command("open-outline");
  await expect(ob.page.locator(".escrita-outline-actions .escrita-outline-action", { hasText: "Ler o livro" })).toBeVisible();
  await expect(serial()).toHaveClass(/is-hidden/);
  await expect(serial()).toHaveText("");
  await expect(nextButton()).toHaveCount(0);
});

test("2. Publicar o próximo capítulo opens chapter 01 and its check; Publicar sets status and date", async () => {
  expect(await ob.command("publish-next-chapter")).toBe(true);
  await publishDialog();
  expect(await ob.activeFile()).toBe(C01);
  await expect(dlg().locator(".escrita-publish-check", { hasText: "Todos os capítulos anteriores estão publicados" })).toBeVisible();
  await snap(ob, "2. publish check for chapter 01", dlg());
  await dlg().getByRole("button", { name: "Publicar", exact: true }).click();
  const day = await today();
  await expect.poll(() => fm(C01, "status"), { timeout: 10_000 }).toBe("publicado");
  await expect.poll(() => fm(C01, "date")).toBe(day);
});

test("3. the header line: Próximo: 02 A carta, last published today, and the button", async () => {
  const day = await short(await today());
  await expect(serial()).toHaveText(`Próximo: 02 A carta · último publicado em ${day}`);
  await expect(nextButton()).toBeVisible();
  await snap(ob, "3. outline header", ob.page.locator(".escrita-outline-serial").locator("xpath=.."));
});

test("4. Publicar o próximo twice more: each opens the next chapter, the line ends at Próximo: 04 A escada", async () => {
  for (const n of ["02 A carta", "03 O cais"]) {
    await nextButton().click();
    await publishDialog();
    expect(await ob.activeFile()).toBe(CH(n));
    await dlg().getByRole("button", { name: "Publicar", exact: true }).click();
    await expect.poll(() => fm(CH(n), "status"), { timeout: 10_000 }).toBe("publicado");
    await expect(dlg()).toHaveCount(0);
  }
  await expect(serial()).toContainText("Próximo: 04 A escada");
});

test("5. edge case: publishing 05 over a gap warns (not a blocker) and the line shows the gap first", async () => {
  const c05 = CH("05 O porão");
  await ob.openFile(c05);
  await ob.command("publish-note");
  await publishDialog();
  // TEST-0.9 writes "04."; the check names the chapter with its title, like the serial line does
  const warn = dlg().locator(".escrita-publish-check.is-warning", { hasText: "Capítulo anterior não publicado: 04 A escada. Quem lê pularia um capítulo." });
  await expect(warn).toBeVisible();
  await expect(dlg().locator(".escrita-publish-anyway")).toHaveCount(0);
  await snap(ob, "5. gap warning", dlg());
  await dlg().getByRole("button", { name: "Publicar", exact: true }).click();
  await expect.poll(() => fm(c05, "status"), { timeout: 10_000 }).toBe("publicado");
  const day = await short(await today());
  await expect(serial()).toHaveText(`Lacuna: 04 · Próximo: 04 A escada · último publicado em ${day}`);
});

test("6. Publicar o próximo opens 04, the gap; its check is clean; the line goes to Próximo: 06 A feira", async () => {
  await nextButton().click();
  await publishDialog();
  expect(await ob.activeFile()).toBe(CH("04 A escada"));
  await expect(dlg().locator(".escrita-publish-check", { hasText: "Todos os capítulos anteriores estão publicados" })).toBeVisible();
  await dlg().getByRole("button", { name: "Publicar", exact: true }).click();
  await expect.poll(() => fm(CH("04 A escada"), "status"), { timeout: 10_000 }).toBe("publicado");
  await expect(serial()).toContainText("Próximo: 06 A feira");
  await expect(serial()).not.toContainText("Lacuna");
});

test("7. edge case: a future date is shown as written, and nothing is scheduled", async () => {
  const future = await ob.page.evaluate(() => (window as any).moment().add(7, "days").format("YYYY-MM-DD"));
  await nextButton().click();
  await publishDialog();
  expect(await ob.activeFile()).toBe(CH("06 A feira"));
  await dlg().locator("input[type=date]").fill(future);
  await dlg().getByRole("button", { name: "Publicar", exact: true }).click();
  await expect.poll(() => fm(CH("06 A feira"), "date"), { timeout: 10_000 }).toBe(future);
  await expect(serial()).toContainText(`último publicado em ${await short(future)}`);
  await snap(ob, "7. future date", ob.page.locator(".escrita-outline-serial").locator("xpath=.."));
});

test("8. edge case: no date on the last published chapter gives 'último publicado: 06 A feira'", async () => {
  await setProperty(ob, CH("06 A feira"), "date", null);
  await expect(serial()).toContainText("último publicado: 06 A feira", { timeout: 10_000 });
  await expect(serial()).not.toContainText("último publicado em");
});

test("9. outside a book (Maré) the command is not offered", async () => {
  await ob.openFile("Contos/Teste 0.9/Maré.md");
  expect(await ob.commandListed("publish-next-chapter")).toBe(false);
  await ob.openFile(BOOK);
});

test("10. out of the sequence: publishing 00 Prólogo changes nothing in the line; 31 is not in it", async () => {
  const before = await serial().innerText();
  const c00 = CH("00 Prólogo");
  await ob.openFile(c00);
  await ob.command("publish-note");
  await publishDialog();
  await dlg().getByRole("button", { name: "Publicar", exact: true }).click();
  await expect.poll(() => fm(c00, "status"), { timeout: 10_000 }).toBe("publicado");
  await ob.openFile(BOOK);
  await expect(serial()).toHaveText(before);
  expect(await fm(CH("31 Notas soltas"), "status")).toBe("rascunho");
});

test("11. every chapter published: the line says so, the command says so", async () => {
  for (const n of ["07 A ponte", "08 O inverno"]) await setProperty(ob, CH(n), "status", "publicado");
  await expect(serial()).toContainText("Todos os capítulos estão publicados", { timeout: 10_000 });
  await expect(nextButton()).toHaveCount(0);
  await ob.openFile(BOOK);
  await ob.command("publish-next-chapter");
  await ob.notice("Todos os capítulos do livro estão publicados.");
});
