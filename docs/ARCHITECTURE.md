# Escrita — architecture and module specs

Escrita is an Obsidian plugin for fiction writers, inspired by NEO
(https://github.com/hughhowey/neo, MIT). It is published publicly, so everything
must be generic (any vault, any language), theme-friendly and mobile-safe.

## Conventions every module follows

- **Ownership.** Each module lives in `src/<module>/` (`index.ts`, `strings.ts`,
  `styles.css`, plus any files it needs) with tests in `tests/<module>*.test.ts`.
  Do not edit `src/main.ts`, `src/settings.ts`, `src/data.ts`, `src/i18n.ts`,
  `src/strings.ts` or `src/core/*` (exception: the outline module implements
  `src/core/chapter-ops.ts` with its pure helpers `src/core/chapter-engine.ts` and `src/core/chapter-plan.ts`). If you need a change there, say so in your final
  report instead. `src/core/classify.ts` and `src/core/books.ts` are shared core
  that every module reads; change them only as a deliberate core-level refactor.
- **Shared helpers** (1.0, IMPROVEMENTS 13). A helper that more than one module uses is not
  in any module's folder. Pure ones are in `src/core/`: `block-context.ts` (`blockStateIn`,
  `bodyLineIn`, `inBlock`, `inlineProtected`; from the editor), `dialogue.ts` (`dialogueInDoc`,
  `dimPlan`; from the editor) with `typography.ts` (the quote tables `dialogue.ts` reads;
  from the editor), and `piece-bar.ts` (`pieceBar`, `paceInUnit`; was `goals/piece.ts`).
  Helpers that open a modal or a leaf are in `src/ui/`: `confirm.ts` (`confirmAction`; was
  `outline/modals.ts`) and `open-work.ts` (`openWork`; was `desk/open.ts`). `src/ui/` may
  import `obsidian` and `core/*`, never a module folder. So the module dependency list holds
  only runtime calls (ports, `features.isOn`), not imports. `export` does not import
  `publish/checks`: the shared readiness checks are `core/readiness.ts`. `ui/confirm.ts`
  reads the string `outline.cancel`; all string files are registered at load, so it resolves
  with the outline off.
- **Entry point.** A feature is a `FeatureModule` (`core/module-context.ts`) built in
  `main.ts` and loaded and unloaded by the `FeatureRegistry` from the writer's switches.
- **Plugin services** (on `this.plugin`): `settings` (see `src/settings.ts` —
  all settings already exist, with a settings tab), `data.history` (see `src/data.ts`),
  `requestSave()` (debounced persist), `saveSettings()`, `books` (`BookService`:
  `classify(file | folder | path | null)` → `{ path, kind, markdown, book, tracked, piece, snapshot, stage, submission, export }`,
  `chapters(book)`, `allBooks()`, `frontmatter(file)`; see "File classification" below),
  `measure` (`Measurer`, `core/measurer.ts`: counts per file and per book, cached
  by mtime; see "Measuring" below), `notes` (`NoteService`, `core/notes.ts`: every
  write into a note's text; see "Note text" below), `decorations`
  (`ExplorerDecorations`, `core/explorer-decorations.ts`: the one thing that draws in
  the file explorer; see the explorer spec), `chapterOps` (`ChapterOps`:
  create/renumber/retitle chapters), `index` (`VaultIndexes`, the reusable vault index; see
  "Vault index" below: `add(spec)`, `follow(follower)`, `rebuild(name?)`, `settingsChanged()`),
  `works` (`WorksReader`, `core/works-index.ts`: the live list of works, one entry per
  tracked book, note or chapter; `get`, `list`, `isReady`, `onReady`, `onChange`; built on
  `index`), `features` (`FeatureRegistry`: `isOn(id)`, `onChange(cb)`; see "Modules and
  feature switches"), `names` (`NamesPort`, `core/names-source.ts`: the terms of a note's
  scope, empty until the universe provides them; see "Names matcher"), and the other modules (`goals`, `outline`,
  `placeholders`, `explorer`, `darlings`, `editor`, `lens`, `snapshots`, `publish`, `export`,
  `submissions`, `desk`, `universe`: the one with a public API, see its spec below).
  `notes` also has `create(path, data, { exists })`, the one find-or-create for notes and
  binary files (see "Note text").
- **Pure core** (no Obsidian imports, unit tested): `core/markdown.ts` (the one
  Markdown segmenter, see below), `core/wordcount.ts`,
  `core/markers.ts` (beat/placeholder/scene-break syntax, and thread markers: see
  "Thread markers" below), `core/template.ts` (template filling: see "Template filling"
  below), `core/book.ts`
  (chapter numbering), `core/dates.ts` (writing day), `core/measure.ts` (`measureText`,
  `countIn`, a note's target/limit/unit/deadline via `readPiece`/`readUnit`, a book's
  goal via `readBookGoal`, the only amount and deadline parsers `parseAmount`/`parseDeadline`,
  `progressOf`/`noteProgress`, `unitKey`/`pluralKey`), `core/measure-cache.ts`
  (`MeasureCache`, per-file counts by mtime), `core/daysoff.ts`
  (`dayOffPredicate`, `parseDatesOff`), `core/classify.ts` (the `VaultTree` port,
  `classify`, `listBooks`, `inFolder`, `inBook`, `ancestors`, and the snapshots folder:
  `snapshotsRoot`, `inSnapshots`, `snapshotsFolderProblem`; see "File classification"),
  `core/lists.ts` (`lineList`, `folderList`; import them from here),
  `core/note-text.ts` (the note text port: `Change`, `checkedChange`, `minimalChange`,
  `guardedEdit`, `replaceIfExact`, `matchLineEndings`), `core/explorer-decorations.ts` (the explorer walk, over fake
  elements in tests) and
  `core/merge.ts` (`mergeDefaults` for saved settings), and the 0.4 core:
  `core/path-keys.ts` (`isUnder`, `movedPath`, and the rename/drop helpers for records,
  maps and sets keyed by path; the one rule for files and folders), `core/vault-index.ts`
  (`VaultIndex`, one incrementally kept index), `core/index-hub.ts` (`IndexHub`, which
  owns the indexes and feeds them events), `core/works.ts` and `core/works-index.ts`
  (`DeskEntry`, `deskEntry`, `worksSpec`, `WorksService`), `core/stages.ts` (the five
  stages, `stageOf`, `writtenWord`, `statusColor`, `normalizeStages`), `core/migrate.ts`
  (`migrateSettings`: the 0.3 status settings to stages), `core/anchor.ts` (`contextAt`,
  `findRestoreOffset`: a spot found again by its surrounding text), `core/left-off.ts`
  (`LeftOff`, `makeLeftOff`, `noteSpot`, `bookTarget`), and `core/markers.ts` also
  exports `isBeatLine` and `isSceneBreakAt` (a real scene break in the body, not a
  setext underline). `countCharacters(md, { spaces })`
  in `core/wordcount.ts` counts on `proseOnly` text with whitespace runs collapsed.
  The 0.5 core, shared with the revision lens and the coming universe: `core/stem/`
  (the stemmers, see "Stemmers"), `core/tokens.ts` (`tokens(text, from?, to?)`: words
  with offsets by the one word rule, `wordRegex`; and `findPhrase`, whole-word phrase
  matching), `core/sentences.ts` (`sentences(mask, md, lang, from?, to?)`: our own
  splitter, with per-language abbreviation lists, so a title like *Dona* or *Dr.* does
  not end a sentence and "not at a sentence start" is answerable) and `readerMask(md)` in
  `core/wordcount.ts` (the masked document with link targets, embeds, urls, tags and
  heading, list and quote marks blanked to spaces, offset for offset). `readerMask` and
  `stripMarkup` (behind `proseOnly` and the word count) run one pattern table, so they
  can't drift. Core never imports the lens.
  The 0.8 core, each with its own section below: `core/manuscript.ts`,
  `core/export-pipeline.ts`, `core/book-source.ts`, `core/readiness.ts`, `core/zip.ts`,
  `core/pending.ts`, `core/folder-problem.ts`, `core/folder-setting.ts` and
  `core/settings-order.ts`.
  Reuse these; don't duplicate.
- **Never re-detect frontmatter, fences, inline code or comments**: ask
  `segment(text)` or `segmentDoc(doc)` from `core/markdown.ts` (see "Markdown
  segmentation" below). Markers inside code, frontmatter or HTML comments are not markers.
- **Never re-derive what a file is**: ask `plugin.books.classify(file)` first for
  chapter / book note / book file / note, the owning book, tracked and the piece.
  Keep your module's policy (typography scope, the placeholder
  index's exclude-only rule) and read the facts from the classifier. The only
  `inFolder` is `core/classify.inFolder`; containment in a book by path is
  `core/classify.inBook`.
- **Pure logic goes in files without `obsidian` imports** so vitest can test it.
  Obsidian-facing code stays thin.
- **i18n.** Every user-visible string goes through `t("<module>.<key>", vars)`
  from `src/i18n.ts`, with an English and a Brazilian Portuguese (`pt-BR`) entry in
  `src/<module>/strings.ts`. Numbers go through `fmt(n)`. UI text is sentence case.
- **Obsidian plugin guidelines** (the plugin will be submitted to the community list):
  no `innerHTML`/`outerHTML`/`insertAdjacentHTML` — build DOM with `createEl`/`createDiv`/`setText`/`setIcon`;
  no default hotkeys; command names without the plugin name; `this.plugin.registerEvent`/
  `registerDomEvent`/`registerInterval`/`registerEditorExtension`/`registerView` for
  everything so unload cleans up. A switchable module never calls those on the plugin:
  it registers through its `ModuleContext` (`this.ctx.command`, `.view`, `.editor`,
  `.statusBar`, `.index`, `.follow`, `.decorate`, `.onLayoutReady`, and `register*` on the
  module itself, which is a `Component`), so turning the feature off undoes each one.
  Only `src/core/module-context.ts`, `src/core/feature-registry.ts`, `src/main.ts`,
  `src/core/measurer.ts` and `src/core/vault-indexes.ts` call the plugin's own
  registration methods (a grep in the checks keeps it so); never keep references to
  views — look them up with `workspace.getLeavesOfType`; **don't detach leaves in the
  plugin's `onunload`** (Obsidian restores them on the next start), but **a feature the
  writer switches off closes its own leaves**, because Obsidian can't unregister a view
  type and would leave ghost panes (see "Modules and feature switches"); modify files with
  `vault.process` (body) and `fileManager.processFrontMatter` (properties), rename with
  `fileManager.renameFile`, delete with `fileManager.trashFile`; `normalizePath` for
  built paths; no Node or Electron APIs (`isDesktopOnly: false`); no global `app`;
  no `console.log` (use `console.error` only for real errors); private APIs only
  behind type guards and try/catch.
- **Documented exceptions to those rules** (each one is deliberate; don't copy them
  elsewhere without adding a line here):
  - **Empty snapshot folders are removed with `vault.delete` / `adapter.rmdir`**, not
    `trashFile`: only a folder left empty by a snapshot move, which holds nothing to lose.
  - **The snapshots `vault.adapter`**: a snapshots folder with a hidden segment (`.x`)
    isn't indexed by Obsidian, so `snapshots/fs.ts` reaches it through the adapter (trash
    is `trashSystem`, then `trashLocal`). The one place Escrita uses the adapter.
  - **Restoring a snapshot's properties is a raw text replace** of the frontmatter block
    (through the note text port, anchored and checked), not `processFrontMatter`: a
    restore must give back the old text byte for byte, comments and key order included.
  - **The lens reaches CodeMirror's view through a cast** (`src/lens/ui.ts`, `cmOf` and
    the editor-menu handler): `(editor as unknown as { cm?: EditorView }).cm`. Obsidian
    does not type `Editor.cm`, and stepping and "Ignore here" need the view's state to
    read the mapped match list. Read-only use, and only in editing mode; a missing `cm`
    gives `null` and the feature does nothing.
  - **The lens opens Escrita's settings tab through `app.setting`** (`LensUi.openSettings`
    in `src/lens/ui.ts`), for the "Open settings" button of the no-language state:
    `setting.open()` then `setting.openTabById(manifest.id)`, behind a cast and a
    try/catch. Obsidian has no public call for it; if it is missing nothing happens.
  - **Three casts to Obsidian internals, each behind a guard.** The universe panel's
    "Reveal in explorer" reads the file explorer view through a cast
    (`src/universe/view-entries.ts`, `revealInFolder`), and the panel's and the template
    insert's "Open settings" buttons open Escrita's settings tab through `app.setting`
    (`src/universe/view.ts`, `src/editor/template-insert.ts`), as the lens does. A missing
    method means nothing happens.
  - **The export notice's "Show in the file explorer"** (`ExportModule.reveal` in
    `src/export/index.ts`) reuses that same guarded `revealInFolder` cast:
    `leaf.view as unknown as { revealInFolder?: (f: TFile) => void }`, checked before
    the call, and the leaf is revealed first. A missing method means nothing happens.
    It is the only non-public API the export and submissions code uses. (`createBinary`,
    `modifyBinary` and `readBinary` are public Vault API, so writing a `.docx` needs no
    exception. `submissions/index.ts` casts a `classify` result to its own `PlacementLike`
    type, which is a narrowing of Escrita's own type, not an Obsidian internal.)
  - **Guidelines lint (1.0, `npm run lint`, `eslint.config.mjs`).** `eslint-plugin-obsidianmd`
    runs the rules the review bot runs, over `src/`, with zero warnings allowed, in CI.
    The review config rejects inline `eslint-disable` for its own rules, so none is used:
    the few rules left off are scoped to one file in `eslint.config.mjs`, and each is here.
    The bot's own run may still report these:
    - `src/settings.ts`: `settings-tab/prefer-setting-definitions` and
      `@typescript-eslint/no-deprecated` (`display()`). The declarative settings API
      (`getSettingDefinitions`) needs Obsidian 1.13 and `minAppVersion` is 1.7.2, and the
      tab draws module sections that load and unload at runtime.
    - `src/ui/confirm.ts`: `no-deprecated` for `ButtonComponent.setWarning`;
      `setDestructive` is newer than `minAppVersion`.
    - `src/snapshots/fs.ts`: `prefer-file-manager-trash-file`, the empty snapshot folder
      removal listed above.
    - `src/editor/template-insert.ts` (`Notice.messageEl`) and `src/universe/create.ts`
      (`loadLocalStorage`, `saveLocalStorage`): `no-unsupported-api`, typed from 1.8.7 while
      `minAppVersion` is 1.7.2. Both are guarded (the notice returns without its button when
      `messageEl` is missing; the storage calls sit in try/catch). Raising `minAppVersion`
      to 1.8.7, which PLAN-1.0 expects for `getLanguage()`, removes these exceptions.
  - **Writes into a note's text go through `plugin.notes`** (the editor when the note is
    open in source or Live Preview, else `vault.process`), never straight to
    `vault.process`. **The editor-writes rule (0.8):** an edit at the cursor of the editor
    that triggered it (a command or menu item on that view) may write to that editor
    directly, in one transaction; `plugin.notes` is for a write to any other note, or to
    a note from code that no editor triggered. "Plant a thread" and "Insert from a
    template" are this case. After an await, such a command checks that its view still
    shows the same note.
- **Styling.** Classes prefixed `escrita-`, CSS in the module's `styles.css`, colors only
  from Obsidian CSS variables or the tokens in `src/styles.css` (`--escrita-accent`,
  `--escrita-ghost`, `--escrita-placeholder-bg/fg`, `--escrita-good`, `--escrita-bar-bg`).
  Must look right in light and dark themes. Touch targets ≥ 32px in side panels.
- **Data safety is the top priority.** Never lose or silently change prose. Anything
  that deletes text either moves it somewhere recoverable (darlings, trash) or asks.
- **Fewer things to manage.** The writer should sit down and write, not run the
  plugin. A feature that needs upkeep from the writer (fields to fill, lists to
  groom, a panel to check) has to earn it. Prefer reading what the writer already
  does (a `status`, a target) over asking for more. See "Workflow" below.
- **Standalone.** Escrita is for any writer, whether or not they publish to a
  website. No feature may assume a site: no URLs or slugs, no site build rules, no
  files written for a site to read. "Publish" only means checking a note and setting
  its status and date properties. The author's own site reads the vault by itself.
- **No network.** Escrita never contacts a server. `tests/no-network.test.ts` fails
  when any file in `src/` (or the built `main.js`) uses `fetch(`, `requestUrl`,
  `request(` from obsidian, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`,
  a dynamic `import(` of a non-relative path, or a Node/Electron network module. Only
  whole-line and block comments are skipped, so don't even mention those APIs in a
  trailing comment. `npm run test:bundle` (CI, after the build) requires `main.js`.
- **Checks.** `npm run typecheck`, `npm test`, `npm run build` must pass, and
  `npm run test:bundle` after a build. Other modules are being written at the same time,
  so errors outside your folder may appear transiently; your files must be clean.
  `npm test` runs the `node` and `dom` projects (every `tests/lifecycle-*.test.ts` and
  `tests/module-context.test.ts` run in happy-dom), then the `timing` project on its own.
  A test that asserts elapsed time goes in `tests/timing/`: it runs one file at a time,
  after the main suite, because a wall-clock budget fails at random while ~130 files
  compete for the CPU (`vitest.config.ts`). Benchmarks are `tests/perf/*.bench.ts`, run
  with `npm run bench` (not part of `npm test`); `tests/perf/README.md` lists what each
  file measures and the baselines.

## File conventions (users' vaults)

```
Novels/A Casa.md                  ← book note. Frontmatter: goal (number), deadline (YYYY-MM-DD); names from settings
Novels/A Casa/Chapters/           ← folder name = settings.chaptersFolder
    01 Chegada.md                 ← frontmatter: status, summary (names configurable)
    02 A porta fechada.md
Novels/A Casa/Darlings.md         ← settings.darlingsNote, relative to the book folder
```

In-text markers (single-line Obsidian comments, hidden in Reading view and by most publishers):

```
%% beat: As cartas na caixa de lata %%     ← a scene beat from the outline ("ghost" until written)
%% XXX: conferir se o porão tem janela %%  ← a placeholder (word = settings.placeholderMarker)
---                                         ← scene break (always with blank lines around it)
```

A marker is a closed `%% … %%` comment on one line, as `core/markdown` segments
the text: the same text inside code, the frontmatter, an HTML comment or a
multi-line comment is not a marker (no dot, badge, pill, ghost or publish blocker),
and a line holding several `%%` comments is not a beat. A scene break line must be
entirely prose (`core/markers.isSceneBreakLine`, the one definition; the Enter
flow adds its blank-line-before rule on top).

A beat is **written** when prose (or code) follows it before the next beat, scene break or end
of file (`core/markers.parseBeats`). Beats stay in the file after the scene is
written; they act as invisible scene headings and keep the outline in sync.

## Workflow (shipped in 0.4)

Escrita is a writing system, not a set of features: every feature serves a stage of
a work's life, and the stage is the `status` the writer already sets. Decided in a
design review on 2026-10-01; the feature spec is ROADMAP-short-fiction.md, 11
(the writing desk) and 12 (submissions).

- **A work** is what moves through the stages: a book (its book note's `status`, set
  by hand, never derived from its chapters) or a tracked standalone note whose
  `status` is a known stage. No status, or an unknown one, means not a work.
  Chapters are never works: their status is progress inside the book.
- **Five fixed stages**, mapped in settings to the writer's words: idea, draft,
  revision, ready, published. Planning happens in idea; submitted is not a stage
  (submissions are notes of their own). Code reads the stage, never a status word.
- **What a stage changes:** nothing is hidden, every command works in every stage,
  and words count in every stage. A stage may change what a feature puts forward
  first, read from `classify().stage`, never as a mode the writer manages.
- **One automatic action:** a stage snapshot (kind `stage`, never pruned) on any
  status change of a work.
- **The hub is a note the writer owns**, with an `escrita-works` block Escrita
  draws and never writes. It shows only what to write today (draft and revision);
  everything else is a count. A click opens the work where the writer left off.
- **Considered and dropped:** a Works tab, a three-pane library and a stage board
  (too much to manage, and boards are StoryLine's); per-stage settings; stage
  dropdowns and action buttons in the block.

## File classification (`core/classify.ts`)

`classify(tree, settings, path)` says where a path sits; `plugin.books.classify(x)`
is the Obsidian adapter (it accepts a `TFile`, a `TFolder`, a vault path, or
null). The adapter never normalizes a live file's own path: every lookup tries the
path as given first and `normalizePath` only as a fallback (`lookupPath`), so a
file named with a U+00A0 space or NFD accents is still found; a string argument is
used as is when something exists there, else normalized, and `""` stays `none`
(`placementPath`). Both helpers are pure and tested in `tests/classify.test.ts`;
the rest of the adapter (the `instanceof` checks, the root folder filtered out of
`folder`/`folders`) is covered by the manual smoke checks. The vault is reached through `VaultTree<F, D>`, a
read-only port of five calls (`file`, `folder`, `folders`, `frontmatter` and, since 0.9,
`resolve(link, from)`, which the adapter in `core/books.ts` answers with
`metadataCache.getFirstLinkpathDest`), the
same pattern as `ChapterFs` in `core/chapter-engine.ts`; `tests/classify.test.ts`
drives it with an in-memory tree. The result:

- `kind`, structure only and a closed set: `chapter` (a `.md` file directly in
  `<book>/<chaptersFolder>/`), `book-note`, `book-file` (any other file under a
  book folder: `Darlings.md`, a canvas, `Chapters/Old/x.md`), `note` (a `.md` file
  in no book), `file` (anything else in no book), `book-folder`, `chapters-folder`,
  `folder` (the root included), `none` (null, `""`, or nothing at the path).
- `markdown`: an existing file ending in `.md` (case-sensitive).
- `book`: the innermost book that **owns** the path (the book note is checked first,
  so a book note inside another book's folder belongs to its own book). A book is
  a non-root folder `F` with a note `F.md` and a folder `F/<chaptersFolder>`
  (`chaptersFolder` may be nested, like `Drafts/Chapters`); `listBooks` uses the
  same rule, so `allBooks()` and `classify` always agree.
- `tracked`: goals' rule — markdown, inside a track folder (or anywhere when there
  is none), outside every exclude folder, not the chapter template. Independent of
  kind: a chapter in an excluded folder is still a chapter.
- `piece`: `readPiece` of the frontmatter for any markdown file, chapters included.
  A standalone piece is `kind === "note" && piece`.
- `pieceSource` (1.0, IMPROVEMENTS 8): where the piece's target comes from, `"own"`,
  `"book"` (a chapter's book default, `chapterTargetProperty` on the book note) or null
  (no target). The rule is `effectivePiece` in `core/measure.ts`, per field: the note's own
  target wins, `limit` and `deadline` are only its own. In 1.0 Wave 0 the field is set
  from today's `piece`; task 1.1 computes the book default in classify and makes `piece`
  the effective piece, so the outline, the explorer and the goals modal agree.
- `snapshot`: the path is the snapshots folder or inside it (`inSnapshots`). Such a
  path is never a book, a chapter or tracked, even when the folder sits inside a book
  (a snapshot folder is named like its note, `x.md/`). The outline and the explorer
  skip it through this field, goals through `tracked`, and the placeholder index
  excludes `snapshotsRoot` like an exclude folder.

- `submission` and `export` (0.8): the path is the submissions folder or the export
  folder, or inside it (`inSubmissions`, `inExports`; roots from `submissionsRoot` and
  `exportRoot`, defaults `Escrita/Submissions` and `Escrita/Exports`). Both work exactly like
  `snapshot`: never a book, a chapter or tracked, so never a work, no stage, and no draft
  status (`core/new-note-status.ts` skips both). A file there is a `note` or a `file` with
  no book, even when the folder sits in a book. The rule holds whether the feature is on
  or off, because classify knows no features. The universe indexes skip both folders
  (`isUniverseNote` in `universe/entries.ts`).

The snapshots, submissions and export folder settings are read only through
`snapshotsRoot(setting)`, `submissionsRoot` and `exportRoot` (trimmed, slashes cleaned,
empty → the default). They are checked before saving through one validation, see
"Plugin folders". `snapshotsFolderProblem` is its first step: not `..`, not the config
folder, not inside (or holding) a track folder, not a folder that already has `.md` notes.

**`classifyKey(settings)`** (0.8) is one string for every setting classify reads except the
scope keys: the track, exclude, chapters and chapter template folders, the three plugin folders
(normalized, so an empty value and the default give the same key), the status property,
the stages and the four piece properties. Every index spec whose values depend on classify
puts it in its `settingsKey` (works, explorer, placeholders, entries, threads, mentions, names),
so a new classify input is added to the key once and every index rebuilds on it.
**`scopeKey(settings)`** (0.9) is the four scope keys (`universeMode`, `universeNote`,
`defaultUniverseFolders`, `universeProperty`; a missing mode keys as "off"); only the specs
whose values depend on scope compose it too (the universe's, through `entries.classifyKeyOf`),
so a universe setting change doesn't rebuild the works, explorer or placeholders indexes.

It reads the live vault and the settings passed in every time: no cache, so
renames and settings changes need no invalidation. Don't add one. It never throws.
A missing path is `none` and guesses nothing from its ancestors: for deleted or
old paths, use `inBook(path, book)`, which is **containment** by path (the note,
the folder, anything under it, including a nested inner book's files).
`Placement.book` is **ownership** (innermost). They differ only for nested books;
keep both.

Growth: new knowledge arrives as new fields on the result and new fields on
`ClassifySettings`, never as new kinds and never as caller changes. The universe's
`scopeFor(file, settings)` became the `scope` field in 0.9 (below); the file explorer counts of v0.3 read `kind`, `book` and `tracked` per item.
The writing desk (0.4) added `stage`, and 0.8 added `submission` and `export`, all the
same way.

- `stage`: the work's stage (`idea`, `draft`, `revision`, `ready`, `published`), set only
  for a **tracked** book note or a tracked standalone note whose status property holds a
  word mapped to a stage in `settings.stages`; null for everything else (chapters, files,
  untracked notes, an unknown or missing status). This is the one stage rule for works
  (`stageFor` in `core/classify.ts`): the works index, the publish check and the stage
  snapshot all read it, and none re-derives it. Words match after NFC, trim and
  lowercase; a word listed under two stages belongs to the first stage in order.
- `scope` (0.9, IMPROVEMENTS 9): which world the path lives in, a `Scope` from
  `core/scope.ts`, set on every placement, folders and `none` included. See "Scope".

## Scope (`core/scope.ts`, 0.9)

The question every universe feature asks first, moved from `universe/scope.ts` into core so
that the classifier can answer it (IMPROVEMENTS 9). Pure, no Obsidian imports.

- **`Scope`** is `{ kind: "none" | "book" | "universe", root, note }`. `NO_SCOPE` is the none
  scope; `sameScope(a, b)` compares two. `scopeFor(file, settings, lookup)` computes it;
  `keptOut`, `linkText`, `inFolder`, `universeNotePath` and `universeRootOf` live beside it.
  The rules are unchanged from 0.7 (rule 0 `universe: false`, then the file's own property,
  the book note's, the universe folder, a default-universe folder, a book, else none); the
  universe section describes them.
- **Classify imports scope, never the reverse** (no cycle at load). `ScopeSettings`, `ScopeMode`
  (`off`, `perBook`, `universe`) and `ScopeLookup` are declared in core, so core never imports
  the universe. `ScopeLookup.resolve` is answered by `VaultTree.resolve`.
- **`Placement.scope`**: `classify` builds the lookup on its own tree (`scopeLookup`, which reuses
  the frontmatter classify already read for the path) and calls `scopeFor` for a
  file, a book note, a chapter, a book folder and a folder. Folder settings are parsed once per
  text (`lists.folderListOf`). Snapshots, submissions, exports and
  `none` keep `NO_SCOPE`. With the mode off or missing, classify returns at once and reads
  nothing more (the cost on the 3,020-file bench: about 7% with the mode on, none with it off;
  `PLAN-0.9.md`, G0c). A missing `universeNote` reads as `Universe.md` and a missing
  `universeProperty` as `universe`, the universe module's defaults. A throw inside `scopeFor`
  gives `NO_SCOPE`: classify never throws. Scope follows the `universeMode` setting, **not the
  feature switch**: a placement has a scope whenever the mode is on, even with the universe
  feature off, so a caller that cares checks `features.isOn("universe")`.
- **Who reads what.** The outline's POV code reads `linkText` from here (its copy is gone).
  `UniverseModule` still calls `scopeFor` and `keptOut` directly, with a lookup it builds, for
  the entries and the mentions: a placement's scope would need a feature check in every caller.
  `universe/scope.ts` is deleted; nothing imports it.

## Markdown segmentation (`core/markdown.ts`)

`segment(text)` splits a note into spans — `prose`, `frontmatter`, `code`
(fenced blocks and inline spans), `comment` (`form: "%%" | "html"`) — in one
left-to-right pass, and answers every question the features ask: `spans(from?, to?)`,
`startsIn(line)` (what a line starts inside: the kind of the line break before it),
`lineOf`/`lineStart`/`lineEnd`, `bodyLine`, `unclosedFrontmatter`, and `masked()`
(the text with every non-prose char blanked, offsets kept 1:1). `segmentDoc(doc)`
caches per immutable document object (a CodeMirror `Text` is one per version).
The consumers take either a text or a `Markdown` (`parseBeats`, `parsePlaceholders`,
`outline/model.scanBeats`, `placeholders/logic.placeholderSpans`,
`editor/enter-flow.decideEnter`/`trailingBreakKeep`, `publish/checks.unclosedComment`,
`core/block-context.blockStateIn`, `wordcount.countSelection`), and every editor
feature passes `segmentDoc(state.doc)`, so ghost beats, placeholder pills,
typography, the Enter flow and the selection count share one pass per document
version. `runChecks` segments once and hands the result to each check. `segment`
also caches the last string, a convenience for string callers, not a guarantee.

A line-level question ("what is on line i") clips `md.spans(lineStart(i), lineEnd(i))`
to the line (`lineSpans` in `core/markers`); `startsIn(i)` says what the line starts
inside. Put a new line-level predicate next to `isSceneBreakLine` instead of
re-deriving it in a feature.

Rules (a strict left fold: the first opener wins; inside a construct only its own
closer matters; each rule has a test in `tests/markdown.test.ts`):

1. **Frontmatter** only when line 0 is `---` and a later line is `---` or `...`
   (trailing blanks allowed). No closer → no span (counts and markers read it as
   body) and `unclosedFrontmatter` is set; the editor alone treats that as "all
   properties" (`core/block-context.bodyLineIn`).
2. **Fences** at the start of a line that starts in prose: ≤3 spaces, then 3+
   backticks or tildes (a backtick info string can't contain a backtick). Closer:
   ≤3 spaces, same char, at least as long, only blanks after. Unclosed → to the end.
3. **In prose**: `\` escapes a backtick or backslash; a backtick run is inline code
   when a run of the same length closes it on the same line (else literal); `%%`
   opens a comment to the next `%%`, across lines (unclosed → to the end, like
   Obsidian); `<!--` opens a comment to the next `-->` only if there
   is one. An unclosed `<!--` is literal so a stray one can't hide placeholders
   from publish; this matches CommonMark for inline HTML only: at the start of a
   line (an HTML block) Reading view hides everything after it, so the
   counts over-count there. Accepted: publish must not miss a placeholder.
   Since 0.8 the readiness check `unclosedHtmlComment` blocks on any `<!--` that never
   closes, and the manuscript cuts the text after a line-start one (a mid-line `<!--` stays
   literal), as Reading view does.
   `%%` inside a closed `<!-- -->` is literal (the first opener wins), so an odd
   one there doesn't open a comment for counts or the editor; the publish check
   still blocks on it (`unclosedComment`), because parity with Reading view is
   unverified and either reading must be safe.

4. **Math** (0.8, D16 and D18). A `$$` at a line start in prose (up to 3 spaces of
   indent) opens math up to the next `$$`, on that line or a later one. It stays prose,
   so its words still count, but nothing opens inside it: a `%%` in a math block is
   literal, as in Reading view (gate G0c, 2026-10-05). With no closing `$$` it is not math
   and the `$$` is plain prose, so a stray `$$` never hides a placeholder. A `$$` inside a
   comment, code or frontmatter, or after other text on a line, opens nothing.
   `Markdown.inMath(line)` says whether a line starts inside a math block (the line after
   the opener up to and including the one with the closing `$$`; false for the opener
   line and out of range). The editor reads it (`core/block-context.ts`) and keeps no math rule
   of its own.

Block spans end at the end of their closer's line; the line break after is prose.
Not segmented: 4-space indented code, fences inside quotes or lists, multi-line inline
code.
`core/block-context.inlineProtected` keeps its own backtick loop on purpose: it
predicts a span that is still being typed, which is not a parse.

Parity with Obsidian's Reading view was checked by hand on 2026-10-05 (gate G0c), and
each answer is pinned by a row in `tests/markdown-consumers.test.ts`: a fence inside an
open `%%` comment is literal here and in Reading view, escaped backticks match, `%%`
inside a closed `<!-- -->` is literal in both, and `%%` inside a `$$` block is literal in
both (the one rule that changed, rule 4). The publish check still blocks an odd `%%` inside
a closed `<!-- -->` (`unclosedComment`), because either reading must be safe.

## Stemmers (`core/stem/`, shipped in 0.5)

One function, `stem(word, lang, profile = "word")`, in `core/stem/index.ts`; `lang` is
`"pt"` or `"en"`, `profile` is `"word"` or `"name"`. Pure TypeScript, no `obsidian`
import, no dependency, no copied word list: written by hand from the published
algorithms (Orengo and Huyck 2001 for the RSLP shape, Porter2). It serves the revision
lens now; the universe (U 1.2, U 1.4) reuses it without importing the lens.

- **Contract.** `stem` normalizes first: NFC, `toLowerCase()` (no locale), `’` to `'`.
  Callers pass raw tokens. The result is an opaque key, **compared for equality only**
  (never shown, never stored as a word). The key is case-folded, so a caller that must
  be case-sensitive (U 1.2's per-entry `caseSensitive`) compares the raw token's casing
  first and uses `stem` only for inflection. A bounded memo per (lang, profile) keeps
  repeated calls cheap. A token with no letter comes back as it is.
- **`"word"` profile** (echoes, ignore lists, and common-noun universe entries):
  - pt: clitic split, adverb, plural, feminine, augmentative/diminutive, verb suffix,
    final vowel, accents. *olhar / olhou / olhando / olhares* share a key.
  - en: Porter2 step 0 (possessive), 1a (plural, with `-es` also after x, z, ch and sh),
    1b (`-ed` / `-ing`, undoubling, restoring `e`), 1c (`y` to `i`), Porter2's final-`e`
    rule, and `-ly` on stems of 4 or more letters (words like *family* and *reply* are
    kept).
- **`"name"` profile** (people and places): pt, plural and diminutive/augmentative only;
  no feminine step and no vowel or accent removal, so *Maria / Mariazinha* share a key
  but *Maria / Mário* and *Mariano / Mariana* do not. en, the possessive and a simple
  plural `-s` on stems of 3 or more letters that don't end in `s`; never Porter (*James*
  stays `james`). Minimum stem is 2 characters. This narrows U 1.2's "plural, feminine,
  diminutive and augmentative" for person and place entries.
- **`splitClitic(normalized)`** (`core/stem/pt.ts`): strips one known clitic after the
  last hyphen (`me te se lhe lhes nos vos o a os as lo la los las no na`), returning
  `{ base, clitic }`. The word rules use it to test a token's base (*dizendo-lhe* is a
  gerund; *olhou-me* stems like *olhou*). Mesoclisis (*dir-se-ia*) is not handled; other
  compounds stay one token.
- **Out, on purpose.** The pt noun-suffix step (`-mento`, `-ção`, `-dade`, `-ista`): it
  merges *casa / casamento* and *mente / mentira*. Porter2 steps 2 to 5 (*universe /
  university*). The feminine step in `"name"`. The rule is to prefer missing a match over
  a wrong one.
- **Stop words** (`core/stem/stopwords.ts`): our own lists, 150 to 250 per language,
  written by hand, so the universe can reuse them. `isStopWord(normalized, lang)`. English
  contractions (*don't*, *she'd*) are stop words matched whole before stemming.
- **Fixtures are the contract.** `tests/fixtures/stem/*.tsv` pin the merge and split
  pairs (*bola / bolo*, *sede / seda* and *ponto / ponta* stay apart); a change to a key
  after the universe uses it is a matching change, so never change a fixture row to make
  a test pass.

## Names matcher (`core/names.ts`, 0.7)

Pure, no Obsidian imports. `compileTerms` turns entries (a name, aliases, a first name for
people) into a `TermTable`; `findNames` reads the reader mask (offsets match the document)
and returns occurrences with candidates. Words are folded with `foldName` (accents
removed) before they are stemmed, so *Inês* and *Ines* meet; a hyphenated word also
matches as its parts.

- **Terms and keys.** A `NameSource` is an entry (path, name, aliases, `person`,
  `firstName`, `caseSensitive`, `ignore`). `compileTerms(sources, { lang, extraTitles })`
  gives a `NameTerm` per name, alias and derived first name, each with its `words`, its
  `keys`, its `origin` (`name`, `alias` or `first`, in that rank) and its `profile`. A key is
  `stem(foldName(word), lang, profile)`, prefixed by the profile (`name:` or `word:`); with
  no language it is the folded word.
- **Profiles by capital letter.** The stem profile comes from the term, not the entry's
  kind: a term whose first letter is a capital uses `"name"`, any other uses `"word"`. A
  capitalized term matches only tokens that start with a capital (word by word, all caps
  included); a lowercase term and `caseSensitive` entries are unchanged (a case-sensitive
  term compares case with accents ignored). Only capitalized terms feed the lens and the
  name marks (`capitalizedTerms`).
- **Phrases.** A multi-word term matches through `findPhrase`: only whitespace and
  emphasis marks between the words, no article rule (each word is stemmed on its own and
  must match as written), the longest match wins at a position, overlaps resolve left to
  right. A hyphenated word is its parts, in the text, in a term and in an ignore phrase,
  unless a part has an apostrophe. One-letter and stop-word terms never match.
- **Collisions.** Terms with the same key from different entries are candidates of one
  occurrence; `pickEntry` keeps the candidates in the note's scope, prefers those whose folded
  text equals the term's (`Candidate.exact`), then explicit names and aliases over a derived
  first name, and leaves the occurrence for no one when more than one entry is still left.
- **First names and titles.** For a character with `firstName` on, leading titles
  (`core/name-titles.ts`, Portuguese and English tables picked by the writing language,
  both when it is "auto" with another locale, extended by `nameTitles`) are skipped and
  the next word is a term when another word follows. The name minus its titles is also a
  term. Titles compare with accents kept.
- **Ports.** `NamesPort` (`plugin.names`) holds one `NamesProvider`: `tableFor(path)` (the
  terms of the note's scope), `entryFor(text, path)` (used by POV links), `version()` and
  `onChange`. Since 0.9 the provider also has optional methods for the lens's names rule, and
  the port answers false, 0 or nothing when there is no provider (the universe is off):
  `isKnownName(text, path)` (a name, alias, automatic first name or name title of the note's
  scope, compared by `foldName` of the whole text), `workCount(text, path)` (in how many
  works of the scope a capitalized run appears; 0 until the index is built), `wantNameCounts()`
  (starts the on-demand index, once), `nameCountsReady()`, `createEntry(name, from)` (opens the
  create-entry dialog for that note's scope with the name filled in; writes nothing) and
  `hasProvider()`. Cross-work counts have their own signal, `onCountsChange` and
  `countsVersion()`, apart from `onChange`: only the lens's rule reads counts, so a count
  update never refreshes the name marks, spellcheck or the outline. The universe provides it (`universe/names-provider.ts`: one table per scope,
  compiled again only when its sources' signature changes) and withdraws it on unload.
  The lens, the name marks and the outline read the port, never the universe.
- **Name runs** (`core/name-runs.ts`, 0.9). `nameRuns(tokens, sentences, mask, lang)` finds the
  candidate names of a text: capitalized words one after the other, separated only by spaces or
  tabs, joined by the language's lowercase joiners (`NAME_JOINERS`: `de`, `da`, `do`, `das`,
  `dos` in Portuguese, none in English). A run is a `NameRun { from, to, text, key }`, the key
  being `foldName(text)`. A run that starts a sentence loses a leading stop word ("A Joana"
  gives "Joana") and is skipped otherwise; English "I" and its contractions never start or
  join a run; with no language every run at a sentence start is skipped. The rule errs toward
  silence. `namesMask(md)` is `core/wordcount.readMask` with "Skip quotations" off: `readerMask`
  with heading lines and `$$` blocks blanked, the lens's own mask. The
  lens's rule and the universe's `universe-names` index both call these two functions, so
  the in-note count and the cross-work count agree, and neither module imports the other.
- **Names index** (`universe/names-index.ts`, 0.9). The `universe-names` index: for each note
  the mentions index would read, the distinct run keys it names (`runsOf`), and the cross-work
  count behind `workCount`. On demand like the mentions index, and stricter: nothing is built
  until the lens's rule first runs (`wantNameCounts`), so a writer who never turns the rule
  on never pays for it. A note's runs settle 4 s after an edit (`NAMES_SETTLE_MS`), and a
  change to a work's set of runs notifies the port 3 s later (`NAMES_NOTIFY_MS`), once the
  build has finished and then debounced, never once per file while it builds. With "Skip
  quotes" on, the cross-work count can include runs from quote lines that the lens never marks.
- **Unlinked mentions** (`universe/unlinked.ts`, `unlinked-link.ts`, `view-unlinked.ts`, 0.9).
  `unlinkedIn(mentions, linkedEntries, note)` is pure: from one note's `NoteMentions`, the
  entries its links resolve to and its segmented text (`note.md`; `line` is `md.lineOf`), the
  occurrences of entries the note never links.
  `note.inScope` picks the entry as Appears in does, and an occurrence still ambiguous is
  skipped. `line` is 0-based. An occurrence inside a link or embed already in the text is never
  listed (the mentions index drops it from the text of a Markdown link to a web page, and Link
  would have written a link inside it). A note that links an entry anywhere lists none of its
  mentions, so the writer links the first one. **The rows come from the note's live text**,
  with the mentions index's matcher: the index only says when the answer is ready
  (`UniverseModule.unlinkedFor`), because it settles 4 s after an edit and its offsets would be
  stale, and a row would come back right after Link. `unlinked-link.ts` is the other pure part:
  `rowsOf`, `excerptOf`, `linkMarkup` (`[[Entry|text]]`, or `[[text]]` when the text is the
  entry's name) and `linkPlan`, a check-then-replace over the whole line the row listed: a
  word that grew ("Teo" to "Teodoro") or a changed line writes nothing, and the row refreshes.
  In a table row (`core/markers.isTableLine`, the GFM rule, leading pipe optional, read on the
  text at write time) the plan asks for the link with its pipes escaped `\|`.
  The write goes through `plugin.notes` on an explicit click: one mention, never "link all".
  The section draws under the active work in the Works tab, and at the bottom of the Entries
  tab in per-book mode (which has no Works tab); for a book it lists the **active chapter's**
  mentions only.
- **Performance budget.** `tests/names.test.ts` has a CI ceiling (300 entries against a
  10,000-word note under 100 ms) that catches quadratic code, and a local budget that is
  skipped when `CI` is set: **20 ms** (median of the fastest half of the runs, to ride out
  a loaded machine) for the same note. The two-thousand-word bench (`tests/names.bench.ts`,
  `vitest bench`) is how the figures were measured (0.7 plan, G0h).
- **G0h figures.** Desktop, `segment + readerMask + findNames` with 300 entries (1,310
  terms) over a 2,000-word prose with about 2% name hits: **1.9 to 2.2 ms per 1,000 words**
  (median of 20 runs after 5 warm-ups; whole run 3.4 to 3.8 ms). **The phone figure is still
  open**: it needs the spike plugin on a device, and the ceilings below use the desktop
  figure alone. The mentions index's CI ceilings come from it
  (`tests/universe-mentions-index.test.ts`): the vault's words (1,000s) times 2.2 ms times a
  margin of 5, which catches quadratic code without failing a loaded runner. Two cases,
  500 notes and 5,000 notes of 2,000 words each with 300 entries, so about 2.2 s and 22 s of
  work and ceilings of about 11 s and 110 s; each also checks that the build yields to
  the event loop between batches (default 40 notes). The name marks' test holds a
  20,000-word note under 100 ms (5 times the desktop figure at most).
- **Mentions index** (`universe/mentions-index.ts`, `mentions.ts`). A content spec on the
  vault index over the notes that can mention an entry (not snapshots, export or submission
  notes, template notes or the universe note itself, all through `isUniverseNote`; the mode and the template settings are part of what decides
  it). Each note keeps its `NoteMentions`: occurrences from the reader mask (a mention
  inside a prose link is dropped because the link already counts) and its prose links.
  Per-entry answers (`appearsIn`) are grouped lazily and cached until the next change.
  **On demand (0.8, Q15)**: the spec is `start: "demand"` with `settleMs` 4 s
  (`MENTIONS_SETTLE_MS`). The universe adds it once the entries index is ready, but nothing
  is built until `demand()`: the first `appearsIn` or `workCount` query, the panel's Works or
  Entries tab drawing (`UniverseModule.demandMentions`), or an entry note becoming active. Until
  it is ready the surfaces show "counting", and a table change while it hasn't started does
  nothing (the first build reads the table as it is then). Typing in a note recomputes its
  mentions only after 4 s of quiet. **Rebuild rule**: the first build waits for the entries
  index and the provider's first table. After that a table change schedules a check 2 s later and rebuilds only when the
  table's `signature` differs from the last build's; old values stay visible during a
  rebuild. `scopeChanged()` (a note created, deleted or renamed, a `universe` property)
  clears the grouped answers and the resolved links; an ordinary edit updates one note.

## Design reference

The approved design (canvas "Escrita plugin") shows, in Portuguese:

1. **Outline panel** (right sidebar view): header "Outline" + book name (a dropdown
   when there are several books); "4 chapters · 6 beats"; "18,420 / 80,000" with a thin
   accent progress bar. Toolbar buttons: "open as board (Canvas)", "color by POV"
   (optional; can be omitted in v0.1). Rows: monospace chapter number, chapter title
   (medium weight), right-aligned status dot + word count, summary below in muted text.
   The chapter of the active file is highlighted (background-modifier-hover) and its
   number uses the accent. Beats are indented under their chapter with a monospace
   letter (a, b, c…): written beats are normal text with a green check, unwritten beats
   are muted. A chapter with 0 words shows "outline only" instead of a count. A chapter
   with placeholders shows a small red "1 XXX" badge. Last row: "+ New chapter… (Enter)".
   Footer: keycap hints — Enter new line · Tab makes it a beat · Shift+Tab makes it a
   chapter · Backspace on an empty line deletes it · drag to reorder, files renumber.
2. **Ghost beats in the editor**: an unwritten-or-written beat line renders (Live
   Preview, cursor elsewhere) as a small uppercase label "BEAT B · FROM OUTLINE" above the
   beat text in italic, faint color. Scene breaks between beats.
3. **Placeholders in the editor**: `%% XXX: … %%` renders as a small monospace pill with
   a red tint. File explorer shows a small red dot after files that contain placeholders.
4. **Progress modal** (opened by clicking the status bar): title "Progress" + book name;
   three tiles — Today (412 / 1,000, bar, "+180 cut while revising"), Book (18,420 /
   80,000, bar, "23% · 4 chapters"), Streak ("5 days in a row", 7 small segments for the
   last 7 days, "goal met 8 of 30 days"); a 30-day chart — bars of words per day (accent
   when the daily goal was met, a muted tone otherwise), a dashed horizontal line at the
   daily goal, a line for the book's running total with its value labeled at the end,
   x labels (first day, middle, "today"), legend; a pacing callout (green tint when on
   track, amber when behind) — "On track. 153 days until Mar 1, 2027: you need 403 words
   a day. At your current pace (520/day, 7-day average) you finish on Jan 26, 2027, 34
   days early."; settings row — daily goal, book goal, deadline (date input), the day ends
   at; sprint row — segmented 15/25/45 min, target words input, "Start sprint" button
   (accent), or "Stop sprint" with remaining time when one is running.
5. **Status bar**: "chapter 1,120 · book 18,420" (only in a book), "412 / 1,000 today"
   with a 48px progress bar, "5 days in a row". Goal met: green check + green count.
   Sprint running: mono countdown "12:40", "286 / 500", bar, "stop" button. With a text
   selection: "84 words selected" replaces the chapter/book counts. Sprint end:
   a Notice "Sprint done: 540 words in 25 min (1,296 an hour)".

## Measuring (`core/measure.ts`, `core/measure-cache.ts`, `core/measurer.ts`)

Every count shown or recorded comes from here; don't count notes anywhere else.
`plugin.measure.counts(file, seed?, unit?)` gives a note's `Counts` (`words`,
`characters`, `charactersNoSpaces`), cached by mtime (`seed` is `{ text, mtime }`, the
file as the caller already read it with the mtime seen before the read; a seed older
than the file is ignored and the file read again); `peek(path, unit?)` is the sync last
known value; `note(file)` adds the live piece, unit and `Progress`; `book(book)`
sums the chapters and reads the goal and deadline (`bookGoal`), `bookPeek(book)` is
the sync sum; `unit(file)` is the unit the note is counted in. `onChange(paths[])` fires when counts are added, change, are dropped,
or move (a rename lists old and new paths). The interface is documented at the top
of `src/core/measurer.ts`.

- **Upkeep.** The measurer handles vault `rename` and `delete` (folders too) and
  recounts, debounced, any `.md` `modify` or `create` (sync, git, other plugins,
  Escrita's own `vault.process`) for files already counted or tracked. It is built
  in `main.ts` before the modules so its handlers run first. Frontmatter-only edits
  don't change counts: listen to `metadataCache` `changed` for those.
- **Piece and unit are read live**, never cached: the metadata cache lags behind
  `modify`. A note's unit is its piece's, else `readUnit` (a note with only
  `unit: characters` is still counted in characters), else words.
- **Characters only where needed.** Measured on a 30,000-word chapter, the character
  counts cost about three times the word count (≈ 3 ms for words, ≈ 12 ms for both),
  so a vault-wide first pass counting both eagerly would far more than double the
  cost. The cache (kept for the whole session, for every counted note) holds numbers
  only, never a note's text: characters are counted for notes counted in characters
  (`counts` asks for them from the note's unit, or the `unit` argument), and kept on
  recounts once counted. A words-only entry is a miss for a caller that needs
  characters (one more read), and reading its character fields throws
  `CharactersNotCountedError`: pass the unit. `measureText` itself (publish, the
  explorer's live count of the active note) stays lazy: short-lived callers pay for
  the characters only when they read them.
- **Property names** come from settings: `targetProperty`, `limitProperty`,
  `unitProperty`, `deadlineProperty` (notes and books), `goalProperty` (books), and, since
  0.7, `povProperty` (a chapter) and `chapterTargetProperty` (a book note).
- **Chapter default (0.7).** `readChapterDefault(fm, props)` reads a book note's chapter
  target (through `parseAmount`) and its unit under the configured names, or null when it
  sets no target. `effectivePiece(own, def, ownUnit)` decides per field: the chapter's own
  `target` wins, else the book default; the chapter's own `limit` and `deadline` are kept; the
  unit is the chapter's, else the default's, else words (a blank unit is no unit). It also
  says where the target came from (`own`, `book` or null). Only `target` inherits. The
  default is read by the outline (rows and bars) only: the measurer, the explorer and the
  goals still read a chapter's own properties, so the explorer may show no target where the
  outline shows a bar (IMPROVEMENTS candidate 8).
- **Publish** measures the editor's text with `measureText` (maybe unsaved), never
  the cache.
- **Labels** go through `unitAmount(unit, n)` and `plural(key, n)` in `src/i18n.ts`
  (`common.unit.*` strings), so "1 word" is never "1 words".

## Note text (`core/note-text.ts`, `core/notes.ts`)

Every Escrita write into a note's text is one plan applied through one port:
`plugin.notes.text(file)` → `NoteText { via, read(), apply(plan) }`, where `plan(current)`
answers with one `Change { from, to, insert }` against exactly that text, or null to
refuse.

- **Which adapter.** The editor (`editorText`) when a `MarkdownView` shows the file in
  source or Live Preview mode: it reads the buffer (maybe unsaved) and applies one
  transaction, so the change joins the undo history and typing can't slip in between.
  Otherwise the vault (`vaultText`): the plan runs inside `vault.process`. Reading-mode
  views are saved first (`view.save()`), so their pending text is never lost.
- **Bound to its note.** Obsidian reuses a view's editor when its tab opens another
  note. The editor port checks, on every read and apply, that its view still shows the
  file in source mode; if not, `read()` rejects (`EditorMovedError`) and `apply()`
  refuses. Ask for a fresh port after any await (snapshot restore does).
- **Anchored changes.** A change computed earlier (a compare view's "Use the old
  version") carries the text it expects plus context (`anchor`), and `checkedChange`
  applies it only where that is still true: at its offsets, else at the one place the
  context occurs. A compare view also passes the whole text it showed (`revertPlan`):
  a pure insert's context can be as short as a paragraph gap, so a stale view refuses
  instead of reverting at a shifted offset.
- **Folders.** `plugin.notes.ensureFolder(path)` creates missing folders and throws
  `FolderBlockedError` when a segment is a file; darlings, outline and snapshots use it.
- **Creating files.** `plugin.notes.create(path, data, { exists, trashOld? })` (0.8) is
  the one find-or-create, for a note (text, `vault.create`) or a binary file (`string |
  ArrayBuffer | Uint8Array`, `vault.createBinary`; `createBinary`, `modifyBinary` and
  `readBinary` are public Vault API, so writing a `.docx` needs no exception). It
  normalizes the path, makes the missing folders with `ensureFolder`, converts a
  `Uint8Array` to an exact `ArrayBuffer` once (a view into a larger buffer would write the
  wrong bytes), and looks for what is already there ignoring case. It returns
  `{ file, outcome }`, with outcome `created`, `existing` or `replaced`. The `exists`
  policy says what to do when something sits at the path:
  - `return`: keep it and return it, writing nothing.
  - `fail`: throw `NoteExistsError(path, existing, folder)`.
  - `unique`: create next to it under the first free name (`Title 1.md`, `Title 2.md`).
  - `replace`: overwrite the contents in place (`vault.modify` for text, `modifyBinary`
    for bytes), keeping the file and its links. Only for a derived file (an export) or
    after the writer said yes (rule 1); asking stays with the caller. With `trashOld`,
    the old file goes to the trash (`fileManager.trashFile`) and a new one is created,
    for a file the plugin may not have written.

  A folder at the path throws `NoteExistsError` under every policy but `unique`. A
  `replace` refuses when the clash differs from the path only by case (on a
  case-insensitive disk that is another note of the writer's). A file that appears between
  the check and the create is looked for once more. Callers: the outline (the board file
  and the new book note), darlings, the home note, the lens' word-lists note, the universe
  (create entry, entry templates), the export and the submissions.
- **Plans written as text-to-text.** `guardedEdit(guard, edit)` turns "check the text,
  then return the new whole text" into a plan (the smallest `Change` between the two;
  null when the guard fails or `edit` answers null; `edit` may throw to refuse with a
  message). `replaceIfExact(from, to, expected, insert)` replaces a span only while
  exactly `expected` is still there: no searching, since a marker that moved is a marker
  that changed. `matchLineEndings(text, doc)` gives text the line endings of `doc`, for
  plans that run on a disk text with CRLF and an editor buffer with LF.
- Users: placeholders (resolve), darlings (cut and restore), publish (read), snapshots
  (read, restore, "Use the old version"), the outline (every beat write, with
  `guardedEdit`, and the emptiness checks before trashing a chapter, which read the
  open editor's unsaved text), the universe (closing and reopening a thread, the
  "Insert link" of the panel, the link in create entry), and the export (the book source
  reads each chapter through `notes.text(file).read()`, so unsaved text counts). Two editor
  commands write straight to the editor that triggered them, which the editor-writes rule
  allows (see "Conventions"): "Plant a thread" (synchronous, on that view) and "Insert from
  a template" (which re-checks after its await that the view still shows the same note).

## Thread markers (`core/markers.ts`)

Threads are single-line comments like beats and placeholders (`%% thread: … %%`), read
with the same segmenter, so a marker in code or frontmatter doesn't count. The keyword
and the closed word are settings, never constants.

- `parseThreads(src, keyword, closedWord)` → `ThreadMarker { line, from, to, text,
  closed, answeredBy, raw }`. The closed form is `%% thread closed: … %%`; the colon is
  required, so `%% thread closed door %%` is an open thread. A trailing `→ [[note]]`
  (or `->`) is the answer link.
- `threadComment(keyword, closedWord, text, closed, answeredBy)` writes one: `%%` in the
  text and the answer is cleaned out, and the link goes through `linkTarget` (drops
  `|alias`, `#heading` and `^block`).
- `closeThreadPlan` and `reopenThreadPlan` return `(text) => Change | null`. They
  re-parse the text they run on and accept only the same line number with the identical
  `raw` comment (never offsets), so a CRLF disk text and an LF editor buffer agree, and a
  moved or edited marker refuses. Apply them through `plugin.notes`.

## Template filling (`core/template.ts`)

One filler for new chapters, "Insert from a template" and the universe's entry templates.
`templateVars(title, now)` and `renderTemplate` fill `{{title}}`, `{{date}}` and
`{{time}}`. `splitTemplate` separates a template's properties (top-level `key:` lines with
their indented and list lines, kept as written, no YAML library) from its body.
`mergeProperties(noteText, props)` is a `Change` that adds only the missing properties
(never overwrites, null for an unclosed frontmatter). `planTemplateInsert(noteText,
cursor, template, vars)` gives the non-overlapping changes for one editor transaction: the
merged properties and the body at the cursor, never inside the frontmatter, on a line of
its own after a closing `---`. `core/chapter-plan.ts` re-exports the pieces it used to own.

## Vault index (`core/vault-index.ts`, `core/index-hub.ts`, `core/vault-indexes.ts`)

One reusable, incrementally kept index replaces the per-module scans (placeholders and
the works list use it first). `plugin.index` is the hub; a module adds a spec and gets a
`VaultIndex<F, V>` back.

- **Spec** (`IndexSpec<F, V>`): `name`; `mode` (`content` reads each file's text through
  `cachedRead`, `metadata` reads only the metadata cache and gets `text === null`);
  `include(f)`; `compute(f, text) → V | undefined` (undefined means no entry); `same(a, b)`;
  `structural` (recompute everything when a file is created, deleted or renamed, because
  who is what can change, as the works index needs for `classify`); `settingsKey()`
  (a string that changes when a setting the spec depends on changes; a spec that depends
  on what a file is puts `classifyKey(settings)` in it, see "File classification");
  `start` (`"ready"`, the default, or `"demand"`) and `settleMs` (below). An index holds
  **values, never note text**: a spec computes what it needs from the text and returns
  only that (markers, a desk entry), so the index stays small and holds nothing to leak.
- **Cause contract.** Each change is `{ path, from?, before?, after?, cause }`, with
  `cause` one of `build`, `update`, `rename` or `delete`. `delete` is only for a vault
  delete event. A live file whose `compute` gives undefined, or that leaves `include`,
  is an `update` with `after: undefined`. A structural recompute emits `update` for
  changed values only (by `same`). A build, first or after a settings change, emits
  `build` for every entry, `same` notwithstanding, so a consumer can reseed from it.
  `onChange` gets one call per batch, in order; `onReady` fires after each completed
  build, never on subscribe (check `isReady()` first).
- **Ordering (measure, index, followers, modules).** `main.ts` builds `measure` first,
  so counts are fresh when an index computes; then the hub; then the works service; then
  the modules. On a rename or delete the hub updates every index first, then calls the
  followers (`plugin.index.follow({ moved, deleted })`), so a follower asking `works`
  about the new path already gets an answer. Path-keyed data (publish records, goals
  history, dialogue focus, left-off, the home note setting) follows renames through a
  follower, not through a module's own `vault.on` listener.
- **Build timing.** Nothing is read before layout ready (the vault announces every file
  while it loads, so `create` events are ignored until then). A `content` index builds
  at layout ready. A `metadata` index builds when every included file has a cache, else
  at the first `resolved` event; if no `resolved` comes (the plugin was enabled
  mid-session) a 5 s fallback timer builds anyway. A build reads files in batches (40 at
  a time), computes one file at a time and yields on a time budget (below); a newer build
  makes an older one stop. Live events that arrive during a build are mirrored into the map
  being built and win over the build's read.
- **Start on demand** (0.8, IMPROVEMENTS 14). A spec with `start: "demand"` is added but not
  built: until the first `VaultIndex.demand()` the index is not ready, gets no events, and
  a settings change or `rebuild` does nothing. `demand()` is safe to call on every query
  (it does nothing once started, and for a `"ready"` index); if the layout is not ready it
  builds at layout ready. The mentions index is the one such spec (see the universe spec):
  startup builds only the cheap indexes (about 85 ms on 3,020 notes, against 4.2 s with
  mentions).
- **Time budget** (0.8, IMPROVEMENTS 21). `yieldBudget(timers, ms = BUDGET_MS)` returns a
  checkpoint to await after each unit of work: it returns at once while less than `ms` (8)
  has passed since the last yield, and calls `timers.yieldNow()` when the slice is spent.
  Builds and flushes use it, so a pass holds the main thread for about 8 ms at a time
  whatever a file costs; the export uses it between chapters. The yield is
  `macrotaskYield()`: a `MessageChannel` message where it exists (not clamped to 4 ms
  like a nested `setTimeout`), else `setTimeout(0)`. The time source is `IndexTimers.now?()`
  (default `performance.now()`), so `ManualTimers` tests stay deterministic. 8 ms was
  measured on 3,020 notes: longest block 64 ms before, 22 ms after, same total time.
- **Debounce.** A modified file is recomputed after 300 ms of quiet, or after the spec's own
  `settleMs` (4 s for mentions, so typing doesn't recompute it at every save; the hub
  passes its default to each index, and the spec's value wins). `settingsChanged()
  (called by `saveSettings`) is debounced 500 ms, then rebuilds only the specs whose
  `settingsKey()` changed.
- **Folder renames are idempotent.** Obsidian may send a folder event and then one event
  per child. The hub remembers each folder event for 1 s and does not call the followers
  twice for the echoes (`movedPath` in `core/path-keys.ts` decides). Every follower must
  still be safe to run twice: `renameKeys` and its siblings move a key once and do
  nothing when it is already moved.
- **Shell.** `core/vault-indexes.ts` is the only Obsidian-facing part: one `vault.on`
  each for create, modify, delete and rename plus `metadataCache` `changed` and
  `resolved`, all registered through the plugin. Time and the vault are ports
  (`IndexTimers`, `IndexSource`), so `tests/vault-index*.test.ts` and
  `tests/index-hub*.test.ts` drive everything with `tests/support/memory-vault.ts` and
  fake timers.
- **Adding an index** is a spec plus a test on the memory vault. Do not add a
  `vault.on("modify")` listener of your own to rebuild something the index could hold.

## Manuscript model (`core/manuscript.ts`, 0.8)

`manuscriptOf(md, options)` turns a note's Markdown (a `Markdown` from `segment`, or
text) into the prose an editor receives, as a small block model that every export writer
formats. Pure, no Obsidian imports. A writer never looks at Markdown again.

- **Model.** `Manuscript { blocks, dropped }`. A `Block` is a closed set: `paragraph`,
  `heading` (level 1 to 6), `quote` (one paragraph of a `>` quotation or a callout body;
  the callout header line is dropped) or `sceneBreak`. Text is `Run[]` (`{ text, italic?,
  bold? }`); a run's `"\n"` is a line break inside the block (the Markdown writer writes
  it as a CommonMark hard break). A list item is a paragraph with its mark kept as text,
  and inline code is a plain run. Adding a kind of block is a deliberate change to every
  writer.
- **Lines.** Every block `manuscriptOf` makes carries `line`: the 0-based line in the whole
  file (frontmatter included) where it starts, for the preview's "click to open the note
  there". It is a non-enumerable property, so `toEqual`, spreads and JSON never see it. A
  block built by hand has none. `Dropped.line` is 0-based too.
- **What it drops.** Frontmatter, `%%` comments and closed `<!-- -->` comments, silently
  (a line that held only a comment, such as a beat, a placeholder or a thread, goes with
  its blank line; removing an inline comment takes the whitespace before it). Reported in
  `dropped`, in file order: placeholders (marker word from settings, so the modal can warn
  like publish does), embeds (`![[…]]`, `![](…)`, with their targets), and an unclosed
  comment. An unclosed `%%`, or an unclosed `<!--` that starts a line (up to 3 spaces of
  indent), hides everything after it, as Reading view does, and is reported once at the
  opener. A `<!--` in the middle of a line is literal text, because Reading view only
  treats a line-start one as an HTML block. Links become their alias, else their text (the
  `MARKUP` table in `core/wordcount.ts`, so the model can't drift from the counts).
  Math is kept as text.
- **Scene breaks** use `isSceneBreakAt` (`core/markers.ts`). One is never first or last in a
  manuscript and never doubles, since a chapter boundary already separates.
- **Options.** `placeholderMarker`; `strictLineBreaks` (off by default, like Obsidian's;
  the export module doesn't read the vault setting, so it stays off); `dropTitleHeading`
  (a first heading equal to one of these strings, trimmed and case-folded, is dropped, so
  a note that starts with `# Its title` doesn't print it twice).
- Tests: `tests/manuscript.test.ts`, `tests/export-manuscript-lines.test.ts`, and the
  fixtures in `tests/fixtures/manuscript/` (its README lists the output rules).

## Export pipeline (`core/export-pipeline.ts`, `core/zip.ts`, 0.8)

The seam between reading a work and writing a file. Pure, no Obsidian imports.

```
ExportSource  →  ExportDoc  →  ManuscriptWriter<M, P>  →  string | Uint8Array
(read by the     (exportDocOf,   (Markdown, DOCX and the     (written by the export module
 export module)   manuscriptOf     preview, in src/export/     through plugin.notes.create)
                  per part)        writers/)
```

- **`ExportSource`**: `title`, `author` (`Author { name, surname, contact[] }`), `count`
  (`{ amount, unit }`, the measurer's size for the title page, never recounted) and
  `parts`. An `ExportPart` has a `role` (`body`, `dedication` or `epigraph`), its formatted
  chapter `heading` (null for a single note and front matter), the chapter's own `title`
  and its `md`.
- **`exportDocOf(source, options)`** turns each part into a `Manuscript`. A body part drops a
  leading heading that repeats its formatted heading, its own title, or (for a single note)
  the work's title. Empty parts stay: a chapter heading with no prose is still a chapter.
  `isBookDoc(doc)` is the shared rule for "a book (a title page of its own) or a single note
  (the title starts page 1)": there is a heading or a front matter part. `droppedIn(doc)`
  lists what was dropped with its part.
- **`ManuscriptWriter<M, P = Preset>`**: `id`, `ext`, and a pure `write(model, preset)`
  returning text (written as UTF-8) or bytes. It is generic over the model `M` and its layout
  data `P`, so screenplay export (after 1.0) brings a script model, its own presets and its
  own writers (Fountain, PDF, FDX) without changing this file. The three 0.8 writers
  all take `ExportDoc`: `markdownWriter` (reads only `byline`, `chapterHeading` and
  `sceneBreak` from the preset), `docxWriter` (the layout) and `PreviewWriter` (DOM). 0.9 adds
  `epubWriter` (`ManuscriptWriter<EpubBook, EpubLayout>`, see "EPUB writer").
- **`Preset`** is plain data, in the manuscript's language (which may differ from Obsidian's):
  `id`, `language`, `page` (points; Letter or A4, one margin), `font`, `lineSpacing`,
  `indent`, `sceneBreak` text, `chapterHeading` template (`{n}`, `{title}`), the running
  `header` (`{surname}`, `{title}`, `{page}`), the `countLabel` per unit, `byline`,
  `endMark`, and the ebook labels (`contentsLabel`, `coverLabel`, `startLabel`). The two
  presets are in `src/core/presets.ts` (core, so the outline's reader reads them too):
  `shunn` (US Letter, English labels) and `ptbr` (A4, Portuguese labels, "Capítulo {n} —
  {title}", "FIM", "Sumário"). `presetForLanguage(lang)` is the language's preset (`ptbr`
  for pt-BR, else `shunn`): export's default and the reader's heading.
- **Helpers.** `aboutCount` (the title page count: nearest 100 below 10,000, nearest 500
  above, never below 100 for a non-empty work), `chapterHeadings` (numbering counts only
  chapters numbered 1 or more, so a "00 Prólogo" doesn't shift the numbers; a 00 chapter
  (sorts first), an unnumbered one (sorts last) and a chapter whose title is in the
  `unnumberedTitles` setting (a shared core Books row, read by export and the outline;
  `core/book.ts` `isUnnumberedTitle` folds with `foldName` and matches an entry or an entry
  followed by a space or punctuation; `countedNumbers` is the one counting rule, also used for
  the outline's label) get their title alone and are not counted; the list is passed as a
  parameter to `chapterHeadings` and `planChapters`; a numbered chapter with no title of its own gets "Capítulo 1" without
  the separator) and `fillTemplate` (`{name}` slots; an unknown slot stays as written).
- **`core/zip.ts`**: `zipStore(files, { modified? })` writes a STORE-only zip (no
  compression, no dependency) with CRC-32 (`crc32`), local headers, central directory and end
  record, UTF-8 names with the language flag. It is deterministic: every entry gets the
  earliest DOS date unless `modified` is given, so the same files always give the same bytes.
  The caller orders the entries (a DOCX wants `[Content_Types].xml` first). It throws on a
  duplicate, empty or absolute path, or a plain-zip limit. Tests read a zip back with
  `tests/support/zip-reader.ts`.

## EPUB writer (`src/export/writers/epub.ts`, 0.9)

N 7, stage 3. A `ManuscriptWriter<EpubBook, EpubLayout>` beside the Markdown and DOCX writers,
pure, zipped with `core/zip.ts`. Every input is in the model, so the same book and layout
give the same bytes.

- **Input.** `EpubBook { doc: ExportDoc, identifier, modified, cover }`: the identifier
  (`epubIdentifier(path, title)`: four seeded FNV-1a lanes over `path\ntitle` shaped as a
  version-5 `urn:uuid`, no crypto API, so re-exporting a book keeps its id), the modified date
  (`epubModified(date)`, UTC whole seconds) and the cover (`EpubCover { data, mediaType }`, JPEG or
  PNG, or null) come in from outside. `EpubLayout` is `epubLayout(preset, sceneBreak)`: the
  preset's language, byline and labels, and the scene break **from the setting**
  (`epubSceneBreak`, default `* * *`, a blank value falls back on load), not the preset's `#`.
- **Files.** `mimetype` first and stored (the zip store keeps every entry stored, as EPUB
  requires), `META-INF/container.xml`, the package document (`content.opf`), the EPUB 3 nav
  document, an NCX for older readers, and the XHTML: a cover page when there is a cover, the title
  page, the dedication and epigraph pages (written only when they have blocks), and one file
  per chapter. The nav lists the chapters, or the title page when there are none (an empty list
  fails EPUBCheck); a body part with no heading (one note) is listed by the work's title and
  has no `h1`. The landmark labels follow the preset's language.
- **Markup.** A chapter heading is `h1` and body headings start at `h2`; consecutive quote
  blocks make one `blockquote`; a scene break is `<p class="scene-break">`; never at a chapter
  boundary (the manuscript model already drops it there). No running header, word count or end
  mark: an ebook isn't a manuscript. Embeds are dropped and listed, as in 0.8.
- **Validation.** The `epubcheck` job in `.github/workflows/ci.yml` builds the fixture book
  (`tests/fixtures/epub/`) through the real writer and runs EPUBCheck (Java, downloaded in CI,
  the latest release; the plugin itself stays offline). Run locally on the `ptbr` fixture with
  the cover: no errors or warnings. The job first runs on a GitHub runner when 0.9 opens its pull
  request.

## Book source (`core/book-source.ts`, 0.8)

`BookSource<B>` is the port through which export (and, in 0.9, "Read the book") reads a
book. `B` is the adapter's book handle, so the file stays free of Obsidian types.

- `chapters(book)`: every `.md` file directly in the chapters folder, in `compareChapters`
  order, as `ChapterRef { path, title, number, include }`. A chapter left out by `compile:
  false` is listed with `include: false` (export skips it, the outline still shows it).
  `includeChapter(frontmatter, property)` is the rule: the property (exact name, then
  ignoring case) is the boolean `false` or the text `false`; anything else, a typo included,
  keeps the chapter in.
- `read(path)` → `{ text, mtime }`: the current text, which is the open editor's buffer when
  there is one, so unsaved prose is what gets exported. `mtime` is the file's when the text
  came from disk and **null for editor text**; only a non-null `mtime` may seed the measurer
  (`measure.counts`), because unsaved text paired with the disk mtime would poison its cache.
- `frontmatter(path)`: the metadata cache's, `{}` when there is none yet.

The Obsidian adapter is `bookSource(app, books, notes, settings)` in `core/books.ts`: it reads
through `plugin.notes` and calls `includeChapter` with `settings.compileProperty`. It is a
factory, not a plugin service. The export module and the outline both call it
(`outline/rows.ts`'s `RowsPort` extends `BookSource`).

## Collections (`core/collection.ts`, 0.9)

SF 13. A collection is a note with a `contents` property (the name is the
`collectionProperty` setting): a list of links to contos, in reading order. It adds no classifier
kind and no classifier field (Q28): export asks about the active note.

- `collectionOf(frontmatter, property, resolve)` is pure. It returns null when the note has no
  such property, an empty `Collection` when the property has no value, else `Collection
  { stories, missing }`: the story paths in order, each once, and the links that resolve to
  nothing. The property is found ignoring case; a nested list (an unquoted `[[A]]` in YAML) is
  flattened; a text value with several wikilinks gives each. It keeps its own small link parser
  (`core/scope`'s `linkText` reads only a list's first item). A link to a file that isn't Markdown,
  or to the collection note itself, is missing.
- `collectionAt(app, note, settings)` in `core/books.ts` is the one place links are resolved
  (`getFirstLinkpathDest` from the note); export resolves it once per target. `storyChapters(collection)`
  in `core/collection.ts` turns the stories into chapters: **unnumbered**, always included, titled
  by their basename (a story's own `title` property is not read); they are read through
  `bookSource`'s `read`, so through `plugin.notes`. The writers and the manuscript model don't change.
- `sourceKindOf(place, collection)` in `export/source.ts` picks `note`, `book` or `collection`; a
  book wins over a `contents` list. `ExportPlan.missing` carries the dangling links, which become
  the `missingStories` readiness warning; that story is skipped.
- A collection is a work only by the usual rule (a tracked note with a status). No outline,
  "Read the book" or serial publishing for it in 0.9.

## Readiness (`core/readiness.ts`, 0.8)

`readinessOf(md, { placeholderMarker })` runs the marker checks that decide whether a note is
ready to leave the desk. They moved out of `publish/checks.ts` so that export can warn the
same way while publish is off, and the book-wide check of 0.9 gets the same answer. Pure.
It reads the text it is given (the editor's, maybe unsaved), never a cache, from one
segmentation. A check is `{ id, level, line?, items, vars }`, untranslated; the caller's
strings make the text.

- `unclosedComment` (blocker): a `%%` that never closes, or an odd `%%` inside a closed
  `<!-- -->` (either reading of Reading view must be safe).
- `unclosedHtmlComment` (blocker, new in 0.8): a `<!--` in prose that never closes. Reading
  view hides the rest of the note while the words still count.
- `placeholders` (blocker), `unwrittenBeats` (warning), `emptyBody` (blocker, zero words).

Publish runs `readinessOf` and adds its own property checks (recommended properties, over the
limit); the export modal runs it on each part and adds the embeds the manuscript drops.
`unclosedComment` and `unclosedHtmlComment` are also exported on their own.

## Pending submissions (`core/pending.ts`, 0.8)

The port between submissions and the desk. `PendingSource { list(), onChange(cb) }`, with
`PendingSubmission { path, workPath, workTitle, market, sent }` (newest `sent` first;
`workPath` is null when the `work` link doesn't resolve). The submissions module provides it
as its `pending` field while loaded. The desk reads it only while
`features.isOn("submissions")`, through `features.get<{ pending?: PendingSource }>("submissions")`
(`desk/gather.ts`), and never imports the submissions module, so an off feature leaves no
trace. Pure types.

## Plugin folders (`core/folder-problem.ts`, `core/folder-setting.ts`, 0.8)

The export, submissions and snapshots folders share one set of checks, so they can't overlap
or capture the writer's notes.

- `pluginFolderProblem(root, others, configDir, trackFolders, hasNotes, books)` returns a
  `FolderProblem` or null. In order: the snapshot rules (not `..`, not the config folder, not
  inside or holding a track folder), `overlap` (it holds, or sits inside, another plugin
  folder), `book` (it sits inside a book or its chapters folder) or `holds-book` (a book's
  folder or note is inside it), then `notes` (it already holds notes that aren't one of the
  plugin's own: `holdsOwnNotes`, which never objects to the folder already saved). `books` is
  `BookService.allBooksEverywhere()`, which lists books even inside a plugin folder.
  `pluginFolders(settings)` gives the three roots.
- `addFolderField(row, ui, { placeholder, value, problemOf, save })` draws the text field:
  the value is saved only when it passes (on commit, through `ui.saveOnCommit`), otherwise the
  saved value stays and a warning under the row says why (`folderProblemText`). No notices
  while typing.
- The export and submissions rows (`pluginFolderRows` in `settings.ts`, through
  `addFolderField` and `pluginFolderProblem`) sit in the always-shown "Properties and folders"
  section, so they stay with the feature off, because the folders still apply (classify skips
  them). The snapshots row stays in the snapshots section and builds its check from the same
  pieces (`snapshotsFolderProblem`, `overlapProblem` against the other two folders,
  `bookProblem`). Each folder follows a rename of itself or of a folder holding it, through a
  data follower in its module (`ExportModule`, `SubmissionsModule`, snapshots).

## Settings tab (`core/settings-order.ts`, `core/module-context.ts`, 0.8, IMPROVEMENTS 11)

Each module draws its own settings section; `settings.ts` draws the core ones and imports no
module's internals (`tests/settings-imports.test.ts`: only shared core, top-level files and
`<module>/settings.ts`).

- **One order list.** `SECTION_ORDER` in `core/settings-order.ts` names the core and module
  sections together (`features`, `shared`, `books`, `dayEnds`, `goals`, `publish`, `export`,
  `submissions`, `outline`, `placeholders`, `darlings`, `editor`, `lens`, `stages`, `desk`,
  `snapshots`, `universe`, `threads`), in the order the tab had before 0.8. A slot has the
  `feature` that draws it (null for shared core) and optional `also`: other features that read
  a row the core draws there (the placeholder marker is read by publish too). `sectionOrder(loaded)`
  returns the slots to draw: core always, a module's slot while it is loaded, and a slot with
  `also` while any of those is loaded (the core part only).
- **The module's part.** `FeatureModule.settingsSection(el, ui)` draws the rows (each module
  keeps them in `<module>/settings-ui.ts`), and `FeatureModule.offNotice()` returns what the
  Features page says when the feature is switched off and keeps data (read after the switch is
  saved, so only what stays). A section is gone with its module. The tab reaches a module
  through `features.get<FeatureModule>(id)`.
- **`SettingsUi`** is what a section gets: `app`, `save()` (saves now, then applies the switches
  and fans out `settingsChanged`), `saveOnCommit(component, fallback, apply)` (a text field
  saves on blur or Enter, not per key, so typing a folder name doesn't reload features per
  letter; the value is trimmed, blank becomes the fallback, and the field shows what was kept),
  `redraw()` and `num(v, fallback, min)`.
- **Shared rows live in core.** A row several features read (the property names, the folders,
  the placeholder marker, the editor's paragraph and quote style) is drawn once by the core, and
  `SETTING_FEATURES` in `settings.ts` says which features keep it shown.
- **Guard test.** `tests/settings-order.test.ts` finds every class with a `FeatureId` and a
  `settingsSection` and requires a slot for it (the explorer's rows sit under its switch on the
  Features page), so a new section that forgets its slot fails the build.

## Modules and feature switches (`core/features.ts`, `core/feature-registry.ts`, `core/module-context.ts`, 0.7)

Every feature the writer can turn off is a `FeatureModule` (a `Component`) with a
`FeatureId`. `main.ts` builds them once, keyed by id, and hands them to the
`FeatureRegistry`. There are 19 ids, in load order: goals, outline, placeholders,
explorerCounts, darlings, typing, dialogueFocus, moveBlocks, templates, spellcheck, lens,
snapshots, stageSnapshot, publish, export, submissions, desk, universe, threads (0.8 added
`export` and `submissions`, in the publishing group after `publish`). Stages, the classifier, the
measurer, the vault index and the notes service are core and always on.

- **The pure part** (`core/features.ts`, no Obsidian imports): `FEATURE_SPECS` (group,
  `requires`, and where the switch lives), `switchedOn` (the writer's switch alone; a
  missing key is on), `wanted` (switched on and every requirement on, computed to a fixed
  point) and `planApply(loaded, want)` (what to unload, in reverse order, and load, in
  order). Three switches are existing settings (`explorerCounts`, `spellcheckOnDemand`,
  `universeMode`: a mode other than "off" is on); the other 16 are in `settings.features`.
  `FEATURE_SPECS` also gives each switch its `page` position, and `FEATURE_PAGE` (derived in
  `core/features.ts`: the groups in fixed order, inside each the switches by `page`) is the
  Features page's one source. `switchesOf(settings)` in `core/feature-registry.ts` reads the
  switches from the settings.
- **`FeatureModule`.** Constructed once. Subclasses implement `onload`/`onunload`, never
  `load`/`unload`; the registry calls them. It has a `slots` field (below), an optional
  `settingsChanged()` (fanned out to loaded modules only), an optional `dataFollowers()`,
  and, since 0.8, an optional `settingsSection(el, ui)` and `offNotice()` (see "Settings
  tab"). `registry.get<T>(id)` returns the module while it is loaded, for a soft dependency
  that needs more than `isOn` (the settings tab, and the desk reading the submissions'
  `pending` port).
- **`ModuleContext`.** The one door to the plugin's registration methods. `command`,
  `ribbon`, `statusBar`, `view`, `editor`, `codeBlock`, `postProcessor`, `index`, `follow`,
  `decorate`, `onLayoutReady` and `afterUnload` each record an undo, and the registry runs
  them when the feature unloads. Commands: `addCommand` rewrites the id of the object it is
  given (`escrita:<id>`), so the context builds a fresh `Command` on each load and removes
  with the raw id (`Plugin.removeCommand` adds the prefix itself; spike G0a). Removal drops
  default hotkeys only; custom ones survive in `hotkeys.json`. The mobile toolbar is
  rebuilt only when its config changes, so a pinned removed command keeps a dead button
  until restart.
- **Slots (Q1 to Q5).** A view type, a code block language, a Reading-view post-processor
  and an editor extension array can each be registered on the plugin once, and a second
  `registerView` for one type throws (G0b). A module that is off at startup never runs its
  load and could not name its types, so each module declares `slots` (view types, code
  block languages, `postProcessor`, how many editor slots) at construction, and
  `registry.init()` registers each slot once, at plugin load, whether the feature is on or
  not. `ctx.view(type, create)` and the others only bind a creator to a declared slot
  (and throw for an undeclared one); unloading unbinds it. A view slot builds a real view
  when bound and an empty placeholder view when not (a leaf restored from the saved layout
  can arrive first). An off code block shows its source as plain code; an editor slot is
  emptied and `workspace.updateOptions()` runs once after `apply()`.
- **Leaves.** Obsidian can't unregister a view type, and unregistering would leave ghost
  panes, so a feature switched off detaches its own leaves (`detachLeavesOfType`) before it
  unloads, and at layout ready the registry closes leaves of types whose feature is off
  (a layout saved with the lens panel open, restarted with the lens off). The plugin
  unloading itself never detaches leaves.
- **The registry.** `init()` at plugin load: registers slots and every module's data
  followers. `apply()` runs at the end of `onload` and at the start of `saveSettings`,
  before `settingsChanged` fans out. It is synchronous (every load is) and guarded against
  re-entry: a call made while one runs (a follower's `saveSettings` inside the hub's
  notify, or two keystrokes in the settings) sets a flag and the running apply goes round
  once more, at most ten passes. Listeners (`onChange`) run after `updateOptions`, once the
  guard is off. Load order is the id order above, which keeps the order handlers ran in
  before 0.7; unload is the reverse. Turning a feature on mid-session never moves the
  writer's tab or opens a view (the desk's cold-start guard is the pattern). A module that
  throws in load is stopped and left off, with an error in the console.
- **Ribbon.** `ctx.ribbon` returns null when the feature is off at startup (no icon). Turned
  off at runtime, the icon stays until the next restart, because Obsidian has no public way
  to remove it, and its click shows `features.offNotice`.
- **Data followers (Q8).** Path-keyed data must follow renames and deletes even while the
  owner is off, or turning it on again would find stale paths. A module lists those
  followers in `dataFollowers()`; the registry registers them on the vault index at init,
  so they run whether the module is on or off. They touch only `plugin.data` and
  `plugin.settings`. The snapshots rename handler is the one that also moves files (the
  snapshot copies on disk) while snapshots is off. The export's follower keeps
  `data.exportChoices` and the export folder setting current, and the submissions' follower
  the submissions folder setting.
- **Soft dependencies.** A module that can work without another asks
  `plugin.features.isOn(id)` at the point of use and degrades: publish takes no snapshot
  when snapshots is off; the outline shows no placeholder count when placeholders is off;
  the desk's `openWork` (`ui/open-work.ts`) ignores "where you left off" when the desk is off; the desk shows the pending
  submissions count only while submissions is on; the universe's Works
  tab and the threads command read the threads and universe switches. A hard dependency is
  `requires` in the spec (the stage snapshot needs snapshots) and `wanted` drops the
  dependent. Its stored switch is kept, so the page can grey it out and restore it.
- **Tests.** Each module has a `tests/lifecycle-<module>.test.ts` that loads it through a
  recording `ModuleContext`, unloads it and asserts nothing is left (no command, ribbon,
  status bar item, slot entry, index handle, follower, event or interval), and loads it
  again to catch duplicates. vitest can't import `obsidian`, so `tests/support/obsidian.ts`
  is a small stub (a working `Component`, no-op UI classes), aliased in `vitest.config.ts`.
  `tests/features.test.ts` and `tests/core-features.test.ts` cover the pure part and the
  registry; `tests/settings-features.test.ts` covers which settings rows hide, and
  `tests/settings-order.test.ts` the section order and the "every section has a slot" guard.
- **Settings.** The Features page is the first section: the writing language, then one row
  per feature in five groups (writing, revision, the desk, publishing, the world), each with
  a switch and a line on what it does. The universe's row is its mode dropdown. A row
  another feature reads stays while any reader is on (`SETTING_FEATURES` in
  `settings.ts`): the placeholder marker while publish is on, the templates folder while
  templates or the universe is on. Property names and folders several features share live
  in an always-shown "Properties and folders" section. Turning a feature off shows the
  module's `offNotice()` text saying what stays (the saved snapshots and where, the word
  lists note, the days of history, the cut passages, the submission notes). Each module draws
  its own section; see "Settings tab".

## Core modules (`core/module-context.ts` `CoreModule`, 1.0)

A part of Escrita that is not one of the 19 features and never switches off is a
`CoreModule` (a `Component`). The first is the setup ("Set up a writing vault", `src/setup/`,
SF 10). It has no `FeatureId`: it is not on the Features page, in a preset, in
`settings.features` or in the registry.

- **The seam.** `main.ts` constructs it at the end of `onload`, after
  `features.apply()`, and calls `startCoreModule(plugin, module)`. That gives the module its
  own `ModuleContextImpl` (no slots), begins it, registers `ctx.end(false)` on the plugin
  and adds the module as a child of the plugin, so it loads once, right away, and unloads
  with the plugin before its context ends. Rule 8 holds: the module registers its command,
  its first-run notice (`ctx.onLayoutReady`) and anything else through `this.ctx`, the same
  door the features use, and never calls the plugin's `register*` or `addCommand` itself.
- **Why not a feature.** A feature can be switched off, and the setup must always be in the
  palette (Q5); a twentieth id would also show a switch, count in the presets and need a
  data follower story it doesn't have.
- **No slots.** `ctx.view`, `ctx.editor`, `ctx.codeBlock` and `ctx.postProcessor` throw for a
  core module. The setup needs a modal and a notice, not a view. A core module that ever
  needs a view gets `ModuleSlots` registered at plugin load, as the registry does, in a
  deliberate change to this seam.
- **Other features.** A core module reads features only as soft dependencies
  (`plugin.features.isOn`, `features.get`) and imports no module folder (IMPROVEMENTS 13,
  done in 1.0: the helpers it needs are in `core/` and `src/ui/`).
- **Its data.** The setup keeps one flag, `data.setupOffered` (`cleanSetupOffered` in
  `data.ts`): saved booleans win; absent, it is true for an install from before 1.0 (saved
  settings exist) and false for a fresh install. Not a setting.

## Default sets (`core/defaults.ts`, 1.0)

The word-bearing settings (stage words, folders, unnumbered titles, submission results,
the universe's words: `WORD_KEYS`) have one default set per language, `en` and `pt-BR`
(`LANGUAGE_DEFAULTS`). Property names are never in a set: they stay English. Every other key
comes from `DEFAULT_SETTINGS`, which stays English and equals the `en` set.
`defaultsFor(lang)` (in `settings.ts`, over the pure `overlayDefaults`) is `DEFAULT_SETTINGS`
with the set laid over it, a fresh object each call. The setting `defaultsLanguage` names
the set an install uses: "en" for any install from before 1.0, Obsidian's language
(`languageOf(locale())`) for a fresh install, saved on its first load and changed only by
the setup. Loading merges the saved settings over `defaultsFor(defaultsLanguage)`, and
`normalizeSettings` restores a blank field from the same set (task 1.4). `SETUP_NAMES` holds
the names the setup gives what it creates (home note, folders, examples).

## Module specs

### goals (`src/goals/`)

- **Tracking.** Count only real typing in tracked files: on `workspace` `file-open`
  (and at layout ready for the active file) prime `measure` with the active file's
  count. On `vault` `modify` of a tracked Markdown file **that is the active file**
  (so sync/git pulls of other files don't count), recount; `delta = after - before`.
  If `|delta| > settings.ignoreJumpsOver`, don't count it (still update the cache).
  Positive deltas add to `added`, negative to `deleted`, in `data.history[writingDay]`
  (and per book in `books[bookNotePath]` when the file is a chapter; also set that
  book's `total` = sum of its chapters' counts). Tracked = `books.classify(file).tracked`:
  inside one of `folderList(trackFolders)` (or anywhere when empty), not inside
  `excludeFolders`, and not the chapter template (the rule lives in `core/classify.ts`). `plugin.measure` moves and drops cached counts on rename and delete by itself;
  goals only keeps its baselines and history keys in step.
  `plugin.requestSave()` after changes.
- **Pure functions** (`src/goals/tracker.ts`, `src/goals/pacing.ts`, tested):
  applying a delta to history; `streak(history, today)` = consecutive days with
  `added > 0` ending today, or ending yesterday when today has nothing yet;
  goal-met days in a window; daily series for a window (vault-wide or one book);
  book running-total series (carry the last known `total` forward; before the first
  record use the first record's total minus its net); 7-day average; pacing:
  remaining words, days left (deadline inclusive), words/day needed, projected finish
  date at the 7-day average, days early/late, on-track flag. Guard division by zero
  and missing data everywhere.
- **Status bar** (when `showStatusBar`): as in the design. Click opens the progress modal.
  Selection word count via a CodeMirror `EditorView.updateListener` registered with
  `registerEditorExtension` (use `countSelection`). Update after every tracked change
  and when the active file changes.
- **Progress modal** (`src/goals/progress-modal.ts`): as in the design. Scope = the
  active file's book, else "All writing" (vault-wide bars, no book tile/line/pacing;
  replace the book tile with "This week" words). Book goal and deadline are read from and
  written to the book note's frontmatter (`goalProperty`, `deadlineProperty`, default `goal`, `deadline`) with
  `processFrontMatter`. Chart as inline SVG (`createSvg` / `createElementNS`), sized to
  the modal width, geometry computed by a pure tested function (`src/goals/chart.ts`).
- **Sprints** (`src/goals/sprint.ts`): duration + target; words = vault-wide `added`
  since start (tracked files); ticks every second via `registerInterval` updating the status bar;
  target reached → Notice once; time up → Notice with words, minutes, words/hour; stop
  early from the status bar or command. Sprint state is not persisted across reloads.
- **Targets per piece** (`core/measure.ts`, display helpers in `src/core/piece-bar.ts`):
  any note can have `target`, `limit`, `unit` (`words` | `characters` |
  `characters-no-spaces`; names from `targetProperty`/`limitProperty`/`unitProperty`)
  and `deadline`. `readPiece` returns null when none is set. `pieceProgress` gives the
  state `none | under | near (≥ 95% of the limit) | over`. Status bar: when the active
  note has a target or limit, a piece segment "4,210 / 5,000 words" with a bar, amber
  near the limit, red with "+312 over the limit" past it (`progressOf`). Outside a
  book, a note with a target, limit or deadline records its per-day words in
  `history` under its own path (like a book), and the progress modal replaces the
  book tile with a piece tile (count against target, limit mark, `pieceBar`) and
  paces toward the note's `deadline` (`paceInUnit` converts words/day to the unit).
  Editing target, limit, unit and deadline in the modal writes the note's properties.
- **Days off** (`core/daysoff.ts`, settings `weekdaysOff`, `datesOff`):
  `goals.dayOff()` returns a predicate, or null when nothing is off (old behaviour).
  `streak(history, today, isDayOff)` skips days off with no writing; writing on one
  still counts. `pacing({ …, isDayOff })` spreads the remaining words over writing
  days only (`afterWritingDays` for the projected finish), and `dailyAverage` averages
  over writing days. The chart draws days off as dimmed bands (`offBands`).
- **Commands**: "Open progress", "Start a sprint", "Stop the sprint".

### outline (`src/outline/` + `src/core/chapter-ops.ts`, `chapter-engine.ts`, `chapter-plan.ts`)

- **ChapterOps** (implement in `src/core/chapter-ops.ts`, keeping its public signatures):
  `createChapterAt(book, at, title, body?)` — shift later chapters' numbers (rename
  from the last one backwards so names never collide; width via `planRenumber`
  semantics), create `numberedName(at+1, safeFileName(title), width).md` in the
  chapters folder from the chapter template (`settings.chapterTemplate`, replacing
  `{{title}}`, `{{date}}` YYYY-MM-DD, `{{time}}` HH:mm; if the template has no
  frontmatter, or there is no template, start with frontmatter holding
  `summaryProperty: ""`), then `body`. `renumber(book, ordered)` — apply
  `planRenumber`, two-phase through temporary names when targets collide.
  `retitle(file, title)` — keep the number, change the title. All via
  `fileManager.renameFile` so links update. Serialize operations (a promise queue) so
  quick keystrokes can't interleave renames.
- **Beat editing** — pure functions in `src/outline/beats-edit.ts` over a chapter's
  text (tested thoroughly, including frontmatter, CRLF, files with no trailing newline,
  beats with prose, empty files): `insertBeat(text, afterIndex /* -1 = first */, beatText)`
  places a new beat at the end of beat `afterIndex`'s section (i.e. just before the
  scene break that precedes the next beat, or at the end of the body), adding a `---`
  scene break with blank lines around it when there is content before it;
  `setBeatText(text, i, beatText)`; `removeBeat(text, i)` removes only the comment line
  (plus an orphaned scene break it leaves behind when the beat was unwritten) and never
  touches prose; `moveBeatOut(text, i)` for Shift+Tab (only allowed on unwritten beats).
  A scene break is `core/markers.isSceneBreakLine` (so a `---` inside code or a comment is
  not one), and the re-parses use the `Markdown` the edit already holds (`parseBeats(doc.md)`),
  not a rejoined lines array (0.5).
- **Outline view** (`ItemView`, type `escrita-outline`, icon `list-tree`, ribbon icon +
  command "Open outline", opens in the right sidebar): the design's panel. Follows the
  active file's book; when the active file isn't in a book, keeps the last book shown,
  or lists books to pick, or shows an empty state explaining the folder convention
  with a "Create a book" button. Reads chapter titles from file names, status/summary
  from frontmatter (settings property names), words from `measure`, beats with
  `parseBeats`, placeholders with `parsePlaceholders`. Editable inline
  (`contenteditable` plaintext or inputs): chapter title (→ `retitle` on blur/Enter),
  summary (→ `processFrontMatter`), beat text (→ `vault.process` + `setBeatText`).
  Keys (NEO's outline): Enter → new chapter after (or new beat after, from a beat);
  Enter at the very start of a non-empty line inserts above; Tab on a chapter with 0
  words (not the first) → becomes the last beat of the previous chapter (trash the
  empty chapter file); Shift+Tab on an unwritten beat → becomes a new chapter right
  after, with the beat text as its summary; Backspace on an empty beat → remove it;
  Backspace on a chapter with empty title-and-summary and 0 words → trash it;
  ArrowUp/Down move between lines. Clicking a chapter's number opens the file; clicking
  a beat letter opens it at that line. Drag and drop chapter rows to reorder →
  `renumber`. Right-click → menu: open, open in new tab, delete chapter (0 words: trash;
  otherwise confirm in a modal, then `trashFile`). Refresh (debounced ~300 ms) on
  metadata changes, create/delete/rename in the book, and active leaf change — but
  never re-render while an inline field has focus (patch counts only).
- **Canvas board**: a button/command "Open outline as a board" writes
  `<book folder>/<book title> board.canvas` (JSON Canvas 1.0) with one text card per
  chapter (title, summary, beats as a list) in a grid, colored by status
  (`statusColor(status, settings.stages, settings.otherStatusColors)` gives a hex, mapped
  to canvas colors "1"–"6"; a stage's own color wins, then the "Other status colors" lines). If the file exists and was
  not generated by Escrita (check a marker in the first node's text or a
  `"escrita": true` top-level key), ask before overwriting. Open it.
- **Ghost beats** (`src/outline/ghost.ts`): a CodeMirror `ViewPlugin` registered with
  `registerEditorExtension`. In Live Preview (`editorLivePreviewField` from obsidian),
  beat lines not touched by the selection are replaced by a widget per the design
  (label "Beat b · from outline" + italic text; letters by order in the file); when
  the cursor is on the line, or in Source mode, the raw line gets a faint class instead.
  Off when `settings.ghostBeats` is false (reconfigure on `settingsChanged` via
  `workspace.updateOptions()`).
- **Outline for a single note**: `resolveTarget` (`src/outline/model.ts`, tested)
  decides what the panel shows: `book`, `note` or `empty`. A book file shows its book;
  any other Markdown note shows its own beats (header: note title, beat count, length
  against its target/limit in the note's unit via `measure.note`/`noteProgress` and `unitAmount`); anything else
  becoming active (the panel, a PDF, nothing) keeps the last target. Keys follow
  `decideNoteKey`: Enter adds a beat after, Backspace on an empty beat removes it,
  text edits rewrite the comment line, Tab/Shift+Tab do nothing. Clicking a letter
  jumps to the line. A note with no beats shows "Add the first beat"
  (`insertFirstBeat`, after the frontmatter and a leading `# title`) above the usual book picker / "Create a
  book" empty state. The book outline is unchanged.
- **Book source** (0.8). The view and the board read chapters, text and properties through
  `bookSource(...)` (`core/books.ts`, see "Book source"): `OutlineModule.rowsPort()` spreads it
  into `RowsPort`, which extends `BookSource` and adds only counts, placeholders, the chapter
  default and POV. The view has no port of its own, and a chapter's text is the open editor's
  when there is one. A chapter left out of an export (`compile: false`) still shows here.
- **Chapter rows** (`rows.ts`, pure, 0.7). `loadRows(port, book)` builds one
  `ChapterRow` per chapter, once, for the outline view and the board: number and label, title, summary,
  status and its stage, the POV, the piece with where its target came from
  (`pieceSource`: `own` or `book`), the unit, words, the count in that unit, progress,
  beats and the placeholder count (from the placeholders index when that feature is on).
  Nothing else reads a chapter field by field. `RowSettings` names the properties it reads.
- **POV and colours** (`pov.ts`, pure). `povValue` reads the `pov` property (a link or plain
  text): one key per resolved note (its path), else per folded text, with the label as
  written or the entry's name (`plugin.names.entryFor` resolves a link to an entry).
  `POV_PALETTE` has eight colours; `assignColors` gives each new key the next free one and
  stores it in `plugin.data.povColors` (cleaned on load, followed on rename by the outline's
  data follower, kept on delete); `statusTally` counts stages for the summary, labelled with
  the writer's word. `RowFilter` is a stage and POV filter.
- **Header and bar** (`header.ts`, `bar.ts`). The header holds the Status / POV toggle, the
  summary ("1 rascunho · 2 revisão"), the stage and POV chips (wrapping by width, with
  "+n" and "fewer"), the "Showing 2 of 5 · Clear" line and the POV colour menu (change a
  colour, open the entry). Both only draw; the view owns the host elements. While a filter
  is on, drag and "Renumber chapters" are disabled so a partial list never renumbers a
  book. A chapter with a target shows `bar.ts`'s thin bar, with the colours and rules of a
  piece's bar in the goals tile (`pieceBar`), in the chapter's own unit; its label says
  where the target came from. Nothing in these files writes to a note.
- **Serial line and "Publish next"** (0.9, N 4; `header.ts`). When the publish feature is on and at
  least one chapter is published, the header shows one line (no separate dashboard view, rule 3):
  the gaps first, then "Next: 05 A volta", then "last published 30 Sep" (a future date is shown as
  written; a published chapter with no date shows its title instead). The date is "D MMM" in
  pt-BR and "MMM D" in English. It reads `core/serial.ts` (`bookSerial`, built only when the publish
  feature is on) and the line redraws when the publish switch changes. The "Publish next chapter"
  button beside it waits for a first published chapter, like the line, and calls
  `PublishNextPort.publishNext` read through `features.get("publish")`.
- **Read the book** (0.9, N 8; `reader-model.ts`, `reader-plan.ts`, `reader-view.ts`). A view of
  type `escrita-reader` in the main area, from the command "Read the book" and a button in the
  header. It reuses the tab already reading that book, else opens a new one. It reads through the
  book source. `reader-model.ts` is pure: `readerBlocks(text, { placeholderMarker })` builds the
  blocks of a chapter on `manuscriptOf`, so what is hidden (frontmatter, `%%` comments, closed
  HTML comments, placeholders, embeds) is decided in one place and matches the export. A
  `ReaderBlock { text, line }` has the Markdown rebuilt from the manuscript's runs (marks
  escaped, links and inline code as plain text, as in the export) and the 0-based source line
  with the frontmatter counted; a scene break is a `---` block, dropped at a chapter's edge or
  when doubled. Chapter headings are not blocks: the view draws them from `chapterHeadings`.
  `reader-plan.ts` is the other pure part: which chapters (included, in order, numbered as the
  export does), the heading format (D7: the export's heading setting, else the language's preset
  heading, `presetForLanguage(lang).chapterHeading` from `core/presets.ts`), where a saved
  position lands, which block is at the top (`readingPoint`, over lazily measured
  `SectionBox`es: bottoms down to the section at the edge, then that section's blocks), and how a position follows a
  rename or a delete (`movePositions`, `dropPositions`). The view renders each block with
  Obsidian's Markdown renderer, chapter by chapter as it scrolls into view; a click on a
  paragraph opens its chapter in a new tab at that line (a selection in progress is left alone).
  A save of a drawn chapter redraws it only when its blocks' text changed (a beat or a comment
  alone just moves the blocks' lines).
  Read-only; no chapter rail or progress bar (D6, the outline navigates). It redraws when a
  chapter is created, deleted or renamed in the book's folder, not when its text changes (the
  next opening shows an edit). The tab follows its book when the book note, or a folder holding
  it, is renamed. A book with no chapters offers "Create the first chapter". It has no DOM
  test; its decisions are the pure files above.
- **Reading position** (`data.readPosition`, `ReadPosition { chapter, line }`, keyed by the book
  note's path). Saved when the view scrolls, cleaned on load (`cleanReadPositions`: no chapter
  dropped, the line a whole number, at least 0). The outline's data follower moves a key or a
  chapter with a rename (`movePositions`) and drops an entry with a deleted book or chapter,
  while the outline is off too. Deleting a chapter sends the position back to the top.
- **Commands**: "Open outline", "Open outline as a board", "Read the book", "Create a book" (modal: title +
  parent folder → creates `<folder>/<title>.md` with `goal`/`deadline` properties, the
  book folder, the chapters folder and a first chapter), "Add a beat to this chapter",
  "Renumber chapters of this book".

### placeholders (`src/placeholders/`)

- **Insert** command "Insert placeholder": inserts `%% XXX:  %%` at the cursor and
  places the cursor after `XXX: `; with a selection, inserts the placeholder right after
  the selection with the selection text as its note.
- **Editor decoration**: `%% XXX: … %%` gets a pill style (mark decoration; in Live
  Preview, when the cursor is outside it, hide the `%%` and show a small marker label
  + the text). Registered with `registerEditorExtension`; marker from settings.
- **Index**: a `content` spec on the vault index (`placeholderSpec` in `logic.ts`, value
  `IndexedMarker[]`) over Markdown files outside the exclude folders and the snapshots
  folder. The vault index builds it after layout ready and keeps it current on
  modify/create/delete/rename; the module owns no store, listeners or debounce. A change
  to the marker word or the folders rebuilds it through the spec's `settingsKey`. Public API: `countFor(path): number`,
  `all(): {file, markers}[]`, and an `onChange(cb)` subscription the outline can use.
- **Placeholders view** (`ItemView`, type `escrita-placeholders`, icon `map-pin`,
  command "Open placeholders"): grouped by file (book chapters first, in chapter order),
  scope toggle "This book / All notes", each item shows the note text (or "no note"),
  click opens the file with the placeholder selected; a check button resolves it
  (removes the marker via `vault.process`, verifying the exact text is still at that
  offset first). Empty state explains ⌘/Ctrl+P → Insert placeholder and suggests binding
  a hotkey like Ctrl/Cmd+Shift+X.
- **Explorer dots** (`showExplorerDots`): a `plugin.decorations` drawer (id `"dot"`) that
  returns an empty decoration for a file with placeholders, drawn as a small span after
  the name (no pseudo-element). Silent: no tooltip, no text. Redrawn on index change
  and on a settings change; `main.ts` redraws everything on layout-change.
- **Commands**: "Next placeholder in this note", "Previous placeholder in this note".

### darlings (`src/darlings/`)

- **Cut to darlings**: command "Move selection to darlings" + editor context menu item
  (only with a selection). Target note: the book's `<book folder>/<darlingsNote>`, else
  `globalDarlingsNote` (create folders/note if missing, with a one-line intro). Remove
  the selection with one editor transaction (single undo step), tidying a doubled space
  or a leftover triple blank line. Append an entry:

  ```
  ### [[03 O porão]] · 2026-09-29
  %% escrita-darling {"id":"k3j2x","from":"Novels/A Casa/Chapters/03 O porão.md","date":"2026-09-29","before":"…up to 80 chars before…","after":"…up to 80 chars after…"} %%
  <the passage, verbatim>
  %% /escrita-darling %%
  ```

  JSON must never contain `%%` (escape `%` as the JSON escape `\u0025`) or newlines. Notice: "Moved to
  darlings — restore it from the Darlings panel."
- **Pure format** (`src/darlings/format.ts`, tested): `formatEntry`, `parseEntries(text)`
  → `{id, from, date, before, after, text, start, end}` (offsets of the whole entry
  including its heading), `removeEntry(text, id)`, `findRestoreOffset(source, before,
  after)` — the best insertion point (exact `before`+`after` adjacency first, then
  `before` alone, then `after` alone, trimming the context progressively; null when
  nothing matches). Round-trip tests with passages containing `%%`, quotes, code,
  multiple paragraphs, CRLF.
- **Darlings view** (`ItemView`, type `escrita-darlings`, icon `heart`, command "Open
  darlings"): darlings of the active file's book (or the global note), newest first:
  source chapter title, date, first ~200 chars. Buttons: Restore (insert into the
  source at `findRestoreOffset`, or at the end with a Notice when context is gone; then
  remove the entry; source missing → offer to paste into the active note instead),
  Open source, Delete (confirm). Restoring into a file open in an editor goes through that
  editor so undo works; otherwise `vault.process`.

### editor (`src/editor/`)

- **Enter, Enter, Enter** (`src/editor/enter-flow.ts`, only when `settings.enterFlow` and
  the file is a chapter, or another tracked note (`books.classify(file).tracked`), where only
  `"break"` applies and `"chapter"` falls back to a normal Enter — use `editorInfoField` to get the file): a high-precedence
  (`Prec.high`) Enter keymap. With an empty selection on an empty line, outside
  frontmatter, code blocks and lists: let `N` = 1 when `paragraphStyle` is `single`,
  else 2. If the empty lines directly above (counting the current one) number ≥ `N` and
  the nearest non-empty line above is prose → replace the empty run so the text reads
  `prose\n\n---\n\n` with the cursor on the last empty line (a scene break). If the
  nearest non-empty line above is a scene break, only blank lines lie between it and
  the cursor, and nothing but whitespace follows the cursor to the end of the file →
  remove that trailing break and blank lines, then create the next chapter with
  `plugin.chapterOps.createChapterAt(book, index, t("common.untitled"))` and open it
  in the same leaf with the cursor at the end. Everything else → return false (normal
  Enter). Decision logic as a pure, tested function over `(lines, cursorLine,
  paragraphStyle)` returning `"normal" | "break" | "chapter"`.
- **Smart typography** (`src/core/typography.ts`, when `smartTypography` and the scope
  matches): `EditorView.inputHandler`, skipping code (inline/fenced), frontmatter, math
  and link targets (use `syntaxTree` from `@codemirror/language`, which Obsidian
  provides): `--` → `—`, except at the start of a line (could become `---`); with
  `dialogueDash`, a space typed after a line's leading `--` → `— `; `...` → `…`;
  `"` and `'` → opening/closing quotes by context for `quoteStyle` (apostrophe `’`
  after a letter). Backspace right after an automatic replacement restores the
  typed characters (a small state field). Pure tested function deciding the
  replacement from `(textBefore, typedChar, settings)`.
- **Spellcheck on demand** (`src/editor/spellcheck.ts`): when `spellcheckOnDemand`,
  editors get `spellcheck="false"` on their content (`EditorView.contentAttributes`)
  until the command "Toggle spellcheck" turns it on; the command toggles and calls
  `workspace.updateOptions()`. Notice with the new state. When the setting is off, leave
  Obsidian's own spellcheck alone.
- **Move a paragraph or scene** (`move-blocks.ts` and `move.ts`, pure and tested; wired in
  `editor/index.ts`). Four commands, no default hotkeys, available only in the editor
  (Live Preview or Source, not Reading view): "Move paragraph up/down", "Move scene
  up/down". `move-blocks.ts` cuts the body into blocks from `core/markdown` and
  `core/markers` (paragraph, heading, unit, break, scene; frontmatter is never a block;
  a beat, comment, code or math block is a unit that never moves and is never moved
  into). In blank style a run of lines with no blank line or break among them is one
  block, so a beat, heading or code glued to prose travels with it (the cursor on the
  beat part itself refuses). `swap` trades the group under the cursor (or the lines a selection touches)
  with its neighbour, keeps the text between them where it is, and returns one change
  `{ from, to, insert }`, so the note keeps its length and its blank lines. The view
  applies it with the public `editor.transaction`, so it is one undo step and the cursor
  moves with the text; no new exception to the guidelines and nothing goes through
  `plugin.notes`, because the editor is the open document. It refuses with a Notice in the
  properties, outside any block, inside a unit, and when the result would read
  differently (`sameStructure`: same length, and the same comments (paired the same way), code,
  frontmatter, scene breaks and `$$` marks, and the same blocks once cut again, so two
  paragraphs never merge; the data-safety net). The trailing break is a wall both ways: a
  paragraph never steps over it down, nor up when it would leave the last scene empty. At an edge
  (nothing to swap with) it does nothing, silently. Nothing is removed, so there is
  nothing to keep in darlings. The paragraph style (`single` or `blank`) decides what a
  paragraph is.
- **Reads the `Markdown` directly** (0.5). The compatibility wrappers `blockStateAt`,
  `bodyStart` and `inProperties` (and `core/markers.bodyStartLine`) are gone: callers use
  `blockStateIn(md, line)`, `bodyLineIn(md)` and `md.bodyLine`. `decideEnter`,
  `trailingBreakKeep` and `breakEdit` in `enter-flow.ts` take a `Markdown` only, and the
  Enter handler passes `segmentDoc(state.doc)`, so no lines array is rebuilt on each Enter.
  `insertSceneBreak` asks `bodyLineIn(segment(doc))` (an unclosed frontmatter still counts
  as properties). The vault path of removing a chapter's trailing break is the pure
  `withoutTrailingBreak(text)`: it keeps the file's own line endings (a mixed LF/CRLF file
  is no longer rewritten to all CRLF) and returns the input itself when there is no
  trailing break.
- **Commands**: "Toggle spellcheck", "Insert scene break" (inserts `\n\n---\n\n` normalized
  around the cursor), and the four move commands above.

### publish (`src/publish/`)

- **Pure checks** (`src/publish/checks.ts`, tested): `runChecks(text, frontmatter, ctx)
  → Check[]`, each `{ id, level: blocker | warning | passed, line?, items, vars }`
  (messages are built with `t()` in the modal from the id and vars). The marker checks come
  from `core/readiness.ts` (`readinessOf`, see "Readiness"), shared with the export so that
  both warn the same way; `runChecks` segments once, calls it and adds the property checks.
  In order: `unclosedComment` (the note's last span is a `%%` comment with no closer, as
  `core/markdown` reads it: outside fenced and inline code; or a closed `<!-- -->`
  holding an odd number of `%%`; blocker, with the opening line), `unclosedHtmlComment` (0.8:
  a `<!--` that never closes; blocker; listed only when it fails), `placeholders` (blocker, each item jumps to its line), `unwrittenBeats`
  (warning), `emptyBody` (`countWords` = 0; blocker), `recommended` (missing
  `recommendedProperties`, case-insensitive; warning; skipped when the list is empty),
  `overLimit` (the piece's `limit` in its unit; warning; only when a limit is set).
  `sortChecks` puts blockers first; `hasBlockers`. No check assumes a website:
  Escrita is standalone (no URLs, slugs or site build rules).
- **Dates** (`src/publish/date.ts`, tested; `hasDate` and `dateText` are in `core/measure.ts`
  beside `parseDeadline`, shared with the serial line): the modal's date field starts at the
  note's date or today; publishing writes the date only when the user changed it or
  the note has none, so an existing value (even non-ISO) is kept as it is.
- **Modal** (`src/publish/modal.ts`): "Publish “<title>”", the sorted checks with an
  icon per level, clickable items (jump to the line), a date
  input, and Publish. Blockers disable Publish until "Publish anyway" is checked.
- **Publish** sets `statusProperty` to the word written for the `published` stage
  (`writtenWord(settings.stages, "published")`, the first word of the stage) and
  `dateProperty` in one `processFrontMatter` call, then a Notice. A note counts as
  published when its status maps to the `published` stage (`isPublished(status, stages)`),
  so any of the stage's words counts. It stores `data.publish[path] =
  { previousStatus }` when there was one. **Unpublish** restores `previousStatus`, else
  the `ready` stage's written word, and drops the record. There are no separate published
  and unpublished settings any more (0.3 values migrate into `stages`). Records follow
  file and folder renames and are dropped on delete, through an index follower. Escrita never commits, pushes or uploads.
- **Serial publishing** (0.9, N 4; `src/core/serial.ts`, pure, no Obsidian imports; in core
  because the outline reads it too, with the `PublishNextPort` type). A book released one
  chapter at a time. `bookSerial(source, book, settings)` reads a book through its book source;
  `serialState(chapters, stages, unnumbered)` over `SerialChapter` (the book
  source's `ChapterRef` plus the status and the date as read) gives `sequence` (chapters in book
  order, without `compile: false` and without the uncounted ones: no number, a 00 chapter, or a
  title in "Chapters without a number", by `countedNumbers`), `published` (a flag per chapter of
  `sequence`), `next` (the first not published), `last` (the last published chapter in order; its
  own date as written) and `gaps`
  (the unpublished chapters before `last`). Published means the status word maps to the published
  stage (`stageOf`, since chapters have no classify stage). A gap is a **warning, never a block**:
  `earlierUnpublished(state, path)` feeds the `earlierChapter` check, which `runChecks`
  adds for a chapter of a book (the modal says "chapter" or "chapters"). `serialLine` and
  `chapterLabel` (the digits of the file name plus the title: "04 A escada") feed the outline's
  line. No clock: a future date is only recorded and shown as written.
- **Commands** (also in the file menu): "Publish this note", "Unpublish this note", and "Publish
  next chapter" (0.9; offered inside a book; it opens the first unpublished chapter, then the same
  check modal as a single note, through `PublishModule.publishNext(bookNotePath)`).

### export (`src/export/`, 0.8)

Serves the ready and published stages: turns a note or a book into the manuscript an editor
or a contest asks for. It asks nothing of the writer beyond an author name and contact lines
set once. No network, no site: the file goes into the vault. Roadmap: N 7, stages 1 and 2.
Plan: `docs/PLAN-0.8.md`. The pipeline (model, writers, presets, zip) is in "Export pipeline";
this module reads the vault, calls the writer and writes the file.

- **Commands** (no default hotkeys): "Export…" for the active note, and "Export again", which
  shows only for a work that has a last export. "Export…" is also in the file menu of a
  Markdown note ("Export again" is not). Neither appears for a snapshot, a submission or an export
  (`classify`'s `snapshot`, `submission`, `export`). A chapter or a book note exports its book
  (a chapter also offers "This chapter"); any other note exports itself. The key of a work's
  remembered choices is the book note's path, or the note's.
- **Modal** (`modal.ts`, boards 26 and 27). Two views of one `ExportModal`: the options (what,
  the chapters: all, a range or ticked, each shown with its manuscript heading and with the
  `compile: false` chapters named as left out; the format, Markdown, DOCX or (0.9) EPUB; the preset, Shunn
  or pt-BR; where it writes; the readiness warnings with "Export anyway"; and a caption for the
  last export with an "Export again" button) and the preview. The modal reaches Obsidian only
  through `ExportHost`, which `index.ts` implements. It opens with the work's remembered choices
  or defaults (DOCX, the preset of the writing language).
- **Preview** (`writers/preview.ts`). `PreviewWriter` is a third `ManuscriptWriter<ExportDoc>`
  that draws the same model the file gets into the modal with `createEl`, so it can't drift
  from the file. A reading column, not pages: no page breaks or numbers, since Escrita doesn't
  lay out pages. Bands mark where the file starts a page for the dedication, the epigraph and
  the text. A click on a paragraph opens its note at that line (`line` on each block).
- **Building** (`source.ts`, pure over ports). `ExportPlan` (title, author, unit, `PartPlan[]`)
  is made from the modal's state: for a book, the front pages (`dedication` and `epigraph`
  properties of the book note, each a link to a note), then the chosen chapters with their
  headings (`planChapters` in `logic.ts`: numbering over every included chapter before the
  selection narrows it; the settings' `chapterHeadingFormat` overrides the preset's);
  for a note, one part. `buildExport` reads each part once through the book source (so unsaved
  text counts), measures the body through `measure.counts` (seeded only by text read from disk),
  and calls `yieldBudget` after each part, so a long book doesn't freeze the phone. It builds
  the `ExportDoc` and the warnings once. `warningsOf` runs `readinessOf` on each part plus the
  embeds the manuscript drops; placeholders, unclosed comments and an empty note are blockers,
  unwritten beats a warning, embeds only information, and each warning links to its lines.
  `needsConfirm` is true when any is a blocker or warning ("Export anyway").
- **EPUB in the modal** (0.9). A third format, with the same chapter choice, warnings, preview,
  "Export again" and file names (`<title> (<preset>).epub`, D2: the preset is in the name, as DOCX's).
  The preset sets the language, byline and labels; the scene break is the `epubSceneBreak`
  setting. The writer's inputs are built in `index.ts`: `epubIdentifier(target.key, title)`,
  `epubModified(new Date())`, `epubLayout(preset, settings.epubSceneBreak)`. **The cover** (Q8,
  D3) is the `coverProperty` of the book note (the whole book) or of a note's own frontmatter,
  a link to a JPEG or PNG in the vault, read with `vault.readBinary` in `index.ts` (not through the
  book source) and handed to the writer as `Built.cover`. No property means no cover and no
  warning; a configured one that is missing, unreadable or neither JPEG nor PNG is the `cover`
  readiness warning and the export goes on without one. The preview shows the cover and revokes
  the previous object URL on each redraw.
- **Collections** (0.9, SF 13; "Collections"). `sourceKindOf` decides `note`, `book` or
  `collection`. A collection exports like a book, whole (the modal's row only says what it is),
  its stories as unnumbered chapters headed by their title alone, each on a new page, the EPUB's
  table of contents listing them; author, dedication, epigraph and cover come from the
  collection note's properties. A link to nothing is the `missingStories` warning. All three
  formats. `collection-menu.ts` is the file explorer's "Create a collection…" (`files-menu`, two
  or more Markdown notes, none an export): a modal asks for a title, `createCollection` writes
  the note through `notes.create` (`exists: "unique"`) beside the first story with `[[Name]]`
  list items (a story whose name another note shares is linked by its path), in the file
  explorer's sort order (`explorerSortOf`, `sortLikeExplorer`), and opens it (D9).
- **Writing** (`index.ts`, `write`). The file goes through `plugin.notes.create` into the export
  folder (`exportFolder`, default `Escrita/Exports`): `<title>.md` or `<title> (<preset>).docx` / `.epub`.
  It never replaces without asking. When the name is taken, the modal asks to replace or keep
  both (keep both names the new file with the date and time, `<title> (<preset>) YYYY-MM-DD
  HHhMM.docx`, written with `exists: "unique"`). Replace is offered only for an export at exactly
  that path (a case-only clash is another file); a file that isn't a recorded export goes to the
  trash first (`trashOld`), never over. The source notes are never touched. The notice after a
  write offers "Show in the file explorer" (see the documented exceptions).
- **Export again** (Q17). `data.exportChoices[key]` is `ExportChoice { format, preset, whole,
  chapters?, last? }` and `last` is `LastExport { format, preset, whole, chapters,
  chapterCount?, at, path, folder, name, source? }`: enough to repeat the export and to say what
  it was (`source` is the note a "This chapter" export came from). "Export again" writes at once
  when nothing needs a confirmation and it is the same kind of export (`canRepeat`: a chapter
  exported alone is repeated only from that chapter); otherwise the modal opens with those
  choices and the warnings. It overwrites the last file only while that file is still where it
  was written (`lastInPlace`: same folder, same name) and is an export; if it moved or is gone,
  it asks where to write. `data.ts` cleans the choices on load (`cleanExportChoices`).
- **Followers.** `dataFollowers()` moves the choices with a renamed note or chapter
  (`renameChoices`: the key, ticked chapters, the last path and its source) and drops them with a
  deleted one (`dropChoices`; a last export whose file was deleted keeps its record), and moves
  the `exportFolder` setting when the folder, or one holding it, is renamed. They run while the
  feature is off. Renaming the export folder is not "moving" the last export.
- **Writers** (`writers/markdown.ts`, `writers/docx.ts`). The Markdown writer escapes text that
  would turn prose into structure and writes a title block, chapter headings (`##`), scene breaks
  and the front pages. The DOCX writer builds the OOXML parts with `core/zip.ts` (9 parts): a
  title page (contact block and the rounded count on top, title and byline below; a page of its
  own for a book, the start of page 1 for a note), a page break before each front page and
  chapter, double spacing and the first-line indent, the running header "Surname / Title / page"
  with a live page field from page 2, the end mark, and the language of the preset. Output rules:
  `tests/fixtures/manuscript/README.md`.
- **Settings** (`settings-ui.ts`): the property names (`compileProperty`, `dedicationProperty`,
  `epigraphProperty`, `authorProperty`), `authorName`, `authorSurname` (empty means the last word
  of the name), `contactLines` and `chapterHeadingFormat`; since 0.9 also `coverProperty` (default `cover`),
  `epubSceneBreak` (default `* * *`, blank falls back) and `collectionProperty` (default
  `contents`). The export folder row is drawn by the core. An `author` property on the book note or the note overrides the settings.
- **Tests.** `tests/export-*.test.ts` (logic, source, Markdown, DOCX unzipped through
  `tests/support/zip-reader.ts`), `tests/lifecycle-export*.test.ts` (lifecycle, modal, preview,
  renames). Strings in `strings.ts` (English and pt-BR), styles in `styles.css`.

### submissions (`src/submissions/`, 0.8)

Serves the ready and published stages: one note per submission, so a work sent twice has two
notes and the home block counts two. Upkeep: one command per submission; the writer edits the
`result` by hand when the answer comes. The notes read well with Escrita off. Roadmap: SF 12.

- **A submission is a note** in the submissions folder (`submissionsFolder`, default
  `Escrita/Submissions`), named `YYYY-MM-DD <work> – <market>.md` (`submissionPath`, `safeName`).
  Frontmatter only, an empty body: `work` (a quoted wikilink to the work: a book note or a
  standalone note), `market`, `sent` (a date), `result` (the first value of the result list) and an
  empty `responded`. The property names are settings (`submissionWorkProperty`,
  `submissionMarketProperty`, `submissionSentProperty`, `submissionResultProperty`,
  `submissionRespondedProperty`, English defaults), and so is `submissionResults`, a
  comma-separated list whose **first value is "pending"**. `submissionText` writes the note and
  `workFor` picks the work.
- **Commands** (no default hotkeys): "Record a submission" (always in the palette) and a
  "Record a submission…" item in the file menu, shown only for a note that stands for a work. A
  chapter or a book note stands for its book; a tracked standalone note with a stage stands for
  itself; any other standalone note gets the "give it a stage" notice; a snapshot, an export, a
  submission note or a non-Markdown file gets "Open a story or a book". The `SubmissionModal` asks for the market (with the three most recent
  markets from the folder as chips) and the sent date, and shows the name and the `work` and
  `result` lines it will write. The note is created with `notes.create(…, { exists: "unique" })`.
  The link is made with `fileToLinktext`, so a renamed work keeps working through Obsidian's own
  link updates.
- **Pending index** (`index.ts`, `logic.ts`). A `metadata`-mode index spec named `submissions`
  over the folder (`include`: a `.md` file inside it), whose value is a `SubmissionRow { work,
  market, sent, result }` read from the metadata cache (`rowOf`; never the note text). Its
  `settingsKey` is the folder root plus the property names. `pendingList` keeps the rows whose
  result equals the pending value (case-insensitive), resolves each `work` link through
  `metadataCache.getFirstLinkpathDest`, and sorts newest `sent` first. The list is cached until
  something changes. A rename, delete or create of any note also notifies, because a `work` link
  may now resolve elsewhere though no submission note changed.
- **The port.** The module's `pending` field is the `PendingSource` of `core/pending.ts` (see
  "Pending submissions"); the desk reads it through `features.get`.
- **Followers.** `dataFollowers()` moves the `submissionsFolder` setting with a renamed folder,
  while the feature is off too. The notes themselves are the data, so there is no path-keyed
  record to follow.
- **Settings** (`settings-ui.ts`): the result list, the five property names (a name that
  duplicates another is refused). The folder row is drawn by the core. `offNotice` says how many
  notes stay in the folder.
- **Tests.** `tests/lifecycle-submissions.test.ts`, `tests/submissions-*.test.ts` (logic,
  properties, folder follow) and `tests/desk-pending.test.ts`. Strings in `strings.ts`, styles in
  `styles.css`.

### explorer (`src/explorer/` + `src/core/explorer-decorations.ts`)

- **Decoration adapter** (`plugin.decorations`, `core/explorer-decorations.ts`): the only
  code that touches the file explorer. It walks the private `view.fileItems[path].selfEl`
  behind type guards; a future Obsidian change turns decorations off (logged once)
  instead of breaking. Features register a drawer per id (`"dot"`, `"count"`) that maps
  `{ path, folder }` to `{ text?, tooltip?, cls? }` or null, cheaply and without I/O. Each
  id owns one `<span class="escrita-explorer-<id>">` after the name, in a fixed order,
  written only when it changed. `main.ts` calls `refresh()` on layout-change.
- **Counts** (`explorerCounts`, default on): tracked notes and chapters show their
  length in the note's own unit; a book's note, folder and chapters folder show the
  book's words (`explorerTotals`); with `explorerFolderTotals`, other folders show the
  words of the tracked notes inside them; with `explorerShowTarget`, "4,210 / 5,000";
  `is-near` / `is-over` classes from the piece's limit. The tooltip holds the full
  amount (`unitAmount`). Numbers come from `plugin.measure` (`peek`), never a read.
- **Abbreviation (spec deviation).** SF 6 abbreviates "when there's no room"; the
  explorer's width can't be measured, so counts are **always** abbreviated from 10,000
  (`12.3k`, `12,3 mil`), with the full count in the tooltip (`explorer/counts.abbreviate`).
- **Upkeep.** A first pass after layout ready counts every tracked note and every
  chapter of a tracked book in batches, then draws once. Afterwards it follows
  `measure.onChange` (counts), `metadataCache` `changed` (a new target, limit or unit;
  a note now counted in characters is counted again), create/delete/rename (books and
  the tracked set), and the editor for the active note (debounced, from the buffer).
  Snapshot paths (`classify().snapshot`) are skipped.
- Pure parts in `explorer/counts.ts` (`abbreviate`, `countLabel`, `explorerTotals`), tested.

### dialogue focus (`src/editor/dialogue.ts`, `src/editor/dialogue-focus.ts`)

- **Command** "Toggle dialogue focus": per note, per session (not saved); the on-set
  follows renames. A Notice says when the note is in Reading view (the dimming only
  shows in the editor).
- **What is speech** (`dialogue.ts`, pure, tested): a line-leading dash (`— – ―`, after
  any blockquote `>`) opens speech; a spaced dash toggles speech and narration inside
  the paragraph, including one that ends a hard-wrapped line when the paragraph goes
  on; a dash with nothing after it in the paragraph is the speaker cut off and stays
  speech. Text in the style's double quotes (and straight `"`) is speech, and dashes
  inside an open quote toggle nothing. Hard-wrapped continuation lines stay speech;
  a line-leading dash on a continuation line opens speech again (a new speaker). With
  `paragraphStyle` `single` every line is its own paragraph. Frontmatter, code,
  comments, math, headings and scene breaks are never speech (`segmentDoc`'s mask).
- **Editor** (`dialogue-focus.ts`): a ViewPlugin that dims the complement of speech on
  the visible lines only (`dimPlan`, paragraph widening capped at 200 lines each way);
  zero work while off. Toggling dispatches a `StateEffect` to every editor, not
  `updateOptions()`. No cursor un-dim.

### revision lens (`src/lens/`, shipped in 0.5)

Serves the **revision** stage. Off by default; "Toggle revision lens" turns it on for one
note, for this session (not saved, follows renames, like dialogue focus). It only
suggests: it decorates and moves the selection, and never writes prose. The only file it
writes is a new word lists note, on an explicit command. No network (`tests/no-network.test.ts`
scans its files).

- **What it reads** (the reader mask). `core/wordcount.readerMask(md)`, then
  `core/wordcount.readMask` (shared with the names index's `namesMask`) blanks whole heading
  lines, `$$` math blocks (through `Markdown.inMath`; math is not a segmenter span) and,
  with "Skip quotes" on (the default), `>` lines. Offsets never move, so every match
  position is a document offset. Frontmatter, code and comments are blank by `segment`.
  One token list over that mask (`core/tokens`) feeds every rule and every number, so
  rates, the dialogue share and readability share one denominator ("words the lens
  read"); a small difference from the status bar count is expected. The lens imports the
  editor's pure `core/dialogue.dialogueInDoc` and `core/block-context` (`blockStateIn`,
  `inBlock`, `bodyLineIn`) read-only; they are pure, the universe won't need them, and
  their signatures must not change for the lens's sake.
- **Rules and kinds** (`rules-stem.ts`, `rules-words.ts`, `types.ts`). Six rules, ids
  `echo`, `adverb`, `gerund`, `crutch`, `name`, `long`, and since 0.9 the opt-in `newName` (below). A `Match` is `{ rule, kind, from,
  to, text, related? }` with kind `base`, `gerundismo`, `chain` or `started`; an echo's
  `related` is the earlier occurrence. Rules take the tokens and sentences built once per
  pass and return matches whatever the settings; `analyze` filters. Language-bound rules
  (echo, adverb, gerund) are off when the language is `null` (a locale that is neither pt
  nor en). Built-in tables (`lexicon.ts`: adverb and gerund exceptions, forms of *ir* and
  *estar*, English start verbs) are language data picked by the language, not the
  author's values. Words the note capitalizes in mid-sentence count as names for the echo
  and gerund rules (`inferredNames`), on top of the listed names, so a sentence-initial
  *Fernando* is not a gerund and a repeated name is not an echo. Name variants take
  `names: string[]` as an option and never read the lists note, so the universe can feed
  them its entries. The rules themselves are specified in SF 5.
- **The session** (`session.ts`, pure, time injected). Per path: on or off, a **version
  counter** (the session owns versions; CodeMirror has none, and two panes on one note
  would each invent theirs), a pending timer and a cache of the last pass with the text
  it came from. `changed(path, text)` bumps the version and schedules one full pass after
  the quiet time: **400 ms** (`LENS_SETTLE_MS`), **800 ms** on mobile
  (`LENS_SETTLE_MOBILE_MS`). `now` runs immediately. The same text never recomputes
  (stepping and toggling reuse the cache), and a result older than the path's latest
  version is dropped. `invalidate` (settings or lists changed) bumps an **options
  generation** and clears every cache first, then recomputes each note that is on from the
  newest text the session was given (notes with a pending pass are left to that pass). The
  cache records its generation and only a current one is reused; a pass that saw the
  generation change is not cached; one failing pass does not stop the others (the first
  error is rethrown at the end). `generation()` and `onInvalidate(cb)` let `LensMarks`
  refresh. Zero work while the lens is off.
- **Marks follow the generation** (`decorations.ts`, fixed in 0.5.1). The field stores the
  generation of its list and adopts a result when it is new or the generation changed;
  otherwise it drops a list from an older generation until the new pass lands (mapped
  marks while typing are unchanged). Root cause of the 0.5.0 stale marks: with no current
  result the field kept its old list, and editing the lists note sent no transaction to
  other editors. A failed dispatch is retried once in a microtask, not removed.
- **Full pass, visible marks, one position list.** The pass (`analyze.ts`) is O(words),
  with a memoized stemmer and a sliding echo window, never pairwise. Decorations are
  built only for the visible ranges (`visible`, a binary search over the sorted matches).
  The pass keeps its intermediates (`LensPass`: mask, tokens, sentences, speech ranges,
  syllables per token), so selection measures slice them (`measuresFor`) instead of
  re-reading the note. In `decorations.ts` a CodeMirror state field holds **the mapped
  match list**: the last result's matches mapped through every edit
  (`ChangeSet.mapPos`), replaced when a result for the latest version arrives. Marks,
  `matchAt` (the context menu), stepping and dismissal keys all read that list, never
  stale offsets from the session. Marks only, never line classes, so they compose with
  dialogue focus; colors are Obsidian variables at low alpha, with dotted, dashed or
  double underlines that never look like the spellcheck squiggle, and long sentences as a
  faint tint (`editor.css`).
- **Performance budget.** `tests/lens-analyze.test.ts` has a CI ceiling on a generated
  10,000-word note (analyze under 300 ms, `visible` under 1 ms, `measuresFor` under
  5 ms) that catches quadratic code, and a local budget that runs only with
  `ESCRITA_PERF=1`: the median of five runs under 60 ms, which keeps a phone under its
  800 ms settle. CI machine speed varies too much to pin the tighter number.
- **Measures** (`measures.ts`, `readability.ts`, `syllables.ts`). Dialogue share is
  speech words over words read, from `dialogueInDoc` with the writer's quote and paragraph
  styles, per scene when there is more than one (split at `isSceneBreakAt`). Readability
  is Martins et al. (1996) for pt-BR in four bands and Flesch for English in seven; the
  score shown is clamped to 0-100 and the raw value is pinned in tests; "—" under 100
  words or 3 sentences, and off with no language. **Syllables are approximate on
  purpose** (about 95% exact on running text): the pt counter follows the dictionary
  split, so a rising sequence counts as two (*histó-ri-a*, *sé-ri-e*); the en counter
  counts vowel groups with silent `e`, `-ed` and `-es` rules and a map of irregular
  words. Pinned by fixtures in `tests/fixtures/syllables/`.
- **Dismissals** (`dismiss.ts`, `shown.ts`, `panel-model.withoutDismissed`). A key is
  rule + normalized matched text + up to 3 normalized words either side, read from the
  live document at the match's mapped offsets; stored in `data.lensDismissed[path]` (500
  per note, oldest dropped). The module builds the **shown result** once per result and
  dismissal change, `withoutDismissed(result, m => !isDismissed(…))`, and marks, panel
  counts, rates and stepping all read it. Dismissals follow renames through
  `plugin.index.follow` (`renameKeys`, merging on a collision), drop on delete and are
  pruned on layout ready; `cleanDismissed` makes saved data safe on load.
- **The lists note** (`lists.ts`, `index.ts`). Headings `Vícios`/`Crutch words`,
  `Nomes`/`Names`, `Ignorar`/`Ignore` (also `Crutches`), compared without case or
  accents, any level `#` to `######`; one entry per line; list markers, blank lines,
  `%% %%` comments, frontmatter and other headings' content are skipped. Read by a
  content-mode vault index (`lens-lists`; `include` and `settingsKey` both from
  `listsPath(setting)`), re-parsed on modify; the setting is normalized (trimmed, no outer
  slash, `.md` added). A follower moves the setting on rename and saves; a delete leaves
  it alone and the panel says the note is missing. "Create the word lists note" never
  overwrites: it opens an existing note with a Notice; else `ensureFolder`,
  `vault.create` with `starterNote`, and it sets the setting when it was empty. Crutch
  phrases match exactly (whole words, any case), never stemmed.
- **Adding to the lists** (`lists-edit.ts`, pure; 0.5.1). `addToList(text, list, entry,
  lang)` returns `{ text }` or `{ already: true }`; it finds the heading (any level, by
  alias), keeps line endings, comments and frontmatter, and adds the heading when missing.
  `menuEntry` and `listable` decide what the editor menu offers. The write goes through
  `plugin.notes.text(file).apply` with the diff shrunk by `minimalChange`, so undo and the
  cursor stay sane; a missing lists note is created silently and an empty setting is set.
  The lists index picks the change up through its modify event.
- **UI** (`ui.ts`, `view.ts`, `panel-model.ts`, `panel-format.ts`, `panel.css`). The panel
  is a view, `escrita-lens`, in the right sidebar, following the most recent Markdown
  note: measures, one row per rule (count, rate per 1,000, previous and next buttons, "3 /
  12", "Ignore here" under the stepped row) and the empty states. `ui.ts` registers
  everything (`registerView`, `registerEditorExtension`, `registerEvent` on
  `editor-menu`, commands), steps with `editor.transaction({ selection })` plus
  `scrollIntoView`, and on a phone closes the right drawer after a panel step and shows a
  Notice. Commands: "Toggle revision lens", "Next revision lens match", "Previous
  revision lens match", "Create the word lists note"; no hotkeys. The two private-API
  casts it needs are listed under "Documented exceptions".
- **Names without an entry (0.9, U 2.5; `rules-names.ts`).** A seventh rule, `newName`, **off
  by default** and the only one that is opt-in: `OPT_IN_RULES = ["newName"]`, switched on by the
  `lensRulesOn` setting (`enabledRules(off, on)`; putting it in `RULES` or in `lensRulesOff`'s
  defaults would have changed every saved vault's output). It runs only while the lens is on,
  and needs the universe: with it off the panel shows a `needsUniverse` row that links to the
  Features page. `newNames(toks, sents, mask, o)` takes the candidates from
  `core/name-runs.ts` `nameRuns` over the lens's own mask and marks one match per occurrence
  (kind `base`, `text` the run as written). A run is marked when it is not known (the names
  port's `isKnownName`, the lens's names list, or the "Not names" setting, all compared by
  `foldName`) and it recurs: at least 5 times in the note, or in at least 2 works of the scope
  (`workCount`, 0 while the `universe-names` index builds, when only the in-note count applies).
  `lens/index.ts` builds `NewNameOptions` from `plugin.names` and calls `wantNameCounts()` when
  the rule runs; its pass key includes `countsVersion()`, so a count change re-runs the pass
  without refreshing the name marks. The panel lists the marked names under the rule's row,
  grouped by folded text and ordered by count, with **Create** (`plugin.names.createEntry`,
  the whole run, "Dona Zefa", editable in the dialog) and **Dismiss** (appends to "Not names",
  one per line; unlike "Ignore here" it is never a name anywhere). A click on a name steps to
  its next occurrence. The panel reads the rule list from `enabledRules`, not a fixed list.
- **Names from the port (0.7).** The session's `analyze` takes `(path, text, version)`, so
  each note is analysed with its own names. `options(path)` sets `lists.names` to the word
  lists note's names merged with the capitalized terms of `plugin.names.tableFor(path)`
  (`lens/names.ts`, `mergeNames`, `namesFor`; lowercase terms are not fed). The pass key
  includes `plugin.names.version()`, and a change calls `invalidate()`. The lens never
  imports the universe.
- **Boundaries.** `lens` imports `core/*` and, read-only, `editor/dialogue` and
  `core/block-context`; core never imports the lens. The pure files import neither `obsidian`
  nor `i18n`: `types`, `syllables`, `readability`, `lists`, `lang`, `dismiss`, `lexicon`,
  `rules-words`, `rules-stem`, `measures`, `panel-model`, `session`, `analyze`,
  `marks-model`, `lists-edit`.

### snapshots (`src/snapshots/`)

- **Storage** (`paths.ts`, `store.ts`, `fs.ts`): `<root>/<note path, .md kept>/<YYYY-MM-DD
  HHmm> <label>.txt` plus an `index.json` (entries: file, name, kind, taken, day, words,
  note path at the time, hash, length). Root from `snapshotsFolder` through core's
  `snapshotsRoot` (default `Escrita/Snapshots`); settings refuse a folder inside a track
  folder or already holding `.md` notes. `.txt`, so links, search and graph ignore
  them and a rename never rewrites a snapshot. The files are the truth: every load
  reconciles the index with them (strays are adopted as manual, never pruned).
- **One serial queue** for takes, renames, deletes and folder moves; a take reads its
  note's path (a live `TFile`) inside the queue, so a rename queued first moves the
  folder first. Renames of notes and folders move the snapshot folders; **deletes keep
  them**. A note created later at a deleted note's path inherits its snapshots (restore
  stays safe: "Before restoring" is always taken). Snapshots of deleted notes are
  reached with "Browse snapshots of deleted notes" (read-only full text in the compare
  tab). Two notes whose paths differ only in characters Obsidian's `normalizePath` or
  the file system folds (NBSP, U+202F, NFD) share one folder: the store sees another
  existing note in `index.json` and refuses (`SharedFolderError`) instead of mixing.
- **Kinds.** Manual (named, never pruned) and automatic: "Before publishing" (publish
  calls `beforePublish`), "Before restoring" (before every restore and every "Use the old
  version"), "Before the day's first edit" (tracked notes, `snapshotBeforeFirstEdit`; the
  disk read starts before anything is awaited). Automatic ones are pruned to
  `snapshotsKeepAuto` (default 20) per note, oldest first, to the trash; the snapshot
  being restored or compared is protected. A take identical to the latest snapshot
  writes nothing; a named manual take identical to an automatic one promotes it.
- **Stage kind.** A fifth kind, `stage`, is taken when a work's status moves to another
  stage, named from the written words (for example "Draft → Revision", `transitionName`),
  with `stage: { from, to }` in the entry. It is **never pruned**: it is not in
  `AUTO_KINDS`, so retention ignores it, and `snapshotsKeepAuto` does not count it. A
  book takes the snapshot of its book note and of each chapter, one after another, under
  the same name (`stageTakeTargets`). It is silent (no Notice) unless the take fails,
  and then one Notice per session.
- **StageWatch** (`stage-watch.ts`, pure, tested). Fed by `plugin.works.onChange`, it
  remembers each work's last known stage **in memory only** and, once a change has been
  quiet for 3 s (`STAGE_SETTLE_MS`, so a status typed letter by letter fires once),
  compares the work's current stage with the last one and calls `onTransition`. It
  reseeds from every `build` change, so a settings rebuild never counts as a transition;
  it follows renames and forgets deletes; a work that stops being a work keeps its last
  stage. A status changed while Obsidian was closed is therefore not snapshotted.
- **Panel** (`view.ts`, type `escrita-snapshots`): the active note's snapshots, newest
  first, with words (`unitAmount`) and the difference from now; View, Compare, Restore,
  Rename, Delete.
- **Compare tab** (`compare.ts` pure and tested, `compare-view.ts`): jsdiff's
  `diffArrays` over paragraphs, then over core's word tokens inside changed ones; moves
  detected; inline, side by side, or the snapshot's full text; unchanged runs fold; the
  properties diff shown apart. "Use the old version" per passage goes through
  `revertBlock` (see "Note text": anchored, checked against the text the view showed,
  after a "Before restoring" snapshot). Restore-all confirms, snapshots, and replaces
  only if the note didn't change meanwhile.
- **Commands**: "Take a snapshot" (also in the file menu), "Open snapshots", "Compare with
  the last snapshot", "Browse snapshots of deleted notes".
- jsdiff (`diff`, BSD-3-Clause) is the first runtime dependency; its license travels in
  an esbuild banner at the top of `main.js` (release assets don't include
  `THIRD_PARTY_NOTICES.md`).

### desk (`src/desk/`)

The writing desk: the home block, where the writer left off, and the home note. Stage
logic lives in core (`stages`, `works`, `left-off`); the desk draws and records.

- **Home block** (`block.ts`, `works.ts`, `gather.ts`, `render.ts`). A code block
  `escrita-works` (registered with `registerMarkdownCodeBlockProcessor`; a `DeskBlock`
  `MarkdownRenderChild` per block, in a set so a settings change re-renders them). Escrita
  draws it and never writes it. The grammar is `folder: <name>` lines (any other line is
  ignored; a quoted name or a `[[wikilink]]` is accepted), which narrow the block to works
  inside those folders. `buildDesk` (pure) turns the works list into a model: works in
  **draft** under "Writing", works in **revision** under "Revising", each as a line with
  its facts (a piece's count against its target or limit, a deadline, a book's chapters
  ready of total, an unstaged work's own status word), ordered by when the writer last
  edited each; every other stage (idea, ready, published, and notes with a status that
  isn't a stage) is a single count. Notices (no works, nothing in draft or revision, a
  folder that doesn't exist) are muted lines. A click opens the work where the writer
  left off; the block has no buttons that change anything.
- **Pending count** (0.8). While `features.isOn("submissions")`, `gatherDesk` reads the pending
  submissions through `pendingSource(plugin)` (`desk/gather.ts`: `features.get` on the submissions
  module's `pending` port; the desk never imports that module). `buildPending` (pure, in `works.ts`)
  counts one per submission, so a conto sent twice counts 2, and with a `folder:` filter keeps
  only submissions whose work resolves to a kept path. The count bar shows "pending" after
  "ready" and before "published", and expands to the submissions (work, market, date), each
  linking to its note. The block follows the submissions feature (`features.onChange`, then it
  rebinds `onChange` of the port) and redraws when the list changes. With submissions off the
  count and its trace are gone.
- **Opening a work** (`open.ts`). A note opens at its left-off spot, else the first
  unwritten beat, else the end (`noteSpot`). A book opens the chapter edited last, else the
  first chapter with an unwritten beat, else the last chapter at its end (`bookTarget`).
  Reading view scrolls to the line instead of moving a cursor.
- **Left off** (`recorder.ts`, `core/left-off.ts`, `core/anchor.ts`). `data.leftOff[path]`
  is `{ offset, before, after, at }`: the cursor offset plus the text around it, found
  again by `findLeftOff` if the note changed (a stale offset is never trusted alone).
  `LeftOffRecorder` records only notes that are works and chapters of a book that is a
  work. An edit only marks the note dirty and remembers the cursor offset (cheap,
  per keystroke, no text read); the context is built once at commit time. A commit runs
  when the writer leaves the note, after 30 s idle, when the window is hidden, on quit and
  on unload. Records follow renames and deletes through an index follower, and records for
  files that no longer exist are pruned at layout ready.
- **Home note** (`home.ts` pure, `home-note.ts`). Setting `homeNote` (a vault path; `.md`
  added when missing; empty by default). The command "Open the home note" (no hotkey)
  opens it; with the setting empty it adopts an existing `Home.md` or `Inicio.md` and
  never overwrites, and saves it as the setting so open on startup and rename tracking
  follow it; if the note doesn't exist it asks, then creates it holding an empty
  works block (a failure shows a Notice and logs the error). The setting follows a rename
  or move of the note through `homeAfterMove`; a deleted home note leaves the setting
  alone.
- **Open on startup** (`openHomeOnStartup`, off by default). Only on a cold start:
  `coldStart` is read at load (`!workspace.layoutReady`) and used in `onLayoutReady`, so
  enabling or updating the plugin mid-session never swaps the active tab. It opens the
  home note in the active tab, replacing the restored one.
- **Settings** it reads: the `stages` mapping and `otherStatusColors` (Stages and Other
  status colors in the settings tab), `statusProperty`, `homeNote`, `openHomeOnStartup`.
  The rest comes from `plugin.works`, never from a scan.

### universe (`src/universe/`, 0.6)

Serves every stage as the world around the works: a shared set of entries (characters,
places…), the open threads of a story, and the commands that make them. Opt-in: the mode
setting (`universeMode`: off, per book, universe) decides how much exists. Roadmap:
ROADMAP-universe.md (Modes, 1.1, 1.3, 1.5). No network.

`UniverseModule` (`index.ts`) owns the indexes and gives the three UI parts one API:
`mode()`, `enabled()`, `entries(scope)`, `universes()`, `threads(scope, open)`,
`worksIn(scope)`, `scopeOf(file)`, `createEntry()`, `closeThread()`, `showThreads()` and
`onChange(cb)`. Views and dialogs never read the indexes directly.

- **Scope** (`core/scope.ts` since 0.9, `scopeFor`, pure; see "Scope"). The question every feature asks first:
  `{ kind: "none" | "book" | "universe", root, note }`. **Rule 0 (0.7)**: `universe: false`
  (the YAML boolean, or the string `"false"`, trimmed, any case: the Properties editor
  writes a string) keeps the file out of the universe, in its book's scope or none. It is
  read on the file before its book note, applies to every file of a book, and beats the
  universe folder and the universe note. Universe mode then tries, in order: the
  file's own universe property (a chapter's wins over its book note's), the book note's
  property, being inside the universe folder, being inside a default-universe folder, being
  in a book (per-book rules), else none. The universe folder is not a setting: it is the
  folder beside the universe note with the same basename (`universeRootOf`;
  `universeNotePath` is the one place the note path is built). A link that resolves to no
  note joins nothing. The module's `scopeOf` reads `books.classify(x).scope`; only for a path
  classify gives no scope by kind (a missing path, such as the universe note before it exists,
  and the plugin's own folders) does it call `scopeFor` itself, with `books.scopeLookup(placement)`,
  the classifier's lookup, which `keptOut` reads too.
- **Settings** (`settings.ts`, pure). `UniverseSettings` extends the plugin settings;
  `normalizeUniverse` fills any missing or wrong-typed value with the English default.
  Five fixed entry types (`ENTRY_KINDS`), each `{ value, folder, template, label }`;
  five forms (`FORM_KINDS`); `threadClosedWord`; `universeNote` (path, `.md` added);
  `defaultUniverseFolders`. The author's own words live in `data.json`. The section in
  Settings is drawn by `settings-ui.ts`.
- **Entries index** (`entries.ts`). A `plugin.index` spec over notes whose type property
  holds an entry type's value, giving `{ path, name, kind, aliases, ... }`. Since 0.7 an entry
  stores no scope at all: it is computed when queried (`scopeOf`), so a change to a book
  note's property can't leave a stale answer. The entry's `caseSensitive`, `ignore` and
  `firstName` properties (names are settings) are read here and feed the names matcher. Snapshots and template notes (the type templates, the templates folder,
  the chapter template) are never entries or threads (`isUniverseNote`), and the index
  is empty while the mode is off. `entriesIn`, `groupByKind` and
  `searchEntries` (folded, accent-blind) are pure.
- **Threads index** (`threads.ts`). A content-mode spec that parses each note's thread
  markers, in every mode. A query is a scope (or the tracked works when the mode is off),
  and a chapter belongs to its book note, so threads and counts group by work.
- **First seen** (`first-seen.ts`). `data.threadSeen` is path → thread text → time, kept
  in plugin data and never written into notes. Recorded on index change, moved with
  `plugin.index.follow`, dropped with a deleted note, pruned for missing files at layout
  ready, and kept when a thread disappears and returns with the same text.
- **Mentions and "Appears in"** (0.7). The names provider (`names-provider.ts`) turns the
  entries into one `TermTable` per scope and one over every entry, and `plugin.names`
  exposes it (see "Names matcher"). `MentionsIndex` (`mentions-index.ts`) scans the notes
  that may mention an entry and answers `appearsIn(entry)`: the works and chapters that
  mention it with counts, the first and last mention (only inside a book), a group of "Other
  notes", and a range for "click to jump" that is checked against the live text before it is
  selected (otherwise the note opens at the top). It builds on demand and rebuilds as described
  in "Names matcher"; its `include` skips the export and submission folders as well as snapshots,
  templates and the universe note, and the entries and threads indexes skip them too
  (`isUniverseNote`). Threads read `segmentDoc`. `appears-in.ts` draws the list for the Entries tab and `appears-in-widget.ts`
  draws it as a block widget at the end of an entry note in Live Preview and Source mode,
  from a `StateField` in an editor slot; it is never written into the file, so it is not
  selectable, exported or counted. Reading view shows nothing yet (gate G0d is open: the
  Markdown post-processor route is unproven). Neither file writes to a note.
- **Unlinked mentions and names without an entry** (0.9, U 2.5). The universe feeds both from
  the mentions and names indexes; their pure parts, rules and the write are in "Names matcher"
  (unlinked mentions, name runs, the names index). `UniverseModule` adds `unlinkedFor(file)`
  ("counting" while the mentions index builds, null for a note outside any scope or an entry),
  the port's `createEntry` (`createEntryFromSelection` with `{ named }`) and the `universe-names` index
  registration, which the module owns (`universe/index.ts`) while `names-provider.ts` answers
  `isKnownName`, `workCount`, `wantNameCounts` and `nameCountsReady` through the port.
- **Name marks** (`name-marks.ts`, `name-marks-model.ts`). A CodeMirror `ViewPlugin` that
  puts `spellcheck="false"` on every capitalized name of the note's scope, with an
  optional underline (the "Underline names in the editor" setting, off by default) and
  Ctrl/Cmd-click to open the entry. One full pass when the note opens or the names change,
  then a debounced re-match of the paragraphs the edits touched, with marks mapped through
  edits in between. Decorations only. Whether the squiggle goes away on a phone is gate
  G0c, still open; the lens half works regardless.
- **Works tab** (`works-list.ts`, `view-works.ts`). The universe's works from
  `plugin.works`, grouped by the form property (unknown or missing → "No form"), sorted by
  stage (published first) then name; the count comes from `plugin.measure`, filled in
  after the first draw, and a redraw happens only when a count actually landed.
- **Panel** (`view.ts`, `view-entries.ts`, `view-threads.ts`, `view-works.ts`,
  `view-parts.ts`, `panel-model.ts`). `UniverseView` (type `escrita-universe`, tabs Entries,
  Threads, Works) and `ThreadsView` (type `escrita-threads`, the threads only, used when
  the mode is off) share `PanelBase`, which redraws after the module's `onChange`, the
  active leaf and the metadata cache, debounced. The tab, the collapsed groups and "show
  closed" live in the leaf's state. The panel can set a note's universe property ("Add to
  <universe>"), only on that click and only where it is missing, through
  `processFrontMatter`. "Insert link" goes through `plugin.notes` and refuses a cursor in
  the properties (moved to the body start), code or a comment (`linkInsertPoint`).
  Closing a thread opens a popover with an optional answer and a preview of the marker;
  `pickStillValid` drops a pick whose marker changed.
- **Create entry** (`create.ts`, `create-logic.ts`, `new-entry.ts`). The modal
  (`Modal`, board 17) and `createEntry`: the name from the selection (`nameFromSelection`),
  `findDuplicate` against names and aliases, the note built by `entryText` (type property,
  universe property in universe mode only, template merged with the shared template code),
  the universe link written with `fileToLinktext`. The optional link on the selection goes
  through `plugin.notes`.
- **Threads in the editor** (`create.ts`, `create-logic.ts`). `plantThreadPlan` (pure) places
  a marker at the cursor and never changes prose structure; "Plant a thread" and the
  editor-menu items (Create universe entry, Plant a thread, Close or Reopen thread, Show
  open threads) call it. `threadMarkerExtension` is a CodeMirror `ViewPlugin` registered
  with `registerEditorExtension`: a line decoration (the margin flag, muted when every
  thread on the line is closed) and a mark decoration over a closed marker only.
- **Migration** (`migration.ts`, `migrate-plan.ts`, `migrate.ts`). `planMigration` (pure)
  matches each file in the book folder to the deepest type folder, never takes a chapter,
  lists name clashes and counts the notes missing the type property. The preview modal
  (board 18) has two checkboxes (add the type property; add the universe property to the
  book note) and applies the plan one note at a time with `fileManager.renameFile`, adding
  properties with `processFrontMatter` only where missing. Moving into a non-default
  universe also adds the universe property to each moved note.
- **Mode off.** The universe is a switchable feature and its switch is the mode. Off
  unloads it: its commands are removed, its panel's leaves close, its names provider
  withdraws and the mentions index is disposed. The view types stay registered (see "Modules
  and feature switches"). Open threads are a separate feature (`threads`, `threads-feature.ts`)
  and keep working in every mode, including the commands "Plant a thread", "Close thread" and
  "Show open threads", with the threads view.
- **Commands** (no default hotkeys): Open the universe panel, Show open threads, Plant a
  thread, Create universe entry, Close thread, Move this book's entries to the universe.
  The migration also shows in a book note's file menu in universe mode.
- **Strings.** `strings.ts` (commands, settings), `view-strings.ts`, `create-strings.ts`
  and `migrate-strings.ts`, each with English and pt-BR; the type labels are the writer's
  own and default to the localized names. Styles: `styles.css`, `view.css`, `create.css`,
  `migrate.css`, all `escrita-` classes on Obsidian variables, touch targets at least
  32px.
- **Tests.** `tests/universe-*.test.ts` (scope, entries, create, panel, threads, migration,
  works), `tests/threads.test.ts`, `tests/template.test.ts`, `tests/note-text-plans.test.ts`.
