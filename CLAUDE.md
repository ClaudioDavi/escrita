@CONTEXT.md

# Working with the author

Preferences the author gave over past sessions (moved here from local memory on 2026-10-12, so
they travel with the repo). Dates are when each was said.

## Planning and releases

- **Roadmap first.** For anything about versions, the roadmap or "what's next", read
  `docs/ROADMAP.md` first and open topic roadmap sections only for details. Don't redo the
  cross-roadmap research each time (2026-09-29). Keep the index current when plans change.
- **Every release ships at least one improvement** from `docs/IMPROVEMENTS.md`, named under the
  version in ROADMAP.md and moved to "Done" when it ships (2026-09-30). If the list runs low,
  suggest a new architecture review.
- **minAppVersion is not a hard limit.** If a fix or API needs a newer Obsidian, say which
  version and propose raising `minAppVersion` to it, with an upgrade note in the changelog,
  rather than leaving the work undone. Pick the lowest version that has the API, never the latest
  by default (2026-10-09: "never get strung up by the minimum obsidian version... just dont go
  to latest all the time").
- **No phone testing.** The author has no phone sync. Phone gates are waived and mobile is
  assumed to work when the code uses Obsidian's documented, mobile-safe API. Keep the mobile-safe
  rules in code; mention mobile risk once in a plan's risks, never as a blocker (2026-10-05).

## Strings

- **pt-BR is Brazilian, not European.** Use the term Brazilian apps use (Google Docs, Word
  pt-BR): "versão", not "instantâneo". Keep the English loanwords Brazilians use: "thread"
  (feminine, "a thread", `fechada`), "darlings". Watch gender agreement when swapping nouns.

## Running plan waves

- **Each wave of a `docs/PLAN-<version>.md` runs as a Workflow** (2026-10-06): the wave's tasks
  fan out in parallel, then an Opus judge. Stay in the loop between waves: read the judge's
  verdict and wait for the author before launching the next wave.
- **Model split** (2026-10-01, 2026-10-04): set `model` explicitly on every agent.
  - Sonnet: search, implementation, tests, mechanical edits, docs and guide pages (en and pt-BR),
    measurements, first-pass reviews, checking a finding with a concrete check.
  - Opus: every architecture decision, always (module boundaries, seams, interfaces, data
    shapes, IMPROVEMENTS candidates), final synthesis or plan, design questions, critique of a
    plan, judgment-call verification, the judge pass over a wave, merges.
  - Sonnet tasks get narrow file ownership, an exact "done when" (the four checks pass) and
    file:line evidence in reports. A Sonnet task that hits an architecture choice stops and hands
    it to Opus.
- **The author's machine has limited resources** (2026-10-09). Parallel agents are fine; heavy
  shells are not:
  - at most one shell command per agent at a time, no background commands;
  - vitest with `--maxWorkers=4`; single test files while iterating, the full suite once;
  - with several agents, serialize typecheck, full vitest and build with
    `flock <scratchpad>/heavy.lock <cmd>`. Run each under `flock` directly, not inside
    `sh -c` (Claude Code's safety check blocks `sh -c` scripts that run `npm run build`).
- **Worktrees: create them in the main loop**, not with the workflow's `isolation: 'worktree'`
  (it branched from the wrong base and the rtk git hook blocked agents' git, 2026-10-07):
  `git worktree add -b <branch> <scratchpad>/wt/<branch> <base>`, symlink `node_modules`, and
  give each agent the absolute path (`cd <path> && …`). Each task commits on its branch when its
  checks pass. Never `git worktree remove --force` before `git status` is clean there: a
  force-remove once destroyed uncommitted work.

## The test vault

- **`~/Projects/escrita-test/`** is a vault just for trying Escrita out (2026-10-15). Its
  `.obsidian/plugins/escrita/` holds symlinks to the repo's `main.js`, `manifest.json` and
  `styles.css`, so it always runs the last build. Keep it updated with every release: after
  `npm run build` for a release (and before the author's by-hand checks), make sure the links
  are still there and point at this repo; reloading the plugin in Obsidian picks up the new
  build. It is a scratch vault: never put the author's writing in it.

## Reading Obsidian's real behavior

The author's Obsidian is a flatpak. Its app code is in
`~/.var/app/md.obsidian.Obsidian/config/obsidian/obsidian-<version>.asar`, which unpacks with a few
lines of Python (asar header + offsets) into `app.js`. Read it for runtime questions the `.d.ts`
leaves open (for example: `update()` recomputes `settingItems` and re-renders the open tab;
`renderTab()` calls `display()` only when the definitions are empty). Unpack it into the
scratchpad, never the repo.
