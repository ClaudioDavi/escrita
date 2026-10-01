# Escrita

An Obsidian plugin for fiction writers: an outline that lives inside your chapters, word goals and sprints, placeholders, and a safe place for the passages you cut.

Escrita is inspired by [NEO](https://github.com/hughhowey/neo) by Hugh Howey (MIT License). Parts of its design and logic are adapted from NEO. Escrita is not affiliated with NEO or its author.

Your books stay plain Markdown. Everything Escrita adds to a chapter is an Obsidian comment (`%% … %%`), so it is hidden in Reading view and by most publishing tools.

## Features

### Outline and ghost beats

- The **Outline** panel in the right sidebar lists the chapters of the current book, with their number, title, status, summary and word count, plus the book's total against its goal.
- Each chapter can hold **beats**: one-line scene notes. A beat stays muted until you write the scene under it, then it gets a check mark.
- You can edit the outline from the keyboard. Enter adds a chapter or beat. Tab turns an empty chapter into a beat of the chapter before it. Shift+Tab turns an unwritten beat into a new chapter. Backspace on an empty line removes it. Drag chapters to reorder them, and the files are renumbered for you.
- Titles, summaries and beat text are editable in place. Chapter files are renamed with Obsidian's own rename, so links keep working.
- Outside a book, the panel shows the beats of the note you're in (a short story, an essay), with its length against its target or limit. Enter adds a beat, Backspace on an empty one removes it, and a note with no beats offers **Add the first beat**.
- **Ghost beats**: in Live Preview, beats show inside the chapter as faint labels ("Beat b · from outline") above where the scene goes. Put the cursor on the line to see the raw text.
- **Open outline as a board** writes a Canvas file with one card per chapter, colored by status.

### Goals, progress and pacing

- Escrita counts the words you type in the active note. Pastes, imports and sync changes above a size you choose are not counted.
- A daily goal for all your writing, and a word goal and deadline for each book (stored as `goal` and `deadline` in the book note's properties; the names are settings).
- The **Progress** window shows today, the book and your streak, a 30-day chart of words per day with the book's running total, and pacing: words per day needed to hit the deadline, and the finish date projected from your 7-day average.
- Words written after midnight can count toward the day before, up to an hour you choose.

### Targets for a single piece

Any note can have its own length goal, not just books. Set `target` (the length you're aiming for), `limit` (a hard maximum, like a contest's), `unit` (`words`, `characters` with spaces, or `characters-no-spaces`) and `deadline` (YYYY-MM-DD) in its properties. A note with only `unit: characters` is still counted in characters. Characters are counted on the text a reader sees: no properties, comments, code or formatting marks, with runs of spaces counted as one. An accented letter or an em dash counts as one character.

### Days off

Choose weekdays off and specific dates off. A day off never breaks your streak, and pacing toward a deadline counts only the days you write. Writing on a day off still counts.

### Publish check

**Publish this note** checks the active note before you publish it: an unclosed `%%` comment, placeholders left, unwritten beats, an empty body, missing recommended properties such as `description`, and a length over the piece's limit. Blockers can be overridden. Publishing sets the status property to your published value and the date property to today (or a date you choose). **Unpublish this note** puts the earlier status back. Escrita doesn't publish anywhere: it only checks the note and updates its properties, so it works whether you post to a blog, send to a magazine, or just mark a piece as done.

### Sprints

Start a timed sprint (15, 25 or 45 minutes, or your default) with a word target. The status bar shows the countdown and your words. When time is up, you get a summary with words per hour.

### Status bar

Shows words in the current chapter and book, today's words against your goal, and your streak. With a selection, it shows the selected word count. Click it to open the progress window.

### Placeholders

Mark something to fix later without breaking your flow: `%% XXX: check if the cellar has a window %%`. Placeholders show as a small red pill in the editor, a dot in the file explorer and a badge in the outline. The **Placeholders** panel lists them all, by book or across the vault; click one to jump to it, or mark it resolved. The marker word (`XXX`) is configurable.

### Darlings

**Move selection to darlings** cuts a passage out of your chapter (one undo step) and appends it, with its source and date, to a Darlings note in the book's folder. The **Darlings** panel lists what you cut. Restore puts a passage back where it came from, using the text that surrounded it to find the spot.

### Enter, Enter, Enter

Off by default. In a chapter, or any other note in your tracked folders (a short story, an essay), pressing Enter on empty lines after a paragraph inserts a scene break (`---`). In a chapter, pressing Enter again after a scene break at the end creates the next chapter and moves you into it. Set whether your paragraphs are separated by a blank line or a single line break so it knows what counts as "empty".

### Smart typography

As you type: `--` becomes an em dash, `...` becomes an ellipsis, and straight quotes become curly quotes, guillemets or German quotes. With the **dialogue dash** option, `--` followed by a space at the start of a line becomes `— `, for dialogue in Portuguese, Spanish, French and other languages. Backspace right after a replacement restores what you typed. Code, frontmatter, math and links are left alone. It can apply to book chapters only or to every note.

### Spellcheck on demand

Hide spelling squiggles while you draft, then turn them on with **Toggle spellcheck** when you revise.

### Dialogue focus

**Toggle dialogue focus** dims everything in the note except speech, so you can read a scene's dialogue on its own. Speech is a line that opens with a dash (—, – or ―), switched to narration and back by spaced dashes inside the paragraph (`— Vem cá — disse ela. — Agora.`), plus anything in double quotes of your quote style (and straight `"`). A hard-wrapped line inside a paragraph stays speech. Code, properties and comments are never speech. It works in Live Preview and Source mode, not in Reading view, and stays on for that note until you turn it off or restart Obsidian.

### Word counts in the file explorer

Tracked notes and chapters show their length next to their name, in the note's own unit (words, or characters for a note with `unit: characters`). A book's note, folder and chapters folder show the book's total. Past 10,000 the number is shortened (`12.3k`, or `12,3 mil` in Portuguese), and the full count is in the tooltip. Optionally, show a note's target or limit beside it (`4,210 / 5,000`) and folder totals for your other folders. A note near or past its limit is marked. The placeholder dot sits next to the name too.

### Snapshots

A snapshot is a copy of a note's text you can go back to. **Take a snapshot** (command or the file menu) saves one with a name you choose, like "Sent to the magazine". Escrita also takes automatic ones: **Before publishing**, **Before restoring** (every time you restore, so a restore can always be undone), and, if you turn it on, **Before the day's first edit** of a tracked note. Automatic snapshots are trimmed to the newest 20 per note (older ones go to the trash); the ones you take yourself are never removed.

The **Snapshots** panel lists the active note's snapshots with their length and how much the note changed since. From there you can view a snapshot's full text, compare it with the note now or with another snapshot (inline or side by side, word by word, with unchanged paragraphs folded), restore the whole note, rename or delete it. In a comparison, **Use the old version** puts back one passage (or the properties). Snapshots follow their note when you rename or move it, and are kept when you delete it: **Browse snapshots of deleted notes** opens them so you can copy the text back.

Snapshots are plain `.txt` files in `Escrita/Snapshots/<note path>/` (the folder is a setting), so search, graph and links ignore them. **Obsidian Sync** copies them only with "Sync all other types" turned on in its settings; git, iCloud, Dropbox and Syncthing copy them as they are.

## How books are organized

A note is a book when a folder with the same name sits next to it and holds a chapters folder:

```
Novels/The House.md              book note. Properties: goal (number), deadline (YYYY-MM-DD)
Novels/The House/Chapters/       chapters folder (name set in settings)
    01 Arrival.md                properties: status, summary (names set in settings)
    02 The locked door.md
Novels/The House/Darlings.md     passages you cut (path set in settings)
```

Chapter files start with their number. Escrita keeps the numbers in order when you add, remove or reorder chapters. Use **Create a book** to set up this structure for you.

Markers inside chapters are single-line comments:

```
%% beat: The letters in the tin box %%             a scene beat from the outline
%% XXX: check if the cellar has a window %%        a placeholder
---                                                a scene break, with blank lines around it
```

A beat counts as written when prose follows it before the next beat, scene break or the end of the file. Beats stay in the file after you write the scene. They work as invisible scene headings and keep the outline in sync.

## Settings

- **Books**: chapters folder name, chapter template (`{{title}}`, `{{date}}` and `{{time}}` are filled in), how many digits chapter numbers get (`01`, `001`…), the status and summary property names, and the status colors used in the outline.
- **Goals**: daily word goal, the hour the writing day ends, folders to track and to ignore, the size of a change that is ignored as a paste or sync, the default sprint length and word target, and whether to show the status bar.
- **Goals** (continued): the property names for a piece's target, limit, unit and deadline, the property name for a book's goal, weekdays off and dates off. Write amounts as `15000`, or quote them when they have separators (`"15.000"`): unquoted, `15.000` is the decimal number 15.
- **Goals** (file explorer): word counts on or off, the target next to the count, folder totals.
- **Publishing**: the status values for published and unpublished notes (the status property is the one under Books), the date property, and recommended properties.
- **Outline**: ghost beats on or off.
- **Placeholders**: the marker word, and whether to mark files in the file explorer.
- **Darlings**: the darlings note inside a book, and the note used for everything else.
- **Editor**: Enter, Enter, Enter; paragraph style; smart typography, where it applies, quote style and dialogue dash; spellcheck on demand.
- **Snapshots**: the snapshots folder (default `Escrita/Snapshots`; a folder that holds notes or sits inside a tracked folder is refused; a folder starting with a dot is hidden, but Obsidian Sync skips it; changing it doesn't move existing snapshots), the snapshot before the day's first edit, and how many automatic snapshots to keep per note.

## Commands

| Area | Commands |
| --- | --- |
| Outline | Open outline, Open outline as a board, Create a book, Add a beat to this chapter, Renumber chapters of this book |
| Goals | Open progress, Start a sprint, Stop the sprint |
| Placeholders | Insert placeholder, Next placeholder in this note, Previous placeholder in this note, Open placeholders |
| Darlings | Move selection to darlings, Open darlings |
| Editor | Toggle spellcheck, Insert scene break, Toggle dialogue focus |
| Snapshots | Take a snapshot, Open snapshots, Compare with the last snapshot, Browse snapshots of deleted notes |
| Publishing | Publish this note, Unpublish this note |

Escrita sets no hotkeys. Bind the ones you use often in Settings → Hotkeys. For example, Ctrl/Cmd+Shift+X for **Insert placeholder**.

## Installation

**From the community plugins list** (once it is accepted): open Settings → Community plugins → Browse, search for "Escrita", then install and enable it.

**With BRAT**: install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin, choose "Add a beta plugin", and enter `ClaudioDavi/escrita`.

**Manually**: download `main.js`, `manifest.json` and `styles.css` from the latest [release](https://github.com/ClaudioDavi/escrita/releases), put them in `<your vault>/.obsidian/plugins/escrita/`, reload Obsidian, and enable Escrita in Settings → Community plugins.

Escrita works on desktop and mobile.

## Privacy

No network access, no AI, no telemetry. Escrita never contacts a server or a model, and a test fails if network code ever appears in its source or in the built plugin. Your writing stays in your vault. Word history, settings and what Escrita remembers about published notes are saved in the plugin's `data.json` inside your vault's `.obsidian/plugins/escrita/` folder.

## Languages

Escrita follows Obsidian's language setting. It ships in:

- English
- Português (Brasil)

To add a language, add a key for it (for example `es` or `fr`) with translated strings to `src/strings.ts` and to each `src/*/strings.ts`. English is the source of truth. Missing strings fall back to English. Pull requests are welcome.

## Development

```
npm install
npm run dev      # bundle styles.css once, then rebuild main.js on every change
npm run build    # type check, bundle styles.css and make a production main.js
npm test         # unit tests
```

To try your build, link or copy the repository folder into a test vault's `.obsidian/plugins/escrita/`.

To release, run `npm version <patch|minor|major> --no-git-tag-version` (it updates `manifest.json` and `versions.json`), commit, then push a tag with the bare version number (for example `git tag 0.1.1 && git push --tags`). The release workflow builds the plugin and drafts a GitHub release with `main.js`, `manifest.json` and `styles.css`; publish the draft when it looks right.

## Changelog

### 0.3.1

- **Brazilian Portuguese wording**: snapshots are now "versões" ("Salvar uma versão") instead of the European "instantâneos". Delete actions say "Excluir" everywhere, and a few other strings read more naturally.

### 0.3.0

- **Snapshots**: take named snapshots of a note, automatic ones before publishing, before restoring and (optionally) before the day's first edit; a panel to view, compare, restore, rename and delete them; a compare tab with inline, side-by-side and full-text views and **Use the old version** for one passage. Stored as `.txt` files in `Escrita/Snapshots` (see the note on Obsidian Sync above). Known limits: a note created at a deleted note's path inherits that note's snapshots; two notes whose names differ only in special spaces or accents can't both have snapshots (Escrita says so instead of mixing them).
- **Dialogue focus**: dims everything but speech in the editor.
- **Word counts in the file explorer**, in each note's unit, with book totals and optional folder totals and targets. The placeholder dot is now drawn the same way.
- **Settings for the goal and deadline property names** of books and notes.
- **Counting fixes**: one counter for the status bar, outline, progress window, explorer and publish check. The outline reads a book goal of `"80.000"` as 80,000 (it showed 80), a goal of `"80.5"` now reads as 81 (it was 805), and `"1.000,5"` is ignored. Deadlines must be real dates (`2026-02-31` is ignored), and a YAML date no longer shifts a day in time zones west of UTC. A note with only `unit: characters` is counted in characters. "1 word", not "1 words".
- Bundles [jsdiff](https://github.com/kpdecker/jsdiff) (BSD-3-Clause) for comparing snapshots: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Internal: one measure module (`core/measure`) for counts, targets and goals, one file explorer decoration adapter (`core/explorer-decorations`), and one way to edit a note's text through the editor or the vault (`core/note-text`).

### 0.2.1

- **Standalone**: Escrita no longer assumes you publish to a website. Removed the "URL taken" and "URL changed" checks, the offer to keep a URL when renaming a published note, and the publish folders, slug property and keep-URL settings. Saved values for them are ignored. Publishing still checks the note and sets its status and date.
- **Beats and placeholders**: a `%% beat %%` or `%% XXX %%` inside a code block, the properties or another comment no longer counts anywhere (outline, ghost beats, placeholder dots and pills, publish check). Before, the editor and the publish check disagreed. Each beat or placeholder must be alone in its own `%% … %%` on its line.
- **Word counts**: the note, the selection and the publish check now read code blocks, comments and properties the same way. A selection's count no longer includes code or properties, and a code block indented with a tab is no longer treated as code.
- **Books with a nested chapters folder** (such as `Drafts/Chapters`) are now found by every feature, not only some of them.
- Internal: one Markdown segmenter (`core/markdown`) and one file classifier (`core/classify`) replace the copies each module kept; about 200 new tests.

### 0.2.0

- **Publish check**: **Publish this note** and **Unpublish this note**, with checks for unclosed comments, placeholders, unwritten beats, an empty body, recommended properties, the piece's limit, and taken or changed URLs. Offers to keep a published note's URL when you rename it. New **Publishing** settings.
- **Targets per piece**: `target`, `limit`, `unit` and `deadline` on any note, counted in words or characters (with or without spaces). The status bar and the progress window show the piece's length and pacing.
- **Days off**: weekdays and dates off that never break your streak and are skipped when pacing toward a deadline.
- **Outline for a single note**: the outline panel shows and edits the beats of a note outside a book.
- **Enter, Enter, Enter in any tracked note**: scene breaks in short stories and essays too, not only in chapters.
- **No network**: a test fails if network code appears in the source or the built plugin.

### 0.1

- First release: outline and ghost beats, goals and pacing, sprints, status bar, placeholders, darlings, Enter Enter Enter, smart typography, spellcheck on demand.

## License

[MIT](LICENSE). Includes work adapted from [NEO](https://github.com/hughhowey/neo), Copyright (c) 2026 Hugh Howey, MIT License.
