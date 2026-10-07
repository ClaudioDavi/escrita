# Mobile code audit for 1.0 (task 1.6)

Done 2026-10-07 on branch `1.0` at `4cf588c`. Part of Q8 in `PLAN-1.0.md`: the code audit
that goes with the emulated-phone pass in G4. The author has no phone, so nothing here was
run on a device; it is a read of `src/`, of the built `main.js` and of the CSS.

How to read it: "Phone gets" says what the code does when `Platform.isMobile` or
`Platform.isPhone` is true (Obsidian adds `is-mobile` and `is-phone` to `<body>`, and the
CSS keys off the same classes). "G4" means: check it in the emulated phone, which uses a
mouse, so touch-only behaviour (long press, soft keyboard) stays unverified.

## Result in short

| Check | Result |
|---|---|
| Node or Electron APIs in `src/` | None. No `fs`, `path`, `os`, `electron`, `process`, `Buffer`, `require`, `getBasePath` or `FileSystemAdapter`. `main.js` requires only `obsidian`, `@codemirror/state` and `@codemirror/view`. |
| Regex lookbehind | **5 uses in 4 files, all in `main.js` as literals.** Safari before 16.4 fails to parse the whole file. Finding F1, fixed by the Wave 1 judge (none left; `tests/no-lookbehind.test.ts` guards `src/` and `main.js`). |
| Other syntax newer than iOS 15/16 | Only CSS: `color-mix()` (7), `:has()` (1), `@container` (1). All degrade without breaking layout. Finding F5. |
| JS runtime APIs | `TextEncoder`, `Blob`, `URL.createObjectURL`, `IntersectionObserver` and `ResizeObserver` (both guarded by `typeof`). `\p{…}` with the `u` flag (iOS 11.3+). No `Intl.Segmenter`, `structuredClone`, `.at()`, `replaceAll`, `findLast`. |
| Hover-only controls | None left. The one hidden control (the outline "⋯") is shown always on mobile. The only hover-only help text is the export preview tip, and the click it hints at works on touch. |
| Touch targets under 32 px | None among interactive elements in the CSS. One status bar button is small, but Obsidian has no status bar on mobile. Finding F4. |
| Menus that need a right click | One: the universe panel's entry rows. Finding F2. |
| CSS changed | None. There was nothing to fix in the module `styles.css` files. |

## Findings for the judge

Nothing below is fixed here, because every fix is outside the files this task owns.

- **F1. Regex lookbehind breaks `main.js` on Safari before 16.4. High if any supported iOS is
  older.** **Fixed** by the Wave 1 judge: Q8 already rules lookbehind out, so the five sites
  were rewritten as below and `tests/no-lookbehind.test.ts` fails on any new one. esbuild's `target: "es2018"` (`esbuild.config.mjs:35`) treats lookbehind as
  supported (it is ES2018) and leaves the literals alone, so `main.js` has them verbatim
  (`grep -c "(?<" main.js` gives 5). A regex literal the engine cannot parse is an early
  `SyntaxError`: the plugin would not load at all, not just lose a feature. The sites:
  - `src/core/markers.ts:113`, `:114` and `:133` (table row cell counting, `(?<!\\)\|`).
  - `src/universe/unlinked-link.ts:83` (escaping `|` in a table cell).
  - `src/universe/entries.ts:112` (`.replace(/(?<!\.md)$/i, ".md")`).

  Each has a plain rewrite with the same result: `replace(/(\\?)\|/g, (m, b) => (b ? m : "\\|"))`
  for the pipe escapes, a small split-on-unescaped-pipe helper for `markers.ts`, and
  `/\.md$/i.test(p) ? p : p + ".md"` for `entries.ts`. The owners are `core/markers.ts`
  (a core file, so a deliberate change) and the two universe files. Suggested guard: a test
  like `tests/no-network.test.ts` that fails on `(?<` in `src/` and `main.js`. The lowest iOS
  that Obsidian 1.7.2 supports is not confirmed here; if it is 16.4 or newer, F1 is only a
  cleanup, so the author should settle which it is.
- **F2. The universe panel's entry menu is right-click only.**
  `src/universe/view-entries.ts:106` opens "open, open to the side, insert link, reveal"
  from `contextmenu` alone, and the row has no "⋯" button (the outline has one, in
  `outline/view.ts`'s `moreButton`). A tap still opens the note, so the loss on a phone is
  insert link, reveal and open to the side. iOS WebKit does not fire `contextmenu` on a long
  press; Android may. G4's mouse cannot show this. Fix: reuse the outline's "⋯" pattern
  (a TS and CSS change in the universe module).
- **F3. Information that lives only in a tooltip.** A phone never shows `setTooltip` text.
  The outline's stage dot says its stage only in a tooltip (`outline/view.ts:780`), as do the
  placeholder badge (`:773`), the POV stripe label (`:899`) and the written-beat check (`:927`);
  the universe panel's count button (`view-entries.ts:122`) and a thread's "go to" title
  (`view-threads.ts:81`) are the same. The dot's colour and the counts still show. This is
  a design question (is a stage word needed on a phone?), not a bug.
- **F4. The sprint "Stop" button in the status bar is small** (`goals/styles.css`,
  `.escrita-status .escrita-status-stop`, `height: auto`, about 20 px). Obsidian mobile does not show
  the status bar, so nobody can reach it; on a tablet in desktop layout it may show. No fix
  needed. It does mean **a phone has no today-count in the status bar**: the count lives in
  the progress modal, the outline header and the home note's block.
- **F5. Modern CSS with a fallback, not a failure.** `color-mix()` (Safari 16.2) is in
  `desk/styles.css:87,93`, `universe/migrate.css:51`, `universe/name-marks.css:8` and
  `universe/view.css:174`. Where unsupported, the declaration is dropped, so the name-mark
  underline falls back to the default text colour and the migrate and selected-row fills
  disappear. `:has()` (Safari 15.4) is in `placeholders/styles.css:65` (the explorer dot's
  padding). `@container` (Safari 16.0) is in `snapshots/styles.css:289` (a narrow layout).
  If F1 turns out to be moot (iOS 16.4+), all of these are fine.
- **F6. Touch gestures with no emulated check.** The POV chip long press
  (`outline/header.ts:213`, 500 ms-ish `LONG_PRESS_MS`) uses `touchstart`, which the
  emulation does not send from a mouse. Dragging chapters is switched off on mobile
  (`outline/view.ts:825`); the "⋯" menu does the same job.
- **F7. Two surfaces assume a keyboard that a phone lacks, and handle it.** Moving a
  paragraph or scene and the lens' next and previous are commands only (no default hotkeys,
  rule 8). On a phone they run from the command palette or a toolbar the writer sets up in
  Obsidian. Nothing in Escrita puts them on screen. Worth one line in the guide (Wave 3).
- **F8. Export preview hover tip.** `export/writers/preview.ts:194` shows "where this line
  is" on `mouseover`. A tap runs the click handler (opens the line), so nothing is lost;
  only the tip is.

## Views

Nine view types are registered (`ctx.view`), all through the module context. All panels
live in Obsidian's drawers on a phone; a drawer shows one pane at a time, so the layout
rules (side-by-side) the plan describes for 2.3 do not apply there.

| View | Type id | Phone gets |
|---|---|---|
| Outline | `escrita-outline` (`outline/view.ts:32`) | The full outline. Summaries always show (`styles.css:243`; on desktop an empty one hides). Chapter drag is off, the number opens the chapter (`:824-825`). The keyboard footer is replaced by a one line touch hint (`:510`, `:545`). Row "⋯" always visible. Chips are 36 px (`:557`). The filter bar is compact (`:694`). Menus open at the button (`showAtPosition`, `:954`). G4: check the chips fit on a 390 px screen. |
| Outline as a board | a Canvas file, not a view | `<book> board.canvas` is written and opened in Obsidian's Canvas, which has its own mobile support. Escrita draws nothing. |
| Read the book | `escrita-reader` (`outline/reader-view.ts:13`) | Renders every chapter as Markdown in one scroll; the outline button has a tooltip only (F3). `IntersectionObserver` is feature-checked (`:252`). Large books render a lot of DOM: the timing is unmeasured (CONTEXT.md, weak spots). G4: scroll a long book. |
| Revision lens panel | `escrita-lens` (`lens/view.ts:15`) | Built for it: 40 px targets (`panel.css:20`), 44 px rows (`:59`), detail and rate columns hidden (`:21`), safe-area padding (`:145`), stepping shows a notice with the position (`view.ts:320`) and collapses the drawer so the text is visible (`ui.ts:250`). |
| Placeholders | `escrita-placeholders` (`placeholders/view.ts:8`) | Rows 32 px, resolve button 32 px. The empty state tells how to add one without the hotkey text (`:180`). |
| Darlings | `escrita-darlings` (`darlings/view.ts:6`) | Buttons 32 px (`styles.css:109`). Delete asks first (`ConfirmModal`). |
| Snapshots | `escrita-snapshots` (`snapshots/view.ts:7`) | Rows and actions 32 px; one icon button per action (view, compare, restore, rename, delete). A narrow layout under `@container` (F5). |
| Snapshot compare | `escrita-snapshot-compare` (`snapshots/compare-view.ts:8`) | A word diff in a tab. Reading only. |
| Universe panel | `escrita-universe` (`universe/view.ts:24`) | Tabs, search, groups, entries and works at 44 px (`view.css:357`); icon buttons 32 px. Entry menu: F2. Unlinked mentions with a Link button (32 px). |
| Threads panel | `escrita-threads` (`universe/view.ts:25`) | Same file and CSS as the universe panel. Check and close buttons 32 px. |

Not views, but drawn in the page:

| Surface | Phone gets |
|---|---|
| Home block (`escrita-works` code block, `desk/render.ts`) | Rows and counts 44 px (`desk/styles.css:168`); a fact that does not fit drops to its own line (`:157`); the dotted leader hides. Presses are stopped from reaching the editor (`render.ts`). |
| "Appears in" section (a CM widget in Live Preview, a post processor in Reading) | 44 px rows, heads and counts (`appears-in.css:162`). The widget is told it is on mobile (`appears-in-widget.ts:81`). The "first and last seen" line is 24 px but is text, not a control. G4 on Reading view re-renders (CONTEXT.md). |
| Name marks (CM decoration) | A longer debounce on mobile (`name-marks.ts:117`). |
| Lens marks (CM decorations) | The current match gets a stronger outline on mobile (`editor.css:28`). |
| Ghost beats and placeholder labels | CM widgets, no controls. |
| File explorer dot and counts | Text and a 6 px dot, no controls. |
| Status bar (goals) | Does not exist on mobile (`module-context.ts:32` detaches the element). F4. |
| Ribbon icons (goals, outline) | Obsidian puts mobile ribbon actions behind its own menu. |
| Settings tab | Built from Obsidian's `Setting` rows. Escrita's own parts: the stage rows stack (`styles.css:97`), colour swatches and the clear button are larger (`:109`), the feature switches are 52x44 (`:184`), the lens settings stack (`panel.css:153`). G4: the Features page has 19 rows; scroll it. |

## Modals

Obsidian sizes a modal to the phone's width on its own. Escrita sets a width only as
`min(Npx, 100%)`, so none overflows.

| Modal | Where | Phone gets |
|---|---|---|
| Progress (goals) | `goals/progress-modal.ts:45` | `width: min(680px, 100%)`; a narrow layout under 520 px (`styles.css:428`). Chart bars have `<title>` text, which a phone never shows. |
| Export | `export/modal.ts:85` | `min(540px, 100%)`; a narrow layout under 600 px (`styles.css:429`); the preview "paper" is a scrolling column. Rows 32 px. |
| Export, chapters / where / exists | `export/modal.ts:593`, `:660`, `:686` | Plain Obsidian modals with buttons. |
| Collection export | `export/collection-menu.ts:52` | Plain modal; Enter in the name field creates. |
| Publish check | `publish/modal.ts:27` | `min(560px, 100%)`. |
| Record a submission | `submissions/modal.ts:25` | `min(460px, 100%)`. |
| New universe entry | `universe/create.ts:72` | Narrow layout under 600 px (`universe/styles.css:40`). |
| Close a thread | `universe/create.ts:385` | Plain modal. |
| Move entries to the universe (preview, progress) | `universe/migrate.ts:123`, `:215` | Narrow layout under 600 px (`migrate.css:93`). |
| Create a book | `outline/modals.ts:68` | Plain modal. |
| Confirm (outline, darlings), create the home note | `outline/modals.ts:11`, `darlings/view.ts:178`, `desk/home-note.ts:11` | Plain modals with two buttons. |
| Snapshot name, snapshot path picker | `snapshots/modals.ts:16`, `:59` | A text field and a `SuggestModal`; the keyboard covers the list on a small phone (Obsidian's own behaviour). |
| Insert from a template | `editor/template-insert.ts:14` | A `FuzzySuggestModal`. |

## Menus

Every menu is an Obsidian `Menu` (native sheet on a phone) except the POV colour popup.

| Menu | Opened from | Phone gets |
|---|---|---|
| Chapter menu (open, open in a new tab, new chapter after, add beat, make a beat, move up and down, rename) | outline "⋯" button; also `contextmenu` on the row (`outline/view.ts:861`, `:1422`) | Works by tap on "⋯". |
| Beat menu (go to, add after, to chapter, remove) | beat "⋯"; also `contextmenu` (`:929`, `:1462`) | Works by tap on "⋯". |
| POV chip colour popup | long press (`outline/header.ts:213`) or right click | A custom popup, not a `Menu`; swatches 32 px. F6. |
| Universe picker | tap on the panel head (`universe/view.ts:328`) | Works. |
| Entry menu | `contextmenu` only (`view-entries.ts:106`, `:141`) | F2. |
| Editor menu: move to darlings | `darlings/index.ts:55` | Obsidian's long press on the selection menu. |
| Editor menu: lens "add to list", "ignore" | `lens/ui.ts:106`, `:299` | Same. |
| Editor menu: create entry, plant or close a thread | `universe/create.ts:474`, `universe/index.ts:631`, `threads-feature.ts:56` | Same. |
| File menu: export, publish, unpublish, record submission, take a snapshot, move entries | `export/index.ts:95`, `publish/index.ts:74`, `submissions/index.ts:66`, `snapshots/index.ts:133`, `universe/index.ts:632` | Obsidian's file menu. |
| Collection menu | `export/collection-menu.ts:32` | In the file menu. |

## Commands

Commands show in the mobile palette (and can be put on the mobile toolbar by the writer).
There are no default hotkeys. A phone gets all of them; the ones below are editor commands
and need a Markdown editor to be active.

Goals: open progress, start and stop a sprint. Outline: open, open as a board, read the
book, create a book, add a beat, renumber. Placeholders: insert, next, previous, open.
Darlings: move selection, open. Editor: insert scene break, toggle dialogue focus, move
paragraph or scene up and down, insert from a template, toggle spellcheck (the four moves
use `editorCheckCallback`, source mode only, `editor/features.ts`). Lens: toggle, next,
previous, create the word lists note. Snapshots: take, open, compare with last, browse
deleted. Publish: publish, unpublish, publish next chapter. Export: export, export again.
Submissions: record. Desk: open the home note. Universe: open the panel, create an entry,
move this book's entries, show open threads, plant a thread, close a thread.

## Editor keys

`editor/features.ts:61` binds Enter and Backspace (dialogue flow, scene breaks) and an input
handler (typography). A soft keyboard sends Enter and Backspace as the same keys, so these
work; the input handler sees composed text, which the 0.8 typing checks covered on desktop
only. G4 cannot test a soft keyboard.

## Platform checks in the code

`Platform.isMobile`/`isPhone` is read in: `outline/view.ts` (6 places), `lens/view.ts:320`,
`lens/ui.ts:250,256`, `placeholders/view.ts:180`, `universe/appears-in-widget.ts:81`,
`universe/name-marks.ts:117`. The lens module also reads the body class directly so its
`index.ts` stays loadable in tests (`lens/index.ts:30`). That is every one; the CSS adds
`body.is-mobile` and `body.is-phone` rules in 8 files.

## Hover and touch targets: what was checked

- All 41 `:hover` rules in the CSS only change colour or background. None reveals or
  enables something that is otherwise missing.
- The single `opacity: 0` rule that hides a control is `outline/styles.css:155`
  (`body:not(.is-mobile) .escrita-outline-more`); it also shows on `:focus-within` and
  `:focus-visible`. On mobile and tablet the "⋯" is always visible. A touch laptop in
  desktop mode gets the focus path only; Obsidian reports that as not mobile.
- `visibility: hidden` at `outline/styles.css:313` hides a keyboard hint while typing.
- `pointer-events: none` is on the export hover tip and the outline fields' empty-placeholder text only (neither is a control).
- Every `width`/`height` under 32 px in the CSS is a dot, bar, icon or track, or sits inside
  a 32 px button (the switch track is 40x22 inside a 48x32 button, 52x44 on mobile). The
  only exception is F4.
- Interactive elements with no size of their own take Obsidian's button height, which is at
  least 32 px (larger on mobile).

## `main.js` size and loading time, for G4

Built with `npm run build` on this branch:

| File | Size |
|---|---|
| `main.js` | 1,311,159 bytes (1.25 MiB), no source map in the production build |
| `main.js`, gzipped | 334,743 bytes (what a download costs; the app reads it from disk) |
| `styles.css` | 106,340 bytes (16,915 gzipped) |

What loads it: Obsidian reads `main.js` from disk, compiles it and runs its top level at
startup, then calls `onload`. Compile and top-level evaluation were measured on this
machine (Node 22, no Obsidian), with `require` stubbed:

- compile: about 24 ms (V8 parses function bodies lazily, so this is the cheap part)
- top-level evaluation: about 2 ms

A phone is commonly 4 to 8 times slower, so expect 100 to 200 ms for these two. The cost
that matters is what `onload` does (building the vault index, measuring files), not the
file. The plan's risk ("1.2 MB parsed at startup") looks small by this measure; the
mitigation (load the DOCX and EPUB writers on first export) would save little parse time
and cost an async import. The writers are 26 KB of source together, so most of the 1.3 MB is
not Escrita's own code (jsdiff is the only bundled dependency; the rest is the plan's
features). No decision is needed unless G4 shows a slow start.

Measure it in G4 on the author's vault, in order of effort:

1. **Bundle only (repeatable).** The script below prints compile and top-level evaluation
   times; run it after a build: `node measure-load.cjs main.js`.
2. **Whole plugin, emulated phone.** Open the developer console (Ctrl+Shift+I) with
   `app.emulateMobile(true)` on and CPU throttling set to 4x in the Performance tab. Run:
   `const t=performance.now(); await app.plugins.disablePlugin("escrita"); const m=performance.now(); await app.plugins.enablePlugin("escrita"); console.log("enable ms", performance.now()-m)`.
   The enable time is compile, top-level evaluation and `onload`, including the modules
   the switches turn on. Run it three times and take the median; the first run is cold.
3. **Where the time goes.** Record the same enable in the Performance tab and look for
   `onload` and the first index build. `tests/perf` and `npm run bench` already time the
   index and the measurer on a large synthetic vault.

```js
// measure-load.cjs: compile and top-level evaluation of a built main.js
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync(process.argv[2], "utf8");
const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
const stub = () => new Proxy(function () {}, {
  get: (t, k) => (k === "prototype" ? t.prototype : k === Symbol.toPrimitive ? () => "" : stub()),
  construct: () => stub(), apply: () => stub(),
});
const compile = [], run = [];
for (let i = 0; i < 7; i++) {
  const code = `(function (exports, require, module) {${src}\n})//${i}`; // unique source defeats V8's compile cache
  let t = process.hrtime.bigint();
  const fn = new vm.Script(code, { filename: "main.js" }).runInThisContext();
  compile.push(Number(process.hrtime.bigint() - t) / 1e6);
  const m = { exports: {} };
  t = process.hrtime.bigint();
  fn(m.exports, () => stub(), m);
  run.push(Number(process.hrtime.bigint() - t) / 1e6);
}
console.log("compile ms:", med(compile).toFixed(1), " top-level eval ms:", med(run).toFixed(1));
```

## Checklist for G4 (emulated phone)

1. `app.emulateMobile(true)`, vault at `~/projects/website/escrita/`, window about 390 px wide.
2. Open each view in the table above from the command palette; confirm no horizontal page
   scroll and every control is reachable by a tap.
3. Open each modal; confirm it fits and its buttons are not cut off. Export with the preview
   is the widest.
4. Outline: tap "⋯" on a chapter and a beat; check the chips row; no drag handle.
5. Lens: step through a rule; the drawer closes and a notice shows the position.
6. Universe panel: tap an entry (opens), then look for the menu (F2).
7. Settings, Escrita: scroll the Features page and a long section (the lens).
8. Measure load time (above).
9. Confirm `grep -c "(?<" main.js` is 0 once F1 is fixed.
