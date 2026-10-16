// Starts a second, isolated Obsidian (the flatpak one) with its own profile and a fresh vault,
// and attaches to it over the DevTools protocol. See docs/TESTING.md for the guarantees.
//
// Never touched: ~/.var/app/md.obsidian.Obsidian/, the author's vaults and their running
// Obsidian. Everything lives in ~/.cache/escrita-e2e/run-<id>/ (the flatpak can see $HOME
// but not the host's /tmp).
import { chromium, type Browser, type Page } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type { VaultSpec } from "../fixtures";

export const CACHE = path.join(os.homedir(), ".cache", "escrita-e2e");

export interface LaunchOptions {
  vault: VaultSpec;
  /** the checkout whose main.js, manifest.json and styles.css are copied in; default: this one */
  repo?: string;
  /** show a window (also: HEADED=1) */
  headed?: boolean;
}

const REPO = path.resolve(import.meta.dirname, "..", "..");
const VIEWPORT = { width: 1280, height: 800 };

/** flatpak instance ids of any Obsidian that is running now. */
function instances(): Set<string> {
  const out = execFileSync("flatpak", ["ps", "--columns=instance,application"], { encoding: "utf8" });
  return new Set(out.split("\n").filter((l) => l.includes("md.obsidian.Obsidian")).map((l) => l.trim().split(/\s+/)[0]));
}

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

/** A plain recursive copy of a vault (read-only on the source), without the workspace files and the git folder. */
function copyVault(from: string, to: string): void {
  fs.cpSync(from, to, {
    dereference: true,
    recursive: true,
    filter: (src) => !/(^|\/)\.git$/.test(src) && !/\.obsidian\/workspace[^/]*\.json$/.test(src),
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Deletes the run folders left by earlier runs (this run's folder is newer than any of them). */
function prune(current: string): void {
  if (!fs.existsSync(CACHE)) return;
  for (const name of fs.readdirSync(CACHE)) {
    if (!/^run-\d+$/.test(name) || name === current) continue;
    fs.rmSync(path.join(CACHE, name), { recursive: true, force: true });
  }
}

export class Obsidian {
  readonly runDir: string;
  readonly profileDir: string;
  readonly vaultDir: string;
  readonly vaultName: string;
  private browser: Browser | null = null;
  private child: ChildProcess | null = null;
  private mine = new Set<string>();
  private _page: Page | null = null;

  private constructor(private readonly opts: Required<Omit<LaunchOptions, "headed">> & { headed: boolean }, id: string) {
    this.runDir = path.join(CACHE, `run-${id}`);
    this.profileDir = path.join(this.runDir, "profile");
    this.vaultName = `escrita-e2e-${id}`;
    this.vaultDir = path.join(this.runDir, this.vaultName);
  }

  get page(): Page {
    if (!this._page) throw new Error("Obsidian is not running");
    return this._page;
  }

  /** A fresh run folder with the vault built, Obsidian started and Escrita loaded. */
  static async launch(options: LaunchOptions): Promise<Obsidian> {
    const id = String(Date.now());
    const run = new Obsidian({
      repo: options.repo ?? REPO,
      vault: options.vault,
      headed: options.headed ?? process.env.HEADED === "1",
    }, id);
    prune(`run-${id}`);
    run.build();
    try {
      await run.start();
    } catch (e) {
      await run.close();
      throw e;
    }
    return run;
  }

  /**
   * Quits Obsidian (gracefully, so the profile's localStorage is flushed: the community-plugins
   * trust flag and the language live there) and starts it again on the same profile and vault.
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /** Stops only the instances this launch added. Safe to call twice; always call it. */
  async close(): Promise<void> {
    await this.stop();
  }

  // ---------------------------------------------------------------------------

  private build(): void {
    const { vault, repo } = this.opts;
    fs.mkdirSync(this.profileDir, { recursive: true });
    const put = (rel: string, text: string) => {
      const p = path.join(this.vaultDir, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, text);
    };
    fs.mkdirSync(this.vaultDir, { recursive: true });
    if (vault.copyFrom) copyVault(vault.copyFrom, this.vaultDir);
    for (const [rel, text] of Object.entries(vault.files)) put(rel, text);
    put(".obsidian/community-plugins.json", JSON.stringify(["escrita"]));
    const plugin = path.join(this.vaultDir, ".obsidian", "plugins", "escrita");
    fs.mkdirSync(plugin, { recursive: true });
    for (const f of ["main.js", "manifest.json", "styles.css"]) {
      const src = path.join(repo, f);
      if (!fs.existsSync(src)) throw new Error(`${src} is missing: run npm run build first`);
      fs.copyFileSync(src, path.join(plugin, f));
    }
    if (vault.data) put(".obsidian/plugins/escrita/data.json", JSON.stringify(vault.data, null, 2));
    fs.writeFileSync(
      path.join(this.profileDir, "obsidian.json"),
      JSON.stringify({ vaults: { [crypto.randomBytes(8).toString("hex")]: { path: this.vaultDir, ts: Date.now(), open: true } } }),
    );
  }

  private async start(): Promise<void> {
    const before = instances();
    const port = await freePort();
    const args = ["run", "md.obsidian.Obsidian", `--user-data-dir=${this.profileDir}`, `--remote-debugging-port=${port}`];
    if (!this.opts.headed) args.push("--ozone-platform=headless");
    const log = (n: string) => fs.openSync(path.join(this.runDir, n), "a");
    this.child = spawn("flatpak", args, { detached: true, stdio: ["ignore", log("obsidian.out"), log("obsidian.err")] });
    this.child.unref();
    this.mine = new Set();
    const remember = () => { for (const i of instances()) if (!before.has(i)) this.mine.add(i); };

    const deadline = Date.now() + 60_000;
    for (;;) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break;
      } catch { /* not up yet */ }
      if (Date.now() > deadline) throw new Error("Obsidian's DevTools endpoint did not come up");
      await sleep(250);
    }
    remember();
    this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    let page: Page | undefined;
    for (let i = 0; i < 240 && !page; i++) {
      page = this.browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes("index.html") && !p.url().includes("starter"));
      if (!page) await sleep(250);
    }
    if (!page) throw new Error("no vault window appeared");
    this._page = page;
    remember();
    await page.setViewportSize(VIEWPORT); // a headless window starts at 200x150
    await page.waitForFunction(() => (window as any).app?.workspace?.layoutReady === true, null, { timeout: 60_000 });

    // Obsidian's language is read from localStorage: set it, and reload once if it changed.
    const languageChanged = await page.evaluate((lang) => {
      if (localStorage.getItem("language") === lang) return false;
      localStorage.setItem("language", lang);
      return true;
    }, this.opts.vault.language);
    if (languageChanged) {
      await page.evaluate(() => { (window as any).__beforeReload = true; });
      await page.reload();
      await page.waitForFunction(() => !(window as any).__beforeReload && (window as any).app?.workspace?.layoutReady === true, null, { timeout: 60_000 });
    }
    // Restricted mode: community plugins run only after this call (it sets the trust flag in the profile).
    await page.evaluate(async () => {
      const pl = (window as any).app.plugins;
      if (!pl.isEnabled()) await pl.setEnable(true);
    });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !!(window as any).app.plugins.plugins.escrita, null, { timeout: 30_000 });
    await page.waitForFunction(() => !!(window as any).app.commands.commands["escrita:new-work"], null, { timeout: 15_000 });
  }

  private async stop(): Promise<void> {
    // Ask the browser to quit (Browser.close over CDP) so Chromium flushes localStorage; a SIGKILL loses it.
    try {
      const session = await this.browser?.newBrowserCDPSession();
      await Promise.race([session?.send("Browser.close").catch(() => {}), sleep(3000)]);
    } catch { /* already gone */ }
    for (let i = 0; i < 20 && [...this.mine].some((id) => instances().has(id)); i++) await sleep(250);
    try { await this.browser?.close(); } catch { /* already gone */ }
    this.browser = null;
    this._page = null;
    for (const id of this.mine) {
      try { execFileSync("flatpak", ["kill", id], { stdio: "ignore" }); } catch { /* already gone */ }
    }
    if (this.child?.pid) {
      try { process.kill(-this.child.pid, "SIGTERM"); } catch { /* already gone */ }
    }
    this.child = null;
    // give the profile's locks a moment to go before a restart
    for (let i = 0; i < 40 && [...this.mine].some((id) => instances().has(id)); i++) await sleep(250);
    this.mine = new Set();
  }
}
