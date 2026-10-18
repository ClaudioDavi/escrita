// 1.1.1, part 1 (the CSS commit 224e428): every line the plugin draws is now a background, a
// spacer or a plain text-decoration where it is the only way (the closed thread), never
// text-decoration or text-indent for the rest. This spec shows each changed style in a real
// Obsidian, dark and light, and checks the computed styles. With RECORD=<folder> it also
// writes a screencast (visual-1.1.1.mp4) and one PNG per step and theme into that folder, with a
// caption and a pause per step; without it, it runs fast and writes nothing.
import { expect, test, type Locator } from "@playwright/test";
import path from "node:path";
import { App } from "../lib/app";
import { world } from "../fixtures/h1";
import { WORLD_SETTINGS } from "../fixtures/h1";
import { chip, exportModal, openExport } from "../lib/export-ui";
import { editorCursor, showUniverseTab, sleep } from "../lib/panels";
import { caption, recordDir, Recorder, removeCaption } from "../lib/record";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const LENS = "Contos/Lente.md";
const NAME = "Contos/Maria.md";
const PUBLISH = "Contos/Aberta.md";
const EXPORT = "Contos/Exportar.md";
const THREADS = "Contos/Fio.md";
const HOME = "Início.md";

// The prose of the lens note. Each rule has its own line, and the lines the click check uses
// are consecutive (no blank line) so each is one .cm-line.
const NEWNAME_LINE = "Na proa estava Almeida";
const BELOW_LINE = "Veio a noite, fria e escura.";
const LENS_TEXT = [
  "---",
  "status: rascunho",
  "---",
  "O vento batia na janela e o vento batia na porta, e a janela rangia.",
  "",
  "Ela andou rapidamente até o cais.",
  "",
  "Amanhã eu vou estar levando o barco para o mar.",
  "",
  "De repente a luz apagou, e de repente tudo ficou quieto.",
  "",
  "Silvano chegou cedo. Depois Silvana foi embora e Silvano ficou.",
  "",
  "O filho de Almeida dormia, a mulher de Almeida cantava, e o cão de Almeida latiu.",
  "",
  "Ninguém falou de Almeida na vila.",
  "",
  NEWNAME_LINE,
  BELOW_LINE,
  "",
  "Ela subiu a escada devagar, contou os degraus um por um, pensou na casa que tinha deixado para trás, lembrou do cheiro do pão da manhã, olhou o mar lá embaixo e decidiu que ia ficar ali até o fim.",
  "",
].join("\n");

const LISTS = "# Vícios\n- de repente\n\n# Nomes\n- Silvano\n";

const NOTES: Record<string, string> = {
  // the desk's count bar holds the idea, ready, published and no-status works; the writer fixture has ideas
  "Contos/Pronto.md": "---\nstatus: pronto\n---\nUm conto terminado.\n",
  "Contos/Feito.md": "---\nstatus: publicado\n---\nUm conto no mundo.\n",
  [LENS]: LENS_TEXT,
  "Listas.md": LISTS,
  [NAME]: "---\nstatus: rascunho\n---\nMaria olhou o mar e Mari sorriu para o farol.\n",
  [PUBLISH]: "---\nstatus: revisão\n---\nUm texto curto.\n\n<!-- esta nota ficou aberta\n\nMais um parágrafo.\n",
  [EXPORT]: [
    "---",
    "status: revisão",
    "---",
    "A chuva caiu sobre o cais durante toda a manhã, e ninguém saiu de casa.",
    "",
    "Na segunda parte do dia, o vento virou e trouxe o cheiro do mar até as janelas fechadas.",
    "",
    "> Quem espera o barco, espera o próprio retorno.",
    "",
    "À noite, a luz do farol varreu as ondas, uma vez e outra, sem pressa.",
    "",
  ].join("\n"),
  [THREADS]: "---\nstatus: rascunho\n---\nUm bilhete na gaveta. %% thread: quem escreveu as cartas? %%\n\nA ponte caiu. %% thread fechada: por que a ponte caiu? %%\n",
};

let ob: App;
let rec: Recorder | null = null;
let shotNo = 0;
const RECORDING = recordDir() !== null;

test.beforeAll(async () => {
  const base = world();
  ob = await App.launch({ vault: { ...base, files: { ...base.files, ...NOTES } } });
  await ob.setSettings({
    ...WORLD_SETTINGS,
    lensLanguage: "pt-BR",
    lensListsNote: "Listas.md",
    lensLongSentence: 25,
    lensRulesOn: ["newName"],
    underlineNames: true,
    setupOffered: true, // no first-run notice over the pictures
  });
  await ob.setFeature("threads", true);
  rec = await Recorder.start(ob.page);
});
test.afterAll(async () => {
  if (ob) {
    await removeCaption(ob.page).catch(() => { /* gone */ });
    await rec?.stop();
    rec?.encode("visual-1.1.1");
    await ob.close();
  }
});
test.afterEach(async () => { await ob.closeModals(); await ob.dismissNotices(); });

/** Shows the caption for a step, before it starts. */
async function begin(step: string, theme: string): Promise<void> {
  await caption(ob.page, `1.1.1 · ${step} · ${theme}`);
}

/** The end of a step: a pause for the viewer and a PNG, only while recording. */
async function present(slug: string, theme: string): Promise<void> {
  if (!RECORDING) return;
  await sleep(2500);
  const dir = recordDir()!;
  await ob.page.screenshot({ path: path.join(dir, `${String(++shotNo).padStart(2, "0")}-${slug}-${theme}.png`) });
}

const style = (loc: Locator) =>
  loc.first().evaluate((el) => {
    const c = getComputedStyle(el);
    return { bg: c.backgroundImage, deco: c.textDecorationLine, layers: (c.backgroundImage.match(/gradient\(/g) ?? []).length };
  });

async function openLens(): Promise<void> {
  // the lens panel may sit behind another panel of the same tab group (the universe's): bring it forward first
  await ob.page.evaluate(async () => {
    const leaf = app.workspace.getLeavesOfType("escrita-lens")[0];
    if (leaf) await app.workspace.revealLeaf(leaf);
  });
  await ob.openFile(LENS);
  await ob.waitFor("the lens note", async () => (await ob.activeFile()) === LENS);
  // the lens is on per note: the panel shows its rule rows only for a note that has it on
  const rules = ob.page.locator(".escrita-lens-rules");
  const panel = ob.page.locator(".escrita-lens-rules, .escrita-lens-empty");
  // no panel yet: the command opens it with the lens on. Otherwise wait for the panel to show
  // this note's state (rules, or the "turn on" box) before deciding.
  if ((await ob.page.locator(".escrita-lens-head, .escrita-lens-empty").count()) === 0) {
    await ob.command("toggle-revision-lens");
  } else {
    await panel.first().waitFor({ state: "visible", timeout: 10_000 });
    if (!(await rules.isVisible())) await ob.command("toggle-revision-lens");
  }
  await expect(ob.page.locator(".escrita-lens-rules")).toBeVisible();
}

/** Steps a rule to its first match through the panel's name button. */
async function stepTo(rule: string): Promise<void> {
  const row = ob.page.locator(".escrita-lens-row").filter({ has: ob.page.locator(`.escrita-lens-key-${rule}`) });
  await row.locator(".escrita-lens-rulename").click();
  await expect(ob.page.locator(`.cm-content .escrita-lens-${rule}.escrita-lens-current`).first()).toBeVisible({ timeout: 5000 });
}

for (const theme of ["dark", "light"] as const) {
  test.describe(theme, () => {
    test.beforeAll(async () => {
      await ob.setTheme(theme);
    });

    test(`1. lens marks · ${theme}`, async () => {
      await begin("Lens marks", theme);
      await openLens();
      const mark = (cls: string) => ob.page.locator(`.cm-content .escrita-lens-${cls}`).first();
      const expected: Record<string, number> = { echo: 1, adverb: 1, gerund: 1, crutch: 1, name: 1, newName: 2 };
      await expect.poll(() => ob.page.locator(".cm-content .escrita-lens-newName").count(), { timeout: 20_000 }).toBeGreaterThan(0);
      for (const rule of ["echo", "related", "adverb", "gerund", "crutch", "name", "newName", "long"]) {
        const loc = mark(rule);
        await expect(loc, `a ${rule} mark is drawn`).toBeVisible({ timeout: 10_000 });
        const s = await style(loc);
        expect(s.deco, `${rule}: text-decoration-line`).toBe("none");
        if (rule === "long") {
          expect(s.bg, "long: no image, a fill").toBe("none");
          continue;
        }
        expect(s.bg, `${rule}: background-image`).not.toBe("none");
        if (rule in expected) expect(s.layers, `${rule}: gradient layers`).toBe(expected[rule]);
      }

      // the marks add no height to their line: a marked single-line paragraph against an unmarked one
      const probe = await ob.page.evaluate((below) => {
        const lines = [...document.querySelectorAll<HTMLElement>(".cm-content .cm-line")];
        const plain = lines.find((l) => l.textContent === below && !l.querySelector("[class*=escrita-lens]"));
        const marked = lines.filter((l) => (l.textContent ?? "").length < 60 && l.querySelector(".escrita-lens-newName, .escrita-lens-adverb, .escrita-lens-crutch"));
        return { plain: plain?.getBoundingClientRect().height ?? 0, marked: marked.map((l) => l.getBoundingClientRect().height) };
      }, BELOW_LINE);
      expect(probe.plain).toBeGreaterThan(10);
      expect(probe.marked.length).toBeGreaterThan(0);
      for (const h of probe.marked) expect(h, "a marked line is as tall as a plain one").toBeLessThanOrEqual(probe.plain + 0.5);

      // the current match, on the first mark of a line, then on a newName, then on a long sentence
      await stepTo("echo");
      const cur = await style(ob.page.locator(".cm-content .escrita-lens-echo.escrita-lens-current"));
      expect(cur.deco).toBe("none");
      expect(cur.bg).not.toBe("none");
      await present("lens-marks-echo-current", theme);

      await stepTo("newName");
      const curName = await style(ob.page.locator(".cm-content .escrita-lens-newName.escrita-lens-current"));
      expect(curName.deco).toBe("none");
      expect(curName.bg).not.toBe("none");
      const fill = await ob.page.locator(".cm-content .escrita-lens-newName.escrita-lens-current").first().evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(fill).not.toBe("rgba(0, 0, 0, 0)");
      await present("lens-marks-newname-current", theme);

      await stepTo("long");
      const curLong = await style(ob.page.locator(".cm-content .escrita-lens-long.escrita-lens-current"));
      expect(curLong.deco).toBe("none");
      await present("lens-marks-long-current", theme);
    });

    test(`1b. a click just under a name mark lands on the line below · ${theme}`, async () => {
      await begin("Click under a name mark", theme);
      await openLens();
      const lines = LENS_TEXT.split("\n");
      const belowIndex = lines.indexOf(BELOW_LINE);
      const markedIndex = lines.indexOf(NEWNAME_LINE);
      expect(belowIndex).toBe(markedIndex + 1);
      await expect(ob.page.locator(".cm-content .cm-line .escrita-lens-newName").filter({ hasText: "Almeida" }).first()).toBeVisible({ timeout: 20_000 });
      // the .cm-line under the marked one
      const box = await ob.page.evaluate((below) => {
        const l = [...document.querySelectorAll<HTMLElement>(".cm-content .cm-line")].find((x) => x.textContent === below);
        if (!l) return null;
        l.scrollIntoView({ block: "center" });
        const r = l.getBoundingClientRect();
        return { x: r.left, y: r.top, h: r.height };
      }, BELOW_LINE);
      expect(box).not.toBeNull();
      // click 1px below the top edge of the lower line, over the marked word's column
      const markBox = await ob.page.locator(".cm-content .escrita-lens-newName").filter({ hasText: "Almeida" }).first().boundingBox();
      const upper = markBox!.x + markBox!.width / 2;
      const after = await ob.page.evaluate((below) => {
        const l = [...document.querySelectorAll<HTMLElement>(".cm-content .cm-line")].find((x) => x.textContent === below)!;
        const r = l.getBoundingClientRect();
        return { y: r.top };
      }, BELOW_LINE);
      await ob.page.mouse.click(upper, after.y + 1);
      await sleep(150);
      const c = await editorCursor(ob);
      expect(c?.line, "the cursor is on the lower line").toBe(belowIndex);
      await present("click-under-mark", theme);
    });

    test(`2. the name underline · ${theme}`, async () => {
      await begin("Name underline", theme);
      await ob.openFile(NAME);
      await ob.waitFor("the Maria note", async () => (await ob.activeFile()) === NAME);
      const mark = ob.page.locator(".cm-content .escrita-name-underline").first();
      await expect(mark).toBeVisible({ timeout: 20_000 });
      const s = await style(mark);
      expect(s.deco).toBe("none");
      expect(s.bg).not.toBe("none");
      expect(s.layers).toBe(1);
      await present("name-underline", theme);
    });

    test(`3. the desk block · ${theme}`, async () => {
      await begin("Desk block", theme);
      await ob.openFile(HOME);
      await ob.waitFor("the home note", async () => (await ob.activeFile()) === HOME);
      const counts = ob.page.locator(".escrita-desk .escrita-desk-count");
      await expect(counts.first()).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => counts.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
      const label = ob.page.locator(".escrita-desk .escrita-desk-count-label");
      const s = await style(label);
      expect(s.deco).toBe("none");
      expect(s.bg).not.toBe("none");
      expect(s.layers).toBe(1);
      const btn = await counts.first().evaluate((el) => getComputedStyle(el).textDecorationLine);
      expect(btn).toBe("none");
      await present("desk-counts", theme);
      // expand one
      await counts.first().click();
      const open = ob.page.locator(".escrita-desk .escrita-desk-count[aria-expanded='true']");
      await expect(open).toHaveCount(1);
      const so = await style(open.locator(".escrita-desk-count-label"));
      expect(so.bg).not.toBe("none");
      expect(so.deco).toBe("none");
      await present("desk-count-expanded", theme);
      await open.click(); // leave it closed for the other theme
      await expect(ob.page.locator(".escrita-desk .escrita-desk-count[aria-expanded='true']")).toHaveCount(0);
    });

    test(`4. the lens panel's Ignore button, hovered · ${theme}`, async () => {
      await begin("Ignore button", theme);
      await openLens();
      await stepTo("adverb");
      const ignore = ob.page.locator(".escrita-lens-ignore");
      await expect(ignore).toBeVisible();
      await ignore.hover();
      const label = ob.page.locator(".escrita-lens-ignore .escrita-lens-ignore-label");
      const s = await style(label);
      expect(s.bg).not.toBe("none");
      expect(s.layers).toBe(1);
      expect(s.deco).toBe("none");
      expect(await ignore.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("none");
      await present("lens-ignore-hover", theme);
    });

    test(`5. the publish check, hovered · ${theme}`, async () => {
      await begin("Publish check", theme);
      await ob.openFile(PUBLISH);
      await ob.waitFor("the note to be active", async () => (await ob.activeFile()) === PUBLISH);
      expect(await ob.command("publish-note")).toBe(true);
      const modal = ob.page.locator(".modal.escrita-publish-modal");
      await modal.waitFor({ state: "visible" });
      const text = modal.locator(".escrita-publish-text.is-clickable");
      await expect(text.first()).toBeVisible();
      const label = text.first().locator(".escrita-publish-label");
      const before = await style(label);
      expect(before.bg).not.toBe("none");
      expect(before.layers).toBe(1);
      expect(before.deco).toBe("none");
      expect(await text.first().evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("none");
      await text.first().hover();
      const hover = await style(label);
      expect(hover.bg, "the line stays on hover").not.toBe("none");
      expect(hover.deco).toBe("none");
      await present("publish-check-hover", theme);
    });

    test(`6. the export preview · ${theme}`, async () => {
      await begin("Export preview", theme);
      await openExport(ob, EXPORT);
      for (const [format, indent, selector] of [["DOCX", "45px", ".escrita-export-paper"], ["EPUB", "", ".escrita-export-paper.is-epub"]] as const) {
        await chip(ob, format);
        if (format === "DOCX") await chip(ob, "Shunn"); // the manuscript preset: a 36 pt indent, drawn at 1.25 px per point (preview.ts PX): 45 px
        await exportModal(ob).getByRole("button", { name: "Prévia" }).click();
        await begin(`Export preview ${format}`, theme);
        const p = exportModal(ob).locator(`${selector} p`).first();
        await expect(p, `${format} preview has a paragraph`).toBeVisible({ timeout: 10_000 });
        const got = await exportModal(ob).locator(selector).first().evaluate((paperEl) => {
          const ps = [...paperEl.querySelectorAll<HTMLElement>("p")];
          const plain = ps.find((el) => !el.matches(".escrita-export-quote, .escrita-export-front"));
          const quote = paperEl.querySelector<HTMLElement>(".escrita-export-quote");
          const front = paperEl.querySelector<HTMLElement>(".escrita-export-front");
          const pseudo = (el: HTMLElement | null | undefined) => {
            if (!el) return null;
            const c = getComputedStyle(el, "::before");
            return { width: c.width, content: c.content, indent: getComputedStyle(el).textIndent, fontSize: getComputedStyle(el).fontSize };
          };
          const varWidth = (() => { const probe = document.createElement("span"); probe.style.cssText = "position:absolute;visibility:hidden;width:var(--escrita-export-indent)"; plain!.appendChild(probe); const w = getComputedStyle(probe).width; probe.remove(); return w; })();
          return { varWidth, plain: pseudo(plain), quote: pseudo(quote), front: pseudo(front), count: ps.length };
        });
        expect(got.count).toBeGreaterThanOrEqual(3);
        expect(got.plain!.content, `${format}: a paragraph draws the indent`).toBe('""');
        expect(got.plain!.indent, `${format}: no text-indent`).toBe("0px");
        const expectedWidth = format === "DOCX" ? indent : `${parseFloat(got.plain!.fontSize) * 1.4}px`;
        expect(parseFloat(got.plain!.width), `${format}: the indent box is the indent`).toBeCloseTo(parseFloat(expectedWidth), 1);
        expect(parseFloat(got.plain!.width)).toBeCloseTo(parseFloat(got.varWidth), 1);
        if (got.quote) expect(got.quote.content, `${format}: the quote has no indent box`).toBe("none");
        if (got.front) expect(got.front.content, `${format}: the front matter has no indent box`).toBe("none");
        expect(got.quote, `${format} preview shows the quote`).not.toBeNull();
        await present(`export-preview-${format.toLowerCase()}`, theme);
        await exportModal(ob).getByRole("button", { name: "Voltar" }).click();
      }
    });

    test(`7. a closed thread · ${theme}`, async () => {
      await begin("Closed thread", theme);
      await ob.openFile(THREADS);
      await ob.waitFor("the thread note", async () => (await ob.activeFile()) === THREADS);
      await showUniverseTab(ob, "Threads");
      const link = ob.page.locator(".escrita-universe-foot .escrita-universe-link");
      await expect(link.first()).toBeVisible({ timeout: 20_000 });
      const closed = ob.page.locator(".escrita-universe-thread.is-closed .escrita-universe-thread-text");
      if ((await closed.count()) === 0) await link.first().click();
      await expect(closed.first()).toBeVisible({ timeout: 10_000 });
      const s = await style(closed);
      expect(s.deco, "a closed thread is struck through").toBe("line-through");
      await present("closed-thread", theme);
      // hide the closed threads again for the other theme
      await ob.page.locator(".escrita-universe-foot .escrita-universe-link").first().click().catch(() => { /* already hidden */ });
    });
  });
}
