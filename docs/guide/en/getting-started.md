# Getting started

This page takes you from installing Escrita to a first conto and a first book. You can do
it with one command, **Set up a writing vault**, which shows you everything before it creates
anything. Or you can skip the command and do it by hand: the last two parts of the page
show how.

Other pages: [Features and settings](features-and-settings.md), [Writing](writing.md),
[Publishing](publishing.md) and [The world](the-world.md).

- [Install Escrita](#install-escrita)
- [The first-run notice](#the-first-run-notice)
- [Set up a writing vault](#set-up-a-writing-vault)
- [What the setup never does](#what-the-setup-never-does)
- [The examples](#the-examples)
- [The home note](#the-home-note)
- [Two layouts: the writing desk and writing mode](#two-layouts-the-writing-desk-and-writing-mode)
- [Your first conto, by hand](#your-first-conto-by-hand)
- [Your first book, by hand](#your-first-book-by-hand)
- [Commands and settings on this page](#commands-and-settings-on-this-page)

## Install Escrita

Escrita needs Obsidian **1.8.7 or later**. It works on desktop and on phones.

- **From the community plugins list**, once Escrita is accepted there: open Settings ›
  Community plugins › Browse, search for "Escrita", then install and enable it.
- **With BRAT**: install the BRAT plugin, choose "Add a beta plugin", and enter
  `ClaudioDavi/escrita`.
- **By hand**: download `main.js`, `manifest.json` and `styles.css` from the latest release on
  GitHub. Put them in `<your vault>/.obsidian/plugins/escrita/`, reload Obsidian, and enable
  Escrita in Settings › Community plugins.

Escrita never contacts a server. Your writing stays in your vault.

A fresh install takes the defaults of Obsidian's language, once: any Portuguese gives
Portuguese defaults (statuses such as `rascunho`, folders such as `Capítulos`), and any other
language gives English ones. They are saved, so they never change when Obsidian's language
does. A fresh install also starts with the **Writer** set of features (see
[Features and settings](features-and-settings.md)). If you update from an earlier version,
nothing changes: your settings and switches stay as they were.

## The first-run notice

The first time Escrita loads in a fresh install, a small notice appears:

> Escrita is ready. Want to set this vault up for writing? I show everything before I create it.

It has two buttons, **Set up…** and **Not now**. It goes away by itself after about twenty
seconds. It is a notice, not a window, so you can ignore it and keep working.

It shows once, whatever you answer. If you update from an earlier version you never see it.
You can run the setup at any time from the command palette (next part).

## Set up a writing vault

Open the command palette and run **Set up a writing vault** (in Portuguese, **Preparar o
cofre para escrever**). It has no hotkey. You can run it as many times as you like: what
already exists is listed as staying, and nothing is touched twice.

The window has two steps. Nothing is written until you press **Create** in the second one.

### Step 1: choices

- **What do you write?** **Short fiction**, **A novel** or **Both**. Short fiction makes a
  folder for contos and essays (`Stories`). A novel makes a folder for books (`Books`), where
  each book gets a subfolder. Both makes the two.
- **Language of the defaults.** **English** or **Português (Brasil)**. It starts on
  Obsidian's language. It decides only the words Escrita writes into notes and uses as names:
  the status words, the folder and note names, the lists. The interface stays in Obsidian's
  language. The example notes and the home note are written in this language too.
- **Starting point.** Three cards: **Essentials** (9 of 19 switches), **Writer** (16 of 19)
  and **Everything** (all 19). It starts on **Writer**. A preset is a starting point, not a
  mode: afterwards every switch is yours in Settings › Escrita › Features. What each one
  turns on is in [Features and settings](features-and-settings.md).
- **Shared world.** **Off**, **Per book** or **Universe**, for characters and places. It shows
  only with **Everything**, because the mode changes where entries live, and you can decide
  later. See [The world](the-world.md).

Press **See what I'll create**.

### Step 2: what I'll create

The second step lists everything the setup will do, in groups. Each row says what it is and
why. A mark in front of a row tells you what it will do: **+** is new, **=** stays as it is,
and **·** is a setting that changes.

| Group | What it lists |
|---|---|
| **Folders** | `Stories` and/or `Books`. A folder that already exists is used as it is, and the row says how many notes are in it. If you keep a list of track folders, a new folder is added to it (see below). |
| **Examples** | The example conto and the example book, if you want them (see [the examples](#the-examples)). |
| **Settings** | Every setting the setup would change, with its value, and every one it leaves alone, with the reason. |
| **Home note** | `Home.md` (`Início.md` in Portuguese), with the works block. |
| **Layout** | **Arrange the screen once**, with two cards: the writing desk and writing mode. |

Some rows have a box you can tick. Only ticked rows run. A row with no box has no choice to
make:

| Box | What it covers |
|---|---|
| **Examples** | All the example notes together. |
| **Language of the defaults** | The language and every word-bearing setting: **Statuses**, **Chapters folder**, **Unnumbered chapter titles**, **Submission results**, **Export folder**, **Submissions folder**, the darlings notes, **Universe note**, **Entry types**, **Form values**, **Thread keyword**, **Closed-thread word**, and **Writing language**. |
| **Home note** | Creating the home note and setting it as your **Home note**. |
| **Open the home note on startup** | Opens the home note when Obsidian starts. |
| **Features** | Turns the switches to match the preset you chose. |
| **Arrange the screen once** | The layout. |

The rows without a box are the folders and the track folders row (**Folders that count**),
and the **Shared world** answer you gave in step 1.

**In a vault that already has works**, the setup is careful. The boxes for the examples, the
language, opening on startup and the features come unticked, with a line saying why ("Unticked:
you already have works"). The layout also comes unticked when you have more than one tab or
panel open. Tick a row if you do want it. A setting you saved yourself is listed as staying
("You already saved this one; it stays"), whatever its box says.

**Folders that count.** Escrita counts words only inside your track folders. If you have none
(the whole vault counts), the row says so and nothing changes. If you have some, the setup adds
the new folders to the list. It never replaces it.

At the bottom a line sums up: "No existing note changes. A folder that already exists is used
as it is." and "I'll create 9 items and change 6 settings." Press **Back** to change your
choices (the ticks you set stay), **Cancel** to stop, or **Create**.

### What happens when you press Create

1. The folders are made.
2. The example notes and the home note are written.
3. The settings are saved, once, last, and only if every folder exists.
4. The layout is applied, if it is ticked, and the home note opens.

A notice says what happened: "Done. I created 9 items and changed 6 settings. The home note is
open."

If something fails (a file name that is not allowed, a folder that is really a file), the
notice says what was made and what wasn't: "I created 4 of 9 items. I couldn't create …".
**Nothing is undone.** What was made stays, the settings are not saved, and you can run the
command again after fixing the cause.

## What the setup never does

- It never changes, overwrites or deletes an existing note. Each file is made only if nothing
  is there already, in any letter case. If a note appears after the preview, it is counted as
  skipped, not written.
- It never changes a saved setting without a box ticked. The only things that change without
  a box are the track folders list (new folders are added to it) and the **Shared world**
  answer you picked yourself in step 1.
- It never moves your snapshots or changes the list of folders Escrita ignores. A fresh
  Portuguese install uses `Escrita/Versões` for snapshots and `Modelos` as the templates
  folder; an existing install keeps what it has.
- It never closes a tab or a panel. The layout adds to what is open.
- It never sets a hotkey, and never contacts a server.
- It never asks you to keep anything up to date. It runs once, and afterwards the notes, the
  settings and the layout are yours.

## The examples

The examples show each feature working, so you can look before you write. The names start with
**Example ·** (**Exemplo ·** in Portuguese) and each note has `example: true` in its
properties, so they are safe to delete whenever you like. The home note says so too.

**A conto**, in your stories folder (with short fiction or both): *Example · The crossing* (*Exemplo · A travessia*).

- A target of 2,000 words and the draft status.
- Two beats (`%% beat: … %%`), so the outline has something to show.
- A little prose between them, and one placeholder (`%% XXX: … %%`), so the placeholder
  panel and the publish check have something to find.

**A book**, in your books folder (with a novel or both): *Example · The lighthouse* (*Exemplo · O farol*).

- The book note, with the premise and a default target for the chapters.
- A chapters folder with two chapters. *01 Arrival* has prose, two beats, a placeholder and a
  target of 1,200 words. *02 The storm* has three beats and no prose yet, so its beats show as
  ghosts, and a target of 1,500.

In a vault that already has works, the examples come unticked. Delete them whenever you want:
nothing else depends on them.

## The home note

The home note is a note you own. It holds one code block, ` ```escrita-works `, and Escrita
draws it: what to write today, each work with its length against its target or deadline, and
**Continue**, which opens a work where you left off. Escrita draws the block and never writes
to it. Add whatever you like around it.

The setup creates it as `Home.md` (`Início.md` in Portuguese) at the root of your vault, starts
it with one line saying the note is yours, and sets it as your **Home note**. If a note with that
name exists in another letter case (`home.md`), the setup uses it as it is.

- **Open the home note** opens it. If it does not exist yet, the command offers to create
  one. With no home note set, it looks for an existing `Home.md` or `Inicio.md`.
- **Home note** (Settings › Escrita, the Home note section) is the path to the note.
- **Open on startup** opens the home note in the active tab when Obsidian starts. It is off
  by default, and the setup has a row for it, **Open the home note on startup**.

A work is a book, or a tracked note, whose status is one of your stage words. The block lists
the works you are writing and revising, and counts the ones that are only ideas, ready or
published. Each work opens where you last edited it.

If the block shows as plain code, the **Works block and where you left off** switch is off. Turn
it on in Features.

## Two layouts: the writing desk and writing mode

Step 2 of the setup ends with **Arrange the screen once**. Pick a card. After the setup, Escrita
does not touch the layout again: it is yours.

### The writing desk

The home note in front, in the main area. On the right, the sidebar is split in two: the
outline, with chapters and their beats, on top, and the revision lens below, with the
placeholders as a second tab behind it. If the universe is on, its panel is a second tab on
the left, behind the files. A panel whose feature is off is left out, and the rest close up
around the gap.

On a phone the drawers don't split, so the outline and the lens are two tabs of the right
drawer.

The home note opens in a tab that already shows it, else in an empty tab, else in a new tab. It
never opens over a tab with something else in it.

### Writing mode

Only the note. The sidebars, the tab bar, the ribbon and the status bar hide (on a phone, also the
note's header). Two things stay:

- A quiet **Exit writing mode** button in the corner, always visible, because a phone has no
  hover.
- A small counter at the bottom, "today 312 / 500", your words today against your daily goal.
  It shows only while **Goals and sprints** is on, and nothing else is shown.

**Continue** in the home block opens the work in the same tab, still in writing mode.

Commands: **Enter writing mode** and **Exit writing mode**. You see one or the other,
according to the state. Neither has a hotkey; bind the one you use in Settings › Hotkeys.
Entering shows a notice once per session: "Writing mode. To leave: the button in the corner or
the command."

The setting **Open in writing mode** (in the Home note section, beside **Open on startup**)
starts Obsidian in writing mode, after the home note opens. The setup turns it on when you pick
the writing mode card.

Writing mode writes nothing to your vault. It adds a style class and collapses the sidebars that
were open. Leaving it reopens only the sidebars it closed, and only what it hid comes back.
It also leaves by itself if you turn the desk off or disable Escrita. Writing mode is a part of
**Works block and where you left off**; there is no separate switch.

It is deliberately small. If you want more (typewriter scrolling, fading, a wider text column),
the Zen Mode, Ultra Zen Mode and Easy View plugins do that, and your theme sets the reading
column. Escrita's only extra is the goal counter and **Continue**. Avoid running two of these at
once: both hide the same bars.

## Your first conto, by hand

You don't need the setup for this. A conto is any note.

1. Make a note where you want it, for example `Stories/The crossing.md`. If you have a list of
   track folders (Settings › Escrita, **Folders to track**), make it inside one. If the list is
   empty, the whole vault is tracked.
2. Add properties to the top of the note:

   ```
   ---
   status: draft
   target: 2000
   ---
   ```

   `status` is one of your stage words: `draft` in English, `rascunho` in the Portuguese defaults.
   They are set in Settings › Escrita, **Stages**. `target` is the length you aim for, in words.
   You can add `unit: characters` to count in characters, `limit` for a hard maximum, and
   `deadline: 2026-12-31`. The property names are settings too.
3. Write. Escrita counts the words you type in the note, against your daily goal (**Daily word
   goal**, in the Goals section).
4. Plan if you like. A line `%% beat: Mara and her father cross the bay %%` is a scene beat,
   shown in the outline and as a faint label in the editor until prose follows it. A line
   `%% XXX: the name of the town %%` is a placeholder for something you don't know yet.
   **Insert placeholder** adds one at the cursor. Both are Obsidian comments, so Reading view
   hides them.
5. Open the home note. With the status in a stage and the note in a tracked folder, the conto
   is a work, and the block lists it with its length against the target.

When you finish, change the status to the next stage. How to revise and publish it is in
[Writing](writing.md) and [Publishing](publishing.md).

## Your first book, by hand

A note is a book when a folder with the same name sits next to it, and that folder holds a
chapters folder:

```
Books/The lighthouse.md                      the book note
Books/The lighthouse/Chapters/               the chapters folder (its name is a setting)
    01 Arrival.md                            one note per chapter
    02 The storm.md
```

**The quick way**: run **Create a book**. A window asks for a **Title** and a **Folder** (empty
means the root of the vault). Escrita makes the book note, with the draft status and a goal of
80,000 words, makes the folder and the chapters folder, makes a first chapter without a title, and opens
it with the outline. The command works the same in a vault with no setup.

**By hand**: make the note, the folder with its name and the chapters folder inside it, then a
note for each chapter. The chapters folder's name is **Chapters folder name** in the settings
(`Chapters` in English, `Capítulos` in Portuguese). Chapter file names start with their
number (`01 Arrival.md`). Escrita keeps the numbers in order when you add, remove or move
chapters.

Then open the outline. **New chapter…** (or Enter) adds a chapter, and in a chapter a line
`%% beat: … %%` is a beat. The book note's `status` is a stage word, as for a conto, so the
book shows in the home block.

The outline, chapter targets and the rest are in [Writing](writing.md).

## Commands and settings on this page

| Name | What it does |
|---|---|
| **Set up a writing vault** (command) | Opens the two-step window. Also reachable from the Features page when there is no home note. |
| **Open the home note** (command) | Opens the home note. |
| **Enter writing mode**, **Exit writing mode** (commands) | Hide and show everything but the note. |
| **Home note** (setting) | The path to the home note. |
| **Open on startup** (setting) | Opens the home note when Obsidian starts. |
| **Open in writing mode** (setting) | Starts Obsidian in writing mode. |

**Create a book** is a command of the outline; its page is [Writing](writing.md).
