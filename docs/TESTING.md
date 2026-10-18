# End-to-end tests (`npm run e2e`)

The checks that used to be by-hand steps run in a real Obsidian, driven by Playwright. They
are local only: CI has no flatpak Obsidian. Plan and decisions: PLAN-1.1.md (Q12 to Q14).
The harness lives under `tests/` so the Obsidian review bot, which skips that folder, does not lint it.

## Run it

```
npm run build                         # the specs copy main.js, manifest.json and styles.css
npm run e2e                           # everything
npx playwright test setup             # one spec file (a name filter)
npx playwright test -g "G2b 4"        # one test, by title
HEADED=1 npm run e2e                  # show the window (the default is headless)
npx tsc -p tests/e2e                        # typecheck the harness and the specs
npx playwright show-report tests/e2e/report/html   # screenshots and failures
```

On the author's machine, run it under the shared lock when other agents are working
(`flock <scratchpad>/heavy.lock npx playwright test`). One Obsidian runs at a time
(`workers: 1`). The full run is 204 tests in about 8 minutes (plus the launches); run one spec file while iterating.

A test marked `test.fail()` is a known finding: the list reporter shows it with a cross, and
Playwright counts it as passed while the bug is still there. When the bug is fixed the test
"fails" with "Expected to fail, but passed": delete the `test.fail()` line.

## What it covers

| Spec | Replaces |
|---|---|
| `tests/e2e/specs/new-work.spec.ts` | PLAN-1.0.4.md, "By-hand checks" 1 to 9 (Nova obra…, the modal, the footer, phone width) |
| `tests/e2e/specs/setup.spec.ts` | TEST-1.0.md G2a (the setup in an empty Portuguese vault) and G2b (English, writing mode) |
| `tests/e2e/specs/features-presets.spec.ts` | TEST-1.0.md, Presets 1 to 7 |
| `tests/e2e/specs/writing-mode.spec.ts` | TEST-1.0.md, writing mode without a third-party theme (steps 2, 3, 6 to 9) |
| `tests/e2e/specs/release-fixes.spec.ts` | TEST-1.0.md, the release-candidate fixes 1 to 4 |
| `tests/e2e/specs/demo-findings.spec.ts` | TEST-1.0.md, the demo findings 1 to 10 and 13 to 18 |
| `tests/e2e/specs/phone.spec.ts` | TEST-1.0.md G4 1 to 5 and the MOBILE-1.0 items a script can see (390 px, `emulateMobile`) |
| `tests/e2e/specs/author-vault.spec.ts` | TEST-1.0.md G2c, on a copy of `~/Projects/website/escrita` (skips when it is missing; the source is hashed before and after) |
| `tests/e2e/specs/beat-click.spec.ts` | IMPROVEMENTS known issue 1 (beat click and the restored cursor), kept as a regression check |
| `tests/e2e/specs/unlinked.spec.ts`, `names.spec.ts` | TEST-0.9.md, unlinked mentions and the names rule |
| `tests/e2e/specs/epub.spec.ts`, `collections.spec.ts`, `publish-next.spec.ts` | TEST-0.9.md, EPUB, collections, "Publish next chapter" |
| `tests/e2e/specs/read-book.spec.ts` | TEST-0.9.md, "Read the book", and 0.9's G0d timings on the `long-book` fixture |
| `tests/e2e/specs/scope.spec.ts`, `switches.spec.ts` | TEST-0.9.md, scope and the feature switches |
| `tests/e2e/specs/appears-in-reading.spec.ts` | 0.7's G0d, closed as decided: Reading view shows the panel only |
| `tests/e2e/specs/screenplay.spec.ts` | PLAN-1.1's own checks: a screenplay's export (PDF, Fountain, page, warnings, preview, settings) |
| `tests/e2e/specs/visual-1.1.1.spec.ts` | PLAN-1.1.1, part 1: the lines drawn as backgrounds and spacers (lens marks, name underline, desk, Ignore, publish check, export indent, closed thread), dark and light. `RECORD=<folder>` also writes `visual-1.1.1.mp4` (CDP screencast, `lib/record.ts`) and one PNG per step; without it there are no pauses and no files |

Helpers beyond `app.ts`: `tests/e2e/lib/more.ts` (the settings page, overlap, small targets, sideways
scroll), `panels.ts` (side panels, the universe tab, the settings window), `export-ui.ts`,
`zip-read.ts` (reads a DOCX or EPUB), and `measure.ts` (`timeToFirstText`, `Trace` for the longest
main-thread task over CDP, `scrollToEnd`).

A fixture's `data.json` with a `settings` block but no `stages` counts as an install from before
the setup, so its stage words and folders are the English defaults. Specs that need the pt-BR set
change settings after launch with `app.setSettings` (`WORLD_SETTINGS` in `tests/e2e/fixtures/h1.ts`).

Each test is one numbered check. Screenshots are attached to the report for anything that
needs an eye (light and dark, "looks right"): review the pictures instead of clicking through.

## What stays by eye

- A real phone (touch, keyboard, the system's share and file pickers). The harness's phone
  check is Obsidian's `emulateMobile` at 390 px wide.
- Third-party themes and plugins (Minimal, zen mode, other plugins' interplay).
- Matching a screenshot to a design board. The harness attaches the picture; the author compares.
- Reading a PDF or an EPUB in a reader app.
- The author's own vault (G2c). It runs against a copy, never the vault itself.

## How it works

`tests/e2e/lib/obsidian.ts` starts a second Obsidian: `flatpak run md.obsidian.Obsidian
--user-data-dir=<run>/profile --remote-debugging-port=<free port> --ozone-platform=headless`,
and attaches with `chromium.connectOverCDP`. The first launch of a run:

1. makes `~/.cache/escrita-e2e/run-<id>/` (inside `$HOME`: the flatpak cannot see `/tmp`),
   with the vault `escrita-e2e-<id>/` and a profile whose `obsidian.json` opens only that vault;
2. writes the fixture's notes and copies `main.js`, `manifest.json` and `styles.css` from the
   repo root of the checkout being tested (`repo` option; default: this checkout);
3. sets Obsidian's language (from the fixture) in localStorage and reloads once;
4. turns community plugins on with `app.plugins.setEnable(true)` (restricted mode otherwise asks);
5. sets the window to 1280 x 800 (a headless window starts at 200 x 150) and waits for the layout
   and for Escrita's commands.

`restart()` quits that Obsidian through the DevTools protocol (`Browser.close`, so localStorage is
flushed to the profile; a kill would lose the plugins flag and the language) and starts it again on the
same profile and vault.

`emulateMobile(on)` calls `app.emulateMobile`, which reloads the window, and sets a 390 px (on) or
1280 px (off) viewport.

### Isolation guarantees

- Never touched: `~/.var/app/md.obsidian.Obsidian/` (the author's Obsidian config), the author's
  vaults (`~/Projects/ideas`, `~/Projects/vault`, `~/Projects/website`, `~/Projects/escrita-test`) and
  their running Obsidian. The second Obsidian has its own profile and vault list.
- `close()` kills only the flatpak instance ids that were new in `flatpak ps` when this launch started
  (two per launch: the app and its sandbox), and always runs: put it in `afterAll` or `finally`.
- Each launch prunes the `run-*` folders of earlier runs. Nothing outside `~/.cache/escrita-e2e/` is
  written, except Playwright's own `tests/e2e/report/` (git-ignored).
- `tests/e2e/` is dev-only. It is not in the bundle, and `tests/no-network.test.ts` still scans only
  `src/` and `main.js`.

## Add a spec

1. Pick or add a fixture in `tests/e2e/fixtures/index.ts`: `emptyPt`, `emptyEn` or `writer`, each with
   `{ seeded: true }` to skip the first-run notice (`data.json` holds `setupOffered: true`; the
   settings are a fresh install's). A fixture is a map of files, the language and optional
   `data.json`, so a new one is a few lines.
   Bigger fixtures live beside it: `h1.ts` (`world()`, `WORLD_SETTINGS`), `world-09.ts`, `long-book.ts`
   (31 chapters, about 91,000 words) and `screenplays.ts` (the Fountain samples and a Portuguese short).
   A `VaultSpec` can also `copyFrom` a folder (a read-only recursive copy, used for the author's vault).
2. Create `tests/e2e/specs/<name>.spec.ts`:

   ```ts
   import { expect, test } from "@playwright/test";
   import { App } from "../lib/app";
   import { writer } from "../fixtures";

   test.describe.configure({ mode: "serial" });
   let app: App;
   test.beforeAll(async () => { app = await App.launch({ vault: writer({ seeded: true }) }); });
   test.afterAll(async () => { await app?.close(); });

   test("1. what the check says", async () => {
     await app.command("new-work");             // "escrita:new-work"
     await expect(app.page.locator(".prompt")).toBeVisible();
     await app.screenshot("1. the list");       // attached to the report
   });
   ```

3. Helpers in `tests/e2e/lib/app.ts`: `command`, `commandListed`, `openFile`, `cursor`, `activeFile`,
   `setting`, `setSettings`, `setFeature`, `readVaultFile`, `waitForFile`, `writeVaultFile`,
   `listVaultFolder`, `readData`, `notice`, `notices`, `modal`, `closeModals`, `openSettings`,
   `settingsWindow`, `placement`, `emulateMobile`, `setTheme`, `observeLongTasks` and
   `longTasks`, `waitFor`, `screenshot`. `tests/e2e/lib/setup-modal.ts` is a page object for the setup.
4. Keep the DOM coupling small: Escrita's own `escrita-*` classes first, Obsidian's classes only
   where needed. A spec that breaks after an Obsidian update is a harness fix, not a plugin bug.
5. A spec that fails because the plugin misbehaves is a finding: mark the test `test.fail()` with a
   comment that says what was seen, and report it.

## Things the harness learned

- Obsidian's settings (1.14) open in their own window, not a `.modal`: use `settingsWindow()` and
  `openSettings()`.
- A new note is created empty and then written: read it with `waitForFile`, not `readVaultFile`.
- Labels in the setup's step 2 differ from the settings rows (for example "Abrir a nota inicial ao
  iniciar" against "Abrir ao iniciar"): read the strings files.
