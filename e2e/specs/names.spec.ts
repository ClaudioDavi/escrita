// docs/TEST-0.9.md, "Names without an entry" (board 30), steps 1 to 10.
// The rule is switched on through the plugin's settings (what the settings row does); the
// "Não são nomes" field is read back from the settings tab's text.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { configureWorld09, installWorld09Extras, world09 } from "../fixtures/world-09";
import { editorCursor, editorText, snap, sleep } from "../lib/panels";

test.describe.configure({ mode: "serial", timeout: 90_000 });

const FAROL = "Contos/Teste 0.9/O farol apagado.md";
let app: App;
let original = "";

test.beforeAll(async () => {
  app = await App.launch({ vault: world09({ chapters: 6 }) });
  installWorld09Extras(app.vaultDir);
  await configureWorld09(app);
  original = app.readVaultFile(FAROL);
});
test.afterAll(async () => { await app?.close(); });
test.afterEach(async () => { await app.closeModals(); await app.dismissNotices(); });

const marks = () => app.page.locator(".cm-content .escrita-lens-newName >> visible=true");
const markedNames = async () => [...new Set((await marks().allTextContents()).map((s) => s.trim()))].sort();
const panelRules = () => app.page.locator(".escrita-lens-rules");
const items = () => app.page.locator(".escrita-lens-name-item");
const item = (name: string) => items().filter({ has: app.page.locator(".escrita-lens-name-text", { hasText: new RegExp(`^${name}$`) }) });

async function lensOn(path: string): Promise<void> {
  await app.openFile(path);
  await app.waitFor("the note to be active", async () => (await app.activeFile()) === path);
  await app.command("toggle-revision-lens");
  await expect(app.page.locator(".escrita-lens-head")).toBeVisible();
}

test("1. the rule is off by default: no name marks, no row in the panel", async () => {
  await lensOn(FAROL);
  await app.page.waitForTimeout(1500);
  expect(await app.setting("lensRulesOn")).toEqual([]);
  await expect(marks()).toHaveCount(0);
  await expect(panelRules()).not.toContainText("Nomes sem entrada");
  await snap(app, "1. lens, rule off");
});

test("2. rule on: Almeida, Dona Zefa and Natal are marked, never Willian, Teodoro or Onde", async () => {
  await app.setSettings({ lensRulesOn: ["newName"] });
  await expect.poll(markedNames, { timeout: 20_000 }).toContain("Almeida");
  const names = await markedNames();
  expect(names).toEqual(expect.arrayContaining(["Almeida", "Dona Zefa", "Natal"]));
  for (const never of ["Willian", "Teodoro", "Onde"]) expect(names).not.toContain(never);
  await expect(panelRules()).toContainText("Nomes sem entrada");
  const almeida = item("Almeida");
  await expect(almeida).toContainText("6 na nota");
  await expect(item("Dona Zefa")).toContainText("6 na nota");
  await expect(item("Natal")).toContainText("6 na nota");
  await expect(almeida.locator("button", { hasText: "Criar entrada" })).toBeVisible();
  await expect(almeida.locator("button", { hasText: "Dispensar" })).toBeVisible();
  await snap(app, "2. lens, rule on", app.page.locator(".workspace-leaf-content[data-type^='escrita']").last());
});

test("3. the counts in the other works arrive: Rio Pequeno joins, Almeida shows 2 obras", async () => {
  await sleep(8000);
  await expect(item("Rio Pequeno")).toBeVisible({ timeout: 30_000 });
  await expect(item("Rio Pequeno")).toContainText("1 na nota · 2 obras");
  await expect(item("Almeida")).toContainText("2 obras");
  expect(await markedNames()).toContain("Rio Pequeno");
  await expect(app.page.locator(".escrita-lens-names-wait")).toHaveCount(0);
});

test("4. clicking Almeida walks through its six occurrences; the step buttons walk through every marked name", async () => {
  const seen: string[] = [];
  for (let i = 0; i < 7; i++) {
    await item("Almeida").locator(".escrita-lens-name-text").click();
    await sleep(200);
    const c = await editorCursor(app);
    seen.push(`${c?.line}:${c?.ch}`);
  }
  // six different places, then the first again
  expect(new Set(seen.slice(0, 6)).size).toBe(6);
  expect(seen[6]).toBe(seen[0]);
  const text = (await editorText(app)).split("\n");
  for (const s of seen) {
    const [l, ch] = s.split(":").map(Number);
    expect(text[l].slice(0, ch)).toMatch(/Almeida$/); // the cursor sits at the end of the selected name
  }
  // the step buttons of the rule row
  await expect(app.page.getByRole("button", { name: "Próximo nome sem entrada" })).toBeVisible();
  await expect(app.page.getByRole("button", { name: "Nome sem entrada anterior" })).toBeVisible();
  const visited = new Set<string>();
  for (let i = 0; i < 16; i++) {
    await app.page.getByRole("button", { name: "Próximo nome sem entrada" }).click();
    await sleep(120);
    const c = await editorCursor(app);
    const line = (await editorText(app)).split("\n")[c!.line];
    visited.add(line.slice(0, c!.ch).match(/(Dona Zefa|Almeida|Natal|Rio Pequeno)$/)?.[1] ?? "?");
  }
  expect([...visited].sort()).toEqual(["Almeida", "Dona Zefa", "Natal", "Rio Pequeno"]);
});

test("5. Criar entrada on Dona Zefa opens the new-entry window with the name filled; the note is untouched", async () => {
  await item("Dona Zefa").locator("button", { hasText: "Criar entrada" }).click();
  const input = app.page.locator(".modal input[aria-label='Nome']");
  await expect(input).toHaveValue("Dona Zefa");
  await app.screenshot("5. new entry window");
  expect(await editorText(app)).toBe(original);
  await app.page.locator(".escrita-universe-create-chip", { hasText: "Personagem" }).click();
  await app.page.locator(".modal button.mod-cta", { hasText: "Criar" }).click();
  await app.waitFor("the entry note", () => app.vaultFileExists("Universo/Personagens/Dona Zefa.md"));
  expect(app.readVaultFile("Universo/Personagens/Dona Zefa.md")).toMatch(/type: personagem/);
  expect(app.readVaultFile(FAROL)).toBe(original);
  await expect.poll(markedNames, { timeout: 20_000 }).not.toContain("Dona Zefa");
});

test("6. Dispensar on Natal: a notice, the marks go, and the line is in Não são nomes", async () => {
  await app.openFile(FAROL);
  await item("Natal").locator("button", { hasText: "Dispensar" }).click();
  await app.notice("“Natal” foi para “Não são nomes” e não será mais marcado.");
  await expect.poll(markedNames, { timeout: 20_000 }).not.toContain("Natal");
  expect(await app.setting("notNames")).toContain("Natal");
  const tab = await app.openSettings();
  expect(tab).toContain("Não são nomes");
  const value = await app.page.evaluate(() => [...(app.setting.activeTab.containerEl as HTMLElement).querySelectorAll("textarea")].map((t) => (t as HTMLTextAreaElement).value));
  expect(value.some((v) => v.split("\n").includes("Natal"))).toBe(true);
  await app.closeModals();
});

test("7. deleting the Natal line marks it again", async () => {
  await app.setSettings({ notNames: "" });
  await app.openFile(FAROL);
  await expect.poll(markedNames, { timeout: 20_000 }).toContain("Natal");
});

test("8. rule off: no marks and no names list", async () => {
  await app.setSettings({ lensRulesOn: [] });
  await expect.poll(async () => (await marks().count()), { timeout: 20_000 }).toBe(0);
  await expect(items()).toHaveCount(0);
  await expect(panelRules()).not.toContainText("Nomes sem entrada");
  await app.setSettings({ lensRulesOn: ["newName"] });
  await expect.poll(markedNames, { timeout: 20_000 }).toContain("Almeida");
});

test("9. universe off: no marks; the panel says it needs the universe, and the button opens Features", async () => {
  await app.setSettings({ universeMode: "off" });
  await expect.poll(async () => (await marks().count()), { timeout: 20_000 }).toBe(0);
  const row = app.page.locator(".escrita-lens-row-wait").filter({ hasText: "Nomes sem entrada" });
  await expect(row).toContainText("Precisa do universo ligado.");
  await snap(app, "9. universe off", row);
  await row.getByRole("button", { name: "Abrir recursos" }).click();
  await app.waitFor("the settings window", async () => (await app.settingsWindow()).open);
  expect((await app.settingsWindow()).tab).toBe("escrita");
  await app.closeModals();
  await app.setSettings({ universeMode: "universe" });
  await expect.poll(markedNames, { timeout: 30_000 }).toContain("Almeida");
});

test("10. a note with universe: false has no name marks and no endless counting", async () => {
  await lensOn("Textos/Noite.md");
  await sleep(4000);
  await expect(marks()).toHaveCount(0);
  await expect(app.page.locator(".escrita-lens-names-wait")).toHaveCount(0);
  await expect(items()).toHaveCount(0);
});
