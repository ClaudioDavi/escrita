# Features and settings

Escrita has many features, and most writers use a few. Since 0.7 you can turn off the ones
you don't use. A feature that is off isn't loaded: it adds no commands, panels, menu items or
background work. Your data stays, and comes back when you turn the feature on again.

Other pages: [Getting started](getting-started.md), [Writing](writing.md), [Publishing](publishing.md), [Screenplays](screenplays.md) and [The world](the-world.md).

## Finding a setting

Escrita's settings are in Obsidian's settings search (Obsidian 1.13 or later). Open Settings,
type in the search box at the top, and every Escrita row that matches shows up. For example,
type "chapters folder" to find that row. Click a result and Obsidian lands on it. Rows of a
feature that is off don't show, because the feature isn't loaded.

Each section of Escrita's tab is a card under its own heading: Features, Properties and
folders, Books, Forms, New works, Goals, Publishing · the check, Export, Submissions, Outline, Placeholders,
Darlings, Editor, Screenplay editor, Revision · the lens, Stages, Home note, Snapshots and Universe. A section
of a feature that is off is gone until you turn the feature on.

## The Features page

Open Settings › Escrita. The **Features** section is at the top. It has:

- **Starting point**: three preset buttons and a label. See "Starting points" below.
- **Writing language** (Idioma da escrita). Automatic follows Obsidian's language: any
  Portuguese gives pt-BR and any English gives English. Another language gives none. The
  revision lens and the matching of names read it. (It used to be in the Revision section.)
- **Twenty switches in five groups**, each with one line on what it does. Stages are
  always on, because the outline, the Works tab and the publish check read them.

| Group | Switches |
|---|---|
| Writing | Goals and sprints · Outline and ghost beats · Placeholders · Enter flow and smart typography · Screenplay editor · Dialogue focus · Move a paragraph or scene · Insert from a template · Spellcheck on demand · Word counts in the explorer |
| Revision | Revision lens · Snapshots · Darlings |
| The desk (Acompanhamento in pt-BR) | Snapshot at each stage · Works block and where you left off |
| Publishing | Publish check · Export · Submissions |
| The world | Shared universe · Threads |

Three switches were settings before 0.7, and they are now only here: **Word counts in the
explorer**, **Spellcheck on demand** and the **Shared universe** mode. The universe row is a
dropdown (Off, Per book, Universe) instead of a switch, because the mode is the switch.

When you update from an earlier version, every feature stays on, so nothing disappears until
you choose. The one exception is the **Screenplay editor**, new in 1.2: it comes up **off**,
unless every other switch is on (as in **Everything**), in which case it comes up on so the set
still reads Everything. A new install starts on the Writer starting point (below).

## Starting points

You don't have to set twenty switches one by one. Above them, **Starting point**
(Ponto de partida) has four buttons: **Essentials**, **Writer**, **Screenwriter** and **Everything**. Each one
is a list of features. A preset is only a starting point, never a mode: Escrita doesn't
remember which button you pressed, and after it you can change any switch.

| Starting point | Switches it turns on |
|---|---|
| Essentials (9) | Goals and sprints · Outline and ghost beats · Placeholders · Enter flow and smart typography · Revision lens · Darlings · Snapshots · Export · Works block and where you left off |
| Writer (16) | Everything in Essentials, plus Dialogue focus · Move a paragraph or scene · Insert from a template · Word counts in the explorer · Snapshot at each stage · Publish check · Submissions |
| Screenwriter (11) | Only what a screenplay needs: Goals and sprints · Outline and ghost beats · Placeholders · Screenplay editor · Revision lens · Snapshots · Darlings · Snapshot at each stage · Works block and where you left off · Export · Submissions |
| Everything (19) | Every switch except the universe, which adds Spellcheck on demand, Threads and Screenplay editor to Writer |

Screenwriter is not Writer plus something: it leaves out the prose features that get in the way of a script. **Enter flow and smart typography** is off because Enter has its own flow in a screenplay and smart typography would turn the `--` that scripts keep into em dashes. **Dialogue focus**, **Move a paragraph or scene** and **Insert from a template** are for prose. **Word counts in the explorer** count words, and a script is counted in pages. **Spellcheck on demand**, the **Publish check** and **Threads** are for prose and the universe. The universe is untouched, as with every preset.

A preset turns off every switch that isn't in its list. Pressing one doesn't change anything
yet. It opens a confirm step, **Apply "Writer"?**, with two lines: **Turns off** and **Turns
on**, each naming the switches that would change. Press **Apply** to save them, or **Cancel**
to leave everything as it is. If the switches already match, the page says "Already on
Writer. Nothing changes." and there is nothing to confirm. The note under the lists reminds
you that the data of what turns off stays saved (see "What data stays" below).

**The label.** Beside the title, a small tag names the starting point your switches match
right now: Essentials, Writer, Screenwriter or Everything. If they match none of them, because you changed
one switch or came from an older version, the tag says **Custom** (Personalizado). Custom is
not a problem and nothing changes by itself. It only says the set is yours. The tag is worked
out each time the page draws, from the switches.

**The universe is never changed by a preset.** The Shared universe row is a mode (Off, Per
book, Universe), and a mode moves folders, so it is always your own choice, in the Universe
section. A preset leaves it as it is, never lists it in the confirm step, and ignores it when
it works out the label. That is why Everything says "19" here: the universe is the twentieth
switch, and the setup counts it as "20 of 20" because it offers it as a separate choice
(**Shared world**). Choosing Everything adds a reminder under the lists that the universe mode
stays as it is.

**A new install and an update.** A new install starts on Writer. An install that already
has Escrita settings keeps every switch as it was: nothing is turned off by updating. A 0.9
install with every switch on reads **Everything**, and gets the Screenplay editor on with it. One on its old defaults reads **Custom**,
because spellcheck on demand is off by default.

**The setup link.** Below the four buttons, a quiet link, **Set up a writing vault**
(Preparar o cofre para escrever), runs the setup, which can also choose a starting point,
create folders and example notes, and set the layout. It shows only while you have no home
note. Once you have one, use the command of the same name. The setup is explained in
[Getting started](getting-started.md).

## The language of the defaults

Escrita writes some words into your notes and reads others as folder and note names: the
stage words, the chapters folder, the titles that take no chapter number, the results of a
submission, the folders for exports, submissions and snapshots, the universe note and its
type words, the form values and the thread words. These are all settings, and they start from
a set of defaults in one language. Since 1.0 there are two sets, **English** and **Português
(Brasil)**. The setup shows the choice as **Language of the defaults** (Idioma dos padrões).

- **A new install takes Obsidian's language**, once: any Portuguese picks the Brazilian set,
  anything else picks English. The choice is then saved, so changing Obsidian's language later
  doesn't move your words.
- **An install that already has settings keeps English.** Updating from 0.9 changes no word,
  because your vault already relies on those words.
- **Only the setup changes it afterwards**, and only when you tick it.

What the Brazilian set holds:

| Setting | English | Português (Brasil) |
|---|---|---|
| Stage words | idea, draft, revision, ready, published | ideia, rascunho, revisão, pronto, publicado |
| Chapters folder | Chapters | Capítulos |
| Chapters without a number | Prologue, Preface, Foreword, Introduction, Interlude, Epilogue, Afterword | Prólogo, Prefácio, Apresentação, Introdução, Nota do autor, Interlúdio, Epílogo, Posfácio |
| Submission results | pending, accepted, rejected, withdrawn | pendente, aceito, recusado, retirado |
| Export folder | Escrita/Exports | Escrita/Exportações |
| Submissions folder | Escrita/Submissions | Escrita/Envios |
| Snapshots folder | Escrita/Snapshots | Escrita/Versões |
| Folders to ignore | Templates | Modelos |
| Universe note | Universe.md | Universo.md |
| Entry types and their folders | character (Characters), place (Places), object (Objects), group (Groups), event (Events) | personagem (Personagens), lugar (Lugares), objeto (Objetos), grupo (Grupos), evento (Eventos) |
| Form values | short story, essay, novella, novel, poem, fragment, screenplay | conto, ensaio, novela, romance, poema, fragmento, roteiro |
| Screenplay words (Transition endings, Continues label, Continued label, Credit line) | TO:, (MORE), (CONT'D), Written by | TO:, PARA:, (MAIS), (CONT.), Roteiro de |
| Thread words | thread, closed | thread, fechada |

The darlings notes keep the name `Darlings.md` in both. **Property names** (`status`, `target`,
`type` and the rest) are not in either set: they are keys in your notes and stay English.
Every value is still a setting you can change, and numbers and switches are the same in both
sets. The snapshots folder and the excluded folder are set only for a new install. The setup
never changes them, because they name places that already exist.

This is a different setting from **Writing language**. The writing language decides which
word lists the revision lens and the name matching read. The language of the defaults decides
the words Escrita writes into your vault.

## What each switch turns off

| Switch | Off means |
|---|---|
| Goals and sprints | No word tracking, daily goal, progress window, sprints or status bar. Its settings hide. |
| Outline and ghost beats | No outline panel, no ghost beats in the editor, no beat commands, no **Read the book** and no **Read this note**. Also no **New book** command, no Book choice in **New work…**, no **+ New book** button in the home block and no Books folder or Book note template rows. |
| Placeholders | No placeholder pills, explorer dots, panel or outline badge. (The publish check still stops on a placeholder left in a note, while Publish is on.) |
| Enter flow and smart typography | Enter doesn't make scene breaks or chapters; no automatic dashes and quotes. |
| Screenplay editor | Screenplay notes are plain Fountain text again: no columns, no Tab and Enter steps, no capitals as you type, no suggestions, no forced marks, and the two element commands go. Exporting a screenplay still works. |
| Dialogue focus | The command and its dimming go. |
| Move a paragraph or scene | The four move commands go. |
| Insert from a template | The command goes. (The universe still uses the templates folder.) |
| Spellcheck on demand | The toggle command goes. |
| Word counts in the explorer | No counts, no folder totals, no targets next to names. |
| Revision lens | No lens, panel, stepping commands or menu items. The names rule and "Not names" hide too. |
| Snapshots | No snapshot commands, compare view, automatic snapshots or "snapshot before publish". |
| Darlings | No "Move selection to darlings", panel or restore. |
| Snapshot at each stage | A stage change takes no snapshot. |
| Works block and where you left off | The `escrita-works` block shows as plain code; Escrita stops recording where you left off; no home note command or open on startup. |
| Publish check | No publish, unpublish or **Publish next chapter** commands. |
| Export | No **Export…** or **Export again** command, no file-menu item (and no **Create a collection…**), and no Export section in the settings, **Screenplays** group included. The export folder row stays, and so do the **Forms** rows. |
| Submissions | No **Record a submission** command or menu item, no pending count in the home block, and no Submissions section in the settings. The submissions folder row stays. |
| Shared universe | No panel, no universe commands, no "Appears in", no name marks or lens names. |
| Threads | No thread commands, margin flag or panel tab. |

Short stories never switch off. **New work…**, **New short story** and **New screenplay** are core commands, like the setup, so they stay even with every feature off.

Turning a feature off shows a short notice that says what stays and where.

## What data stays

Nothing is deleted when you turn a feature off.

- **Snapshots**: the files stay in your snapshots folder. The notice names it and how many.
- **Darlings**: the cut passages stay in your notes. Turn it on again to restore them.
- **Goals**: your writing history stays in Escrita's data (the notice says how many days).
- **Lens**: your word lists stay in their note.
- **The desk**: where you left off stays in Escrita's data.
- **Outline**: where you stopped in "Read the book" stays in Escrita's data, and keeps up with renames.
- **Revision lens**: the "Not names" list stays in the settings.
- **Export**: collection notes are ordinary notes and stay. The files already written (EPUB too) stay in the export folder. Your choices for each work (format, template, chapters) and its last export stay in Escrita's data, and keep up with renames and moves while the feature is off. Turn it on again and "Export again" still knows the last file.
- **Submissions**: the submission notes stay where they are, in the submissions folder. The notice names the folder and how many notes there are. They are ordinary notes: with the feature off they still don't count toward goals and don't become works. Change the folder in the settings if you already use that name for something else.
- **Threads**: the markers stay in your notes; the dates each was first seen stay in the data.
- **Universe**: entries are ordinary notes, so they are never touched. Colours chosen for
  points of view stay in the data.

Data that is tied to a path keeps up with renames while its feature is off. If you rename a
note or a folder with the desk off, the "where you left off" record and the snapshots still
follow it, so turning the feature on later finds them. For snapshots this includes moving the
snapshot files on disk.

## Dependencies

- **Snapshot at each stage needs Snapshots.** While Snapshots is off, the stage snapshot's
  switch is greyed out, with a **Turn on Snapshots** button. Your own choice for it is kept
  and comes back when Snapshots does.
- **The home block shows a pending count only while Submissions is on.** It is the number of submissions still waiting for an answer, next to the ready count. Turn Submissions off and the count is gone.
- **Export works without Publish, and Publish without Export.** Export warns about the same problems as the publish check (a placeholder left, a comment that never closes, unwritten beats, an empty note), on its own.
- **Publish works without snapshots.** It just takes no snapshot before publishing.
- **The outline works without placeholders.** It shows no placeholder count.
- **Settings follow the switches.** A setting hides when the features that read it are all
  off. A setting that another feature reads stays: the placeholder marker stays while Publish
  is on, and the templates folder stays while Insert from a template or the universe is on.
- **Shared names stay shown.** The property names (target, limit, unit, deadline, goal,
  point of view, chapter target), the track and exclude folders, and the chapters folder live
  in an always-shown section, **Properties and folders**, because several features read them.
  Since 0.8 the **Export folder** and **Submissions folder** rows are there too, and they show
  even when Export or Submissions is off, because the folders still apply: notes in them are
  never counted by goals and never become works. A folder row saves only a folder that is safe
  (see below).

- **Chapters without a number** (Settings, Books) is read by Export and the outline: a list
  of titles (Prologue, Interlude, Epilogue…) that export with their title alone and show no
  number in the outline. The rest are counted from 1.

## Settings added in 0.9

These settings belong to a feature. They hide when that feature is off.

| Setting | Feature | What it does |
|---|---|---|
| Names without an entry (a rule, in the Revision · the lens section) | Revision lens | Off by default. Marks recurring capitalized names that have no entry. Needs a universe mode. |
| Not names | Revision lens | Words the rule never marks, one per line. **Dismiss** in the lens panel adds a word. |
| Cover property | Export | The book note's property that links the EPUB cover (JPEG or PNG). `cover`. |
| EPUB scene break | Export | The line an EPUB shows between scenes. `* * *`. |
| Collection property | Export | The property of a note that lists stories in reading order. `contents`. |

Two commands arrive with 0.9 and have no setting. **Read the book** belongs to Outline and
ghost beats. **Publish next chapter** belongs to Publish check. The **Publish next** button in
the outline header shows only while both are on. Unlinked mentions have no switch of their own:
they are part of Shared universe, so they go when the universe is off.

## Settings added in 1.0.4

The **New works** section comes after Books. It sets where **New work…**, **New short story**, **New screenplay** and **New book** create notes, and which template of yours they use. It is always shown, except the two book rows, which hide when Outline and ghost beats is off. Nothing here is ever overwritten: a note that already exists is left alone.

| Setting | Needs | What it does |
|---|---|---|
| Short stories folder | | Where **New short story** creates the note. Empty by default: the folder beside the open book when a chapter or the book note is open, else the open note's folder (the vault root with no note open). |
| Short story template | | A note of yours to use instead of the built-in template. `{{title}}`, `{{date}}` and `{{time}}` are filled in, and a draft status is added when it has none. Empty by default (built-in). A note that can't be found falls back to the built-in one, with a notice. |
| Screenplays folder | | Where **New screenplay** creates the note. Empty by default, with the same fallback as above. |
| Screenplay template | | A note of yours to use instead of the built-in screenplay note (draft status, the screenplay form, one beat). `{{title}}`, `{{date}}` and `{{time}}` are filled in, and a draft status is added when it has none. Empty by default (built-in). |
| Books folder | Outline | Where **New book** creates the book's folder. Empty by default, with the same fallback as above. |
| Book note template | Outline | A note of yours to use instead of the built-in book note. Empty by default (built-in). The first chapter follows the chapter template. |

The setup fills the two folder rows with the folders it creates, but only while they are empty. The commands are explained in [Writing](writing.md).

## Settings added in 1.1

**Forms** is a new group after Books. It holds **Form property**, **Form values** and **Form by
folder**, which used to sit in the Universe section. It is always shown, and the rows now apply with the universe off. Nothing you saved
changes. Screenplay is the seventh form value (`screenplay`, or `roteiro` in a Portuguese install), and a list of six words saved before 1.1 gains it on its own.

**Screenplays** is a new group in the Export section, shown while Export is on. It has nine rows:
scene heading prefixes, transition endings, page size, scene numbers, the two page-break labels,
the credit line and two title page properties. The title page's author and contact are the
Export rows that already exist. All of it is in [Screenplays](screenplays.md#settings).

## Settings added in 1.2

**Screenplay editor** is a new switch in the Writing group, and with it a new section after
Editor. It shows while the switch is on. The switch is on in **Screenwriter** and **Everything** only.

| Setting | Feature | What it does |
|---|---|---|
| Font | Screenplay editor | **Courier** (Courier Prime if installed) or **Theme font**. Courier. |
| Times of day | Screenplay editor | The words offered after ` - ` in a scene heading. `DAY, NIGHT, CONTINUOUS, LATER` (`DIA, NOITE, CONTÍNUO, MAIS TARDE` in a Portuguese install). |
| Show rhythm | Revision lens | Shows the Rhythm section in the lens panel. On. |

### The screenplay editor

The editor lays out a screenplay note in Live Preview and gives Tab and Enter their screenplay
meanings. It acts only in a note whose form is `screenplay`. Writing with it is explained in
[Screenplays](screenplays.md#write-in-the-editor), and the Rhythm section in
[Revision](revision.md#rhythm).

It needs no other switch. With the universe on, it also offers the universe's names for a
character cue. The prose **Enter flow** and **Dialogue focus** do nothing in a screenplay note,
whether this switch is on or not.

**Read this note** is a second reading command, next to **Read the book**. It belongs to the
same switch, Outline and ghost beats. See [Writing](writing.md#read-this-note).

## Folder rows and how fields save

The export folder (default `Escrita/Exports`), the submissions folder (default `Escrita/Submissions`)
and the snapshots folder are Escrita's own places. They can't hold or sit inside each other.
A folder field is outlined and a warning shows under the setting's description, and the
saved value stays, when the new one is:

- not a plain folder inside the vault (no `..` or `.` in the path);
- inside Obsidian's settings folder, inside or around a track folder, or inside a book;
- a folder that holds a book;
- one of Escrita's other folders, or around one;
- a folder that already has files of yours (a folder Escrita already uses for this setting is
  fine, because it holds its own files).

Changing a folder doesn't move the files already there. If you rename the folder in
Obsidian, the setting follows it.

Text fields in the settings now save when you leave the field (or press Enter), not on every
key. A property name or folder field left empty goes back to its default.

## The Editor section

Since 0.8 the Editor section lists the typing rows first (Enter flow, smart typography, where
it applies, dialogue dash) and then **Paragraphs are separated by** (paragraph style) and **Quotes** (quote style). Those two rows
are shared with dialogue focus, moving blocks and the revision lens, so they show while any
of those is on.

## Turning a feature on and off while you write

You don't need to restart Obsidian. Turn a feature on and it comes back once, with its
commands, panels and menu items, and your tab doesn't move. A few leftovers are Obsidian's
doing, and they clear when you restart:

- **The ribbon icon stays.** A feature turned off keeps its icon in the left ribbon until the
  next restart. Clicking it shows "This feature is off. Turn it on in Escrita's settings."
  If Obsidian starts with the feature off, the icon isn't added at all.
- **Panels close.** The feature's panels close when you turn it off. If you restart with a
  feature off and its panel was open, the panel closes at startup.
- **Commands leave the palette.** They also leave the hotkeys list. Hotkeys you set yourself
  are kept and work again when the feature returns.
- **On a phone, the mobile toolbar keeps a dead button.** If you pinned one of the feature's
  commands to the mobile toolbar, the button stays, doing nothing, until you restart
  Obsidian. If you edit the toolbar while the feature is off, the pin is dropped for good,
  so pin it again after turning the feature on.

## Minimum Obsidian version

Escrita 1.0.3 and later need Obsidian **1.13** or later, for the settings search. An older
Obsidian keeps the last version it could run (1.0.2). Before that, removing commands at runtime
needed 1.7.2, which Escrita 0.7 asked for.

## When something looks wrong

| You see | Why | What to do |
|---|---|---|
| A command is missing | Its feature is off | Turn it on in the Features section |
| The home block shows no pending count | Submissions is off, or nothing is waiting | Turn on Submissions |
| A setting is missing | Every feature that reads it is off | Turn one on; the setting comes back |
| A ribbon icon says the feature is off | You turned it off this session | Turn the feature on, or restart to remove the icon |
| The stage snapshot switch is grey | Snapshots is off | Click **Turn on Snapshots** |
| The home block shows as code | The desk is off | Turn on "Works block and where you left off" |
