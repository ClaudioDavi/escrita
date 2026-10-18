# Plan 1.1.1: code improvements only

A patch release with no new features. Two parts:

1. **The review bot's warnings, all gone** (done on 2026-10-18, branch `1.1.1`):
   - The e2e harness moved from `e2e/` to `tests/e2e/`. The bot lints every `.ts` file outside
     `tests/` and outside `*.spec.ts`, whatever `eslint.config.mjs` ignores, so it reported the
     harness's Node imports, the global `app`, `setTimeout` and `any` (about 300 warnings).
   - CSS: no `text-decoration` styling and no `text-indent` (ARCHITECTURE.md, "No
     `text-decoration` styling…"). The lens marks, the name underline and the dotted UI lines are
     backgrounds; the export preview's indent is a `::before` spacer. Checked with `doiuse` and
     the browser `Chrome 138`, which reproduces the bot's list exactly; now it reports nothing.
     The look was compared old against new in Chromium; the author checks it by eye in the test
     vault.
2. **The improvement: one settings table** (IMPROVEMENTS 53, the schema half of 37). The plan
   below was written by the design pass (Opus) on 2026-10-18.

## Improvement: one settings table

### 0. Claims checked against the code (HEAD b1d87d8)

- `EscritaSettings` `src/settings.ts:17-214`; `DEFAULT_SETTINGS` `:216-324`; `WORD_KEYS`
  `src/core/defaults.ts:63-67`; `EN` `:101-127`, `PT_BR` `:130-159`; `INSTALL_KEYS` `:79`;
  `normalizeSettings` `settings.ts:338-385`; `PROPERTY_KEYS` `:412-415` (19 keys);
  `SETTING_FEATURES` `:424-465`. Universe: `universe/settings.ts:25-54` (interface), `:65-87`
  (defaults), `:111-144` (normalizer). Settings rows also live in `settings-tab.ts` and each
  `<module>/settings-ui.ts`.
- Parity tests: `tests/settings-features.test.ts:54`, `tests/defaults.test.ts:31-34, 36-38, 91-93`.
- Blank `summaryProperty`/`authorProperty`/`dateProperty` never restored on load (their rows
  already fall back: `settings-tab.ts:91`, `export/settings-ui.ts:28`, `publish/settings-ui.ts:15`).
- Enums: `lensLanguage` (`:361`), `screenplayPage` (`:372`), `universeMode`
  (`universe/settings.ts:128`), `defaultsLanguage` (`:340`) are checked; `paragraphStyle`,
  `quoteStyle`, `typographyScope` only get `mergeDefaults`' typeof check (`core/merge.ts:16`).
  **An unknown `quoteStyle` throws**: `QUOTES[quoteStyle].open2` at `core/dialogue.ts:60` (also
  `typography.ts:77`). Unknown `paragraphStyle` acts as `"single"` (`dialogue.ts:219`); unknown
  `typographyScope` as `"books"` (`editor/features.ts:196`).
- `unnumberedTitles` blank means "none" on purpose (`settings.ts:31`, `:359`). Keep it.
- `epubSceneBreak` and others fall back to `DEFAULT_SETTINGS` instead of the set `d`; none is in
  a language set, so no visible difference.
- 36 keys never pass `normalizeSettings` (15 booleans, 6 numbers, 12 strings, 3 enums). Blank
  `chaptersFolder`, `darlingsNote`, `globalDarlingsNote` stay blank on load though their rows
  restore the default; `placeholderMarker`'s row restores `"XXX"`, loading does not.
- Form keys still in `universe/settings.ts:38-43, 78-80, 116, 126, 135-137`; exemption at
  `tests/settings-features.test.ts:50`. `core/defaults.ts:24` is the only core import of a
  module's values. `listsPath` (`lens/settings.ts:6`) and `normalizeNotePath`
  (`universe/settings.ts:100`) are normalizers a core table needs.
- `normalizeSettings` runs twice on a fresh install (`settings.ts:402-404`): normalizers must be
  idempotent. `WORD_KEYS` order is the setup's order (`setup/plan.ts:291`, fixtures in
  `tests/fixtures/setup/*.json`, compared in order by `tests/setup-plan.test.ts:35`).

### 1. The table's shape

New pure file `src/core/settings-schema.ts`. It may import only leaf core files (`./language`,
`./stages`, `./features`, `./merge`, `./paths`, `./form`, `./entry-kinds`) and `EscritaSettings`
as a type from `../settings`. Never `./classify` or `./defaults` (an import cycle at load).

```ts
export type ReadBy = readonly FeatureId[] | "always" | "switch" | "universe";
export interface Kind<V> { readonly kind: KindName; normalize(v: unknown, fallback: V): V }
type Lang<V> = { lang?: never; ptBR?: never } | { lang: "word" | "install"; ptBR: V };
export type Row<V> = { default: V; kind: Kind<V>; readBy: ReadBy } & Lang<V>;
export type SettingsSchema = { [K in keyof EscritaSettings]-?: Row<EscritaSettings[K]> };
export const SETTINGS_SCHEMA = { /* one row per key, in interface order */ } satisfies SettingsSchema;
```

**Typing: keep the `EscritaSettings` interface and check the table against it with
`satisfies`.** It rejects a missing row, an extra row and a default of the wrong type; the
interface keeps its JSDoc, unions and `extends`, which `TextKey` (`ui/settings-rows.ts`) relies
on; `satisfies` keeps the literal `lang`, so key unions can be derived:
`type KeysWith<L> = { [K in keyof Schema]: Schema[K] extends { lang: L } ? K : never }[keyof Schema];`

Row fields: `default` (the English value); `lang`: `"word"` (in the language sets, offered by the
setup) or `"install"` (`snapshotsFolder`, `excludeFolders`); `ptBR` (required when `lang` is set);
`readBy` (today's `SETTING_FEATURES`; `"switch"` for `features`, `explorerCounts`,
`spellcheckOnDemand`; `"universe"` for the `UniverseSettings` keys). `EN` and `PT_BR` are deleted;
`stages()`, `entries()` and their comments ("Brazilian, never European", "CORTA PARA") move into
the schema file.

Kinds. Each normalizer is `(v, f) => value`, `f` = `defaultsFor(lang)[k]`. Keys marked * are the
drift fixes (section 3); step 4 gives them a `custom` that copies today's line.

| kind | rule | keys |
|---|---|---|
| `word` | trimmed string; blank or not a string gives `f` | submissionResults, threadKeyword, threadClosedWord, screenplaySceneHeadings/Transitions/More/Continued/Credit, epubSceneBreak, chaptersFolder*, darlingsNote*, globalDarlingsNote*, placeholderMarker* |
| `property` | same as `word`; the type forbids `lang` | statusProperty, the 19 `PROPERTY_KEYS`, universe/type/caseSensitive/ignore/firstName properties, formProperty, summaryProperty*, authorProperty*, dateProperty* |
| `trimmed` | string trimmed, blank kept; not a string gives `f` | homeNote, unnumberedTitles, authorName, authorSurname, contactLines, chapterHeadingFormat |
| `text` | string kept as typed; not a string gives `f` | chapterTemplate, otherStatusColors, trackFolders, excludeFolders, datesOff, recommendedProperties, notNames, defaultUniverseFolders, formFolders, nameTitles |
| `folder` | `cleanFolder(v) \|\| f` | exportFolder*, submissionsFolder* |
| `optionalFolder` | `cleanFolder(v)`, blank kept | storiesFolder, booksFolder, templatesFolder* |
| `vaultFolder` | classify's fuller rule `\|\| f` | snapshotsFolder |
| `templatePath` | trim, strip leading `/` | storyTemplate, bookNoteTemplate |
| `enumOf(values)` | in the list, else `f` | lensLanguage, screenplayPage, universeMode, defaultsLanguage, paragraphStyle*, quoteStyle*, typographyScope* |
| `bool` | boolean, else `f` | every boolean |
| `number` | finite number, else `f` | numberPadding, dailyGoal, dayEndsAt, ignoreJumpsOver, sprintMinutes, sprintTarget |
| `int(min, max)` | round and clamp; not a number gives `f` | lensEchoWindow 10–200, lensLongSentence 15–200, snapshotsKeepAuto 1–∞ |
| `strings` | array of strings only; else `f` | lensRulesOff, lensRulesOn |
| `custom(fn)` | nested values | stages (`normalizeStages(v, f)`), entryTypes and formValues (each field trimmed, blank gives `f`'s field, `template` trimmed; built fresh), weekdaysOff (`cleanWeekdays`), features (`cleanFeatures`), universeNote (`normalizeNotePath(word(v, f), f)`), lensListsNote (`listsPath`) |

### 2. What is derived from the table

- `schemaDefaults()`: a fresh `EscritaSettings`, every default copied two levels deep.
  `settings.ts` keeps `export const DEFAULT_SETTINGS = schemaDefaults()` and `defaultsFor`.
- `normalizeKeys(target, base, keys)`: `target[k] = row.kind.normalize(target[k], clone(base[k]))`,
  in place. `normalizeSettings` (same signature) becomes: check `defaultsLanguage`, then
  `normalizeKeys(s, defaultsFor(s.defaultsLanguage), SETTING_KEYS)`. Unknown keys are left alone;
  `mergeDefaults` does not change.
- `SETTING_FEATURES`: rows whose `readBy` is an array or `"always"`; re-exported by `settings.ts`.
- `UNIVERSE_KEYS`: rows with `readBy: "universe"`. `universe/settings.ts` keeps
  `defaultUniverseSettings()` and `normalizeUniverse(raw, base?)` as wrappers, so 14 test files
  need no change.
- `PROPERTY_KEYS`: deleted (the `property` kind replaces it).
- `core/defaults.ts`: `LANGUAGE_DEFAULTS = deepFreeze({ en: pick(r => r.default), "pt-BR": pick(r => r.ptBR) })`
  over `SET_KEYS`. `WORD_KEYS` stays an explicit tuple (its order is the setup's), checked at
  compile time against `KeysWith<"word">` both ways; `INSTALL_KEYS` the same.
- New `src/core/language.ts`: `DEFAULTS_LANGUAGES`, `DefaultsLanguage`, `isDefaultsLanguage`,
  `languageOf`; `defaults.ts` re-exports them.
- `core/settings-order.ts`: unchanged (deriving `also` is the other half of 37).

### 3. Behaviour rule for 1.1.1

**Valid data loads exactly as today**, pinned by `tests/settings-g3.test.ts` with
`tests/fixtures/settings-0.9/expected-settings.json` (unchanged, both locales) and
`tests/setup-plan.test.ts` / `tests/setup-fixtures.test.ts` (every fixture unchanged). "Valid" is
any value the settings tab can write.

Drift fixes taken (broken data.json only; the changelog names each):

1. A blank or non-text `summaryProperty`, `authorProperty` or `dateProperty` comes back as
   `summary`, `author` or `date`.
2. An unknown `quoteStyle`, `paragraphStyle` or `typographyScope` comes back as `curly`, `blank`
   or `books` (today an unknown quote style throws in dialogue focus and the lens).
3. A blank `chaptersFolder`, `darlingsNote` or `globalDarlingsNote` comes back from the install's
   set; a blank `placeholderMarker` comes back as `XXX`. These four are trimmed.
4. `exportFolder`, `submissionsFolder` and `templatesFolder` are cleaned with `cleanFolder`, like
   the stories and books folders (`"/ Exports"` becomes `"Exports"`).

Not taken: range clamps for `dayEndsAt`, `numberPadding` and the goal numbers; trimming
`chapterTemplate`; `placeholderMarker` character rules; `unnumberedTitles`.

### 4. Form keys and `ENTRY_KINDS` move to core

- New `src/core/entry-kinds.ts`: `ENTRY_KINDS`, `EntryKind`, `EntryTypeSetting`;
  `universe/settings.ts` re-exports them.
- `UniverseSettings` loses `formProperty`, `formValues`, `formFolders`; `EscritaSettings` becomes
  `extends UniverseSettings, FormSettings` (from `core/form.ts`). Form rows `readBy: "always"`;
  `formValues` has `lang: "word"`.
- `core/paths.ts` gains `listsPath` (re-exported by `lens/settings.ts`), `normalizeNotePath`
  (re-exported by `universe/settings.ts`) and `cleanVaultFolder(v)` (today's `folderRoot`
  cleaning at `classify.ts:247-250`; `folderRoot` calls it).

### 5. Test plan

New `tests/settings-schema.test.ts`, table-driven over `DEFAULTS_LANGUAGES` × `SETTINGS_SCHEMA`,
with `load(v) = normalizeSettings(mergeDefaults(defaultsFor(lang), { defaultsLanguage: lang, [key]: v }))[key]`
(not `loadSettings`: `migrateSettings` rebuilds stages): missing gives `d[key]`; `load(d[key])`
equals `d[key]`; wrong types give `d[key]` (per kind); blank rules per kind; unknown enum gives
`d[key]`; running twice changes nothing; nested fields (`stages.draft.words: ""`,
`entryTypes.place.value: ""`, `formValues.essay: " "`) come back from `d`; `WORD_KEYS` has no
duplicates.

Delete `defaults.test.ts:31-34, 36-38` and the key-set equality and exemption in
`settings-features.test.ts:50, 54`. Keep `defaults.test.ts:47, 66, 82, 91, 95` and the
feature-id half of `settings-features.test.ts:55-59`. Add: keys missing from `SETTING_FEATURES`
are exactly the `"switch"` keys plus `UNIVERSE_KEYS`; a case in `tests/settings-imports.test.ts`
that fails if any `src/core/*.ts` imports a module folder (`ui/` type imports allowed). Move the
form assertions of `tests/scope.test.ts:145,150-151,166,175` to `tests/classify-form.test.ts`.

Must stay green unchanged: `settings-g3`, `setup-plan`, `setup-fixtures`, `settings-1-4`,
`core-features`, `stages-defaults`, `settings-tab`, `no-network` (through `test:bundle`).

### 6. Steps

Each step leaves `npm run typecheck`, `npx vitest run --maxWorkers=4`, `npm run build`,
`npm run test:bundle` green, and commits.

1. **Pure helpers into core.** New `core/entry-kinds.ts`, `core/language.ts`; `core/paths.ts`
   (+`listsPath`, `normalizeNotePath`, `cleanVaultFolder`); `core/classify.ts`; `core/defaults.ts`;
   re-exports in `lens/settings.ts`, `universe/settings.ts`. Done when
   `grep -rn '"\.\./\(universe\|lens\)' src/core` prints nothing and the import-rule test is green.
2. **Form keys into core.** `universe/settings.ts`; `settings.ts`; `tests/settings-features.test.ts:50`;
   `tests/scope.test.ts`; `tests/classify-form.test.ts`. Done when the universe file mentions
   forms only in the re-export and G3 passes with `expected-settings.json` unchanged.
3. **The table; derive defaults, sets and features, no behaviour change.** New
   `core/settings-schema.ts`; `core/defaults.ts`; `settings.ts`. Done when `git diff` of `tests/`
   is empty for this step and all suites pass.
4. **`normalizeSettings` from the table, no behaviour change.** The 13 drift keys get `custom`
   normalizers copying today's lines. Done when no test changed and `settings.ts` no longer
   imports `listsPath`, `cleanFolder`, `snapshotsRoot` or `normalizeUniverse`.
5. **Drift fixes, test first.** Add `tests/settings-schema.test.ts`, see it fail only on the 13
   drift keys, then change their kinds. Done when green with the fixtures unchanged.
6. **Trim parity tests, docs.** `tests/defaults.test.ts`, `tests/settings-features.test.ts`;
   ARCHITECTURE.md (Forms paragraph, a settings table paragraph, the `core/defaults.ts` line);
   IMPROVEMENTS 53 and 37; README 1.1.1 changelog; CONTEXT.md; the header comment of
   `core/defaults.ts`. Done when `EN:`, `PT_BR` and `PROPERTY_KEYS` no longer appear in `src`.

### 7. Risks

- Import cycle if the schema imports `classify` or `defaults`; vitest and `test:bundle` show it.
- Setup order: deriving `WORD_KEYS` from row order would break 7 fixtures. Keep the tuple.
- Shared objects: `normalizeKeys` always clones the fallback; record normalizers build new
  objects (`settings-1-4.test.ts:59-67`, `defaults.test.ts:105` guard it).
- `DEFAULT_SETTINGS.stages` becomes a copy of `DEFAULT_STAGES`, not the same object.
- `satisfies` catches a wrong `enumOf` list but not a missing member; note it beside the types.
- Phones: nothing here touches the DOM.

## Results

(filled in when the work is done)
