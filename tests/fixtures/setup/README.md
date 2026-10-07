# setup fixtures

One JSON file per case, for `planSetup` (task 1.5). Each file:

- `description`: what the case checks.
- `choices`: a `SetupChoices`.
- `settings`: the live settings, either `{ base, overrides }` (`defaultsFor(base)` with
  `overrides` laid over it) or `{ fromFile }` (a full `EscritaSettings`, relative to this folder).
- `vault`: a `SetupVault`.
- `expected`: the `SetupItem[]` `planSetup` must return, in run order. `content` is left out
  (example and home note text belong to task 2.1); compare items without it.

Cases:

| File | Checks |
|---|---|
| `empty-en.json` | Empty vault, fresh English install already on Writer. Folders, both examples, home note; `trackFolders` empty stays empty (kept); features kept (already Writer); desk layout. |
| `empty-ptbr.json` | The same in Portuguese (Contos, Exemplo ·, Início.md), stories only, Essentials (features row changes), writing mode (`openInWritingMode` written under the layout tick). |
| `en-install-picks-ptbr.json` | An English install, empty vault, four leaves open; the writer picks Portuguese, Everything and Shared world. Every word-bearing setting changes (darlings notes are equal in both sets, so no item), `universeMode` is written, the layout row is unticked. |
| `author-like.json` | Board 36 a: the scrubbed 0.9 settings, existing folders and home note, works present. The writer's own words are kept; examples, the language group, the features row and the layout are unticked; `trackFolders` gains `Livros` and keeps the rest. |
| `second-run.json` | Board 36 b: the vault and settings after `empty-en` ran. Everything is kept; the layout row is unticked (leaves open), so `itemsToRun` is empty ("Nothing to do"). |
| `case-clash.json` | Board 36 c: folder `stories` and note `home.md` exist in another case. Items carry the existing spelling and are kept; `homeNote` and `trackFolders` use that spelling. |
| `tabs-open.json` | Five leaves open, books only: only the layout row depends on the tabs (unticked). |

These fixtures encode the rules of `src/setup/plan.ts`'s file comment. Where that comment is
silent they make a choice, listed here so task 1.5 and the judge can overrule it:

1. Reason keys (`setup.reason.*`) and their `vars` are provisional.
2. Example paths: the story, the book folder, the book note, the chapters folder (the target
   language's `chaptersFolder`) and two chapters are separate `example` items. Chapter file
   names (`01 Arrival.md`…) are placeholders until task 2.1.
3. Word-bearing settings are one item per key. A key equal to the target set is left out of
   the list; one that differs from the install's set is `kept` (the writer's own); the rest
   `change` under the `language` tick (judge, 2026-10-07). `chaptersFolder`, `trackFolders`,
   `lensLanguage`, `homeNote`, `openHomeOnStartup` are always listed.
4. A `kept` item has `tick: null` and `ticked: false`. A `change` or `new` item with no tick
   has `ticked: true`.
5. `lensLanguage` is written as the writing language (`"en"` or `"pt-BR"`, never `"auto"`).
6. In `en-install-picks-ptbr` and `author-like`, `defaultsLanguage` changes to the picked
   language, under the `language` tick.
7. The layout item is `new` with `ticked: false` when more than one leaf is open, or in a
   vault with works (reason `layoutHasWorks`; tabs win when both hold).
8. The language group (judge, 2026-10-07): `defaultsLanguage`, every word-bearing key that
   changes and `lensLanguage` share one tick, `language`, ticked by default only in a vault
   without works (reason `settingHasWorks` otherwise). A value equal to the install's set is
   still saved in `data.json`, and SF 10 says a saved value never changes without the
   writer's choice; `chaptersFolder` and `submissionsFolder` also move what Escrita reads.
   `trackFolders` has no tick: it gains the folders the run creates.
9. Wave 2 seams (2026-10-07): `openHomeOnStartup` has its own tick, `startup`, ticked by
   default only in a vault without works (reason `settingHasWorks` otherwise). A home note
   that exists in another case (`home.md` for `Home.md`) is `kept` and `homeNote` points at
   it under the `home` tick (`case-clash.json`). Example chapter names live in
   `src/setup/examples.ts` (`EXAMPLE_CHAPTERS`, task 2.1); renaming them updates these files.
