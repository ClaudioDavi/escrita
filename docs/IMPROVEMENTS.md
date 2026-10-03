# Code improvements backlog

**Rule: every release includes at least one item from this list.** Pick it when
planning the version in [ROADMAP.md](ROADMAP.md) (its "Improvement" column), preferring
one that the version's features lean on. When it ships, move it to "Done" with the
version.

The list comes from an architecture review on 2026-09-30 (six candidates, of which
the first two shipped in 0.2.1) plus the loose ends that refactor left. Re-run the
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

**Strength:** strong · **Pairs with:** feature switches (SF 10, 0.7)

- **Problem.** Every module is built and loaded at startup, and its commands, views,
  menus, editor extensions and index specs are registered on the plugin, so they live
  until the plugin unloads. A module can't be switched off without a restart, and a
  feature the writer never uses still costs startup time and index work. The universe
  (0.6) already needs commands and a view that come and go with its mode, and solves it
  locally.
- **Change.** Each module becomes an Obsidian `Component` added as a child of the
  plugin, and registers everything through its own `register*` calls, so `removeChild`
  undoes all of it. A small registry in `main.ts` knows each module's switch and its
  dependencies, loads the enabled ones, and loads or unloads on `settingsChanged`.
  Index specs (`plugin.index.add`) return a handle the module disposes. Commands go
  through one helper that removes them on unload. The universe's mode-dependent
  registration moves onto it.
- **Wins.** Feature switches become a settings change, not a refactor; startup skips
  disabled modules; an unload test per module ("nothing left registered") catches leaks,
  which the community review checks.

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
