# Escrita 1.2.5, typewriter scroll: implementation plan

A small version. In writing mode the line being typed stays a third of the way down the editor
and the note scrolls instead (SF 17, asked by the author 2026-11-03). It also carries the outline
fix found on 2026-11-21. Written 2026-11-21 on `main` at `1aac72f` (1.2.4).

**Stage served:** drafting. **Upkeep for the writer:** none. It comes with writing mode, on by
default, with one setting to turn it off.

## Already in the working tree (done, checked)

- **The Esboço panel kept an old note.** When a sidebar tab first loads, Obsidian calls `onOpen` and
  then `setState` with the state saved in the layout, which can be days old (checked in app.js:
  `setViewState` calls `open(view)`, then `view.setState(state)`; a deferred view's `rerender`
  passes the saved state). `onOpen` followed the active note, then `setState` put the saved one
  back, and because the active note counted as already followed, the panel never moved.
  `OutlineView.setState` now clears `lastActive`, so the saved target is a fallback only
  (`src/outline/view.ts`). Test in `tests/outline-note.test.ts`. The four checks pass.

## Decided by the author (2026-11-03, SF 17)

- Only in writing mode, no command or mode of its own.
- On by default, setting **Typewriter scroll in writing mode** (`writingModeTypewriter`, bool,
  default on, read by the desk), in the Home note group beside "Open in writing mode".
- The line sits a third of the way down, fixed, not a setting.
- Desktop only: on a phone (`Platform.isMobile`) the extension does nothing; the setting's
  description says it is for desktop.
- Typing, Enter and the arrow keys bring the line back to its place. A click or a mouse or
  trackpad scroll does not; the next keystroke does.
- Live Preview and source mode. Reading view stays as it is.
- Leaving writing mode, or turning the setting off, removes the space and stops the recentering;
  the scroll position stays.

## Decisions (recommended, for the author to change at G0)

| # | Question | Decision |
|---|---|---|
| D1 | Version | **1.2.5**, a patch: one small feature and one fix, no new switch. |
| D2 | Improvement | **IMPROVEMENTS 42, typed feature ports.** The desk's writing-mode port is one of the shims it names (`core/writing-mode.ts:41`), and the typewriter reads the mode. A `FeaturePorts` map in core and `port<K>(id)`; `writingModeOf`, `dailyProgressOf`, the desk's pending read (`desk/gather.ts:15`) and the outline's publish-next read (`outline/view.ts:669`) move to it. Candidate 24's "create entry" part is not in this version. |
| D3 | How the scroll is made | **No dispatch of our own.** An `EditorState.transactionExtender` adds `EditorView.scrollIntoView(head, { y: "start", yMargin })` to a transaction that changes the document or moves the cursor from the keyboard (`userEvent` `input`, `delete`, `move`, `undo`, `redo`; never `select.pointer`). The margin is a third of the editor's height, measured by a small `ViewPlugin` in a `requestMeasure` and kept in a field the extender reads. Whether CodeMirror lets our effect win over Obsidian's own `scrollIntoView` is spike S0's first question. |
| D4 | The space above and below | CSS under the body class `escrita-typewriter`, set by the desk only while writing mode and the setting are on and not on a phone: `padding-block` on `.cm-content`, a third of the editor's height above and two thirds below (S0 picks between `vh` units and a CSS variable the measure plugin sets on the editor). Never text in the note. |
| D5 | Where the code lives | Pure: `src/core/typewriter.ts` (`recenters(tr-like input)`, `typewriterMargin(height)`), tested in `tests/typewriter.test.ts`. Obsidian-facing: `src/desk/typewriter.ts`, the extension built on the editor glue (`EditorSet`), registered through the desk's `ModuleContext` (the desk declares `editors: 1` in its slots). It reads the mode through `WritingModePort.onChange`, the setting through `plugin.settings`. |
| D6 | Other plugins | A zen or typewriter plugin running at the same time fights over the scroll. Not detected; the guide says to turn one of the two off. |

## Gates

- **G0** (before Wave 0): the author agrees to D1 to D6. **Passed** 2026-11-21: improvement 42
  chosen in conversation, the rest as recommended.
- **G1** (before Wave 1's UI task): a short board on the design canvas
  (https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6): the setting row in the Home note group,
  and a note in writing mode with the line a third of the way down, light and dark. Approved.
- **G2** (before release): the four checks, `npm run e2e` green, and a few paragraphs typed by
  hand in writing mode in the test vault.

## Waves

The usual rules: Sonnet for code, tests and docs; Opus for contracts, the board, the judge and
every architecture call. Worktrees are made in the main loop from the `1.2.5` branch, and each
task commits on its branch. Heavy checks run behind `flock`, vitest with `--maxWorkers=4`. One
Obsidian at a time.

**Wave 0, contracts, the board and the spike (one workflow).**

| Task | Model | Owns |
|---|---|---|
| C, contracts | Opus | `core/settings-schema.ts` (the row), `settings.ts` / `EscritaSettings` (the field), the strings in `desk/strings.ts` (en and pt-BR), `core/typewriter.ts` with signatures and doc comments (bodies `throw`), the `FeaturePorts` type and `port<K>` signature in core (D2). One commit. |
| B, the board | Opus | The design canvas: one board for SF 17, as in G1. |
| S0, the spike | Sonnet | `tests/e2e/spike/typewriter.spec.ts` (removed after): in writing mode in the harness, a throwaway extender as in D3. Does our `scrollIntoView` win over Obsidian's? Do `padding-block` and the scroll hold in Live Preview and source mode, at the first and last line? Does a click carry `select.pointer`? Does Obsidian's own "scroll past end" or readable line width change the numbers? Report with measurements. |

**Judge (Opus).** The contracts against this plan; the spike's answers turned into the final D3
and D4. Then the author: G1.

**Wave 1 (Sonnet, three tasks in parallel, after G1).**

| Task | Owns |
|---|---|
| T, typewriter core | `core/typewriter.ts` bodies, `tests/typewriter.test.ts` |
| E, the extension | `desk/typewriter.ts`, `desk/index.ts` (slots, registration), `desk/writing-mode.ts` (the body class), `desk/styles.css`, `desk/settings-ui.ts` (the row), a lifecycle test (loads, unloads, leaves no class or extension behind), and `tests/e2e/specs/typewriter.spec.ts` (the line at a third after typing at the end of a long note, Enter and arrows recenter, a click does not, the setting off and leaving the mode remove the space) |
| I, improvement 42 | `core/feature-registry.ts`, a new `core/feature-ports.ts`, `core/writing-mode.ts`, `core/daily-progress.ts`, `core/pending.ts`, `desk/gather.ts`, `outline/view.ts` (the publish-next read only), their tests. Behavior unchanged |

**Judge (Opus):** the diff against this plan, the four checks, `npm run e2e` once, no module
folder importing another, and the merge of the three branches into `1.2.5`.

**Wave 2, release (Sonnet, then an Opus review).**

- Guide, English and pt-BR: "Writing mode" gets the typewriter scroll; "Next to a zen plugin or a
  theme" no longer sends writers elsewhere for it and says to turn one of the two off if both
  scroll; the settings page gets the row.
- README: the feature line and the 1.2.5 changelog (the typewriter scroll, the outline fix).
- ARCHITECTURE: `desk/typewriter.ts`, `core/typewriter.ts`, `core/feature-ports.ts`. CONTEXT: the
  1.2.5 line. IMPROVEMENTS: 42 to Done. ROADMAP and SF 17: shipped; plan what's next.
- The test vault's plugin links checked after the build.

## Risks

- Obsidian scrolls the cursor into view on its own; if its effect wins (S0), D3 falls back to a
  scroll set in the measure phase after the update, which can flicker.
- Themes that pad the editor (Typewriter, Minimal) may add their own space (TEST-1.0 by-eye list).
- Mobile: the extension is off on phones, so the risk is only that the class never leaks there;
  the lifecycle test checks it. Phone testing is waived.

## Not in this plan

- Typewriter scroll outside writing mode, a configurable position, or a highlight of the current
  line or paragraph (a zen plugin's job).

## Results
