// Timing helpers for the measured gates (TEST-0.9 G0d). Three instruments:
// - `timeToFirstText`: from running a command to the first drawn text and to the frame after it;
// - `Trace`: a DevTools trace of the renderer's main thread, so the longest task is read as the
//   Performance tab's "Main" track shows it (RunTask events), not only the 50 ms and up that the
//   Long Tasks API reports;
// - `scrollToEnd`: scrolls a pane from top to bottom in animation frames and reports the frame gaps.
import type { CDPSession } from "@playwright/test";
import type { App } from "./app";

export interface FirstText {
  /** from the command to the first drawn text, ms */
  textMs: number;
  /** from the command to the frame after it, ms */
  paintedMs: number;
  /** what the match was: its text length and the nearest `data-path` above it (the chapter), to show it is real text */
  length: number;
  path: string | null;
}

/** Runs a command and waits for the first element matching `selector` that has text. */
export function timeToFirstText(ob: App, command: string, selector: string): Promise<FirstText> {
  const full = command.includes(":") ? command : `escrita:${command}`;
  return ob.page.evaluate(async ([cmd, sel]) => {
    const t0 = performance.now();
    let hit: Element | null = null;
    const found = new Promise<number>((resolve) => {
      const mo = new MutationObserver(() => {
        const el = document.querySelector(sel);
        if (el && (el.textContent ?? "").trim() !== "") { hit = el; mo.disconnect(); resolve(performance.now()); }
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    app.commands.executeCommandById(cmd);
    const t1 = await found;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const el = hit as Element | null;
    return {
      textMs: t1 - t0,
      paintedMs: performance.now() - t0,
      length: (el?.textContent ?? "").trim().length,
      path: el?.closest("[data-path]")?.getAttribute("data-path") ?? null,
    };
  }, [full, selector] as const);
}

export interface ScrollRun {
  /** wall time of the scroll, ms */
  durationMs: number;
  frames: number;
  /** the widest gap between two animation frames, ms (a block of the main thread shows up here) */
  maxFrameGapMs: number;
  /** the scroll position and height at the end, to show it reached the bottom */
  reachedBottom: boolean;
}

/**
 * Scrolls `selector` from the top to the bottom, `stepPx` per animation frame, and keeps going
 * until the end is reached and `settled()` (checked in the page) is true, or `maxMs` pass.
 */
export function scrollToEnd(ob: App, selector: string, stepPx = 120, maxMs = 90_000): Promise<ScrollRun> {
  return ob.page.evaluate(async ([sel, step, max]) => {
    const el = document.querySelector(sel) as HTMLElement;
    el.scrollTop = 0;
    const start = performance.now();
    let last = start;
    let maxGap = 0;
    let frames = 0;
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        maxGap = Math.max(maxGap, now - last);
        last = now;
        frames++;
        el.scrollTop += step;
        const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
        const pending = el.querySelector(".is-pending") !== null;
        if ((atEnd && !pending) || now - start > max) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return {
      durationMs: performance.now() - start,
      frames,
      maxFrameGapMs: maxGap,
      reachedBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 2,
    };
  }, [selector, stepPx, maxMs] as const);
}

export interface TraceResult {
  /** the longest RunTask on a renderer main thread, ms */
  longestMs: number;
  /** the five longest, ms */
  top: number[];
  /** how many tasks were 20 ms and up, and 50 ms and up */
  over20: number;
  over50: number;
  tasks: number;
}

/** A DevTools trace of the browser, for the longest main-thread task. Start before, `stop()` after. */
export class Trace {
  private session: CDPSession | null = null;
  private events: { name?: string; ph?: string; dur?: number; pid?: number; tid?: number; args?: { name?: string } }[] = [];
  private done: Promise<void> | null = null;

  async start(ob: App): Promise<boolean> {
    try {
      // the browser-level session: tracing is not a page domain
      const browser = (ob.obsidian as unknown as { browser: { newBrowserCDPSession(): Promise<CDPSession> } }).browser;
      const session = await browser.newBrowserCDPSession();
      this.session = session;
      this.events = [];
      session.on("Tracing.dataCollected", (e: { value: Trace["events"] }) => { this.events.push(...e.value); });
      this.done = new Promise((resolve) => session.once("Tracing.tracingComplete", () => resolve()));
      await session.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "toplevel", "__metadata"], recordMode: "recordAsMuchAsPossible" } } as never);
      return true;
    } catch {
      this.session = null;
      return false;
    }
  }

  async stop(): Promise<TraceResult | null> {
    const s = this.session;
    if (!s) return null;
    await s.send("Tracing.end");
    await this.done;
    await s.detach().catch(() => {});
    this.session = null;
    // the renderer main threads: thread_name "CrRendererMain"
    const mains = new Set(this.events.filter((e) => e.name === "thread_name" && e.args?.name === "CrRendererMain").map((e) => `${e.pid}:${e.tid}`));
    const durs = this.events
      .filter((e) => e.name === "RunTask" && e.ph === "X" && typeof e.dur === "number" && mains.has(`${e.pid}:${e.tid}`))
      .map((e) => (e.dur as number) / 1000)
      .sort((a, b) => b - a);
    if (durs.length === 0) return null;
    return { longestMs: durs[0], top: durs.slice(0, 5), over20: durs.filter((d) => d >= 20).length, over50: durs.filter((d) => d >= 50).length, tasks: durs.length };
  }
}

export const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;
