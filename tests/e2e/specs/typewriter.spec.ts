// The typewriter scroll in writing mode (1.3, SF 17; PLAN-1.3 D3, D4, D7). In a tracked note the
// line being typed sits two thirds of the way down the editor (its top within 0.63 to 0.70 of the
// scroller's height), once the text is long enough to get there; a click or a mouse scroll leaves the
// scroll alone and the next key brings the line back; select-all never jumps; a short note never
// scrolls; the setting "off" and leaving the mode stop it; "tracked" leaves the home note alone and
// "all" takes it.
import { expect, test } from "@playwright/test";
import { App } from "../lib/app";
import { settle } from "../lib/more";
import { emptyEn } from "../fixtures";

const para = (i: number) => `Paragraph ${i}. The sea rose slowly that night and nobody on the shore said a word about it, though everyone watched the water climb the old stones of the pier, one step and then another.`;
const LONG = Array.from({ length: 80 }, (_, i) => para(i)).join("\n\n") + "\n";
const SHORT = "A title\n\nFirst paragraph of the short note.\n\nSecond paragraph.\n\nThird paragraph.\n";
const LOW = 0.63;
const HIGH = 0.70;

let ob: App;

interface Metrics { frac: number | null; scrollTop: number; height: number; line: number }

const metrics = (): Promise<Metrics> => ob.page.evaluate(() => {
  const cm = app.workspace.activeEditor.editor.cm;
  const sd = cm.scrollDOM;
  const head = cm.state.selection.main.head;
  const co = cm.coordsAtPos(head);
  const r = sd.getBoundingClientRect();
  return {
    frac: co ? (co.top - r.top) / sd.clientHeight : null,
    scrollTop: Math.round(sd.scrollTop),
    height: sd.clientHeight,
    line: cm.state.doc.lineAt(head).number,
  };
});

/** The line sits at two thirds, with a little time for the measure and the scroll to land. */
async function expectTwoThirds(what: string): Promise<void> {
  await settle(350);
  const m = await metrics();
  expect(m.frac, `${what}: ${JSON.stringify(m)}`).not.toBeNull();
  expect(m.frac!, `${what} (low): ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(LOW);
  expect(m.frac!, `${what} (high): ${JSON.stringify(m)}`).toBeLessThanOrEqual(HIGH);
}

async function view(mode: "lp" | "source"): Promise<void> {
  await ob.page.evaluate(async (m) => {
    const leaf = app.workspace.getMostRecentLeaf();
    const st = leaf.getViewState();
    st.state.mode = "source";
    st.state.source = m === "source";
    await leaf.setViewState(st);
  }, mode);
  await settle(600);
}

/** Puts the cursor at a line (0-based; "end" for the last) with no user event, and focuses the editor. */
async function cursorAt(line: number | "end", ch: "end" | number = "end"): Promise<void> {
  await ob.page.evaluate(([l, c]) => {
    const ed = app.workspace.activeEditor.editor;
    ed.focus();
    const n = l === "end" ? ed.lastLine() : (l as number);
    ed.setCursor({ line: n, ch: c === "end" ? ed.getLine(n).length : (c as number) });
  }, [line, ch] as const);
  await settle(300);
}

const setScroll = (top: number): Promise<void> => ob.page.evaluate((t) => { app.workspace.activeEditor.editor.cm.scrollDOM.scrollTop = t; }, top);

async function open(path: string): Promise<void> {
  await ob.openFile(path);
  await settle(800);
}

const inMode = (on: boolean): Promise<void> => ob.command(on ? "enter-writing-mode" : "exit-writing-mode").then(() => settle(700));

/** Types on a new last line, so the cursor goes to the end of the note. */
async function typeAtEnd(text = "typed words"): Promise<void> {
  await cursorAt("end");
  await ob.page.keyboard.press("Enter");
  await ob.page.keyboard.type(text, { delay: 5 });
}

test.describe("Typewriter scroll", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    const vault = emptyEn({ seeded: true });
    vault.files["Stories/Long.md"] = LONG;
    vault.files["Stories/Short.md"] = SHORT;
    vault.files["Home.md"] = LONG;
    ob = await App.launch({ vault });
    await settle(1500);
    await ob.setSettings({ trackFolders: "Stories", writingModeTypewriter: "tracked", draftNewNotes: false });
    await ob.dismissNotices();
  });
  test.afterAll(async () => {
    await ob?.close();
  });

  test("(a) typing at the end of a tracked note, in Live Preview and in source mode", async () => {
    await open("Stories/Long.md");
    await inMode(true);
    for (const mode of ["lp", "source"] as const) {
      await view(mode);
      await typeAtEnd(`line in ${mode}`);
      await expectTwoThirds(`typing at the end, ${mode}`);
      await ob.page.keyboard.type(" and some more words to type", { delay: 5 });
      await expectTwoThirds(`typing on, ${mode}`);
    }
  });

  test("(b) Enter, ArrowDown, PageDown, Ctrl+Home then typing, Ctrl+End and Ctrl+Z", async () => {
    await view("lp");
    await cursorAt(100, 0);
    await ob.page.keyboard.press("Enter");
    await expectTwoThirds("after Enter");
    await ob.page.keyboard.press("ArrowDown");
    await expectTwoThirds("after ArrowDown");
    await ob.page.keyboard.press("PageDown");
    await expectTwoThirds("after PageDown");
    await ob.page.keyboard.press("Control+Home");
    await ob.page.keyboard.type("start ", { delay: 5 });
    // the first line is higher than two thirds: the note cannot scroll above its top
    expect((await metrics()).scrollTop, "typing on the first line").toBe(0);
    await ob.page.keyboard.press("Control+End");
    await expectTwoThirds("after Ctrl+End");
    await ob.page.keyboard.type("UNDOME", { delay: 5 });
    await cursorAt(40, 0);
    await setScroll(0);
    await settle(300);
    await ob.page.keyboard.press("Control+z");
    await expectTwoThirds("after Ctrl+Z");
  });

  test("(c) a click leaves the scroll alone, a mouse scroll stays, the next key recenters", async () => {
    await typeAtEnd("anchor line");
    await expectTwoThirds("before the click");
    const before = await metrics();
    const spot = await ob.page.evaluate(() => {
      const top = document.querySelector(".workspace-leaf.mod-active .cm-scroller")!.getBoundingClientRect();
      const l = [...document.querySelectorAll(".workspace-leaf.mod-active .cm-line")].find((x) => {
        const r = x.getBoundingClientRect();
        return r.top > top.top + 40 && r.bottom < top.top + top.height * 0.5 && (x.textContent ?? "").length > 20;
      })!;
      const r = l.getBoundingClientRect();
      return { x: r.left + 60, y: r.top + 8 };
    });
    await ob.page.mouse.click(spot.x, spot.y);
    await settle(500);
    expect((await metrics()).scrollTop, "a click").toBe(before.scrollTop);
    await ob.page.mouse.move(spot.x, spot.y);
    await ob.page.mouse.wheel(0, -400);
    await settle(500);
    const afterWheel = await metrics();
    expect(afterWheel.scrollTop, "the wheel moved the note").toBeLessThan(before.scrollTop);
    await settle(500);
    expect((await metrics()).scrollTop, "the wheel scroll stays").toBe(afterWheel.scrollTop);
    await ob.page.keyboard.type("k", { delay: 5 });
    await expectTwoThirds("the next key");
  });

  test("(d) select-all leaves the scroll alone", async () => {
    await typeAtEnd("before select all");
    await expectTwoThirds("before select-all");
    const before = await metrics();
    await ob.page.keyboard.press("Control+a");
    await settle(500);
    expect((await metrics()).scrollTop, "select-all").toBe(before.scrollTop);
  });

  test("(e) a short note and the first lines of a long one never scroll", async () => {
    await open("Stories/Short.md");
    await view("lp");
    await typeAtEnd("a few more words");
    await settle(400);
    expect((await metrics()).scrollTop, "typing at the end of a short note").toBe(0);
    await open("Stories/Long.md");
    await cursorAt(60, 0);
    await ob.page.keyboard.press("Control+Home");
    await settle(400);
    expect((await metrics()).scrollTop, "after Ctrl+Home").toBe(0);
    for (let i = 0; i < 4; i++) await ob.page.keyboard.press("ArrowDown");
    await settle(400);
    expect((await metrics()).scrollTop, "the first lines").toBe(0);
  });

  test("(f) after a window resize the line is still at two thirds", async () => {
    await open("Stories/Long.md");
    await view("lp");
    await typeAtEnd("before the resize");
    await expectTwoThirds("before the resize");
    const size = await ob.page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    for (const h of [Math.max(500, size.height - 250), size.height]) {
      await ob.page.setViewportSize({ width: size.width, height: h });
      await settle(700);
      await ob.page.keyboard.type("r", { delay: 5 });
      await expectTwoThirds(`after a resize to ${h} px`);
    }
  });

  test("(g) the setting off, and leaving writing mode: no recentering, the scroll stays", async () => {
    await open("Stories/Long.md");
    await view("lp");
    // a visible cursor high in the window, so Obsidian's own scroll has nothing to do
    const high = async () => {
      await cursorAt(60, 0);
      await ob.page.evaluate(() => {
        const cm = app.workspace.activeEditor.editor.cm;
        const head = cm.state.selection.main.head;
        const sd = cm.scrollDOM;
        sd.scrollTop = Math.max(0, cm.lineBlockAt(head).top - sd.clientHeight * 0.2);
      });
      await settle(400);
      return metrics();
    };
    await ob.setSettings({ writingModeTypewriter: "off" });
    const off0 = await high();
    await ob.page.keyboard.type("x", { delay: 5 });
    await settle(400);
    expect((await metrics()).scrollTop, "typing with the setting off").toBe(off0.scrollTop);
    await ob.setSettings({ writingModeTypewriter: "tracked" });
    await typeAtEnd("back on");
    await expectTwoThirds("the setting back on");
    const leaving = await metrics();
    await inMode(false);
    expect((await metrics()).scrollTop, "leaving writing mode").toBe(leaving.scrollTop);
    const out0 = await high();
    await ob.page.keyboard.type("y", { delay: 5 });
    await settle(400);
    expect((await metrics()).scrollTop, "typing outside writing mode").toBe(out0.scrollTop);
    await inMode(true);
  });

  test("(h) the home note: untracked, never with \"tracked\"; every note with \"all\"", async () => {
    await open("Home.md");
    await view("lp");
    await ob.setSettings({ writingModeTypewriter: "tracked" });
    await cursorAt(60, 0);
    await ob.page.evaluate(() => {
      const cm = app.workspace.activeEditor.editor.cm;
      const sd = cm.scrollDOM;
      sd.scrollTop = Math.max(0, cm.lineBlockAt(cm.state.selection.main.head).top - sd.clientHeight * 0.2);
    });
    await settle(400);
    const before = await metrics();
    await ob.page.keyboard.type("x", { delay: 5 });
    await ob.page.keyboard.press("Enter");
    await settle(400);
    expect((await metrics()).scrollTop, "the home note with tracked").toBe(before.scrollTop);
    await ob.setSettings({ writingModeTypewriter: "all" });
    await typeAtEnd("home note, every note");
    await expectTwoThirds("the home note with all");
  });
});
