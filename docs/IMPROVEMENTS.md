# Code improvements backlog

**Rule: every release includes at least one item from this list.** Pick it when
planning the version in [ROADMAP.md](ROADMAP.md) (its "Improvement" column), preferring
one that the version's features lean on. When it ships, move it to "Done" with the
version.

The list comes from an architecture review on 2026-09-30 (six candidates, of which
the first two shipped in 0.2.1) plus the loose ends that refactor left, and a second
review on 2026-10-03, before 0.7 (candidates 7–13), and the critique of its plan (candidate 14). Re-run the
review (`/improve-codebase-architecture`) when this list runs low or after a big
feature, and add what it finds here.

Vocabulary, as in the review: a **module** is **deep** when a lot of behaviour sits
behind a small **interface**, **shallow** when the interface is nearly as big as the
implementation. **Locality**: a change or bug lives in one place. **Seam**: where an
interface lives. Test through the interface.

## Candidates

### 5. Split the outline view along its concepts

**Strength:** speculative · mostly falls out of 1 and 3

- **Problem.** `outline/view.ts` (about 1,300 lines) holds target resolution, row
  loading (which `outline/index.ts` duplicates), the refresh race, rendering, the beat
  edits with hand-made checks, key dispatch, a long action switch doing file I/O, drag
  and drop, menus and caret helpers. The riskiest code, edits to chapter files, is
  only reachable through DOM code with no tests. `goals/progress-modal.ts` (about 780
  lines) has the same shape.
- **Change.** A chapter document module (rows, beats, checked edits, tested); the view
  keeps rendering and input.

### 6. Modules that load and unload at runtime

**Strength:** strong · **Pairs with:** feature switches (SF 10, 0.7) · **Planned for
0.7** (docs/PLAN-0.7.md, task 1.1 and wave 2)

- **Problem.** Every module is built and loaded at startup (`src/main.ts:116-131`), and
  its commands, views, menus, editor extensions and index specs are registered on the
  plugin (109 such calls across 13 module files), so they live until the plugin
  unloads. A module can't be switched off without a restart, and a feature the writer
  never uses still costs startup time and index work. The index hub can't remove one
  spec (`core/index-hub.ts:83-98`; only `unload()` disposes, `:130-142`). The universe
  (0.6) already needs commands and a view that come and go with its mode, and solves it
  locally with `checkCallback` and `syncMode` (`universe/index.ts:370-431`).
- **What Obsidian allows.** A child `Component` can only `registerEvent`,
  `registerDomEvent`, `registerInterval` and `register(cb)`. `registerView`,
  `registerEditorExtension`, `registerMarkdownCodeBlockProcessor` and `addCommand`
  are Plugin-only and have no undo, except `removeCommand`, which needs Obsidian 1.7.2
  (`minAppVersion` is 1.6.6), and ribbon and status bar elements, which can be
  `.remove()`d. So "`removeChild` undoes all of it" holds only for events.
- **Change.** Each module is constructed once and loaded and unloaded as a
  `Component` whose `load()`/`unload()` the registry calls itself, in order (not as a
  child of the plugin, whose unload order isn't ours to set). A `ModuleContext` per module is the one place that touches the
  Plugin-only calls and records a disposer for each:
  - commands through `addCommand` / `removeCommand` (raise `minAppVersion` to 1.7.2),
    or `checkCallback` gating if `removeCommand` misbehaves;
  - a **view slot**: each view type registered once; an off feature's leaves are
    detached and its factory builds an empty placeholder;
  - an **extension slot**: one mutable array per feature, registered once, refilled
    or emptied, then one `workspace.updateOptions()` per change (the trick
    `editor/index.ts:73`, `outline/index.ts:78` and `placeholders/index.ts:96` each
    copy today);
  - a **code block slot** for the desk's `escrita-works`, drawing plain code when off;
  - ribbon and status bar elements removed; index specs through a handle that removes
    them from the hub (`IndexHub.remove`), like `decorations.add` already returns an
    undraw (`core/explorer-decorations.ts:117`).

  A registry in `main.ts` knows each feature's switch and hard dependencies, loads the
  enabled ones in order, unloads in reverse, and applies on `saveSettings`. Followers
  of path-keyed data stay registered while a feature is off, so its data keeps
  following renames. The universe's mode-dependent registration moves onto it.
- **Runtime dependencies the registry must handle** (soft: checked at call time):

  | Caller | Callee | Where |
  |---|---|---|
  | Publish | snapshots | `publish/index.ts:141` (`beforePublish`) |
  | Outline view | placeholders | `outline/view.ts:185` (`onChange` returns a no-op when the index is null, `placeholders/index.ts:60-62`) |
  | Settings tab | lens | `settings.ts:489` (`createLists`) |

- **Wins.** Feature switches become a settings change, not a refactor; startup skips
  disabled modules; an unload test per module ("nothing left registered") catches leaks,
  which the community review checks.

### 7. Chapter rows: one loader for the outline view and the board

**Strength:** strong · **Pairs with:** N 1, N 2, candidate 5 (its first slice),
candidate 6 · **Planned for 0.7** (docs/PLAN-0.7.md, tasks 1.3 and 2.2)

- **Problem.** The outline view builds a chapter row field by field from frontmatter,
  the measurer and the text (`outline/view.ts:276-298`). The canvas board rebuilds part
  of it (`outline/index.ts:152-167`), and the note mode builds a third shape
  (`outline/view.ts:251-273`). The outline also parses placeholders itself
  (`outline/view.ts:292`) although the placeholders index knows the count
  (`placeholders/index.ts:35`). POV (N 1) and the per-chapter target (N 2) both add
  fields here, inside an untested 1,334-line DOM class.
- **Change.** A pure `outline/rows.ts` takes a port (chapters, text, frontmatter,
  counts, placeholder count, book default, POV resolver) and returns `ChapterRow[]`.
  The view and the board both call it; vitest tests it.
- **Wins.** New row fields land once and are tested; one cross-module parse goes.

### 8. One rule for a note's effective piece, including a chapter's book default

**Strength:** medium–strong · **Pairs with:** N 2, candidate 7

- **Problem.** "Piece, then unit, then `noteProgress`" is written out three times
  (`core/measurer.ts:127-131`, `outline/view.ts:254-260`, `explorer/index.ts:402-403`),
  and the goals modal uses `progressOf` (`goals/progress-modal.ts:234`). 0.7's book
  default for chapter targets is shown in the outline only, so the explorer's "target
  next to the count" and the goals modal don't see it.
- **Change.** Decide the effective piece once, as a field on the classifier result
  (the growth rule), for example `piece` plus `pieceSource: "own" | "book"`, computed
  in `core/classify.ts` (`pieceOf`, `:268-270`) from the book note's default. Callers
  use `measure.note(file)`, or a sync peek for the explorer.
- **Wins.** Every surface agrees on a chapter's target; a chapter counted in characters
  works everywhere.

### 9. Scope as one live answer

**Strength:** medium–strong · **Pairs with:** U 1.1 (`universe: false`), U 1.2, the
classifier fake (loose ends) · **Minimum planned for 0.7** (PLAN-0.7.md, task 3.1)

- **Problem.** Each universe entry stores its scope (`universe/entries.ts:14-23`,
  `:110`) and `sameEntry` compares it (`:55-59`). Scope depends on other notes (the
  book note's `universe` property), and a structural recompute runs only on create,
  delete or rename, so the stored scope can go stale; `entries()` already works around
  it by reading scope live (`universe/index.ts:180-186`).
- **Change.** Minimum: drop `scope` from `Entry` and from `sameEntry`, and always read
  it through `scopeOf`. Fuller: `books.classify(x).scope`, with link resolution in the
  `VaultTree` port and `scopeFor` kept pure, so the lens, editor and outline can ask for
  scope without the universe module.
- **Wins.** No stale scope; outside modules get scope without depending on the
  universe.

### 10. A names seam: one name matcher in core, and a names port

**Strength:** strong · **Pairs with:** U 1.2, U 1.4, N 1, candidate 6 · **Planned for
0.7** as a rule of the plan (PLAN-0.7.md, tasks 1.2, 3.1, 3.3)

- **Problem.** 0.7 adds four readers of entry names ("Appears in", spellcheck, the
  lens's name rule, POV links). Name matching already lives in two places with two
  normalizations: the lens's `nameVariants` (`lens/rules-stem.ts:17-25,147-181`, accents
  kept) and the universe's `foldText` (`universe/entries.ts:131-133`, accents folded).
  The lens's options are vault-wide (`lens/index.ts:184-197`), but names depend on the
  note's universe.
- **Change.** A pure `core/names.ts` compiles names and aliases into a matcher over
  `tokens()` and `stem(…, "name" | "word")`. A `plugin.names` port answers
  `tableFor(path)` and `entryFor(text, path)`; the universe provides it while loaded,
  and it is empty otherwise. No module imports the universe for names.
- **Wins.** One matcher, tested once in Portuguese and English; switching the universe
  off is safe by construction.

### 11. Each module owns its settings section

**Strength:** medium · **Pairs with:** SF 10, candidate 6

- **Problem.** `settings.ts` (739 lines) is one `display()` (`:226-713`) with a heading
  per module, importing module internals (the lens at `:4-7`, the universe at
  `:11-12`) and calling `plugin.lens.createLists()` (`:489`). 0.7 hides the sections of
  off features with a check per section, which keeps every module's condition in one
  central file.
- **Change.** An optional `settingsSection(container, save)` on each module, as the
  universe already does (`renderUniverseSettings`, `settings.ts:269`). The tab draws the
  core sections, then each loaded module's.
- **Wins.** An off module's section disappears with it; `settings.ts` stops importing
  modules.

### 12. Content indexes share one read and one segmentation per file

**Strength:** speculative (measure the mentions index first) · **Pairs with:** U 1.2,
candidate 6

- **Problem.** Each content index reads and segments every file it includes on its
  own: placeholders and threads over the whole vault, the lens lists over one note,
  and from 0.7 the mentions index over the whole vault with tokens and stems
  (`core/vault-index.ts:154`, `:364`). The measurer reads on its own too. This matters
  most on phones.
- **Change.** The hub reads each changed file once per flush and hands every content
  spec the same text, and possibly one memoized `segment`.
- **Wins.** Startup and editing cost stop growing with each new index.

### 13. Shared helpers out of module folders

**Strength:** speculative, small · **Pairs with:** candidate 6

- **Problem.** Pure helpers live in one module's folder and are used by another:
  `confirmAction` (outline, used by `snapshots/index.ts:19`), `dialogueInDoc` and
  `blockStateIn` (editor, used by `lens/measures.ts:11` and `lens/analyze.ts:10`),
  `openWork` (desk, used by `universe/view-works.ts:5`). An edit for one module can
  break another.
- **Change.** Move the pure ones to `core/` and the modals to a shared `ui/` folder.
- **Wins.** Clear ownership; the module dependency table only lists runtime calls.

### 14. Content indexes start on demand

**Strength:** speculative (measure on a phone first) · **Pairs with:** candidate 12,
the 1.0 mobile pass

- **Problem.** Every content index starts its first full pass at layout ready, whatever
  the writer is doing: placeholders (`placeholders/logic.ts:329`) and threads
  (`universe/threads.ts:45`) over the whole vault, the measurer's first pass, and from
  0.7 the mentions index (started once the entries index is ready, PLAN-0.7.md task
  3.2). On a phone with a large vault these compete with opening the first note.
- **Change.** A spec may declare `start: "ready" | "demand"`; a demand spec builds on
  its first query or `onChange` subscription, and the hub runs eager specs first.
  Surfaces that read a demand index show a "counting" state until it is ready.
- **Wins.** Startup cost on phones stops growing with each feature; an index nobody
  looks at in a session costs nothing.

## Loose ends from 0.2.1

Small; good for a release whose features don't touch the candidates above. The editor
ones shipped in 0.5 (see "Done"). What is left:

- The publish check could warn about an unclosed `<!--`, whose following words are
  counted although Reading view hides them. Needs a check id and strings.
- Test the Obsidian side of the classifier (`core/books.ts`: `instanceof` checks,
  root folder filtering) with a small fake, and try nested books in a real vault.
- Open questions pinned by tests in `tests/markdown-consumers.test.ts`: `%%` inside a
  closed `<!-- -->`, a fence inside an open `%%`, `%%` inside `$$`, escaped backticks.
  Check each against Reading view and flip the rule where it differs.

## Known issues

None at the moment.

## Done

| Version | Improvement |
|---|---|
| 0.6.0 | Note text port finished (candidate 3): the outline's beat re-checks and writes go through `plugin.notes` as `guardedEdit` plans, and its emptiness checks read through the port. Thread closing and template insert share `replaceIfExact`, `guardedEdit` and `matchLineEndings`. Still direct: the editor's template insert and "Plant a thread" write to the editor that triggered them |
| 0.5.1 | Lens marks stale after a lists change: the session treats options as a generation (`invalidate` clears every cache first, one failing pass no longer stops the others), the marks field drops a list from an older generation, and a failed refresh retries instead of dropping the editor |
| 0.2.1 | Markdown segmenter (`core/markdown`): one scan for prose, frontmatter, code and comments |
| 0.2.1 | File classifier (`core/classify`): one answer to what a file is |
| 0.3.0 | Measure module (`core/measure`, `plugin.measure`): counts, targets and goals in one place (candidate 1) |
| 0.3.0 | File explorer decoration adapter (`core/explorer-decorations`) (candidate 4) |
| 0.3.0 | Note text port (`core/note-text`, `plugin.notes`), partial: the outline's beat re-checks remain (candidate 3) |
| 0.4.0 | Vault index (`core/vault-index`, `core/index-hub`, `plugin.index`; candidate 2). Migrated: placeholders, publish records, dialogue focus, goals history and baseline, the desk's works, `leftOff` and the home note path. Still waiting: the measurer, the explorer's tracked set and first pass, and the snapshots store (they keep their own path-keyed state) |
| 0.5.0 | The 0.2.1 editor loose ends: the compatibility wrappers (`blockStateAt`, `bodyStart`, `inProperties`, `core/markers.bodyStartLine`) are gone, `insertSceneBreak` and `enter-flow` read the `Markdown` from the segmenter, and `outline/beats-edit.isBreak` uses `isSceneBreakLine`. Still open: the `<!--` publish check, the classifier fake and the parity questions |
