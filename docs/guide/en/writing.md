# Writing

This page covers the parts of writing that 0.7 adds to the outline (point of view, status and
filters, and per-chapter targets) and, since 0.9, reading the whole book. Other parts of the page (goals, placeholders, typing,
moving blocks, templates and the rest) are still to come, and the README lists them for now.

Other pages: [Features and settings](features-and-settings.md) and [The world](the-world.md).
Turn the outline on or off in Features › Outline and ghost beats.

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
property is a setting (**Chapter target property**).

- **The chapter wins.** A chapter with `target: 1500` shows its own bar. The bar's label says
  where the target came from: "chapter target" for the chapter's own.
- **Only the target is inherited.** A chapter's `limit` and `deadline` stay its own.
- **The unit.** A chapter's own `unit` wins. Without one, the book note's `unit` is used,
  and without that, words. So `unit: characters` on the book note counts all its chapters in
  characters, and a chapter can still choose its own.
- **No target, no bar.** A book with no `chapterTarget` and chapters without a target shows
  no bars.
- **The default shows in the outline only.** The file explorer's counts and the goals read
  each chapter's own properties, so the explorer may show no target next to a chapter where
  the outline shows a bar from the book's default.

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

## When something looks wrong

| You see | Why | What to do |
|---|---|---|
| No stripe on a chapter | It has no `pov` property, or the name in the setting differs | Add `pov`, or change the setting |
| Two stripes of different colours for one character | The text and the link spell it differently | Use one link, or give the entry an alias that matches the text |
| Drag doesn't work | A filter is on | Click **Clear** |
| A chapter has no bar | No target of its own and no `chapterTarget` on the book | Add one of them |
| The bar uses the wrong unit | The chapter's `unit` or the book's `unit` says so | Change or remove the property |

## New notes start as draft

A new book or chapter, and a note you create in a tracked folder (from Obsidian's *New note* or from a template), gets your first draft word as its `status`, unless it already has one. Escrita waits a moment after the note is created, so a template's own status wins. Templates, universe entries and Escrita's own notes (home, word lists, universe note) are left alone. Only the properties change. Turn it off in Settings → Stages, "New notes start as draft".
