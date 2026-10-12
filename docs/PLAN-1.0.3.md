# Escrita 1.0.3, "settings search": implementation plan

The plan for IMPROVEMENTS 36 (settings rows) and IMPROVEMENTS 51 (the declarative settings
API), written 2026-10-12 on `main` at `c87360e` (1.0.2), plus the review-bot fixes already in
the working tree (`src/ui/day.ts`). **Approved 2026-10-12:** every question as recommended;
screenwriting stays in 1.1. The waves run as workflows (ultracode), on branch `1.0.3`.

**Goal:** the community review page shows no source-code warning or recommendation. Today
it shows four: `prefer-setting-definitions` (settings.ts:478) and `display` deprecated
(settings.ts:501, 665, 794). The `moment` warnings are fixed in the working tree. The CSS
warnings stay; they are false positives (see "Not in this plan").

**Stage served:** all of them, indirectly. Settings search finds Escrita's rows from
Obsidian's settings search box (1.13+). **Upkeep for the writer:** none.

## What Obsidian does (read from Obsidian 1.14.4's `app.js`)

The plan rests on how the API behaves, not only on the `.d.ts`:

- `renderTab()` draws from `settingItems` when it is non-empty, and calls `display()` only
  when it is empty. So once `getSettingDefinitions()` returns rows, `display()` is never
  called and can be removed.
- `settingItems` is computed **once**, in `addSettingTab()`, and again on each `update()`.
  Opening the tab does not recompute it. `update()` recomputes it, refreshes search and
  re-renders the tab if it is open.
- On re-render, groups are matched by heading and rows by `name` (or by control key).
  A matched row is cleared and its `render(setting, group)` runs again, with its cleanup
  function called first. A duplicate name in one group logs an error and confuses the
  match.
- The framework calls `setName` and `setDesc` from the definition, then `render`. Loose
  top-level rows are wrapped in an unnamed group. A group whose rows are all hidden is
  hidden too.
- `visible: () => boolean` is checked on each render. A hidden row is left out of search.
- Obsidian's own tabs build custom blocks as a row with `name: ""` whose `render` calls
  `settingEl.empty()` and draws into it (the keychain warning). We use the same pattern.
- `PluginSettingTab.setControlValue` writes `plugin.settings[key]` and calls `saveData`
  directly. That skips `plugin.saveSettings()`, so `features.apply()` and every module's
  `settingsChanged` would not run.

## Open questions, with recommended answers

| # | Question | Recommended answer |
|---|---|---|
| Q1 | Which version? | **1.0.3.** No new feature beyond search, and 1.1 stays screenwriting. Raising `minAppVersion` in a patch is fine: Obsidian simply doesn't offer the update to older apps, which keep 1.0.2. |
| Q2 | Which `minAppVersion`? | **1.13.0**, the first version with `getSettingDefinitions`. We don't use the 1.13.1 additions (group `search`, page `displayValue`). |
| Q3 | `control` rows or `render` rows? | **`render` everywhere**, through the row helpers. `control` rows save on every change through `saveData`, which skips `saveSettings()` and the commit-on-blur rule for text fields (typing a folder name would rebuild the indexes at each key), and a dropdown control stores strings where we store numbers. With `render`, today's behavior and tests carry over. |
| Q4 | Where do headings live? | **In the core.** Each slot in `core/settings-order.ts` gets a heading key, and the tab makes one group per slot. A module returns blocks instead of drawing: `settingsItems(ui): SettingsBlock[]`, where a block is `{ heading?: string; items: SettingGroupItem[] }`. The first block goes under the slot's heading. Later blocks become their own groups: the lens's "Rules" and "Measures", the universe's "Types" and "Names". |
| Q5 | When does the tab call `update()`? | **Only on a change of structure:** when the registry loads or unloads a feature (one hook in the registry's `apply`), on a universe mode change, and through `ui.redraw()`. Never after a text field commits, which would rebuild the rows below it while the writer tabs through. |
| Q6 | The Features page switches | **Keep `addSwitch`** (board 21, approved), inside `render` rows. The `.escrita-feature-group` sub-headings become group headings: "Features" (language and presets), then one group per feature group (Writing, Revision, …). |
| Q7 | Mockups (rule 7)? | **One board on the design canvas** before Wave 1: the Features page and the Lens section as Obsidian groups, light and dark, desktop and phone width. The layout becomes Obsidian's own group cards, and the Features page loses its custom sub-headings. The board can be waived if the author prefers to judge it in Obsidian. |
| Q8 | Split `settings.ts` while rewriting the tab? | **Yes, the tab only** (part of candidate 37): the tab class moves to `src/settings-tab.ts`, so `settings.ts` keeps the schema, defaults, loading and visibility rules. Moving the module strings (the rest of 37) stays out. |

## The design

### Row helpers: `src/ui/settings-rows.ts` (candidate 36)

Each helper returns a `SettingDefinition` with a `render` callback. No helper draws
anything by itself.

- `textRow(ui, { name, desc?, placeholder?, get, set, fallback?, cls?, visible? })`: a text
  field through `ui.saveOnCommit`. `fallback` defaults to the key's value in
  `ui.defaults()`, which fixes the known issue "English defaults in the settings tab".
- `textAreaRow(...)`, the same with a text area.
- `toggleRow(ui, { name, desc?, get, set, visible? })`: saves through `ui.save()`.
- `dropdownRow(ui, { name, desc?, options, get, set, visible? })`: converts number values
  itself.
- `numberRow(ui, { name, desc?, min, max, get, set })`: one parser, `digitsNumber`.
  It replaces `clampInt`, the goals module's hand-built fields and the lens's `numberRow`.
- `folderRow(ui, { …, problemOf })`: today's `addFolderField`, with an optional problem
  text so snapshots uses it too (`snapshots/settings-ui.ts:15-47` goes away).
- `noteRow(text, cls?)`: a description paragraph (`name: ""`, `searchable: false`) for the
  section descriptions that are bare divs today.
- `customRow(name, draw)`: `render` empties `settingEl` and calls `draw(el)`. Used for the
  presets block and the universe's types table and property block.

`visible` takes `() => boolean`, so rows that depend on `rowShown` (SETTING_FEATURES)
follow the loaded features without a rebuild.

### Module contract (`core/module-context.ts`)

- `settingsSection?(el, ui)` becomes `settingsItems?(ui): SettingsBlock[]`.
- `SettingsUi.redraw()` calls the tab's `update()`.
- `SettingsBlock` and the helpers' option types live in `src/ui/settings-rows.ts`, which
  imports only `obsidian` and core types.

### The tab (`src/settings-tab.ts`)

- `getSettingDefinitions()` walks `sectionOrder(loaded)` and returns one group per slot:
  the core's rows for the slot, then the module's blocks. It reads the loaded set when it is
  called; Q5 makes sure it is called again whenever that set changes.
- `display()` is removed, along with both lint exceptions for `settings.ts` in
  `eslint.config.mjs`.
- Custom parts:
  - **Stages:** one `render` row per stage. The duplicate-word warning is drawn inside the
    row's `infoEl` instead of after the row, so a re-render can't orphan it.
  - **Presets block:** a `customRow` that keeps redrawing only itself while asking (scroll
    kept, as today). "Apply" saves and calls `update()`.
  - **Explorer rows** under the explorer switch: the explorer's items go into the features
    group right after its row, while it is loaded.
- Row names are unique within each group. A test checks this, since Obsidian logs an error
  and mis-matches rows otherwise.

### Tests

- `tests/support/definitions.ts`: renders a definition list into the DOM with the existing
  `Setting` stub, the way Obsidian does it (`setName`, `setDesc`, `render`, cleanup on
  re-render, `visible`). It fails on a duplicate name in a group. `fakeUi` stays.
- The 17 `tests/settings-*.test.ts` files and the lifecycle tests that call
  `settingsSection` move to `settingsItems` through that helper. Their assertions stay
  the same: the same rows, the same saves, the same fallbacks.
- New tests:
  - every searchable row has a name;
  - a feature load or unload calls `update()` once;
  - a text commit doesn't call it;
  - a pt-BR install's cleared field falls back to the pt-BR default (candidate 36's known
    issue).

### Smaller items in the same release

- `minAppVersion` 1.13.0 in `manifest.json` and `versions.json`.
- `src/ui/confirm.ts`: `setWarning` becomes `setDestructive`, and that lint exception goes.
- The `moment` wrapper (`src/ui/day.ts`) from the working tree.

## Gates

- **G0** (before Wave 0): the questions answered.
- **G1** (before Wave 1): the board approved, or waived (Q7). **Passed** 2026-10-12: board 40,
  "Configurações em grupos do Obsidian, e a busca".
- **G2** (before release): `npm run lint` clean with only `snapshots/fs.ts`'s exception
  left, and the bot's config (no per-file exceptions) reporting nothing but that one.
- **G3** (before release): the by-hand checks below, in the author's Obsidian 1.14.4.
  The author called the release on 2026-10-12. **G2 passed** the same day: `npm run lint` is
  clean, and the config with no per-file exceptions reports nothing.

## Waves

The memory rules apply: Sonnet for the code, Opus for the contracts and the judge; worktrees
made in the main loop, each task committing; heavy checks behind `flock`, vitest with
`--maxWorkers=4`.

**Wave 0, contracts (Opus, main loop, one commit).** `src/ui/settings-rows.ts` with the
helpers and their tests. The `settingsItems` contract and `SettingsBlock`. Headings in
`core/settings-order.ts`. `tests/support/definitions.ts`. The skeleton of
`src/settings-tab.ts`: `getSettingDefinitions`, the registry hook and `redraw`. Until
Wave 1 finishes, modules still on `settingsSection` keep drawing through a temporary adapter
(one `render` row per module), so every commit builds.

**Wave 1, ports (done 2026-10-12; Sonnet, four tasks in parallel, one owner per file):**

| Task | Owns |
|---|---|
| A, the core tab | `src/settings-tab.ts`, `src/settings.ts`, `src/ui/confirm.ts`, tests `settings-tab`, `-tab-update`, `-plugin-folders`, `-features`, `-presets`, `-stages`, `-order`, `-1-4`, `-g3`, `-folder-problem`, `-imports` |
| B, small sections | goals, outline, placeholders, darlings, publish, explorer, desk `settings-ui.ts` and `index.ts` (the one-line method), their tests (`settings-goals`, `-publish`, `-darlings`, `-desk`, `-explorer`) |
| C, editor, lens, snapshots | `editor/settings-ui.ts`, `editor/features.ts`, `lens/settings-ui.ts`, `lens/index.ts`, `snapshots/settings-ui.ts`, `snapshots/index.ts`, their tests (`settings-typing`, `-lens`, `-lens-section`, `-snapshots`) |
| D, universe, export, submissions | `universe/settings-ui.ts`, `universe/threads-settings-ui.ts`, `universe/index.ts`, `universe/threads-feature.ts`, `export/*`, `submissions/*` settings files, their tests (`settings-universe`, `universe-names-settings`) and the lifecycle-export tests |

Rules for every task (from the Wave 0 review):

- A ported module exports `<prefix>SettingsItems(ui, plugin): SettingsBlock[]` from its
  `settings-ui.ts`, where the prefix is today's (`goals`, `typing`, `explorer`, `threads`…).
  `tests/settings-tab.test.ts` finds that function, or the old `<prefix>SettingsSection`, by
  name, so B, C and D never edit it.
- Nobody edits `tests/support/` (`definitions.ts`, `section-ui.ts`, `section-rig.ts`). A test
  that needs a different rig keeps its own copy.
- Module tests render through `renderBlocks`, which groups blocks as the tab does (a block
  without a heading joins the group above), so a duplicate row name fails there. A clash with
  the core's rows of the slot shows in `settings-tab.test.ts`, which opens the whole tab.
- Rows are built when the tab rebuilds, not when it opens. The tab rebuilds when the loaded
  features, the switches, `defaultsLanguage` or `lensLanguage` change, so a placeholder or fallback read from
  `ui.defaults()` while building is current. Anything else a row reads must be read in
  `render` (or passed as a function).
- Task A: the universe slot's core part is only its heading. Once ported it has no rows, and
  `slotGroups` then opens the threads rows under the universe's heading (the empty slot's
  heading carries to the next slot without one, pinned in `settings-tab.test.ts`). Keep
  the universe slot in `sectionOrder` while threads is loaded.

Task A also removes the adapter once B–D merge. **Judge (Opus):** reads the diff against
this plan, the row names per group, and the behaviors in "Tests".

**Wave 2, release (done 2026-10-12, except the release mechanics; Sonnet, then an Opus review):**

- `manifest.json` and `versions.json` (1.13.0); `eslint.config.mjs` exceptions removed.
- `docs/ARCHITECTURE.md`: the settings tab section, and the exceptions list.
- `docs/IMPROVEMENTS.md`: 36 and 51 to "Done", and the known issue closed.
- `docs/ROADMAP.md`: the 1.0.3 row.
- README changelog with an upgrade note: "needs Obsidian 1.13 or later".
- The guide's "Features and settings" page (English and pt-BR): settings search.
- The author confirms two section headings (judge fix, Wave 1): the lens's "Revisão · a lente" /
  "Revision · the lens" (board 40), and the publish check's "Publicação · a checagem" /
  "Publishing · the check" (same pattern, not on the board). The Features page groups stay plain.

## Results

- **Wave 0** (contracts) and **Wave 1** (the four ports, merged; the temporary adapter is gone;
  judge fixes and review nits committed): every module returns `settingsItems`; the tab is
  `src/settings-tab.ts` with `getSettingDefinitions`, no `display()`; `confirm.ts` uses
  `setDestructive`; the `settings.ts` and `confirm.ts` lint exceptions are gone.
- **Wave 2** (docs and manifest): `minAppVersion` is 1.13.0 in `manifest.json` (the version is
  still 1.0.2); the two `minAppVersion` options are out of `eslint.config.mjs`; ARCHITECTURE.md
  ("Settings tab", "Documented exceptions"), CONTEXT.md, IMPROVEMENTS.md (36 and 51 in "Done"),
  ROADMAP.md, the README changelog and the guide's "Features and settings" page (English and
  pt-BR) describe the new tab. `versions.json` gets its 1.0.3 entry (1.13.0) from `npm version`
  at release, after the by-hand checks (G3). In the same bare-version commit: date the README
  changelog heading (`### 1.0.3 (unreleased)`) and trim the ROADMAP row's version cell to `1.0.3`.
- **Section headings accepted by the author on 2026-10-12:** "Revisão · a lente" /
  "Revision · the lens" and "Publicação · a checagem" / "Publishing · the check". The Features
  page groups stay plain.

## By-hand checks (G3, Obsidian 1.14.4, `~/projects/website/escrita/`)

1. Open Escrita's tab: every section shows, in today's order, with today's values.
2. Type "chapters folder" (and "pasta de capítulos" in pt-BR) in the settings search: the
   row is found, and a click lands on it.
3. Turn a feature off and on from the Features page: its section goes and comes back, the
   page keeps its scroll, and the off notice shows.
4. Turn a feature off from the command palette with the tab open: the tab follows.
5. Presets: ask, cancel, apply; the label says "Custom" or the preset.
6. Text fields save on blur or Enter, not per key, and a cleared field shows the default
   of the install's language. Tab through the stage words without losing focus.
7. Stage colors: pick, clear, pick black. The duplicate-word warning shows under the right
   stage.
8. Universe off, per book, universe: the section's rows follow; the types table saves.
9. Lens "Create lists" redraws its rows.
10. At phone width (`app.emulateMobile(true)`): no horizontal scroll, touch targets of
    32px or more.

## Risks

- **Re-render cost and focus.** `update()` re-runs every row's `render`. Calling it only on
  a change of structure (Q5) avoids rebuilding a field the writer just moved to. Check 6
  covers it.
- **Stale structure.** Definitions computed at `addSettingTab` time go stale if a structure
  change misses the hook. The registry hook covers features, including the setup command and
  presets; check 4 covers the palette.
- **Only 1.14.4 is at hand.** The API is marked `@since 1.13.0`, but 1.13.0 itself won't be
  tested.
- **Size.** About 1,000 lines of settings code across 19 files and 17 test files. Wave 0's
  adapter keeps every commit building.

## Not in this plan

- **The CSS lint warnings** (`text-decoration`, `box-decoration-break`, `text-indent`). They
  are false positives against Obsidian 1.7.4, kept by the author's choice on 2026-10-12 and
  documented in ARCHITECTURE.md. The review page will still list them. Clearing them would
  mean redrawing the lens marks and name underlines without `text-decoration`.
- Moving the module strings out of `src/strings.ts` (the rest of candidate 37).
- `control` rows (Q3). They can come later, row by row, if search or reset-to-default
  needs them.
