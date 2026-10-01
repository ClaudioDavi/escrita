# Roadmap: short fiction and essays

Which version each feature ships in is decided in [ROADMAP.md](ROADMAP.md); the
table below mirrors it.

Plan for the next six months of the author's writing: **contos (short stories) and
textos (essays, chronicles)**, one note each, finished and published whole.
Novel features wait for [ROADMAP-novel.md](ROADMAP-novel.md).

Read [ARCHITECTURE.md](ARCHITECTURE.md) first. Every convention there still applies:
module ownership, pure logic without `obsidian` imports and with vitest tests,
`t()` strings in English and pt-BR, theme variables only, `vault.process` /
`processFrontMatter`, mobile-safe, data safety first.

Background research: `reports/Obsidian fiction writing gaps.md` (local only, not in git).
Features 8–10 and the measures in feature 5 come from Tris's
[Obsidian for Writers](https://www.namtao.com/obsidian-for-writers/) and a comparison
with the StoryLine plugin (2026-10-01): StoryLine has a dialogue ratio and readability
scores, but readability is English only and dialogue is found by quote marks alone.

## Ground rules for this roadmap

- **No network, no AI.** The plugin never calls a server or a model. Everything below
  is local rules and plain code. Milestone 0 turns this into a failing test.
- **Generic first.** The author's vault is the first user, not the only one. Every
  property name, status value, folder and word list is a setting, with English
  defaults and the author's values set in the author's own `data.json`.
- **Standalone.** Escrita works for any writer, whether they publish to a website, send
  work to magazines, or never publish at all. No feature assumes a website: no URLs,
  slugs, site build rules or files written for a site. See ARCHITECTURE.md, "Standalone".
- **Design first.** Before building each feature's UI, add mockups to the design canvas
  (https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6) and get them approved. The existing
  boards set the look: Obsidian dark theme, Source Serif 4 prose, IBM Plex Sans UI, accent
  `#f0a476`, Portuguese copy.
- **Suggest, never rewrite.** No feature changes prose without an explicit click.

### The author's vault (for testing and for its `data.json`)

- Vault: `~/projects/website/escrita/`. Contos in `Contos/`, essays in `Textos/`, one note each.
- Properties: `status` (`ideia`, `rascunho`, `revisão`, `pronto`, `publicado`), `date`
  (publication date), `description` (one line).
- The author happens to publish to a personal site that reads the vault; that's the
  site's business, and nothing in Escrita depends on it.

## Versions

| Version | Contents | Effort | Status |
|---|---|---|---|
| 0.2.0 | No-network guard (0) · Publish check (1) · Targets per piece + days off (2) · Outline for a single note (3) | XS + S + S + S | Shipped |
| 0.3.0 | Word counts in the file explorer (6) · Dialogue focus (7) · Snapshots with word-level compare (4) | S + S + M | Shipped |
| 0.4 | Revision lens, pt-BR and English rules, with dialogue share and readability (5) · Move a paragraph or scene (8) | M–L + S | Planned |
| 0.5 | Insert from a template (9) | S | Planned |
| 1.0 | Set up a writing vault (10) | S | Planned |

Sections keep their original numbers so references from the other roadmaps stay valid.

---

## 0. No-network guard (shipped in 0.2.0)

- `tests/no-network.test.ts`: fail if any file in `src/` contains `fetch(`,
  `requestUrl`, `request(` from obsidian, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `navigator.sendBeacon`, or `import(` of a URL. Also scan the built `main.js` when it
  exists (CI builds before testing, or add a `test:bundle` step to CI after the build).
- README: a "Privacy" line that states it plainly: no network access, no AI, no telemetry.

**Done when** the test fails on a deliberately added `fetch(` and passes without it.

---

## 1. Publish check (shipped in 0.2.0)

**Why.** Every conto and texto is published whole, so publishing happens weekly. Today
it is a manual property edit, and the mistakes it can make are silent (a leftover
`XXX`, an unclosed `%%` that hides the rest of the text).

**What it does.** A command, "Publish this note", plus a button in the status bar menu
or file menu. It runs checks on the active note and shows the result in a modal:

| Check | Level | Notes |
|---|---|---|
| Unclosed `%%` | Blocker | Count `%%` outside code; odd count. Show the line where it opens. |
| Placeholders left (`%% XXX: … %%`) | Blocker | List them; click jumps to each. Uses `core/markers`. |
| Unwritten beats | Warning | `parseBeats` with `written: false`. Beats that were written are fine. |
| Empty body | Blocker | `countWords` = 0. |
| Missing `description` | Warning | Property names from settings; empty list of "recommended properties" disables it. |
| Over the piece's limit | Warning | From feature 2 (e.g. contest character limit). |

Blockers disable the "Publish" button but can be overridden with a checkbox
("Publish anyway"), because the plugin can't know every case.

**Publishing** sets `status` to the configured published value and `date` to today
(or keeps an existing date; a date picker in the modal allows scheduling), via
`processFrontMatter`, in one operation. It then shows a Notice. It never commits,
pushes or uploads anything.

**Unpublish.** A command "Unpublish this note" sets `status` back to a configured value
(default: the value it had before publishing, stored in plugin data; fallback `ready`).

**Removed after 0.2.0:** the "URL taken" and "URL changed" checks, "keep the old URL on
rename", and the publish folders and slug property settings. They copied one website's
URL rules, which breaks the standalone rule.

**Settings** (new section "Publishing"):
- Status property (reuse `statusProperty`), published value (default `published`;
  author: `publicado`), unpublished value (default `ready`; author: `pronto`).
- Date property (default `date`).
- Recommended properties (default `description`).

**Pure, tested** (`src/publish/checks.ts`): `runChecks(text, frontmatter, context) →
Check[]` with the table above; `unclosedComment(text)` returning the opening line.

**UI.** Modal: title "Publish “O farol”", the list of checks with an icon per level
(blocker, warning, passed), clickable items that jump to the line, the date field, and
the Publish button. Needs a mockup first.

**Done when** publishing a clean note sets both properties in one undoable-looking
step, and each failing check blocks or warns as specified, with tests for each check
including CRLF, frontmatter, `%%` inside inline code and fenced code, and a note whose
only content is comments.

---

## 2. Targets per piece, and days off (shipped in 0.2.0)

**Why.** Book goals and deadlines only work for novels today. A conto has its own
target length, often a hard **maximum** from a contest or magazine, frequently counted
in **characters with spaces** ("até 15.000 caracteres com espaços"), and a submission
deadline. Days off stop a rest day from breaking the streak or distorting the pacing.

**Properties on any note** (names configurable):
- `target`: a number, the length you're aiming for.
- `limit`: a number, the maximum allowed.
- `unit`: `words` (default), `characters` (with spaces) or `characters-no-spaces`.
- `deadline`: YYYY-MM-DD (already used by books; same name).

**Counting.** Characters are counted on the same prose-only text as words
(`core/wordcount.proseOnly`: no frontmatter, comments, markup), with whitespace runs
collapsed to one space, and trimmed. Add `countCharacters(md, { spaces })` to core with
tests (accents count as one character; em dash counts as one).

**Status bar.** When the active note has `target` or `limit`, a piece segment shows
"4.210 / 5.000 palavras" (or "12.800 / 15.000 caracteres") with a bar. Near a limit
(≥ 95%) it turns amber; over it, red with "+312 acima do limite". It sits next to
the daily goal, which is unchanged.

**Progress modal.** When the active note isn't a book but has a target/limit/deadline,
the book tile becomes a piece tile (current / target, limit line), and pacing works
for the piece (words per day needed until `deadline`). Setting fields in the modal edit
the note's properties, like the book goal does today.

**Days off.**
- Settings: weekdays off (checkboxes, default none) and specific dates off (a list).
- A day off never breaks the streak: the streak skips days off with no writing.
  Writing on a day off still counts and extends the streak.
- Pacing counts only writing days between today and the deadline.
- Chart: days off get a subtle hatched or dimmed background.

**Pure, tested:** `countCharacters`; `pieceProgress({ count, target, limit })`;
`streak` and `pacing` extended with a `isDayOff(day)` predicate (keep the old
behavior when no days are off; existing tests must still pass).

**Done when** a conto with `limit: 15000` and `unit: characters` shows the right count
against a hand-checked sample, a weekday off leaves the streak intact, and pacing to a
deadline skips days off.

---

## 3. Outline for a single note (shipped in 0.2.0)

**Why.** Contos have scenes too. Beats (`%% beat: … %%`) and ghost rendering already
work in any note; only the outline panel requires a book.

**What changes.** When the active note is not in a book, the outline panel shows that
note's beats instead of the empty state: a header with the note title, word count and
target (feature 2), and the beat list with letters and written checks. Same keys as
beats in a book: Enter adds a beat after, Backspace on an empty beat removes it,
editing text rewrites the comment line (`beats-edit.ts` already does this). Clicking a
beat jumps to its line. Tab/Shift+Tab (chapter conversions) don't apply.

When there are no beats yet, the empty state offers "Add the first beat" and keeps the
current "Create a book" link.

**Done when** a conto with three beats shows them, edits round-trip to the file, and
the book outline is unchanged for chapters.

---

## 4. Snapshots with word-level compare (shipped in 0.3.0)

> **Status:** shipped in 0.3.0. Where this section and the code
> differ, the code and `docs/ARCHITECTURE.md` (snapshots) are right; the storage
> and diff notes below are updated to what was built.

**Why.** Short pieces go through many drafts: before cutting, before a contest version,
before an editor's pass. Git keeps history, but only line-level diffs, no names, and
nothing inside Obsidian. Scrivener's named snapshots and compare are what writers miss.

**Storage.** Plain files, so they sync with git and work on mobile:
`<snapshots folder>/<note path, .md kept>/<YYYY-MM-DD HHmm> <name>.txt` holding the
full note text, including frontmatter. `.txt`, not `.md`, so search, graph, backlinks,
Dataview and Bases ignore them and a rename never rewrites links inside a snapshot.
Default folder: `Escrita/Snapshots`, visible and indexed by Obsidian (read and written
through the Vault API). A hidden root (a segment starting with a dot) is still allowed
and goes through `vault.adapter`, since Obsidian doesn't index dot folders. An index
file per note (`index.json`) holds name, kind, date, word count, hash and the note's
path at the time; the `.txt` files are the truth and a lost index is rebuilt. On note
or folder rename, the snapshot folder moves (`vault.on("rename")`).

**Sync (decided).** A visible default folder. Obsidian Sync copies the `.txt` files only
with "Sync all other types" turned on, and skips dot folders entirely; the setting's
description and the README say so. Git, iCloud, Dropbox and Syncthing copy them as they are.

**Taking snapshots.**
- Command "Take a snapshot" (asks for an optional name; default "Snapshot").
- Automatically before "Publish this note" (feature 1), named "Before publishing".
- Setting "Snapshot before the first edit of each day" (default off; tracked notes only).
- Never two identical snapshots in a row (compare text first).

**Snapshots panel** (`ItemView`, type `escrita-snapshots`): the active note's
snapshots, newest first, each with name, date, word count and the difference in words
from the current text. Actions: View, Compare, Restore, Rename, Delete (to trash).

**Compare view.** Word-level diff between a snapshot and the current note (or two
snapshots):
- Inline mode (default): the current text with deletions struck through and insertions
  highlighted; side-by-side mode as an option.
- Paragraph-aware: align paragraphs first, then diff words inside changed paragraphs,
  so moved or rewritten paragraphs stay readable.
- Summary line: "+312 words, −540 words, 18% of paragraphs changed".
- Each changed block has "Use the old version" (restores that passage only), applied
  through the note text port (the editor when the note is open in source or Live
  Preview, else `vault.process`) after checking the current text still matches, and
  always after a "Before restoring" snapshot.
- A read-only "Full text" view shows one snapshot's whole text (the only way to read a
  `.txt` snapshot on mobile). Snapshots of deleted notes are reached with "Browse
  snapshots of deleted notes".
- Frontmatter differences shown separately at the top, collapsed.

Diff algorithm (built): the `diff` package (jsdiff, **BSD-3-Clause**, no network; its
license notice is in a banner at the top of `main.js` and in `THIRD_PARTY_NOTICES.md`).
`src/snapshots/compare.ts` uses `diffArrays` over paragraphs, then `diffArrays` over
core's word tokens inside changed paragraphs (not `diffWordsWithSpace`, so words are
Escrita's words), with tests on Portuguese text, punctuation, CRLF, and a paragraph
moved from the end to the start.

**Restore.** Restoring a whole snapshot first takes a snapshot of the current text
("Before restoring"), so it's always reversible.

**Retention.** Setting "Keep at most N automatic snapshots per note" (default 20);
named manual snapshots are never deleted automatically.

**Done when** a round-trip (take, edit, compare, restore one passage, restore all, undo
by restoring "Before restoring") loses nothing, with tests on the pure parts and a
manual check on mobile.

---

## 5. Revision lens (v0.4)

**Why.** Short fiction and essays are revised sentence by sentence. Style checkers
(ProWritingAid, iA Writer Style Check, Harper) are English-only or need a server. This
is a local, rule-based pass: **no AI, no network**.

**How it works.** Off by default; the command "Toggle revision lens" turns it on for
the active note (like spellcheck on demand). It underlines matches in the editor (a
CodeMirror decoration, one color per rule, subtle) and opens a side panel with counts
per rule, **per 1,000 words** so pieces of different lengths compare. Clicking a count
steps through its matches. It only suggests; it never changes text.

**Rules** (each on/off in settings; language from a setting, `pt-BR` or `en`):

| Rule | pt-BR | en |
|---|---|---|
| Echoes | Same stem within N words (default 40), ignoring stop words | same |
| Adverbs | Words ending in `-mente`, minus an exceptions list (`mente`, `semente`, `demente`, `clemente`, `veemente`, `ente`…) | Words ending in `-ly`, minus exceptions (`only`, `family`, `reply`, `early`…) |
| Gerunds | `-ando/-endo/-indo` minus exceptions (`quando`, `mundo`, `lindo`, `segundo`, `fundo`, `redondo`…); gerundismo `ir/estar + estar + gerúndio`; 3+ gerunds in one sentence | "began to / started to + verb" |
| Crutch words | From the user's list note | same |
| Name variants | Words within edit distance 1–2 of a name in the name list (not the name itself) | same |
| Long sentences | Sentences over N words (default 45) | same |

**Measures** (in the lens panel, above the rule counts; for the note, and for the
selection when there is one). They describe the text; they don't underline anything.

- **Dialogue share**: the percentage of words that are speech, from the same
  `dialogueInDoc` that dialogue focus uses (feature 7), so dash dialogue counts. Per
  scene too, split at scene breaks, so a chapter shows where it is all talk or none.
- **Readability**: average sentence length, average word length in syllables, and a
  reading-ease score. pt-BR: Flesch adapted to Portuguese (Martins et al., 1996:
  `248.835 − 1.015 × words per sentence − 84.6 × syllables per word`), with the usual
  bands (very easy to very hard). English: Flesch reading ease. Shown with its band, not
  as a grade to chase.

Syllables are counted by rule (vowel groups, with Portuguese diphthongs and hiatus, and
English silent `e`), approximate on purpose; tests pin a word list per language and the
score of the sample conto. Book-wide measures wait for N 10.

**Stemming.** Two stemmers ship in this version, both in `core/stem/` so the universe
(U 1.2, 1.4) can reuse them without depending on the revision lens:

- **Portuguese**: a small suffix-stripping stemmer (RSLP-style: plural, feminine,
  augmentative/diminutive, adverb, noun and verb suffix steps), so
  *olhar / olhou / olhando / olhares* share a stem, and *Mariazinha* shares a stem with *Maria*.
- **English**: a light Porter-style stemmer (plural, possessive, `-ed`, `-ing`, `-ly`,
  common noun and verb suffixes), so *walk / walks / walked / walking* share a stem.

One interface for both, `stem(word, lang)`, picked by the revision language setting.
Pure TypeScript, tests on real word lists in each language; accept imperfection, prefer
missing a match over a wrong one.

**User lists in the vault.** One note, path in settings (author: `Modelos/Revisão.md`),
with headed sections the plugin reads:

```
## Vícios
de repente
começou a
meio que

## Nomes
Maria
Teo

## Ignorar
olhar
```

**Dismissing.** A match can be dismissed ("ignore here"); dismissals are stored in
plugin data by note path + rule + matched text + surrounding words, so they survive
edits elsewhere in the note.

**Skip** frontmatter, comments, code, links' targets and quotes in `>` blocks (setting).

**Pure, tested:** tokenizer (Portuguese letters, hyphenated words, apostrophes),
sentence splitter (handles `…`, `—` dialogue, abbreviations like `Sr.` and `Dra.`),
Portuguese and English stemmers, each rule as a function `(text, options) → Match[]`, per-1,000 rate.

**Done when** the rules produce stable, explainable matches on a sample conto (keep one
as a fixture in `tests/fixtures/`), the editor stays responsive on a 10,000-word note
(compute in the view plugin only for the visible range plus a cached full pass for the
panel, debounced), and the no-network test still passes.

---

## 6. Word counts in the file explorer (shipped in 0.3.0)

> **Status:** shipped in 0.3.0. One deviation: counts are always
> abbreviated from 10,000 (the explorer's width can't be measured), with the full
> count in the tooltip.

**Why.** The author uses the Novel Word Count plugin only to see lengths next to file
names. Escrita already counts every tracked note (`plugin.measure`), so it can show the same
thing with its own rules (prose only: no frontmatter, comments or beats), one plugin
fewer, and counts that agree with the status bar and the outline.

**What it shows**, as small muted text after the file or folder name:
- **Contos and essays**: the note's count. When the note has `unit: characters` (feature
  2), characters instead of words; with a `target` or `limit`, optionally
  "4.210 / 5.000".
- **Chapters**: the chapter's count.
- **Novels**: the book total (sum of its chapters) next to the book note and the book
  folder, and the chapters folder's total next to it.
- **Other folders**: the total of the tracked notes inside (off by default; can be
  switched on).

**Rules.**
- Only tracked notes (same `trackFolders` / `excludeFolders` as goals); nothing on
  other files, so the explorer stays quiet outside the writing folders.
- Numbers through `fmt()` ("18.420"), abbreviated past 10,000 when there's no room
  ("18,4 mil" / "18.4k"), with the full count in a tooltip.
- Update from the `plugin.measure` cache on modify/rename/delete, debounced; the first pass
  runs after layout ready in small batches, like the placeholder index. Never re-read the
  whole vault on each change: a folder total is the sum of cached counts.
- Draw it in an element Escrita owns (a span added to the title, or a class plus a
  pseudo-element on `.nav-file-title-content` / `.nav-folder-title-content`), never on
  `.nav-file-title::after`: Novel Word Count and some themes use that pseudo-element,
  and sharing it broke the placeholder dot in v0.2. Keep it next to the placeholder dot
  without overlapping.
- Private explorer API (`fileItems[path]`) behind a type guard and try/catch, re-applied
  on `layout-change`, as the placeholder dots do.

**Settings** (Goals section): "Show word counts in the file explorer" (default on),
"Show folder totals" (default off), "Show the target next to the count" (default off).

**Pure, tested:** folder and book totals from a map of counts; the label for a count,
unit and target; abbreviation.

**Done when** a vault with a novel, contos and essays shows the right counts next to
each note, the book total next to the book, matches the status bar's numbers, updates
within a second of typing stopping, and looks right alongside Novel Word Count
installed (or tells the user to turn off its file counts).

---

## 7. Dialogue focus (shipped in 0.3.0)

> **Status:** shipped in 0.3.0.

Moved here from the novel roadmap (it was N 3): it works on any note, a conto as much as
a chapter.

**Why.** Revising voices means reading the dialogue alone. Scrivener's Dialogue Focus
and the stale Dialogue Mode plugin only know quotes, in English. Portuguese, Spanish and
French fiction mostly uses the dash.

**What it does.** Command "Toggle dialogue focus" for the active note. A CodeMirror
decoration dims everything except dialogue; the text is never changed. It recognizes
both styles:

- Dash dialogue: a paragraph starting with `—` is dialogue up to the next `—` that
  introduces narration, and dialogue again after the following `—`
  (`— Vem cá — disse ela. — Agora.` → the speech parts only).
- Quote dialogue: text inside `“…”` / `"…"` / `«…»`, per the existing quote-style
  setting.

Skip frontmatter, comments and code, like the other decorations.

**Pure, tested:** `dialogueRanges(paragraph, style) → Range[]`, with tests on dash
dialogue with and without narration, narration in the middle, a dash inside a sentence
that isn't dialogue, nested quotes, curly and straight quotes, and CRLF.

**Done when** a conto and a chapter with both dialogue styles dim everything but the
speech, toggling off restores the view, and a 10,000-word note stays responsive.

---

## 8. Move a paragraph or scene (v0.4)

**Why.** Rearranging prose without cut and paste is one of the things Tris singles out
in Obsidian, but Obsidian only moves lines, and Escrita's outline moves whole chapters.
Nothing moves a paragraph or a scene.

**What it does.** Commands "Move paragraph up", "Move paragraph down", "Move scene up"
and "Move scene down" (no default hotkeys; users can bind them).

- A paragraph is a run of lines separated by the paragraph style setting (blank line or
  single line break), as Enter Enter Enter already uses. A scene runs between scene
  breaks.
- The block under the cursor swaps with its neighbour; the cursor moves with it.
  Frontmatter, code blocks, comments and beats stay put as units: a paragraph never
  moves into or out of them (read from `segmentDoc`).
- One editor transaction, so one undo puts it back.

**Pure, tested:** `paragraphBlocks(md, style)`, `sceneBlocks(md)` and
`swap(md, block, dir) → { text, cursor }`, with tests on blank-line and single-break
styles, the first and last block, a beat or a comment between paragraphs, CRLF, and a
scene break at the end.

**Done when** moving a paragraph or scene through a conto and back gives the same text,
in Live Preview and Source mode, on desktop and mobile.

---

## 9. Insert from a template (v0.5)

**Why.** Writers reuse small scaffolds: a scene with its beats, a revision checklist, a
note for a contest entry. Tris uses Hotkeys for Templates for this. Escrita only knows
the chapter template.

**What it does.** A setting "Templates folder" (empty by default). Command "Insert from
a template" lists its notes; the chosen one's body goes in at the cursor, with
`{{title}}`, `{{date}}` and `{{time}}` filled in as in the chapter template, and its
properties merged into the note's only where the note doesn't have them yet
(`processFrontMatter`, never overwriting). Beats and placeholders in a template work as
usual once inserted.

The universe's per-type templates (U 1.3) and the chapter template use the same filling
code, in `core/`.

**Done when** inserting a scene template into a chapter fills its variables, keeps the
chapter's properties, and undoes in one step.

---

## 10. Set up a writing vault (v1.0)

**Why.** Escrita has many settings, and a new user meets them before writing a word.
Tris gives his readers a ready-made vault; Escrita can build one.

**What it does.** Command "Set up a writing vault", offered once on first run (a notice
with a button, never a modal that blocks). It asks what the user writes (short pieces,
a novel, both) and their language, then shows what it will create before creating it:

- Folders for short pieces and for books, set as track folders.
- One example conto and one example book with two chapters, with beats, a placeholder
  and a target, so every feature has something to show. Marked as examples and safe to
  delete.
- Settings to match (language, quote style, status values, paragraph style).

It never touches existing notes; if a folder exists, it is used as it is and listed.

**Done when** an empty vault goes from install to a working book and conto in one
command, and running it in a vault with notes changes none of them.

---

## Settings summary (new)

| Section | Setting | Default | Author's vault |
|---|---|---|---|
| Publishing | Published value | `published` | `publicado` |
| | Unpublished value | `ready` | `pronto` |
| | Date property | `date` | `date` |
| | Recommended properties | `description` | `description` |
| Goals | Target, limit, unit properties | `target`, `limit`, `unit` | same |
| | Deadline property, book goal property | `deadline`, `goal` | same |
| | Word counts in the file explorer | on | same |
| | Folder totals / target next to the count | off / off | (author's choice) |
| | Weekdays off / dates off | none | (author's choice) |
| Snapshots | Folder | `Escrita/Snapshots` | same |
| | Auto snapshot before first edit of the day | off | (author's choice) |
| | Keep automatic snapshots | 20 | same |
| Revision | Language | from Obsidian's language | `pt-BR` |
| | Word lists note | (empty) | `Modelos/Revisão.md` |
| | Echo window / long sentence length | 40 / 45 | same |
| | Show dialogue share / readability | on / on | same |
| Templates | Templates folder | (empty) | `Modelos` |

After each milestone, update the author's `escrita/.obsidian/plugins/escrita/data.json`
in the website repo and the "Plugin Escrita" section of `escrita/Como usar.md`.
