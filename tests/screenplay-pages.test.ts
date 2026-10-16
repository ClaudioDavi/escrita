import { describe, expect, it } from "vitest";
import { paginate, rowText, type Page } from "../src/core/screenplay-pages";
import { screenplayPreset } from "../src/core/screenplay-presets";
import { action, actionOf, cue, dialogue, pageBreak, paren, scene, script, section, synopsis, transition } from "./screenplay-helpers";

const labels = { screenplayMore: "(MORE)", screenplayContinued: "(CONT'D)", screenplaySceneNumbers: false };
const LETTER = screenplayPreset("letter", labels);
const A4 = screenplayPreset("a4", labels);
const texts = (p: Page) => p.rows.map(rowText);
/** one-line actions that use exactly `rows` rows (odd: the first has no blank before it) */
const fill = (rows: number) => Array.from({ length: (rows + 1) / 2 }, () => action("x"));
const rowOf = (p: Page, text: string) => p.rows.find((r) => rowText(r) === text);

describe("wrapping and blank lines", () => {
  it("wraps action at 60 columns on word boundaries, from column 15", () => {
    const words = Array.from({ length: 30 }, (_, i) => `w${String(i).padStart(2, "0")}xx`).join(" ");
    const [p] = paginate(script(action(words)), LETTER);
    for (const r of p.rows) {
      expect(r.col).toBe(15);
      expect(rowText(r).length).toBeLessThanOrEqual(60);
    }
    expect(texts(p).join(" ")).toBe(words);
    expect(p.rows.length).toBeGreaterThan(2);
  });

  it("keeps the styles across the wrap", () => {
    const [p] = paginate(script(action([{ text: "aaa ".repeat(10) }, { text: "bold words here that go over the line", bold: true }, { text: " end", underline: true }])), LETTER);
    const runs = p.rows.flatMap((r) => r.runs);
    expect(runs.some((r) => r.bold && r.text.includes("bold"))).toBe(true);
    expect(runs.some((r) => r.underline && r.text.includes("end"))).toBe(true);
    expect(p.rows.length).toBeGreaterThan(1);
  });

  it("puts one blank line before scene headings, action, cues and transitions, none inside a speech", () => {
    const [p] = paginate(script(scene("int. kitchen - day"), action("One."), cue("ANA"), paren("(low)"), dialogue("Hello."), transition("CUT TO:")), LETTER);
    expect(p.rows.map((r) => [r.row, rowText(r)])).toEqual([
      [0, "INT. KITCHEN - DAY"],
      [2, "One."],
      [4, "ANA"],
      [5, "(low)"],
      [6, "Hello."],
      [8, "CUT TO:"],
    ]);
  });

  it("uses the preset's columns: cue 37, parenthetical 30, dialogue 25, transition right-aligned", () => {
    const [p] = paginate(script(cue("ANA"), paren("(low)"), dialogue("Hello."), transition("CUT TO:")), LETTER);
    expect(rowOf(p, "ANA")!.col).toBe(37);
    expect(rowOf(p, "(low)")!.col).toBe(30);
    expect(rowOf(p, "Hello.")!.col).toBe(25);
    expect(rowOf(p, "CUT TO:")!.col + "CUT TO:".length).toBe(75);
  });

  it("adds missing parentheses to a parenthetical", () => {
    const [p] = paginate(script(cue("ANA"), paren("softly"), dialogue("Hi.")), LETTER);
    expect(rowText(p.rows[1])).toBe("(softly)");
  });

  it("does not print sections and synopses", () => {
    const [p] = paginate(script(section("Act one"), synopsis("They meet."), action("Hi.")), LETTER);
    expect(texts(p)).toEqual(["Hi."]);
    expect(p.rows[0].row).toBe(0);
  });

  it("centers centered action inside the action columns", () => {
    const [p] = paginate(script(action("THE END", { centered: true })), LETTER);
    expect(p.rows[0].col).toBe(15 + Math.floor((60 - 7) / 2));
  });
});

describe("pages", () => {
  it("fits 55 lines on Letter and 57 on A4", () => {
    const six = Array.from({ length: 28 }, () => action("x"));
    // 28 one-line actions with a blank before each: 1 + 27*2 = 55 lines
    expect(paginate(script(...six), LETTER)).toHaveLength(1);
    expect(paginate(script(...six, action("x")), LETTER)).toHaveLength(2);
    expect(paginate(script(...Array.from({ length: 29 }, () => action("x"))), A4)).toHaveLength(1);
    expect(paginate(script(...Array.from({ length: 30 }, () => action("x"))), A4)).toHaveLength(2);
  });

  it("numbers pages from 1 and rows from 0, never starting a page with a blank line", () => {
    const pages = paginate(script(...Array.from({ length: 60 }, () => action("x"))), LETTER);
    expect(pages.map((p) => p.number)).toEqual([1, 2, 3]);
    for (const p of pages) expect(p.rows[0].row).toBe(0);
    for (const p of pages) expect(p.rows[p.rows.length - 1].row).toBeLessThan(55);
  });

  it("a forced page break starts a new page, and a break at the top does nothing", () => {
    const pages = paginate(script(pageBreak(), action("one"), pageBreak(), pageBreak(), action("two")), LETTER);
    expect(pages.map(texts)).toEqual([["one"], ["two"]]);
  });

  it("splits a long action by lines, two or more on each side", () => {
    // 49 rows used, a blank and 4 lines fit on page 1, the last 2 go to page 2
    const pages = paginate(script(...fill(49), actionOf(6, "c")), LETTER);
    expect(pages[0].rows.filter((r) => rowText(r).startsWith("c"))).toHaveLength(4);
    expect(pages[1].rows).toHaveLength(2);
    expect(pages[1].rows[0].row).toBe(0);
  });

  it("never splits an action of fewer than four lines", () => {
    const pages = paginate(script(...fill(53), actionOf(3, "d")), LETTER);
    expect(pages[1].rows.filter((r) => rowText(r).startsWith("d"))).toHaveLength(3);
    expect(pages[0].rows.some((r) => rowText(r).startsWith("d"))).toBe(false);
  });

  it("leaves two lines on the last page when the cut would leave one", () => {
    const pages = paginate(script(...fill(51), actionOf(5, "e")), LETTER);
    expect(pages[0].rows.filter((r) => rowText(r).startsWith("e"))).toHaveLength(3);
    expect(pages[1].rows).toHaveLength(2);
  });
});

describe("keep rules", () => {
  it("a scene heading never ends a page: it moves with at least two lines of what follows", () => {
    const pages = paginate(script(...fill(51), scene("int. a - day"), actionOf(3, "f")), LETTER);
    expect(pages).toHaveLength(2);
    expect(rowText(pages[1].rows[0])).toBe("INT. A - DAY");
    expect(pages[1].rows[0].row).toBe(0);
  });

  it("a scene heading stays when two lines of what follows fit under it", () => {
    expect(paginate(script(...fill(49), scene("int. a - day"), action("g")), LETTER)).toHaveLength(1);
  });

  it("a cue never ends a page", () => {
    const pages = paginate(script(...fill(53), cue("ANA"), dialogue("Hi.")), LETTER);
    expect(pages).toHaveLength(2);
    expect(rowText(pages[1].rows[0])).toBe("ANA");
    expect(rowText(pages[0].rows[pages[0].rows.length - 1])).toBe("x");
  });

  it("a transition never starts a page: the line before goes with it", () => {
    // 28 one-line actions use 55 rows, so the transition would start page 2
    const els = [...Array.from({ length: 28 }, (_, i) => action(`a${i}`)), transition("CUT TO:")];
    const pages = paginate(script(...els), LETTER);
    expect(pages).toHaveLength(2);
    expect(texts(pages[1])).toEqual(["a27", "CUT TO:"]);
    expect(pages[1].rows[0].row).toBe(0);
  });

  it("a transition pulls only the last line of a long action", () => {
    const pages = paginate(script(...fill(47), actionOf(7, "h"), transition("CUT TO:")), LETTER);
    expect(pages).toHaveLength(2);
    expect(pages[0].rows.filter((r) => rowText(r).startsWith("h"))).toHaveLength(6);
    expect(texts(pages[1])).toEqual(["h".repeat(59), "CUT TO:"]);
  });
});

describe("dialogue across pages", () => {
  const sentence = (n: number) => `Sentence number ${n} is here.`;
  const speech = (n: number) => Array.from({ length: n }, (_, i) => sentence(i)).join(" ");

  it("splits at a sentence end, with the more label under it and the continued cue on the next page", () => {
    const pages = paginate(script(...fill(41), cue("JOÃO"), dialogue(speech(30))), LETTER);
    expect(pages).toHaveLength(2);
    const p1 = pages[0];
    const more = p1.rows[p1.rows.length - 1];
    expect(rowText(more)).toBe("(MORE)");
    expect(more.col).toBe(37);
    expect(more.row).toBeLessThan(55);
    expect(rowText(p1.rows[p1.rows.length - 2]).endsWith(".")).toBe(true);
    expect(rowText(pages[1].rows[0])).toBe("JOÃO (CONT'D)");
    expect(pages[1].rows[0].col).toBe(37);
    expect(rowText(pages[1].rows[1]).startsWith("Sentence number")).toBe(true);
    // nothing lost: the dialogue text of both pages is the whole speech
    const at = p1.rows.findIndex((r) => rowText(r) === "JOÃO");
    const all = [...p1.rows.slice(at + 1, -1), ...pages[1].rows.slice(1)].map(rowText).join(" ");
    expect(all.replace(/\s+/g, " ")).toBe(speech(30));
  });

  it("uses the labels from the preset (Portuguese)", () => {
    const pt = screenplayPreset("letter", { screenplayMore: "(MAIS)", screenplayContinued: "(CONT.)", screenplaySceneNumbers: false });
    const pages = paginate(script(...fill(41), cue("JOÃO"), dialogue(speech(30))), pt);
    expect(rowText(pages[0].rows[pages[0].rows.length - 1])).toBe("(MAIS)");
    expect(rowText(pages[1].rows[0])).toBe("JOÃO (CONT.)");
  });

  it("does not repeat the label when the extension is already the continued word", () => {
    const pages = paginate(script(...fill(41), cue("ANA", "CONT'D"), dialogue(speech(30))), LETTER);
    expect(rowText(pages[1].rows[0])).toBe("ANA (CONT'D)");
  });

  it("splits a speech more than once when it is long enough", () => {
    const pages = paginate(script(cue("ANA"), dialogue(speech(120))), LETTER);
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(rowText(pages[1].rows[0])).toBe("ANA (CONT'D)");
    expect(rowText(pages[2].rows[0])).toBe("ANA (CONT'D)");
  });

  it("moves the whole speech to the next page when no sentence end leaves room", () => {
    const pages = paginate(script(...fill(53), cue("ANA"), dialogue("Just one sentence that goes on for a while without any stop in it at all.")), LETTER);
    expect(pages).toHaveLength(2);
    expect(rowText(pages[1].rows[0])).toBe("ANA");
  });

  it("never ends a page on a parenthetical, and splits between a dialogue and the parenthetical after it", () => {
    const pages = paginate(script(...fill(51), cue("ANA"), dialogue("One short line."), paren("(beat)"), dialogue("Then the rest of it.")), LETTER);
    expect(pages).toHaveLength(2);
    expect(rowText(pages[0].rows[pages[0].rows.length - 1])).toBe("(MORE)");
    expect(rowText(pages[1].rows[0])).toBe("ANA (CONT'D)");
    expect(rowText(pages[1].rows[1])).toBe("(beat)");
  });
});

describe("dual dialogue", () => {
  it("sits side by side on the same rows", () => {
    const [p] = paginate(script(cue("ANA"), dialogue("Left side."), cue("BEN", undefined, true), dialogue("Right side.")), LETTER);
    const l = rowOf(p, "Left side.")!;
    const r = rowOf(p, "Right side.")!;
    expect(l.row).toBe(r.row);
    expect(l.col).toBeLessThan(r.col);
    expect(rowOf(p, "ANA")!.row).toBe(rowOf(p, "BEN")!.row);
  });

  it("never splits: the pair moves to the next page", () => {
    const fill: ReturnType<typeof action>[] = [];
    for (let i = 0; i < 25; i++) fill.push(action("x")); // 50 rows
    const long = "A sentence that is long enough to wrap onto more than one line in a half width column.";
    const pages = paginate(script(...fill, cue("ANA"), dialogue(long + " " + long), cue("BEN", undefined, true), dialogue(long)), LETTER);
    expect(pages).toHaveLength(2);
    expect(pages[0].rows.some((r) => rowText(r) === "ANA")).toBe(false);
    expect(rowText(pages[1].rows[0])).toBe("ANA");
    expect(pages[1].rows[0].row).toBe(0);
  });
});

describe("scene numbers", () => {
  it("are attached to the heading's first line when the preset says so, numbered in order when absent", () => {
    const on = screenplayPreset("letter", { ...labels, screenplaySceneNumbers: true });
    const [p] = paginate(script(scene("int. a - day"), action("x"), scene("ext. b - night", "7A")), on);
    expect(p.rows.filter((r) => r.sceneNumber).map((r) => r.sceneNumber)).toEqual(["1", "7A"]);
    const [q] = paginate(script(scene("int. a - day")), LETTER);
    expect(q.rows[0].sceneNumber).toBeUndefined();
  });
});
