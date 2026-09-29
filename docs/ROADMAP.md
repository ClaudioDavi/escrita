# Roadmap: versions at a glance

The one place that says what is in each version. Start here; the details of each
feature live in the three topic roadmaps:

- [ROADMAP-short-fiction.md](ROADMAP-short-fiction.md): contos, essays, and anything that
  works on a single note (so on chapters too).
- [ROADMAP-novel.md](ROADMAP-novel.md): features that need a book.
- [ROADMAP-universe.md](ROADMAP-universe.md): a shared world across works (opt-in).

Feature references below use the short names **SF** (short fiction), **N** (novel) and
**U** (universe), followed by the section number in that file.

When a version ships: move its row to "Shipped", add the changelog entry in the README,
and pick the next version's contents here before editing the topic roadmaps.

## Shipped

| Version | Contents |
|---|---|
| 0.1 | Outline and ghost beats, goals and pacing, sprints, status bar, placeholders, darlings, Enter Enter Enter, smart typography, spellcheck on demand |
| 0.2.0 | No-network guard (SF 0) · Publish check (SF 1) · Targets per piece and days off (SF 2) · Outline for a single note (SF 3) |

## Next: 0.3

Chosen because each one works the same on a conto, an essay and a chapter.

| # | Feature | Ref | Effort | Why now |
|---|---|---|---|---|
| 1 | Word counts in the file explorer | SF 6 | S | Covers contos, chapters, book totals; replaces Novel Word Count; reuses the `counter` cache and the placeholder-dot explorer pattern |
| 2 | Dialogue focus (travessão-aware) | SF 7 | S | Revising voices matters in any form; nothing else handles dash dialogue |
| 3 | Snapshots with word-level compare | SF 4 | M | Per note, so chapters get it for free; adds "Before publishing" to the 0.2 publish check |

Suggested order: 1 and 2 first (small, independent), then 3.

## 0.4

| Feature | Ref | Effort | Note |
|---|---|---|---|
| Revision lens (pt-BR and English rules) | SF 5 | M–L | Largest item: stemmer, six rules, performance on long notes. Design the stemmer with U 1.2 in mind, which reuses it for name matching. |

## Not yet scheduled

Pick from here when planning 0.5 and later.

| Feature | Ref | Effort | Depends on |
|---|---|---|---|
| POV and status in the outline | N 1 | S | |
| Per-chapter targets (bar in the outline, book default) | N 2 | S | SF 2 (shipped) |
| Book-wide publish check and serial dashboard | N 4 | S | SF 1 (shipped) |
| Longform importer | N 5 | S–M | |
| Companion-plugin guide | N 6 | S | |
| Book compile: Markdown → DOCX → EPUB | N 7 | L | |
| "Read the book" view | N 8 | M | |
| Codex-lite | N 9 | L | Superseded by U 1.2 if the universe ships first |
| Book-wide snapshots and revision reports | N 10 | M | SF 4, SF 5 |
| Universe phase 1: container, appears in, entry from selection, names, open threads | U 1.1–1.5 | M–L | SF 5 stemmer (for 1.2, 1.4) |
| Universe phase 2: timeline, facts over time, continuity, canon | U 2.1–2.4 | L | U phase 1 |
| Universe phase 3: site integration | U phase 3 | L | Mostly on the site |
