import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noticeLog, TFile } from "./support/obsidian";
import { FeatureRegistry } from "../src/core/feature-registry";
import type { FeatureId } from "../src/core/features";
import type { FeatureModule } from "../src/core/module-context";
import { GoalsModule } from "../src/goals";
import { streak } from "../src/goals/tracker";
import { fakePlugin, type FakePlugin } from "./support/fake-plugin";

let plugin: FakePlugin;
let goals: GoalsModule;
let registry: FeatureRegistry;
/** intervals that were set and not cleared, by id */
let live: Set<number>;

beforeEach(() => {
  noticeLog.length = 0;
  live = new Set();
  const set = window.setInterval.bind(window);
  const clear = window.clearInterval.bind(window);
  vi.spyOn(window, "setInterval").mockImplementation(((cb: () => void, ms?: number) => {
    const id = set(cb, ms) as unknown as number;
    live.add(id);
    return id;
  }) as typeof window.setInterval);
  vi.spyOn(window, "clearInterval").mockImplementation(((id?: number) => {
    if (id !== undefined) live.delete(id);
    clear(id);
  }) as typeof window.clearInterval);

  plugin = fakePlugin();
  (plugin as unknown as { books: unknown }).books = { classify: () => ({ tracked: false, kind: "note", book: null, markdown: false }), allBooks: () => [] };
  goals = new GoalsModule(plugin.asPlugin);
  const map = new Map<FeatureId, FeatureModule>([["goals", goals]]);
  registry = new FeatureRegistry(plugin.asPlugin, map);
  plugin.features = registry;
  registry.init();
});

afterEach(() => {
  registry.unloadAll();
  vi.restoreAllMocks();
});

const COMMANDS = ["escrita:open-progress", "escrita:start-sprint", "escrita:stop-sprint"];

describe("goals lifecycle", () => {
  it("loads with its commands, ribbon icon, status bar, listeners, interval and editor extension", () => {
    registry.apply();
    expect(registry.isOn("goals")).toBe(true);
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect(plugin.ribbon.size).toBe(1);
    expect(plugin.statusBars).toHaveLength(1);
    expect(plugin.statusBars[0].isConnected).toBe(true);
    expect(plugin.liveListeners()).toBe(3);
    expect(live.size).toBe(1);
    expect(plugin.extensions).toHaveLength(1);
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);
  });

  it("leaves nothing registered after unload, and data stays", () => {
    plugin.history.absorb({ history: { "2026-01-01": { added: 5, books: { "Old": { added: 5 } } } } });
    registry.apply();
    plugin.turn("goals", false);
    expect(registry.isOn("goals")).toBe(false);
    expect(plugin.commands.size).toBe(0);
    expect(plugin.statusBars[0].isConnected).toBe(false);
    expect(plugin.liveListeners()).toBe(0);
    expect(live.size).toBe(0);
    expect((plugin.extensions[0] as unknown[]).length).toBe(0);
    // only the data follower remains
    expect(plugin.followers.size).toBe(1);
    expect(Object.keys(plugin.history.view()["2026-01-01"].books ?? {})).toEqual(["Old"]);
    // the ribbon icon stays until restart (G0f); its click says the feature is off
    plugin.clickRibbon([...plugin.ribbon.keys()][0]);
    expect(noticeLog).toHaveLength(1);
  });

  it("loads again with one of each registration", () => {
    registry.apply();
    plugin.turn("goals", false);
    plugin.turn("goals", true);
    expect([...plugin.commands.keys()].sort()).toEqual([...COMMANDS].sort());
    expect(plugin.liveListeners()).toBe(3);
    expect(live.size).toBe(1);
    expect(plugin.extensions).toHaveLength(1);
    expect((plugin.extensions[0] as unknown[]).length).toBe(1);
    expect(plugin.ribbonAdds).toHaveLength(1);
    expect(plugin.followers.size).toBe(2);   // data follower + the loaded one
    expect(plugin.statusBars.filter((e) => e.isConnected)).toHaveLength(1);
    expect(plugin.statusBars).toHaveLength(2);
  });

  it("keeps a running sprint's count across a switch-off: the timer stops, the sprint stays", () => {
    registry.apply();
    goals.startSprint(10, 100);
    expect(live.size).toBe(2);   // the minute refresh and the sprint timer
    const sprint = goals.sprint;
    sprint!.add(40);
    plugin.turn("goals", false);
    expect(live.size).toBe(0);
    expect(goals.sprint).toBe(sprint);
    expect(goals.sprint!.words).toBe(40);
    plugin.turn("goals", true);
    expect(goals.sprint!.words).toBe(40);
    expect(live.size).toBe(2);
  });

  it("closes the progress modal if open", () => {
    registry.apply();
    const close = vi.fn();
    (goals as unknown as { modal: unknown }).modal = { close };
    plugin.turn("goals", false);
    expect(close).toHaveBeenCalledTimes(1);
    expect((goals as unknown as { modal: unknown }).modal).toBeNull();
  });

  it("forgets baselines while off, so words typed meanwhile are not counted", () => {
    registry.apply();
    (goals as unknown as { baseline: Map<string, number> }).baseline.set("a.md", 10);
    plugin.turn("goals", false);
    expect((goals as unknown as { baseline: Map<string, number> }).baseline.size).toBe(0);
  });

  it("follows a renamed book in history even when it was never loaded", () => {
    plugin.settings.features = { goals: false };
    plugin.history.absorb({ history: { "2026-01-01": { added: 5, books: { "Old": { added: 5 } } } } });
    registry.apply();
    expect(registry.isOn("goals")).toBe(false);
    expect(plugin.commands.size).toBe(0);
    for (const f of plugin.followers) f.moved?.("Old", "New");
    expect(Object.keys(plugin.history.view()["2026-01-01"].books ?? {})).toEqual(["New"]);
  });

  it("the follower shares a rename for a book note or a piece, not for an ordinary note", () => {
    const place = (kind: string, piece: unknown = null) => ({ tracked: false, kind, book: null, markdown: true, piece });
    const kinds: Record<string, ReturnType<typeof place>> = {
      "Book.md": place("book-note"), "Conto.md": place("note", { target: 500 }), "Plain.md": place("note"),
    };
    (plugin as unknown as { books: unknown }).books = {
      classify: (p: string) => kinds[p] ?? place("none"),
      allBooks: () => [],
    };
    const calls: [string, string, boolean | undefined][] = [];
    plugin.history.rename = ((o: string, n: string, opts?: { share?: boolean }) => { calls.push([o, n, opts?.share]); return false; }) as never;
    registry.apply();
    for (const f of plugin.followers) {
      f.moved?.("a", "Book.md");
      f.moved?.("b", "Conto.md");
      f.moved?.("c", "Plain.md");
    }
    expect(calls).toEqual([["a", "Book.md", true], ["b", "Conto.md", true], ["c", "Plain.md", false]]);
  });

  it("builds the status bar element detached without error (mobile)", () => {
    const orig = plugin.addStatusBarItem.bind(plugin);
    plugin.addStatusBarItem = () => { const el = orig(); el.remove(); return el; };
    expect(() => registry.apply()).not.toThrow();
    expect(() => plugin.turn("goals", false)).not.toThrow();
  });

  it("history absorbed from another device repaints the status bar, notifies listeners and counts its streak", () => {
    registry.apply();
    const today = (goals as unknown as { today(): string }).today();
    const day = (n: number) => {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() - n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    (goals as unknown as { renderStatus(): void }).renderStatus();
    const cb = vi.fn();
    goals.dailyProgress.onChange(cb);
    const update = vi.spyOn((goals as unknown as { status: { update(n: unknown): void } }).status, "update");
    expect(goals.dailyProgress.current().words).toBe(0);
    plugin.history.absorb({
      devices: { "other-device": {
        [today]: { added: 4321 }, [day(1)]: { added: 10 }, [day(2)]: { added: 10 },
      } },
    });
    expect(goals.dailyProgress.current().words).toBe(4321);
    expect(cb).toHaveBeenCalledTimes(1);
    const last = update.mock.calls.at(-1)![0] as { today: number; streak: number };
    expect(last.today).toBe(4321);
    expect(last.streak).toBe(3);
    expect(streak(plugin.history.view(), today)).toBe(3);
  });

  it("tells daily progress listeners only when the words or the goal change", () => {
    registry.apply();
    const cb = vi.fn();
    goals.dailyProgress.onChange(cb);
    const repaint = () => (goals as unknown as { renderStatus(): void }).renderStatus();
    repaint();
    expect(cb).toHaveBeenCalledTimes(1);   // first numbers seen
    repaint();
    repaint();
    expect(cb).toHaveBeenCalledTimes(1);   // same numbers: quiet
    plugin.settings.dailyGoal = plugin.settings.dailyGoal + 100;
    repaint();
    expect(cb).toHaveBeenCalledTimes(2);   // the goal changed
    plugin.history.own()[(goals as unknown as { today(): string }).today()] = { added: 7 } as never;
    plugin.history.changed();
    repaint();
    expect(cb).toHaveBeenCalledTimes(3);   // the words changed
    repaint();
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("notifies again after goals is switched off and on", () => {
    registry.apply();
    const repaint = () => (goals as unknown as { renderStatus(): void }).renderStatus();
    repaint();
    plugin.turn("goals", false);
    plugin.turn("goals", true);
    const cb = vi.fn();
    goals.dailyProgress.onChange(cb);
    repaint();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  /** A tracked note A with a counts stub; `now` is what the next count returns. */
  function trackedNote(piece = false) {
    const file = new TFile();
    file.path = "A.md";
    const other = new TFile();
    other.path = "B.md";
    let active: TFile | null = file;
    // `gate`: while set, a count waits for it, then reads `now`
    const counts = { now: { words: 0, open: false } as { words: number; open?: boolean }, gate: null as Promise<void> | null };
    (plugin as unknown as { books: unknown }).books = {
      classify: () => ({ tracked: true, kind: "note", piece, book: null, markdown: true, path: "A.md" }),
    };
    (plugin as unknown as { measure: unknown }).measure = {
      counts: async () => {
        if (counts.gate) await counts.gate;
        return { ...counts.now };
      },
      peek: () => undefined,
    };
    plugin.app.workspace.getActiveFile = (() => active) as never;
    const open = (f: TFile) => { active = f; plugin.app.workspace.trigger("file-open", f); };
    const save = () => plugin.app.vault.trigger("modify", file);
    const settle = () => (goals as unknown as { queue: Promise<void> }).queue;
    const day = () => plugin.history.own()[(goals as unknown as { today(): string }).today()];
    /** Holds the next counts until the returned function is called. */
    const hold = () => {
      let release!: () => void;
      counts.gate = new Promise((r) => { release = () => { counts.gate = null; r(); }; });
      return release;
    };
    return { file, other, counts, open, save, settle, day, hold };
  }

  // 2026-10-24: a save still being counted when goals was switched off wrote its baseline back
  // after the clear, and the words typed while off counted on the next save.
  it("a save counted across a switch-off doesn't bring its baseline back", async () => {
    registry.apply();
    const n = trackedNote();
    n.counts.now = { words: 100 };
    n.open(n.file);
    await n.settle();
    const release = n.hold();
    n.counts.now = { words: 150 };
    n.save();
    plugin.turn("goals", false);
    release();
    await n.settle();
    n.counts.now = { words: 1150 };              // typed while goals was off
    plugin.turn("goals", true);
    n.open(n.file);
    await n.settle();
    n.counts.now = { words: 1151 };
    n.save();
    await n.settle();
    expect(n.day()?.added).toBe(1);
  });

  // 2026-10-24: the same race with a sync: the dropped baseline came back and the next save
  // counted the synced words as written.
  it("a note opened again is measured again, so a synced change never counts", async () => {
    registry.apply();
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const n = trackedNote();
    n.counts.now = { words: 100 };
    n.open(n.file);
    await n.settle();
    const release = n.hold();
    n.counts.now = { words: 150 };
    n.save();                                    // counted later
    n.open(n.other);
    now += 10_000;                               // past the grace for a file just left
    n.counts.now = { words: 650 };
    n.save();                                    // a sync: not typing, drops the baseline
    release();
    await n.settle();
    n.open(n.file);
    await n.settle();
    n.counts.now = { words: 651 };
    n.save();
    await n.settle();
    // the held count reads the synced text, so the 50 typed before leaving are lost with it;
    // 1.2.2 recorded 501 here
    expect(n.day()?.added).toBe(1);
  });

  // 2026-10-24: switching tabs while a comment runs open used to re-measure the note and
  // forget what the opener hid, so the closing save recorded nothing.
  it("keeps an open comment's baseline across a tab switch, so the closing save counts", async () => {
    registry.apply();
    const n = trackedNote();
    n.counts.now = { words: 100 };
    n.open(n.file);
    await n.settle();
    n.counts.now = { words: 20, open: true };   // typed %%: 80 words hidden
    n.save();
    await n.settle();
    n.open(n.other);
    n.open(n.file);                              // prime() again
    await n.settle();
    n.counts.now = { words: 30, open: true };   // ten words above the opener
    n.save();
    await n.settle();
    n.counts.now = { words: 113 };               // closed, three words after the closer
    n.save();
    await n.settle();
    expect(n.day()?.added).toBe(13);
  });

  it("writes a piece's full total on the save that closes a comment, even when it adds no words", async () => {
    registry.apply();
    const n = trackedNote(true);
    n.counts.now = { words: 100 };
    n.open(n.file);
    await n.settle();
    n.counts.now = { words: 20, open: true };
    n.save();
    await n.settle();
    n.counts.now = { words: 25, open: true };   // typed above the opener: total taken while open
    n.save();
    await n.settle();
    expect(n.day()?.books?.["A.md"]?.total).toBe(25);
    n.counts.now = { words: 105 };               // closed: no new words
    n.save();
    await n.settle();
    expect(n.day()?.added).toBe(5);
    expect(n.day()?.books?.["A.md"]?.total).toBe(105);
  });
});
