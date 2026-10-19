// An optional screen recording of a spec. The harness attaches to Obsidian over CDP, so
// Playwright's recordVideo does not work; this uses the DevTools screencast instead
// (Page.startScreencast), keeps every frame with its timestamp and encodes an mp4 with ffmpeg.
// Active only when the RECORD environment variable names a folder; otherwise `Recorder.start`
// returns null and the spec runs as usual, without pauses.
import type { CDPSession, Locator, Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** The folder from RECORD, or null when recording is off. */
export const recordDir = (): string | null => process.env.RECORD || null;

export class Recorder {
  private frames: { file: string; at: number }[] = [];
  private pending: Promise<unknown>[] = [];
  private session: CDPSession | null = null;
  private framesDir: string;

  private constructor(private page: Page, readonly dir: string) {
    this.framesDir = path.join(dir, "frames");
  }

  /** Starts recording when RECORD is set (and clears the folder's old frames); null otherwise. */
  static async start(page: Page): Promise<Recorder | null> {
    const dir = recordDir();
    if (!dir) return null;
    const r = new Recorder(page, dir);
    fs.mkdirSync(dir, { recursive: true });
    fs.rmSync(r.framesDir, { recursive: true, force: true });
    fs.mkdirSync(r.framesDir, { recursive: true });
    await r.attach(page);
    return r;
  }

  /** Starts the screencast of `page` (frames of every page share one timeline and one numbering). */
  private async attach(page: Page): Promise<void> {
    this.page = page;
    this.session = await page.context().newCDPSession(page);
    const session = this.session;
    session.on("Page.screencastFrame", (ev: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
      const at = ev.metadata.timestamp ?? Date.now() / 1000;
      const file = path.join(this.framesDir, `${String(this.frames.length).padStart(6, "0")}.jpg`);
      this.frames.push({ file, at });
      this.pending.push(fs.promises.writeFile(file, Buffer.from(ev.data, "base64")));
      void session.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => { /* page closing */ });
    });
    await session.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: 1280, everyNthFrame: 1 });
  }

  /**
   * Moves the recording to another page of the same Obsidian (the settings window is a page of
   * its own). Give both pages the same size or the encoder scales the new frames to the first.
   */
  async follow(page: Page): Promise<void> {
    try { await this.session?.send("Page.stopScreencast"); } catch { /* already gone */ }
    await this.attach(page);
  }

  /** Stops the screencast and waits for the frames to be on disk. */
  async stop(): Promise<void> {
    try { await this.session?.send("Page.stopScreencast"); } catch { /* already gone */ }
    await Promise.all(this.pending);
  }

  /** Encodes the frames, by their timestamps, into <dir>/<name>.mp4 and returns its path. */
  encode(name: string): string {
    const out = path.join(this.dir, `${name}.mp4`);
    if (this.frames.length === 0) throw new Error("no frames were recorded");
    const list = path.join(this.framesDir, "list.txt");
    const lines: string[] = [];
    this.frames.forEach((f, i) => {
      const next = this.frames[i + 1];
      const seconds = next ? Math.max(next.at - f.at, 0.001) : 1;
      lines.push(`file '${f.file}'`, `duration ${seconds.toFixed(4)}`);
    });
    // the concat demuxer ignores the last duration unless the last file is repeated
    lines.push(`file '${this.frames[this.frames.length - 1].file}'`);
    fs.writeFileSync(list, lines.join("\n") + "\n");
    // libx264 when this ffmpeg has it; some builds only ship OpenH264 (which wants a bitrate)
    const encoders = execFileSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" });
    const codec = encoders.includes("libx264") ? ["-c:v", "libx264"] : ["-c:v", "libopenh264", "-b:v", "4M"];
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-r", "30", ...codec, "-pix_fmt", "yuv420p", out,
    ], { stdio: "inherit" });
    return out;
  }
}

export interface CaptionOptions {
  /** where on the window; default the bottom edge */
  where?: "bottom" | "top" | "center";
  /** font size in px; default 24 */
  size?: number;
}

/** Shows a caption over the window (a fixed element on the body); a new call replaces it. */
export async function caption(page: Page, text: string, opts: CaptionOptions = {}): Promise<void> {
  await page.evaluate(([s, where, size]) => {
    document.getElementById("escrita-e2e-caption")?.remove();
    const el = document.createElement("div");
    el.id = "escrita-e2e-caption";
    el.textContent = s;
    const place = where === "top" ? "top:12px;transform:translateX(-50%);"
      : where === "center" ? "top:50%;transform:translate(-50%,-50%);"
      : "bottom:40px;transform:translateX(-50%);";
    // large, warm and high-contrast, so it reads at phone size on YouTube
    el.style.cssText = `position:fixed;left:50%;${place}z-index:2147483647;max-width:84%;text-align:center;` +
      `background:rgba(32,22,16,0.92);color:#fdf6ea;font:600 ${size}px/1.3 system-ui,sans-serif;letter-spacing:0.01em;` +
      `padding:12px 24px;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,0.35);pointer-events:none;`;
    document.body.appendChild(el);
  }, [text, opts.where ?? "bottom", opts.size ?? 24] as const);
}

export function removeCaption(page: Page): Promise<void> {
  return page.evaluate(() => document.getElementById("escrita-e2e-caption")?.remove());
}

const SPOT_ID = "escrita-e2e-spotlight";

/**
 * Draws a spotlight around an element until `spotlightOff`: an absolutely positioned box with a soft
 * accent border and a light dim around it, on top of everything and with pointer-events none, so it
 * never changes a click or an assertion. It follows the element if it moves or changes size.
 */
export async function spotlightOn(page: Page, target: Locator, label?: string): Promise<void> {
  await target.first().evaluate((el, [id, text]) => {
    document.getElementById(id)?.remove();
    const box = document.createElement("div");
    box.id = id;
    box.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;border:3px solid rgba(255,170,0,0.95);" +
      "border-radius:10px;box-shadow:0 0 0 9999px rgba(0,0,0,0.22),0 0 16px 4px rgba(255,170,0,0.55);";
    if (text) {
      const tag = document.createElement("div");
      tag.textContent = text;
      tag.style.cssText = "position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);white-space:nowrap;" +
        "background:rgba(255,170,0,0.95);color:#000;font:700 13px sans-serif;padding:3px 10px;border-radius:6px;";
      box.appendChild(tag);
    }
    document.body.appendChild(box);
    const place = () => {
      if (!box.isConnected) return;
      const r = el.getBoundingClientRect();
      box.style.left = `${r.left - 6}px`;
      box.style.top = `${r.top - 4}px`;
      box.style.width = `${r.width + 12}px`;
      box.style.height = `${r.height + 8}px`;
      requestAnimationFrame(place);
    };
    place();
  }, [SPOT_ID, label ?? ""] as const);
}

export function spotlightOff(page: Page): Promise<void> {
  return page.evaluate((id) => document.getElementById(id)?.remove(), SPOT_ID);
}

/** A spotlight around the element for `ms`, then removed. */
export async function spotlight(page: Page, target: Locator, opts: { ms: number; label?: string }): Promise<void> {
  await spotlightOn(page, target, opts.label);
  await new Promise((r) => setTimeout(r, opts.ms));
  await spotlightOff(page);
}
