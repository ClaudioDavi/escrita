# Escrita 1.0, "the full release": implementation plan

This is the plan for Escrita 1.0, started 2026-10-07 on branch `1.0` at `923be0b` (the
0.9.0 release). **Draft.** On 2026-10-07 the author confirmed Q1, Q3 and Q8 and the two
improvements (8 and 13), all as recommended. The other questions stand as recommended
unless the author changes them. The waves are sketched; each is written out in full, with
file ownership per task, once the questions are answered and the mockups are approved.
Each wave runs as one workflow, with an Opus judge at the end.

The specs win on any disagreement:

- `docs/ROADMAP-short-fiction.md`: SF 10 (set up a writing vault, presets, defaults in the
  writer's language).
- `docs/ROADMAP.md`: "Next: 1.0" and "Documentation".
- `docs/IMPROVEMENTS.md`: the candidates picked below.

If this plan and a spec disagree, fix this plan. Where the plan narrows a spec, the change
is listed under "Deviations", and the release writes it back into the spec.

**Stages served** (ARCHITECTURE.md, "Workflow"): all of them, from the first one. A new
writer installs Escrita, runs one command and sits down to write a conto or a book, in
their language, with the features they chose. Everything else in 1.0 makes what already
exists trustworthy enough to submit: a mobile pass, the guide complete, the guidelines
audited.

**Upkeep asked of the writer:** none. The setup runs once and is optional; a preset is a
starting point, after which each switch is theirs.

## Scope

| Feature | Ref | Effort |
|---|---|---|
| "Set up a writing vault": a notice on first run, the command, a preview of what it creates, then folders, examples, settings, a home note and a layout | SF 10 | M |
| Presets: Essentials, Writer, Everything, in the setup and as three buttons on the Features page, with "Custom" | SF 10 | S |
| Writing mode: only the note and a small goal counter, a command and a layout choice in the setup | SF 10 | S |
| Defaults in the writer's language: the pt-BR default set when Obsidian runs in Portuguese | SF 10 | S |
| Mobile pass: Obsidian's mobile emulation on desktop, plus an audit of the code (Q8) | 1.0 | S |
| Guidelines audit for the community submission: `eslint-plugin-obsidianmd`, the manifest, the documented exceptions | 1.0 | S |
| User guide complete: "Getting started", "Revision", "Tracking" (new), "Writing" and "Features and settings" filled in, in English and pt-BR | Docs | M |
| README as the front door: what Escrita is, install, one line per feature linking to its guide, the changelog | Docs | S |
| Migrations tested on the author's vault: a 0.9 `data.json` loads into 1.0 unchanged in meaning | 1.0 | S |
| Community plugin submission: the pull request to `obsidianmd/obsidian-releases` (the author opens it) | 1.0 | S |

| # | Improvement | Why now | Size |
|---|---|---|---|
| 8 | One rule for a note's effective piece: `piece` plus `pieceSource` on the classifier result | A correctness fix for 1.0: a chapter's book-default target shows in the outline but not in the explorer or the goals modal. The setup's example book has chapter targets, so every surface it shows must agree | M |
| 13 | Shared helpers out of module folders (`core/` and a shared `ui/`) | The setup command is a new module that needs `confirmAction` and `openWork`; it should not import other modules' folders to get them | S |

**Cut line.** If the release runs long, these move after 1.0 in this order:

1. The writing layout step of the setup (Q4). The setup still makes folders, examples,
   settings and the home note.
2. The example book (Q3). The example conto stays.
3. Candidate 13. The setup imports the two helpers where they are, listed as a
   documented exception.

The setup, the presets, the language defaults, the guide, the guidelines audit and
candidate 8 never cut.

**Out of scope:**

- Screenwriting (after 1.0, `ROADMAP-screenplay.md`) and universe phase 2 (U 2.1–2.4).
- A phone test. The author has no phone to test on; the phone gates stay waived (Q8).
- Saving or restoring layouts after the first one. Obsidian owns the workspace (SF 10).
- The "Other plugins" guide (N 6, unscheduled).
- A store page, screenshots site or any website (rule 5). The README is the page.

## Open questions, with recommended answers

| # | Question | Recommended answer |
|---|---|---|
| Q1 | When do the pt-BR defaults apply? | **Confirmed.** **Only on a fresh install (no `data.json`) and in the setup command.** Today `loadSettings` fills every unsaved key from `DEFAULT_SETTINGS`, so a 0.9 writer in Portuguese who never saved `chaptersFolder` is using "Chapters". Switching that default to "Capítulos" on update would lose their chapters. So: on the first 1.0 load of an existing install, write the English defaults the writer relies on into `data.json` once (a migration, logged in the changelog's upgrade notes); a fresh install picks the set from Obsidian's language. |
| Q2 | Where does the default set live? | **`core/defaults.ts`**: one table per language (`en`, `pt-BR`), each a `Partial<Settings>` of the word-bearing keys (status words, folders, chapters without a number, submission results, word lists). Pure, tested. `DEFAULT_SETTINGS` stays English and is the fallback for every key a language set leaves out. `normalizeSettings` resets a blank field to `DEFAULT_SETTINGS` today (`settings.ts:276-282`), so it takes the install's set too, or a cleared field in a Portuguese vault would come back in English. Rule 6 holds: every value is still a setting. |
| Q3 | Does the setup create example notes? | **Confirmed.** **Yes, as the spec says, marked `example: true` and listed in the preview with their own tick.** One conto (beats, a placeholder, a target) and one book with two chapters. Never over an existing note (`notes.create` with `exists: "return"`). The home note mentions they are safe to delete. |
| Q4 | How is the layout applied? | **Once, through public workspace calls only** (`getLeaf`, `getRightLeaf`, `setViewState`): the home note in the main tab, the outline on the right, the universe panel on the left when the universe is on. Unticked by default when the vault already has more than one open leaf. Escrita stores nothing about it. |
| Q5 | First run: what counts as "first"? | **No `data.json` and no Escrita setting saved.** A notice with a "Set up" button, shown once (a `setupOffered` flag), never a modal. An update from 0.9 never shows it; the command is always in the palette. |
| Q6 | Existing installs and presets | **Every feature stays on after the update**, as SF 10 says. The Features page shows "Custom" or the matching preset; a click on a preset shows the switches it will change and asks first. |
| Q7 | Which preset does a new install get without the setup? | **Writer**, the spec's default for new installs. A fresh install with no setup run starts on Writer; today it starts on every feature. |
| Q8 | What is the mobile pass, with no phone? | **Confirmed.** **Obsidian's mobile emulation on desktop** (`app.emulateMobile(true)` from the developer console) on the author's vault: every view, modal and menu at phone width, touch targets ≥ 32 px, no hover-only control. Plus a code audit: no Node or Electron API, no regex lookbehind or other syntax older iOS lacks, `Platform` checks where the UI differs, and the bundle's load time (`main.js` is 1.2 MB). |
| Q9 | Which guidelines check? | **`eslint-plugin-obsidianmd`** (the rules the submission review bot runs), added as a dev dependency and an `npm run lint` step in CI. Every finding is fixed or listed in ARCHITECTURE.md's documented exceptions. |
| Q10 | The manifest description | **Rewritten** (the current one describes 0.1): under 250 characters, no "Obsidian", ends with a period. For example: "Write and revise fiction: an outline with scene beats, goals, a revision lens, a shared world, and manuscript export to DOCX and EPUB." |
| Q11 | Where does the long README content go? | **Into the guides**, section by section, so every command and setting appears in exactly one guide (ROADMAP.md, "Documentation"). The README keeps a short paragraph per feature with a link. Done last, after the guides exist. |
| Q12 | Who opens the submission pull request? | **The author**, from their GitHub account, after 1.0.0 is published. The plan prepares the entry for `community-plugins.json` (`id: escrita`, still free on 2026-10-07) and a checklist; it does not open it. |

## Design first (rule 7)

Before any setup or preset UI is built, mockups on the design canvas
(https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6), approved by the author:

- The first-run notice.
- The setup: what you write, language, preset, then the preview of everything it will
  create, with the ticks (folders, examples, settings, home note, layout).
- The writing layout, desktop and phone.
- The preset buttons on the Features page, "Custom", and the confirm step listing the
  switches that change.

This is gate **G1**; Wave 2 doesn't start without it.

**Drawn and approved on 2026-10-07**, boards 35–39 ("1.0 · Preparar o cofre para
escrever"; 39 is the writing mode). Decisions the boards settle, beyond the questions above:

- **What each preset turns on** (rebalanced by the author on 2026-10-07: the lens and export
  are essentials). **Essentials** (9): goals, outline, placeholders, typing, the lens,
  darlings, snapshots, export, the home block. **Writer** (16): Essentials plus dialogue focus,
  moving blocks, templates, explorer counts, the stage snapshot, the publish check and
  submissions. **Everything** (19) adds spellcheck on demand, threads and the universe. The
  universe mode never changes through a preset. SF 10 predates export, submissions and the
  stage snapshot, so this is a deviation written back at the release.
- **Two layouts in the setup** (asked by the author on 2026-10-07):
  - **Writing desk**: the home note in front; the right sidebar split in half, the outline
    (chapters and their beats) on top and the lens panel below, with placeholders as a
    second tab behind it. On a phone the drawers don't split: outline and lens are two tabs.
  - **Writing mode**: only the note. The sidebars, tab bar, ribbon and status bar hide; a small
    "today 312 / 500" goal counter stays at the bottom when goals are on (nothing else). A
    quiet "Exit writing mode" button stays visible (no hover on phones). "Continue" in the
    home block opens the work in the same tab, still in the mode. One command enters and
    exits, no default hotkey. One new setting, "Open in writing mode", beside "Open the home
    note on startup"; the setup turns it on when the writer picks this layout. Part of the
    home block feature, no switch of its own. Hiding is a body class
    (`escrita-writing-mode`) plus public workspace calls to collapse and restore the
    sidebars; nothing is written to the vault. Obsidian has no zen mode of its own, and
    community plugins do (Zen Mode, Ultra Zen Mode, Easy View); kept anyway (2026-10-07)
    because the setup can offer it without a second plugin and only Escrita has the goal
    counter and "Continue". It stays this small; the guide names those plugins for more.
- **The setup never changes a saved setting without a tick.** In a vault with settings,
  values the writer saved are listed as kept; the features row and the layout come unticked.
  A track folder is added to the list, never swapped.
- **Names.** The command is "Set up a writing vault" ("Preparar o cofre para escrever"); the
  home note is `Home.md` or `Início.md`; the examples start with "Example ·" or "Exemplo ·"
  and carry `example: true`.
- **A partial failure** says what was made and what wasn't, and undoes nothing. Settings are
  written last.
- **The setup link on the Features page** (board 38, approved): a quiet link below the
  preset buttons, only when there is no home note.

## Gates

- **G0** (before Wave 1): the questions above answered. Q1, Q3, Q8 and the improvements
  are confirmed (2026-10-07).
- **G1** (before Wave 2): the mockups approved. **Passed** 2026-10-07.
- **G2** (before release): the setup in an empty vault goes from install to a working
  conto and book in one command, in English and in Portuguese; run in the author's vault,
  it changes no note and no saved setting (SF 10, "Done when").
- **G3** (before release): the author's 0.9 `data.json` loads into 1.0 with every effective
  value the same (a test with a copy of it, plus a run in the vault).
- **G4** (before release): `npm run lint` clean, and the mobile emulation pass done.

## Models

- **Sonnet** does the code: implementation, tests, docs.
- **Opus** writes the Wave 0 contracts, judges each wave, and reviews the release.
- A Sonnet task that meets an architecture choice not settled here stops and hands it
  back.

## Ownership rules

- One owner per file per wave. A task touches only the files it lists, plus new test
  files named after it. Independent tasks run in parallel in worktrees and each commits when
  its checks pass; a merge step brings them together.
- `src/core/*`, `main.ts`, `settings.ts` and `data.ts` change only in the task that owns
  them.
- **Every task's done-when:** `npm run typecheck`, `npm test` and `npm run build` pass,
  and `npm run test:bundle` passes after a build. While iterating, a task runs only its
  own test files; the full checks run once at the end.

## Wave 0: contracts and fixtures

**Q1 as built.** The confirmed outcome stands (an existing install keeps the English
defaults it relies on; a fresh install takes the set of Obsidian's language), reached
with less writing: a new setting `defaultsLanguage` (`"en"` or `"pt-BR"`) names the set an
install uses. `migrateSettings` gives a saved `settings` object without the key `"en"`, so
no other value has to be written for a 0.9 install. A fresh install (no saved `settings`)
takes the language from Obsidian and saves once on its first load, so the set never moves
when Obsidian's language changes later. Loading is `mergeDefaults(defaultsFor(lang), …)`
and `normalizeSettings` restores a blank field from the same set.

**0.1 Contracts (Opus).** Signatures, doc comments and data, stub bodies where logic is
due in Wave 1, compiled, no behaviour change for an existing install.

- `core/defaults.ts`: `DefaultsLanguage`, the `en` and `pt-BR` tables as
  `Partial<EscritaSettings>` of the word-bearing keys only (stage words, chapters folder,
  unnumbered titles, submission results, export and submissions folders, darlings notes,
  universe note, entry type labels and folders, thread closed word, the home note name
  the setup uses), and `defaultsFor(lang): EscritaSettings` (`DEFAULT_SETTINGS` overlaid).
  Property names stay English in both sets: they are keys in the writer's notes, and a
  pt-BR vault with `status:` is the author's own. Written, tested.
- `languageOf(obsidianLanguage)`: `"pt-BR"` for `pt` and `pt-BR`, else `"en"`. Where it reads
  Obsidian's language (`getLanguage()` needs 1.8.7; `minAppVersion` is 1.7.2) is the
  contract's call, with the fallback stated.
- Settings with no UI: `defaultsLanguage` (`"en"`), `openInWritingMode` (`false`).
  `data.setupOffered` (a flag, not a setting), cleaned on load.
- `core/feature-presets.ts` (`core/presets.ts` is the manuscript presets): `PresetId`
  (`essentials`, `writer`, `everything`), `PRESETS` as the three lists of the board,
  `presetSwitches(id, current)`, `matchingPreset(switches): PresetId | null` (the universe
  never counts), `presetChanges(current, id): { off: FeatureId[]; on: FeatureId[] }` with
  requirements pulled in. Stubs.
- Candidate 8: `Placement.pieceSource: "own" | "book" | null` beside `piece`, with the
  rule in a doc comment; `piece` keeps today's value until 1.1.
- `src/setup/plan.ts`: `SetupChoices` (what you write, language, preset, examples, home,
  layout `"desk" | "focus" | null`), `SetupVault` (a snapshot of what exists: folders,
  notes and their case, settings, open leaves, whether works exist), `SetupItem` (kind,
  path or key, `new` / `kept` / `change`, tickable, ticked by default, the reason line),
  `planSetup(choices, vault, settings): SetupItem[]` (stub). The preview and the run read
  the same list. A setting counts as the writer's own when it differs from the install's
  default set; then it is `kept`.
- How the setup registers. It is not one of the 19 features and never switches off. The
  contract picks the seam (an always-on module, or registration from `main.ts`), keeps
  rule 8 (`register*` for everything) and writes it into ARCHITECTURE.md.

**0.2 Fixtures (Sonnet).**

- `tests/fixtures/settings-0.9/`: a copy of the author's `data.json` (from
  `~/projects/website/escrita/.obsidian/plugins/escrita/`), **scrubbed**: `authorName`,
  `authorSurname`, `contactLines` and every path or title that names an unpublished work
  replaced, `history` cut to two days. With the expected effective settings after a 1.0
  load (G3): every value the same, `defaultsLanguage` `"en"`, features unchanged.
- `tests/fixtures/setup/`: vault snapshots as JSON (`SetupVault`) with the expected items:
  an empty vault in English and in Portuguese, the author-like vault of board 36 a, a
  second run (board 36 b), a case clash (board 36 c), a vault with tabs open.

**Opus judge:** the contracts against Q1–Q12, SF 10 and boards 35–39.

**Wave 0 result (date 2026-10-07).** Done: contracts `8ccd9c3`, fixtures `53db612`, judge
fixes `c878fb2`. The four checks pass, and nothing changes for an existing install: a 0.9
`data.json` gains `defaultsLanguage: "en"`, `openInWritingMode: false` and
`setupOffered: true`, all filled in on load, and every other effective value is the same
(the settings fixture is the author's file with only the three author fields scrubbed;
`tests/setup-fixtures.test.ts` checks every saved key survives). The presets are the
board's: Essentials 9, Writer 16, Everything 18 ids plus the universe, which no preset
touches. The pt-BR words are Brazilian. The contracts add, beyond the list above:
- `defaultsFor` lives in `settings.ts` (:296), over the pure `overlayDefaults` in
  `core/defaults.ts`, so core never imports `settings.ts` by value (an import cycle once
  1.4's `normalizeSettings` calls it).
- Obsidian's language is read through `locale()` (`moment.locale()`); `getLanguage()`
  replaces it when `minAppVersion` reaches 1.8.7. Every `pt-…` tag gives pt-BR.
- Three more word-bearing keys: `threadKeyword` (`fio`), the entry type values and
  `formValues`. Left out on purpose: `snapshotsFolder`, `excludeFolders`,
  `placeholderMarker`, `epubSceneBreak`. The setup's names (`Home.md` / `Início.md`, the
  stories and books folders, the examples) are `SETUP_NAMES`, not settings; `homeNote`
  stays "".
- `data.setupOffered` is derived when absent: true when the data holds saved settings
  (Q5: an update never sees the notice).
- The setup's ticks live on the items (`tick`, `ticked`), not in `SetupChoices`, so the
  preview and the run read one list; `itemsToRun` is written.
- The setup is a `CoreModule` started by `startCoreModule` after `features.apply()`: its
  own `ModuleContext`, no view or editor slots, never switched off (rule 8;
  ARCHITECTURE.md, "Core modules").

The judge's fixture rules (`tests/fixtures/setup/README.md`, rules 3 to 8):
- **A language tick.** `defaultsLanguage`, every word-bearing setting that would change and
  `lensLanguage` share one tick, `language`, ticked by default only in a vault without
  works. The fixtures had them changing with no tick: in the author's vault the setup would
  have moved `submissionsFolder` and `exportFolder` to the Portuguese set, so the pending
  submissions would stop being submissions. A value equal to the install's set is still
  saved, and SF 10 says a saved value never changes without the writer's choice.
  `trackFolders` keeps no tick (it only gains the folders the run makes).
- **The layout is unticked in a vault with works**, as the board says, not only with more
  than one leaf open. `author-like` with no tick changed now runs only the `Livros` folder
  and its track folder (a new test pins it, the G2 rule in miniature).
- The pt-BR unnumbered titles gain "Nota do autor", which SF 10 names.
- Kept as the fixtures made them: one item per word key, `kept` items with no tick, the
  example book as six items, `lensLanguage` written as the picked language, a second run's
  layout row `new` and unticked rather than a `kept` state.

Plan changes for Wave 1:
- **1.1** also makes a chapter's cached counts drop when its book note changes (they are
  keyed by the chapter's mtime).
- **1.3**: the author's fixture (spellcheck off, `features` `{lens, snapshots}`) reads
  "Custom"; an all-on 0.9 install reads "Everything".
- **1.4** also gives the install's set to `normalizeStages`, `normalizeUniverse` (it owns
  `universe/settings.ts` for that) and classify's folder fallbacks (`snapshotsRoot`,
  `exportRoot`, `submissionsRoot`), owning those lines of `core/classify.ts` after 1.1
  commits. Today a blank value there comes back in English.
- **1.5** follows the language tick and the layout rule above; the reason keys and the
  chapter file names (`01 Arrival.md`, `01 Chegada.md`) stay provisional until 2.1.
- Wiring the setup into `main.ts` stays Wave 2's.

Open for the author: whether pt-BR also renames `Escrita/Snapshots` ("Versões") and the
`Templates` exclude folder ("Modelos"), both English in both sets for now; and whether the
setup, in a fresh vault with an existing `home.md` (case clash), should point `homeNote` at
that note under the home tick, as `case-clash.json` does.

## Wave 1: foundations (parallel, Sonnet; 1.7 after the merge)

| Task | Owns | Done when |
|---|---|---|
| 1.1 Effective piece (8) | `core/classify.ts`, `core/measure.ts`, `core/measurer.ts`, `explorer/index.ts`, `goals/progress-modal.ts`, `outline/rows.ts`, `outline/view.ts` (the piece lines only) | A chapter with only a book default shows the same target in the outline, the explorer and the goals modal; `pieceSource` set; IMPROVEMENTS 8's call sites read the field |
| 1.2 Shared helpers (13) | the helpers listed in IMPROVEMENTS 13, moved to `core/` (pure) and `src/ui/` (modals, `openWork`), and their importers | No module imports another module's folder for them; ARCHITECTURE.md's dependency table updated |
| 1.3 Presets | `core/feature-presets.ts`, `tests/feature-presets.test.ts` | The three lists of board 38; `matchingPreset` ignores the universe; `presetChanges` pulls in `snapshots` for `stageSnapshot`; a 0.9 all-on install matches "everything" |
| 1.4 Language defaults on load | `main.ts` (`loadAll`), `settings.ts` (`normalizeSettings`), `core/migrate.ts`, `core/defaults.ts` (tests only) | The 0.9 fixture loads unchanged (G3); a fresh install in Portuguese gets the pt-BR set and Writer (Q7), and saves once; a blank folder setting comes back in the install's language |
| 1.5 Setup plan | `setup/plan.ts`, `tests/setup-plan.test.ts` | Every `tests/fixtures/setup/` case; never an item over an existing note; a track folder added, never swapped; settings items last |
| 1.6 Mobile code audit | `docs/MOBILE-1.0.md` (new), module `styles.css` files for hover-only fixes | Every view, modal and menu listed with what a phone gets; no Node or Electron API, no syntax older iOS lacks (lookbehind), hover-only controls fixed; the load time of `main.js` noted for G4 |
| 1.7 Guidelines lint | `package.json`, the ESLint config, `.github/workflows/ci.yml`, and the files its fixes touch | `npm run lint` clean in CI; every rule left off has its exception in ARCHITECTURE.md. Runs last: its fixes touch many files |

**Opus judge** after the wave. Is any decision made in code that this plan didn't
settle?

**Wave 1 result (2026-10-07).** Only two of the seven tasks landed: 1.6, the mobile code audit
(`9a054af`, `docs/MOBILE-1.0.md`), and 1.7, the guidelines lint (`782b263`). Then the judge
fixes (`6ff49f3`). Tasks 1.1 to 1.5 wrote no code. Their worktrees were branched from the
0.9 line (`923be0b`), not from `1.0`, so the plan and the Wave 0 contracts were missing. Git
was also refused inside them: the rtk rewrite hook trips the worktree-isolation guard. Every
check passes on `1.0`, including `npm run lint`. G3 holds on today's load path.
- **1.7.** `npm run lint` runs in CI with zero warnings. The review config rejects inline
  disables, so each rule left off is scoped to one file in `eslint.config.mjs` and listed
  with its reason in ARCHITECTURE.md (`settings.ts` `display()`, `setWarning`, the empty
  snapshot folder removal, and two APIs typed from 1.8.7). The judge accepts all four. Three
  small behaviour changes were made in code, and the judge keeps them: a YAML map in the
  outline shows as JSON, not "[object Object]"; on Obsidian older than 1.8.7 the
  no-templates notice shows without its button; and the settings placeholders are
  translated. Nothing else changes for a writer.
- **1.6.** No Node or Electron API, no hover-only control, no touch target under 32 px. The
  regex lookbehind (F1) was a load failure on Safari before 16.4. Q8 already rules it out,
  so the judge rewrote the five sites (`core/markers.ts`, `universe/unlinked-link.ts`,
  `universe/entries.ts`) and added `tests/no-lookbehind.test.ts` over `src/` and `main.js`.
  `main.js` is 1.31 MB, with about 26 ms to compile and run on desktop, so lazy-loading
  the writers would save little.
- **Judge.** No decision the plan didn't settle was made in code. `tests/settings-g3.test.ts`
  loads the 0.9 fixture the way `loadAll` does and compares every setting to the expected
  file. It passes now and is 1.4's guard. The fixtures test's title now says two settings,
  because `setupOffered` is data.

Plan changes for Wave 2:
- **Wave 2 waits.** First, 1.1 to 1.5 run again as Wave 1b, from the head of `1.0`. Each
  worktree must contain `docs/PLAN-1.0.md`, and git must work inside it. If neither can be
  promised, the tasks run one at a time in the main checkout (the low-resources rule).
  1.1 commits before 1.4, which owns lines of `core/classify.ts` after it. An Opus judge
  checks Wave 1b, then Wave 2 starts.
- **Every task's done-when adds `npm run lint`**, since the lint now lands before the code.
  No inline `eslint-disable`; a new exception goes in `eslint.config.mjs` and ARCHITECTURE.md.
- 1.7's fixes touched lines that 1.1 and 1.4 own (`main.ts`, `settings.ts`, `core/defaults.ts`,
  `core/migrate.ts`, `outline/rows.ts`, `outline/view.ts`). Those tasks build on them.

Open for the author:
- Raise `minAppVersion` to 1.8.7? That drops two lint exceptions and lets `getLanguage()`
  replace `moment.locale()`.
- F2 (now task 2.6): the universe panel's entry menu opens only on a right click, and iOS has none. The
  fix is the outline's "⋯" button. It needs an owner (a small Wave 2 task in `universe/`,
  reusing an approved pattern).
- F3: the stage word, the placeholder count and the POV label show only in tooltips, which a
  phone never shows. This is a design question, for version 1.1 or later.
- The `no-deprecated` exception covers all of `settings.ts`, so 2.5's Features page code is
  not checked for it. The judge accepts this until `minAppVersion` allows the declarative
  settings API.

**Wave 1b result (2026-10-07).** Tasks 1.1 to 1.5 ran again from the head of `1.0` and all
landed: 1.3 presets `6521e2d`, 1.2 shared helpers `1775f36`, 1.1 effective piece `5792138`,
1.4 language defaults `3854356`, 1.5 setup plan `5dfb090`, the merge fix `ddc7024` (1.3's
`presetSwitches` spread every setting into the features row), then the judge's `a7b0e75`.
The four checks and `npm run lint` pass.
- **1.1.** The classifier fills a chapter's `piece` and `pieceSource` from its book note
  (`effectivePiece`, the outline's rule), and `Measurer.unit` reads it, so the explorer, the
  goals modal, the status bar and the outline's note view agree. The status bar now shows a
  chapter's book-default target too, as IMPROVEMENTS 8 wants. A chapter's cached counts drop
  when its book note's default changes (not on every save of the book note).
  `outline/rows.ts` still computes the piece itself, through the same function; a new
  `tests/piece-agreement.test.ts` pins that it gives the classifier's piece and source.
- **1.2.** Moved, not rewritten: `core/block-context.ts`, `core/dialogue.ts`,
  `core/typography.ts`, `core/piece-bar.ts`, `ui/confirm.ts`, `ui/open-work.ts`.
  `publish/checks` stays (export uses `core/readiness.ts`). `ui/confirm.ts` reads the
  `outline.cancel` string, which resolves with the outline off.
- **1.3.** As the board. The real 0.9 fixture has spellcheck on demand saved on, so the
  author's install reads **Everything**, not "Custom" as Wave 0 said; the presets test's
  "author" case was an invented one and is renamed.
- **1.4.** `loadSettings(saved, locale)` in `settings.ts`: a saved object keeps its set
  (`"en"` when missing), a fresh install takes Obsidian's language and Writer and saves
  once. `normalizeStages` and `normalizeUniverse` take a `base` set (a language argument
  would make an import cycle). Blank `chaptersFolder` and darlings notes still aren't
  restored, as in 0.9.
- **1.5.** As the fixtures. Decisions the plan didn't settle, accepted: the example book's
  chapters folder is the writer's own `chaptersFolder` when they have one; an own
  `homeNote` or `lensLanguage` is `kept`; the plain defaults are a copy in `plan.ts`
  (now pinned to `DEFAULT_SETTINGS` by a test).
- **Judge.** No architecture decision was made in code outside the plan. Fixes:
  `tests/fixtures/settings-0.9/data.json` was git-ignored, so CI and every fresh worktree
  failed G3; it is tracked now (scrubbed, as its README says). `tests/settings-g3.test.ts`
  now loads through `loadSettings` in English and Portuguese, the real load path, and still
  passes: a 0.9 install's effective settings are unchanged. A fresh install reads Writer
  through `matchingPreset`, universe off. `planSetup` never plans an item over an existing
  path (any case) and changes a saved setting only under a tick, except `trackFolders`
  (added to) and `universeMode` (the writer's own "Shared world" answer), both as the
  fixtures settled.

Plan changes for Wave 2:
- **2.2 applies the features row without its `universeMode`.** The row's value carries the
  current mode (no preset changes it), and the `universeMode` item comes before it, so
  applying the whole value would undo the writer's "Shared world" answer.
- **2.2 re-plans when a tick changes**, or at least when the language tick does: the
  example book's chapters folder is the target language's `chaptersFolder` only when the
  language group runs. With examples ticked and language unticked, the example chapters
  must go in the install's `chaptersFolder`, or the example isn't a book. Simplest: the run
  calls `planSetup` with the language that will be in effect.
- 2.1 replaces `EXAMPLE_CHAPTERS` in `plan.ts` (owns those lines).

Open for the author:
- (Settled in the Wave 2 seams: the startup row, `Versões`/`Modelos`, and the home note in
  another case.)
- Lint covers `src/` only; `eslint package.json` still reports `depend/ban-dependencies`
  for `builtin-modules` (esbuild's externals). Harmless for the review bot, which lints
  sources; replace it with `node:module`'s `builtinModules` in 1.7's follow-up if wanted.

## Wave 2: features (parallel, Sonnet, after G1)

| Task | Owns | Done when |
|---|---|---|
| 2.1 Examples | `setup/examples.ts` (the conto and the two-chapter book, `en` and `pt-BR`, `example: true`; `EXAMPLE_CHAPTERS` now lives here), and `tests/fixtures/setup/*.json` only if it renames a chapter | Each example classifies as a piece and a book; beats, a placeholder and a target in each |
| 2.2 The setup | `setup/` except `examples.ts`, `layout.ts` and `layout-strings.ts`: `index.ts` (the notice, command, `open()`), the two-step modal, the run, `home-text.ts`, `plan.ts` (the re-plan), `strings.ts`, styles | Boards 35 and 36: the preview is `planSetup`'s list; every file through `notes.create`; settings written last; a partial failure says what was made |
| 2.3 The layout | `setup/layout.ts`, `setup/layout-strings.ts` | Board 37: the home note in front, the outline on top and the lens with placeholders below on the right, by public workspace calls; never closes a leaf; "focus" enters writing mode through the port |
| 2.4 Writing mode | `desk/writing-mode.ts`, `desk/index.ts`, `desk/settings-ui.ts`, `desk/strings.ts`, `desk/styles.css`, `desk/home-note.ts`, `desk/render.ts`, `ui/open-work.ts` ("Continue" in the same tab; it moved there in 1.2) | Board 39; exiting restores only what it hid; the counter only with goals on; "Open in writing mode" |
| 2.5 Presets on the Features page | `settings.ts` (the Features page), `strings.ts` | Board 38: three buttons, "Custom", the confirm step listing what changes, the setup link when there is no home note |
| 2.6 The universe entry menu on phones (F2) | `universe/view-entries.ts`, `universe/view.css`, `universe/view-strings.ts` | `docs/MOBILE-1.0.md` F2: each entry row gets a visible "⋯" button opening the same menu as the right click, the outline's pattern (32 px target, a tooltip and `aria-label`); the right click stays |

**Wave 2 seams (2026-10-07, Opus).** Committed before the tasks branch, so none of them waits
on another's code. Signatures, doc comments and stub bodies; nothing changes for a writer.
- **Examples (2.1).** `setup/examples.ts`: `EXAMPLE_CHAPTERS`, `ExampleRole`
  (`story`, `bookNote`, `chapter` with its index), `ExampleContext` (language and the
  settings in effect after the run) and `exampleText(role, ctx)`, a stub returning "".
  `planSetup` already calls it and puts the text on each new example item's `content`;
  `settingsAfter(settings, language)` in `plan.ts` builds the context's settings.
- **The setup (2.2).** `setup/index.ts` `SetupModule`, a `CoreModule`, constructed and
  started in `main.ts` (`plugin.setup`, `startCoreModule` after `features.apply()`); its
  strings (`setupStrings`, `setupLayoutStrings`) are registered there too, so 2.2 doesn't touch
  `main.ts`. `open()` (stub) opens the modal; `hasHomeNote()` (written) is what the Features
  page asks. `setup/home-text.ts` `homeNoteText({ language, examples })` gives the home item's
  `content` (for now the works block alone).
- **The layout (2.3).** `setup/layout.ts` `applyLayout(plugin, layout): Promise<void>`, a stub.
  View ids come from `core/view-types.ts` `VIEW_TYPES` (the four modules' constants are now
  defined from it), so the layout imports no module folder.
- **Writing mode (2.4).** The port `core/writing-mode.ts` (`WritingModePort`: `isActive`,
  `enter`, `exit`, `toggle`, `onChange`) and `writingModeOf(plugin.features)`, null while the
  desk is off. `DeskModule.writingMode` is the stub `desk/writing-mode.ts` `WritingMode`,
  loaded and unloaded with the desk. The goal counter reads `core/daily-progress.ts`
  (`dailyProgressOf(plugin.features)`, null while goals are off), which the goals module now
  provides (`GoalsModule.dailyProgress`, notified whenever the status bar redraws).
- **Presets on the Features page (2.5).** `plugin.setup.open()` and `plugin.setup.hasHomeNote()`.
- **String namespaces.** 2.2 `setup.*` in `setup/strings.ts` (the plan's reason keys
  `setup.reason.*` included); 2.3 `setup.layout.*` in `setup/layout-strings.ts`; 2.4
  `desk.writingMode.*` in `desk/strings.ts`; 2.5 `settings.features.preset.*` and
  `settings.features.setupLink` in `strings.ts`; 2.6 `universe.view.entryMore*` in
  `universe/view-strings.ts`. 2.1 has none: the example texts are in the setup's chosen
  language, not the interface's, and live in `examples.ts`.

Decisions settled with the seams (the open questions of Wave 0 and Wave 1b, as recommended):
- **pt-BR snapshots and templates.** A fresh pt-BR install keeps snapshots in
  `Escrita/Versões` and excludes `Modelos`. They are `INSTALL_KEYS` in `core/defaults.ts`:
  in both sets, not word keys, so the setup never lists or moves them (moving
  `snapshotsFolder` would orphan the snapshots, and `excludeFolders` is the writer's list).
  English is unchanged, and a 0.9 install (set "en") keeps `Escrita/Snapshots` and
  `Templates`: G3 still passes. A blank snapshots folder comes back from the install's set
  (`snapshotsRoot(setting, defaultsLanguage)`).
- **A home note in another case.** An existing `home.md` (for `Home.md`) is used as the home
  note under the home tick, as `case-clash.json` has it.
- **"Open the home note on startup"** is its own row (tick `startup`), unticked in a vault
  with works. Five fixtures move that item from the `home` tick to `startup`.

**Opus judge**, then G2 on an empty vault in both languages and on the author's vault.

## Wave 3: docs (Sonnet), then review (Opus)

"Getting started", "Revision", "Tracking", the rest of "Writing" and "Features and
settings", in both languages; the README as the front door; the manifest description
(Q10); write-backs to ARCHITECTURE.md, the roadmaps and IMPROVEMENTS.md. Then the Opus
release review.

## Manual verification on `~/projects/website/escrita/`

A test plan (`TEST-1.0.md`), as in 0.9: the setup in a scratch vault and in the author's,
the presets, writing mode next to the Minimal theme and a zen plugin, the emulated phone
(G4).

## Release checklist (CONTEXT.md, "Working process")

- **ROADMAP.md:** move 1.0 to "Shipped"; plan what comes after (screenwriting).
- **README.md:** changelog.
- **Guide pages:** both languages.
- **IMPROVEMENTS.md:** move 8 and 13 to "Done".
- **Topic roadmaps:** SF 10 marked shipped, with the deviations.
- **Version:** `npm version major --no-git-tag-version` (1.0.0); commit as `1.0.0`, PR to
  `main`, merge, tag and push.
- **Submission:** the author opens the `obsidian-releases` pull request (Q12).

## Risks

- **The language defaults moving a writer's folders.** The whole of Q1. The migration and
  G3 are the guard.
- **The setup writing into a real vault.** Rule 1: it never touches an existing note, shows
  everything before it writes, and every file goes through `notes.create`.
- **The review bot.** It may flag things the guidelines allow with a reason (the
  documented exceptions). Each needs a sentence ready for the reviewer.
- **The bundle size on phones.** 1.2 MB parsed at startup. Measured in Q8; if it is slow,
  the DOCX and EPUB writers load on first export.
- **Writing mode next to a zen plugin or theme.** Both hiding the same chrome, or a theme
  restyling it. Test it with the Minimal theme and one zen plugin on; exiting must restore
  only what Escrita hid.
- **Docs size.** Three new guides in two languages and a README rewrite is the largest docs
  wave so far.
