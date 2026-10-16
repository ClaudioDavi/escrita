# S0 spike findings

Works: attach over CDP to a second flatpak Obsidian 1.14.4, fully isolated.

Launch (the flatpak wrapper `obsidian.sh` forwards `"$@"`, and the last `--ozone-platform` wins):

    flatpak run md.obsidian.Obsidian --user-data-dir=<run>/profile --remote-debugging-port=<free port> [--ozone-platform=headless]

- Run folder must be under `$HOME` (`~/.cache/escrita-e2e/run-<ts>/`); the flatpak can't see `/tmp`.
- `profile/obsidian.json` with one vault `{"path", "ts", "open": true}` makes it open that vault on start.
- Restricted mode: `app.plugins.initialize` (app.js, `enable-plugin-` + `appId` in localStorage). Community
  plugins load only if `localStorage["enable-plugin-<appId>"] === "true"`; if the key is absent it shows the
  trust modal. The spike calls `app.plugins.setEnable(true)` through `page.evaluate`, which sets the key and
  loads `community-plugins.json`. (The key then lives in the run's profile, so a relaunch of the same
  profile would not need it.) Escape closes the trust modal.
- New work opens a suggest-style prompt (`.prompt`), not `.modal`.
- Headless: `--ozone-platform=headless` runs with NO window (checked with KWin's `/WindowsRunner Match`:
  the author's window is listed, the spike's is not) and screenshots work. Set `page.setViewportSize`
  (headless starts at 200x150). `--headless` alone is ignored (a window still appears).
- Timings: spawn to CDP up 0.5-1.0 s, to layoutReady 0.8-1.5 s, whole run about 1.1 s.
- Cleanup: the instance is killed with `flatpak kill <id>` for the ids that are new in `flatpak ps`
  (two per launch: the app and its zypak sandbox). The author's instances are never in that set.
