# Roadmap: screenwriting

Screenplays written in Obsidian with Escrita, from the first scene heading to a PDF a
producer, a contest or a film school will accept. Export is the heart of this roadmap:
a screenplay is judged on its format before anyone reads a line, and today there is no
offline, mobile-safe way to get from an Obsidian note to an industry-format PDF.

Versions are decided in [ROADMAP.md](ROADMAP.md). Feature references use **SP**
followed by the section number.

Same ground rules as the other roadmaps and [ARCHITECTURE.md](ARCHITECTURE.md): **no
network, no AI**; generic settings with English defaults (the author's values in the
vault's `data.json`); design mockups on the canvas before UI work; suggest, never
rewrite prose; mobile-safe; pure logic tested with vitest.

## Where it fits

Escrita is the writing and revision plugin. A screenplay is one more kind of work, with
the same stages (idea, draft, revision, ready, published), the same desk, snapshots,
goals and darlings. What changes is the format: how the text is written, counted,
outlined and exported.

- **A screenplay is a form.** A note is a screenplay when its form property (U 1.1,
  0.6) has the screenplay value (setting; default `screenplay`, author: `roteiro`). The
  form list gets a seventh value, and "Form by folder" can map a `Roteiros` folder to it. No new kind in the classifier: it's a field, as the
  growth rule in CONTEXT.md asks.
- **Fountain inside Markdown.** Screenplays are `.md` notes written in
  [Fountain](https://fountain.io) syntax, so Obsidian's editor, links, search, sync and
  every Escrita feature keep working. Escrita doesn't register the `.fountain`
  extension; that would fight other plugins and lose the Markdown editor. Fountain
  files come in and go out through import and export (SP 6).
- **Escrita's markers stay.** Beats, placeholders and threads are `%%` comments, which
  Fountain doesn't know, so they never reach an export. Fountain's own notes (`[[…]]`)
  clash with Obsidian links, so Escrita reads `%% … %%` as notes and leaves `[[…]]` as
  links. Boneyard (`/* … */`) works as in Fountain.
- **Short films first.** The author's next months are short fiction, so the first
  target is a short film (5 to 30 pages) as a single note. Feature-length scripts as a
  book (one scene sequence per chapter) come after.

## Phases

| Phase | Contents | Effort |
|---|---|---|
| 1 | Screenplay notes and the Fountain parser (SP 1) · Export: Fountain and PDF (SP 6) | M + L. **Built in 1.1.0 (unreleased)** |
| 2 | Writing in screenplay format (SP 2) · Pages, not words (SP 4) · Scene outline (SP 3) | M + S + S |
| 3 | Revision for scripts (SP 5) · FDX export and Fountain import (SP 6) · Feature-length scripts as a book (SP 7) | M + M + M |

Export comes in phase 1 on purpose: a writer can draft in plain Fountain today, with no
help from the editor, but can't hand in the script without a correct PDF.

---

## 1. Screenplay notes and the Fountain parser

**Built in 1.1.0 (unreleased), PLAN-1.1.** What phase 1 has, where it differs from the text below:

- The form: `screenplay` is the seventh value of `FORM_KINDS` (pt-BR `roteiro`), in
  `core/form.ts`; `classify()` gives `form` on every result, so it works with the universe off. The
  three form rows (form property, form values, form by folder) moved from the Universe section to a
  "Forms" group after Books, always shown. Nothing saved changes; an old six-value list gains
  `screenplay` on its own. The Works tab has a seventh group, "Roteiros".
- The parser: `parseFountain` in `core/fountain.ts`, on `segment()`'s lines, with boneyard, the
  `Title:` block, forced elements, dual dialogue, emphasis and lyrics. An indented line is action
  (so a tab-indented `CUT TO:` is action), a `---` line is action, an unclosed `/*` is text:
  nothing is lost. Centered lines with no blank between them are one centered block. The
  Markdown disagreements are pinned in `tests/fountain.test.ts`.
- Settings (Export section, "Screenplays" group): scene heading prefixes, transition endings,
  page size, scene numbers, the "more" and "continued" labels, the credit line, and the source and
  draft date properties. **Deviation:** the title page's author and contact use the export settings
  that already exist (`authorProperty`, `authorName`, `contactLines`), not three new property names.
  The time-of-day words wait for phase 2.
- The title page: the note's title; credit, source and draft date from the settings; a `Title:`
  block fills only what is still empty.
- Character cues count as mentions in "Appears in" (universe on), unless the prose matcher or a
  link already covers them, so a cue is never counted twice. The unlinked list reads the prose
  matcher only.

- **Parser** in `src/core/fountain.ts`, pure, no `obsidian` import. It turns a note's
  body (after `segment()`, so frontmatter, code and `%%` comments are already known)
  into elements: scene heading, action, character, parenthetical, dialogue, dual
  dialogue, lyric, transition, centered, page break, section, synopsis, title page.
  Forced elements (`.`, `!`, `@`, `>`, `~`) as in the spec.
- **Tests from the spec.** The Fountain syntax examples become fixtures, plus
  Portuguese samples. Where Fountain and Markdown read a line differently (`#` is a
  section in Fountain and a heading in Markdown, `>` is a transition or centered text
  in Fountain and a quote in Markdown), the screenplay wins inside a screenplay note,
  and the cases are pinned in tests like `tests/markdown-consumers.test.ts`.
- **Portuguese and other languages.** Fountain finds scene headings by `INT`, `EXT`,
  `EST`, `INT./EXT` and `I/E`, and transitions by an uppercase line ending in `TO:`.
  Brazilian scripts use the same `INT.` and `EXT.` but write transitions as `CORTA
  PARA:` and `FUSÃO PARA:`. Settings: scene heading prefixes (default the Fountain
  list) and transition endings (default `TO:`; author: `TO:`, `PARA:`). Character cues
  are uppercase and may have accents (`JOÃO`, `CONCEIÇÃO`).
- **Title page** from the note's properties, not from Fountain's `Title:` block, so it
  shows in Obsidian's properties panel: title (the note's title), credit, author,
  source, draft date, contact. Property names are settings. A Fountain `Title:` block
  at the top is also read, for scripts pasted from elsewhere.
- **Characters link to the universe.** In universe or per-book mode, a character cue
  matching an entry's name or alias counts as an appearance (feeds "appears in", U
  1.2), so a character can move from a conto to a short film.

## 2. Writing in screenplay format

- **Live Preview layout.** A CodeMirror decoration lays out each element as on the
  page: scene headings bold, character cues and dialogue indented to their columns,
  transitions to the right. Optional monospace font (Courier Prime if installed, else
  the theme's monospace). Source mode stays plain. Reading view gets the same layout
  through a post-processor.
- **Tab and Enter, as in screenwriting programs.** Enter after a character cue starts
  dialogue; Enter twice after dialogue goes back to action; Tab on an empty line cycles
  action → character → transition → scene heading. This extends the editor's Enter
  flow; it only types the line breaks and capitals a writer would type by hand, and
  undoes in one step.
- **Suggestions.** Character names and locations already used in the script (and
  universe entries) are offered as you type a cue or a scene heading, through
  Obsidian's `EditorSuggest`. Time-of-day words are a setting (default `DAY`, `NIGHT`,
  `CONTINUOUS`, `LATER`; author: `DIA`, `NOITE`, `CONTÍNUO`, `MAIS TARDE`).
- **Dialogue focus** (SF 7) and the **revision lens** (SF 5) read Fountain dialogue
  and action instead of quote marks and dashes.

## 3. Scene outline

The outline for a single note (SF 3) learns scenes: each scene heading is a row, `#`
sections group them into sequences or acts, and `=` synopses show under the scene.
Beats keep working. Moving a scene uses "Move a paragraph or scene" (SF 8), with the
scene heading as the boundary.

## 4. Pages, not words

- A screenplay is measured in **pages** (one page is about one minute of screen time).
  The page count comes from the same pagination as the PDF export (SP 6), so the
  number in the status bar is the number on the last page of the PDF.
- `unit: pages` joins words and characters as a unit for targets and limits (SF 2):
  a contest asking for at most 15 pages is a `limit: 15` with `unit: pages`. Daily
  goals still count words, since that's what a writer types.
- The explorer, the desk's home block and the works tab show pages for screenplays.

## 5. Revision for scripts

- **Script report** (a panel or a section in the lens panel): scenes by INT/EXT and by
  time of day, pages per scene, and for each character the number of scenes, lines of
  dialogue and words spoken. Useful for casting a short film and for spotting a
  character who disappears.
- **Lens rules for scripts**: action paragraphs longer than four lines, parentheticals
  that direct the actor too much (a list in the word-lists note), a character cue
  spelled two ways (the name-variant rule).
- **Locked pages, revision colors and scene numbers** are production features and stay
  out (see the end of this file). Snapshots (SF 4) already compare drafts word by word.

## 6. Export

**Built in 1.1.0 (unreleased), PLAN-1.1.** Phase 1 has the Fountain and PDF writers; FDX and
import stay in phase 3. What it does, and the decisions:

- A screenplay is a **single note** whose form is screenplay. It exports as PDF (US Letter by
  default, or A4) or Fountain only; no prose format. Books and collections stay prose even if
  they hold screenplay notes (feature-length scripts are SP 7).
- The PDF is `core/pdf.ts` (PDF 1.4, the base-14 Courier faces, WinAnsi, `?` for what Courier
  can't print, listed in the preview first) and `core/screenplay-pages.ts` (`paginate`).
  **Lines per page: Letter 55, A4 57** (Afterwriting's A4 profile; the first guess of 58 was
  wrong). **Columns (the industry layout):** action 60 characters from column 15 (A4 57), dialogue
  35 from column 25, parenthetical from 30 to 55, the cue at column 37.
- **Splits:** a speech splits across pages only at a sentence end, with the "more" label at the
  bottom and `NAME (continued)` at the top; a speech with no sentence end moves whole to the next
  page. There is **no automatic CONT'D** when a character speaks again after action, and **no
  CONTINUED: marks**: the writer types the extension when wanted. A scene heading is never left
  alone at the bottom (it keeps a short action or a speech with it), a parenthetical never ends a
  page, a transition stays with the scene before.
- The Fountain writer inverts the parser's rules (`@`, `.`, `!`), checking each forced mark with the
  parser itself. `%%` notes are dropped; "Keep notes" in the modal writes them as `[[note]]`
  paragraphs (off each time). Escrita's parser reads those back as link text, so notes are not in
  the round trip, and there is no Fountain import.
- File names `<title>.fountain` and `<title> (Letter).pdf` / `(A4).pdf`. "Export again" repeats a
  numbered PDF. The modal and the settings follow boards 43 and 44.
- **Checked against Afterwriting 1.17.3** (`scripts/compare-screenplay.mjs`, dev only, never
  bundled). Page counts match on all five fixtures except *My Living Memory* on A4 (16 against 15).
  Each remaining difference is decided and pinned in `tests/screenplay-pages.test.ts`: sentence-end
  splits, the industry columns, and trailing spaces are kept as ours; consecutive centered lines
  follow theirs.
- **Two questions are still open with the author (G2):** (1) a long speech with no sentence end
  moves whole to the next page; (2) an indented `CUT TO:` is action, where Fountain's spec ignores
  leading spaces outside action and would make it a transition. Today's behavior is the first
  reading in both; the fixture *Brick & Steel* on A4 gains a page from (2).

The original plan for the feature follows.

The main feature. It reuses the export pipeline from 0.8 (N 7: choose the source, strip
Escrita's markers, warn on placeholders, write the file), with screenplay writers
behind the same seam. All files are written into the vault (`vault.createBinary`), so
it works on mobile.

**Fountain (`.fountain`).** Plain text in the Fountain spec: the title page block from
properties, `%%` notes dropped (or kept as `[[…]]` notes, a checkbox), Escrita markers
removed. For other screenwriting apps (Highland, Fade In, Beat, WriterDuet, Final Draft
imports Fountain too).

**PDF in industry format.** The deliverable producers and contests ask for.

- Built in the plugin with a small PDF writer: Courier is one of the 14 standard PDF
  fonts, so no font is embedded and every character is the same width. Page layout is
  then plain arithmetic on lines and columns, which keeps the writer small and the
  pagination fully testable. Courier's standard encoding (WinAnsi) covers Portuguese
  (`ã`, `ç`, `é`, `—`, curly quotes); characters outside it are listed in a warning,
  never silently dropped.
- **Pagination rules** in a pure `src/core/screenplay-pages.ts`: 55 lines per page;
  scene headings never last on a page; dialogue split between pages with `(MORE)` at
  the bottom and `NAME (CONT'D)` at the top; a parenthetical never last on a page;
  transitions stay with the scene before; page number top right from page 2; title page
  unnumbered. Tests compare page breaks with reference scripts (fixtures in
  `tests/fixtures/`).
- **Presets**: US Letter (Courier 12, margins 1.5" left, 1" others, the usual element
  columns) and A4 for Brazil and Europe, with Portuguese labels: `(CONT.)` and
  `(MAIS)`, configurable. Optional scene numbers in both margins (for a shooting
  script), off by default.
- **Done when** a short film exported from the author's vault and the same script
  exported by a reference app have the same page count and the same page breaks.

**FDX (Final Draft XML)** in phase 3: an XML file, written with no dependency, for
producers who work in Final Draft. Paragraph types map one to one from the parser's
elements.

**Import**: a command that turns a `.fountain` file into a screenplay note (properties
from the title page, `[[…]]` notes into `%%` comments), so scripts from other apps can
come in. Phase 3. The original file is left untouched.

**Not in the plugin**: DOCX for scripts (nobody submits a script as Word), and
printing (the PDF prints).

## 7. Feature-length scripts as a book (phase 3)

A long script uses the book convention: a book note with the screenplay form and one
chapter per sequence or act. Export joins the chapters into one script with continuous
scene flow (no chapter headings), and the page count adds up across chapters. The
outline shows sequences as chapters and scenes inside them.

---

## Not in the plugin

- **Production**: breakdown sheets, scheduling, call sheets, locked pages, A/B scene
  numbers, revision colors. These belong to production software.
- **Collaboration** in real time: Obsidian Sync or Git, as for any note.
- **Stage plays and comics**: different formats; maybe later, on the same parser seam.

## Settings summary (new)

| Setting | Default | Author's vault |
|---|---|---|
| Screenplay form value | `screenplay` | `roteiro` |
| Scene heading prefixes | `INT`, `EXT`, `EST`, `INT./EXT`, `INT/EXT`, `I/E` | same |
| Transition endings | `TO:` | `TO:`, `PARA:` |
| Time-of-day words | `DAY`, `NIGHT`, `CONTINUOUS`, `LATER` | `DIA`, `NOITE`, `CONTÍNUO`, `MAIS TARDE` |
| Title page properties | `credit`, `author`, `source`, `draftDate`, `contact` | Portuguese names, author's choice |
| Page size | Letter | A4 |
| More / continued labels | `(MORE)`, `(CONT'D)` | `(MAIS)`, `(CONT.)` |
| Scene numbers in PDF | off | off |
| Screenplay font in the editor | off | (author's choice) |
