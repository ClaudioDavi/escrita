// PLAN-1.2, "Read this note" (SF 15, board 46) and improvement 52: a conto and a collection in the
// reader, the position, the click, the palette, an old { book } state, and the startup case where the
// metadata cache is not ready when the reader opens.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { sleep, snap } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const DIR = "Contos/Teste 0.9";
const CHUVA = `${DIR}/Chuva.md`;
const COLL = `${DIR}/Coletânea.md`;
const MARE = `${DIR}/Maré.md`;
const SAL = `${DIR}/Sal.md`;
const FAROL = `${DIR}/O farol apagado.md`;
const SCRIPT = "Roteiros/Cena.md";
const VAZIA = `${DIR}/Vazia.md`;
const BOOK_DIR = "Romances/Leitura";
const BOOK = `${BOOK_DIR}/Livro Pequeno.md`;
const CH1 = `${BOOK_DIR}/Livro Pequeno/Capítulos/01 Um.md`;
const CH2 = `${BOOK_DIR}/Livro Pequeno/Capítulos/02 Fora.md`;
const CH3 = `${BOOK_DIR}/Livro Pequeno/Capítulos/03 Três.md`;

/** A conto long enough to scroll: a beat and a comment that must stay hidden, 80 paragraphs. */
const chuva = (): string => [
  "---", "status: rascunho", "---",
  "%% beat: a chuva começa %%",
  "A chuva começou de manhã.",
  "",
  "%% rever o tom desta cena %%",
  "",
  ...Array.from({ length: 80 }, (_, i) => `Parágrafo ${i + 1}. A água escorria pela vidraça e ninguém falava.\n`),
].join("\n");

let ob: App;

test.beforeAll(async () => {
  const world = world09({ chapters: 3 });
  Object.assign(world.files, {
    [CHUVA]: chuva(),
    [VAZIA]: "---\nstatus: rascunho\n---\n%% beat: nada ainda %%\n",
    [COLL]: `---\ncontents:\n  - "[[Maré]]"\n  - "[[Fantasma]]"\n  - "[[Sal]]"\n  - "[[O farol apagado]]"\n---\n`,
    [SCRIPT]: "---\nform: roteiro\n---\n\nINT. SALA - DIA\n\nUma sala vazia.\n",
    [BOOK]: "---\nstatus: rascunho\n---\n",
    [CH1]: "Um.\n",
    [CH2]: "---\ncompile: false\n---\nFora do livro.\n",
    [CH3]: "Três.\n",
  });
  ob = await App.launch({ vault: world });
  installWorld09Extras(ob.vaultDir);
  await configureWorld09(ob);
  await ob.setSettings({ collectionProperty: "contents" });
  await ob.waitFor("the metadata cache", () => ob.page.evaluate((p) => app.metadataCache.getCache(p)?.frontmatter?.compile === false, CH2), 30_000);
});
test.afterAll(async () => { await ob?.close(); });
test.afterEach(async () => { await ob.closeModals(); await ob.dismissNotices(); });

const readerLeaves = () => ob.page.evaluate(() => app.workspace.getLeavesOfType("escrita-reader").length);
const closeReaders = async () => {
  await ob.page.evaluate(() => app.workspace.getLeavesOfType("escrita-reader").forEach((l: any) => l.detach()));
  await ob.waitFor("readers closed", async () => (await readerLeaves()) === 0);
};
const section = (file: string) => ob.page.locator(`.escrita-reader-chapter[data-path="${file}"]`);
async function readNote(file: string): Promise<void> {
  await ob.openFile(file);
  await ob.waitFor("the note", async () => (await ob.activeFile()) === file);
  expect(await ob.command("read-note")).toBe(true);
  await ob.page.locator(".escrita-reader-chapter").first().waitFor({ state: "attached" });
  await expect(ob.page.locator(".escrita-reader-body.is-pending")).toHaveCount(0, { timeout: 15_000 });
}
/** The first block whose bottom is below the bar: its line and text. */
const topBlock = () => ob.page.evaluate(() => {
  const el = document.querySelector(".escrita-reader") as HTMLElement;
  const edge = el.getBoundingClientRect().top + ((el.querySelector(".escrita-reader-bar") as HTMLElement | null)?.offsetHeight ?? 0) + 1;
  for (const b of el.querySelectorAll<HTMLElement>(".escrita-reader-block")) {
    if (b.getBoundingClientRect().bottom > edge) return Number(b.dataset.line);
  }
  return null;
});

test("1. Ler esta nota opens a conto without the beat and the comment; the bar has the title and the chip", async () => {
  await closeReaders();
  await readNote(CHUVA);
  await expect(ob.page.locator(".workspace-tab-header.is-active[data-type=\"escrita-reader\"]")).toHaveAttribute("aria-label", "Lendo: Chuva");
  const text = await section(CHUVA).innerText();
  expect(text).toContain("A chuva começou de manhã.");
  expect(text).toContain("Parágrafo 80.");
  expect(text).not.toContain("a chuva começa");
  expect(text).not.toContain("rever o tom");
  await expect(ob.page.locator(".escrita-reader-heading")).toHaveCount(0);
  await expect(ob.page.locator(".escrita-reader-book")).toHaveText("Chuva");
  await expect(ob.page.locator(".escrita-reader-chip")).toHaveText("somente leitura");
  await expect(ob.page.locator(".escrita-reader-count")).toHaveCount(0);
  await expect(ob.page.locator(".escrita-reader-tool")).toHaveCount(0);
  await expect(ob.page.locator(".escrita-reader [contenteditable='true']")).toHaveCount(0);
  await snap(ob, "1. a conto in the reader", ob.page.locator(".escrita-reader"));
});

test("2. the position is saved under the note's path and restored after closing the tab", async () => {
  await sleep(400);   // the reader ignores scrolls for 150 ms after it opens
  await ob.page.evaluate(async () => { await app.workspace.revealLeaf(app.workspace.getLeavesOfType("escrita-reader")[0]); });
  await ob.page.evaluate(() => {
    const el = document.querySelector(".escrita-reader") as HTMLElement;
    el.scrollTop = el.scrollHeight / 2;
  });
  await sleep(1200);
  const saved = await ob.page.evaluate((p) => app.plugins.plugins.escrita.data.readPosition[p], CHUVA);
  expect(saved?.chapter).toBe(CHUVA);
  expect(saved?.line).toBeGreaterThan(20);
  const before = await topBlock();
  await closeReaders();
  await readNote(CHUVA);
  await expect.poll(topBlock, { timeout: 10_000 }).toBe(before);
});

test("3. a click on a paragraph opens the note at that line", async () => {
  await closeReaders();
  await readNote(CHUVA);
  const block = section(CHUVA).locator(".escrita-reader-block").nth(5);
  const line = Number(await block.getAttribute("data-line"));
  const tabs = await ob.page.locator(".workspace-tab-header").count();
  await block.click();
  await ob.waitFor("the note open", async () => (await ob.activeFile()) === CHUVA);
  expect(await ob.page.locator(".workspace-tab-header").count()).toBe(tabs + 1);
  await ob.waitFor("the cursor", async () => (await ob.cursor())?.line === line, 4000).catch(() => {});
  expect((await ob.cursor())?.line).toBe(line);
});

test("4. Ler esta nota again goes to the open reader, no second tab", async () => {
  await ob.openFile(CHUVA);
  await ob.command("read-note");
  await sleep(500);
  expect(await readerLeaves()).toBe(1);
  expect(await ob.page.evaluate(() => app.workspace.activeLeaf?.view?.getViewType())).toBe("escrita-reader");
});

test("5. an empty note says so, with no button", async () => {
  await closeReaders();
  await ob.openFile(VAZIA);
  await ob.command("read-note");
  await expect(ob.page.locator(".escrita-reader-empty")).toHaveText("Esta nota ainda não tem texto para ler.");
  await expect(ob.page.locator(".escrita-reader-empty button")).toHaveCount(0);
});

test("6. a collection reads its contos in order, each headed by its title, with the count; the missing link is skipped", async () => {
  await closeReaders();
  await readNote(COLL);
  await expect(ob.page.locator(".workspace-tab-header.is-active[data-type=\"escrita-reader\"]")).toHaveAttribute("aria-label", "Lendo: Coletânea");
  expect(await ob.page.locator(".escrita-reader-heading").allTextContents()).toEqual(["Maré", "Sal", "O farol apagado"]);
  await expect(ob.page.locator(".escrita-reader-count")).toHaveText("3 contos");
  await expect(ob.page.locator(".escrita-reader-chip")).toHaveCount(0);
  expect(await section(SAL).innerText()).toContain("O sal secava nas pedras");
  expect(await section(MARE).innerText()).toContain("A maré subiu cedo.");
  const paths = await ob.page.locator(".escrita-reader-chapter").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.path));
  expect(paths).toEqual([MARE, SAL, FAROL]);
  await snap(ob, "6. a collection in the reader", ob.page.locator(".escrita-reader"));
});

test("7. an empty collection says so, with no button", async () => {
  ob.writeVaultFile(`${DIR}/Sem contos.md`, "---\ncontents:\n---\n");
  await ob.waitFor("the new note", () => ob.page.evaluate((p) => app.metadataCache.getCache(p)?.frontmatter !== undefined, `${DIR}/Sem contos.md`));
  await closeReaders();
  await ob.openFile(`${DIR}/Sem contos.md`);
  await ob.command("read-note");
  await expect(ob.page.locator(".escrita-reader-empty")).toHaveText("Esta coletânea ainda não lista notas para ler.");
  await expect(ob.page.locator(".escrita-reader-empty button")).toHaveCount(0);
});

test("8. Ler esta nota is not in the palette for a screenplay or inside a book; Ler o livro is", async () => {
  await ob.openFile(SCRIPT);
  expect(await ob.commandListed("read-note")).toBe(false);
  await ob.openFile(CH1);
  expect(await ob.commandListed("read-note")).toBe(false);
  expect(await ob.commandListed("read-book")).toBe(true);
  await ob.openFile(BOOK);
  expect(await ob.commandListed("read-note")).toBe(false);
  await ob.openFile(MARE);
  expect(await ob.commandListed("read-note")).toBe(true);
  expect(await ob.commandListed("read-book")).toBe(false);
});

test("9. the outline for a single note has the reader button", async () => {
  await ob.openFile(CHUVA);
  await ob.command("open-outline");
  const btn = ob.page.locator(".escrita-outline-read-note");
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute("aria-label", "Ler esta nota");
  await closeReaders();
  await btn.click();
  await expect(ob.page.locator(".escrita-reader-chip")).toBeVisible();
  await expect(ob.page.locator(".escrita-reader-book")).toHaveText("Chuva");
});

test("10. an old { book } view state still opens the book", async () => {
  await closeReaders();
  await ob.page.evaluate(async (p) => {
    const leaf = app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: "escrita-reader", active: true, state: { book: p } });
  }, BOOK);
  await expect(ob.page.locator(".escrita-reader-book")).toHaveText("Livro Pequeno");
  await expect(ob.page.locator(".escrita-reader-count")).toHaveText("2 capítulos");
  await expect(ob.page.locator(".escrita-reader-tool")).toBeVisible();
  // the state it writes back is the new one
  const state = await ob.page.evaluate(() => app.workspace.getLeavesOfType("escrita-reader")[0].view.getState());
  expect(state.source).toBe(BOOK);
});

test("11. improvement 52: opened before the metadata cache is ready, the left-out chapter leaves when it is", async () => {
  await closeReaders();
  // the cache knows nothing of the chapter's properties yet, as at startup
  await ob.page.evaluate((p) => {
    const cache = app.metadataCache as any;
    const real = cache.getFileCache.bind(cache);
    cache.__real = real;
    cache.getFileCache = (f: { path: string }) => (f.path === p ? null : real(f));
  }, CH2);
  await ob.openFile(BOOK);
  expect(await ob.command("read-book")).toBe(true);
  await expect(ob.page.locator(".escrita-reader-chapter")).toHaveCount(3);
  expect(await section(CH2).count()).toBe(1);
  // the cache settles
  await ob.page.evaluate(() => {
    const cache = app.metadataCache as any;
    cache.getFileCache = cache.__real;
    cache.trigger("resolved");
  });
  await expect(ob.page.locator(".escrita-reader-chapter")).toHaveCount(2, { timeout: 10_000 });
  expect(await section(CH2).count()).toBe(0);
  await expect(ob.page.locator(".escrita-reader-count")).toHaveText("2 capítulos");
});

test("12. a resolved with nothing changed draws nothing again; a changed list rebuilds and the place is kept", async () => {
  await closeReaders();
  await ob.openFile(BOOK);
  await ob.command("read-book");
  await expect(ob.page.locator(".escrita-reader-chapter")).toHaveCount(2);
  await ob.page.evaluate(() => { (document.querySelector(".escrita-reader-chapter") as any).__mark = true; });
  await ob.page.evaluate(() => (app.metadataCache as any).trigger("resolved"));
  await sleep(900);
  expect(await ob.page.evaluate(() => (document.querySelector(".escrita-reader-chapter") as any).__mark)).toBe(true);
  const pos = () => ob.page.evaluate((p) => app.plugins.plugins.escrita.data.readPosition[p] ?? null, BOOK);
  const before = await pos();
  // a chapter appears on disk: the list changes
  ob.writeVaultFile(`${BOOK_DIR}/Livro Pequeno/Capítulos/04 Quatro.md`, "Quatro.\n");
  await expect(ob.page.locator(".escrita-reader-chapter")).toHaveCount(3, { timeout: 10_000 });
  await sleep(900);
  expect(await pos()).toEqual(before);
  await expect(ob.page.locator(".escrita-reader-body.is-pending")).not.toHaveCount(3);
});
