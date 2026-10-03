# Roadmap: a shared universe

The author plans to write most stories in one universe: short stories, novellas,
novels and other forms, all part of an expanding world where characters, places and
events carry over between works. Today characters and places live inside one novel's
folder (`Romances/<Book>/Personagens/`), so contos can't share them. This roadmap
makes the **universe** the container and every work a part of it.

Versions are decided in [ROADMAP.md](ROADMAP.md): 1.1, 1.3 and 1.5 in v0.6; 1.2 and 1.4 in
v0.7; phase 2 in v0.9, which completes the universe for v1.0.

It is independent of [ROADMAP-short-fiction.md](ROADMAP-short-fiction.md) and
[ROADMAP-novel.md](ROADMAP-novel.md); where features overlap (character tracking in the
novel roadmap, the name-variant rule in the revision lens), build them once, here, at
universe scope, and let the other roadmaps reuse them.

Same ground rules as the other roadmaps and [ARCHITECTURE.md](ARCHITECTURE.md):
**no network, no AI**; generic settings with English defaults (the author's values in
the vault's `data.json`); design mockups on the canvas
(https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6) before UI work; suggest, never
rewrite prose; mobile-safe; pure logic tested with vitest.

## Modes: the universe is opt-in

Not every writer wants a shared world. One setting, **Shared universe**, decides how
much of this roadmap exists for a user:

| Mode | For | Where characters and places live | Scope of "appears in", continuity, create-from-selection |
|---|---|---|---|
| **Off** (default) | Writers who don't want any of it | Nowhere in particular | Hidden: no panel, no commands, no properties added |
| **Per book** | Standalone novels | Inside each book: `<Book folder>/Characters/`, `Places/`… (today's convention) | That book's chapters only |
| **Universe** | A shared world across works | The folder beside the universe note (`Universe.md` → `Universe/`), shared | Every work in the universe |

Rules:

- **Off is the default for new installs.** The universe panel (view type
  `escrita-universe`) and the universe commands exist only when the mode isn't off.
  Obsidian can't unregister a view or a command, so the view type stays registered but its
  leaves are closed when the mode goes off, and each universe command hides itself with a
  `checkCallback` (no re-registering needed). No property is ever added to a note while
  the mode is off, and none is added without an explicit click.
- **Features that don't need a universe work in every mode**: open threads (1.5) are
  listed over the tracked works when off (a standalone "Open threads" view, command
  "Show open threads"), over the book when per book, and over the universe's works in
  universe mode. "Plant a thread" and "Insert from a template" (SF 9) work in every mode.
  Names from the entry folders feed spellcheck and the revision lens (1.4) in per-book
  mode too.
- **Per book** reuses the book convention: entry folders are subfolders of the book
  folder, with the same per-type folder names as the universe uses (`Personagens`,
  `Lugares` for the author), and every feature is scoped to that book. Short stories
  have no entries in this mode.
- **Switching modes never moves or edits files.** Per book → universe offers the
  migration command (1.1) with a preview; universe → per book or off only hides
  features. Notes stay where they are.
- **Keeping one note out (v0.7)**: `universe: false` makes a note standalone even when
  it sits in a folder in the universe (an essay in a folder of contos). On a book note it
  keeps the book's chapters out too, unless a chapter links a universe itself. It is
  checked before every other rule, and it's a YAML boolean, so there's no word to
  translate and no setting. The panel's "Add to" button doesn't show for such a note,
  since the writer chose to keep it out.
- **Mixed vaults**: in universe mode, a work without a `universe` property (and not in
  a folder with a default universe) is standalone. Its entries live in its own book
  folder (per-book rules) and are invisible to the universe.
- Implementation: a pure `scopeFor(file, settings, lookup) → { kind: "none" | "book" |
  "universe", root, note }` in `src/universe/scope.ts` that every feature asks first;
  tested for each mode and for mixed vaults. In universe mode the first match wins:
  the note's own `universe` property (a chapter's own property wins over its book note's);
  the book note's property; being inside the universe folder (entries join by folder,
  no property needed); being inside a default-universe folder; belonging to a book (that
  book, per-book rules); else none. A `universe` link that points at no note is read as
  a typo and joins nothing.

The author's vault uses **Universe** mode.

## Phases

| Phase | Contents | Effort |
|---|---|---|
| 1 | Universe container and entry types · "Appears in" across works · Create entry from selection · Names into spellcheck and revision lens · Open threads | M–L |
| 2 | Story timeline · Facts that change over time · Continuity checks · Canon status | L |

Phase 1 is useful as soon as contos start sharing characters, so it can run alongside
the short-fiction roadmap.

---

## Phase 1

### 1.1 Universe container and entry types (v0.6, shipped in 0.6.0)

**Convention** (names are settings; the author's are shown):

```
Universo.md                     ← universe note (properties: name, description)
Universo/                       ← the folder beside it with the same basename
    Personagens/                ← characters
    Lugares/                    ← places
    Objetos/                    ← objects
    Grupos/                     ← families, institutions, groups
    Eventos/                    ← events (feeds the timeline in phase 2)
Contos/O farol.md               ← a work: universe: "[[Universo]]", forma: conto
Romances/A Casa.md              ← a book: universe: "[[Universo]]", forma: romance
```

- **No universe folder setting.** The entries folder is the folder next to the universe
  note with the same basename (`Universo.md` → `Universo/`). One setting, the universe
  note, names both. A `universe` link to another note makes that note's own folder the
  root, so a second world needs no setting.
- **A work joins a universe** with a `universe` property linking to the universe note.
  Book chapters inherit it from the book note, and a chapter's own property wins. Notes
  inside the universe folder join without a property. A setting, "Folders in the
  universe", also lets notes in chosen folders join without the property, so existing
  contos join without edits.
- **Entry type by property** (`type: character`, `place`, `object`, `group`, `event`).
  There are **five fixed types**, renamable but not addable or removable, like the
  stages. Each has a value (the word in the property), a folder, a template (optional)
  and a label ("Name in menus"). The folder is the default place for new entries, not the
  source of truth, so entries can move freely. Bases can already build tables from
  these properties. The phase 2 timeline reads the event type.
- **Per-book mode uses the same per-type folder names** inside the book folder
  (`Romances/A Casa/Personagens/`). There is no separate setting for them.
- **Several universes** are allowed (a writer with two worlds); entries belong to a
  universe by folder or by their own `universe` property. The panel has a picker.
- **`form` on works** (short story, essay, novella, novel, poem, fragment; the property and
  the six words are settings; author: `forma`: conto, ensaio, novela, romance, poema,
  fragmento). A novella can be a single note or use the book convention. It groups the
  Works tab.
- **Form by folder.** A setting maps folders to forms (`Folder: form` lines; author:
  `Contos: conto`, `Textos: ensaio`, `Romances: romance`), so works take their form
  from where they live and nobody has to add the property. A work's own `form` wins,
  and the deepest matching folder wins over a shallower one. Nothing is written.
- **Add to the universe.** In the panel, a note that is outside any universe has an
  "Add to <universe>" button. It sets the `universe` property on that note, only on that
  explicit click, and only when the note has none.
- **Migration command** "Move this book's entries to the universe" (also in the book
  note's file menu, in universe mode): moves `<Book>/Personagens/*`, `Lugares/*`… into
  the universe's per-type folders with `fileManager.renameFile` (links update), one note
  at a time, after a preview. A note goes to the deepest matching type folder; chapters
  are never moved. Name clashes are listed, never overwritten. The preview has two
  checkboxes: **add the type property where it's missing** (from the source folder) and
  **add `universe` to the book note when it's missing**. Migration only adds, never
  changes a value. When the target is not the settings' universe, each moved note also
  gets the `universe` property, where missing, since its folder alone doesn't join it.
- **Universe panel** (`ItemView`, type `escrita-universe`; tabs Entries, Threads, Works):
  - *Entries*: grouped by type (headings are the last segment of the type's folder),
    searchable by name and alias, collapsible, with a + per group and a "New entry"
    button. Row menu: open, open to the side, insert link in the note (never into the
    properties, code or a comment), reveal in the explorer. In per-book mode it shows
    the active note's book.
  - *Works*: the works in the universe grouped by the form property (an unknown or
    missing form goes under "No form"), sorted by stage (published first) then name, a
    dot in the stage color, the word count from `plugin.measure`. A click opens the work
    where the writer left off (the desk's open logic).
  - There is **no "appears in N works" count** yet. It arrives in 0.7 with the matcher (1.2).
  - Mode off: the panel is closed and the commands hide. Threads have their own view (1.5).

### 1.2 "Appears in" across works (v0.7)

Novelcrafter's Codex idea, without AI, universe-wide and Portuguese-aware.

- **Matching**: each entry's file name and `aliases` matched as whole words in the prose
  of every work in the universe (`core/wordcount.proseOnly` text, so comments and
  frontmatter don't count). Case-insensitive by default; per-entry `caseSensitive`.
- **Portuguese inflection**: shipped in 0.5 as the stemmers in `core/stem/`, built with
  the revision lens (short-fiction roadmap feature 5). People and places match through
  `stem(word, lang, "name")`: plural, diminutive and augmentative (*Maria / Mariazinha*),
  and the feminine is skipped on purpose (*Mariano / Mariana* are different people).
  Common-noun entries and aliases match through `"word"` (*menino / meninos / menina*).
  A case-sensitive entry compares casing before the stem. English: plural and possessive
  (`Teo's`) through the English stemmer from the same module. The sentence splitter and
  title abbreviations (*Sr.*, *Dra.*) are in `core/sentences.ts`.
- **Ignore list** per entry (`ignore` property) for names that are also common words
  (a character named "Rosa", a place called "Porto"). An ignore entry can be a phrase
  ("Rosa dos ventos"), so the name still counts elsewhere.
- **First name as an alias**: for a character entry with a full name, its first word
  counts as an alias unless it's a title (*Dona*, *Seu*, *Dr.*, *Mr.*; list in
  settings). Per-entry `firstName: false` turns it off.
- **Explicit links count too**: a `[[Teo]]` link is a mention even if the text differs.
- **Index**: built after layout ready in small batches, kept current on modify, rename
  and delete (the placeholders index is the pattern). Pure matcher in
  `src/universe/match.ts`, tested on Portuguese samples.
- **Output**:
  - In the universe panel and in each entry note (a small "Appears in" section rendered
    by the plugin in the note's view, not written into the file): every work and chapter
    mentioning it, in story order when phase 2 exists, else by work, with counts and
    first/last mention. Click to jump.
  - Optional subtle underline of recognized names in the editor (setting, off by default).
  - "Unlinked mentions" list per work, so the author can add links if wanted.

### 1.3 Create entry from selection (v0.6, shipped in 0.6.0)

- Editor menu item and command "Create universe entry" (universe and per-book modes):
  pick the type, then create the note in the type's folder from its template (a setting
  per type, filled by the shared template code, SF 9), with the selection as the title and
  the `type` property set. `universe` is set in universe mode only (never in per-book mode).
  The same code serves the panel's + buttons, which pass the scope the panel shows.
- Options in the same modal: link this occurrence (through the note text port, refused
  if the text changed), and add another alias.
- If an entry with that name or alias exists, offer to open it instead, to just link
  here, or to create another anyway.
- A note outside any universe gets a notice that points to the panel's "Add to" button
  and the default-folders setting; the command never adds the property by itself.
- The universe link is written as the shortest link that is unambiguous
  (`fileToLinktext`), so two notes with one basename get a path.
- **Names without an entry** (a tab in the universe panel, from v0.7 when the matcher
  exists): capitalized words that recur across works, aren't at a sentence start, and
  match no entry or alias, each with a Create button that opens this modal. A dismiss
  list keeps ordinary words out. "Sentence start" comes from the sentence splitter and
  title abbreviations already in `core/sentences.ts` (0.5).

### 1.4 Names into spellcheck and the revision lens (v0.7)

- Every entry name and alias in the universe is added to the editor's spellcheck
  dictionary so invented names stop being flagged. Obsidian doesn't expose a dictionary
  API; use the Electron session spellchecker only on desktop behind a guard
  (`isDesktopApp`, try/catch), and on mobile skip it. Never remove words the user added.
- The revision lens's name-variant rule reads names from the universe instead of (or in
  addition to) its word-list note: *Marianna* when the entry is *Mariana*. The rule has
  taken a `names` option since 0.5, so this only feeds it entries.

### 1.5 Open threads (v0.6, shipped in 0.6.0)

Hooks planted in one story for future stories. They work in every mode.

- Syntax: `%% thread: quem escreveu as cartas? %%` (the keyword is a setting), a
  single-line comment like beats and placeholders, so it never shows in Reading view or an
  export. `parseThreads(src, keyword, closedWord)` in `core/markers.ts` reads them (markers
  in code or frontmatter don't count); tests in `tests/threads.test.ts`.
- **Closed form**: `%% thread closed: … %%`. The closed word is a setting
  (`threadClosedWord`, English default `closed`; the author sets `fechado` in their
  vault's `data.json`, never in code). The colon is required, so an open thread that
  starts with the word is not read as closed. `parseThreads` accepts the configured word
  and `closeThreadPlan` writes it.
- **Answer link**: a thread can name the work that answers it (`%% thread closed: … →
  [[A Casa]] %%`). The link drops any `|alias`, `#heading` and `^block`. The `%%` sequence
  is cleaned out of the text and the answer, so a marker can't end early.
- **Plant a thread**: command and editor menu item. It inserts the marker at the cursor,
  or at the end of the selection, padded with a space; the selected text becomes the
  thread's text and **stays in the prose** (a deviation from the first idea, to keep rule
  1: the command never removes text). On an empty line it fills the line when the lines
  around are blank; beside text it takes blank lines of its own; on a scene break or a
  table row it goes in a paragraph after it; a cursor inside a wikilink goes after the
  link. Refused in the properties, in code and inside a multi-line comment. One undo
  takes it back.
- **Where threads show**: mode off, a standalone "Open threads" view (command "Show open
  threads") over the tracked works; per book, the Threads tab scoped to the book;
  universe, the universe's works. Grouped by work (a chapter counts under its book), with
  the text, the date first seen and the answer link; click to jump to the marker. A
  footer toggle shows the closed ones.
- **First-seen dates** are stored in plugin data (`threadSeen`: path → thread text →
  time), never in the note. They follow renames through `plugin.index.follow`, go with a
  deleted note, and survive a thread disappearing and coming back with the same text.
- **Closing a thread**, from the panel (a popover with an optional "Answered in", and a
  preview of the new marker), from the editor menu or by the command "Close thread" with
  the cursor on the marker. Reopening keeps the answer link. The rewrite goes through
  the note text port and is refused if the marker moved or changed: the plan re-reads
  the text it runs on and accepts only the same line with the identical comment (no
  search, and CRLF files and unsaved editor text give the same answer). A refusal shows a
  notice and refreshes the list.
- **In the editor**: a small flag in the margin on a line with an open thread; a closed
  marker is muted and struck through (the marker only, never the prose around it).
  Decorations only, so the text is untouched.

---

## Phase 2 (v0.9)

### 2.1 Story timeline

- A `when` property on works, chapters, scenes (via beats: `%% beat: … | when: 1994-03 %%`
  is optional) and event entries. Accepts full dates, year-month, year, or a label
  mapped in the universe note (`eras:`) for vague times ("antes da guerra").
- Timeline view: all dated works and events in story order, with publication order as a
  second column; filter by character or place (uses "appears in").
- Reading-order suggestion: "read in story order" list for the universe, exportable as a
  note.
- **Shift dates**: select several works or events and move them together, either to
  a new start date (keeping the gaps) or by an amount (days, months, years), with a
  preview before writing the `when` properties.
- **Narrative mode** on a work or chapter (`mode`: `linear`, `flashback`, `flash-forward`,
  `dream`, `frame`; configurable): shown on the timeline, and used by the continuity
  checks (2.3).

### 2.2 Facts that change over time

- Entries keep stable facts in properties (`born`, `died`, `eyes`), and changes as dated
  sections in the note, e.g.:

  ```
  ## 1990
  Casa-se com Teo. Mora na casa da avó.
  ## 2003
  Vai embora da cidade.
  ```

  (heading format configurable: a date or a work link).
- "As of this story": from a work, the entry view shows the character's state at the
  work's `when` (facts up to that date), and hides later sections as spoilers.

### 2.3 Continuity checks (local rules, no AI)

- Age of each character in each work from `born` and the work's `when`, shown in
  "appears in" and the timeline.
- Warnings: a character appears in a work dated after their `died`; a work dated before
  a character's `born`; two works with the same character in different places on the
  same date (when both have place and date).
- Conflicting stable facts: the same property with different values in two entries that
  are aliases of each other, or an entry fact contradicted by a `%% fact: … %%` marker
  (optional, later).
- Works or chapters in a `dream` mode are skipped by the date checks, and `flashback` /
  `flash-forward` ones aren't flagged for being out of publication order, so a
  non-linear book doesn't drown in false warnings.
- Pure, tested checker in `src/universe/continuity.ts`; results in a "Continuity" tab.

### 2.4 Canon status

- `canon` property on works and entries: `canon`, `draft`, `apocryphal` (configurable).
- Non-canon works don't count for continuity checks and are shown dimmed in the timeline.

---

## Not in the plugin: website integration

Escrita is standalone (ARCHITECTURE.md, "Standalone"), so it writes nothing for a
website. A writer who publishes online can build "also in this universe" links,
story-order reading pages or a public wiki on their own site, reading the vault's
`universe`, `type`, `aliases`, `when` and status properties directly.

---

## Use other plugins for

- **Maps**: Zoom Map or Leaflet, with pins linking to place entries.
- **Family trees and relationship maps**: generate a Canvas from `relations` properties
  (`relations: ["[[Teo]] irmão", …]`) rather than building a graph view.
- **Fantasy calendars**: Calendarium, if the universe ever needs one.
- **Tables of entries**: Bases, over the `type` and `universe` properties.

## Settings summary (new)

| Setting | Default | Author's vault |
|---|---|---|
| Shared universe mode | off | universe |
| Universe note (its folder is the folder beside it, same basename; no separate folder setting) | `Universe.md` | `Universo.md` |
| Folders in the universe (join without the property) | (none) | `Contos`, `Textos`, `Romances` |
| Universe property | `universe` | same |
| Type property | `type` | `tipo` |
| Per type (five fixed types, renamable): value, folder, template, label | `character`, `Characters`, none, "Character"; likewise place, object, group, event | `personagem`, `Personagens`, `Modelos/Personagem.md`, "Personagem"; `lugar`, `Lugares`, … |
| Folders in per-book mode | the same per-type folders, inside the book | (not used) |
| Form property and values | `form`: short story, essay, novella, novel, poem, fragment | `forma`: conto, ensaio, novela, romance, poema, fragmento |
| Form by folder | (none) | `Contos: conto`, `Textos: ensaio`, `Romances: romance` |
| Thread word | `thread` | `fio` or `thread` (author's choice) |
| Thread closed word | `closed` | `fechado` |
| Underline names in the editor (0.7) | off | (author's choice) |
| When / born / died / canon properties (0.9) | `when`, `born`, `died`, `canon` | same or Portuguese names |
