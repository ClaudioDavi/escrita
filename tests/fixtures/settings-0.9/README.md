# settings-0.9

The G3 fixture: the author's 0.9 `data.json`, scrubbed, and what a 1.0 load must make of it.

- `data.json`: the file as 0.9 wrote it (`EscritaData`). Scrubbed because the repo is public:
  `authorName`, `authorSurname` and `contactLines` are neutral values; every path, title, name
  and sentence from the writer's own works is replaced (`history` is cut to two days,
  `leftOff`, `threadSeen`, `povColors` and `exportChoices` use made-up notes). The settings
  (word lists, folders, stage words, entry types) are kept as they are: they are what the case
  tests. `features` holds only `lens` and `snapshots` (as saved); `stages` is present, so
  `migrateSettings` does nothing.
- `expected-settings.json`: the effective `EscritaSettings` after a 1.0 load. Every value is
  the same as in `data.json` except two new keys filled in: `defaultsLanguage: "en"` (a saved
  `settings` object without the key means the English set, PLAN-1.0 "Q1 as built") and
  `openInWritingMode: false`. Every other key missing from the file takes its
  `DEFAULT_SETTINGS` value. `features` stays `{ lens: true, snapshots: true }`: no preset is
  applied to an existing install (Q6). The Portuguese words ("Capítulos", "revisao", "fio"…)
  must not be replaced by the pt-BR set, and the blank-field fallback of a cleared field is the
  English set (`defaultsLanguage` "en").

Expected output was produced from the 0.9 load path (`normalizeSettings(mergeDefaults(DEFAULT_SETTINGS, migrateSettings(raw.settings)))`)
plus the two keys above, then checked key by key against `data.json`.

Used by: task 1.4 (the 0.9 fixture loads unchanged) and task 1.3 (the author's switches read "Custom").
