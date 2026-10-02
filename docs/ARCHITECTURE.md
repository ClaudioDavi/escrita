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
- **Entry point.** `src/<module>/index.ts` exports `class <Name>Module implements EscritaModule`
  with `constructor(private plugin: EscritaPlugin)`, `load()`, optional `unload()`
  and `settingsChanged()`. `main.ts` already constructs and loads every module.
- **Plugin services** (on `this.plugin`): `settings` (see `src/settings.ts` —
  all settings already exist, with a settings tab), `data.history` (see `src/data.ts`),
  `requestSave()` (debounced persist), `saveSettings()`, `books` (`BookService`:
  `classify(file | folder | path | null)` → `{ path, kind, markdown, book, tracked, piece, snapshot, stage }`,
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
  `index`), and the other modules (`goals`, `outline`,
  `placeholders`, `explorer`, `darlings`, `editor`, `snapshots`, `publish`, `desk`).
- **Pure core** (no Obsidian imports, unit tested): `core/markdown.ts` (the one
  Markdown segmenter, see below), `core/wordcount.ts`,
  `core/markers.ts` (beat/placeholder/scene-break syntax), `core/book.ts`
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
  `matchLineEndings`), `core/explorer-decorations.ts` (the explorer walk, over fake
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
  everything so unload cleans up; never keep references to views — look them up with
  `workspace.getLeavesOfType`; don't detach leaves in `onunload`; modify files with
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
  - **Writes into a note's text go through `plugin.notes`** (the editor when the note is
    open in source or Live Preview, else `vault.process`), never straight to
    `vault.process` or an editor.
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
- **Checks.** `npm run typecheck`, `npx vitest run`, `npm run build` must pass.
  Other modules are being written at the same time, so errors outside your folder
  may appear transiently; your files must be clean.

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
read-only port of four calls (`file`, `folder`, `folders`, `frontmatter`), the
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
- `snapshot`: the path is the snapshots folder or inside it (`inSnapshots`). Such a
  path is never a book, a chapter or tracked, even when the folder sits inside a book
  (a snapshot folder is named like its note, `x.md/`). The outline and the explorer
  skip it through this field, goals through `tracked`, and the placeholder index
  excludes `snapshotsRoot` like an exclude folder.

The snapshots folder setting is read only through `snapshotsRoot(setting)` (trimmed,
slashes cleaned, empty → `Escrita/Snapshots`), and checked before saving with
`snapshotsFolderProblem`: not `..`, not the config folder, not inside (or holding) a
track folder, not a folder that already has `.md` notes.

It reads the live vault and the settings passed in every time: no cache, so
renames and settings changes need no invalidation. Don't add one. It never throws.
A missing path is `none` and guesses nothing from its ancestors: for deleted or
old paths, use `inBook(path, book)`, which is **containment** by path (the note,
the folder, anything under it, including a nested inner book's files).
`Placement.book` is **ownership** (innermost). They differ only for nested books;
keep both.

Growth: new knowledge arrives as new fields on the result and new fields on
`ClassifySettings`, never as new kinds and never as caller changes. The universe
roadmap's `scopeFor(file, settings)` becomes a `scope` field computed in the same
pass; the file explorer counts of v0.3 read `kind`, `book` and `tracked` per item.
The writing desk (0.4) added `stage` and submissions (0.8) will add `submission`, both
the same way.

- `stage`: the work's stage (`idea`, `draft`, `revision`, `ready`, `published`), set only
  for a **tracked** book note or a tracked standalone note whose status property holds a
  word mapped to a stage in `settings.stages`; null for everything else (chapters, files,
  untracked notes, an unknown or missing status). This is the one stage rule for works
  (`stageFor` in `core/classify.ts`): the works index, the publish check and the stage
  snapshot all read it, and none re-derives it. Words match after NFC, trim and
  lowercase; a word listed under two stages belongs to the first stage in order.

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
`editor/context.blockStateIn`, `wordcount.countSelection`), and every editor
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
   properties" (`editor/context.bodyLineIn`).
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
   `%%` inside a closed `<!-- -->` is literal (the first opener wins), so an odd
   one there doesn't open a comment for counts or the editor; the publish check
   still blocks on it (`unclosedComment`), because parity with Reading view is
   unverified and either reading must be safe.

Block spans end at the end of their closer's line; the line break after is prose.
Not segmented: `$$` math (an editor-only overlay in `editor/context.ts`, counted over
prose only, so a stray `$$` never hides a placeholder), 4-space indented code,
fences inside quotes or lists, multi-line inline code.
`editor/context.inlineProtected` keeps its own backtick loop on purpose: it
predicts a span that is still being typed, which is not a parse.

Open questions (each is a one-place flip pinned by a row in
`tests/markdown-consumers.test.ts`): parity with Obsidian's Reading view for a fence inside an open `%%` comment (literal here), `%%` inside a `$$`
block (opens a comment here), escaped backticks, and `%%` inside a closed
`<!-- -->` (literal here; check before release, since it decides whether text
after the comment is hidden in Reading view).

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
  `unitProperty`, `deadlineProperty` (notes and books) and `goalProperty` (books).
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
- Users: placeholders (resolve), darlings (cut and restore), publish (read), snapshots
  (read, restore, "Use the old version"). The outline's four hand-made beat re-checks
  are not migrated yet (IMPROVEMENTS 3, partial).

## Vault index (`core/vault-index.ts`, `core/index-hub.ts`, `core/vault-indexes.ts`)

One reusable, incrementally kept index replaces the per-module scans (placeholders and
the works list use it first). `plugin.index` is the hub; a module adds a spec and gets a
`VaultIndex<F, V>` back.

- **Spec** (`IndexSpec<F, V>`): `name`; `mode` (`content` reads each file's text through
  `cachedRead`, `metadata` reads only the metadata cache and gets `text === null`);
  `include(f)`; `compute(f, text) → V | undefined` (undefined means no entry); `same(a, b)`;
  `structural` (recompute everything when a file is created, deleted or renamed, because
  who is what can change, as the works index needs for `classify`); `settingsKey()`
  (a string that changes when a setting the spec depends on changes). An index holds
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
  a time) and yields between them; a newer build makes an older one stop. Live events
  that arrive during a build are mirrored into the map being built and win over the
  build's read.
- **Debounce.** A modified file is recomputed after 300 ms of quiet. `settingsChanged()`
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
- **Targets per piece** (`core/measure.ts`, display helpers in `src/goals/piece.ts`):
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
- **Commands**: "Open outline", "Open outline as a board", "Create a book" (modal: title +
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
- **Smart typography** (`src/editor/typography.ts`, when `smartTypography` and the scope
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
- **Commands**: "Toggle spellcheck", "Insert scene break" (inserts `\n\n---\n\n` normalized
  around the cursor), and the four move commands above.

### publish (`src/publish/`)

- **Pure checks** (`src/publish/checks.ts`, tested): `runChecks(text, frontmatter, ctx)
  → Check[]`, each `{ id, level: blocker | warning | passed, line?, items, vars }`
  (messages are built with `t()` in the modal from the id and vars). In order:
  `unclosedComment` (the note's last span is a `%%` comment with no closer, as
  `core/markdown` reads it: outside fenced and inline code; or a closed `<!-- -->`
  holding an odd number of `%%`; blocker, with the opening line), `placeholders` (blocker, each item jumps to its line), `unwrittenBeats`
  (warning), `emptyBody` (`countWords` = 0; blocker), `recommended` (missing
  `recommendedProperties`, case-insensitive; warning; skipped when the list is empty),
  `overLimit` (the piece's `limit` in its unit; warning; only when a limit is set).
  `sortChecks` puts blockers first; `hasBlockers`. No check assumes a website:
  Escrita is standalone (no URLs, slugs or site build rules).
- **Dates** (`src/publish/date.ts`, tested): the modal's date field starts at the
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
- **Commands** (also in the file menu): "Publish this note", "Unpublish this note".

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
