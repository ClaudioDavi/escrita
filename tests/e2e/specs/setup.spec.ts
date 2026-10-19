// docs/TEST-1.0.md: G2a (the setup in an empty Portuguese vault, all steps) and G2b (an empty
// English vault, writing mode layout, steps 1-4).
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { SetupModal } from "../lib/setup-modal";
import { emptyEn, emptyPt } from "../fixtures";

const VIEWS = ["escrita-outline", "escrita-lens", "escrita-placeholders", "escrita-universe"];

test.describe("G2a: the setup in an empty vault, in Portuguese", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;
  let setup: SetupModal;

  test.beforeAll(async () => {
    app = await App.launch({ vault: emptyPt() });
    setup = new SetupModal(app);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("1. first run: a notice, not a modal, with Preparar… and Agora não", async () => {
    const notice = await app.notice("Escrita está pronto");
    await expect(notice).toContainText("Quer preparar este cofre para escrever? Mostro tudo antes de criar.");
    await expect(notice.getByRole("button", { name: "Preparar…" })).toBeVisible();
    await expect(notice.getByRole("button", { name: "Agora não" })).toBeVisible();
    await expect(app.page.locator(".modal-container")).toHaveCount(0);
    await app.screenshot("1. the first-run notice");
  });

  test("2. Agora não, then a restart: no notice again, setupOffered is saved", async () => {
    await (await app.notice("Escrita está pronto")).getByRole("button", { name: "Agora não" }).click();
    await expect(app.page.locator(".notice").filter({ hasText: "Escrita está pronto" })).toHaveCount(0);
    await app.waitFor("setupOffered in data.json", () => app.readData().setupOffered === true, 8000);
    await app.restart();
    await new Promise((r) => setTimeout(r, 2500));
    expect(await app.notices()).toEqual([]);
    expect(app.readData().setupOffered).toBe(true);
  });

  test("3. the command opens step 1: Os dois, Português (Brasil), Escritor, no shared world yet", async () => {
    await app.command("setup");
    await expect(setup.root).toBeVisible();
    await expect(setup.root.locator(".modal-title")).toHaveText("Preparar o cofre para escrever");
    expect((await setup.steps()).current).toBe("1 · Escolhas");
    await expect(setup.field("O que você escreve?")).toBeVisible();
    for (const name of ["Contos e ensaios", "Um romance", "Os dois"]) await expect(setup.chip(name)).toBeVisible();
    expect(await setup.pressed(setup.field("O que você escreve?"))).toEqual(["Os dois"]);
    await expect(setup.root.locator("select.escrita-setup-select")).toHaveValue("pt-BR");
    await expect(setup.field("Idioma dos padrões")).toContainText("Português (Brasil)");
    for (const name of ["Essencial", "Escritor", "Roteirista", "Tudo"]) await expect(setup.card(name)).toBeVisible();
    expect(await setup.pressed(setup.field("Ponto de partida"))).toEqual(["Escritor"]);
    await expect(setup.root.locator(".escrita-setup-label", { hasText: "Mundo compartilhado" })).toHaveCount(0);
    await app.screenshot("3. step 1");
  });

  test("4. Tudo asks for the shared world; Universo toggles; Escritor hides the question", async () => {
    await setup.card("Tudo").click();
    const world = setup.field("Mundo compartilhado");
    await expect(world).toBeVisible();
    for (const name of ["Desligado", "Por livro", "Universo"]) await expect(setup.chip(name)).toBeVisible();
    expect(await setup.pressed(world)).toEqual([]); // nothing picked
    await setup.chip("Universo").click();
    expect(await setup.pressed(world)).toEqual(["Universo"]);
    await setup.chip("Universo").click(); // again: unpicks ("decide later")
    expect(await setup.pressed(world)).toEqual([]);
    await setup.chip("Universo").click();
    await setup.card("Escritor").click();
    await expect(setup.root.locator(".escrita-setup-label", { hasText: "Mundo compartilhado" })).toHaveCount(0);
    await setup.card("Tudo").click();
    expect(await setup.pressed(setup.field("Mundo compartilhado"))).toEqual(["Universo"]);
  });

  test("5. Ver o que vou criar: folders, examples, settings, home note and the two layout cards", async () => {
    await setup.button("Ver o que vou criar").click();
    expect((await setup.steps()).current).toBe("2 · O que vou criar");
    const groups = await setup.preview();
    const titles = groups.map((g) => g.title);
    const order = ["Pastas", "Exemplos", "Configurações", "Nota inicial", "Layout"].map((t) => titles.indexOf(t));
    expect(order.every((i) => i >= 0), `groups: ${titles}`).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order); // board 36's order
    const group = (title: string) => groups.find((g) => g.title === title)!;

    const folders = group("Pastas").rows;
    expect(folders.map((r) => r.label)).toEqual(expect.arrayContaining(["Contos", "Livros"]));
    expect(folders.every((r) => r.mark === "+" || r.tick)).toBe(true);
    expect(folders.filter((r) => r.mark === null).length).toBe(1); // one tick, on the first row
    expect(folders[0].tick).toBe(true);

    const examples = group("Exemplos").rows;
    const labels = examples.map((r) => r.label).join("\n");
    for (const name of ["Contos/Exemplo · A travessia.md", "Livros/Exemplo · O farol", "Livros/Exemplo · O farol.md", "Capítulos", "01 Chegada.md", "02 A tempestade.md"]) {
      expect(labels, name).toContain(name);
    }
    expect(examples.filter((r) => r.pill === "exemplo").length).toBeGreaterThanOrEqual(4); // the notes
    expect(examples.filter((r) => r.mark === null).length).toBe(1);
    expect(examples[0].tick).toBe(true);

    const settings = group("Configurações").rows;
    const values = settings.map((r) => `${r.label} ${r.value}`).join("\n");
    expect(values).toContain("Recursos Tudo (20 de 20)");
    expect(values).toContain("Mundo compartilhado Universo");
    expect(settings.filter((r) => r.mark === null).length).toBeGreaterThanOrEqual(2); // the language group and the universe each have a tick
    expect(group("Nota inicial").rows.map((r) => r.label).join("\n")).toContain("Início.md");
    expect(group("Nota inicial").rows.map((r) => r.label).join("\n")).toContain("Abrir a nota inicial ao iniciar");
    await expect(setup.card("Mesa de escrita")).toBeVisible();
    await expect(setup.card("Modo escrita")).toBeVisible();
    expect(await setup.summary()).toContain("Nenhuma nota existente muda.");
    expect(await setup.summary()).toMatch(/Vou criar \d+ itens? e mudar \d+ configurações?\./);
    await app.screenshot("5. step 2");
  });

  test("6. unticking Exemplos greys the example rows and drops the counts", async () => {
    const before = await setup.summary();
    await setup.root.locator(".escrita-setup-ck").nth(1).click(); // the folders' tick is first, the examples' second
    const off = await setup.preview();
    const examples = off.find((g) => g.title === "Exemplos")!.rows;
    expect(examples.every((r) => r.off)).toBe(true);
    expect(await setup.summary()).not.toBe(before);
    await setup.root.locator(".escrita-setup-ck").nth(1).click();
    expect((await setup.preview()).find((g) => g.title === "Exemplos")!.rows.every((r) => !r.off)).toBe(true);
    expect(await setup.summary()).toBe(before);
  });

  test("7. Mesa de escrita, Criar: one notice, the home note in front, the panels in place", async () => {
    await setup.card("Mesa de escrita").click();
    expect(await setup.pressed(setup.root.locator(".escrita-setup-screens"))).toEqual(["Mesa de escrita"]);
    await setup.button("Criar").click();
    const notice = await app.notice("Pronto. Criei");
    await expect(notice).toContainText("A nota inicial está aberta.");
    expect((await app.notices()).filter((n) => n.includes("Pronto")).length).toBe(1);
    await expect(setup.root).toHaveCount(0);

    expect(await app.activeFile()).toBe("Início.md");
    const home = app.readVaultFile("Início.md");
    expect(home).toContain("Esta nota é sua.");
    expect(home).toContain("```escrita-works");
    expect(home).toContain("Exemplo ·");
    const rows = app.page.locator(".escrita-desk-section", { hasText: "Escrevendo" }).locator(".escrita-desk-row");
    await expect(rows).toHaveCount(2); // both examples, in the draft stage
    await expect(rows.filter({ hasText: "Exemplo · A travessia" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Exemplo · O farol" })).toHaveCount(1);

    const where = await app.placement(VIEWS);
    expect(where["escrita-outline"]).toMatchObject({ side: "right", front: "escrita-outline" });
    expect(where["escrita-lens"]).toMatchObject({ side: "right", front: "escrita-lens" });
    expect(where["escrita-lens"]!.tabs).toContain("escrita-placeholders"); // Marcadores behind the lens
    expect(where["escrita-placeholders"]).toMatchObject({ side: "right", front: "escrita-lens" });
    expect(where["escrita-outline"]!.index).toBeLessThan(where["escrita-lens"]!.index); // outline on top
    expect(where["escrita-universe"]).toMatchObject({ side: "left" });
    expect(where["escrita-universe"]!.tabs).toContain("file-explorer"); // the universe shares the files' tab group
    await app.screenshot("7. the desk layout");
  });

  // Found by task E (2026-10-16): the universe tab came to the front; fixed by the Wave 1 judge
  // (setup/layout.ts: a "leftTab" step is not a head, and opens inactive).
  test("7b. the universe panel is a tab behind the files on the left", async () => {
    const where = await app.placement(["escrita-universe"]);
    expect(where["escrita-universe"]!.front).toBe("file-explorer");
  });

  test("7c. the explorer's counts: the conto against 2000, the chapters their own targets", async () => {
    // the target is in the count's tooltip; the text shows it only with "Mostrar a meta ao lado da contagem"
    const tip = async (path: string) => {
      await app.openFile(path);
      await app.command("file-explorer:reveal-active-file");
      const loc = app.page.locator(`.nav-file-title[data-path="${path}"] .escrita-explorer-count`);
      await expect(loc).toBeVisible();
      return (await loc.getAttribute("aria-label")) ?? (await loc.getAttribute("data-tooltip")) ?? "";
    };
    expect(await tip("Contos/Exemplo · A travessia.md")).toMatch(/2\.000/);
    const chapters = [
      await tip("Livros/Exemplo · O farol/Capítulos/01 Chegada.md"),
      await tip("Livros/Exemplo · O farol/Capítulos/02 A tempestade.md"),
    ].join(" | ");
    expect(chapters).toMatch(/1\.200/);
    expect(chapters).toMatch(/1\.500/);
    expect(app.readVaultFile("Livros/Exemplo · O farol.md")).toMatch(/^chapterTarget: 1500$/m); // the chapters' default
    await app.screenshot("7. the explorer's counts");
  });

  test("8. the conto: prose under the first beat, a ghost second beat, a marked placeholder, dialogue focus", async () => {
    const path = "Contos/Exemplo · A travessia.md";
    const text = app.readVaultFile(path);
    const beats = [...text.matchAll(/^%% beat: .*%%$/gm)];
    expect(beats).toHaveLength(2);
    const after = (i: number) => text.slice(beats[i].index! + beats[i][0].length, beats[i + 1]?.index ?? text.length).trim();
    expect(after(0).length).toBeGreaterThan(0); // prose under the first beat
    expect(after(1)).toBe(""); // the second is a ghost
    expect(text).toMatch(/%% XXX: .+ %%/);
    expect(text).toMatch(/^— /m); // a dialogue line starts with a travessão

    await app.openFile(path);
    await expect(app.page.locator(".cm-content .escrita-placeholder").first()).toBeVisible();
    await app.command("toggle-dialogue-focus");
    await expect(app.page.locator(".cm-content.escrita-dialogue-focus, .escrita-dialogue-focus").first()).toBeVisible();
    await expect(app.page.locator(".escrita-dialogue-dim").first()).toBeVisible();
    await app.screenshot("8. the conto, dialogue focus on");
    await app.command("toggle-dialogue-focus");

    const chapter = app.readVaultFile("Livros/Exemplo · O farol/Capítulos/02 A tempestade.md");
    expect([...chapter.matchAll(/^%% beat: .*%%$/gm)]).toHaveLength(3);
    expect(chapter.replace(/^---[\s\S]*?^---$/m, "").replace(/^%% (beat|XXX): .*%%$/gm, "").trim()).toBe(""); // beats and a placeholder, no prose
  });

  test("9. Configurações › Escrita: statuses, chapters folder, Tudo, universe mode, open home on startup", async () => {
    expect(await app.setting("chaptersFolder")).toBe("Capítulos");
    expect(await app.setting("stages")).toMatchObject({
      idea: { words: "ideia" }, draft: { words: "rascunho" }, revision: { words: "revisão" }, ready: { words: "pronto" }, published: { words: "publicado" },
    });
    const features = await app.setting<Record<string, boolean>>("features");
    expect(Object.values(features).every((v) => v === true)).toBe(true); // Tudo: every switch on
    expect(await app.setting("explorerCounts")).toBe(true);
    expect(await app.setting("spellcheckOnDemand")).toBe(true);
    expect(await app.setting("universeMode")).toBe("universe");
    expect(await app.setting("openHomeOnStartup")).toBe(true);
    expect(await app.setting("homeNote")).toBe("Início.md");

    // and the tab itself
    const text = await app.openSettings();
    expect(text).toContain("Abrir ao iniciar"); // the settings row; the setup's preview calls it "Abrir a nota inicial ao iniciar"
    expect(text).toContain("rascunho");
    await app.closeModals();
  });

  test("10. a restart opens Início.md, with no first-run notice", async () => {
    await app.waitFor("data saved", () => app.readData().settings?.openHomeOnStartup === true, 8000);
    await app.restart();
    await app.waitFor("the home note", async () => (await app.activeFile()) === "Início.md", 15_000);
    await new Promise((r) => setTimeout(r, 1500));
    expect((await app.notices()).filter((n) => n.includes("Escrita está pronto"))).toEqual([]);
  });

  test("11. the command again: every row of folders, examples, settings and the home note stays (=)", async () => {
    await app.command("setup");
    await setup.card("Tudo").click();
    await setup.chip("Universo").click();
    await setup.button("Ver o que vou criar").click();
    const groups = await setup.preview();
    const rows = groups.filter((g) => g.title !== "Layout").flatMap((g) => g.rows);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((r) => r.mark !== "=").map((r) => `${r.label} [${r.mark}]`), "rows that would still change").toEqual([]);
    await app.screenshot("11. the second run");
  });

  test("11b. nothing to do: the summary says so and the only button besides Voltar is Fechar", async () => {
    expect(await setup.summary()).toBe("Tudo o que você escolheu já existe. Nada a fazer.");
    expect((await setup.root.locator(".escrita-setup-buttons button").allInnerTexts()).sort()).toEqual(["Fechar", "Voltar"]);
  });
});

test.describe("G2b: the setup in an empty vault, in English", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;
  let setup: SetupModal;

  test.beforeAll(async () => {
    app = await App.launch({ vault: emptyEn({ seeded: true }) });
    setup = new SetupModal(app);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("1. Short fiction, Essentials and Writing mode: only Stories/ and the example conto", async () => {
    await app.command("setup");
    await setup.chip("Short fiction").click();
    await setup.card("Essentials").click();
    await setup.button("See what I'll create").click();
    await setup.card("Writing mode").click();
    const groups = await setup.preview();
    const made = groups.filter((g) => g.title === "Folders" || g.title === "Examples").flatMap((g) => g.rows.map((r) => r.label));
    expect(made).toEqual(["Stories", "Stories/Example · The crossing.md"]);
    expect(groups.map((g) => g.title)).toContain("Layout");
    expect(await setup.pressed(setup.root.locator(".escrita-setup-screens"))).toEqual(["Writing mode"]);
    await app.screenshot("G2b 1. the preview");
  });

  test("2. Create: Home.md in writing mode, the exit button, the notice once, the goal counter", async () => {
    await setup.button("Create").click();
    await app.waitFor("writing mode", () => app.page.evaluate(() => document.body.classList.contains("escrita-writing-mode")), 15_000);
    expect(await app.activeFile()).toBe("Home.md");
    const hidden = (sel: string) => app.page.locator(sel).first().evaluate((e) => getComputedStyle(e).display === "none");
    for (const sel of [".workspace-ribbon", ".status-bar", ".workspace-tab-header-container", ".workspace-split.mod-left-split", ".workspace-split.mod-right-split"]) {
      expect(await hidden(sel), sel).toBe(true);
    }
    await expect(app.page.locator(".mod-root .view-header").first()).toBeVisible(); // the note's header stays
    await expect(app.page.locator(".escrita-writing-exit")).toHaveText("Exit writing mode");
    await app.notice("Writing mode. To leave: the button in the corner or the command.");
    const goal = await app.setting<number>("dailyGoal"); // TEST-1.0 says 500; the default is 1,000
    await expect(app.page.locator(".escrita-writing-goal")).toHaveText(`today 0 / ${goal.toLocaleString("en-US")}`);
    await app.screenshot("G2b 2. writing mode");
  });

  test("3. the settings say Open in writing mode; a restart opens Home.md in writing mode", async () => {
    expect(await app.setting("openInWritingMode")).toBe(true);
    expect(await app.setting("openHomeOnStartup")).toBe(true);
    const text = await app.openSettings();
    expect(text).toContain("Open in writing mode");
    expect(text).toContain("Open on startup"); // the settings row; the setup's preview calls it "Open the home note on startup"
    await app.closeModals();
    await app.waitFor("data saved", () => app.readData().settings?.openInWritingMode === true, 8000);
    await app.restart();
    await app.waitFor("writing mode", () => app.page.evaluate(() => document.body.classList.contains("escrita-writing-mode")), 15_000);
    expect(await app.activeFile()).toBe("Home.md");
  });
});

test.describe("G2b 4: the language tick off", () => {
  test.describe.configure({ timeout: 90_000 });
  let app: App;
  let setup: SetupModal;

  test.beforeAll(async () => {
    app = await App.launch({ vault: emptyEn({ seeded: true }) });
    setup = new SetupModal(app);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("4. Portuguese names, but the example book keeps the install's own chapters folder and still reads as a book", async () => {
    await app.command("setup");
    await setup.root.locator("select.escrita-setup-select").selectOption("pt-BR");
    await setup.button("See what I'll create").click();
    const label = "Include: ";
    const groups = await setup.preview();
    const languageTick = groups.flatMap((g) => g.rows).find((r) => r.tick && r.label !== "" && /language/i.test(r.label));
    expect(languageTick, "the language group's tick").toBeTruthy();
    await setup.tick(label, languageTick!.label).click();
    await setup.button("Create").click();
    await app.notice("Done");
    expect(app.listVaultFolder("")).toEqual(expect.arrayContaining(["Contos", "Livros"]));
    expect(app.listVaultFolder("Contos")).toContain("Exemplo · A travessia.md");
    expect(app.listVaultFolder("Livros/Exemplo · O farol")).toEqual(["Chapters"]); // the install's own, not "Capítulos"
    expect(await app.bookOf("Livros/Exemplo · O farol.md")).toEqual({ isBook: true, chapters: 2 });
  });
});
