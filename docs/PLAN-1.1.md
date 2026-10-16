# Escrita 1.1, "screenplays": implementation plan

The plan for screenwriting phase 1 (SP 1, SP 6: Fountain notes, Fountain and PDF export),
IMPROVEMENTS 46 (export writers share the title page; the modal splits), the five known issues,
and an end-to-end check harness that drives Obsidian with Playwright, so the by-hand checks run
by themselves. Written 2026-10-16 on `main` at `6ed0efd` (1.0.4). **Approved 2026-10-16:** every
question as recommended (G0), including copying the author's vault into the run folder for G2c.
Boards 43 and 44 approved 2026-10-16 (G1). The waves run as workflows, on branch `1.1`.

**Goal:** a writer marks a note as a screenplay, writes it in plain Fountain, and exports a PDF
in industry format (and a `.fountain` file) that a contest or producer accepts. Separately,
every check that a person used to run by hand in Obsidian is a script Claude can run.

**Stage served:** draft and submitting. **Upkeep for the writer:** none beyond the form
property (or a folder mapped to the screenplay form).

## Decided with the author (2026-10-16)

- Screenwriting next, for one of the author's users. Phase 1 as written: Fountain in a note,
  then an industry-format PDF and a `.fountain` file. No editor layout (SP 2) in 1.1.
- The PDF is checked against public samples: Fountain's own sample scripts, plus a short
  Portuguese script written as a fixture.
- Two page presets, US Letter by default and A4; the "more" and "continued" labels follow the
  install's language (`(MORE)`/`(CONT'D)`, `(MAIS)`/`(CONT.)`).
- 1.1 also fixes the known issues and closes the open checks.
- A Playwright harness runs the checks in a real Obsidian. The scripts that made the 1.0 demo
  GIFs are lost, so it is rebuilt from scratch and lives in the repo this time.

## Open questions, with recommended answers

| # | Question | Recommended answer |
|---|---|---|
| Q1 | Where does a note's form live? It is read only inside the universe today (`universe/works-list.ts:53` `formFor`), so a screenplay would be invisible with the universe off. | **Move it to core, as a field.** `core/form.ts` gets `FORM_KINDS`, `FormKind`, `formOf`, `formFor`, `parseFormFolders` (moved from `universe/settings.ts:10` and `works-list.ts`), and `books.classify(x)` gains `form: FormKind \| null`, as `scope` did in 0.9 (the growth rule). The settings keys (`formProperty`, `formValues`, `formFolders`) keep their names, so `data.json` needs no migration. The three form rows move from the universe section to the books slot (always drawn), since forms now matter without the universe. The universe reads `classify().form` instead of calling `formFor`. |
| Q2 | A new feature module for screenplays? | **No, not in 1.1.** Rule 3: there is nothing to switch on. A screenplay is a form value (`screenplay`, pt `roteiro`, the seventh `FORM_KINDS` entry), and its export is two formats in the export module. The parser and the page rules are pure core files. Phase 2 (editor layout) brings `src/screenplay/` and its switch; the feature count stays 19 now. |
| Q3 | How does export pick formats for a screenplay? | **By the source's form.** A single note whose form is `screenplay` offers PDF and Fountain (PDF first) and none of the prose formats; every other source is unchanged. A book or collection with screenplay notes inside exports as prose, as today (feature-length scripts are phase 3, SP 7). `ExportFormat` gains `"pdf"` and `"fountain"`; the ternary at `export/index.ts:397` becomes a small table of writers by format, each with its own preset kind. |
| Q4 | Settings for screenplays: where, and how many? | **One "Screenplays" group in the export section**, shown while export is on: scene heading prefixes, transition endings, page size (Letter, A4), scene numbers in the PDF (off), the more and continued labels, and the title page property names (`credit`, `author`, `source`, `draftDate`, `contact`). The time-of-day words and the editor font wait for phase 2 (they serve the suggestions and the layout, not export). Every word is a setting with English defaults and pt-BR defaults through `core/defaults.ts` (rule 6). |
| Q5 | Fountain notes and Obsidian links | **As SP 1 says.** `[[…]]` stays a link and is exported as its link text; `%% … %%` are Escrita's notes and are dropped from the PDF. In the `.fountain` file they become `[[…]]` notes only when "Keep notes" is ticked in the modal (off by default). Boneyard (`/* … */`) is read by the Fountain parser, since `segment()` doesn't know it. |
| Q6 | Where Fountain and Markdown disagree | **The screenplay wins inside a screenplay note.** `#` is a section, `>` a transition or centered text, `_x_` is underline, and a `---` line is action (`segment()` doesn't mark indented code, `core/markdown.ts:36`, so nothing is lost). **Indents reversed 2026-10-16:** the author chose to follow the Fountain spec and what other tools do ("Indenting": leading tabs and spaces are ignored outside action), so an indented line that is another element is read as that element; only action keeps its indent. Each case is pinned in `tests/fountain.test.ts`, next to the existing parity tests. |
| Q7 | Characters outside Courier's WinAnsi encoding (emoji, `ő`, non-Latin) | **The preview lists them before export, and the PDF prints `?` in their place.** Never silently dropped: the list has the line of each one, like placeholders. Portuguese (`ã ç é —`, curly quotes, `…`) is all in WinAnsi. |
| Q8 | Character cues in "Appears in" (SP 1) | **Yes, small.** In a screenplay note, `computeMentions` (`universe/mentions.ts:14`) adds each cue (`JOÃO`, extension like `(V.O.)` removed) as an occurrence when it folds to an entry's name or alias (`foldName`). The `NoteMentions` shape is unchanged; the mentions index passes the note's `form`. |
| Q9 | Title page | **From the note's properties** (title = the note's title; the other five property names are settings), with a Fountain `Title:` block at the top read as a fallback for pasted scripts. Built through improvement 46's `titlePageOf`, so it is not a fifth copy. |
| Q10 | The reference for "same page breaks" | **Afterwriting's CLI as a dev-only reference** (MIT, offline, `npx afterwriting`), never bundled, plus fountain.io's published PDF of *Brick & Steel* where its sample terms allow it in `tests/fixtures/`. A dev script exports each fixture both ways and compares the page count and the first line of every page; differences are listed and each one is decided (theirs or ours), then pinned in `tests/screenplay-pages.test.ts`. If a sample's terms don't allow copying it into the repo, it stays a local fixture, git-ignored, like `reports/`. |
| Q11 | Which improvement? | **46**, because the two new writers sit right on its seam: `titlePageOf(doc, preset)` and `minHeadingOf(doc)` go into `core/export-pipeline.ts`, `writers/xml.ts` is split out of `docx.ts`, and the four small dialogs move out of `export/modal.ts` (714 lines) to `export/dialogs.ts`, so there's room for the PDF options. **Plus the five known issues** (IMPROVEMENTS, "Known issues") and the loose end of test-only aliases from 33. |
| Q12 | The open checks | **Automate the ones a script can see; close G0d (0.7) as decided.** Every by-hand step in TEST-1.0 (G2a, G2b, presets, writing mode without a third-party theme, the release-candidate fixes, the demo findings), the 1.0.4 G2 list and TEST-0.9's feature sections become specs. 0.9's G0d ("Read the book" timings on a 30-chapter book) is measured by a spec and written down. 0.7's G0d is closed as "Reading view shows the panel only, no post-processor" (the Q34 fallback that shipped). What needs an eye (matching a board, looks right in light and dark) gets a screenshot in the report, so the author reviews pictures instead of clicking through. G2c (the author's real vault) runs against a copy in the harness's run folder, never the vault itself. |
| Q13 | How does the harness reach Obsidian? | **Attach over the DevTools protocol.** `flatpak run md.obsidian.Obsidian --user-data-dir=<run>/profile --remote-debugging-port=<port>` starts a second Obsidian with its own profile (so the author's open Obsidian and its vault list are untouched); Playwright's `chromium.connectOverCDP` attaches to it. The profile's `obsidian.json` is written beforehand with one vault: a fresh copy of a fixture vault, with Escrita's three built files copied in. The flatpak shares the host network and the home folder, so the run folder is `~/.cache/escrita-e2e/` (flatpak can't see the host's `/tmp`). Wave 0's spike proves it, and also tries Electron's headless mode so a run doesn't take over the screen. |
| Q14 | How is it run, and where? | **`npm run e2e`, local only, one Obsidian at a time** (`workers: 1`, the author's machine has limited resources). It is not in CI, since CI has no flatpak Obsidian. Specs in `e2e/specs/`, helpers in `e2e/lib/` (launch, attach, run a command by id, read `app` state through `page.evaluate`, read files in the vault copy, take a screenshot). Fixture vaults are built by `e2e/fixtures/*.ts` (the Python generator in TEST-0.9:163 becomes one of them). The Playwright HTML report holds the screenshots for the eye checks. `@playwright/test` is a dev dependency only; `main.js` doesn't change, and `tests/no-network.test.ts` still scans only `src/` and `main.js`. |

## The design

### Core, no Obsidian imports

- **`core/form.ts`** (Q1): the form kinds, with `screenplay` added, and `formFor`. `classify.ts`
  gives `form` on every result, read from frontmatter and the form-by-folder lines.
- **`core/fountain.ts`** (SP 1): `parseFountain(text, md, opts) → Script`. A `Script` is the
  title page fields and a list of elements: `scene` (with an optional scene number), `action`,
  `character` (name, extension, `dual`), `parenthetical`, `dialogue`, `lyric`, `transition`,
  `centered`, `pageBreak`, `section` (depth), `synopsis`, plus each element's source line and
  its inline styles (bold, italic, underline). Forced elements (`.`, `!`, `@`, `>`, `~`) as in
  the spec. `opts` carries the scene heading prefixes and transition endings from settings. It
  runs on `segment()`'s result: frontmatter and `%%` spans are skipped, boneyard is its own.
- **`core/screenplay-pages.ts`** (SP 6): `paginate(script, layout) → Page[]`, pure arithmetic on
  lines and columns. Courier 12 is 10 characters per inch and 6 lines per inch. The layout
  gives each element's left and right columns and the lines per page (55). Rules: a scene
  heading never ends a page; dialogue splits at a sentence end with the more label at the
  bottom and `NAME (continued label)` at the top; a parenthetical never ends a page; a
  transition stays with the scene before; the page number top right from page 2; the title
  page unnumbered. Dual dialogue sits side by side and never splits.
- **`core/pdf.ts`**: a small PDF 1.4 writer: objects, the xref table, one content stream per
  page, the base-14 Courier, Courier-Bold and Courier-Oblique with WinAnsi encoding (no font
  embedded). `pdfOf(pages, meta) → Uint8Array`. It knows nothing about screenplays, so a
  later prose PDF could reuse it.
- **`core/screenplay-presets.ts`**: `ScreenplayPreset` (page size, margins in points, element
  columns, labels, scene numbers) with `LETTER` and `A4`; the labels come from settings.
- **`core/export-pipeline.ts`** (46): `titlePageOf(doc, preset)` and `minHeadingOf(doc)`; the
  writer type allows a per-format preset kind, so the screenplay writers don't pretend to take
  a prose `Preset`.

### Export (`src/export/`)

- `writers/xml.ts` (46, from `docx.ts`), `writers/fountain.ts`, `writers/pdf.ts` (parse,
  paginate, `pdfOf`).
- `index.ts`: the writer table (Q3); file names `<title>.fountain` and `<title> (Letter).pdf`
  / `(A4).pdf` through `exportFileName`.
- `dialogs.ts` (46): `ChaptersModal`, `WhereModal`, `ExistsModal` moved out of `modal.ts`.
- `modal.ts`: for a screenplay, the format chips are PDF and Fountain, the preset is Letter or
  A4, "Scene numbers" and "Keep notes" (Fountain only) are checkboxes, and the preview shows
  the page count, the first page and the characters Courier can't print (Q7). Boards first (G1).
- The export section's "Screenplays" group (Q4), in the module's `settings-ui.ts`.

### Universe

- Reads `classify().form` (Q1); its form rows move to the books slot.
- Character cues in mentions (Q8).

### Known issues (from IMPROVEMENTS, "Known issues", lines as of 6ed0efd)

1. Beat click and the restored cursor (`outline/view.ts:1531-1538`, `ui/open-work.ts:55`):
   a harness spec checks it first; fix it only if the cursor lands wrong (with the part of
   candidate 34 it needs).
2. "Appears in" chapter numbers (`universe/appears-in-model.ts:43`) use `core/book.ts`'s parser.
3. The cover property is read like `Compile:`, ignoring case (`export/index.ts:265` through
   `core/book-source.ts` `propertyValue`).
4. `templatesFolder` and `globalDarlingsNote` follow renames (two data followers through
   `plugin.index.follow`).
5. `submissionsOffNotice` passes the language (`submissions/settings-ui.ts:45`).

Plus the test-only aliases (`export/logic.ts` `inFolder`, `placeholders/logic.ts` `parentPath`,
`universe/migrate-plan.ts` `basename`, `dirname`): their tests import `core/paths.ts`, and the
aliases go.

### The harness (`e2e/`)

- `e2e/lib/obsidian.ts`: start Obsidian with a fresh profile and vault copy, attach, wait for
  the workspace layout to be ready, close and clean up (always, even when a spec fails).
  Community plugins are switched on in the profile beforehand, so restricted mode never asks.
- `e2e/lib/app.ts`: `command(id)`, `openFile(path)`, `setting(key, value)`, `readVaultFile`,
  `cursor()`, `emulateMobile(on)`, `longTasks()` (the `PerformanceObserver` from TEST-0.9).
- `e2e/fixtures/`: `empty-pt`, `empty-en`, `writer` (the test vault's shape), `long-book`
  (30 chapters, about 90k words), `screenplays` (the Fountain samples, a Portuguese short).
- `e2e/specs/`: one file per old test page section (`setup.spec.ts`, `writing-mode.spec.ts`,
  `new-work.spec.ts`, `reader.spec.ts`, …) and `screenplay.spec.ts` for 1.1's own checks.
- `docs/TESTING.md` (new): how to run it, what it covers, what it doesn't (phone, third-party
  themes), and how to add a spec. TEST-0.9.md and TEST-1.0.md keep a pointer at the top to the
  spec that replaced each section; the steps that stay by eye are listed there.

### Tests (vitest)

- `tests/form.test.ts`: `formFor` moved unchanged (the old universe tests point at it), and
  `classify().form` with the universe off.
- `tests/fountain.test.ts`: the spec's examples, Portuguese transitions and accented cues,
  forced elements, boneyard, the Markdown disagreements (Q6).
- `tests/screenplay-pages.test.ts`: each page rule on a small script, and the decided
  reference differences (Q10).
- `tests/pdf.test.ts`: the file parses (header, xref offsets match, `%%EOF`), WinAnsi bytes for
  Portuguese, `?` for the rest.
- `tests/export-*.test.ts`: the format table, file names, the Fountain writer round trip
  (parse the written file, get the same elements).

## Gates

- **G0** (before Wave 0): the questions answered. **Passed** 2026-10-16: all as recommended.
- **G1** (before the export UI in Wave 2): the boards for the screenplay export modal and the
  "Screenplays" settings group approved on the design canvas. **Passed** 2026-10-16: boards 43 (exporting a
  screenplay: the modal, Fountain, the warnings, the PDF preview) and 44 (the note, the
  "Screenplays" group in Export, the Forms rows in the books slot).
- **S0** (Wave 0, the harness spike): a script starts the flatpak Obsidian with its own profile,
  attaches, loads Escrita in a vault copy, runs `escrita:new-work`, reads the modal's DOM, takes
  a screenshot and quits, leaving the author's Obsidian and config untouched. It also says
  whether headless works. If attaching fails, the fallback is unpacking Obsidian's asar (as in
  CLAUDE.md) and launching it with Playwright's `_electron` and an Electron of the same
  version; the spike reports which one works before the harness is built on it.
- **G2** (before release): `npm run e2e` green, the screenshots reviewed by the author, the
  reference comparison (Q10) with every difference decided, and a PDF from the author's user
  opened in a PDF reader.

## Waves

The usual rules: Sonnet for code, tests and docs, Opus for the contracts, the judge and every
architecture call; worktrees made in the main loop, each task committing on its branch; heavy
checks behind `flock`, vitest with `--maxWorkers=4`. Only one Obsidian runs at a time, so the
harness tasks run their specs under the same lock.

**Wave 0, contracts and the spike.**

- Opus, main loop, one commit: `core/form.ts` and the `form` field (moved code, no behavior
  change except `screenplay`); the `Script` and element types in `core/fountain.ts` (types and
  a stub); `ScreenplayPreset`; the writer table's type; the new settings keys with defaults
  and normalizing; every new string in both languages.
- Sonnet, in parallel: S0, in `e2e/spike/` (removed when Wave 1 builds the harness).

**Wave 1 (Sonnet, five tasks in parallel, one owner per file):**

| Task | Owns |
|---|---|
| A, improvement 46 | `core/export-pipeline.ts` (`titlePageOf`, `minHeadingOf`), `export/writers/{docx,markdown,epub,preview,xml}.ts`, `export/dialogs.ts`, `export/modal.ts` (the move only), `export/logic.ts`; export tests unchanged and green |
| B, the parser | `core/fountain.ts`, `tests/fountain.test.ts`, `tests/fixtures/fountain/` |
| C, pages and PDF | `core/screenplay-pages.ts`, `core/pdf.ts`, `core/screenplay-presets.ts`, their tests, the reference script `scripts/compare-screenplay.mjs` (dev only) |
| D, known issues | the files in "Known issues" above and their tests, except issue 1 (it waits for the harness) |
| E, the harness | `e2e/**`, `playwright.config.ts`, the `e2e` script in `package.json`, `docs/TESTING.md`; first specs: 1.0.4's G2 list and TEST-1.0's G2a and G2b |

**Judge (Opus):** the diff against this plan, the four checks, `npm run e2e` once, and that no
module folder imports another.

**Wave 2 (Sonnet, after G1):**

| Task | Owns |
|---|---|
| F, export integration | `export/index.ts`, `export/modal.ts`, `export/writers/{fountain,pdf}.ts`, `export/settings-ui.ts`, `export/strings.ts`, export tests |
| G, form and universe | `universe/*` (reads `classify().form`, cues in mentions), the form rows in the books slot (`settings-tab.ts`), their tests |
| H, the rest of the checks | `e2e/specs/*` for the remaining TEST-1.0 and TEST-0.9 sections, 0.9's G0d measured, known issue 1 checked (and fixed in `outline/view.ts` if it fails), `screenplay.spec.ts` once F lands |

**Judge (Opus)**, as in Wave 1, plus the reference comparison with each difference decided.

**Wave 3, release (Sonnet, then an Opus review):**

- User guide, English and pt-BR: a new `screenplays.md` (write a screenplay in a note, the
  form, the export, the settings), and "Publishing" points to it.
- README: the feature line, the changelog (the form rows' new place is an upgrade note).
- `docs/ARCHITECTURE.md`: `core/form.ts`, the Fountain and PDF files, the writer table, the
  harness. `CONTEXT.md`: the 1.1 line, `form` in the classifier, the harness in "Working
  process".
- `docs/IMPROVEMENTS.md`: 46 and the known issues to "Done". `docs/ROADMAP.md`, SP 1 and SP 6:
  shipped; G0d's numbers and the closed 0.7 G0d written down; "Still open after 1.0" cleared.

## Results

### Wave 0 (2026-10-16)

**Contracts (Opus, main loop).**

- `core/form.ts`: the form rule moved from `universe/settings.ts` and `universe/works-list.ts`
  (`formOf`, `parseFormFolders`, `formFor`, `formValuesText`, `parseFormValues`), with
  `screenplay` as the seventh kind (`screenplay`, pt-BR `roteiro`). `universe/settings.ts`
  re-exports `FORM_KINDS` and `FormKind`. `classify()` gives `form` on every placement (null
  for anything but a Markdown file), read for any kind and stage. The three form keys are
  optional on `ClassifySettings` and are part of `classifyKey`. A forms text saved before 1.1
  (six words) keeps the screenplay word. Tests: `tests/classify-form.test.ts`.
- `core/export-formats.ts`: `ExportFormat` (now with `pdf` and `fountain`, re-exported from
  `data.ts`), `PROSE_FORMATS`, `SCREENPLAY_FORMATS`, `formatsFor({ single, form })`.
- `core/fountain.ts`: the `Script` model, `TitlePage`, `FountainOptions`, `fountainOptions(s)`,
  and a `parseFountain` stub for task B.
- `core/screenplay-presets.ts`: `ScreenplayPreset`, Letter (55 lines) and A4 (58 lines, a first
  guess for task C to check), `screenplayPreset(id, settings)`.
- Settings: `screenplaySceneHeadings`, `screenplayTransitions`, `screenplayPage` (`letter`),
  `screenplaySceneNumbers` (off), `screenplayMore`, `screenplayContinued`, `screenplayCredit`,
  `screenplaySourceProperty` (`source`), `screenplayDraftDateProperty` (`draftDate`), all behind
  the export switch. The transitions and the three labels are word keys: pt-BR has `TO:, PARA:`,
  `(MAIS)`, `(CONT.)`, `Roteiro de`, and the setup shows them in its language step.
- **Deviation from Q4:** the title page's author and contact use the export settings that already
  exist (`authorProperty`, `authorName`, `contactLines`) instead of three more property names.
  Only the credit line (text), the source and the draft date are new.
- Strings: the two format names and the "Screenplays" settings group, in both languages. The
  modal's strings wait for the boards (G1) and come with task F.
- Fixtures: the 0.9 expected settings and the two setup fixtures gained the new keys and rows;
  `tests/export-logic.test.ts` used `pdf` as an unknown format and now uses `rtf`.

**S0, the harness spike (Sonnet). Passed.**

- `flatpak run md.obsidian.Obsidian --user-data-dir=<run>/profile --remote-debugging-port=<port>
  --ozone-platform=headless` starts a second Obsidian with no window; the flatpak wrapper
  forwards the arguments. CDP is up in 0.5–1 s and the layout is ready in 0.8–1.5 s.
- The profile's `obsidian.json` opens the vault copy. Restricted mode is a localStorage key
  (`enable-plugin-<appId>`), so the harness calls `app.plugins.setEnable(true)` after the layout
  is ready, and Escrita loads without the trust prompt.
- `escrita:new-work` opens a `.prompt` (suggest), not a `.modal`. A fresh vault shows Escrita's
  setup notice; fixtures that don't test the setup pre-seed the plugin's `data.json`.
- A headless window starts at 200×150, so the harness sets a 1280×800 viewport.
- Cleanup: each launch adds two `flatpak ps` instances (the app and its sandbox); the harness
  kills only the new ids with `flatpak kill`. The author's `obsidian.json` hash was unchanged
  and their Obsidian kept running.
- Vault folders get unique names (`escrita-e2e-<id>`), since the author has a vault named `vault`.
- The spike is in `e2e/spike/` (`run.mjs`, `NOTES.md`); task E builds the harness on it and
  removes it.

### Wave 1 (2026-10-16)

Five tasks, merged into `1.1` in order with `--no-ff` (`59ddf92`, `6b58db1`, `8200ad0`, `1a96eaf`,
`5c8100b`). No conflicts: A and D touched different lines of `export/index.ts` and `logic.ts`.

**A, improvement 46 (`e6becab`).** `core/export-pipeline.ts` has `titlePageOf(doc, preset)`,
`bylineOf` and `minHeadingOf`; `EpubCover` moved there. DOCX, Markdown, EPUB and the preview use
them. `writers/xml.ts` holds `xmlEscape`, so `epub.ts` no longer imports `docx.ts`. `logic.ts`
has `headingFormat`, `ExportState` and `stateOfLast` (the copies in `modal.ts` and `index.ts` are
gone). The four dialogs are in `export/dialogs.ts`; `modal.ts` went from 714 to 576 lines. No
export expectation changed. New: `tests/export-title-page.test.ts`.

- `askExists` and `askWhere` stay in `modal.ts` as thin wrappers, because three lifecycle tests
  mock that module. Accepted.
- A's finding that `askChapters` has no caller is wrong: `modal.ts:346` calls it.

**B, the parser (`659a27c`).** `parseFountain` in `core/fountain.ts`, on `segment()`'s lines, with
boneyard, the title block, forced elements, dual dialogue and emphasis (`parseRuns`, exported for
the writers). An unclosed `/*` is text, a `---` line is action, so nothing is lost (Q6). 121 tests
in `tests/fountain.test.ts` and the Portuguese fixture `tests/fixtures/fountain/roteiro.md`. The
Wave 0 types are unchanged.

**C, pages and PDF (`3f97e65`).** `core/screenplay-pages.ts` (`paginate(script, preset)`, every
rule of SP 6), `core/pdf.ts` (PDF 1.4, the four base-14 Courier faces, WinAnsi, `?` for the rest)
and `core/screenplay-pdf.ts` (`screenplayPdf(script, titlePage, preset)` with `unsupported` for the
preview, Q7). A4 is 57 lines, as in Afterwriting's A4 profile. `scripts/compare-screenplay.mjs` is
the reference script (Q10). Tests: `screenplay-pages` (27), `pdf` (13), `screenplay-pdf` (8). The
fixtures are C's own (`tests/fixtures/screenplay/`): *Brick & Steel* has no stated license, so it
stays out of the repo and is read from Afterwriting's samples folder.

**D, known issues 2 to 5 (`ff18fcd`).** "Appears in" reads chapter numbers with `core/book.ts`
(`3Title` and `03) X` now have no number, like everywhere else). The cover property goes through
`propertyValue`. `templatesFolder` and `globalDarlingsNote` follow renames through
`dataFollowers()`, also while the feature is off. `submissionsOffNotice` passes the language. The
`inFolder`, `basename` and `dirname` aliases are gone.

**E, the harness (`27fd451`).** `e2e/lib/` (launch, restart, close, the `App` helpers, a setup
page object), `e2e/fixtures/` (`emptyPt`, `emptyEn`, `writer`), `new-work.spec.ts` (PLAN-1.0.4's
checks 1 to 9) and `setup.spec.ts` (TEST-1.0 G2a and G2b), `playwright.config.ts`, `npm run e2e`,
`docs/TESTING.md`. `e2e/spike/` is removed. `restart()` quits over CDP so the profile's
localStorage is kept.

**Judge fixes.**

- `core/export-pipeline.ts`'s new `TitlePage` clashed with `core/fountain.ts`'s `TitlePage` (the
  screenplay's). The prose one is now `ManuscriptTitle`.
- The last test-only alias went: `placeholders/view.ts` calls `parentOf` from `core/paths.ts`, and
  `placeholders/logic.ts` no longer exports `parentPath`. IMPROVEMENTS updated.
- E's finding 1, fixed: after the desk layout the universe panel came to the front of the left
  sidebar. In `setup/layout.ts` a `leftTab` step now opens inactive and is not revealed, so it
  stays behind the files. Test 7b no longer has `test.fail()` and passes.
- TEST-1.0's stale expectations now match the code: the settings row is "Abrir ao iniciar" /
  "Open on startup", the default goal is 1,000, the explorer shows the target in the tooltip.

**Decisions on the handoffs.**

- The screenplay title page (Wave 2, F): a pure function in the export module builds core/fountain's
  `TitlePage`. The title is the note's title. The author and contact lines use the same rule as
  prose (`titlePageOf(doc).contact`, from `authorProperty`, `authorName`, `contactLines`). Credit,
  source and draft date come from the settings' properties. The Title block fills only what is
  still empty (Q9).
- The Fountain writer (F) inverts the parser's rules: `@` for a mixed-case cue, `.` for a heading
  without a known prefix, `!` for action that reads as a cue or a transition. Its round-trip test
  parses what it writes.
- Dialogue splits only at a sentence end (SP 6). Kept. A long speech with no sentence end moves
  whole; the author confirms at G2.
- No automatic `(CONT'D)` when a character speaks again after action, and no `CONTINUED:` marks,
  in 1.1. Writers type the extension when they want it.
- Columns: ours stay the industry numbers (action 60, dialogue 35 from col 25, cue at col 37).
  Afterwriting's differ by one or two columns, which explains some of the page breaks below.
- Property reads in export: the cover and `Compile:` both ignore case now. `frontPages` trims and
  the others don't. F routes `frontPages` through `propertyValue` while it is in `index.ts`.
- `parseFountain` falls back to `segment(text)` when `md.text` differs, which evicts the caller's
  cache. Harmless; F always passes the note's own `segment()`.
- CONTEXT.md and ARCHITECTURE.md mention the harness in Wave 3, as planned.

**Left for the author.** E's finding 2: running the setup again in a vault that is fully set up
lists the layout row ("Arrumar a tela uma vez", unticked). So the modal says "Nada marcado" and
shows a disabled Criar, not "nothing to do" with Fechar as board 36 b and TEST-1.0 G2a step 11
say. Either the layout row stops counting as available (and can't be run from a finished
setup), or the expectation changes. Test 11b pins it with `test.fail()`.

**Checks** (main checkout, after the merges and again after the judge fixes): typecheck, vitest
227 files with 3683 passed and 2 skipped, the timing project 10 passed and 1 skipped, build,
`test:bundle` 4 passed, lint, `npx tsc -p e2e`. A fuzz of 3,000 random scripts through
`parseFountain`, `paginate` and `screenplayPdf` (Letter and A4) threw nothing and every PDF's xref
offsets matched. `pdfinfo` and `pdffonts` read the PDFs: the right page size, the four Courier
faces, WinAnsi, nothing embedded.

**e2e** (`npx playwright test`, once): 27 passed in 41.3 s wall, 4 Obsidian launches. Two of the 27
are `test.fail()` findings (7b, 11b). After the layout fix the setup spec ran again: 18 passed,
and only 11b is still an expected failure. The author's `obsidian.json` hash was unchanged, and
their two Obsidian instances kept running.

**Reference comparison** (`scripts/compare-screenplay.mjs`, Afterwriting 1.17.3; page counts
include the title page):

| Fixture | Letter: Escrita / Afterwriting | Letter: pages that start differently | A4: Escrita / Afterwriting | A4: pages that start differently |
|---|---|---|---|---|
| en-short (ours) | 5 / 5 | 1 | 5 / 5 | 3 |
| pt-short (ours) | 5 / 5 | 3 | 5 / 5 | 0 |
| brick_and_steel | 4 / 4 | 1 | 4 / 4 | 1 |
| my_living_memory | 16 / 16 | 9 | 16 / 15 | 9 |
| printing_trouble | 12 / 12 | 0 | 12 / 12 | 1 |

The page counts match except *My Living Memory* on A4. Escrita usually starts a page one or two
lines earlier. Some of it is Afterwriting's own rules (its automatic `(CONT'D)`, its dialogue
split at any line, its wider columns). But on *Brick & Steel* page 3 the lines wrap the same and
Afterwriting still fits one more short speech, so Escrita may count a line too many per page.
Wave 2 checks that first (a counting error is a fix, not a decision), then decides each
remaining difference and pins it in `tests/screenplay-pages.test.ts`.

**For Wave 2.** F: the writer table, `writers/{fountain,pdf}.ts`, the screenplay title page, the
modal (boards 43 and 44), the "Screenplays" settings group, and `frontPages` through
`propertyValue`. G: as planned. H: the remaining TEST-1.0 and TEST-0.9 specs, the `long-book` and
`screenplays` fixtures, 0.9's G0d, known issue 1, `screenplay.spec.ts`, and test 11b once the
author decides.

### Wave 2 (2026-10-16)

Six tasks merged into `1.1` with `--no-ff` in this order: P (`9094911`), I (`23e65d0`), G (`151ecd6`),
F (`dd223f9`), H1 (`8dcc579`), H2 (`d384391`); then the merge fixes (`ecb2d29`), task J's spec
(`3ef7a56`) and the judge fixes (`2dec6d7`). One conflict: `tests/settings-tab.test.ts`, the
expected headings, where both new groups were kept.

**F, screenplay export (`3b6f8ba`).** `export/writers/table.ts` (`WRITERS`, prose or script per
format) replaces the ternary in `write()`. `writers/fountain.ts` inverts the parser and checks
each forced mark with the parser itself; `writers/pdf.ts` is a thin call to `screenplayPdf`.
`export/screenplay.ts` builds the title page (`screenplayTitlePage`) and adds the script, the
notes and the pages to the build (`withScreenplay`), with the `unsupported` warning for a PDF.
`export/script-preview.ts` draws the pages from `paginate`. The modal (576 to 654 lines) has the
Page chips, "Scene numbers" and "Keep notes", the where line and the notice of board 43; the
"Screenplays" group has the nine rows of board 44 b. `frontPages` reads through `propertyValue`.
New tests: `export-fountain` (14), `export-screenplay` (19), `lifecycle-export-screenplay` (12).

- The `Title:` block's credit never wins, because the setting is never empty. Accepted (the Wave 1
  decision: the credit is the setting).
- An inline `%%` note becomes its own `[[note]]` paragraph before its block. Accepted.
- Escrita's parser reads a `[[note]]` back as link text, so notes are not part of the round trip.
  Accepted: there is no Fountain import in 1.1.

**G, form and universe (`86adca3`).** The universe reads `classify().form` (`worksIn`, the labels).
The three form rows are a "Forms" group after Books, always drawn, with their strings moved to
core (`settings.forms`, `settings.form*`); `SETTING_FEATURES` marks them `always`. Cues count in
mentions (Q8): `computeMentions(md, find, cues)` adds a cue that the matcher takes whole, unless
the prose matcher or a link already covers it, so a cue is never counted twice. The mentions
index gets `formOf` and re-indexes when the screenplay words change. "Roteiros" is the Works
tab's seventh group.

**H1, TEST-1.0 and G2c (`3df3558`, `1e90742`, `3ddb9ff`).** Seven specs: `features-presets`,
`writing-mode`, `release-fixes`, `demo-findings`, `phone`, `author-vault`, `beat-click` (68
tests). Helpers in `e2e/lib/more.ts`, the `world()` fixture, and `VaultSpec.copyFrom` (a read-only
recursive copy). TEST-1.0 has a pointer under each section.

**H2, TEST-0.9 and G0d (`d2a1ef2` to `77d7061`, nine commits).** Nine specs (`unlinked`, `names`,
`epub`, `collections`, `publish-next`, `read-book`, `scope`, `switches`, `appears-in-reading`; 96
tests), the `long-book` fixture (31 chapters, 90,951 words, seeded), `world-09`, and the helpers
`measure.ts` (`timeToFirstText`, a CDP `Trace`, `scrollToEnd`), `panels.ts`, `export-ui.ts`,
`zip-read.ts`. Where TEST-0.9's wording differs from the code, the specs assert the code, with a
comment at each (four places, for Wave 3).

**I, setup run again (`996367b`).** `planCounts` leaves the layout row out of `available` while it
is unticked by default and the writer has not ticked it. A set-up vault says "nothing to do"
(board 36 b); test 11b passes. It covers the `layoutTabs` reason too. Accepted.

**J, screenplay e2e (`3ef7a56`).** `e2e/specs/screenplay.spec.ts` (10 tests) and
`e2e/fixtures/screenplays.ts`: the formats, the file names, `pdfinfo` page sizes and Courier
fonts, the page remembered per work, the `Title:` block and "Keep notes", the `★` warning, the
preview's `(MAIS)` and `(CONT.)`, the nine pt-BR rows, the export switch.

**P, pagination check (`5416dda`).** Escrita does not count a line too many: 55 rows on Letter,
57 on A4, the same arithmetic as Afterwriting. Two real bugs fixed in `core/screenplay-pages.ts`: a
scene heading could be left alone above a short action or a speech with no sentence end
(`minLead`), and `HARRY (V.O.) (CONT'D)` printed the label twice. The compare script gained
`ESCRITA_COMPARE_TRIM` and `ESCRITA_COMPARE_AW_COLUMNS`.

**Merge fixes (`ecb2d29`).** H2 committed its worktree's `node_modules` symlink (`77d7061`); the
merge replaced the main checkout's `node_modules` with a link to itself. The merge was amended to
drop it, `node_modules` reinstalled with `npm ci`, and `.gitignore` now says `node_modules` (a file
or a folder). Branch `1.1-w2-h2` still holds the symlink: delete it after its worktree, never
check it out in the main checkout.

**Judge fixes (`2dec6d7`).**

- Centered lines with no blank between are one centered block (`core/fountain.ts`), and the
  Fountain writer writes each line as `> … <`. Brick & Steel on Letter now matches Afterwriting.
- A `forms` slot in `core/settings-order.ts`, after `dayEnds`, replaces G's trick of returning the
  Forms group from the writing-day slot.
- `LastExport` gains `pages` and `sceneNumbers` (`data.ts`, kept by `cleanLast`), so a PDF's page
  count no longer rides in `chapterCount` and "Export again" repeats a numbered PDF.
- Title page rows carry `TITLE_PAGE_LINE` (-1) in `core/screenplay-pdf.ts`: a character Courier
  can't print in the title, author or contact is named in the warning, with no "line 1" link.
- Progress chart (`goals/progress-modal.ts:374`): `is-met` is its own class. Obsidian adds an SVG's
  `cls` with `classList.add`, which threw on the space, so the chart was missing for anyone who
  had met a goal (a 1.0 bug, found by H1).
- Create entry from selection (`universe/create.ts` `openBeside`): Obsidian 1.14 brings the new tab
  to the front whatever `active` says, so the chapter's leaf is revealed and made active again.
- Read the book (`outline/reader-view.ts` `refreshDirty`): the text in view is kept by a measured
  anchor, the first block at the top of the window, found again after the redraw by its text
  (`anchorAfterEdit` in `reader-model.ts`, tested). The old code added the height change after
  Chromium's scroll anchoring had made it (test 8, a jump of twice the change). With 8 fixed, test
  8b showed the other case, an edit in the chapter being read: its blocks are all replaced, so
  Chromium's anchor was lost and the text jumped by the change. Both pass now.
- `setCssProps` stubbed in `tests/support/dom-setup.ts`. `docs/TESTING.md` lists every spec, the
  new helpers and the `stages` lesson for fixtures.
- Afterwriting's `liner.js` in `~/.cache/escrita-e2e/` restored from P's copy (it had P's debug
  lines).

**Decisions on the handoffs.**

- Cue extensions stay one string in the `Script` model; `cueTextOf` prints `(V.O.) (CONT'D)` as two
  groups. A list type is not worth a model change in 1.1.
- Scene numbers and "Keep notes" are not remembered per work in `ExportChoice`: scene numbers
  start from the setting, and a last PDF export keeps its own. "Keep notes" starts off each time.
- The unlinked list reads the prose matcher only (no cues): a cue is plain text the prose matcher
  sees already.
- Known issue 1 (beat click and the restored cursor) is closed, not a bug: the cursor lands on the
  beat in all three ways H1 tried. `beat-click.spec.ts` stays as the regression check.
- 0.7's G0d is closed as decided (Q12): Reading view shows the panel only.
  `appears-in-reading.spec.ts` checks it across 5 toggles, a split and a 200-line entry.
- G0d's 20 ms bar (below): accepted at 30 ms for "Read the book". The longest task is the
  renderer's chapter draw (about 44 blocks), measured with a trace running; no frame is dropped
  and nothing reaches 50 ms. Splitting a chapter's draw across frames is not worth it now.
- The reader's startup race (a `compile: false` chapter included when Read the book runs before
  the metadata cache is ready) goes to IMPROVEMENTS as a candidate (rebuild on the cache's
  `resolved`), not 1.1.
- TEST-0.9's text is fixed in Wave 3 in the four places H2 listed.

**Page breaks** (task P's comparison, decided; each pinned in `tests/screenplay-pages.test.ts`,
"reference differences, decided"):

| Cause | Where it shows | Decision | Reason |
|---|---|---|---|
| R1, dialogue splits at a sentence end (ours) or at any line (Afterwriting) | my_living_memory Letter 8, 11; A4 14; en-short A4 4 | Keep ours | SP 6 and Final Draft's rule: a speech breaks after a sentence. Confirmed again at G2. |
| R3, columns: action 60 (A4 57), dialogue 35 from 25, cue at 37; Afterwriting 61, 36, 35 | pt-short Letter 3–5, en-short 3, most of my_living_memory | Keep ours | US industry layout: 1.5" left and 1" right margins give 6.0" of action; cue at 3.7". |
| R4, consecutive `> x <` lines | Brick & Steel Letter 4 | Follow theirs (fixed) | The lines are one centered block; blank rows between them were ours alone. |
| R5, a trailing space wraps a full-width line onto an empty one | my_living_memory Letter 4–6 | Keep ours | An Afterwriting artifact; trailing spaces are not text. |
| An indented `CUT TO:` is action (ours, Q6) or a transition (Afterwriting) | Brick & Steel A4 3, 4 | Keep ours, ask the author | Q6 made an indent action. Fountain's spec says leading spaces are ignored outside action, which would make it a transition: a question for G2. |
| Cascades of the above | the rest of each list | Keep ours | No rule of their own. |

The comparison after the judge fixes (`scripts/compare-screenplay.mjs`, Afterwriting 1.17.3; page
counts include the title page; Wave 1's numbers in brackets):

| Fixture | Letter: Escrita / Afterwriting | Letter: pages that start differently | A4: Escrita / Afterwriting | A4: pages that start differently |
|---|---|---|---|---|
| en-short | 5 / 5 | 1 (1) | 5 / 5 | 3 (3) |
| pt-short | 5 / 5 | 3 (3) | 5 / 5 | 0 (0) |
| brick_and_steel | 4 / 4 | 0 (1) | 4 / 4 | 2 (1) |
| my_living_memory | 16 / 16 | 9 (9) | 16 / 15 | 9 (9) |
| printing_trouble | 12 / 12 | 0 (0) | 12 / 12 | 0 (1) |

Brick & Steel A4 gains a page: the indented `CUT TO:` now starts page 3, and page 4 follows from
it. It goes if the author picks the spec's reading of indents.

**Checks** (main checkout, after the judge fixes): typecheck, vitest 231 files with 3765 passed and
2 skipped (14.2 s), the timing project 10 passed and 1 skipped, build, `test:bundle` 4 passed, lint,
`npx tsc -p e2e`. The test vault's three links still point at this repo's build.

**e2e** (`npx playwright test`, once after the judge fixes, 12:38 to 12:46): 204 tests, 199 passed
in 7.9 min, 1 failed and 4 did not run after it. No `test.fail()` is left: the three findings
(17, 16 and read-book 8) are fixed and pass, and so does 8b. The failure was
`release-fixes.spec.ts:133` (the darlings editor did not show the first cut within 8 s); the file
then passed alone, 9 of 9 in 32 s. A flake to watch, not a known bug. Time inside tests per file
(launches not included): read-book 83.7 s, demo-findings 61.4 s, appears-in-reading 33.1 s, phone
23.1 s, names 20.8 s, setup 20.3 s, release-fixes 16.4 s (5 of 9 tests), scope 14.0 s, unlinked
11.2 s, author-vault 9.6 s, collections 7.4 s, switches 5.6 s, publish-next 5.0 s, epub 4.8 s,
new-work 3.9 s, screenplay 3.5 s, beat-click 3.4 s, writing-mode 3.1 s, features-presets 1.4 s.
Wall time with launches, from the tasks' own runs: demo-findings 125 s, read-book 84 s, phone
38–51 s, appears-in-reading 38 s, release-fixes 32 s, names 26 s, author-vault 25 s, scope 19 s,
unlinked 16 s, collections 13 s, switches 11 s, publish-next 9 s, epub 9 s, writing-mode 9 s,
beat-click 8 s, screenplay 8 s, features-presets 7 s.

**G0d (0.9, "Read the book" on `long-book`: 31 chapters, 90,951 words).** First text on screen
from the command: 8 to 18 ms (median 16.1 and 9.8 ms in two full runs); painted 29 to 60 ms.
Longest main-thread task while dragging to the end in about 5 s: 22.9 to 28.4 ms over six runs, 6
to 11 tasks of 20 ms or more per pass, none of 50 ms; the widest gap between frames 16.8 ms (one
run had one of 33.3 ms). At reading pace (120 px per frame, 26 s): 24.2 and 26.6 ms. Typing in a
3,000-word chapter with the lens off: longest task 7.5 to 9.6 ms. The bars: first text under 500
ms, passed; the 20 ms task bar missed by 3 to 8 ms, accepted at 30 ms (decisions).

**G2c (the author's vault, on a copy).** `author-vault.spec.ts` copies `~/Projects/website/escrita`
(13 MB) into the run folder, hashes the source before and after (unchanged), and runs G2c 1 to 6.
The setup in the copy leaves `data.json`'s `settings` deep-equal to the source's (G3 holds).
"Abrir a nota inicial ao iniciar" shows "Já está assim" because it is already on, not unticked as
TEST-1.0 says. The forms text has `screenplay` added, and the closed thread word is the author's
`fechado`.

**For Wave 3.**

- The user guide, English and pt-BR: `screenplays.md` (the form, Fountain in a note, the export,
  the warnings, "Keep notes", the "Screenplays" settings), "Publishing" pointing to it, and the
  upgrade note: the form rows moved from Universe to a "Forms" group after Books.
- README: the feature line and the changelog, with that upgrade note and the 1.0 fixes (the
  Progress chart, the entry tab, the reader's jump).
- `docs/ARCHITECTURE.md`: `core/form.ts`, `fountain.ts`, `screenplay-pages.ts`, `pdf.ts`,
  `screenplay-pdf.ts`, `screenplay-presets.ts`, `export-formats.ts`; `export/writers/table.ts`,
  `fountain.ts`, `pdf.ts`, `screenplay.ts`, `script-preview.ts`; the `forms` slot; cues in mentions;
  the harness. `CONTEXT.md`: the 1.1 line, `form` in the classifier, the harness in "Working
  process".
- `docs/IMPROVEMENTS.md`: 46 and the five known issues to "Done" (issue 1 closed, not a bug); a
  candidate for the reader's startup race.
- `docs/ROADMAP.md`: SP 1 and SP 6 shipped, G0d's numbers, 0.7's G0d closed, "Still open after 1.0"
  cleared. TEST-0.9's text in the four places H2 listed.

### Wave 3 (2026-10-16)

Four Sonnet tasks wrote the release docs on branches from e6d55c8, merged in order with
`--no-ff` and no conflicts (each owned its own files).

- **K, the user guide** (`1befe0c`): a new `screenplays.md` in English and pt-BR (the form, Fountain
  in a note, the export window, the title page, the page breaks, the "Screenplays" and "Forms"
  settings, a "When something looks wrong" table). `publishing.md` gains "Export a screenplay" and
  pointers; `features-and-settings.md` gains "Settings added in 1.1" (the upgrade note), the Forms
  heading, the screenplay words in the language table and the Export switch row; `the-world.md`
  has the seventh form, where the rows are now, and cues in "What counts as a mention";
  `getting-started.md` lists the four screenplay words the setup's language step sets. Every other
  page links the new one.
- **L, README and TEST-0.9** (`4bc61c6`): the Publishing line names screenplays and links the new
  page; a "1.1.0 (unreleased)" changelog entry (screenplays, the settings, the form outside the
  universe, cues, the setup run again, seven fixes, the Forms upgrade note, improvement 46).
  TEST-0.9's four places from H2 (the collection's "O quê" row, the bracketed missing-story name,
  the gap warning naming "04 A escada", Livro Longo absent from the Works tab without a `status`).
- **M, ARCHITECTURE, CONTEXT, TESTING** (`a2dc089`): new "Form", "Screenplays" and "The
  end-to-end harness" sections; the export pipeline (`titlePageOf`, `bylineOf`, `minHeadingOf`,
  `ManuscriptTitle`), the module's modal, writer table, script writers, `LastExport.pages` and
  the settings group; cues in mentions and the closed 0.7 G0d in the universe. CONTEXT has `form`
  in the classifier, "1.1 additions", the harness under "Working process", the 1.1 line as in
  progress, Screenplay and Fountain in the vocabulary, the updated weak spots and the vault path
  in its real case. TESTING has the real run time and the bigger fixtures.
- **N, IMPROVEMENTS and the roadmaps** (`9fdeb55`): 46 and the five known issues in "Done" under
  1.1 (issue 1 closed, not a bug); candidate 52 for the reader's startup race; the darlings
  split-editor flake noted as suspected. ROADMAP's 1.1 section is "built, not released", with the
  "what was open after 1.0" table and the two G2 questions; SP 1 and SP 6 are marked built in
  1.1.0 (unreleased) with the decisions; ROADMAP-novel has G0d's numbers.

**Review against the code.** Every setting name, description, English and pt-BR default in the
two settings tables matches `src/export/strings.ts`, `src/strings.ts`, `src/core/defaults.ts` and
`src/settings.ts`; the modal labels, hints, the "Writes" lines, the warning, the "Last export"
shape, the file names and the dialogs match the strings and `export/modal.ts`; the Fountain rules
match `core/fountain.ts` and the page rules `core/screenplay-pages.ts` and
`core/screenplay-presets.ts`; the setup's four labels match `setup/strings.ts`; the Works group is
"Screenplays" / "Roteiros". The guide follows boards 43 and 44, except the board's settings path
"Livros e obras › Formas": the code's group heading is "Forms" / "Formas", and the guide follows
the code. Every relative link and anchor in the changed docs resolves (the only misses are
examples inside code spans, there before 1.1). Every backticked identifier and file path the new
text names exists. Nothing says 1.1 is released. Both G2 questions are written as today's
behavior and, in ROADMAP and ROADMAP-screenplay, as open.

**Fixes in the review:**

- `docs/guide/en/screenplays.md`, `pt-BR/screenplays.md`: "Nothing is written to your notes for
  you" (pt-BR "por você" read as "by you") is now "Escrita never writes the form into your notes";
  lyrics are a `~` line anywhere, not only inside a speech (the parser takes both); "a screenplay
  is not sent as DOCX" is now "doesn't export as"; pt-BR names the `CONTINUED:` marks by their
  industry name, not an invented `CONTINUA:`, and the forced transition example is `> FADE OUT.`,
  as Brazilian scripts write it.
- `docs/guide/pt-BR/the-world.md`: "ganha essa sozinha" is "ganha esse valor sozinha".
- `docs/ARCHITECTURE.md`: the presets section named `LETTER` and `A4` constants that don't exist
  (they are private `LETTER_PAGE` and `A4_PAGE`); the `pieceSource` bullet's "task 1.1" now says
  it is 1.0's task, not version 1.1.
- `docs/ROADMAP-screenplay.md`: the Works group is "Screenplays" ("Roteiros" in pt-BR).
- `docs/ROADMAP.md`: improvement 46 is already in "Done", not "moves there with the release".
- `CONTEXT.md`: the harness "runs the checks of" the by-hand pages instead of "replaced" them
  (what needs an eye is still by hand).

**Checks** (main checkout, after the fixes): typecheck, vitest 231 files with 3765 passed and 2
skipped (14.2 s), build, `test:bundle` 4 passed, lint. No e2e run (docs only). The test vault's
three links still point at this repo's `main.js`, `manifest.json` and `styles.css`.

**Left before the release:**

1. G2 by the author ("By-hand checks" below). The two pagination calls are decided (2026-10-16,
   "Follow-up: indents").
2. The release mechanics: `npm version minor --no-git-tag-version` (manifest and versions to
   1.1.0); ROADMAP's 1.1 section to "Shipped"; the README changelog heading dated, and
   "(unreleased)" taken out of `screenplays.md` (both languages), ROADMAP-screenplay and the
   ROADMAP table; CONTEXT's 1.1 line to shipped; commit `1.1.0`, tag `1.1.0`, push the tag.

### Follow-up: indents (2026-10-16)

The author decided to follow the Fountain spec and what other tools do. Q6 is reversed for indents
(an indented scene heading, transition, cue with its speech, centered text, section, synopsis,
page break, lyric, note or forced element is that element; only action keeps its indent), and R1
stays. Branch `1.1-q6`: `parseFountain` drops its indent rule and an action line keeps a tab or
4-space indent when it falls through to action (`src/core/fountain.ts`); the Fountain writer needed
no change (it already forces with `!` what the parser would read as another element, checked in
`tests/export-fountain.test.ts`). Tests: "ignores leading whitespace on every other element" in
`tests/fountain.test.ts`, the indented `CUT TO:` in `tests/screenplay-pages.test.ts` (now a
transition), and a round-trip block in `tests/export-fountain.test.ts`.

Comparison (`scripts/compare-screenplay.mjs`, Afterwriting 1.17.3; Escrita / Afterwriting pages,
then pages that start differently; before, then after):

| Fixture | Letter before | Letter after | A4 before | A4 after |
|---|---|---|---|---|
| en-short | 5 / 5, 1 | 5 / 5, 1 | 5 / 5, 3 | 5 / 5, 3 |
| pt-short | 5 / 5, 3 | 5 / 5, 3 | 5 / 5, 0 | 5 / 5, 0 |
| brick_and_steel | 4 / 4, 0 | **5 / 4, 3** | 4 / 4, 2 | **4 / 4, 0** |
| my_living_memory | 16 / 16, 9 | 16 / 16, 9 | 16 / 15, 9 | 16 / 15, 9 |
| printing_trouble | 12 / 12, 0 | 12 / 12, 0 | 12 / 12, 0 | 12 / 12, 0 |

Brick & Steel A4 now agrees with Afterwriting: the indented `CUT TO:` is a transition, and the
page 3 and 4 differences are gone. Brick & Steel Letter is a new difference, not decided here:
its tab-indented `JACK` and `DAN` lines are now cues with speeches, as Afterwriting reads them, and
Escrita's narrower parenthetical column (30 to 55) wraps "(in Vietnamese, subtitled)" onto two
lines where Afterwriting keeps one, which pushes `THE END` onto a fifth page. With Afterwriting's
columns (`ESCRITA_COMPARE_AW_COLUMNS=1`) Brick & Steel agrees on both sizes, so the cause is R3
(columns), not the indent rule. Open: keep R3 for parentheticals too, or widen them.

## By-hand checks (G2)

The harness runs everything a script can see (204 tests). What is left for the author:

1. **The pictures** in the Playwright report (`npm run e2e`, then `e2e/report/`): the screenplay
   modal, the warning and the preview against board 43; the Screenplays and Forms groups against
   board 44; the setup steps; writing mode; the Progress chart's colours (demo finding 16); light
   and dark.
2. **A PDF in a reader app:** the Portuguese fixture and *Brick & Steel*, on Letter and A4:
   Courier, page numbers from page 2, `(MAIS)` and `(CONT.)` where a speech breaks, the title page.
3. **By eye, as before:** writing mode with a third-party theme (Typewriter, Minimal, zen; demo
   findings 1 and 6). Phone checks stay waived.
4. **The author's user** tries a short film of their own and says whether the PDF is what they
   submit.

## Risks

- **Moving the form to core** touches the classifier, the universe's works list and the new
  conto template. The move is code only, with the old tests kept green and pointed at the new
  file; `screenplay` is the only new value.
- **Pagination parity.** No two screenwriting apps break pages the same way. The reference
  comparison makes the differences explicit and decided, instead of chasing a perfect match.
- **The harness depends on the flatpak and on Obsidian's DOM**, which can change with an
  Obsidian update. Specs use command ids, `app` state and Escrita's own `escrita-` classes
  first, and Obsidian's classes only where needed. A broken spec after an update is a harness
  fix, not a plugin bug, and the spec says which it is.
- **The harness opens a second Obsidian** on the author's desktop. It never shares a profile or
  a vault with the first, and it always quits at the end. If headless doesn't work, a window
  shows while the specs run.
- **Mobile.** The screenplay code is pure, and the export writes with `notes.create`, so phones
  are assumed to work (no phone to test on). The harness's `emulateMobile` covers phone width.

## Not in this plan

- Screenplay layout in the editor, Tab and Enter, suggestions, pages as a unit (SP 2–4, phase 2).
- FDX export, Fountain import, feature-length scripts as a book, the script report (phase 3).
- Recording the README GIFs with the harness. It could do this later (CDP screencast frames
  through ffmpeg), but 1.1 builds it for checks.
- Running the harness in CI.
- Third-party themes and plugins in the harness (the Minimal and zen checks stay by eye).
