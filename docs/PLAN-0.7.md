# Escrita 0.7, "characters across works": implementation plan

This is the implementation plan for Escrita 0.7, generated 2026-10-03. It breaks
the release into waves of tasks that agents can run in parallel, with strict file
ownership per wave. The specs win on any disagreement: `docs/ROADMAP-universe.md`
"Modes" (the `universe: false` rule), U 1.1, U 1.2 and U 1.4; `docs/ROADMAP-novel.md`
N 1 and N 2; `docs/ROADMAP-short-fiction.md` §10 ("Features you can turn off"); and
`docs/IMPROVEMENTS.md`, candidate 6 (modules that load and unload at runtime). If this
plan and a spec disagree, fix this plan. Where this plan narrows or extends a spec, the
change is listed in "Deviations from the specs" below, and the release writes each one
back into its spec (task 5.3).

File:line references point at the working tree on 2026-10-03 (the 0.6.0 commit,
`2f05ac5`; `git diff 2f05ac5 -- src tests` is empty, and the only uncommitted edits are
the `universe: false` lines in ROADMAP.md, ROADMAP-universe.md and GUIDE-universe.md).

0.7 serves two stages of a work's life (ARCHITECTURE.md, "Workflow"). The universe
features and the outline serve **writing and revision** of works that share people and
places: "Appears in" tells the writer where a character has been, names stop being
flagged, and the outline shows whose chapter it is and how long it should be. The
feature switches serve **every stage** by removing what a writer doesn't use. The
upkeep asked of the writer is small and optional: a `pov` property per chapter, a
`chapterTarget` on a book note, `universe: false` on a note to keep it out, and three
optional per-entry properties (`caseSensitive`, `ignore`, `firstName`). Everything else
reads what the writer already wrote.

## Open questions, with recommended answers

The author answers these in gate G2 (see "Gates"). Each has a recommended answer;
agents build to the recommendation unless the author says otherwise.

**Modules that load and unload (IMPROVEMENTS 6)**

| # | Question | Recommendation |
|---|---|---|
| Q1 | Candidate 6 says each module becomes a `Component` and "`removeChild` undoes all of it". Is that true? | **Only in part.** A `Component` can `registerEvent`, `registerDomEvent`, `registerInterval` and `register(cb)` (obsidian.d.ts:1835-1913). `registerView` (:4974), `registerEditorExtension` (:5019), `registerMarkdownCodeBlockProcessor` (:5001), `addCommand`, `addRibbonIcon` and `addStatusBarItem` exist only on `Plugin` and have no undo, except `removeCommand` (:4962). A ribbon icon has no public undo at all (G0f): `el.remove()` and `el.toggle(false)` don't last, so a feature that is off at startup never adds its icon, and one turned off at runtime keeps it until the next restart, its click showing a notice that the feature is off. So each module gets a `ModuleContext` (task 1.1) that is the one place touching those Plugin-only calls. It records a disposer for each and runs them on unload. Events, DOM events, intervals and callbacks go on the module's own `Component`. |
| Q2 | Commands: `removeCommand` (since Obsidian 1.7.2) or hide them with `checkCallback`? | **`removeCommand`, and raise `minAppVersion` from 1.6.6 to 1.7.2** (manifest.json:5). SF 10 says an off feature has "no commands", and `checkCallback` leaves the command in the hotkeys list. Gate G0a checks the id form `removeCommand` expects (the raw id or `escrita:<id>`) in a real vault. G0a passed (the raw id; see G0), so no `checkCallback` fallback is needed. Feature-detecting both paths is rejected (see "Issues not applied"). |
| Q3 | Views can't be unregistered (no `unregisterView` in obsidian.d.ts). | **A view slot, declared up front.** Each module declares its slots in a `slots` field read at construction (view types, code block languages, whether it has a Reading-view post-processor, how many editor slots), because a module that is off at startup never runs its load and so could never name its types (0.1). The context registers each declared view type once for the plugin's life, at plugin load, whether the feature is on or not; `ctx.view(type, create)` only binds the creator, and throws for a type the module didn't declare. The factory builds the real view when the feature is on and an empty placeholder view when it is off (a restored leaf from the saved layout can arrive before the registry runs). Switching a feature off detaches its leaves (`getLeavesOfType`, as universe/index.ts:373 does). At layout ready the registry detaches leaves of features that are off. ARCHITECTURE's "don't detach leaves in `onunload`" (ARCHITECTURE.md:95-96) is about the plugin unloading; a switch the writer flips is different, and the conventions say so (5.3). |
| Q4 | Editor extensions can't be removed either. | **An extension slot**: one mutable array per slot, registered once at plugin load. `ctx.editor(initial?)` returns `{ set(exts) }`, because three modules refill their arrays after load, not only push (outline/index.ts:88-91 empties and refills on `settingsChanged`; editor/index.ts:150-155 splices the spellcheck array on a setting or the toggle command; placeholders/index.ts:95 pushes). The registry empties every slot of a feature on unload and calls `workspace.updateOptions()` once per apply, not once per feature (it is "fairly expensive", obsidian.d.ts:8039); a module that calls `set` mid-session calls `updateOptions` itself, as it does today. The slot replaces the three copies of the trick (editor/index.ts:73, outline/index.ts:78, placeholders/index.ts:96). |
| Q5 | The desk's `escrita-works` code block processor (desk/index.ts:30), and the Reading-view post-processor "Appears in" needs (Q34). | **A code block slot and a post-processor slot**, each registered once in `init()` from the module's declared `slots`. With the desk off the code block slot draws the block's source as plain `pre > code`, the way Obsidian shows an unknown language; the post-processor slot does nothing while its feature is off. Unloading the desk unloads the live `DeskBlock`s it tracks (desk/index.ts:19). A processor only runs when a section renders, so on a desk toggle the desk re-renders open Markdown leaves (`previewMode.rerender(true)`, obsidian.d.ts:4088, and a Live Preview refresh); otherwise turning it off leaves empty containers and turning it on leaves plain code until the next render. `MarkdownPreviewRenderer.unregisterPostProcessor` (obsidian.d.ts:4047) is not used (untested, and rendered blocks stay until re-rendered). |
| Q6 | Are module objects rebuilt on each load? | **No. Each module is constructed once at plugin load; the registry calls its `Component.load()` and `unload()` itself**, in `FEATURE_IDS` order and in reverse. Modules are not children of the plugin: `Component.unload` pops children in reverse insertion order, which stops matching `FEATURE_IDS` after the first toggle, and it runs them before `plugin.onunload`, so `unloadAll()` (first thing in `onunload`, idempotent) keeps today's order: the desk recorder commits `leftOff` before the final persist (main.ts:136-142). Because every module defines `load()`/`unload()` today (goals/index.ts:57,121; placeholders/index.ts:71,126; …), which would override `Component.load`/`unload` and skip `_loaded`, children and registered callbacks, wave 2 renames them to `onload`/`onunload`. The typed fields `plugin.goals`, `plugin.lens`… (main.ts:66-76) stay defined, and listener sets on a module survive a reload (this fixes the stale subscription at outline/view.ts:185). Callers ask `plugin.features.isOn(id)` before calling into another feature. On unload every module drops its index fields (a disposed `VaultIndex` keeps answering from its map today, core/vault-index.ts:126-136), and goals closes its progress modal. |
| Q7 | Index specs. | **`plugin.index.add` returns a handle whose `dispose()` also removes the entry from the hub** (`IndexHub.remove`; today `add` only pushes, core/index-hub.ts:83-98, and only `unload()` disposes, :130-142). The context disposes every handle it handed out. A feature switched off does no index work; switched on again it adds its spec again and the hub builds it. |
| Q8 | Path-keyed data while its feature is off. SF 10 says "turning it back on loses nothing". If the desk is off and a note is renamed, `leftOff` keeps the old path, and the desk's prune at layout ready then drops it. | **Data followers are always on.** A module may expose `dataFollowers(): Follower[]`; the registry registers them at plugin load for every module, on or off, through `plugin.index.follow`. **A data follower touches only `plugin.data` and `plugin.settings`**, never a module field, so it works on a module that was never loaded; each wave 2 lifecycle test runs the real followers on an unloaded module. It moves and drops keys, and a follower that moves a path setting (the home note, the lists note) calls `plugin.saveSettings()`, which is safe re-entrantly (Q12). This covers `leftOff` and the home note path (desk), `lensDismissed` and the word lists note path (lens), `threadSeen` (universe), publish records (publish), the goals history (`renameBook`, goals/index.ts:212), and the new `povColors` (outline). Session state stays on a follower the module registers while loaded: the goals active files and baseline (goals/index.ts:205-210), the lens session and its shown cache (lens/index.ts:79-80), the desk recorder's `pending` (desk/recorder.ts:114), dialogue focus. **The snapshots rename handler is the exception**: it moves `.txt` files on disk and can rewrite `snapshotsFolder` (snapshots/index.ts:567-585), so it is an always-on handler that writes files while snapshots is off (listed in "Deviations"). It stays a hub follower and finds the file or folder with `getAbstractFileByPath(newPath)`, since `Follower.moved` carries only paths (core/vault-index.ts:49-52); the hub's echo filter already drops per-child events after a folder move (core/index-hub.ts:207-231), which `store.moveFolder` covers. Tests: a file rename, a folder rename and a rename of the snapshots root, all with snapshots off. Pruning at layout ready stays in each module's load. |
| Q9 | Which features get a switch? SF 10's list leaves out spellcheck on demand and the stage snapshot, and "the desk: stages and the home block" mixes core stages with a module. | **17 switches**, in SF 10's groups. **Writing:** goals and sprints (with the status bar), outline and ghost beats, placeholders (with the explorer dots), Enter flow and smart typography, dialogue focus, move a paragraph or scene, insert from a template, spellcheck on demand, word counts in the explorer. **Revision:** revision lens, snapshots, darlings. **The desk:** home block and where you left off, stage snapshot (requires snapshots). **Publishing:** publish check. **The world:** the universe (the mode), open threads. **Stages stay always on**: the stage words are shared core (outline dots, Works tab, publish), like the classifier. |
| Q10 | Where is the switch stored? | **`settings.features: Partial<Record<FeatureId, boolean>>`, where a missing key means on.** Existing installs get every feature on with no migration. Where one existing setting already means "this feature is on", the switch is that setting, so there is one control, not two: word counts in the explorer is `explorerCounts`, spellcheck on demand is `spellcheckOnDemand` (settings.ts:106, read at editor/index.ts:150; default off, settings.ts:175, so this one feature stays off until the writer turns it on, as today), the universe is `universeMode`. The old controls for those three leave their sections (the `explorerCounts` toggle at settings.ts:307-311, the `spellcheckOnDemand` toggle at :442-446, the universe section's mode dropdown at universe/settings-ui.ts:33-46), and the Features page is the one place to set them (4.1, 4.5). Every other feature gets a key in `features`. |
| Q11 | Dependencies. | **Hard:** `requires` in the feature list. Only the stage snapshot has one (snapshots). While snapshots is off, the stage snapshot's switch shows off and disabled, with a note; its stored value is kept, so turning snapshots back on restores it. **Soft:** checked at call time through `plugin.features.isOn`. Publish skips its "before publishing" snapshot when snapshots is off (publish/index.ts:141); the outline shows no placeholder badge when placeholders is off; the settings tab hides the lens's "Create" button when the lens is off (settings.ts:489); the lens and the outline read names through the names port (Q36), which is empty when the universe is off; the universe's Works tab opens works through the desk's `openWork` (universe/view-works.ts:5, :63), which reads `leftOff` (desk/open.ts:17-29): with the desk off it opens the work at the top with no record, since the recorder isn't running and the records would be stale. |
| Q12 | What runs when? | The registry `apply()`s at the end of `onload` (after the core services, main.ts:92-114) and at the start of `saveSettings` (main.ts:165-169), before `settingsChanged` fans out, which then reaches loaded modules only. **`apply()` is synchronous** (every module's load is sync, main.ts:128-131) **and guarded against re-entry**: a call made while one is running (a follower's `saveSettings` inside the hub's notify, desk/index.ts:46-47, lens/index.ts:84-88, snapshots/index.ts:572-573; or two settings keystrokes) sets a flag, and the running apply loops once more at the end. Tests: `apply` from inside a follower, and twice in a row. **Load order is today's order** (main.ts:116-127), with each split feature at its module's place: goals, outline, placeholders, explorerCounts, darlings, typing, dialogueFocus, moveBlocks, templates, spellcheck, lens, snapshots, stageSnapshot, publish, desk, universe, threads. Listeners for one event run in registration order (the "handlers run first" comment at goals/index.ts:101), so keeping the order keeps today's behaviour. Unload is the reverse. Turning a feature on mid-session never moves the writer's tab or opens a view (the desk's cold-start guard, desk/index.ts:28, is the pattern). |
| Q13 | Settings of an off feature. | **Hidden row by row, by the feature that reads them, not section by section.** Several rows are read by more than one feature or sit in another feature's section: the piece property names and the goal property (settings.ts:323-345, read by the outline, the explorer and publish), the track and exclude folders (:283-292, read by the classifier), the explorer rows inside the Goals section (:307-322), `placeholderMarker` (read by publish, publish/index.ts:112), `quoteStyle` and `paragraphStyle` (read by the lens, lens/index.ts:122, :194-195), the thread words in the universe section (universe/settings-ui.ts:109-124, drawn in every mode because threads work in every mode). 4.1 moves the shared property names (with the new `povProperty` and `chapterTargetProperty`) and the track and exclude folders into an always-shown "Properties and folders" section, moves the explorer rows under the explorer feature, and shows a shared row while any feature that reads it is on. The Features page is the first section of the one settings tab (Obsidian has no subpages). This is UI, so it waits for G1a (rule 7). Moving each section into its module (review candidate E) is not done in 0.7 (see "Issues not applied"). |
| Q14 | The lens language setting is in the lens's section, but the universe matcher needs a language too (Q24), and the section hides when the lens is off. | **Move the row, keep the key.** A "Writing language" row (Automatic / Português (Brasil) / English) moves to the top of the settings, under the Features page. It keeps the `lensLanguage` key (settings.ts:109), so no migration. The lens, the matcher and the built-in name titles (Q29) all read it. |

**Keep a note out of the universe (U 1.1, `universe: false`)**

| # | Question | Recommendation |
|---|---|---|
| Q15 | What counts as "false"? | **The YAML boolean `false`, and the string `"false"` (trimmed, any case).** Decided by G0g: the Properties editor writes the string. `universe` already holds links (`[[Universo]]`), so its vault-wide property type is text and the Properties editor shows a text field, not a checkbox; typing `false` there saves `universe: "false"` (a list field saves `- "false"`, which is not `false`). Today's code reads that as a link that names no note and the note silently stays in through the folder rules (scope.ts:85-94, :109-112). The former "Issues not applied" entry (not accepting the string) is reversed. The guide shows the source-mode form `universe: false`. |
| Q16 | "Checked before every other rule": also before the universe folder and the universe note? | **Yes, literally.** A note in the universe folder with `universe: false` is out, and so is the universe note itself if it carries it. Tests pin both. Today `linkText(false)` returns null (scope.ts:69), so the value is skipped and the folder rules win (scope.ts:109-112). |
| Q17 | What scope does an opted-out note get? | **Its book scope, else none** (`bookScope`, scope.ts:100). A book whose note says `false` keeps per-book rules for its own files, like a standalone book in a mixed vault (scope.ts:113). Per-book mode and off mode are unchanged (scope.ts:98-101). |
| Q18 | On a book note: chapters only, or every file of the book? | **Every file of the book**, as the positive property already works: the loop at scope.ts:103 visits the file, then its book note, and `lookup.book` covers chapters and other files of the book (universe/index.ts:340-343). A file's own link wins over its book note's `false`; a file's own `false` wins over its book note's link. |
| Q19 | The panel's "Add to" button. | **Hidden when the note is kept out**, by its own `false` or its book note's (with no link of its own). A new `universe.keptOut(file)` built on a pure `keptOut(path, lookup)` in scope.ts; the view checks it next to the scope check at view.ts:333. `addToUniverse` already refuses to overwrite any set value, `false` included (universe/index.ts:316-329); a test keeps it so. |
| Q20 | The entries index stores each entry's scope (entries.ts:14-23, :110) and `sameEntry` compares it (:55-59). A book note's property change doesn't recompute other notes, so the stored scope can go stale; `universe: false` adds another rule that depends on other notes. | **Stop storing scope** (review candidate C, the minimum). `Entry` loses `scope`; `sameEntry` no longer compares it; `entries(scope)` and `entry(path)` read scope live through `scopeOf`, as `entries()` already does (universe/index.ts:180-186). Done in 3.1. |

**"Appears in" (U 1.2)**

| # | Question | Recommendation |
|---|---|---|
| Q21 | Which text does the matcher read? The spec says `proseOnly`, but "click to jump" needs offsets, and `proseOnly` collapses them (core/wordcount.ts:21-37). | **`readerMask(md)`** (core/wordcount.ts:84-99): the same words as `proseOnly`, offset for offset. Headings count, as they do for the word count. Frontmatter, comments, code and link targets don't. |
| Q22 | Which terms use the `"name"` stem profile and which `"word"`? The spec says people and places use `"name"`, common-noun entries `"word"`; object, group and event are open. | **By the term, not the kind**: a name or alias whose first letter is uppercase uses `"name"` (*Maria / Mariazinha*, *Os Almeida*); a lowercase alias uses `"word"` (*o menino*). This reads the spec's "common-noun entries and aliases" through what the writer typed, with no per-kind rule. **Case (author, G3, 2026-10-03)**: a `"name"` term matches only tokens whose first letter is uppercase, checked word by word for each capitalized word of the term (*Rosa dos ventos* needs a capital on *Rosa*, not on *dos*). An all-caps token counts (a `## PORTO` heading matches *Porto*). A common word at the start of a sentence still matches, an accepted cost. A `"word"` (lowercase) term matches in any case (*O menino*). The per-entry `caseSensitive` option keeps its meaning, exact case, for terms that need it (accents are ignored, case is kept). |
| Q23 | Accents. The lens keeps accents (core/stem/index.ts:15-17); the universe's search folds them (entries.ts:132). | **The matcher folds accents, before stemming** (author, G2; review H1): *Inês* and *Ines* are one key, as are *Tomás/Tomas*, *Thaís/Thais*, *Andrés/Andres* and *Mário/Mario*. A word's key is `stem(foldName(word), lang, profile)`, where `foldName` (`src/core/names.ts`, filled in 0.1b) is `normalizeWord`, then NFD, drop combining marks, NFC, trim. Folding after stemming fails: the pt stemmer drops a bare `-es`/`-as`/`-is` but not an accented one, so *Inês* gave `ines` and *Ines* gave `ine`. The same fold applies to every word the matcher compares: occurrence tokens, term words, ignore phrases, titles and the `nameTitles` setting (**except titles, G3**: titles compare with accents kept, so *Irma*, a given name, is not the title *Irmã*). Every exact comparison of names compares `foldName` forms too: `Candidate.exact`, `NamesProvider.entryFor` and the POV keys. The stemmer itself is unchanged and the lens keeps its accent-aware keys. Writers are inconsistent with accents in names, and a missed mention is worse here than a rare merge. The panel's search keeps `foldText`. |
| Q24 | Which language? | **The writing language** (Q14), through `matchLang(setting, locale)` in `core/names.ts`, the same mapping as `lensLang` (lens/lang.ts:10-16). With no language (a locale that is neither pt nor en), terms match by exact normalized form, with no stemming. |
| Q25 | Multi-word names and aliases (*Dona Maria*, *Rosa dos ventos*). | **Phrase matching** through `findPhrase` (core/tokens.ts:26-40) with the term's stem on each word. Only whitespace (a line break included) and emphasis marks may sit between the words, the crutch rule (lens/rules-words.ts:202-204). At one position the longest match wins; overlaps resolve left to right. **Articles inside a multi-word term (author, G3)**: no article rule. Articles and contractions must match as written, each word stemmed on its own, so *o menino* matches *o menino* and *O menino*, and *os meninos* never matches *o menino*. (The H2 option a mapping, o/os, do/dos and so on, is removed.) **Hyphens**: a hyphenated word is its parts, in the text and in a term or ignore phrase alike (G3, wave 1 review 2), when no part has an apostrophe; so *Maria-José* is a mention of the entry *Maria José*, the term *Santa-Rita do Sul* and the ignore phrase *beija-flor* match their own text, and *rosa-dos-ventos* is matched by the ignore phrase *rosa dos ventos*. A term written with a hyphen also matches the same words with a space. |
| Q26 | Collisions: the pt `"name"` stem gives *Marcos* and *Marco* one key (`marco`), likewise *Carlos/Carlo*, *Lucas/Luca*; two entries can share a first name. | **Each occurrence keeps its candidate entries; the query decides.** Candidates are filtered to the note's scope. Then an entry whose term has the exact surface form wins, an explicit name or alias beats a derived first name, and if more than one is left the occurrence counts for none ("prefer missing a match over a wrong one", SF 5). The stem fixtures stay frozen. A common word that is also a name (*Rosa*, *Luz*, *Mar*) matches only when capitalized (Q22), so *a blusa rosa* is not a mention. |
| Q27 | Very short or common terms. | **A term of one letter, or a single stop word in the matcher language (`isStopWord`, core/stem/stopwords.ts:82), never matches.** Everything else follows the spec: case-insensitive by default, with the per-entry `ignore` list for names that are also words (*Rosa*, *Porto*). |
| Q28 | The per-entry properties `caseSensitive`, `ignore` and `firstName`: literal keys, or settings? Rule 6 says every property name is a setting. | **Settings with those English defaults**: `caseSensitiveProperty`, `ignoreProperty`, `firstNameProperty`, in the universe settings (universe/settings.ts), shown in one collapsed "Entry properties" group. `aliases` stays Obsidian's own key (entries.ts:38-49). |
| Q29 | First name as an alias: titles, collisions, kinds. | **Characters only. Leading titles are skipped, then the first word becomes an alias when at least one more word follows** (*Dona Benta Encerrabodes* → *Benta*). **The full name minus its leading titles is also a term** (`origin: "first"`, so it loses to an explicit name, Q26), including when one word remains (author, G3): *Dona Maria Clara* also gives *Maria Clara*, *Mr Brown* gives *Brown* and *Senhor Antunes* gives *Antunes*. Without a title, a bare surname is still not derived (*Maria Souza* gives *Maria*, not *Souza*). The spec says "unless it's a title"; skipping the title and taking the next word is a reading, listed in "Deviations". **Titles compare with accents kept** (G3), so *Irma* is not *Irmã*. **Titles are language data, built in per language** and picked by the writing language (Q14), like the lens's lexicon ("language tables picked by the language setting, not the author's values", lens/lexicon.ts:1-3) and the stop words (core/stem/stopwords.ts:82): pt *Dona, Dom, Seu, Sr., Sra., Srta., Dr., Dra., Senhor, Senhora, Doutor, Doutora, Padre, Frei, Irmã, Irmão, Tia, Tio, Vó, Vô, Coronel, Capitão, Professor, Professora*, en *Mr, Mrs, Ms, Miss, Dr, Sir, Lady, Lord, Aunt, Uncle*, in `src/core/name-titles.ts` (pure data). An English-only default would make *Dona Benta Encerrabodes* derive *Dona*, and every "dona" in prose would count. A setting `nameTitles` (newline-separated, dot optional, **empty by default**) extends the table, as the word lists note extends the lexicon. With no language, both tables apply. `firstName: false` turns it off. A derived first name loses to any explicit name or alias (Q26). |
| Q30 | Explicit links. | **A `[[Teo]]` or `[Teo](Teo.md)` in prose is one mention of the note it resolves to**, when that note is an entry; its display text is not matched again. Embeds and frontmatter links don't count. The index stores the link path; the query resolves it with `getFirstLinkpathDest`, so the index stays pure and a rename of the entry needs no rebuild. |
| Q31 | Which notes are scanned, and how is the result grouped? | **Every Markdown note except snapshots and templates** (`isUniverseNote`, entries.ts:79-81), filtered at query time to the entry's scope (scope is never stored, Q20); `compute` returns `undefined` for a note with no occurrences and no links, so empty notes cost no memory. Filtering scope at compute time instead would go stale when a book note's `universe` changes (Q20), so the scan stays vault-wide (see "Issues not applied"). An entry's own note never counts for itself. Groups: **works** first (a book with its chapters under it, then standalone works, in the Works tab's order: `groupWorks` puts forms first, then `compareWorks`, works-list.ts:71-84), then **other notes in scope** (other entries, the universe note, loose notes), collapsed. The "other notes" group goes beyond U 1.2's "every work and chapter" and is listed in "Deviations". |
| Q32 | "First/last mention" and "story order". | **Inside a book only, by chapter order.** Across works there is no order until the phase 2 timeline, so the section shows no first or last there. A narrowing, listed in "Deviations". |
| Q33 | How does the index stay current when entries change? A note's matches depend on the whole term table. | **The index stores matches against the current term table, and a change in the table's signature rebuilds it.** The signature covers names, aliases, the three per-entry options, kinds, titles and the language; a scope change or a thread edit doesn't change it. The universe calls `plugin.index.rebuild("universe-mentions")` (core/vault-indexes.ts:74) 2 seconds after the last signature change. A rebuild keeps the old values visible until the new map is complete (core/vault-index.ts:164-167), so counts never drop to zero mid-build. Storing entry-independent token keys per note (option b in the map) is rejected (see "Issues not applied"). The spec is content mode and **not structural** (a structural spec recomputes everything on every create, delete or rename, core/vault-index.ts:329-337). |
| Q34 | The entry note's "Appears in" section: write it into the note, or draw it? | **Draw it, never write it** (rule 1, and the spec's "not written into the file"). The home block is the precedent for drawing, but it needs a block the writer owns; this needs none. In Live Preview and Source mode: a block widget at the end of the document from a CodeMirror `StateField` (block widgets can't come from a `ViewPlugin`), only in a note that is an entry in the current mode. In Reading view: a Markdown post-processor that appends the section after the note's last section, if gate G0d shows it can find the last section reliably; otherwise Reading view shows nothing and the panel has the list. **The panel shows the list too**, as U 1.2 asks ("in the universe panel and in each entry note"): the Entries tab's count opens the same list (the `appears-in.ts` DOM, shared) under the entry's row (4.2, G1b). The section starts collapsed to one line ("Appears in 3 works · 41 mentions"), open state per session. A click on a row opens the note and selects the first mention there, after checking the text at that range still matches; if not, it opens the note at the top. It changes only the selection (rule 2). |
| Q35 | The rest of U 1.2's output: the optional editor underline, "Unlinked mentions" per work, and "Names without an entry" (U 1.3, "from v0.7"). | **The underline ships with the spellcheck marks** (Q37): it is the same decoration with a visible class, behind the "Underline names in the editor" setting, off by default (ROADMAP-universe.md settings summary). **"Unlinked mentions" and "Names without an entry" move to 0.9** with the rest of the universe's phase 2; they are not in the 0.7 table (ROADMAP.md:43-52), each needs its own mockups, and the second needs a dismiss list that doesn't exist yet. Listed in "Deviations". |

**Names into spellcheck and the revision lens (U 1.4)**

| # | Question | Recommendation |
|---|---|---|
| Q36 | How do the lens, the outline and the editor read names without depending on the universe module? | **A names port on the plugin** (review candidate D, as a rule of this plan): `plugin.names` in `core/names-source.ts`, with `tableFor(path)`, `entryFor(text, path)`, `version()` and `onChange`. The universe provides it while it is loaded and withdraws it on unload; with no provider it answers empty. No module imports `src/universe/` for names; 5.4 greps for it. |
| Q37 | Spellcheck. The spec's route (Electron's session spellchecker on desktop) breaks rule 8 ("no Node or Electron APIs", ARCHITECTURE.md:99) and trips `tests/no-network.test.ts` (its `require("electron")` pattern, tests/no-network.test.ts:34-35). (The spec allows adding words; it only says "Never remove words the user added", ROADMAP-universe.md:216.) | **No Electron. Mark decorations with `spellcheck="false"` over recognized names**, matched with the terms of the note's scope (`tableFor(path)`), capitalized terms only (Q38). It never touches the writer's dictionary, and may work on mobile too. After the first full pass, a typing pause re-matches only the paragraphs that changed (`findNames`' `from`/`to`), not the whole note. Gate G0c checks that the attribute on a span is honoured by Chromium on desktop and Android and by WebKit (WKWebView) on iOS. Where it isn't, the spellcheck half doesn't ship on that platform; the lens half ships regardless. Keyboard autocorrect of invented names on phones is per field, not per span, and is not addressed. Editing modes only (Reading view has no spellcheck). When "spellcheck on demand" has spellcheck off, the marks do nothing visible. A deviation from U 1.4: names are unflagged in notes in the name's scope, not everywhere. |
| Q38 | Which names feed the lens, spellcheck and the underline? Feeding `lists.names` also changes echoes and gerunds (lens/rules-stem.ts:45-63, rules-words.ts:28-36). | **Every capitalized term (names, aliases, derived first names) of the entries in the note's scope, in addition to the word lists note's `## Names`; the name marks (4.4) use the same `capitalizedTerms` filter**, pinned in `universe-name-marks.test.ts`. Lowercase aliases are not fed or marked (they count as mentions only, Q22): "o menino" would make *menino* a name and silence echoes on it. Echoes and gerunds skipping entry names is wanted (repeating a name is normal; *Fernando* is not a gerund). In off mode there are no entries, so nothing feeds; per-book mode feeds the book's entries (ROADMAP-universe.md:42-44). |
| Q39 | The lens's options are global (lens/index.ts:184-197) and its analyze callback has no path (lens/session.ts:36). | **The session passes the path**: `analyze(path, text, version)`. `options(path)` merges the note's names; the pass key includes `plugin.names.version()`, so a names change re-runs only notes with the lens on, through the existing `invalidate()`. The lens doesn't subscribe to `universe.onChange`, which also fires on every thread edit (universe/index.ts:84-91). |

**POV and status in the outline (N 1)**

| # | Question | Recommendation |
|---|---|---|
| Q40 | The property and its value. | **A setting `povProperty`, default `pov`** (rule 6). A link or plain text, read through `linkText` (scope.ts:61-73), so `[[Maria|Mari]]`, `Maria` and a one-item list read the same. |
| Q41 | One colour per what? | **Per resolved note when the value links (or names an entry in the chapter's scope, through `plugin.names.entryFor`), else per folded text.** So `[[Maria]]`, `Maria` and an alias of Maria share one colour, and the chip shows the entry's name. With the universe off, links still resolve to notes; text stays text. |
| Q42 | Colours: which, how assigned, how edited? | **A palette of eight Obsidian colour variables** (`--color-red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `pink`), so themes and dark mode work. A new key gets the first colour no key uses, in order of first appearance; after eight they repeat. Stored in `data.povColors: Record<key, PovColor>` (absent before 0.7, loaded as `{}`), shared by every book so a character keeps one colour, never pruned automatically, and following renames through an always-on data follower (Q8). **Edited from the POV chip's menu** in the outline header (the eight swatches), not in settings (rule 3). |
| Q43 | The status / POV toggle. | **A header button; per outline leaf, kept in the view's state** (Obsidian saves it with the layout), not in data.json. Default: status. In status mode the stripe uses `statusColor` (core/stages.ts:120), as the dot does today (outline/view.ts:596-615). |
| Q44 | Filters (chips in the header). | **One chip per stage present and one per POV present.** Several chips in one group mean OR; the two groups combine with AND. Session only. While a filter is on, drag-to-reorder and "Renumber chapters" are disabled, because moving chapters among hidden rows is easy to get wrong (rule 1), and the header says "Showing 4 of 12 · Clear". |
| Q45 | The summary ("3 rascunho · 2 revisão · 4 publicado"): by raw word or by stage? | **Counted by stage, labelled with the writer's own word for it** (the stage's first status word in `settings.stages`), in stage order. So code reads the stage (CONTEXT, "Vocabulary") and the writer sees their words. A status that matches no stage is counted under its own word, after the stages; chapters with no status under "no status". |
| Q46 | The canvas board (`openBoard`, outline/index.ts:152-167). | **Unchanged**: status colours only. It reads its rows from the new row loader (task 2.2), so POV on the board is a small change later. |

**Per-chapter targets (N 2)**

| # | Question | Recommendation |
|---|---|---|
| Q47 | The book default: name, value, unit, and does `limit` inherit? | **A setting `chapterTargetProperty`, default `chapterTarget`** (beside `goalProperty`, settings.ts:62). The value goes through `parseAmount`. Only the target inherits, as the spec says; the chapter's own `limit` and `deadline` stay its own. The unit is the chapter's own `unit`, else the book note's `unit`, else words. |
| Q48 | Merge rule. | **Per field: the chapter's own `target` wins, else the default.** A pure `effectivePiece(own, chapterDefault)` in core/measure.ts, beside `readBookGoal` (core/measure.ts:205), and `readChapterDefault(fm, props)`. The outline passes the result to `measure.note(file, pieceOverride)` (core/measurer.ts:124), so counting and progress aren't re-derived. |
| Q49 | Where does the default show? The explorer, the goals modal and the outline each build a note's piece (core/measurer.ts:127-131, explorer/index.ts:402-403, outline/view.ts:254-260). | **In the outline only, in 0.7.** The explorer's "target next to the count" and the goals modal show a chapter's own target, as today. Chapters aren't works, so goals are untouched. Moving the effective piece into the classifier so every surface agrees is review candidate B, added to IMPROVEMENTS. A narrowing, listed in "Deviations". |
| Q50 | The bar. | **A thin bar under the chapter's title line**, with target and limit marks from `pieceBar` (goals/piece.ts:23-31) and near/over states from `Progress` (core/measure.ts:254-271); `role="progressbar"`, a tooltip ("1.234 / 2.000 palavras"). Counted in the chapter's unit: characters are read lazily through `measure.counts` (core/measurer.ts:109), cached by mtime. Today rows count words only (outline/view.ts:290). |

**The improvement**

| # | Question | Recommendation |
|---|---|---|
| Q51 | A second improvement? | **Yes: chapter rows** (review candidate A, new IMPROVEMENTS 7, the first slice of candidate 5). A pure `outline/rows.ts` loads a chapter row once, for the outline view and the board, instead of field by field in two places (outline/view.ts:276-298, outline/index.ts:152-167). POV and the per-chapter target land there once, tested, instead of in an untested 1,334-line view. The placeholder count comes from the placeholders index (`countFor`, placeholders/index.ts:35) instead of a second parse (outline/view.ts:292). The review rates it strong for 0.7 and both N 1 and N 2 need it. Candidate 6 stays the required improvement. |
| Q52 | Testing that unload leaves nothing behind. vitest can't import `obsidian` today: no test does, and there is no stub (tests/support has only memory-vault.ts). | **A small `obsidian` stub for tests** (`tests/support/obsidian.ts`, aliased in a new `vitest.config.ts`), with a working `Component` and no-op UI classes. A lifecycle test per module loads it through a recording `ModuleContext`, unloads it, and asserts nothing is left: no command, ribbon, status bar item, slot entry, index handle, follower, event or interval. 5.4 also greps every module for direct `plugin.register*` and `add*` calls. |

## Deviations from the specs

Every place this plan narrows, extends or reads a spec differently. Task 5.3 writes
each edit; the author confirms them in G2.

| Ref | Spec | Kind | What changes | Spec edit at release |
|---|---|---|---|---|
| Q2 | SF 10 | reading | Commands removed with `removeCommand`; `minAppVersion` 1.7.2 | One sentence in SF 10 and the README install note. |
| Q3 | SF 10 | reading | View types stay registered; an off feature's leaves are closed | Add to "A feature that is off is not loaded". |
| G0f | SF 10 | narrowing | A feature turned off at runtime keeps its ribbon icon until the next restart; a click shows that the feature is off. Off at startup, it never adds the icon | Add to "A feature that is off is not loaded". |
| Q8 | SF 10 | addition | Data followers run while a feature is off, so its data follows renames; the snapshots rename handler also moves snapshot files on disk while snapshots is off | Add to "Its data stays", naming the snapshots exception. |
| Q10 | SF 10 | reading | `explorerCounts`, `spellcheckOnDemand` and `universeMode` are the switches; their old controls leave their sections | One sentence in SF 10. |
| Q11 | SF 10 | addition | With the desk off, the universe's Works tab opens a work at the top, ignoring "where you left off" | One sentence in SF 10. |
| Q13 | SF 10 | reading | Settings hide row by row by the feature that reads them; shared property names and folders move to an always-shown section | Add to "A feature that is off is not loaded". |
| Q9 | SF 10 | reading | 17 switches; spellcheck on demand and the stage snapshot get their own; stages stay always on | Rewrite the feature list. |
| Q14 | SF 5, SF 10 | addition | "Writing language" moves out of the Revision section, same key | One line in SF 5's settings and SF 10. |
| Q15 | U 1.1 | reading | The string `"false"` (trimmed, any case) counts as false too, because the Properties editor writes a string (G0g) | One clause in the "Keeping one note out" bullet. |
| Q16–Q18 | U 1.1 | reading | `false` beats the universe folder and the universe note; it applies to every file of a book, not only chapters | Rewrite the "Keeping one note out" bullet. |
| Q21 | U 1.2 | reading | The matcher reads the reader mask (offsets kept), not `proseOnly`; headings count | Rewrite "Matching". |
| Q22 | U 1.2 | reading | `"name"` or `"word"` by the term's capital letter, not by entry kind | Rewrite "Portuguese inflection". |
| Q22 (G3) | U 1.2 | narrowing | U 1.2 says case-insensitive by default. A capitalized term matches only capitalized tokens (all caps included); a lowercase term and `caseSensitive: true` entries are unchanged. Sentence-start common words still match | Rewrite "Matching" and the `caseSensitive` bullet. |
| Q23 | U 1.2 | addition | Accents are folded before stemming in every word the matcher compares | One sentence in "Portuguese inflection". |
| Q25 | U 1.2 | addition | Hyphenated words in the text, in a term and in an ignore phrase all match as their parts. (The article rule was dropped at G3: articles inside a multi-word term match as written.) | Add to "Matching". |
| Q26–Q27 | U 1.2 | addition | Tie-break for shared keys; one-letter and stop-word terms never match | Add a "Collisions" bullet. |
| Q28 | U 1.2 | reading | The three per-entry property names are settings | Name the settings. |
| Q29 | U 1.2 | reading | Leading titles are skipped and the next word becomes the first name; the full name minus its titles is also a term, even when one word remains (*Mr Brown* gives *Brown*); titles compare with accents kept; titles are built-in pt and en tables picked by the writing language, extended by `nameTitles` | Rewrite "First name as an alias". |
| Q31 | U 1.2 | addition | An "Other notes" group (other entries, the universe note, loose notes in scope) after the works | Add to the "Output" bullet. |
| IMPROVEMENTS 10 | U 1.2 | reading | The matcher lives in `src/core/names.ts`, not `src/universe/match.ts`, so the lens, spellcheck and the outline share it without importing the universe | Rewrite the "Index" bullet's last sentence. |
| Q32 | U 1.2 | narrowing | First and last mention only inside a book | Rewrite the "Output" bullet. |
| Q35 | U 1.2, U 1.3 | narrowing | "Unlinked mentions" and "Names without an entry" move to 0.9; the underline ships with the spellcheck marks | Move both bullets to phase 2; ROADMAP.md 0.9 row. |
| Q37 | U 1.4 | replacement | `spellcheck="false"` marks instead of the Electron dictionary; desktop and, per platform as G0c finds, mobile; names are unflagged only in notes in their scope, not vault-wide; autocorrect on phones not addressed | Rewrite the first U 1.4 bullet. |
| Q38 | U 1.4 | reading | Capitalized terms only, for the lens and the marks alike; names feed echoes and gerunds too | One sentence in the second bullet. |
| Q44 | N 1 | addition | Reordering and renumbering are off while filtered | Add to N 1. |
| Q45 | N 1 | reading | The summary counts stages, labelled with the writer's word | One sentence. |
| Q47–Q49 | N 2 | narrowing | Only `target` inherits; the default shows in the outline only | Rewrite N 2's last sentence. |
| G1 | all | addition | Whatever the approved mockups add (texts, states, buttons) | Listed when G1 is approved. |

## Scope

0.7 ships six features and two improvements:

- **Feature switches** (SF 10, the first half): a Features page at the top of the
  settings, 17 switches in five groups, an off feature fully unloaded, its settings
  settings hidden row by row, its data kept and still following renames. Presets and the setup
  command stay in 1.0.
- **Keep a note out of the universe** (U 1.1): `universe: false`, checked first, on a
  note or a book note.
- **"Appears in"** (U 1.2): the names matcher in `src/core/names.ts` (shared with the
  lens, spellcheck and the outline), the mentions index, the count in the panel's
  Entries tab, and the drawn section in each entry note.
- **Names into spellcheck and the revision lens** (U 1.4): the names port, the lens's
  per-note names, and `spellcheck="false"` marks with an optional underline.
- **POV and status in the outline** (N 1): stripe, toggle, chips, summary, colours
  that stick.
- **Per-chapter targets** (N 2): the bar and the book default.

**Improvements:** modules that load and unload at runtime (IMPROVEMENTS 6, required),
and chapter rows (IMPROVEMENTS 7, new, the first slice of candidate 5). Two rules from
the review are built into the features rather than listed as improvements: entries
stop storing scope (candidate 9, the minimum, in 3.1), and names reach other modules
only through the names port (candidate 10, in 1.2, 3.1 and 3.3).

**Out of scope:** presets and "Set up a writing vault" (1.0); "Unlinked mentions" and
"Names without an entry" (0.9, Q35); POV on the canvas board (Q46); the default
chapter target outside the outline (Q49, candidate 8); moving settings sections into
their modules (candidate 11); one text pass shared by content indexes (candidate 12);
moving shared helpers out of module folders (candidate 13); content indexes that start on demand (candidate 14); the rest of candidate 5;
the measurer, explorer and snapshots path state onto the vault index (IMPROVEMENTS 2's
remainder), except that the snapshots rename handler becomes an always-on follower
(Q8); the 0.2.1 loose ends.

The author's vault settings (`~/projects/website/escrita/.obsidian/plugins/escrita/data.json`)
that matter here:

- `universeMode: "universe"`, `universeNote: "Universo.md"`, default folders `Contos`,
  `Textos`, `Romances`, `typeProperty: "tipo"`.
- Obsidian in Portuguese, `lensLanguage: "pt-BR"`, so the matcher stems in pt.
- No `features` key: every feature stays on after the update (spellcheck on demand
  stays as the author set it, Q10).
- New values the release sets: the author's choice of `povProperty` and
  `chapterTargetProperty` names. The pt titles are built in (Q29), so `nameTitles`
  stays empty unless the author wants more.

## Gates (before building)

**G0. Spikes in a real vault** (an agent or the author, with Obsidian 1.7.2 or later
on desktop, and the Obsidian app on an iPhone and an Android phone). A throwaway
plugin, never committed. Each result is written into this file under G0 before the
gated task starts.

- **G0a** (gates 1.1): `removeCommand` with the raw id and with `escrita:<id>`: which
  one removes the command from the palette and the hotkeys list, and whether
  `addCommand` with the same id works again afterwards. `addCommand` rewrites `cmd.id`
  to `escrita:<id>` on the object it is given, so the context records the raw id before
  the call and builds a fresh `Command` object on each load (check that reusing one
  would prefix it twice). On a phone: what the mobile toolbar shows for a pinned
  command that was removed.
  **Cleared. Result 2026-10-03, from Obsidian 1.13.7 app.js:** `Plugin.removeCommand`
  takes the **raw id** and adds the prefix itself (`escrita:<id>` removes nothing).
  `addCommand` rewrites `id` and `name` on the object it is given, so reusing one gives
  `escrita:escrita:x`: the context builds a **fresh `Command` object on each load**.
  Adding the same id again overwrites the map entry. Removal drops only default
  hotkeys; **custom hotkeys survive** in `hotkeys.json` and work again once the command
  is back. The **mobile toolbar goes stale until restart**: it is rebuilt only when its
  config changes, so a pinned removed command keeps a dead button, and a re-added one
  reappears only after that rebuild; editing the toolbar while the feature is off drops
  the pin for good. Accepted, and noted for the guide (5.3).
- **G0b** (gates 1.1): a second `registerView` for one type throws or not (the plan
  never does it; this confirms the view slot is needed), and a restored leaf of an
  unregistered type at startup.
  **Cleared. Result 2026-10-03, from Obsidian 1.13.7 app.js:** a second `registerView`
  for one type **throws**, so each view type is registered **once for the plugin's
  life** (the view slot, Q3). A restored leaf of an unregistered type becomes an
  "unknown pane" placeholder that keeps its state, and comes back by itself when the
  type is registered. `Plugin.registerView`'s unload callback detaches leaves only when
  the user disables the plugin, so unregistering leaves ghost panes: **unloading a
  feature must detach its leaves itself** (`getLeavesOfType`), which the slot design
  already does.
- **G0c** (gates 4.4): a `Decoration.mark({attributes: {spellcheck: "false"}})` over a
  misspelt name in Live Preview: is the squiggle gone on desktop (Chromium), Android
  (Chromium WebView) and iOS (WebKit, tested separately)?
  **Open**: needs a device; the spike plugin (see G0d) marks a word with and without
  the attribute.
- **G0d** (gates the Reading-view half of 4.2): a Markdown post-processor that finds
  the note's last section (`ctx.getSectionInfo`) and appends a block after it, across
  re-renders, long notes and edits in a split pane.
  **Open**: needs a device. Spike plugin at
  `/tmp/claude-1000/-home-claudio-projects-escrita/38fd51ce-9f6d-4599-8fd7-904877f86374/scratchpad/escrita-spike/`
  (not committed; its README has the steps). Expected risk: Reading view re-renders
  only changed sections, so an edit at the end may leave two blocks.
- **G0e**: the author accepts `minAppVersion` 1.7.2 (released in 2024). **Accepted
  2026-10-03** (with Q2).
- **G0f** (gates 1.1): a ribbon icon removed with `el.remove()` and added again, on
  desktop and a phone: does it leave an entry in "Manage ribbon" or the mobile ribbon
  menu, or duplicate one? If it does, the context hides the icon with
  `el.toggle(false)` while the feature is off and shows it again on load, adding it
  once for the plugin's life.
  **Cleared. Result 2026-10-03, from Obsidian 1.13.7 app.js: the fallback above
  fails.** The ribbon keeps each icon as an entry `escrita:<title>` in
  `leftRibbon.items`; any ribbon change (another plugin's icon, a reorder) re-inserts
  the element and calls `toggle(!hidden)`, so neither `el.remove()` nor
  `el.toggle(false)` lasts. "Configure ribbon" and the phone ribbon menu list every
  entry until restart, whichever way it was removed; only Obsidian's own unload
  (`removeRibbonAction`, private) clears the callback. **Decision, with no private
  API:** a feature that is off at startup never adds its ribbon icon; a feature turned
  off at runtime keeps its icon until the next restart, and clicking it shows a notice
  that the feature is off. Turned on again, the icon is added with the same title,
  which updates the same entry (no duplicate). The title stays the same across loads.
- **G0g** (gates 1.5): in a vault where `universe` holds links, type `false` into the
  `universe` field of the Properties editor and read the file: the YAML boolean or the
  string `"false"`? This decides Q15.
  **Cleared. Result 2026-10-03, from Obsidian 1.13.7 app.js:** the text field saves the
  typed text, and frontmatter is written by `yaml` 2 (`universe: "false"`); a list
  field writes `- "false"`; the boolean is written only when the writer changes the
  property type to checkbox. So the **string `"false"`** (trimmed, any case) counts as
  false, as does the YAML boolean (Q15). A device run with the spike plugin can confirm
  the in-editor save path; it doesn't block 1.5.
- **G0h** (before 3.2 pins its ceiling): time `segment + readerMask + findNames` per
  1,000 words with 300 entries on desktop and on a mid-range phone; record both here.
  3.2's ceilings are derived from these figures.
  **Desktop figure (measured, `npx vitest bench --run tests/names.bench.ts`)**: about
  1.7-1.9 ms per 1,000 words (re-run after the G3 changes: 1.9-2.2 ms, inside the 25% margin, so the figure stands; median of 20 runs after 5 warm-ups; 300 entries compiled to
  1,310 terms; 2,000 words, 42 hits = 2.1%; whole run 3.4-3.8 ms, min 2.3 ms). Phone
  figure still **open** (spike plugin with `names.ts` bundled in).
  Method, as planned: measured by this run once 1.2 lands (a `vitest bench`, not committed with
  fixed numbers: 300 entries with accented pt-BR aliases, 2,000-word prose with about 2%
  name hits, median of 20 runs after 5 warm-ups; the phone figure from the spike plugin
  with `names.ts` bundled in).

**G1. Design canvas mockups** (rule 7), on
https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6. **G1a–G1d: Approved by the author 2026-10-03 (boards 21–25 on the canvas).** The author approves them before
the gated tasks start: G1a gates 4.1, G1b gates 4.2 and 4.4, G1c gates 4.3, G1d gates
4.5. **Nothing in waves 0–3 waits on them, because waves 0–3 change no visible UI**:
the registry, every module's move onto it, the matcher, the mentions index, the names
port, the lens feed, `universe: false`, the row loader and the POV and target logic
are built first. Hiding settings (Q13) and hiding the panel's Threads tab are UI and
happen in wave 4 (4.1, 4.2). The visual comparison
against the approved artboards happens in 5.2, once everything is wired.

- **G1a. Features page** (SF 10):
  - the page at the top of the settings: five group headings, one row per feature
    with a switch and one line on what it does;
  - the universe row with the mode dropdown in place of a switch;
  - a dependent feature while its requirement is off (the stage snapshot, switch off
    and disabled, "Needs snapshots");
  - the "Writing language" row below the page (Q14);
  - the always-shown "Properties and folders" section (the piece and goal property
    names, the new POV and chapter target property names, track and exclude folders)
    and the explorer rows under the explorer feature (Q13);
  - how rows of off features disappear below (before and after), and the universe
    section's line pointing to the Features page in place of its mode dropdown;
  - the empty placeholder an off feature's restored view shows for a moment (Q3), if
    the author wants it to say anything;
  - light, dark, a phone (touch targets of at least 32px).
- **G1b. "Appears in"** (U 1.2, U 1.4):
  - the Entries tab row with its count ("4 works"; the tooltip "41 mentions in 4
    works"; nothing when zero), drawn beside the name (view-entries.ts:92-103);
  - the same list in the panel, opened from the count under the entry's row (Q34);
  - the panel with open threads off (no Threads tab);
  - the entry note's section at the end of the note, collapsed (one line) and open:
    works with counts, a book with its chapters and first/last chapter, "Other
    notes" collapsed; Live Preview, Source mode and Reading view;
  - states: the index still building ("Counting…"), no mentions, the note not an
    entry in the current mode (no section);
  - the optional name underline next to a lens mark, a spellcheck squiggle and a
    dialogue-focus dim;
  - light, dark, a 300px sidebar, a phone.
- **G1c. Outline** (N 1, N 2):
  - the POV stripe on the chapter row in both modes (status and POV);
  - the toggle in the header tools, next to the board button (outline/view.ts:413-418);
  - the chips (stages, POVs), selected and not, and the filtered state with "Showing
    4 of 12 · Clear" and the drag handle disabled;
  - the summary line beside the stats (outline/view.ts:580-594);
  - the per-chapter bar, under, near and over target, with a limit mark;
  - the POV chip menu with eight swatches;
  - a narrow sidebar and a phone.
- **G1d. Universe settings rows**: "Entry properties" (three names, collapsed), the
  extra titles list (empty, with the built-in titles named in its description),
  "Underline names in the editor". Small; may be approved with G1a.

**G2. Author decisions.** The questions at the top of this file and the "Deviations
from the specs" table. Q2, Q8, Q9, Q13, Q15, Q16, Q18, Q22, Q26, Q29, Q32, Q33, Q35, Q37, Q42,
Q44 and Q49 change or read a spec most and need an explicit answer.
**Answered 2026-10-03:** every recommendation accepted, except Q23: the matcher folds
accents (*Inês* and *Ines* match), now written into Q23 and the fixtures in 0.2.

**G3. Names fixture check** (before 3.2 pins the fixture snapshot). The author reads
`tests/fixtures/names/*` (task 0.2) for any expected mention that looks wrong. It can
run any time during waves 1–2.
**Done 2026-10-03.** Answers, built in `src/core/names.ts` with tests and the fixtures
edited in the same commit (the last time they change):
1. A capitalized term matches only tokens that start with a capital (all caps count;
   sentence-start common words still match; `caseSensitive` keeps exact case). Listed as
   a deviation from U 1.2's case-insensitive default (Q22).
2. No article rule: articles in a multi-word term match as written (Q25).
3. Plurals of names still count (*as Marias* is Maria).
4. The name minus its leading titles is a term even when one word remains (*Mr Brown*
   gives *Brown*, *Senhor Antunes* gives *Antunes*) (Q29).
5. Titles compare with accents kept: *Irma* is not *Irmã* (Q23, Q29).
6. Hyphenated words inside a term or an ignore phrase match; a case-sensitive term
   ignores accents and keeps case (wave 1 review 2 and 5).
7. Rows added: *a blusa rosa*, *acendeu a luz*, *o mar*, *beija-flor* are `-`; the pt
   titles gain *Coronel*, *Capitão*, *Professor*, *Professora*, each with a row.
Changed rows: pt `PORTO` heading now Porto (the Porto entry is no longer
case-sensitive); pt `Os meninos` now `-`; pt-titles `Luísa` became `Irma` (Irma is a given
name); the `Senhor Antunes` entry is now one word after the title; en `Brown` now Mr Brown.

## Ownership rules

- No two tasks in a wave touch the same file.
- Shared core files (`src/core/*`, `main.ts`, `settings.ts`, `data.ts`, `strings.ts`,
  `i18n.ts`) change only in tasks marked **[core]**. Each core file has one owner per
  wave. `manifest.json`, `package.json`, `build-css.mjs`, `vitest.config.ts` and
  `tests/support/*` count as core. Two listed exceptions: in wave 2, any task may
  **append** an export to `tests/support/obsidian.ts` or a field to
  `tests/support/fake-plugin.ts` (never change one), and 2.5 may change the editor's
  construction lines in `src/main.ts` (B1 in the review; no other wave 2 task touches
  `main.ts`).
- A task may import a type or stub that wave 0 created, or any file that existed at
  the start of its wave; it may not import anything a task in its own wave creates or
  changes the signature of.
- Fixture rows written by 0.2 are frozen after G3: a later task may add rows, never
  change or delete one. A row that looks wrong goes to the author.
- `src/core/names.ts`, `src/core/names-source.ts`, `src/core/features.ts`,
  `src/universe/mentions.ts`, `src/outline/rows.ts` and `src/outline/pov.ts` have no
  `obsidian` or CodeMirror imports and don't import `src/i18n.ts`. They return codes
  and numbers; the views translate.
- Every module file (`src/<module>/*`) registers through its `ModuleContext` or its own
  `Component` from wave 2 on, and never calls `workspace.onLayoutReady` directly (it
  uses `ctx.onLayoutReady`). Only `src/core/module-context.ts`, `src/main.ts` and the
  core services that already do (`src/core/measurer.ts:86-99`,
  `src/core/vault-indexes.ts:62-67`) call `plugin.register*`, `addCommand`,
  `addRibbonIcon` or `addStatusBarItem`.
- No file outside `src/universe/` imports from `src/universe/` (names go through
  `plugin.names`), except `main.ts` and the two imports that exist today:
  `src/data.ts:4` (the `SeenStore` type) and `src/settings.ts:11-12` (the universe
  settings and its section). Moving those is candidate 11's job.
- Every task runs `npm run typecheck && npm test` before calling itself done.
- Line numbers in this plan are from the 0.6.0 commit. Wave 2 moves code in every
  module, so tasks in waves 3–5 re-check citations before editing.

## Wave 0: contracts and fixtures

**0.1 [core] Types and stubs**, one agent, effort S–M. It writes the types below and
`throw new Error("todo")` stubs for functions later tasks fill in. It changes no
behaviour. Done when typecheck and the existing tests pass.

Files: create `src/core/features.ts`, `src/core/module-context.ts`,
`src/core/feature-registry.ts`, `src/core/names.ts`, `src/core/names-source.ts`,
`src/universe/mentions.ts`, `src/outline/rows.ts`, `src/outline/pov.ts`,
`src/editor/features.ts`, `src/universe/threads-feature.ts`,
`src/snapshots/stage-feature.ts`, `src/core/name-titles.ts` (the pt and en title
tables, filled: it is data, Q29); change `src/core/measure.ts` (two stubs only),
`src/settings.ts`, `src/universe/settings.ts` and `src/data.ts` (additive fields
only), `src/main.ts` (field declarations and a `povColors: {}` default in the
`loadAll` literal, main.ts:148-156), `build-css.mjs` (add
`src/universe/appears-in.css` and `src/universe/name-marks.css` to the list,
build-css.mjs:5-9; `existsSync` skips them until 4.2 and 4.4 create them).

`src/core/features.ts` (filled here; it is data):

```ts
export const FEATURE_IDS = [
  "goals", "outline", "placeholders", "explorerCounts", "darlings", "typing", "dialogueFocus",
  "moveBlocks", "templates", "spellcheck", "lens", "snapshots", "stageSnapshot", "publish",
  "desk", "universe", "threads",
] as const;   // also the load order: today's (main.ts:116-127), Q12; unload runs in reverse
export type FeatureId = typeof FEATURE_IDS[number];
export type FeatureGroup = "writing" | "revision" | "desk" | "publishing" | "world";
export interface FeatureSpec {
  id: FeatureId;
  group: FeatureGroup;
  requires?: readonly FeatureId[];               // stageSnapshot: ["snapshots"]
  /** where the switch lives: the `features` record (default), or an existing setting (Q10) */
  switch?: "explorerCounts" | "spellcheckOnDemand" | "universeMode";
}
export const FEATURE_SPECS: readonly FeatureSpec[];
export interface FeatureSwitches { features: Partial<Record<FeatureId, boolean>>; explorerCounts: boolean; spellcheckOnDemand: boolean; universeMode: "off" | "perBook" | "universe" }
/** The writer's switch alone (missing key = on). */
export function switchedOn(id: FeatureId, s: FeatureSwitches): boolean;   // stub
/** Switched on and every requirement on (closure). */
export function wanted(s: FeatureSwitches): Set<FeatureId>;               // stub
/** What to unload (reverse order) and load (FEATURE_IDS order) to go from loaded to want. */
export function planApply(loaded: ReadonlySet<FeatureId>, want: ReadonlySet<FeatureId>): { unload: FeatureId[]; load: FeatureId[] };  // stub
export function cleanFeatures(raw: unknown): Partial<Record<FeatureId, boolean>>;  // FILLED in 0.1: unknown ids and non-booleans dropped
```

`cleanFeatures` is filled in 0.1, not stubbed: `normalizeSettings` calls it at load
(settings.ts:190-210, main.ts:147), so a stub would stop the plugin loading until 1.1
merges.

`src/core/module-context.ts` (types filled, class bodies stubbed):

```ts
/** What a module registers on the plugin for its whole life, read in init() even when it is off (Q3). */
export interface FeatureSlots {
  views?: readonly string[];          // view types
  codeBlocks?: readonly string[];     // code block languages
  postProcessor?: boolean;            // one Reading-view post-processor (Q34)
  editors?: number;                   // how many extension slots
}
export interface EditorSlot { set(exts: readonly Extension[]): void }   // the module calls updateOptions after a mid-session set
export interface ModuleContext {
  command(cmd: Command): void;                                   // raw id recorded before addCommand; removed on unload (Q2, G0a)
  ribbon(icon: string, title: string, cb: (e: MouseEvent) => void): HTMLElement | null;   // G0f: null when off at startup; turned off at runtime the icon stays and its click shows a notice
  statusBar(): HTMLElement;                                      // el.remove() on unload; on mobile the element is detached (obsidian.d.ts:4941-4947)
  view(type: string, create: ViewCreator): void;                 // binds a declared slot (Q3); throws for an undeclared type; leaves detached on unload
  editor(initial?: readonly Extension[]): EditorSlot;            // takes the next declared slot (Q4); emptied on unload
  codeBlock(lang: string, handler: CodeBlockHandler): void;      // binds a declared slot (Q5)
  postProcessor(fn: MarkdownPostProcessor): void;                // binds the declared slot (Q5, Q34); a no-op while off
  index<F extends IndexFile, V>(spec: IndexSpec<F, V>): VaultIndex<F, V>;  // disposed and removed on unload (Q7)
  follow(f: Follower): void;                                     // removed on unload
  decorate(id: DecorationId, draw: Drawer): void;                // undrawn on unload
  onLayoutReady(cb: () => void): void;                           // never runs after unload
  afterUnload(cb: () => void): void;                             // once, after onunload and after the slots are unbound; for re-rendering what the feature drew (added after the wave 1 review). Not run when the plugin itself unloads: `unloadAll` calls `end(false)` (wave 2 review)
}
/**
 * A switchable part of Escrita. Constructed once; the registry calls Component.load()
 * and unload() itself, in order (Q6). Subclasses implement onload/onunload, never
 * load/unload.
 */
export abstract class FeatureModule extends Component {
  readonly abstract id: FeatureId;
  readonly slots: FeatureSlots = {};
  protected ctx!: ModuleContext;
  /** Called by the registry before each load. */
  attach(ctx: ModuleContext): void;
  settingsChanged?(): void;
  /** Followers that keep this feature's path-keyed data current even while it is off (Q8). Touch only plugin.data and plugin.settings. */
  dataFollowers?(): Follower[];
}
```

`src/core/feature-registry.ts` (stubbed):

```ts
export class FeatureRegistry {
  constructor(plugin: EscritaPlugin, modules: ReadonlyMap<FeatureId, FeatureModule | EscritaModule>);
  /** At plugin load: view, extension and code block slots; data followers of every module. */
  init(): void;
  apply(): void;                                 // synchronous; a re-entrant call re-runs once at the end (Q12)
  isOn(id: FeatureId): boolean;
  get<T>(id: FeatureId): T | undefined;          // the module when loaded
  onChange(cb: (id: FeatureId, on: boolean) => void): () => void;
  settingsChanged(): void;                       // fans out to loaded modules only
  unloadAll(): void;
}
```

`src/core/names.ts` (stubbed):

```ts
export interface NameSource {
  id: string;                        // the entry path
  name: string;                      // the file's basename
  aliases: readonly string[];
  person: boolean;                   // a character: first-name alias allowed
  firstName: boolean;                // the per-entry option (default true)
  caseSensitive: boolean;
  ignore: readonly string[];
}
export type TermOrigin = "name" | "alias" | "first";
export interface NameTerm { id: string; text: string; words: readonly string[]; keys: readonly string[]; profile: StemProfile; origin: TermOrigin; caseSensitive: boolean }
export interface IgnorePhrase { id: string; words: readonly string[]; keys: readonly string[]; profile: StemProfile }
export interface TermTable { terms: readonly NameTerm[]; lang: StemLang | null; signature: string; ignores?: readonly IgnorePhrase[] }   // ignores: absent on EMPTY_TABLE
export interface Candidate { id: string; exact: boolean; origin: TermOrigin }   // exact: same foldName form as the term
export interface Occurrence { from: number; to: number; text: string; candidates: readonly Candidate[] }
export function matchLang(setting: "auto" | "pt-BR" | "en", locale: string): StemLang | null;
/** `extraTitles` is the `nameTitles` setting; the built-in tables (core/name-titles.ts) are picked by `lang` (both when null). */
export function compileTerms(sources: readonly NameSource[], o: { lang: StemLang | null; extraTitles: readonly string[] }): TermTable;
/** Over a mask whose offsets match the document (readerMask). Ignore phrases suppress their span. */
export function findNames(mask: string, table: TermTable, from?: number, to?: number): Occurrence[];
/** Q26: filter to the note's scope, exact form first, explicit beats first name; null when still ambiguous. */
export function pickEntry(o: Occurrence, inScope: (id: string) => boolean): string | null;
export function capitalizedTerms(table: TermTable): string[];   // for the lens (Q38)
export const EMPTY_TABLE: TermTable;
export function foldName(s: string): string;   // FILLED in 0.1b (Q23)
```

`src/core/names-source.ts` (filled here, it is small):

```ts
/** Any change to what tableFor or entryFor answers must call the onChange callbacks (review L5). */
export interface NamesProvider {
  tableFor(path: string): TermTable;                              // the terms of the note's scope
  entryFor(text: string, path: string): { path: string; name: string } | null;  // name or alias with the same foldName form (POV, Q41)
  version(): number;
  onChange(cb: () => void): () => void;
}
/** plugin.names: empty until the universe provides; the provider withdraws on unload. */
export class NamesPort implements NamesProvider {
  provide(p: NamesProvider): () => void;
}
```

`src/universe/mentions.ts` (stubbed):

```ts
export interface NoteMentions {
  occurrences: readonly Occurrence[];
  links: readonly { from: number; to: number; linkpath: string }[];   // prose wikilinks and Markdown links (Q30)
}
/** `find` is injected so the model is tested without the matcher. */
export function computeMentions(md: Markdown, find: (mask: string) => Occurrence[]): NoteMentions;
export interface MentionCtx {
  entry: string;                                                  // the entry path
  inScope(notePath: string): boolean;                             // live scope (Q20, Q31)
  candidateInScope(notePath: string, id: string): boolean;
  resolve(linkpath: string, from: string): string | null;
  workOf(notePath: string): { work: string; chapter: number | null } | null;   // chapter: 1-based position (Chapter.index), not its number; null: other notes
  /** Position of a work in the Works tab's order (groupWorks then compareWorks, works-list.ts:71-84); 5.1 builds it from plugin.works. */
  workRank(work: string): number;
}
export interface MentionRow { path: string; count: number; first: { from: number; to: number } }
export interface WorkMentions { work: string; count: number; notes: MentionRow[]; firstChapter?: string; lastChapter?: string }   // chapter paths
export interface AppearsIn { works: WorkMentions[]; other: MentionRow[]; total: number; workCount: number }
export function appearsIn(all: Iterable<[string, NoteMentions]>, ctx: MentionCtx): AppearsIn;
export function mentionsSame(a: NoteMentions, b: NoteMentions): boolean;
```

`src/outline/rows.ts` and `src/outline/pov.ts` (stubbed):

```ts
// rows.ts
export interface ChapterRow {
  path: string; index: number; label: string; title: string; summary: string;
  status: string; stage: Stage | null; pov: PovValue | null;
  piece: Piece | null; pieceSource: "own" | "book" | null; unit: PieceUnit;
  words: number; count: number; progress: Progress | null;
  beats: BeatMarker[]; placeholders: number; bodyBlank: boolean;   // parseBeats, core/markers.ts:138
}
export interface RowsPort<B> {                 // generic, so tests pass a plain book (review L1)
  chapters(book: B): { path: string; basename: string }[];
  read(path: string): Promise<{ text: string; mtime: number }>;
  frontmatter(path: string): Record<string, unknown> | undefined;
  counts(path: string, seed: { text: string; mtime: number }, unit: PieceUnit): Promise<Counts>;
  placeholders(path: string): number;          // 0 when the feature is off
  chapterDefault(book: B): ChapterDefault | null;
  resolvePov(value: unknown, path: string): PovValue | null;
  settings(): RowSettings;
  stages(): StageMapping;                      // the writer's status words, for stageOf (core/stages.ts)
}
/** The property names a row reads (the writer's settings; summaryProperty is optional). */
export interface RowSettings {
  summaryProperty?: string;
  statusProperty: string; povProperty: string; targetProperty: string; limitProperty: string;
  unitProperty: string; deadlineProperty: string; chapterTargetProperty: string;
}
export function loadRows<B>(port: RowsPort<B>, book: B): Promise<ChapterRow[]>;
// pov.ts
export const POV_PALETTE = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"] as const;
export type PovColor = typeof POV_PALETTE[number];
export interface PovValue { key: string; label: string; path: string | null }
export function povValue(value: unknown, resolve: (link: string) => { path: string; name: string } | null): PovValue | null;
export function assignColors(keys: readonly string[], store: Record<string, PovColor>): boolean;   // true when it added
export function cleanPovColors(raw: unknown): Record<string, PovColor>;
export function renamePovKey(store: Record<string, PovColor>, oldPath: string, newPath: string): boolean;
export interface TallyItem { stage: Stage | null; word: string; n: number }
export function statusTally(rows: readonly ChapterRow[], stages: StageMapping): TallyItem[];   // core/stages.ts:65
export interface RowFilter { stages: ReadonlySet<string>; povs: ReadonlySet<string> }   // stage ids or "other:<word>"; pov keys
export function rowMatches(row: ChapterRow, f: RowFilter): boolean;
export function filterActive(f: RowFilter): boolean;
/** Q44: drag and "Renumber chapters" only when no filter is on (rule 1). */
export function canReorder(f: RowFilter): boolean;
```

`rows.ts`'s `ChapterRow` is keyed by `path`. The view already has a local `ChapterRow`
keyed by `file: TFile` (outline/view.ts:23), used throughout drag, renumber and
`NoteState` (:55, :66, :1115, :1129, :1196), so 2.2 adds an adapter
`toViewRow(row, file)` and keeps the view's type; rewriting the view onto `path` is
not part of 0.7.

`src/core/measure.ts` (two stubs, beside `readBookGoal`):

```ts
export interface ChapterDefault { target: number; unit: PieceUnit | null }
export function readChapterDefault(fm: Record<string, unknown> | null | undefined, props: { chapterTargetProperty: string; unitProperty: string }): ChapterDefault | null;
export function effectivePiece(own: Piece | null, def: ChapterDefault | null, ownUnit: PieceUnit | null): { piece: Piece | null; source: "own" | "book" | null };
```

Split-feature stubs, each `class X extends FeatureModule` with an empty `onload`:
`src/editor/features.ts` (`TypingFeature`, `DialogueFocusFeature`, `MoveBlocksFeature`,
`TemplatesFeature`, `SpellcheckFeature`), `src/universe/threads-feature.ts`
(`ThreadsFeature`), `src/snapshots/stage-feature.ts` (`StageSnapshotFeature`).

Additive fields:

- `EscritaSettings`: `features: Partial<Record<FeatureId, boolean>>` (`{}`; normalized
  with `cleanFeatures` in `normalizeSettings`), `povProperty: string` (`"pov"`),
  `chapterTargetProperty: string` (`"chapterTarget"`). Both property names join
  `PROPERTY_KEYS` (settings.ts:216).
- `UniverseSettings`: `caseSensitiveProperty` (`"caseSensitive"`), `ignoreProperty`
  (`"ignore"`), `firstNameProperty` (`"firstName"`), `nameTitles` (`""`, extra titles
  beyond the built-in tables, Q29), `underlineNames: boolean` (false).
- `EscritaData.povColors: Record<string, PovColor>` (default `{}`).
- Plugin fields: `features!: FeatureRegistry`, `names!: NamesPort`.

**0.1b [core] `foldName`** (review M1), done 2026-10-03 after the wave 0 review. A
filled, tested `export function foldName(s: string): string` in `src/core/names.ts`:
`normalizeWord` (NFC, lowercase, ’ → '), then NFD, drop `\p{M}`, NFC, trim. Tests in
`tests/names-fold.test.ts`. It is the one fold for names: the matcher's keys
(`stem(foldName(word))`, Q23), `Candidate.exact` (1.2), `entryFor` (3.1) and the POV
keys (1.3) all compare `foldName` forms, so no task writes its own. In the same
follow-up, type-only changes from the review: `RowsPort<B>` and `loadRows<B>` in
`src/outline/rows.ts` (L1); `MentionCtx.workOf`'s `chapter` documented as the chapter's
position and `firstChapter`/`lastChapter` as paths in `src/universe/mentions.ts` (M3);
the `onChange` duty documented on `NamesProvider` (L5); the pt titles gain *Irmão,
Senhor, Senhora, Doutor, Doutora* in `src/core/name-titles.ts` (L6).

**0.2 Names fixtures**, a different agent from 1.2, effort S–M. Runs in parallel with
0.1 (no shared file).

- Create `tests/fixtures/names/entries.tsv` (one entry per line: id, name, aliases,
  kind, options) and `tests/fixtures/names/{pt,en}-*.md` with
  `tests/fixtures/names/{pt,en}-expected.tsv` (`file\tline\ttext\tentry`; `-` for a
  mention that must not match), each with a header comment saying where the values
  come from. Expected values are written from the specs, not from any code.
- Must-have cases, pt: *Mariazinha* and *Marias* → Maria; *Mariano* and *Mariana* apart;
  *Marcos* entry and *Marco* entry in one scope (each exact form wins; "os dois
  Marcos" → Marcos, since the exact form wins; no form fits both, so there is no `-`
  row for it); *Rosa* the character inside "rosa dos ventos" with that phrase in
  `ignore` (`-`), and elsewhere (Rosa); *Dona Maria Clara* with first name *Maria* and
  another entry *Maria José* (bare *Maria* is `-`, ambiguous; "Maria Clara" without
  *Dona* → Dona Maria Clara, Q29); *Porto* (lowercase *porto* `-`, all-caps *PORTO*
  in a heading counts, G3); lowercase common words that are also entries (*a blusa rosa*,
  *acendeu a luz*, *o mar*, *beija-flor*) are `-`; an alias "o menino" with *os meninos*
  (`-`, no article rule, G3; `"word"`); a name split by a line break and by `*emphasis*`; a mention in a heading
  (counts); in a comment, a code block and frontmatter (`-`); `[[Teo|o menino]]` (one
  mention of Teo, no match for "o menino" inside it); accents folded before stemming
  (Q23): *Inês* and *Ines* → Inês, *Tomás* and *Tomas* → Tomás, *Thaís* and *Thais* →
  Thaís, *Andrés* and *Andres* → Andrés, *Mario* → Mário; hyphens (Q25): *Maria-José* →
  Maria José, and *rosa-dos-ventos* is `-` (the ignore phrase covers it).
- pt titles: *Dona Benta Encerrabodes* gives the first name *Benta* through the built-in
  pt titles, and a bare "dona" in prose is `-`; *Irmão*, *Senhor*, *Senhora*, *Doutor*
  and *Doutora* are skipped like the others (*Doutor Paulo Mendes* gives *Paulo*); *Irma*
  is a given name, not the title *Irmã*; *Coronel*, *Capitão*, *Professor* and *Professora*
  are titles; *Senhor Antunes* gives *Antunes*.
- en: *Teo's* and *Teos* → Teo; *James* not stemmed to *jame*; *Mr Brown* with titles
  (a bare *Brown* is Mr Brown, G3); a one-letter alias and a
  stop-word alias (`-`).
- These defaults were recorded after the wave 0 review; the author reviews them at G3
  with the rest of the rows.
- Done when the files parse and the author has the G3 link. The rows are then frozen.

## Wave 1: foundations (parallel)

**1.1 [core] The registry, the module context and index removal**, depends on 0.1, G0a,
G0b, G0e, G0f (all cleared), effort M. **The improvement.**
- Fill `src/core/features.ts` (the functions), `src/core/module-context.ts`,
  `src/core/feature-registry.ts`; change `src/core/index-hub.ts`,
  `src/core/vault-index.ts`, `src/core/vault-indexes.ts`, `src/main.ts`,
  `src/data.ts`, `manifest.json` (`minAppVersion: "1.7.2"`), `package.json`
  (`happy-dom` as a dev dependency); create `vitest.config.ts`,
  `tests/support/obsidian.ts`, `tests/support/fake-plugin.ts`,
  `tests/features.test.ts`, `tests/module-context.test.ts`,
  `tests/index-hub-remove.test.ts`. Keep `tests/core-features.test.ts` (from 0.1;
  review L3) and add the new `cleanFeatures` and title cases to it rather than
  repeating them in `tests/features.test.ts`, so the two files don't diverge. Fix the
  header comments of the files it fills (review L2).
- `VaultIndex.dispose()` also clears its map and sets it not ready
  (core/vault-index.ts:126-136 leaves the map answering today).
- `IndexHub.add` returns the index as today, plus `IndexHub.remove(index)`: clears its
  fallback timer, disposes it, splices the entry (index-hub.ts:83-98). The shell gains
  `remove`. `settingsChanged` and `rebuild` then never see a removed spec.
- `ModuleContext` (one per module, owned by the registry): records each disposer and
  runs them in reverse on unload. Commands go through `plugin.addCommand` and
  `removeCommand` with the raw id (G0a), a fresh `Command` object per load. Ribbon icons
  per G0f, with no private API: `ribbon()` returns null and adds nothing when the
  feature is off at startup; a feature turned off at runtime keeps its icon until the
  next restart, and the context swaps its callback for one that shows a notice that the
  feature is off (a new string in `src/strings.ts`); turned on again, the icon is added
  with the same title, which updates the same ribbon entry. A view slot unloads by
  detaching its leaves itself (G0b: unregistering leaves ghost panes). Slots are created in `init()` from each
  module's `slots`: every declared view type, extension array, code block processor
  and post-processor is registered once on the plugin. A view slot's factory builds
  the module's view when the feature is on and a bare placeholder `ItemView` when it is
  off. `editor(initial)` takes the module's next declared array and returns its
  `set`; the registry empties the arrays on unload and calls
  `workspace.updateOptions()` once at the end of `apply()` when any slot changed. The
  post-processor slot calls the bound function only while the feature is loaded. `onLayoutReady(cb)` runs `cb` only if the module
  is still loaded (the guard explorer/index.ts:73 and snapshots/index.ts:150 write by
  hand).
- `FeatureRegistry`: `init()` builds the slots and registers every module's
  `dataFollowers()` through `plugin.index.follow`. `apply()` (synchronous, re-entry
  guarded, Q12) computes `wanted(settings)`, calls `module.unload()` in reverse order,
  detaches the leaves of unloaded features' views, calls `attach(ctx)` then
  `module.load()` in `FEATURE_IDS` order, then one `updateOptions`, then `onChange`
  callbacks. Modules are not children of the plugin (Q6). `unloadAll()` is the first
  thing `plugin.onunload` does and is idempotent. At layout ready it detaches leaves of
  features that are off. A module that is still an old `EscritaModule` is
  wrapped in an adapter that calls `load`/`unload`, so wave 1 ends with everything
  working; wave 2 removes the adapter's users.
- `main.ts`: builds the modules as today (main.ts:116-127) plus the split stubs,
  hands them to the registry keyed by id (the old editor, snapshots and universe
  modules carry `typing`, `snapshots` and `universe`; the stubs carry the rest), calls
  `init()` and `apply()` in place of the load loop (main.ts:128-131), `unloadAll()` in
  `onunload` (main.ts:136-143), and `features.apply()` then `features.settingsChanged()`
  in `saveSettings` (main.ts:165-169). `plugin.names = new NamesPort()` before the
  modules. `EscritaModule` (data.ts:42-47) stays for the adapter and is marked
  deprecated.
- `tests/support/obsidian.ts`: a working `Component` (`load`, `unload`, `addChild`,
  `removeChild`, `register*` with real cleanup, in Obsidian's order: children popped,
  then callbacks, then `onunload`) and no-op stand-ins for every `obsidian` export
  `src/` imports (grep the imports; Notice, Modal, ItemView, Setting, `setIcon`,
  `setTooltip`, `debounce`, `Platform`, `TFile`, `moment`…), plus real CodeMirror
  `StateField`s for `editorInfoField` and `editorLivePreviewField`. `vitest.config.ts`
  aliases `obsidian` to it and runs `tests/lifecycle-*` in the `happy-dom` environment,
  with Obsidian's `HTMLElement` helpers (`createDiv`, `createEl`, `createSpan`,
  `addClass`, `toggleClass`, `setText`, `empty`…) polyfilled in a setup file. The rest
  of the suite stays in node. No existing test imports `obsidian`, so none changes.
- `tests/support/fake-plugin.ts`: one fake plugin (`books`, `measure`, `index`,
  `decorations`, `works`, `notes`, `names`, `features`, `settings`, `data`,
  `requestSave`, `saveSettings`, a recording `app.workspace`) that every lifecycle test
  shares, so wave 2 doesn't write eleven copies.
- Tests:
  - `features.test.ts`: missing key means on; `explorerCounts` and `universeMode`
    switches; `requires` closure (snapshots off takes stageSnapshot off, and its
    stored value is untouched); `planApply` orders (unload reverse, load forward);
    `cleanFeatures` drops unknown ids and non-booleans.
  - `module-context.test.ts`: with fake modules and a recording plugin, every kind of
    registration is undone on unload; a slot is registered once across three
    load/unload cycles; `ctx.view` with an undeclared type throws; a feature off at
    startup gets a placeholder view and its restored leaf is detached at layout ready;
    the post-processor slot is a no-op while off; an editor slot's `set` replaces and
    unload empties it; `onLayoutReady` after unload never runs; one `updateOptions` per
    apply; data followers run while the module is off; `apply` called from inside a
    follower and twice in a row ends in the right state; `unloadAll` runs modules in
    reverse `FEATURE_IDS` order before the final persist, and twice is harmless; a
    status bar element that was never attached (mobile) is removed without error; a
    disposed index answers nothing; a ribbon icon is never added for a feature off at
    startup, and after a runtime switch-off its click shows the notice and runs
    nothing; switched on again, one icon with the same title.
  - `index-hub-remove.test.ts` (MemoryVault and ManualTimers): a removed spec stops
    receiving events and settings rebuilds; re-adding one with the same name builds
    it again; removing during a build stops it.
- Done when every existing test passes and the plugin works in a test vault exactly
  as 0.6.0 (all features on).

**1.2 [core] The names matcher**, depends on 0.1, 0.2, effort M
- Fill `src/core/names.ts`; create `tests/names.test.ts` and
  `tests/names-fixtures.test.ts`.
- `compileTerms`: per source, the name and each alias become terms (the first word of
  a person's name after skipping titles, Q29, becomes an `origin: "first"` term).
  Each word is folded with `foldName` (0.1b: `normalizeWord`, then accents removed)
  **before** it is stemmed with the term's profile (Q22) and the table's language:
  `key = stem(foldName(word), lang, profile)`; with no language the key is the folded
  word. The same fold applies to occurrence tokens, ignore phrases, the built-in titles
  and `nameTitles` (Q23). In a multi-word term, pt articles and contractions key to
  their number pair (Q25). The full name minus its leading titles is also a term
  (Q29). Terms of one letter or a single stop word are dropped (Q27). The
  signature is a stable string of every input that changes matching (Q33).
- `findNames`: `tokens(mask)` (core/tokens.ts:11-19), then a lookup by first-word key
  into a map of terms, then `findPhrase`-style extension for multi-word terms with
  the gap rule (Q25). Longest match per position; ignore phrases (matched the same
  way) remove occurrences inside their span. A case-sensitive term needs the raw
  casing to match before the stem (core/stem/index.ts:19-22). `exact` is true when
  the occurrence's `foldName` text equals the term's. A hyphenated token also matches
  as its parts when both are letters and the joined form isn't a term (Q25). Fix the
  file's header comment (it says U 1.1; the matcher is U 1.2; review L2).
- `pickEntry` per Q26. `capitalizedTerms` per Q38. `matchLang` like `lensLang`
  (lens/lang.ts:10-16) mapped to `StemLang`.
- Tests: each fixture file through `readerMask(segment(text))` gives the expected
  mentions (resolved with `pickEntry` and an all-in-scope predicate); unit cases for
  titles, the gap rule, the longest match, ignore spans, case-sensitive terms, no
  language, an empty table, the signature changing only when matching inputs change;
  accent pairs with the same key (*Inês/Ines*, *Tomás/Tomas*, *Thaís/Thais*,
  *Andrés/Andres*, *Mário/Mario*) and `exact` true for both forms; *Irma* not a title
  (accents kept); *o menino* not matching *os meninos* or *a menina*; *Maria-José*
  matching the entry *Maria José*, and hyphenated terms and ignore phrases matching;
  *Maria Clara* matching *Dona Maria Clara*; a bare *Brown* matching *Mr Brown*;
  a **CI ceiling**: 300 entries against a 10,000-word note under 100 ms, and a local
  budget (`it.skipIf(!!process.env.CI)`) of 20 ms median, recorded in ARCHITECTURE.

**1.3 Chapter rows and the POV model**, depends on 0.1, effort M. **The second
improvement.**
- Fill `src/outline/rows.ts` and `src/outline/pov.ts`; create
  `tests/outline-rows.test.ts` and `tests/outline-pov.test.ts`.
- `RowsPort<B>` and `loadRows<B>(port, book)` are generic over the book (0.1b), so the
  tests pass a plain object; titles and labels come from `chapterTitle` and
  `chapterNumber` (core/book.ts, pure) applied to the port's `basename`. Fix the header
  comments of `rows.ts` and `pov.ts` (they say "until 2.2"; review L2).
- `loadRows(port, book)`: for each chapter, in order, read text and frontmatter
  through the port, title and summary as today (`str`/`oneLine`, outline/view.ts:72-78,
  moved here; `stringOf` at outline/index.ts:256 goes in 2.2), status and its stage
  (`stageOf`, core/stages.ts:65), POV through `port.resolvePov`, the effective piece
  through `effectivePiece` (stubbed until 1.4; the test injects a port, so the row
  logic is tested against the contract), counts in words and in the piece's unit,
  `noteProgress`, beats (`parseBeats`, core/markers.ts:138, as outline/view.ts:291), the placeholder count from the port, and
  `bodyBlank`. Reads run in parallel, as `measure.book` does.
- `pov.ts` per Q41–Q45: `povValue` uses `linkText` semantics (copied, no universe
  import) and the resolver; text keys are `foldName` forms (0.1b, Q23), so *Inês* and
  *Ines* share a colour, the label as written.
- Tests: rows from a fake port (status, POV link and text, own target, book default
  with own unit, no piece, placeholders from the port, characters unit); `assignColors`
  is stable across calls and orders, never reassigns, repeats after eight;
  `cleanPovColors` drops bad values; `renamePovKey`; `statusTally` by stage with the
  writer's words, an unknown status, no status; `rowMatches` OR within and AND across
  groups; `canReorder` false whenever a filter is on.

**1.4 [core] The chapter default target**, depends on 0.1, effort S
- Fill `readChapterDefault` and `effectivePiece` in `src/core/measure.ts`; create
  `tests/measure-chapter.test.ts`.
- Per Q47–Q48, using `parseAmount` and `parseUnit`. `effectivePiece` keeps the own
  piece's `limit` and `deadline`, and fills only a missing `target`. The unit follows
  Q47 (review M2): `ownUnit ?? def?.unit ?? "words"`, where `ownUnit` is null when the
  chapter has no unit property. `readPiece` always sets a unit (`parseUnit` gives
  `"words"` when the property is missing), so `own.unit` is ignored when `ownUnit` is
  null.
- Tests: own target wins; default fills; own limit kept with a default target; unit
  precedence (own, then book, then words); a chapter with only a `deadline` in a book
  whose unit is `characters` gives characters; a bad or zero amount gives no default;
  no frontmatter.

**1.5 `universe: false` in the scope rules**, depends on 0.1, G0g (cleared), effort S
- Change `src/universe/scope.ts`; change `tests/universe-scope.test.ts`.
- In the loop at scope.ts:103-108, read `lookup.universe(path)` first: `false` returns
  `bookScope` (Q17); a link joins as today. The file comes before its book note, so a
  chapter's own link beats the book's `false` and its own `false` beats the book's
  link (Q18). Export `keptOut(path: string, lookup: ScopeLookup): boolean` (own `false`,
  or the book note's `false` with no own link). Update the rules comment
  (scope.ts:10-16) with a rule 0.
- Tests (the cases in the universe-false map): `false` in the universe folder, in a
  default folder, on the universe note itself; on a book note (chapters and a
  `Characters/` file out, a chapter with its own link in); a chapter's `false` under a
  linking book note; per-book and off modes unchanged; `true`, `0` and `""` behave as
  before; the YAML boolean `false` and the string `"false"` (trimmed, any case:
  `" False "`, `"FALSE"`) both count as false, a list `["false"]` does not (Q15, G0g);
  `keptOut` for each.

**1.6 The mentions model**, depends on 0.1, effort S–M
- Fill `src/universe/mentions.ts`; create `tests/universe-mentions.test.ts`.
- `computeMentions`: segment, `readerMask`, the injected `find`; links from prose spans
  only (`segment`, core/markdown.ts:1-35): `[[target|text]]`, `[[target#h]]`,
  `[text](target.md)` with the target unescaped; embeds skipped. An occurrence inside
  a link's span is dropped (Q30).
- `appearsIn` per Q26, Q30–Q32: occurrences resolved with `pickEntry` against
  `candidateInScope`; links resolved with `resolve` and counted when they hit the
  entry; the entry's own note skipped; notes out of scope skipped; grouped by
  `workOf`, works ordered by `workRank`, chapters by their position in the book
  (`Chapter.index`, books.ts:14; not the chapter number, which can be null or repeat;
  review M3), first and last chapter only inside a book, held as chapter paths (the
  view labels them); `first` is the earliest range in each note. Fix the header
  comment (it says "until 3.2"; review L2).
- Tests with a fake `find` and fake ctx: grouping, ordering (two unnumbered chapters
  ordered by position), self-mentions, scope filtering, links counted once, an ambiguous occurrence counted nowhere, an empty
  result; `mentionsSame` compares ranges and candidates.

## Wave 2: every module on the registry (parallel)

Each task moves one module folder onto `FeatureModule` and its `ModuleContext`, with
no change in behaviour apart from what is named. **Each module's `load()`/`unload()`
become `onload()`/`onunload()`** (Q6; keeping the old names would override
`Component.load`/`unload`), it declares its `slots`, and it drops its index fields in
`onunload`. Raw `workspace.onLayoutReady` calls (darlings:72, goals:114, lens:96,
desk:56, universe:98, snapshots:150, explorer:72) become `ctx.onLayoutReady`. Wave 2
changes no visible UI (G1). Each task owns its folder and creates
`tests/lifecycle-<module>.test.ts` on the shared fake plugin: load the module through
a recording context and the obsidian stub, assert `onload` ran, unload it, and assert
nothing is left (Q52); load it again and assert one of each registration; run its real
data followers on a module that was never loaded. Each is done when its commands, views and editor
behaviour work in a test vault, and switching it off and on (by editing
`data.json` and reloading settings, since the Features page comes in 4.1) leaves no
command, view, menu item or listener behind.

**2.1 Goals**, effort S–M. Own `src/goals/*`. Status bar and ribbon through the
context (goals/index.ts:62, :70); the bare `updateListener` (goals/index.ts:88) into
the extension slot; the sprint interval through a clearable module-scoped timer
instead of a new `registerInterval` per sprint (goals/index.ts:315-316); `onunload`
stops a running sprint's timer without losing its count and closes the progress modal
if open. The follower at goals/index.ts:102 splits (Q8): the history rename
(`renameBook`, :212) becomes a data follower; the active files, baseline and
`refreshStatus` (:205-210, :216) stay on a follower registered while loaded. The status
bar code must not assume its element is attached (mobile).

**2.2 Outline**, depends on 1.3, 1.4, effort M. Own `src/outline/index.ts`,
`src/outline/view.ts`. Registration through the context (outline/index.ts:31-79); the
editor extension array (outline/index.ts:78) into a slot whose `set` the ghost-beats
setting refills (outline/index.ts:88-91). The view maps `rows.ts` rows to its own
`ChapterRow` with `toViewRow(row, file)` (0.1). `OutlineView.loadRows`
(outline/view.ts:276-298) and `openBoard` (outline/index.ts:152-167) both call
`rows.loadRows` with a port built in `view.ts` (`chapterDefault` from the book note's
frontmatter through `readChapterDefault`; `resolvePov` with
`metadataCache.getFirstLinkpathDest` then `plugin.names.entryFor`; `placeholders`
from `plugin.placeholders.countFor` when `features.isOn("placeholders")`, else 0).
Rows now carry the new fields; rendering of them waits for 4.3. The local
`parsePlaceholders` count (outline/view.ts:292) and `stringOf` go. The subscription
at outline/view.ts:185 now hits placeholders' stable listener set (2.3).
Two behaviours of the row loader must match the view as it was (wave 1 review): the
chapter label stays the raw digits of the file name, `/^\d+/.exec(basename)?.[0] ??
String(i + 1)` (so "01" stays "01", and "12abc" still falls back to the position), not
`String(chapterNumber())`; and a blank `unit` (`""`) is null in both `rows.ts` and
`readChapterDefault`, so it never overrides the book's unit. Add a test row for each.
Test: the existing outline tests pass unchanged; `tests/lifecycle-outline.test.ts`.

**2.3 Placeholders**, effort S. Own `src/placeholders/*`. Fix the double push on
reload (placeholders/index.ts:95-96) by using the slot; `onChange` keeps its own
stable listener set fed by the index while loaded (today it forwards to an index that
may be null, :60-62); the index through `ctx.index`; the explorer dots through
`ctx.decorate` (:120).

**2.4 Darlings**, effort S. Own `src/darlings/*`. View, commands, menus and events
through the context and the module's `Component`; the timer at darlings/index.ts:121
cleared on unload as today.

**2.5 Editor, split into five features**, effort M. Own `src/editor/*`, plus the
editor's construction lines in `src/main.ts` (main.ts:22, :71, :121; the listed
exception), so the ids map to the new classes and `EditorModule` goes. The static
array at editor/index.ts:64-72 splits by feature: `lastReplacement`, the Enter and
Backspace keymap and the input handler go to `TypingFeature` (with
`smartTypography`, `enterFlow` and `dialogueDash` still read at call time);
`dialogue.extension` and "Toggle dialogue focus" to `DialogueFocusFeature`; the four
move commands (editor/index.ts:111) to `MoveBlocksFeature`; "Insert from a template"
to `TemplatesFeature`; the spellcheck slot (editor/index.ts:73, :149-165, refilled through `set`) and "Toggle
spellcheck" to `SpellcheckFeature`, whose switch is `spellcheckOnDemand` (Q10): loaded,
it suppresses spellcheck until toggled; unloaded, spellcheck is Obsidian's own. "Insert scene break" stays with typing. The old
`EditorModule` keeps only shared session state, if any is left, or goes. The follower
at editor/index.ts:123 (dialogue focus on-set, session only) stays with dialogue
focus. Lifecycle tests per feature in `tests/lifecycle-editor.test.ts`.

**2.6 Lens**, effort S–M. Own `src/lens/*`. `LensUi.load` (lens/ui.ts:57-110):
view and marks (`lens/ui.ts:61`, :69) through the slots; commands and menus through
the context. The lists index through `ctx.index` (lens/index.ts:60-75). The
follower at lens/index.ts:77-95 splits (Q8): the dismissals and the lists-note path
become a data follower (it must not touch `this.session`, which is undefined when the
lens was off at startup, and whose error the hub would swallow, core/index-hub.ts:246);
the session and shown-cache moves and the on-set follower stay on a follower registered
while loaded. The session's timers (lens/index.ts:44-48) are cleared by
`session.dispose()` on unload, as today (:56).

**2.7 Snapshots and the stage snapshot**, effort M. Own `src/snapshots/*`. Views
(snapshots/index.ts:102-103), commands, the file menu and events through the context.
The rename handler (snapshots/index.ts:142, :567-585) becomes an always-on follower,
so snapshots follow their note while the feature is off (Q8, a listed deviation): it
finds the file or folder with `getAbstractFileByPath(newPath)`, reads `this.store`
built at construction (not at load), and leaves `shownPath` (session state) to a
follower registered while loaded. Tests with snapshots never loaded: a file rename, a
folder rename, and a rename of the snapshots root (the setting follows, through the
re-entry-safe `saveSettings`). `watchStages`
(snapshots/index.ts:168-184) moves to `StageSnapshotFeature`, which reaches the store
through `plugin.snapshots` (loaded, by `requires`). `beforePublish` stays on the
snapshots module.

**2.8 Publish**, effort S. Own `src/publish/*`. Commands and the file menu through the
context; the publish records follower (publish/index.ts:58) becomes a data follower;
`beforePublish` is called only when `features.isOn("snapshots")`
(publish/index.ts:141, Q11).

**2.9 Explorer**, effort S. Own `src/explorer/*`. Its switch is `explorerCounts` (Q10).
The events registered inside `onLayoutReady` (explorer/index.ts:72-87) move to
`ctx.onLayoutReady` with the module's own `registerEvent`; the decoration through
`ctx.decorate` (:69). Its `unload` (:92-103) stays.

**2.10 Desk**, effort S–M. Own `src/desk/*`. The code block through the code block
slot with the plain-code fallback (desk/index.ts:30-35, Q5); on a desk toggle, open
Markdown leaves re-render (Q5) so blocks appear and disappear without reopening the
note. The recorder's events and DOM event through the module's `Component`
(desk/recorder.ts:103-118); the `leftOff` and home note follower (desk/index.ts:41-52)
becomes a data follower; the recorder's `pending` follower (recorder.ts:113-116) is
session state and stays with the loaded recorder. `openWork` (desk/open.ts) opens
without a record when the desk is off (Q11). Startup open keeps its cold-start guard
(desk/index.ts:28). Unload unloads live blocks (desk/index.ts:19). The re-render on a toggle goes through `ctx.afterUnload` (0.7 wave 1 review): it runs after `onunload` and after the code block slot is unbound, so the blocks draw as plain source; re-registered on each load. Re-rendering from `onunload` itself would still see the handler bound. Tests: the code block
draws plain code while off; `openWork` with the desk off ignores `leftOff`.

**2.11 Universe and open threads**, depends on 1.5, effort M. Own `src/universe/*`
(it leaves `scope.ts` and `mentions.ts` as wave 1 wrote them).
  **As built (wave 2 review, recorded 2026-10-03):** `keptOut(path, lookup, settings)`
  takes the settings as a third argument; the core field `plugin.threads` was added; and
  2.7 and 2.11 each edited `src/main.ts` (constructor arguments the 0.1 stubs lacked),
  beyond 2.5's exception. Tasks 3.1 and later cite the new signature and field.
- Split: `UniverseModule` (switch: mode, Q10) keeps the entries index, the panel, the
  three universe commands and the menus (universe/index.ts:378-441);
  `ThreadsFeature` takes the threads index, the threads view, the thread marker
  extension (universe/index.ts:105, into a slot), "Show open threads", "Plant a
  thread" and "Close thread". The `threadSeen` follower (:94) becomes a data
  follower of threads.
- `keptOut` and `scopeFor` must agree (wave 1 review): in `keptOut` an own link wins only
  when it resolves; a chapter whose own link names nothing, under a book note set to
  `false`, is out for both. Add that case to `tests/universe-scope.test.ts`.
- `syncMode` (universe/index.ts:370-376) and the `checkCallback` mode checks go: the
  registry loads and unloads the universe with the mode. Commands keep `checkCallback`
  only for what they check besides the mode (an active Markdown note). Hiding the
  panel's Threads tab when threads is off is UI and goes to 4.2.
- Where each method lives (manual check 7 needs threads to work with the universe
  unloaded): `threads()` and `threadsOf()` move to `ThreadsFeature` (it owns
  `threadsIdx`), and `universe.threads()` delegates to it; the stateless helpers that
  thread code calls (`scopeOf`, `closeThread`, `reopenThread`, `answerLink`,
  `worksIn`; create.ts:281, :335-356; view-threads.ts:166, :176) stay callable while
  the universe is unloaded and never touch its index fields (`worksIn` reads
  `plugin.works`). A lifecycle test closes a thread with the mode off.
- `universe: false`: `keptOut(file)` on the module from scope.ts's `keptOut` and the
  existing lookup (universe/index.ts:338-355); the view hides "Add to" when it is true
  (view.ts:333, Q19). Test that `addToUniverse` refuses a note with `false`.
- Lifecycle tests for both features.

## Wave 3: composition and wiring (parallel)

**3.1 Entries without stored scope, and the names provider**, depends on 1.2, 1.5,
2.11, effort M
- Change `src/universe/entries.ts`, `src/universe/index.ts`; create
  `src/universe/names-provider.ts`; change `tests/universe-entries.test.ts`; create
  `tests/universe-names-provider.test.ts`.
- `Entry` loses `scope` and gains `caseSensitive`, `ignore` and `firstName`, read
  through the three property settings (Q28); `sameEntry` (entries.ts:55-59) compares
  the new fields and not scope; `entriesSettingsKey` (:90-96) includes the three
  property names. `entriesIn` and the module's `entries(scope)` and `entry(path)` read
  scope live (Q20). The entries spec drops `structural: true` (entries.ts:103), which
  existed only because scope was stored; structural specs recompute every file on every
  create, delete or rename (core/vault-index.ts:333-336).
- `UniverseNamesProvider implements NamesProvider`: one `TermTable` over every entry
  for the mentions index (`globalTable()`), and `tableFor(path)` per scope, cached by
  scope key and the global signature. `entryFor` matches names and aliases
  whose `foldName` form (core/names.ts, 0.1b) equals `foldName(text)` among the scope's
  entries (not `foldText`, which stays for the panel's search). `version()` bumps
  only when a table's signature changes (not on thread edits). The universe provides
  it to `plugin.names` on load and withdraws it on unload.
- Tests: `sameEntry` with each new field; scope not stored; the spec is not structural; the provider's table per
  scope, its version stable across thread changes and a scope-only change, bumped by
  an alias edit; `entryFor` with accents and aliases; an empty port after withdraw.

**3.2 The mentions index**, depends on 1.2, 1.6, 3.1's contract (the 0.1 types),
effort M
- Create `src/universe/mentions-index.ts`, `tests/universe-mentions-index.test.ts`,
  `tests/universe-mentions-fixtures.test.ts`.
- `class MentionsIndex`, constructed with `{ add(spec), rebuild(name), table():
  TermTable, timers }` (no import of 3.1's file): a content spec `universe-mentions`
  over `isUniverseNote`, `compute = computeMentions(segment(text), m => findNames(m,
  table()))` (returning `undefined` for a note with nothing, Q31), `same =
  mentionsSame`, not structural. **The spec is added only once the entries index is
  ready and the provider has its first table**, so startup does one full build, not
  one against an empty table and a second 2 s later (a content spec builds at layout
  ready, core/index-hub.ts:154, while the entries index waits for `resolved`,
  :158-164). `tableChanged()` debounces 2 s, then rebuilds when the signature differs
  from the last build's (Q33). `appearsIn(entry, ctx)` and `workCount(entry, ctx)` read
  **a per-entry aggregate** rebuilt once per index change, with a per-note scope memo
  cleared on metadata and structure changes, not a walk over every occurrence per
  entry: the Entries tab asks for every row on every panel refresh
  (view-entries.ts:92, view.ts:49-55). `onChange`, `isReady`.
- Tests on MemoryVault and ManualTimers: build, modify (300 ms settle), rename and
  delete of a work; an alias change rebuilds once after 2 s and keeps old values until
  done; a thread edit doesn't rebuild; no build starts before the entries index is
  ready, and startup does exactly one full build; 300 entries' counts come from the
  aggregate with no per-entry occurrence walk; the fixture notes through the real
  matcher give the expected per-entry counts (snapshot, written after G3); **CI
  ceilings derived from G0h** (the per-word cost of `segment + readerMask + findNames`
  times the vault's words, with a stated margin): a 500-note case and a 5,000-note case
  of 2,000 words each with 300 entries, both yielding between batches (default batch
  40). The figures and the phone figure go into ARCHITECTURE.

**3.3 The lens reads names**, depends on 1.2, effort S–M
- Change `src/lens/session.ts`, `src/lens/index.ts`; create `src/lens/names.ts`,
  `tests/lens-names.test.ts`; change `tests/lens-session.test.ts`.
- The session's `analyze` becomes `(path, text, version)` (lens/session.ts:36, :186).
  `options(path)` (lens/index.ts:184-197) sets `lists.names` to
  `mergeNames(lists.names, capitalizedTerms(plugin.names.tableFor(path)))` (Q38). The
  pass key (lens/index.ts:118-123) includes `plugin.names.version()`; a change calls
  the existing `invalidate()`. `plugin.names.onChange` is subscribed through the
  module's `register`.
- Tests: `mergeNames` de-duplicates and keeps list names; lowercase terms are not fed;
  a session test that a different path gets different names; a names version bump
  re-runs a note with the lens on.

**3.4 [core] POV colours in data**, depends on 1.3, 2.2, effort S
- Change `src/main.ts` (`povColors: cleanPovColors(raw.povColors)` in `loadAll`,
  main.ts:148-156) and `src/outline/index.ts` (the outline's `dataFollowers()` returns a
  follower calling `renamePovKey`; a public `OutlineModule.colorsFor(keys)` runs
  `assignColors` and calls `requestSave` when it added a key; the view calls it when
  rows load, in 4.3, since rows load in view.ts, which 3.4 doesn't own).
- Tests: add the follower case (a rename moves the colour; a delete keeps it) to
  `tests/outline-pov.test.ts` (1.3's file in wave 1; 3.4 owns it in wave 3).

## Wave 4: the UI (parallel, gated)

Each task is done when typecheck, test and build pass and its pure helpers have unit
tests; the comparison with G1 happens in 5.2.

**4.1 [core] The Features page, the writing language row and settings that follow the
switches**, depends on G1a, 1.1, effort M
- Change `src/settings.ts` (a private `featuresSection(containerEl, save)` called first
  in `display()`, then the "Writing language" row moved from the Revision section,
  Q14, then an always-shown "Properties and folders" section) and `src/strings.ts`
  (`settings.features.*`: group names, one name and one line per feature, "Needs
  snapshots"; the two new property rows; en and pt-BR); create
  `tests/settings-features.test.ts` (every feature has a name and a line in both
  languages; every settings row maps to a feature or to "always").
- A switch saves `features[id]` (or `explorerCounts`, `spellcheckOnDemand`); the
  universe row is the mode dropdown, the only one (4.5 replaces the universe
  section's dropdown with a line pointing here). A dependent's switch is disabled
  while its requirement is off. Saving runs `saveSettings`, so the registry applies
  and the tab redraws.
- Settings follow the switches row by row (Q13): a small table in settings.ts maps
  each row to the features that read it, and a row draws while any of them is on. The
  piece and goal property names (settings.ts:323-345) and the new `povProperty` and
  `chapterTargetProperty` rows (beside `goalProperty`), and the track and exclude
  folders (:283-292), move into "Properties and folders"; the explorer rows
  (:307-322) move under the explorer feature; the old `explorerCounts` and
  `spellcheckOnDemand` toggles go (Q10); `placeholderMarker` shows while placeholders
  or publish is on; `quoteStyle` and `paragraphStyle` while typing or the lens is on.
  The lens's "Create" button (settings.ts:489) shows only when the lens is on.

**4.2 "Appears in": the count and the entry note's section**, depends on G1b, G0d,
3.2, effort M
- Create `src/universe/appears-in.ts` (DOM for the list, shared by the panel and the
  note), `src/universe/appears-in-widget.ts` (the CodeMirror `StateField` block widget
  and the Reading-view post-processor, Q34), `src/universe/appears-in.css`; change
  `src/universe/view-entries.ts` (the count beside the name, view-entries.ts:92-103),
  `src/universe/view-strings.ts`, `src/universe/view-parts.ts` and
  `src/universe/view.ts` (`PanelCtx` gains optional `counts?: (path) => number | null`
  and `appearsIn?: (path) => AppearsIn | null`, view-parts.ts:17; `drawEntry` only gets
  a `PanelCtx`, view-entries.ts:92).
- The panel: the count beside the name opens the list under the entry's row (Q34).
  The Threads tab is hidden while threads is off (`features.isOn("threads")`).
- The widget reads from a callback `(path) => AppearsIn | null` and a version, so 5.1
  wires it without this task touching `index.ts`. Rows open the note and select the
  first mention after checking the text (Q34). Collapsed by default; open state per
  session in a module-level set.
- Tests: a pure helper for the one-line summary and plural forms; a pure helper that
  checks a stored range against the live text before selecting.

**4.3 The outline: stripe, toggle, chips, summary, bar**, depends on G1c, 2.2, 3.4,
effort M
- Change `src/outline/view.ts`, `src/outline/styles.css`, `src/outline/strings.ts`;
  create `src/outline/header.ts` (the toggle, chips and summary, lifted out of
  `render()`, outline/view.ts:409-432), `src/outline/bar.ts` (one piece bar helper,
  `renderPieceBar(parent, progress, count, piece)`, from outline/view.ts:525-541).
- The stripe via a CSS variable on the chapter group (the `--escrita-dot` pattern,
  outline/view.ts:608); POV mode reads `data.povColors`; the toggle state in
  `getState`/`setState`; filters per Q44 (drag and "Renumber" disabled while
  filtered); the summary per Q45; the bar per Q50; the POV chip menu with eight
  swatches writes `povColors` and requests a save. `patch()` (outline/view.ts:765-797)
  learns the stripe and the bar, so a refresh with a focused field doesn't fall back
  to a full render.
- Colours: rows call `plugin.outline.colorsFor(keys)` (3.4) when they load. Drag and
  "Renumber" read `canReorder(filter)` (1.3).
- Tests: none beyond strings unless a pure helper appears (header layout logic stays
  in `pov.ts`; `canReorder` is tested in 1.3).

**4.4 Name marks: spellcheck and the underline**, depends on G0c, G1b, 1.2, 3.1's
contract, effort S–M
- Create `src/universe/name-marks.ts`, `src/universe/name-marks-model.ts` (pure),
  `src/universe/name-marks.css`, `tests/universe-name-marks.test.ts`.
- A `ViewPlugin` that, for a note whose `plugin.names.tableFor(path)` has capitalized
  terms (the `capitalizedTerms` filter, Q38), runs `findNames` over `readerMask` once
  in full when the note opens, then on each debounced pause (400 ms; 800 ms on mobile
  by `Platform.isMobile`, as outline/view.ts:450) re-matches only the paragraphs the
  edits touched, through `findNames`' `from`/`to`; it maps ranges through edits between
  passes and draws `Decoration.mark({attributes: {spellcheck: "false"}, class})` for
  visible ranges only. A full pass runs again only when `plugin.names.version()`
  changes. The class adds the underline when `underlineNames` is on. On a platform
  where G0c failed, it draws only when the underline is on.
- Tests (model): ranges mapped through an insertion and a deletion; visible-window
  slicing; nothing for an empty table; lowercase-alias matches are not marked; a
  typing pause re-matches only the changed paragraph, never the whole note.

**4.5 Universe settings rows**, depends on G1a, G1d, effort S
- Change `src/universe/settings-ui.ts` and `src/universe/strings.ts` (where the
  settings strings live): "Entry properties" (three names, collapsed), the extra titles
  list (newline-separated, empty by default, the description naming the built-in
  titles for the writing language), "Underline names in the editor".
- The mode dropdown (universe/settings-ui.ts:33-46) gives way to one line pointing to
  the Features page (Q10). The thread word rows (:109-124) draw while threads is on,
  in every mode; the other universe rows while the universe is on.

## Wave 5: integration, docs and checks

**5.1 Universe integration**, depends on 3.1, 3.2, 4.2, 4.4, effort S–M
- Change `src/universe/index.ts`.
- Build the `MentionsIndex` with `ctx.index`, `plugin.index.rebuild` and the
  provider's `globalTable()`; call `tableChanged()` when the provider's version bumps.
- The `MentionCtx`: live scope through `scopeOf` and `sameScope`, links through
  `getFirstLinkpathDest`, `workOf` through `books.classify(path).book` and
  `plugin.works`.
- `workRank` from `groupWorks` and `compareWorks` over `plugin.works` (works-list.ts:71-84).
- Register the name marks and the appears-in widget through `ctx.editor`, and the
  Reading-view processor through `ctx.postProcessor` (its slot declared in the
  universe's `slots`); give the panel its `counts` and `appearsIn`.
- Test (`tests/universe-mention-ctx.test.ts`, MemoryVault): the `MentionCtx` built
  over a book, a standalone work and an out-of-scope note: `workOf`, `workRank`, the
  scope memo after a scope change, and link resolution.
- Unload withdraws the names provider and disposes everything through the context.

**5.2 Visual check against the canvas**, depends on 4.1, 4.3, 4.5, 5.1, effort S
- With a test vault, compare against the approved artboards: G1a on desktop and a
  phone; G1b in Live Preview, Source and Reading view, light and dark, a 300px
  sidebar and a phone; G1c in a narrow sidebar and a phone; G1d. Fix CSS and layout
  in the owning files. Anything that changes structure goes back to the author.

**5.3 Docs**, depends on 5.1, effort S–M
- `docs/ARCHITECTURE.md`:
  - a "Modules and feature switches" section: `FeatureModule`, `ModuleContext`, the
    slots and why (Q1–Q5), the registry's order and `apply`, data followers (Q8), soft
    dependencies through `features.isOn`, the lifecycle tests and the obsidian stub;
  - the conventions (ARCHITECTURE.md:90-101): register through the context; "don't
    detach leaves in `onunload`" plus "a feature switched off closes its leaves";
  - `core/names.ts` and the names port: terms, profiles by capital letter, keys,
    phrases, collisions, the performance budget from 1.2;
  - the universe spec: `universe: false` (rule 0), entries without stored scope,
    the mentions index and its rebuild rule, the appears-in widget, the name marks;
  - the outline spec: `rows.ts`, POV colours, the header, the bar; the measuring
    section: `readChapterDefault` and `effectivePiece`;
  - the lens spec: names from the port, the path in the session.
- The user guide (ROADMAP.md, "Documentation"; added after the plan was written):
  - create `docs/guide/en/` and `docs/guide/pt-BR/`; `git mv docs/GUIDE-universe.md
    docs/guide/en/the-world.md` and fix every link to it (CONTEXT.md, README.md,
    ROADMAP*.md);
  - in "The world": a rule 0 in the membership list (was GUIDE-universe.md:60-65),
    the "(Planned for 0.7…)" sentence (:67-71) replaced by how to use `universe:
    false`, and sections on "Appears in", entry properties and the name underline;
  - new "Features and settings" page: the Features page, what each switch turns off,
    what data stays, the dependencies;
  - new "Writing" page, 0.7 parts only: POV and status in the outline, per-chapter
    targets and the book default (the rest of the page waits, per ROADMAP.md);
  - pt-BR versions of the three pages, same file names, same sections;
  - README: link each 0.7 feature's line to its guide page.
- Topic roadmaps: every row of "Deviations from the specs", each with the edit named
  there; the ROADMAP-universe settings summary gains the new rows.
- `CONTEXT.md`: version, the next focus (0.8), the modules list (switchable features),
  the shared services (`features`, `names`), the weak spots (rows extracted; the
  followers now always on).

**5.4 Checks**
- `npm run typecheck`, `npm test`, `npm run build` and `npm run test:bundle` pass.
- The no-network test passes with no change; `grep -rn "electron" src` finds nothing.
- `grep -rn innerHTML src` and `grep -rn console.log src` find nothing.
- `grep -rnE "(plugin|p|this\.plugin)\.(register[A-Za-z]*|addCommand|addRibbonIcon|addStatusBarItem)\(|\.onLayoutReady\(" src --include=*.ts`
  finds only `src/core/module-context.ts`, `src/core/feature-registry.ts`,
  `src/main.ts`, `src/core/measurer.ts` and `src/core/vault-indexes.ts` (this catches
  `registerEvent`, `registerDomEvent` and `registerInterval` on the plugin, where most
  leaks happen: desk/recorder.ts:106-111, darlings/index.ts:51-70, goals/index.ts:63,
  explorer/index.ts:76-87, and raw `onLayoutReady` in modules).
- `grep -rn "from \"\.\./universe/\|from \"\./universe/" src` finds only `src/main.ts`,
  `src/data.ts`, `src/settings.ts` and files inside `src/universe/`.
- `grep -rn "from \"obsidian\"" src/core/{names,names-source,features}.ts src/universe/mentions.ts src/outline/{rows,pov}.ts`
  finds nothing, and none of them imports `i18n`.
- Rule 2: `grep -rnE "vault\.process|vault\.modify|processFrontMatter|replaceRange|changes:" src/universe/{appears-in,appears-in-widget,name-marks,mentions-index}.ts src/outline/{header,bar}.ts`
  finds nothing.

## Manual verification on ~/projects/website/escrita/

Back up `.obsidian/plugins/escrita/data.json` first.

**Feature switches**
1. After the update, every feature is on and works as in 0.6.0 (spellcheck on demand
   as the author had it); the Features page lists 17 switches in five groups, the
   universe row shows "Universe", and the universe section has no mode dropdown of
   its own.
2. Turn each feature off in turn: its commands leave the palette and the hotkeys list,
   its views close, its menu items and status bar item go; its ribbon icon stays until
   the next restart and a click on it says the feature is off (G0f); after a restart
   with the feature off the icon is gone (also from "Configure ribbon"); its settings rows hide while rows another feature reads stay
   (property names, track folders, the placeholder marker while publish is on). Turn it on again: all of it comes back once (no duplicate command,
   decoration or status bar item), with no restart, and the active tab doesn't move.
3. Turn snapshots off: the stage snapshot's switch greys out. Publish a note: it
   publishes without a snapshot. Turn snapshots on: the stage snapshot is back as it
   was.
4. With the desk off, rename a note that has a "where you left off" record, and a
   note with snapshots while snapshots is off, and a folder holding notes with
   snapshots; turn both on: the record and the snapshots followed the renames.
5. Turn the desk off with the home note open: the `escrita-works` block shows as plain
   code; on again, it draws.
6. Restart Obsidian with the lens off and its panel open in the saved layout: the
   panel closes at startup.
7. Turn the universe off and on (mode dropdown): the panel and its commands go and come
   back; open threads keep working throughout (close one with the mode off).
7b. Turn the desk off and open a work from the universe's Works tab: it opens at the
   top, not at an old "where you left off".
7c. With the lens off at startup, rename the word lists note: after turning the lens
   on, the setting points at the new path.

**Keep a note out**
8. Add `universe: false` to an essay in `Textos/` (a default folder): the panel's "Add
   to" button doesn't show, its names don't feed the lens, and its mentions don't
   count. Remove it: everything is back without a restart.
9. On a book note, `universe: false`: the book's chapters and its `Personagens/` leave
   the universe; a chapter with its own `universe` link stays in.

**Appears in**
10. Open a character in `Universo/Personagens/`: the section at the end of the note
    lists the contos that mention it, with counts, in Live Preview, Source and Reading
    view. Nothing is written into the file (check the file's text and mtime).
11. Click a work: the note opens with the first mention selected. Edit that conto so
    the mention moves, then click again: the right range is selected. Delete the
    mention and click: the note opens at the top.
12. Add an alias to a character: the counts update within a few seconds without
    reopening. Add a phrase to `ignore`: those mentions go.
13. A diminutive (*Mariazinha*) counts; *Mariano* doesn't count for *Mariana*; a
    `[[link|other text]]` counts once.
14. The Entries tab shows "N works" beside each entry with mentions.
15. Type in the middle of a long conto with the panel open: no lag; counts settle about
    a second after typing stops. **Repeat on a phone.**

**Names in spellcheck and the lens**
16. An invented name with an entry is not squiggled in Live Preview; the same word in
    a note outside the universe still is. **Repeat on a phone** (if G0c passed there).
17. Turn on "Underline names in the editor": names get the underline; off: gone.
18. Lens on: a typo of an entry name is flagged as a name variant; repeating the name
    is no echo.

**Outline**
19. Add `pov: "[[Maria]]"` to two chapters and `pov: João` to one in a book: stripes in
    POV mode, two colours; restart: same colours. Change Maria's colour from the
    chip's menu: it sticks. Rename Maria's entry: the colour stays.
20. Toggle to status mode: stripes follow the stage colours. The summary reads "1
    rascunho · 2 revisão" in the author's words.
21. Filter by a POV chip and a stage chip: rows narrow, "Showing 2 of 5 · Clear"
    shows, drag and "Renumber" are disabled; Clear restores.
22. `chapterTarget: 3000` on the book note: every chapter without its own target shows
    a bar; a chapter with `target: 1500` shows its own; `unit: characters` on one
    chapter counts in characters.

## Release checklist (per CONTEXT.md)

- [ ] docs/ROADMAP.md: move the 0.7 row to "Shipped" (including "Keep a note out of the
      universe"), name the improvements (modules that load and unload at runtime,
      IMPROVEMENTS 6; chapter rows, IMPROVEMENTS 7), move "Unlinked mentions" and
      "Names without an entry" into the 0.9 row (Q35), and plan 0.8 before editing the
      topic roadmaps.
- [ ] README.md:
  - the 0.7.0 changelog entry: the Features page, `universe: false`, "Appears in",
    names in spellcheck and the lens, POV and status in the outline, per-chapter
    targets; on its own lines, the new minimum Obsidian version (1.7.2), "Writing
    language" moving out of Revision, the explorer counts and spellcheck-on-demand
    toggles and the universe mode moving to the Features page, the piece property names
    and track folders moving to "Properties and folders", and reordering being off
    while the outline is filtered;
  - sections for the Features page, "Appears in" (what counts, entry properties,
    titles, what is never written), POV and the chapter default;
  - the settings list and the properties list (`pov`, `chapterTarget`,
    `caseSensitive`, `ignore`, `firstName`, `universe: false`).
- [ ] docs/IMPROVEMENTS.md: move candidates 6 and 7 to "Done" (0.7); note in
      candidate 5 that the rows slice is done; note in candidates 9 and 10 that their
      minimum shipped in 0.7.
- [ ] Topic roadmaps: mark U 1.2, U 1.4, N 1, N 2 and SF 10's switches shipped, and
      the `universe: false` bullet in "Modes"; write the deviations (5.3).
- [ ] docs/ARCHITECTURE.md and docs/GUIDE-universe.md: the items in 5.3.
- [ ] CONTEXT.md: the items in 5.3.
- [ ] The author's vault: in `data.json` set
      `povProperty` / `chapterTargetProperty` if the author wants Portuguese names;
      update the "Plugin Escrita" section of `escrita/Como usar.md`.
- [ ] `npm version minor --no-git-tag-version` (manifest.json and versions.json to
      0.7.0, with `minAppVersion` 1.7.2), commit `0.7.0`, tag `0.7.0`, push the tag,
      and check the drafted release assets (main.js, manifest.json, styles.css with
      the new CSS).

## Risks

1. **The refactor touches every module.** Wave 2 moves registration in eleven folders
   at once. Mitigated by the adapter in 1.1 (wave 1 ends with 0.6.0 behaviour), one
   folder per task, a lifecycle test per module, the 5.4 grep, and manual checks 1–7
   over every feature.
2. **Obsidian behaviour the d.ts doesn't state** (`removeCommand`'s id, a duplicate
   view type, restored leaves of off features). G0a, G0b and G0f answered each from
   the 1.13.7 app code before 1.1.
3. **The obsidian stub drifts from the real API.** It only backs lifecycle tests; the
   real API is exercised by manual checks. The stub lists exactly what `src/` imports,
   so a new import fails loudly in tests.
4. **Data followed while off** (Q8). An always-on follower that throws would break
   every rename. They touch only `plugin.data` and `plugin.settings`, and every wave 2
   lifecycle test runs them on a module that was never loaded. The snapshots handler
   also moves files while snapshots is off (a listed deviation), tested for file,
   folder and root renames; manual check 4 renames with features off. A follower that
   saves settings re-enters `apply()`, which is synchronous and guarded (Q12).
5. **The mentions index on big vaults and phones.** A third content index over the
   whole vault, plus a full rebuild on every alias edit. Mitigated by one startup build
   after the entries index is ready (3.2), `undefined` for empty notes, a per-entry
   aggregate for queries, ceilings derived from G0h's desktop and phone figures, the
   name marks re-matching only changed paragraphs (4.4), the 2-second debounce on table changes, old values kept during a
   rebuild, a non-structural spec, and manual check 15 on a phone. If the build is
   too slow, review candidate 12 (one shared text pass) is the next step, measured
   first.
6. **False positives from names that are words** (*Rosa*, *Porto*), case-insensitive by
   default as the spec says. The per-entry `ignore` and `caseSensitive` exist for
   them; stop-word and one-letter terms never match (Q27).
7. **pt name collisions** (*Marcos/Marco*). Ambiguous occurrences count for no one
   (Q26), pinned by the fixtures; the stem fixtures stay frozen.
8. **`spellcheck="false"` may not be honoured on mobile.** G0c decides per platform
   (WebKit on iOS tested separately); the lens half ships regardless, and the deviation
   says so. Autocorrect on phone keyboards is not addressed.
8b. **Ribbon icons and removed commands leave traces** (G0a, G0f). A feature turned off
   at runtime keeps its ribbon icon until restart (its click says the feature is off),
   and a pinned command keeps a dead button in the mobile toolbar until restart; editing
   the toolbar while the feature is off drops the pin. Accepted, with no private API,
   and written into the guide and the changelog.
9. **The Reading-view section may be fragile.** G0d decides; the fallback is the panel
   only.
10. **Stale offsets on "click to jump".** A stored range is checked against the live
    text before it is selected (Q34); otherwise the note opens at the top.
11. **Filtering and reordering** (rule 1). Drag and renumber are disabled while a
    filter is on (Q44).
12. **The default target shows in the outline only** (Q49), so the explorer may show
    no target where the outline shows a bar. Documented; candidate 8 fixes it.
13. **`minAppVersion` 1.7.2** drops users on older Obsidian. 1.7.2 shipped in 2024;
    the changelog says so.
14. **Line numbers drift** after wave 2. Tasks in waves 3–5 re-check citations before
    editing.

## Issues not applied

- **The Electron spellchecker** (U 1.4's route). Replaced by `spellcheck="false"` marks
  (Q37): the route breaks rule 8 and trips the no-network test. (An earlier draft also
  said the spec forbids adding to the writer's dictionary; it doesn't, it only forbids
  removing words the writer added, ROADMAP-universe.md:216.)
- **Entry-independent token keys per note** (option b for the mentions index). It
  avoids rebuilds on entry edits but holds a key set per note for the whole vault; the
  measurer deliberately never holds text (core/measure-cache.ts:1-8). Rebuild on a
  signature change was taken (Q33).
- **Feature-detecting `removeCommand`** instead of raising `minAppVersion`. Two code
  paths for one behaviour; 1.7.2 is old enough.
- **`MarkdownPreviewRenderer.unregisterPostProcessor`** for the desk's block. Untested,
  and rendered blocks stay until re-rendered; the slot with a fallback is simpler.
- **Each module draws its own settings section** (review candidate E, IMPROVEMENTS 11).
  An `isOn` check per section in `settings.ts` is enough for 0.7.
- **The effective piece as a classifier field** (review candidate B, IMPROVEMENTS 8).
  The default shows in the outline only for now (Q49).
- **Scope as a classifier field** (the fuller candidate C, IMPROVEMENTS 9). Only the
  minimum (no stored scope) is done; the fuller version needs the classifier fake.
- **One text pass for every content index** (review candidate F, IMPROVEMENTS 12).
  Speculative until the mentions index is measured.
- **Moving shared helpers out of module folders** (review candidate G, IMPROVEMENTS 13).
  They don't block loading; everything is bundled.
- **The full outline split** (candidate 5). Only the rows slice is taken; key
  dispatch, drag and drop and the refresh race stay.
- **POV colours on the canvas board.** Canvas colours are a fixed set; later.
- **Migrating "Plant a thread" and template insert onto `plugin.notes`.** ARCHITECTURE
  already lists them as the deliberate synchronous gap (ARCHITECTURE.md:126-130).
- **Filtering the mentions scan to notes in some scope at compute time** (review E2,
  first critic 6a). Scope depends on other notes (a book note's `universe`, Q18), and a
  content index only recomputes the note that changed, so the stored value would go
  stale, the problem Q20 removes. The scan stays vault-wide; empty notes store nothing.
- **Building the mentions index on first query** (review E1 and I). The panel is
  usually open in the saved layout, so it would build at startup anyway, and every
  surface would need a "not built" state. Taken instead: one build after the entries
  index is ready. Making content indexes start on demand in general is IMPROVEMENTS 14.
- **Keeping the snapshots rename handler as a module-owned `vault.on("rename")`**
  (first critic 1, first option). Renames while snapshots is off would orphan
  snapshots, against SF 10's "turning it back on loses nothing"; reconciling on load
  can't know where a deleted path went. Taken: always on, listed as a deviation.
- **A panel hint for `universe: "false"`** (first critic 5, second option). Superseded by
  G0g: the string counts (Q15). (An earlier entry here, "not accepting the string
  `"false"`", was reversed by G0g and moved into Q15.)
- **Hiding a ribbon icon with `el.toggle(false)` or removing it with
  `removeRibbonAction`** (G0f). The first doesn't last (any ribbon change shows it
  again); the second is a private API and still leaves the entry in "Configure ribbon"
  until restart. Taken: the icon stays until restart and says the feature is off.
- **Modules as children of the plugin, with the order checked in G0b** (review C1,
  second option). The registry calling `load`/`unload` itself makes the order ours,
  whatever Obsidian does with children.
- **Mapping every id to its final class in 1.1** (review B1, first option). It needs
  `EditorModule` loaded as an internal non-feature until 2.5; a one-line, listed
  `main.ts` exception for 2.5 is smaller.
