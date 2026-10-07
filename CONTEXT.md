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

Current version: see `manifest.json` (0.8.0 at the time of writing). The author's
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
   `processFrontMatter` / `fileManager.renameFile` / `trashFile`, `normalizePath`, no
   Node or Electron APIs, no `console.log`. Exceptions are listed in ARCHITECTURE.md;
   don't add one without listing it there.

## How the code is shaped

- `src/main.ts` builds the services, then each module (`src/<module>/index.ts`,
  a `FeatureModule`). Modules: goals, outline, placeholders, darlings, editor, lens,
  publish, export, submissions, explorer, snapshots, desk, universe. **They are switchable features** (19
  ids in `core/features.ts`; the editor is split into typing, dialogue focus, moving
  blocks, templates and spellcheck): the `FeatureRegistry` loads and unloads each from the
  writer's switches at runtime, and a module registers everything through its
  `ModuleContext`, never straight on the plugin. A module must unload cleanly and its
  path-keyed data must follow renames through a data follower even while it is off.
  ARCHITECTURE.md, "Modules and feature switches". Each module draws its own settings
  section (`settingsSection` in its `settings-ui.ts`); the order of all sections is one
  list in `core/settings-order.ts`, and `settings.ts` imports no module internals.
- **Shared services on `plugin`** (use them; never re-derive):
  - `books.classify(x)`: what a file is (chapter, book note, note…), its book,
    `tracked`, `piece`, `snapshot`, `stage`, `submission`, `export`, `scope` (0.9: which
    universe or book it lives in, from `core/scope.ts`; set whenever the universe mode is on,
    even with the feature off). Backed by `core/classify.ts`.
  - `measure`: every count shown or recorded (`core/measurer.ts`, cached by mtime).
  - `notes`: every write into a note's text (editor when open, else `vault.process`;
    check-then-replace through `core/note-text.ts`).
  - `notes.create(path, data, { exists, trashOld })`: every new file (text or binary).
    `exists` is `return`, `fail`, `unique` or `replace`; `replace` refuses a case-only
    clash, and `trashOld` sends the old file to the trash first.
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
- **Tracked**: counted by goals (inside track folders, outside exclude folders).
- Deep/shallow module, seam, locality: as defined at the top of IMPROVEMENTS.md.

## Editor writes

An edit at the cursor of the editor that triggered it may write straight to that editor;
`plugin.notes` is for writes to any other note (ARCHITECTURE.md, "Conventions").

## Working process

- **Checks before calling something done**: `npm run typecheck`, `npm test`,
  `npm run build` (and `npm run test:bundle` after a build). CI runs all four.
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
- Testing vault: the author's vault at `~/projects/website/escrita/` (contos in
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
- **0.9 (built, not yet released; the author tests first), the book and its world**: unlinked mentions with a Link button, names
  without an entry as a lens rule (U 2.5), EPUB, "Publish next chapter", "Read the book"
  (N 7 stage 3, N 4, N 8; 0.10 merged in on 2026-10-06), collections of contos exported
  as one DOCX or EPUB (SF 13). Improvement: IMPROVEMENTS 9,
  the fuller change (scope as a field on the classifier result). Plan in `docs/PLAN-0.9.md`.
- **1.0**: universe + manuscript export complete, setup with presets (Essentials,
  Writer, Everything), mobile pass, docs in both languages, community plugin submission.
- **After 1.0**: screenwriting (`docs/ROADMAP-screenplay.md`), Fountain and PDF export first;
  then universe phase 2 (timeline, dates, continuity, canon; U 2.1–2.4), moved out of 0.9.

Known weak spots to keep in mind when touching nearby code: `outline/view.ts` and
`goals/progress-modal.ts` are large and mostly untested (IMPROVEMENTS 5; the chapter rows
were extracted to `outline/rows.ts` in 0.7, the first slice); path-keyed
data follows renames on its own vault events in two places, the measurer and the
explorer's tracked set (IMPROVEMENTS 2, done in 0.4 for everything else, which follows
through `plugin.index.follow`; the snapshots store moved there in 0.7, and since 0.7
those followers run even when their feature is off); the Reading-view "Appears in"
section across re-renders is still unchecked on desktop (0.7's G0d); the phone checks
(name marks, the names bench) are waived, because the author has no phone sync; the Markdown
parity questions with Reading view were checked in a real vault (0.8, G0c) and the
segmenter follows them, pinned in `tests/markdown-consumers.test.ts`. 0.9 adds: "Read the book"
(`outline/reader-view.ts`) has no DOM test, and its timings (G0d), scroll restore and click-to-line
are unmeasured in Obsidian (its decisions are pure, in `outline/reader-model.ts` and
`reader-plan.ts`, which copies the two export preset headings and can drift from them); the EPUB
CI job (EPUBCheck) first runs when the 0.9 pull request opens; the unlinked rows read the note's
live text, not the mentions index's offsets, which lag about 4 s behind edits.
