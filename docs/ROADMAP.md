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

## Next: 1.0, the full release

Stabilization and setup: a mobile pass, the user guide complete in English and pt-BR (see
"Documentation"), migrations tested on the author's vault, and the community plugin
submission. Serves every stage: a new writer sits down and writes. Upkeep: none; the setup
runs once.

| Feature | Ref | Effort | Note |
|---|---|---|---|
| Set up a writing vault: the home note and a first writing layout, with presets (Essentials, Writer, Everything) on the 0.7 feature switches | SF 10 | M | |
| Defaults in the writer's language: Portuguese status words, folders and word lists when Obsidian runs in Portuguese | SF 10 | S | |
| Stabilization: mobile pass, the user guide complete, migrations tested on the author's vault | Docs | M | Phone gates stay waived (no phone to test on) |
| Community plugin submission | — | S | |

**Improvement:** to be picked from IMPROVEMENTS.md when 1.0 is planned in detail; the
0.9 simplify review added candidates 24–32.

The timeline, dates, facts over time, continuity checks and canon (U 2.1–2.4) were
planned for 0.9 and moved after screenwriting on 2026-10-06: bloat at this stage.

Open from 0.7, on desktop: gate G0d (the Reading-view "Appears in" section across
re-renders) and the visual check against the canvas (PLAN-0.7.md, task 5.2). The phone
gates (G0c, G0h) are waived: the author has no phone to test on, so mobile behaviour is
assumed from the documented API (2026-10-05).

## 0.5 to 1.0

1.0 is the full release: **the shared universe and manuscript export**. The versions
before it build toward those two, contos first (the author's next months are short
fiction), then the universe, then book features. Planning the writing desk as 0.4
(2026-10-01) moved every later version up by one; on 2026-10-06 the book features of
0.10 merged into 0.9, so 1.0 follows 0.9. The desk
shipped as 0.4.0 and the lens as 0.5.0.

1.0 is planned above, under "Next". After it: screenwriting (`ROADMAP-screenplay.md`), then
universe phase 2 (U 2.1–2.4).

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
if any, sit in `docs/guide/images/`. The universe guide moved there in 0.7, as
`docs/guide/en/the-world.md` (and its pt-BR twin).

**The guides**, one per stage of a work's life, the way the Features page groups them:

| Guide | Covers |
|---|---|
| Getting started | Install, the first conto, the first book, the home note. From 1.0, the setup command |
| Writing | Outline and ghost beats, goals and sprints, placeholders, Enter flow and typography, dialogue focus, moving blocks, templates, explorer counts |
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
| Screenwriting, phase 1: screenplay notes, Fountain parser, Fountain and PDF export | SP 1, SP 6 | M + L | Export first: a script can be drafted in plain Fountain, but can't be handed in without a correct PDF. Builds on the 0.8 export pipeline and the `form` property (0.6) |
| Screenwriting, phase 2: screenplay layout and Tab/Enter in the editor, pages as a unit, scene outline | SP 2–4 | M + S + S | |
| Screenwriting, phase 3: script report, FDX export, Fountain import, feature-length scripts as a book | SP 5–7 | M + M + M | |
| Universe phase 2: story timeline, `when` and eras, narrative mode, shift dates, facts over time, continuity checks, canon | U 2.1–2.4 | L | After screenwriting. Planned for 0.9 and moved on 2026-10-06 as bloat at this stage; the draft design is in `research_notes/0.9-dates-draft/` (local) |
