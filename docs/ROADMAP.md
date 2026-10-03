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
| 0.4.0 | The writing desk: stages and the stage snapshot (SF 11) · Home block, where you left off, open on startup (SF 11) · Move a paragraph or scene (SF 8) · Improvement: vault index |
| 0.5.0 | Revision: revision lens with six rules, dialogue share, Portuguese readability and "Ignore here" (SF 5) · Portuguese and English stemmers in `core/stem/` · Improvement: the 0.2.1 editor loose ends (and the outline's scene-break check) |

## Next: 0.6, universe foundations

The container for a shared world, and the first tools that use it. Open threads and
templates work without a universe too. The universe is opt-in and off by default.

| Feature | Ref | Effort | Note |
|---|---|---|---|
| Universe modes and container | U 1.1 | M | Per book, shared universe or off. Entry folders and types (character, place, object…), `form` on works, a migration command with a preview, and the universe panel. |
| Create entry from selection | U 1.3 | S | Editor menu and command: pick the type, create the note from its template, set `type` and `universe`. Opens the existing entry if the name is taken. |
| Open threads | U 1.5 | S | `%% thread: … %%` hooks planted in one story for later ones, a threads panel, and closing a thread. Works without a universe. |
| Insert from a template | SF 9 | S | A templates folder and a command. The same filling code serves the universe's per-type templates (U 1.3). |

**Improvement:** the outline's hand-made beat re-checks (IMPROVEMENTS.md, candidate 3,
the part still open). Closing a thread must check that the exact text is still there
before it rewrites the marker, which is the check-then-replace that `plugin.notes`
already does, so the new code and the outline can share one path.

## 0.5 to 1.0

1.0 is the full release: **the shared universe and manuscript export**. The versions
before it build toward those two, contos first (the author's next months are short
fiction), then the universe, then book features. Planning the writing desk as 0.4
(2026-10-01) moved every later version up by one, so books land in 0.10. The desk
shipped as 0.4.0 and the lens as 0.5.0.

| Version | Contents | Ref | Effort | Theme |
|---|---|---|---|---|
| 0.7 | "Appears in" · Names into spellcheck and the revision lens · POV and status in the outline (POV can link to a character entry) · Per-chapter targets | U 1.2, U 1.4, N 1, N 2 | M + S + S + S | Characters across works |
| 0.8 | Export stages 1–2: Markdown manuscript and DOCX (Shunn and pt-BR presets), for a single note and for a book · Submissions · Companion-plugin guide | N 7, SF 12, N 6 | M–L + S + S | Submitting work |
| 0.9 | Universe phase 2: timeline, facts over time, continuity checks, canon | U 2.1–2.4 | L | A consistent world |
| 0.10 | Export stage 3: EPUB 3, validated by EPUBCheck in CI · Book-wide publish check and serial dashboard · "Read the book" view | N 7, N 4, N 8 | M + S + M | Books |
| 1.0 | Stabilization: mobile pass, docs in English and pt-BR, migrations tested on the author's vault, community plugin submission · Set up a writing vault (creates the home note and a first writing layout) | SF 10 | M + S | Full release |

Improvements: 0.6 is planned above; later versions pick from IMPROVEMENTS.md when
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

## After 1.0

| Feature | Ref | Effort | Note |
|---|---|---|---|
| Book-wide snapshots and revision reports | N 10 | M | Builds on SF 4, SF 5 |
| Longform importer | N 5 | S–M | Not wanted for 1.0 |
