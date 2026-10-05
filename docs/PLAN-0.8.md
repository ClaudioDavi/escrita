# Escrita 0.8, "submitting work": implementation plan

This is the plan for Escrita 0.8, written 2026-10-04 on branch `0.7` at `ae33d03`. It
breaks the release into waves of tasks that agents can run in parallel, with strict
file ownership per wave.

The specs win on any disagreement:

- `docs/ROADMAP-novel.md`: N 6 (companion plugins) and N 7, stages 1–2 (export).
- `docs/ROADMAP-short-fiction.md`: SF 12 (submissions).
- `docs/IMPROVEMENTS.md`: candidates 11, 14 and 15–23, and the loose ends. They were
  re-checked against this commit on 2026-10-04, so their file:line references are
  current.

If this plan and a spec disagree, fix this plan. Where the plan narrows a spec, the
change is listed under "Deviations", and the release writes it back into the spec.

**Stages served** (ARCHITECTURE.md, "Workflow"):

- **Ready and published.** Export turns a note or a book into the manuscript an editor
  or a contest asks for. Submissions record where it went and what came back.
- **Every stage.** The performance work makes startup and typing lighter on phones.

**Upkeep asked of the writer:**

- One note per submission, created by a command.
- Optionally, `compile: false` on a chapter parked inside a book.
- An author name and contact lines, set once in settings.

Export reads everything else from what the note already has.

## Scope

**Features**

| Feature | Ref | Effort |
|---|---|---|
| Export a note or a book: Markdown manuscript and DOCX, Shunn and pt-BR presets | N 7 | M–L |
| Submissions: one note per submission, "Record a submission", pending count in the home block | SF 12 | S |
| Companion-plugin guide: "Other plugins" guide page and settings note, StoryLine notes | N 6 | S |
| User guide: `publishing.md` and `other-plugins.md`, English and pt-BR | Docs | S |

**Improvements**

The rule asks for at least one. 0.8 takes the foundations export and submissions stand
on, plus the measured performance items.

| # | Improvement | Why now | Size |
|---|---|---|---|
| 11 + 20 | Each module owns its settings section; feature metadata in one place | Export and submissions bring settings and two feature ids | M |
| 15 | `core/manuscript.ts`: a note's prose as an editor receives it | The model every export writer formats | M |
| 16 | `classifyKey` and the `submission` field (with the classifier fake) | Submissions | S |
| 17 | `notes.create` with binary and exists policies | Export writes `.docx`; submissions create notes | S |
| 18 | `core/book-source.ts` | Export reads a book's chapters with unsaved text | S |
| 19 | `core/readiness.ts`, plus the `<!--` loose end | Export warns as publish does, with publish off | S |
| 21 | Time-budgeted index passes, `settleMs`, `tests/perf/` | Phone startup; export of a long book | S |
| 14 | Mentions index on demand | 85% of index CPU at startup | M |
| 22 | Names caches (must); lens memos (if room) | Typing and mentions cost | S |
| 23 | Threads `segmentDoc`, dot paths | One-liners | S |
| 10 | One name fold (if room) | Closes the candidate | S |

**Cut line.** If the release runs long, these move to 0.9 in this order: 10, then 22's
lens part, then 23, then the preview's click to open a note (Q16). Everything else is either a foundation the features need or a
measured win that is S.

**Out of scope:** EPUB (0.10); print PDF (never: recommend Enhancing Export); market
notes; a submissions dashboard (Bases or Dataview can table the notes); candidates 5,
8, 9 and 13 beyond what 18 and 19 move.

## Open questions, with recommended answers

**Answered 2026-10-04:** the author accepted every recommendation (Q1–Q15), and on
2026-10-05 the recommendations for Q16 and Q17. Agents build
to them as written.

**Export**

| # | Question | Recommendation |
|---|---|---|
| Q1 | Zip for DOCX: a dependency (fflate) or our own? | **Our own STORE zip in `core/zip.ts`**: CRC32 plus local and central headers, about 100 lines, no dependency, no licence banner, nothing for `no-network.test.ts` to flag. A manuscript is a few hundred KB, so no compression is fine. Gate G0a checks that Word, LibreOffice, Google Docs and Pages open it. The tests read the zip with a small reader in `tests/support/`. |
| Q2 | Where does the author's name come from? | **Settings:** `authorName`, `authorSurname` (empty means the last word of the name, used in the Shunn header) and `contactLines` (several lines: address, email, phone). **Overrides:** an `author` property on the book note or the note. No per-market data. |
| Q3 | Where does the file go, and what if it exists? | **An export folder setting**, default `Escrita/Exports`. The name is `<title>.md`, or `<title> (<preset>).docx`. If the file exists, ask: replace or keep both. Replacing an export loses no prose: the export is derived, and its source notes are untouched. The export folder is kept out of tracking like the snapshots folder: classify's `export` field (task 1.6) means never tracked, never a work, no draft status. |
| Q4 | One command or several? | **One command, "Export…"**, for the active note or its book. It opens one modal with: the source (this note, or the whole book when the note is in one), the chapters (all, a range, or ticked), the format (Markdown or DOCX), the preset (Shunn or pt-BR), and the readiness warnings with "Export anyway". Needs a mockup (G1). The modal remembers the last choices per work in `data.json`. |
| Q5 | Chapter headings, and prologue and epilogue? | **There is no prologue concept today.** Rule: a chapter with a number gets "Capítulo N" or "Chapter N" (the format is a setting with `{n}` and `{title}`). A chapter without a number prefix gets its title alone, unnumbered. Numbering counts only numbered chapters. This covers "Prólogo.md" and "Epílogo.md" with no new property. |
| Q6 | Wikilinks, embeds, code, footnotes? | A wikilink becomes its alias, or else its target's text. Embeds are dropped and listed in the warnings. Code keeps its text, unformatted. Footnotes: kept as text in 0.8 (DOCX footnotes are 0.10 material). |
| Q7 | Front matter pages (dedication, epigraph)? | **Book only:** optional `dedication` and `epigraph` properties on the book note, each a link to a note whose prose becomes a page. The property names are settings. A single note has only the title page. |
| Q8 | Which unit for the title page count? | `measure.note` or `measure.book`, rounded: to 100 below 10,000 words, to 500 above (the Shunn convention), "about" in both languages. Characters when the work's unit is characters. Never recount. |
| Q16 | A preview before the file is written? *(added 2026-10-05)* | **Yes, as a reading column, not pages.** A "Preview" step in the Export modal draws the `ExportDoc` the writers get: title page, chapter headings, scene breaks, front matter pages, with the preset's font and spacing. It is a third writer behind the `ManuscriptWriter` seam (`src/export/writers/preview.ts`, DOM through `createEl`), so it can't drift from the file. No page breaks or page numbers: Escrita doesn't lay out pages, and a fake page count would mislead. Clicking a paragraph opens its note at that line, which needs a 0-based `line` on each manuscript block (like `Dropped.line` already has). If the release runs long, the click cuts first and the `line` field stays. Idea from Word-Smith's export preview. |
| Q17 | Remember the last export? *(added 2026-10-05)* | **Yes, one click to repeat it.** Q4 already remembers the choices per work. On top of that, the modal opens with a line for the last export (format, preset, chapter count, date, the file as a link) and an **Export again** button that runs it with those choices. The readiness warnings still show and still need "Export anyway". Also a palette command, "Export again", for the active note's work (no hotkey). Stored in `data.json` by work path, so it follows renames and deletes through `plugin.index.follow`, even while export is off. If the file has moved or gone, Export again asks where to write, as Q3 does. |

**Architecture**

These are Opus decisions; agents don't reopen them.

| # | Question | Recommendation |
|---|---|---|
| Q9 | Editor commands that write straight to the editor: still a rule violation? | **No.** New rule: an edit at the cursor of the editor that triggered it may write directly; `plugin.notes` is for writes to any other note. Close the loose end with that line in ARCHITECTURE's conventions and in CONTEXT.md. |
| Q10 | Where does the export pipeline live? | **Pure core pieces** (`core/manuscript.ts`, `core/book-source.ts` port, `core/readiness.ts`, `core/zip.ts`). **The writers** live in a new `export` module: `src/export/writers/markdown.ts` and `docx.ts`, behind the `ManuscriptWriter<M>` seam (Wave 0). The pipeline is source → model → writer. It is generic over the model, so screenplay brings a script model and its own writers without changing it. |
| Q11 | Two feature ids or one? | **Two:** `export` and `submissions`, both in the "publishing" group, after `publish` in the load order. That makes 19 features. The hard-coded export row in settings goes away. |
| Q12 | How does the home block learn the pending count? | A frontmatter-mode index spec in the submissions module, over the submissions folder: work path → pending count, resolving the `work` link through `metadataCache`. The desk reads it only while `features.isOn("submissions")`, and subscribes to its `onChange` for a redraw. |
| Q13 | Settings section order once modules own them? | **Keep today's visual order**, so no mockup is needed. A single order list in core names core and module sections together. Moving Stages up next to Books is a design change for a later version. |

**Performance**

| # | Question | Recommendation |
|---|---|---|
| Q14 | Time budget size? | **8 ms** (was 12 ms; changed 2026-10-05 after G0d on desktop), with a `MessageChannel` yield where available and `setTimeout(0)` as the fallback. Electron clamps nested timeouts to 4 ms, which costs wall time at 8 ms. |
| Q15 | What starts the mentions index? | The first `appearsIn` or `workCount` query, opening the universe panel's Works or entry tab, or an entry note becoming active. A term-table change while not started does nothing. |

## Deviations from the specs

| Spec | Says | Plan | Why |
|---|---|---|---|
| N 7 | Command "Compile the book" | One "Export…" command for a note or its book | One entry point for both (N 7 already says single notes too) |
| N 7 | "Prologue/Epilogue rule" | Unnumbered chapters get their title alone (Q5) | No new property; it reads what the writer has |
| SF 12 | Home block "can show 2 pendentes" | Shown next to the ready count only while submissions is on | Off feature, no trace |
| IMPROVEMENTS 14 | Every content index | Mentions only | Measured: the others are cheap |

## Gates

**G0. Spikes** (an agent with Obsidian on desktop, the author on a phone; results are
written here before the gated task starts).

- **G0a** (gates 2.3): a DOCX from the STORE zip opens without a repair prompt in Word,
  LibreOffice, Google Docs and Pages. It must have double spacing, a header with the
  page number field, and a page break per chapter.
  **Passed in part. Result 2026-10-04:** a throwaway generator (`make-docx.mjs`, not
  committed) wrote a Shunn file (Letter) and a pt-BR file (A4). Each had a title page,
  a Prólogo with no number, numbered chapters, a `#` scene break and travessão dialogue.
  The zip was STORE with CRC32, 8 parts, about 9 KB. Both files open with no repair
  prompt in **LibreOffice** (checked by the author, and converted headless to PDF)
  and **Google Docs** (the author). The PDF shows:
  - the page size
  - a page break before each chapter
  - the "Surname / Title / N" header with a live PAGE field, hidden on the title page
  - double spacing and the half-inch indent
  - italics kept

  **Word and Pages not checked yet.** Task 2.3 may start. The Word and Pages check
  moves to the manual verification before release.
- **G0b** (gates 1.7): `vault.createBinary` and `modifyBinary` in a vault folder, on
  desktop and on Android and iOS. The file must show in the explorer, and a sync
  plugin must pick it up.
  **Phone part waived 2026-10-05:** the author has no phone sync, so phone checks are
  assumed to pass (Obsidian's documented API, no Node). A throwaway plugin for it is in
  `~/Downloads/escrita-spike/` (not committed). Its "G0b: write a binary file" command
  checks `createBinary` and `modifyBinary` read back the same bytes. It is optional on
  desktop. 1.7 tests the same through the fake vault.
- **G0c** (gates 1.3): the four Reading-view parity questions in
  `tests/markdown-consumers.test.ts`, checked in a real vault. Flip the segmenter rule
  where Reading view differs, before the manuscript builds on it.
  **Done. Result 2026-10-05, the author in Obsidian's Reading view:**
  - **A** (`%%` inside a closed `<!-- -->`): shows `antes meio fim`. Matches D14.
  - **B** (a fence inside an open `%%`): shows `depois` only. Matches D7.
  - **D** (escaped backticks): shows ``a ` c` d``. Matches D6.
  - **C** (`%%` inside `$$`): Obsidian draws the math block (`x`; LaTeX treats `%` as
    its own comment), then shows `prosa fim`. A `%%` inside `$$` does **not** open an
    Obsidian comment. **D9 is wrong.** Escrita hides the rest of the math block and
    "prosa", and then reads `%% fim` as an open comment.

  Decision (Opus): a `$$` block that starts at a line start in prose is math until
  its closing `$$`, and a `%%` inside it is literal. Words in math still count as
  today; math in a manuscript is task 1.3's call (kept as text). Task 1.10 makes the
  change.
- **G0d** (gates 1.1): the time budget and a `MessageChannel` yield on a phone, using
  the bench vault copied into a test vault. Record the longest block before and after.
  **Desktop result 2026-10-05** (the spike plugin in Obsidian, 3,020 notes, the
  mentions compute):

  | Pass | Total | Longest block | Phone estimate (× 5) |
  |---|---|---|---|
  | Today | 3.7 s | 64 ms | about 320 ms |
  | 12 ms budget | 3.3 s | 30 ms | about 150 ms |
  | 8 ms budget | 3.4 s | 22 ms | about 110 ms |

  Total time doesn't grow. **Decision (Opus): 8 ms**, the shortest block at no cost
  (Q14 updated). The phone run is waived (no phone). G0b also passed on desktop:
  `createBinary` and `modifyBinary` read back the same bytes.

**G1. Design** (rule 7): mockups on the design canvas for the Export modal (Q4, with
its warning state, the preview step of Q16 and the last-export line of Q17), the
"Record a submission" modal, and the pending count in the home
block. The settings tab keeps its look (Q13), so it needs no mockup.

**G2. Answers.** Cleared 2026-10-04: the author accepted the recommendations for Q1–Q15.
Q16 and Q17 cleared 2026-10-05.

Still open from 0.7, on desktop: G0d (the Reading-view "Appears in" section across
re-renders) and the visual check against the canvas (PLAN-0.7.md, task 5.2). The phone
checks (0.7's G0c `spellcheck="false"` on Android and iOS, and the G0h phone figure) are
waived like 0.8's: the author has no phone to test on.

## Models

Following the project's rule:

- **Sonnet** does the code: implementation, tests, docs and benchmarks.
- **Opus** makes every architecture decision. It writes the Wave 0 contracts, judges
  each wave, and reviews the release.
- A Sonnet task that meets an architecture choice not settled here stops and hands it
  back.

Each task lists its model.

## Ownership rules

- One owner per file per wave. A task touches only the files it lists, plus new test
  files named after it.
- `src/core/*`, `main.ts`, `settings.ts` and `data.ts` change only in the task that owns
  them.
- **Every task's done-when:** `npm run typecheck`, `npm test` and `npm run build` pass,
  and `npm run test:bundle` passes after a build.

## Wave 0: contracts and fixtures

**0.1 Contracts (Opus).** Signatures and doc comments with stub bodies, compiled.

- `core/manuscript.ts`: `Manuscript`, `Block`, `Run`, `ManuscriptOptions`,
  `manuscriptOf(md, o)`.
- `core/export-pipeline.ts` (pure):
  - `ExportSource { title, author, parts: { heading: string | null; md: Markdown }[] }`
  - `ManuscriptWriter<M> { id; ext; write(m: M, preset): string | Uint8Array }`
  - `Preset`
- `core/book-source.ts`: `BookSource { chapters(book); read(path); frontmatter(path) }`
  and `ChapterRef { path, title, number, include }`.
- `core/readiness.ts`: `Readiness`, `readinessOf(md, o)`.
- `core/zip.ts`: `zipStore(files: { path; data: Uint8Array }[]): Uint8Array`, `crc32`.
- `core/notes.ts`: `create(path, data, { exists })`, its result type, and its errors.
- `core/classify.ts`: `Placement.submission`, `ClassifySettings.submissionsFolder`,
  `classifyKey(s)`.
- `core/index-hub.ts` and `core/vault-index.ts`:
  - `IndexSpec.start?: "ready" | "demand"`
  - `IndexSpec.settleMs?`
  - `IndexTimers.now()`
  - `yieldBudget(timers, ms)`
- `core/module-context.ts`: `SettingsUi`, `FeatureModule.settingsSection?(el, ui)` and
  `offNotice?()`.
- `core/features.ts`: the ids `export` and `submissions`, and the page order on
  `FeatureSpec`.

**0.2 Fixtures (Sonnet).**

- `tests/fixtures/manuscript/`: a conto with dialogue, beats, placeholders, `%%` and
  `<!-- -->` comments, scene breaks, a wikilink with an alias and an embed; a
  three-chapter book with an unnumbered "Prólogo" and a `compile: false` chapter;
  expected Markdown output for both presets.
- `tests/support/zip-reader.ts`.
- `tests/perf/`: the 2026-10-04 benchmarks moved from the scratchpad (fixtures,
  editor, index, names, budget), plus `npm run bench`.

**Opus judge:** the contracts against Q1–Q15 and the specs.

**Wave 0 result (2026-10-04).** Done. The contracts add, beyond the list above:
- `ExportDoc` (built by `exportDocOf`), `Author`, `ExportPart.role` and `ExportSource.count`.
- `ManuscriptWriter<M, P = Preset>`, so the preset type travels with the model.
- `BookSource.read` returns `{ text, mtime }`, with `mtime` null for editor text. Only a non-null `mtime` seeds the measurer.
- `notes.create` takes `string | ArrayBuffer | Uint8Array`.
- `Placement.export` and `exportFolder`.
- `macrotaskYield` is written, not stubbed.
- `IndexTimers.now?()` is optional.
- `VaultIndex.demand()`.
- `yieldBudget` returns a checkpoint (`BUDGET_MS`, 8 ms after G0d).
- A separate `unclosedHtmlComment` check id.

The 0.8 settings keys are declared with English defaults and no UI: `exportFolder`, `compileProperty`, `dedicationProperty`, `epigraphProperty`, `authorName`, `authorSurname`, `contactLines`, `chapterHeadingFormat`, `submissionsFolder` and `submissionResults`. `data.exportChoices` is declared too.

The judge's fixture rules are in `tests/fixtures/manuscript/README.md`:
- The scene break is written `\#`.
- Chapters are numbered by ordinal before the modal narrows the list.
- Body headings sit at level 2 or deeper in a note, level 3 or deeper in a book.
- A book has a separate title page; a conto does not.

## Wave 1: foundations (parallel, Sonnet)

| Task | Owns | Done when |
|---|---|---|
| 1.1 Time budget, settle, demand start (21, 14 hub part) | `core/vault-index.ts`, `core/index-hub.ts`, `core/vault-indexes.ts` (the hub's timers use `macrotaskYield` and `now: () => performance.now()`) | `ManualTimers` tests for budgeted builds, `settleMs`, demand start on first query; bench shows the longest block ≤ 20 ms on 3,020 notes |
| 1.2 Names caches (22) | `core/names.ts` | Same output on every names fixture; bench ≥ 1.3× on 10k words; bounded memory test |
| 1.3 Manuscript model (15) | `core/manuscript.ts`, `core/wordcount.ts` (export `MARKUP` only), `tests/support/manuscript-md.ts` (a test-only renderer from blocks to Markdown: runs as `*`/`**`, quote `> `, heading `#`×level, scene break `\#`, one blank line between blocks) | `manuscriptOf` on each body input (the conto, each included chapter, the dedication, the epigraph), rendered, matches the matching slice of `expected/*.shunn-en.md` without the title block and chapter heading lines (2.3's real writer compares whole files); parity rules from G0c applied; a conto round-trips with no marker left |
| 1.4 Zip (Q1) | `core/zip.ts` | CRC32 vectors; the reader in `tests/support/` reads back every file |
| 1.5 Readiness (19) | `core/readiness.ts`, `publish/checks.ts`, `publish/strings.ts` (en and pt-BR for `unclosedHtmlComment`) | Publish tests unchanged and green; new `<!--` check with strings |
| 1.6 Classifier (16) | `core/classify.ts`, `core/books.ts`, `core/new-note-status.ts` | `submission` and `export` fields in every return, `submissionsRoot` and `exportRoot` filled; `classifyKey`; never tracked, never a work, no draft status; the `books.ts` fake test |
| 1.7 `notes.create` (17) | `core/notes.ts`, `core/note-text.ts` | Each `exists` policy, case clash, race and binary write tested on the fake vault |
| 1.8 Book source (18) | `core/book-source.ts`, `core/books.ts` (adapter; after 1.6 on that file) | Order, `compile: false`, and reads through `plugin.notes` tested |
| 1.9 Feature metadata (20) | `core/features.ts`, `core/feature-registry.ts`, the feature-count tests | 19 ids; a derived `FEATURE_PAGE` exported from `core/features.ts` and `switchesOf` from `core/feature-registry.ts` (the registry's private `switches()` calls it), **without touching `settings.ts`**; 2.1 swaps the imports, deletes the local copies and the hard-coded export row (a doubled export row until 2.1 is expected); `SETTING_FEATURES` entries for the 0.8 keys move from `["publish"]` to `["export"]` / `["submissions"]` in 2.1 |
| 1.10 Math blocks hide no comment (G0c, D9 reversed) | `core/markdown.ts`, `editor/context.ts` (the `$$` overlay moves into the segmenter or reads it), `tests/markdown-consumers.test.ts`, `tests/markdown.test.ts` | A line-start `$$` block in prose is math until it closes, and `%%` inside it is literal. Rows `mathWithPct` and `dollarInComment` updated, with D9's new rule in the header (a `D16` entry): `mathWithPct` finds its placeholder again and has no unclosed comment. Case C of G0c is a new row: `prosa fim` visible, `%% z %%` a comment. No other row changes, or each change is listed |

**Opus judge** after the wave: the diffs against the contracts. Is any decision made in
code that this plan didn't settle?

**Wave 1 result (2026-10-05).** Done, committed as `a206a3a`. Typecheck, 2,593 tests,
build and bundle check pass. Bench on 3,020 notes, longest block:

| Index | Total | Longest block | Phone estimate (× 5) |
|---|---|---|---|
| placeholders | 59 ms | 13 ms | about 65 ms |
| threads | 45 ms | 16 ms | about 80 ms |
| mentions | 3.6 s (was 4.2) | 23 ms (was 125–155) | about 115 ms |
| all three at once | 3.6 s | 26 ms | about 130 ms |

Each index alone meets the 20 ms target within noise, matching G0d's 22 ms in Obsidian.
Three indexes at once stretch the gap, because each keeps its own slice. Re-measure "all
three" after 2.4 starts mentions on demand.

`findNames`: 3k words 2.9 ms (was 4.8–5.4), 10k words 10.8 ms (was 12.1–12.9).

The judge accepted the builders' decisions:
- An optional `onDemand` and `NewNotePlace` flags.
- Pure helpers in `note-text.ts`.
- `notes.create` retries a race once, and only `replace` overwrites.
- 1.9 added `settings.features.submissions` strings to `src/strings.ts`.

Follow-ups from the judge:
- **The `bookSource(app, plugin.books, plugin.notes, () => plugin.settings)` factory:**
  2.5 and 3.1 call it, with no new plugin service.
- **3.4 shrinks:** 1.5 already made `runChecks` read `readinessOf`, so 3.4 only checks
  that publish behaves the same.
- **2.1:** also rewords `settings.features.export` and `.desc` to "Export", dropping
  "and submissions" and the "in 0.8" tag.
- **4.2:** a changelog and guide line. Notes in the submissions folder (default
  `Submissions`) and the export folder are never counted or treated as works; change
  the folder in settings if you already use that name.
- **4.3:** rule 8 prefers `vault.process` to `vault.modify` for `notes.create`'s
  `replace` on text.

Two fixes landed after the wave:
- A `<!--` in the middle of a line no longer cuts the rest of a manuscript (only a
  line-start one does, as in Reading view).
- One math rule: `core/markdown` owns math lines (`inMath`), and the editor reads it.

## Wave 2: consumers (parallel, Sonnet)

| Task | Owns | Done when |
|---|---|---|
| 2.1 Settings shell (11) | `settings.ts`, `main.ts` (`saveSettings`), `tests/support/obsidian.ts` (`Setting` stub records rows) | The tab draws the core sections plus each loaded module's section from one order list; `saveOnCommit`; the import-boundary test; the hard-coded export row gone. **Opus reviews this task before 2.2 starts.** |
| 2.2 Module sections (11) | `<module>/settings.ts` and `<module>/index.ts` for goals, publish, outline, placeholders, darlings, typing, lens, desk, snapshots, explorer, universe, threads (split across 3 agents by module) | Every `EscritaSettings` key drawn by exactly one owner or a switch; same look as today; `offNotice` moved per module |
| 2.3 Writers (Q10) | `src/export/writers/markdown.ts`, `docx.ts`, `src/export/presets.ts`, `core/export-pipeline.ts` (fills `exportDocOf`, `droppedIn`, `aboutCount`, `chapterHeadings`, `fillTemplate`) | Markdown output matches the fixtures; DOCX XML matches the Shunn and pt-BR rules in N 7 (unzipped in tests); G0a passed |
| 2.4 Index specs on `classifyKey` (16), mentions on demand (14), dots, threads (23) | `core/works-index.ts`, `explorer/index.ts`, `placeholders/index.ts`, `universe/threads.ts`, `universe/entries.ts`, `universe/mentions-index.ts`, `universe/index.ts`, `universe/create.ts` | Six specs compose `classifyKey`; mentions demand plus `settleMs` 4 s; "counting" shown on first open; dots redraw changed paths; threads use `segmentDoc` |
| 2.5 Callers on `notes.create` (17) and the book source (18) | `darlings/index.ts`, `desk/home-note.ts`, `lens/ui.ts`, `outline/index.ts`, `outline/view.ts` (the port only), `outline/rows.ts` | Seven create sites use one call with their old policy; `chaptersPort` gone from the view; outline tests green |
| 2.6 Lens memos and the name fold (22, 10; if room) | `lens/measures.ts`, `lens/syllables.ts`, `core/sentences.ts`, `universe/entries.ts` (fold only, after 2.4) | Same lens results; bench shows the pass ≥ 20% faster |

**Opus judge** after the wave.

## Wave 3: features (parallel, Sonnet, gated by G1 and G2)

| Task | Owns | Done when |
|---|---|---|
| 3.1 Export module | `src/export/index.ts`, `modal.ts`, `strings.ts`, `settings.ts` | Command for a note and its book; modal per mockup; readiness warnings; file written through `notes.create`; budgeted yields while building a long book; the preview writer (Q16, `writers/preview.ts`); last export and "Export again" (Q17), following renames; lifecycle test |
| 3.2 Submissions module | `src/submissions/index.ts`, `modal.ts`, `logic.ts`, `strings.ts`, `settings.ts` | "Record a submission" creates a note with `work`, `market`, `sent` and `result`; the pending index; renaming the work keeps the link; notes read well with Escrita off; lifecycle test |
| 3.3 Desk pending count | `desk/works.ts`, `desk/render.ts`, `desk/strings.ts` | "2 pendentes" next to ready while submissions is on; redraw on its change; desk tests |
| 3.4 Publish on readiness | `publish/index.ts` | Same behaviour (1.5 already moved `runChecks` onto `readinessOf`; check only, no change expected) |

## Wave 4: docs (Sonnet), then review (Opus)

- **4.1** `docs/guide/en/publishing.md` and `pt-BR/publishing.md` cover the publish
  check, export and submissions. `other-plugins.md` in both languages covers N 6,
  re-checking each plugin's maintenance with the date checked, and running next to
  StoryLine. Use Brazilian terms (`versão`, not `instantâneo`).
- **4.2** Write-backs:
  - ARCHITECTURE.md: the export module, the core pieces, the editor-writes rule (Q9)
    and the settings sections.
  - CONTEXT.md: the services list, the feature count and the weak spots.
  - Spec deviations into N 7, SF 12 and IMPROVEMENTS.
- **4.3 Opus release review:** `/code-review high` over the branch, data safety (rule 1)
  on every write path, rule 8 on `createBinary`, and the bench numbers against Wave 1.

## Manual verification on `~/projects/website/escrita/`

- **Export a conto from `Contos/` to DOCX (Shunn and pt-BR).**
  - Open the file in LibreOffice and Word.
  - Check the header, the title page count, `#` scene breaks, travessão dialogue kept,
    and no `%%` text.
- **Open both presets' DOCX in Word and Pages** (the rest of G0a): no repair prompt, header numbers, page breaks, spacing.
- **Export a test book with a "Prólogo".** Check the chapter headings and that the
  `compile: false` chapter is left out.
- **Submissions.**
  - Record a submission for a conto, then rename the conto: the link must follow.
  - The home block must show the pending count.
  - Turn submissions off: the count and the settings section must go.
- **Settings tab.** It must look the same as 0.7. Typing in a folder field must not
  reload features per key.
- **Universe on, startup.** No mentions pass until "Appears in" is opened. Typing in a
  10k-word chapter must not recompute mentions.

## Release checklist (CONTEXT.md, "Working process")

- **ROADMAP.md:** move 0.8 to "Shipped".
- **README.md:** changelog.
- **Guide pages:** written in both languages (4.1).
- **IMPROVEMENTS.md:** move 11, 14–21 and 23 (and 10 and 22 if done) to "Done".
- **Topic roadmaps:** N 6, N 7 stages 1–2 and SF 12 marked shipped.
- **Plan 0.9** in ROADMAP.md.
- **Version:** `npm version minor --no-git-tag-version`; commit as `0.8.0`, then tag and
  push.

## Risks

- **DOCX fidelity.** Hand-written OOXML can open with a repair prompt. G0a gates the
  writer. Keep the XML to the minimal parts Word needs: content types, rels, document,
  styles, settings, header.
- **Settings refactor breadth.** Twelve modules move code at once. 2.1 lands and is
  reviewed before 2.2 fans out; the "drawn by exactly one owner" test catches dropped
  rows.
- **Mentions on demand.** The first open shows "counting" for a few seconds on a big
  vault. Accepted; it is the trade the measurement supports.
- **Release size.** Many items, mostly S. The cut line above says what moves first.
