# Roadmap: novel writing (later)

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
| 1 | POV and status in the outline | Quick win | S |
| 2 | Per-chapter targets | Quick win | S |
| 3 | Dialogue focus (travessão-aware) | Quick win | S |
| 4 | Book-wide publish check and serial dashboard | Quick win | S |
| 5 | Longform importer | Quick win | S–M |
| 6 | Companion-plugin guide | Quick win | S |
| 7 | Book compile: Markdown → DOCX → EPUB | Big bet | L |
| 8 | "Read the book" view | Big bet | M |
| 9 | Codex-lite: names, mentions, presence charts | Big bet | L |
| 10 | Book-wide snapshots and revision reports | Big bet | M |

Effort: S a few days, M one to two weeks, L several weeks.

---

Word counts next to chapters, the book note and book folders in the file explorer are
planned in [ROADMAP-short-fiction.md](ROADMAP-short-fiction.md), feature 6, together with
contos and essays.

## 1. POV and status in the outline

The design already shows status dots; "color by POV" was left out of v0.1.

- A POV color stripe per chapter from a `pov` property (name configurable). A link
  (`[[Maria]]`) or plain text both work; colors assigned per distinct value, stable
  across sessions (stored in plugin data), editable.
- A toolbar toggle in the outline: color by status / by POV.
- Filter by status and POV (chips in the header).
- Header summary: "3 rascunho · 2 revisão · 4 publicado".

## 2. Per-chapter targets

Reuse the `target` / `limit` / `unit` properties from the short-fiction roadmap on
chapters. The outline shows a small bar per chapter when a target exists. A book-level
setting "Default chapter target" (property on the book note, e.g. `chapterTarget`)
applies when a chapter has none.

## 3. Dialogue focus

Dims everything except dialogue, to revise voices. Unlike Scrivener's Dialogue Focus
and the stale Dialogue Mode plugin (quote-based, English), it recognizes both styles:

- Dash dialogue (Portuguese, Spanish, French): a paragraph starting with `—` is
  dialogue up to the next `—` that introduces narration (`— Vem cá — disse ela. — Agora.`
  → the speech parts only).
- Quote dialogue: text inside `“…”` / `"…"` / `«…»` per the quote-style setting.

Command "Toggle dialogue focus". A CodeMirror decoration dims non-dialogue text.
Pure, tested parser `dialogueRanges(paragraph, style)`. Also useful for contos, so it
can move to the short-fiction roadmap if wanted.

## 4. Book-wide publish check and serial dashboard

Extends feature 1 of the short-fiction roadmap to chapters, which the author publishes
one at a time:

- "Publish next chapter": the first chapter in order that isn't published, through the
  same check modal.
- The outline header shows the next chapter to publish and the date of the last one.
- Check that published chapters are contiguous (no gap: chapter 5 published while 4
  isn't) — a warning, since the site orders by file name.
- Book-level checks: two chapters with the same URL (the site fails the build on this).
- Scheduling: a future `date` is allowed; the site already decides what to show.

## 5. Longform importer

Longform stores a project in the index note's frontmatter (`longform:` with `format`,
`title`, `draftTitle`, `scenes` as a nested list, `sceneFolder`, `ignoredFiles`).

- Command "Import a Longform project": pick the index note, preview the result (chapters
  in order, nested scenes flattened or merged — ask), then create an Escrita book: book
  note (keeps the index note's properties), chapters folder, numbered chapter files
  (copy by default; move only on explicit choice).
- Never delete the Longform files. Tests on real Longform frontmatter samples.

## 6. Companion-plugin guide

A settings section and README page recommending healthy plugins instead of rebuilding
them: LanguageTool (the only real pt-BR grammar checker; can point to a self-hosted
server), Typewriter Mode, Continuous Mode, Enhancing Export (print PDF), Chronos and
Calendarium (timelines), Excalidraw and Canvas (boards), Obsidian Git (history).
Re-check maintenance status before each release; list the date checked.

## 7. Book compile

The step Scrivener users miss most, and Longform's oldest open requests.

**Stage 1 — Markdown manuscript.** Command "Compile the book": choose chapters
(all, a range, or checked), then write one Markdown file with chapter headings
("Capítulo 1 — Título", format configurable, with a "Prologue/Epilogue" rule for
unnumbered chapters), scene breaks normalized, and all Escrita markers removed (beats,
placeholders, `%%` comments). Warns when placeholders remain. Front matter (title page,
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

## 8. "Read the book" view

A read-only view of all chapters in order, rendered with Obsidian's Markdown renderer,
with chapter headings, scene breaks, and markers hidden; remembers the reading position;
clicking a paragraph opens that chapter at that line for editing. Editing stitched
chapters (true Scrivenings) is XL and fragile; recommend Continuous Mode for that.

## 9. Codex-lite

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

## 10. Book-wide snapshots and revision reports

- "Snapshot the whole book" (one named snapshot across all chapters) and a
  "what changed since snapshot X" table: words added/removed per chapter.
- The revision lens report across all chapters: rates per chapter, so a chapter with
  twice the echoes or adverbs stands out.

---

## Out of scope for the plugin

- **Beta readers**: belongs on the author's site (private chapter links, inline
  comments, how far each reader got), feeding back into the vault as notes. The site
  would also need to strip CriticMarkup if comments are ever kept in chapters.
- **Comments / suggestion mode**: Commentator exists (beta); don't build a competing editor.
- **Maps, fantasy calendars, relationship graphs, plot-template libraries**: other
  plugins do these, and they matter little for literary fiction.
- **Any AI feature.** If ever wanted, it would be a separate companion plugin: analysis
  only, local models only, off by default. Brazil's Prêmio Jabuti excludes AI-assisted
  works, which is reason enough for Escrita itself to stay AI-free.
