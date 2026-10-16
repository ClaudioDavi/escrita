// docs/TEST-0.9.md, "Read the book" (board 33), steps 1 to 11, and the gate G0d measured on the
// long book (30 chapters, about 90,000 words): time to the first text, and the longest task
// while scrolling to the end, three runs. Numbers go to the report and the console.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { longBook, roughWords } from "../fixtures/long-book";
import { round, scrollToEnd, timeToFirstText, Trace, type FirstText, type ScrollRun, type TraceResult } from "../lib/measure";
import { editorText, sleep, snap } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 180_000 });

const DIR = "Romances/Teste 0.9";
const BOOK = `${DIR}/Livro Longo.md`;
const CH = (n: string) => `${DIR}/Livro Longo/Capítulos/${n}.md`;
let ob: App;

test.beforeAll(async () => {
  ob = await App.launch({ vault: world09() });
  installWorld09Extras(ob.vaultDir);
  await configureWorld09(ob);
  // a fresh vault indexes in the background: the reader reads `compile: false` from the cache
  await ob.waitFor("the metadata cache", () => ob.page.evaluate((p) => app.metadataCache.getCache(p)?.frontmatter?.compile === false, CH("31 Notas soltas")), 30_000);
});
test.afterAll(async () => { await ob?.close(); });
test.afterEach(async () => { await ob.closeModals(); await ob.dismissNotices(); });

const SCROLLER = ".escrita-reader";
const readerLeaves = () => ob.page.evaluate(() => app.workspace.getLeavesOfType("escrita-reader").length);
const section = (file: string) => ob.page.locator(`.escrita-reader-chapter[data-path="${file}"]`);
const closeReaders = async () => {
  await ob.page.evaluate(() => app.workspace.getLeavesOfType("escrita-reader").forEach((l: any) => l.detach()));
  await ob.waitFor("readers closed", async () => (await readerLeaves()) === 0);
};
async function readBook(file = BOOK): Promise<void> {
  await ob.openFile(file);
  await ob.waitFor("the note", async () => (await ob.activeFile()) === file);
  expect(await ob.command("read-book")).toBe(true);
  await ob.page.locator(".escrita-reader-chapter").first().waitFor({ state: "attached" });
}
/** Scrolls the reader so a chapter is at the top (or its middle) and waits for it to be drawn. */
async function goTo(file: string, middle = false): Promise<void> {
  // chapters above draw as the page nears them and change its height: scroll again until it settles
  for (let i = 0; i < 4; i++) {
    await ob.page.evaluate(([p, mid]) => {
      const el = document.querySelector(".escrita-reader") as HTMLElement;
      const sec = el.querySelector(`.escrita-reader-chapter[data-path="${p}"]`) as HTMLElement;
      const bar = (el.querySelector(".escrita-reader-bar") as HTMLElement | null)?.offsetHeight ?? 0;
      el.scrollTop = sec.offsetTop - bar + (mid ? sec.offsetHeight / 2 : 0);
    }, [file, middle] as const);
    await sleep(250);
  }
  await expect(section(file).locator(".escrita-reader-body.is-pending")).toHaveCount(0, { timeout: 15_000 });
}
/** Brings the reading tab to the front. */
const showReader = () => ob.page.evaluate(async () => { await app.workspace.revealLeaf(app.workspace.getLeavesOfType("escrita-reader")[0]); });
/** The chapter under the top edge of the reader (below its bar). */
const topChapter = () => ob.page.evaluate(() => {
  const el = document.querySelector(".escrita-reader") as HTMLElement;
  const edge = el.getBoundingClientRect().top + ((el.querySelector(".escrita-reader-bar") as HTMLElement | null)?.offsetHeight ?? 0) + 1;
  for (const s of el.querySelectorAll<HTMLElement>(".escrita-reader-chapter")) if (s.getBoundingClientRect().bottom > edge) return s.dataset.path ?? null;
  return null;
});
const headings = () => ob.page.locator(".escrita-reader-heading").allTextContents();

test("1. Ler o livro opens a tab with the chapters in order, without the left-out one", async () => {
  await readBook();
  await expect(ob.page.locator(".workspace-tab-header.mod-active[data-type=\"escrita-reader\"]")).toHaveAttribute("aria-label", "Lendo: Livro Longo");
  const h = await headings();
  expect(h).toHaveLength(31);
  expect(h[0]).toBe("Prólogo");
  expect(h[1]).toBe("Capítulo 1 — A chegada");
  expect(h[30]).toBe("Capítulo 30 — A travessia");
  expect(h.join("|")).not.toContain("Notas soltas");
  // chapter 02: no beat, no comment; scene breaks are dividing lines
  const ch2 = CH("02 A carta");
  await goTo(ch2);
  const text = await section(ch2).innerText();
  expect(text).toContain("A carta estava debaixo da porta, molhada.");
  expect(text).not.toContain("ela encontra a carta");
  expect(text).not.toContain("rever o tom");
  await expect(section(ch2).locator("hr").first()).toBeAttached();
  await expect(ob.page.locator(".escrita-reader [class*='rail'], .escrita-reader [class*='progress']")).toHaveCount(0); // D6
  await snap(ob, "1. reading, chapter 02", ob.page.locator(SCROLLER));
  // the outline's header has the same button
  await ob.command("open-outline");
  await expect(ob.page.locator(".escrita-outline-action", { hasText: "Ler o livro" })).toBeVisible();
});

test("2. the tab is read-only", async () => {
  const before = ob.readVaultFile(CH("02 A carta"));
  await closeReaders();
  await readBook();
  await goTo(CH("02 A carta"));
  await expect(ob.page.locator(".escrita-reader [contenteditable='true']")).toHaveCount(0);
  await section(CH("02 A carta")).locator(".escrita-reader-block").first().click();
  await ob.page.keyboard.type("texto digitado");
  expect(ob.readVaultFile(CH("02 A carta"))).toBe(before);
  await ob.page.evaluate(() => app.workspace.getLeavesOfType("markdown").forEach((l: any) => { if (l.view.file?.path?.includes("02 A carta") && l !== app.workspace.getLeavesOfType("escrita-reader")[0]) l.detach(); }));
});

test("3. a click on a paragraph of chapter 05 opens it in a new tab at that line", async () => {
  await closeReaders();
  await readBook();
  const c5 = CH("05 O porão");
  await goTo(c5);
  const block = section(c5).locator(".escrita-reader-block").nth(3);
  const line = Number(await block.getAttribute("data-line"));
  const tabs = await ob.page.locator(".workspace-tab-header").count();
  await block.click();
  await ob.waitFor("chapter 05 open", async () => (await ob.activeFile()) === c5);
  expect(await ob.page.locator(".workspace-tab-header").count()).toBe(tabs + 1);
  await ob.waitFor("the cursor", async () => (await ob.cursor())?.line === line, 4000).catch(() => {});
  expect((await ob.cursor())?.line).toBe(line);
});

test("4. closing the tab in the middle of chapter 12 and reading again opens at the same place", async () => {
  const c12 = CH("12 O quarto");
  await showReader();
  await goTo(c12, true);
  await sleep(1200); // the position is saved 0.6 s after the last scroll
  expect(await topChapter()).toBe(c12);
  const saved = await ob.page.evaluate(() => app.plugins.plugins.escrita.data.readPosition["Romances/Teste 0.9/Livro Longo.md"]);
  expect(saved).toBeTruthy();
  await closeReaders();
  await readBook();
  await expect.poll(topChapter, { timeout: 15_000 }).toBe(c12);
  await snap(ob, "4. restored in chapter 12", ob.page.locator(SCROLLER));
});

test("5. Ler o livro while the tab is open goes to it, no second tab", async () => {
  await ob.openFile(BOOK);
  await ob.command("read-book");
  await sleep(500);
  expect(await readerLeaves()).toBe(1);
  expect(await ob.page.evaluate(() => app.workspace.activeLeaf?.view?.getViewType())).toBe("escrita-reader");
});

test("6. edge case: renaming chapter 12 while reading keeps the place; close and reopen too", async () => {
  const c12 = CH("12 O quarto");
  const renamed = CH("12 O quarto escuro");
  await goTo(c12, true);
  await sleep(1200);
  await ob.page.evaluate(([from, to]) => { void app.fileManager.renameFile(app.vault.getFileByPath(from), to); }, [c12, renamed] as const);
  await ob.waitFor("the rename", () => ob.vaultFileExists(renamed));
  await expect(section(renamed)).toBeAttached({ timeout: 10_000 });
  await expect.poll(topChapter, { timeout: 10_000 }).toBe(renamed);
  await sleep(1200);
  await closeReaders();
  await readBook();
  await expect.poll(topChapter, { timeout: 15_000 }).toBe(renamed);
});

test("7. edge case: renaming the folder that holds the book; the tab follows", async () => {
  await ob.page.evaluate(([from, to]) => { void app.fileManager.renameFile(app.vault.getAbstractFileByPath(from), to); }, [DIR, `${DIR} b`] as const);
  await ob.waitFor("the folder renamed", () => ob.vaultFileExists(`${DIR} b/Livro Longo.md`));
  await expect(ob.page.locator(".escrita-reader-chapter").first()).toBeAttached({ timeout: 10_000 });
  await expect(ob.page.locator(".escrita-reader-empty")).toHaveCount(0);
  await expect(ob.page.locator(".escrita-reader-book")).toHaveText("Livro Longo");
  await expect(ob.page.locator(".escrita-reader-heading")).toHaveCount(31, { timeout: 10_000 });
  await expect(ob.page.getByText("Este livro não está mais no cofre.")).toHaveCount(0);
  await ob.page.evaluate(([from, to]) => { void app.fileManager.renameFile(app.vault.getAbstractFileByPath(from), to); }, [`${DIR} b`, DIR] as const);
  await ob.waitFor("renamed back", () => ob.vaultFileExists(BOOK));
  await expect(ob.page.locator(".escrita-reader-heading")).toHaveCount(31, { timeout: 10_000 });
});

const NEW_SENTENCE = "Uma frase nova no começo do capítulo, bem comprida, para crescer o primeiro parágrafo e empurrar o que vem depois. ";

/** Opens chapter 12 in a split (the split narrows the reading pane, which re-wraps it) and returns. */
async function openSplit(path: string): Promise<void> {
  await ob.page.evaluate(async (p) => { await app.workspace.getLeaf("split").openFile(app.vault.getFileByPath(p)); }, path);
  await sleep(600);
}
/** Adds a sentence at the start of the chapter's first paragraph, in its split editor. */
const addSentence = (path: string) => ob.page.evaluate(([p, s]) => {
  const view = app.workspace.getLeavesOfType("markdown").map((l: any) => l.view).find((v: any) => v.file?.path === p);
  view.editor.replaceRange(s, { line: 4, ch: 0 });
}, [path, NEW_SENTENCE] as const);
/** Undoes the edit and closes the split. */
async function cleanSplit(path: string): Promise<void> {
  await ob.page.evaluate(async ([p, s]) => {
    const f = app.vault.getFileByPath(p);
    await app.vault.modify(f, (await app.vault.read(f)).replace(s, ""));
    app.workspace.getLeavesOfType("markdown").forEach((l: any) => { if (l.view.file?.path === p) l.detach(); });
  }, [path, NEW_SENTENCE] as const);
  await sleep(1500);
}
/** The top of a drawn block (chapter path, data-line), relative to the viewport. */
const blockTop = (chapter: string, line: number) => ob.page.evaluate(([p, l]) => {
  const b = document.querySelector(`.escrita-reader-chapter[data-path="${p}"] .escrita-reader-block[data-line="${l}"]`) as HTMLElement | null;
  return b ? b.getBoundingClientRect().top : null;
}, [chapter, line] as const);
/** The first block of the chapter whose top is on screen (it may run past the bottom): its line and where it sits. */
const visibleBlock = (chapter: string) => ob.page.evaluate((p) => {
  const el = document.querySelector(".escrita-reader") as HTMLElement;
  const r = el.getBoundingClientRect();
  const edge = r.top + ((el.querySelector(".escrita-reader-bar") as HTMLElement | null)?.offsetHeight ?? 0);
  for (const b of el.querySelectorAll<HTMLElement>(`.escrita-reader-chapter[data-path="${p}"] .escrita-reader-block`)) {
    const t = b.getBoundingClientRect();
    if (t.top >= edge && t.top <= r.bottom - 60) return { line: Number(b.dataset.line), top: t.top };
  }
  return null;
}, chapter);

test("8. editing the chapter above the one in view: the reading tab shows the new sentence, the text in view stays put", async () => {
  // Finding: with chapter 13 in view and chapter 12 (wholly above) edited, the text in view moves UP
  // by the height the new sentence added (78 px for 3 lines). refreshDirty adds the height difference
  // to scrollTop, and Chromium's scroll anchoring has already made the same adjustment, so the
  // compensation is applied twice (the reader has no `overflow-anchor: none`). Measured: scrollTop
  // 20683 -> 20839 for a 78 px change.
  test.fail(true, "reader-view.ts refreshDirty: scrollTop compensation doubles Chromium's scroll anchoring; the text in view jumps");
  const c12 = CH("12 O quarto escuro");
  const c13 = CH("13 A sombra");
  await showReader();
  await goTo(c13);
  await openSplit(c12);
  await showReader();
  // chapter 12 wholly above the window: the sticky bar covers the top, so scroll a little into chapter 13
  await ob.page.evaluate((p) => { const el = document.querySelector(".escrita-reader") as HTMLElement; el.scrollTop = (el.querySelector(`[data-path="${p}"]`) as HTMLElement).offsetTop + 40; }, c13);
  await sleep(500);
  const mark = await visibleBlock(c13);
  expect(mark).not.toBeNull();
  await addSentence(c12);
  await expect(section(c12)).toContainText("Uma frase nova no começo do capítulo", { timeout: 10_000 });
  await sleep(300);
  const after = await blockTop(c13, mark!.line);
  test.info().annotations.push({ type: "jump (chapter above)", description: `${round((after ?? NaN) - mark!.top)} px` });
  expect(Math.abs((after ?? NaN) - mark!.top)).toBeLessThanOrEqual(2);
  await cleanSplit(c12);
});

test("8b. editing the top of the chapter that is being read: the text in view stays put", async () => {
  // TEST-0.9 step 8 as written: the reader is inside chapter 12 and a sentence is added at its top.
  // Chromium's scroll anchoring keeps the text in view (no compensation by the plugin applies).
  const c12 = CH("12 O quarto escuro");
  await showReader();
  await goTo(c12, true);
  await openSplit(c12);
  await showReader();
  await goTo(c12, true);
  await sleep(500);
  const mark = await visibleBlock(c12);
  expect(mark).not.toBeNull();
  await addSentence(c12);
  await expect(section(c12)).toContainText("Uma frase nova no começo do capítulo", { timeout: 10_000 });
  await sleep(300);
  const after = await blockTop(c12, mark!.line);
  test.info().annotations.push({ type: "jump (chapter in view)", description: `${round((after ?? NaN) - mark!.top)} px` });
  try {
    expect(Math.abs((after ?? NaN) - mark!.top)).toBeLessThanOrEqual(2);
  } finally {
    await cleanSplit(c12);
  }
});

test("9. edge case: the position was in a chapter that was deleted: it opens at the top", async () => {
  const c30 = CH("30 A travessia");
  await goTo(c30, true);
  await sleep(1200);
  expect(await topChapter()).toBe(c30);
  await closeReaders();
  await ob.page.evaluate((p) => { void app.vault.trash(app.vault.getFileByPath(p), false); }, c30);
  await ob.waitFor("trashed", () => !ob.vaultFileExists(c30));
  await readBook();
  await expect(ob.page.locator(".escrita-reader-heading")).toHaveCount(30, { timeout: 10_000 });
  await expect.poll(topChapter, { timeout: 10_000 }).toBe(CH("00 Prólogo"));
  // restore it from the trash
  await ob.page.evaluate(async ([from, to]) => { await app.vault.adapter.rename(from, to); }, [".trash/30 A travessia.md", c30] as const);
  await ob.waitFor("restored", () => ob.vaultFileExists(c30));
});

test("10. an empty book: the message and the button that makes the first chapter", async () => {
  await closeReaders();
  const book = `${DIR}/Livro Vazio.md`;
  await ob.openFile(book);
  await ob.waitFor("the note", async () => (await ob.activeFile()) === book);
  await ob.command("read-book");
  await expect(ob.page.locator(".escrita-reader-empty-title")).toHaveText("Este livro ainda não tem capítulos para ler.");
  await snap(ob, "10. empty book", ob.page.locator(SCROLLER));
  await ob.page.getByRole("button", { name: "Criar o primeiro capítulo" }).click();
  await ob.waitFor("a chapter made", () => ob.listVaultFolder(`${DIR}/Livro Vazio/Capítulos`).length === 1);
  await ob.waitFor("it opens in the editor", async () => ((await ob.activeFile()) ?? "").startsWith(`${DIR}/Livro Vazio/Capítulos/`));
  expect(await editorText(ob)).toBeDefined();
});

test("11. outside a book (Maré) Ler o livro is not in the palette", async () => {
  await ob.openFile("Contos/Teste 0.9/Maré.md");
  expect(await ob.commandListed("read-book")).toBe(false);
});

// ---------------------------------------------------------------------------------------------
// G0d (0.9): "Read the book" on the long book. Bars from TEST-0.9: first text under 500 ms
// (proposed); the longest task against 0.8's 20 ms.

const BAR_FIRST_MS = 500;
const BAR_TASK_MS = 20;
// The scroll of TEST-0.9: the scrollbar dragged from top to bottom in about five seconds. The page is
// about 186,000 px tall at 390 px of text width; 620 px per frame at 60 fps is that drag. A second pass
// at reading pace (120 px per frame) follows the three runs.
const DRAG_PX = 620;
const READ_PX = 120;
const runs: { first: FirstText; scroll: ScrollRun; trace: TraceResult | null; longTasks: number[] }[] = [];

for (const n of [1, 2, 3]) {
  test(`G0d run ${n}: first text on screen, then the longest task while scrolling to the end`, async () => {
    test.setTimeout(240_000);
    await closeReaders();
    await ob.page.evaluate(() => { app.plugins.plugins.escrita.data.readPosition = {}; });
    await ob.openFile(BOOK);
    await ob.waitFor("the book", async () => (await ob.activeFile()) === BOOK);
    await ob.page.evaluate(() => new Promise((r) => requestIdleCallback(() => r(null), { timeout: 2000 })));
    await sleep(1500); // let the earlier work settle: indexes, saves

    const first = await timeToFirstText(ob, "read-book", ".escrita-reader-block");
    expect(first.length).toBeGreaterThan(100); // a real paragraph, not a placeholder
    expect(first.path).toBe(CH("00 Prólogo"));
    await expect(ob.page.locator(".escrita-reader-chapter")).toHaveCount(31);
    await sleep(800);

    await ob.observeLongTasks();
    const trace = new Trace();
    const tracing = await trace.start(ob);
    const scroll = await scrollToEnd(ob, SCROLLER, DRAG_PX);
    await sleep(300);
    const traced = tracing ? await trace.stop() : null;
    const long = (await ob.longTasks()).map((t) => round(t.duration));

    const row = { first, scroll, trace: traced, longTasks: long };
    runs.push(row);
    await test.info().attach(`G0d run ${n}`, { body: JSON.stringify(row, null, 2), contentType: "application/json" });
    console.log(`G0D run ${n}: ${JSON.stringify({ firstTextMs: round(first.textMs), paintedMs: round(first.paintedMs), scrollMs: round(scroll.durationMs), frames: scroll.frames, maxFrameGapMs: round(scroll.maxFrameGapMs), reachedBottom: scroll.reachedBottom, longestTaskMs: traced ? round(traced.longestMs) : null, topTasksMs: traced?.top.map((x) => round(x)), over20: traced?.over20, over50: traced?.over50, tasks: traced?.tasks, longTasksApi: long })}`);
    expect(scroll.reachedBottom).toBe(true);
    await snap(ob, `G0d run ${n}: the end of the book`, ob.page.locator(SCROLLER));
  });
}

test("G0d at reading pace: the same scroll at 120 px per frame", async () => {
  test.setTimeout(240_000);
  await closeReaders();
  await ob.page.evaluate(() => { app.plugins.plugins.escrita.data.readPosition = {}; });
  await ob.openFile(BOOK);
  await sleep(1500);
  await ob.command("read-book");
  await expect(ob.page.locator(".escrita-reader-chapter")).toHaveCount(31, { timeout: 15_000 });
  await sleep(800);
  await ob.observeLongTasks();
  const trace = new Trace();
  const tracing = await trace.start(ob);
  const scroll = await scrollToEnd(ob, SCROLLER, READ_PX);
  await sleep(300);
  const traced = tracing ? await trace.stop() : null;
  const long = (await ob.longTasks()).map((t) => round(t.duration));
  const row = { scroll, trace: traced, longTasks: long };
  await test.info().attach("G0d reading pace", { body: JSON.stringify(row, null, 2), contentType: "application/json" });
  console.log(`G0D reading pace: ${JSON.stringify({ scrollMs: round(scroll.durationMs), frames: scroll.frames, maxFrameGapMs: round(scroll.maxFrameGapMs), longestTaskMs: traced ? round(traced.longestMs) : null, topTasksMs: traced?.top.map((x) => round(x)), over20: traced?.over20, over50: traced?.over50, tasks: traced?.tasks, longTasksApi: long })}`);
  expect(scroll.reachedBottom).toBe(true);
});

test("G0d result: the three runs against the bars", async () => {
  expect(runs).toHaveLength(3);
  const words = roughWords(longBook());
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const firstMs = runs.map((r) => r.first.textMs);
  const paintedMs = runs.map((r) => r.first.paintedMs);
  const tasks = runs.map((r) => r.trace?.longestMs ?? NaN);
  const gaps = runs.map((r) => r.scroll.maxFrameGapMs);
  const lines = [
    `book: 31 chapters, about ${words} words`,
    `first text (ms): ${firstMs.map((x) => round(x)).join(", ")} (median ${round(med(firstMs))}; painted ${paintedMs.map((x) => round(x)).join(", ")}); bar ${BAR_FIRST_MS}`,
    `longest main-thread task while scrolling (ms): ${tasks.map((x) => round(x)).join(", ")}; bar ${BAR_TASK_MS}`,
    `widest gap between animation frames (ms): ${gaps.map((x) => round(x)).join(", ")}`,
    `long tasks over 50 ms (Long Tasks API): ${runs.map((r) => r.longTasks.length).join(", ")}`,
  ];
  await test.info().attach("G0d summary", { body: lines.join("\n"), contentType: "text/plain" });
  console.log("G0D summary\n" + lines.join("\n"));
  const firstOk = med(firstMs) < BAR_FIRST_MS;
  const taskOk = tasks.every((x) => Number.isFinite(x)) ? Math.max(...tasks) < BAR_TASK_MS : null;
  test.info().annotations.push({ type: "G0d first text", description: `${firstOk ? "met" : "MISSED"}: median ${round(med(firstMs))} ms against ${BAR_FIRST_MS}` });
  test.info().annotations.push({ type: "G0d longest task", description: taskOk === null ? "no trace" : `${taskOk ? "met" : "MISSED"}: worst ${round(Math.max(...tasks))} ms against ${BAR_TASK_MS} (a trace is running while it is measured)` });
  // The hard checks: the first text is well under the proposed bar, and nothing reaches the Long Tasks
  // API's 50 ms. The 20 ms bar is recorded above, not asserted: a miss is a finding for the report.
  expect(firstOk).toBe(true);
  expect(runs.every((r) => r.longTasks.length === 0)).toBe(true);
});
