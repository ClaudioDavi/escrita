// docs/TEST-1.0.md, "G4: the emulated phone" steps 1 to 5, and the parts of MOBILE-1.0.md's
// "Checklist for G4" a script can see. `app.emulateMobile(true)` and a 390 px window; touch
// itself (long press, the soft keyboard, the system's pickers) stays by hand, and the author has no
// phone sync, so this is the whole phone check (PLAN-1.1, Q12).
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { SetupModal } from "../lib/setup-modal";
import { scrollsSideways, settingsPage, settle, smallTargets, stickingOut } from "../lib/more";
import { emptyPt } from "../fixtures";
import { WORLD_SETTINGS, world } from "../fixtures/h1";
import { FEATURE_IDS } from "../../../src/core/features";

const ALL_ON = Object.fromEntries(FEATURE_IDS.filter((id) => id !== "universe").map((id) => [id, true]));

/** Buttons and links under the page that lie, even partly, outside the 390 px window. */
const outsideWindow = (app: App, scope: string) => app.page.evaluate((sel) => {
  const out: string[] = [];
  for (const el of document.querySelectorAll(`${sel} button, ${sel} a, ${sel} [role=button], ${sel} input, ${sel} select`)) {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.left < -1 || r.right > window.innerWidth + 1) out.push(`${(el as HTMLElement).className || el.tagName} ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  return out;
}, scope);

test.describe("G4 (1 to 3): the setup and the layout on an emulated phone", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  let app: App;
  let setup: SetupModal;

  test.beforeAll(async () => {
    app = await App.launch({ vault: emptyPt({ seeded: true }) });
    setup = new SetupModal(app);
    await app.emulateMobile(true);
  });
  test.afterAll(async () => {
    await app?.close();
  });

  test("0. the window is a phone: 390 px wide, Obsidian's phone classes on", async () => {
    expect(await app.page.evaluate(() => window.innerWidth)).toBe(390);
    expect(await app.page.evaluate(() => [document.body.classList.contains("is-mobile"), document.body.classList.contains("is-phone")])).toEqual([true, true]);
  });

  test("1. the setup: the preset and layout cards stack, every tick and button is 32 px or more, no sideways scroll in the preview", async () => {
    await app.command("setup");
    await expect(setup.root).toBeVisible();
    const cards = await setup.root.locator(".escrita-setup-card").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }; }));
    const presets = cards.slice(0, 4);
    expect(new Set(presets.map((c) => c.x)).size, `preset cards stacked: ${JSON.stringify(presets)}`).toBe(1);
    expect(presets[1].y).toBeGreaterThan(presets[0].y);
    expect(await smallTargets(setup.root, "button, .escrita-setup-ck, select")).toEqual([]);
    expect(await outsideWindow(app, ".modal.escrita-setup-modal")).toEqual([]);
    await app.screenshot("1. step 1 on a phone", setup.root);
    await setup.button("Ver o que vou criar").click();
    expect(await smallTargets(setup.root, "button, .escrita-setup-ck, select")).toEqual([]);
    expect(await scrollsSideways(app.page, ".modal.escrita-setup-modal .escrita-setup-scroll")).toBe(false);
    expect(await scrollsSideways(app.page)).toBe(false);
    const screens = await setup.root.locator(".escrita-setup-screens .escrita-setup-card").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(screens).size, "layout cards stacked").toBe(1);
    await app.screenshot("1. step 2 on a phone", setup.root);
  });

  test("2. Mesa de escrita: outline and lens are two tabs of the right drawer, no split, no universe tab", async () => {
    await setup.card("Mesa de escrita").click();
    await setup.button("Criar").click();
    await app.notice("Pronto. Criei");
    await settle(1500);
    const where = await app.placement(["escrita-outline", "escrita-lens", "escrita-universe"]);
    expect(where["escrita-outline"]).toMatchObject({ side: "right" });
    expect(where["escrita-lens"]).toMatchObject({ side: "right" });
    expect(where["escrita-outline"]!.tabs).toContain("escrita-lens"); // one tab group: no split
    expect(where["escrita-outline"]!.index).toBe(where["escrita-lens"]!.index);
    expect(where["escrita-universe"], "no universe tab on the desk layout of a vault without the universe").toBeNull();
    await app.screenshot("2. the desk layout on a phone");
  });

  test("3. writing mode: no bottom navigation bar and no note header; the exit button (44 px) shows without hover; the counter clears the bottom edge", async () => {
    await app.openFile("Início.md");
    await app.command("enter-writing-mode");
    await app.waitFor("writing mode", () => app.page.evaluate(() => document.body.classList.contains("escrita-writing-mode")), 10_000);
    await settle(600);
    const hidden = (sel: string) => app.page.locator(sel).first().evaluate((e) => getComputedStyle(e).display === "none").catch(() => true);
    expect(await hidden(".mobile-navbar"), ".mobile-navbar hidden").toBe(true);
    expect(await hidden(".view-header"), ".view-header hidden").toBe(true);
    const exit = app.page.locator(".escrita-writing-exit");
    await expect(exit).toBeVisible();
    const b = (await exit.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
    const goal = app.page.locator(".escrita-writing-goal");
    await expect(goal).toBeVisible();
    const g = (await goal.boundingBox())!;
    expect(g.y + g.height, "the counter sits above the bottom edge").toBeLessThanOrEqual(844);
    await app.screenshot("3. writing mode on a phone");
    await app.command("exit-writing-mode");
  });

  test("4. the Features page: the preset buttons are 44 px tall and wrap inside the window", async () => {
    const s = await settingsPage(app);
    const btns = s.locator(".escrita-preset-btn");
    await expect(btns).toHaveCount(4);
    for (const b of await btns.all()) {
      await b.scrollIntoViewIfNeeded();
      const r = (await b.boundingBox())!;
      expect(r.height, await b.innerText()).toBeGreaterThanOrEqual(44);
      expect(r.x + r.width).toBeLessThanOrEqual(390);
    }
    await app.screenshot("4. the preset buttons on a phone", s.locator(".escrita-presets"));
    expect(await stickingOut(s, ".vertical-tab-content")).toEqual([]);
    await app.closeModals();
  });
});

test.describe("G4 (5) and MOBILE-1.0's checklist: the views, the modals and the menus on an emulated phone", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  let app: App;

  test.beforeAll(async () => {
    app = await App.launch({ vault: world({ seeded: true }) });
    await app.setSettings({ ...WORLD_SETTINGS, features: ALL_ON, explorerCounts: true, spellcheckOnDemand: true, homeNote: "Início.md" });
    await settle(1500);
    await app.emulateMobile(true);
    await app.openFile("Contos/O afogado.md");
  });
  test.afterAll(async () => {
    await app?.close();
  });

  /** A menu on a phone is a sheet with a backdrop: a tap on the backdrop closes it. */
  const closeMenu = async () => {
    await app.page.keyboard.press("Escape");
    await app.waitFor("the menu to close", async () => (await app.page.locator(".menu").count()) === 0, 4000).catch(async () => {
      await app.page.locator(".suggestion-bg").first().click({ position: { x: 5, y: 5 }, force: true });
      await app.waitFor("the menu to close", async () => (await app.page.locator(".menu").count()) === 0, 4000);
    });
    await app.page.waitForFunction(() => document.querySelectorAll(".suggestion-bg").length === 0, null, { timeout: 4000 }).catch(() => {});
    await settle(700); // the drawer the menu came from collapses a moment later
  };

  /** A drawer closes with the menu opened from it: show the panel again. */
  const reveal = async (type: string) => {
    await app.page.evaluate((ty) => {
      const leaf = window.app.workspace.getLeavesOfType(ty)[0];
      leaf.parent.selectTab?.(leaf);
      leaf.getRoot().expand?.();
    }, type);
    await settle(600);
  };

  const noSideScroll = async () => {
    expect(await scrollsSideways(app.page), "the page scrolls sideways").toBe(false);
  };

  test("5. the universe panel: each entry row shows the ⋯ button without hover, it opens the same menu as the right click, and a tap on the row opens the entry", async () => {
    await app.command("open-universe");
    const row = app.page.locator(".escrita-universe-entry").filter({ hasText: "Maria" }).first();
    await expect(row).toBeVisible();
    const more = row.locator(".escrita-universe-entry-more");
    await expect(more).toBeVisible();
    const box = (await more.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(32);
    expect(box.height).toBeGreaterThanOrEqual(32);
    const opacity = await more.evaluate((e) => getComputedStyle(e).opacity);
    expect(opacity).toBe("1");
    const items = () => app.page.locator(".menu .menu-item").allInnerTexts();
    await more.click();
    await expect(app.page.locator(".menu")).toBeVisible();
    const viaButton = await items();
    expect(viaButton.length).toBeGreaterThan(2);
    await app.screenshot("5. the entry menu on a phone");
    await closeMenu();
    await reveal("escrita-universe");
    await row.click({ button: "right" });
    await expect(app.page.locator(".menu")).toBeVisible();
    expect(await items()).toEqual(viaButton);
    await closeMenu();
    await reveal("escrita-universe"); // the drawer closes with the menu
    await expect(row.locator(".escrita-universe-entry-text"), JSON.stringify(await app.page.evaluate(() => [window.app.workspace.leftSplit.collapsed, window.app.workspace.rightSplit.collapsed]))).toBeVisible();
    await row.locator(".escrita-universe-entry-text").click();
    await app.waitFor("the entry", async () => (await app.activeFile()) === "Universo/Personagens/Maria.md", 8000);
  });

  test("checklist 2: every view opens from the palette with no sideways scroll and every button inside the window", async () => {
    await app.openFile("Contos/O afogado.md");
    const views: [string, string][] = [
      ["open-outline", ".view-content:has(.escrita-outline-root), .escrita-outline"],
      ["toggle-revision-lens", ".escrita-lens-panel, .escrita-lens-rules"],
      ["open-placeholders", ".escrita-placeholders"],
      ["open-darlings", ".escrita-darlings-header"],
      ["open-snapshots", ".escrita-snapshots"],
      ["open-universe", ".escrita-universe-groups"],
      ["show-threads", ".escrita-universe-threads, .escrita-threads"],
    ];
    const opened: string[] = [];
    for (const [id, selector] of views) {
      if (!(await app.commandListed(id))) continue;
      await app.command(id);
      await settle(700);
      await noSideScroll();
      const el = app.page.locator(selector).first();
      if (await el.count()) {
        opened.push(id);
        expect(await outsideWindow(app, selector.split(",")[0]), id).toEqual([]);
      }
      await app.page.evaluate(() => { window.app.workspace.rightSplit.collapse(); window.app.workspace.leftSplit.collapse(); });
    }
    expect(opened.length, `views whose selector matched: ${opened}`).toBeGreaterThanOrEqual(4);
  });

  test("checklist 3: the modals fit the window and none of their buttons is cut off (export with the preview is the widest)", async () => {
    await app.openFile("Livros/O farol.md");
    const fits = async (name: string) => {
      const modal = app.page.locator(".modal-container .modal").first();
      await expect(modal, name).toBeVisible();
      const r = (await modal.boundingBox())!;
      expect(r.x, `${name} left`).toBeGreaterThanOrEqual(-1);
      expect(r.x + r.width, `${name} right`).toBeLessThanOrEqual(391);
      expect(await outsideWindow(app, ".modal-container .modal"), name).toEqual([]);
      await app.screenshot(`checklist 3. ${name}`, modal);
    };
    await app.command("export");
    await fits("export");
    await app.modal.getByRole("button", { name: "Prévia", exact: true }).click();
    await expect(app.page.locator(".escrita-export-scroll")).toBeVisible();
    await fits("export preview");
    await app.closeModals();
    await app.command("open-progress");
    await expect(app.page.locator(".escrita-tile").first()).toBeVisible();
    await fits("progress");
    await app.closeModals();
    await app.command("setup");
    await fits("setup");
    await app.closeModals();
    await app.openFile("Contos/O afogado.md");
    await app.page.evaluate(() => {
      const ed = window.app.workspace.activeEditor!.editor!;
      const i = ed.getValue().indexOf("Teo");
      ed.setSelection(ed.offsetToPos(i), ed.offsetToPos(i + 3));
    });
    await app.command("create-entry");
    await fits("new entry");
    await app.closeModals();
  });

  test("checklist 4: the outline's ⋯ on a chapter and on a beat open a menu; there is no drag handle", async () => {
    await app.openFile("Livros/O farol/Capítulos/02 A tempestade.md");
    await app.command("open-outline");
    await settle(900);
    const chapterMore = app.page.locator(".escrita-outline-more").first();
    await expect(chapterMore).toBeVisible();
    await chapterMore.click();
    await expect(app.page.locator(".menu")).toBeVisible();
    await closeMenu();
    await reveal("escrita-outline");
    const beatMore = app.page.locator(".escrita-outline-beat .escrita-outline-more").first();
    await expect(beatMore).toBeVisible();
    await beatMore.click();
    await expect(app.page.locator(".menu")).toBeVisible();
    await closeMenu();
    expect(await app.page.locator('.escrita-outline [draggable="true"], .escrita-outline-num[draggable=true]').count(), "no drag handle").toBe(0);
    await app.screenshot("checklist 4. the outline on a phone");
  });

  test("checklist 5: stepping through a lens rule closes the drawer and shows a notice with the position", async () => {
    app.writeVaultFile("Contos/Lente.md", "---\nstatus: rascunho\n---\n\nEla andou rapidamente. Ele respondeu calmamente. Depois saiu lentamente.\n");
    await settle(800);
    await app.openFile("Contos/Lente.md");
    await app.command("toggle-revision-lens");
    await app.page.evaluate(() => window.app.workspace.rightSplit.expand());
    const rule = app.page.locator(".escrita-lens-row", { hasText: "Advérbios" }).locator(".escrita-lens-rulename");
    await expect(rule).toBeEnabled({ timeout: 10_000 });
    await app.dismissNotices();
    await rule.click();
    await app.notice(/Advérbios|1 de 3|1\/3|1 of 3/);
    await app.waitFor("the drawer closed", () => app.page.evaluate(() => window.app.workspace.rightSplit.collapsed), 5000);
  });

  test("checklist 7: the Features page and a long section (the lens) scroll without going sideways", async () => {
    const s = await settingsPage(app);
    expect(await stickingOut(s, ".vertical-tab-content")).toEqual([]);
    const heads = s.locator(".setting-item-heading");
    const lens = heads.filter({ hasText: /Revisão · a lente|Lente/ }).first();
    if (await lens.count()) await lens.scrollIntoViewIfNeeded();
    expect(await stickingOut(s, ".vertical-tab-content")).toEqual([]);
    expect(await smallTargets(s.locator(".vertical-tab-content"), ".escrita-switch, .escrita-preset-btn", 32)).toEqual([]);
    await app.screenshot("checklist 7. the lens settings on a phone", s.locator(".vertical-tab-content"));
    await app.closeModals();
  });
});
