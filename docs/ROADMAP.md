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

## Next: 0.7, characters across works

Characters and places start to work across stories: the universe learns where each entry
appears, names stop being flagged, and the outline shows point of view. Every feature can
also be switched off, which needs modules that load and unload at runtime.

| Feature | Ref | Effort | Note |
|---|---|---|---|
| "Appears in" | U 1.2 | M | The matcher (names and aliases, Portuguese inflection through `core/stem/`), an index kept current on edits, the count in the panel's Entries tab and an "Appears in" section in each entry note. |
| Names into spellcheck and the revision lens | U 1.4 | S | Entry names and aliases stop being flagged; the name-variant rule reads them. |
| POV and status in the outline | N 1 | S | POV can link to a character entry. |
| Per-chapter targets | N 2 | S | The bar in the outline and a book default. |
| Keep a note out of the universe | U 1.1 | XS | `universe: false` on a note (or a book note, for its chapters) makes it standalone even inside a folder in the universe. A YAML boolean, so no word to translate and no new setting. Small follow-up from 0.6 testing. |
| Feature switches | SF 10 | M | A Features page: every feature has a switch, and an off feature isn't loaded. Data stays. Mockups first. Presets and the setup command stay in 1.0. |
| User guide for 0.7 | Docs | S | Creates `docs/guide/` (English and pt-BR), moves the universe guide there, and writes the pages for this version's features: Features and settings, "appears in", POV and per-chapter targets. See "Documentation". |

**Improvement:** modules that load and unload at runtime (IMPROVEMENTS.md, candidate 6).
The feature switches stand on it, and the universe's mode-dependent commands and view
move onto it.

## 0.5 to 1.0

1.0 is the full release: **the shared universe and manuscript export**. The versions
before it build toward those two, contos first (the author's next months are short
fiction), then the universe, then book features. Planning the writing desk as 0.4
(2026-10-01) moved every later version up by one, so books land in 0.10. The desk
shipped as 0.4.0 and the lens as 0.5.0.

| Version | Contents | Ref | Effort | Theme |
|---|---|---|---|---|
| 0.8 | Export stages 1–2: Markdown manuscript and DOCX (Shunn and pt-BR presets), for a single note and for a book · Submissions · Companion-plugin guide | N 7, SF 12, N 6 | M–L + S + S | Submitting work |
| 0.9 | Universe phase 2: timeline, facts over time, continuity checks, canon | U 2.1–2.4 | L | A consistent world |
| 0.10 | Export stage 3: EPUB 3, validated by EPUBCheck in CI · Book-wide publish check and serial dashboard · "Read the book" view | N 7, N 4, N 8 | M + S + M | Books |
| 1.0 | Stabilization: mobile pass, the user guide complete in English and pt-BR (see "Documentation"), migrations tested on the author's vault, community plugin submission · Set up a writing vault (creates the home note and a first writing layout, with presets: Essentials, Writer, Everything, built on the 0.7 feature switches) | SF 10 | M + S | Full release |

Improvements: 0.6 is planned above, and 0.7 takes IMPROVEMENTS 6 (the feature switches
stand on it); later versions pick from IMPROVEMENTS.md when
they're planned in detail.

Notes:

- The writing desk (0.4, shipped) came from a design review on 2026-10-01: Escrita was a set
  of features without a workflow. The test it set for every feature: **fewer things to
  manage**. A feature that needs upkeep from the writer has to earn it. A works tab
  and a three-pane library were considered and dropped as too much to manage.
- The stemmers shipped with the lens (0.5), before the universe; U 1.2 and 1.4 (0.7)
  reuse them. The vault index (0.4) is also ready for "appears in".
- Export ships DOCX first (0.8): a conto in standard manuscript format is what contests
  and magazines ask for. Submissions (SF 12) ship with it, since sending a work out is
  what export is for. EPUB matters mostly for a finished book (0.10).
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
if any, sit in `docs/guide/images/`. `docs/GUIDE-universe.md` moves there when the
folder is created (0.7).

**The guides**, one per stage of a work's life, the way the Features page groups them:

| Guide | Covers |
|---|---|
| Getting started | Install, the first conto, the first book, the home note. From 1.0, the setup command |
| Writing | Outline and ghost beats, goals and sprints, placeholders, Enter flow and typography, dialogue focus, moving blocks, templates, explorer counts |
| Revision | The revision lens and its word lists, snapshots, darlings |
| Tracking | Stages, the stage snapshot, the home block and where you left off |
| Publishing | The publish check; export and submissions (0.8); EPUB (0.10) |
| The world | The universe, entries, "appears in", open threads (today's universe guide) |
| Features and settings | The Features page, what each switch turns off, presets (1.0) |
| Other plugins | The companion-plugin guide (N 6, 0.8) |

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
| Longform importer | N 5 | S–M | Not wanted for 1.0 |
| Screenwriting, phase 1: screenplay notes, Fountain parser, Fountain and PDF export | SP 1, SP 6 | M + L | Export first: a script can be drafted in plain Fountain, but can't be handed in without a correct PDF. Builds on the 0.8 export pipeline and the `form` property (0.6) |
| Screenwriting, phase 2: screenplay layout and Tab/Enter in the editor, pages as a unit, scene outline | SP 2–4 | M + S + S | |
| Screenwriting, phase 3: script report, FDX export, Fountain import, feature-length scripts as a book | SP 5–7 | M + M + M | |
