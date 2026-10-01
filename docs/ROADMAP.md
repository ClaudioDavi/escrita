# Roadmap: versions at a glance

The one place that says what is in each version. Start here; the details of each
feature live in the three topic roadmaps:

- [ROADMAP-short-fiction.md](ROADMAP-short-fiction.md): contos, essays, and anything that
  works on a single note (so on chapters too).
- [ROADMAP-novel.md](ROADMAP-novel.md): features that need a book.
- [ROADMAP-universe.md](ROADMAP-universe.md): a shared world across works (opt-in).

Every feature follows the rules in [ARCHITECTURE.md](ARCHITECTURE.md), including
**standalone**: Escrita is for any writer, whether or not they publish to a website,
so nothing here assumes one.

Feature references below use the short names **SF** (short fiction), **N** (novel) and
**U** (universe), followed by the section number in that file.

**Every release includes at least one code improvement** from
[IMPROVEMENTS.md](IMPROVEMENTS.md), listed as "Improvement" under the version below.
Prefer one the version's features lean on.

When a version ships: move its row to "Shipped", add the changelog entry in the README,
move the improvement to "Done" in IMPROVEMENTS.md, and pick the next version's contents
(features and improvement) here before editing the topic roadmaps.

## Shipped

| Version | Contents |
|---|---|
| 0.1 | Outline and ghost beats, goals and pacing, sprints, status bar, placeholders, darlings, Enter Enter Enter, smart typography, spellcheck on demand |
| 0.2.0 | No-network guard (SF 0) · Publish check (SF 1) · Targets per piece and days off (SF 2) · Outline for a single note (SF 3) |
| 0.2.1 | Standalone publish (URL features removed) · Improvements: Markdown segmenter, file classifier |
| 0.3.0 | Word counts in the file explorer (SF 6) · Dialogue focus (SF 7) · Snapshots with word-level compare (SF 4) · Improvements: measure module, explorer decoration adapter, note text (partial) |

## Next: 0.4

| Feature | Ref | Effort | Note |
|---|---|---|---|
| Portuguese and English stemmers in `core/stem/` | SF 5 | M | Shared: the revision lens uses them here, and the universe reuses them for name matching (U 1.2, 1.4: *Maria / Mariazinha*, *Teo's*). |
| Revision lens (pt-BR and English rules) | SF 5 | M | Six rules, per-1,000 rates, performance on long notes. Measures: dialogue share (from dialogue focus, so dash dialogue counts) and readability with the Portuguese Flesch formula, which StoryLine lacks. |
| Move a paragraph or scene up or down | SF 8 | S | One undo step; reads `segmentDoc`, like the improvement below. |

**Improvement:** the 0.2.1 loose ends in the editor (IMPROVEMENTS.md): drop the
compatibility wrappers and read `segmentDoc` everywhere, since the lens adds another
editor decoration on the same segmentation.

## 0.5 to 1.0

1.0 is the full release: **the shared universe and manuscript export**. The versions
before it build toward those two, contos first (the author's next months are short
fiction), then the universe, then book features.

| Version | Contents | Ref | Effort | Theme |
|---|---|---|---|---|
| 0.5 | Universe modes and container, migration command, universe panel · Create entry from selection · Open threads (work without a universe too) · Insert from a template | U 1.1, U 1.3, U 1.5, SF 9 | M + S | Universe foundations |
| 0.6 | "Appears in" · Names into spellcheck and the revision lens · POV and status in the outline (POV can link to a character entry) · Per-chapter targets | U 1.2, U 1.4, N 1, N 2 | M + S + S + S | Characters across works |
| 0.7 | Export stages 1–2: Markdown manuscript and DOCX (Shunn and pt-BR presets), for a single note and for a book · Companion-plugin guide | N 7, N 6 | M–L + S | Submitting work |
| 0.8 | Universe phase 2: timeline, facts over time, continuity checks, canon | U 2.1–2.4 | L | A consistent world |
| 0.9 | Export stage 3: EPUB 3, validated by EPUBCheck in CI · Book-wide publish check and serial dashboard · "Read the book" view | N 7, N 4, N 8 | M + S + M | Books |
| 1.0 | Stabilization: mobile pass, docs in English and pt-BR, migrations tested on the author's vault, community plugin submission · Set up a writing vault | SF 10 | M + S | Full release |

Improvements: 0.5 the vault index (IMPROVEMENTS.md, 2), which the universe's indexes
need; later versions pick from IMPROVEMENTS.md when they're planned in detail.

Notes:

- U 1.1, 1.3 and 1.5 don't need the stemmers, so they come before U 1.2 and 1.4.
- Export ships DOCX first (0.7): a conto in standard manuscript format is what contests
  and magazines ask for. EPUB matters mostly for a finished book (0.9).
- Per-chapter targets (N 2) is small: chapters already take `target` / `limit` since 0.2;
  what's left is the bar in the outline and a book default.
- The universe's "appears in" (U 1.2) replaces Codex-lite (N 9), which is dropped.
- Ideas taken from Tris's "Obsidian for Writers" and from comparing with StoryLine
  (2026-10-01): SF 8–10, the lens measures (SF 5), and details in U 1.2, U 1.3, U 2.1,
  U 2.3, N 6 and N 7. StoryLine owns planning boards (corkboard, plot grid, beat sheets);
  Escrita doesn't compete there and stays the writing and revision plugin, Portuguese
  first.

## After 1.0

| Feature | Ref | Effort | Note |
|---|---|---|---|
| Book-wide snapshots and revision reports | N 10 | M | Builds on SF 4, SF 5 |
| Longform importer | N 5 | S–M | Not wanted for 1.0 |
