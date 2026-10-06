# Escrita 0.9, "the book and its world": implementation plan

This is the plan for Escrita 0.9, written 2026-10-06 on branch `0.8` at `65458e0` (the
0.8.0 release). It breaks the release into waves of tasks that agents run in parallel,
with strict file ownership per wave. Each wave runs as one workflow, with an Opus judge
at the end.

**Replanned on 2026-10-06.** The first draft was "a consistent world": the timeline,
`when` and dates, facts over time, continuity checks and canon (U 2.1–2.4). The author
judged them bloat at this stage and moved them after screenwriting (ROADMAP.md, "After
1.0"). The draft's design notes are kept locally in `research_notes/0.9-dates-draft/`
(git-ignored). The same day, 0.10 was merged into 0.9: 0.9 now carries U 2.5 and the
book features (N 4, N 7 stage 3, N 8), and 1.0 comes next.

The specs win on any disagreement:

- `docs/ROADMAP-universe.md`: U 2.5.
- `docs/ROADMAP-novel.md`: N 4, N 7 (stage 3), N 8.
- `docs/ROADMAP-short-fiction.md`: SF 13 (collections, added 2026-10-06).
- `docs/IMPROVEMENTS.md`: candidate 9, the fuller change.

If this plan and a spec disagree, fix this plan. Where the plan narrows a spec, the
change is listed under "Deviations", and the release writes it back into the spec.

**Stages served** (ARCHITECTURE.md, "Workflow"):

- **Revision.** "Read the book" reads a whole book as a reader would. Unlinked mentions
  and the names rule of the lens find what the world is missing.
- **Ready and published.** EPUB for a finished book; "Publish next chapter" for a book
  released one chapter at a time.

**Upkeep asked of the writer:** none required. Optional: a `contents` list on a collection note, a `cover` property on a book
note, and dismissing words the names rule flags.

## Scope

| Feature | Ref | Effort |
|---|---|---|
| Unlinked mentions, with a **Link** button per mention | U 2.5 | S |
| Names without an entry, a revision lens rule (off until the writer turns it on) | U 2.5 | M |
| EPUB 3 export, validated by EPUBCheck in CI | N 7, stage 3 | M |
| Book-wide publish check: "Publish next chapter", the next chapter in the outline header, gaps | N 4 | S |
| "Read the book" view | N 8 | M |
| Collections: select several contos, export them together as one DOCX or EPUB | SF 13 | M |
| User guide: "The world", "Publishing" and "Writing" updated, English and pt-BR | Docs | S |

| # | Improvement | Why now | Size |
|---|---|---|---|
| 9 | Scope as a field on the classifier result: `books.classify(x).scope`, link resolution in the `VaultTree` port, `scopeFor` and `linkText` pure in `core/` | The author asked for it. The outline drops its copy of `linkText`, and the lens's names rule asks for scope without importing the universe | M |

**Cut line.** If the release runs long, these move to 1.0 in this order:

1. The reading position in "Read the book" (Q14). The view opens at the top.
2. The EPUB cover (Q8). A book exports without one.
3. Names without an entry (the lens rule). Unlinked mentions stays.
4. "Create a collection…" in the file explorer (Q25). A collection note written by hand still exports.

EPUB, "Publish next chapter", "Read the book", unlinked mentions and candidate 9 never cut.

**Out of scope:**

- U 2.1–2.4 (after screenwriting).
- Images inside the prose of an EPUB. Embeds are dropped and listed, as in 0.8.
- A separate serial dashboard view. The outline header is the dashboard (Q12).
- Editing in "Read the book" (N 8: recommend Continuous Mode).

## Open questions, with recommended answers

**Answered 2026-10-06:** the author accepted every recommendation (Q1–Q14, Q21–Q27) and the design-review recommendations D1–D9 (gate G2).
Wave 1 builds the recommendation for Q21; a different answer is a small change in 1.3's
file.

**Unlinked mentions and names (U 2.5)**

| # | Question | Recommendation |
|---|---|---|
| Q1 | Where are the unlinked mentions, and can Escrita add the link? | **A section in the Works tab of the universe panel**, under the active work: each place an entry is named without a link, with its line (`unlinkedIn(mentions, linkedEntries, { text, inScope })`). **Link** on a row turns that one mention into `[[Entry\|text]]` (or `[[text]]` when the text is the entry's name), with an explicit click (rule 2), through `plugin.notes`, check-then-replace: if the text there has changed, nothing is written and the row refreshes. No "link all". A note that links an entry anywhere lists no unlinked mention of it (the writer links the first one). |
| Q2 | How is "names without an entry" turned on? | **A revision lens rule, `newName`, off by default** (the author: it must be activated, like the lens). The writer enables it in the lens settings; it then runs only while the lens is on, like the other rules. In the active note it marks each capitalized word or run, not at a sentence start (`core/sentences.ts`), that matches no entry, alias, name title or the lens's names list. The lens panel lists the marked names with **Create** (the create-entry modal, the name filled in) and **Dismiss**. Needs the universe on; off otherwise. |
| Q3 | Which marked words count? | **Ones that recur: in at least two works, or five times in this note.** The cross-work count reads an on-demand content index (`universe-names`) that starts the first time the rule runs, never before. While it builds, only the in-note count applies. |
| Q4 | Where does Dismiss go? | **A setting, "Not names"** (one per line, empty by default), because it is a word list (rule 6). It is not the lens's "Ignore here", which is per place: a dismissed name is never a name anywhere. |

**EPUB (N 7, stage 3)**

| # | Question | Recommendation |
|---|---|---|
| Q5 | How is EPUB chosen? | **A third format in the Export modal**, next to Markdown and DOCX, for a note and for a book, with the same chapter choice, readiness warnings, preview, "Export again" and file names (`<title>.epub`). The presets set the language (`pt-BR` or `en-US`), the byline and the labels ("Sumário", "Contents"). The scene break is the EPUB setting, not the preset's (Q6). |
| Q6 | What goes in the book? | **A title page, the dedication and epigraph pages (as in 0.8), a table of contents, one XHTML file per chapter** with its heading as in DOCX, and the ornamental scene break (setting, default `* * *`, never at a chapter boundary). No running header, no word count (an ebook isn't a manuscript). |
| Q7 | Metadata? | **Title, author (the 0.8 author settings and the `author` property), language, and a modified date.** The identifier is a `urn:uuid` derived from the work's path and title, so re-exporting the same book keeps its id. EPUB 3 nav document plus an NCX for older readers. |
| Q8 | The cover? | **A `cover` property on the book note** (the name is a setting), linking an image in the vault (JPEG or PNG). It becomes the cover image and a first cover page. A missing or unreadable image is a readiness warning, and the export goes on without a cover. |
| Q9 | How does CI validate it? | **A CI job builds the fixture book's EPUB through the real writer and runs EPUBCheck** (Java, downloaded in CI; the plugin stays offline, rule 4). The job fails on any EPUBCheck error. Gate G0a checks this works before 1.4 starts. |

**Book-wide publish check (N 4)**

| # | Question | Recommendation |
|---|---|---|
| Q10 | What is a published chapter? | **A chapter whose status word maps to the published stage.** Chapters aren't works, so classify gives them no stage; the serial model reads the status through `stageOf` directly. Chapters left out by `compile: false` and unnumbered ones ("Chapters without a number") are not in the sequence. |
| Q11 | "Publish next chapter"? | **A palette command and a button in the outline header**: the first chapter in order that isn't published, through the same publish check modal as a single note. It opens that chapter first. A future `date` is allowed and only recorded. |
| Q12 | The serial dashboard? | **One line in the outline header**, shown only when at least one chapter is published: "Next: 05 A volta · last published 2026-09-30". No separate view (rule 3). Read from `serialState(chapters, stages, unnumbered)`; `unnumbered` is "Chapters without a number", so the sequence follows the export headings (`countedNumbers`). |
| Q13 | Gaps? | **A warning, never a block.** The publish check of a chapter warns when an earlier chapter in the sequence isn't published, and the outline header line says "gap: 04". |

**Read the book (N 8)**

| # | Question | Recommendation |
|---|---|---|
| Q14 | How does it read, and what does it remember? | **A view in the main area**, "Read the book", from a palette command and the outline header. Every included chapter in order, with the export's chapter headings and scene breaks, markers hidden (the 0.8 manuscript model decides what is hidden, so it matches the export; `readerBlocks(text, { placeholderMarker })`). Rendered with Obsidian's Markdown renderer, chapter by chapter as they scroll into view. Clicking a paragraph opens its chapter at that line. The reading position (chapter and line) is kept per book in `data.json` and follows renames through `plugin.index.follow`. Read-only. |

**Architecture.** Opus decisions; agents don't reopen them.

| # | Question | Decision |
|---|---|---|
| Q15 | Candidate 9: how does scope reach the classifier? | **`scope` becomes a field on every `Placement`**, never a new kind (the growth rule). `VaultTree` gains `resolve(link, from): string \| null` (the adapter in `core/books.ts` uses `metadataCache.getFirstLinkpathDest`). `scopeFor`, `keptOut`, `linkText`, `sameScope`, `universeNotePath` and `universeRootOf` move to `core/scope.ts` unchanged. `ClassifySettings` gains four keys: `universeMode`, `universeNote`, `defaultUniverseFolders` and `universeProperty`. `outline/pov.ts` drops its copy of `linkText`. Gate G0c measures `classify` before and after; the field must cost under 10%. If it costs more, `scope` becomes a lazy getter, decided by the Wave 1 judge. |
| Q16 | `classifyKey` and scope? | **The key includes the four scope keys.** A note's own `universe` property is frontmatter: the universe module's scope timers keep handling it. The judge checks that no index refreshes twice. |
| Q17 | Where does the unlinked list come from? | **The mentions index, no new read.** `universe/unlinked.ts` is pure: `unlinkedIn(mentions, linkedEntries, note)`, from one note's `NoteMentions`, its resolved links and its text (for lines; `note.inScope` picks the entry as Appears in does, and an occurrence still ambiguous is skipped), the occurrences of entries the note never links. |
| Q18 | The names rule and the lens? | **The lens reads names through the names port** (`core/names-source.ts`) and never imports the universe. The port gains what the rule needs: the known-name test and the cross-work counts, both empty when the universe is off. The `universe-names` index lives in the universe module and answers through the port. `core/names-source.ts` is the seam; its change is a contract in Wave 0. The rule and the index find candidates with one function, `core/name-runs.ts` (`nameRuns`, `namesMask`), so the in-note and cross-work counts agree. |
| Q19 | The EPUB writer? | **A `ManuscriptWriter` in `src/export/writers/epub.ts`**, beside markdown and DOCX, writing through `core/zip.ts` (the `mimetype` entry first and stored, as EPUB requires). The cover image is read through the book source, as binary. |
| Q20 | Where do the book models live? | **Pure files without `obsidian`:** `publish/serial.ts` (the sequence, next, last, gaps) and `outline/reader-model.ts` (`readerBlocks(text, { placeholderMarker })`: the blocks of a chapter with their source lines, markers hidden; the chapter headings are not blocks, the view draws them from `chapterHeadings`). The views stay thin. |
| Q28 | Collections in code? | **A second book source.** `core/collection.ts` is pure: `collectionOf(frontmatter, property, resolve)` gives the ordered story paths and the links that resolve to nothing. The export pipeline reads a collection through the `BookSource` port with every story unnumbered, so the writers and the manuscript model don't change. No new classifier kind and no new field: export asks `core/collection.ts` about the active note. |

**From the Wave 0 judge**

| # | Question | Recommendation |
|---|---|---|
| Q21 | Which capitalized words make one name, for the names rule? | **Words separated only by spaces, or joined by `de`, `da`, `do`, `das`, `dos`** ("Maria das Dores", "João da Silva"; English has no joiners). A name that starts a sentence loses a leading stop word ("A Joana" gives "Joana"). Any other run that starts a sentence is skipped ("Depois Teodoro"), so the rule stays quiet when unsure. The joiners are a fixed list per language, like the built-in name titles. |
| Q22 | For a book, whose unlinked mentions does the Works tab list? | **The active chapter's only**, not the whole book's. One chapter is what the writer is revising, and a long book would give a long list. The "links it anywhere" test is per chapter too: a chapter that links an entry lists none of it. |
| Q23 | The last published chapter has no date. What does the header say? | **Its title, without a date**: "Next: 05 A volta · last published: 04 A escada". The header doesn't reach back for an earlier chapter's date, which would look like the wrong chapter. Publishing sets the date, so this only happens when a status was typed by hand. |

**Collections (SF 13), added 2026-10-06**

| # | Question | Recommendation |
|---|---|---|
| Q24 | What is a collection? | **A note with a `contents` property** (the name is a setting): a list of links to contos, in reading order. It takes the book note's front-matter properties (`author`, `dedication`, `epigraph`, `cover`). Repeatable, so "Export again" works; no ad-hoc selection that vanishes after one export. |
| Q25 | How is one made? | **From the file explorer**: select several notes, right-click, "Create a collection…" asks for a title and writes the note through `notes.create` (`exists: "unique"`), beside the first selected note, links in the explorer's order. A collection written by hand works the same. |
| Q26 | How does it export? | **Like a book**, in the same modal: "the whole collection", the stories as the chapter list (all, a range, picked), each story's title alone as its heading, each on a new page, the EPUB table of contents listing them. Each story's own properties are ignored except its title. A link to nothing is a readiness warning, and that story is skipped. All three formats; Markdown comes for free. |
| Q27 | Is a collection a work, and are its words counted? | **Only by the usual rule**: a tracked note with a status is a work, so a collection can move through the stages. Its own body is a list of links, so goals count almost nothing; the stories keep their counts and stages. No outline, no "Read the book", no serial publishing for a collection in 0.9. |

## Deviations from the specs

| Spec | Says | Plan | Why |
|---|---|---|---|
| U 2.5 | Names without an entry, "a tab in the universe panel" | A revision lens rule, off by default (Q2) | The author: it must be turned on to show |
| U 2.5 | "A dismiss list" | A "Not names" setting (Q4) | Word lists are settings (rule 6) |
| U 2.5 | Unlinked mentions "so the author can add links" | A **Link** button per mention (Q1) | One click, rule 2 kept |
| N 4 | "Serial dashboard" | One line in the outline header (Q12) | Rule 3: no new view to manage |
| N 7 | Cover image "from the book note" | A `cover` property, a setting (Q8) | Rule 6 |
| ROADMAP | 0.10: EPUB, N 4, N 8 | Merged into 0.9 | The author's call, 2026-10-06 |

## Gates

- **G0a** (gates 1.4): EPUBCheck in CI. A minimal hand-written EPUB passes EPUBCheck in a
  CI job, on the GitHub runner, before the writer is built.
- **G0b**: the 0.7 gate G0d, still open: the Reading-view "Appears in" section across
  re-renders, on desktop. Folded into the manual verification.
- **G0c** (gates 1.1): the classifier's cost on the 3,020-file bench (`tests/perf/`),
  before and after `scope`. Target: under 10% more (Q15).
  - Before, 2026-10-06, Intel Core Ultra 7 155H, node 22.22.2, three runs at `65458e0`:
    `classify()` on every file 7.23 ms (6.75–7.78), `listBooks()` 0.053 ms, the works
    index recompute 8.14 ms (7.98–8.26). The RTK hook hides the bench table; run it
    through `rtk proxy npx vitest bench …`.
- **G0d** (gates 2.6): "Read the book" on a 30-chapter book, desktop: the time to the
  first chapter on screen, and the longest block while scrolling, against 0.8's 20 ms.
- **G1. Design** (rule 7): mockups on the design canvas, in a new row "0.9", for:
  - The unlinked mentions section, with Link.
  - The names rule in the lens panel, with Create and Dismiss.
  - EPUB in the Export modal, and the cover warning.
  - The outline header with the serial line, the gap and "Publish next chapter".
  - The "Read the book" view.
  - Collections: "Create a collection…" in the file explorer, and the Export modal on a collection note (board 34).
  - **Approved by the author on 2026-10-06:** boards 29–34 in the row "0.9 · O livro e o seu mundo". The design review left eight questions, D1–D8:
    - D1. In per-book mode the panel has no Works tab. Where does the unlinked section go?
    - D2. `<title>.epub` has no preset in the name, so a pt-BR and a Shunn EPUB overwrite each other. Add the preset, as DOCX does?
    - D3. Does a standalone conto's own `cover` property work (Q8 reads only a book note)?
    - D4. "Exportar assim mesmo" (export) or "Publicar mesmo assim" (publish): one form for both.
    - D5. A future publish date: shown as written ("último publicado em 15 out") or as "agendado para"? The second needs today's date in the serial model.
    - D6. "Read the book": keep the chapter rail and progress bar (beyond Q14; a 30-chapter rail must scroll), or drop them and leave navigation to the outline?
    - D7. "Read the book" headings: the pt-BR preset's format, the book's last export preset, or the heading setting?
    - D8. "Dona Zefa": does Create entry fill in "Dona Zefa" or "Zefa"?
    - D9. After "Criar uma coleção…", does the new collection note open in the editor (board 34 draws it so)?
- **G2. Answers**: accepted on 2026-10-06, every recommendation as written. The D answers:
  - D1: in per-book mode, the unlinked section sits at the bottom of the Entries tab.
  - D2: `<title> (<preset>).epub`, as DOCX.
  - D3: a standalone note's own `cover` property works too.
  - D4: one form, "mesmo assim", for export and publish ("Exportar mesmo assim").
  - D5: a future date shows as written; the serial model needs no clock.
  - D6: "Read the book" has no chapter rail and no progress bar; the outline navigates.
  - D7: "Read the book" headings use the export's chapter-heading setting.
  - D8: Create entry fills in the whole run, "Dona Zefa", editable in the modal.
  - D9: the new collection note opens in the editor.

Still open from 0.7, on desktop: the visual check against the canvas (PLAN-0.7.md, task
5.2), folded into the manual verification. The phone gates stay waived.

## Models

- **Sonnet** does the code: implementation, tests, docs.
- **Opus** writes the Wave 0 contracts, judges each wave, and reviews the release.
- A Sonnet task that meets an architecture choice not settled here stops and hands it
  back.

## Ownership rules

- One owner per file per wave. A task touches only the files it lists, plus new test
  files named after it.
- `src/core/*`, `main.ts`, `settings.ts` and `data.ts` change only in the task that owns
  them.
- **Every task's done-when:** `npm run typecheck`, `npm test` and `npm run build` pass,
  and `npm run test:bundle` passes after a build.

## Wave 0: contracts and fixtures

**0.1 Contracts (Opus).** Signatures and doc comments with stub bodies, compiled, no
behaviour change.

- `core/scope.ts`: the scope code moved from `universe/scope.ts`, written.
  `universe/scope.ts` stays as a re-export until 2.1 moves its callers and deletes it.
- `core/classify.ts`: `VaultTree.resolve`, `Placement.scope` (the none scope until 1.1),
  the four `ClassifySettings` keys, `classifyKey` with them. The `resolve` adapter in
  `core/books.ts`, and every test fake.
- `core/names-source.ts`: what the names rule reads (Q18).
- `universe/unlinked.ts`: `UnlinkedMention`, `unlinkedIn(mentions, linkedEntries, note)`.
- `lens`: the `newName` rule id, off by default (`OPT_IN_RULES`, switched on by
  `lensRulesOn`), its match shape, and the call in `analyze.ts`.
- `core/name-runs.ts`: `nameRuns` and `namesMask`, the candidates the rule and the index share.
- `export/writers/epub.ts`: the writer's signature; the EPUB format in the export types.
- `publish/serial.ts`: `SerialChapter`, `serialState(chapters, stages, unnumbered)` giving
  the sequence, next, last published and gaps.
- `outline/reader-model.ts`: `ReaderBlock { text; line }`, `readerBlocks(text, { placeholderMarker })`.
- Settings with English defaults and no UI: `lensRulesOn` ([]), `notNames` (""),
  `coverProperty` ("cover"), `epubSceneBreak` ("* * *"). `data.readPosition` declared,
  with cleaning on load.

**0.2 Fixtures (Sonnet).**

- `tests/fixtures/universe-names/`: a small universe with contos that name entries linked
  and unlinked; a name in a heading, a comment and a code block (never counted);
  capitalized words at sentence starts, after a title abbreviation ("Sr. Almeida") and
  after a travessão. Expected unlinked mentions per note, and the expected marked names
  with and without "Not names".
- The EPUB fixture book: the 0.8 manuscript fixture book (`tests/fixtures/manuscript/`)
  plus a small cover image, with the expected file list and the expected `content.opf`.
- `tests/fixtures/serial/`: chapter lists with published, unpublished, `compile: false`,
  unnumbered and a gap, with the expected next, last and gaps.

**Opus judge:** the contracts against Q1–Q20 and the specs.

**Wave 0 result (2026-10-06).** Done. The four checks pass, and nothing changes for the
writer except that the lens starts one new pass after the update (its pass key grew).
The contracts add, beyond the list above:
- `core/scope.ts` holds `inFolder` and `NO_SCOPE` as well, and `core/classify.ts`
  re-exports them. Classify imports scope, never the reverse, so 1.1 can call `scopeFor`
  from classify without an import cycle at load. `ScopeSettings` and `ScopeMode` are
  declared in core, so core never imports the universe.
- The four scope keys on `ClassifySettings` are optional; a missing mode means "off".
- The names port gains three optional provider methods (`isKnownName`, `workCount`,
  `wantNameCounts`) and `hasProvider()`. With no provider it answers false, 0 or nothing.
  `isKnownName` covers names, aliases, automatic first names and name titles; the rule
  checks the lens's names list and "Not names" itself.
- `core/name-runs.ts` (added by the judge): `nameRuns` and `namesMask`. The lens rule and
  the universe's index must find the same runs, and neither module may import the other.
- The names rule is opt-in: `OPT_IN_RULES = ["newName"]`, a `lensRulesOn` setting,
  `enabledRules(off, on)`, and an opt-in count only while the rule is on. Putting it in
  `RULES` or in `lensRulesOff`'s defaults would have changed every saved vault's output.
  Its matches are kind `base`, one per occurrence; the panel groups them by folded text.
- `analyze.ts` already calls `newNames` (a stub that returns `[]`), because no Wave 2
  task owns `analyze.ts`. Task 2.3 builds `NewNameOptions` in `lens/index.ts`.
- The panel model has a `needsUniverse` row kind.
- `unlinkedIn` takes a third parameter, `note: { text, inScope? }`: lines need the text,
  and the entry is picked with the scope test Appears in uses. `line` is 0-based.
- The EPUB writer is `ManuscriptWriter<EpubBook, EpubLayout>`: the identifier, the
  modified date and the cover come in as input, so `write` stays pure. `epubLayout` and
  `epubModified` are written. The scene break is the setting, not the preset's `#`.
- `ExportFormat` (with `"epub"`) in `data.ts`, so a saved EPUB choice survives loading.
  The modal doesn't offer EPUB yet, and `export/index.ts` refuses it until 2.4.
- `serialState` takes `unnumbered`, so the sequence follows `countedNumbers`. `last` is
  `{ chapter, date }`: the last published chapter in order and its own date, as written.
- `readerBlocks` takes `{ placeholderMarker }`, to hide placeholders as the export does.
- A blank `epubSceneBreak` falls back to `* * *` on load. `readPosition` entries are
  cleaned on load: no chapter or no number dropped, the line a whole number, at least 0.
- Collections (SF 13, added after the wave): `core/collection.ts` with `Collection
  { stories, missing }` and `collectionOf(frontmatter, property, resolve)` (stub; null
  when the property is missing, an empty collection when it has no value); the
  `collectionProperty` setting (`contents`, no row, trimmed and restored like the other
  property names); in `core/books.ts` the stubs `collectionAt(app, note, settings)` (the
  one place links are resolved, so export and the source agree) and
  `collectionSource(app, notes, settings): BookSource<TFile>` (stories by basename,
  unnumbered, always included); in `export/source.ts` `SourceKind` (`note`, `book`,
  `collection`), `sourceKindOf` (written: a book wins over a `contents` list) and
  `ExportPlan.missing`. The `missingStories` warning id joins `WarningId` in 2.7, which
  hands the modal's case and strings to 2.4. No menu item and no modal change.

Plan changes: Q1, Q5, Q12, Q14, Q17, Q18 and Q20 show the signatures above. Task 1.3
owns `core/name-runs.ts` and the rule's test. Task 2.3 wires the rule. Task 2.4 adds
EPUB to the modal and removes the refusal. Task 2.6 draws the chapter headings from
`chapterHeadings`. `outline/pov.ts` and its copy of `linkText` already belong to 2.1.

The judge's fixture rules:
- **Names** (`tests/fixtures/universe-names/README.md`): headings never count for the
  names rule, as the plan says and as the lens's mask already does. So `Zeferino` (once
  in prose, once in a heading) is not marked; the fixture had it marked. Unlinked
  mentions do read headings, as Appears in does. A run that starts a sentence drops a
  leading stop word ("A Bia" gives "Bia") and is skipped otherwise. Fixture lines are
  1-based; `UnlinkedMention.line` is 0-based.
- **Serial** (`tests/fixtures/serial/README.md`): `last` follows the contract,
  `{ chapter, date }`. In `published-without-date` it is chapter 02 with no date; the
  fixture had chapter 01's date. The stage words are the author's Portuguese ones, which
  are not the defaults, so a test builds the mapping.
- **EPUB** (`tests/fixtures/epub/README.md`): the presets are `ptbr` (`pt-BR`) and
  `shunn` (`en-US`); the fixture had `shunn-en` and `en`. The cover PNG checks out.

## Wave 1: foundations (parallel, Sonnet)

| Task | Owns | Done when |
|---|---|---|
| 1.1 Scope on the classifier (9) | `core/scope.ts`, `core/classify.ts`, `core/books.ts`, `tests/universe-scope.test.ts` (renamed `tests/scope.test.ts`) | Every `Placement` carries the right `scope`; the 0.7 scope tests pass unchanged against the new home; G0c's after number meets Q15 |
| 1.2 Unlinked model | `universe/unlinked.ts` | The fixture's expected unlinked mentions; a note that links an entry lists none for it |
| 1.3 Names rule | `lens/rules-names.ts`, `core/name-runs.ts`, `core/names-source.ts`, `tests/lens-names-rule.test.ts` | `nameRuns`, `namesMask` and `newNames` filled in; Q2–Q4 on the fixture; sentence starts from `core/sentences.ts`; code, comments, frontmatter and headings never counted; "Not names" respected. `analyze.ts` already calls the rule: leave it |
| 1.4 EPUB writer | `export/writers/epub.ts`, `.github/workflows/ci.yml` (the EPUBCheck job), a build script for the fixture | The fixture book passes EPUBCheck in CI; the file list and `content.opf` match; `mimetype` first and stored |
| 1.5 Serial model | `publish/serial.ts` | The serial fixtures |
| 1.6 Reader model | `outline/reader-model.ts` | Blocks with source lines; markers hidden exactly as the manuscript model hides them; scene breaks kept |
| 1.7 Collection model (SF 13) | `core/collection.ts`, `core/books.ts` (the collection source adapter, after 1.1 on that file) | Order kept, missing links reported, duplicates once; the source gives every story unnumbered |

**Opus judge** after the wave. Is any decision made in code that this plan didn't
settle?

**Wave 1 result (2026-10-07).** Done. The four checks pass (172 test files, 3,004
tests). The first run of the wave was lost with its workflow. What it left was kept as
one unverified commit (`b5999aa`: 1.2, 1.6 and the tests of 1.1, 1.3 and 1.7), and the
wave was run again over it. 1.5 had already landed. Each task's code was checked
against the recovered tests, and three wrong tests were fixed (two in 1.3, one in 1.6;
below). Nothing
changes for the writer yet: no task in this wave touches a view, a command or a setting.

What landed:
- 1.1: `Placement.scope` is set on every file, book note, chapter, book folder and
  folder, through `scopeFor`. Snapshots, submissions, exports and "none" keep the none
  scope. With the mode off or missing, classify returns early and reads nothing more.
  `tests/universe-scope.test.ts` is now `tests/scope.test.ts`, unchanged.
- 1.2: `unlinkedIn`, as the contract says.
- 1.3: `nameRuns`, `namesMask` and `newNames`. The names port needed no change.
- 1.4: the EPUB writer, its unit tests and an `epubcheck` CI job.
- 1.5: `serialState`.
- 1.6: `readerBlocks`, built on `manuscriptOf`, so what is hidden is decided in one place.
- 1.7: `collectionOf`, `collectionAt` and `collectionSource`.

**G0c after** (`classify()` over the 3,020-file bench, mean per run; before 7.23 ms):
6.45 and 6.57 ms with the default settings (the mode is off, so this is the early
return), and 7.76 ms with the mode "universe" and a default universe folder (one run,
a temporary bench). That is about 7% more, under the 10% of Q15. `scope` stays a plain
field; no lazy getter.

**G0a:** EPUBCheck 5.4.0 (Java 25), run locally on the `ptbr` fixture book with the
cover: "No errors or warnings detected", 0 fatals, 0 errors, 0 warnings. The judge ran
it again on the final writer with the same result. The `shunn` and no-cover variants
have unit tests only. The CI job has not run on a GitHub runner yet: CI runs on pushes
to `main` and on pull requests, so it first runs when 0.9 opens its pull request. It
downloads the latest EPUBCheck release.

**Q16 checked:** every index spec already keys on `classifyKey` (works, placeholders,
explorer, entries, threads, mentions), so a settings save rebuilds each once. The
universe module's `settingsChanged` refreshes the names provider, not an index. No
spec needs moving.

The judge's fixes (`0.9: Wave 1 fixups`):
- Names rule: English "I" and its contractions ("I'm", "I'll") never start a run, and a
  contraction never joins one ("I'm Maria" gives "Maria"; "Pedro I" stays). Without
  this, any first-person English story flagged "I'm".
- Unlinked mentions: an occurrence inside a link or embed in the text is never listed.
  The mentions leave in the text of a Markdown link to a web page, and Link would have
  written a link inside it (rule 1).
- Collections: a text value with several wikilinks (`contents: "[[A]], [[B]]"`) gives
  each, not only the first.

Decisions taken in code (the judge keeps them):
- Scope (1.1): a missing `universeNote` reads as `Universe.md` and a missing
  `universeProperty` as `universe`, the universe module's defaults. A throw inside
  `scopeFor` gives the none scope (classify never throws). Scope follows the
  `universeMode` setting, not the universe feature switch.
- Names (1.3): a one-letter run is dropped. A run is capitalized words separated only by
  spaces or tabs, with the `pt` joiners between two capitalized words; after a leading
  stop word is dropped, a joiner can't start the run. A line break starts a sentence,
  so a name at the start of a line is skipped. "Sr. Almeida" gives "Sr" and "Almeida";
  `isKnownName` answers for "Sr" as a name title. `namesMask` is `readerMask` with
  heading lines and `$$` blocks blanked. A run is marked when it is not in the lens's
  names list or "Not names" (compared by `foldName`), `known` says no, and it recurs
  (5 in the note, or 2 works). With no language, every run at a sentence start is
  skipped. Two recovered expectations were wrong and were fixed: in English "Maria das
  Dores" gives "Maria" and "Dores"; "Rio\nPequeno" gives "Rio".
- EPUB (1.4): the identifier hashes `path\ntitle` with four seeded FNV-1a lanes into a
  version-5-shaped UUID (no crypto API). A chapter heading is `h1` and body headings
  start at `h2`. Consecutive quote blocks make one `blockquote`. A scene break is
  `<p class="scene-break">`. The landmark labels ("Capa"/"Cover", "Início"/"Start of
  content") follow the preset's language, like the contents label. The nav lists the
  chapters, or the title page when there are none (an empty list fails EPUBCheck). A
  body part with no heading (one note) is listed by the work's title and has no `h1`.
  A dedication or epigraph page is written only when it has blocks.
- Reader (1.6): `ReaderBlock.text` is Markdown rebuilt from the manuscript's runs, with
  literal marks escaped. Links read as plain text and inline code as plain text, as in
  the export. A scene break is `---`; one at a chapter's edge, or doubled, is dropped,
  as in the export. The recovered edge test opened with `---`, which reads as
  frontmatter; it now has real frontmatter first.
- Collections (1.7): the property is found ignoring case; nested lists (unquoted
  `[[A]]` in YAML) are flattened; `collectionOf` keeps its own small link parser
  (`core/scope`'s `linkText` reads only a list's first item). A link to a non-Markdown
  file, or to the collection note itself, is missing. A story's title is its basename;
  its `title` property is not read.

Hand-backs for Wave 2:
- 2.1: delete `universe/scope.ts` and move its callers, including
  `tests/universe-entries.test.ts`, `tests/universe-mention-ctx.test.ts` and
  `tests/universe-names-provider.test.ts`. A placement carries a scope whenever the
  mode is on, even with the universe feature off; callers that care check the feature.
- 2.2: `unlinkedIn` already skips text inside links and embeds. Link still checks the
  text before it writes.
- 2.3: wire `isKnownName`, `workCount` and `wantNameCounts` behind the port, and call
  `wantNameCounts` when the rule runs. The `universe-names` index keys runs with
  `nameRuns` over `namesMask`. The rule runs over the lens's own mask: check that it
  blanks what `namesMask` blanks (headings, math), so the two counts agree.
- 2.4: EPUB in the modal. Read the cover as binary into `EpubBook.cover`; set
  `identifier` to `epubIdentifier(workPath, title)` and `modified` to
  `epubModified(new Date())`; build the layout with `epubLayout(preset,
  epubSceneBreak)`; warn when a configured cover is missing (Q8); name the file
  `<title> (<preset>).epub` (D2).
- 2.6: draw each block's `text` with the Markdown renderer and the chapter headings from
  `chapterHeadings`; `line` is 0-based, frontmatter included.
- 2.7: `collectionAt(app, note, settings)` is null for a note that isn't a collection;
  `collectionSource` is the `BookSource` with the collection note as the handle; the
  readiness warning reads `collectionAt(...).missing`. "Create a collection…" writes
  `[[Name]]` list items, the form `collectionOf` reads.

## Wave 2: features (parallel, Sonnet, gated by G1 and G2)

| Task | Owns | Done when |
|---|---|---|
| 2.1 Scope callers (9) | `universe/index.ts`, `entries.ts`, `names-provider.ts`, `create.ts`, `new-entry.ts`, `mention-ctx.ts`, `threads.ts`, `threads-feature.ts`, `view-parts.ts`, `view.ts` (imports), `universe/scope.ts` (deleted), the tests that import it, `outline/pov.ts` | Every caller reads `books.classify(x).scope` or `core/scope.ts`; nothing imports `universe/scope.ts`; tests green |
| 2.2 Unlinked mentions UI | `universe/view-works.ts`, `universe/view-strings.ts` | The section per mockup; Link through `plugin.notes`, check-then-replace; a changed text writes nothing and refreshes the row |
| 2.3 Names in the lens | `lens/index.ts`, `lens/view.ts`, `lens/ui.ts`, `lens/strings.ts`, `lens/settings-ui.ts` (the rule switch in `lensRulesOn`, "Not names"), `universe/names-index.ts` (new, the on-demand index behind the port, built on `nameRuns` and `namesMask`) | The rule per mockup; `lens/index.ts` builds `NewNameOptions` from `plugin.names` and calls `wantNameCounts` when the rule runs; the panel reads `enabledRules(off, on)` and draws the `needsUniverse` row; Create opens the create-entry modal with the name; Dismiss adds to "Not names"; the index starts on the rule's first run and calls `onChange` once when built, then debounced |
| 2.4 EPUB in the export modal | `export/index.ts`, `export/modal.ts`, `export/logic.ts`, `export/presets.ts`, `export/strings.ts`, `export/styles.css`, `export/settings-ui.ts` (the cover, EPUB scene break and collection property rows) | EPUB per mockup: `"epub"` in the modal's format list with its `export.format.epub` strings, and the Wave 0 refusal in `export/index.ts` removed; the cover warning; "Export again" repeats an EPUB |
| 2.5 Publish next chapter | `publish/index.ts`, `publish/modal.ts`, `publish/checks.ts`, `publish/strings.ts`, `outline/header.ts`, `outline/strings.ts` | The command and the header button; the header line; the gap warning in the check |
| 2.7 Collections (SF 13) | `export/source.ts`, `export/collection-menu.ts` (new, the file explorer "Create a collection…") | Export on a collection note per mockup (2.4 owns the modal: 2.7 hands it the source choice); the menu makes the note with the links in order |
| 2.6 Read the book | `outline/reader-view.ts` (new), `outline/index.ts`, `outline/styles.css` | The view per mockup, chapter headings drawn from `chapterHeadings` (they are not reader blocks); click opens the chapter at the line; the reading position kept and followed; G0d met |

`universe/index.ts` belongs to 2.1: 2.3 hands it the lines that register the names
index, and 2.1 adds them. `export/index.ts`, `export/strings.ts` and `export/modal.ts` belong to 2.4:
2.7 hands it the collection target and plan (`sourceKindOf`, `collectionAt`,
`collectionSource`, `ExportPlan.missing`), the `files-menu` registration of "Create a
collection…", the strings and the collection property's settings row, and 2.4 adds
them. `src/main.ts` and `src/settings.ts` belong to 2.1 for any wiring the other tasks
need, listed in their hand-back.

**Opus judge** after the wave, and a completeness pass that traces whole flows: link an
unlinked mention; turn on the names rule, create an entry and dismiss a word; export a
book to EPUB with a cover and repeat it; publish the next chapter across a gap; read a
book and come back to the same place after renaming a chapter.

## Wave 3: docs (Sonnet), then review (Opus)

- **3.1 Guides**, English and pt-BR, Brazilian terms:
  - `the-world.md`: unlinked mentions, the names rule.
  - `publishing.md`: EPUB, collections, "Publish next chapter" and gaps.
  - `writing.md`: "Read the book".
  - `features-and-settings.md`: "Not names", the cover property, the EPUB scene break,
    the collection property.
- **3.2 Write-backs:** ARCHITECTURE.md (`core/scope.ts`, the scope field, the names
  port, the EPUB writer, the book models), CONTEXT.md (the classifier's fields),
  ROADMAP-universe.md (U 2.5), ROADMAP-novel.md (N 4, N 7 stage 3, N 8), IMPROVEMENTS.md
  (9 to Done).
- **3.3 Opus release review:** `/code-review high` over the branch; rules 1 and 2 on
  Link; the EPUB against EPUBCheck; the bench against G0c and G0d.

## Manual verification on `~/projects/website/escrita/`

- A conto in `Contos/` names a character without a link: the Works tab lists it.
  **Link** turns it into a link and changes nothing else. Edit that line first: nothing
  is written, and the row refreshes.
- Turn on the names rule and the lens in a conto: a recurring name with no entry is
  marked. **Create** makes the entry and the mark goes. **Dismiss** a word: it goes to
  "Not names". With the rule off, nothing is marked.
- Export a book to EPUB with a cover: it opens in an ebook reader (Calibre or Apple
  Books), with the table of contents, the chapters and the scene breaks.
- Publish chapters 1–3 of a book, then 5: the check warns about 4, and the header shows
  the gap. "Publish next chapter" opens 4.
- "Read the book": click a paragraph, it opens at that line. Close and reopen: the same
  place. Rename the chapter: still the same place.
- 0.7's G0d (Reading-view "Appears in" across re-renders) and the visual check against
  the canvas (PLAN-0.7.md, 5.2).

## Release checklist (CONTEXT.md, "Working process")

- **ROADMAP.md:** move 0.9 to "Shipped"; plan 1.0.
- **README.md:** changelog.
- **Guide pages:** both languages (3.1).
- **IMPROVEMENTS.md:** move 9 to "Done".
- **Topic roadmaps:** U 2.5, N 4, N 7 stage 3 and N 8 marked shipped, with the deviations.
- **Version:** `npm version minor --no-git-tag-version`; commit as `0.9.0`, then tag and
  push.

## Risks

- **Release size.** Four M features, two S, and an M improvement. The cut line says
  what moves first.
- **Scope in the classifier.** The classifier runs for every file the explorer draws.
  G0c measures it; Q15 has the lazy-getter fallback.
- **EPUB validity.** Readers are forgiving and stores are not. EPUBCheck in CI (G0a) is
  the guard, on the fixture book with every part: dedication, epigraph, cover, a scene
  break and an unnumbered chapter.
- **A noisy names rule.** Capitalized words are often not names. It is off by default,
  needs recurrence (Q3), skips sentence starts, and "Not names" keeps it short.
- **"Read the book" on a long book.** Rendering 30 chapters at once would block. Chapters
  render as they scroll into view; G0d measures it.
- **Link writes prose.** The only prose write in the release: one click, one mention,
  check-then-replace through `plugin.notes`.
