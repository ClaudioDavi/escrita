# Escrita: context for working on this repo

Read this first. It says what Escrita is, where each decision is written down, and
the rules that decide most questions. It points to the docs instead of copying
them; when this file and a doc disagree, the doc wins (and fix this file).

## What it is

An Obsidian plugin for fiction writers (TypeScript, CodeMirror 6, esbuild, vitest),
inspired by NEO. Public and generic: any vault, any language, theme-friendly,
mobile-safe (`isDesktopOnly: false`). Portuguese first (pt-BR and English strings).
It is the **writing and revision** plugin; planning boards (corkboard, plot grid,
beat sheets) belong to StoryLine, and Escrita doesn't compete there.

Current version: see `manifest.json` (1.2.4 at the time of writing). The author's
next months are short fiction (contos, essays), so short-fiction features come first.

## Where things are written down

| Question | Read |
|---|---|
| What ships in which version, what's next | `docs/ROADMAP.md` (the index; start here) |
| Details of a feature (refs like SF 5, N 7, U 1.2) | `docs/ROADMAP-short-fiction.md` (SF), `docs/ROADMAP-novel.md` (N), `docs/ROADMAP-universe.md` (U), `docs/ROADMAP-screenplay.md` (SP), by section number |
| How the code is organized, module specs, conventions | `docs/ARCHITECTURE.md` |
| Code improvements to schedule | `docs/IMPROVEMENTS.md` |
| User-facing features, settings, commands, changelog, release steps | `README.md` |
| User guide, English and pt-BR (0.7: features and settings, writing, the world) | `docs/guide/en/` and `docs/guide/pt-BR/`, same file names; plan in `docs/ROADMAP.md`, "Documentation" |
| Background research (local only, git-ignored) | `reports/Obsidian fiction writing gaps.md`, `research_notes/` |
| Approved UI design (mockups) | design canvas https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6 |

## Non-negotiable rules

These decide most design questions. Full text in ARCHITECTURE.md, "Conventions".

1. **Data safety first.** Never lose or silently change prose. Anything that removes
   text moves it somewhere recoverable (darlings, trash, a snapshot) or asks.
2. **Suggest, never rewrite.** No feature changes prose without an explicit click.
3. **Fewer things to manage.** The writer should sit down and write, not run the
   plugin. A feature that needs upkeep from the writer has to earn it; prefer reading
   what they already do (a `status`, a target) over asking for more. This rule cut a
   works tab and a library view down to one plain block in a note.
4. **No network, no AI.** Never contact a server or a model. `tests/no-network.test.ts`
   fails on network APIs anywhere in `src/` (and in `main.js` via `npm run test:bundle`),
   even in a trailing comment.
5. **Standalone.** No feature assumes a website: no URLs, slugs, site build rules or
   files written for a site. "Publish" only checks a note and sets status and date.
6. **Generic first.** Every property name, status value, folder and word list is a
   setting with English defaults. The author's values live in their vault's
   `data.json`, never in code.
7. **Design first.** UI work gets mockups on the design canvas and approval before it
   is built.
8. **Obsidian community guidelines** (the plugin will be submitted): no `innerHTML`,
   no default hotkeys, `register*` for everything (through the module's `ModuleContext`), `vault.process` /
   `processFrontMatter` (only through `plugin.notes.frontmatter`) / `fileManager.renameFile` / `trashFile`, `normalizePath`, no
   Node or Electron APIs, no `console.log`. Exceptions are listed in ARCHITECTURE.md;
   don't add one without listing it there.

## How the code is shaped

- `src/main.ts` builds the services, then each module (`src/<module>/index.ts`,
  a `FeatureModule`). Modules: goals, outline, placeholders, darlings, editor, screenplay, lens,
  publish, export, submissions, explorer, snapshots, desk, universe. **They are switchable features** (20
  ids in `core/features.ts`; the editor is split into typing, dialogue focus, moving
  blocks, templates and spellcheck): the `FeatureRegistry` loads and unloads each from the
  writer's switches at runtime, and a module registers everything through its
  `ModuleContext`, never straight on the plugin. A module must unload cleanly and its
  path-keyed data must follow renames through a data follower even while it is off.
  ARCHITECTURE.md, "Modules and feature switches". Each module returns its own settings
  blocks (`settingsItems` in its `settings-ui.ts`, drawn by the declarative tab `src/settings-tab.ts` with the row helpers in `src/ui/settings-rows.ts`); the order of all sections is one
  list in `core/settings-order.ts`, and `settings.ts` imports no module internals. Every setting is one
  row of the table in `core/settings-schema.ts` (1.1.1): default, kind, the features that read it, the
  pt-BR word; add a setting there plus its field in `EscritaSettings`.
- **Shared services on `plugin`** (use them; never re-derive):
  - `books.classify(x)`: what a file is (chapter, book note, note…), its book,
    `tracked`, `piece`, `snapshot`, `stage`, `submission`, `export`, `own` (1.2.1: the darlings
    notes and the word lists note, never works), `scope` (0.9: which
    universe or book it lives in, from `core/scope.ts`; set whenever the universe mode is on,
    even with the feature off), `form` (1.1: short story, essay… or screenplay, from
    `core/form.ts`; set for any Markdown file, with the universe off too). Backed by
    `core/classify.ts`.
  - `measure`: every count shown or recorded (`core/measurer.ts`, cached by mtime).
  - `notes`: every write into a note's text (editor when open, else `vault.process`;
    check-then-replace through `core/note-text.ts`).
  - `notes.create(path, data, { exists, trashOld })`: every new file (text or binary).
    `exists` is `return`, `fail`, `unique` or `replace`; `replace` refuses a case-only
    clash, and `trashOld` sends the old file to the trash first.
  - `notes.frontmatter(file, fn)` (1.2.4): every property write. It saves the file's views first
    (`flush`), then calls `processFrontMatter`, which nothing else in `src/` calls
    (`tests/frontmatter-writes.test.ts`).
  - `decorations`: the only code that draws in the file explorer.
  - `chapterOps`: create, renumber, retitle chapters.
  - `features`: the registry; `features.isOn(id)` for a soft dependency on another feature. A
    module's port is read through `features.get` (the desk reads the submissions' `pending`
    port, `core/pending.ts`, and never imports that module).
  - `names`: the names port (`core/names-source.ts`); the lens, the name marks and the
    outline read names through it and never import the universe. The matcher is
    `core/names.ts`. Since 0.9 it also answers the lens's names rule: `isKnownName`,
    `workCount`, `wantNameCounts`, `createEntry` and a separate counts signal (all empty
    when the universe is off); the candidate runs are `core/name-runs.ts`.
  - `index`: the vault index hub (`core/index-hub.ts`): add a spec for a per-file
    index, or `follow` renames and deletes for path-keyed data. `works`: the live
    list of works, built on it.
  - `history`: the days of writing (`core/history-store.ts`, pure parts in
    `core/device-history.ts`, 1.2.3). Each device writes its own section of `data.json`
    (`devices`; `history` is the frozen base; `renames` is shared). Readers use
    `history.view()`, the merged sum; goals writes through `history.own()` and then
    `history.changed()`. Nobody reads `data.history` directly. Saves read the file first;
    it is read again on an external change, on focus and every minute, and each device keeps
    a backup of its section in local storage.
- **1.0 additions.** The setup is a core module (`src/setup/`, `CoreModule`), not a feature:
  it has no switch and is always in the palette. `core/feature-presets.ts` holds the four
  presets (three in 1.0; Screenwriter, the screenplay-only list of 11, in 1.2) (never touching the universe); `core/defaults.ts` holds the default sets per
  language (`defaultsLanguage`, `defaultsFor`); writing mode is part of the desk, read
  through `core/writing-mode.ts`, and the goal counter through `core/daily-progress.ts`.
  Shared modal and leaf helpers are in `src/ui/`, never importing a module folder. View ids
  are in `core/view-types.ts`; they never change (they live in the writer's workspace file).
- **1.0.4 additions.** Starting a work is a second core module, `src/new-work/`
  (`CoreModule`, always loaded): "New work…", "New short story" and "New book" (`create-book`
  moved here from the outline, offered only while the outline is on). Its port is
  `core/new-work.ts` (`plugin.newWork`: `start(kind?)`, `offers(kind)`), which the desk's
  footer and the outline's empty state call, so they never import the module. Path questions
  (parent, base name, `.md`, folder cleaning, joins, "is inside") go through `core/paths.ts`;
  folder and note suggests are in `src/ui/suggest.ts`.
- **1.1 additions.** A screenplay is a note whose `form` is `screenplay`, not a module and not a
  switch (the feature count stayed 19 in 1.1; 1.2 added a switch for the editor help). The form rule moved from the universe to `core/form.ts`
  (`FORM_KINDS` now has seven values; the settings keys keep their names, and the three rows are
  a "Forms" group after Books, always shown). Pure core: `core/fountain.ts` (the `Script` model
  and `parseFountain`), `core/screenplay-pages.ts` (`paginate`), `core/pdf.ts` and
  `core/screenplay-pdf.ts` (the PDF), `core/screenplay-presets.ts` (US Letter and A4),
  `core/export-formats.ts` (`formatsFor`: a single screenplay note gets PDF and Fountain, every
  other source the prose formats). The export module has a writer table (`export/writers/table.ts`)
  and `export/screenplay.ts`; its "Screenplays" settings group holds the words. Character cues
  count as mentions in "Appears in". Improvement 46: `titlePageOf`, `bylineOf` and `minHeadingOf`
  in `core/export-pipeline.ts`. Details: ARCHITECTURE.md, "Form" and "Screenplays".
- **1.2 additions.** The screenplay editor is a module and a switch (`screenplay`, the 20th id, on in
  the Screenwriter and Everything presets only; a missing key reads as off, `OFF_WHEN_MISSING` in `core/features.ts`,
  settled on load by `settleNewSwitches`). `src/screenplay/` has `layout.ts` (line classes in Live
  Preview, built on `EditorSet`), `keys.ts` (Tab, Enter, caps, the mode of a line), `suggest.ts`
  (one `EditorSuggest`, registered with `ctx.suggest`) and `settings-ui.ts`. Pure core:
  `core/fountain-doc.ts` (the parse cached per document version), `fountainLines` in
  `core/fountain.ts`, `core/screenplay-keys.ts` (`decideKey`) and `core/screenplay-suggest.ts`.
  `src/ui/editor-glue.ts` (`EditorSet`, `fileOfState`, `isLivePreview`, `cmOf`) and
  `src/ui/reveal-on-touch.ts` are the shared editor plumbing (improvement 38). `NoteService.flush(file)`
  saves a file's views before a write that reads the disk (since 1.2.4 every property write gets it through `notes.frontmatter`). The reader's source is a book, a
  collection or a note (`readerSource`; "Read this note"). The lens keeps each sentence's length
  (`sentenceWords`, `sentencePara`) for the Rhythm section. Details: ARCHITECTURE.md, "The screenplay
  editor" and "Editor glue".
- **Markdown questions** (frontmatter, code, comments, what a line is) go through
  `segment(text)` / `segmentDoc(doc)` in `core/markdown.ts`. Line predicates live next
  to `isSceneBreakLine` in `core/markers.ts`.
- **Pure logic in files without `obsidian` imports**, tested with vitest in
  `tests/<module>*.test.ts`. Obsidian-facing code stays thin.
- **Strings**: `t("<module>.<key>")` with English and pt-BR in
  `src/<module>/strings.ts`; numbers through `fmt`, units through `unitAmount`/`plural`.
  Sentence case.
- **Styles**: `escrita-` class prefix, module `styles.css`, Obsidian CSS variables or
  the tokens in `src/styles.css`. Light and dark themes; touch targets ≥ 32px.
- `src/core/*`, `main.ts`, `settings.ts`, `data.ts`, `i18n.ts`, `strings.ts` are
  shared core: change them as a deliberate refactor, not as a side effect of a feature.
- Growth rule for the classifier: new knowledge arrives as new fields on the result,
  never as new kinds (the universe's `scope` became a field in 0.9).

## Vocabulary

- **Book**: a folder `F` with a note `F.md` and a chapters folder inside it.
- **Chapter**: a `.md` file directly in a book's chapters folder.
- **Piece**: any note with `target`, `limit`, `unit` or `deadline` (a conto, an essay).
- **Work** (0.4): what moves through the stages: a book, or a tracked standalone note
  whose `status` is a known stage. Chapters are not works.
- **Stage** (0.4): idea, draft, revision, ready, published, each mapped to the writer's
  `status` words (`ideia`, `rascunho`, `revisão`, `pronto`, `publicado`). Code reads
  the stage, never the word. Submitted is not a stage.
- **Home note** (0.4): a note the writer owns with an `escrita-works` block that
  Escrita draws (never writes): what to write today, and a click lands where you left off.
- **Beat**: `%% beat: … %%` on its own line; "ghost" until prose follows it.
- **Placeholder**: `%% XXX: … %%` (marker word from settings); blocks publish.
- **Scene break**: a `---` line with blank lines around it.
- **Darlings**: cut passages kept in a note, restorable to where they came from.
- **Snapshot**: a `.txt` copy of a note under `Escrita/Snapshots`, comparable word by word.
- **Export** (0.8): a manuscript file (Markdown, DOCX or, in 0.9, EPUB) written into the export folder.
  Derived, never tracked, never a work.
- **Submission** (0.8): a note in the submissions folder recording where a work was
  sent and what came back. Never tracked, never a work.
- **Feature** (0.7): a switchable part of Escrita (`FeatureId`); off means not loaded, data stays.
- **Entry** (0.6): a note with the type property, in a universe. **Mention**: a place in
  a note where an entry's name or alias appears (0.7, `core/names.ts`).
- **Collection** (0.9): a note with a `contents` property, a list of links to contos in reading
  order, exported as one DOCX, EPUB or Markdown file (`core/collection.ts`). Not a classifier
  kind or field; a work only by the usual rule.
- **Screenplay** (1.1): a single note whose `form` is `screenplay`, written in Fountain. It exports
  as PDF or Fountain only. A book or a collection stays prose even if it holds screenplay notes.
- **Fountain** (1.1): the plain-text screenplay format (`core/fountain.ts`). Inside a screenplay
  note it wins over Markdown (`#` is a section, `>` a transition); indents follow the Fountain
  spec (ignored outside action).
- **Tracked**: counted by goals (inside track folders, outside exclude folders).
- Deep/shallow module, seam, locality: as defined at the top of IMPROVEMENTS.md.

## Editor writes

An edit at the cursor of the editor that triggered it may write straight to that editor;
`plugin.notes` is for writes to any other note (ARCHITECTURE.md, "Conventions").

## Working process

- **Checks before calling something done**: `npm run typecheck`, `npm test`,
  `npm run build` (and `npm run test:bundle` after a build), and `npm run lint` (eslint with the
  Obsidian rules, zero warnings). CI runs all five; 1.2.3 shipped with a lint warning because lint
  wasn't run locally.
- **The end-to-end harness** (1.1, `tests/e2e/`, `docs/TESTING.md`): `npm run e2e` runs Playwright specs
  in a real Obsidian that it starts itself, with its own profile and a copy of a fixture vault, so
  the author's Obsidian and vaults are never touched. Local only, not in CI; run `npm run build`
  first. One Obsidian at a time (`workers: 1`); with several agents, run it under
  `flock <scratchpad>/heavy.lock`. It runs the checks of the by-hand test pages (TEST-0.9, TEST-1.0);
  what stays by eye (pictures against the boards, a PDF in a reader app, third-party themes,
  phones) is listed in TESTING.md and PLAN-1.1.
  It lives under `tests/` so the Obsidian review bot, which skips that folder, does not lint it.
- **Every release includes at least one improvement** from IMPROVEMENTS.md, named in
  ROADMAP.md under the version, preferably one the version's features lean on.
- **When a version ships**: move its row to "Shipped" in ROADMAP.md, add the changelog
  entry to README.md, write or update the user guide pages for its features in
  `docs/guide/` (English and pt-BR; ROADMAP.md, "Documentation"), move the improvement
  to "Done" in IMPROVEMENTS.md, mark the feature shipped in its topic roadmap, and plan
  the next version in ROADMAP.md before editing the topic roadmaps.
- **Release mechanics**: `npm version <patch|minor> --no-git-tag-version` (updates
  `manifest.json` and `versions.json`), commit as the bare version (`0.3.0`), tag the
  bare version, push the tag; the workflow drafts a GitHub release with `main.js`,
  `manifest.json`, `styles.css`.
- **Docs style**: plain English, short sentences, sentence-case headings. Keep the
  version index in ROADMAP.md current whenever plans change.
- Testing vault: the author's vault at `~/Projects/website/escrita/` (contos in
  `Contos/`, essays in `Textos/`; status values `ideia`, `rascunho`, `revisão`,
  `pronto`, `publicado`).

## Where the project is heading

Escrita is a writing **system**: every feature serves a stage of a work's life
(ARCHITECTURE.md, "Workflow"). When proposing a feature, say which stage it serves
and what upkeep it asks of the writer.

- **0.4 (shipped), the writing desk**: stages, the stage snapshot, the home block with
  "where you left off" (SF 11), moving a paragraph or scene (SF 8), the vault index.
- **0.5 (shipped), revision**: stemmers in `core/stem/` (shared with the universe) and the revision lens
  (SF 5). Improvement: the 0.2.1 editor loose ends.
- **0.6 (shipped), universe foundations**: universe modes and container, create entry from
  selection, open threads, insert from a template (U 1.1, U 1.3, U 1.5, SF 9).
  Improvement: the outline's beat writes through the note text port (IMPROVEMENTS 3).
- **0.7 (shipped), characters across works**: the Features page
  (17 switches then, 19 in 0.8; SF 10) on modules that load and unload at runtime (IMPROVEMENTS 6), `universe:
  false`, "Appears in" (the names matcher, the mentions index), names in spellcheck and the
  lens, POV and status in the outline, per-chapter targets (U 1.1, U 1.2, U 1.4, N 1, N 2).
  Improvements: IMPROVEMENTS 6 and chapter rows (IMPROVEMENTS 7). First version with the
  user guide in `docs/guide/` (English and pt-BR; The world, Features and settings, Writing).
- **0.8 (shipped), submitting work**: Markdown and DOCX export (Shunn and pt-BR presets) for a
  note and a book, submissions (N 7, SF 12). The companion-plugin guide (N 6) was dropped.
  Improvements: each module owns its settings section (IMPROVEMENTS 11, 20), the export
  and submissions foundations (15–19), and measured performance work (10, 14, 21–23).
  Plan and results in `docs/PLAN-0.8.md`.
- **0.9 (shipped), the book and its world**: unlinked mentions with a Link button, names
  without an entry as a lens rule (U 2.5), EPUB, "Publish next chapter", "Read the book"
  (N 7 stage 3, N 4, N 8; 0.10 merged in on 2026-10-06), collections of contos exported
  as one DOCX or EPUB (SF 13). Improvement: IMPROVEMENTS 9,
  the fuller change (scope as a field on the classifier result). Plan and results in `docs/PLAN-0.9.md`.
- **1.0 (shipped)**: universe + manuscript export complete, setup with presets (Essentials,
  Writer, Everything), mobile pass, docs in both languages, community plugin submission.
- **1.0.4 (shipped), start a new work**: "New work…", "New short story" and
  "New book" (SF 14), the home block footer and the "New works" settings. Improvement:
  IMPROVEMENTS 33, path helpers in core. Plan and results in `docs/PLAN-1.0.4.md`.
- **1.1 (shipped), screenplays**: screenwriting phase 1 (SP 1, SP 6;
  `docs/ROADMAP-screenplay.md`): a note whose form is `screenplay` is written in Fountain and
  exports as a PDF (US Letter or A4) or a `.fountain` file; character cues count in "Appears in".
  Also the form rule in core, the end-to-end harness, the 1.0 fixes found by it, and improvement
  46 (the export writers share the title page; the modal splits). Plan and results in
  `docs/PLAN-1.1.md`.
- **1.1.1 (shipped), code only**: the review bot's warnings cleared (the e2e harness moved to `tests/e2e/`,
  no `text-decoration` or `text-indent` in the CSS) and improvement 53, one settings table:
  `core/settings-schema.ts` has one row per setting, and the defaults, the language sets, `SETTING_FEATURES`
  and `normalizeSettings` come from it. A new setting is one row plus its field in the interface; core imports
  no module folder. Plan and results in `docs/PLAN-1.1.1.md`.
- **1.2 (shipped), writing a script and reading a story**: the screenplay editor (SP 2: Live
  Preview layout, Tab and Enter, caps, forced marks, suggestions, two commands for phones), "Read
  this note" (SF 15), Rhythm in the lens panel (SF 16), and a fix for typing lost when a new tracked
  note got its draft status. Improvements 38 (editor glue) and 52 (the reader rebuilds when the cache
  is ready), and the first slice of 47. Plan and results in `docs/PLAN-1.2.md`.
- **1.2.3 (shipped), the count you can trust**: words in a note that stays open count again, and
  one history for every device that syncs the vault (`plugin.history`). Improvement: the goals
  slice of 48. Plan and results in `docs/PLAN-1.2.3.md`.
- **1.2.4 (shipped), fixes**: a screenplay note no longer opens as plain text until edited, and
  every property write saves the open editor first (`notes.frontmatter`). Improvement: the known
  issue of the `processFrontMatter` callers without a flush.
- **Next**: universe phase 2 (timeline, dates, continuity, canon; U 2.1–2.4), moved out of 0.9.

Known weak spots to keep in mind when touching nearby code: `outline/view.ts` and
`goals/progress-modal.ts` are large and mostly untested (IMPROVEMENTS 5; the chapter rows
were extracted to `outline/rows.ts` in 0.7, the first slice); path-keyed
data follows renames on its own vault events in two places, the measurer and the
explorer's tracked set (IMPROVEMENTS 2, done in 0.4 for everything else, which follows
through `plugin.index.follow`; the snapshots store moved there in 0.7, and since 0.7
those followers run even when their feature is off); the Reading-view "Appears in"
section is closed (0.7's G0d, 1.1): Reading view shows the panel only, with no post-processor,
and `tests/e2e/specs/appears-in-reading.spec.ts` checks it; the phone checks
(name marks, the names bench) are waived, because the author has no phone sync; the Markdown
parity questions with Reading view were checked in a real vault (0.8, G0c) and the
segmenter follows them, pinned in `tests/markdown-consumers.test.ts`. 0.9 adds: "Read the book"
(`outline/reader-view.ts`) has no DOM test, but since 1.1 it has e2e checks (`tests/e2e/specs/read-book.spec.ts`)
and measured timings on a 31-chapter book (G0d: first text in 8 to 18 ms, longest task 23 to 28 ms,
accepted at 30 ms; PLAN-1.1, Wave 2). Its startup race (a `compile: false` chapter shown before
the metadata cache is ready) was fixed in 1.2 (improvement 52). Its decisions are pure, in `outline/reader-model.ts` and
`reader-plan.ts`, whose default heading is the core preset's. The EPUB
CI job (EPUBCheck) runs on every pull request. The unlinked rows read the note's
live text, not the mentions index's offsets, which lag about 4 s behind edits.
