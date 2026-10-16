// docs/TEST-1.0.md, "Demo findings (2026-10-09)": findings 1 to 10 and 13 to 18, numbered as there.
// Not scripted: colors and the legend of 16 are screenshots only; "Typewriter" (a third-party
// theme) in 1 and 6 stays by eye.
import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { App } from "../lib/app";
import { SetupModal } from "../lib/setup-modal";
import { overlappingPairs, settle } from "../lib/more";
import { WORLD_SETTINGS, world } from "../fixtures/h1";
import { emptyPt, writer } from "../fixtures";

test.describe("Demo findings: the setup (1, 7, 8, 9, 10)", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;
  let setup: SetupModal;

  const layoutRow = async () => (await setup.preview()).flatMap((g) => g.rows).find((r) => r.label === "Arrumar a tela uma vez")!;
  const openStep2 = async () => {
    await app.command("setup");
    await setup.button("Ver o que vou criar").click();
  };

  test.beforeAll(async () => {
    app = await App.launch({ vault: emptyPt({ seeded: true }) });
    setup = new SetupModal(app);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("10. step 1: the text of Essencial, Escritor and Tudo starts at the top of each card", async () => {
    await app.command("setup");
    const tops = await setup.root.locator(".escrita-setup-card").evaluateAll((cards) => cards.map((c) => {
      const box = c.getBoundingClientRect();
      const first = [...c.querySelectorAll("*")].find((e) => (e.textContent ?? "").trim() !== "" && e.children.length === 0) as HTMLElement;
      return { name: (c.querySelector("b") as HTMLElement | null)?.innerText ?? "", offset: first.getBoundingClientRect().top - box.top, height: box.height };
    }));
    const presets = tops.filter((c) => ["Essencial", "Escritor", "Tudo"].includes(c.name));
    expect(presets.map((c) => c.name)).toEqual(["Essencial", "Escritor", "Tudo"]);
    for (const c of presets) expect(c.offset, `${c.name}: title ${c.offset}px below the card's top edge`).toBeLessThanOrEqual(24);
    expect(Math.max(...presets.map((c) => c.offset)) - Math.min(...presets.map((c) => c.offset))).toBeLessThanOrEqual(1);
    await app.screenshot("10. the preset cards", setup.root);
  });

  test("1. step 2: no row overlaps another, the paths, reasons and badges each on their own line", async () => {
    await setup.button("Ver o que vou criar").click();
    expect((await setup.steps()).current).toBe("2 · O que vou criar");
    expect(await overlappingPairs(setup.root.locator(".escrita-setup-scroll"))).toEqual([]);
    const rows = await setup.root.locator(".escrita-setup-row").evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    }));
    for (let i = 1; i < rows.length; i++) expect(rows[i].top, `row ${i} starts below row ${i - 1}`).toBeGreaterThanOrEqual(rows[i - 1].bottom - 1);
    await app.screenshot("1. step 2 (default theme)", setup.root);
    await app.setTheme("light");
    expect(await overlappingPairs(setup.root.locator(".escrita-setup-scroll"))).toEqual([]);
    await app.screenshot("1. step 2 (light)", setup.root);
    await app.setTheme("dark");
  });

  test("9. step 2: the startup row has its own reason, not the language one", async () => {
    const rows = (await setup.preview()).flatMap((g) => g.rows);
    const startup = rows.find((r) => r.label === "Abrir a nota inicial ao iniciar")!;
    expect(startup.reason).toBe("Abre a nota inicial toda vez que o Obsidian começa.");
    const language = rows.find((r) => r.label === "Idioma da escrita")!;
    expect(language.reason).toBe("Definida para o idioma que você escolheu.");
    expect(startup.reason).not.toBe(language.reason);
  });

  test("7. a fresh vault: Arrumar a tela uma vez comes ticked; with two notes in tabs it comes unticked and says so", async () => {
    expect((await layoutRow()).tick).toBe(true);
    await setup.button(/Cancelar/).click();
    await app.page.evaluate(async () => {
      for (const name of ["Primeira", "Segunda"]) {
        const f = await app.vault.create(`${name}.md`, `${name}\n`);
        await app.workspace.getLeaf("tab").openFile(f, { active: true });
      }
    });
    await settle();
    await openStep2();
    const row = await layoutRow();
    expect(row.tick).toBe(false);
    expect(row.reason).toBe("Desmarcado: você já tem 2 notas abertas em abas.");
    await app.screenshot("7. the layout row, two notes open", setup.root);
  });

  test("8. ticking the layout row changes its reason to 'Marcado por você: será feito.'; unticking brings the old one back", async () => {
    const before = await layoutRow();
    await setup.tick("Incluir: ", "Arrumar a tela uma vez").click();
    const ticked = await layoutRow();
    expect(ticked.tick).toBe(true);
    expect(ticked.reason).toBe("Marcado por você: será feito.");
    await setup.tick("Incluir: ", "Arrumar a tela uma vez").click();
    const after = await layoutRow();
    expect(after.tick).toBe(false);
    expect(after.reason).toBe(before.reason);
  });
});

test.describe("Demo findings: the home note row (9)", () => {
  test.describe.configure({ timeout: 90_000 });
  let app: App;

  test.beforeAll(async () => {
    app = await App.launch({ vault: writer({ seeded: true }) });
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("9. a vault with Início.md and no home note setting: the setting row says what it does, apart from the language row", async () => {
    expect(await app.setting("homeNote")).toBe("");
    const setup = new SetupModal(app);
    await app.command("setup");
    await setup.button("Ver o que vou criar").click();
    const rows = (await setup.preview()).flatMap((g) => g.rows);
    const home = rows.find((r) => r.reason === "Aponta o Escrita para esta nota inicial.");
    expect(home, JSON.stringify(rows.map((r) => [r.label, r.reason]))).toBeTruthy();
    const language = rows.find((r) => r.label === "Idioma da escrita")!;
    expect(home!.reason).not.toBe(language.reason);
    expect(home!.label).toBe("Nota inicial");
    await app.screenshot("9. the home note rows", setup.root);
  });
});

test.describe("Demo findings: the universe note (3)", () => {
  test.describe.configure({ timeout: 90_000 });
  let app: App;
  let setup: SetupModal;

  test.afterEach(async () => {
    await app?.close();
  });

  const toStep2 = async () => {
    await app.command("setup");
    await setup.card("Tudo").click();
    await setup.chip("Universo").click();
    await setup.button("Ver o que vou criar").click();
  };
  const universeRows = async () => (await setup.preview()).find((g) => g.title === "Nota do universo")?.rows ?? [];

  test("3. a fresh vault with Universo: Universo.md is a ticked + row; after Criar it exists and the desk shows no 'não existe' message", async () => {
    app = await App.launch({ vault: emptyPt({ seeded: true }) });
    setup = new SetupModal(app);
    await toStep2();
    const rows = await universeRows();
    // the row shares the "Mundo compartilhado" tick, so it has no box of its own: it is ticked when it is not greyed
    expect(rows.map((r) => [r.label, r.mark, r.off])).toEqual([["Universo.md", "+", false]]);
    await app.screenshot("3. step 2 with the universe note", setup.root);
    await setup.button("Criar").click();
    await app.notice("Pronto. Criei");
    expect(app.vaultFileExists("Universo.md")).toBe(true);
    await settle(2500);
    expect((await app.notices()).filter((n) => n.includes("não existe"))).toEqual([]);
    await app.command("open-home-note");
    await settle(1500);
    expect((await app.notices()).filter((n) => n.includes("não existe"))).toEqual([]);
  });

  test("3. with universo.md already there: nothing new is listed and the note is left untouched", async () => {
    const base = emptyPt({ seeded: true });
    app = await App.launch({ vault: { ...base, files: { ...base.files, "universo.md": "Meu mundo.\n" } } });
    setup = new SetupModal(app);
    await toStep2();
    const rows = await universeRows();
    expect(rows.map((r) => r.mark), JSON.stringify(rows)).not.toContain("+");
    expect(rows.length === 0 || rows.every((r) => r.mark === "=")).toBe(true);
    await app.screenshot("3. step 2, the note exists", setup.root);
    await setup.button("Criar").click();
    await app.notice("Pronto.");
    expect(app.readVaultFile("universo.md")).toBe("Meu mundo.\n");
    expect(app.vaultFileExists("Universo.md")).toBe(false);
  });
});

test.describe("Demo findings: the home note on startup (2)", () => {
  test.describe.configure({ timeout: 120_000 });
  let app: App;

  test.beforeAll(async () => {
    app = await App.launch({ vault: writer({ seeded: true }) });
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("2. Início.md opens in the main area after a restart, and the right sidebar stays on Escrita's outline", async () => {
    await app.setSettings({ homeNote: "Início.md", openHomeOnStartup: true });
    await app.openFile("Início.md");
    // the core Outline panel, on the home note
    await app.page.evaluate(async () => {
      const leaf = app.workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: "outline", active: true });
    });
    await app.command("open-outline"); // Escrita's outline comes to the front of the right sidebar
    await app.openFile("Contos/O afogado.md");
    await settle(1200);
    const before = await app.placement(["escrita-outline", "outline"]);
    expect(before["outline"]).toMatchObject({ side: "right" });
    expect(before["escrita-outline"]).toMatchObject({ side: "right", front: "escrita-outline" });
    // let Obsidian write the layout before the window is closed
    await app.page.evaluate(async () => { await app.workspace.requestSaveLayout.run?.(); });
    await settle(2500);

    await app.restart();
    await app.waitFor("the home note", async () => (await app.activeFile()) === "Início.md", 20_000);
    await settle(1500);
    const where = await app.page.evaluate(() => {
      const leaf = app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.file?.path === "Início.md");
      return leaf ? (leaf.getRoot() === app.workspace.rootSplit ? "main" : "side") : "none";
    });
    expect(where).toBe("main");
    const after = await app.placement(["escrita-outline", "outline"]);
    expect(after["escrita-outline"], JSON.stringify(after)).toMatchObject({ side: "right", front: "escrita-outline" });
    await app.screenshot("2. after the restart");
  });
});

test.describe("Demo findings: the compare title (5)", () => {
  test.describe.configure({ timeout: 120_000 });
  let app: App;

  test.beforeAll(async () => {
    app = await App.launch({ vault: writer({ seeded: true }) });
  });
  test.afterAll(async () => {
    await app?.close();
  });

  /** The compare view's tab title and its header title, from the DOM. */
  const titles = () => app.page.evaluate(() => {
    const leaf = app.workspace.getLeavesOfType("escrita-snapshot-compare")[0];
    if (!leaf) return null;
    const header = leaf.tabHeaderEl?.querySelector(".workspace-tab-header-inner-title")?.textContent ?? "";
    const view = (leaf.view.containerEl.querySelector(".view-header-title") as HTMLElement | null)?.innerText ?? "";
    return { header, view, display: leaf.view.getDisplayText() };
  });

  test("5. Comparar “<nota>”: the tab and the view header read it, after a restart, and follow a rename", async () => {
    const path = "Contos/O afogado.md";
    await app.openFile(path);
    await app.command("take-snapshot");
    await app.page.locator(".modal input").press("Enter"); // the name prompt: the default name
    await app.waitFor("the snapshot", () => app.listVaultFolder("Escrita/Versões").length > 0 || app.listVaultFolder("Escrita/Snapshots").length > 0, 10_000);
    await app.writeVaultFile(path, app.readVaultFile(path) + "\nMais uma linha.\n");
    await settle(800);
    await app.command("compare-last-snapshot");
    await app.waitFor("the compare view", async () => (await titles()) !== null, 10_000);
    await settle(600);
    expect(await titles()).toEqual({ header: "Comparar “O afogado”", view: "Comparar “O afogado”", display: "Comparar “O afogado”" });
    await app.screenshot("5. the compare view");

    await app.page.evaluate(async () => { await app.workspace.requestSaveLayout.run?.(); });
    await settle(2500);
    await app.restart();
    await app.waitFor("the compare view after the restart", async () => (await titles()) !== null, 20_000);
    await settle(800);
    expect(await titles()).toEqual({ header: "Comparar “O afogado”", view: "Comparar “O afogado”", display: "Comparar “O afogado”" });

    await app.page.evaluate(async () => {
      await app.fileManager.renameFile(app.vault.getFileByPath("Contos/O afogado.md")!, "Contos/O náufrago.md");
    });
    await app.waitFor("the renamed title", async () => (await titles())?.header === "Comparar “O náufrago”", 10_000);
    expect(await titles()).toEqual({ header: "Comparar “O náufrago”", view: "Comparar “O náufrago”", display: "Comparar “O náufrago”" });
  });
});

test.describe("Demo findings: Escape on a new beat (4)", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;
  const CHAPTER = "Livros/O farol/Capítulos/02 A tempestade.md";
  const ORIGINAL = [
    "%% beat: a chegada %%", "", "Ela chegou.", "", "---", "",
    "%% beat: a conversa %%", "", "Falaram.", "", "---", "",
    "%% beat: a partida %%", "",
  ].join("\n");

  const beatsIn = (text: string) => [...text.matchAll(/^%% beat: (.*) %%$/gm)].map((m) => m[1]);
  const field = (n: number) => app.page.locator(".escrita-outline-beat-text").nth(n);
  /** Focus beat `n`, put the caret at its end and press Enter: a new empty beat follows and takes the focus. */
  async function enterOnBeat(n: number): Promise<void> {
    await field(n).click();
    await app.page.keyboard.press("End");
    await app.page.keyboard.press("Enter");
    await app.waitFor("a new beat in the chapter", () => beatsIn(app.readVaultFile(CHAPTER)).length === 4, 8000);
    await expect(app.page.locator(".escrita-outline-beat-text")).toHaveCount(4);
    await settle(400);
  }
  const restoreChapter = async () => {
    app.writeVaultFile(CHAPTER, ORIGINAL);
    await app.waitFor("the original chapter back in the outline", async () => (await app.page.locator(".escrita-outline-beat-text").count()) === 3, 8000);
    await settle(500);
  };

  test.beforeAll(async () => {
    const base = writer({ seeded: true });
    app = await App.launch({ vault: { ...base, files: { ...base.files, [CHAPTER]: ORIGINAL } } });
    await app.openFile(CHAPTER);
    await app.command("open-outline");
    await expect(app.page.locator(".escrita-outline-beat-text")).toHaveCount(3);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("4. Enter on a beat, a few words, Escape: the new beat and the --- lines around it are gone, the others untouched", async () => {
    await enterOnBeat(1);
    expect(beatsIn(app.readVaultFile(CHAPTER))).toEqual(["a chegada", "a conversa", "", "a partida"]);
    await app.page.keyboard.type("um beat que não fica");
    await app.screenshot("4. a new beat with words");
    await app.page.keyboard.press("Escape");
    await app.waitFor("the chapter back as it was", () => app.readVaultFile(CHAPTER) === ORIGINAL, 8000);
    await expect(app.page.locator(".escrita-outline-beat-text")).toHaveCount(3);
  });

  test("4. again with nothing typed: the same result", async () => {
    await enterOnBeat(1);
    await app.page.keyboard.press("Escape");
    await app.waitFor("the chapter back as it was", () => app.readVaultFile(CHAPTER) === ORIGINAL, 8000);
    await expect(app.page.locator(".escrita-outline-beat-text")).toHaveCount(3);
  });

  test("4. the chapter edited in the editor before Escape: the beat stays", async () => {
    await enterOnBeat(1);
    const edited = app.readVaultFile(CHAPTER) + "\nUma linha escrita no editor.\n";
    // an edit through the editor (it is open on this chapter)
    await app.page.evaluate((text) => { app.workspace.getLeavesOfType("markdown").map((l: any) => l.view).find((v: any) => v.file.path.endsWith("02 A tempestade.md"))?.editor.setValue(text); }, edited);
    await app.waitFor("the editor's edit on disk", () => app.readVaultFile(CHAPTER).includes("Uma linha escrita no editor."), 8000);
    await app.page.locator(".escrita-outline-beat-text").nth(2).focus();
    await app.page.locator(".escrita-outline-beat-text").nth(2).press("Escape");
    await settle(1200);
    const text = app.readVaultFile(CHAPTER);
    expect(beatsIn(text)).toHaveLength(4);
    expect(text).toContain("Uma linha escrita no editor.");
  });

  test("4. Tab away from a new beat: it stays", async () => {
    await restoreChapter();
    await enterOnBeat(1);
    await app.page.keyboard.press("Tab");
    await settle(800);
    expect(beatsIn(app.readVaultFile(CHAPTER))).toHaveLength(4);
  });
});

test.describe("Demo findings: name variants in the lens (6)", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;

  /** The geometry of every rule row at the current sidebar width: what overlaps what, and whether the name leaves its row. */
  const geometry = () => app.page.evaluate(() => {
    const out: { rule: string; problems: string[]; lines: number }[] = [];
    for (const row of document.querySelectorAll(".escrita-lens-row")) {
      const r = row.getBoundingClientRect();
      const parts = [".escrita-lens-key", ".escrita-lens-rulename", ".escrita-lens-count", ".escrita-lens-rate", ".escrita-lens-step", ".escrita-lens-hint"]
        .flatMap((sel) => [...row.querySelectorAll(sel)].map((el) => ({ sel, el: el as HTMLElement, b: el.getBoundingClientRect() })))
        .filter((p) => p.b.width > 0 && p.b.height > 0);
      const problems: string[] = [];
      for (const p of parts) if (p.b.left < r.left - 1 || p.b.right > r.right + 1) problems.push(`${p.sel} leaves the row`);
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i].b, b = parts[j].b;
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) problems.push(`${parts[i].sel} x ${parts[j].sel}`);
      }
      const name = row.querySelector(".escrita-lens-rulename") as HTMLElement;
      const lh = parseFloat(getComputedStyle(name).lineHeight) || parseFloat(getComputedStyle(name).fontSize) * 1.4;
      out.push({ rule: name.innerText, problems, lines: Math.round(name.getBoundingClientRect().height / lh) });
    }
    return out;
  });

  test.beforeAll(async () => {
    app = await App.launch({ vault: world({ seeded: true }) });
    await app.setSettings({ ...WORLD_SETTINGS });
    await app.openFile("Contos/O afogado.md");
    await app.command("toggle-revision-lens");
    await app.page.evaluate(() => {
      app.workspace.rightSplit.expand();
      const rs: any = app.workspace.rightSplit;
      rs.size = 320;
      rs.containerEl.style.width = "320px";
    });
    await expect(app.page.locator(".escrita-lens-row").first()).toBeVisible();
    await settle(600);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  const check = async (label: string) => {
    const width = await app.page.locator(".workspace-split.mod-right-split").evaluate((e) => e.getBoundingClientRect().width);
    expect(Math.round(width), "the sidebar is about 320 px").toBeLessThanOrEqual(330);
    const rows = await geometry();
    const variant = rows.find((r) => r.rule === "Variantes de nome")!;
    expect(variant, JSON.stringify(rows)).toBeTruthy();
    for (const r of rows) expect(r.problems, `${label}: ${r.rule}`).toEqual([]);
    test.info().annotations.push({ type: `${label}: Variantes de nome lines`, description: String(variant.lines) });
  };

  test("6. the rule name wraps inside its button and never covers the colour key or the counts (waiting for the lists note), dark then light", async () => {
    await app.setTheme("dark");
    await check("dark, no lists");
    await app.screenshot("6. the lens at 320 px, dark", app.page.locator(".workspace-split.mod-right-split"));
    await app.setTheme("light");
    await check("light, no lists");
    await app.screenshot("6. the lens at 320 px, light", app.page.locator(".workspace-split.mod-right-split"));
  });

  test("6. the same once the word lists note exists (the rule has a count and steppers)", async () => {
    app.writeVaultFile("Listas de palavras.md", "# Listas de palavras\n\n## Vícios\n\n- de repente\n- viu\n\n## Nomes\n\n- Maria\n- Teo\n");
    await app.setSettings({ lensListsNote: "Listas de palavras.md" });
    await settle(1200);
    await app.openFile("Contos/O afogado.md");
    await settle(1500);
    await expect(app.page.locator(".escrita-lens-row:not(.escrita-lens-row-wait)").filter({ hasText: "Variantes de nome" })).toHaveCount(1);
    await check("light, lists");
    await app.setTheme("dark");
    await check("dark, lists");
    await app.screenshot("6. the lens with the lists note, dark", app.page.locator(".workspace-split.mod-right-split"));
  });
});

test.describe("Demo findings: a new entry (13, 17, 18)", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;
  const ENTRY = "Universo/Personagens/Teo.md";
  const SOURCE = "Contos/O afogado.md";

  test.beforeAll(async () => {
    app = await App.launch({ vault: world({ seeded: true }) });
    await app.setSettings({ ...WORLD_SETTINGS });
    await settle(1500);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  let layout: { inMain: boolean; groups: number; active: string | null; cursorFile: string | null; current: number; tabs: string[] };
  let groupsBefore = 0;

  test("17. Create entry from the selection 'Teo': the entry opens in a new tab of the main area, not in a split", async () => {
    await app.openFile(SOURCE);
    groupsBefore = await app.page.evaluate(() => {
      const roots = new Set<unknown>();
      app.workspace.iterateRootLeaves((l: any) => roots.add(l.parent));
      return roots.size;
    });
    const at = await app.page.evaluate(() => {
      const ed = app.workspace.activeEditor!.editor!;
      const text = ed.getValue();
      const i = text.indexOf("Teo chegou");
      ed.setSelection(ed.offsetToPos(i), ed.offsetToPos(i + 3));
      ed.focus();
      return i;
    });
    expect(at).toBeGreaterThan(0);
    await app.command("create-entry");
    await expect(app.page.locator(".modal.escrita-universe-create")).toBeVisible();
    await expect(app.page.locator(".escrita-universe-create input[type=text]").first()).toHaveValue("Teo");
    await app.screenshot("13. the create-entry modal");

    // 13: record what the entry's "Appears in" says from now on: the summary line in the DOM and the model's answer
    await app.page.evaluate((path) => {
      const w = window as any;
      w.__ai = [];
      const src = app.plugins.plugins.escrita.features.get("universe")?.appearsInSource?.();
      const last = { dom: "", model: "" };
      w.__aiTimer = setInterval(() => {
        const dom = (document.querySelector(".escrita-ai-summary") as HTMLElement | null)?.innerText ?? "";
        const a = src?.appearsIn(path);
        const model = a === "counting" ? "counting" : a ? `${a.workCount} works ${a.total} mentions` : String(a);
        if (dom !== last.dom || model !== last.model) { w.__ai.push({ t: Math.round(performance.now()), dom, model }); last.dom = dom; last.model = model; }
      }, 15);
    }, ENTRY);
    await app.page.keyboard.press("Enter"); // creates it
    await app.waitFor("the entry note", () => app.vaultFileExists(ENTRY), 8000);
    await app.waitFor("the entry open", async () => app.page.evaluate((p) => app.workspace.getLeavesOfType("markdown").some((l: any) => l.view.file?.path === p), ENTRY), 8000);
    await settle(800); // the modal returns the focus to the chapter once the note is open
    layout = await app.page.evaluate((p) => {
      const leaf = app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.file?.path === p)!;
      const roots = new Set<unknown>();
      app.workspace.iterateRootLeaves((l: any) => roots.add(l.parent));
      const group = leaf.parent;
      return {
        inMain: leaf.getRoot() === app.workspace.rootSplit,
        groups: roots.size,
        active: app.workspace.getActiveFile()?.path ?? null,
        cursorFile: app.workspace.activeEditor?.file?.path ?? null,
        current: group.currentTab,
        tabs: group.children.map((c: any) => c.view.file?.path),
      };
    }, ENTRY);
    expect(layout.inMain).toBe(true);
    expect(layout.groups, "a tab beside the chapter, not a split").toBe(groupsBefore);
    expect(layout.tabs).toEqual([SOURCE, ENTRY]);
    await app.screenshot("17. after the entry is created");
  });

  // FINDING (task H1, 2026-10-16, Obsidian 1.14.4): src/universe/create.ts `openBeside` opens the entry with
  // `getLeaf("tab")` and `openFile(file, { active: false })`, expecting the chapter to stay in front. On 1.14.4 the
  // new tab becomes the group's current tab and the active leaf, whatever `active` says (plain Obsidian calls do the
  // same), so the chapter is hidden and the writer's cursor is in the entry note. Drop test.fail() when the entry
  // opens in the background (for example by selecting the old tab again after openFile) or the expectation changes.
  test("17. ...and the cursor stays in the chapter", async () => {
    test.fail();
    expect(layout.current, "the chapter's tab is still in front").toBe(0);
    expect(layout.active).toBe(SOURCE);
    expect(layout.cursorFile).toBe(SOURCE);
  });

  test("13. 'Aparece em' goes from 'contando…' (if at all) to '2 obras · 3 menções', never 'nenhuma obra ainda' first", async () => {
    await app.page.evaluate((p) => {
      const leaf = app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.file?.path === p)!;
      app.workspace.setActiveLeaf(leaf, { focus: true });
    }, ENTRY);
    await app.waitFor("the final answer", async () =>
      (await app.page.evaluate(() => ((window as any).__ai as { model: string }[]).some((s) => s.model === "2 works 3 mentions"))), 15_000)
      .catch(async (e) => { throw new Error(`${e.message}; seen ${JSON.stringify(await app.page.evaluate(() => (window as any).__ai))}`); });
    await settle(600);
    const seen = await app.page.evaluate(() => { clearInterval((window as any).__aiTimer); return (window as any).__ai as { dom: string; model: string }[]; });
    test.info().annotations.push({ type: "answers seen", description: JSON.stringify(seen.map((s) => [s.dom, s.model])) });
    const texts = seen.flatMap((s) => [s.dom, s.model]);
    expect(texts.filter((x) => /nenhuma obra ainda|0 works 0 mentions/.test(x)), JSON.stringify(seen)).toEqual([]);
    await expect(app.page.locator(".escrita-ai-summary").first()).toHaveText("2 obras · 3 menções");
    await app.screenshot("13. Aparece em", app.page.locator(".escrita-ai-section").first());
  });

  test("18. the universe panel: a click on '2 obras' opens the list, a click on the rest of the row opens the entry", async () => {
    await app.openFile(SOURCE);
    await app.command("open-universe");
    const row = app.page.locator(".escrita-universe-entry").filter({ has: app.page.locator(".escrita-universe-entry-name", { hasText: /^Teo$/ }) });
    await expect(row).toBeVisible();
    const count = row.locator(".escrita-ai-count");
    await expect(count).toHaveText("2 obras");
    await count.click();
    const panel = app.page.locator(".escrita-ai-panel");
    await expect(panel).toBeVisible();
    await expect(panel.locator(".escrita-ai-row.is-work")).toHaveCount(2);
    expect(await app.activeFile(), "the count button does not open the note").toBe(SOURCE);
    await app.screenshot("18. the list under the row", app.page.locator(".escrita-universe-groups").first());
    await row.locator(".escrita-universe-entry-text").click();
    await app.waitFor("the entry note", async () => (await app.activeFile()) === ENTRY, 8000);
  });
});

test.describe("Demo findings: export (14, 15)", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;

  const chip = (name: string) => app.page.locator(".escrita-export-chip").filter({ hasText: new RegExp(`^${name}`) });
  /** The text of an entry of an EPUB or DOCX on the host (unzip -p). */
  const zipText = (file: string, entry: string) => execFileSync("unzip", ["-p", app.vaultDir + "/" + file, entry], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  const zipList = (file: string) => execFileSync("unzip", ["-Z1", app.vaultDir + "/" + file], { encoding: "utf8" }).split("\n").filter(Boolean);
  const plain = (xml: string) => xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  test.beforeAll(async () => {
    app = await App.launch({ vault: writer({ seeded: true }) });
    await app.setSettings({ authorName: "Claudio", authorSurname: "Davi", trackFolders: "Contos\nLivros\nTextos" });
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("14. an EPUB of a conto: the title page reads 'por Claudio Davi'; the DOCX header still uses 'Davi'", async () => {
    await app.openFile("Contos/O afogado.md");
    await app.command("export");
    await expect(app.modal).toBeVisible();
    await chip("EPUB").click();
    await app.screenshot("14. the export modal on EPUB", app.modal);
    await app.modal.getByRole("button", { name: "Exportar", exact: true }).click();
    await app.waitFor("the EPUB", () => app.listVaultFolder("Escrita/Exportações").some((n) => n.endsWith(".epub")), 15_000);
    const epub = "Escrita/Exportações/" + app.listVaultFolder("Escrita/Exportações").find((n) => n.endsWith(".epub"))!;
    const entries = zipList(epub);
    const titlePage = entries.filter((e) => /title|cover|front/i.test(e) && /x?html$/.test(e));
    const all = entries.filter((e) => /\.x?html$/.test(e)).map((e) => ({ e, text: plain(zipText(epub, e)) }));
    const found = all.find((x) => /por Claudio Davi/.test(x.text));
    expect(found, `entries ${titlePage.join(", ")}; texts ${JSON.stringify(all.map((x) => [x.e, x.text.slice(0, 80)]))}`).toBeTruthy();

    // the DOCX of the same note: the running header is the surname
    await app.command("export");
    await expect(app.modal).toBeVisible();
    await chip("DOCX").click();
    await app.modal.getByRole("button", { name: "Exportar", exact: true }).click();
    await app.waitFor("the DOCX", () => app.listVaultFolder("Escrita/Exportações").some((n) => n.endsWith(".docx")), 15_000);
    const docx = "Escrita/Exportações/" + app.listVaultFolder("Escrita/Exportações").find((n) => n.endsWith(".docx"))!;
    const headers = zipList(docx).filter((e) => /word\/header\d*\.xml$/.test(e)).map((e) => plain(zipText(docx, e)));
    expect(headers.length).toBeGreaterThan(0);
    expect(headers.join(" | ")).toContain("Davi");
    expect(headers.join(" | ")).not.toContain("Claudio");
  });

  test("15. the EPUB preview of a book: one 'Sumário' heading, no 'SUMÁRIO' divider above it", async () => {
    await app.closeModals();
    await app.openFile("Livros/O farol.md");
    await app.command("export");
    await expect(app.modal).toBeVisible();
    await chip("EPUB").click();
    await app.modal.getByRole("button", { name: "Prévia", exact: true }).click();
    const scroll = app.page.locator(".escrita-export-scroll");
    await expect(scroll).toBeVisible();
    await expect(scroll).toContainText("Sumário");
    await settle(800);
    const text = await scroll.innerText();
    const inText = (re: RegExp) => (text.match(re) ?? []).length;
    expect(inText(/Sumário/g), text.slice(0, 600)).toBe(1);
    expect(inText(/SUMÁRIO/g)).toBe(0);
    await app.screenshot("15. the EPUB preview", app.modal);
  });
});

test.describe("Demo findings: progress for a book (16)", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;

  const isoDay = (back: number) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const modal = () => app.page.locator(".modal").filter({ has: app.page.locator(".escrita-chart") });
  const legend = () => modal().locator(".escrita-legend-item").allInnerTexts();
  const streakSub = () => modal().locator(".escrita-tile").filter({ has: app.page.locator(".escrita-streak-segments") }).locator(".escrita-tile-sub");

  test.beforeAll(async () => {
    // four days that met the 1,000-word daily goal, so the chart has goal-coloured bars to hide
    const history = Object.fromEntries([1, 2, 3, 5].map((back) => [isoDay(back), { added: 1500, deleted: 0, books: {} }]));
    const base = writer();
    app = await App.launch({ vault: { ...base, data: { setupOffered: true, history } } });
    await app.setSettings({ trackFolders: "Contos\nLivros\nTextos" });
  });
  test.afterAll(async () => {
    await app?.close();
  });

  const open = async (note: string) => {
    await app.closeModals();
    await app.openFile(note);
    await app.command("open-progress");
    await expect(modal()).toBeVisible();
    await expect(modal().locator(".escrita-chart-legend")).toBeVisible();
  };

  test("16. from a book: no goal-coloured bars, no 'Meta batida', the bars are 'Palavras neste livro', the streak line is 'em toda a sua escrita'", async () => {
    await open("Livros/O farol/Capítulos/01 Chegada.md");
    const items = await legend();
    expect(items).toContain("Palavras neste livro");
    expect(items).not.toContain("Meta batida");
    await expect(modal().locator(".escrita-chart-bar.is-met")).toHaveCount(0);
    await expect(streakSub()).toContainText("em toda a sua escrita");
    const lines = await streakSub().evaluate((el) => Math.round(el.getBoundingClientRect().height / (parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.4)));
    expect(lines, "the streak line wraps to one or two lines").toBeLessThanOrEqual(2);
    await app.screenshot("16. progress from a book (colours: by eye)", modal());
  });

  test("16. from a conto: 'Palavras neste texto', and the same rules", async () => {
    await open("Contos/O afogado.md");
    const items = await legend();
    expect(items).toContain("Palavras neste texto");
    expect(items).not.toContain("Meta batida");
    await expect(modal().locator(".escrita-chart-bar.is-met")).toHaveCount(0);
    await expect(streakSub()).toContainText("em toda a sua escrita");
    await app.screenshot("16. progress from a conto (colours: by eye)", modal());
  });

  // FINDING (task H1, 2026-10-16, Obsidian 1.14.4): with no book or piece, a day that met the goal makes
  // src/goals/progress-modal.ts:374 call createSvg("rect", { cls: "escrita-chart-bar is-met" }). Obsidian's
  // createSvg adds `cls` with classList.add, which throws InvalidCharacterError on a token with a space, so the
  // whole chart (bars, goal line, legend) is missing from "Progress" for anyone who ever met a daily goal.
  // The fix is `cls: ["escrita-chart-bar", "is-met"]` (or two class names). Drop test.fail() once fixed.
  test("16. with no book or piece: the goal colour and the 'Meta batida' legend entry are back", async () => {
    test.fail();
    await open("Início.md");
    const items = await legend();
    expect(items).toContain("Meta batida");
    expect(items).not.toContain("Palavras neste livro");
    expect(await modal().locator(".escrita-chart-bar.is-met").count()).toBeGreaterThan(0);
    await app.screenshot("16. progress with no book (colours: by eye)", modal());
  });
});
