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

None at the moment.

## Done

| Version | Improvement |
|---|---|
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
