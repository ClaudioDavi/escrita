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
| 0.4.0 | The writing desk: stages, stage snapshot, home block (11) · Move a paragraph or scene (8) | S–M + S | Shipped |
| 0.5.0 | Revision lens, pt-BR and English rules, with dialogue share and readability (5) · stemmers | M–L | Shipped |
| 0.6.0 | Insert from a template (9) | S | Shipped |
| 0.7 | Feature switches (10, the Features page) | M | Planned |
| 0.8 | Submissions (12), with export (novel roadmap, 7) | S | Planned |
| 1.0 | Set up a writing vault and presets (10) | S | Planned |

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
named manual snapshots are never deleted automatically. Stage snapshots (feature 11,
shipped in 0.4) are never pruned either, and don't count toward N.

**Done when** a round-trip (take, edit, compare, restore one passage, restore all, undo
by restoring "Before restoring") loses nothing, with tests on the pure parts and a
manual check on mobile.

---

## 5. Revision lens (v0.5, shipped in 0.5.0; list menu items in 0.5.1)

**Why.** Short fiction and essays are revised sentence by sentence. Style checkers
(ProWritingAid, iA Writer Style Check, Harper) are English-only or need a server. This
is a local, rule-based pass: **no AI, no network**.

**How it works.** Off by default; the command "Toggle revision lens" turns it on for
the active note (like spellcheck on demand), for this session only, and opens the side
panel. In Reading view the command shows a Notice instead. It underlines matches in the
editor (a CodeMirror decoration, one color per rule, subtle) and the panel shows counts
per rule, **per 1,000 words** so pieces of different lengths compare. Clicking a rule's
step buttons selects its next or previous match (shown as "3 / 12"). Two commands,
"Next revision lens match" and "Previous revision lens match", step the rule you chose
last (echoes until then), so they work from the mobile toolbar; neither has a default
hotkey. On a phone the right drawer closes after a step from the panel, and a short
Notice shows the rule and position ("Gerúndios · 2 / 9"), since the counter has gone
with the drawer. It only suggests; it never changes text, only moves the selection.

**Language.** Set in the settings: Automatic (the default), Português (Brasil) or
English. Automatic follows Obsidian's language: any `pt` locale gives pt-BR, any `en`
locale gives English. Any other locale gives **no language**: echoes, adverbs, gerunds
and readability are off (running English rules on Spanish prose would be confidently
wrong), the panel says "Choose a language in settings" with an "Open settings" button
that opens Escrita's settings tab, and crutch words, name variants, long sentences and
dialogue share still work.

**Rules** (each on/off in settings; language from a setting, `pt-BR` or `en`):

| Rule | pt-BR | en |
|---|---|---|
| Echoes | The same stem (the `"word"` profile) within N words (default 40, every word counts). Each later occurrence is one match, with the earlier one drawn fainter. The window runs across paragraphs and starts over at a scene break and at a heading. Ignored: stop words, words under 4 letters, words under `## Ignorar`, listed names, and any word the note capitalizes in mid-sentence (a name needs no list: a sentence-initial *Fernando* is still a name) | same |
| Adverbs | Words ending in `-mente` with at least 3 letters before it (so `mente`, `semente`, `demente` and `ente` never match), minus an exceptions list (`clemente`, `veemente`, `dormente`, and the subjunctives of `-mentar` verbs such as `aumente`, `comente`, `lamente`). Capitalized words in mid-sentence are names, not adverbs | Words ending in `-ly`, 5 letters or more, minus about 45 exceptions (`only`, `family`, `reply`, `early`…) |
| Gerunds | `-ando/-endo/-indo`, also with a clitic (*dizendo-lhe*, *olhando-a*; the match spans the whole word), minus exceptions (`quando`, `mundo`, `lindo`, `segundo`, `fundo`, `redondo`…) and minus names (listed, or capitalized in mid-sentence, as *Fernando*, *Armando*). Gerundismo: a form of `ir`, then a form of `estar`, then a gerund, in one sentence with at most one word between the parts (*vou estar enviando*); *deve estar chegando* is normal Portuguese and never matches. A sentence with 3 or more gerunds gets one extra match spanning it | "began to / started to + verb" (also *begins, begun, beginning, start, starts, starting*), over the whole construction. `-ing` chains are not flagged |
| Crutch words | From the user's list note: exact phrases, whole words, any case, any line break or run of spaces inside. No stemming, so list *começou a* and *começaram a* both | same |
| Name variants | A capitalized word close to a name in the name list, by the name's length: 3 letters or fewer, only a transposition or a doubled or undoubled letter (*Aan*, *Anna*; never *Asa* against *Ana*); 4–5 letters, one edit; 6 or more, two. Not the name itself, not another form of it by the `"name"` stem, not a listed or ignored word, and not a word the note also writes in lowercase (so a sentence-initial *Teu* doesn't flag against *Teo*) | same |
| Long sentences | Sentences over N words (default 45), dialogue included; one match per sentence, drawn as a faint tint so it doesn't stack under the word marks | same |

**Measures** (in the lens panel, above the rule counts; for the note, and for the
selection when there is one, labelled "Selection"; the rule counts stay whole-note, so
stepping has one stable list). They describe the text; they don't underline anything.
Every lens number counts the same words (the words the lens read), so rates, the dialogue
share and readability agree. The lens skips headings, `$$` math blocks and, with the
setting on (the default), `>` quote lines, so it can differ a little from the status
bar's word count.

- **Dialogue share**: the percentage of words that are speech, from the same
  `dialogueInDoc` that dialogue focus uses (feature 7), so dash dialogue counts. Per
  scene too, split at scene breaks and shown when the note has more than one scene, so a
  chapter shows where it is all talk or none.
- **Readability**: average sentence length, average word length in syllables, and a
  reading-ease score. pt-BR: Flesch adapted to Portuguese (Martins et al., 1996:
  `248.835 − 1.015 × words per sentence − 84.6 × syllables per word`), in four bands
  (very easy, easy, hard, very hard). English: Flesch reading ease, in seven bands.
  Shown with its band and what it means, not as a grade to chase; "—" under 100 words
  or 3 sentences, and off when there is no language.

Syllables are counted by rule (vowel groups, with Portuguese diphthongs and hiatus, and
English silent `e`), approximate on purpose (about 95% exact on running text); a pt
rising sequence counts as two (*histó-ri-a*). Tests pin a word list per language and the
score of the sample conto. Book-wide measures wait for N 10.

**Stemming.** Two stemmers ship in this version, both in `core/stem/` so the universe
(U 1.2, 1.4) can reuse them without depending on the revision lens:

- **Portuguese**: a small suffix-stripping stemmer in the shape of RSLP (clitic split,
  adverb, plural, feminine, augmentative/diminutive, verb suffix, final vowel and
  accents), so *olhar / olhou / olhando / olhares* share a stem, and *Mariazinha* shares
  a stem with *Maria*. There is no noun-suffix step: it would merge *casa* with
  *casamento* and *mente* with *mentira*.
- **English**: a light Porter2 stemmer: possessive (step 0), plural (1a, with `-es` also
  after x, z, ch and sh), `-ed` and `-ing` with undoubling and a restored `e` (1b), `y`
  to `i` (1c), Porter2's final-`e` rule, and `-ly` on stems of 4 letters or more, so
  *walk / walks / walked / walking* share a stem. Steps 2 to 4 stay out (*universe* is
  not *university*).

One interface for both, `stem(word, lang, profile)`, with the language picked by the
revision language setting. The `"word"` profile is the one above. `"name"` is the light
profile for people and places: plural and diminutive/augmentative only in Portuguese, no
feminine step, so *Mariano* and *Mariana* stay apart (so do *Maria* and *Mário*); in
English the possessive and a simple plural, never Porter (*James* stays *james*). Pure
TypeScript, tests on real word lists in each language; accept imperfection, prefer
missing a match over a wrong one. The expected word lists are frozen fixtures: a change
to a stem key is a matching change for everything that reuses it.

**User lists in the vault.** One note, path in settings (author: `Modelos/Revisão.md`),
with headed sections the plugin reads. Headings are Portuguese or English, in any case
and with or without accents (`Vícios` / `Crutch words`, `Nomes` / `Names`, `Ignorar` /
`Ignore`), one entry per line; list markers, `%% %%` comments and anything under other
headings are skipped. The note is re-read when it changes, and the setting follows it
when it is renamed.

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

`Ignorar` covers echoes, adverbs, gerunds and name variants, and adds to the built-in
exceptions; it does not cover crutch words, which the writer listed on purpose. Matching
never folds accents for a single word (*está* is not *esta*). The built-in pt-BR tables
(stop words, exceptions) are language data, applied when the language is pt-BR; nothing
needs editing in code. There is no built-in crutch list. The command **"Create the word
lists note"** (also a button in the settings) writes a new note with the three headings
and a short starter crutch list in the lens language (pt-BR: *de repente, começou a, meio
que, viu, ouviu, sentiu, percebeu*; en: *all of a sudden, started to, sort of, saw, heard,
felt, noticed*). It never overwrites: if the note exists, it opens it and says so. With an
empty note the crutch and name rules stay silent, and the panel says "Add a word lists
note" (or "Word lists note not found" when the setting points at a missing note).

**Adding to the lists (0.5.1).** With the lens on, the editor's context menu offers
"Add to crutch words", "Add to names" (a capitalized word or name; lowercase connectors
like "da" or "of" are allowed inside, not at the end) and "Always ignore" (a single word).
The entry is the selection (one line, 1 to 6 words) or the word under the cursor; a
selection containing `%%` or starting with a list marker gets no items. The line is written
under the matching heading of the lists note (created, with the heading, when missing), and
a duplicate says "Already in the list" and writes nothing. If the lists note is missing a
starter note is created, and an empty setting is filled in. The author waived mockups for
this item.

**Dismissing.** A match can be dismissed ("Ignore here"), from the editor's context menu
on a match (a disabled header names it: "Advérbio: lentamente") and from the panel while
stepping. Dismissals are stored in plugin data by note path + rule + matched text + up to
three words either side, so they survive edits elsewhere in the note, follow the note
when it is renamed, and are dropped when it is deleted (500 per note at most). Dismissed
matches are left out of everything: marks, counts, rates and stepping. To undo, the panel
shows "N ignored · Clear" for the note; Clear asks "Show the 2 ignored matches in this
note again?" (Cancel / Show) before bringing them back.

**Skip** frontmatter, comments, code, links' targets and quotes in `>` blocks (setting).

**Pure, tested:** tokenizer (Portuguese letters, hyphenated words, apostrophes),
sentence splitter (handles `…`, `—` dialogue, abbreviations like `Sr.` and `Dra.`; our
own, not `Intl.Segmenter`), Portuguese and English stemmers, each rule as a function
over the tokens and sentences built once per pass, with `analyze(md, options)` as the
text-level function, and the per-1,000 rate.

**Done when** the rules produce stable, explainable matches on a sample conto (an
original text written for the tests, not the author's, kept as a fixture in
`tests/fixtures/`), the editor stays responsive on a 10,000-word note (one debounced full
pass, 400 ms after the last change, 800 ms on mobile; underlines drawn only for the
visible range from the cached pass, and mapped through edits between passes so they don't
jump; the pass itself under 60 ms locally, with a looser ceiling in CI), and the
no-network test still passes.

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

## 8. Move a paragraph or scene (v0.4, shipped)

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

## 9. Insert from a template (v0.6, shipped in 0.6.0)

**Why.** Writers reuse small scaffolds: a scene with its beats, a revision checklist, a
note for a contest entry. Tris uses Hotkeys for Templates for this. Escrita only knows
the chapter template.

**What it does.** A setting "Templates folder" (empty by default). Command "Insert from
a template" (editor only, Live Preview or Source; no default hotkey) lists the notes in
that folder, with each template's path under its name. The chosen one's body goes in at
the end of the selection (the cursor when nothing is selected), with `{{title}}`,
`{{date}}` and `{{time}}` filled in as in the chapter template, and its properties merged
into the note's only where the note doesn't have them yet, never overwriting. The body and
the properties go in as one editor transaction, so one undo takes everything back. A body
never lands inside the frontmatter, and one that follows a closing `---` starts on a line
of its own. The note you are in is left out of the list. Beats and placeholders in a
template work as usual once inserted.

Without a templates folder the command shows a notice with an "Open settings" button; an
empty folder gets a notice naming it. If the note changes while the template loads, nothing
is inserted and a notice says so. It works in every universe mode.

The universe's per-type templates (U 1.3) and the chapter template use the same filling
code, `core/template.ts` (`renderTemplate`, `templateVars`, `splitTemplate`,
`mergeProperties`, `planTemplateInsert`); the chapter's code re-exports it.

**Done when** inserting a scene template into a chapter fills its variables, keeps the
chapter's properties, and undoes in one step.

---

## 10. Set up a writing vault (v1.0; feature switches in v0.7)

**Why.** Escrita has many settings, and a new user meets them before writing a word.
Tris gives his readers a ready-made vault; Escrita can build one.

**What it does.** Command "Set up a writing vault", offered once on first run (a notice
with a button, never a modal that blocks). It asks what the user writes (short pieces,
a novel, both) and their language, then shows what it will create before creating it:

- Folders for short pieces and for books, set as track folders.
- One example conto and one example book with two chapters, with beats, a placeholder
  and a target, so every feature has something to show. Marked as examples and safe to
  delete.
- Settings to match (language, quote style, stage values, paragraph style).
- A home note with the works block (feature 11), set to open on startup.
- A writing layout, applied once: the home note in the main tab and Escrita's views
  docked in the sidebars (the outline on the right). After that the layout is the
  writer's: Obsidian keeps whatever they change in its own workspace file, and Escrita
  never rearranges it again. Escrita doesn't save layouts of its own.

It never touches existing notes; if a folder exists, it is used as it is and listed.
The layout step is listed with the rest and can be unticked; in a vault with a layout
already set up it is unticked by default.

**Features you can turn off (v0.7).** Ships before the rest of this section, with
IMPROVEMENTS 6. Escrita has grown into many features, and most writers
use a few. A **Features** page at the top of the settings lists every feature, grouped by
the stage of a work it serves, each with a switch and one line on what it does:

- Writing: goals and sprints (with the status bar), outline and ghost beats,
  placeholders, Enter flow and smart typography, dialogue focus, move a paragraph or
  scene, insert from a template, word counts in the explorer.
- Revision: revision lens, snapshots, darlings.
- Tracking ("Acompanhamento" in pt-BR): stages and the home block.
- Publishing: publish check, and export and submissions once they ship.
- The world: the universe (its switch is the universe mode, so there's one control, not
  two) and open threads.

A feature that is off is not loaded: no commands, views, menu items, editor extensions
or index work, and its settings section is hidden. Its data stays (goals history,
snapshots, darlings, thread dates), so turning it back on loses nothing. Features that
depend on another say so next to the switch (the stage snapshot needs snapshots) and
can't be on without it. Shared services (the classifier, the measurer, the vault index)
are always on.

**Presets (v1.0).** The setup command offers three starting points, and the Features page has
the same three buttons, each showing what it will switch before it does:

- **Essentials**: outline, goals, placeholders, darlings, snapshots, the home block.
  For a writer who wants to write and not run a plugin.
- **Writer** (default for new installs): Essentials plus the revision lens, dialogue
  focus, moving blocks, templates, explorer counts and the publish check.
- **Everything**: every feature on. The universe mode is asked separately (per book or
  universe), since it shapes folders.

Existing installs keep every feature on when they update, so nothing disappears
without the writer choosing it. A preset is a starting point, not a mode: after it,
each switch is the writer's, and the page shows "Custom" when they differ from all
three.

**Design first.** Mockups of the Features page before 0.7, and of the layout (desktop
and phone) and the setup steps before 1.0, on the design canvas.

**Done when** an empty vault goes from install to a working book and conto in one
command, laid out for writing; the writer's later layout changes survive a restart;
running it in a vault with notes changes none of them; and turning a feature off and on
again at runtime leaves no command, view or listener behind and loses no data.

---

## 11. The writing desk (v0.4, shipped)

**Shipped in 0.4.0:** stages, the stage snapshot, the home block, where you left off
and open on startup. The legacy settings keys stay in `data.json` for a downgrade;
the old status colors that match no stage live on as `otherStatusColors`.

**Why.** Escrita had many features and no workflow: nothing said what to write today,
and the `status` property only colored a dot in the outline and changed at publish.
The goal is to open the vault, see what you're writing, click, and be typing. Decided
in a design review on 2026-10-01; the rules it set are in ARCHITECTURE.md, "Workflow".

**Stages.** Five fixed stages, each mapped in settings to the writer's own words
(the first word is the one Escrita writes; more words are accepted):

| Stage | Default | Author's vault |
|---|---|---|
| idea | `idea` | `ideia` |
| draft | `draft` | `rascunho` |
| revision | `revision` | `revisão` |
| ready | `ready` | `pronto` |
| published | `published` | `publicado` |

- Planning has no stage of its own: beats and the outline happen on an idea.
  Submitted isn't a stage either: a work out at three magazines is still ready
  (submissions are records, feature 12).
- The mapping replaces `publishedValue`, `unpublishedValue` and `statusColors`, with a
  color per stage. Migration: the published value becomes the published stage, the
  unpublished value the ready stage, colors are matched to stages by value, and colors
  that match no stage are kept as extra values, so nothing set is lost.
- Stages change nothing by themselves: every command works in every stage, and words
  count in every stage.

**Works.** A work is what moves through the stages: a book (its stage is the book
note's `status`, set by hand, never derived from the chapters) or a tracked
standalone note whose status is a known stage. A note with no status, or an unknown
one, isn't a work. Chapters aren't works: their status is progress inside the book.
`classify` gains a `stage` field (`string | null`); no new kind.

**Stage snapshot.** On any status change of a work (properties panel, sync, a hand
edit, detected through `metadataCache` `changed` against the last known stage),
take a snapshot named after the transition, "rascunho → revisão". A new kind,
**stage**, never pruned. An unchanged note takes nothing (the usual identical-take
rule). The only automatic action tied to a stage; it gives "compare with the first
draft" for free.

**Home block.** A code block in any note the writer owns:

````
```escrita-works
```
````

Escrita draws it live (`registerMarkdownCodeBlockProcessor`) and never writes to the
note; text around the block is the writer's. Without Escrita it is an empty code
block.

```
  Escrevendo
  O porão ............ 4,210 / 5,000 · prazo 15 out
  Carta à mãe ........ 1,020

  Revisando
  A casa ............. 7 de 12 capítulos prontos

  4 ideias · 1 pronto · 6 publicados · 3 sem estágio
```

- Only draft and revision works get a line: the title and at most one fact. Writing:
  length against target (a book: words against its `goal`), plus the deadline when one
  is set. No target, just the count. A book in revision: chapters whose status is ready
  or later, out of all chapters.
- Every other stage is one count in the last line; clicking a count expands its list
  in place. "sem estágio" (tracked notes with an unknown status) appears only when
  there are some.
- No bars, buttons, dropdowns or badges. The stage is changed in the note's
  properties, as before.
- Optional `folder:` line in the block to show one area (Contos, Textos, a book).
- Clicks must not put the cursor into the block in Live Preview.

**Where you left off.** Clicking a work opens it at:

1. the writer's last edit in it: a position plus some context around it, recorded
   when the note is left or closed (never per keystroke), kept in `data.json` for
   works only, following renames through the vault index; found again with the
   darlings' `findRestoreOffset` rule, so sync and outside edits don't lose it;
2. else the first unwritten beat;
3. else the end of the text.

A book opens its last edited chapter at its last edit; with no record, the first
chapter with an unwritten beat, else the last chapter. The spot is scrolled to the
middle, with no highlight; a lost context falls through quietly.

**Open on startup.** Setting "Home note" (a path, empty by default) and "Open it on
startup" (off by default). When on, the home note opens in the active tab after the
workspace is restored, or is focused if already open. Command "Open the home note"
offers to create `Home.md` (`Inicio.md` when Obsidian is in Portuguese, no accent) with
the block when there is none.

**Pure, tested:** stage mapping and migration, `stageOf(status, mapping)`, the works
list and its lines from classified notes and counts, the "left off" resolution.

**Design first.** A mockup of the block on the design canvas (light and dark, narrow
and phone) before it is built.

**Done when** the author's vault opens on the home note, it lists the contos in
rascunho and revisão with the right counts, a click lands at the last edit, moving a
conto to revisão takes a stage snapshot, and existing status settings carry over.

---

## 12. Submissions (v0.8)

**Why.** Sending a conto to contests and magazines, and tracking where it went and
what came back, is a large part of short fiction. It ships with export (novel
roadmap, 7), since export is how a work gets sent.

**What it does.** One note per submission, in a folder (setting, default
`Submissions/`), with plain properties: `work` (a link to the work, so renames are
followed by Obsidian), `market` (plain text; a link to a market note works too, with
no market features), `sent`, `result` (`pending`, `accepted`, `rejected`,
`withdrawn`, values from settings), `responded`. The body is free: the editor's
note, the contract. Bases or Dataview can table them without Escrita.

- Command "Record a submission" for the active work: asks for the market, fills the
  date, creates the note.
- The home block's ready count can show "2 pendentes" when submissions are pending.
  Nothing more in the block.
- `classify` gains a `submission` field, like `snapshot`; submission notes are never
  works or tracked.

**Done when** recording a submission for a conto creates a note that links back to it,
renaming the conto updates the link, and the notes read well with Escrita turned off.

---

## Settings summary (new)

| Section | Setting | Default | Author's vault |
|---|---|---|---|
| Stages | Idea / draft / revision / ready / published values (replace published and unpublished values, status colors) | `idea`, `draft`, `revision`, `ready`, `published` | `ideia`, `rascunho`, `revisao`, `pronto`, `publicado` |
| | Other status colors (`otherStatusColors`: one `word: color` per line, for statuses that are not a stage, such as chapter ones) | (empty) | (migrated from the old status colors) |
| | Home note / open it on startup | (empty) / off | `Início.md` (their existing note) / on |
| Submissions | Folder / result values | `Submissions` / `pending`, `accepted`, `rejected`, `withdrawn` | (author's choice) |
| Publishing | Date property | `date` | `date` |
| | Recommended properties | `description` | `description` |
| Goals | Target, limit, unit properties | `target`, `limit`, `unit` | same |
| | Deadline property, book goal property | `deadline`, `goal` | same |
| | Word counts in the file explorer | on | same |
| | Folder totals / target next to the count | off / off | (author's choice) |
| | Weekdays off / dates off | none | (author's choice) |
| Snapshots | Folder | `Escrita/Snapshots` | same |
| | Auto snapshot before first edit of the day | off | (author's choice) |
| | Keep automatic snapshots | 20 | same |
| Revision | Language | Automatic (from Obsidian's language) | `pt-BR` |
| | Word lists note | (empty) | `Modelos/Revisão.md` |
| | Echo window / long sentence length | 40 / 45 | same |
| | Skip quotes (`>` lines) | on | same |
| | One toggle per rule | all on | same |
| | Show dialogue share / readability | on / on | same |
| Templates | Templates folder (read by "Insert from a template" and offered nowhere else) | (empty) | `Modelos` |

After each milestone, update the author's `escrita/.obsidian/plugins/escrita/data.json`
in the website repo and the "Plugin Escrita" section of `escrita/Como usar.md`.
