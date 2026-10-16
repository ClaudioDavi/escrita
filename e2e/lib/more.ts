// More helpers for the specs that replaced the by-hand pages (TEST-1.0): the settings window,
// geometry (overlap, wrap, touch targets, horizontal scroll) and a few readers of the plugin's
// state. Pure additions: nothing here changes how the harness starts or stops Obsidian.
import type { Locator, Page } from "@playwright/test";
import type { App } from "./app";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Obsidian's settings window is a second page (about:blank), not part of the main window's DOM.
 * Opens the tab (the plugin's by default) and returns that page.
 */
export async function settingsPage(app: App, tabId = "escrita"): Promise<Page> {
  await app.openSettings(tabId);
  let found: Page | undefined;
  await app.waitFor("the settings window", async () => {
    // on a phone the settings are a modal of the main window; on desktop a window of their own
    for (const p of [...app.page.context().pages().filter((x) => x !== app.page), app.page]) {
      if ((await p.locator(".vertical-tab-content").count().catch(() => 0)) > 0) { found = p; return true; }
    }
    return false;
  });
  const phone = await app.page.evaluate(() => document.body.classList.contains("is-mobile"));
  if (phone) await settle(1200); // the phone's settings slide from the list to the tab
  if (found !== app.page) {
    await found!.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1100, height: 800 }).catch(() => { /* a window that cannot be resized keeps its size */ });
  }
  return found!;
}

/** The first visible bounding box of a locator, or null. */
export async function box(loc: Locator): Promise<Box | null> {
  return loc.first().boundingBox();
}

export const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

/** Whether the page scrolls sideways (the document, or `selector`'s element when given). */
export function scrollsSideways(page: Page, selector?: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = sel ? document.querySelector(sel) as HTMLElement | null : document.documentElement;
    return !!el && el.scrollWidth > el.clientWidth + 1;
  }, selector ?? null);
}

/** Buttons and ticks under `scope` that are smaller than `min` px on a side (visible ones only). */
export function smallTargets(scope: Locator, selector = "button, [role=button], [role=checkbox], .escrita-setup-ck, select, input[type=checkbox]", min = 32): Promise<string[]> {
  return scope.evaluate((root, [sel, m]) => {
    const out: string[] = [];
    for (const el of root.querySelectorAll(sel as string)) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < (m as number) || r.height < (m as number)) {
        out.push(`${(el as HTMLElement).className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)} "${((el as HTMLElement).innerText || el.getAttribute("aria-label") || "").slice(0, 30)}"`);
      }
    }
    return out;
  }, [selector, min] as const);
}

/** Number of text lines an element wraps to (height over line height). */
export function lineCount(loc: Locator): Promise<number> {
  return loc.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    return Math.round(el.getBoundingClientRect().height / lh);
  });
}

/** Whether the body shows writing mode (the class the plugin sets). */
export function inWritingMode(app: App): Promise<boolean> {
  return app.page.evaluate(() => document.body.classList.contains("escrita-writing-mode"));
}

/** A tiny pause for animations and debounced redraws. */
export const settle = (ms = 400): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Pairs of text-bearing elements under `scope` whose boxes overlap although neither contains
 * the other. Empty when nothing collides. Used for "no row overlaps another".
 */
export function overlappingPairs(scope: Locator, selector = "*"): Promise<string[]> {
  return scope.evaluate((root, sel) => {
    const own = (el: Element) => [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
    const els = [...root.querySelectorAll(sel as string)].filter((el) => own(el) && (el as HTMLElement).getBoundingClientRect().width > 0) as HTMLElement[];
    const out: string[] = [];
    const label = (el: HTMLElement) => `${el.className || el.tagName}:"${(el.innerText || "").slice(0, 24)}"`;
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i], b = els[j];
        if (a.contains(b) || b.contains(a)) continue;
        const r = a.getBoundingClientRect(), s = b.getBoundingClientRect();
        const x = Math.min(r.right, s.right) - Math.max(r.left, s.left);
        const y = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
        if (x > 1 && y > 1) out.push(`${label(a)} x ${label(b)}`);
      }
    }
    return out;
  }, selector);
}

/**
 * The innermost elements under `scopeSelector` that stick out of its right edge or the window's
 * (an element whose children stick out too is left out, so the list names the cause, not the chain).
 */
export function stickingOut(page: Page, scopeSelector = "body"): Promise<string[]> {
  return page.evaluate((sel) => {
    const scope = document.querySelector(sel) as HTMLElement | null;
    if (!scope) return [`no ${sel}`];
    const edge = Math.min(scope.getBoundingClientRect().right, window.innerWidth);
    const out = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.closest("[aria-hidden=true], .is-measuring") && r.right > edge + 1 && getComputedStyle(el).position !== "fixed";
    };
    const found: string[] = [];
    for (const el of scope.querySelectorAll("*")) {
      if (!out(el) || [...el.children].some(out)) continue;
      const r = (el as HTMLElement).getBoundingClientRect();
      found.push(`${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).split(" ").join(".")} "${(el.textContent ?? "").slice(0, 30)}" right=${Math.round(r.right)} edge=${Math.round(edge)}`);
    }
    return found.slice(0, 12);
  }, scopeSelector);
}
