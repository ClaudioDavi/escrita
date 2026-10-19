# Getting started

This page takes you from installing Escrita to a first short story and a first book. You can do
it with one command, **Set up a writing vault**, which shows you everything before it creates
anything. Or you can skip the setup and start from **New work…**, which works in any vault:
the last two parts of the page show how, and how to do it by hand.

Other pages: [Features and settings](features-and-settings.md), [Writing](writing.md),
[Revision](revision.md), [Tracking](tracking.md), [Publishing](publishing.md),
[Screenplays](screenplays.md) and [The world](the-world.md).

- [Install Escrita](#install-escrita)
- [The first-run notice](#the-first-run-notice)
- [Set up a writing vault](#set-up-a-writing-vault)
- [What the setup never does](#what-the-setup-never-does)
- [The examples](#the-examples)
- [The home note](#the-home-note)
- [Two layouts: the writing desk and writing mode](#two-layouts-the-writing-desk-and-writing-mode)
- [Your first short story](#your-first-short-story)
- [Your first book](#your-first-book)
- [Commands and settings on this page](#commands-and-settings-on-this-page)

## Install Escrita

Escrita needs Obsidian **1.13 or later**. It works on desktop and on phones.

- **From the [community plugins list](https://obsidian.md/plugins?id=escrita)**: open Settings ›
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
  folder for short stories and essays (`Stories`). A novel makes a folder for books (`Books`), where
  each book gets a subfolder. Both makes the two.
- **Language of the defaults.** **English** or **Português (Brasil)**. It starts on
  Obsidian's language. It decides only the words Escrita writes into notes and uses as names:
  the status words, the folder and note names, the lists. The interface stays in Obsidian's
  language. The example notes and the home note are written in this language too.
- **Starting point.** Three cards: **Essentials** (9 of 20 switches), **Writer** (16 of 20)
  and **Everything** (all 20). It starts on **Writer**. A preset is a starting point, not a
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
| **Folders** | `Stories` and/or `Books`. A folder that already exists is used as it is, and the row says how many notes are in it. If you keep a list of track folders, a new folder is added to it (see below). The settings **Short stories folder** and **Books folder** are filled with these folders too, when they are empty (see [your first short story](#your-first-short-story)). |
| **Examples** | The example short story and the example book, if you want them (see [the examples](#the-examples)). |
| **Settings** | Every setting the setup would change, with its value, and every one it leaves alone, with the reason. |
| **Home note** | `Home.md` (`Início.md` in Portuguese), with the works block. |
| **Layout** | **Arrange the screen once**, with two cards: the writing desk and writing mode. |

Some rows have a box you can tick. Only ticked rows run. A row with no box has no choice to
make:

| Box | What it covers |
|---|---|
| **Folders** (on the first new folder) | The new folders, adding them to **Folders that count**, and filling **Short stories folder** and **Books folder**. |
| **Examples** | All the example notes together. |
| **Language of the defaults** | The language and every word-bearing setting: **Statuses**, **Chapters folder**, **Unnumbered chapter titles**, **Submission results**, **Export folder**, **Submissions folder**, the darlings notes, **Universe note**, **Entry types**, **Form values**, the four screenplay words (**Screenplay transitions**, **Screenplay "more" label**, **Screenplay "continued" label** and **Screenplay credit line**), **Thread keyword**, **Closed-thread word**, and **Writing language**. |
| **Home note** | Creating the home note and setting it as your **Home note**. |
| **Open the home note on startup** | Opens the home note when Obsidian starts. |
| **Features** | Turns the switches to match the preset you chose. |
| **Arrange the screen once** | The layout. |

Folders that already exist have no box, and neither has the **Shared world** answer you
gave in step 1.

**Where new works go.** The setup also fills **Short stories folder** and **Books folder**
(Settings › Escrita, **New works**) with the folders it makes, so **New short story** and **New
book** start there. It does this only while the setting is empty: a folder you chose yourself
stays. They are listed under **Settings** and share the folders' box: in a vault that already has
works they come unticked ("Unticked: you already have works").

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
  a box are the track folders list (new folders are added to it), the two settings
  **Short stories folder** and **Books folder** (only while empty), and the **Shared world**
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

**A short story**, in your stories folder (with short fiction or both): *Example · The crossing* (*Exemplo · A travessia*).

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
draws it: what to write today, and each work with its length against its target or deadline.
Click a work and it opens where you left off. Escrita draws the block and never writes to it.
Add whatever you like around it.

The setup creates it as `Home.md` (`Início.md` in Portuguese) at the root of your vault, starts
it with one line saying the note is yours, and sets it as your **Home note**. If a note with that
name exists in another letter case (`home.md`), the setup uses it as it is.

The setup's row **Open the home note on startup** turns on the setting **Open on startup**.

Under the list of works, a line reads **+ New short story · + New book**. It is always there,
and each part opens the same window as the command (see [your first short
story](#your-first-short-story)). **+ New book** is hidden while the outline is off.

A work is a book, or a tracked note, whose status is one of your stage words. The block lists
the works you are writing and revising, and counts the ones that are only ideas, ready or
published. The block, the **Open the home note** command and the home note settings are in
[Tracking](tracking.md#start-from-one-note-the-home-note).

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

The setup turns on the setting **Open in writing mode** when you pick this card, so Obsidian
starts in the mode. Writing mode writes nothing to your vault, and leaving it brings back only
what it hid. Its commands, its setting and how it sits next to a zen plugin are in
[Tracking](tracking.md#write-with-only-the-note-writing-mode).

## Your first short story

You don't need the setup for this. Open the command palette and run **New short story** (in
Portuguese, **Novo conto**). Or run **New work…** (**Nova obra…**): a list asks "What are you
writing?" with **Short story** and **Book**, each with a grey line saying where it goes ("A note
in Stories/"). Pick **Short story**. The commands have no hotkey. You can also click **+ New
short story** under the works list in the home note.

A window opens with:

- **Title**. The cursor starts here. Enter creates the note.
- **Folder**, with suggestions as you type. It starts at the setting **Short stories folder**
  (Settings › Escrita, **New works**). If that is empty, it starts at the folder beside the open
  book when a chapter or the book note is open, otherwise at the folder of the open note. With no note open, it
  is the root of the vault.
- **Template**: **Built-in**, or the path of your own note (see below). This line shows what is
  used; you change it in the settings.
- **Create**.

You get one note: the status in the draft stage, the form property set to the short story word,
a blank target and a blank deadline, and one beat, "What happens first". It opens with the cursor
on the line under the beat. Write. Add a `target` when you know the length you aim for, and the home note lists the short story with its
length against it.

**Your own template.** Point **Short story template** (in **New works**) at a note of yours. Its
text is used instead of the built-in one, with `{{title}}`, `{{date}}` and `{{time}}` filled in.
If it has no status, the draft status is added. If the note is missing, the built-in template is
used and a notice says so.

**Nothing is overwritten.** If a note with that name already exists, a notice says "already
exists. Nothing was changed.", and the window stays open. A work created outside your track
folders is created anyway, and a notice says goals don't count it, with an **Open settings**
button. An empty title gets a notice too: "Give the work a title."

### By hand

You can do the same by hand. A short story is any note.

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
5. Open the home note. With the status in a stage and the note in a tracked folder, the short story
   is a work, and the block lists it with its length against the target.

When you finish, change the status to the next stage. How to revise and publish it is in
[Writing](writing.md) and [Publishing](publishing.md).

## Your first book

A note is a book when a folder with the same name sits next to it, and that folder holds a
chapters folder:

```
Books/The lighthouse.md                      the book note
Books/The lighthouse/Chapters/               the chapters folder (its name is a setting)
    01 Arrival.md                            one note per chapter
    02 The storm.md
```

**The quick way**: run **New book** (**Novo livro**). You can also pick **Book** in **New work…**
or click **+ New book** in the home note. It is offered only while the outline is on, so it is
missing from the palette, the list and the home note when that switch is off. The window is the
same as for a short story, with **Books folder** as the starting folder. Escrita makes:

- the book note, with the draft status, a blank goal and a blank deadline, and two headings,
  **Premise** and **Characters**, each with a hint in a comment;
- the folder with the book's name, and the chapters folder inside it;
- a first chapter without a title. With no chapter template it holds one beat, "What happens
  first". With a chapter template, the template decides;
- the outline, beside the chapter. The chapter opens with the cursor after the beat.

The goal starts blank. Set `goal` in the book note when you know how long the book will be. You can
point **Book note template** (in **New works**) at a note of yours, as for a short story. The first
chapter still follows the chapter template. **New book** works the same in a vault with no setup,
and nothing is overwritten: if the note or a file in the way already exists, a notice says so and
nothing is created.

**By hand**: make the note, the folder with its name and the chapters folder inside it, then a
note for each chapter. The chapters folder's name is **Chapters folder name** in the settings
(`Chapters` in English, `Capítulos` in Portuguese). Chapter file names start with their
number (`01 Arrival.md`). Escrita keeps the numbers in order when you add, remove or move
chapters.

Then open the outline. **New chapter…** (or Enter) adds a chapter, and in a chapter a line
`%% beat: … %%` is a beat. The book note's `status` is a stage word, as for a short story, so the
book shows in the home block.

The outline, chapter targets and the rest are in [Writing](writing.md).

## Commands and settings on this page

| Name | What it does |
|---|---|
| **Set up a writing vault** (command) | Opens the two-step window. Also reachable from the Features page when there is no home note. |
| **New work…** (command) | Opens the list: **Short story** or **Book**, each with where it goes. |
| **New short story** (command) | Opens the window for a short story. |
| **New book** (command) | Opens the window for a book. It was **Create a book**, with the same command id, so your hotkey still works. Offered only while the outline is on. |
| **Short stories folder**, **Short story template**, **Books folder**, **Book note template** (settings) | The **New works** group. The two book rows show only while the outline is on. Empty folders mean the folder beside the open book or note. |

**New book** is a core command, available whenever the outline is on. **Open the
home note**, **Enter writing mode**, **Exit writing mode** and the settings **Home note**,
**Open on startup** and **Open in writing mode** are on [Tracking](tracking.md).
