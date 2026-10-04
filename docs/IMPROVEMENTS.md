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
- **Done in 0.7.0:** the rows slice (`outline/rows.ts`, candidate 7). The beats, the
  checked edits and the action switch are still in the view.

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
- **Minimum shipped in 0.7.0:** `Entry` no longer stores `scope` and `sameEntry` no
  longer compares it; scope is read live through `scopeOf`. The fuller change (scope on
  the classifier result) is still open.

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
- **Minimum shipped in 0.7.0:** `core/names.ts` and the `plugin.names` port; "Appears
  in", the name marks, the lens and the outline's POV read names through it. The lens's
  own `nameVariants` still keeps its accent rules.

### 11. Each module owns its settings section

**Strength:** medium · **Pairs with:** SF 10, export and submissions (0.8) · **Planned
for 0.8**

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
| 0.7.0 | Modules that load and unload at runtime (candidate 6): a `FeatureModule` per feature, a `ModuleContext` that records an undo for every registration (commands with `removeCommand`, so `minAppVersion` 1.7.2; view, editor, code block and post-processor slots registered once; index specs removed through `IndexHub.remove`), a registry that loads in order and unloads in reverse, data followers that run while a feature is off, and a lifecycle test per module on an `obsidian` stub |
| 0.7.0 | Chapter rows (candidate 7): `outline/rows.ts` loads every chapter row through one port, for the outline view and the canvas board, tested with vitest; the outline reads the placeholder count from the placeholders index |
| 0.6.0 | Note text port finished (candidate 3): the outline's beat re-checks and writes go through `plugin.notes` as `guardedEdit` plans, and its emptiness checks read through the port. Thread closing and template insert share `replaceIfExact`, `guardedEdit` and `matchLineEndings`. Still direct: the editor's template insert and "Plant a thread" write to the editor that triggered them |
| 0.5.1 | Lens marks stale after a lists change: the session treats options as a generation (`invalidate` clears every cache first, one failing pass no longer stops the others), the marks field drops a list from an older generation, and a failed refresh retries instead of dropping the editor |
| 0.2.1 | Markdown segmenter (`core/markdown`): one scan for prose, frontmatter, code and comments |
| 0.2.1 | File classifier (`core/classify`): one answer to what a file is |
| 0.3.0 | Measure module (`core/measure`, `plugin.measure`): counts, targets and goals in one place (candidate 1) |
| 0.3.0 | File explorer decoration adapter (`core/explorer-decorations`) (candidate 4) |
| 0.3.0 | Note text port (`core/note-text`, `plugin.notes`), partial: the outline's beat re-checks remain (candidate 3) |
| 0.4.0 | Vault index (`core/vault-index`, `core/index-hub`, `plugin.index`; candidate 2). Migrated: placeholders, publish records, dialogue focus, goals history and baseline, the desk's works, `leftOff` and the home note path. Still waiting: the measurer, the explorer's tracked set and first pass, and the snapshots store (they keep their own path-keyed state) |
| 0.5.0 | The 0.2.1 editor loose ends: the compatibility wrappers (`blockStateAt`, `bodyStart`, `inProperties`, `core/markers.bodyStartLine`) are gone, `insertSceneBreak` and `enter-flow` read the `Markdown` from the segmenter, and `outline/beats-edit.isBreak` uses `isSceneBreakLine`. Still open: the `<!--` publish check, the classifier fake and the parity questions |
