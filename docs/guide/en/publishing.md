# Publishing

This page covers what happens when a work leaves your desk: checking a note before you
publish it, exporting a conto or a book as a manuscript, and keeping track of where you
sent it. Escrita never sends anything anywhere. It checks, it writes a file, and it
records what you tell it.

Other pages: [Features and settings](features-and-settings.md), [Writing](writing.md) and
[The world](the-world.md). Each part has its own switch in Features › Publishing: **Publish
check**, **Export** and **Submissions**.

- [Check a note and mark it published](#check-a-note-and-mark-it-published)
- [Send a conto to a magazine](#send-a-conto-to-a-magazine)
- [Export a note or a book](#export-a-note-or-a-book)
- [Record a submission](#record-a-submission)
- [Settings](#settings)
- [Commands](#commands)

## Check a note and mark it published

Open the note and run **Publish this note** (or choose **Publish…** in the file menu). A
window lists what Escrita found. It reads the text you see in the editor, saved or not.

**Blockers** are things a reader would notice:

- A `%%` comment that never closes, so everything after it is hidden. An odd number of `%%`
  inside a closed `<!-- -->` comment counts too. A `%%` inside a `$$` math block is part of
  the math, not a comment.
- A `<!--` comment that never closes, at the start of a line (new in 0.8). A `<!--` in the middle of a line is plain text. Reading view hides the rest of the note,
  while the words still count.
- A placeholder left in the text (the marker word is a setting, `XXX` by default).
- A note with no text.

**Warnings** don't stop you:

- A beat with no prose after it.
- A recommended property that is empty (the list is a setting).
- A piece over its `limit`.

Each line says what is wrong, and a line with a place in the note has a **Go to line** link.
With no blockers you just press **Publish**. With blockers, tick **Publish anyway**: Escrita
can't know every case, so the choice is yours. Warnings never need that tick.

Publishing sets the status property to your word for the published stage, and the date
property to today. You can pick another day, even a future one. If the note already has a
date, Escrita keeps it, unless you pick one here. If Snapshots is on, it takes a snapshot
first (**Before publishing**). It needs the status property to be set in the settings.

**Unpublish this note** is offered for a published note. It puts the earlier status back, or
your word for the ready stage if Escrita doesn't know the earlier one.

## Send a conto to a magazine

The usual path, with the three parts together:

1. Finish the conto and clear what blocks it. **Publish this note** is optional, and
   "published" may not be the right word before the magazine answers; you can skip it.
2. Open the conto and run **Export…**. Choose **DOCX** and the template for the magazine:
   **Shunn** for an English market, **pt-BR** for a Brazilian one. Press **Preview** to look
   at it, then **Export**.
3. Send the file from the export folder.
4. Run **Record a submission**. Type where you sent it. Escrita makes one note for the
   submission, with the result still pending.
5. When the answer comes, change the `result` in that note to `accepted`, `rejected` or
   another of your values, and fill `responded`.

## Export a note or a book

Open a note (or a chapter, or a book's note) and run **Export…**, or choose **Export…** in
the file menu. You can export any Markdown note, except a snapshot, a submission note or a
file already in the export folder.

The window is titled **Export “Title”**. What it exports depends on where you opened it:

- From a note outside a book (a conto, an essay): that note.
- From a book's note: the whole book.
- From a chapter: a **What** row offers **This chapter** or **The whole book**. The first
  time, it is on **The whole book**.

**Chapters** (for a book):
- **All (n)**: every chapter.
- **From … to …**: a range, by position. 1 to 3 means the first three chapters.
- **Choose…**: a list with a tick for each chapter and **All** and **None** buttons. The line
  under it says, for example, "3 of 12 chosen". Choose none and Escrita says "No chapter is
  chosen", and **Export** waits.

A chapter whose property is `false` is always left out. The property is a setting
(**Left-out property**, `compile` by default), so `compile: false` in a chapter's properties
keeps it out. The window says how many are left out and which ones.

**Chapter headings.** A chapter with a number gets the template's heading: "Chapter 1: The
arrival" (Shunn) or "Capítulo 1 — A chegada" (pt-BR). Name a prologue with a 00
prefix, "00 Prólogo": it sorts first and gets its title alone, with no number. A file without a
number in its name, such as "Epílogo", goes last and also gets its title alone. Numbers count
only chapters numbered 1 or more, so a prologue doesn't shift them and a left-out chapter leaves no
gap. The numbers are counted before the range or the ticks narrow the list: exporting
chapters 5 to 7 keeps "Chapter 5", "6" and "7". If a chapter has no title beyond its number,
the heading is just "Chapter 1". A heading at the top of the chapter that repeats the
chapter's own heading or title is dropped, so it doesn't show twice (for a single note, a
heading that repeats the note's title). You can change the
format in **Chapter heading** (see Settings).

**Dedication and epigraph.** On the book's note, add a property that links to a note:

```
dedication: "[[Dedicatória]]"
epigraph: "[[Epígrafe]]"
```

The text of each linked note becomes a page of its own, with no heading, before the first
chapter. The window shows them in its "Title page with…" line. Only a book has them. A single
note has only its title page. The property names are settings.

**Format.** **DOCX** (the default) or **Markdown**.

**Template.** **Shunn** (Letter, English) or **pt-BR** (A4, dialogue dash). The one that
matches Obsidian's language is listed first and is chosen the first time. Both set the same
layout:

- Times New Roman, 12 pt, double spaced, one-inch margins, a half-inch first-line indent.
- A title page, then the text. A single note starts below its title on the first page.
- A running header from page 2 on: Surname / Title / page number.
- `#` for a scene break, and an end mark after the last line.
- Italics and bold kept, and dialogue dashes kept as you typed them.

They differ in these:

| | Shunn | pt-BR |
|---|---|---|
| Page | US Letter | A4 |
| Chapter heading | Chapter 1: Title | Capítulo 1 — Título |
| Byline | by Name | por Nome |
| Count on the title page | about 4,200 words | cerca de 4.200 palavras |
| End mark | END | FIM |

The template is independent of Obsidian's language, so a Brazilian writer can send a Shunn
manuscript to an English magazine.

Markdown uses only the template's byline, scene break and chapter headings. The page layout,
header, count and end mark are for DOCX.

**The title page.** In DOCX, the top left has your name and your contact lines, and the
**rounded count** sits at the right margin on the first line. The title and byline come below. For a book this is a page of
its own. The count is the work's measured size, rounded the way manuscripts do it: to the
nearest 100 below 10,000, and to the nearest 500 from 10,000 up (never below 100). It is in
words, or in characters for a piece that counts characters.

**What the manuscript leaves out.** Comments, beats and placeholders don't go into the file,
and links become their text. Embedded items (`![[…]]`) are left out. Footnotes stay as text.

### The warnings and "Export anyway"

At the top of the window, a **Before you send** box lists what Escrita found in the text it will
export: placeholders left, a comment that never closes (`%%` or `<!--`: the rest of the
note disappears), beats with no prose after them, and an empty note. It checks every
chapter you chose, and each item has a **Go to line** link that opens the note there. An
empty chapter in a book is not a problem. A single empty note is.

If there is anything on that list, the main button says **Export anyway** instead of
**Export**. Embedded items are listed too, only to tell you they are left out; they don't
change the button.

### The preview

**Preview** shows the document as the file will have it. Click a paragraph to open the note
at that line (the tip reads "Open Title, line 12"). **Back** returns to the options. The
dedication, the epigraph and the text are marked apart. The preview is only a look: nothing
is written until you press **Export**.

### Where the file goes

Into the **Export folder** (`Escrita/Exports` by default). A note is named `Title.md` or
`Title (Shunn).docx` (`Title (pt-BR).docx`). Escrita writes the file and says "Exported:
name", with a link, **Show in the file explorer**.

If a file with that name exists, Escrita asks. **The file already exists** gives:

- **Cancel**: nothing is written.
- **Keep both**: the new file gets the date and time in its name, such as
  `Title (Shunn) 2026-10-05 14h32.docx`.
- **Replace**: offered only when the old file is in the export folder and is one of Escrita's
  exports. If Escrita recorded it as the last export of a work, it is written over. If not,
  the old file goes to the trash first, so a file you made yourself is never lost.

Escrita never writes over a note of yours, and the export folder's files never count toward
your goals or become works.

### Export again

The window remembers, for each work, the format, the template and the chapters, and shows
"Last export: DOCX · Shunn · 12 chapters · 3 Oct, 14:32" with the file's name (a link to
open it; "(file moved or gone)" when it isn't there). It has an **Export again** button, and
there is an **Export again** command.

**Export again** repeats the last export with the same choices. It writes at once, with no
window, when there is nothing to confirm and it is the same kind of export: the whole book,
or the same chapter. A chapter you exported alone is repeated from that chapter. Otherwise it
opens the window with those choices, and the button reads **Export anyway** when there are
warnings.

It writes over the last file only if that file is still where Escrita wrote it, with the same
name. If you moved or renamed it, or it is gone, Escrita asks **Where to write**: "The last
export is not where it was written. Write …?", with **Write** and **Cancel**. If another file
already has the usual name, you get **The file already exists** instead. The memory follows
if you rename or move the work or a chapter. Renaming the export folder in Obsidian doesn't
count as moving the file: the setting and the memory follow the folder, and Export again
writes over the file without asking.

### Author name, surname and contact

In Settings › Escrita › Export:

- **Author name** goes on the title page and the byline.
- **Surname for the header** is the "Surname" in the header. Empty uses the last word of the
  name.
- **Contact lines**: address, email, phone, one per line, at the top of the title page.
- **Author property** (`author` by default): a property on a note or a book's note that
  names the author for that work. It overrides the name above. For that work the surname is
  the last word of that name.

## Record a submission

Run **Record a submission** (or **Record a submission…** in the file menu) from a work. It
asks for:

- **Work**: shown for you (its stage and size). You don't choose it.
- **Where to**: a magazine, a contest, an editor. The three most recent places are listed
  under **Recent places**: click one to fill it in.
- **Sent on**: today, in `YYYY-MM-DD`. Change it if you sent it earlier.

A line says what it will create: "Creates … with …, …". **Record** needs a place and a real
date.

**Which work it picks.** From a chapter or a book note, the work is the book. From a note
outside a book, it is that note, when it is tracked and has a stage (a conto marked
`rascunho`, say). A note without a stage says "… isn't a work: give it a stage to record a
submission." A submission note, an export, a snapshot or a note that isn't Markdown says
"Open a story or a book to record a submission."

**The note it makes.** One new note in the **Submissions folder** (`Escrita/Submissions` by default),
named like `2026-10-05 Cartas de Lisboa – Revista Pessoa.md`. If that name is taken, a number
is added. It has only properties, and an empty body for you:

```
---
work: "[[Cartas de Lisboa]]"
market: "Revista Pessoa"
sent: 2026-10-05
result: pending
responded:
---
```

The five property names are settings. The `result` starts as the first of your **Result
values**: `pending, accepted, rejected, withdrawn` by default, separated by commas. Change the
result in the note to one of the others when you hear back, and fill the date in `responded`.
Results are compared ignoring capitals.

If you rename the work, Obsidian updates the `work` link and the submission still points at
it. If you rename the submissions folder in Obsidian, the setting follows it.

**The pending count.** With Submissions on, the home block shows, next to the ready count,
how many submissions still have the first result value: "2 pending". Click it to list them,
newest first, each with its place and date, and click one to open the note. If the home block
shows only some folders, it counts only the submissions of works in those folders. Turn
Submissions off and the count goes.

**Tables.** Escrita has no table of submissions. They are ordinary notes with properties, so
Bases, Dataview or any plugin that reads properties can list them, by work, by place or by
result.

Notes in the submissions folder, and files in the export folder, never count toward your
goals and never become works. If you already use a folder with one of those names for
something else, change the folder in the settings. A folder that already has your own files
is refused.

## Settings

**Publishing** (Settings › Escrita):

| Setting | What it does |
|---|---|
| Date property | The property that gets the publication date. `date` by default. |
| Recommended properties | One per line. The check warns when one is empty. `description` by default. Empty skips the check. |

The status words are under Stages, and the status property under Books.

**Export:**

| Setting | What it does |
|---|---|
| Export folder | Where manuscripts are written. `Escrita/Exports`. It lives in Properties and folders and shows even when Export is off. |
| Left-out property | A chapter whose property is `false` stays out. `compile` by default. |
| Dedication property | On the book note: a link to the note that becomes the dedication page. `dedication`. |
| Epigraph property | The same, for the epigraph page. `epigraph`. |
| Author property | A property on the work that names its author. `author`. |
| Author name | On the title page. |
| Surname for the header | The header's "Surname". Empty uses the last word of the name. |
| Contact lines | Address, email, phone, one per line, at the top of the title page. |
| Chapter heading | Use `{n}` for the number and `{title}` for the title. Empty uses the template's own. |

**Submissions:**

| Setting | What it does |
|---|---|
| Submissions folder | One note per submission. `Escrita/Submissions`. Changing it doesn't move existing notes. It lives in Properties and folders and shows even when Submissions is off. |
| Result values | Separated by commas. The first is "pending". |
| Work property | The property in a submission note that links to the work. `work`. |
| Market property | Where it was sent. `market`. |
| Sent date property | The day it was sent. `sent`. |
| Result property | The result. `result`. |
| Response date property | The day the answer came. `responded`. Empty in a new note. |

The five submission property names must differ from each other. If you type one that another
already uses, the field goes back to its old value.

A folder row refuses a folder that is unsafe (see
[Features and settings](features-and-settings.md#folder-rows-and-how-fields-save)). Text
fields save when you leave them.

## Commands

| Command | What it does |
|---|---|
| Publish this note | Checks the note, then sets status and date. |
| Unpublish this note | Puts the earlier status back. Offered for a published note. |
| Export… | Opens the export window for the active note or its book. |
| Export again | Repeats the last export of the work. Offered when the work has one. |
| Record a submission | Makes a submission note for the active work. |

The same actions are in the file menu: **Publish…**, **Unpublish**, **Export…** and **Record
a submission…**. Escrita sets no hotkeys; bind the ones you use in Settings › Hotkeys.
