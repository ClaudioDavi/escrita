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

**Drawn on 2026-10-07**, boards 35–38 ("1.0 · Preparar o cofre para escrever"), waiting for
approval. Decisions the boards propose, beyond the questions above:

- **What each preset turns on.** SF 10 predates export, submissions and the stage snapshot,
  and names "Enter and typography" in no preset. Proposed: **Essentials** (7): goals, outline,
  placeholders, typing, darlings, snapshots, the home block. **Writer** (16): Essentials plus
  the lens, dialogue focus, moving blocks, templates, explorer counts, the stage snapshot, the
  publish check, export and submissions. **Everything** (19) adds spellcheck on demand,
  threads and the universe. The universe mode never changes through a preset.
- **The setup never changes a saved setting without a tick.** In a vault with settings,
  values the writer saved are listed as kept; the features row and the layout come unticked.
  A track folder is added to the list, never swapped.
- **Names.** The command is "Set up a writing vault" ("Preparar o cofre para escrever"); the
  home note is `Home.md` or `Início.md`; the examples start with "Example ·" or "Exemplo ·"
  and carry `example: true`.
- **A partial failure** says what was made and what wasn't, and undoes nothing. Settings are
  written last.
- **Open on board 38:** a quiet link to the setup command at the top of the Features page,
  only when there is no home note.

## Gates

- **G0** (before Wave 1): the questions above answered. Q1, Q3, Q8 and the improvements
  are confirmed (2026-10-07).
- **G1** (before Wave 2): the mockups approved.
- **G2** (before release): the setup in an empty vault goes from install to a working
  conto and book in one command, in English and in Portuguese; run in the author's vault,
  it changes no note and no saved setting (SF 10, "Done when").
- **G3** (before release): the author's 0.9 `data.json` loads into 1.0 with every effective
  value the same (a test with a copy of it, plus a run in the vault).
- **G4** (before release): `npm run lint` clean, and the mobile emulation pass done.

## Waves (sketch)

- **Wave 0: contracts and fixtures.** `core/defaults.ts` types and tables, the settings
  migration of Q1 with its test against a copy of the author's `data.json`, the preset
  table (`core/presets.ts`), the setup plan type (what it will create, as data, so the
  preview and the run read the same list).
- **Wave 1: foundations (parallel).** Candidate 8 (`piece` and `pieceSource` on the
  classifier; the explorer and the goals modal read it). Candidate 13 (helpers to `core/`
  and `ui/`). `eslint-plugin-obsidianmd` and the fixes it asks for. The mobile audit of
  the code.
- **Wave 2: features (after G1).** The setup module (notice, command, preview, run,
  layout). Presets on the Features page. Language defaults wired into the first load and
  the setup.
- **Wave 3: docs.** "Getting started", "Revision", "Tracking", the rest of "Writing" and
  "Features and settings", both languages; the README as the front door; the manifest
  description; write-backs to ARCHITECTURE.md, the roadmaps and IMPROVEMENTS.md. Then the
  Opus release review.
- **Manual verification** on the author's vault, with a test plan (`TEST-1.0.md`), as in 0.9.

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
- **Docs size.** Three new guides in two languages and a README rewrite is the largest docs
  wave so far.
