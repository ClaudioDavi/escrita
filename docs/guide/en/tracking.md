# Tracking

This page is about knowing where each piece of writing stands, and getting back to it. It
covers the stages a work moves through, the snapshot Escrita takes when a work changes
stage, the home note with its works block, how Escrita remembers where you left off, and
writing mode, which hides everything but the note.

Other pages: [Getting started](getting-started.md), [Writing](writing.md),
[Revision](revision.md), [Publishing](publishing.md), [The world](the-world.md) and
[Features and settings](features-and-settings.md).

## Say where a work stands: stages and status words

A work moves through five **stages**: idea, draft, revision, ready and published. You don't
learn new words for them. You map each stage to the words you already put in the `status`
property, and Escrita reads the stage from the word.

A **work** is a book, or a tracked note, whose `status` is one of your stage words. Chapters
are not works. A note with no status is not a work. A note whose status isn't one of your stage
words (such as `paused`) is not a work either; the home block only counts it as "without a
stage".

In Settings › Escrita, **Stages** has one row per stage, **Words for Idea**, **Words for
Draft** and so on. Type your words separated by commas. The first word is the one Escrita
writes (when you publish, or when a new note starts as a draft); the others count too. Words
match ignoring capitals. The defaults are `idea`, `draft`, `revision`, `ready` and
`published`. A conto written in Portuguese might use `ideia`, `rascunho`, `revisão`, `pronto`
and `publicado`.

- **A word in two stages.** If you type the same word under two stages, the first stage wins,
  and the settings tell you so.
- **A color for each stage.** Each row has **Color for Draft** and so on, and **Remove the
  color** clears it. The colors show on the chapter dots and the stage chips in the outline,
  and as the key on the counts line of the home block.
- **Other status colors.** Statuses that aren't a stage, such as `paused` on a chapter, can
  have a color too. In **Other status colors**, write one per line as `word: color`, for
  example `paused: #6e6b66`.
- **The property.** The name of the status property (default `status`) is a setting in
  Properties and folders, **Status and summary properties**.

### New notes start as draft

With **New notes start as draft** on (it is on by default), a new book or chapter, and a note
you create in a tracked folder (from Obsidian's *New note* or from a template), gets your first
draft word as its `status`, unless it already has one. Escrita waits a moment after the note is
created, so a template's own status wins. Templates, universe entries and Escrita's own notes
(home, word lists, universe note) are left alone. Only the properties change.

## Keep a version at each stage: the stage snapshot

When you change a work's status to another stage, Escrita takes a snapshot named for the
change, in your own words, for example "draft → revision". It waits until the status has stopped changing for
a few seconds, so a quick fix of a typo in the word doesn't take two. For a book, it saves
the book's note and each chapter.

- **Stage snapshots are never trimmed.** They are your record of what the work looked like at
  each turn. They show as **Stage change** in the snapshots list (**Open snapshots**).
- **Only while Obsidian is open.** A status you change while Obsidian is closed isn't
  snapshotted.
- **It needs Snapshots.** The switch is **Snapshot at each stage**, in Features, group
  The desk. While Snapshots is off, it is grey and does nothing; it works again when you turn
  Snapshots on. See [Features and settings](features-and-settings.md).

## Start from one note: the home note

The home note is a note you own, with a block that Escrita draws. It answers "what do I write
today?". Add this to any note:

````
```escrita-works
```
````

Then set that note as the **Home note** in Settings › Escrita (the Home note section), or
run **Open the home note**, which offers to create it for you.

Escrita draws the block and never writes into it. It shows:

- **Writing**: your works in the draft stage.
- **Revising**: your works in the revision stage.
- **One line of counts** for the rest, with a colored dot per stage: ideas, ready, pending
  (when Submissions is on) and published, and works with no stage. Click a count to unfold
  the works under it; click again to fold it.

Each work is a line with its title and one fact: its length against its target or limit, its
deadline, or, for a book, how many chapters are ready. The works you edited last come first.

To see only some of your works, add `folder:` lines inside the block:

````
```escrita-works
folder: Contos
folder: Textos
```
````

Any other line is ignored. A folder that doesn't exist says so in the block.

### Open the home note

**Open the home note** opens the note. If you haven't set one, Escrita adopts an existing
`Home.md` or `Inicio.md`, and never overwrites it. If there is none, it asks first, then
creates the note with an empty works block (`Home.md` in English, `Inicio.md` in
Portuguese). If the note you set doesn't exist, it asks before creating it. Renaming or
moving the home note updates the setting.

The command has no default hotkey. You can give it one in Settings › Hotkeys.

### Open on startup

**Open on startup**, next to the home note setting, opens the home note in the active tab
when Obsidian starts, in place of the tab Obsidian restored. It is off by default. It only
acts when Obsidian starts: turning Escrita on in the middle of a session never swaps the tab
you are in.

## Come back where you stopped: where you left off

Click a work in the home block and it opens where you left off:

- **A note** opens at the spot you last edited. With no such spot, it opens at its first
  unwritten beat, and with no beat, at its end.
- **A book** opens the chapter you last edited, at the spot you last edited. With no such
  chapter, it opens the first chapter with an unwritten beat, else the last chapter at its end.

Escrita remembers the spot only for works and for the chapters of a book that is a work. It
keeps the text around your cursor along with the position, so if you changed the note from
another device or editor, it finds the place again by the words. It follows a note if you
rename or move it. There is nothing to set up and nothing to clean: the record is saved in
the plugin's data, never in your notes.

Ctrl-click (Cmd-click on a Mac) or middle-click a work to open it in a new tab. In writing mode a click opens the work in the
same tab.

If you turn the home block off in Features (**Works block and where you left off**), Escrita
stops recording where you left off and the block shows as plain code. The records stay and
come back when you turn it on.

## Write with only the note: writing mode

Writing mode hides everything around the note, so what is left is the page.

**What it hides.** The left and right sidebars, the tab bar, the ribbon and the status bar.
On a phone it also hides the note's title bar and the bottom bar. Nothing is written to your
vault, and nothing in your files changes.

**What stays.**

- **The note.** The reading column is your theme's.
- **A quiet "Exit writing mode" button** in the top right corner. It is always visible,
  because there is no hover on a phone.
- **A small goal counter**, such as "today 312 / 500", at the bottom of the screen, when
  Goals is on and you have a daily goal. It is the only thing Escrita adds. It follows Goals
  being turned on or off, and goes away with it.

**The commands.** Two commands, and the palette offers the one that fits the moment: **Enter
writing mode** when it is off, **Exit writing mode** when it is on. The first time in a session
you enter, a notice tells you how to leave. They have no default hotkey. Set your own in Settings › Hotkeys.

**Leaving.** The button or the command. Escrita reopens only the sidebars it closed, so a
sidebar you had already closed stays closed.

**Open in writing mode.** The setting **Open in writing mode**, next to **Open on startup**,
starts Obsidian in writing mode. If **Open on startup** is on too, the home note opens first
and then the mode starts. The setup's "Writing mode" layout turns it on for you
(see [Getting started](getting-started.md#two-layouts-the-writing-desk-and-writing-mode)).

**Open a work from the home note.** Click a work: it opens in the same tab, where you left
off, and you stay in writing mode.

Writing mode is part of the home block feature and has no switch of its own. Turning that
feature off while the mode is on leaves the mode first, so nothing stays hidden.

### Next to a zen plugin or a theme

Obsidian has no zen mode of its own, and community plugins do: **Zen Mode**, **Ultra Zen Mode**
and **Easy View** are three. If you want more than this (a typewriter scroll, fading the
other lines, hiding more of the chrome), try one of them. Escrita's mode stays small on
purpose: it can enter without a second plugin, and only Escrita has the goal counter and "where you left off".

The two can sit side by side. Escrita reopens only what it hid itself, so a zen plugin's own hiding is
left alone when you leave writing mode. If both of them hid the same sidebar, leaving Escrita's mode may bring it back; leave the zen
plugin's mode afterwards.

## Settings and commands on this page

| Where | Name | What it does |
|---|---|---|
| Settings › Stages | Words for each stage, Color for each stage, Other status colors, New notes start as draft | Map your status words to stages |
| Settings › Home note | Home note, Open on startup, Open in writing mode | The note that holds the block, and what happens when Obsidian starts |
| Features › The desk | Works block and where you left off, Snapshot at each stage | The home block and the stage snapshot |
| Commands | Open the home note, Enter writing mode, Exit writing mode | |

## When something looks wrong

| You see | Why | What to do |
|---|---|---|
| The block says "No works yet" | No note or book has a status that is one of your stage words | Set a status, or change the words under Stages |
| A note is missing from the block | It isn't tracked, has no status, or a `folder:` line leaves it out | Check the folder, the status and the block |
| A note is counted "without a stage" | Its status isn't one of your stage words | Add the word to a stage |
| No snapshot after a status change | Snapshots is off, or the status changed while Obsidian was closed | Turn on Snapshots |
| The block shows as code | Works block and where you left off is off | Turn it on in Features |
| No goal counter in writing mode | Goals is off, or there is no daily goal | Turn on Goals and set a goal |
