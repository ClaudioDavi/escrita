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
- The simplify review of the 0.9 diff on 2026-10-07: candidates 24–32.
- A full cleanup review of `src/` on 2026-10-08, on the 1.0 branch (seven reviewers, one per
  area plus a cross-module sweep): candidates 33–50, the seams added to candidate 5, and the
  known issues below. Its main finding: there is almost no copy-paste (5 blocks over 6 lines),
  but the same small idiom is written 5 to 60 times with drifting rules, because `src/ui/` and
  the core path helpers offer too little.

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
- **Seams (review of 2026-10-08).**
  - `ChapterOps.trashChapter(book, file, { onlyIfBlank })` in core: trash and renumber as one
    queued operation. Today "trash, then renumber" is written three times (`view.ts:1334`,
    `:1348`, `:1416`), and the trash runs outside the ChapterOps queue.
  - `outline/chapter-edits.ts`: a class over a small port (`notes.text`, `chapterOps`,
    `processFrontMatter`) with `setSummary`, `setBeat`, `insertBeat`, `removeBeat`,
    `appendBeat`, `addFirstBeat`, `beatToChapter` and `chapterToBeat`. Each returns a result
    or a reason, never a Notice. `act()` keeps only focus and `dataset.done`. "Create first,
    then remove the beat" and "re-check blank before trashing" become testable with a fake
    port.
  - One row builder: `loadNote` (`view.ts:311`) and `toViewRow` go; `rows.ts` returns the
    summary and status as written, so the view and the board stop re-reading frontmatter.
    `str` and `oneLine` live in `rows.ts` only.
  - A pure `reorderLive(shown, live, from, to)` in `model.ts`, from `moveChapter`.
  - `outline/fields.ts` for `makeField`, `buttonize` and the caret helpers, which hold no view
    state; `syncBeats` and `renderHints` for the two copied patch and hint loops.
  - In `goals/progress-modal.ts`: one pure `pacingMessage(p, { kind: "book" | "piece" })` in
    `goals/pacing.ts` for `renderPacing` and `renderPiecePacing` (the same decision tree), and
    `numberInput`, `setOrDelete` and one `editProps` wrapper for the 4 + 5 + 2 copies in the
    two settings renderers.

### 24. One counts interface on the names port, and "create entry" as a universe port

**Strength:** medium, small · **Pairs with:** U 2.5

- **Problem.** The cross-work name counts are plumbed through three layers: `NamesIndex`, the
  provider's `deps.counts` (`universe/names-provider.ts`), and the port's `workCount`,
  `wantNameCounts`, `countsVersion` and `onCountsChange` (`core/names-source.ts`). "Create
  entry" is forwarded through three too: the lens calls `names.createEntry`, the port calls the
  provider, the provider calls back into `UniverseModule`. Neither is about names.
- **Change.** One `NameCounts` interface implemented by `NamesIndex`; the provider exposes
  `counts?`, and the port returns a null object while there is none. "Create entry" becomes a
  universe port the lens reads through `features.get`, like the desk reads `pending`.
- **Wins.** Fewer pass-through methods; the names port answers names only.

### 25. Export "parts": one value for a book and a collection

**Strength:** medium · **Pairs with:** SF 13, N 7

- **Problem.** `export/index.ts` branches on book or collection in several places (the holder,
  the title, the chapter list, the missing links). And the build key holds the format, so
  switching to or from EPUB in the modal rebuilds the manuscript although only the writer changes.
- **Change.** `targetOf` builds one `Parts` value `{ holder, title, kind: "book" | "collection",
  chapters(), missing }`, and the callers read it. The build key leaves the format out.
- **Wins.** The book and collection branches go; a format switch costs a write, not a build.

### 26. "Read the book" renders per chapter, not per paragraph

**Strength:** speculative until measured · **Pairs with:** G0d

- **Problem.** `outline/reader-view.ts` calls `MarkdownRenderer.render` once per paragraph. A
  long book makes thousands of render calls, each with its own setup.
- **Change.** Render one chapter (or a chunk of paragraphs) per call and zip the rendered
  children back to the blocks the click-to-line and scroll restore need. Measure against G0d
  first: keep it only if it is faster in Obsidian.
- **Cost.** The children-to-blocks zip must survive Markdown that renders to more or fewer
  elements than it has blocks (lists, tables, callouts).

### 27. One property-link parser and `books.resolveLink`

**Strength:** medium · **Pairs with:** candidate 9, export

- **Problem.** A link in a property is parsed in four places: `core/scope.ts` `linkText`,
  `export/logic.ts` `linkTarget` and `coverLink`, and `core/markers.ts` `linkTarget`. It is
  resolved by hand in `core/books.ts`, twice in `export/index.ts`, and in the universe. They
  disagree at the edges: an unquoted `[[x]]` in YAML is a nested list, which some read and others
  don't (the dedication and epigraph, for example).
- **Change.** One core parser for a property's link value (string, quoted link, nested list) and
  one `books.resolveLink(value, from)`; every caller goes through them.
- **Wins.** Every property link reads the same way; one test file pins the YAML shapes.

### 28. The names index shares the mentions index's segmentation

**Strength:** speculative · **Pairs with:** candidate 12

- **Problem.** The `universe-names` index reads and segments every universe note a second time,
  next to the mentions index, which already did both for the same files in the same settle.
- **Change.** Share one read and one `segment()` per file per settle between the two specs (the
  hub hands the same `Markdown` to both), or merge them into one content spec.
- **Cost.** Candidate 12 found segmentation cheap (under 1%); the read is the real saving.
  Measure on the 3,020-file bench before building.

### 29. Memoize the unlinked rows

**Strength:** small

- **Problem.** `UniverseModule.unlinkedFor` re-reads, re-segments and re-matches the note every
  time the panel draws, even when nothing changed.
- **Change.** Keep the rows per (path, text version, names version) and answer from them while
  all three hold.
- **Wins.** A panel redraw with no edit costs nothing.

### 30. One Run-to-Markdown serializer in core

**Strength:** small · **Pairs with:** N 7

- **Problem.** Turning manuscript runs back into Markdown is written twice: in
  `outline/reader-model.ts` and in `export/writers/markdown.ts`. A fix to one (escaping, a new
  run kind) misses the other.
- **Change.** Move it to core, next to the manuscript model, and have both call it.

### 31. A core accessor for `vault.getConfig`

**Strength:** small

- **Problem.** `export/collection-menu.ts` (the file explorer's sort order) and
  `universe/view-unlinked.ts` ("Use [[Wikilinks]]") both cast the vault to reach the untyped
  `getConfig`.
- **Change.** One typed helper in core (for example `vaultConfig(app, key)`), listed among the
  exceptions in "Conventions" as the one place that reads it.

### 32. The outline's serial line from the loaded chapter rows

**Strength:** speculative, small · **Pairs with:** N 4

- **Problem.** The outline builds its serial line (`core/serial.ts`, `outline/header.ts`) by
  reading the chapters again, although it already loaded every chapter row (`outline/rows.ts`).
- **Change.** Build it from the rows. They lack the include flag, the number and the date the
  serial model reads, so the rows would gain those fields first.
- **Cost.** Wider rows for one line; only worth it if the second read shows up in a profile.

### 33. Path helpers in core

**Strength:** strong, small · **Pairs with:** every module

- **Problem.** Path strings are handled by hand all over `src/`:
  - "Parent of a path": 6 definitions (`core/classify.ts:367`, `placeholders/logic.ts:291`,
    `snapshots/store.ts:90`, `snapshots/fs.ts:22`, `universe/migrate-plan.ts:8`,
    `export/logic.ts:244`).
  - "Name without `.md`": 7 named copies and about 10 inline ones; some strip `.md`
    case-sensitively (`outline/rows.ts:81`, `core/serial.ts:102`).
  - "Add `.md` if missing": 10 sites. `core/scope.ts` has `withMd` and `noMd` but keeps them
    private.
  - Trimming slashes from a folder: about 25 copies in 4 variants; only some handle `\` and
    `//` (`classify.ts:232`, `export/logic.ts:85`, `lens/settings.ts:7`,
    `universe/settings.ts:109`).
  - "Is inside a folder": 7 versions that disagree on an empty folder. `scope.inFolder("")` is
    true, `path-keys.isUnder("")` is false. And `export/logic.ts:84 inFolder` is a path join
    with the same name as core's containment test.
- **Change.** `core/paths.ts` (or `path-keys.ts`): `parentOf`, `baseName`, `noteName`,
  `withMd`, `cleanFolder`, and one `isUnder(path, folder, { emptyMatches })`. Rename the export
  join to `joinPath`. Pin the edge cases in a test first; adopting the full slash rule
  everywhere changes behaviour for `\` input, so decide it on purpose.
- **Wins.** One rule per path question; most of candidates 34 and 41 get shorter.

### 34. Navigation helpers in `src/ui/`

**Strength:** strong · **Pairs with:** known issue "beat click"

- **Problem.**
  - "Open a note at a line" is written 9 times with different rules
    (`publish/index.ts:259` and `export/index.ts:520` byte for byte, `outline/view.ts:1491`,
    `ui/open-work.ts:57`, `universe/view-parts.ts:51`, `universe/appears-in.ts:171`,
    `placeholders/index.ts:268`, `darlings/index.ts:407`, `outline/reader-view.ts:357`). Only
    some reuse a leaf that shows the file, clamp to `lastLine()`, pass the cursor in `eState`
    or leave Reading view.
  - "Find the leaf that shows a path" is written three more times (`placeholders/index.ts:236`,
    `lens/ui.ts:140`, `desk/home-note.ts:47`); `core/notes.ts:79` already does it.
  - "Reveal a sidebar view, or create it": 6 identical bodies (`outline/index.ts:199`,
    `placeholders/index.ts:220`, `darlings/index.ts:137`, `snapshots/index.ts:208`,
    `lens/ui.ts:199`, `universe/view.ts:409`). "Refresh every view of a type": 8 loops.
  - "Reveal in the file explorer" twice (`export/index.ts:501`,
    `universe/view-entries.ts:185`), and the `app.setting` cast that opens the settings tab
    three times (`lens/ui.ts:211`, `editor/template-insert.ts:50`, `universe/view.ts:313`).
    ARCHITECTURE lists each cast as its own exception.
- **Change.** `src/ui/leaves.ts`: `openNoteAt(app, file, at, { leaf, source })`,
  `markdownLeafFor(app, path)`, `revealSideView(app, type)`, `viewsOf(app, type, Class)`,
  `revealInExplorer(app, file)` and `openSettingsTab(plugin)`. The casts become one listed
  exception each (with candidate 31).
- **Cost.** Each caller's current quirk needs a decision; check the leaf choice by hand in
  Obsidian.

### 35. Confirm dialogs, "Cancel" and error notices in one place

**Strength:** medium, small

- **Problem.**
  - `desk/home-note.ts:11-44` is a copy of `ui/confirm.ts`. `darlings/view.ts:170-207` is a
    third variant with better behaviour (disables the button, catches an async error, focuses
    Cancel on a warning). `export/modal.ts:660` `WhereModal` is a fourth.
  - `ui/confirm.ts:29` reads `outline.cancel` and `ui/open-work.ts:17` reads
    `desk.notice.missing`: shared UI depending on module strings. "Cancel" exists under 11–15
    keys.
  - 27 pairs of `console.error` followed by `new Notice` in 13 files; `outline/errors.ts`
    `reportError` already does this for the outline only.
- **Change.** `confirmAction(app, { title, body, confirm, warning })` with the darlings
  behaviour and a node body (for the monospace path spans); delete the copies. `common.cancel`
  and `common.missing` in `src/strings.ts`. `reportError` moves to `src/ui/`.

### 36. Settings rows, with fallbacks from the install's defaults

**Strength:** strong · **Pairs with:** known issue "English defaults in the settings tab"

- **Problem.** `SettingsUi` offers almost nothing, so each section builds its rows by hand: 18
  toggle rows, 36 `saveOnCommit` text rows, 4 hand-built number fields in
  `goals/settings-ui.ts:15-37`, three integer parsers (`settings.ts:364` `clampInt`, `:438`
  `digitsNumber`, the lens's own), 10 raw `change` listeners that skip `saveOnCommit`
  (`universe/settings-ui.ts`, `lens/settings-ui.ts`), and three local row helpers
  (`settings.ts:570`, `export/settings-ui.ts:14`, the lens's `numberRow`). The fallbacks and
  placeholders read the English `DEFAULT_SETTINGS`, which is the known issue.
  `snapshots/settings-ui.ts:15-47` re-implements `addFolderField`.
- **Change.** `SettingsUi.defaults()` returns `defaultsFor(settings.defaultsLanguage)`.
  `src/ui/settings-rows.ts` has `toggleRow`, `textRow` and `numberRow { min, max }`, keyed by
  setting name and taking their fallback from `defaults()`. `addFolderField` takes an optional
  problem text so snapshots uses it. Sections become lists of rows.
- **Wins.** About 40% fewer lines in the section files; one place for commit, trim and
  fallback.

### 37. Split `settings.ts`, and module strings follow their sections

**Strength:** medium · **Pairs with:** candidates 11 and 20 (done)

- **Problem.** `settings.ts` (968 lines) holds the schema and defaults (`:19-300`), loading and
  normalizing (`:302-371`, with `typeof s[k] === "string" ? s[k].trim() : ""` written about 12
  times, and run twice on a fresh install), the visibility rules (`:373-433`) and the whole tab
  (`:478-968`, including the Features page and the stages). 68 `settings.*` keys in
  `src/strings.ts` are used only by module code, while export and submissions use their own
  namespace.
- **Change.** `settings.ts` keeps the schema and defaults; `settings-load.ts` normalizes with a
  `str()` helper; `settings-tab.ts` draws the tab, with `ui/features-page.ts` and
  `ui/stages-settings.ts`. Move the module keys into each module's `strings.ts` (the names can
  stay). Keep `tests/settings-imports.test.ts` green. `SECTION_ORDER.also` should derive from
  the rows the core draws, not restate `SETTING_FEATURES`.

### 38. Editor glue and "reveal on touch" in `src/ui/`

**Strength:** strong · **Pairs with:** 0.5.1's lens retry

- **Problem.**
  - A set of open editors, a refresh `StateEffect` and a broadcast loop are written four times
    (`lens/decorations.ts`, `editor/dialogue-focus.ts`, `universe/name-marks.ts`,
    `universe/appears-in-widget.ts`), and they treat a failed dispatch three ways. The lens
    retries once in a microtask (its comment at `decorations.ts:173` says why); dialogue focus
    drops the editor for good, which is the failure that comment warns about; the name marks
    catch nothing, so a throw goes back into the names provider's emitter.
  - "The file of an editor state" is written four times, the Live Preview check twice, the
    `editor.cm` cast twice in `lens/ui.ts`.
  - `placeholders/decoration.ts:46-101` and `outline/ghost.ts:36-90` are the same plugin: scan
    with `segmentDoc`, rebuild on text, selection, viewport or mode, show raw text when the
    selection touches an item and a widget when it doesn't.
- **Change.** `src/ui/editor-glue.ts`: `EditorSet` (add, delete, `broadcast(spec)` with the
  lens's retry), `fileOfState`, `isLivePreview`, `cmOf` (the `cm` exception in one place).
  `src/ui/reveal-on-touch.ts`: `revealOnTouch({ scan, raw, rendered })`.
- **Wins.** One failure policy; about 80 lines gone; the next marker kind is one call.

### 39. Line predicates in `core/markers.ts`

**Strength:** medium · **Cost:** behaviour changes at the edges

- **Problem.** Nine regexes test for a heading, in five variants (`editor/enter-flow.ts:20`,
  `editor/move-blocks.ts:41`, `lens/analyze.ts:20`, `lens/lists.ts:32`, `core/dialogue.ts:32`,
  `core/sentences.ts:71`, `core/wordcount.ts:51,100`, `core/manuscript.ts:116`); `/^#{1,6} /`
  misses an indented `   ## x`. The list-item regex is written three times, the math-block one
  twice, and `enter-flow.ts:22`'s table test (any line starting with `|`) disagrees with
  `isTableLine`. `isProseLine` (`enter-flow.ts:37`) lives outside `markers.ts` and re-segments
  each line.
- **Change.** `isHeadingLine`, `isListItemLine` and `isMathOpenLine` next to
  `isSceneBreakLine`, taking `(md, i)`. Pin today's behaviour per caller first; the lens's echo
  window would start resetting at indented headings.

### 40. Ranges in core

**Strength:** small

- **Problem.** `{ from, to }` is declared 5 times and written inline 28 times. `MapPos` and
  "map ranges through a change, drop collapsed ones" exist in `lens/marks-model.ts:7-30` and
  `universe/name-marks-model.ts:43-51`. The visible-range filter exists three ways: a binary
  search in `lens/analyze.ts:67` (an odd home), a linear scan of every mark per window on every
  scroll in `name-marks-model.ts:59`, and a linear `some` in `placeholders/decoration.ts:53`.
- **Change.** A pure `core/ranges.ts`: `Range`, `MapPos`, `mapRanges`, `overlapping(sorted,
  from, to)`, `rangeAt`.

### 41. Small shared helpers in core

**Strength:** medium, each small

- **Timers.** The window `IndexTimers` is built 5 times (`core/vault-indexes.ts:25`,
  `snapshots/stage-feature.ts:26`, `lens/index.ts:80`, `universe/index.ts:116`,
  `export/index.ts:235`); lens and snapshots still yield with `setTimeout(0)`. Add
  `windowTimers()` and make `now` required. Six hand-written debounces could use Obsidian's
  `debounce`.
- **Setting followers.** "A folder setting follows a rename" is written 3 times
  (`export/index.ts:59`, `submissions/index.ts:90`, `snapshots/index.ts:519`), the note
  version twice (`desk/index.ts:83`, `lens/index.ts:63`). Add `settingFollower(plugin, key,
  "folder" | "note")`.
- **Saved-data cleaners.** Six copies of the path-keyed cleaner skeleton (`data.ts:103,130`,
  `core/left-off.ts:111`, `outline/pov.ts:38`, `lens/dismiss.ts:72`,
  `universe/first-seen.ts:21`) and five `isRecord`s. Add `core/records.ts` with `isRecord` and
  `cleanRecord(raw, cleanEntry)` that keeps own keys only. `history` and `publish` are loaded
  unchecked (`main.ts:236`). Export's `ExportChoice` types and cleaners move out of `data.ts`.
- **Files by path.** 58 checks of `getAbstractFileByPath` then `instanceof TFile`, four local
  `fileAt` helpers, two private `frontmatter()` copies (`publish/index.ts:130`,
  `export/index.ts:158`). `minAppVersion` is 1.8.7, so use `vault.getFileByPath` (add it to the
  test fakes) and `books.frontmatter(file | path)`.
- **Note settings.** One `readTemplate(app, setting)` for `core/chapter-ops.ts:98` and
  `universe/index.ts:475`, built on `withMd` (candidate 33). One `resolveHomeNote` for the
  desk and setup (the known issue).
- **Dates and numbers.** Six short-date formatters (`i18n.ts:54`, `outline/header.ts:289`,
  `export/logic.ts:145,154`, `universe/panel-model.ts:98`, inline `"ll"` in
  `darlings/view.ts:139`). Add `fmtDayMonth` and `fmtWhen` in `i18n.ts`; export keeps its
  manuscript language as a parameter. `fillTemplate` (`core/export-pipeline.ts:227`) repeats
  `t()`'s `{name}` replacer.

### 42. Typed feature ports

**Strength:** medium · **Pairs with:** candidate 24

- **Problem.** `features.get<T>` (`core/feature-registry.ts:91`) casts the module to whatever
  `T` the caller names, and each port grows its own shim (`core/writing-mode.ts:41`,
  `core/daily-progress.ts:29`, `desk/gather.ts:15`, `outline/view.ts:669`). A renamed port
  returns `undefined` at runtime instead of failing to compile.
- **Change.** A `FeaturePorts` map in core (`{ desk: WritingModeHost; goals: DailyProgressHost;
  submissions: PendingSource; publish: PublishNextPort }`) and `port<K>(id)`. Candidate 24's
  "create entry" port lands there. `pendingOf` joins `core/pending.ts`.

### 43. Required classifier settings, and one plugin-folder root

**Strength:** medium

- **Problem.** `ClassifySettings` fields are optional "so the many hand-built test settings
  stay valid" (`classify.ts:64-91`). That spreads fallbacks (`classify.ts:457,474,487`,
  `works-index.ts:58`, `desk/gather.ts:74`) although `settings.ts` normalizes them at load. The
  three folder roots take the language unevenly: `submissionsRoot` and `exportRoot` do,
  `inSnapshots`, `classifyKey`, `folder-problem.ts:16`, `vault-indexes.ts:56` and nine callers
  in export and submissions don't. Harmless only because load fills blanks.
- **Change.** Required fields; a `classifySettings(partial)` test builder on
  `defaultsFor("en")` (about 21 test files); one `pluginRoot(kind, settings)`.

### 44. Threads own their code

**Strength:** medium · **Pairs with:** candidate 6 (done)

- **Problem.** Threads became a feature in 0.7, but `threads-feature.ts` imports its UI from
  universe files: about 260 lines of `universe/create.ts` (`:307-564`) are thread code, the
  thread writes (`closeThread`, `reopenThread`, `answerLink`) live on `UniverseModule`
  (`index.ts:440`), `ThreadsView` is in `universe/view.ts`, and the universe forwards back to
  `plugin.threads` (`index.ts:392`). `threadsOf`, `firstSeen` and `isReady` have no callers.
  `inScope` (`threads.ts:77`) is a scope predicate other files import from the threads model.
- **Change.** `universe/threads-ui.ts` for the thread half of `create.ts`; the writes move to
  `ThreadsFeature`; `ThreadsView` gets its own file; `inScope` moves to `core/scope.ts`; delete
  the dead methods. Move `CreateEntryError` to `new-entry.ts` so `create.ts:266` can use
  `instanceof` instead of comparing the error's name.

### 45. Universe strings and indexes

**Strength:** small to medium

- **Strings.** Five strings files (`strings.ts`, `view-strings.ts`, `create-strings.ts`,
  `migrate-strings.ts`, `strings-appears.ts`); `universe.appears.*` is split across two of
  them. Merge into one, or keep the split but register every part in `main.ts` and test it
  (the known issue). Drop the "BUILDER A/B owns this file" and "owned by 5.1" comments and the
  stale ones in `index.ts:5-12` and `create.ts:560`.
- **Indexes.** `MentionsIndex` and `NamesIndex` repeat the on-demand lifecycle (`start`,
  `demand`, `isReady`, `onChange`, `dispose`), the `include` predicate, most of the settings
  key, the 4000 ms settle and the `add(map, key, path)` helper. A `DemandIndex<V>` base, one
  `universeNotesInclude(settings)`, and `add` in `core/lists.ts`. Drop the `started` getters
  and `MentionsIndex.workCount`. Ground for candidate 28.
- **Links and info.** `UniverseInfo` is built twice (`index.ts:319`, `view.ts:203`) and the
  `[[Universe]]` value four ways; the create modal's preview (`create.ts:210`) uses the bare
  basename while the note gets `fileToLinktext`. One `universeInfo(note)`; the preview calls
  `universeLinkValue`.

### 46. Export writers share the title page; the modal splits

**Strength:** medium · **Pairs with:** candidates 25 and 30

- **Problem.** The count line, contact lines, byline and `minHeading = book ? 3 : 2` are worked
  out separately in `export/writers/docx.ts`, `markdown.ts`, `epub.ts` and `preview.ts`; the
  preview "can't drift from the file" only by copy. `epub.ts:23` imports `xmlEscape` from
  `./docx`, and `export/source.ts:9` imports `EpubCover` from a writer. `export/modal.ts` (714
  lines) holds four classes and repeats what the module knows: the heading format
  (`modal.ts:128`, `index.ts:206`), the state from the last export (`modal.ts:498`,
  `index.ts:306`), `baseName` (`index.ts:42`, `modal.ts:81`). Export reads properties three
  ways (`frontPages` trims, `readCover` doesn't, the compile property ignores case).
- **Change.** `titlePageOf(doc, preset)` and `minHeadingOf(doc)` next to `aboutCount` in
  `core/export-pipeline.ts`; `writers/xml.ts`; `EpubCover` in the pipeline. `stateOfLast` and
  `headingFormat` in `logic.ts`; the three small dialogs in `export/dialogs.ts`; a
  `sentenceWithPath` helper; stop exporting `ChaptersModal`. Every property goes through
  `propertyValue`. The fixture outputs pin it byte for byte.

### 47. The lens prepares each pass once

**Strength:** small to medium

- **Problem.** `layout(toks, sents)` runs up to five times per pass (`rules-words.ts:71, 90,
  119, 214`) and `inferredNames` twice. The list entries become sets three ways (`ignoreSet`,
  `nameSet`, `listWords`), so one "Ignore" entry reads differently in the word and stem rules.
  The capitalized test is in `rules-stem.ts:137` and `core/name-runs.ts:57`, the sentence
  starts in `name-runs.ts:74` and `layout().first`. `nameVariants` takes a `sentStarts` it
  ignores. `measuresFor` only forwards, and `EMPTY_MD` exists to feed it. `activeState`
  (`lens/index.ts:295`) builds the full options, and so asks for name counts, on every panel
  draw. The rule-label choice for `gerund.en` is written five times.
- **Lists note.** `lens/lists.ts:39` and `lens/lists-edit.ts:75` detect frontmatter and `%%`
  by hand, against the `segment()` convention; a `## Names` inside a code fence opens a section.
- **Change.** Build `layout`, `inferredNames` and the list sets once in `analyze` and pass them
  in; keep the three normalizations as they are (merging them changes behaviour).
  `isCapitalized` and `sentenceStarts` next to `core/sentences.ts`. `rangeMeasures` replaces
  `measuresFor`. One `ruleKey(rule, lang)`. Both lists files walk `segment(text)`.

### 48. Things in the wrong place

**Strength:** small, each S

- `main.ts:180-218` holds the "draft new notes" behaviour; it becomes a `CoreModule` like setup.
  `VaultIndexes` (`main.ts:66`) moves into `core/vault-indexes.ts`; today `core/vault-indexes.ts`
  and `core/works-index.ts` import from `../main`.
- `core/chapter-ops.ts:97` creates chapters with `vault.create`; use `notes.create(path,
  content, { exists: "fail" })`.
- The snapshot store counts words (`store.ts:125`) but every caller passes `words` too
  (`snapshots/index.ts:339,388`, `stage-feature.ts:69`); `take()` counts, and `day` defaults to
  an injected `today()`.
- `goals/index.ts:306` notifies every daily-progress listener on each status repaint (each
  selection change and each sprint second); notify only when `{ words, goal }` changes.
- Progress bars are drawn in five places (`outline/bar.ts:57`, `goals/progress-modal.ts:248,
  301`, `outline/view.ts:603,656`) with three width computations; `setWidth` lives in
  `goals/status-bar.ts`. A `barState` in `core/piece-bar.ts` and `renderProgressBar` in
  `src/ui/`. `statusColor(x, stages, otherStatusColors)` is spelled out four times.
- The darlings, snapshots, threads and reader view ids are not in `core/view-types.ts`.
- `desk/gather.ts:74` re-reads the status word that `deskEntry` already read; add a
  `statusWord` field on the unstaged entry. `desk/works.ts:219` `under` is `isUnder`.
- Two exports named `PRESETS` (`core/feature-presets.ts:37`, `core/presets.ts:52`).
- `FeatureModule` and `CoreModule` duplicate `attach` and `ctx`.

### 49. Dead code and stale comments

**Strength:** small · **Cost:** tests move to the survivors

- Superseded but still exported, because tests import them: `book.ts:75` `planRenumber` (and
  its duplicate `PREFIX` regex), `wordcount.ts` `countWords`, `countCharacters` and
  `readerText`, `stages.ts` `parseStatusColors`, `atLeast`, `ownStages`, `stageRank` (while
  `works.ts:79` and `universe/works-list.ts:72` rank by hand), `chapter-plan.ts:8`'s template
  re-exports, `publish/checks.ts:55`'s `unclosedComment`.
- Unused: `DEFAULT_COMPILE_PROPERTY` (and `"compile"` hard-coded at `settings.ts:234` and
  `export/modal.ts:603`), `pluginFolders` (still documented in ARCHITECTURE),
  `DEFAULT_SUBMISSIONS_FOLDER`, `DEFAULT_EXPORT_FOLDER`, about 25 universe exports used only in
  their own file, `export` on `toViewRow`, `stageKey`, `sumDayBook`, `IDLE_MS` and others.
  `CheckLevel` repeats `ReadinessLevel`.
- 34 core comments name a plan task ("task 2.1", "until the setting exists", "in 0.10"); some
  are false now (`vault-index.ts:103`: "every index starts when ready", but mentions start on
  demand). `features.ts:24`'s `page?` can become required.
- `measure.ts:339` re-sanitizes what `pieceProgress` just did; `measure-cache.ts:47` `under`,
  `renamePrefix` and `forgetPrefix` repeat `path-keys` (a first slice of candidate 2's leftover).

### 50. Shared test helpers

**Strength:** small, no risk

- A `turn(on)` feature toggle is copied into 9 lifecycle tests, and two of them forget
  `registry.apply()`. Add `FakePlugin.turn(id, on)`.
- About 9 `TFile`-from-path builders fill different fields. Add `tfile(path, mtime?)` to
  `tests/support/obsidian.ts`.
- `VaultTree` fakes in 7 files. Add `tests/support/fake-tree.ts`.

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

None at the moment. The four from 0.2.1 were closed in 0.8.0 (see "Done").

## Known issues

Found by the review of 2026-10-08. Each is small; fix them before the refactors.

- **Beat click may land at the restored cursor.** `outline/view.ts:1491` sets the cursor after
  opening, which `ui/open-work.ts:57` says Obsidian's restore undoes; it doesn't clamp either.
  Unverified in Obsidian. Fix with candidate 34.
- **Smaller.** "Appears in" parses chapter numbers with its own regex (`appears-in-model.ts:42`),
  unlike `core/book.ts` (`3Title`, `03) X`). Export reads `Cover:` by exact key but `Compile:`
  ignoring case. `templatesFolder` and `globalDarlingsNote` don't follow renames.
  `submissionsOffNotice` calls `submissionsRoot()` without the language.

## Done

| Version | Improvement |
|---|---|
| 1.0.0 | Known issues from the review of 2026-10-08: the settings tab falls back to the install's language set (`SettingsUi.defaults()`, the first slice of candidate 36); one home note lookup for the desk and the setup (`core/home-note.ts`, exact, then NFC, then case-insensitive; pt-BR offers `Início.md` and still adopts `Inicio.md`; the setup no longer plans a second home note); darlings write through `plugin.notes`; dialogue focus and the name marks retry a failed dispatch once (`core/dispatch-retry.ts`, the failure-policy slice of candidate 38); "Appears in" strings registered in `main.ts` and in the parity test; saved-data cleaners skip `__proto__` (`core/records.ts`); the chapter template resolves to a Markdown file; `FakePlugin.turn` (part of candidate 50); stale plan-task comments in core |
| 1.0.0 | Shared helpers out of module folders (candidate 13): `core/block-context.ts`, `core/dialogue.ts`, `core/typography.ts` and `core/piece-bar.ts` in core; `ui/confirm.ts` and `ui/open-work.ts` in a shared `src/ui/`. Moved, not rewritten; export needs no `publish/checks` (it uses `core/readiness.ts`), so the module dependency list holds only runtime calls |
| 1.0.0 | One rule for a note's effective piece (candidate 8): `books.classify(x).piece` is the piece with the book's chapter default filled in, and `pieceSource` (`"own"`, `"book"` or null) says where it came from (`effectivePiece` in `core/measure.ts`, applied in `core/classify.ts`); the measurer, the outline rows, the explorer and the goals status bar read it (the progress window shows a chapter's book, not its piece), so a chapter's target agrees everywhere |
| 0.9.0 | Scope as one live answer (candidate 9, the fuller change): `books.classify(x).scope` is a plain field set through `scopeFor` in `core/scope.ts`, link resolution is `VaultTree.resolve`, `universe/scope.ts` and the outline's copy of `linkText` are gone, and `scopeKey` is split from `classifyKey`. On the 3,020-file bench `classify()` stays within the 10% budget (7.23 ms before; 6.5 ms with the mode off, 6.7–10.5 ms with it on); a lazy getter was measured slower and dropped |
| 0.8.0 | Loose ends closed: the publish check warns about an unclosed `<!--` (candidate 19's readiness checks); the classifier has a test with a small fake for the Obsidian side (`core/books.ts`, nested books); the Reading-view parity questions were checked in a real vault (G0c; D16, D18 and D19 follow it, and `%%` inside `$$` is now literal) and are pinned in `tests/markdown-consumers.test.ts`; and the editor-writes rule is written in ARCHITECTURE's conventions: an edit at the cursor of the editor that triggered it may write directly, and `plugin.notes` is for writes to any other note |
| 0.8.0 | One name fold in core (candidate 10): `universe`'s `foldText` is now `foldName` |
| 0.8.0 | Small redraws and re-reads (candidate 23) |
| 0.8.0 | Hot loops keep their caches across calls (candidate 22): the names matcher and the lens syllable counts, about 1.4× faster name matching and about 19% faster lens passes. The `normalizeWord` memo was not built (a core file, worth about 1 ms) |
| 0.8.0 | Index passes yield on a time budget (candidate 21): 8 ms, with a `MessageChannel` yield, and a slow index can settle longer (`settleMs`). The longest block on a 3,020-note vault goes from 125 ms to about 14–26 ms; the mentions index no longer recomputes on every save while typing |
| 0.8.0 | Foundations for export and submissions (candidates 15–19): the manuscript model, a note's prose as an editor receives it (15); `classifyKey` and the `submission` field (16); `notes.create`, with binary writes (17); the book source port (18); readiness checks in core (19) |
| 0.8.0 | The mentions index starts on demand (candidate 14): the first "Appears in" query builds it, so startup index work on a 3,020-note vault goes from about 4.2 s to under 0.1 s |
| 0.8.0 | Each module owns its settings section and feature metadata lives in one place (candidates 11 and 20): `core/settings-order.ts` names the order, `settings.ts` imports no module internals, and text rows save when the field is committed |
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
