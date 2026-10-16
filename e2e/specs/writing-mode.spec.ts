// docs/TEST-1.0.md, "Writing mode next to the Minimal theme and a zen plugin": steps 2, 3 and 6 to 9.
// Steps 1, 4, 5 and 10 need a third-party theme or plugin and stay by eye.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { SetupModal } from "../lib/setup-modal";
import { inWritingMode, settle } from "../lib/more";
import { emptyEn } from "../fixtures";

const CHROME = [".workspace-ribbon", ".status-bar", ".workspace-tab-header-container", ".workspace-split.mod-left-split", ".workspace-split.mod-right-split"];

test.describe("Writing mode", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let app: App;

  const shown = (sel: string) => app.page.locator(sel).first().evaluate((e) => getComputedStyle(e).display !== "none");
  const sidebars = () => app.page.evaluate(() => ({ left: !window.app.workspace.leftSplit.collapsed, right: !window.app.workspace.rightSplit.collapsed }));
  const setSidebars = (left: boolean, right: boolean) => app.page.evaluate(([l, r]) => {
    l ? window.app.workspace.leftSplit.expand() : window.app.workspace.leftSplit.collapse();
    r ? window.app.workspace.rightSplit.expand() : window.app.workspace.rightSplit.collapse();
  }, [left, right] as const);
  const waitMode = (on: boolean) => app.waitFor(`writing mode ${on ? "on" : "off"}`, async () => (await inWritingMode(app)) === on, 10_000);

  test.beforeAll(async () => {
    app = await App.launch({ vault: emptyEn({ seeded: true }) });
    // the vault of G2b: Short fiction, Essentials, the Writing mode layout
    const setup = new SetupModal(app);
    await app.command("setup");
    await setup.chip("Short fiction").click();
    await setup.card("Essentials").click();
    await setup.button("See what I'll create").click();
    await setup.card("Writing mode").click();
    await setup.button("Create").click();
    await waitMode(true);
    await settle(800);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("2. Exit writing mode (the button): both sidebars come back, with the tabs, the ribbon and the status bar", async () => {
    await app.dismissNotices();
    for (const sel of CHROME) expect(await shown(sel), `${sel} hidden in the mode`).toBe(false);
    await app.screenshot("2. in writing mode");
    await setSidebars(true, true); // open both while the mode hides them: Escrita remembers what was hidden
    await app.page.locator(".escrita-writing-exit").click();
    await waitMode(false);
    for (const sel of CHROME) expect(await shown(sel), `${sel} back`).toBe(true);
    await settle();
    expect(await sidebars()).toEqual({ left: true, right: true });
    await app.screenshot("2. after Exit writing mode");
  });

  test("3. the left sidebar closed, enter, exit: only the right one comes back", async () => {
    await setSidebars(false, true);
    await app.command("enter-writing-mode");
    await waitMode(true);
    await settle();
    await app.command("exit-writing-mode");
    await waitMode(false);
    await settle();
    expect(await sidebars()).toEqual({ left: false, right: true });
  });

  test("6. the palette lists exactly one of Enter and Exit by state, and neither has a hotkey", async () => {
    expect(await app.commandListed("enter-writing-mode")).toBe(true);
    expect(await app.commandListed("exit-writing-mode")).toBe(false);
    await app.command("enter-writing-mode");
    await waitMode(true);
    expect(await app.commandListed("enter-writing-mode")).toBe(false);
    expect(await app.commandListed("exit-writing-mode")).toBe(true);
    const hotkeys = await app.page.evaluate(() => ["escrita:enter-writing-mode", "escrita:exit-writing-mode"].map((id) => ({
      id,
      keys: window.app.hotkeyManager.getHotkeys(id) ?? window.app.hotkeyManager.getDefaultHotkeys(id) ?? [],
      defaults: window.app.hotkeyManager.getDefaultHotkeys(id) ?? [],
    })));
    for (const h of hotkeys) {
      expect(h.keys, `${h.id} keys`).toEqual([]);
      expect(h.defaults, `${h.id} default keys`).toEqual([]);
    }
  });

  test("7. a click on a work in the home block opens it in the same tab, at the left-off spot, and the mode stays", async () => {
    await app.openFile("Home.md");
    const leavesBefore = await app.page.evaluate(() => { let n = 0; window.app.workspace.iterateRootLeaves(() => { n++; }); return n; });
    const row = app.page.locator(".escrita-desk-row", { hasText: "Example · The crossing" });
    await expect(row).toBeVisible();
    await app.screenshot("7. the home block in writing mode");
    await row.click();
    await app.waitFor("the work", async () => (await app.activeFile()) === "Stories/Example · The crossing.md");
    await settle(800);
    const leavesAfter = await app.page.evaluate(() => { let n = 0; window.app.workspace.iterateRootLeaves(() => { n++; }); return n; });
    expect(leavesAfter).toBe(leavesBefore);
    expect(await inWritingMode(app)).toBe(true);
    // the spot: the first beat that still waits for prose (the second of the example's two)
    const text = app.readVaultFile("Stories/Example · The crossing.md").split("\n");
    const beats = text.map((l, i) => (l.startsWith("%% beat:") ? i : -1)).filter((i) => i >= 0);
    const c = (await app.cursor())!;
    expect(c.file).toBe("Stories/Example · The crossing.md");
    expect(beats.length).toBe(2);
    expect(c.line, `cursor on "${c.text}"`).toBeGreaterThanOrEqual(beats[1]);
    await app.screenshot("7. the work, still in writing mode");
  });

  test("8. Goals off: the counter goes away; on again: it comes back", async () => {
    await expect(app.page.locator(".escrita-writing-goal")).toBeVisible();
    await app.setFeature("goals", false);
    await expect(app.page.locator(".escrita-writing-goal")).toHaveCount(0);
    expect(await inWritingMode(app)).toBe(true);
    await app.setFeature("goals", true);
    await expect(app.page.locator(".escrita-writing-goal")).toBeVisible();
  });

  test("9. the home block (desk) off: the mode exits by itself and nothing stays hidden", async () => {
    await app.setFeature("desk", false);
    await waitMode(false);
    await settle();
    for (const sel of CHROME.filter((s) => !s.includes("mod-left") )) expect(await shown(sel), `${sel} visible`).toBe(true);
    await expect(app.page.locator(".escrita-writing-exit")).toHaveCount(0);
    await expect(app.page.locator(".escrita-writing-goal")).toHaveCount(0);
    expect(await app.commandListed("enter-writing-mode")).toBe(false); // the mode belongs to the desk
    await app.screenshot("9. after turning the home block off");
  });
});
