# End-to-end tests (`npm run e2e`)

The checks that used to be by-hand steps run in a real Obsidian, driven by Playwright. They
are local only: CI has no flatpak Obsidian. Plan and decisions: PLAN-1.1.md (Q12 to Q14).

## Run it

```
npm run build                         # the specs copy main.js, manifest.json and styles.css
npm run e2e                           # everything
npx playwright test setup             # one spec file (a name filter)
npx playwright test -g "G2b 4"        # one test, by title
HEADED=1 npm run e2e                  # show the window (the default is headless)
npx tsc -p e2e                        # typecheck the harness and the specs
npx playwright show-report e2e/report/html   # screenshots and failures
```

On the author's machine, run it under the shared lock when other agents are working
(`flock <scratchpad>/heavy.lock npx playwright test`). One Obsidian runs at a time
(`workers: 1`). The full run takes under a minute.

A test marked `test.fail()` is a known finding: the list reporter shows it with a cross, and
Playwright counts it as passed while the bug is still there. When the bug is fixed the test
"fails" with "Expected to fail, but passed": delete the `test.fail()` line.

## What it covers

| Spec | Replaces |
|---|---|
| `e2e/specs/new-work.spec.ts` | PLAN-1.0.4.md, "By-hand checks" 1 to 9 (Nova obra…, the modal, the footer, phone width) |
| `e2e/specs/setup.spec.ts` | TEST-1.0.md G2a (the setup in an empty Portuguese vault) and G2b (English, writing mode) |

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

`e2e/lib/obsidian.ts` starts a second Obsidian: `flatpak run md.obsidian.Obsidian
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
  written, except Playwright's own `e2e/report/` (git-ignored).
- `e2e/` is dev-only. It is not in the bundle, and `tests/no-network.test.ts` still scans only
  `src/` and `main.js`.

## Add a spec

1. Pick or add a fixture in `e2e/fixtures/index.ts`: `emptyPt`, `emptyEn` or `writer`, each with
   `{ seeded: true }` to skip the first-run notice (`data.json` holds `setupOffered: true`; the
   settings are a fresh install's). A fixture is a map of files, the language and optional
   `data.json`, so a new one is a few lines.
2. Create `e2e/specs/<name>.spec.ts`:

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

3. Helpers in `e2e/lib/app.ts`: `command`, `commandListed`, `openFile`, `cursor`, `activeFile`,
   `setting`, `setSettings`, `setFeature`, `readVaultFile`, `waitForFile`, `writeVaultFile`,
   `listVaultFolder`, `readData`, `notice`, `notices`, `modal`, `closeModals`, `openSettings`,
   `settingsWindow`, `placement`, `emulateMobile`, `setTheme`, `observeLongTasks` and
   `longTasks`, `waitFor`, `screenshot`. `e2e/lib/setup-modal.ts` is a page object for the setup.
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
