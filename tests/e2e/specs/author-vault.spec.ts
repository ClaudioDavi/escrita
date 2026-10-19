// docs/TEST-1.0.md, G2c: the setup in the author's vault, which it must change in no note and no
// saved setting. The vault is COPIED into the run folder (a plain recursive copy that leaves out
// .git and the workspace files); the source folder is never written to, renamed in or opened in
// Obsidian. The spec checks that too: it lists the source before and after.
import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { App } from "../lib/app";
import { SetupModal } from "../lib/setup-modal";
import { settingsPage, settle } from "../lib/more";

const SOURCE = path.join(os.homedir(), "Projects", "website", "escrita");

/** path -> "size:sha1" for every file under `dir`, skipping what the copy leaves out. */
function listing(dir: string, skip: (rel: string) => boolean = () => false): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      const rel = path.relative(dir, abs);
      if (skip(rel)) continue;
      if (e.isDirectory()) walk(abs);
      else out[rel] = `${fs.statSync(abs).size}:${createHash("sha1").update(fs.readFileSync(abs)).digest("hex")}`;
    }
  };
  walk(dir);
  return out;
}

const notes = (rel: string) => !rel.startsWith(".obsidian") && !rel.startsWith(".git");

test.describe("G2c: the setup in a copy of the author's vault", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.skip(!fs.existsSync(SOURCE), `the author's vault (${SOURCE}) is not on this machine: G2c stays by hand`);

  let app: App;
  let setup: SetupModal;
  let sourceBefore: Record<string, string>;
  let dataBefore: Record<string, any>;
  let copyBefore: Record<string, string>;

  test.beforeAll(async () => {
    sourceBefore = listing(SOURCE, (rel) => rel.startsWith(".git"));
    dataBefore = JSON.parse(fs.readFileSync(path.join(SOURCE, ".obsidian", "plugins", "escrita", "data.json"), "utf8"));
    app = await App.launch({ vault: { language: "pt-BR", files: {}, copyFrom: SOURCE } });
    setup = new SetupModal(app);
    copyBefore = listing(app.vaultDir, (rel) => !notes(rel));
  });
  test.afterAll(async () => {
    await app?.close();
    // the source is as it was: nothing in the run touched it
    if (sourceBefore) expect(listing(SOURCE, (rel) => rel.startsWith(".git"))).toEqual(sourceBefore);
  });

  test("0. the copy has the author's notes and no workspace file; the source is not the vault Obsidian opened", async () => {
    expect(Object.keys(copyBefore).length).toBeGreaterThan(20);
    expect(fs.existsSync(path.join(app.vaultDir, ".obsidian", "workspace.json"))).toBe(false);
    expect(path.resolve(app.vaultDir)).not.toBe(path.resolve(SOURCE));
    expect(app.vaultDir.startsWith(path.join(os.homedir(), ".cache", "escrita-e2e"))).toBe(true);
  });

  test("1. start: no first-run notice, the Features page reads Personalizado or the preset the switches match, nothing is switched", async () => {
    await settle(3000);
    expect((await app.notices()).filter((n) => n.includes("Escrita está pronto"))).toEqual([]);
    const features = await app.setting<Record<string, boolean>>("features");
    // 1.2 (PLAN-1.2 Q2): a switch new in this version is written on load; every switch the author had stays
    const added = Object.keys(features).filter((k) => !(k in dataBefore.settings.features));
    expect(added.every((k) => k === "screenplay")).toBe(true);
    expect(Object.fromEntries(Object.entries(features).filter(([k]) => !added.includes(k)))).toEqual(dataBefore.settings.features);
    const s = await settingsPage(app);
    const label = await s.locator(".escrita-presets-state").innerText();
    expect(["Personalizado", "Essencial", "Escritor", "Tudo"]).toContain(label);
    test.info().annotations.push({ type: "Features page label", description: label });
    await app.screenshot("1. the Features page", s.locator(".escrita-presets"));
    await app.closeModals();
  });

  test("2. Contos e ensaios, Escritor, Ver o que vou criar: Contos is '=' with its note count; the rest comes unticked with a reason; saved settings stay", async () => {
    await app.command("setup");
    await setup.chip("Contos e ensaios").click();
    await setup.card("Escritor").click();
    await setup.button("Ver o que vou criar").click();
    const groups = await setup.preview();
    const group = (title: string) => groups.find((g) => g.title === title)?.rows ?? [];
    const row = (label: string) => groups.flatMap((g) => g.rows).find((r) => r.label === label)!;

    const contos = row("Contos");
    expect(contos.mark).toBe("=");
    expect(contos.reason).toMatch(/^Já existe, fica\. \d+ notas\. Usada como está\.$/);

    // unticked, each with its reason: the examples, the language group, the features row, the layout
    const unticked = [...group("Exemplos"), row("Idioma dos padrões"), row("Recursos"), row("Arrumar a tela uma vez")];
    for (const r of unticked) {
      expect(r.off, `${r.label} comes unticked`).toBe(true);
      expect(r.reason, `${r.label} says why`).toMatch(/^Desmarcado: /);
    }
    // "Abrir a nota inicial ao iniciar" is already on in this vault, so it is kept ("=") rather than unticked
    expect(row("Abrir a nota inicial ao iniciar")).toMatchObject({ mark: "=", reason: "Já está assim." });

    // every setting the author saved reads "Você já salvou esta; ela fica."
    for (const label of ["Status", "Nota de darlings", "Nota global de darlings", "Nota do universo", "Tipos de entrada", "Valores de forma", "Palavra das threads", "Palavra de thread fechada", "Pasta de capítulos"]) {
      expect(row(label), label).toMatchObject({ mark: "=", reason: "Você já salvou esta; ela fica." });
    }
    // the track folders are not swapped
    expect(row("Pastas que contam")).toMatchObject({ mark: "=", value: "Contos, Textos, Romances, Ideias" });
    await app.screenshot("2. step 2 in a copy of the author's vault", setup.root);
  });

  test("3. Nota inicial: the author's home note is '=' and the summary says there is nothing to do, with Criar greyed", async () => {
    const home = (await setup.preview()).find((g) => g.title === "Nota inicial")!.rows;
    expect(home.map((r) => [r.label, r.mark])).toEqual([["Início.md", "="], ["Nota inicial", "="], ["Abrir a nota inicial ao iniciar", "="]]);
    expect(await setup.summary()).toMatch(/Nada (a fazer|marcado)/);
    await expect(setup.button("Criar")).toBeDisabled();
    await app.screenshot("3. nothing to do", setup.root);
    await setup.button("Cancelar").click();
  });

  test("4. nothing else moved: the notes are as they were and the saved settings are the same", async () => {
    await settle(3500); // saves are debounced
    expect(listing(app.vaultDir, (rel) => !notes(rel))).toEqual(copyBefore);
    const after = JSON.parse(fs.readFileSync(path.join(app.vaultDir, ".obsidian", "plugins", "escrita", "data.json"), "utf8"));
    expect(after.settings).toEqual(dataBefore.settings);
    // outside `settings` only bookkeeping may differ
    const { settings: _a, ...restAfter } = after;
    const { settings: _b, ...restBefore } = dataBefore;
    const changed = Object.keys({ ...restAfter, ...restBefore }).filter((k) => JSON.stringify(restAfter[k]) !== JSON.stringify(restBefore[k]));
    test.info().annotations.push({ type: "data.json keys outside settings that changed", description: JSON.stringify(changed) });
    expect(changed.filter((k) => !["setupOffered", "leftOff", "history", "lensDismissed", "threadSeen", "version"].includes(k))).toEqual([]);
  });

  test("5. 'Os dois': Livros is a new folder, unticked because the vault has works, and so is the track line; ticking the folder turns both on", async () => {
    await app.command("setup");
    await setup.chip("Contos e ensaios").click();
    await setup.card("Escritor").click();
    await setup.chip("Os dois").click();
    await setup.button("Ver o que vou criar").click();
    const rows = () => setup.preview().then((gs) => gs.flatMap((g) => g.rows));
    const livros = (await rows()).find((r) => r.label === "Livros")!;
    expect(livros, JSON.stringify((await rows()).map((r) => r.label))).toBeTruthy();
    // the folder row owns the tick (so it has a box instead of the + mark); it is a new folder, unticked
    expect(livros.mark).toBeNull();
    expect(livros.tick).toBe(false);
    expect(livros.off).toBe(true);
    const track = () => rows().then((rs) => rs.find((r) => r.label === "Pastas que contam")!);
    expect((await track()).off, "the track line shares the folder's tick").toBe(true);
    expect((await track()).reason).toMatch(/^Desmarcado: marque para acrescentar/);
    await setup.tick("Incluir: ", "Livros").click();
    expect((await rows()).find((r) => r.label === "Livros")).toMatchObject({ tick: true, off: false });
    expect((await track()).off).toBe(false);
    await app.screenshot("5. Livros ticked", setup.root);
    await setup.button("Cancelar").click();
    await settle(500);
    expect(listing(app.vaultDir, (rel) => !notes(rel))).toEqual(copyBefore);
  });

  test("6. a home note in another case: renamed to início.md the setup uses it as it is, with no Início.md beside it; renamed back", async () => {
    await app.page.evaluate(async () => {
      await window.app.fileManager.renameFile(window.app.vault.getFileByPath("Início.md"), "início.md");
    });
    await settle(800);
    await app.command("setup");
    await setup.button("Ver o que vou criar").click();
    const home = (await setup.preview()).find((g) => g.title === "Nota inicial")!.rows;
    expect(home[0]).toMatchObject({ label: "início.md", mark: "=" });
    expect(home.map((r) => r.label)).not.toContain("Início.md");
    expect(app.vaultFileExists("Início.md")).toBe(false);
    await app.screenshot("6. a lower-case home note is used as it is", setup.root);
    await setup.button(/Cancelar|Fechar/).click();
    await app.page.evaluate(async () => {
      await window.app.fileManager.renameFile(window.app.vault.getFileByPath("início.md"), "Início.md");
    });
    await settle(500);
    expect(app.vaultFileExists("Início.md")).toBe(true);
  });
});
