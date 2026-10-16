// docs/TEST-1.0.md, "Demo findings (2026-10-09)": findings 1 to 10 and 13 to 18, numbered as there.
// Not scripted: colors and the legend of 16 are screenshots only; "Typewriter" (a third-party
// theme) in 1 and 6 stays by eye.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { SetupModal } from "../lib/setup-modal";
import { overlappingPairs, settle } from "../lib/more";
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
