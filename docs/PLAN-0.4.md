# Escrita 0.4, "the writing desk": implementation plan

This is the implementation plan for Escrita 0.4, generated 2026-10-01. It breaks
the release into waves of tasks that agents can run in parallel, with strict file
ownership per wave. The specs win on any disagreement: `docs/ROADMAP-short-fiction.md`
§8 (move a paragraph or scene) and §11 (stages, the stage snapshot, the home block,
where you left off), and `docs/IMPROVEMENTS.md` §2 (the reusable vault index). If
this plan and a spec disagree, fix this plan.

File:line references point at the working tree on 2026-10-01.

## Open questions, with recommended answers

The author answers these in gate G2 (see "Gates"). Each has a recommended answer;
agents build to the recommendation unless the author says otherwise.

| # | Question | Recommendation |
|---|---|---|
| Q1 | Does a book note need `tracked` to be a work? | **Yes, require `tracked`.** `excludeFolders` (Arquivo, Modelos) is already the "leave alone" signal. The author's `Romances` is in `trackFolders`, so their books still count. One rule for every work. |
| Q2 | Should the migration infer the idea, draft and revision words from the order of the five color lines? | **Yes, under strict conditions** (task 1.2): exactly 5 lines, line 4 = ready word, line 5 = published word, lines 1–3 match no stage, and idea, draft and revision still have their default words. Without it, the author's `ideia`, `rascunho` and `revisão` would not be works. |
| Q3 | Stage words as one lineList string or as `string[]`? | **One string** (`"revisão, revisando"`), split by `lineList` (core/lists.ts:4), the same as trackFolders. The first word is the one Escrita writes. |
| Q4 | Keep the legacy keys in data.json? Save right after migrating? | **Keep them** (mergeDefaults keeps unknown keys, core/merge.ts:12, so a downgrade still works). **Don't save on load**: the migration is idempotent and keys off `stages` being present. |
| Q5 | Where do colors live? | In each `StageSetting {words, color}`, plus one `otherStatusColors` textarea for chapter-only statuses (outline dots) and for legacy colors the picker can't show (Q35). |
| Q6 | Does `readStatus` accept a YAML list (`status: [rascunho]`)? | **No** in 0.4: string or number only, as `isPublished` does today (publish/checks.ts:78-82). |
| Q7 | What counts as "sem estágio"? | **Tracked notes and tracked book notes whose status is non-empty and unknown.** A note with no status is not a work and is not counted. |
| Q8 | Where does a chapter's stage come from (for "N of M chapters ready")? | **`stageOf(chapter status)`, computed in `core/works.ts`.** `classify().stage` stays null for chapters (chapters are never works); no new Placement field for it. |
| Q9 | How is left-off keyed? | **By the edited file:** a standalone work note, or a chapter whose book note is a work. A book's spot is its chapter record with the newest `at`. Values never hold paths, so `renameKeys` covers everything. |
| Q10 | Where does the last known stage for stage snapshots live? | **In memory** (`StageWatch`, task 2.8). Every `build` batch re-seeds it from the **full** works list, never from the change array, and skips paths with a pending settle timer. A status changed while Obsidian was closed is not snapshotted; document this. |
| Q11 | When is a stage snapshot taken? | Only **known stage → different known stage**. A null stage keeps the last known one, so `draft → "" → revision` gives one snapshot. An update to "not a work" (no status, broken YAML while typing) is ignored, not forgotten. Changes settle per path for 3000 ms. Becoming a work takes none. Startup, renames and settings changes take none. |
| Q12 | Snapshot name? | **The canonical (first) words**: "rascunho → revisão". Store the ids in a new `stage: {from, to}` entry field. |
| Q13 | What does a book note's stage change snapshot? | **The book note plus every chapter** (`books.chapters`), all with the same name. |
| Q14 | Visible signal for a stage snapshot? | **None** (silent, like the other automatic kinds). |
| Q15 | Should the measurer, the explorer's tracked set and first pass, and the snapshots store move onto the vault index in 0.4? | **No.** Measurer and explorer wait for 0.5. The snapshots store never moves into an index (it moves real folders). |
| Q16 | Content-mode modify: debounced or immediate? | **Debounced 300 ms**; rename and delete stay immediate. Placeholder dots, view and outline badges will lag about 300 ms. |
| Q17 | Should followers (publish, dialogue focus, history, leftOff, homeNote) register through `plugin.index.follow`? | **Yes**, so "path-keyed data follows renames in one place" is true at release. |
| Q18 | Desk structural recompute: full or incremental? | **Full, debounced (≥300 ms)**, skipping snapshot paths. |
| Q19 | Where does MemoryVault live? | `tests/support/memory-vault.ts` (tsconfig already includes tests/**). |
| Q20 | Order of lines in a section? | **Most recently edited first** (left-off `at`; for a book, the newest of its chapters), then title (`localeCompare`). The same order applies to the items of an expanded count. |
| Q21 | Fact for a note in revision, and for a limit-only piece? | Same length fact as draft: count / target, else count / limit, else count alone, plus deadline. |
| Q22 | Book in revision with 0 chapters? | Show the words fact. A click opens the book note itself (first unwritten beat, else the end). |
| Q23 | Show states by color? | **Decided: color on the number only**, no badge. Green when the target is reached; coral for the part over the limit and for a past deadline (approved on the canvas, artboard 5, 2026-10-01). Light theme uses darker tones of the same two colors, from theme variables where Obsidian has them. |
| Q24 | Count labels: stage names or the writer's words? | **Localized stage names with `plural()`.** Code reads the stage, never the word. |
| Q25 | Where to land on an unwritten beat? | At the start of the line after the beat; at the end of the beat line when it is the last line. |
| Q26 | Record edits to the book note itself? | **No.** A book opens a chapter. |
| Q27 | Home note missing on startup? | **Silent.** The command offers to create it: `Home.md`, or `Inicio.md` (no accent) when the language is pt-BR (decided 2026-10-01). If that note exists while the setting is empty, adopt it and never overwrite it. A setting without `.md` gets `.md` appended. For the author: `homeNote: "Início.md"` (release step). |
| Q28 | Shared helpers? | Lift `fmtShortDay` (goals/format.ts:10-17) to `src/i18n.ts` (goals re-exports it). Pure desk code takes the day formatter injected. Copy a small confirm modal into desk instead of importing outline/modals.ts. |
| Q29 | Move: units next to a paragraph? Crossing scene breaks? Edges? | A paragraph **steps over** a unit (a beat, code, a comment, math) or a break as one atomic neighbour. A cursor inside a unit refuses (`inUnit`). A paragraph **crosses scene breaks**, except the trailing break with nothing after it, which is a wall. At an edge, **silent**; a Notice for properties, noBlock, inUnit and unsafe. |
| Q30 | Move: selection, headings, scope, names? | A selection over several blocks moves them as **one group**; only the main cursor is used. **Headings are movable blocks.** It works in **every Markdown note**. Names: "Move paragraph up/down" / "Mover parágrafo para cima/baixo", "Move scene up/down" / "Mover cena para cima/baixo". |
| Q31 | Move: a glued beat (`%% beat %%\nProse`)? | It travels with its prose: in blank style a glued run (no blank line or break inside) is one block, so stepping over it never merges two paragraphs. A cursor on the beat line itself refuses. Swaps are checked against the block partition (pinned by round-trip tests). |
| Q32 | How does Move reach the editor? | **Public API only.** `editor.transaction({changes, selection})` is one dispatch and one undo step; darlings/index.ts:263-266 already does this. No private `editor.cm`, no new guideline exception. |
| Q33 | A tracked book note with a set but unknown status? | **Role `unstaged`**, counted under "sem estágio", the same as notes. |
| Q34 | Two legacy values equal (`publishedValue == unpublishedValue`)? | **Keep ready at its default word**, so `isPublished` keeps working as in 0.3. |
| Q35 | Legacy colors the picker can't show (`red`, `#rrggbbaa`)? | **`#rgb` expands to `#rrggbb`.** Any other non-`#rrggbb` color stays out of the stage row and moves, line verbatim, to `otherStatusColors`, which `statusColor` falls back to. Nothing set is lost. |

## Scope

0.4 ships four things:

- **Stages.** A stage mapping setting replaces `publishedValue`, `unpublishedValue`
  and `statusColors`. A data.json migration carries the old values over.
  `classify().stage` is new and is the one place the stage rule for works lives.
- **The stage snapshot.** An automatic snapshot, never pruned, named like
  "rascunho → revisão".
- **The home block.** An `escrita-works` code block, "where you left off", a "home
  note" command and "open on startup", in a new `src/desk/` module.
- **Move a paragraph or scene up or down.** Four commands (SF 8).

The improvement is IMPROVEMENTS §2, a reusable vault index (`plugin.index`) with
shared path-key upkeep. It feeds the live works list (`plugin.works`), the
stage-change signal and the left-off records.

The author's vault settings (`~/projects/website/escrita/.obsidian/plugins/escrita/data.json`)
that matter here:

- `trackFolders`: `Contos`, `Textos`, `Romances`, `Ideias`
- `excludeFolders`: `Modelos`, `Arquivo`
- `chaptersFolder`: `Capítulos`
- `statusProperty`: `status`
- `publishedValue`: `publicado`; `unpublishedValue`: `pronto`
- `statusColors`: five lines, `ideia` / `rascunho` / `revisão` / `pronto` / `publicado`
- `paragraphStyle`: `single`
- The vault already has a home note, `Início.md` (quick links and `![[Painel.base]]`).

## Gates (before building)

**G1. Design canvas mockups** (rule 7), on
https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6. The author approves them before
the gated tasks start: G1a gates 5.5, G1b gates 5.8. Nothing else waits on them.

- **G1a. Home block. Approved 2026-10-01** (canvas artboards 4–7): dotted leaders, color on the number for states (Q23), the empty-vault line naming the stage words from settings, `Inicio.md` in pt-BR. Task 5.5 builds to those artboards. The mockup shows:
  - the block inside a note with prose above and below, in Reading view and Live
    Preview;
  - light and dark themes, a 400px pane and a 375px phone;
  - headings "Escrevendo" / "Revisando" ("Writing" / "Revising");
  - line variants:
    - a note with a target and deadline ("O porão … 4.210 / 5.000 · prazo 15 out");
    - a note with no target;
    - a piece counted in characters;
    - a limit-only piece;
    - a book in draft (words / goal + deadline);
    - a book in revision ("7 de 12 capítulos prontos");
  - long titles;
  - target reached, over the limit and past deadline, with no badge (and a decision
    on whether color is allowed);
  - the counts line "4 ideias · 1 pronto · 6 publicados · 3 sem estágio" with zero
    counts left out, and one count expanded (its list of works) and then collapsed;
  - hover, focus-visible and touch targets of at least 32px;
  - empty states: no works, and a `folder:` that matches nothing;
  - the "Create Home.md?" confirm (`Inicio.md` in pt-BR);
  - a note that clicking never puts the cursor into the block and landing shows no
    highlight.
- **G1b. Stages settings section. Drafted 2026-10-01 from the recommendations** (canvas
  artboard 8; the author asked to build to the defaults): a "Stages" heading with one
  description; each row is the localized stage name, a words text field (comma
  separated), a 32px color swatch, and a 32px × button that clears the color (hidden
  when there is no color; an empty swatch has a dashed border). A duplicate word shows
  `escrita-setting-warning` under the row ("\"pronto\" is in Revision and Ready. The
  first one wins: Revision.") and never blocks saving. "Other status colors" is a
  monospace textarea, `word: color` per line. A "Home note" heading holds the
  home note path and the "Open on startup" toggle. On mobile the controls wrap under
  the name with 40px targets. Task 5.8 builds to this.
- **G1b (original brief).** Five rows (a words text field plus a color
  picker; this is the first color picker in the codebase, so the row needs a way to
  clear a color). It also shows:
  - the duplicate-word warning;
  - the "Other status colors" textarea;
  - the two home rows ("Home note" / "Nota inicial", "Open on startup" / "Abrir ao
    iniciar", with text saying it replaces the restored active tab);
  - light, dark and mobile.
- **Move (SF 8) needs no mockup.** It adds only commands and notices. The author
  confirms this in G2.

**G2. Author decisions.** The questions at the top of this file.

## Ownership rules

- No two tasks in a wave touch the same file.
- Shared core files (`src/core/*`, `main.ts`, `settings.ts`, `data.ts`, `strings.ts`,
  `i18n.ts`) change only in tasks marked **[core]**. Each new core file is owned by
  one task per wave.
- A task may import a type or stub that wave 0 created; it may not import anything a
  task in its own wave creates.
- Every task runs `npm run typecheck && npm test` before calling itself done.

## Wave 0: contracts

**0.1 [core] Types and stubs**, one agent, effort S. It writes the types below and
`throw new Error("todo")` stubs for functions that later tasks fill in. It changes no
behaviour. Done when typecheck and the existing tests pass.

Files: create `src/core/stages.ts`, `src/core/vault-index.ts`, `src/core/works.ts`,
`src/core/left-off.ts`, `src/desk/open.ts`; change `src/core/classify.ts` (the field
only), `src/settings.ts` and `src/data.ts` (additive fields only), `src/main.ts`
(field declarations only).

`src/core/stages.ts`:

```ts
export const STAGES = ["idea", "draft", "revision", "ready", "published"] as const;
export type Stage = typeof STAGES[number];
export interface StageSetting { words: string; color: string }  // color: "" or "#rrggbb"
export type StageMapping = Record<Stage, StageSetting>;
export const DEFAULT_STAGES: StageMapping;  // words = id; colors from settings.ts:99
export const DEFAULT_STATUS_PROPERTY = "status";
```

`src/core/vault-index.ts`:

```ts
export interface IndexFile { path: string; extension: string }
export interface IndexSource<F extends IndexFile> {
  files(): F[];
  file(path: string): F | null;
  read(f: F): Promise<string>;
}
export interface IndexTimers {
  set(cb: () => void, ms: number): unknown;
  clear(h: unknown): void;
  yieldNow(): Promise<void>;
}
/**
 * 'delete' only for a vault delete event. A live file whose compute returns
 * undefined, or that leaves `include`, emits 'update' with `after: undefined`.
 * A structural recompute emits 'update' for changed values only.
 * A build (first build or settings rebuild) emits 'build' for EVERY entry,
 * `same()` notwithstanding.
 */
export type IndexCause = "build" | "update" | "rename" | "delete";
export interface IndexChange<V> {
  path: string;
  from?: string;   // set for 'rename'
  before?: V;
  after?: V;
  cause: IndexCause;
}
export interface IndexSpec<F extends IndexFile, V> {
  name: string;
  mode: "content" | "metadata";
  include(f: F): boolean;
  compute(f: F, text: string | null): V | undefined;  // text is null in metadata mode
  same(a: V, b: V): boolean;
  structural?: boolean;
  settingsKey?(): string;
}
export interface Follower {
  moved?(oldPath: string, newPath: string): void;
  deleted?(path: string): void;
}
```

`src/core/classify.ts`: `Placement` gains `stage: Stage | null`, set to `null`
everywhere. Task 2.3 fills in the rule.

`src/core/works.ts`:

```ts
export type DeskRole = "book" | "note" | "chapter" | "unstaged";
export interface DeskEntry {
  role: DeskRole;
  stage: Stage | null;
  title: string;
  book?: string;        // book note path, for chapters
  target?: number;
  limit?: number;
  unit?: PieceUnit;
  deadline?: string;
  goal?: number;
}
export interface WorksReader {
  get(path: string): DeskEntry | undefined;
  list(): Iterable<[string, DeskEntry]>;
  isReady(): boolean;
  onReady(cb: () => void): () => void;
  onChange(cb: (c: readonly IndexChange<DeskEntry>[]) => void): () => void;
}
```

`src/core/left-off.ts`:

```ts
export interface LeftOff { offset: number; before: string; after: string; at: number }
export interface LeftOffEvents { onChange(cb: (paths: readonly string[]) => void): () => void }
```

`src/desk/open.ts`:

```ts
export function openWork(plugin: EscritaPlugin, path: string, newTab: boolean): Promise<void>;
```

Additive fields (legacy fields stay until 3.1):

- `EscritaSettings`: `stages: StageMapping` (default `DEFAULT_STAGES`),
  `otherStatusColors: string` (""), `homeNote: string` (""),
  `openHomeOnStartup: boolean` (false).
- `EscritaData.leftOff: Record<string, LeftOff>` (default `{}`).
- Plugin fields: `index!: VaultIndexes` (type-only import) and `works!: WorksReader`.
  `VaultIndexes` is declared here as an interface: `add(spec): VaultIndex<F, V>` (returns the index, so 4.1 and 5.1 can use get/list/onReady/onChange), `follow(f: Follower)`,
  `rebuild(name?)`, `settingsChanged()`, `unload()`.

## Wave 1: pure foundations (parallel)

**1.1 [core] Path-key helpers** (IDX-1), effort S
- Create `src/core/path-keys.ts` (no obsidian import) and `tests/path-keys.test.ts`.
- Functions:
  ```ts
  movedPath(key: string, oldPath: string, newPath: string): string | null
  isUnder(key: string, path: string): boolean
  renameKeys<T>(rec: Record<string, T>, oldPath: string, newPath: string, merge?: (moved: T, existing: T) => T): boolean
  dropKeys<T>(rec: Record<string, T>, path: string): boolean
  renameInMap<T>(m: Map<string, T>, o: string, n: string, merge?: (moved: T, existing: T) => T): boolean
  dropFromMap<T>(m: Map<string, T>, p: string): boolean
  renameInSet(s: Set<string>, o: string, n: string): boolean
  dropFromSet(s: Set<string>, p: string): boolean
  ```
- Rules:
  - A key matches when it equals the path or sits under `path + "/"`.
  - `""` is a no-op.
  - Keys are compared byte for byte, never through normalizePath (core/books.ts:28 rule).
  - Every function is idempotent when per-child events follow a folder event.
  - By default the moved value wins a collision.
- Tests: exact rename; folder-prefix rename; a sibling `Contos/A` vs `Contos/AB` is
  untouched; folder event then child events is a no-op; child events only give the
  same result; merge on collision (sum, newest wins); the root `""` guard; NFD and
  U+00A0 keys kept byte for byte; drop exact plus prefix; return values; Set and Map
  variants, including a folder delete in a Set (the dialogue-focus case).

**1.2 [core] Stages and migration** (S1 + S2), effort S
- Fill `src/core/stages.ts`; create `src/core/migrate.ts` and `tests/core-stages.test.ts`.
- Functions:
  ```ts
  stageOf(status: unknown, stages: StageMapping): Stage | null   // NFC, trim, lowercase; string|number; first stage in STAGES order wins a tie
  stageWords(stages: StageMapping, stage: Stage): string[]
  writtenWord(stages: StageMapping, stage: Stage): string        // first word, else the stage id
  readStatus(fm: unknown, statusProperty: string): string | null
  stageRank(stage: Stage): number
  atLeast(stage: Stage | null, min: Stage): boolean
  parseStatusColors(s: string): Record<string, string>           // moved unchanged from settings.ts:148-155
  parseStatusColorLines(s: string): { value: string | null; color: string | null; raw: string }[]
  statusColor(status: unknown, stages: StageMapping, otherStatusColors: string): string | undefined  // stage color if set, else the otherStatusColors entry for the word
  stageConflicts(stages: StageMapping): { word: string; stages: Stage[] }[]
  normalizeStages(v: unknown): StageMapping   // ALWAYS a fresh deep copy; array or non-record gives the defaults; empty words get the default word; color kept only if "" or #rrggbb (#rgb expanded)
  migrateSettings(raw: unknown): unknown      // idempotent; returns the input untouched if raw.stages is a record
  migrateStages(legacy: unknown): { stages: StageMapping; otherStatusColors: string }
  ```
  `stageOf` caches a word map per `StageMapping` object (a WeakMap), since classify
  calls it for every file.
- Migration rules:
  - `publishedValue` becomes published.words; `unpublishedValue` becomes ready.words,
    unless it equals `publishedValue` after NFC, trim and lowercase; then ready keeps
    its default word (Q34).
  - Colors are matched by value first, then by the positional rule (Q2).
  - `#rgb` expands to `#rrggbb`. Any other color that is not `#rrggbb` (named,
    alpha) is not put on the stage; its line goes verbatim into `otherStatusColors`
    (Q35).
  - Unused lines (including unparsable ones) go verbatim into `otherStatusColors`.
  - The legacy keys stay; the input is never mutated.
- Tests, stages: every case in report S1, including NFD "revisão"; several words,
  and writtenWord; conflicts; `atLeast`; `statusColor` fallback to
  `otherStatusColors`; `normalizeStages` never returns its input or `DEFAULT_STAGES`
  (identity checked).
- Tests, migration:
  - defaults give DEFAULT_STAGES;
  - **the author's real settings give idea=ideia, draft=rascunho, revision=revisão,
    ready=pronto, published=publicado** with their colors and `otherStatusColors ""`;
  - `publishedValue "done"`;
  - `publishedValue == unpublishedValue` keeps ready at its default;
  - `ideia = red` and `ideia = #abc`: red survives the pipeline in
    `otherStatusColors` and still colors `ideia` through `statusColor`; `#abc`
    becomes `#aabbcc` on the stage;
  - unmatched and unparsable lines are kept;
  - idempotence; a never-loses-a-value property test; non-record input; no mutation;
  - the positional rule does not fire with 4 or 6 lines;
  - a pipeline test `normalizeStages(mergeDefaults(...migrateSettings(authorRaw)))`
    where the legacy keys survive.

**1.3 [core] Shared anchor rule** (D1), effort S
- Create `src/core/anchor.ts` and `tests/anchor.test.ts`. Change `src/darlings/format.ts`.
- Move `CONTEXT` (format.ts:44), `STEPS`, `MIN_ALONE`, `uniqueIndex` and
  `findRestoreOffset` (format.ts:299-350) byte for byte.
- Add `contextAt(text: string, offset: number, size = CONTEXT): { offset: number; before: string; after: string }`,
  sliced the same way as format.ts:286-287.
- darlings/format.ts re-exports them, so darlings/index.ts:12 is unchanged.
- Tests: contextAt clamps at 0 and at the end; CRLF; identity (the same function
  object is reachable through darlings/format); tests/darlings.test.ts stays green.

**1.4 [core] Marker predicates** (T1), effort XS
- Change `src/core/markers.ts` and `src/editor/enter-flow.ts`; add tests to
  `tests/core.test.ts`.
- New exports, matching today's enter-flow code exactly:
  ```ts
  isBeatLine(md: Markdown, i: number): boolean   // wraps private beatAt (markers.ts:80)
  isSceneBreakAt(md: Markdown, i: number, body = md.bodyLine): boolean
  // = i >= body && isSceneBreakLine(md, i) && (i === body || isEmptyLine(line i-1))
  ```
- The private `isSceneBreakAt` in enter-flow.ts:81-84 delegates to the new one.
- Tests: the isBeatLine and isSceneBreakAt cases from report T1, plus a case with
  `i < body`. tests/editor.test.ts passes unchanged.

**1.5 Snapshot stage kind** (SS1), effort S
- Change `src/snapshots/index-format.ts`, `store.ts`, `retention.ts` (comment only)
  and `strings.ts`, plus `tests/snapshots-index.test.ts`, `-retention.test.ts` and
  `-store.test.ts`.
- index-format.ts: add `"stage"` to `SnapshotKind` and `KINDS`
  (index-format.ts:11-13), **not** to `AUTO_KINDS` (index-format.ts:16); add an
  optional `stage?: {from: string; to: string}` to SnapshotEntry, parsed in
  `entryFrom` (index-format.ts:56-74).
- store.ts:
  - `TakeOptions.stage`;
  - `take` keeps the name for kind stage (store.ts:239);
  - the identical rule for kind stage:
    1. if the latest snapshot is identical and AUTO, promote it in place
       (store.ts:225-232 path);
    2. else, if a manual or stage entry is identical (sameText gate, then a read),
       return unchanged;
    3. else write.
  - `rename` (store.ts:277) sets kind manual only for AUTO kinds.
- Strings: `snapshots.kind.stage` ("Stage change" / "Mudança de estágio").
- Tests: round trip of the kind and of the field; a malformed field is dropped; stage
  entries are never pruned with keepAuto=1; file name
  "2026-09-30 1001 rascunho → revisão.txt"; an identical daily is promoted; an
  identical older manual writes nothing; renaming keeps the kind; add `stage` to the
  `labels` record in the store test.

## Wave 2: pure models (parallel)

**2.1 [core] Generic VaultIndex + MemoryVault** (IDX-3), depends on 1.1, effort M
- Fill `src/core/vault-index.ts`; create `tests/support/memory-vault.ts` and
  `tests/vault-index.test.ts`.
- `class VaultIndex<F, V>`: build, created, modified, metadataChanged, renamed,
  deleted, structureChanged, get, entries, paths, size, isReady, onReady, onChange,
  dispose.
- MemoryVault can emit a folder rename in two modes: folder event only, and folder
  event followed by child events.
- Behaviour carried over:
  - From placeholders/index.ts:25-36 and 175-253: the generation counter,
    touched-during-build, per-path tickets, and ready even when the build finds
    nothing.
  - From measurer.ts:159-178: the debounced dirty set (settleMs 300).
  - Rename and delete applied immediately through path-keys.
  - Injected `yieldNow` and `onError`.
- Change causes follow the `IndexCause` contract in wave 0.
- Tests: batching; a stale build stops; an event during the build wins; debounce and
  out-of-order reads; rename, with folder-only and folder-then-children giving the
  same map and no duplicate changes; leaving scope (emits `update` with
  `after: undefined`); compute turning undefined on a live file emits `update`, never
  `delete`; deleting a folder or a dirty path; metadata and structural modes;
  `same()` suppresses no-op updates but not build changes (every entry is emitted on
  a build); dispose.

**2.2 Path-key followers, still on vault.on** (IDX-2), depends on 1.1, effort S
- Change `src/publish/index.ts` (renamed and deleted, publish/index.ts:215-246 →
  renameKeys and dropKeys).
- Change `src/editor/index.ts` (dialogueOn, editor/index.ts:92-104 → renameInSet and
  dropFromSet; this fixes folder delete).
- Change `src/goals/tracker.ts`: `renameBook` (tracker.ts:76-91) loops the days with
  `renameKeys(..., sumDayBook)`; extract `sumDayBook(moved, existing): DayBook`;
  `ActiveFiles` (tracker.ts:305-315) uses the helpers.
- Change `src/goals/index.ts`: drop the `TFile && md` guard at goals/index.ts:207 so
  history moves by folder prefix.
- Tests, in tests/goals.test.ts: a folder renameBook moves every piece key under it;
  a replay of the child events doesn't sum twice. The existing publish and goals tests
  pass. (The dialogue-focus handler imports obsidian; its folder delete is covered by
  1.1's Set tests and manual check 35.)

**2.3 [core] classify().stage** (S4), depends on 1.2, effort S
- Change `src/core/classify.ts` and `tests/classify.test.ts`; touch only the doc
  comment in `src/core/books.ts`.
- `ClassifySettings` (classify.ts:34-44) gains optional `statusProperty?` and
  `stages?`. When absent, use `DEFAULT_STATUS_PROPERTY` and `DEFAULT_STAGES`.
- Read frontmatter once and share it between `readPiece` and `readStatus`.
- The stage is set only for `book-note && tracked` (Q1) and `note && tracked`.
  Chapters, book files, snapshots and folders get null.
- This is the only stage rule for works. The works index (2.5, 4.1) reads `p.stage`.
- Tests: a new `describe("stage")` with every case in S4, plus the MATRIX invariant
  that stage is null unless kind is book-note or note.

**2.4 Move blocks** (T2, first half), depends on 1.4, effort S
- Create `src/editor/move-blocks.ts` and `tests/editor-move-blocks.test.ts`.
- Types and functions (no obsidian or CodeMirror imports):
  ```ts
  export interface Block { from: number; to: number; kind: "paragraph" | "heading" | "unit" | "break" | "scene" }
  export interface Sel { anchor: number; head: number }
  export type MoveDir = "up" | "down";
  export type MoveRefusal = { refused: "properties" | "noBlock" | "inUnit" | "edge" };
  export type MoveResult = MoveRefusal | { refused: "unsafe" } | { change: { from: number; to: number; insert: string }; selection: Sel };
  paragraphBlocks(md: Markdown, style: ParagraphStyle): Block[]
  sceneBlocks(md: Markdown): Block[]
  groupAt(blocks: Block[], sel: Sel, mode: "paragraph" | "scene"): { i: number; j: number } | MoveRefusal
  ```
- Tests: the block-model and grouping cases from report T2 (units, breaks, headings,
  the trailing-break wall, selections over several blocks, LF and CRLF, `single` and
  `blank` style).

**2.5 [core] Works entry** (IDX-6, pure half), effort S
- Fill `src/core/works.ts`; create `tests/works.test.ts`. Imports only wave 0 types
  and 1.2.
- Functions:
  ```ts
  deskEntry(
    p: { kind: string; tracked: boolean; snapshot: boolean; piece: Piece | null; stage: Stage | null; bookNotePath?: string; title: string },
    status: unknown,
    stageOf: (s: unknown) => Stage | null,
    bookGoal?: number,
  ): DeskEntry | undefined
  sameDeskEntry(a: DeskEntry, b: DeskEntry): boolean
  bookChapterProgress(entries: Iterable<[string, DeskEntry]>, bookNotePath: string, min: Stage): { done: number; total: number }
  ```
- Rules:
  - Book notes and notes take `p.stage` (from classify). The raw status is read only
    to tell `unstaged` apart: tracked, stage null, status non-empty (Q7, Q33).
  - A chapter gets role `chapter` with `stageOf(its status)` (Q8).
  - A tracked note with no status, an untracked note and a snapshot give undefined.
- Grouping and presentation live in desk (2.6).
- Tests: deskEntry for every kind (book note known and unknown status, tracked note
  known, unknown and without a status, untracked, snapshot, chapter tracked and
  untracked, chapter template); bookChapterProgress ready-or-later.

**2.6 Desk pure model** (D3), effort M
- Create `src/desk/works.ts`, `src/desk/block.ts`, `tests/desk-works.test.ts` and
  `tests/desk-block.test.ts`. No obsidian imports.
- Types and functions:
  ```ts
  interface WorkSource { path: string; role: DeskRole; stage: Stage | "none"; title: string; count: number; unit: PieceUnit; target?: number; limit?: number; deadline?: string; goal?: number; chapters?: { done: number; total: number }; editedAt: number }
  interface WorkLine { path: string; title: string; fact: Fact }
  interface DeskModel {
    writing: WorkLine[];
    revising: WorkLine[];
    counts: { stage: Stage | "none"; n: number; items: WorkLine[] }[];  // zero counts left out
  }
  interface FactLabels { day(iso: string): string; of(n: number, total: number): string; chaptersReady(done: number, total: number): string; /* … */ }
  buildDesk(works: readonly WorkSource[]): DeskModel
  factOf(w: WorkSource): Fact
  filterByFolders(works: readonly WorkSource[], folders: string[], bookFolderOf: (path: string) => string | null): WorkSource[]
  factText(f: Fact, labels: FactLabels): string
  parseBlock(source: string): { folders: string[] }
  ```
- Rules: only draft and revision get lines; lines and count items follow Q20; counts
  cover idea, ready, published and none; facts follow Q21 and Q22. The day format is
  injected through `FactLabels.day` (tests use a fake).
- Tests: every case in D3, count items and their order, and the block grammar
  (`Folder: /Contos/`, quoted names, `[[Contos]]`, several lines, CRLF).

**2.7 [core] Left-off logic** (IDX-7 + D4), depends on 1.3, effort M
- Fill `src/core/left-off.ts`; create `tests/left-off.test.ts`.
- All functions normalize text to LF (`/\r\n?/g`) before computing or matching
  offsets, so editor offsets and file offsets agree.
- Functions:
  ```ts
  makeLeftOff(text: string, offset: number, now: number, ctx = 48): LeftOff   // capped context keeps data.json small
  findLeftOff(text: string, e: LeftOff): number | null                        // fast exact check, then findRestoreOffset
  firstUnwrittenBeatOffset(text: string): number | null                      // lands per Q25
  noteSpot(text: string, e: LeftOff | null): { offset: number; via: "left-off" | "beat" | "end" }
  lastEditedChapter(rec: Record<string, LeftOff>, chapterPaths: readonly string[]): string | null
  bookTarget(chapterPaths: readonly string[], rec: Record<string, LeftOff>): { path: string; spot: LeftOff } | { scan: string[] } | null
  // record branch, else the ordered chapter list to scan for a beat; null when there are no chapters
  shouldRecord(role: DeskRole | null, bookRole: (bookNotePath: string) => DeskRole | null, bookNotePath?: string): boolean
  // note works, and chapters whose book note is a work
  newestLeftOff(moved: LeftOff, existing: LeftOff): LeftOff
  pruneMissing(rec: Record<string, LeftOff>, exists: (path: string) => boolean): boolean
  cleanLeftOff(raw: unknown): Record<string, LeftOff>   // keeps only well-typed entries: finite non-negative offset and at, string before/after
  ```
- Tests: the context is capped; an insertion before the spot is still found; lost or
  ambiguous context gives null and falls to the beat, then the end; a beat on the
  last line; beats in frontmatter and code are ignored; CRLF text and a context
  spanning a line break; bookTarget record, scan and null branches;
  lastEditedChapter; renameKeys with newestLeftOff on a collision; a folder rename
  moves the chapter keys; pruneMissing; cleanLeftOff drops NaN, negative, missing and
  wrongly typed fields.

**2.8 StageWatch** (SS2 + the routing from SS3), depends on 1.1 and 1.2, effort S–M
- Create `src/snapshots/stage-watch.ts` and `tests/snapshots-stage.test.ts`. No
  obsidian imports.
- Types and functions:
  ```ts
  export const STAGE_SETTLE_MS = 3000;
  class StageWatch {
    constructor(opts: {
      timers: IndexTimers;
      current: (path: string) => DeskEntry | undefined;   // works.get
      all: () => Iterable<[string, DeskEntry]>;           // works.list
      onTransition: (path: string, from: Stage, to: Stage) => void;
    });
    handle(changes: readonly IndexChange<DeskEntry>[]): void;
    dispose(): void;
  }
  transitionName(from: Stage, to: Stage, word: (s: Stage) => string): string  // `${word(from)} → ${word(to)}`
  stageTakeTargets<F>(note: F, role: DeskRole, chapters: readonly F[]): F[]
  ```
- Routing:
  - Any `build` change in a batch: re-seed from `all()` (the full list), skipping
    paths with a pending timer. Pending timers keep running.
  - `rename`: move the last-known stage and any pending timer (prefix-aware, via
    path-keys).
  - `delete`: forget the path and clear its timer.
  - `update` with `after` undefined: ignored (null keeps the last stage).
  - `update` for roles book and note: re-arm the per-path timer.
  - When a timer fires: read `current(path)?.stage`; if both the last known and the
    current stage are known and differ, call `onTransition`; then store the current
    stage if known. An unseeded path is recorded silently.
- Tests: every case in SS2; `draft → null → revision` gives one transition; a broken
  YAML window (update to undefined, then back) gives none; seed A and B, a rebuild
  where only A changes, then a B transition gives one snapshot; an update followed by
  a build within 3 s gives one transition; a rename during the settle window; the
  pt-BR name; an empty word falls back to the id.

**2.9 Desk home rule** (D8 pure), effort XS
- Create `src/desk/home.ts` and `tests/desk-home.test.ts`.
- Functions:
  ```ts
  homePath(setting: string): string   // trimmed; appends ".md" when it has no .md extension; "" stays ""
  homeAction(setting: string, exists: (p: string) => boolean): { kind: "open" | "adopt" | "offer"; path: string }
  HOME_TEMPLATE = "```escrita-works\n```\n"
  ```
- Tests: the four cases from D8, plus a setting without `.md` (`Escrita/Início`).

## Wave 3: core switch-over, the index hub, the move model (parallel)

**3.1 [core] Stages switch-over, data part** (S3 + S5 + S6 + the D2 data part),
depends on 1.2 and 2.7, effort M. Not gated on the mockups. One agent, one commit:
removing the old fields breaks outline and publish until the same commit.

- `src/settings.ts`:
  - remove `statusColors`, `publishedValue` and `unpublishedValue` from the interface
    and the defaults (settings.ts:17-19, 55-58, 99, 122-123), and delete the local
    `parseStatusColors`;
  - `normalizeSettings` (settings.ts:158-164): `s.stages = normalizeStages(s.stages)`
    (required, because mergeDefaults shares object defaults by reference,
    merge.ts:19); `statusProperty` trimmed, else `"status"`; `otherStatusColors` must
    be a string; `homeNote` trimmed;
  - UI: remove the color row (settings.ts:209-212) and the publish rows
    (settings.ts:303-312). The new rows come in 5.8.
- `src/strings.ts`: remove the old keys (strings.ts:15-16, 48-51, 113-114, 146-149);
  add `stage.idea|draft|revision|ready|published` in en and pt-BR; reword
  `settings.statusProperty.desc`.
- `src/i18n.ts`: lift `fmtShortDay`; `src/goals/format.ts` re-exports it.
- `src/main.ts` loadAll (main.ts:105-114):
  `normalizeSettings(mergeDefaults(DEFAULT_SETTINGS, migrateSettings(raw.settings)))`,
  and `leftOff = cleanLeftOff(raw.leftOff)`. No save on load.
- Publish:
  - `src/publish/checks.ts`: `isPublished(status, stages)` is `stageOf(...) === "published"`.
  - `src/publish/index.ts` (publish/index.ts:77-80, 95-97, 140-143, 178): writes
    `writtenWord(stages, "published")`; unpublish falls back to `previousStatus`, then
    `writtenWord(stages, "ready")`; the guard checks only `statusProperty`.
  - `src/publish/strings.ts`: reword `publish.noStatus`.
- Outline: `src/outline/view.ts:591-598` and `src/outline/index.ts:155` use
  `statusColor(...)`; drop the imports at view.ts:9 and index.ts:9.
- Tests: tests/publish.test.ts:47-50 rewritten for `isPublished(status, stages)` with
  the author's mapping; tests/outline.test.ts board colors through `statusColor`;
  tests/strings.test.ts parity.

**3.2 Move model** (T2, second half), depends on 2.4, effort S–M
- Create `src/editor/move.ts` and `tests/editor-move.test.ts`.
- Functions:
  ```ts
  swap(md: Markdown, blocks: Block[], group: { i: number; j: number }, dir: MoveDir, sel: Sel): MoveResult
  sameStructure(md: Markdown, change: { from: number; to: number; insert: string }, newText: string): boolean
  moveParagraph(md: Markdown, style: ParagraphStyle, sel: Sel, dir: MoveDir): MoveResult
  moveScene(md: Markdown, sel: Sel, dir: MoveDir): MoveResult
  ```
- Rules: the change is `{from: x0, to: y1, insert: Y + sep + X}`, so the separator
  stays put and the length is unchanged. `sameStructure` is the data-safety guard
  (html comment pairing, an unclosed `%%`, `---` becoming frontmatter, `$$` parity);
  a failure returns `unsafe`.
- Tests: the swap cases from report T2, the glued beat (Q31), and round-trip
  properties over a conto fixture in LF and CRLF, `single` and `blank` style (down
  n times then up n times gives the same bytes).

**3.3 [core] Index hub and Obsidian shell** (IDX-4 minus main.ts), depends on 2.1,
effort M
- Create `src/core/index-hub.ts` (pure, no obsidian import), `src/core/vault-indexes.ts`
  (thin shell) and `tests/vault-indexes.test.ts`.
- `IndexHub` takes an event source:
  ```ts
  interface HubEvents {
    onCreate(cb: (f: IndexFile) => void): void;
    onModify(cb: (f: IndexFile) => void): void;
    onDelete(cb: (f: IndexFile) => void): void;
    onRename(cb: (f: IndexFile, oldPath: string) => void): void;
    onMetaChanged(cb: (f: IndexFile) => void): void;
    onResolved(cb: () => void): void;
    onLayoutReady(cb: () => void): void;
    layoutReady(): boolean;
    hasCache(f: IndexFile): boolean;
  }
  ```
  and implements `add(spec)`, `follow(f: Follower)`, `rebuild(name?)`,
  `settingsChanged()`, `unload()`.
- Rules:
  - Dispatch order per event: every index first, then the followers.
  - Creates before layout ready are ignored (the build covers them).
  - `add(spec)` builds at once if layout is ready, else on layout ready.
  - A metadata index builds on layout ready when every included file has a cache
    entry; otherwise on the first `resolved`, with a fallback build after 5 s. This
    covers a mid-session enable or reload, where no `resolved` arrives until a file
    changes.
  - Structural indexes get `structureChanged` on create, delete or rename outside the
    snapshots root.
  - `settingsChanged()` is debounced (500 ms, trailing) and rebuilds only specs whose
    `settingsKey()` changed. The settings tab saves on every keystroke
    (settings.ts:178, 206).
- The shell registers once each of vault modify, delete, rename and create, plus
  metadataCache `changed` and `resolved`, all through `plugin.registerEvent`.
- Tests on MemoryVault: indexes before followers; creates before layout ready
  ignored; layout already ready at `add()`; already resolved before subscribe gives
  `isReady()` after layout ready; structural fan-out skips the snapshots root; a
  follower is called once per folder rename in both MemoryVault rename modes; ten
  `settingsChanged` calls in a burst give one build; only specs with a changed key
  rebuild.

## Wave 4: one wiring point (serial, one agent)

**4.1 [core] Works service**, depends on 2.3, 2.5, 3.1 and 3.3, effort S
- Create `src/core/works-index.ts`; add the structural test to `tests/works.test.ts`.
- `class WorksService implements WorksReader`, constructed with the plugin and the
  hub.
- The `desk` spec: mode metadata, structural; `include` is `.md` and not a snapshot;
  `compute` is `deskEntry(books.classify(f), books.frontmatter(f)[statusProperty], s => stageOf(s, stages), measure.bookGoal)`;
  `settingsKey` covers trackFolders, excludeFolders, chaptersFolder, chapterTemplate,
  snapshotsFolder, statusProperty, stages and the piece and goal properties.
- Test with MemoryVault plus VaultIndex: creating `F/Capítulos` turns F.md into a
  book (structural recompute).

**4.2 [core] Wire the index, works, followers and desk scaffold**, depends on 2.2 and
4.1, effort S
- `src/main.ts`: construct `index` right after `measure` (main.ts:62), keeping the
  order measure → index → followers → modules; construct `works`;
  `index.settingsChanged()` in saveSettings before the modules (main.ts:122-125);
  `index.unload()` after the modules in onunload (main.ts:97-103); construct
  `DeskModule` after publish, add it to `modules`, and register `deskStrings`.
- Move the follower registrations to `plugin.index.follow`: `src/publish/index.ts`
  (drop vault.on at publish/index.ts:57-58), `src/editor/index.ts` (dialogueOn) and
  `src/goals/index.ts` (onRename history and baseline).
- Create `src/desk/index.ts`, a `DeskModule` stub. load registers:
  - the leftOff follower: `renameKeys(data.leftOff, …, newestLeftOff)` / `dropKeys`,
    then requestSave; `pruneMissing` on layout ready;
  - the homeNote follower: `movedPath(settings.homeNote, old, new)`; if it moved, set
    it and save settings (folder renames included). A delete leaves the setting alone.
- Create `src/desk/strings.ts` with only the keys that don't depend on the mockup:
  `desk.cmd.openHome`, `desk.notice.missing`, `desk.confirm.*`. Create an empty
  `src/desk/styles.css`.
- `build-css.mjs` parts: add `src/desk/styles.css`. `tests/strings.test.ts`: add
  deskStrings.
- Done when all four checks pass and placeholders, publish, dialogue focus and goals
  behave as before.

## Wave 5: feature glue (parallel)

**5.1 Placeholders on the index** (IDX-5), depends on 4.2, effort S–M
- Change `src/placeholders/index.ts`, `src/placeholders/logic.ts` and
  `tests/placeholders.test.ts`; delete `src/placeholders/store.ts`.
- `placeholderSpec`: mode content; `include` is today's `indexable`
  (placeholders/index.ts:170-173); `compute` is `placeholderValue(text, marker)`;
  `same` is `sameMarkers`, moved to logic.ts; `settingsKey` is
  `[marker, excludeFolders, snapshotsFolder]`.
- Delete exactly: `BATCH` (17-18), `store` (21), `ready` (23),
  generation/building/touched/seq/nextSeq (25-36), the vault.on block (125-134), and
  rebuild/bump/reindex/forget/renamed (175-253).
- Keep: the class header, `extensions`, `loaded`, `lastMarker`/`lastExclude`/
  `lastSnapshots`/`lastDots`, `dotsSoon`, `undraw`, and settingsChanged's
  `workspace.updateOptions()` and dots logic (it calls `index.settingsChanged()`
  instead of `rebuild`). Move the "open views leave indexing" render (inside rebuild,
  about 199-205) to the index's `onReady`.
- Keep the facade (index.ts:49-82) unchanged.
- Tests: PlaceholderStore cases become `placeholderValue` and `sameMarkers` cases.

**5.2 Stage snapshot wiring** (SS3), depends on 1.5, 2.8 and 4.2, effort S
- Change `src/snapshots/index.ts`.
- Build a `StageWatch` with the plugin's timers, `works.get` and `works.list`;
  subscribe `works.onChange` → `watch.handle`, and seed on `works.onReady`.
- `onTransition` calls `takeStage`: targets come from `stageTakeTargets` plus
  `books.chapters`, taken one after another through `notes.text(f).read()` and
  `store.take(f, text, {kind: "stage", name: transitionName(..., s => writtenWord(stages, s)), stage, day, words})`.
  It re-resolves files by path first.
- Errors log with `console.error`, plus one Notice per session (`stageFailed`).
- `unload` disposes the watch. No new vault handler.

**5.3 Left-off recorder** (D5), depends on 2.7 and 4.2, effort M
- Create `src/desk/recorder.ts` and `tests/desk-recorder.test.ts`.
- `class LeftOffRecorder implements LeftOffEvents`:
  - `editor-change` captures the offset and context in memory (no I/O);
  - it commits on `active-leaf-change` and `file-open` (leaving a note),
    `layout-change` (a closed tab), `quit`, `document` `visibilitychange` to hidden
    (mobile backgrounding; through `registerDomEvent`), an idle timer of 30 s, and
    `unload`;
  - a commit applies `shouldRecord` and `makeLeftOff`, writes `data.leftOff[path]`,
    calls requestSave once per batch, and emits `onChange(paths)`;
  - the pending map follows renames.
- Pure function: `toCommit(pending, active, open: ReadonlySet<string>, all: boolean): string[]`.
- Tests: the toCommit cases.

**5.4 Opener** (D6), depends on 2.7 and 4.2, effort S
- Fill `src/desk/open.ts`.
- `openWork(plugin, path, newTab)`:
  - opens with `getLeaf(newTab ? "tab" : false).openFile(file, {active: true})`, with
    no eState;
  - a note: `noteSpot` on the opened editor's `getValue()`;
  - a book: `bookTarget(chapters, data.leftOff)`; the record branch opens that
    chapter and runs `noteSpot` on its editor text; the scan branch reads chapters one
    at a time (`notes.text(f).read()`), stops at the first with an unwritten beat, and
    falls back to the last chapter at its end; null (no chapters) opens the book note
    itself with `noteSpot(text, null)`;
  - then `setCursor`, `scrollIntoView({from, to}, true)` and `focus`;
  - in Reading view, convert the offset to a line on the LF-normalized text and call
    `previewMode.applyScroll(line)`;
  - a missing file shows a Notice.

**5.5 Block renderer** (D7), depends on G1a, 2.6 and 4.2, effort M
- Create `src/desk/render.ts` and `src/desk/gather.ts`; change `src/desk/styles.css`
  and `src/desk/strings.ts` (it adds the rendering keys: headings, `desk.count.*`
  plurals, `desk.fact.*`, `desk.empty*`). No other wave-5 task edits these files.
- `class DeskBlock extends MarkdownRenderChild`, constructed with the plugin and a
  `LeftOffEvents` source:
  - it re-renders, debounced 250 ms, on `works.onChange`, on `measure.onChange` and on
    the left-off `onChange`, each filtered to the shown paths and their chapters;
  - first paint, then a re-render on `works.onReady`;
  - it keeps `expanded: Set<Stage | "none">` and the focused element across
    re-renders.
- `gather.ts` builds `WorkSource[]`: stage and role from the works index; counts from
  `measure.note` and `measure.book`; chapter progress from `bookChapterProgress`;
  `editedAt` from leftOff. It passes `fmtShortDay` as `FactLabels.day`.
- DOM through createDiv, createEl and setText only. Lines and expanded items are
  `role=link` with `tabindex=0` and open with `openWork` (Mod-click: new tab). Counts
  are `role=button` with `aria-expanded`, toggled by click, Enter and Space.
- `mousedown` and `pointerdown` call preventDefault and stopPropagation on the block
  root.
- CSS: `escrita-desk-*` classes, Obsidian variables, a 32px min-height, ellipsis on
  the title.
- Optional test with fake elements in the style of tests/explorer-decorations.test.ts.

**5.6 Home note glue** (D8), depends on 2.9 and 4.2, effort S
- Create `src/desk/home-note.ts`.
- `openHome(plugin, {create: boolean})`:
  - resolve the path with `homeAction`;
  - if the active leaf already shows it, do nothing;
  - else find a leaf with `leaf.getViewState().state?.file === path` (this finds
    deferred background tabs restored on startup) and show it with
    `await workspace.revealLeaf(leaf)` and `setActiveLeaf(leaf, {focus: true})`;
  - else `getLeaf(false).openFile`;
  - offer to create through a local confirm modal (Q28): `notes.ensureFolder` for the
    parent, `vault.create(normalizePath(p), HOME_TEMPLATE)`, set homeNote when it was
    empty, then `saveSettings`.
- `startupOpen(plugin)`: acts only when `openHomeOnStartup` is on and the file
  exists; otherwise silent.

**5.7 Move commands** (T3), depends on 2.2 and 3.2, effort S
- Change `src/editor/index.ts` and `src/editor/strings.ts`.
- Four commands with `editorCheckCallback`: `move-paragraph-up|down`,
  `move-scene-up|down`. No hotkeys. They are hidden unless the active MarkdownView is
  in source mode (Live Preview or Source), which also hides them in Reading view.
- Compute with `segment(editor.getValue())` and `settings.paragraphStyle`, using the
  main selection converted with `posToOffset`.
- Apply with one public call, which is one undo step:
  `editor.transaction({changes: [{from: offsetToPos(x0), to: offsetToPos(y1), text}], selection: {from: offsetToPos(anchor), to: offsetToPos(head)}})`,
  then `editor.scrollIntoView(...)`. No private `editor.cm`.
- Notices follow Q29; at an edge, nothing.
- Strings `editor.cmd.move*` and `editor.move.*`, in en and pt-BR.
- Done when strings parity passes; the manual checks are in "Manual verification".

**5.8 [core] Stages settings UI** (S7 + the D2 settings rows), depends on G1b and
3.1, effort S–M
- Change `src/settings.ts` and `src/strings.ts`. No other wave-5 task edits them.
- A new `stagesSettings()` with five rows (`addText` + `addColorPicker`, plus a way to
  clear the color, per G1b). Stage words save on blur as well as on change; the hub
  debounce covers the rest.
- The `stageConflicts` warning (`escrita-setting-warning`), the "Other status colors"
  textarea, and the homeNote and openHomeOnStartup rows.
- Strings in en and pt-BR (wording in report S7): `settings.stages(.desc|.duplicate)`,
  `settings.otherStatusColors(.desc)`, `settings.homeNote(.desc)`,
  `settings.openHomeOnStartup(.desc)` (it says the home note replaces the restored
  active tab).
- Done when typecheck, tests and strings parity pass and the settings match the G1b
  mockup.

## Wave 6: integration, docs and checks

**6.1 Desk integration**, depends on 5.3–5.6, effort S
- `src/desk/index.ts`:
  - `registerMarkdownCodeBlockProcessor("escrita-works", (src, el, ctx) => ctx.addChild(new DeskBlock(...)))`;
  - keep a `Set<DeskBlock>` that re-renders on settingsChanged;
  - load `LeftOffRecorder` and pass it to each DeskBlock;
  - the command `open-home-note` (no hotkey);
  - startup open: capture `const coldStart = !app.workspace.layoutReady` at load, and
    call `startupOpen` in `onLayoutReady` only when `coldStart` is true, so enabling
    or updating the plugin mid-session never swaps the active tab;
  - `unload` commits pending left-off spots.

**6.2 Docs** (IDX-8, S8, SS4, T4, D9), depends on 6.1, 5.1, 5.2, 5.7 and 5.8, effort S
- `docs/ARCHITECTURE.md`:
  - a "Vault index" section: the spec fields, the cause contract, the ordering rule
    (measure → index → followers → modules), the build timing (layout ready, first
    `resolved`, fallback), the settings debounce, folder-rename idempotence, and that
    an index holds values and never note text;
  - `plugin.index` and `plugin.works` under Plugin services;
  - the pure core list: path-keys, vault-index, index-hub, works, left-off, anchor,
    stages, migrate, and the new markers exports;
  - the classify shape gains `stage` (the one stage rule for works);
  - the publish spec (ARCHITECTURE.md:629-632) and the board colors (ARCHITECTURE.md:494);
  - the placeholders Index bullet (ARCHITECTURE.md:528-530);
  - the snapshots stage kind and StageWatch;
  - a desk module spec;
  - Move in the editor spec (public `editor.transaction`, no new exception).
- `CONTEXT.md` weak spots: narrow "path-keyed data follows renames in several separate
  places" to the measurer and explorer.

**6.3 Checks**
- `npm run typecheck`, `npm test`, `npm run build` and `npm run test:bundle` all pass.
- The no-network test passes.
- `grep -rn innerHTML src` finds nothing new; `grep -rn console.log src` finds nothing.

## Manual verification on ~/projects/website/escrita/

Back up `.obsidian/plugins/escrita/data.json` first.

**SF 11: existing status settings carry over**
1. Load 0.4. Settings → Stages shows ideia, rascunho, revisão, pronto, publicado with
   their old colors. data.json still holds `publishedValue`, `unpublishedValue` and
   `statusColors`, and is not rewritten on startup.
2. The outline dots and the canvas board colors are unchanged.
3. Publish a `pronto` conto: its status becomes `publicado`. Unpublish: the status
   goes back to `pronto`.

**SF 11: works and the home block**
4. With homeNote empty and no Home.md, run "Open the home note": it offers Home.md
   (`Inicio.md` with Obsidian in Portuguese), then creates it with the block. A second run focuses the open tab. Then set
   homeNote to `Início` (no extension): the command opens `Início.md` and doesn't
   offer to create anything.
5. The block lists contos in rascunho under "Escrevendo" and in revisão under
   "Revisando", each with one fact. The counts line shows ideias, prontos, publicados
   and "sem estágio" (seed one tracked note with `status: talvez`). A note with no
   status is absent.
6. Expand a count: its works are listed, and they stay expanded while you edit a
   conto in another pane. Enter and Space toggle it.
7. Editing a target or status in properties updates the block within about a second.
   Renaming a conto keeps its line.
8. `folder: Contos` limits the list. `folder: Romances/<book>` shows one book.
9. A book in revisão shows "N de M capítulos prontos".
10. In Live Preview, clicking a line never puts the cursor in the block, and the
    "edit block" button still works. Check light, dark and a phone.
11. Disable and re-enable the plugin: the block fills without editing any file.

**SF 11: where you left off**
12. Type in a conto, switch notes, and check that data.json gets one entry, not one
    per keystroke.
13. Click the conto in the block: it lands centered on that spot with no highlight.
14. Insert text above the spot from another device or another editor: it still lands
    right.
15. Delete the context: it lands on the first unwritten beat, else the end.
16. Mod-click opens a new tab.
17. For a book, clicking opens the last edited chapter at its spot. A book with no
    chapters opens its book note.
18. Rename the conto, then the `Contos` folder: the record follows.
19. On a phone, type in a conto and background the app: the spot is recorded.
20. With the home note open in another tab, edit a conto and switch back: the order
    of lines has updated.

**SF 11: open on startup**
21. Turn it on and restart: the home note opens in the active tab. If the note is
    missing, startup is silent.
22. Home note already the active tab, restart: nothing changes. Home note in a
    background tab, restart: that tab is focused, no duplicate opens.
23. Rename the home note and move its folder, restart: it still opens.
24. Toggle the plugin off and on mid-session: the home note does not open.

**SF 11: stage snapshot**
25. Change a conto from rascunho to revisão in properties: one snapshot
    "rascunho → revisão" after about 3 s.
26. Type the status by hand, character by character, in Source mode: one snapshot.
27. Restart: nothing is taken.
28. Rename, then change the stage: the snapshot lands in the moved folder.
29. Publish: "Before publishing" plus "pronto → publicado".
30. A book note's change snapshots the book note and every chapter.
31. Editing the stage mapping takes nothing. Changing a status, then opening settings
    and typing within 3 s, still takes the snapshot.
32. Setting a status on a note that had none takes nothing.
33. After 25 daily snapshots, the stage snapshot is still there.

**SF 8: move a paragraph or scene**
34. In a conto (style `single`), move a paragraph down 3 times and up 3 times: the
    text is byte-identical (compare with a snapshot).
35. One Ctrl+Z undoes exactly one move (move slowly; see Risks).
36. A paragraph steps over a beat, and the outline's ghost beat updates. It steps over
    a code block whole.
37. Move a scene between `---` breaks: the breaks and blank lines stay put. The
    trailing break is a wall.
38. A cursor in the frontmatter, a code block or a beat shows a Notice and changes
    nothing.
39. Check a CRLF file, Live Preview with a rendered callout or code block, and folded
    headings.
40. On mobile, the commands work from the palette and from the toolbar with the
    keyboard open.
41. In Reading view, the commands are hidden.

**Index regression**
42. Rename a conto, then the Contos folder: placeholder dots, publish records,
    dialogue focus and goals history follow, and history is not doubled.
43. Delete a folder holding a note with dialogue focus on, then recreate the note:
    focus is off.
44. Startup builds without duplicate creates.

## Release checklist (per CONTEXT.md)

- [ ] docs/ROADMAP.md: move the 0.4 row to "Shipped", name the improvement
      (IMPROVEMENTS 2), and plan 0.5 before editing the topic roadmaps.
- [ ] README.md:
  - the 0.4.0 changelog entry: stages and the migration (legacy keys kept, and a 0.3.x
    edit made after upgrading is ignored), the stage snapshot, the home block,
    left-off, open on startup, move commands, the vault index, the NFC matching of
    status words, and that any published word now counts as published;
  - the settings list: the Stages section, home note and open on startup; remove
    "status colors" (README.md:110) and the published and unpublished values
    (README.md:114);
  - the publish paragraph (README.md:38);
  - the commands: "Open the home note" and the four move commands in the Editor row
    (README.md:128);
  - a short section each for the home block, left-off and move.
- [ ] docs/IMPROVEMENTS.md: move §2 to "Done". It migrated placeholders, publish,
      dialogue focus, goals history and baseline, the desk works, leftOff and the
      home note path. The measurer, the explorer's tracked set and first pass, and the
      snapshots store are waiting.
- [ ] Topic roadmaps: mark SF 8 shipped (ROADMAP-short-fiction.md:429), SF 11
      (stages, stage snapshot, home block, left-off, open on startup) shipped, the
      SF 4 Retention note "stage snapshots are never pruned", and the
      `otherStatusColors` row in the settings summary.
- [ ] docs/ARCHITECTURE.md: the items in 6.2, and mark the Workflow section shipped.
- [ ] CONTEXT.md: the current version, the next version focus (0.5), and the weak spots.
- [ ] The author's vault (ROADMAP-short-fiction.md:653-654): in
      `escrita/.obsidian/plugins/escrita/data.json` set `homeNote: "Início.md"` and
      `openHomeOnStartup: true`; add an ```` ```escrita-works``` ```` block to
      `Início.md`; update the "Plugin Escrita" section of `escrita/Como usar.md`.
- [ ] `npm version minor --no-git-tag-version` (manifest.json and versions.json to
      0.4.0), commit `0.4.0`, tag `0.4.0`, push the tag, and check the drafted release
      assets (main.js, manifest.json, styles.css including the desk CSS).

## Risks

1. **Folder-rename semantics.** The code disagrees today about whether Obsidian fires
   a rename for each child (placeholders/index.ts:241, goals/index.ts:207 vs
   measurer.ts:88, publish/index.ts:221-231). Every helper is idempotent and tested in
   both MemoryVault modes, or history gets summed twice.
2. **Handler order.** The measurer registers first (goals/index.ts:101 depends on
   main.ts:61-62). Then the index, then the followers, then the modules. The hub
   tests pin the index-before-followers order.
3. **Metadata readiness.** Metadata may not be ready at layout ready (books.ts:64-67),
   and a mid-session load gets no `resolved`. The hub builds on layout ready when
   every file is cached, else on the first `resolved`, with a 5 s fallback. Every
   build is seed data, never a transition.
4. **Unwanted or lost stage snapshots** from settings rebuilds, the migration,
   reloads, renames or two synced devices. Mitigated by the cause contract, the
   full-list re-seed that skips pending paths, the 3 s settle, the ignored
   null updates and the twin rule; duplicates across devices are cosmetic.
5. **Migration correctness** depends on the positional rule (Q2). A wrong guess
   changes reading, never prose: 0.4 only writes the published and ready words, and
   both migrate exactly.
6. **Shared default object.** `mergeDefaults` copies only arrays (merge.ts:19) and
   accepts `[]` for an object (merge.ts:16). `normalizeStages` deep-copies, and a test
   asserts it.
7. **The core switch-over (3.1) is serial.** Removing the fields breaks outline and
   publish until the same commit. Keep it one agent and one merge. It is not gated on
   the mockups; the UI is 5.8.
8. **Move data safety** relies on `sameStructure`. It costs one extra `segment()` per
   move, which is fine at conto size.
9. **Undo grouping.** `editor.transaction` sets no `userEvent`, so CodeMirror may join
   two adjacent moves made within 500 ms into one undo step. Low impact; note it in
   the README if it shows up in manual check 35.
10. **Live Preview clicks** in the code-block widget can move the selection into the
    block. Check by hand on desktop and mobile; the "edit block" button must keep
    working.
11. **Re-render churn and structural recompute cost.** classify runs for every .md on a
    structural event, debounced; a big git checkout costs repeated recomputes.
    classify now reads frontmatter and calls `stageOf` per file (the explorer calls it
    per file too); `stageOf` caches its word map. Re-renders are filtered to the shown
    paths.
12. **Placeholder latency** grows by about 300 ms after the debounced migration;
    publish checks and editor decorations are unaffected.
13. **Book fan-out.** A 40-chapter book writes 41 never-pruned files per stage change
    through the serial queue.
14. **leftOff stores prose context** in data.json: capped at 48 characters each side,
    recorded for works only, cleaned and pruned on load, local only.
15. **Downgrade to 0.3.x.** Stage snapshots parse as manual and are never pruned. The
    legacy settings keys are still present. Data-safe.
16. **Open on startup** replaces the restored active tab; the setting text says so.
17. **Scene-break parity.** outline/beats-edit.ts:71 uses raw `SCENE_BREAK`, so the
    outline and Move can disagree on a setext `Title\n---` (accepted, noted).

## Issues not applied

- **"Use `EditorView.findFromDOM`" and "a ViewPlugin registry matched on
  `editorInfoField`"** (two critiques on Q32). Not needed: the public
  `editor.transaction({changes, selection})` already does the move in one dispatch
  (darlings/index.ts:263-266), so Move needs no EditorView at all. That critique was
  applied instead.
- **"`editorCheckCallback` at editor/index.ts:71-90 doesn't exist"**: correct that the
  cited range holds `callback`, `editorCallback` and `checkCallback`, so the citation
  is dropped. But `editorCheckCallback` is a public Obsidian command field and is kept
  for the move commands.
- **"Home note follower in 4.1 or 6.1"**: applied in 4.2, the wiring step, since
  `src/desk/index.ts` is created there.
- **Release step location**: the critique cites ROADMAP-short-fiction.md:668; the rule
  is at lines 653-654. Applied with the right reference.
- All other critique issues were applied. Duplicates (the `resolved` build timing,
  the 2.5/2.7 dependencies, `isSceneBreakAt`, the color picker and the settings
  debounce) were merged into one change each.
