// 0.7's gate G0d, closed as decided (PLAN-1.1 Q12): Reading view shows the panel only, no
// post-processor. TEST-0.9, "0.7's G0d: Aparece em across re-renders", steps 1 to 5 plus the panel:
// in Reading view no "Aparece em" block is drawn into the note (across 5 toggles and a split pane),
// Live Preview keeps exactly one, and the panel still lists the mentions.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { appendToEditor, showUniverseTab, sleep, snap } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const WILLIAN = "Universo/Personagens/Willian.md";
let ob: App;
const problems: string[] = [];

test.beforeAll(async () => {
  ob = await App.launch({ vault: world09({ chapters: 6 }) });
  installWorld09Extras(ob.vaultDir);
  await configureWorld09(ob);
  ob.page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  ob.page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
});
test.afterAll(async () => { await ob?.close(); });
test.afterEach(async () => { await ob.closeModals(); });

/** The modes of the note's leaves, and the count of "Aparece em" blocks inside each. */
const leavesState = () => ob.page.evaluate((p) => app.workspace.getLeavesOfType("markdown")
  .filter((l: any) => l.view.file?.path === p)
  .map((l: any) => ({
    mode: l.view.getMode() as string,
    // a leaf keeps the editor in the DOM while it shows Reading view: count where the reader looks
    wraps: l.view.containerEl.querySelectorAll(l.view.getMode() === "preview" ? ".markdown-reading-view .escrita-ai-wrap" : ".markdown-source-view .escrita-ai-wrap").length as number,
    anyAi: l.view.containerEl.querySelectorAll(".markdown-reading-view [class*='escrita-ai-']").length as number,
    shown: l.view.containerEl.offsetParent !== null,
  })), WILLIAN);
const toggle = async () => { await ob.command("markdown:toggle-preview"); await sleep(700); };
/** The sections the reader can see, in any pane. */
const totalWraps = () => ob.page.locator(".escrita-ai-wrap >> visible=true").count();

/** Scrolls every Live Preview editor of the note to its end: the editor draws only what is near the view. */
const toEnd = () => ob.page.evaluate((p) => {
  for (const l of app.workspace.getLeavesOfType("markdown") as any[]) {
    if (l.view.file?.path !== p || l.view.getMode() !== "source") continue;
    const ed = l.view.editor;
    ed.scrollIntoView({ from: { line: ed.lastLine(), ch: 0 }, to: { line: ed.lastLine(), ch: 0 } }, true);
  }
}, WILLIAN);

async function liveOne(): Promise<void> {
  await expect.poll(async () => { await toEnd(); return (await leavesState())[0]?.wraps; }, { timeout: 15_000 }).toBe(1);
  expect(await totalWraps()).toBe(1);
}

async function checkToggles(): Promise<void> {
  await ob.openFile(WILLIAN);
  await ob.page.evaluate(async () => {
    const leaf = app.workspace.getMostRecentLeaf();
    await leaf.setViewState({ type: "markdown", state: { file: "Universo/Personagens/Willian.md", mode: "source", source: false } });
  });
  await liveOne();
  // 2. Reading view: no section, no error, nothing doubled
  await toggle();
  let st = await leavesState();
  expect(st[0].mode).toBe("preview");
  expect(st[0].wraps).toBe(0);
  expect(st[0].anyAi).toBe(0);
  expect(await totalWraps()).toBe(0);
  await snap(ob, "Reading view of Willian");
  // 3. back and forth five times: one section in Live Preview each time, none in Reading view
  for (let i = 1; i <= 5; i++) {
    await toggle(); // to Live Preview
    await toEnd();
    await sleep(300);
    st = await leavesState();
    expect(st[0].mode, `toggle ${i}: mode`).toBe("source");
    await expect.poll(async () => { await toEnd(); return (await leavesState())[0].wraps; }, { timeout: 10_000 }).toBe(1);
    expect(await totalWraps(), `toggle ${i}: Live Preview`).toBe(1);
    await toggle(); // to Reading view
    st = await leavesState();
    expect(st[0].mode, `toggle ${i}: mode`).toBe("preview");
    expect(st[0].wraps, `toggle ${i}: Reading view`).toBe(0);
    expect(st[0].anyAi).toBe(0);
    expect(await totalWraps()).toBe(0);
  }
  await toggle(); // leave it in Live Preview
}

async function checkSplit(): Promise<void> {
  await ob.openFile(WILLIAN);
  await liveOne();
  // a split: Live Preview on the left, Reading view on the right
  await ob.page.evaluate(async () => {
    const right = app.workspace.getLeaf("split");
    await right.setViewState({ type: "markdown", state: { file: "Universo/Personagens/Willian.md", mode: "preview" } });
  });
  await sleep(1000);
  let st = await leavesState();
  expect(st.map((x: { mode: string }) => x.mode).sort()).toEqual(["preview", "source"]);
  const live = () => leavesState().then((xs) => xs.find((x: { mode: string }) => x.mode === "source")!);
  const read = () => leavesState().then((xs) => xs.find((x: { mode: string }) => x.mode === "preview")!);
  await toEnd();
  await sleep(300);
  expect((await live()).wraps).toBe(1);
  expect((await read()).wraps).toBe(0);
  // type at the end of the note on the left
  await ob.page.evaluate(() => {
    const leaf = app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.getMode() === "source" && l.view.file?.path === "Universo/Personagens/Willian.md");
    app.workspace.setActiveLeaf(leaf, { focus: true });
  });
  const lines = (await ob.page.evaluate(() => app.workspace.activeEditor?.editor?.lineCount() ?? 0)) as number;
  await appendToEditor(ob, "\nWillian voltou ao farol.\n");
  await toEnd();
  await sleep(1500);
  expect(await ob.page.evaluate(() => app.workspace.activeEditor?.editor?.lineCount() ?? 0)).toBeGreaterThan(lines);
  expect((await live()).wraps).toBe(1);
  // the section still follows the text: it is the last thing in the editor
  const atEnd = await ob.page.evaluate(() => {
    const leaf = app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.getMode() === "source" && l.view.file?.path === "Universo/Personagens/Willian.md");
    const content = leaf.view.containerEl.querySelector(".cm-content") as HTMLElement;
    const wrap = content.querySelector(".escrita-ai-wrap") as HTMLElement;
    const lastLine = [...content.querySelectorAll(".cm-line")].pop() as HTMLElement;
    return wrap.getBoundingClientRect().top >= lastLine.getBoundingClientRect().bottom - 1;
  });
  expect(atEnd).toBe(true);
  const right = await read();
  expect(right.wraps).toBe(0);
  expect(right.anyAi).toBe(0);
  expect(await totalWraps()).toBe(1);
  await snap(ob, "split: Live Preview left, Reading view right");
  // close the split again
  await ob.page.evaluate(() => {
    for (const l of app.workspace.getLeavesOfType("markdown")) if ((l as any).view.getMode() === "preview" && (l as any).view.file?.path === "Universo/Personagens/Willian.md") l.detach();
  });
  st = await leavesState();
  expect(st).toHaveLength(1);
}

test("1. Live Preview: one Aparece em section at the end", async () => {
  await ob.openFile(WILLIAN);
  await liveOne();
  const wrap = ob.page.locator(".escrita-ai-wrap");
  await expect(wrap).toContainText("Aparece em");
  await expect(wrap.locator(".escrita-ai-summary")).toContainText("3 obras", { timeout: 20_000 });
});

test("2 and 3. Reading view draws no section, across five toggles", async () => {
  await checkToggles();
});

test("4. a split, Live Preview left and Reading view right: the left keeps one section that follows the text, the right stays clean", async () => {
  await checkSplit();
});

test("5. a long entry (200 lines): the same", async () => {
  const text = await ob.page.evaluate(async (p) => app.vault.read(app.vault.getFileByPath(p)), WILLIAN);
  const long = text + Array.from({ length: 200 }, (_, i) => `Linha ${i + 1} do diário do faroleiro, com a luz e o vento.`).join("\n\n") + "\n";
  await ob.page.evaluate(async ([p, t]) => { await app.vault.modify(app.vault.getFileByPath(p), t); }, [WILLIAN, long] as const);
  await sleep(1000);
  await checkToggles();
  await checkSplit();
});

test("6. the panel still lists the mentions while the note is in Reading view", async () => {
  await ob.openFile(WILLIAN);
  await liveOne();
  await toggle();
  expect((await leavesState())[0].mode).toBe("preview");
  await showUniverseTab(ob, "Entradas");
  const entry = ob.page.locator(".escrita-universe-entry", { hasText: "Willian" });
  await expect(entry.locator("button.escrita-ai-count")).toContainText("3 obras", { timeout: 20_000 });
  await entry.locator("button.escrita-ai-count").click();
  const rows = ob.page.locator(".escrita-universe-body .escrita-ai-row.is-work .escrita-ai-name");
  await expect(rows).toHaveCount(3);
  expect((await rows.allTextContents()).sort()).toEqual(["Livro Longo", "O farol apagado", "Sal"]);
  await snap(ob, "6. the panel lists the mentions", ob.page.locator(".escrita-universe-body"));
  expect(await totalWraps()).toBe(0);
  await toggle();
});

test("no error was logged by the page during any of it", async () => {
  expect(problems.filter((p) => /escrita/i.test(p))).toEqual([]);
  test.info().annotations.push({ type: "page messages (not Escrita's)", description: String(problems.length) });
});
