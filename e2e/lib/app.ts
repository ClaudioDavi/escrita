// Helpers a spec uses once Obsidian is up: run commands, open notes, read and set the
// plugin's settings, read and write files of the run's vault, emulate a phone, screenshots.
// The vault files are read on the host path (e2e is dev-only and never bundled).
import { test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { Obsidian, type LaunchOptions } from "./obsidian";

export interface Cursor {
  line: number;
  ch: number;
  /** the text of the cursor's line */
  text: string;
  /** the file the editor shows */
  file: string | null;
}

export class App {
  constructor(readonly obsidian: Obsidian) {}

  static async launch(options: LaunchOptions): Promise<App> {
    return new App(await Obsidian.launch(options));
  }

  get page(): Page {
    return this.obsidian.page;
  }

  get vaultDir(): string {
    return this.obsidian.vaultDir;
  }

  close(): Promise<void> {
    return this.obsidian.close();
  }

  async restart(): Promise<void> {
    await this.obsidian.restart();
  }

  // ---- commands and notes ----

  /** Runs a command. A bare id gets the plugin's prefix ("new-work" -> "escrita:new-work"). Resolves false when it was not run. */
  command(id: string): Promise<boolean> {
    const full = id.includes(":") ? id : `escrita:${id}`;
    return this.page.evaluate((c) => app.commands.executeCommandById(c) as boolean, full);
  }

  /** Whether the command is in the palette now (its checkCallback allows it). */
  commandListed(id: string): Promise<boolean> {
    const full = id.includes(":") ? id : `escrita:${id}`;
    return this.page.evaluate((c) => app.commands.listCommands().some((x: { id: string }) => x.id === c), full);
  }

  async openFile(vaultPath: string): Promise<void> {
    await this.page.evaluate(async (p) => {
      const file = app.vault.getFileByPath(p);
      if (!file) throw new Error(`no such file: ${p}`);
      await app.workspace.getLeaf(false).openFile(file, { active: true });
    }, vaultPath);
  }

  /** The active editor's cursor, or null when no note is being edited. */
  cursor(): Promise<Cursor | null> {
    return this.page.evaluate(() => {
      const ed = app.workspace.activeEditor;
      if (!ed?.editor) return null;
      const c = ed.editor.getCursor();
      return { line: c.line, ch: c.ch, text: ed.editor.getLine(c.line), file: ed.file?.path ?? null };
    });
  }

  activeFile(): Promise<string | null> {
    return this.page.evaluate(() => app.workspace.getActiveFile()?.path ?? null);
  }

  // ---- settings, through the plugin ----

  setting<T = unknown>(key: string): Promise<T> {
    return this.page.evaluate((k) => app.plugins.plugins.escrita.settings[k], key);
  }

  /** Sets one or several settings and saves them the way the settings tab does (features reapply). */
  setSettings(patch: Record<string, unknown>): Promise<void> {
    return this.page.evaluate(async (p) => {
      const plugin = app.plugins.plugins.escrita;
      Object.assign(plugin.settings, p);
      await plugin.saveSettings();
    }, patch);
  }

  /** Switches a feature on or off (settings.features[id]) and saves. */
  setFeature(id: string, on: boolean): Promise<void> {
    return this.page.evaluate(async ([f, v]) => {
      const plugin = app.plugins.plugins.escrita;
      plugin.settings.features[f as string] = v;
      await plugin.saveSettings();
    }, [id, on] as const);
  }

  /**
   * Where each view type sits: the side of the workspace, its tab group (with the types it holds
   * and the one in front) and the group's index among its side's children (top to bottom).
   */
  placement(types: string[]): Promise<Record<string, { side: string; tabs: string[]; front: string | undefined; index: number } | null>> {
    return this.page.evaluate((ts) => {
      const ws = app.workspace;
      const out: Record<string, any> = {};
      for (const type of ts) {
        const leaf = ws.getLeavesOfType(type)[0];
        if (!leaf) { out[type] = null; continue; }
        const root = leaf.getRoot();
        const group = leaf.parent;
        out[type] = {
          side: root === ws.rightSplit ? "right" : root === ws.leftSplit ? "left" : "main",
          tabs: group.children.map((c: any) => c.view.getViewType()),
          front: group.children[group.currentTab]?.view.getViewType(),
          index: root.children.indexOf(group),
        };
      }
      return out;
    }, types);
  }

  // ---- the vault's files, on the host ----

  private abs(rel: string): string {
    return path.join(this.vaultDir, rel);
  }

  readVaultFile(rel: string): string {
    return fs.readFileSync(this.abs(rel), "utf8");
  }

  /** Waits until the file exists and has text (a new note is created empty, then written), and returns the text. */
  async waitForFile(rel: string, timeout = 10_000): Promise<string> {
    await this.waitFor(rel, () => this.vaultFileExists(rel) && this.readVaultFile(rel) !== "", timeout);
    return this.readVaultFile(rel);
  }

  vaultFileExists(rel: string): boolean {
    return fs.existsSync(this.abs(rel));
  }

  /** The names in a vault folder ("" is the root), sorted; empty when it does not exist. */
  listVaultFolder(rel: string): string[] {
    const dir = this.abs(rel);
    return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  }

  /** Writes a file under the vault; Obsidian's watcher picks it up. */
  writeVaultFile(rel: string, text: string): void {
    fs.mkdirSync(path.dirname(this.abs(rel)), { recursive: true });
    fs.writeFileSync(this.abs(rel), text);
  }

  /** The plugin's saved data.json, parsed. */
  readData(): Record<string, any> {
    return JSON.parse(this.readVaultFile(".obsidian/plugins/escrita/data.json"));
  }

  // ---- waiting ----

  /** Polls a host-side condition. */
  async waitFor(what: string, cond: () => boolean | Promise<boolean>, timeout = 10_000): Promise<void> {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await cond()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`timed out waiting for ${what}`);
  }

  /** The visible notices' texts. */
  notices(): Promise<string[]> {
    return this.page.evaluate(() => [...document.querySelectorAll(".notice")].map((n) => (n as HTMLElement).innerText));
  }

  /** Waits for a notice containing `text` and returns its locator. */
  async notice(text: string | RegExp, timeout = 10_000): Promise<Locator> {
    const loc = this.page.locator(".notice").filter({ hasText: text }).first();
    await loc.waitFor({ state: "visible", timeout });
    return loc;
  }

  /** Dismisses every notice so the next check starts clean. */
  dismissNotices(): Promise<void> {
    return this.page.evaluate(() => document.querySelectorAll(".notice").forEach((n) => n.remove()));
  }

  /** The open modal (or the command prompt). */
  get modal(): Locator {
    return this.page.locator(".modal-container .modal").first();
  }

  /** Obsidian's settings window (it is a popout window in 1.14, not a `.modal`): whether it is open and which tab shows. */
  settingsWindow(): Promise<{ open: boolean; tab: string | null }> {
    return this.page.evaluate(() => ({ open: app.setting.isOpen === true, tab: app.setting.activeTab?.id ?? null }));
  }

  /** Opens Obsidian's settings on one tab ("escrita" is this plugin's) and returns the tab's visible text. */
  async openSettings(tabId = "escrita"): Promise<string> {
    await this.page.evaluate((id) => { app.setting.open(); app.setting.openTabById(id); }, tabId);
    await this.waitFor("the settings tab", async () => (await this.settingsWindow()).tab === tabId);
    return this.page.evaluate(() => (app.setting.activeTab.containerEl as HTMLElement).innerText);
  }

  /** What the plugin's classifier says about a note: whether it is a book note, and its chapter count. */
  bookOf(vaultPath: string): Promise<{ isBook: boolean; chapters: number }> {
    return this.page.evaluate((p) => {
      const plugin = app.plugins.plugins.escrita;
      const c = plugin.books.classify(app.vault.getFileByPath(p));
      return { isBook: !!c.book, chapters: c.book ? plugin.books.chapters(c.book).length : 0 };
    }, vaultPath);
  }

  async closeModals(): Promise<void> {
    await this.page.evaluate(() => { if (app.setting.isOpen) app.setting.close(); });
    for (let i = 0; i < 4 && (await this.page.locator(".modal-container").count()) > 0; i++) {
      await this.page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // ---- the window ----

  /**
   * Phone emulation: Obsidian's own (it reloads the window), plus a phone-sized window
   * (390 x 844). Off restores 1280 x 800. Resolves when Escrita is loaded again.
   */
  async emulateMobile(on: boolean): Promise<void> {
    await this.page.evaluate(() => { (window as any).__beforeReload = true; });
    await this.page.evaluate((v) => { void app.emulateMobile(v); }, on).catch(() => { /* the context goes away with the reload */ });
    await this.page.waitForFunction(
      () => !(window as any).__beforeReload && app?.workspace?.layoutReady === true && !!app.commands.commands["escrita:new-work"],
      null,
      { timeout: 30_000 },
    );
    await this.page.setViewportSize(on ? { width: 390, height: 844 } : { width: 1280, height: 800 });
    await new Promise((r) => setTimeout(r, 500));
  }

  /** "light" or "dark" (Obsidian's moonstone and obsidian themes). */
  async setTheme(theme: "light" | "dark"): Promise<void> {
    await this.page.evaluate((th) => app.changeTheme(th === "light" ? "moonstone" : "obsidian"), theme);
    await this.page.waitForFunction((th) => document.body.classList.contains(`theme-${th}`), theme);
  }

  /** Starts watching long tasks (50 ms and up); `longTasks()` reads what it saw. */
  async observeLongTasks(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as any;
      if (w.__longTasks) { w.__longTasks.length = 0; return; }
      w.__longTasks = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__longTasks.push({ start: e.startTime, duration: e.duration });
      }).observe({ entryTypes: ["longtask"] });
    });
  }

  longTasks(): Promise<{ start: number; duration: number }[]> {
    return this.page.evaluate(() => [...((window as any).__longTasks ?? [])]);
  }

  // ---- screenshots, attached to the Playwright report ----

  /** A screenshot of the window (or of one element), attached to the running test as `name`. */
  async screenshot(name: string, element?: Locator): Promise<void> {
    const body = await (element ?? this.page).screenshot();
    await test.info().attach(name, { body, contentType: "image/png" });
  }
}
