# Escrita 1.2.3, "the count you can trust": implementation plan

Two fixes to the daily word count, and the history shared across devices. Written 2026-10-24 on
`main` at `0a95873` (1.2.2), with the counter fixes already in the working tree. **Approved
2026-10-24 (G0)** by the author in conversation: the design below, including the two robustness
pieces (re-read on focus and on the minute tick, and the per-device backup). After the advisor's
review the author approved D6's per-key settings merge and fixes for F4 to F6 (D8, D12, D13).

**Goal:** a writer who writes on two computers, or on a computer and a phone, sees one streak, one
"today", one chart. Words written on each device add up. No sync tool needs special handling
beyond carrying the plugin's `data.json`.

**Stage served:** every stage (goals). **Upkeep for the writer:** none. Nothing to set up; the
guide says which sync settings must carry `.obsidian/plugins/escrita/data.json`.

## Already in the working tree (done, checked)

- `countedChange` (`src/goals/tracker.ts`) takes a `Baseline { words, open, hidden? }`: a note that
  stays open (notes under a `%%` that never closes, a leading `---`, a stray `%%`) counts again;
  the save that opens records only words it added, the save that closes records the change since
  the opener minus what it hid.
- `prime()` measures the note again on every file-open, carrying only `hidden` while still open;
  queued tracking work is dropped after an unload (`generation`).
- The closing save rewrites the book or piece total (`src/goals/index.ts`, `onModify`).
- Improvement, a slice of candidate 48: daily-progress listeners are notified only when
  `{ words, goal }` changes.
- Tests in `tests/goals.test.ts` and `tests/lifecycle-goals.test.ts`; README 1.2.3 entry, ROADMAP
  row, IMPROVEMENTS (Done row, known issues), CONTEXT version, ARCHITECTURE "Open comments", guide.

## Claims checked against the code and Obsidian 1.14.5

- `loadAll()` (`src/main.ts:249`) reads `data.json` once. `persist()` (`:270`) writes all of
  `this.data`. Nothing implements `onExternalSettingsChange`. So the last device to save wipes the
  other's days, and settings changed on one device are overwritten by the other's next save.
- `DayRecord { added, deleted, books }`, `DayBook { added, deleted, total }` (`src/data.ts:10-22`).
  Two devices write the same fields of the same day: their snapshots can't be added up.
- Readers of `plugin.data.history`: `src/goals/index.ts` (the port's `current`, `record`,
  `renderStatus`, the rename follower), `src/goals/progress-modal.ts:161,321,418,484`,
  `src/goals/settings-ui.ts:132`. Nothing outside goals reads it.
- Obsidian (app.js 1.14.5): `saveData` writes `JSON.stringify(data, undefined, 2)` with
  `mtime: Date.now()`; a `raw` event on `<pluginDir>/data.json` calls `onExternalSettingsChange`
  when the file's mtime is newer than the plugin's last save. A `git pull` or another sync tool
  writing the file on desktop triggers it. On phones, writes by another app may not be seen.
- Obsidian Sync syncs only `manifest.json`, `main.js`, `styles.css` and `data.json` in a plugin
  folder (`isPluginFile`). **So everything stays in `data.json`**: a second file would not reach
  Obsidian Sync users.
- `app.loadLocalStorage` / `saveLocalStorage` (since 1.8.7) store per vault, per device, never
  synced. `onExternalSettingsChange` since 1.5.7. `minAppVersion` is 1.13.0: no raise needed.

## Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Where does each device write? | **Its own section of `data.json`:** `devices: { [deviceId]: History }`. A device writes only its own section. The legacy `history` key stays as a frozen base. |
| D2 | The device id | A random id saved with `app.saveLocalStorage("escrita-device")` on first load (`crypto.randomUUID()` when present, else a time plus random string). Never synced, never shown. A cleared localStorage makes a new id: the old section stays in the file and still counts. |
| D3 | What the readers see | **One merged `History`**, built by a pure `mergeHistories(base, devices, renames)`: per day, `added` and `deleted` are the sum of the base and every device; per day and book, the same sums, and `total` from the record with the latest `at`. Cached, rebuilt when any section changes. Streak, goal met, chart, pacing, the status bar and writing mode's counter all read it. |
| D4 | `at` on a book's day record | `DayBook` gains optional `at` (ms) set by `applyDelta` and `recordBookTotal`. A record without `at` (legacy) counts as oldest. |
| D5 | Saving | **Read before write.** `persist()` reads `data.json`, keeps the disk's other devices and base merged with memory by `maxHistory` (per day and field the larger value, per book the larger counts and the newer total), writes memory's own section and settings and the rest of the data as today. Saves run one at a time (a promise chain). Our own write's mtime is remembered so the reload skips it. |
| D6 | Reloading | `onExternalSettingsChange()`, plus a check of `data.json`'s mtime (`adapter.stat`) on window focus, on `visibilitychange` to visible, and once a minute. A file whose mtime differs from the last one read or written is read (Obsidian Sync and Syncthing keep the source's mtime, so an older one still counts): other devices and the base merge in (`maxHistory`; the base through `maxBase`, so a 1.2.2 device's rename re-keys a day instead of doubling its book); the own section merges by `maxHistory` too (a stale disk copy never lowers it). **Settings merge per key, three-way** (changed 2026-10-24 after the advisor's F1; the first version took the disk's settings whole and reverted a change made while the other device was typing): against the copy last read or written, a key this device didn't change takes the file's value, a key it changed keeps its own, and a key both changed keeps the last save. Only a file newer than everything read or written can bring settings in, and `persist` adopts a newer file's settings before writing. Applied as `saveSettings` does, without writing. Other data keys (publish, leftOff, lens dismissals, thread dates, POV colours, export choices, read positions, setupOffered) keep memory's values in 1.2.3 (known issue, listed). |
| D7 | The backup | After each save, the own section goes to `app.saveLocalStorage("escrita-history-backup", { device, history })`. On load, a backup for the same device merges into the own section by `maxHistory`. This covers: device A writes and closes before syncing, B's older file wins, A reopens and would read its own words gone. |
| D8 | Renames | The data follower renames keys in the own section and the base (as today) and appends `{ from, to, at }` to a shared `renames` list in `data.json` (merged as a union by `from+to+at`, kept for 400 days). `mergeHistories` applies the list, in `at` order, to every device's section when building the view, so a book renamed while the other device was closed still charts as one. |
| D9 | Where the code lives | Pure: `src/core/device-history.ts` (types, `mergeHistories`, `maxHistory`, `applyRenames`, cleaners). Obsidian-facing: `src/core/history-store.ts`, a `HistoryStore` service on `plugin.history` built in `main.ts` (shared core, a deliberate refactor). Goals writes through it and reads its view. The store works with goals off (data stays and keeps syncing). |
| D10 | Migration | None destructive. On first load `devices` is absent: the base is the old `history`, the own section starts empty. Nothing is moved or deleted. Rolling back to 1.2.2 reads `history` (the base) and loses only days written under 1.2.3 (README upgrade note). |
| D12 | Moving an open opener (F6) | `Counts.openWords`: the words in the region that runs open. While a note stays open, a save whose visible words change but whose visible plus open words don't is a move: it records nothing and corrects `hidden`. |
| D13 | Renames nobody here has data for (F4) | The goals follower shares a rename in `renames` even when nothing moved on this device, when the new path is a book note, a tracked piece, or a folder holding one, so a closed device's days follow it. |
| D11 | Mobile | Only documented, mobile-safe API: `loadData`/`saveData`, `adapter.stat`, `loadLocalStorage`, `registerDomEvent`, `registerInterval`. No Node, no Electron. Phone testing is waived (the author has no phone sync). |

### The store's interface (`src/core/history-store.ts`)

```ts
export interface HistoryHost {           // what the store needs from the plugin, faked in tests
  load(): Promise<unknown>;              // plugin.loadData
  save(data: unknown): Promise<void>;    // plugin.saveData
  mtime(): Promise<number>;              // adapter.stat(<dir>/data.json)?.mtime ?? 0
  local: { get(key: string): unknown; set(key: string, v: unknown): void };  // app.load/saveLocalStorage
  now(): number;
}
export class HistoryStore {
  readonly device: string;
  /** The merged view every reader uses; the same object until something changes. */
  view(): History;
  /** This device's section: the only history the goals tracker writes (applyDelta, recordBookTotal). */
  own(): History;
  /** After writing into own(): rebuild the view, notify, and ask for a save. */
  changed(): void;
  rename(oldPath: string, newPath: string): boolean;
  onChange(cb: () => void): () => void;
  /** Merge a freshly read data.json (load, external change, a newer mtime). */
  absorb(raw: unknown): void;
  /** The `history`, `devices` and `renames` to write, merged with what is on disk now. */
  toSave(disk: unknown): { history: History; devices: Record<string, History>; renames: Rename[] };
}
```

`main.ts` owns the load, the serialized persist (read, `toSave`, write, remember the mtime, write
the backup), the reload triggers and applying reloaded settings. `EscritaData` gains `devices` and
`renames`; `history` keeps its meaning as the base.

## Tasks

Every task: Sonnet, narrow file ownership, the four checks (`npm run typecheck`, `npm test`,
`npm run build`, `npm run test:bundle`) under `flock <scratchpad>/heavy.lock`, single test files
while iterating, file:line evidence in the report. A task that meets an architecture choice not
decided here stops and hands it to the judge.

- **T1, pure core.** `src/core/device-history.ts` and `tests/device-history.test.ts`; `DayBook.at`
  in `src/data.ts`; `applyDelta`/`recordBookTotal` set `at` (an injected `now`, default
  `Date.now`) in `src/goals/tracker.ts`. Done when: merge sums, newest total wins, `maxHistory` is
  idempotent and commutative, renames apply in order, malformed input is cleaned, and the
  existing goals tests pass.
- **T2, the store and persistence** (after T1). `src/core/history-store.ts`, `src/main.ts`
  (`loadAll`, `persist`, `onExternalSettingsChange`, focus/visibility/minute checks, settings
  reload), `src/data.ts` (`devices`, `renames`), `tests/history-store.test.ts`,
  `tests/support/fake-plugin.ts` (a `history` store and localStorage). Includes a **two-device
  test**: two stores sharing a fake `data.json` that a fake sync copies between them, covering
  the same day on both, a stale copy winning, a closed device reopening (the backup), a rename
  while one device is closed, and settings changed on one device reaching the other.
- **T3, goals on the store** (after T2). `src/goals/index.ts`, `src/goals/progress-modal.ts`,
  `src/goals/settings-ui.ts` and their tests read `plugin.history.view()` and write through
  `own()` + `changed()`; the rename follower calls `plugin.history.rename`; a history change from
  a reload repaints the status bar, the modal and the daily-progress port.
- **T4, docs** (parallel with T2 and T3). README 1.2.3 entry (a Fix bullet for the shared streak,
  an upgrade note: rollback reads only the base), guide en and pt-BR "Writing on more than one
  device" under the goals section (which sync settings carry `data.json`: Obsidian Sync's
  "Installed community plugins", Git with `data.json` committed, Syncthing/Dropbox/iCloud with
  `.obsidian`, Remotely Save/LiveSync with the config folder option), ARCHITECTURE (the store, the
  data shape, D5–D8), ROADMAP row, IMPROVEMENTS known issue for D6's other keys. pt-BR is
  Brazilian.
- **Judge (Opus)** verifies against this plan, runs the four checks, fixes small things.
- **Advisor (Fable)** verifies everything independently: the counter fixes, improvement 48, the
  shared history, data safety (no path loses a recorded day), and the docs.

## Risks

- A git text conflict in `data.json` when both devices save before a pull still needs a manual
  merge; after it, the read-before-write and the backup put every device's words back.
- Two devices saving within the same moment through a file sync: the loser's section comes back
  on its next save (memory) or its next load (backup).
- `data.json` grows by one section per device; a few KB per year of daily writing.
- Mobile reload triggers can't be tested here (waived); worst case the phone shows the merged
  count after its next save or focus.

## Not in this plan

- Syncing the other data keys (D6). Listed as a known issue.
- A UI listing devices or merging them by hand (rule 3).
