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
  `classify(file | folder | path | null)` → `{ path, kind, markdown, book, tracked, piece }`,
  `chapters(book)`, `allBooks()`, `frontmatter(file)`; see "File classification" below),
  `counter` (`WordCounter`: cached per-file word counts), `chapterOps` (`ChapterOps`:
  create/renumber/retitle chapters), and the other modules (`goals`, `outline`,
  `placeholders`, `darlings`, `editor`, `publish`).
- **Pure core** (no Obsidian imports, unit tested): `core/markdown.ts` (the one
  Markdown segmenter, see below), `core/wordcount.ts`,
  `core/markers.ts` (beat/placeholder/scene-break syntax), `core/book.ts`
  (chapter numbering), `core/dates.ts` (writing day), `core/piece.ts` (a note's
  target/limit/unit/deadline, `pieceCount`, `pieceProgress`), `core/daysoff.ts`
  (`dayOffPredicate`, `parseDatesOff`), `core/classify.ts` (the `VaultTree` port,
  `classify`, `listBooks`, `inFolder`, `inBook`; see "File classification"),
  `core/lists.ts` (`lineList`, `folderList`; import them from here) and
  `core/merge.ts` (`mergeDefaults` for saved settings). `countCharacters(md, { spaces })`
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
- **Styling.** Classes prefixed `escrita-`, CSS in the module's `styles.css`, colors only
  from Obsidian CSS variables or the tokens in `src/styles.css` (`--escrita-accent`,
  `--escrita-ghost`, `--escrita-placeholder-bg/fg`, `--escrita-good`, `--escrita-bar-bg`).
  Must look right in light and dark themes. Touch targets ≥ 32px in side panels.
- **Data safety is the top priority.** Never lose or silently change prose. Anything
  that deletes text either moves it somewhere recoverable (darlings, trash) or asks.
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
Novels/A Casa.md                  ← book note. Frontmatter: goal (number), deadline (YYYY-MM-DD)
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

## Module specs

### goals (`src/goals/`)

- **Tracking.** Count only real typing in tracked files: on `workspace` `file-open`
  (and at layout ready for the active file) prime `counter` with the active file's
  count. On `vault` `modify` of a tracked Markdown file **that is the active file**
  (so sync/git pulls of other files don't count), recount; `delta = after - before`.
  If `|delta| > settings.ignoreJumpsOver`, don't count it (still update the cache).
  Positive deltas add to `added`, negative to `deleted`, in `data.history[writingDay]`
  (and per book in `books[bookNotePath]` when the file is a chapter; also set that
  book's `total` = sum of its chapters' counts). Tracked = `books.classify(file).tracked`:
  inside one of `folderList(trackFolders)` (or anywhere when empty), not inside
  `excludeFolders`, and not the chapter template (the rule lives in `core/classify.ts`). Handle rename (`counter.rename`) and delete (`forget`).
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
  written to the book note's frontmatter (`goal`, `deadline`) with
  `processFrontMatter`. Chart as inline SVG (`createSvg` / `createElementNS`), sized to
  the modal width, geometry computed by a pure tested function (`src/goals/chart.ts`).
- **Sprints** (`src/goals/sprint.ts`): duration + target; words = vault-wide `added`
  since start (tracked files); ticks every second via `registerInterval` updating the status bar;
  target reached → Notice once; time up → Notice with words, minutes, words/hour; stop
  early from the status bar or command. Sprint state is not persisted across reloads.
- **Targets per piece** (`core/piece.ts`, display helpers in `src/goals/piece.ts`):
  any note can have `target`, `limit`, `unit` (`words` | `characters` |
  `characters-no-spaces`; names from `targetProperty`/`limitProperty`/`unitProperty`)
  and `deadline`. `readPiece` returns null when none is set. `pieceProgress` gives the
  state `none | under | near (≥ 95% of the limit) | over`. Status bar: when the active
  note has a target or limit, a piece segment "4,210 / 5,000 words" with a bar, amber
  near the limit, red with "+312 over the limit" past it (`pieceSummary`). Outside a
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
  from frontmatter (settings property names), words from `counter`, beats with
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
  (map to canvas colors "1"–"6" or the hex from statusColors). If the file exists and was
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
  against its target/limit in the piece's unit via `outline/units.ts`); anything else
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
- **Index**: `Map<path, PlaceholderMarker[]>` over Markdown files not in excluded folders,
  built after layout ready with `cachedRead` in small async batches; kept current on
  modify/create/delete/rename. Public API: `countFor(path): number`,
  `all(): {file, markers}[]`, and an `onChange(cb)` subscription the outline can use.
- **Placeholders view** (`ItemView`, type `escrita-placeholders`, icon `map-pin`,
  command "Open placeholders"): grouped by file (book chapters first, in chapter order),
  scope toggle "This book / All notes", each item shows the note text (or "no note"),
  click opens the file with the placeholder selected; a check button resolves it
  (removes the marker via `vault.process`, verifying the exact text is still at that
  offset first). Empty state explains ⌘/Ctrl+P → Insert placeholder and suggests binding
  a hotkey like Ctrl/Cmd+Shift+X.
- **Explorer dots** (`showExplorerDots`): add/remove class `escrita-has-placeholder` on
  file explorer items (private API `view.fileItems[path].selfEl`, guarded) + CSS dot.
  Re-apply on index change and when the explorer re-renders (layout-change).
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
- **Commands**: "Toggle spellcheck", "Insert scene break" (inserts `\n\n---\n\n` normalized
  around the cursor).

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
- **Publish** sets `statusProperty` = `publishedValue` and `dateProperty` in one
  `processFrontMatter` call, then a Notice. It stores `data.publish[path] =
  { previousStatus }` when there was one. **Unpublish** restores `previousStatus`, else
  `unpublishedValue`, else `ready`, and drops the record. Records follow file and
  folder renames and are dropped on delete. Escrita never commits, pushes or uploads.
- **Commands** (also in the file menu): "Publish this note", "Unpublish this note".
