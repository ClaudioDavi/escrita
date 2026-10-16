// S0 spike: drive a second, isolated flatpak Obsidian over CDP.
// Usage: node e2e/spike/run.mjs [extra Chromium flags...]   e.g. --headless
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const require = createRequire(path.join(os.homedir(), ".cache/escrita-e2e/spike-node/"));
const { chromium } = require("playwright-core");

const extraFlags = process.argv.slice(2);
const repo = process.env.ESCRITA_REPO ?? "/home/claudiodavi/Projects/escrita";
const t0 = Date.now();
const lap = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

// 1. run folder (inside $HOME: the flatpak can't see the host /tmp)
const run = path.join(os.homedir(), ".cache/escrita-e2e", `run-${Date.now()}`);
const profile = path.join(run, "profile");
const vault = path.join(run, "vault");
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync(vault, { recursive: true });

// 2. vault
const put = (rel, text) => {
  const p = path.join(vault, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};
put("Contos/O afogado.md", "---\nstatus: rascunho\n---\n\nO mar subiu devagar naquela noite.\n");
put("Contos/A casa.md", "---\nstatus: ideia\n---\n\nUma casa vazia.\n");
put("Notas/Ideias.md", "Algumas ideias soltas.\n");
put(".obsidian/community-plugins.json", JSON.stringify(["escrita"]));
for (const f of ["main.js", "manifest.json", "styles.css"]) {
  const dst = path.join(vault, ".obsidian/plugins/escrita", f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(repo, f), dst);
}

// profile: one vault, open on start
const vaultId = crypto.randomBytes(8).toString("hex");
fs.writeFileSync(
  path.join(profile, "obsidian.json"),
  JSON.stringify({ vaults: { [vaultId]: { path: vault, ts: Date.now(), open: true } } }),
);

// free port
const port = await new Promise((res) => {
  const s = net.createServer().listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => res(p));
  });
});

// 3. launch
const psIds = () =>
  new Set(
    execFileSync("flatpak", ["ps", "--columns=instance,application"], { encoding: "utf8" })
      .split("\n")
      .filter((l) => l.includes("md.obsidian.Obsidian"))
      .map((l) => l.trim().split(/\s+/)[0]),
  );
const before = psIds();
const args = ["run", "md.obsidian.Obsidian", `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, ...extraFlags];
lap(`flatpak ${args.join(" ")}`);
const child = spawn("flatpak", args, { detached: true, stdio: ["ignore", fs.openSync(path.join(run, "obsidian.out"), "w"), fs.openSync(path.join(run, "obsidian.err"), "w")] });
child.unref();

let browser;
let ok = false;
try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  lap("CDP endpoint up");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  let page;
  for (let i = 0; i < 120 && !page; i++) {
    page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes("index.html") && !p.url().includes("starter"));
    if (!page) await new Promise((r) => setTimeout(r, 250));
  }
  if (!page) throw new Error("no vault page; pages: " + browser.contexts().flatMap((c) => c.pages()).map((p) => p.url()));
  lap("page " + page.url());
  await page.setViewportSize({ width: 1280, height: 800 }); // headless windows start at 200x150
  await page.waitForFunction(() => window.app?.workspace?.layoutReady === true, null, { timeout: 60000 });
  lap("layoutReady");

  // restricted mode: community plugins run only when localStorage "enable-plugin-<appId>" === "true"
  const trust = await page.evaluate(async () => {
    const pl = app.plugins;
    const was = pl.isEnabled();
    if (!was) await pl.setEnable(true); // sets the localStorage flag and loads enabledPlugins
    return { was, now: pl.isEnabled() };
  });
  lap("restricted mode: " + JSON.stringify(trust));
  await page.keyboard.press("Escape"); // close the trust modal if it opened
  await page.waitForFunction(() => !!app.plugins.plugins.escrita, null, { timeout: 30000 });
  lap("escrita loaded");

  await page.waitForFunction(() => !!app.commands.commands["escrita:new-work"], null, { timeout: 15000 });
  const ran = await page.evaluate(() => app.commands.executeCommandById("escrita:new-work"));
  lap("executeCommandById -> " + ran);
  await page.waitForSelector(".modal, .prompt", { timeout: 10000 }).catch(async (e) => {
    await page.screenshot({ path: path.join(run, "fail.png") });
    lap("DOM: " + (await page.evaluate(() => [...document.body.children].map((c) => c.className).join(" | "))));
    throw e;
  });
  const text = await page.locator(".modal, .prompt").first().innerText();
  lap("modal text: " + JSON.stringify(text));
  await page.screenshot({ path: path.join(run, "new-work.png") });
  lap("screenshot " + path.join(run, "new-work.png"));
  ok = text.length > 0;
  // optional hook for the spike: E2E_AFTER=<script> runs while Obsidian is still up (e.g. list the desktop's windows)
  if (process.env.E2E_AFTER) lap("after: " + execFileSync(process.env.E2E_AFTER, { encoding: "utf8" }));
} catch (e) {
  console.error("FAILED:", e);
} finally {
  try { await browser?.close(); } catch {}
  // terminate only the instance we started (never the author's)
  const mine = [...psIds()].filter((i) => !before.has(i));
  for (const id of mine) { try { execFileSync("flatpak", ["kill", id]); lap("killed instance " + id); } catch {} }
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  console.log("run folder:", run, ok ? "OK" : "FAILED");
}
process.exit(ok ? 0 : 1);
