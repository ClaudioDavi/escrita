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
| **Universe** | A shared world across works | `Universe/` folders, shared | Every work in the universe |

Rules:

- **Off is the default for new installs.** Commands are only registered, and the
  universe panel only offered, when the mode isn't off (re-register on
  `settingsChanged`). No property is ever added to a note while the mode is off.
- **Features that don't need a universe work in every mode**: open threads (1.5) are
  listed per work when off or per book, and per universe in universe mode; names from
  the entry folders feed spellcheck and the revision lens (1.4) in per-book mode too.
- **Per book** reuses the book convention: entry folders are subfolders of the book
  folder (names configurable, author: `Personagens`, `Lugares`), and every feature is
  scoped to that book. Short stories have no entries in this mode.
- **Switching modes never moves or edits files.** Per book → universe offers the
  migration command (1.1) with a preview; universe → per book or off only hides
  features. Notes stay where they are.
- **Mixed vaults**: in universe mode, a work without a `universe` property (and not in
  a folder with a default universe) is standalone. Its entries live in its own book
  folder (per-book rules) and are invisible to the universe.
- Implementation: a pure `scopeFor(file, settings) → { kind: "none" | "book" |
  "universe", root }` in `src/universe/scope.ts` that every feature asks first; tested
  for each mode and for mixed vaults.

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

### 1.1 Universe container and entry types (v0.6)

**Convention** (all names configurable):

```
Universo.md                     ← universe note (properties: name, description)
Universo/
    Personagens/                ← characters
    Lugares/                    ← places
    Objetos/                    ← objects
    Grupos/                     ← families, institutions, groups
    Eventos/                    ← events (feeds the timeline in phase 2)
Contos/O farol.md               ← a work: universe: "[[Universo]]", form: conto
Romances/A Casa.md              ← a book: universe: "[[Universo]]", form: romance
```

- **A work joins a universe** with a `universe` property linking to the universe note.
  Book chapters inherit it from the book note. A default universe (setting) applies to
  notes in chosen folders without the property, so existing contos join without edits.
- **Entry type by property** (`type: character`, `place`, `object`, `group`, `event`;
  values configurable, author: `tipo: personagem`, `lugar`, …). Folders are the default
  place for new entries, not the source of truth, so entries can move freely. Bases can
  already build tables from these properties.
- **Several universes** are allowed (a writer with two worlds); entries belong to a
  universe by folder or by their own `universe` property.
- **`form` on works** (`conto`, `novela`, `romance`, `poema`, `fragmento`; configurable).
  A novella can be a single note or use the book convention.
- **Migration command** "Move this book's characters and places to the universe":
  moves `Romances/<Book>/Personagens/*` and `Lugares/*` into the universe folders with
  `fileManager.renameFile` (links update), after a preview. Name clashes are listed, never
  overwritten.
- **Universe panel** (`ItemView`, type `escrita-universe`): entries grouped by type,
  searchable, each with its type, aliases and number of works it appears in; a works tab
  listing all works in the universe by form and status.

### 1.2 "Appears in" across works (v0.7)

Novelcrafter's Codex idea, without AI, universe-wide and Portuguese-aware.

- **Matching**: each entry's file name and `aliases` matched as whole words in the prose
  of every work in the universe (`core/wordcount.proseOnly` text, so comments and
  frontmatter don't count). Case-insensitive by default; per-entry `caseSensitive`.
- **Portuguese inflection**: plural, feminine, diminutive and augmentative forms
  (*Maria / Mariazinha*, *menino / meninos / menina*) through the Portuguese stemmer in
  `core/stem/` (built in v0.5 with the revision lens, short-fiction roadmap feature 5).
  English: plural and possessive (`Teo's`) through the English stemmer from the same
  module.
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

### 1.3 Create entry from selection (v0.6)

- Editor menu and command "Create universe entry from selection": pick the type, then
  create the note in the type's folder from its template (setting per type; the vault
  already has `Modelos/Personagem.md` and `Modelos/Lugar.md`), with the selection as the
  title, `type` and `universe` set.
- Options in the same modal: link this occurrence, and add another alias.
- If an entry with that name or alias exists, offer to open it instead.
- **Names without an entry** (a tab in the universe panel, from v0.7 when the matcher
  exists): capitalized words that recur across works, aren't at a sentence start, and
  match no entry or alias, each with a Create button that opens this modal. A dismiss
  list keeps ordinary words out.

### 1.4 Names into spellcheck and the revision lens (v0.7)

- Every entry name and alias in the universe is added to the editor's spellcheck
  dictionary so invented names stop being flagged. Obsidian doesn't expose a dictionary
  API; use the Electron session spellchecker only on desktop behind a guard
  (`isDesktopApp`, try/catch), and on mobile skip it. Never remove words the user added.
- The revision lens's name-variant rule reads names from the universe instead of (or in
  addition to) its word-list note: *Marianna* when the entry is *Mariana*.

### 1.5 Open threads (v0.6)

Hooks planted in one story for future stories.

- Syntax: `%% thread: quem escreveu as cartas? %%` (keyword configurable), a single-line
  comment like beats and placeholders, so it never shows in Reading view or an export.
- Parser in `core/markers.ts` next to beats and placeholders; tests.
- Threads panel (a tab in the universe panel): all open threads in the universe, grouped
  by work, with the text and date first seen; click to jump.
- Closing a thread: a `%% thread closed: … %%` form, or a button that rewrites the marker
  as closed after checking the exact text is still there. A thread can name the work that
  answers it (`%% thread: … → [[A Casa]] %%`).

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
| Entry folders in per-book mode | `Characters`, `Places`, … | (not used) |
| Universe note / folder | `Universe.md` / `Universe/` | `Universo.md` / `Universo/` |
| Default universe for folders | (none) | `Contos`, `Textos`, `Romances` |
| Type property and values | `type`: character, place, object, group, event | `tipo`: personagem, lugar, objeto, grupo, evento |
| Folder per type | `Characters`, `Places`, … | `Personagens`, `Lugares`, `Objetos`, `Grupos`, `Eventos` |
| Template per type | (none) | `Modelos/Personagem.md`, `Modelos/Lugar.md` |
| Form property and values | `form`: short story, novella, novel, poem, fragment | `forma`: conto, novela, romance, poema, fragmento |
| Thread keyword | `thread` | `fio` or `thread` (author's choice) |
| Underline names in the editor | off | (author's choice) |
| When / born / died / canon properties | `when`, `born`, `died`, `canon` | same or Portuguese names |
