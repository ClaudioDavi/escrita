# Code improvements backlog

**Rule: every release includes at least one item from this list.** Pick it when
planning the version in [ROADMAP.md](ROADMAP.md) (its "Improvement" column), preferring
one that the version's features lean on. When it ships, move it to "Done" with the
version.

The list comes from several reviews:

- An architecture review on 2026-09-30: six candidates. The first two shipped in 0.2.1,
  and that refactor left the loose ends below.
- A second review on 2026-10-03, before 0.7: candidates 7–13.
- The critique of the 0.7 plan: candidate 14.
- A third review on 2026-10-04, before 0.8. It re-checked every open candidate against
  the 0.7 code, added candidates 15–20, and ran a measured performance review that
  added candidates 21–23. The performance numbers come from benchmarks on a synthetic
  vault of 3,020 notes and on 3k- and 10k-word pt-BR notes. "Phone" means desktop × 5.

Re-run the review (`/improve-codebase-architecture`) when this list runs low or after a
big feature, and add what it finds here.

Vocabulary, as in the review: a **module** is **deep** when a lot of behaviour sits
behind a small **interface**, **shallow** when the interface is nearly as big as the
implementation. **Locality**: a change or bug lives in one place. **Seam**: where an
interface lives. Test through the interface.

## Candidates

### 5. Split the outline view along its concepts

**Strength:** speculative · mostly falls out of 1 and 3

- **Problem.** `outline/view.ts` (1,561 lines) still mixes too many jobs:
  - `loadNote` (`:335-358`) is a second row builder next to `outline/rows.ts`.
  - The checked edits: `commit` (`:1064-1112`, `processFrontMatter` at `:1097`) and
    `editBeats` (`:1114-1126`).
  - The action switch `act()` (`:1217-1365`) does file I/O: beat to chapter, chapter to
    beat, trash chapter.
  - Drag and drop, `moveChapter` and `deleteChapter` (`:1382`, `:1408`), and menus
    (`:1429-1494`).
  - "Summary and status as written" is overlaid twice (`view.ts:366-371`,
    `outline/index.ts:191-198`).
  - `chaptersPort` (`:70-101`) lives in the view, and `outline/index.ts:20` imports it
    from there.

  The riskiest code, edits to chapter files, is only reachable through DOM code with no
  tests. `goals/progress-modal.ts` (774 lines) has the same shape: `renderSettings`
  (`:536-614`) and `renderPieceSettings` (`:618-692`) write frontmatter directly.
- **Change.** A chapter document module (rows, beats, checked edits, tested); the view
  keeps rendering and input.
- **Done in 0.7.0:** the rows slice (`outline/rows.ts`, candidate 7).
- **Planned for 0.8:** `chaptersPort` moves to core as the book source (candidate 18).
  The beats, the checked edits and the action switch stay in the view.

### 8. One rule for a note's effective piece, including a chapter's book default

**Strength:** medium–strong · **Pairs with:** N 2, candidate 7

- **Problem.** "Piece, then unit, then `noteProgress`" is written out in several places:
  - `core/measurer.ts:124-132`
  - `outline/view.ts:335-344`
  - `explorer/index.ts:389-390`
  - `goals/progress-modal.ts:146,234`, which also uses `progressOf`

  The book default for chapter targets (0.7) is applied only in the outline: in
  `outline/rows.ts:69` through `effectivePiece` (`core/measure.ts:235-251`), and at
  `view.ts:919-920`. So the explorer's "target next to the count" and the goals modal
  don't see it.
- **Change.** Decide the effective piece once, as a field on the classifier result (the
  growth rule): for example `piece` plus `pieceSource: "own" | "book"`. Compute it in
  `core/classify.ts` (`pieceOf`, `:268-274`, used at `:313`). The classifier already
  holds `book.note` and `tree.frontmatter`. Callers use `measure.note(file)`, or a sync
  peek for the explorer.
- **Wins.** Every surface agrees on a chapter's target; a chapter counted in characters
  works everywhere.

### 9. Scope as one live answer

**Strength:** medium–strong · **Pairs with:** U 2 (continuity needs scope outside the
universe) · **Target:** 0.9

- **Problem.** Scope lives only in the universe: `universe/index.ts:263-266` calls
  `scopeFor` in `universe/scope.ts`. Nothing outside the universe asks for it yet;
  0.9's continuity checks will.
- **Change.** `books.classify(x).scope`, with link resolution in the `VaultTree` port and
  `scopeFor` kept pure, so the lens, editor and outline can ask for scope without the
  universe module.
- **Wins.** Outside modules get scope without depending on the universe.
- **Minimum shipped in 0.7.0:** `Entry` no longer stores `scope` and `sameEntry` no
  longer compares it; scope is read live through `scopeOf`.

### 10. One name fold in core

**Strength:** small, strong · **Pairs with:** U 1.2 (done)

- **Problem.** Two functions fold names for comparison:
  - `core/names.ts:16-18`, `foldName`
  - `universe/entries.ts:168-170`, `foldText`, used at `universe/create-logic.ts:27-32`
    and `:172-181`, `universe/panel-model.ts:19-26`, and `entries.ts:174-176`

  They can drift. The lens's `nameVariants` (`lens/rules-stem.ts:147-185`) is a
  misspelling detector, a different job, and stays as it is.
- **Change.** `foldText` becomes `foldName`, or a thin re-export of it.
- **Wins.** One fold. Then this candidate is done.
- **Shipped in 0.7.0:** `core/names.ts` and the `plugin.names` port; "Appears in", the
  name marks, the lens and the outline's POV read names through it.

### 11. Each module owns its settings section

**Strength:** medium (bigger than first written) · **Pairs with:** SF 10, export and
submissions · **Planned for 0.8** (PLAN-0.8.md has the interface)

- **Problem.** `settings.ts` (983 lines) is one `display()` (`:305-491`) with a heading
  per module.
  - It imports module internals: the lens at `:4-7`, the universe at `:12-13`.
  - It calls `plugin.lens.createLists()` (`:712`).
  - `offNotice` (`:581-612`) reaches into `p.snapshots.store`, `p.data.history`, the lens
    and `p.data.leftOff`.
  - A placeholder "export" switch row is hard-coded at `:571-576`.
  - Most text rows save on every keystroke (`settings.ts:327` and others). Each save
    writes `data.json`, runs `features.apply()` and calls every module's
    `settingsChanged` (`main.ts:231-236`). The index rebuild that follows is debounced
    (`core/index-hub.ts:130-142`).
- **Change.** An optional `settingsSection(el, ui)` and `offNotice()` on each module, as
  the universe already does (`universe/settings-ui.ts`). The tab draws the sections in
  one order list that keeps today's order. Text rows save when the field is committed
  (`saveOnCommit`, lifted from `universe/settings-ui.ts:16-24`).
- **Wins.** An off module's section disappears with it; `settings.ts` stops importing
  modules; typing in a field no longer reloads features on each key.

### 13. Shared helpers out of module folders

**Strength:** medium, small · **Pairs with:** candidate 6, export (candidate 19)

- **Problem.** Pure helpers live in one module's folder and are used by another:
  - `confirmAction` (outline), used by `snapshots/index.ts:20`
  - `dialogueInDoc` and `blockStateIn` (editor), used by `lens/measures.ts:11` and
    `lens/analyze.ts:10`
  - `openWork` (desk), used by `universe/view-works.ts:5`
  - `goals/piece`, used by `outline/bar.ts:5` (new since 0.7)

  An edit for one module can break another. Export would add a use of
  `publish/checks`.
- **Change.** Move the pure ones to `core/` and the modals to a shared `ui/` folder.
- **Wins.** Clear ownership; the module dependency table only lists runtime calls.
- **Planned for 0.8, in part:** the publish checks move to core (candidate 19).

### 14. The mentions index starts on demand

**Strength:** strong, measured · **Pairs with:** the 1.0 mobile pass, candidate 21 ·
**Planned for 0.8** · Rescoped on 2026-10-04 from "every content index" to the mentions
index only.

- **Problem.** With the universe on, `universe/index.ts:183` starts a full-vault pass
  as soon as the entries are ready: `segment`, `readerMask` and `findNames` over every
  file. A term-table change, such as an edited alias, runs it again after 2 s
  (`universe/mentions-index.ts:103`). Measured on the 3,020-note vault:

  | Index | Total, desktop |
  |---|---|
  | mentions | 4,214 ms (phone about 20 s) |
  | placeholders | 122 ms |
  | threads | 114 ms |
  | measuring every file | 610 ms |

  The mentions pass is about 85% of all index time.
- **Change.** A spec may declare `start: "demand"`. The mentions spec builds on its first
  query: `appearsIn`, `workCount`, the panel's tab, or an entry note opening. Surfaces
  already have a "counting" state (`appearsInAnswer`). Placeholders and threads stay
  eager: they are cheap, and the dots and the outline need them.
- **Wins.** About 4 s of desktop CPU, and about 20 s on a phone, saved in every session
  that never looks at "Appears in".

### 15. Manuscript text: a note's prose as an editor receives it

**Strength:** strong · **Pairs with:** N 7 (export) · **Planned for 0.8**

- **Problem.** No function yields a note's prose without Escrita's markers while keeping
  its structure. Every reader function strips for counting:
  - `proseOnly` (`core/wordcount.ts:21-36`) drops heading and list marks and scene
    breaks, and leaves a space where a comment was, so a beat-only line becomes a
    stray blank line.
  - `readerTextOf` (`:139-159`) removes emphasis and collapses whitespace.
  - `readerMask` (`:84-98`) blanks offsets for the lens.
- **Change.** A pure `core/manuscript.ts`: `manuscriptOf(md: Markdown, options)` returns
  blocks (paragraph, scene break, heading, quote) made of runs (text, italic, bold),
  plus what it dropped (placeholders, embeds, unclosed comments). It does the
  following:
  - Drops frontmatter, `%%` and `<!-- -->` comments, and whole beat or placeholder
    lines with their blank line.
  - Maps scene breaks through `isSceneBreakAt` (`core/markers.ts:118`).
  - Turns a wikilink into its alias or target.
  - Drops embeds and reports them.

  Link rules come from the `MARKUP` table (`wordcount.ts:42-53`), so the manuscript
  can't drift from the counts.
- **Wins.** Markdown, DOCX and later EPUB writers all format one model. It is tested
  against the `markdown-consumers` fixtures.

### 16. One fingerprint for what classify reads, and a `submission` field

**Strength:** strong · **Pairs with:** SF 12 (submissions) · **Planned for 0.8**

- **Problem.** Six indexes hand-copy classify's inputs into their own `settingsKey`:
  - `core/works-index.ts:52`
  - `explorer/index.ts:127`
  - `placeholders/index.ts:86`, which also tracks `last*` values by hand at
    `:138-144`
  - `universe/threads.ts:37`
  - `universe/entries.ts:127`
  - `universe/mentions-index.ts:41`

  A `submissionsFolder` setting would mean editing all six. The "skip a snapshot on
  rename" guard is repeated too (`outline/view.ts:252`, `explorer/index.ts:231`,
  `core/index-hub.ts:225-254`). `main.ts:182-187` lists "Escrita's own notes" by
  hand.
- **Change.** `classifyKey(settings)` in `core/classify.ts`, which every spec composes.
  `submission: boolean` goes on `Placement`, checked next to `snapshot`
  (`classify.ts:304-310`): a submission note is never tracked, never a work, has no
  stage and never gets the draft status. `submissionsFolder` goes on
  `ClassifySettings`.
- **Wins.** Submissions land as one field plus one key, and every index follows.

### 17. Find-or-create a note through `plugin.notes`

**Strength:** medium · **Pairs with:** export, submissions · **Planned for 0.8**

- **Problem.** "Make the folders, create, handle an existing file, a case clash or a
  race" is written seven times with different policies:
  - `darlings/index.ts:185-199`
  - `desk/home-note.ts:68-69`
  - `lens/ui.ts:318-328` and `:374-381`
  - `universe/index.ts:413-424` and `:430-439`
  - `outline/index.ts:205-223,256-260`

  Export must write a `.md` or a binary `.docx`; nothing in `src/` uses `createBinary`
  yet. Submissions create notes.
- **Change.** `notes.create(path, text | ArrayBuffer, { exists })`, where `exists` is
  `"return"`, `"fail"`, `"unique"` or `"replace"`. It wraps `ensureFolder`, `create`,
  `createBinary` and `modifyBinary`, with the case and race checks done once. Asking
  the writer stays with the caller.
- **Wins.** One tested policy; export and submissions write one call each.

### 18. A book source port in core

**Strength:** medium–strong · **Pairs with:** N 7, N 8 (0.10) · **Planned for 0.8**

- **Problem.** Chapter order is one call (`books.chapters`, `core/books.ts:51-59`), but
  the port that pairs it with text and frontmatter is `chaptersPort`, inside the DOM
  view (`outline/view.ts:70-101`). It reads with `cachedRead` (`:81`), so an open
  editor's unsaved text is missed.
- **Change.** `core/book-source.ts`: chapters in order with title, number and whether
  to include them (the `compile: false` rule); `read(path)` through `plugin.notes`; and
  frontmatter. The Obsidian adapter sits beside `BookService`. `outline/rows.ts`'s
  `RowsPort` extends it.
- **Wins.** Export and "Read the book" share it; the outline view loses its port.

### 19. Readiness checks in core

**Strength:** medium · **Pairs with:** N 7, N 4 (0.10) · **Planned for 0.8**

- **Problem.** `runChecks` and `unclosedComment` are pure but live in
  `publish/checks.ts:60-160`. Export's "warn when placeholders remain" is the same
  check, and it must work while publish is off.
- **Change.** Move the marker checks (unclosed comment, placeholders, unwritten beats,
  empty body) to `core/readiness.ts`. Add the unclosed `<!--` check (loose end).
  Publish keeps its own checks (recommended properties, over limit).
- **Wins.** Export, publish and 0.10's book-wide check give the same answer.

### 20. Feature metadata in one place

**Strength:** medium, small · **Pairs with:** candidate 11, two new feature ids ·
**Planned for 0.8**

- **Problem.** A new feature touches five lists:
  - `FEATURE_IDS` and `FEATURE_SPECS` (`core/features.ts:4-34`)
  - `FEATURE_PAGE` (`settings.ts:267-273`), which repeats the groups
  - `SETTING_FEATURES` (`settings.ts:240-264`)
  - the hard-coded export row (`settings.ts:571-576`)
  - the module map (`main.ts:151-160`)

  `switchesOf` (`settings.ts:276-278`) duplicates the registry's private `switches()`
  (`core/feature-registry.ts:110-118`).
- **Change.** `FeatureSpec` gets the page order, `FEATURE_PAGE` is derived from it, and
  `switchesOf` is exported once from core.
- **Wins.** Adding export and submissions edits one list plus the module map.

### 21. Index passes yield on a time budget, and a slow index can settle longer

**Strength:** strong, measured · **Pairs with:** candidate 14, export of a long book
on a phone · **Planned for 0.8**

- **Problem.**
  - **Long blocks.** `VaultIndex.build` (`core/vault-index.ts:153-166`) reads 40 files in
    `Promise.all`, then runs every `compute` in one macrotask, and yields only between
    batches. The same pattern is in `flush` (`:330`) and the explorer's first count
    pass (`explorer/index.ts:150`). On 3,020 notes with the mentions index, the longest
    block is 125–155 ms, about 600–780 ms on a phone.
  - **Saves.** Every spec shares one 300 ms settle after a modify. So the mentions index
    recomputes the open note on every save while typing (Obsidian saves about every
    2 s): 13.1 ms for a 10k-word chapter (phone about 65 ms). That is 85% of all
    per-save work.
- **Change.**
  - Compute one file at a time with a time budget of 8–16 ms, keeping the reads
    parallel. Add `now()` to `IndexTimers` so the `ManualTimers` tests stay
    deterministic. Use the same helper in the explorer's first pass and in export.
  - An optional `settleMs` per spec, 3–5 s for mentions.
  - Move the benchmarks into `tests/perf/` with an `npm run bench` script.
- **Wins.** Measured with a patched copy: the longest block goes from 125 ms to 14 ms,
  with a total time cost of +1–5%. Typing no longer triggers the mentions recompute.

### 22. Hot loops keep their caches across calls

**Strength:** medium, measured · **Pairs with:** candidates 14, 21 · **Planned for 0.8**
(names; the lens if room)

- **Problem.**
  - **Names.** `findNames` (`core/names.ts:201-237`) builds its fold and stem-key caches
    per call; profiling puts `keyOf` at 21% self time. It runs on every mentions
    compute, on each name-marks pass and in the lens.
  - **Lens.** The lens's full pass on a 10k-word chapter is 25.8 ms (phone about
    130 ms), with `syllables` per token (`lens/measures.ts:25`) and `normalizeWord`
    taking about 30%.
- **Change.**
  - Module-level fold and key maps, keyed by language and profile, cleared at 50k
    entries.
  - A memo in `syllables()` and a small LRU on `normalizeWord`.
  - Optionally, charCode tests instead of `WS.test` in `core/sentences.ts` `region`.
- **Wins.** `findNames` gets about 1.4× faster (10k words: 12.1 to 8.4–8.8 ms), with
  the same output. The lens pass drops 20–35%.

### 23. Small redraws and re-reads

**Strength:** small, safe · **Planned for 0.8**

- **Threads.** The thread markers plugin calls `doc.toString()` on every docChanged
  (`universe/create.ts:530-535`). Use `parseThreads(segmentDoc(doc), …)`, like the
  other editor plugins.
- **Placeholder dots.** They redraw the whole explorer on every index change
  (`placeholders/index.ts:124-127`). Pass the changed paths.
- **Look at in Obsidian first, not measured:**
  - `main.ts:129` redraws every explorer item on each `layout-change`.
  - The universe panel re-renders on any `metadataCache` change
    (`universe/view.ts:56`).

## Measured and set aside

### 12. Content indexes share one read and one segmentation per file

**Set aside on 2026-10-04 after measuring.** Over 3,020 notes, the three content
computes cost 4,418 ms with separate segmentations and 4,380 ms with one shared
segmentation. One `segment()` per file is 36 ms in total, under 1%. Placeholders and
threads return early in notes without `%%`.

The only real saving would be reads at startup: 9,060 `cachedRead`s would become
3,020. That can't be measured outside Obsidian, and candidates 14 and 21 make it moot.
Revisit only if a phone profile shows reads dominating.

## Loose ends

Small; good for a release whose features don't touch the candidates above.

- **Unclosed `<!--`.** The publish check could warn about an unclosed `<!--`, whose
  following words are counted although Reading view hides them
  (`publish/checks.ts:60-74` tests only `form === "%%"`, at `:64`). **Planned for
  0.8** with candidate 19: export must drop or flag that text too.
- **Classifier fake.** Test the Obsidian side of the classifier (`core/books.ts`:
  `instanceof` checks, root folder filtering) with a small fake, and try nested books
  in a real vault. `core/books.ts` has no test yet. **Planned for 0.8** with
  candidate 16.
- **Reading view parity.** Open questions pinned by tests in
  `tests/markdown-consumers.test.ts`: `%%` inside a closed `<!-- -->`, a fence inside an
  open `%%`, `%%` inside `$$`, escaped backticks. Check each against Reading view and
  flip the rule where it differs. Export makes these matter: what Reading view hides
  must not reach the manuscript. **Gate G0c in PLAN-0.8.md.**
- **Editor writes.** Besides "plant a thread" (`universe/create.ts:319`) and the
  template insert (`editor/template-insert.ts:92`), other cursor-local edits write
  straight to the editor too: `placeholders/index.ts:181`, `outline/index.ts:165`,
  and `editor/features.ts:85,332`. The rule (PLAN-0.8.md, Q9): an edit at the
  cursor of the editor that triggered it may write directly, and `plugin.notes` is for
  writes to any other note. The author agreed on 2026-10-04; the item closes when 0.8
  writes that line into ARCHITECTURE's conventions (PLAN-0.8.md, task 4.2).

## Known issues

None at the moment.

## Done

| Version | Improvement |
|---|---|
| 0.7.0 | Modules that load and unload at runtime (candidate 6): a `FeatureModule` per feature, a `ModuleContext` that records an undo for every registration (commands with `removeCommand`, so `minAppVersion` 1.7.2; view, editor, code block and post-processor slots registered once; index specs removed through `IndexHub.remove`), a registry that loads in order and unloads in reverse, data followers that run while a feature is off, and a lifecycle test per module on an `obsidian` stub |
| 0.7.0 | Chapter rows (candidate 7): `outline/rows.ts` loads every chapter row through one port, for the outline view and the canvas board, tested with vitest; the outline reads the placeholder count from the placeholders index |
| 0.6.0 | Note text port finished (candidate 3): the outline's beat re-checks and writes go through `plugin.notes` as `guardedEdit` plans, and its emptiness checks read through the port. Thread closing and template insert share `replaceIfExact`, `guardedEdit` and `matchLineEndings`. Still direct: the editor's template insert and "Plant a thread" write to the editor that triggered them |
| 0.5.1 | Lens marks stale after a lists change: the session treats options as a generation (`invalidate` clears every cache first, one failing pass no longer stops the others), the marks field drops a list from an older generation, and a failed refresh retries instead of dropping the editor |
| 0.2.1 | Markdown segmenter (`core/markdown`): one scan for prose, frontmatter, code and comments |
| 0.2.1 | File classifier (`core/classify`): one answer to what a file is |
| 0.3.0 | Measure module (`core/measure`, `plugin.measure`): counts, targets and goals in one place (candidate 1) |
| 0.3.0 | File explorer decoration adapter (`core/explorer-decorations`) (candidate 4) |
| 0.3.0 | Note text port (`core/note-text`, `plugin.notes`), partial: the outline's beat re-checks remain (candidate 3) |
| 0.4.0 | Vault index (`core/vault-index`, `core/index-hub`, `plugin.index`; candidate 2). Migrated: placeholders, publish records, dialogue focus, goals history and baseline, the desk's works, `leftOff` and the home note path. Still waiting: the measurer, the explorer's tracked set and first pass, and the snapshots store (they keep their own path-keyed state) |
| 0.5.0 | The 0.2.1 editor loose ends: the compatibility wrappers (`blockStateAt`, `bodyStart`, `inProperties`, `core/markers.bodyStartLine`) are gone, `insertSceneBreak` and `enter-flow` read the `Markdown` from the segmenter, and `outline/beats-edit.isBreak` uses `isSceneBreakLine`. Still open: the `<!--` publish check, the classifier fake and the parity questions |
