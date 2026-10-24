import { describe, it, expect } from "vitest";
import { HistoryStore, BACKUP_KEY, DEVICE_KEY, mergeSettings, type History, type HistoryParts } from "../src/core/history-store";
import { FakeDisk, fakeHistoryHost, fakeLocal } from "./support/fake-plugin";
import { applyDelta, streak, addedOn } from "../src/goals/tracker";

const D1 = "2026-10-22";
const D2 = "2026-10-23";
const D3 = "2026-10-24";

/** One device: its disk, its localStorage, and a store that saves the way main.ts does. */
class Device {
  disk = new FakeDisk();
  local = fakeLocal();
  store!: HistoryStore;
  saves = 0;
  clock = 1_700_000_000_000;
  constructor() { this.open(); }
  /** (re)start the plugin on this device: a new store from the disk and the localStorage */
  async open(): Promise<void> {
    this.store = new HistoryStore(fakeHistoryHost(this.disk, this.local, () => this.clock), () => { this.saves++; });
    this.store.absorb(this.disk.data);
    await this.store.markSeen();
  }
  write(day: string, words: number, book?: { path: string; total: number }): void {
    this.clock += 1000;
    applyDelta(this.store.own(), day, words, book ?? null, () => this.clock);
    this.store.changed();
  }
  save(): Promise<void> {
    return this.store.persist((p: HistoryParts) => ({ version: 1, settings: { a: 1 }, other: "x", ...p }));
  }
  get view() { return this.store.view(); }
}

async function started(): Promise<Device> {
  const d = new Device();
  await d.open();
  return d;
}

describe("HistoryStore, one device", () => {
  it("keeps a device id in localStorage and reuses it", () => {
    const local = fakeLocal();
    const a = new HistoryStore(fakeHistoryHost(new FakeDisk(), local));
    const b = new HistoryStore(fakeHistoryHost(new FakeDisk(), local));
    expect(a.device).toBe(b.device);
    expect(local.map.get(DEVICE_KEY)).toBe(a.device);
  });

  it("changed() rebuilds the view, notifies and asks for a save; the view is the same object until then", async () => {
    const d = await started();
    const v1 = d.view;
    expect(d.view).toBe(v1);
    let n = 0;
    d.store.onChange(() => n++);
    d.write(D1, 40);
    expect(d.view).not.toBe(v1);
    expect(addedOn(d.view, D1)).toBe(40);
    expect(n).toBe(1);
    expect(d.saves).toBe(1);
  });

  it("onChange returns an unsubscribe", async () => {
    const d = await started();
    let n = 0;
    const off = d.store.onChange(() => n++);
    off();
    d.write(D1, 5);
    expect(n).toBe(0);
  });

  it("persist writes history, devices and renames beside the caller's other keys, and the backup", async () => {
    const d = await started();
    d.write(D1, 40, { path: "B.md", total: 100 });
    await d.save();
    const out = d.disk.data as Record<string, unknown>;
    expect(out.other).toBe("x");
    expect(out.history).toEqual({});
    expect((out.devices as Record<string, unknown>)[d.store.device]).toBeDefined();
    expect(out.renames).toEqual([]);
    const backup = d.local.map.get(BACKUP_KEY) as { device: string; history: Record<string, unknown> };
    expect(backup.device).toBe(d.store.device);
    expect(Object.keys(backup.history)).toEqual([D1]);
  });

  it("the legacy history key is the base: its days count and are written back unchanged", async () => {
    const d = new Device();
    d.disk.data = { history: { [D1]: { added: 70, deleted: 0, books: {} } } };
    await d.open();
    d.write(D1, 30);
    expect(addedOn(d.view, D1)).toBe(100);
    await d.save();
    expect((d.disk.data as { history: Record<string, { added: number }> }).history[D1].added).toBe(70);
  });

  it("saves run one at a time", async () => {
    const d = await started();
    const order: string[] = [];
    const host = fakeHistoryHost(d.disk, d.local);
    const slow = { ...host, save: async (x: unknown) => { order.push("start"); await Promise.resolve(); await Promise.resolve(); await host.save(x); order.push("end"); } };
    const s = new HistoryStore(slow);
    await Promise.all([s.persist((p) => p), s.persist((p) => p)]);
    expect(order).toEqual(["start", "end", "start", "end"]);
  });

  it("a save whose read fails writes nothing and the next one works", async () => {
    const d = await started();
    d.write(D1, 9);
    const good = fakeHistoryHost(d.disk, d.local);
    let fail = true;
    const s = new HistoryStore({ ...good, load: () => (fail ? Promise.reject(new Error("bad json")) : good.load()) });
    s.own()[D1] = { added: 9, deleted: 0, books: {} };
    await expect(s.persist((p) => p)).rejects.toThrow("bad json");
    expect(d.disk.data).toBeNull();
    fail = false;
    await s.persist((p) => p);
    expect(d.disk.data).not.toBeNull();
  });

  it("refresh skips our own write and reads a newer file", async () => {
    const d = await started();
    d.write(D1, 10);
    await d.save();
    expect(await d.store.refresh()).toBe(false);
    d.disk.mtime += 5;
    let adopted: unknown = null;
    expect(await d.store.refresh({ adopt: (raw) => { adopted = raw; } })).toBe(true);
    expect(adopted).not.toBeNull();
    expect(await d.store.refresh()).toBe(false);
    expect(await d.store.refresh({ force: true })).toBe(true);
  });

  it("a read of a newer file notifies when the view changed, and not otherwise", async () => {
    const d = await started();
    let n = 0;
    d.store.onChange(() => n++);
    d.disk.data = { devices: { other: { [D1]: { added: 5, deleted: 0, books: {} } } } };
    d.disk.mtime = 99_999;
    await d.store.refresh();
    expect(n).toBe(1);
    await d.store.refresh({ force: true });
    expect(n).toBe(1);
  });

  it("malformed sections in the file are cleaned, not trusted", async () => {
    const d = await started();
    d.store.absorb({ history: [], devices: { "__proto__": { x: 1 }, bad: 7, ok: { [D1]: { added: "9", books: 3 } } }, renames: "x" });
    expect(addedOn(d.view, D1)).toBe(0);
    expect(Object.getPrototypeOf(d.view)).toBe(Object.prototype);
  });

  it("rename moves base, own and other devices' keys and records one shared rename", async () => {
    const d = await started();
    d.write(D1, 10, { path: "X.md", total: 10 });
    expect(d.store.rename("X.md", "Y.md")).toBe(true);
    expect(Object.keys(d.view[D1].books)).toEqual(["Y.md"]);
    expect(d.store.rename("Nope.md", "Z.md")).toBe(false);
    expect(d.store.rename("Y.md", "Y.md")).toBe(false);
    await d.save();
    expect((d.disk.data as { renames: unknown[] }).renames).toHaveLength(1);
  });
});

describe("HistoryStore, two devices sharing a data.json through a sync", () => {
  it("the same day written on both devices adds up", async () => {
    const a = await started();
    const b = await started();
    a.write(D1, 100);
    await a.save();
    b.write(D1, 50);
    await b.save();
    a.disk.copyTo(b.disk);     // a first syncs: b's file is a's (b's words are only in b's memory)
    await b.save();            // b reads before it writes and puts its section back
    b.disk.copyTo(a.disk);
    await a.store.refresh();
    expect(addedOn(a.view, D1)).toBe(150);
    expect(addedOn(b.view, D1)).toBe(150);
    const file = a.disk.data as { devices: Record<string, unknown> };
    expect(Object.keys(file.devices).sort()).toEqual([a.store.device, b.store.device].sort());
  });

  it("a stale copy winning the sync: memory puts the section back on the next save", async () => {
    const a = await started();
    const b = await started();
    a.write(D1, 100);
    await a.save();
    b.write(D1, 50);
    await b.save();
    b.disk.copyTo(a.disk);     // a's file is now b's: a's 100 words are not in it
    expect(await a.store.refresh()).toBe(true);
    expect(addedOn(a.view, D1)).toBe(150);   // memory kept a's 100
    await a.save();
    const file = a.disk.data as { devices: Record<string, Record<string, { added: number }>> };
    expect(file.devices[a.store.device][D1].added).toBe(100);
    expect(file.devices[b.store.device][D1].added).toBe(50);
  });

  it("a closed device reopening reads its own words back from the backup", async () => {
    const a = await started();
    const b = await started();
    a.write(D1, 100);
    await a.save();            // the backup is written
    b.write(D1, 50);
    await b.save();
    b.disk.copyTo(a.disk);     // a closes; the sync leaves b's older file on a's disk
    expect((a.disk.data as { devices: Record<string, unknown> }).devices[a.store.device]).toBeUndefined();
    await a.open();            // a reopens: a new store, the same localStorage
    expect(addedOn(a.view, D1)).toBe(150);
    await a.save();
    expect((a.disk.data as { devices: Record<string, Record<string, { added: number }>> }).devices[a.store.device][D1].added).toBe(100);
  });

  it("without the backup (cleared storage) the old section still counts under its old id", async () => {
    const a = await started();
    a.write(D1, 100);
    await a.save();
    const oldId = a.store.device;
    a.local.map.clear();
    await a.open();
    expect(a.store.device).not.toBe(oldId);
    expect(addedOn(a.view, D1)).toBe(100);
    a.write(D1, 20);
    await a.save();
    expect(addedOn(a.view, D1)).toBe(120);
  });

  it("a book renamed while the other device is closed is one book in the merged view", async () => {
    const a = await started();
    const b = await started();
    a.write(D1, 10, { path: "X.md", total: 100 });
    await a.save();
    b.write(D1, 10, { path: "X.md", total: 100 });
    await b.save();
    a.disk.copyTo(b.disk);
    await b.save();
    b.disk.copyTo(a.disk);
    await a.store.refresh();
    // b closes. a renames the book and saves; the sync carries the file to b
    expect(a.store.rename("X.md", "Y.md")).toBe(true);
    await a.save();
    a.disk.copyTo(b.disk);
    await b.open();            // b reopens: its backup still says X.md
    expect(Object.keys(b.view[D1].books)).toEqual(["Y.md"]);
    expect(b.view[D1].books["Y.md"].added).toBe(20);
    expect(addedOn(b.view, D1)).toBe(20);
    b.write(D1, 5, { path: "Y.md", total: 105 });
    await b.save();
    b.disk.copyTo(a.disk);
    await a.store.refresh();
    expect(Object.keys(a.view[D1].books)).toEqual(["Y.md"]);
    expect(a.view[D1].books["Y.md"].added).toBe(25);
  });

  it("a shared rename with nothing to move still folds a closed device's later section into the new path", async () => {
    const a = await started();
    const b = await started();
    // a has nothing under Old.md; b (closed, unsynced) has 500 words there
    b.write(D1, 500, { path: "Old.md", total: 500 });
    await b.save();
    expect(a.store.rename("Old.md", "New.md", { share: true })).toBe(false);
    expect(a.saves).toBe(1);
    await a.save();
    expect((a.disk.data as { renames: unknown[] }).renames).toHaveLength(1);
    // the sync brings b's section to a, then a's file back to b
    b.disk.copyTo(a.disk);
    await a.store.refresh();
    expect(Object.keys(a.view[D1].books)).toEqual(["New.md"]);
    expect(addedOn(a.view, D1)).toBe(500);
  });

  it("a rename without share and nothing moved adds no entry", async () => {
    const a = await started();
    expect(a.store.rename("Old.md", "New.md")).toBe(false);
    expect(a.saves).toBe(0);
    await a.save();
    expect((a.disk.data as { renames: unknown[] }).renames).toEqual([]);
  });

  it("the streak is computed on the merged view across both devices", async () => {
    const a = await started();
    const b = await started();
    a.write(D1, 10);
    a.write(D3, 10);
    await a.save();
    b.write(D2, 10);
    await b.save();
    a.disk.copyTo(b.disk);
    await b.save();
    b.disk.copyTo(a.disk);
    await a.store.refresh();
    expect(streak(a.view, D3)).toBe(3);
    expect(streak(b.view, D3)).toBe(3);
    // each device alone would have broken the streak
    expect(streak({ [D1]: a.view[D1], [D3]: a.view[D3] }, D3)).toBe(1);
  });

  it("settings come back through the refresh's adopt hook, and the other keys stay memory's", async () => {
    const a = await started();
    const b = await started();
    a.write(D1, 1);
    await a.save();
    (a.disk.data as { settings: unknown }).settings = { dailyGoal: 500 };
    a.disk.copyTo(b.disk);
    b.disk.mtime += 10;
    const seen: unknown[] = [];
    await b.store.refresh({ adopt: (raw) => seen.push((raw as { settings: unknown }).settings) });
    expect(seen).toEqual([{ dailyGoal: 500 }]);
    expect(addedOn(b.view, D1)).toBe(1);
  });

  it("an older file never lowers a count in memory", async () => {
    const a = await started();
    a.write(D1, 100);
    a.store.absorb({ devices: { [a.store.device]: { [D1]: { added: 3, deleted: 0, books: {} } } } });
    expect(addedOn(a.view, D1)).toBe(100);
  });
});

// PLAN-1.2.3 advisor F1/F2: settings follow the change, not the device that saved last, and a
// synced file older than our own last write is still read.
type Settings = Record<string, unknown>;

/** A device that keeps settings the way main.ts does: memory, the copy last read or written, a three-way merge. */
class SettingsDevice extends Device {
  settings: Settings = { goal: 1, theme: "a" };
  synced: Settings = structuredClone(this.settings);
  adopt = (raw: unknown): void => {
    const disk = (raw as { settings?: Settings } | null)?.settings;
    if (!disk) return;
    this.settings = mergeSettings(this.synced, this.settings, disk);
    this.synced = structuredClone(disk);
  };
  override save(): Promise<void> {
    return this.store.persist((p: HistoryParts) => {
      this.synced = structuredClone(this.settings);
      return { version: 1, settings: structuredClone(this.settings), ...p };
    }, this.adopt);
  }
  check(): Promise<boolean> { return this.store.refresh({ adopt: this.adopt }); }
}

async function startedS(): Promise<SettingsDevice> {
  const d = new SettingsDevice();
  await d.open();
  return d;
}

describe("mergeSettings (three-way, per key)", () => {
  it("takes the disk's value for keys memory didn't change, keeps memory's changes", () => {
    const synced = { goal: 1, theme: "a", list: [1] };
    expect(mergeSettings(synced, { goal: 1, theme: "a", list: [1] }, { goal: 2, theme: "a", list: [1] }))
      .toEqual({ goal: 2, theme: "a", list: [1] });
    expect(mergeSettings(synced, { goal: 1, theme: "b", list: [1] }, { goal: 2, theme: "a", list: [1, 2] }))
      .toEqual({ goal: 2, theme: "b", list: [1, 2] });
    // both changed the same key: memory's (this device saves it next)
    expect(mergeSettings(synced, { goal: 3, theme: "a", list: [1] }, { goal: 2, theme: "a", list: [1] }).goal).toBe(3);
  });

  it("a key only on disk is taken; a key memory has and the disk lacks stays", () => {
    expect(mergeSettings({ a: 1 }, { a: 1, m: 1 }, { a: 1, d: 2 })).toEqual({ a: 1, m: 1, d: 2 });
  });
});

describe("HistoryStore, settings across devices", () => {
  it("a save that finds a newer file adopts its settings before writing (the other device is typing)", async () => {
    const a = await startedS();
    const b = await startedS();
    await a.save();
    a.disk.copyTo(b.disk);
    await b.check();
    // a changes the daily goal and saves; the file reaches b
    a.settings.goal = 2;
    await a.save();
    a.disk.copyTo(b.disk);
    // b is typing: its debounced save runs before any refresh
    b.write(D1, 30);
    await b.save();
    expect(b.settings.goal).toBe(2);
    expect((b.disk.data as { settings: Settings }).settings.goal).toBe(2);
    // b's file goes back to a: a's change stays
    b.disk.copyTo(a.disk);
    await a.check();
    expect(a.settings.goal).toBe(2);
    expect(addedOn(a.view, D1)).toBe(30);
  });

  it("a refresh keeps a change this device made and hasn't saved yet", async () => {
    const a = await startedS();
    const b = await startedS();
    await a.save();
    a.disk.copyTo(b.disk);
    await b.check();
    a.settings.theme = "z";
    await a.save();
    a.disk.copyTo(b.disk);
    b.settings.goal = 5;          // changed on b, its save still queued
    await b.check();
    expect(b.settings).toEqual({ goal: 5, theme: "z" });
  });

  it("our own write is not adopted again, and an older file's settings never replace newer ones", async () => {
    const a = await startedS();
    const b = await startedS();
    await b.save();                 // b's file, older
    const old = new FakeDisk();
    b.disk.copyTo(old);
    a.settings.goal = 7;
    await a.save();
    let adopted = 0;
    await a.store.persist((p) => ({ settings: a.settings, ...p }), () => { adopted++; });
    expect(adopted).toBe(0);        // the file on disk is our own last write
    old.mtime = 1;                  // b's older file arrives with its own (older) mtime
    old.copyTo(a.disk);
    expect(await a.check()).toBe(true);
    expect(a.settings.goal).toBe(7);
  });

  it("a synced file older than our last write is still read (its words show without our next save)", async () => {
    const a = await started();
    const b = await started();
    b.write(D1, 500);
    await b.save();
    const fromB = new FakeDisk();
    b.disk.copyTo(fromB);
    a.write(D1, 1);
    await a.save();                 // a's write is newer than b's
    fromB.copyTo(a.disk);           // the sync keeps b's mtime, older than a's
    expect(await a.store.refresh()).toBe(true);
    expect(addedOn(a.view, D1)).toBe(501);
    expect(await a.store.refresh()).toBe(false);   // the same file is not read again every minute
  });
});

describe("HistoryStore, mixed versions (a 1.2.2 device writes only the base)", () => {
  const BOOK_OLD = "Old.md";
  const BOOK_NEW = "New.md";
  const keys = (d: Device) => Object.keys(d.view[D1].books);

  const day = (book: string) => ({ [D1]: { added: 100, deleted: 0, books: { [book]: { added: 100, deleted: 0, total: 100 } } } });

  it("a 1.2.2 rename of the base (no renames entry) leaves one book", async () => {
    const d = await started();
    d.store.absorb({ history: day(BOOK_OLD) });
    d.store.absorb({ history: day(BOOK_NEW) });   // what a 1.2.2 device writes: the base re-keyed
    expect(keys(d)).toEqual([BOOK_NEW]);
    expect(addedOn(d.view, D1)).toBe(100);
  });

  it("a logged 1.2.3 rename is not undone by a stale base that still has the old key", async () => {
    const d = await started();
    d.store.absorb({ history: day(BOOK_OLD) });
    d.store.rename(BOOK_OLD, BOOK_NEW);
    d.store.absorb({ history: day(BOOK_OLD) });
    expect(keys(d)).toEqual([BOOK_NEW]);
    expect(addedOn(d.view, D1)).toBe(100);
  });

  it("a 1.2.2 device writing more words into a day keeps the larger counts", async () => {
    const d = await started();
    d.store.absorb({ history: { [D1]: { added: 100, deleted: 0, books: { [BOOK_OLD]: { added: 100, deleted: 0, total: 100 } } } } });
    d.store.absorb({ history: { [D1]: { added: 130, deleted: 0, books: { [BOOK_OLD]: { added: 130, deleted: 0, total: 130 } } } } });
    expect(addedOn(d.view, D1)).toBe(130);
    expect(keys(d)).toEqual([BOOK_OLD]);
  });

  it("a 1.2.2 save that drops devices and renames is repaired by the next 1.2.3 save", async () => {
    const d = await started();
    d.write(D1, 100, { path: BOOK_OLD, total: 100 });
    d.store.rename(BOOK_OLD, BOOK_NEW);
    await d.save();
    const out = d.disk.data as { history: unknown; settings: unknown };
    d.disk.data = { version: 1, settings: out.settings, history: out.history };   // 1.2.2 drops the other keys
    d.disk.mtime += 10;
    await d.save();
    const back = d.disk.data as { devices: Record<string, History>; renames: { from: string; to: string }[] };
    expect(Object.keys(back.devices)).toHaveLength(1);
    expect(back.renames.map((r) => [r.from, r.to])).toEqual([[BOOK_OLD, BOOK_NEW]]);
    expect(addedOn(d.view, D1)).toBe(100);
    expect(keys(d)).toEqual([BOOK_NEW]);
  });
});
