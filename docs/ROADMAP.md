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

## Next: 0.8, submitting work

A conto leaves the vault: export turns a note or a book into a manuscript an editor or a
contest accepts, and submissions track where it went and what came back. Serves the
"ready" and "published" stages. Upkeep: one property per submission the writer adds
when they send a work out; export reads what the note already has.

| Feature | Ref | Effort | Note |
|---|---|---|---|
| Export stages 1–2: Markdown manuscript and DOCX | N 7 | M–L | Shunn and pt-BR presets, for a single note and for a book. No network; the file is written into the vault. |
| Submissions | SF 12 | S | Where a work was sent, when, and the answer; ships with export, since export is how a work gets sent. |
| Companion-plugin guide | N 6 | S | A guide page ("Other plugins") and a settings note; re-check each plugin's maintenance and running next to StoryLine. |
| User guide for 0.8 | Docs | S | "Publishing" (the publish check, export, submissions) and "Other plugins", in English and pt-BR. |

**Improvements** (planned 2026-10-04 after an architecture and a measured performance
review; details in [PLAN-0.8.md](PLAN-0.8.md)):

- Each module owns its settings section, and feature metadata lives in one place
  (IMPROVEMENTS 11, 20). Export and submissions bring settings and two feature ids.
- The foundations export and submissions stand on:
  - 15: the manuscript model, a note's prose as an editor receives it.
  - 16: `classifyKey` and the `submission` field.
  - 17: `notes.create`, with binary writes.
  - 18: the book source.
  - 19: readiness checks in core, with the unclosed `<!--` check.
- Performance, all measured on a 3,020-note vault:
  - Index passes yield on a time budget: the longest block goes from 125 ms to 14 ms
    (21).
  - The mentions index starts on demand. It is 85% of startup index work, about 20 s
    on a phone (14).
  - The mentions index no longer recomputes on every save while typing (21).
  - Names matching is about 1.4× faster with caches that last across calls (22).
  - Small redraw fixes (23).
- If room: the lens memos (22) and one name fold (10).
- Set aside after measuring: candidate 12, the shared read per flush.

Open from 0.7, for the author on a device: gates G0c (does `spellcheck="false"` hold on
Android and iOS?), G0d (the Reading-view "Appears in" section across re-renders), the
G0h phone figure, and the visual check against the canvas (PLAN-0.7.md, task 5.2).

## 0.5 to 1.0

1.0 is the full release: **the shared universe and manuscript export**. The versions
before it build toward those two, contos first (the author's next months are short
fiction), then the universe, then book features. Planning the writing desk as 0.4
(2026-10-01) moved every later version up by one, so books land in 0.10. The desk
shipped as 0.4.0 and the lens as 0.5.0.

| Version | Contents | Ref | Effort | Theme |
|---|---|---|---|---|
| 0.9 | Universe phase 2: timeline, facts over time, continuity checks, canon · Unlinked mentions and names without an entry (moved from 0.7) | U 2.1–2.5 | L | A consistent world |
| 0.10 | Export stage 3: EPUB 3, validated by EPUBCheck in CI · Book-wide publish check and serial dashboard · "Read the book" view | N 7, N 4, N 8 | M + S + M | Books |
| 1.0 | Stabilization: mobile pass, the user guide complete in English and pt-BR (see "Documentation"), migrations tested on the author's vault, community plugin submission · Set up a writing vault (creates the home note and a first writing layout, with presets: Essentials, Writer, Everything, built on the 0.7 feature switches) | SF 10 | M + S | Full release |

Improvements: 0.8 is planned above (PLAN-0.8.md); later versions pick from IMPROVEMENTS.md when they're planned in detail.

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
if any, sit in `docs/guide/images/`. The universe guide moved there in 0.7, as
`docs/guide/en/the-world.md` (and its pt-BR twin).

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
| Longform importer | N 5 | S–M | Not wanted for 1.0 |
| Screenwriting, phase 1: screenplay notes, Fountain parser, Fountain and PDF export | SP 1, SP 6 | M + L | Export first: a script can be drafted in plain Fountain, but can't be handed in without a correct PDF. Builds on the 0.8 export pipeline and the `form` property (0.6) |
| Screenwriting, phase 2: screenplay layout and Tab/Enter in the editor, pages as a unit, scene outline | SP 2–4 | M + S + S | |
| Screenwriting, phase 3: script report, FDX export, Fountain import, feature-length scripts as a book | SP 5–7 | M + M + M | |
