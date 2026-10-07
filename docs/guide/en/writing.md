# Writing

This page is about the writing itself: planning a book in the outline, setting goals, leaving
notes for later, typing without friction, moving text around, and seeing your counts. Each part
starts with the task, then names the commands and settings it uses.

Other pages: [Getting started](getting-started.md), [Revision](revision.md),
[Tracking](tracking.md), [Publishing](publishing.md), [The world](the-world.md) and
[Features and settings](features-and-settings.md). Every part below has a switch on the Features
page, so you can turn off what you don't use.

## Plan a book in the outline

*Features › Outline and ghost beats.*

A **book** is a note with a folder of the same name beside it, and a chapters folder inside
that folder:

```
Novels/My Book.md
Novels/My Book/Chapters/01 Arrival.md
Novels/My Book/Chapters/02 The locked door.md
```

Run **Create a book** (also a button in an empty outline) to make one. It asks for a title and
a folder, then makes the book note (in the draft stage, with a goal of 80,000 words and an empty
deadline), its folders and, if the folder has no chapters yet, a first chapter. Run **Open outline** to
open the **Outline** panel in the right sidebar. It lists the chapters of the current book, each
with its number, title, status, summary and length, and the book's total against its goal. If
you have several books, the **Book** dropdown at the top picks one.

### Edit from the keyboard

Titles and summaries are editable in place. A chapter file is renamed with Obsidian's own
rename, so links keep working.

- **Enter** adds a chapter, or a beat when you are in a beat.
- **Tab** turns an empty chapter into a beat of the chapter before it. A chapter with text or
  beats is never turned into a beat.
- **Shift+Tab** turns an unwritten beat into a new chapter. A beat that already has prose stays.
- **Backspace** on an empty line removes it. A chapter that has text or beats is deleted only
  from its menu, after a question, and goes to the trash.
- **Drag** the numbers to reorder chapters. The files are renumbered for you. **Renumber
  chapters of this book** does the same renumbering without a drag.

On a phone, the **⋯** button on each row holds the same actions: open, move up and down, add a
beat, make it a beat or a chapter, delete.

### Beats

A beat is a one-line note about a scene. In the chapter it is a comment on its own line:

```
%% beat: The letters in the tin box %%
```

A beat counts as **written** when prose follows it before the next beat, a scene break or the
end of the file. Until then it stays muted in the outline. After that it gets a check mark. The
beat stays in the file: it works as an invisible scene heading.

Run **Add a beat to this chapter** (in a chapter's editor) to put a beat in it. In the outline,
click a beat's letter to go to it. The menu on a beat has **Remove beat (keeps the prose)**.

Outside a book, the panel shows the beats of the note you are in (a conto, an essay), with its
length against its target or limit. A note with no beats offers **Add the first beat**.

### Ghost beats

In Live Preview, each beat shows inside the chapter as a faint label ("Beat b · from outline")
above the place where the scene goes. Put the cursor on the line to see the raw text. Turn them
off with **Ghost beats** in the Outline section of the settings.

### See the book as a board

**Open outline as a board** (a command, and a button in the outline) writes a Canvas file with
one card per chapter, coloured by status. If a file with that name exists and Escrita didn't make
it, Escrita asks before replacing it.

### Settings for chapters

In Settings › Escrita › Books:

- **Chapters folder name.** A note is a book when a folder with the same name beside it holds
  this subfolder.
- **Chapter template.** A note used as the starting text of new chapters. `{{title}}`,
  `{{date}}` (YYYY-MM-DD) and `{{time}}` (HH:mm) are filled in. Empty means a blank chapter.
- **Chapter number digits.** The minimum digits in chapter file names (`01 Arrival.md`).
- **Chapters without a number.** Titles that never get a number in the outline and in export, such
  as Prologue, Interlude, Epilogue. Number every file as usual; a chapter with a listed title is
  not counted.
- **Status and summary properties.** The properties read from each chapter: the status says
  which stage a work is in (the stages are in [Tracking](tracking.md)), and the summary shows in
  the outline.

## See whose story a chapter tells: point of view

Add a `pov` property to a chapter. It can be a link to a character or plain text:

```
pov: "[[Maria]]"
```

or

```
pov: João
```

The name of the property is a setting (**Point of view property**, in Properties and
folders). Use any name you like, such as `narrador`; `pov` is the default.

In the outline, each chapter row has a **colour stripe** on its edge. Two chapters with the
same point of view get the same colour. Escrita picks the colour for you from eight (red,
orange, yellow, green, cyan, blue, purple, pink) and remembers it, so it stays the same
after a restart.

- **Links and text are the same character.** A link `[[Maria]]` and a link to the same note
  by another name are one point of view. Plain text matches ignoring capitals and accents:
  *João* and *joao* are one. If the text is a name or alias of an entry in your universe,
  Escrita treats it as that entry.
- **Change a colour.** Click the point of view's chip in the header and choose **Color of
  Maria**, then pick one. It sticks.
- **Open the entry.** The same menu has **Open the entry**, when the point of view is a note.
- **Rename the character.** If you rename Maria's note, the colour stays with it.

## Colour by status or by point of view

At the top of the outline, **Color by** toggles between **Status** and **POV**. In Status mode
the stripes follow your stage colours (draft, revision and so on, from the settings). In POV
mode they follow the points of view.

The **summary** next to it counts chapters by stage, using your own words for the stages:
"1 rascunho · 2 revisão". A chapter with a status that isn't a stage counts under that word.
A chapter with no status shows "no status".

## Filter the outline

Under the toggle there are chips for each stage and each point of view. Click one to show only
those chapters. Click more than one chip in a row to widen the filter: you see the chapters that match any
of them. Stage chips and point-of-view chips narrow each other: you see the chapters that match
both.

When a filter is on, the header says **Showing 2 of 5 · Clear**. Click **Clear** to show every
chapter again.

While a filter is on, **drag and drop and "Renumber chapters" are paused**. Reordering a
partial list could renumber the book wrongly, and Escrita never risks your chapters. Clear the
filter to reorder. If there are many chips, the row shows a few and a **+3** button; **fewer**
folds them back.

## A target for every chapter

A chapter can have its own `target`, `limit`, `unit` and `deadline`, just like a conto. When
a chapter has a target, a thin **bar** under its title shows how far it is, in the chapter's
own unit. The bar uses the same colours as the bars in the progress tile.

You can also set a **default** for the whole book. Add `chapterTarget` to the book's note:

```
chapterTarget: 3000
```

Every chapter without a target of its own now gets a bar against 3,000. The name of the
property is a setting (**Chapter target property**, in Properties and folders). If you empty
that setting, there is no book default.

### The rule: one answer everywhere

Escrita works out each chapter's target once, and the outline, the file explorer and the
goals (the status bar and the counts they draw) all use that answer. So a chapter never shows
3,000 in one place and nothing in another. The rule, field by field:

- **The chapter wins.** A chapter with `target: 1500` is measured against 1,500. A chapter with no
  target of its own takes its book's `chapterTarget`. The bar's label says "chapter target" when
  the chapter's own wins over a book default.
- **Only the target is inherited.** A chapter's `limit` and `deadline` stay its own. A book's
  default never gives a chapter a limit or a deadline.
- **The unit.** A chapter's own `unit` wins. Without one (an empty `unit` counts as none), the
  book note's `unit` is used, and without that, words. So `unit: characters` on the book note
  counts all its chapters in characters, and a chapter can still choose its own.
- **Only chapters inherit.** A conto or an essay outside a book has no book above it, so it
  takes nothing. The book note itself uses its own `goal` (in Goals, below), not `chapterTarget`.
- **No target, no bar.** A book with no `chapterTarget` and chapters without a target shows no
  bars and no target in the explorer or the status bar.
- **The explorer and the status bar.** With **Show the target next to the count**, a chapter that
  takes its book's default shows `2,100 / 3,000` in the explorer, and the status bar shows the same
  while you write in it.

## Read the book

To read a book the way a reader will, open any chapter or the book's note and run **Read the
book**. You can also press **Read the book** in the outline's header. A tab opens with every
chapter in order, one after the other.

- **It looks like the export.** Comments, beats and placeholders are hidden, as in a manuscript.
  A chapter left out with `compile: false` isn't shown. Chapter headings are the ones the export
  would print.
- **It is read-only.** You can't change anything in this tab. Click a paragraph and the chapter
  opens in a new tab at that line, ready to edit.
- **It is quick on a long book.** Chapters are drawn as you scroll toward them.
- **It remembers where you stopped.** Close the tab and open it again: you are at the same
  place. This follows the chapter if you rename or move it. If the chapter is deleted, you
  start at the top.
- **A book with no chapters** says "This book has no chapters to read yet", with a **Create the
  first chapter** button. In the reading tab, **Open the outline** goes back to the outline.

Turn it on or off with the outline (Features › Outline and ghost beats).

## Set a goal and watch your progress

*Features › Goals and sprints.*

Escrita counts the words you type in the active note, inside the folders it tracks. It doesn't
count what you paste, import or sync: a single change that adds or removes more words than a size
you choose is ignored. Words you delete while revising are not lost either; the progress window
shows "cut while revising" next to what you added.

- **A daily goal** for all your writing: **Daily word goal**.
- **A goal and a deadline for each book.** Put them in the book note's properties, as `goal` and
  `deadline`. You can also set them in the progress window.
- **A day that ends late.** Words written after midnight can count toward the day before, up to
  an hour you choose: **The writing day ends at**.

```
goal: 80000
deadline: 2027-03-01
```

Write amounts as `80000`, or quote them if they have separators (`"80.000"`). Unquoted, `80.000` is
the decimal number 80.

### The progress window

Run **Open progress**, or click the counter in the status bar. The window shows:

- **Today**: your words against the daily goal, and how many you cut while revising.
- **Book**: the book's total against its goal, with the chapters counted.
- **Streak**: days in a row that you wrote (days off do not break it).
- **This week**: your average a day.
- **This piece**: for a conto or an essay, its length against its target or limit.

Below the tiles there is a 30-day chart of words a day, with the book's running total. Under it
is **pacing**: the words a day you need to meet the deadline, and the date you finish at your
7-day average. Pacing counts only your writing days. If the deadline has passed, or you haven't
added anything for a week, it says so instead of guessing.

Open from a chapter or a book note, the window shows the book. Open from a conto or an essay
with a target, limit or deadline, it shows that piece.

### The status bar

The status bar shows the words in the current chapter and the book, today's words against your
goal, and your streak. With text selected it shows the selection's count. Click it to open the
progress window. Turn it off with **Show progress in the status bar**.

### Sprints

A sprint is a timed burst with a word target. Run **Start a sprint** to start one with your
default length and target. The status bar shows the time left and the words so far, with a
**stop** button. **Stop the sprint** ends it early. When you reach the target you get a notice,
and when the time is up you see the words, the minutes and your rate an hour. A sprint is not
saved if you close Obsidian. You can also start one from the progress window, with its own
length and target.

### Days off

Choose weekdays off and specific dates off. A day off never breaks your streak, and pacing counts
only the days you write. Writing on a day off still counts.

### Settings for goals

In Settings › Escrita › Goals: **Daily word goal**, **The writing day ends at**, **Folders to
track** (one per line; empty tracks the whole vault), **Folders to ignore**, **Ignore jumps
over**, **Default sprint** (minutes, then target words), **Show progress in the status bar**,
**Weekdays off** and **Dates off** (one per line, as YYYY-MM-DD). **Book goal property** and the
four piece properties below are in Properties and folders.

## Give one piece a target: a conto or an essay

Any note can have its own length goal, not just books. In its properties, set:

```
target: 5000
limit: 6000
unit: words
deadline: 2026-12-01
```

- `target` is the length you are aiming for. `limit` is a hard maximum, like a contest's.
- `unit` is `words`, `characters` (with spaces) or `characters-no-spaces`. A note with only
  `unit: characters` is still counted in characters.
- `deadline` is a date, YYYY-MM-DD.

Characters are counted on the text a reader sees: no properties, comments, code or formatting
marks, and runs of spaces count as one. An accented letter or an em dash is one character. The
note's length shows in the status bar and the progress window, and next to its name in the file
explorer. A note near or past its limit is marked.

The property names are settings in Properties and folders: **Target property**, **Limit
property**, **Unit property**, **Deadline property** and **Book goal property**. Write amounts
as `15000`, or quote them if they have separators (`"15.000"`).

## Leave a note for later: placeholders

*Features › Placeholders.*

When you don't know a detail, don't stop. Mark the spot and keep writing:

```
%% XXX: check if the cellar has a window %%
```

Run **Insert placeholder** to add the marker where you are. You can bind it to a hotkey in
Obsidian's settings (Escrita sets none), or add it to the mobile toolbar.

- **In the editor** a placeholder shows as a small red pill. In Live Preview, with the cursor
  elsewhere, the `%% XXX:` and `%%` are hidden and the marker shows as a label. Put the cursor on
  it to see the raw text.
- **In the file explorer** a note with placeholders gets a dot, and in the outline a chapter gets
  a badge with the count.
- **Next placeholder in this note** and **Previous placeholder in this note** step through them.
- **Open placeholders** opens the **Placeholders** panel. It lists them for **This book** or **All
  notes**. Click one to jump to it. The resolve button removes the marker from the note, after
  you have filled in the answer.
- **They hold back publishing.** The publish check stops on a placeholder left in a note (see
  [Publishing](publishing.md)).

Settings, in the Placeholders section: **Placeholder marker** (the word, `XXX` by default) and
**Mark files with placeholders in the file explorer**.

## Write without stopping: Enter flow and typography

*Features › Enter flow and smart typography.*

### Enter, Enter, Enter

This is off by default. Turn on **Enter, Enter, Enter** in the Editor section. Then, in a chapter
or in another tracked note, pressing Enter on an empty line past a normal gap between paragraphs
makes a **scene break**:

```
the last line of the scene

---

the first line of the next
```

What "a normal gap" means is the setting **Paragraphs are separated by**: **A blank line**
(standard Markdown, so you press Enter three times after the last line) or **A single line
break** (twice). In a chapter, one more Enter after a scene break at the end of the note makes
the **next chapter**: Escrita creates it after the current one, titled "Untitled", and opens it
in place of this tab. A conto gets scene breaks only. Nothing happens inside properties, code or
comments.

**Insert scene break** puts a break at the cursor with the blank lines around it set right. It
refuses to put one in the properties.

### Smart typography

On by default (**Smart typography**). As you type:

- `--` after a word becomes —.
- `--` at the start of a line becomes — for dialogue (**Dialogue dash**).
- `...` becomes …
- Straight quotes curl to your style (**Quotes**): “…” ‘…’, «…» ‹…›, „…“ ‚…‘, or **Leave quotes
  alone**. An apostrophe becomes ’.

Press Backspace right after a replacement to get back what you typed. A backslash keeps the next
character as typed. Nothing changes in properties, code or math. **Where smart typography
applies** is **Only in book chapters** (the default) or **In every note**.

Settings are in the Editor section: **Enter, Enter, Enter**, **Paragraphs are separated by**,
**Smart typography**, **Where smart typography applies**, **Quotes** and **Dialogue dash**.
Quotes and paragraph style are shared with dialogue focus and the revision lens, so they show
while one of them is on.

## Read only the speech: dialogue focus

*Features › Dialogue focus.*

**Toggle dialogue focus** dims everything in the note except speech, so you can read a scene's
dialogue on its own. Speech is:

- a line that opens with a dash (—, – or ―). Spaced dashes inside the paragraph switch to
  narration and back: `— Vem cá — disse ela. — Agora.`
- anything in double quotes of your quote style, and straight `"`.

A hard-wrapped line inside a paragraph stays speech. Code, properties and comments are never
speech. It works in Live Preview and Source mode, not in Reading view, and stays on for that
note until you turn it off or restart Obsidian. Its only setting is **Quotes**, shared with smart typography. The revision lens
shows the dialogue share of the same text (see [Revision](revision.md)).

## Move a paragraph or scene

*Features › Move a paragraph or scene.*

Four commands swap the paragraph, or the scene between `---` breaks, under your cursor with its
neighbour: **Move paragraph up**, **Move paragraph down**, **Move scene up** and **Move scene
down**. They have no default hotkeys; bind the ones you want in Obsidian's settings.

- **One undo.** The whole move is one change.
- **Some things stay put.** Beats, comments, code and math blocks, and the properties don't move.
  A paragraph steps over one as if it were a neighbour.
- **Nothing breaks.** A move that would change how the note reads is refused, and a notice says
  so. A paragraph at the edge of the note doesn't move.

They work in the editor, in Live Preview or Source mode.

## Insert from a template

*Features › Insert from a template.*

Set **Templates folder** (in Books), then run **Insert from a template**. It lists the notes in
that folder, with their path under the name. The one you pick goes in at the cursor, or at the end
of your selection.

- `{{title}}`, `{{date}}` (YYYY-MM-DD) and `{{time}}` (HH:mm) are filled in.
- The template's properties are added to your note only where it doesn't have them yet. Nothing is
  overwritten.
- It all goes in as one change, so one undo takes it back.
- Beats and placeholders in a template work as usual once inserted.

With no templates folder set, the command says so and offers to open the settings. If the note
changes while the template loads, nothing is inserted. The same folder holds the templates the
universe uses (see [The world](the-world.md)).

## Spellcheck on demand

*Features › Spellcheck on demand.*

**Toggle spellcheck** turns Obsidian's spelling squiggles on or off. Hide them while you draft,
and turn them on when you revise.

## See your counts in the file explorer

*Features › Word counts in the explorer.*

Tracked notes and chapters show their length next to their name, in the note's own unit (words,
or characters for a note with `unit: characters`). A book's note, its folder and its chapters
folder show the book's total. Past 10,000 the number is shortened (`12.3k`, or `12,3 mil` in
Portuguese), and the full count is in the tooltip.

- **A target beside the count.** With **Show the target next to the count**, a note with a target
  or limit shows `4,210 / 5,000`. A chapter shows the effective target, so a chapter that takes
  its book's default shows it too.
- **Folder totals.** With **Show folder totals**, your other folders show the words of the tracked
  notes inside them. Books always show their total.
- **A limit.** A note near or past its limit is marked.
- **The placeholder dot** sits next to the name too.

The settings are in the Goals section. Which notes are tracked comes from **Folders to track**
and **Folders to ignore**.

## When something looks wrong

| You see | Why | What to do |
|---|---|---|
| No stripe on a chapter | It has no `pov` property, or the name in the setting differs | Add `pov`, or change the setting |
| Two stripes of different colours for one character | The text and the link spell it differently | Use one link, or give the entry an alias that matches the text |
| Drag doesn't work | A filter is on | Click **Clear** |
| A chapter has no bar | No target of its own and no `chapterTarget` on the book | Add one of them |
| The bar uses the wrong unit | The chapter's `unit` or the book's `unit` says so | Change or remove the property |
| A chapter shows no target in the explorer | The book has no `chapterTarget`, or the setting is empty | Add `chapterTarget` to the book note |
| Enter doesn't make a scene break | **Enter, Enter, Enter** is off, the note isn't tracked, or you are in properties, code or a comment | Turn it on, or check where you are |
| Quotes don't curl | **Quotes** is on "Leave quotes alone", or the note isn't a chapter | Change the setting, or use **In every note** |
| My words didn't count | The note is outside **Folders to track**, or the change was bigger than **Ignore jumps over** | Check the folders and the size |
| A move did nothing | The cursor is in a beat, comment, code or math, or the note is at its edge | Put the cursor in a paragraph |
