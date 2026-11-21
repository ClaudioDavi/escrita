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
| D2 | Improvement | **IMPROVEMENTS 42, typed feature ports.** The desk's writing-mode port is one of the shims it names (`core/writing-mode.ts:41`), and the typewriter reads the mode. A `FeaturePorts` map in core and `port<K>(id)`; `writingModeOf`, `dailyProgressOf`, the desk's pending read (`desk/gather.ts:15`) and the outline's publish-next read (`outline/view.ts:696`) move to it. Candidate 24's "create entry" part is not in this version. |
| D3 | How the scroll is made | **No dispatch of our own** (final after S0). An `EditorState.transactionExtender` adds `EditorView.scrollIntoView(head, { y: "start", yMargin })` when `recenters` says yes. S0 measured that it wins over Obsidian's and CodeMirror's own scroll in Live Preview and source mode: the line sits at 0.333 of the height, no flicker. On an empty line it sits 24 px low (0.365), accepted. A later dispatch also reached 0.333 but flickered for a frame, so it is not used. **What recenters:** `input`, `delete`, `move`, `undo`, `redo` and their sub-events, when the document changed or the cursor moved; a plain `select` (arrows, Home, End, Page Up/Down, Ctrl+Home/End; the arrows send `select`, not `move`) when the cursor moved and nothing is selected; `select.undo`, `select.redo`. **Never:** no user event, `select.pointer` (a click), `move.drop`, `input.drop`, any other `select.*`, select-all or a Shift selection. A mouse scroll is not a transaction: the view stays until the next keystroke. **The margin** is `typewriterMargin` of the editor's `scrollDOM.clientHeight`, read by a small `ViewPlugin` in a `requestMeasure` (key `"tw"`) on start and on a change of geometry, viewport or focus, kept per view, never module-level. The extender reads a flag (writing mode, the setting, not a phone), not the body class. |
| D4 | The space above and below | CSS under the body class `escrita-typewriter`, set by the desk only while writing mode and the setting are on and not on a phone. The measure plugin sets `--escrita-tw-h` (the scroller's height in px) on each `.cm-editor`; not `vh`, which S0 measured 12 px off because the scroller is shorter than the window. A third of it above, two thirds below, in a Markdown leaf's note editor only (never embeds, popovers or Canvas cards). **Above:** `padding-top` on `.cm-sizer`, so the inline title and properties sit just above the first line; if that fails in Wave 1's e2e, `.cm-content` and accept the gap. **Below:** `padding-bottom` on `.cm-content` with `!important`, over Obsidian's own 50% "scroll past end" (381 px measured). Readable line length changes nothing (measured). Never text in the note. Leaving the mode or turning the setting off removes the class; the scroll position stays. |
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
| T, typewriter core | `core/typewriter.ts` bodies, with `selectionEmpty` added to `TypewriterTransaction` (the judge's change), and `tests/typewriter.test.ts`: true for `select` with the cursor moved and nothing selected, `input.type` with the document changed, `select.undo`; false for `select.pointer`, `move.drop`, `input.drop`, `select` with a selection, no event, inactive; `typewriterMargin` at 0, NaN, negative, and rounding |
| E, the extension | `desk/typewriter.ts`, `desk/index.ts` (slots, registration), `desk/writing-mode.ts` (the body class), `desk/styles.css`, `desk/settings-ui.ts` (the row), a lifecycle test (loads, unloads, leaves no class or extension behind), and `tests/e2e/specs/typewriter.spec.ts` on an 80-paragraph note, the line within 0.30 to 0.37 of the height: (a) after typing at the end, Live Preview and source; (b) after Enter, ArrowDown, PageDown, Ctrl+Home, Ctrl+End, Ctrl+Z; (c) a click leaves scrollTop alone, a mouse scroll stays and the next key recenters; (d) select-all does not jump; (e) on the first line the inline title is inside the scroller; (f) after a resize; (g) setting off or leaving the mode: no class, Obsidian's padding back, scrollTop unchanged |
| I, improvement 42 | `core/feature-registry.ts`, a new `core/feature-ports.ts`, `core/writing-mode.ts`, `core/daily-progress.ts`, `core/pending.ts`, `desk/gather.ts`, `outline/view.ts` (the publish-next read at `:696` only), `implements DailyProgressHost` on `GoalsModule` and `implements PendingHost` on `SubmissionsModule`, `pendingOf` moved into `core/pending.ts`, their tests. Behavior unchanged |

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

- On an empty line the cursor sits 24 px below the third (S0). Accepted.
- A native selection change that arrives more than 50 ms after the user's action is sent as a
  plain `select` (CodeMirror view:4081-4088) and can recenter.
- Not tested in S0: IME composition, splits and pop-out windows. A split uses the focused view's
  height.
- Themes that pad `.cm-sizer` or `.cm-content` (Typewriter, Minimal) may add their own space
  (TEST-1.0 by-eye list).
- Mobile: the extension is off on phones, so the risk is only that the class never leaks there;
  the lifecycle test checks it. Phone testing is waived.

## Not in this plan

- Typewriter scroll outside writing mode, a configurable position, or a highlight of the current
  line or paragraph (a zen plugin's job).

## Results

### Wave 0 (2026-11-21)

- **C, contracts:** merged into `1.2.5` (`46a2bef`). The setting row (default on), its field and
  the 0.9 settings fixture; the strings (en "Typewriter scroll in writing mode", pt-BR "Rolagem de
  máquina de escrever no modo escrita"); `core/typewriter.ts` signatures; `core/feature-ports.ts`
  (`FeaturePorts`, `port()` as a free function over `{ get }`); `PendingHost` in `core/pending.ts`.
  Setup leaves the setting alone (the default is already on). Typecheck, vitest (5227) and lint
  pass.
- **B, the board:** board 48 on the design canvas, "Typewriter scroll in writing mode (SF 17)".
  Its setting description is a placeholder; the repo strings win.
- **S0, the spike:** on `tw-spike` (`c197609`, never merged). Answers in D3 and D4 above. The arrow
  keys send `select`, not `move`; `vh` is off by the window chrome; Obsidian pads 50% below the
  last line itself; cost is noise (about 0.1 ms a key).
- **Judge (Opus):** all three accepted. D3 and D4 rewritten from the spike; task T gets
  `selectionEmpty` so select-all and Shift selections never recenter.

