# Roadmap: short fiction and essays (v0.2 → v0.3)

Plan for the next six months of the author's writing: **contos (short stories) and
textos (essays, chronicles)**, one note each, published whole to a personal site.
Novel features wait for [ROADMAP-novel.md](ROADMAP-novel.md).

Read [ARCHITECTURE.md](ARCHITECTURE.md) first. Every convention there still applies:
module ownership, pure logic without `obsidian` imports and with vitest tests,
`t()` strings in English and pt-BR, theme variables only, `vault.process` /
`processFrontMatter`, mobile-safe, data safety first.

Background research: `reports/Obsidian fiction writing gaps.md` (local only, not in git).

## Ground rules for this roadmap

- **No network, no AI.** The plugin never calls a server or a model. Everything below
  is local rules and plain code. Milestone 0 turns this into a failing test.
- **Generic first.** The author's vault is the first user, not the only one. Every
  property name, status value, folder and word list is a setting, with English
  defaults and the author's values set in the author's own `data.json`.
- **Design first.** Before building each feature's UI, add mockups to the design canvas
  (https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6) and get them approved. The existing
  boards set the look: Obsidian dark theme, Source Serif 4 prose, IBM Plex Sans UI, accent
  `#f0a476`, Portuguese copy.
- **Suggest, never rewrite.** No feature changes prose without an explicit click.

### The author's vault (for testing and for its `data.json`)

- Vault: `~/projects/website/escrita/`. Contos in `Contos/`, essays in `Textos/`, one note each.
- Properties: `status` (`ideia`, `rascunho`, `revisão`, `pronto`, `publicado`), `date`
  (publication date), `description` (one line for the index and RSS), optional `slug`
  and `title`.
- The site (`~/projects/website`) publishes a note when `status` is `publicado`; it
  **fails the build** when a published note has no `date`, and when two notes resolve
  to the same URL. The URL is the file name slugified (see `src/lib/slug.ts` there:
  NFD, strip diacritics, lowercase, non-alphanumerics → `-`), unless `slug` is set.
  `%% … %%` comments are stripped; an unclosed `%%` hides everything after it.
- Obsidian Git auto-commits and pushes; the site deploys from `main`.

## Milestones

| Milestone | Contents | Effort |
|---|---|---|
| 0 | No-network guard | XS |
| 1 (v0.2) | Publish check · Targets per piece + days off · Outline for a single note | S + S + S |
| 2 (v0.3) | Snapshots with word-level compare | M |
| 3 (v0.3) | Revision lens (pt-BR and English rules) | M |

Ship milestone 1 as one release. Snapshots and the revision lens can ship
together or separately.

---

## 0. No-network guard

- `tests/no-network.test.ts`: fail if any file in `src/` contains `fetch(`,
  `requestUrl`, `request(` from obsidian, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `navigator.sendBeacon`, or `import(` of a URL. Also scan the built `main.js` when it
  exists (CI builds before testing, or add a `test:bundle` step to CI after the build).
- README: a "Privacy" line that states it plainly: no network access, no AI, no telemetry.

**Done when** the test fails on a deliberately added `fetch(` and passes without it.

---

## 1. Publish check

**Why.** Every conto and texto is published whole, so publishing happens weekly. Today
it is a manual property edit, and the mistakes it can make are silent (a leftover
`XXX`, an unclosed `%%`) or break the site build (no `date`, duplicate URL).

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
| URL taken | Blocker | Another published note in the publish folders has the same slug. |
| URL changed since last publish | Warning | See "Stable URLs" below. |

Blockers disable the "Publish" button but can be overridden with a checkbox
("Publish anyway"), because the plugin can't know every site's rules.

**Publishing** sets `status` to the configured published value and `date` to today
(or keeps an existing date; a date picker in the modal allows scheduling), via
`processFrontMatter`, in one operation. It then shows a Notice. It never commits or
pushes; Obsidian Git or the user does that.

**Unpublish.** A command "Unpublish this note" sets `status` back to a configured value
(default: the value it had before publishing, stored in plugin data; fallback `ready`).

**Stable URLs.** When a note whose status is the published value is renamed, offer
(Notice with a button, or a modal) to add `slug: <old slug>` so links to it keep
working. The slug function must match the site's; make it a pure function in
`src/publish/slug.ts` with the same algorithm as the site's `slugify`, tested with
accented Portuguese titles.

**Settings** (new section "Publishing"):
- Status property (reuse `statusProperty`), published value (default `published`;
  author: `publicado`), unpublished value (default `ready`; author: `pronto`).
- Date property (default `date`).
- Recommended properties (default `description`).
- Publish folders, one per line (default empty = checks for duplicate URLs are off;
  author: `Contos`, `Textos`). Chapters of books count too when their folder matches.
- Slug property (default `slug`), and "Offer to keep the URL when renaming published
  notes" (default on).

**Pure, tested** (`src/publish/checks.ts`): `runChecks(text, frontmatter, context) →
Check[]` with the table above; `unclosedComment(text)` returning the opening line;
`slugify(name)`; `duplicateSlugs(entries)`.

**UI.** Modal: title "Publish “O farol”", the list of checks with an icon per level
(blocker, warning, passed), clickable items that jump to the line, the date field, and
the Publish button. Needs a mockup first.

**Done when** publishing a clean note sets both properties in one undoable-looking
step, and each failing check blocks or warns as specified, with tests for each check
including CRLF, frontmatter, `%%` inside inline code and fenced code, and a note whose
only content is comments.

---

## 2. Targets per piece, and days off

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

## 3. Outline for a single note

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

## 4. Snapshots with word-level compare (v0.3)

**Why.** Short pieces go through many drafts: before cutting, before a contest version,
before an editor's pass. Git keeps history, but only line-level diffs, no names, and
nothing inside Obsidian. Scrivener's named snapshots and compare are what writers miss.

**Storage.** Plain files, so they sync with git and work on mobile:
`<snapshots folder>/<note path without .md>/<YYYY-MM-DD HHmm> <name>.md` holding the
full note text, including frontmatter. Default folder: `.escrita/snapshots` (hidden from
search and graph; use `vault.adapter` to read/write, since Obsidian doesn't index dot
folders). An index file per note (`index.json`) holds name, date, word count, and the
note's path at the time. On note rename, move its snapshot folder (listen to
`vault.on("rename")`).

**Taking snapshots.**
- Command "Take a snapshot" (asks for an optional name; default "Snapshot").
- Automatically before "Publish this note" (feature 1), named "Before publishing".
- Setting "Snapshot automatically before the first edit of each day" (default off).
- Never two identical snapshots in a row (compare text first).

**Snapshots panel** (`ItemView`, type `escrita-snapshots`): the active note's
snapshots, newest first, each with name, date, word count and the difference in words
from the current text. Actions: Compare, Restore, Rename, Delete (to trash).

**Compare view.** Word-level diff between a snapshot and the current note (or two
snapshots):
- Inline mode (default): the current text with deletions struck through and insertions
  highlighted; side-by-side mode as an option.
- Paragraph-aware: align paragraphs first, then diff words inside changed paragraphs,
  so moved or rewritten paragraphs stay readable.
- Summary line: "+312 words, −540 words, 18% of paragraphs changed".
- Each changed block has "Use the old version" (restores that passage only), applied
  with `vault.process` after checking the current text still matches.
- Frontmatter differences shown separately at the top, collapsed.

Diff algorithm: use the `diff` package (jsdiff, MIT, no network, `diffWordsWithSpace` and
`diffArrays` for paragraphs) or write a Myers diff over tokens; either way wrap it in a
pure `src/snapshots/compare.ts` with tests on Portuguese text, punctuation, CRLF, and
a paragraph moved from the end to the start.

**Restore.** Restoring a whole snapshot first takes a snapshot of the current text
("Before restoring"), so it's always reversible.

**Retention.** Setting "Keep at most N automatic snapshots per note" (default 20);
named manual snapshots are never deleted automatically.

**Done when** a round-trip (take, edit, compare, restore one passage, restore all, undo
by restoring "Before restoring") loses nothing, with tests on the pure parts and a
manual check on mobile.

---

## 5. Revision lens (v0.3)

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

**Stemming.** A small Portuguese suffix-stripping stemmer (RSLP-style: plural, feminine,
augmentative/diminutive, adverb, noun and verb suffix steps) in pure TypeScript, so
*olhar / olhou / olhando / olhares* share a stem. English uses a light Porter-style
stemmer. Write both as pure modules with tests on real word lists; accept imperfection,
prefer missing a match over a wrong one.

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
stemmers, each rule as a function `(text, options) → Match[]`, per-1,000 rate.

**Done when** the rules produce stable, explainable matches on a sample conto (keep one
as a fixture in `tests/fixtures/`), the editor stays responsive on a 10,000-word note
(compute in the view plugin only for the visible range plus a cached full pass for the
panel, debounced), and the no-network test still passes.

---

## Settings summary (new)

| Section | Setting | Default | Author's vault |
|---|---|---|---|
| Publishing | Published value | `published` | `publicado` |
| | Unpublished value | `ready` | `pronto` |
| | Date property | `date` | `date` |
| | Recommended properties | `description` | `description` |
| | Publish folders | (empty) | `Contos`, `Textos` |
| | Slug property / keep URLs on rename | `slug` / on | same |
| Goals | Target, limit, unit properties | `target`, `limit`, `unit` | same |
| | Weekdays off / dates off | none | (author's choice) |
| Snapshots | Folder | `.escrita/snapshots` | same |
| | Auto snapshot before first edit of the day | off | (author's choice) |
| | Keep automatic snapshots | 20 | same |
| Revision | Language | from Obsidian's language | `pt-BR` |
| | Word lists note | (empty) | `Modelos/Revisão.md` |
| | Echo window / long sentence length | 40 / 45 | same |

After each milestone, update the author's `escrita/.obsidian/plugins/escrita/data.json`
in the website repo and the "Plugin Escrita" section of `escrita/Como usar.md`.
