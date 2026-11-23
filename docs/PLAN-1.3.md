# Escrita 1.3, typewriter scroll: implementation plan

Planned and built as 1.2.5; shipped as 1.3.0 (the author's decision, 2026-11-23).

A small version. In writing mode the line being typed stays two thirds of the way down the editor
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
- The line sits two thirds of the way down, fixed, not a setting: two thirds of the screen show
  the text above it (the author, 2026-11-21, correcting "a third" after Wave 0).
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
| D1 | Version | **1.3.0** (planned as the patch 1.2.5): one small feature and one fix, no new switch. |
| D2 | Improvement | **IMPROVEMENTS 42, typed feature ports.** The desk's writing-mode port is one of the shims it names (`core/writing-mode.ts:41`), and the typewriter reads the mode. A `FeaturePorts` map in core and `port<K>(id)`; `writingModeOf`, `dailyProgressOf`, the desk's pending read (`desk/gather.ts:15`) and the outline's publish-next read (`outline/view.ts:696`) move to it. Candidate 24's "create entry" part is not in this version. |
| D3 | How the scroll is made | **No dispatch of our own** (final after S0). An `EditorState.transactionExtender` adds `EditorView.scrollIntoView(head, { y: "start", yMargin })` when `recenters` says yes. S0 measured that it wins over Obsidian's and CodeMirror's own scroll in Live Preview and source mode: the line sits at 0.333 of the height, no flicker (S0 ran at a third; the author moved the line to two thirds after Wave 0, the same mechanism with a larger margin). On an empty line it sits 24 px low, accepted. A later dispatch also reached 0.333 but flickered for a frame, so it is not used. **What recenters:** `input`, `delete`, `move`, `undo`, `redo` and their sub-events, when the document changed or the cursor moved; a plain `select` (arrows, Home, End, Page Up/Down, Ctrl+Home/End; the arrows send `select`, not `move`) when the cursor moved and nothing is selected; `select.undo`, `select.redo`. **Never:** no user event, `select.pointer` (a click), `move.drop`, `input.drop`, any other `select.*`, select-all or a Shift selection. A mouse scroll is not a transaction: the view stays until the next keystroke. **The margin** is `typewriterMargin` of the editor's `scrollDOM.clientHeight`, read by a small `ViewPlugin` in a `requestMeasure` (key `"tw"`) on start and on a change of geometry, viewport or focus, kept per view, never module-level. The extender reads a flag (writing mode on, not a phone) and, per editor, whether the setting takes its note (D7), cached per view and file. |
| D4 | The space above and below | **None added** (the author, 2026-11-21: "activate if it has enough text to warrant the scroll"). The scroll never goes above the top of the note, so a line higher than two thirds stays where it is: a short note never moves and there is no blank space above the title. Below the last line, Obsidian's own "scroll past end" already leaves half the height (381 px measured in S0), more than the third the line needs to reach two thirds, so no CSS and no body class. If Wave 1's e2e finds a case without that room, a `padding-bottom` of a third of `--escrita-tw-h` on `.cm-content` under `escrita-typewriter` is the fallback. Never text in the note. Leaving the mode or turning the setting off stops the recentering; the scroll position stays. |
| D5 | Where the code lives | Pure: `src/core/typewriter.ts` (`recenters(tr-like input)`, `typewriterMargin(height)`), tested in `tests/typewriter.test.ts`. Obsidian-facing: `src/desk/typewriter.ts`, the extension built on the editor glue (`EditorSet`), registered through the desk's `ModuleContext` (the desk declares `editors: 1` in its slots). It reads the mode through `WritingModePort.onChange`, the setting through `plugin.settings`. |
| D7 | Which notes | **A setting with three values**, `writingModeTypewriter`: "tracked" (the default), "all", "off" (the author, 2026-11-21: only for works like contos and books, never the home note). "Tracked" is `books.classify(file).tracked`: inside the track folders the writer already set for goals, so no new upkeep. One dropdown replaces the on/off toggle. Names: "Typewriter scroll in writing mode" / "Modo máquina de escrever"; values "Tracked notes", "Every note", "Off" / "Notas acompanhadas", "Todas as notas", "Desligado". |
| D6 | Other plugins | A zen or typewriter plugin running at the same time fights over the scroll. Not detected; the guide says to turn one of the two off. |

## Gates

- **G0** (before Wave 0): the author agrees to D1 to D6. **Passed** 2026-11-21: improvement 42
  chosen in conversation, the rest as recommended.
- **G1** (before Wave 1's UI task): a short board on the design canvas
  (https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6): the setting row (a dropdown) in the Home
  note group, and a note in writing mode with the line two thirds of the way down, light and
  dark. Approved. **Passed** 2026-11-21: board 48 (canvas version 52), with the dropdown, a short
  note where nothing moves, and the home-note caption.
- **After Wave 0** (2026-11-21), the author: the line at two thirds, not a third; no space above
  the title, the scroll starts once the text reaches two thirds; Shift selections and select-all
  never recenter (approved); pt-BR "Modo máquina de escrever"; only tracked notes by default, as a
  setting (D7).
- **G2** (before release): the four checks, `npm run e2e` green, and a few paragraphs typed by
  hand in writing mode in the test vault.

## Waves

The usual rules: Sonnet for code, tests and docs; Opus for contracts, the board, the judge and
every architecture call. Worktrees are made in the main loop from the branch named after the first plan, and each
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
| E, the extension | `desk/typewriter.ts`, `desk/index.ts` (slots, registration), `desk/writing-mode.ts` (only if the mode's flag needs it), `desk/settings-ui.ts` (the dropdown row), a lifecycle test (loads, unloads, leaves no extension behind), and `tests/e2e/specs/typewriter.spec.ts` on an 80-paragraph note, the line within 0.63 to 0.70 of the height: (a) after typing at the end, Live Preview and source; (b) after Enter, ArrowDown, PageDown, Ctrl+Home, Ctrl+End, Ctrl+Z; (c) a click leaves scrollTop alone, a mouse scroll stays and the next key recenters; (d) select-all does not jump; (e) in a short note, and on the first lines of a long one, scrollTop stays 0 (nothing scrolls before the text reaches two thirds); (h) the home note (untracked) with "tracked" never scrolls, with "all" it does; (f) after a resize; (g) setting off or leaving the mode: no recentering, scrollTop unchanged |
| I, improvement 42 | `core/feature-registry.ts`, a new `core/feature-ports.ts`, `core/writing-mode.ts`, `core/daily-progress.ts`, `core/pending.ts`, `desk/gather.ts`, `outline/view.ts` (the publish-next read at `:696` only), `implements DailyProgressHost` on `GoalsModule` and `implements PendingHost` on `SubmissionsModule`, `pendingOf` moved into `core/pending.ts`, their tests. Behavior unchanged |

**Judge (Opus):** the diff against this plan, the four checks, `npm run e2e` once, no module
folder importing another, and the merge of the three branches into `1.2.5`.

**Wave 2, release (Sonnet, then an Opus review).**

- Guide, English and pt-BR: "Writing mode" gets the typewriter scroll; "Next to a zen plugin or a
  theme" no longer sends writers elsewhere for it and says to turn one of the two off if both
  scroll; the settings page gets the row.
- README: the feature line and the 1.3 changelog (the typewriter scroll, the outline fix).
- ARCHITECTURE: `desk/typewriter.ts`, `core/typewriter.ts`, `core/feature-ports.ts`. CONTEXT: the
  1.3 line. IMPROVEMENTS: 42 to Done. ROADMAP and SF 17: shipped; plan what's next.
- The test vault's plugin links checked after the build.

## Risks

- On an empty line the cursor sits 24 px below its place (S0). Accepted.
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


### Wave 1 (2026-11-21)

- **T, typewriter core:** merged (`685131e`). `recenters` follows D3 with `selectionEmpty`
  (`select.pointer`, `move.drop` and `input.drop` checked first; a plain `select` needs the cursor
  moved and an empty selection; `select.undo`/`select.redo` need the cursor moved); event names
  match as `isUserEvent` does. `typewriterMargin` is 0 for 0, negative and non-finite heights.
  `tests/typewriter.test.ts`.
- **E, the extension:** merged (`67970a2`, the e2e fix `333dc05`). `src/desk/typewriter.ts`: an
  `EditorState.transactionExtender` plus a `ViewPlugin` that measures `scrollDOM.clientHeight`
  (key `"tw"`) into a per-instance `WeakMap`; the extender finds its view by
  `view.state === tr.startState` (right in splits and pop-outs, no focus tracking). Only a
  `MarkdownView`'s own editor on a `.md` file (embeds, popovers and canvas cards are left out),
  never on a phone; "tracked" reads `books.classify(file).tracked`, cached by path. One editor slot
  on the desk; the dropdown row after "Open in writing mode". Lifecycle test
  `tests/lifecycle-typewriter.test.ts`. **Deviation from D5:** the mode is read live
  (`isActive()`), not through `onChange`, so there is nothing to subscribe to or undo.
- **I, improvement 42:** merged (`0921828`, merge `0987f18`). `writingModeOf`, `dailyProgressOf`,
  the new `pendingOf` (in `core/pending.ts`) and the outline's publish-next read go through
  `port()`; `GoalsModule implements DailyProgressHost`, `SubmissionsModule implements
  PendingHost`. The helper names are kept, so no caller changed. Behavior unchanged.
- **Judge fixes** (`93e03c9`): the extension uses `TypewriterTransaction` directly; the tracked
  cache is also cleared when the desk loads (settings can change while it is off); four comments
  that still named `features.get` now name `port()`.
- **Checks on `1.2.5`:** typecheck, vitest (255 files, 5244 passed, 2 skipped), build,
  test:bundle (4), lint (zero warnings).
- **Typewriter e2e** (8 of 8, `tests/e2e/specs/typewriter.spec.ts`, band 0.63 to 0.70 unchanged):
  every "at two thirds" check measured 0.6667 of the scroller height: typing at the end (Live
  Preview and source), Enter, ArrowDown, PageDown, Ctrl+End, Ctrl+Z, the next key after a click
  and a mouse scroll, after resizes to 550 and 800 px, the setting back on, and an untracked note
  with "all". A click, a wheel scroll and select-all left scrollTop unchanged; a short note and
  the first lines of a long one stayed at 0; the setting off and leaving the mode left scrollTop
  exactly unchanged; an untracked note with "tracked" never moved. D4's padding fallback was not
  needed.
- **Full `npm run e2e`:** 261 passed, 12 failed, 7 skipped, 3 did not run. None comes from Wave 1:
  - 11 fail closing Obsidian with "Protocol error (Page.handleJavaScriptDialog): No dialog is
    showing" (a `beforeunload` dialog when a window with edited notes closes; collections 14,
    demo-findings 9, 3, 5 and 6, new-work 10, release-fixes 3, screenplay-editor 19, setup G2b 3
    and 4, unlinked 14). The same three tried on the build before the extension (`tw-core`)
    fail the same way. The typewriter spec works around it in its own `afterAll`.
  - 2 timing bars miss on this machine (screenplay editor 19 fails both ways), also on the build
    before the extension: screenplay
    editor 19, typing median 10.3 ms against 10 (10.3 on the baseline too); "Read the book" G0d,
    longest task 54 to 66 ms against no long task (45 to 61 ms on the baseline; 1.1 measured 23
    to 28).

### Wave 2 (2026-11-23)

- **G, the guide:** merged (`adee80b`, review fix `ebcf96f`, fast-forward). `tracking.md` (en and
  pt-BR): a "Typewriter scroll" paragraph in writing mode with the three values, "Next to a zen
  plugin or a theme" says Escrita has its own and to turn one of the two off if both scroll, and a
  row in the page's settings table; `features-and-settings.md`: a "Settings added in 1.3" section
  with the row and the outline fix. Strings match `src/desk/strings.ts` ("Typewriter scroll in
  writing mode" / "Modo máquina de escrever"; Tracked notes, Every note, Off / Notas acompanhadas,
  Todas as notas, Desligado). **Review fix:** both pages said the home note is never tracked; with
  no track folders every note is tracked (`isTracked` in `core/classify.ts`), the home note too, so
  the text now says a home note kept outside the track folders never scrolls.
- **R, repo docs:** merged (`e943c0f`, review fix `036d70d`, merge `5867a98`). README (the Tracking
  line and the 1.3 changelog), ARCHITECTURE ("Feature ports", "The typewriter scroll", pending
  through `pendingOf`), CONTEXT (1.3 line, feature ports), IMPROVEMENTS (42 to Done), ROADMAP
  (1.3 shipped; next stays universe phase 2) and SF 17 shipped. **Review fixes:** the same home
  note claim in the README changelog; ARCHITECTURE said `typewriterMargin` is the height minus two
  thirds (it is two thirds of the height, rounded); a "see below" that points above.
- **H, the harness:** merged (`0dcb89a`, merge `1f0811a`). `Obsidian.stop()` accepts the
  `beforeunload` dialog on every context and page before `Browser.close`; the typewriter spec's own
  workaround is gone. No timing bar changed.
- **Checks on `1.2.5`:** typecheck, vitest (255 files, 5244 passed, 2 skipped), build,
  test:bundle (4), lint (zero warnings).
- **Full `npm run e2e`:** 271 passed, 2 failed, 7 skipped, 3 did not run (11.8 min). The 11
  "No dialog is showing" failures of Wave 1 are gone. The two left are the timing bars that already
  failed on the pre-1.3 build in Wave 1:
  - `screenplay-editor.spec.ts:560` 19, a 120-page script: `expect(received).toBeLessThanOrEqual(expected)`,
    expected `<= 10`, received `10.5` (typing to the DOM median; 10.3 on the baseline).
  - `read-book.spec.ts:356` G0d: `expect(received).toBe(expected)`, expected `true`, received
    `false` at `:380` (long tasks over 50 ms: 2, 1, 0; longest task 62, 59.5, 47.9 ms; first text
    median 31.8 ms against 500). Baseline: longest 45 to 61 ms.
- **Test vault:** `~/Projects/escrita-test/` was not found on this machine, so its plugin links
  could not be checked.
