// PLAN-1.2, Wave 2 F: the screenplay editor in a real Obsidian (boards 45 a to c). The layout in Live
// Preview (each element's class and its computed look), Tab and Enter typed with the real keyboard
// (one undo per step), the suggest, the two commands, the switch, timings on a 120-page script,
// screenshots for the G2 review in light and dark, and a recordable demo (gate V: RECORD=<folder>).
import { expect, test } from "@playwright/test";
import path from "node:path";
import { App } from "../lib/app";
import { CAST_TEXT, CONTO, ELEMENTS, HUGE, screenplayEditorVault } from "../fixtures/screenplays";
import { round } from "../lib/measure";
import { settingsPage } from "../lib/more";
import { editorText, sleep, snap } from "../lib/panels";
import { caption, recordDir, Recorder, removeCaption } from "../lib/record";

test.describe.configure({ mode: "serial", timeout: 180_000 });

let ob: App;
const RECORDING = recordDir() !== null;

test.beforeAll(async () => {
  ob = await App.launch({ vault: screenplayEditorVault() });
  await ob.setSettings({ formFolders: "Roteiros: roteiro", trackFolders: "", draftNewNotes: false });
  await ob.setFeature("screenplay", true); // the switch is off until the writer turns it on (Q2)
  await ob.dismissNotices();
});
test.afterAll(async () => { await ob?.close(); });
test.afterEach(async () => { await ob.closeModals(); await ob.dismissNotices(); });

// ---- helpers ----

const ED = `(() => {
  const path = app.workspace.getActiveFile()?.path;
  const view = app.workspace.getLeavesOfType("markdown").map((l) => l.view).find((v) => v.file?.path === path);
  return view?.editor;
})()`;

/** Opens a note, and waits for the editor of it. */
async function open(file: string): Promise<void> {
  await ob.openFile(file);
  await ob.waitFor("the note", async () => (await ob.activeFile()) === file);
  await ob.page.locator(".workspace-leaf.mod-active .cm-content").waitFor();
}

/** Puts the cursor at (line, ch) (default: the end of the note) and gives the editor the keyboard. */
async function focusAt(line?: number, ch?: number): Promise<void> {
  await ob.page.evaluate(`((l, c) => {
    const ed = ${ED};
    const last = ed.lastLine();
    const ln = l ?? last;
    ed.setCursor({ line: ln, ch: c ?? ed.getLine(ln).length });
    ed.focus();
  })(${line ?? "undefined"}, ${ch ?? "undefined"})`);
  await sleep(60);
}

let fresh = 0;
/** A new note in Roteiros/ (a screenplay by its folder), opened, the cursor at its end. */
async function newScript(text = ""): Promise<string> {
  const file = `Roteiros/Novo ${++fresh}.md`;
  await ob.page.evaluate(async ([p, s]) => { await app.vault.create(p, s); }, [file, text] as const);
  await open(file);
  await ob.waitFor("the screenplay form", () => ob.page.evaluate((p) => app.plugins.plugins.escrita.books.classify(app.vault.getFileByPath(p)).form === "screenplay", file));
  await focusAt();
  return file;
}

const text = () => editorText(ob);
const cursorAt = () => ob.cursor().then((c) => (c ? { line: c.line, ch: c.ch } : null));
const ghost = () => ob.page.locator(".workspace-leaf.mod-active .escrita-sp-ghost");
const kb = () => ob.page.keyboard;
/** The human pace of a recording: nothing at all in a normal run. */
const pace = (ms: number) => (RECORDING ? sleep(ms) : Promise.resolve());
// a pause at the end, as a writer has: the suggest list catches up with the last key before the next one
const typeKeys = async (s: string) => { await kb().type(s, { delay: RECORDING ? 70 : 30 }); await sleep(RECORDING ? 200 : 150); };
const undo = () => kb().press("Control+z");
const live = () => ob.page.locator(".workspace-leaf.mod-active .cm-editor");

async function setSource(on: boolean): Promise<void> {
  await ob.page.evaluate(async (v) => {
    const leaf = app.workspace.getLeavesOfType("markdown").find((l: any) => l.view.file?.path === app.workspace.getActiveFile()?.path)!;
    const st = leaf.getViewState();
    st.state.mode = "source";
    st.state.source = v;
    await leaf.setViewState(st);
  }, on);
  await sleep(300);
}

/** The computed look of the first line matching `selector` in the active editor. */
function looks(selector: string): Promise<Record<string, string> | null> {
  return ob.page.evaluate((sel) => {
    const el = document.querySelector(`.workspace-leaf.mod-active ${sel}`) as HTMLElement | null;
    if (!el) return null;
    const c = getComputedStyle(el);
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;width:1ch;";
    el.appendChild(probe);
    const ch = probe.getBoundingClientRect().width;
    probe.remove();
    return {
      padLeftCh: String(Math.round((parseFloat(c.paddingLeft) / ch) * 10) / 10),
      padLeft: c.paddingLeft,
      textAlign: c.textAlign,
      fontWeight: c.fontWeight,
      fontSize: c.fontSize,
      fontStyle: c.fontStyle,
      borderLeft: c.borderLeftWidth,
      borderBottom: c.borderBottomWidth,
      fontFamily: c.fontFamily,
      after: getComputedStyle(el, "::after").content,
      barWidth: getComputedStyle(el, "::before").borderLeftWidth,
      barContent: getComputedStyle(el, "::before").content,
    };
  }, selector);
}

const spLines = () => ob.page.locator(".workspace-leaf.mod-active .cm-line[class*='escrita-sp-']");

// ---- the layout ----

test("1. Live Preview: the editor carries escrita-screenplay and each element line its escrita-sp-<kind>", async () => {
  await open(ELEMENTS);
  await focusAt(0, 0); // the cursor on the title page: no line below is "touched"
  await expect(live()).toHaveClass(/escrita-screenplay/);
  await expect(live()).toHaveClass(/escrita-screenplay-courier/);
  const kinds = async (cls: string) => ob.page.locator(`.workspace-leaf.mod-active .cm-line.escrita-sp-${cls}`).allInnerTexts();
  expect(await kinds("titlePage")).toEqual(["Title: Elementos"]);
  expect(await kinds("scene")).toEqual(["INT. COZINHA - DIA"]);
  expect((await kinds("action"))[0]).toContain("Mara abre a janela");
  expect(await kinds("character")).toEqual(["MARA"]);
  expect(await kinds("parenthetical")).toEqual(["(baixo)"]);
  expect(await kinds("dialogue")).toEqual(["Tem alguém aí?"]);
  expect((await kinds("transition")).join("|")).toContain("CORTA PARA:");
  expect((await kinds("section")).join("|")).toContain("Primeiro ato");
  expect((await kinds("synopsis")).join("|")).toContain("a sinopse da cena");
  expect((await kinds("centered")).join("|")).toContain("FIM");
  // the text is as typed
  expect(await text()).toContain("> CORTA PARA:");
  expect(await text()).toContain("# Primeiro ato");
  await snap(ob, "1. the laid-out script (board 45 a)", ob.page.locator(".workspace-leaf.mod-active"));
});

test("2. the columns in ch, the bold heading, and the font", async () => {
  await open(ELEMENTS);
  await focusAt(0, 0);
  const cue = await looks(".cm-line.escrita-sp-character");
  const par = await looks(".cm-line.escrita-sp-parenthetical");
  const dia = await looks(".cm-line.escrita-sp-dialogue");
  const scene = await looks(".cm-line.escrita-sp-scene");
  const act = await looks(".cm-line.escrita-sp-action");
  expect(Number(cue!.padLeftCh)).toBeCloseTo(22, 0);
  expect(Number(par!.padLeftCh)).toBeCloseTo(16, 0);
  expect(Number(dia!.padLeftCh)).toBeCloseTo(10, 0);
  expect(Number(act!.padLeftCh)).toBe(0);
  expect(Number(scene!.fontWeight)).toBeGreaterThanOrEqual(600);
  expect(Number(act!.fontWeight)).toBeLessThan(600);
  expect(cue!.fontFamily).toMatch(/Courier/i);
});

test("3. a # section is not heading-sized; a > CUT TO: has no quote border and is right-aligned; a --- line shows ---", async () => {
  await open(ELEMENTS);
  await focusAt(0, 0);
  const act = await looks(".cm-line.escrita-sp-action");
  const sec = await looks(".cm-line.escrita-sp-section");
  expect(sec).not.toBeNull();
  expect(parseFloat(sec!.fontSize)).toBeLessThanOrEqual(parseFloat(act!.fontSize));
  expect(Number(sec!.fontWeight)).toBeLessThan(600);
  const tr = await looks(".cm-line.escrita-sp-transition");
  expect(tr).not.toBeNull();
  expect(tr!.borderLeft).toBe("0px");
  expect(tr!.barWidth).toBe("0px"); // Obsidian's bar is the line's ::before: it must be gone, not only the line's own border
  expect(tr!.textAlign).toMatch(/right|end/);
  const centered = await looks(".cm-line.escrita-sp-centered");
  expect(centered!.textAlign).toBe("center");
  expect(centered!.borderLeft).toBe("0px");
  expect(centered!.barWidth).toBe("0px");
  const hr = await looks(".cm-line.hr");
  expect(hr).not.toBeNull();
  expect(hr!.after).toBe('"---"');
});

test("4. _x_ is underlined (a border, no text-decoration) and *x* stays italic", async () => {
  await open(ELEMENTS);
  await focusAt(0, 0);
  const under = await looks(".escrita-sp-underline");
  expect(under).not.toBeNull();
  expect(under!.borderBottom).toBe("1px");
  expect(under!.fontStyle).toBe("normal");
  const deco = await ob.page.evaluate(() => getComputedStyle(document.querySelector(".workspace-leaf.mod-active .escrita-sp-underline")!).textDecorationLine);
  expect(deco).toBe("none");
  const em = await ob.page.evaluate(() => {
    const els = [...document.querySelectorAll(".workspace-leaf.mod-active .cm-em")] as HTMLElement[];
    return els.filter((e) => !e.closest(".escrita-sp-underline") && !e.classList.contains("escrita-sp-underline")).map((e) => ({ t: e.textContent, s: getComputedStyle(e).fontStyle }));
  });
  expect(em.some((e) => e.t === "medo" && e.s === "italic")).toBe(true);
});

test("5. Source mode shows none of it; Live Preview brings it back", async () => {
  await open(ELEMENTS);
  await setSource(true);
  await expect(live()).not.toHaveClass(/escrita-screenplay/);
  await expect(spLines()).toHaveCount(0);
  await setSource(false);
  await expect(live()).toHaveClass(/escrita-screenplay/);
  await expect(spLines().first()).toBeVisible();
});

test("6. a prose note gets none of it, and a # or > there keeps Obsidian's own look", async () => {
  await open(CONTO);
  await focusAt(0, 0);
  await expect(live()).not.toHaveClass(/escrita-screenplay/);
  await expect(spLines()).toHaveCount(0);
  const quote = await looks(".cm-line.HyperMD-quote");
  expect(quote).not.toBeNull();
  expect(quote!.barWidth).toBe("2px"); // Obsidian draws the bar on the line's ::before
});

test("7. the switch off removes the layout and the keys at runtime, and on brings them back", async () => {
  await open(ELEMENTS);
  await focusAt(0, 0);
  await expect(spLines().first()).toBeVisible();
  await ob.setFeature("screenplay", false);
  await expect(spLines()).toHaveCount(0);
  await expect(live()).not.toHaveClass(/escrita-screenplay/);
  expect(await ob.commandListed("screenplay-next-element")).toBe(false);
  // Tab is Obsidian's again: it inserts nothing of ours (no mode, no ghost)
  await focusAt(0, 0);
  await kb().press("Tab");
  await expect(ghost()).toHaveCount(0);
  await undo();
  await ob.setFeature("screenplay", true);
  await expect(spLines().first()).toBeVisible();
  await expect(live()).toHaveClass(/escrita-screenplay/);
  expect(await text()).toBe((await ob.page.evaluate(() => app.vault.read(app.workspace.getActiveFile()!))) as string);
});

// ---- the keys ----

test("8. Tab on an empty line cycles the modes and shows the element's name", async () => {
  await newScript();
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    await kb().press("Tab");
    await sleep(40);
    seen.push((await ghost().allInnerTexts()).join(""));
    if (i === 0) {
      // the held line takes the element's column before the parser can read it
      await expect(ob.page.locator(".workspace-leaf.mod-active .cm-line.escrita-sp-character")).toHaveCount(1);
      expect(Number((await looks(".cm-line.escrita-sp-character"))!.padLeftCh)).toBeCloseTo(22, 0);
      await snap(ob, "8. a Tab step: the ghost name (board 45 c)", ob.page.locator(".workspace-leaf.mod-active"));
    }
  }
  expect(seen.map((s) => s.toLowerCase())).toEqual(["personagem", "transição", "cabeçalho de cena", "ação"]);
  expect(await text()).toBe("");
  await kb().press("Shift+Tab");
  await sleep(40);
  expect((await ghost().innerText()).toLowerCase()).toBe("cabeçalho de cena");
  // the ghost is not text: typing replaces it and the note holds only what was typed
  expect(await text()).toBe("");
});

test("9. a cue typed in character mode is in capitals; Enter goes to dialogue, then to the next cue, then back to action", async () => {
  await newScript();
  await kb().press("Tab"); // character
  await typeKeys("maria");
  expect(await text()).toBe("MARIA");
  await kb().press("Enter");
  expect(await text()).toBe("MARIA\n");
  expect((await ghost().innerText()).toLowerCase()).toBe("fala");
  await typeKeys("Oi, tudo bem?");
  expect(await text()).toBe("MARIA\nOi, tudo bem?"); // dialogue keeps its case
  await kb().press("Enter");
  expect(await text()).toBe("MARIA\nOi, tudo bem?\n\n"); // a blank line, then the cue
  expect(await cursorAt()).toEqual({ line: 3, ch: 0 });
  expect((await ghost().innerText()).toLowerCase()).toBe("personagem");
  await kb().press("Enter"); // Enter on the empty cue line goes back to action
  expect(await text()).toBe("MARIA\nOi, tudo bem?\n\n");
  expect((await ghost().innerText()).toLowerCase()).toBe("ação");
  await typeKeys("Ela sai.");
  expect(await text()).toBe("MARIA\nOi, tudo bem?\n\nEla sai.");
});

test("10. Tab after a cue opens a parenthetical with the cursor inside", async () => {
  await newScript();
  await kb().press("Tab");
  await typeKeys("ana");
  await kb().press("Tab");
  expect(await text()).toBe("ANA\n()");
  expect(await cursorAt()).toEqual({ line: 1, ch: 1 });
  await typeKeys("baixo"); // no capitals in a parenthetical
  expect(await text()).toBe("ANA\n(baixo)");
  await kb().press("End");
  await kb().press("Enter"); // the parenthetical leads to the dialogue
  await typeKeys("Cala.");
  expect(await text()).toBe("ANA\n(baixo)\nCala.");
});

test("11. after a scene heading, Enter leaves a blank line and stays in action; a transition is in capitals and Enter goes to a scene", async () => {
  await newScript();
  await kb().press("Tab");
  await kb().press("Tab");
  await kb().press("Tab"); // character, transition, scene
  expect((await ghost().innerText()).toLowerCase()).toBe("cabeçalho de cena");
  await typeKeys("int. sala - dia");
  expect(await text()).toBe("INT. SALA - DIA");
  await kb().press("Enter");
  expect(await text()).toBe("INT. SALA - DIA\n\n");
  expect((await ghost().innerText()).toLowerCase()).toBe("ação");
  await typeKeys("Uma sala vazia.");
  await kb().press("Enter");
  await kb().press("Tab"); // character
  await kb().press("Tab"); // transition
  await typeKeys("corta para:");
  expect(await text()).toBe("INT. SALA - DIA\n\nUma sala vazia.\n\nCORTA PARA:");
  await kb().press("Enter");
  expect((await ghost().innerText()).toLowerCase()).toBe("cabeçalho de cena");
});

test("12. one Ctrl+Z undoes exactly one step", async () => {
  await newScript();
  await typeKeys("Mara entra.");
  await sleep(700); // a typing group of its own
  await kb().press("Enter");
  expect(await text()).toBe("Mara entra.\n\n");
  await undo();
  expect(await text()).toBe("Mara entra.");
  await kb().press("Enter");
  await sleep(700);
  await kb().press("Tab");
  await typeKeys("ana");
  await sleep(700);
  await kb().press("Tab"); // the parenthetical: one step
  expect(await text()).toBe("Mara entra.\n\nANA\n()");
  await undo();
  expect(await text()).toBe("Mara entra.\n\nANA");
  // Enter after a cue, right after typing it (no pause long enough for a typing group of its own): still its own step.
  // (The cue's mode is let go when the cursor leaves it, a step with no text change; test 12b pins
  // the case that is brought back, a Tab.)
  await newScript();
  await kb().press("Tab");
  await typeKeys("ana");
  await kb().press("Enter");
  expect(await text()).toBe("ANA\n");
  await undo();
  expect(await text()).toBe("ANA");
});

test("12b. a step never joins the typing after it, and an undone Tab gives the cue its mode back", async () => {
  await newScript();
  await kb().press("Tab");
  await typeKeys("ana");
  await kb().press("Tab");
  await kb().type("baixinho", { delay: 10 }); // right after the step, well inside a typing group
  expect(await text()).toBe("ANA\n(baixinho)");
  await undo();
  expect(await text()).toBe("ANA\n()");
  await undo();
  expect(await text()).toBe("ANA");
  // the cue (nothing follows it, so the parser would read action) is held in its mode again
  await expect(ob.page.locator(".workspace-leaf.mod-active .cm-line.escrita-sp-character")).toHaveCount(1);
  // and so what is typed on it goes on in capitals
  await typeKeys("x");
  expect(await text()).toBe("ANAX");
});

test("13. Enter flow of prose never acts in a tracked screenplay (and still does in a tracked conto)", async () => {
  await ob.setSettings({ enterFlow: true, trackFolders: "Roteiros\nContos" });
  try {
    await newScript();
    await typeKeys("Mara entra.");
    for (let i = 0; i < 5; i++) await kb().press("Enter");
    expect(await text()).not.toContain("---");
    // control: the same keys in a conto turn the empty lines into a scene break
    await ob.page.evaluate(async () => { await app.vault.create("Contos/Controle.md", "---\nstatus: rascunho\n---\n\n"); });
    await open("Contos/Controle.md");
    await focusAt();
    await typeKeys("O mar subiu.");
    for (let i = 0; i < 5; i++) await kb().press("Enter");
    expect(await text()).toContain("---");
  } finally {
    await ob.setSettings({ enterFlow: false, trackFolders: "" });
  }
});

// ---- the suggest ----

const suggestions = () => ob.page.locator(".suggestion-container .suggestion-item");

test("14. 'MA' on a cue line offers MARIA and MARCOS with their counts; Enter picks one", async () => {
  await newScript(CAST_TEXT);
  const before = await text();
  await kb().press("Tab");
  await typeKeys("ma");
  await expect(suggestions()).toHaveCount(2);
  const rows = await suggestions().allInnerTexts();
  expect(rows[0].replace(/\s+/g, " ")).toBe("MARIA 3 falas");
  expect(rows[1].replace(/\s+/g, " ")).toBe("MARCOS 2 falas");
  await snap(ob, "14. the cue suggest (board 45 b)", ob.page.locator(".workspace-leaf.mod-active"));
  await kb().press("Enter");
  await expect(suggestions()).toHaveCount(0);
  expect(await text()).toBe(before + "MARIA");
  expect(await text()).not.toContain("MARIAA");
});

test("15. a click on a suggestion picks it; the second one is MARCOS", async () => {
  await newScript(CAST_TEXT);
  await kb().press("Tab");
  await typeKeys("mar");
  await expect(suggestions()).toHaveCount(2);
  await suggestions().nth(1).click();
  await expect(suggestions()).toHaveCount(0);
  expect((await text()).endsWith("\nMARCOS")).toBe(true);
});

test("16. a location after 'INT. ' and a time after ' - '", async () => {
  await newScript(CAST_TEXT);
  await kb().press("Tab");
  await kb().press("Tab");
  await kb().press("Tab"); // scene mode
  await typeKeys("int. ");
  await expect(suggestions()).not.toHaveCount(0);
  const locations = (await suggestions().allInnerTexts()).map((s) => s.trim());
  expect(locations).toContain("COZINHA");
  expect(locations).toContain("PRAIA");
  await suggestions().filter({ hasText: "COZINHA" }).first().click();
  expect((await text()).endsWith("INT. COZINHA")).toBe(true);
  await typeKeys(" - ");
  await expect(suggestions()).not.toHaveCount(0);
  const times = (await suggestions().allInnerTexts()).map((s) => s.trim());
  expect(times).toEqual(["DIA", "NOITE", "CONTÍNUO", "MAIS TARDE"]);
  await snap(ob, "16. the time-of-day suggest", ob.page.locator(".workspace-leaf.mod-active"));
  await suggestions().filter({ hasText: "NOITE" }).click();
  expect((await text()).endsWith("INT. COZINHA - NOITE")).toBe(true);
});

test("17. the suggest is silent in a prose note", async () => {
  await open(CONTO);
  await focusAt();
  await kb().press("Enter");
  await typeKeys("INT. ");
  await sleep(200);
  await expect(suggestions()).toHaveCount(0);
  await undo();
});

// ---- the commands ----

test("18. the two commands exist only in a screenplay note and do what Tab and Shift-Tab do", async () => {
  await open(CONTO);
  expect(await ob.commandListed("screenplay-next-element")).toBe(false);
  expect(await ob.commandListed("screenplay-previous-element")).toBe(false);
  await newScript();
  expect(await ob.commandListed("screenplay-next-element")).toBe(true);
  expect(await ob.commandListed("screenplay-previous-element")).toBe(true);
  expect(await ob.command("screenplay-next-element")).toBe(true);
  expect((await ghost().innerText()).toLowerCase()).toBe("personagem");
  expect(await ob.command("screenplay-next-element")).toBe(true);
  expect((await ghost().innerText()).toLowerCase()).toBe("transição");
  expect(await ob.command("screenplay-previous-element")).toBe(true);
  expect((await ghost().innerText()).toLowerCase()).toBe("personagem");
  // after a cue the next-element command opens the parenthetical, as Tab does
  await ob.page.evaluate(`${ED}.focus()`);
  await typeKeys("ana");
  expect(await ob.command("screenplay-next-element")).toBe(true);
  expect(await text()).toBe("ANA\n()");
});

// ---- timings ----

/** From openFile to the first scene heading of the script drawn (with its class when `marked`, else any line with its text), then two frames. */
async function openAndDraw(file: string, marked: boolean): Promise<{ layoutMs: number; paintedMs: number }> {
  await open(ELEMENTS); // another note in front, so the script is opened afresh
  return ob.page.evaluate(async ([p, m]) => {
    const t0 = performance.now();
    const drawn = () => [...document.querySelectorAll(m ? ".workspace-leaf.mod-active .cm-line.escrita-sp-scene" : ".workspace-leaf.mod-active .cm-line")].some((e) => (e.textContent ?? "").includes("LUGAR 1 "));
    const hit = new Promise<number>((resolve) => {
      const mo = new MutationObserver(() => { if (drawn()) { mo.disconnect(); resolve(performance.now()); } });
      mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    });
    await app.workspace.getLeaf(false).openFile(app.vault.getFileByPath(p as string)!, { active: true });
    const t1 = await hit;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { layoutMs: t1 - t0, paintedMs: performance.now() - t0 };
  }, [file, marked] as const);
}

/** Types a phrase with the real keyboard at the end of the open note and measures each key: keydown to the DOM updated, and to the next frame. */
async function measureKeys(keys: string, phrase: string): Promise<{ dom: number[]; frame: number[]; long: number }> {
  await ob.page.evaluate(() => {
    const w = window as any;
    w.__keys = [];
    w.__ko?.disconnect();
    if (w.__kd) window.removeEventListener("keydown", w.__kd, true);
    let t0 = 0;
    w.__kd = () => { t0 = performance.now(); };
    window.addEventListener("keydown", w.__kd, true);
    w.__ko = new MutationObserver(() => {
      if (t0 === 0) return;
      const done = performance.now();
      const start = t0;
      t0 = 0;
      requestAnimationFrame(() => w.__keys.push({ dom: done - start, frame: performance.now() - start }));
    });
    w.__ko.observe(document.querySelector(".workspace-leaf.mod-active .cm-content")!, { childList: true, subtree: true, characterData: true, attributes: true });
  });
  await ob.observeLongTasks();
  if (keys) await kb().press(keys);
  await kb().type(phrase, { delay: 60 });
  await sleep(300);
  const got = (await ob.page.evaluate(() => (window as any).__keys)) as { dom: number; frame: number }[];
  return { dom: got.map((k) => k.dom).sort((a, b) => a - b), frame: got.map((k) => k.frame).sort((a, b) => a - b), long: (await ob.longTasks()).length };
}

test("19. a 120-page script: the first layout after opening, and the keystroke at the end", async () => {
  const pct = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
  const phrase = "Ela atravessa o corredor sem olhar para trás, e a porta bate";

  // with the layout on
  const first = await openAndDraw(HUGE, true);
  const lines = (await text()).split("\n").length;
  expect(lines).toBeGreaterThan(5800); // about 120 pages
  await focusAt();
  await kb().press("Control+End");
  await sleep(300);
  const on = await measureKeys("Tab", phrase.slice(0, 52)); // character mode at the end of the script, then 52 keys
  const textOn = await text();
  expect(textOn.endsWith(phrase.slice(0, 52).toLocaleUpperCase())).toBe(true); // caps on the cue

  // the same script and keys with the screenplay switch off: Obsidian's own cost, for the difference
  await ob.setFeature("screenplay", false);
  const firstOff = await openAndDraw(HUGE, false);
  await focusAt();
  await kb().press("Control+End");
  await sleep(300);
  const off = await measureKeys("", phrase.slice(0, 52));
  await ob.setFeature("screenplay", true);

  const line = (n: string, a: { dom: number[]; frame: number[]; long: number }) =>
    `${n}: ${a.dom.length} keys, to the DOM median ${round(pct(a.dom, 0.5))} ms, p95 ${round(pct(a.dom, 0.95))} ms, max ${round(a.dom[a.dom.length - 1])} ms; to the next frame median ${round(pct(a.frame, 0.5))} ms, p95 ${round(pct(a.frame, 0.95))} ms; long tasks ${a.long}`;
  const report = `${lines} lines. First layout ${round(first.layoutMs)} ms (painted ${round(first.paintedMs)} ms), switch off ${round(firstOff.layoutMs)} ms (painted ${round(firstOff.paintedMs)} ms). ${line("switch on", on)}. ${line("switch off", off)}`;
  console.log(`SCREENPLAY timings: ${report}`);
  test.info().annotations.push({ type: "timings", description: report });
  expect(on.dom.length).toBeGreaterThanOrEqual(40);
  expect(pct(on.dom, 0.5)).toBeLessThanOrEqual(10); // the typing budget (PLAN-1.2 Q3)
});

// ---- the screenshots for the G2 review ----

async function showFeatureRows(theme: "light" | "dark"): Promise<void> {
  const settings = await settingsPage(ob);
  const row = settings.locator(".escrita-feature-row").filter({ hasText: "Editor de roteiro" }).first();
  await row.waitFor();
  await row.scrollIntoViewIfNeeded();
  await ob.screenshot(`the Features page row, ${theme}`, row);
  const group = settings.locator(".setting-item-heading").filter({ hasText: "Editor de roteiro" }).first();
  if ((await group.count()) > 0) {
    await group.scrollIntoViewIfNeeded();
    await ob.screenshot(`the settings group, ${theme}`, settings.locator("body"));
  } else {
    // the group sits under the module's own section: find its font row
    const font = settings.locator(".setting-item").filter({ hasText: "Courier, como na página" }).first();
    await font.scrollIntoViewIfNeeded();
    await ob.screenshot(`the settings group, ${theme}`, settings.locator("body"));
    expect(await font.count()).toBe(1);
  }
  await ob.closeModals();
}

for (const theme of ["light", "dark"] as const) {
  test(`20. screenshots for G2, ${theme}`, async () => {
    await ob.setTheme(theme);
    await open(ELEMENTS);
    await focusAt(0, 0);
    await snap(ob, `the laid-out script, ${theme}`, ob.page.locator(".workspace-leaf.mod-active"));
    await newScript();
    await kb().press("Tab");
    await sleep(80);
    await snap(ob, `a Tab step with the ghost name, ${theme}`, ob.page.locator(".workspace-leaf.mod-active"));
    await newScript(CAST_TEXT);
    await kb().press("Tab");
    await typeKeys("ma");
    await expect(suggestions()).toHaveCount(2);
    await snap(ob, `the suggest open, ${theme}`);
    await kb().press("Escape");
    await showFeatureRows(theme);
  });
}

// ---- the demo (gate V): a recording, only when RECORD names a folder ----

const SEED = [
  "Title: A lata do faroleiro",
  "",
  "INT. COZINHA DO FAROL - NOITE",
  "",
  "A chaleira chacoalha no fogão. Mara conta moedas numa lata.",
  "",
  "MARA",
  "Onze, doze. Conte de novo, Tomé.",
  "",
  "TOMÉ",
  "(da escada)",
  "Você disse que ia dormir.",
  "",
  "EXT. TRILHA DO PENHASCO - DIA",
  "",
  "O vento achata o capim.",
  "",
  "",
].join("\n");

test("demo: writing a scene", async () => {
  await ob.setTheme("light");
  await ob.setSettings({ screenplayFont: "courier" });
  // Obsidian's own spellcheck underlines Portuguese in red in the video; off while recording only
  if (RECORDING) await ob.page.evaluate(() => (app.vault as unknown as { setConfig(k: string, v: unknown): void }).setConfig("spellcheck", false));
  const file = await newScript(SEED);
  await focusAt();
  const rec = await Recorder.start(ob.page);
  try {
    const step = async (words: string) => { if (RECORDING) await caption(ob.page, words); await pace(900); };
    const pick = async (label: string) => {
      const item = suggestions().filter({ hasText: label }).first();
      await item.waitFor();
      await pace(1200);
      await item.click();
      await expect(suggestions()).toHaveCount(0);
      await pace(500);
    };
    await step("Um roteiro, escrito em Fountain");
    await pace(1500);

    await step("Tab muda o elemento: cabeçalho de cena");
    await kb().press("Tab"); await pace(500);
    await kb().press("Tab"); await pace(500);
    await kb().press("Tab"); await pace(900);
    await typeKeys("ext. ");
    await step("O lugar vem do próprio roteiro");
    await pick("TRILHA DO PENHASCO");
    await typeKeys(" - ");
    await step("E a hora do dia, das configurações");
    await pick("MAIS TARDE");

    await step("Enter: uma linha em branco e a ação");
    await kb().press("Enter"); await pace(600);
    await typeKeys("Tomé arrasta uma caixa pelos últimos degraus.");
    await kb().press("Enter"); await pace(600);

    await step("Tab: personagem, com sugestões");
    await kb().press("Tab"); await pace(700);
    await typeKeys("to");
    await pick("TOMÉ");
    await step("Tab depois do nome abre a rubrica");
    await kb().press("Tab"); await pace(500);
    await typeKeys("ofegante");
    await kb().press("End");
    await kb().press("Enter");
    await step("Enter: a fala");
    await typeKeys("Peças de rádio. O homem do porto queria o relógio.");
    await kb().press("Enter"); await pace(900);

    await step("Enter depois da fala: o próximo personagem");
    await typeKeys("ma");
    await pick("MARA");
    await kb().press("Enter");
    await typeKeys("Traga de volta, ou eu toco o sino.");
    await kb().press("Enter"); await pace(900);

    await step("Tab troca para transição");
    await kb().press("Tab"); await pace(700);
    await typeKeys("corta para:");
    await pace(1500);
    await removeCaption(ob.page);
  } finally {
    await rec?.stop();
    rec?.encode("screenplay-editor");
  }
  const out = await text();
  expect(out.startsWith(SEED.replace(/\n+$/, "\n\n"))).toBe(true);
  const scene = out.slice(SEED.length - 1);
  expect(scene).toContain("EXT. TRILHA DO PENHASCO - MAIS TARDE\n\n");
  expect(scene).toContain("\nTOMÉ\n(ofegante)\nPeças de rádio.");
  expect(scene).toContain("\n\nMARA\nTraga de volta, ou eu toco o sino.\n\n");
  expect(scene.trimEnd().endsWith("CORTA PARA:")).toBe(true);
  expect(file).toMatch(/^Roteiros\//);
  if (RECORDING) await ob.page.screenshot({ path: path.join(recordDir()!, "screenplay-editor-last.png") });
});
