# Features and settings

Escrita has many features, and most writers use a few. Since 0.7 you can turn off the ones
you don't use. A feature that is off isn't loaded: it adds no commands, panels, menu items or
background work. Your data stays, and comes back when you turn the feature on again.

Other pages: [Writing](writing.md), [Publishing](publishing.md) and [The world](the-world.md).

## The Features page

Open Settings › Escrita. The **Features** section is at the top. It has:

- **Writing language** (Idioma da escrita). Automatic follows Obsidian's language: any
  Portuguese gives pt-BR and any English gives English. Another language gives none. The
  revision lens and the matching of names read it. (It used to be in the Revision section.)
- **Nineteen switches in five groups**, each with one line on what it does. Stages are
  always on, because the outline, the Works tab and the publish check read them.

| Group | Switches |
|---|---|
| Writing | Goals and sprints · Outline and ghost beats · Placeholders · Enter flow and smart typography · Dialogue focus · Move a paragraph or scene · Insert from a template · Spellcheck on demand · Word counts in the explorer |
| Revision | Revision lens · Snapshots · Darlings |
| The desk (Acompanhamento in pt-BR) | Snapshot at each stage · Works block and where you left off |
| Publishing | Publish check · Export · Submissions |
| The world | Shared universe · Threads |

Three switches were settings before 0.7, and they are now only here: **Word counts in the
explorer**, **Spellcheck on demand** and the **Shared universe** mode. The universe row is a
dropdown (Off, Per book, Universe) instead of a switch, because the mode is the switch.

When you update, every feature is on, so nothing disappears until you choose. Export and Submissions are the two switches 0.8 adds, in the Publishing group.

## What each switch turns off

| Switch | Off means |
|---|---|
| Goals and sprints | No word tracking, daily goal, progress window, sprints or status bar. Its settings hide. |
| Outline and ghost beats | No outline panel, no ghost beats in the editor, no beat commands. |
| Placeholders | No placeholder pills, explorer dots, panel or outline badge. (The publish check still stops on a placeholder left in a note, while Publish is on.) |
| Enter flow and smart typography | Enter doesn't make scene breaks or chapters; no automatic dashes and quotes. |
| Dialogue focus | The command and its dimming go. |
| Move a paragraph or scene | The four move commands go. |
| Insert from a template | The command goes. (The universe still uses the templates folder.) |
| Spellcheck on demand | The toggle command goes. |
| Word counts in the explorer | No counts, no folder totals, no targets next to names. |
| Revision lens | No lens, panel, stepping commands or menu items. |
| Snapshots | No snapshot commands, compare view, automatic snapshots or "snapshot before publish". |
| Darlings | No "Move selection to darlings", panel or restore. |
| Snapshot at each stage | A stage change takes no snapshot. |
| Works block and where you left off | The `escrita-works` block shows as plain code; Escrita stops recording where you left off; no home note command or open on startup. |
| Publish check | No publish or unpublish commands. |
| Export | No **Export…** or **Export again** command, no file-menu item, and no Export section in the settings. The export folder row stays. |
| Submissions | No **Record a submission** command or menu item, no pending count in the home block, and no Submissions section in the settings. The submissions folder row stays. |
| Shared universe | No panel, no universe commands, no "Appears in", no name marks or lens names. |
| Threads | No thread commands, margin flag or panel tab. |

Turning a feature off shows a short notice that says what stays and where.

## What data stays

Nothing is deleted when you turn a feature off.

- **Snapshots**: the files stay in your snapshots folder. The notice names it and how many.
- **Darlings**: the cut passages stay in your notes. Turn it on again to restore them.
- **Goals**: your writing history stays in Escrita's data (the notice says how many days).
- **Lens**: your word lists stay in their note.
- **The desk**: where you left off stays in Escrita's data.
- **Export**: the files already written stay in the export folder. Your choices for each work (format, template, chapters) and its last export stay in Escrita's data, and keep up with renames and moves while the feature is off. Turn it on again and "Export again" still knows the last file.
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

## Folder rows and how fields save

The export folder (default `Escrita/Exports`), the submissions folder (default `Submissions`)
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

Removing commands at runtime needs Obsidian **1.7.2** or later. Escrita 0.7 and later ask for it.

## When something looks wrong

| You see | Why | What to do |
|---|---|---|
| A command is missing | Its feature is off | Turn it on in the Features section |
| The home block shows no pending count | Submissions is off, or nothing is waiting | Turn on Submissions |
| A setting is missing | Every feature that reads it is off | Turn one on; the setting comes back |
| A ribbon icon says the feature is off | You turned it off this session | Turn the feature on, or restart to remove the icon |
| The stage snapshot switch is grey | Snapshots is off | Click **Turn on Snapshots** |
| The home block shows as code | The desk is off | Turn on "Works block and where you left off" |
