// 1.2.1: Enter in a beat field of the outline panel lands in the new beat field (not in the note's
// editor), and Tab writes under the beat. Both for a single note and for a book's chapter.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { emptyPt, type VaultSpec } from "../fixtures";

const CONTO = "Contos/O afogado.md";
const CHAPTER = "Livros/O farol/Capítulos/01 Chegada.md";

function fixture(): VaultSpec {
  const base = emptyPt({ seeded: true });
  return {
    ...base,
    files: {
      ...base.files,
      [CONTO]: "---\nstatus: rascunho\n---\n\n%% beat: o mar sobe %%\n\nO mar subiu devagar.\n\n%% beat: a casa %%\n",
      "Livros/O farol.md": "---\nstatus: rascunho\n---\n\nPremissa.\n",
      [CHAPTER]: "%% beat: a chegada %%\n\nEla chegou de barco.\n\n%% beat: a conversa %%\n",
    },
  };
}

const BEAT = ".escrita-outline-beat-text";

test.describe("1.2.1: beats in the outline panel", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;

  test.beforeAll(async () => {
    app = await App.launch({ vault: fixture() });
  });
  test.afterAll(async () => {
    await app?.close();
  });

  const active = () => app.page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return {
      inEditor: !!a?.closest(".cm-content"),
      inBeat: !!a?.classList.contains("escrita-outline-beat-text"),
      text: a?.classList.contains("escrita-outline-beat-text") ? a.textContent ?? "" : "",
    };
  });

  async function enterThrice(file: string, lastBeat: string): Promise<void> {
    await app.openFile(file);
    await app.command("open-outline");
    const beats = app.page.locator(BEAT);
    await expect(beats).toHaveCount(2);
    const last = beats.last();
    expect(await last.textContent()).toBe(lastBeat);
    await last.click();
    await app.page.keyboard.press("End");
    await app.page.keyboard.press("Enter");
    await app.waitFor("a new empty beat field", async () => {
      const a = await active();
      return a.inBeat && a.text === "";
    });
    await app.page.keyboard.type("terceira", { delay: 60 });
    await app.page.keyboard.press("Enter");
    await app.waitFor("another empty beat field", async () => {
      const a = await active();
      return a.inBeat && a.text === "";
    });
    expect((await active()).inEditor).toBe(false);
    await app.page.keyboard.type("quarta", { delay: 60 });
    await app.page.keyboard.press("Enter");
    await app.waitFor("a third empty beat field", async () => {
      const a = await active();
      return a.inBeat && a.text === "";
    });
    await app.page.keyboard.type("quinta", { delay: 60 });
    await app.page.locator(".escrita-outline-footer").click(); // leaving the field saves it
    await app.waitFor("the last beat saved", () => app.readVaultFile(file).includes("%% beat: quinta %%"), 8_000);
    const text = app.readVaultFile(file);
    const lines = text.split("\n").filter((l) => l.startsWith("%% beat:"));
    expect(lines.slice(-3)).toEqual(["%% beat: terceira %%", "%% beat: quarta %%", "%% beat: quinta %%"]);
  }

  test("1. a single note: Enter after Enter keeps the cursor in the outline's beat fields", async () => {
    await enterThrice(CONTO, "a casa");
  });

  test("2. Tab in a beat field writes under it: first prose line, or a new empty line", async () => {
    await app.openFile(CONTO);
    await app.waitFor("the outline shows the note", async () => (await app.page.locator(BEAT).count()) >= 2);
    // beat 1 has prose: the cursor goes to its first prose line
    await app.page.locator(BEAT).first().click();
    await app.page.keyboard.press("Tab");
    await app.waitFor("the editor has focus", async () => (await active()).inEditor);
    let c = (await app.cursor())!;
    expect(c.file).toBe(CONTO);
    expect(c.text).toBe("O mar subiu devagar.");
    // the last beat of the original two has no prose yet ("a casa" is followed by "terceira" now)
    const before = app.readVaultFile(CONTO);
    await app.page.locator(BEAT).filter({ hasText: /^quinta$/ }).click();
    await app.page.keyboard.press("Tab");
    await app.waitFor("the editor has focus", async () => (await active()).inEditor);
    c = (await app.cursor())!;
    expect(c.text).toBe("");
    const lines = app.readVaultFile(CONTO).split("\n");
    expect(lines[c.line - 1]).toBe("%% beat: quinta %%");
    // only the empty line was added at most
    expect(app.readVaultFile(CONTO).replace(/\n+$/, "")).toBe(before.replace(/\n+$/, ""));
  });

  test("3. a book's chapter: the same", async () => {
    await enterThrice(CHAPTER, "a conversa");
  });

  test("4. Tab under a beat in a book's chapter", async () => {
    await app.openFile(CHAPTER);
    await app.waitFor("the outline shows the chapter", async () => (await app.page.locator(BEAT).count()) >= 2);
    await app.page.locator(BEAT).first().click();
    await app.page.keyboard.press("Tab");
    await app.waitFor("the editor has focus", async () => (await active()).inEditor);
    const c = (await app.cursor())!;
    expect(c.file).toBe(CHAPTER);
    expect(c.text).toBe("Ela chegou de barco.");
  });
});
