# Escrita 1.1, "screenplays": implementation plan

The plan for screenwriting phase 1 (SP 1, SP 6: Fountain notes, Fountain and PDF export),
IMPROVEMENTS 46 (export writers share the title page; the modal splits), the five known issues,
and an end-to-end check harness that drives Obsidian with Playwright, so the by-hand checks run
by themselves. Written 2026-10-16 on `main` at `6ed0efd` (1.0.4). **Approved 2026-10-16:** every
question as recommended (G0), including copying the author's vault into the run folder for G2c.
The export boards wait for mockups (G1). The waves run as workflows, on branch `1.1`.

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
| Q6 | Where Fountain and Markdown disagree | **The screenplay wins inside a screenplay note.** `#` is a section, `>` a transition or centered text, `_x_` is underline, and 4-space indents are action (`segment()` doesn't mark indented code, `core/markdown.ts:36`, so nothing is lost). Each case is pinned in `tests/fountain.test.ts`, next to the existing parity tests. |
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
  "Screenplays" settings group approved on the design canvas.
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

## By-hand checks (G2)

What stays by hand is short, and most of it is reading the harness's screenshots:

1. The screenshots in the Playwright report: the setup steps, writing mode, the export modal
   for a screenplay, light and dark.
2. A PDF of the Portuguese fixture and of *Brick & Steel*, opened in a PDF reader: Courier,
   page numbers, `(MAIS)` and `(CONT.)` where a speech breaks.
3. The author's user tries a short film of their own and says whether it is what they submit.

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
