# Roadmap: novel writing (later)

Versions are decided in [ROADMAP.md](ROADMAP.md); the table below mirrors them.

Features for when the author starts a novel. They build on the book convention
already in place (a book note next to a folder with a chapters subfolder; see
[ARCHITECTURE.md](ARCHITECTURE.md)) and on the short-fiction roadmap
([ROADMAP-short-fiction.md](ROADMAP-short-fiction.md)), which should ship first.

Same ground rules: **no network, no AI**, generic settings with English defaults,
design mockups on the canvas (https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6)
before UI work, suggest-never-rewrite, mobile-safe.

Background research: `reports/Obsidian fiction writing gaps.md` (local only). The
opportunity it found: Longform, the reference novel plugin, is looking for a new
maintainer and has years-old open requests (a continuous view of all chapters, choosing
what to compile, DOCX/EPUB, prologue numbering). StoryLine took the feature-maximalist
spot but is English-centric and desktop-leaning. What's open is a focused, trustworthy,
mobile-safe manuscript tool with first-class Portuguese.

## Priority order

| # | Feature | Tier | Effort |
|---|---|---|---|
| 1 | POV and status in the outline (shipped in 0.7.0) | Quick win | S |
| 2 | Per-chapter targets (shipped in 0.7.0) | Quick win | S |
| 3 | ~~Dialogue focus~~ (moved to short fiction, feature 7, v0.3) | — | — |
| 4 | Book-wide publish check and serial dashboard (v0.9) | Quick win | S |
| 5 | Longform importer (after 1.0) | Quick win | S–M |
| 6 | Companion-plugin guide (unscheduled; dropped from 0.8) | Quick win | S |
| 7 | Book compile: Markdown and DOCX (shipped in 0.8.0), EPUB (v0.9) | Big bet | L |
| 8 | "Read the book" view (v0.9) | Big bet | M |
| 9 | ~~Codex-lite~~ (replaced by the universe's "appears in", shipped in 0.7.0) | — | — |
| 10 | Book-wide snapshots and revision reports (after 1.0) | Big bet | M |

Effort: S a few days, M one to two weeks, L several weeks.

---

Word counts next to chapters, the book note and book folders in the file explorer are
planned in [ROADMAP-short-fiction.md](ROADMAP-short-fiction.md), feature 6 (v0.3), together
with contos and essays. Snapshots of a single chapter come with feature 4 (v0.3); feature 10
below extends them to the whole book.

## 1. POV and status in the outline (v0.7, shipped in 0.7.0)

The design already shows status dots; "color by POV" was left out of v0.1.

- A POV color stripe per chapter from a `pov` property (name configurable). A link
  (`[[Maria]]`) or plain text both work; colors assigned per distinct value, stable
  across sessions (stored in plugin data), editable.
- A toolbar toggle in the outline: color by status / by POV.
- Filter by status and POV (chips in the header).
- Header summary: "3 rascunho · 2 revisão · 4 publicado". It counts stages, each labelled
  with the writer's own word for it (the first word of the stage).
- Reordering (drag) and renumbering are off while a filter is on, so a partial list never
  renumbers a book (rule 1). The header says "Showing 2 of 5 · Clear".

## 2. Per-chapter targets (v0.7, shipped in 0.7.0)

Reuse the `target` / `limit` / `unit` properties from the short-fiction roadmap on
chapters. The outline shows a small bar per chapter when a target exists. A property on
the book note (`chapterTarget`; the name is a setting) gives each chapter a default
target when it has none of its own. Only `target` inherits: a chapter's own `limit`,
`deadline` and `unit` are kept, and the book note's `unit` is the default unit. The
default shows in the outline only, so the file explorer may show no target where the
outline shows a bar (a later improvement closes that gap).

## 3. Dialogue focus (moved)

Moved to [ROADMAP-short-fiction.md](ROADMAP-short-fiction.md), feature 7, and scheduled
for v0.3: it works on any note, so contos get it too.

## 4. Book-wide publish check and serial dashboard (v0.9)

Extends feature 1 of the short-fiction roadmap to chapters, for writers who release a
book one chapter at a time (a newsletter, a serial platform, a blog):

- "Publish next chapter": the first chapter in order that isn't published, through the
  same check modal.
- The outline header shows the next chapter to publish and the date of the last one.
- Check that published chapters are contiguous (no gap: chapter 5 published while 4
  isn't) — a warning, since readers would skip a chapter.
- Scheduling: a future `date` is allowed; Escrita only records it.
- Nothing about URLs or a particular site (ARCHITECTURE.md, "Standalone").

**Built in 0.9, not yet released.** Where it differs from the text above:
- **No serial dashboard view** (rule 3): the outline header shows one line, only while the publish
  feature is on and at least one chapter is published: the gaps ("Gap: 04"), "Next: 05 A volta" and
  "last published 30 Sep". A last chapter with no date shows its title, not an earlier date (Q23).
  A future date is shown as written (D5); the model needs no clock.
- **What counts**: a chapter whose status maps to the published stage. Chapters left out by
  `compile: false` and unnumbered ones ("Chapters without a number", a 00 chapter) are not in the
  sequence (`publish/serial.ts`).
- **"Publish next chapter"** is a command and a header button (the button waits for a first
  published chapter). It opens the chapter first, then the same check modal as a single note. The
  gap is a warning in that check, never a block, and it names every earlier unpublished chapter.
- Open for the author: naming only the nearest gap; falling back to the outline's book when the
  vault has more than one.

## 5. Longform importer (after 1.0)

Longform stores a project in the index note's frontmatter (`longform:` with `format`,
`title`, `draftTitle`, `scenes` as a nested list, `sceneFolder`, `ignoredFiles`).

- Command "Import a Longform project": pick the index note, preview the result (chapters
  in order, nested scenes flattened or merged — ask), then create an Escrita book: book
  note (keeps the index note's properties), chapters folder, numbered chapter files
  (copy by default; move only on explicit choice).
- Never delete the Longform files. Tests on real Longform frontmatter samples.

## 6. Companion-plugin guide (unscheduled)

**Dropped from 0.8 on 2026-10-05** by the author: written only if a need shows up.

A settings section and README page recommending healthy plugins instead of rebuilding
them: LanguageTool (the only real pt-BR grammar checker; can point to a self-hosted
server), Typewriter Mode, Continuous Mode, Enhancing Export (print PDF), Chronos and
Calendarium (timelines), Excalidraw and Canvas (boards), Obsidian Git (history).
Re-check maintenance status before each release; list the date checked.

Running Escrita next to **StoryLine**: say what to watch. StoryLine writes `status`
(idea → final), `wordcount` and `charcount` into scene files, which can clash with
Escrita's status values and fill its "modified" events while typing. Suggest pointing
Escrita's status property elsewhere or keeping StoryLine's scenes out of the track
folders, and check both together before 0.8 ships.

## 7. Book compile (stages 1–2 in v0.8, shipped in 0.8.0; stage 3 in v0.9)

The step Scrivener users miss most, and Longform's oldest open requests.

**Single notes too.** The same export works on one note outside a book: a conto sent to
a magazine or contest needs standard manuscript format as much as a novel does. For a
single note, "choose chapters" is skipped, there are no chapter headings, and the title
page uses the note's title and count.

**Stages 1 and 2: shipped in 0.8.0.** What the build decided, where it
differs from the text below (PLAN-0.8.md has the full record):
- **One command.** "Export…" replaces "Compile the book". It works on the active note or
  its book, and one modal picks the source, the chapters, the format and the preset. The
  modal remembers the last choices per work.
- **Prologue and epilogue.** There is no prologue property. A chapter with a number prefix
  gets the heading format (`{n}`, `{title}`). A prologue is named with a 00 prefix ("00
  Prólogo"): it sorts first and gets its title alone. A file without a number sorts last
  and also gets its title alone, so it suits an epilogue. Numbering counts only chapters
  numbered 1 or more. Extended 2026-10-06: a settings list, "Chapters without a number"
  (`unnumberedTitles`, English defaults), names titles that export with their title alone and
  are not counted, so every file can be numbered normally (01 Prefácio, 02 Prólogo, 03 A chegada
  gives Prefácio, Prólogo, Capítulo 1). The outline label follows the same count.
- **Preview (Q16).** A reading column, not pages, drawn from the same model the writers
  use, so it can't drift from the file. No page breaks or page numbers.
- **Export again (Q17).** The modal shows the last export (format, preset, chapters, date,
  file) with a one-click repeat, and a palette command, "Export again". Readiness warnings
  still need "Export anyway".
- **File names.** `<title>.md` or `<title> (<preset>).docx`, in the export folder (default
  `Escrita/Exports`). If the file exists: cancel, replace (offered only for an export; a
  recorded last export is written over, any other goes to the trash first) or keep both,
  which names the new file by this export's date and time
  (`<title> (<preset>) YYYY-MM-DD HHhMM.docx`).
- **Author (Q2).** Settings: author name, surname (empty means the last word of the name)
  and contact lines. An `author` property on the book or note overrides the name.
- **Count (Q8).** The title page count is the measurer's, rounded to 100 below 10,000 and
  to 500 above, with "about"; characters when the work's unit is characters.
- **Front matter.** Book only: `dedication` and `epigraph` properties link to notes whose
  prose becomes a page. A single note has only its title page.
- **Tracking.** The export folder is kept out of tracking like the snapshots folder:
  never tracked, never a work, no draft status.

**Stage 1 — Markdown manuscript.** Command "Compile the book": choose chapters
(all, a range, or checked), then write one Markdown file with chapter headings
("Capítulo 1 — Título", format configurable, with a "Prologue/Epilogue" rule: "00 Prólogo" first, an
unnumbered file last, both with the title alone), scene breaks normalized, and all Escrita markers removed (beats,
placeholders, `%%` comments). Warns when placeholders remain. Scene breaks
come out as the chosen separator (blank line, `#`, `* * *` or custom text; the presets
set one), never at a chapter boundary. A chapter with `compile: false` (property name
configurable) stays out without being moved or deleted, for drafts parked inside the
book. Front matter (title page,
dedication, epigraph) from optional notes named in the book note's properties.

**Stage 2 — DOCX.** Built in the plugin with a small, offline DOCX writer (a zip of
XML; a dependency like `docx` is fine as long as it's pure JS and makes no network
calls) — Pandoc can't be assumed on mobile. Two presets:
- Standard manuscript format (Shunn): 12 pt Times New Roman, double spacing, 1" margins,
  0.5" first-line indent, header "Surname / Title / page", title page with rounded
  word count, each chapter on a new page, `#` for scene breaks.
- pt-BR editorial preset: same, with Portuguese labels, travessão dialogue kept, and
  A4 page size.

**Stage 3 — EPUB 3.** Also a zip of XHTML; `lang="pt-BR"`, table of contents
("Sumário"), chapter openers, ornamental scene break (`∗ ∗ ∗` or configurable), cover
image from the book note. Validate against EPUBCheck in CI with a fixture book (CI
may use Java; the plugin itself stays offline).

**Built in 0.9, not yet released.** What the build decided:
- A third format in the Export modal, for a note, a book and (SF 13) a collection, with the same
  chapter choice, warnings, preview and "Export again". The file is `<title> (<preset>).epub` (D2).
- Contents: a title page, dedication and epigraph pages (only when they have text), a table of
  contents (EPUB 3 nav plus an NCX), one XHTML file per chapter, no running header or word count.
  The presets set the language and labels; the **scene break is the `epubSceneBreak` setting**
  (default `* * *`), not the preset's.
- **The cover** is a `cover` property (a setting, rule 6) on the book note, or on a standalone
  note's own frontmatter (D3), linking a JPEG or PNG. A missing or unreadable image is a readiness
  warning and the export goes on without it.
- The identifier is a `urn:uuid` derived from the work's path and title, so re-exporting keeps it.
  Images inside the prose are still dropped and listed, as in 0.8.
- EPUBCheck 5.4.0 passes the `ptbr` fixture with the cover (no errors or warnings). The CI job
  downloads the latest EPUBCheck and first runs when the 0.9 pull request opens. Rendering in a
  real reader (Calibre, Apple Books) is left for the manual check.

Print-ready PDF is out of scope: recommend Enhancing Export or Vellum/Atticus.

**Shared with screenplay export.** Screenplay export (ROADMAP-screenplay.md, SP 6) reuses
this pipeline (choose the source, strip markers, warn on placeholders, write the file)
and adds Fountain, PDF and FDX writers. Keep the format writers behind one seam in 0.8 so
they plug in without changing it. The PDF exception is only for scripts: Courier-only
monospace layout needs no typography decisions, and the PDF is what gets submitted.

## 8. "Read the book" view (v0.9)

A read-only view of all chapters in order, rendered with Obsidian's Markdown renderer,
with chapter headings, scene breaks, and markers hidden; remembers the reading position;
clicking a paragraph opens that chapter at that line for editing. Editing stitched
chapters (true Scrivenings) is XL and fragile; recommend Continuous Mode for that.

**Built in 0.9, not yet released.** Where it differs from the text above:
- A view in the main area (type `escrita-reader`), from the command and a header button. It reuses
  the tab already reading that book. Every included chapter in order, headed as the export heads
  it (D7: the chapter-heading setting, else the language's preset), with markers hidden by the same
  manuscript model as the export. Chapters render as they scroll into view.
- **No chapter rail and no progress bar** (D6); the outline navigates.
- A click on a paragraph opens its chapter **in a new tab** at that line.
- The position (chapter and line) is kept per book in `data.json` and follows renames; deleting a
  chapter sends it back to the top. The view doesn't redraw a chapter when its text changes, only
  on create, delete and rename. It has no DOM test, and gate G0d (time to the first chapter, the
  longest block while scrolling a 30-chapter book) is unmeasured.

## 9. Codex-lite (replaced)

Replaced by [ROADMAP-universe.md](ROADMAP-universe.md) 1.2 "Appears in" (v0.7), which
covers the same ground at universe scope and also works per book. Kept below for
reference.

Novelcrafter's Codex without AI, and with Portuguese-aware matching.

- Entries are the notes already in the book's `Personagens/`, `Lugares/` (folders
  configurable) with `aliases` in frontmatter.
- Matching: names and aliases matched as whole words, case-insensitive by default,
  with Portuguese inflections (plural, feminine, diminutive: *Maria / Mariazinha*,
  *menino / meninos / menina*) via the stemmer from the revision lens; an ignore list
  per entry for common words (a character named "Rosa").
- Mentions: each entry lists the chapters and lines mentioning it; optional subtle
  underline in the editor.
- Reports (a view in the book note or a modal): a matrix of entries × chapters
  (mentioned in text vs POV vs tagged by hand), POV distribution, chapter lengths,
  and "last seen" per character (e.g. "Teo hasn't appeared since chapter 4").
- Continuity: an optional `born` property on characters and a `when` property on
  chapters give computed ages per chapter, and a warning when a character appears in a
  chapter dated after a `died` property.

## 10. Book-wide snapshots and revision reports (after 1.0)

- "Snapshot the whole book" (one named snapshot across all chapters) and a
  "what changed since snapshot X" table: words added/removed per chapter.
- The revision lens report across all chapters: rates per chapter, so a chapter with
  twice the echoes or adverbs stands out.

---

## Out of scope for the plugin

- **Beta readers**: needs hosting (private chapter links, inline comments, how far each
  reader got), which a local plugin can't provide. Readers' notes can come back into
  the vault as ordinary notes.
- **Comments / suggestion mode**: Commentator exists (beta); don't build a competing editor.
- **Maps, fantasy calendars, relationship graphs, plot-template libraries**: other
  plugins do these, and they matter little for literary fiction.
- **Any AI feature.** If ever wanted, it would be a separate companion plugin: analysis
  only, local models only, off by default. Brazil's Prêmio Jabuti excludes AI-assisted
  works, which is reason enough for Escrita itself to stay AI-free.
