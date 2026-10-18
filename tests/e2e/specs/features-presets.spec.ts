// docs/TEST-1.0.md, "Presets on the Features page": steps 1 to 7, in a Portuguese vault that is
// set up on Tudo (a home note, every switch on, the universe mode "universe").
import { expect, test, type Page } from "@playwright/test";
import { App } from "../lib/app";
import { settingsPage, settle } from "../lib/more";
import { writer } from "../fixtures";
import { FEATURE_IDS } from "../../../src/core/features";
import { PRESETS } from "../../../src/core/feature-presets";

test.describe("Presets on the Features page", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;
  let settings: Page;

  const state = () => settings.locator(".escrita-presets-state");
  const button = (name: string) => settings.locator(".escrita-preset-btn", { hasText: new RegExp(`^${name}$`) });
  const confirm = () => settings.locator(".escrita-presets-confirm");
  const switches = () => app.setting<Record<string, boolean>>("features");
  const onCount = () => settings.locator("button.escrita-switch[aria-checked=true]").count();
  const scrollTop = () => settings.locator(".escrita-presets").evaluate((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (p.scrollHeight > p.clientHeight + 1) return p.scrollTop;
    return -1;
  });

  test.beforeAll(async () => {
    app = await App.launch({ vault: writer({ seeded: true }) });
    await app.setSettings({
      homeNote: "Início.md",
      universeMode: "universe",
    });
    settings = await settingsPage(app);
    await settings.locator(".escrita-presets").waitFor();
    // the vault after the setup on Tudo: apply the preset the way the writer does
    await button("Tudo").click();
    await confirm().getByRole("button", { name: "Aplicar" }).click();
    await expect(state()).toHaveText("Tudo");
    await settle();
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("1. the Features page: Ponto de partida reads Tudo, three buttons, no setup link", async () => {
    await expect(settings.locator(".escrita-presets-title")).toHaveText("Ponto de partida");
    await expect(state()).toHaveText("Tudo");
    expect(await settings.locator(".escrita-preset-btn").allInnerTexts()).toEqual(["Essencial", "Escritor", "Tudo"]);
    await expect(settings.locator(".escrita-presets-setup")).toHaveCount(0);
    await settings.locator(".escrita-presets").scrollIntoViewIfNeeded();
    await app.screenshot("1. the Features page on Tudo", settings.locator("body"));
  });

  test("2. Essencial asks first: what turns off in page order, nothing turns on, nothing is saved yet, no jump", async () => {
    await settings.locator(".escrita-presets").scrollIntoViewIfNeeded();
    const before = await scrollTop();
    const featuresBefore = await switches();
    await button("Essencial").click();
    await expect(confirm()).toBeVisible();
    await expect(confirm().locator(".escrita-presets-ask")).toHaveText('Aplicar "Essencial"?');
    const lines = confirm().locator(".escrita-presets-change");
    await expect(lines.nth(0).locator(".escrita-presets-kind")).toHaveText("Desliga");
    await expect(lines.nth(1).locator(".escrita-presets-kind")).toHaveText("Liga");
    await expect(lines.nth(1)).toContainText("nada");
    await expect(confirm()).toContainText("Os dados de quem desliga ficam guardados.");
    await expect(confirm().locator("button")).toHaveText(["Cancelar", "Aplicar"]);

    // "Desliga" lists every feature the preset drops, in the order of the page's rows
    const offIds = FEATURE_IDS.filter((id) => id !== "universe" && !PRESETS.essentials.includes(id));
    const named = (await lines.nth(0).locator("span").nth(1).innerText()).split(", ");
    expect(named.length).toBe(offIds.length);
    const pageNames = await settings.locator(".escrita-feature-row .setting-item-name").evaluateAll(
      (els) => els.map((e) => (e.firstChild?.textContent ?? "").trim()),
    );
    const positions = named.map((n) => pageNames.indexOf(n));
    expect(positions.every((p) => p >= 0), `names ${named} in rows ${pageNames}`).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    expect(await switches()).toEqual(featuresBefore); // nothing switched yet
    expect(Math.abs((await scrollTop()) - before)).toBeLessThanOrEqual(2);
    await app.screenshot("2. the confirm step", settings.locator(".escrita-presets"));
  });

  test("3. Cancelar, Essencial, Aplicar: the label reads Essencial, nine switches on, the universe unchanged", async () => {
    await confirm().getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm()).toHaveCount(0);
    await expect(state()).toHaveText("Tudo");
    await button("Essencial").click();
    await confirm().getByRole("button", { name: "Aplicar" }).click();
    await expect(state()).toHaveText("Essencial");
    await expect.poll(onCount).toBe(PRESETS.essentials.length);
    expect(PRESETS.essentials.length).toBe(9);
    expect(await app.setting("universeMode")).toBe("universe");
    await app.screenshot("3. on Essencial", settings.locator(".escrita-presets"));
  });

  test("4. Essencial again: 'Já está em Essencial. Nada muda.' and no Aplicar", async () => {
    await button("Essencial").click();
    await expect(settings.locator(".escrita-presets")).toContainText('Já está em "Essencial". Nada muda.');
    await expect(settings.getByRole("button", { name: "Aplicar" })).toHaveCount(0);
  });

  test("5. one switch by hand: the label reads Personalizado", async () => {
    await settings.locator('button.escrita-switch[aria-label="Darlings"]').click();
    await expect(state()).toHaveText("Personalizado");
    expect((await switches()).darlings).toBe(false);
  });

  test("6. Tudo: the confirm adds the universe line", async () => {
    await button("Tudo").click();
    await expect(confirm()).toContainText("O universo não é um interruptor");
    await confirm().getByRole("button", { name: "Cancelar" }).click();
  });

  // The desk's follower keeps the setting in step with a rename in Obsidian, so "away from the
  // setting's name" is a setting that names no note.
  test("7. the home note setting names no note: the quiet setup link appears and opens the setup; fixed, it goes", async () => {
    await app.closeModals();
    await app.setSettings({ homeNote: "Casa.md" });
    settings = await settingsPage(app);
    const link = settings.locator(".escrita-presets-setup");
    await expect(link).toHaveText("Preparar o cofre para escrever");
    await app.screenshot("7. the setup link", settings.locator(".escrita-presets"));
    await link.click();
    // the modal opens in the window that asked (the settings window), not the main one
    await expect(settings.locator(".modal.escrita-setup-modal")).toBeVisible();
    await settings.keyboard.press("Escape");
    await app.closeModals();
    await app.setSettings({ homeNote: "Início.md" });
    settings = await settingsPage(app);
    await expect(settings.locator(".escrita-presets-setup")).toHaveCount(0);
  });
});
