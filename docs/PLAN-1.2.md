# Escrita 1.2, "writing a script and reading a story": implementation plan

The plan for the screenplay editor (SP 2), "Read a note" (SF 15), sentence rhythm in the lens
panel (SF 16), and two improvements: editor glue and "reveal on touch" in `src/ui/` (candidate
38) and "Read the book" rebuilding when the metadata cache is ready (candidate 52). Written
2026-10-19 on `main` at `627b23d` (1.1.1). **Approved 2026-10-19 (G0):** every question as
recommended, except Q2 (the screenplay switch is on in Everything only). The boards wait for
G1. The waves run on branch `1.2`.

**Goal:** a writer types a short film in a screenplay note and sees it laid out as on the page,
with Tab and Enter doing what they do in a screenwriting program. A writer revising a conto
reads it in the reader, and sees the rhythm of a paragraph's sentences in the lens panel.

**Stage served:** draft (the screenplay editor) and revision (the reader, the rhythm).
**Upkeep for the writer:** none. The editor acts only on notes whose form is already
`screenplay`; the reader and the rhythm read what is there.

## Decided with the author (2026-10-19)

- The screenplay switch is on in the Everything preset only; any other writer turns it on by
  hand (Custom).
- 1.2 is the screenplay editor, a reader for short stories, the rhythm checker and two
  improvements. Universe phase 2 moves after 1.2.
- The other short-fiction ideas from the same talk (cut target for revision, more lens rules,
  submission history) are not in 1.2 and not in the roadmap yet.

## Claims checked against the code (HEAD 627b23d)

**The screenplay editor**

- `core/fountain.ts` (479 lines): `ScriptElement` (`:27-47`) carries only its start `line` and
  `runs` (`:19-23`). There is no end line, and a multi-line action or speech joins its lines in
  `runs`.
- `parseFountain(text, md, opts)` (`:313`) is a whole-document pass, and a line's type depends
  on the lines before it (`inSpeech`, `prevBlank`). Nothing caches it.
- `fountainOptions(settings)` (`:81`) builds the parser options.
- `classify().form` is set on every Markdown file (`core/classify.ts:227`, `:509`).
- The file of an editor state is read as `state.field(editorInfoField, false)?.file` in four
  places: `editor/features.ts:48-51`, `lens/ui.ts:34`, `universe/name-marks.ts:40` and
  `universe/appears-in-widget.ts:77`.
- Enter: `TypingFeature`'s keymap is `Prec.high` (`editor/features.ts:64-67`). `onEnter` acts on
  chapters and tracked notes (`:105-107`), so a tracked screenplay gets prose Enter flow today.
  Tab is bound nowhere.
- Decoration plugins: `lens/decorations.ts` (189), `editor/dialogue-focus.ts` (112),
  `universe/name-marks.ts` (197), `placeholders/decoration.ts` (101), `outline/ghost.ts` (91).
  - The first three each keep an editor set, a refresh effect and a broadcast through
    `core/dispatch-retry.ts:12`.
  - The last two are the same plugin (candidate 38).
  - `dialogue-focus.ts` is the model: per-state on/off, a rebuild on doc or viewport change,
    line decorations over `visibleRanges`, `segmentDoc(doc)`.
- There is no `EditorSuggest` in `src/`. The post-processor slot exists
  (`core/module-context.ts:212-214`), and no module uses it.
- Cues: `universe/mentions.ts:40-52` (`cueOccurrences`) collects character names from
  `parseFountain`. Universe names reach other modules only through `plugin.names`
  (`core/names-source.ts:11-15`, `tableFor(path)`).
- Settings: the screenplay rows are `core/settings-schema.ts:195-208`, all `readBy: ["export"]`.
  There are no time-of-day words, no editor font, and no Courier anywhere.
- Features: 19 ids (`core/features.ts:5-8`). The presets are in `core/feature-presets.ts:19-40`:
  Essentials 9, Writer 16, Everything is every id but the universe.

**The reader**

- `outline/reader-view.ts` (389), `reader-model.ts` (87), `reader-plan.ts` (109).
- The command `read-book` (`outline/index.ts:127-135`) is offered only inside a book. The view
  type `escrita-reader` (`reader-view.ts:13`) is not in `core/view-types.ts`.
- The view state is `{ book }` (`:67-80`), and `build()` (`:203`) looks the book up in
  `books.allBooks()`.
- The seam is `ReaderChapter[]` (`reader-plan.ts:19`). An empty heading draws no `<h1>`
  (`:241`), and `blocksOf(path)` (`:312`) needs only a path.
- Positions are `data.readPosition[bookNotePath]` (`:364`), moved by `movePositions` and
  `dropPositions` (`outline/index.ts:48-52`).
- The redraws are on create, delete and rename (`:92-94`, debounced 400 ms) and on modify for
  a chapter (`:107-112`, 800 ms). There is no metadata cache listener (candidate 52).
- Tests: `tests/outline-reader-plan.test.ts`, `tests/reader-model.test.ts`,
  `tests/reader-mask.test.ts`, `tests/e2e/specs/read-book.spec.ts` (381 lines, G0d timings).

**The lens**

- The panel `LensView` (`lens/view.ts`) redraws whole: `render()` (`:69`) then `build()`
  (`:79`). It draws Dialogue and Readability in `measures()` (`:138`), then the rules.
- Redraws: on leaf change and file open, on a new result, and on a selection change after
  150 ms (`lens/ui.ts:158-174`). The cursor is read at render time (`view.ts:331`
  `cursorRange`).
- `sentences()` (`core/sentences.ts`) gives `{ from, to }` per sentence, split per paragraph.
- `layout(toks, sents)` (`lens/rules-words.ts:45`) gives each token's sentence.
- `longSentences` (`:211-232`) counts the words of each sentence and throws the counts away. No
  per-sentence length is kept.
- `LensPass` (`lens/types.ts:86`) holds mask, tokens, sentences, speech and syllables.
- Lens rows: `core/settings-schema.ts:254-264`. `lensShowDialogue` and `lensShowReadability`
  are the pattern for a new "show" switch.

## Open questions, with recommended answers

| # | Question | Recommended answer |
|---|---|---|
| Q1 | A new switch for the screenplay editor, or part of typing? | **A new feature, `screenplay`**, the 20th id, in the "writing" group after typing, as PLAN-1.1 Q2 foresaw. Its module is `src/screenplay/`. A writer who dislikes the layout turns it off without losing Enter flow in prose. It does nothing in a note whose form isn't `screenplay`. |
| Q2 | Which presets turn it on? | **Everything only** (decided by the author, 2026-10-19; Essentials stays at 9, Writer at 16). A writer on another preset turns it on by hand, which makes the preset "Custom". On upgrade the switch is **off**, except for an install whose switches all match "Everything", which gets it on so it still matches. |
| Q3 | How do the decorations get each line's element? | **Each element gains `endLine`** in `core/fountain.ts` (a deliberate core change; `line` stays). A pure `fountainLines(script, lineCount) → LineKind[]` gives the kind of every line. The parse is cached per document version, as `segmentDoc` is: a `WeakMap<Text, Script>` in a new `core/fountain-doc.ts`. No incremental parser: a short film is a few thousand lines. S0 measures a 120-page script, and the bar is the reader's typing budget (≤ 10 ms per keystroke). |
| Q4 | Markdown fights Fountain in Live Preview: `#` draws a heading, `>` a quote, `---` a rule, `_x_` italics | **Line classes override the look, and the text stays as typed.** In a screenplay note each line gets `escrita-sp-<kind>`, and CSS under the screenplay body class neutralizes heading size, the quote border and the rule widget. S0 tests whether CSS can hide Obsidian's `hr` widget and quote styling. If it can't, the fallback is a replace decoration for those lines only, never touching the text. |
| Q5 | The layout | **Indents in `ch` under a monospace font, as on the page:** cue at 22ch, dialogue at 10ch with a 35ch measure, parenthetical at 16ch, transition to the right, scene heading bold. These are the industry columns, and the PDF uses them too (`core/screenplay-presets.ts`). A new setting, `screenplayFont` ("Courier" by default: the stack is Courier Prime, Courier New, Courier, then the theme's monospace; or "Theme", the editor's own font), read by the new feature. Source mode stays plain. |
| Q6 | Reading view | **Unchanged in 1.2.** A post-processor would rebuild Obsidian's rendered paragraphs line by line, which is fragile, and the export preview already shows the page. Moved out in ROADMAP-screenplay.md. |
| Q7 | Enter and Tab: which rules? | **As in Fade In, Highland and Final Draft** (the author's rule: follow the spec and other tools). One pure table in `core/screenplay-keys.ts`, pinned in tests. Enter after a cue or parenthetical goes to dialogue (one line break). Enter after dialogue goes to the next cue (a blank line, then cue mode); Enter on that empty cue line goes back to action. Enter after a scene heading or action leaves a blank line and stays in action. Tab on an empty line cycles action → character → transition → scene heading. Tab after a cue opens a parenthetical `()`. Shift-Tab goes back. Each step is one transaction, so one undo. Outside those cases Tab and Enter fall through to Obsidian. |
| Q8 | Caps on cue, scene and transition lines | **Typed as uppercase while the line is in that mode**, through an input handler that only touches the characters being typed, never text already there. Fountain needs the capitals, and a writer in a screenwriting program never presses Caps Lock. A forced line (`@name`, `.HEADING`, `>`) is respected. |
| Q9 | Enter flow in a screenplay | **Off.** `onEnter` returns false when the form is `screenplay` (one line in `editor/features.ts`), whether or not the new switch is on. Prose Enter flow breaks Fountain's blank-line rules. |
| Q10 | Phones have no Tab key | **Two commands**, "Next screenplay element" and "Previous screenplay element", for the mobile toolbar. No default hotkeys (rule 8). |
| Q11 | Suggestions | **One `EditorSuggest`, three triggers.** On a cue line: the cues already in the script, then the universe's names for the note (`plugin.names.tableFor(path)`, no universe import), most used first. After a scene prefix (`INT. `): the locations already used. After ` - ` on a scene heading: the time-of-day words, a new word setting `screenplayTimes` (en `DAY, NIGHT, CONTINUOUS, LATER`; pt-BR `DIA, NOITE, CONTÍNUO, MAIS TARDE`). |
| Q12 | Dialogue focus and the lens in a screenplay | **Not in 1.2** (moved to SP 5, revision for scripts). Dialogue focus stays off in screenplay notes rather than dimming the wrong lines: one check in `onFor`. |
| Q13 | "Read a note": which command? | **A second command, `read-note`, "Read this note"** (pt-BR "Ler esta nota"). `read-book` keeps its id and name, because writers' hotkeys point at it. `read-note` is offered on a note outside a book that is not a screenplay, snapshot, export or submission. |
| Q14 | Collections in the reader? | **Yes.** On a collection (`core/collection.ts`), `read-note` reads its contos in order, each headed by its title as the collection exports. It is the same seam (`ReaderChapter[]`), so it is small. |
| Q15 | The reader's state and positions | **The view state becomes `{ source }`, and an old `{ book }` is read as the same.** The view type and the position key stay, because they live in the writer's workspace and `data.json`. A source resolves to a book, a collection or a note (`reader-plan.ts` `readerSource`). The top bar shows the title and, for a book only, the chapter count and the outline button. The view id moves into `core/view-types.ts` (part of candidate 48, done here because the file is touched). |
| Q16 | The reader stays in the outline module? | **Yes.** It is the outline's view, and the guide already says the outline turns it on. A note's reader needs the outline on too, as the book's does. A new switch is upkeep (rule 3). |
| Q17 | The rhythm's scope and look | **The paragraph at the cursor, or the selected sentences when there is a selection.** One horizontal bar per sentence, its length in words, a line at `lensLongSentence`, a click selects the sentence. A **run** is 3 or more sentences in a row whose lengths are within 3 words of each other (fixed, pinned in tests). New setting `lensShowRhythm` (on), next to `lensShowDialogue`. |
| Q18 | Where do sentence lengths come from? | **`LensPass` gains `sentenceWords: Uint16Array` and `sentencePara: Int32Array`**, filled once in `analyze` from the one `layout` call. This is the first slice of candidate 47 (the rest stays open). `longSentences` reads `sentenceWords` instead of its own map. The panel finds the paragraph by `sentencePara`. It needs no Markdown object, so the `EMPTY_MD` issue doesn't arise. |
| Q19 | Which improvements? | **38 and 52.** 38: `src/ui/editor-glue.ts` (`EditorSet` with the lens's retry, `fileOfState`, `isLivePreview`, `cmOf`) and `src/ui/reveal-on-touch.ts`. The four broadcast users, ghost beats and placeholders move onto them, and the screenplay layout is built on them from the start. 52: the reader rebuilds on the metadata cache's `resolved`, keeping the position. |

## The design

### Core, no Obsidian imports

- `core/fountain.ts`: `endLine` on every element; `fountainLines`.
- `core/fountain-doc.ts`: the cached parse per CodeMirror `Text`.
- `core/screenplay-keys.ts`: `decideKey(lines, kinds, cursor, key) → Edit | null`, pure. It
  returns the text change, the new mode and the cursor.
- `core/screenplay-suggest.ts`: cue, location and time candidates from a `Script` plus a names
  table, ordered by use.
- `core/features.ts`: `screenplay` (20th id); `core/feature-presets.ts`: Everything only; the
  upgrade rule of Q2 where the stored switches are normalized.
- `core/settings-schema.ts`: `screenplayFont`, `screenplayTimes` (lang `word`), `lensShowRhythm`.
  `screenplaySceneHeadings` and `screenplayTransitions` add `screenplay` to `readBy`.

### The screenplay module (`src/screenplay/`)

- `index.ts` is the `FeatureModule`. It owns the editor extensions, the suggest, the two
  commands and the settings rows (a "Screenplay editor" group: font and time words).
- `layout.ts` is the view plugin on `EditorSet`. It applies the body class
  `escrita-screenplay` and the line classes, rebuilding over `visibleRanges` from
  `fountainDoc`.
- `keys.ts` is the `Prec.highest` keymap and the caps input handler. Each calls the pure
  table and dispatches one transaction.
- `suggest.ts` is the `EditorSuggest`.
- `styles.css` holds the columns, the overrides from Q4, light and dark, and touch targets.

### The reader (`src/outline/`)

- `reader-plan.ts` gets `readerSource(path) → { kind: "book" | "collection" | "note", sections }`.
- `reader-view.ts` reads `{ source }` (and an old `{ book }`), titles by source, rebuilds on
  `resolved` (52), and checks the folder of the source's sections in `touched`.
- `index.ts` adds the `read-note` command. The view id moves to `core/view-types.ts`.

### The lens (`src/lens/`)

- `analyze.ts` fills `sentenceWords` and `sentencePara`, and `rules-words.ts` reads them.
- `view.ts` adds a "Rhythm" section (`rhythm.ts` has the pure model: the bars, the run, the
  selection range). `panel.css` gets the bar styles.

## Gates

- **G0** (before Wave 0): the questions answered by the author. **Passed** 2026-10-19: all as
  recommended, Q2 changed to Everything only.
- **S0** (Wave 0, a spike in the harness): in a screenplay note in Live Preview:
  - can line classes and CSS neutralize a `#` heading, a `>` quote and a `---` rule?
  - Does `editorInfoField` hold the file when the extension first builds?
  - The cost of `parseFountain` per keystroke on a 120-page script.

  The report says which Q4 path to take and whether Q3 needs more than a cached whole parse.
- **G1** (before Wave 1's UI tasks): boards on the design canvas, approved:
  - the screenplay note in Live Preview, light and dark, with each element, the suggest and a
    Tab cycle;
  - the reader for a note and for a collection;
  - the lens's Rhythm section, with a run and a long sentence.
- **G2** (before release): the four checks, `npm run e2e` green, the screenshots reviewed by the
  author, and a short film typed by hand in the test vault (`~/Projects/escrita-test/`).

## Waves

The usual rules apply:
- Sonnet for code, tests and docs; Opus for the contracts, the judge and every architecture call.
- Worktrees are made in the main loop, and each task commits on its branch.
- Heavy checks run behind `flock`, and vitest runs with `--maxWorkers=4`. One Obsidian at a time.

**Wave 0, contracts and the spike.**

- Opus, main loop, one commit: the 20th feature id and presets; the three settings rows; every
  new string in both languages; `endLine` and the `LineKind` type; the `decideKey` and suggest
  types; `LensPass`'s two fields; `readerSource`'s type; the view id in `core/view-types.ts`.
  The boards are drafted on the design canvas at the same time.
- Sonnet, in parallel: S0, in `tests/e2e/spike/` (removed after).

**Wave 1 (Sonnet, four tasks in parallel, one owner per file):**

| Task | Owns |
|---|---|
| A, improvement 38 | `src/ui/editor-glue.ts`, `src/ui/reveal-on-touch.ts`, and the moves in `lens/decorations.ts`, `editor/dialogue-focus.ts`, `universe/name-marks.ts`, `universe/appears-in-widget.ts`, `placeholders/decoration.ts`, `outline/ghost.ts`, `editor/features.ts` (`fileOfState` only). Behavior unchanged, existing tests green, plus tests for `EditorSet`'s retry |
| B, script core | `core/fountain.ts` (`endLine`), `core/fountain-doc.ts`, `core/screenplay-keys.ts`, `core/screenplay-suggest.ts` and their tests (`tests/fountain*.test.ts`, `tests/screenplay-keys.test.ts`, `tests/screenplay-suggest.test.ts`) |
| C, the reader (after G1) | `outline/reader-*.ts`, `outline/index.ts` (the command), improvement 52, their tests, and `tests/e2e/specs/read-book.spec.ts` plus a new `read-note.spec.ts` (a conto, a collection, the old `{ book }` state, 52's startup case) |
| D, the rhythm (after G1) | `lens/analyze.ts`, `lens/types.ts`, `lens/rules-words.ts`, `lens/rhythm.ts`, `lens/view.ts`, `lens/panel.css`, `lens/settings-ui.ts`, and tests (`tests/lens-rhythm.test.ts`, `rules-words` unchanged results) |

**Judge (Opus):** the diff against this plan, the four checks, `npm run e2e` once, and no module
folder importing another.

**Wave 2 (Sonnet, after Wave 1 and G1):**

| Task | Owns |
|---|---|
| E, the screenplay module | `src/screenplay/**`, the Enter flow guard in `editor/features.ts` (Q9), dialogue focus's off check (Q12), the module's registration in `main.ts`, its tests (lifecycle: loads, unloads, leaves no extension behind) |
| F, the screenplay checks | `tests/e2e/specs/screenplay-editor.spec.ts`: each element's class, a Tab cycle and Enter sequence typed and the resulting text, one undo per step, suggest picks, the switch off leaving plain text, timings on the 120-page fixture; screenshots in light and dark for G2 |

**Judge (Opus)**, as in Wave 1.

**Wave 3, release (Sonnet, then an Opus review):**

- User guide, English and pt-BR:
  - `screenplays.md`: writing in the editor, the keys, the two commands, the settings.
  - `writing.md`: "Read this note" beside "Read the book".
  - `revision.md`: the Rhythm section.
  - `features-and-settings.md`: the 20th switch and the presets.
- README: the feature lines and the changelog.
- `docs/ARCHITECTURE.md`: the screenplay module, `fountain-doc`, `screenplay-keys`, the editor
  glue, 20 ids. `CONTEXT.md`: the 1.2 line, 20 features.
- `docs/IMPROVEMENTS.md`: 38 and 52 to "Done", and 47's first slice noted. `docs/ROADMAP.md` and
  the topic roadmaps: shipped.
- The test vault's plugin links checked after the build.

## Results

(Filled in as the waves run.)

## Risks

- **Obsidian's Live Preview owns Markdown styling.** Headings, quotes and rules may not yield to
  CSS everywhere, or may change with an Obsidian update. S0 decides before any layout code, and
  the e2e spec checks it on every run.
- **Keys are where writers notice bugs.** Tab and Enter fall through to Obsidian whenever the
  table has no answer, and each step is one undo. The pure table is pinned case by case, and the
  e2e spec types real sequences.
- **Whole-document parse per change.** Fine for a short film. A feature-length script as one
  note may be slower; S0 measures it, and feature-length scripts as a book (SP 7) are the
  long-term answer.
- **Candidate 38 touches five working plugins.** It is a move with the behavior pinned, and the
  lens's retry becomes everyone's. The judge runs the e2e suite, which covers marks, ghosts,
  placeholders and dialogue focus.
- **Mobile.** The new code uses CodeMirror and Obsidian's documented API, and the two commands
  replace Tab on a phone. Phones are assumed to work (no phone to test on).

## Not in this plan

- Reading view layout for screenplays (Q6).
- Fountain in dialogue focus and the lens, and the script report (SP 5).
- Pages as a unit (SP 4) and the scene outline (SP 3).
- The rest of candidate 47 (the lens's other repeated preparation).
- The other short-fiction ideas of 2026-10-19: a cut target in revision, new lens rules, and the
  submission history on a work.
