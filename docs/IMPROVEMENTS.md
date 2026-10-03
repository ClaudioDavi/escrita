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

### 3. Note text: edit through the editor or the vault

**Strength:** worth exploring · **Pairs with:** 0.3 snapshots (restore, "use the old
version")

- **Problem.** "Write through the open editor if there is one, else through the vault,
  and only if the text is still what we expect" is written three times with different
  rules: placeholders (no mode check), darlings (editor only in source mode), publish
  (read only). The outline re-checks "beat i still has text X" by hand four times.
- **Change.** A small port with read and check-then-replace, satisfied by an editor
  adapter (keeps undo) and a `vault.process` adapter (closed notes).
- **Wins.** The data-safety rule lives once; snapshot restore reuses it.

**Status:** partially shipped in 0.3.0: `core/note-text.ts` (the port,
tested) and `plugin.notes` (`core/notes.ts`, `NoteService`) serve placeholders,
darlings, publish and snapshots, and darlings and outline create folders through
`plugin.notes.ensureFolder`. Left: the outline's four hand-made beat re-checks
(with candidate 5).

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

### Lens marks can stay on an old result

**Found in 0.5.0, to fix in 0.5.1, with a test.** The author edited the word lists
note and saw a name that is in the list (*Mariana*) still marked as a name variant in
Obsidian. Turning the lens off and on cleared it. The pure analysis of the same files
gives the right answer, so the stale result is in the refresh path, not in the rules.

Where to look in `src/lens/index.ts` and its neighbours: the session's `invalidate`,
`run`'s text cache (the same text never recomputes, so a changed list must change the
cache key), `LensMarks.adopt`, and the shown cache. Write a test that edits the lists
note while the lens is on and expects the marks to follow.

## Done

| Version | Improvement |
|---|---|
| 0.2.1 | Markdown segmenter (`core/markdown`): one scan for prose, frontmatter, code and comments |
| 0.2.1 | File classifier (`core/classify`): one answer to what a file is |
| 0.3.0 | Measure module (`core/measure`, `plugin.measure`): counts, targets and goals in one place (candidate 1) |
| 0.3.0 | File explorer decoration adapter (`core/explorer-decorations`) (candidate 4) |
| 0.3.0 | Note text port (`core/note-text`, `plugin.notes`), partial: the outline's beat re-checks remain (candidate 3) |
| 0.4.0 | Vault index (`core/vault-index`, `core/index-hub`, `plugin.index`; candidate 2). Migrated: placeholders, publish records, dialogue focus, goals history and baseline, the desk's works, `leftOff` and the home note path. Still waiting: the measurer, the explorer's tracked set and first pass, and the snapshots store (they keep their own path-keyed state) |
| 0.5.0 | The 0.2.1 editor loose ends: the compatibility wrappers (`blockStateAt`, `bodyStart`, `inProperties`, `core/markers.bodyStartLine`) are gone, `insertSceneBreak` and `enter-flow` read the `Markdown` from the segmenter, and `outline/beats-edit.isBreak` uses `isSceneBreakLine`. Still open: the `<!--` publish check, the classifier fake and the parity questions |
