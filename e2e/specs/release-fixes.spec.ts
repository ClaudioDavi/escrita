// docs/TEST-1.0.md, "Release-candidate fixes (2026-10-09)", steps 1 to 4.
import { expect, test, type Page } from "@playwright/test";
import { App } from "../lib/app";
import { SetupModal } from "../lib/setup-modal";
import { settingsPage, settle } from "../lib/more";
import { emptyPt, writer } from "../fixtures";
import { WORLD_SETTINGS, world } from "../fixtures/h1";
import { parseEntries } from "../../src/darlings/format";

test.describe("Release-candidate fixes: settings fall back to the install's language (1)", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;
  let settings: Page;

  /** The text input of a settings row, found by the row's name. */
  const field = (name: string) => settings.locator(".setting-item").filter({ has: settings.locator(".setting-item-name", { hasText: new RegExp(`^${name}$`) }) }).locator("input[type=text]").first();

  test.beforeAll(async () => {
    app = await App.launch({ vault: world({ seeded: true }) });
    await app.setSettings({ ...WORLD_SETTINGS, features: { threads: true } });
    await settle(1000);
    settings = await settingsPage(app);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("1. clearing 'Palavra de thread fechada' and leaving the field brings back 'fechada'; the thread word reads 'thread'", async () => {
    const closed = field("Palavra de thread fechada");
    await closed.scrollIntoViewIfNeeded();
    await closed.fill("");
    await closed.blur();
    await closed.press("Tab").catch(() => {});
    await settle(600);
    await expect.poll(() => app.setting("threadClosedWord")).toBe("fechada");
    const shown = (await field("Palavra de thread fechada").inputValue()) || (await field("Palavra de thread fechada").getAttribute("placeholder"));
    expect(shown).toBe("fechada");
    const word = field("Palavra das threads");
    expect((await word.inputValue()) || (await word.getAttribute("placeholder"))).toBe("thread");
    await app.screenshot("1. the thread words", settings.locator(".setting-item", { hasText: "Palavra de thread fechada" }));
  });

  test("1. the universe note, the export and the submissions folders: each placeholder is Portuguese", async () => {
    expect(await field("Nota do universo").getAttribute("placeholder")).toBe("Universo.md");
    expect(await field("Pasta das exportações").getAttribute("placeholder")).toBe("Escrita/Exportações");
    expect(await field("Pasta dos envios").getAttribute("placeholder")).toBe("Escrita/Envios");
    // and a cleared universe note comes back as the Portuguese name, not Universe.md
    const note = field("Nota do universo");
    await note.fill("");
    await note.blur();
    await settle(600);
    await expect.poll(() => app.setting("universeNote")).toBe("Universo.md");
  });
});

test.describe("Release-candidate fixes: one home note (2)", () => {
  test.describe.configure({ timeout: 90_000 });
  let app: App;
  test.afterAll(async () => {
    await app?.close();
  });

  test("2. Inicio.md and no home note setting: 'Abrir a nota inicial' and the setup both use it, and no Início.md is created", async () => {
    const base = emptyPt({ seeded: true });
    app = await App.launch({
      vault: { ...base, files: { ...base.files, "Inicio.md": "Minha nota.\n\n```escrita-works\n```\n" } },
    });
    await app.setSettings({ homeNote: "" });
    expect(await app.command("open-home-note")).toBe(true);
    await app.waitFor("the home note", async () => (await app.activeFile()) === "Inicio.md", 8000);

    const setup = new SetupModal(app);
    await app.command("setup");
    await setup.button("Ver o que vou criar").click();
    const rows = (await setup.preview()).flatMap((g) => g.rows);
    const homeRows = rows.filter((r) => /In[ií]cio\.md/.test(r.label));
    expect(homeRows.map((r) => [r.label, r.mark]), JSON.stringify(rows.map((r) => r.label))).toEqual([["Inicio.md", "="]]);
    await app.screenshot("2. the setup adopts Inicio.md", setup.root);
    if (await setup.button("Criar").isEnabled()) {
      await setup.button("Criar").click();
      await app.notice("Pronto.");
    } else {
      await setup.button(/Cancelar|Fechar/).click();
    }
    await settle(800);
    expect(app.vaultFileExists("Início.md")).toBe(false);
    expect(app.vaultFileExists("Inicio.md")).toBe(true);
  });
});

test.describe("Release-candidate fixes: darlings with the note open (3)", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;
  const CONTO = "Contos/O afogado.md";
  const PARAS = ["Primeiro parágrafo do conto.", "O mar subiu devagar naquela noite.", "A casa ficou vazia por anos.", "Ninguém voltou para buscar as malas.", "Última linha do conto."];
  let darlings = "";

  /** Select a paragraph of the conto in its editor and cut it to the darlings note. */
  async function cut(paragraph: string): Promise<void> {
    await app.page.evaluate(([path, text]) => {
      const leaf = window.app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.file?.path === path)!;
      window.app.workspace.setActiveLeaf(leaf, { focus: true });
      const ed = leaf.view.editor;
      const i = ed.getValue().indexOf(text);
      ed.setSelection(ed.offsetToPos(i), ed.offsetToPos(i + text.length));
    }, [CONTO, paragraph] as const);
    expect(await app.command("move-selection-to-darlings")).toBe(true);
  }
  const editorText = (path: string) => app.page.evaluate((p) => window.app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.file?.path === p)?.view.editor.getValue() ?? null, path);
  /** The passages the darlings note holds, parsed from what its editor shows (an entry also stores the text around the cut, so a plain search would find more than the passages). */
  const passages = async () => parseEntries((await editorText(darlings)) ?? "").map((e) => e.text.trim());
  /** Every paragraph is in the conto or held as a passage in the darlings note: nothing is lost. */
  async function nothingLost(except: string[] = []): Promise<void> {
    const conto = (await editorText(CONTO)) ?? "";
    const held = await passages();
    for (const p of PARAS.filter((x) => !except.includes(x))) expect(conto.includes(p) || held.includes(p), `"${p}" is in the conto or in the darlings note`).toBe(true);
  }
  const waitDarlings = (text: string, present: boolean) =>
    app.waitFor(`the darlings editor ${present ? "to hold" : "to drop"} "${text}"`, async () => (await passages()).includes(text) === present, 8000);
  const card = (text: string) => app.page.locator(".escrita-darling").filter({ hasText: text });

  test.beforeAll(async () => {
    const base = writer({ seeded: true });
    app = await App.launch({ vault: { ...base, files: { ...base.files, [CONTO]: `---\nstatus: rascunho\n---\n\n${PARAS.join("\n\n")}\n` } } });
    await app.openFile(CONTO);
    darlings = await app.page.evaluate((p) => window.app.plugins.plugins.escrita.features.get("darlings").notePathFor(window.app.vault.getFileByPath(p)), CONTO);
    expect(darlings).toMatch(/\.md$/);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("3. the first cut creates the darlings note; open it in a tab beside the conto", async () => {
    await cut(PARAS[1]);
    await app.waitFor("the darlings note", () => app.vaultFileExists(darlings), 8000);
    await app.page.evaluate(async ([path, conto]) => {
      const file = window.app.vault.getFileByPath(path)!;
      const leaf = window.app.workspace.getLeaf("split", "vertical");
      await leaf.openFile(file, { active: false });
      const c = window.app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.file?.path === conto)!;
      window.app.workspace.setActiveLeaf(c, { focus: true });
    }, [darlings, CONTO] as const);
    await waitDarlings(PARAS[1], true);
    expect(await editorText(CONTO)).not.toContain(PARAS[1]);
    await nothingLost();
    await app.screenshot("3. the conto and its darlings note, side by side");
  });

  test("3. a second cut shows in the open darlings note at once", async () => {
    await cut(PARAS[2]);
    await waitDarlings(PARAS[2], true);
    await nothingLost();
  });

  test("3. Ctrl+Z in the darlings note undoes there (the editor and the file agree); Ctrl+Z in the conto brings the cut back, so nothing is lost", async () => {
    await app.page.evaluate((path) => {
      const leaf = window.app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.file?.path === path)!;
      window.app.workspace.setActiveLeaf(leaf, { focus: true });
    }, darlings);
    await settle(300);
    const before = await passages();
    await app.page.keyboard.press("Control+z");
    await settle(900);
    // the undo took the last darling out of the note it was written into
    const after = await passages();
    expect(after.length).toBeLessThan(before.length);
    await app.waitFor("the darlings file to match its editor", async () => app.readVaultFile(darlings).trim() === ((await editorText(darlings)) ?? "").trim(), 8000);
    await app.screenshot("3. after Ctrl+Z in the darlings note");
    // the passage that left the darlings note is still in the conto's undo history
    await app.page.evaluate((path) => {
      const leaf = window.app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.file?.path === path)!;
      window.app.workspace.setActiveLeaf(leaf, { focus: true });
    }, CONTO);
    await settle(300);
    await app.page.keyboard.press("Control+z");
    await settle(900);
    await nothingLost();
  });

  test("3. cut again, then Restore from the panel: the passage returns to the conto and leaves the note", async () => {
    await cut(PARAS[3]);
    await waitDarlings(PARAS[3], true);
    await app.command("open-darlings");
    await app.page.evaluate(() => window.app.workspace.rightSplit.expand());
    await expect(card(PARAS[3])).toBeVisible();
    await card(PARAS[3]).locator('[data-escrita-action="restore"]').click();
    await app.waitFor("the passage back in the conto", async () => ((await editorText(CONTO)) ?? "").includes(PARAS[3]), 8000);
    await waitDarlings(PARAS[3], false);
    await nothingLost();
  });

  test("3. Delete another: it leaves the note, the others stay, and the darlings editor shows it at once", async () => {
    await cut(PARAS[4]);
    await waitDarlings(PARAS[4], true);
    await app.page.evaluate(() => window.app.workspace.rightSplit.expand());
    await expect(card(PARAS[4])).toBeVisible();
    await card(PARAS[4]).locator('[data-escrita-action="delete"]').click();
    await app.modal.getByRole("button", { name: "Excluir", exact: true }).click();
    await waitDarlings(PARAS[4], false);
    // the deleted passage is gone by choice; the rest is where it should be
    await nothingLost([PARAS[4]]);
    expect(await editorText(CONTO)).not.toContain(PARAS[4]);
    expect(await passages()).not.toContain(PARAS[4]);
  });
});

test.describe("Release-candidate fixes: dialogue focus keeps working (4)", () => {
  test.describe.configure({ timeout: 90_000 });
  let app: App;
  const NOTE = "Contos/O afogado.md";
  test.afterAll(async () => {
    await app?.close();
  });

  test("4. typing dialogue in a note with entry names while the universe panel updates: the dim and the name marks follow", async () => {
    app = await App.launch({ vault: world({ seeded: true }) });
    await app.setSettings({ ...WORLD_SETTINGS });
    await settle(1200);
    await app.openFile(NOTE);
    await app.command("toggle-dialogue-focus");
    await app.command("open-universe");
    await app.page.evaluate(() => window.app.workspace.leftSplit.expand());
    await expect(app.page.locator(".cm-content .escrita-name-mark").first()).toBeVisible({ timeout: 15_000 });
    const marks = () => app.page.locator(".cm-content .escrita-name-mark").count();
    const marksBefore = await marks();
    expect(marksBefore).toBeGreaterThan(0);
    const dimmed = () => app.page.locator(".cm-content .cm-line.escrita-dialogue-dim, .cm-content .escrita-dialogue-dim").count();
    expect(await dimmed()).toBeGreaterThan(0);

    // type a narration line and a dialogue line at the end while entries are created and renamed (the panel updates)
    await app.page.evaluate((path) => {
      const leaf = window.app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.file?.path === path);
      window.app.workspace.setActiveLeaf(leaf, { focus: true });
      const ed = leaf.view.editor;
      ed.focus();
      ed.setCursor({ line: ed.lastLine(), ch: ed.getLine(ed.lastLine()).length });
    }, NOTE);
    await app.page.keyboard.press("Enter");
    await app.page.keyboard.type("Maria foi até a porta e esperou.", { delay: 15 });
    app.writeVaultFile("Universo/Personagens/Joana.md", '---\ntype: personagem\nuniverse: "[[Universo]]"\n---\n');
    await app.page.keyboard.press("Enter");
    await app.page.keyboard.press("Enter");
    await app.page.keyboard.type("— Mari, volte logo — disse Joana.", { delay: 15 });
    app.writeVaultFile("Universo/Personagens/Joana.md", '---\ntype: personagem\nuniverse: "[[Universo]]"\naliases:\n  - Jo\n---\n');
    await settle(1200);

    const state = await app.page.evaluate(() => {
      const lines = [...document.querySelectorAll(".cm-content .cm-line")] as HTMLElement[];
      const find = (text: string) => lines.find((l) => l.innerText.includes(text));
      const dim = (l?: HTMLElement) => !!l && (l.classList.contains("escrita-dialogue-dim") || !!l.querySelector(".escrita-dialogue-dim"));
      const narration = find("Maria foi até a porta");
      const speech = find("— Mari, volte logo");
      return {
        narrationDim: dim(narration),
        speechDim: speech ? [...speech.querySelectorAll(".escrita-dialogue-dim")].map((e) => (e as HTMLElement).innerText) : null,
        speechLineDim: !!speech?.classList.contains("escrita-dialogue-dim"),
        speechMarks: speech ? [...speech.querySelectorAll(".escrita-name-mark")].map((e) => (e as HTMLElement).innerText) : null,
        narrationMarks: narration ? [...narration.querySelectorAll(".escrita-name-mark")].map((e) => (e as HTMLElement).innerText) : null,
      };
    });
    expect(state.narrationDim, JSON.stringify(state)).toBe(true);
    expect(state.speechLineDim, JSON.stringify(state)).toBe(false);
    expect(state.narrationMarks, JSON.stringify(state)).toContain("Maria");
    expect(state.speechMarks, JSON.stringify(state)).toContain("Mari");
    await app.screenshot("4. dialogue focus and name marks while typing");
  });
});
