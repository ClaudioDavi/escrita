# Roadmap: versions at a glance

The one place that says what is in each version. Start here; the details of each
feature live in the three topic roadmaps:

- [ROADMAP-short-fiction.md](ROADMAP-short-fiction.md): contos, essays, and anything that
  works on a single note (so on chapters too).
- [ROADMAP-novel.md](ROADMAP-novel.md): features that need a book.
- [ROADMAP-universe.md](ROADMAP-universe.md): a shared world across works (opt-in).
- [ROADMAP-screenplay.md](ROADMAP-screenplay.md): screenplays in Fountain, with PDF export
  in industry format.

Every feature follows the rules in [ARCHITECTURE.md](ARCHITECTURE.md), including
**standalone**: Escrita is for any writer, whether or not they publish to a website,
so nothing here assumes one.

Feature references below use the short names **SF** (short fiction), **N** (novel) and
**U** (universe) and **SP** (screenplay), followed by the section number in that file.

**Every release includes at least one code improvement** from
[IMPROVEMENTS.md](IMPROVEMENTS.md), listed as "Improvement" under the version below.
Prefer one the version's features lean on.

When a version ships: move its row to "Shipped", add the changelog entry in the README,
write or update the user guide for its features (see "Documentation"), move the
improvement to "Done" in IMPROVEMENTS.md, and pick the next version's contents
(features and improvement) here before editing the topic roadmaps.

## Shipped

| Version | Contents |
|---|---|
| 0.1 | Outline and ghost beats, goals and pacing, sprints, status bar, placeholders, darlings, Enter Enter Enter, smart typography, spellcheck on demand |
| 0.2.0 | No-network guard (SF 0) · Publish check (SF 1) · Targets per piece and days off (SF 2) · Outline for a single note (SF 3) |
| 0.2.1 | Standalone publish (URL features removed) · Improvements: Markdown segmenter, file classifier |
| 0.3.0 | Word counts in the file explorer (SF 6) · Dialogue focus (SF 7) · Snapshots with word-level compare (SF 4) · Improvements: measure module, explorer decoration adapter, note text (partial) |
| 0.4.0 | The writing desk: stages and the stage snapshot (SF 11) · Home block, where you left off, open on startup (SF 11) · Move a paragraph or scene (SF 8) · Improvement: vault index |
| 0.5.0 | Revision: revision lens with six rules, dialogue share, Portuguese readability and "Ignore here" (SF 5) · Portuguese and English stemmers in `core/stem/` · Improvement: the 0.2.1 editor loose ends (and the outline's scene-break check) |
| 0.5.1 | Fix: lens marks stale after the word lists note changes · Add to crutch words, names or ignored words from the editor menu (SF 5; mockups waived by the author) |
| 0.6.0 | Universe foundations: universe modes, entries, the universe panel (Entries, Threads, Works), migration (U 1.1) · Create entry from selection (U 1.3) · Open threads (U 1.5) · Insert from a template (SF 9) · Forms, with an essay form and form by folder · Improvement: the outline's beat writes through the note text port (candidate 3, finished) |
| 0.7.0 | Characters across works: "Appears in" (U 1.2) · Names into spellcheck and the revision lens (U 1.4) · Keep a note out of the universe, `universe: false` (U 1.1) · POV and status in the outline (N 1) · Per-chapter targets (N 2) · Feature switches, the Features page (SF 10) · User guide in `docs/guide/` (English and pt-BR) · Minimum Obsidian 1.7.2 · Improvements: modules that load and unload at runtime (candidate 6), chapter rows (candidate 7) |
| 0.8.0 | Submitting work: export, Markdown and DOCX in the Shunn and pt-BR presets, for a note and a book, with a preview, "Export again" and chapters without a number (N 7, stages 1–2) · Submissions, "Record a submission" and the pending count in the home block (SF 12) · Export and submissions feature switches (19 in all) · User guide "Publishing" (English and pt-BR) · Improvements: each module owns its settings section and feature metadata (11, 20), the export foundations (15–19), mentions on demand (14), time-budgeted index passes (21), name caches and lens (22), small redraws (23) and one name fold (10) |
| 0.9.0 | The book and its world: unlinked mentions with a Link button and names without an entry as a lens rule (U 2.5) · EPUB 3 export, checked by EPUBCheck in CI (N 7, stage 3) · "Publish next chapter" and the serial line in the outline (N 4) · "Read the book" (N 8) · Collections of contos, exported as one DOCX, EPUB or Markdown file (SF 13) · User guide updated ("The world", "Publishing", "Writing", English and pt-BR) · Improvement: scope as a field on the classifier result (candidate 9) |
| 1.0.0 | The full release: set up a writing vault, with presets (Essentials, Writer, Everything), the home note and a first layout (SF 10) · Defaults in the writer's language (SF 10) · Writing mode · Mobile pass and the universe "⋯" button · User guide complete, seven pages in English and pt-BR · Fixes from the 2026-10-08 review and the demo rehearsal · Minimum Obsidian 1.8.7 · Improvements: one rule for a note's effective piece (candidate 8), shared helpers out of module folders (candidate 13) |
| 1.0.1 | Fixes from Obsidian's community plugin review: an empty snapshot folder goes to the trash, no `:has` selector in the file explorer, build and type warnings |
| 1.0.2 | Escrita is in the community plugins list: install links in the README and the guides, "short story" for "conto" in the English docs. No change in behavior |
| 1.0.3 | Settings search: Escrita's rows appear in Obsidian's settings search, through the declarative settings tab (PLAN-1.0.3) · Minimum Obsidian 1.13.0 · Fixes from the community review: no `display()`, no deprecated `setWarning`, a `moment` wrapper · Improvements: settings rows with fallbacks from the install's defaults (candidate 36) and the settings tab on the declarative settings API (candidate 51) |
| 1.0.4 | Start a new work: New work…, New short story, New book, the home block footer and the New works settings (SF 14, PLAN-1.0.4) · Deadlines by month · Improvement: path helpers in core (candidate 33) |
| 1.1.0 | Screenwriting, phase 1: screenplay notes in Fountain, `screenplay` as the seventh form, character cues in "Appears in", the Forms group after Books (SP 1) · Fountain and PDF export, US Letter or A4, with a preview and the Screenplays settings (SP 6) · The end-to-end harness (204 tests) · Fixes: the Progress chart after a met goal, the entry tab hiding the chapter, the reader's jump on an edit, setting up again in a finished vault · Improvement: export writers share the title page, the modal splits (candidate 46) |
| 1.1.1 | Code only, no new feature (PLAN-1.1.1): the review bot's warnings cleared (the e2e harness under `tests/`, underlines as backgrounds, the export preview indent as a spacer) · four fixes for a broken `data.json` · Improvement: one settings table (candidate 53, the schema half of 37) |
| 1.2.0 | Writing a script and reading a story: the screenplay editor, a 20th switch on in Screenwriter and Everything only: Live Preview lays out each Fountain element as on the page, Tab and Enter as in screenwriting programs, capitals as you type, forced marks, and suggestions for cues, places and times of day, with two commands for phones (SP 2) · Read this note: the reader for a conto, an essay or a collection (SF 15) · Rhythm in the lens panel (SF 16) · A fix for typing lost when a new tracked note got its draft status (`NoteService.flush`) · User guide updated in both languages · Improvements: editor glue and "reveal on touch" (38) and "Read the book" rebuilds when the metadata cache is ready (52); the first slice of 47 |
| 1.2.1 | Fixes: Enter in an outline beat lands in the new beat field (a forced refresh saves the open editors first) · Tab in a beat writes under it (small addition) · smart typography on for every note by default (new installs) · Escrita's own notes (the darlings notes, the word lists note) are never works, a new `own` field on the classifier result · the screenplay layout no longer flickers on save · stepping through a lens rule keeps the panel's place · Improvement: required classifier settings and one plugin-folder root (candidate 43) |
| 1.2.2 | Fix: an open `%%` comment no longer inflates the daily word count (the measurer's `Counts.open`, the goals tracker's `countedChange`) · Improvement: the stale `unclosedComment` re-export removed (a slice of candidate 49) |

## 1.1, screenwriting (phase 1): shipped

**Shipped** as 1.1.0 on 2026-10-16. Plan and results: [PLAN-1.1.md](PLAN-1.1.md), from
[ROADMAP-screenplay.md](ROADMAP-screenplay.md).

A screenplay is a note in Fountain. Phase 1 makes a script a first-class note and gets it
out the door as a correct PDF; the editor help comes in phase 2. Serves drafting and
submitting. Upkeep: none beyond marking a note as a screenplay.

| Feature | Ref | Effort | Status |
|---|---|---|---|
| Screenplay notes and the Fountain parser: `screenplay` is the seventh form value, Fountain read in the note, character cues count in "Appears in", the form rows moved to a "Forms" group after Books and work with the universe off | SP 1 | M | Shipped |
| Export: Fountain and PDF in industry format (Letter or A4), with a preview, warnings and the "Screenplays" settings group | SP 6 | L | Shipped |
| End-to-end checks: a Playwright harness that drives Obsidian and runs the by-hand checks (`tests/e2e/`, `npm run e2e`, local only, see [TESTING.md](TESTING.md)) | not a feature | M | Shipped (204 tests) |

**Improvement:** export writers share the title page, the modal splits (candidate 46),
plus the five known issues and the test-only aliases from 33. In "Done" under 1.1 in
IMPROVEMENTS.md.

**Also fixed in 1.1:** the Progress chart is back for anyone who has met a goal; creating an entry
from a selection keeps the chapter in front; "Read the book" keeps the text in view when a chapter
changes; setting up again in a finished vault says there is nothing to do.

**What was open after 1.0, and where each went:**

| Open item | Outcome |
|---|---|
| Gate G0d, 0.7: the Reading-view "Appears in" section across re-renders | Closed as decided: Reading view shows the panel only, no post-processor. `tests/e2e/specs/appears-in-reading.spec.ts` checks it across 5 toggles, a split and a 200-line entry |
| Gate G0d, 0.9: "Read the book" timings on a 30-chapter book | Measured (`tests/e2e/specs/read-book.spec.ts`, 31 chapters, 90,951 words). First text on screen 8–18 ms (painted 29–60 ms); longest task while scrolling 22.9–28.4 ms, none of 50 ms, accepted at 30 ms (the 20 ms bar was missed by 3–8 ms); typing in a 3,000-word chapter 7.5–9.6 ms |
| The by-hand checks of TEST-0.9 and TEST-1.0 | Run by the harness. What needs an eye stays in PLAN-1.1, "By-hand checks (G2)": the pictures, a PDF in a reader, writing mode with a third-party theme |
| The reader's startup race (a `compile: false` chapter read as included) | Candidate 52 in IMPROVEMENTS.md (not in 1.1; fixed in 1.2.0) |
| Phone gates | Waived (no phone to test on, 2026-10-05) |

**Closed by the author (2026-10-16, follow the spec and other tools):** a speech with no sentence
end moves whole to the next page (kept), and indents follow the Fountain spec (ignored outside
action; an indented `CUT TO:` is a transition).

## 1.2, writing a script and reading a story: shipped

**Shipped** as 1.2.0 on 2026-10-19. Planned with the author the same day. Plan and results: [PLAN-1.2.md](PLAN-1.2.md).

Three features that help while drafting and revising, chosen over universe phase 2 because the
author's next months are short forms (contos, essays, short films). Upkeep for the writer: none.

| Feature | Ref | Effort | Stage | Status |
|---|---|---|---|---|
| The screenplay editor: Live Preview lays out each Fountain element as on the page, Tab and Enter as in screenwriting programs, suggestions for characters, places and times of day. A new switch, `screenplay` (the 20th) | SP 2 | M | Draft | Shipped |
| Read a note: "Read the book" for a single conto or essay, and for a collection's contos in order | SF 15 | S | Revision | Shipped |
| Sentence rhythm: a strip of bars in the lens panel, one per sentence of the paragraph at the cursor, with runs of same-length sentences marked | SF 16 | S | Revision | Shipped |

**Improvements:** editor glue and "reveal on touch" in `src/ui/` (candidate 38; the screenplay
layout is the fifth decoration plugin and is built on it) and "Read the book" rebuilds when the
metadata cache is ready (candidate 52; the reader for a note touches the same code). Both are in
"Done" under 1.2.0 in IMPROVEMENTS.md. The rhythm also did the first slice of candidate 47.

**What differs from the plan:** elements got no `endLine` (a `fountainLines` function does the
same job without changing `parseFountain`); the `---` rule between scenes is drawn by CSS, so a
typed `-----` shows as `---` until the cursor is on it; a missing switch reads as off, and an
install whose other switches all match Everything gets it on. The pre-existing data-loss bug in
`draftIfNew` was found by the screenplay spec and fixed in this version. Open items are in
IMPROVEMENTS.md, "Known issues".

**Not in 1.2:** Reading view layout for screenplays, Fountain in dialogue focus and the lens
(moved to SP 5), pages as a unit (SP 4) and the scene outline (SP 3).

## Next: universe phase 2

Timeline, dates, facts over time, continuity and canon (U 2.1–2.4), moved out of 0.9 on
2026-10-06, and after 1.2 since 2026-10-19. Not planned in detail yet: the version, its
improvement and a `PLAN-<version>.md` come when it is planned. Natural improvements: 57 (the
works of a scope) and 58 (typed property readers). The draft design is in
`research_notes/0.9-dates-draft/` (local).

## 0.5 to 1.0

1.0 is the full release: **the shared universe and manuscript export**. The versions
before it build toward those two, contos first (the author's next months are short
fiction), then the universe, then book features. Planning the writing desk as 0.4
(2026-10-01) moved every later version up by one; on 2026-10-06 the book features of
0.10 merged into 0.9, so 1.0 follows 0.9. The desk
shipped as 0.4.0 and the lens as 0.5.0.

1.0 shipped on 2026-10-09. Next: screenwriting (`ROADMAP-screenplay.md`), then universe
phase 2 (U 2.1–2.4).

Improvements: later versions pick from IMPROVEMENTS.md when they're planned in detail.

Notes:

- The writing desk (0.4, shipped) came from a design review on 2026-10-01: Escrita was a set
  of features without a workflow. The test it set for every feature: **fewer things to
  manage**. A feature that needs upkeep from the writer has to earn it. A works tab
  and a three-pane library were considered and dropped as too much to manage.
- The stemmers shipped with the lens (0.5), before the universe; U 1.2 and 1.4 (0.7)
  reuse them. The vault index (0.4) is also ready for "appears in".
- Export ships DOCX first (0.8): a conto in standard manuscript format is what contests
  and magazines ask for. Submissions (SF 12) ship with it, since sending a work out is
  what export is for. EPUB matters mostly for a finished book (0.9.0).
- Per-chapter targets (N 2) is small: chapters already take `target` / `limit` since 0.2;
  what's left is the bar in the outline and a book default.
- The universe's "appears in" (U 1.2) replaces Codex-lite (N 9), which is dropped.
- Ideas taken from Tris's "Obsidian for Writers" and from comparing with StoryLine
  (2026-10-01): SF 8–10, the lens measures (SF 5), and details in U 1.2, U 1.3, U 2.1,
  U 2.3, N 6 and N 7. StoryLine owns planning boards (corkboard, plot grid, beat sheets);
  Escrita doesn't compete there and stays the writing and revision plugin, Portuguese
  first.

## Documentation

Escrita's user documentation is a **guide in the repo**, in English and pt-BR, written
as the features ship rather than all at once before 1.0. No website (rule 5): plain
Markdown files that read well on GitHub and inside a vault.

**Where.** `docs/guide/en/` and `docs/guide/pt-BR/`, the same file names in both. Images,
if any, sit in `docs/images/` (the GIFs and videos of the guides and the README). The universe guide moved there in 0.7, as
`docs/guide/en/the-world.md` (and its pt-BR twin).

**The guides**, one per stage of a work's life, the way the Features page groups them:

| Guide | Covers |
|---|---|
| Getting started | Install, the first conto, the first book, the home note. From 1.0, the setup command |
| Writing | Outline and ghost beats, reading a note (1.2), goals and sprints, placeholders, Enter flow and typography, dialogue focus, moving blocks, templates, explorer counts |
| Revision | The revision lens and its word lists, snapshots, darlings |
| Tracking | Stages, the stage snapshot, the home block and where you left off |
| Publishing | The publish check; export and submissions (0.8); EPUB, collections, publishing a book chapter by chapter (0.9) |
| The world | The universe, entries, "appears in", open threads (today's universe guide) |
| Features and settings | The Features page, what each switch turns off, presets (1.0) |
| Other plugins | The companion-plugin guide (N 6), unscheduled since 2026-10-05: written only if a need shows up |

File names: `getting-started.md`, `writing.md`, `revision.md`, `tracking.md`, `publishing.md`,
`the-world.md`, `features-and-settings.md`, `other-plugins.md`. 0.7 wrote `the-world.md`,
`features-and-settings.md` and `writing.md` (its 0.7 parts only), in both languages.

Each guide explains a task first ("revise a conto"), then the commands and settings it
uses. Every command and setting appears in one guide.

**The README** becomes the front door: what Escrita is, install, one line per feature
linking to its guide, and the changelog. The long per-feature sections move into the
guides.

**Per version.** From 0.7, each version writes or updates the guide pages for its
features, in both languages, as part of shipping. 0.7 creates the folder, moves the
universe guide, and writes "Features and settings" and the 0.7 parts of "The world"
and "Writing" (per-chapter targets, POV). The guides for features that shipped before
0.7 (0.1 to 0.6) are written by 1.0, a few per version when a version has room.

**Done (1.0) when** a new writer can go from install to a first conto with only
"Getting started"; every command and setting is in a guide; the two languages match;
and the README links to every guide.

## After 1.0

| Feature | Ref | Effort | Note |
|---|---|---|---|
| Book-wide snapshots and revision reports | N 10 | M | Builds on SF 4, SF 5 |
| Companion-plugin guide (unscheduled) | N 6 | S | Dropped from 0.8 on 2026-10-05; written only if a need shows up (for example, a StoryLine clash reported by a writer) |
| Longform importer | N 5 | S–M | Not wanted for 1.0 |
| Screenwriting, phase 1: screenplay notes, Fountain parser, Fountain and PDF export | SP 1, SP 6 | M + L | Shipped in 1.1.0 (see "1.1" above). Export first: a script can be drafted in plain Fountain, but can't be handed in without a correct PDF. Builds on the 0.8 export pipeline and the `form` property (0.6) |
| Screenwriting, phase 2: screenplay layout and Tab/Enter in the editor, pages as a unit, scene outline | SP 2–4 | M + S + S | SP 2 shipped in 1.2.0 (without Reading view); SP 3 and SP 4 after |
| Screenwriting, phase 3: script report, FDX export, Fountain import, feature-length scripts as a book | SP 5–7 | M + M + M | |
| Universe phase 2: story timeline, `when` and eras, narrative mode, shift dates, facts over time, continuity checks, canon | U 2.1–2.4 | L | After screenwriting. Planned for 0.9 and moved on 2026-10-06 as bloat at this stage; the draft design is in `research_notes/0.9-dates-draft/` (local) |
