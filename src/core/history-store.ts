// The word-count history shared by several devices (PLAN-1.2.3, D1-D8). No Obsidian imports:
// the plugin gives the store a `HistoryHost`, tests give it a fake.
//
// Each device writes only its own section of data.json. Readers see `view()`, the merged history.
// Every merge into memory is a `maxHistory`, so a stale copy of the file can never lower a count.

import {
  cleanDevices, cleanHistory, cleanRenames, maxBase, maxHistory, mergeHistories, unionRenames,
  type History, type Rename,
} from "./device-history";
import { isRecord } from "./records";

export type { History, Rename };

export const DEVICE_KEY = "escrita-device";
export const BACKUP_KEY = "escrita-history-backup";

/** What the store needs from the plugin. */
export interface HistoryHost {
  /** plugin.loadData */
  load(): Promise<unknown>;
  /** plugin.saveData */
  save(data: unknown): Promise<void>;
  /** adapter.stat(<plugin dir>/data.json)?.mtime ?? 0 */
  mtime(): Promise<number>;
  /** app.loadLocalStorage / saveLocalStorage: per vault and device, never synced */
  local: { get(key: string): unknown; set(key: string, v: unknown): void };
  now(): number;
}

/** The three keys of data.json this store owns. */
export interface HistoryParts {
  history: History;
  devices: Record<string, History>;
  renames: Rename[];
}

function newDeviceId(now: number): string {
  const c = typeof window !== "undefined" ? (window as { crypto?: { randomUUID?: () => string } }).crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** JSON with sorted keys, so two equal values compare equal whatever their key order. */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) => {
    if (!isRecord(val)) return val;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(val).sort()) out[k] = val[k];
    return out;
  });
}

/**
 * Settings read back from data.json, merged per key against the copy last read or written
 * (`synced`): a key this device didn't change since takes the disk's value, a key it changed keeps
 * memory's. So a setting changed on one device isn't put back by the other device's next save.
 */
export function mergeSettings<T extends Record<string, unknown>>(synced: Record<string, unknown>, mine: T, disk: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...mine };
  for (const k of Object.keys(disk)) {
    if (k === "__proto__") continue;
    if (!(k in mine) || stableJson(mine[k]) === stableJson(synced[k])) out[k] = disk[k];
  }
  return out as T;
}

export class HistoryStore {
  readonly device: string;
  private base: History = {};
  private mine: History = {};
  private others = new Map<string, History>();
  private renames: Rename[] = [];
  private cache: History | undefined;
  private listeners = new Set<() => void>();
  /** the data.json mtime this store last wrote or read: a file with another mtime is read again */
  private seen = 0;
  /**
   * the newest mtime written or read: only a file newer than this goes to `adopt` (settings), so a
   * synced file that keeps an older mtime adds its words but never puts back older settings
   */
  private newest = 0;
  private tail: Promise<void> = Promise.resolve();

  constructor(private host: HistoryHost, private requestSave: () => void = () => {}) {
    let id: unknown;
    try { id = host.local.get(DEVICE_KEY); } catch { id = undefined; }
    if (typeof id !== "string" || id === "" || id === "__proto__" || id.length > 200) {
      id = newDeviceId(host.now());
      try { host.local.set(DEVICE_KEY, id); } catch { /* storage may be unavailable: a new id each run, the old sections still count */ }
    }
    this.device = id as string;
    // D7: the backup of this device's own section, written after every save
    try {
      const b = host.local.get(BACKUP_KEY);
      if (isRecord(b) && b.device === this.device) this.mine = cleanHistory(b.history);
    } catch { /* no backup */ }
  }

  /** The merged view every reader uses; the same object until something changes. */
  view(): History {
    if (!this.cache) this.cache = mergeHistories(this.base, this.sections(), this.renames);
    return this.cache;
  }

  /**
   * This device's section: the only history the goals tracker writes into. The object is replaced
   * when a file is absorbed, so ask for it each time instead of keeping it.
   */
  own(): History { return this.mine; }

  /** After writing into own(): rebuild the view, notify, and ask for a save. */
  changed(): void {
    this.cache = undefined;
    this.notify();
    this.requestSave();
  }

  /**
   * Move records of a renamed book or folder (base, own and the other devices'), and share the rename.
   * Returns whether anything moved here. With `share`, the rename is also shared when nothing moved
   * (a closed device may hold words under the old path), and a save is asked for.
   */
  rename(oldPath: string, newPath: string, opts?: { share?: boolean }): boolean {
    if (oldPath === newPath) return false;
    const r: Rename = { from: oldPath, to: newPath, at: this.host.now() };
    const before = stableJson([this.base, this.mine, [...this.others]]);
    const move = (h: History): History => mergeHistories(h, {}, [r]);   // one section through the rename
    this.base = move(this.base);
    this.mine = move(this.mine);
    for (const [id, h] of this.others) this.others.set(id, move(h));
    const moved = stableJson([this.base, this.mine, [...this.others]]) !== before;
    if (!moved && !opts?.share) return false;
    this.renames = unionRenames(this.renames, [r], this.host.now());
    this.changed();
    return moved;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /** Merge a freshly read data.json (load, external change, a newer mtime). Never lowers a count. */
  absorb(raw: unknown): void {
    if (!isRecord(raw)) return;
    const before = stableJson(this.view());
    const now = this.host.now();
    const next = unionRenames(this.renames, cleanRenames(raw.renames), now);
    if (stableJson(next) !== stableJson(this.renames)) {
      this.renames = next;
      // sections already in memory follow the new renames, so an old key can't come back beside the new one
      this.base = this.fold(this.base);
      this.mine = this.fold(this.mine);
      for (const [id, h] of this.others) this.others.set(id, this.fold(h));
    }
    this.base = maxBase(this.base, this.fold(cleanHistory(raw.history)));  // a 1.2.2 rename re-keys the base alone
    for (const [id, h] of Object.entries(cleanDevices(raw.devices))) {
      const disk = this.fold(h);
      if (id === this.device) this.mine = maxHistory(this.mine, disk);
      else this.others.set(id, maxHistory(this.others.get(id) ?? {}, disk));
    }
    this.cache = undefined;
    if (stableJson(this.view()) !== before) this.notify();
  }

  /** The `history`, `devices` and `renames` to write, merged with what is on disk now. */
  toSave(disk: unknown): HistoryParts {
    this.absorb(disk);
    this.renames = unionRenames(this.renames, [], this.host.now());
    return { history: this.base, devices: this.sections(), renames: this.renames };
  }

  /** The backup of this device's own section (D7). */
  backup(): void {
    try { this.host.local.set(BACKUP_KEY, { device: this.device, history: this.mine }); } catch { /* storage may be unavailable */ }
  }

  /** Remember the file's current mtime as seen (after load). */
  async markSeen(): Promise<void> {
    try { this.saw(await this.host.mtime()); } catch { /* no stat */ }
  }

  /**
   * Save, one at a time: read data.json, merge (`toSave`), write what `build` makes of the parts,
   * remember our own write's mtime, write the backup. A file newer than any read or written so far
   * (another device's save not yet refreshed) goes through `adopt` first, as in `refresh`, so its
   * settings are taken before ours are written over them. The backup is also written at once, before
   * the queued read: the save run on unload may not finish before the app quits. A read that
   * throws stops the save (rule 1); the words stay in memory and in the backup. Obsidian's
   * loadData doesn't throw: a file it can't parse reads as undefined, and memory, which holds
   * every section read so far, is written over it.
   */
  persist(build: (parts: HistoryParts) => unknown, adopt?: (raw: unknown) => void): Promise<void> {
    this.backup();
    return this.enqueue(async () => {
      let before = 0;
      try { before = await this.host.mtime(); } catch { /* no stat: nothing to adopt */ }
      const disk = await this.host.load();
      if (adopt && before > this.newest) {
        try { adopt(disk); } catch { /* the history is still saved */ }
      }
      await this.host.save(build(this.toSave(disk)));
      try { this.saw(await this.host.mtime()); } catch { /* no stat */ }
      this.backup();
    });
  }

  /**
   * Read data.json again when its mtime differs from the one this store last wrote or read (or
   * `force`), and absorb it: a sync tool may keep the other device's older mtime, and absorbing is
   * a `maxHistory`, safe for any file. `adopt` runs on the raw file inside the same queue as saves,
   * only for a file newer than any read or written (or one without an mtime). Resolves true when a
   * file was read.
   */
  refresh(opts: { force?: boolean; adopt?: (raw: unknown) => void } = {}): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        const m = await this.host.mtime();
        if (!opts.force && (m <= 0 || m === this.seen)) return false;
        const raw = await this.host.load();
        const newer = m <= 0 || m > this.newest;
        this.saw(m);
        this.absorb(raw);
        if (newer) opts.adopt?.(raw);
        return true;
      } catch {
        return false;
      }
    });
  }

  private saw(m: number): void {
    if (m <= 0) return;
    this.seen = m;
    if (m > this.newest) this.newest = m;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.tail.then(fn);
    this.tail = p.then(() => undefined, () => undefined);
    return p;
  }

  private fold(h: History): History {
    return this.renames.length ? mergeHistories(h, {}, this.renames) : h;
  }

  /** every device's section, this one included */
  private sections(): Record<string, History> {
    const out: Record<string, History> = {};
    for (const [id, h] of this.others) if (id !== this.device) out[id] = h;
    out[this.device] = this.mine;
    return out;
  }

  private notify(): void {
    for (const cb of [...this.listeners]) cb();
  }
}
