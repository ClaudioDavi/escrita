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
| 4 | Book-wide publish check and serial dashboard (v0.10) | Quick win | S |
| 5 | Longform importer (after 1.0) | Quick win | S–M |
| 6 | Companion-plugin guide (unscheduled; dropped from 0.8) | Quick win | S |
| 7 | Book compile: Markdown and DOCX (v0.8), EPUB (v0.10) | Big bet | L |
| 8 | "Read the book" view (v0.10) | Big bet | M |
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

## 4. Book-wide publish check and serial dashboard (v0.10)

Extends feature 1 of the short-fiction roadmap to chapters, for writers who release a
book one chapter at a time (a newsletter, a serial platform, a blog):

- "Publish next chapter": the first chapter in order that isn't published, through the
  same check modal.
- The outline header shows the next chapter to publish and the date of the last one.
- Check that published chapters are contiguous (no gap: chapter 5 published while 4
  isn't) — a warning, since readers would skip a chapter.
- Scheduling: a future `date` is allowed; Escrita only records it.
- Nothing about URLs or a particular site (ARCHITECTURE.md, "Standalone").

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

## 7. Book compile (stages 1–2 in v0.8, stage 3 in v0.10)

The step Scrivener users miss most, and Longform's oldest open requests.

**Single notes too.** The same export works on one note outside a book: a conto sent to
a magazine or contest needs standard manuscript format as much as a novel does. For a
single note, "choose chapters" is skipped, there are no chapter headings, and the title
page uses the note's title and count.

**Stage 1 — Markdown manuscript.** Command "Compile the book": choose chapters
(all, a range, or checked), then write one Markdown file with chapter headings
("Capítulo 1 — Título", format configurable, with a "Prologue/Epilogue" rule for
unnumbered chapters), scene breaks normalized, and all Escrita markers removed (beats,
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

Print-ready PDF is out of scope: recommend Enhancing Export or Vellum/Atticus.

**Shared with screenplay export.** Screenplay export (ROADMAP-screenplay.md, SP 6) reuses
this pipeline (choose the source, strip markers, warn on placeholders, write the file)
and adds Fountain, PDF and FDX writers. Keep the format writers behind one seam in 0.8 so
they plug in without changing it. The PDF exception is only for scripts: Courier-only
monospace layout needs no typography decisions, and the PDF is what gets submitted.

## 8. "Read the book" view (v0.10)

A read-only view of all chapters in order, rendered with Obsidian's Markdown renderer,
with chapter headings, scene breaks, and markers hidden; remembers the reading position;
clicking a paragraph opens that chapter at that line for editing. Editing stitched
chapters (true Scrivenings) is XL and fragile; recommend Continuous Mode for that.

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
