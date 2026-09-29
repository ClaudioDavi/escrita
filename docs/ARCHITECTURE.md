# Escrita — architecture and module specs

Escrita is an Obsidian plugin for fiction writers, inspired by NEO
(https://github.com/hughhowey/neo, MIT). It is published publicly, so everything
must be generic (any vault, any language), theme-friendly and mobile-safe.

## Conventions every module follows

- **Ownership.** Each module lives in `src/<module>/` (`index.ts`, `strings.ts`,
  `styles.css`, plus any files it needs) with tests in `tests/<module>*.test.ts`.
  Do not edit `src/main.ts`, `src/settings.ts`, `src/data.ts`, `src/i18n.ts`,
  `src/strings.ts` or `src/core/*` (exception: the outline module implements
  `src/core/chapter-ops.ts`). If you need a change there, say so in your final
  report instead.
- **Entry point.** `src/<module>/index.ts` exports `class <Name>Module implements EscritaModule`
  with `constructor(private plugin: EscritaPlugin)`, `load()`, optional `unload()`
  and `settingsChanged()`. `main.ts` already constructs and loads every module.
- **Plugin services** (on `this.plugin`): `settings` (see `src/settings.ts` —
  all settings already exist, with a settings tab), `data.history` (see `src/data.ts`),
  `requestSave()` (debounced persist), `saveSettings()`, `books` (`BookService`:
  `bookFor(file)`, `isChapter(file)`, `chapters(book)`, `allBooks()`, `frontmatter(file)`),
  `counter` (`WordCounter`: cached per-file word counts), `chapterOps` (`ChapterOps`:
  create/renumber/retitle chapters), and the other modules (`goals`, `outline`,
  `placeholders`, `darlings`, `editor`).
- **Pure core** (no Obsidian imports, unit tested): `core/wordcount.ts`,
  `core/markers.ts` (beat/placeholder/scene-break syntax), `core/book.ts`
  (chapter numbering), `core/dates.ts` (writing day). Reuse these; don't duplicate.
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

A beat is **written** when prose follows it before the next beat, scene break or end
of file (`core/markers.parseBeats`). Beats stay in the file after the scene is
written; they act as invisible scene headings and keep the outline in sync.

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
  book's `total` = sum of its chapters' counts). Tracked = inside one of
  `folderList(trackFolders)` (or anywhere when empty), not inside `excludeFolders`,
  and not the chapter template. Handle rename (`counter.rename`) and delete (`forget`).
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
- **Commands**: "Open progress", "Start a sprint", "Stop the sprint".

### outline (`src/outline/` + `src/core/chapter-ops.ts`)

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

  JSON must never contain `%%` (escape `%` as `%`) or newlines. Notice: "Moved to
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
  the file is a chapter — use `editorInfoField` to get the file): a high-precedence
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
