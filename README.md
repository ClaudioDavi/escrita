# Escrita

An Obsidian plugin for fiction writers: an outline that lives inside your chapters, word goals and sprints, placeholders, and a safe place for the passages you cut.

Escrita is inspired by [NEO](https://github.com/hughhowey/neo) by Hugh Howey (MIT License). Parts of its design and logic are adapted from NEO. Escrita is not affiliated with NEO or its author.

Your books stay plain Markdown. Everything Escrita adds to a chapter is an Obsidian comment (`%% … %%`), so it is hidden in Reading view and by most publishing tools.

## User guide

Step-by-step guides, in English and Brazilian Portuguese (they grow with each version):

- Features and settings: [English](docs/guide/en/features-and-settings.md) · [Português](docs/guide/pt-BR/features-and-settings.md)
- Writing (the outline, point of view, chapter targets): [English](docs/guide/en/writing.md) · [Português](docs/guide/pt-BR/writing.md)
- Publishing (the publish check, export, submissions): [English](docs/guide/en/publishing.md) · [Português](docs/guide/pt-BR/publishing.md)
- The world (the universe, "Appears in", threads, templates): [English](docs/guide/en/the-world.md) · [Português](docs/guide/pt-BR/the-world.md)

## Features

### Features page

Turn off what you don't use. The **Features** section at the top of the settings has a switch for each of 19 features, in five groups. A feature that is off isn't loaded: no commands, panels, menu items or background work. Its data stays and comes back when you turn it on again, and its settings hide. The universe's switch is its mode (off, per book, universe). It needs Obsidian 1.7.2 or later. The ribbon icon of a feature you turn off stays until you restart Obsidian. See [Features and settings](docs/guide/en/features-and-settings.md) ([Português](docs/guide/pt-BR/features-and-settings.md)).

### Outline and ghost beats

- The **Outline** panel in the right sidebar lists the chapters of the current book, with their number, title, status, summary and word count, plus the book's total against its goal.
- Each chapter can hold **beats**: one-line scene notes. A beat stays muted until you write the scene under it, then it gets a check mark.
- You can edit the outline from the keyboard. Enter adds a chapter or beat. Tab turns an empty chapter into a beat of the chapter before it. Shift+Tab turns an unwritten beat into a new chapter. Backspace on an empty line removes it. Drag chapters to reorder them, and the files are renumbered for you.
- Titles, summaries and beat text are editable in place. Chapter files are renamed with Obsidian's own rename, so links keep working.
- Outside a book, the panel shows the beats of the note you're in (a short story, an essay), with its length against its target or limit. Enter adds a beat, Backspace on an empty one removes it, and a note with no beats offers **Add the first beat**.
- **Ghost beats**: in Live Preview, beats show inside the chapter as faint labels ("Beat b · from outline") above where the scene goes. Put the cursor on the line to see the raw text.
- **Open outline as a board** writes a Canvas file with one card per chapter, colored by status.
- **Point of view and status** (0.7): a `pov` property on a chapter (a link or plain text) gives each chapter a colored stripe, and **Color by** switches the stripes between status and point of view. The header counts chapters by stage in your own words ("1 rascunho · 2 revisão"), and chips filter by stage and by point of view. Drag and renumbering pause while a filter is on. See [Writing](docs/guide/en/writing.md) ([Português](docs/guide/pt-BR/writing.md)).
- **Per-chapter targets** (0.7): a chapter's own `target` shows a thin bar under its title, and a `chapterTarget` property on the book note gives every chapter without a target a default. See [Writing](docs/guide/en/writing.md#a-target-for-every-chapter) ([Português](docs/guide/pt-BR/writing.md#uma-meta-para-cada-cap%C3%ADtulo)).

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

**Publish this note** checks the active note before you publish it: an unclosed `%%` comment, placeholders left, unwritten beats, an empty body, missing recommended properties such as `description`, and a length over the piece's limit. Blockers can be overridden. Publishing sets the status property to your word for the published stage and the date property to today (or a date you choose). **Unpublish this note** puts the earlier status back. Escrita doesn't publish anywhere: it only checks the note and updates its properties, so it works whether you post to a blog, send to a magazine, or just mark a piece as done.

### Export

**Export…** turns the active note, or its whole book, into a manuscript file: Markdown or DOCX, in the Shunn (Letter, English) or pt-BR (A4, Portuguese labels) template. Pick the chapters, check the preview and the readiness warnings, and write the file into the export folder (default `Escrita/Exports`). **Export again** repeats your last export for the work in one click. Comments, beats, placeholders and embeds never reach the file. Export files are never tracked or counted. See [Publishing](docs/guide/en/publishing.md) ([Português](docs/guide/pt-BR/publishing.md)).

### Submissions

**Record a submission** creates one note per submission in the submissions folder (default `Escrita/Submissions`), with the work, the market, the date sent and the result (`pending`, `accepted`, `rejected` or `withdrawn`). The home block shows how many are pending. Submission notes are never tracked or counted. See [Publishing](docs/guide/en/publishing.md) ([Português](docs/guide/pt-BR/publishing.md)).

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

### Revision lens

**Toggle revision lens** underlines what is worth rereading in the active note and opens a panel on the right. It only suggests: it never changes your text, nothing leaves your device, and it stays on for that note until you turn it off or restart Obsidian. It works in Live Preview and Source mode, not in Reading view.

Six rules, each with its own underline style, each can be switched off in the settings:

- **Echoes**: the same word, or one of the same family (*olhar / olhou / olhando*), within 40 words. The window starts over at a scene break and at a heading. Names, stop words and words under 4 letters are left alone.
- **Adverbs**: words in `-mente` (Portuguese) or `-ly` (English), minus real words that only look like adverbs (*mente, semente, only, family*).
- **Gerunds**: `-ando`, `-endo` and `-indo` words, *gerundismo* (*vou estar enviando*) and three or more gerunds in one sentence. In English the rule is "started to / began to" instead.
- **Crutch words**: the words and phrases you list in your word lists note. They match whole words, in any case, exactly as written, so list both *começou a* and *começaram a*.
- **Name variants**: a capitalized word that looks like a misspelling of a name you list (*Maira* for *Maria*). The name itself, its plural or diminutive, and a word you also write in lowercase are never flagged.
- **Long sentences**: sentences of more than 45 words, dialogue included.

The panel shows, for the whole note (or for the selection, labelled "Selection"): the **dialogue share** (the percentage of words that are speech, with each scene's share when the note has several) and **readability** (average sentence length, syllables per word and a reading-ease score with its band: Flesch adapted to Portuguese by Martins et al. 1996, or Flesch for English). Below, one row per rule with its count, the rate **per 1,000 words** so pieces of different lengths compare, and previous and next buttons that select the match ("3 / 12"). **Next revision lens match** and **Previous revision lens match** do the same for the rule you stepped last, handy from the mobile toolbar. On a phone the drawer closes after a step and a short notice shows where you are.

**Add to the word lists.** In the editor's context menu, with the lens on, **Add to crutch words**, **Add to names** and **Always ignore** add the selection (one line, 1 to 6 words) or the word under the cursor to the matching list in your word lists note. They are not offered for a selection that holds `%%` or starts like a list item, since that would not read back from the note. Nothing else in the note changes.

To drop a match you disagree with, use **Ignore here** in the editor's context menu on it, or in the panel while stepping. Escrita remembers it by the note, the rule, the word and the words around it, so it survives edits elsewhere in the note, and the panel offers "N ignored · Clear" to bring them back. Dismissals follow the note when you rename it.

**Word lists note.** A note you choose in the settings with three headings, in Portuguese or English: `## Vícios` / `## Crutch words`, `## Nomes` / `## Names`, `## Ignorar` / `## Ignore`, one entry per line. **Ignore** words stay out of echoes, adverbs, gerunds and name variants (not crutch words, which you listed on purpose). **Create the word lists note** makes one for you, with the three headings and a short starter list of crutch words, and never touches a note that exists. Without a word lists note the crutch and name rules stay silent and everything else works.

**Language.** The language setting is Automatic (follow Obsidian), Português (Brasil) or English. In another Obsidian language the echo, adverb, gerund and readability rules are off, and the panel offers **Open settings** so you can choose one; crutch words, name variants, long sentences and dialogue share still work. Syllable counts are approximate on purpose, and the lens skips headings, math blocks and (by default) `>` quotes, so its word count can differ a little from the status bar's.

### Home note and where you left off

Put a code block like this in any note, then set it as your **Home note** in the settings:

````
```escrita-works
```
````

Escrita draws it and never writes to it. It lists the works you are writing (status in the draft stage) and revising, each with its length against its target or limit, its deadline, or a book's chapters ready. Ideas, ready and published works are only counted. Add `folder: Contos` lines to show only the works in those folders. Click a work to open it where you left off: a note at the spot you last edited, a book at the chapter you last edited. If there is no such spot, a note opens at its first unwritten beat, else its end. **Open the home note** opens the note (and offers to create it if it doesn't exist; with no home note set, it adopts an existing `Home.md` or `Inicio.md`); **Open on startup** does it for you when Obsidian starts.

A work is a book, or a tracked note, whose status is one of your stage words. Chapters are not works. Escrita remembers where you left off only for works and a work's chapters.

### Move a paragraph or scene

**Move paragraph up/down** and **Move scene up/down** swap the paragraph (or the scene between `---` breaks) under your cursor with its neighbour, in one undo step. Beats, comments, code and math blocks stay where they are, and a move that would change how the note reads is refused. They work in the editor (Live Preview or Source), and have no default hotkeys.

### Stage snapshots

When you change a work's status to another stage, Escrita takes a snapshot named for the change (for example "Draft → Revision"), once the status has stopped changing for a few seconds. For a book it saves the book note and each chapter. Stage snapshots are never trimmed. A status you change while Obsidian is closed is not snapshotted.

### Word counts in the file explorer

Tracked notes and chapters show their length next to their name, in the note's own unit (words, or characters for a note with `unit: characters`). A book's note, folder and chapters folder show the book's total. Past 10,000 the number is shortened (`12.3k`, or `12,3 mil` in Portuguese), and the full count is in the tooltip. Optionally, show a note's target or limit beside it (`4,210 / 5,000`) and folder totals for your other folders. A note near or past its limit is marked. The placeholder dot sits next to the name too.

### Snapshots

A snapshot is a copy of a note's text you can go back to. **Take a snapshot** (command or the file menu) saves one with a name you choose, like "Sent to the magazine". Escrita also takes automatic ones: **Before publishing**, **Before restoring** (every time you restore, so a restore can always be undone), and, if you turn it on, **Before the day's first edit** of a tracked note. Automatic snapshots are trimmed to the newest 20 per note (older ones go to the trash); the ones you take yourself are never removed.

The **Snapshots** panel lists the active note's snapshots with their length and how much the note changed since. From there you can view a snapshot's full text, compare it with the note now or with another snapshot (inline or side by side, word by word, with unchanged paragraphs folded), restore the whole note, rename or delete it. In a comparison, **Use the old version** puts back one passage (or the properties). Snapshots follow their note when you rename or move it, and are kept when you delete it: **Browse snapshots of deleted notes** opens them so you can copy the text back.

Snapshots are plain `.txt` files in `Escrita/Snapshots/<note path>/` (the folder is a setting), so search, graph and links ignore them. **Obsidian Sync** copies them only with "Sync all other types" turned on in its settings; git, iCloud, Dropbox and Syncthing copy them as they are.

### Insert from a template

Set a **Templates folder** in the settings, then run **Insert from a template**. It lists the notes in that folder (with their path under the name), and the one you pick goes in at the cursor, or at the end of your selection. `{{title}}`, `{{date}}` (YYYY-MM-DD) and `{{time}}` (HH:mm) are filled in, and the template's properties are added to your note only where it doesn't have them yet; nothing is overwritten. It all goes in as one change, so one undo takes it back. It works in the editor (Live Preview or Source). Beats and placeholders in a template work as usual once inserted.

### Open threads

A thread is a loose end you plant in one story for a later one, written as a comment on its own line:

```
%% thread: who wrote the letters? %%
```

**Plant a thread** (command, or the editor menu) puts the marker at your cursor. If you selected text, it becomes the thread's text and stays in your prose. A small flag in the margin shows a line with an open thread. **Show open threads** lists every open thread with the date Escrita first saw it, grouped by work; click one to jump to it. It works in every mode: with the universe off, it covers the works Escrita tracks; per book, the book; with a universe, the universe's works.

To close a thread, use **Close thread** (cursor on the marker), the editor menu, or the button in the list. You can name the work that answers it, and the marker becomes `%% thread closed: who wrote the letters? → [[The House]] %%`. A closed marker is muted and struck through in the editor, and **Reopen thread** undoes it. Escrita rewrites the marker only if it is exactly as it was when you asked; if it moved or changed, nothing is touched. The word for closed is a setting. The dates are kept in Escrita's data, never in your notes.

### Shared universe

Off by default. Turn on **Shared universe** in the settings to keep characters, places, objects, groups and events that your stories share. For a walkthrough of setting it up, with threads and templates, see [the universe guide](docs/guide/en/the-world.md) ([Português](docs/guide/pt-BR/the-world.md)).

- **Per book**: entries live inside each book, in folders named for their type (`Characters/`, `Places/`…).
- **Universe**: entries are shared across works. A **universe note** (for example `Universe.md`) names the universe, and the folder beside it with the same name (`Universe/`) holds the entries.

A work joins a universe with a `universe` property that links the universe note (`universe: "[[Universe]]"`). A chapter takes its book's, unless it has its own. Notes inside the universe folder join without a property, and so do notes in the folders you list in the settings. An entry is a note with a `type` property (`character`, `place`, `object`, `group` or `event`; the words are settings, and so are the folder, template and menu name for each type). The folder is only where new entries go, so entries can move freely.

The **universe panel** has three tabs:

- **Entries**: grouped by type, searchable by name and alias. Each row can open the note, open it to the side, insert a link at your cursor, or show it in the file explorer; the + buttons create an entry. If the active note is outside any universe, an **Add to** button sets its `universe` property (only when you click it).
- **Threads**: the open threads of the universe, as above.
- **Works**: the works in the universe grouped by their `form` property (short story, essay, novella, novel, poem, fragment), or by their folder's form when they have none (the "Form by folder" setting); works with no form go under "No form", by stage and name, each with a dot in its stage color and its word count. Click one to open it where you left off.

**Create universe entry** (command, or the editor menu with some text selected) asks for the type, then makes the note in the type's folder from its template, with `type` and `universe` set, and can turn the selected text into a link and add an alias. If an entry with that name or alias exists, it offers to open it instead.

**Move this book's entries to the universe** moves a book's `Characters/`, `Places/`… notes into the universe's folders, after a preview. Links update. A name that already exists is never overwritten. Two boxes in the preview add the `type` property where a note lacks it (from the folder it came from) and the `universe` property to the book note; nothing already there is changed. Changing the mode never moves or edits notes.

#### Keep a note out of the universe

`universe: false` in a note's properties makes it standalone, even inside a folder you listed in the settings (an essay among your contos). It is checked before every other rule. On a book note it keeps the whole book out, unless a file links a universe itself. No setting and no word to translate: it is a plain true or false. See [The world](docs/guide/en/the-world.md#keeping-one-note-out-universe-false) ([Português](docs/guide/pt-BR/the-world.md#deixando-uma-nota-de-fora-universe-false)).

#### Appears in

Escrita finds where each entry is mentioned. The Entries tab shows "N works" beside an entry with mentions, and a click opens the list of works and chapters with counts and the first and last chapter. Each entry note also gets an **Appears in** section at its end (Live Preview and Source mode), drawn over the note and never written into it. A click on a work opens the note with the first mention selected.

Names match by the note's name and its `aliases`, whole words only. A capitalized name needs a capital letter (*Rosa* is not *rosa*), articles must match as written, accents are ignored (*Inês* is *Ines*), and plurals and diminutives follow the writing language (*Maria* and *Mariazinha*, but not *Mariano* for *Mariana*). For a character, the first name counts too, skipping titles (*Dona Benta Encerrabodes* is also *Benta*). A link counts once. Four optional properties on an entry adjust it: `aliases`, `caseSensitive`, `ignore` (phrases that don't count, like *rosa dos ventos*) and `firstName: false`; the three that are Escrita's own have names you can change in the settings. Nothing is written to your notes and nothing leaves your device. See [The world, section 9](docs/guide/en/the-world.md#9-appears-in-where-a-character-or-place-is-mentioned) ([Português](docs/guide/pt-BR/the-world.md#9-aparece-em-onde-um-personagem-ou-lugar-%C3%A9-mencionado)).

#### Names in spellcheck and the revision lens

Names and aliases of entries in a note's universe are not flagged as spelling errors in Live Preview (the word is marked "don't spellcheck"; your dictionary is never changed). **Underline names in the editor** (off by default) draws a thin line under them, and Ctrl/Cmd-click opens the entry. The revision lens reads the same names, so a variant of a name is flagged and a repeated name is not an echo. See [The world, section 10](docs/guide/en/the-world.md#10-names-in-the-editor-and-the-revision-lens) ([Português](docs/guide/pt-BR/the-world.md#10-nomes-no-editor-e-na-lente-de-revis%C3%A3o)).

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
%% thread: who wrote the letters? %%             a thread, for a later story
---                                                a scene break, with blank lines around it
```

A beat counts as written when prose follows it before the next beat, scene break or the end of the file. Beats stay in the file after you write the scene. They work as invisible scene headings and keep the outline in sync.

## Settings

- **Books**: chapters folder name, chapter template (`{{title}}`, `{{date}}` and `{{time}}` are filled in), how many digits chapter numbers get (`01`, `001`…), the titles that never get a chapter number in export and the outline (Prologue, Interlude, Epilogue…), and the status and summary property names.
- **Stages**: the five stages of a work (idea, draft, revision, ready, published), the status words you use for each (separate several with commas; the first is the one Escrita writes) and a color for each, used in the outline and its board (a chapter's dot; a single note's stage in the outline header) and as a key on the home block's counts line. Your existing published and unpublished values and status colors carry over the first time you open 0.4.
- **Other status colors**: colors for statuses that are not a stage, such as chapter ones. One per line, `word: color`.
- **Home note**: the note that holds your `escrita-works` block, and **Open on startup**, which opens it in the active tab when Obsidian starts (off by default; it replaces the tab Obsidian restored).
- **Goals**: daily word goal, the hour the writing day ends, folders to track and to ignore, the size of a change that is ignored as a paste or sync, the default sprint length and word target, and whether to show the status bar.
- **Goals** (continued): the property names for a piece's target, limit, unit and deadline, the property name for a book's goal, weekdays off and dates off. Write amounts as `15000`, or quote them when they have separators (`"15.000"`): unquoted, `15.000` is the decimal number 15.
- **Goals** (file explorer): the target next to the count and folder totals. (Word counts on or off is now on the Features page.)
- **Publishing**: the date property and recommended properties (the status words are under Stages, and the status property under Books).
- **Export**: your author name, the surname for the page header (empty means the last word of the name), contact lines for the title page, the chapter heading format (`{n}` and `{title}`), and the property names for leaving a chapter out (`compile`), a book's dedication and epigraph, and an author override (`author`).
- **Submissions**: the result values (the first one means pending) and the property names.
- **Outline**: ghost beats on or off.
- **Placeholders**: the marker word, and whether to mark files in the file explorer.
- **Darlings**: the darlings note inside a book, and the note used for everything else.
- **Editor**: Enter, Enter, Enter; paragraph style; smart typography, where it applies, quote style and dialogue dash. (Spellcheck on demand is now a switch on the Features page.)
- **Features** (0.7): the **Writing language** (Automatic, Português (Brasil) or English; it used to be under Revision) and the 19 switches. Word counts in the explorer, spellcheck on demand and the universe mode live here now.
- **Properties and folders** (0.7, always shown): the property names for a piece's target, limit, unit and deadline, a book's goal, a chapter's point of view (`pov`) and a book's default chapter target (`chapterTarget`), plus the track and ignore folders, and (0.8) the export and submissions folders, shown even when those features are off.
- **Revision**: the word lists note (path, with a **Create** button), the echo window (default 40 words, 10 to 200) and the long sentence length (default 45 words, 15 to 200), **Skip quotes** (lines that start with `>` are not read), one toggle for each rule, and **Show dialogue share** and **Show readability**.
- **Templates**: the templates folder used by **Insert from a template**. Empty turns the command off.
- **Universe**: the universe note (with a **Create** button), the folders whose notes join the universe without the property, the universe, type and form properties, the six form words, the form of each folder ("Form by folder", as `Folder: form` lines), and for each of the five entry types its value, folder, template and name in menus (you can rename them, not add or remove any). There is no separate folder setting: entries live in the folder beside the universe note. Since 0.7 also **Underline names in the editor** (off by default), **Extra titles** (one per line, added to the built-in Portuguese and English titles) and the names of the entry properties `caseSensitive`, `ignore` and `firstName`.
- **Threads**: the thread word (default `thread`) and the word that marks a closed thread (default `closed`; use your own language, for example `fechado`). Both work in every mode.
- **Snapshots**: the snapshots folder (default `Escrita/Snapshots`; a folder that holds notes or sits inside a tracked folder is refused; a folder starting with a dot is hidden, but Obsidian Sync skips it; changing it doesn't move existing snapshots), the snapshot before the day's first edit, and how many automatic snapshots to keep per note.

## Commands

| Area | Commands |
| --- | --- |
| Outline | Open outline, Open outline as a board, Create a book, Add a beat to this chapter, Renumber chapters of this book |
| Goals | Open progress, Start a sprint, Stop the sprint |
| Placeholders | Insert placeholder, Next placeholder in this note, Previous placeholder in this note, Open placeholders |
| Darlings | Move selection to darlings, Open darlings |
| Editor | Toggle spellcheck, Insert scene break, Toggle dialogue focus, Move paragraph up, Move paragraph down, Move scene up, Move scene down |
| Home | Open the home note |
| Revision lens | Toggle revision lens, Next revision lens match, Previous revision lens match, Create the word lists note |
| Snapshots | Take a snapshot, Open snapshots, Compare with the last snapshot, Browse snapshots of deleted notes |
| Publishing | Publish this note, Unpublish this note, Export…, Export again, Record a submission |
| Templates | Insert from a template |
| Threads | Plant a thread, Close thread, Show open threads |
| Universe (when the mode isn't off) | Open the universe panel, Create universe entry, Move this book's entries to the universe |

Escrita sets no hotkeys. Bind the ones you use often in Settings → Hotkeys. For example, Ctrl/Cmd+Shift+X for **Insert placeholder**.

## Installation

**From the community plugins list** (once it is accepted): open Settings → Community plugins → Browse, search for "Escrita", then install and enable it.

**With BRAT**: install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin, choose "Add a beta plugin", and enter `ClaudioDavi/escrita`.

**Manually**: download `main.js`, `manifest.json` and `styles.css` from the latest [release](https://github.com/ClaudioDavi/escrita/releases), put them in `<your vault>/.obsidian/plugins/escrita/`, reload Obsidian, and enable Escrita in Settings → Community plugins.

Escrita works on desktop and mobile. From 0.7 it needs Obsidian 1.7.2 or later.

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

### 0.9.0

- **Unlinked mentions**: the universe panel lists the places in the note you are in where an entry is named without a link. **Create link** turns that one mention into a link, on your click, and writes nothing else. See [The world](docs/guide/en/the-world.md#11-unlinked-mentions).
- **Names without an entry**: a new revision lens rule, off until you turn it on, marks capitalized names that recur (5 times in the note, or in 2 works) and match no entry. **Create** opens the new-entry dialog with the name filled in; **Dismiss** adds the word to the **Not names** setting. See [The world](docs/guide/en/the-world.md#names-without-an-entry).
- **EPUB export**: **Export…** now offers EPUB 3 beside Markdown and DOCX, with a title page, a table of contents, one file per chapter, an ornamental scene break (a setting) and an optional cover from a `cover` property. See [Publishing](docs/guide/en/publishing.md#export-an-epub).
- **Collections**: select several contos in the file explorer, right-click, **Create a collection…**. The note lists the stories in a `contents` property and exports as one DOCX, EPUB or Markdown file. See [Publishing](docs/guide/en/publishing.md#export-a-collection-of-stories).
- **Publish next chapter**: for a book released one chapter at a time, the command and an outline button open the first unpublished chapter's publish check; the outline header shows the next chapter, the last published and any gap, and the check warns when an earlier chapter isn't published. See [Publishing](docs/guide/en/publishing.md#publish-a-book-one-chapter-at-a-time).
- **Read the book**: a read-only view of every chapter in order, with the export's chapter headings and scene breaks and your markers hidden. Click a paragraph to open that chapter at that line; it remembers where you stopped. See [Writing](docs/guide/en/writing.md#read-the-book).
- **Settings**: Not names, the cover property, the EPUB scene break and the collection property. See [Features and settings](docs/guide/en/features-and-settings.md#settings-added-in-09).
- Upgrade notes:
  - The revision lens runs one new pass after the update. Nothing is marked by the new names rule until you turn it on.
- Internal: scope is a field of the classifier (`books.classify(x).scope`) and `core/scope.ts` holds the rule; the names port answers the lens's names rule; the EPUB writer is checked with EPUBCheck in CI.

### 0.8.0

- **Export**: **Export…** turns the active note, or its whole book, into a manuscript file: Markdown or DOCX, in the Shunn (Letter, English) or pt-BR (A4, Portuguese labels) template. A preview shows the manuscript before the file is written, readiness warnings link to their lines, and **Export again** repeats the last export in one click. Files go to the export folder (default `Escrita/Exports`). See [Publishing](docs/guide/en/publishing.md#export-a-note-or-a-book).
- **Chapters without a number**: a chapter numbered `00` is a prologue (first, its title alone, not counted), and the new **Chapters without a number** setting lists titles (such as an epilogue) that also export with their title alone. See [Publishing](docs/guide/en/publishing.md#export-a-note-or-a-book).
- **Author and contact**: settings for your name, surname and contact lines, used on the title page and in the header. An `author` property on a book or a note overrides the name.
- **Submissions**: **Record a submission** makes one note per submission in the submissions folder (default `Escrita/Submissions`), with the work, the market, the date and the result. The home block shows how many are pending. See [Publishing](docs/guide/en/publishing.md#record-a-submission).
- **Settings**: each feature now draws its own section, in the same order as before, and a text field saves when you leave it instead of on every key. Export and submissions are two new switches on the Features page, which now has 19.
- **Performance**: index passes now yield every 8 ms, so Obsidian stays responsive while a large vault is read. "Appears in" builds on demand, when you first open it, so startup index work on a 3,000-note vault drops from about 4.2 s to under 0.1 s, and typing in a long chapter no longer recomputes mentions. Name matching and the revision lens are faster.
- **Fix**: only a `<!--` at the start of a line that is never closed hides the rest of the note from counts and the publish check, and the publish check warns about it. A `%%` inside `$$` math is literal, as in Reading view.
- Upgrade notes:
  - Notes in the export folder (`Escrita/Exports`) and the submissions folder (`Escrita/Submissions`) never count toward goals and never become works.
  - In the Editor section of the settings, the paragraph style and quote style rows now come after the typing rows.
  - There are 19 feature switches, up from 17.
- Internal: a manuscript model and book source in core, readiness checks shared by publish and export, `notes.create` for new notes (including binary files), one name fold, and time-budgeted index passes.

### 0.7.0

- **Features page**: a switch for each of 17 features, in five groups, at the top of the settings. An off feature is not loaded, its settings hide and its data stays. See [Features and settings](docs/guide/en/features-and-settings.md).
- **Keep a note out of the universe**: `universe: false` on a note, or on a book note for the whole book. See [The world](docs/guide/en/the-world.md#keeping-one-note-out-universe-false).
- **Appears in**: where each entry is mentioned, in the panel's Entries tab and in a section at the end of each entry note, with counts. See [The world](docs/guide/en/the-world.md#9-appears-in-where-a-character-or-place-is-mentioned).
- **Names in spellcheck and the revision lens**: entry names are not flagged as typos, an optional underline shows them, and the lens reads them. See [The world](docs/guide/en/the-world.md#10-names-in-the-editor-and-the-revision-lens).
- **POV and status in the outline**: colored stripes, a Status/POV toggle, stage and POV chips, and a summary by stage. See [Writing](docs/guide/en/writing.md).
- **Per-chapter targets**: a bar per chapter, and `chapterTarget` on the book note as the default. See [Writing](docs/guide/en/writing.md#a-target-for-every-chapter).
- **User guide**: `docs/guide/` in English and Brazilian Portuguese; the universe guide moved there as "The world".
- The minimum Obsidian version is now 1.7.2.
- **Writing language** moved out of Revision to the Features page, with the same key.
- Word counts in the explorer, spellcheck on demand and the universe mode moved to the Features page as switches.
- The piece property names and the track folders moved to a section called "Properties and folders".
- Drag and renumbering in the outline pause while it is filtered, and Tab no longer turns a chapter (or a new line) into a beat of a chapter the filter hides.
- New books and chapters, and notes you create in a tracked folder, start in the draft stage: they get your first draft status word unless they (or their template) already have a status. Templates, universe entries and Escrita's own notes are left alone. Turn it off in Settings → Stages, "New notes start as draft". In "Appears in", a book counts as a work even before its note has a status.
- A feature turned off keeps its ribbon icon until you restart Obsidian (a click says the feature is off), and on a phone a command pinned to the mobile toolbar keeps a dead button until you restart.
- Internal: modules now load and unload at runtime, and the outline reads each chapter through one row loader.

### 0.6.0

- **Shared universe** (off by default): characters, places, objects, groups and events that your stories share. Three modes: off, per book (entries inside each book) and universe (entries in the folder beside a universe note). A work joins with a `universe` property, through its book, or by sitting in one of the folders you list. Five entry types, renamable, each with its folder, template and name in menus. Changing the mode never moves or edits notes. A walkthrough is in [the universe guide](docs/guide/en/the-world.md).
- **Universe panel**: **Entries** (grouped by type, searchable by name and alias ignoring accents, with open, insert link and show in explorer), **Threads** and **Works** (grouped by form, by stage and name, with stage dots and word counts; a click opens where you left off). An **Add to** button joins the note you're in to the universe, only when you click it. A picker appears when there is more than one universe.
- **Create universe entry**: from a selection in the editor menu, the command or the panel. It makes the note from the type's template with `type` and `universe` set, can link the selected text (one undo) and add an alias, and offers to open an entry that already has that name or alias. It never overwrites a note.
- **Move this book's entries to the universe**: moves a book's `Characters/`, `Places/`… notes into the universe after a preview, with links updated. Names that already exist are listed and left in place, chapters are never moved, and two boxes add a missing `type` and the book's `universe` property.
- **Forms**: a `form` property (short story, essay, novella, novel, poem, fragment; the words are settings), and **Form by folder** so works take their form from their folder (`Short stories: short story`) without the property.
- **Open threads**: `%% thread: … %%` marks a loose end for a later story. **Plant a thread** inserts one at the cursor, the editor flags it in the margin, and the panel (or **Show open threads** when the universe is off) lists them by work with the date each was first seen. Close one with an optional answer (`%% thread closed: … → [[The House]] %%`) and reopen it; both only write if the marker is unchanged. The thread word and the closed word are settings.
- **Insert from a template**: a **Templates folder** setting and a command that inserts a template at the cursor, fills `{{title}}`, `{{date}}` and `{{time}}`, adds only the properties the note lacks, and undoes in one step.
- Internal: the outline's beat edits now go through the shared note text port, so a chapter open in an editor is edited there and the change joins its undo history.

### 0.5.1

- **Fix**: the revision lens could keep showing marks from before you edited the word lists note (a name you had just added still underlined as a name variant until you turned the lens off and on). Marks now follow the lists as soon as the note changes, and a failed refresh no longer stops an editor from updating.
- **Add to the word lists from the editor menu**: with the lens on, the context menu offers **Add to crutch words**, **Add to names** (for a capitalized word or name) and **Always ignore** (for a single word). It uses your selection (one line, 1 to 6 words) or the word under the cursor, and writes one line under the matching heading of the word lists note. A word already there is not added twice ("Already in the list"). If the note is missing, a starter note is created; if the setting was empty, it is filled in. The rest of the lists note is not touched.

### 0.5.0

- **Revision lens**: **Toggle revision lens** underlines what is worth rereading in the active note and opens a panel. Six rules: echoes, adverbs, gerunds (in English, "started to"), crutch words, name variants and long sentences, each with its own underline and its own switch in the settings. It only suggests and never changes your text. Portuguese (Brasil) and English; in another Obsidian language the panel offers **Open settings** to choose one.
- **Panel measures**: dialogue share (and each scene's share), readability (words per sentence, syllables per word and a reading-ease score with its band: Flesch adapted to Portuguese, or Flesch for English), and each rule's count per 1,000 words. They describe the text and don't grade it.
- **Stepping**: previous and next buttons for each rule ("3 / 12"), and the commands **Next revision lens match** and **Previous revision lens match** for the rule you stepped last. On a phone the drawer closes after a step and a short notice shows where you are.
- **Ignore here**: drop a match you disagree with from the editor's context menu or the panel. It is remembered by the note, the rule, the word and the words around it, follows renames, and the panel's "N ignored · Clear" brings the matches back.
- **Word lists note**: a note you choose in the settings with `## Vícios` / `## Crutch words`, `## Nomes` / `## Names` and `## Ignorar` / `## Ignore`. **Create the word lists note** makes one with a short starter list and never touches an existing note.
- **Revision settings**: language, word lists note, echo window, long sentence length, **Skip quotes**, a toggle per rule, and **Show dialogue share** and **Show readability**.
- **Stemmers**: small Portuguese and English stemmers (`core/stem/`) that group *olhar / olhou / olhando* and keep *casa* and *casamento* apart. Internal for now; the universe will use them later for matching names.
- **Editor loose ends**: the old editor helpers are gone and the editor reads the Markdown segmenter everywhere. Two behaviour changes follow.
  - A `---` inside a code block or a comment no longer counts as a scene break next to a beat in the outline.
  - Removing a trailing scene break in a note that is closed keeps the note's own line endings.

### 0.4.0

- **Stages**: a work moves through five stages (idea, draft, revision, ready, published), each mapped to the status words you already use. New **Stages** settings with a color for each. Your published and unpublished values and status colors carry over the first time you open 0.4: the old settings stay in `data.json`, and an edit to them made after upgrading (for example in 0.3.x) is ignored. Status words are matched ignoring case, and an accent typed as a combining mark still matches. Any of your published words now counts as published, not only the first. Publishing writes the first word of the published stage, and unpublishing restores the earlier status.
- **Stage snapshot**: when a work's status changes to another stage, Escrita takes a snapshot of it ("Draft → Revision"). Stage snapshots are never trimmed.
- **Home block**: an `escrita-works` code block in a note you own lists what you are writing and revising, and counts the rest. A click opens the work where you left off. New **Open the home note** command and an **Open on startup** setting.
- **Where you left off**: Escrita remembers the last place you edited in each work (and in a book's chapters), and the home block opens there. It follows renames.
- **Move a paragraph or scene**: **Move paragraph up/down** and **Move scene up/down**, in one undo step.
- Internal: a reusable vault index (`core/vault-index`) that follows renames, deletes and edits, now behind placeholders, publish records, dialogue focus, goals history, the works list, where you left off and the home note path. The measurer, the explorer and the snapshots store still keep their own path-keyed state.

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
