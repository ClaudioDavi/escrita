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
- A daily goal for all your writing, and a word goal and deadline for each book (stored as `goal` and `deadline` in the book note's properties).
- The **Progress** window shows today, the book and your streak, a 30-day chart of words per day with the book's running total, and pacing: words per day needed to hit the deadline, and the finish date projected from your 7-day average.
- Words written after midnight can count toward the day before, up to an hour you choose.

### Targets for a single piece

Any note can have its own length goal, not just books. Set `target` (the length you're aiming for), `limit` (a hard maximum, like a contest's), `unit` (`words`, `characters` with spaces, or `characters-no-spaces`) and `deadline` (YYYY-MM-DD) in its properties. Characters are counted on the text a reader sees: no properties, comments, code or formatting marks, with runs of spaces counted as one. An accented letter or an em dash counts as one character.

### Days off

Choose weekdays off and specific dates off. A day off never breaks your streak, and pacing toward a deadline counts only the days you write. Writing on a day off still counts.

### Publish check

**Publish this note** checks the active note before you publish it: an unclosed `%%` comment, placeholders left, unwritten beats, an empty body, missing recommended properties such as `description`, a length over the piece's limit, and a URL that another published note already uses or that changed since the last publish. Blockers can be overridden. Publishing sets the status property to your published value and the date property to today (or a date you choose). **Unpublish this note** puts the earlier status back. Escrita never commits or pushes; your sync or Git plugin does that.

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
- **Goals** (continued): the property names for a piece's target, limit and unit, weekdays off and dates off.
- **Publishing**: the status values for published and unpublished notes (the status property is the one under Books), the date property, recommended properties, the folders whose published notes must not share a URL, the slug property, and whether to offer keeping the URL when a published note is renamed.
- **Outline**: ghost beats on or off.
- **Placeholders**: the marker word, and whether to mark files in the file explorer.
- **Darlings**: the darlings note inside a book, and the note used for everything else.
- **Editor**: Enter, Enter, Enter; paragraph style; smart typography, where it applies, quote style and dialogue dash; spellcheck on demand.

## Commands

| Area | Commands |
| --- | --- |
| Outline | Open outline, Open outline as a board, Create a book, Add a beat to this chapter, Renumber chapters of this book |
| Goals | Open progress, Start a sprint, Stop the sprint |
| Placeholders | Insert placeholder, Next placeholder in this note, Previous placeholder in this note, Open placeholders |
| Darlings | Move selection to darlings, Open darlings |
| Editor | Toggle spellcheck, Insert scene break |
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
