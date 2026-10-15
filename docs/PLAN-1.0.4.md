# Escrita 1.0.4, "start a new work": implementation plan

The plan for SF 14 ("New work…", "New short story", "New book") and IMPROVEMENTS 33 (path
helpers in core), written 2026-10-15 on `main` at `afe1492` (1.0.3). **Approved 2026-10-15:** every question as recommended (G0). Mockups: boards 41 and
42 on the design canvas, approved 2026-10-15. The waves run as workflows, on branch `1.0.4`.

**Goal:** from the command palette or the home note, a writer picks "short story" or
"book", types a title, and is in the prose of a note that is already a work in the draft
stage.

**Stage served:** idea and draft. **Upkeep for the writer:** none. The templates are built
in, and a note of the writer's own replaces one only when a setting points to it.

## Decided with the author (2026-10-14 and 15)

- A conto is one note, never a folder.
- Built-in templates, each replaceable by a note named in settings.
- A new conto's `target` and `deadline` start blank. A new book's `goal` starts blank too,
  instead of 80,000 (`NEW_BOOK_GOAL`). This changes "Create a book" and goes in the changelog.
- "New work…" opens a list (Short story, Book). "New short story" and "New book" skip it.
  "New book" keeps the command id `create-book`.
- The home block has a footer line, "+ New short story · + New book", always shown. "New
  book" is hidden when the outline is off, both there and in the list.
- The board details: one beat in the conto ("What happens first"), "Premise" and
  "Characters" in the book note, the draft word added to a template without status, the
  built-in template used (with a notice) when the named note is missing.

## Open questions, with recommended answers

| # | Question | Recommended answer |
|---|---|---|
| Q1 | Who owns the commands? | **A new core module, `src/new-work/`** (`CoreModule`, like setup). Starting a work is not a feature to switch off. A conto needs no feature at all, and a book needs only the core services (`books`, `chapterOps`, `notes`). The outline's `createBook`/`makeBook` and `CreateBookModal` move there. The module registers `create-book` itself, with a `checkCallback` that is true only while the outline is on, so the id and writers' hotkeys stay. The outline keeps only "open the outline beside it" after creating, through `features.isOn("outline")` and `plugin.outline.openOutline`. |
| Q2 | How does the desk call it without importing a module folder? | **A core port, `core/new-work.ts`**: `type NewWorkKind = "story" \| "book"` and `interface NewWorkStarter { start(kind?: NewWorkKind): void; offers(kind): boolean }`. `plugin.newWork` is typed by it. The desk's footer and the outline view's empty-state "Create" button (`outline/view.ts:448`) call `plugin.newWork.start("book")`. With no kind, it opens the list. |
| Q3 | Defaults for the two folder settings? | **Empty**, meaning the active note's folder, as "Create a book" does today. Setup writes the folders it already creates (`SETUP_NAMES.storiesFolder` / `booksFolder`, `setup/plan.ts:221-222`) into the new settings, so a set-up vault gets "Stories"/"Contos" and "Books"/"Livros" with no new setup question. They are not `WORD_KEYS`: a language default that names a folder setup never made would put contos outside the track folders. |
| Q4 | A new work outside the track folders? | **Create it, then a notice:** "“O afogado” is outside the track folders, so goals don't count it." with an "Open settings" button (`editor/template-insert.ts` has the pattern). The work still has its status; the draft status on new notes is not needed, since the template writes it. |
| Q5 | Where do the settings rows go? | **The books slot** (`settings-tab.ts` `booksItems`, `feature: null`, always drawn), as a new group "New works" / "Novas obras" after the chapter rows. `SETTING_FEATURES`: the story rows `"always"`, the book rows `["outline"]`. Folder rows use `folderRow`. Template rows are `textRow`s with a new note suggest. |
| Q6 | Suggest classes | **`src/ui/suggest.ts`**: `FolderSuggest` moves out of `outline/modals.ts` (private today), plus a new `NoteSuggest` (`AbstractInputSuggest<TFile>`, Markdown files by path). The list is a `SuggestModal<NewWorkKind>` in the module. |
| Q7 | The book's first chapter | Without a chapter template, `createChapterAt(book, 0, untitled, beat)` gets the built-in beat as its body. With one, the template decides and nothing is added. The cursor goes to the end of the chapter. |
| Q8 | How far does candidate 33 go? | **`core/paths.ts`** (`parentOf`, `baseName`, `noteName`, `withMd`, `cleanFolder`, `joinPath`, `isUnder(path, folder, { emptyMatches })`), with the edge cases pinned in a test first. Adopted in the new module and at the six `parentOf` copies, `scope.ts`'s `withMd`/`noMd`, the case-sensitive `.md` strip in `outline/rows.ts:81`, and export's `inFolder` join (renamed `joinPath`). `cleanFolder` keeps today's rule (trim, edge slashes); the `\` rule of `classify.ts:232 folderRoot` stays where it is. Not changing behavior for `\` input is on purpose. The other 20-odd trim copies are left for later, listed in IMPROVEMENTS. |

## The design

### `core/new-work.ts` (port, no Obsidian imports)

`NewWorkKind`, `NewWorkStarter`, and `newWorkOf(plugin)` if a helper reads better than the
field. Nothing else.

### `src/new-work/` (core module)

- `model.ts`, pure, tested:
  - `storyNoteText(s, texts)`: frontmatter `status` (draft word), the form property with
    `formValues.shortStory`, a blank target and deadline, then `%% beat: <texts.beat> %%`
    and an empty line. Property names come from settings (rule 6).
  - `bookNoteText(s, texts)`: `status`, a blank goal and deadline, then the two headings,
    each with its `%% <hint> %%`.
  - `fromTemplate(template, vars, s)`: `renderTemplate`, then the draft status added with
    `withProperty` (`core/chapter-plan.ts`) when the template has none.
  - `cursorAfterBody(text)`: the offset at the end, on its own line.
  - `targetPath(folder, title)` through `core/paths.ts`, and `safeFileName`.
- `modals.ts`: `NewWorkList` (`SuggestModal<NewWorkKind>`, each kind with the grey line
  "A note in Contos/" or "…in the active note's folder"), and `NewWorkModal` (title, folder
  with `FolderSuggest`, the template line, Create). `CreateBookModal` is removed.
- `index.ts`: `NewWorkModule extends CoreModule`, implements `NewWorkStarter`. Commands
  `new-work`, `new-short-story`, `create-book` (`checkCallback`: outline on). `createStory`
  and `createBook` (today's `makeBook`, moved): `notes.create(…, { exists: "fail" })`, open
  the file, set the cursor, then the untracked notice (Q4) and, for a book, the outline.
- `strings.ts`, registered in `main.ts` and `tests/strings.test.ts`.

### Desk

`render.ts` `paint()`: a `footer(root)` after `counts` (`render.ts:162`), outside
`counts()`, which returns early on an empty bar. The buttons use the block's delegated
actions (`KEY` attributes `new:story`, `new:book`), and "book" is drawn only when
`plugin.newWork.offers("book")`. CSS in `desk/styles.css`, the counts' grey, 32px targets,
wrapping at phone width.

### Settings

`storiesFolder`, `storyTemplate`, `booksFolder`, `bookNoteTemplate` in `EscritaSettings`,
empty by default, normalized like `templatesFolder` (`settings.ts:328`). Rows in the books
slot (Q5). Setup's run writes the two folders when it creates them.

### Tests

- `tests/new-work-model.test.ts`: both built-in notes classify (a work in the draft stage,
  the form, no piece while the target is blank), with English and custom property names; a
  template without status gets the draft word, one with status keeps it; the cursor offset.
- `tests/paths.test.ts`: every helper's edge cases, before any adoption.
- `tests/lifecycle-new-work.test.ts`: the three commands exist with the outline off and on,
  `create-book` is offered only with the outline on, and `tests/lifecycle-outline.test.ts`
  drops `create-book` from its list.
- `tests/outline-new-book.test.ts` moves to the model test (blank goal).
- Settings: the four rows, their visibility, and that setup writes the folders.
- The desk footer gets the first DOM test of `DeskBlock` (footer shown with and without
  works, "book" hidden when not offered, click calls `start`).

## Gates

- **G0** (before Wave 0): the questions answered. **Passed** 2026-10-15: all as recommended.
- **G1**: the boards approved. **Passed** 2026-10-15 (boards 41 and 42).
- **G2** (before release): the by-hand checks below, in the author's Obsidian.

## Waves

The usual rules: Sonnet for the code, Opus for the contracts and the judge; worktrees made
in the main loop, each task committing; heavy checks behind `flock`, vitest with
`--maxWorkers=4`.

**Wave 0, contracts (Opus, main loop, one commit).** `core/new-work.ts`; `core/paths.ts`
with `tests/paths.test.ts`; `src/ui/suggest.ts` (`FolderSuggest` moved, `NoteSuggest`);
the four settings keys with defaults, normalizing and `SETTING_FEATURES`; `plugin.newWork`
in `main.ts`, wired to a stub `NewWorkModule` whose `start` does nothing yet; the
`new-work.*` strings file with every key in both languages.

**Wave 1 (Sonnet, four tasks in parallel, one owner per file):**

| Task | Owns |
|---|---|
| A, the module | `src/new-work/*`, `src/outline/index.ts`, `outline/modals.ts`, `outline/new-book.ts` (removed), `outline/view.ts:448`, tests `new-work-model`, `lifecycle-new-work`, `lifecycle-outline`, `outline-new-book` (removed) |
| B, the desk footer | `src/desk/render.ts`, `desk/styles.css`, `desk/strings.ts`, the new `DeskBlock` test |
| C, settings and setup | `src/settings-tab.ts` (`booksItems`), `src/strings.ts` (`settings.*`), `src/setup/plan.ts`, `setup/apply.ts`, tests `settings-core-rows`, `settings-tab`, the setup plan tests |
| D, paths adoption | `core/classify.ts`, `core/scope.ts`, `snapshots/store.ts`, `snapshots/fs.ts`, `placeholders/logic.ts`, `universe/migrate-plan.ts`, `export/logic.ts`, `outline/rows.ts`; their tests unchanged and green |

**Judge (Opus):** the diff against this plan and the boards, the four checks, and that no
module folder imports another.

**Wave 2, release (Sonnet, then an Opus review):**

- User guide, English and pt-BR: "Getting started" (the first conto and the first book
  through "New work…"), "Writing" (the templates, the four settings).
- README: the feature line and the changelog, with the note on the book's blank goal.
- `docs/ARCHITECTURE.md`: the new core module and port. `CONTEXT.md`: the 1.0.4 line.
- `docs/IMPROVEMENTS.md`: 33 to "Done", with the trim copies left as a loose end.
- `docs/ROADMAP.md` and SF 14: shipped.

## Results

- **Wave 0** (contracts, 2026-10-15): `core/new-work.ts` (`NewWorkKind`, `NEW_WORK_KINDS`,
  `NewWorkStarter`); `core/paths.ts` with `tests/paths.test.ts` (adopted nowhere yet);
  `src/ui/suggest.ts` (`FolderSuggest` moved from `outline/modals.ts`, `NoteSuggest`); the
  settings `storiesFolder`, `storyTemplate`, `booksFolder`, `bookNoteTemplate` (empty,
  folders through `cleanFolder`; `SETTING_FEATURES`: stories `"always"`, books
  `["outline"]`) and their row strings (`settings.newWorks`, `settings.<key>[.desc]`);
  `src/new-work/strings.ts` (every `new-work.*` key, both languages, in the parity test);
  `plugin.newWork`, a stub `NewWorkModule` started after setup (`start` does nothing yet,
  `offers("book")` follows the outline). The 0.9 G3 fixture gains the four keys, empty.
  Checks: typecheck, 3,452 tests, build, bundle test and lint pass.
- For Wave 1: the desk's footer strings are `desk.new.story` and `desk.new.book` (Task B
  adds them, "+ New short story" / "+ Novo conto"). Task A keeps `outline.command.createBook`
  and `outline.create.*` only while something still reads them, and removes them with the
  code that does.

- **Wave 1** (2026-10-15): A `d97bc9a` (the module), B `04fdda2` (the desk footer), C
  `35128a6` (settings and setup), D `c424b98` (paths adoption), merged in the order D, A, B,
  C. The Opus judge passed D, and A, B and C with fixes, all applied:
  - A1: with no folder setting and a chapter open, the default folder is the one beside the
    book (`defaultFolderFor`, `new-work/model.ts`), so a new work never lands in a chapters
    folder. A2: the book check also compares the book's note. A3: only a `ChapterError`
    "exists" shows the exists notice. A4: pt-BR "então não conta para as metas". A5: a file
    in the way of the book's folders stops before anything is written (`fileInTheWay`).
  - B1: the home block redraws when the outline is switched.
  - C1: "New works" is its own slot in `core/settings-order.ts`, after the writing day.
  - Answers: new works don't go through `draftNewNotes` (they always start as drafts); no
    rollback after a partial book create (A5 prevents it); setup writes the folder settings
    under its "folders" tick.
  - Also: the book goal starts blank (`NEW_BOOK_GOAL` is gone; changelog); `create-book` is
    registered by new-work; the outline's `createBook`, `CreateBookModal`, `new-book.ts` and
    their strings are removed; `ui/settings-rows` has a `suggest` option; the list and notice
    reuse `escrita-template-path` and `escrita-notice-button` (editor CSS); `outline/rows.ts`
    strips ".md" in any case.
  - For Wave 2: three test-only re-export aliases remain (`export/logic.ts` `inFolder`,
    `placeholders/logic.ts` `parentPath`, `universe/migrate-plan.ts` `basename`/`dirname`),
    plus the other slash-trim copies (IMPROVEMENTS 33 loose end). G2 adds: the template line
    is a disabled field (check against board 41); the footer follows the outline switch.
  Checks after the fixes: typecheck, 3,488 tests, build, bundle test and lint pass.

- **Wave 2** (docs, 2026-10-15): "Getting started", "Writing" and "Features and settings"
  (English and pt-BR) describe starting a new work, the footer and the "New works" settings;
  README (feature line, `1.0.4 (unreleased)` changelog with the upgrade note), ARCHITECTURE
  (the new-work core module and port, `core/paths.ts`, `ui/suggest.ts`, the shared CSS
  classes), IMPROVEMENTS (33 in "Done", the aliases and trim copies as a loose end), ROADMAP
  (1.0.4 under "Shipped", unreleased; next is 1.1), SF 14 and CONTEXT. The Opus review fixed
  the default-folder wording (any note of a book, the root with no note open), dropped a wrong
  claim that goals ignore a work without a target, and fixed pt-BR agreement. After it: the
  setup's box table gained the **Folders** box (it covers the new folders, "Folders that
  count" and the two new settings; the old "rows without a box are the folders" was wrong),
  and the two folder settings' descriptions give the full empty-folder rule.

## By-hand checks (G2, the author's vault `~/projects/website/escrita/`)

1. Ctrl+P, "Nova obra…": the list shows Conto and Livro with where each goes.
2. Conto: type a title, Enter. The note opens in the stories folder with status, form,
   blank target and deadline, the beat, and the cursor under it. It shows in "Escrevendo".
3. The same title again: the notice, nothing changed.
4. Livro: the folder, the chapters folder, the book note with its headings, the first
   chapter open with the cursor after the beat, the outline beside it.
5. Turn the outline off: "Livro" leaves the list and the footer; "Novo livro" leaves the
   palette.
6. Set "Modelo de conto" to a note with `{{title}}` and no status: the title is filled and
   the status is added. Point it at a missing note: the built-in one, with the notice.
7. A stories folder outside the track folders: the notice with "Open settings".
8. The home block footer: both buttons open the modal directly; light and dark themes.
9. At phone width (`app.emulateMobile(true)`): the footer wraps, targets are 32px or more.

## Risks

- **Moving `create-book`.** A command id registered by a different module is the same id
  to Obsidian, but the lifecycle tests pin who registers what. Task A owns both tests.
- **The outline view's "Create" button** now goes through the port; the view is one of the
  large, untested files (IMPROVEMENTS 5). The change is one line.
- **Path adoption** touches classification and snapshots, where a changed edge case would
  move data. The pinned tests come first (Wave 0), and Task D keeps every existing test green
  without editing it.
- **Mobile.** The modal and the footer use Obsidian's own `Modal`, `SuggestModal` and
  `Setting`; mobile is assumed to work (no phone to test on).

## Not in this plan

- Other kinds in the list (essay, collection, screenplay). The list is built from
  `NewWorkKind`, so 1.1's screenplay can add one.
- A folder per conto.
- A setup question for the stories folder (Q3: setup writes what it already creates).
