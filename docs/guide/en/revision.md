# Revision

This page is for the second draft: reread a conto, cut what doesn't earn its place, keep
what you cut, and be able to go back. Three parts of Escrita help, and none of them changes
your text without a click from you:

- the **revision lens**, which underlines what is worth rereading;
- **snapshots**, copies of a note you can compare and restore;
- **darlings**, passages you cut but can't bear to lose.

Other pages: [Features and settings](features-and-settings.md), [Writing](writing.md),
[Tracking](tracking.md), [Publishing](publishing.md) and [The world](the-world.md). Each part has its own switch in
Features, under Revision: **Revision lens**, **Snapshots** and **Darlings**. Turn one off and
its commands, panel and menu items go away. Your data stays (the word lists note, the
snapshot files, the darlings note).

## Revise a conto

A way to use the three parts together:

1. Take a snapshot of the draft, so you can always see what you changed.
2. Turn on the lens and step through what it marks. Fix some, ignore others.
3. Cut what doesn't work with **Move selection to darlings** instead of deleting it.
4. Compare the note with your snapshot to see the revision as a whole.
5. Happy? Keep going. Not happy? Restore the snapshot, or bring a darling back.

## The revision lens

Run **Toggle revision lens** on a note. Escrita underlines matches in the text and opens a
panel on the right. The lens only suggests. It never changes your text, and nothing leaves your
device. It stays on for that note until you turn it off or restart Obsidian.

It works in Live Preview and Source mode, not in Reading view. If you try it in Reading view, a
notice says so.

### The rules

Each rule has its own underline style, and each can be switched off in Settings › Escrita ›
Revision, under **Rules**.

| Rule | What it marks |
|---|---|
| **Echoes** | The same word, or one of the same family (*olhar*, *olhou*, *olhando*), too close together. The window is 40 words by default and starts over at each scene break and heading. Names, very common words and words under 4 letters are left alone. |
| **Adverbs** | Words ending in *-mente* (Portuguese) or *-ly* (English), except real words that only look like adverbs (*mente*, *semente*, *only*, *family*). |
| **Gerunds** | *-ando*, *-endo* and *-indo* words, *gerundismo* (*vou estar enviando*) and three or more gerunds in one sentence. In English this rule is named **Started to** and marks phrases like *started to* and *began to*. |
| **Crutch words** | The words and phrases you list in your word lists note (below). They match whole words, in any case, exactly as written. List *começou a* and *começaram a* both. |
| **Name variants** | A capitalized word that looks like a misspelling of a name you listed (*Maira* for *Maria*). The name itself, its plural or diminutive, and a word you also write in lowercase are never marked. |
| **Long sentences** | A sentence with more words than the limit, dialogue included. 45 words by default. |

A seventh rule, **Names without an entry**, is off until you turn it on. It points at
recurring capitalized names you haven't made an entry for. It needs the universe, so it is
described in [The world](the-world.md#names-without-an-entry).

### The panel

The panel (named **Revision lens**) shows, for the whole note, or for your selection when you
have one (it says "Selection"):

- **Dialogue**: the share of words that are speech. A note with several scenes also shows each
  scene's share ("Scene 2").
- **Readability**: words per sentence, syllables per word, and a reading-ease score with a
  band such as "easy" or "difficult" and a line that says what it means. For Portuguese it is
  Flesch adapted by Martins (1996). For English it is Flesch. A very short text says how many
  words and sentences it needs first.
- **Rules · whole note**: one row per rule with its count and the rate **per 1,000 words**, so
  a short conto and a long chapter can be compared. Each row has previous and next buttons that
  select the match ("3 / 12").

The syllable count is approximate on purpose. The lens skips headings, math blocks and, by
default, `>` quotes, so its word count can differ a little from the status bar's.

### Step through the matches

Press a row's next and previous buttons, or run **Next revision lens match** and **Previous
revision lens match**. They step through the rule you used last. They have no default hotkey:
set your own in Obsidian's hotkeys, or add them to the mobile toolbar. On a phone the drawer
closes after a step and a short notice shows where you are ("Echoes · 3 / 12").

### Ignore a match

When you disagree with a match, use **Ignore here**: in the editor's context menu on the match,
or in the panel while stepping. Escrita remembers it by the note, the rule, the word and the
words around it, so it survives edits elsewhere in the note. The panel then says "N ignored" with
a **Clear** button. Clear asks first ("Show the 3 ignored matches in this note again?").
Ignored matches follow the note when you rename it.

### Word lists

The crutch words, names and ignored words come from one note of yours, the **word lists note**.
It has three headings, in Portuguese or English, with one entry per line:

| Portuguese | English | What it is for |
|---|---|---|
| `## Vícios` | `## Crutch words` | Words and phrases you overuse. Marked by the **Crutch words** rule. |
| `## Nomes` | `## Names` | Characters and places. The **Name variants** rule warns when one comes out almost the same. |
| `## Ignorar` | `## Ignore` | Words the lens never marks in echoes, adverbs, gerunds and name variants. Not crutch words, since you listed those on purpose. |

Run **Create the word lists note** (or press **Create** in the settings) and Escrita writes a
note with the three headings and a short starter list of crutch words. It never touches a note
that already exists: it opens it. Without a word lists note, the crutch and name rules stay
silent and everything else works.

**Add from the editor.** With the lens on, select a word or a short phrase (1 to 6 words), or
just put the cursor in a word, and open the editor's context menu. **Add to crutch words**,
**Add to names** and **Always ignore** add it to the matching list. Nothing else in the note
changes. A selection that holds `%%` or starts like a list item isn't offered, because it
couldn't be read back from the note. If the note doesn't exist yet, it is created first, and a
notice says "Added to crutch words: «word»". A word already there says "Already in the list".

### Language

The lens reads the **Writing language** (Automatic, Português (Brasil) or English), set on the
Features page. See [Features and settings](features-and-settings.md). In another language the
echo, adverb, gerund and readability rules are off, and the panel offers **Open settings** so you
can choose one. Crutch words, name variants, long sentences and the dialogue share still work.

### Settings for the lens

In Settings › Escrita › **Revision**:

| Setting | What it does |
|---|---|
| **Word lists note** | The path of the word lists note, with a **Create** button. Empty means `Word lists.md` (`Listas de palavras.md` in Portuguese). |
| **Echo window** | How many words back an echo looks. 40 by default, from 10 to 200. |
| **Long sentence** | A sentence with more words than this is marked. 45 by default, from 15 to 200. |
| **Skip quotes** | Lines that start with `>` are not read. On by default. |
| **Rules** | One switch for each rule. |
| **Names without an entry** and **Not names** | The opt-in rule and its list of words it never marks. See [The world](the-world.md#names-without-an-entry). |
| **Show dialogue share** | Shows the dialogue measure in the panel. |
| **Show readability** | Shows the readability measure. |

The number fields save when you leave the field. A value out of range is put back.

## Snapshots

A snapshot is a copy of a note's text you can go back to. It is the safety net for revising.

### Take one

Run **Take a snapshot** or use **Take a snapshot** in the file menu. A window asks for a name
("Snapshot" by default). Give it a useful one, like "Sent to the magazine". If nothing has
changed since the last snapshot, a notice says "Nothing changed since the last snapshot."

Escrita also takes snapshots by itself. Each one is labelled with its kind:

| Kind | When |
|---|---|
| **Snapshot** | You took it. |
| **Before publishing** | You run Publish on the note (see [Publishing](publishing.md)). |
| **Before restoring** | Every time you restore, so a restore can always be undone. |
| **Before the day's first edit** | The first change to a tracked note on a writing day. Off by default. |
| **Stage change** | A work moves to another stage, such as draft to revision. This one belongs to the **Snapshot at each stage** switch, described in [Tracking](tracking.md#keep-a-version-at-each-stage-the-stage-snapshot). |

Automatic snapshots are trimmed: only the newest ones are kept for each note, and older ones
go to the trash. Snapshots you take yourself, and stage-change ones, are never removed.

### See them: the Snapshots panel

Run **Open snapshots**. The **Snapshots** panel lists the active note's snapshots, with their
length and how much the note changed since (for example "+120 words since then", or "same length now"). Each
snapshot has:

- **View**: its full text, in the compare tab's **Full text** view.
- **Compare**: opens the compare tab.
- **Restore**: puts the whole note back, properties included. A window asks first. The current
  text is saved before as "Before restoring", and if the note changed while it was restoring,
  nothing is replaced.
- **Rename** and **Delete**. Delete sends the snapshot file to the trash after asking.

### Compare

Run **Compare with the last snapshot** for a quick look, or **Compare** on any snapshot. The tab
compares the snapshot with the note as it is now, or with another snapshot. The **Snapshot**
list picks the one you are looking at and **Compare with** picks what it is compared with
(**Current text** or another snapshot). It works word by word, in three views:

- **Inline** shows added and removed words in the text.
- **Side by side** shows the two versions next to each other.
- **Full text** shows the snapshot's text on its own, with no comparison.
- Paragraphs that didn't change are folded ("12 unchanged paragraphs"). Click the line to open
  them.
- A paragraph you moved is labelled **Moved**.
- A summary says what changed: "+120, −45, 8% of paragraphs changed". A change in the
  properties says **Properties changed**.
- **Refresh** compares again after you edit the note.
- In a very long text some changes appear as whole paragraphs ("Long text: some changes are
  shown as whole paragraphs.").

In the comparison, **Use the old version** puts one passage (or the properties) back, and only
that. If the passage changed after the comparison, nothing is replaced.

### Deleted notes

Snapshots follow their note when you rename or move it, and they are kept when you delete it.
Run **Browse snapshots of deleted notes** to see them. Open one and copy the text back. The
compare tab then says "The note is gone. This is its snapshot's text: copy what you need."

### Where they live

Snapshots are plain `.txt` files in a folder with one subfolder per note, plus an `index.json`.
Search, graph and links ignore them. Settings › Escrita › **Snapshots**:

| Setting | What it does |
|---|---|
| **Snapshots folder** | Where they go. Empty means `Escrita/Snapshots`. Changing it doesn't move existing snapshots. |
| **Snapshot before the first edit of each day** | The first time you change a tracked note on a writing day, Escrita saves its text as it was. Off by default. |
| **Automatic snapshots to keep per note** | How many automatic snapshots to keep. 20 by default, at least 1. |

The folder has rules. A warning shows under the setting and the old value stays when the new
folder is not a plain folder inside the vault, is inside Obsidian's settings folder or a
tracked folder, holds a book, already has notes, or overlaps the export or submissions folder.
A folder starting with a dot is hidden, but **Obsidian Sync** skips it. Sync copies snapshot
files only with "Sync all other types" turned on. Git, iCloud, Dropbox and Syncthing copy them as
they are. If two notes have names that differ only in special spaces or accents, they would
share a folder, and a notice asks you to rename one.

## Darlings

*Darlings* are the passages you love and the story doesn't need. Don't delete them. Move them.

### Cut a passage

Select the passage and run **Move selection to darlings**, or choose **Move to darlings** in the
editor's context menu. On a phone, add the command to the toolbar. The passage leaves the
note in one undo step and goes into a darlings note, with a link to where it came from and the
date. A notice says "Moved to darlings — restore it from the Darlings panel."

If the text changed while saving, Escrita copies the passage to the darlings but leaves it where it
was. It never loses it.

### Where they go

Settings › Escrita › **Darlings**:

| Setting | What it does |
|---|---|
| **Darlings note inside a book** | The path of the note, inside the book's folder. `Darlings.md` by default. |
| **Darlings note for everything else** | The note for contos, essays and any note that isn't in a book. `Darlings.md` by default, a path from the vault's top level. |

It is a plain note you own. Each darling is a passage with its source in a heading, a
comment that holds the data Escrita needs, and your text exactly as you wrote it.
Run **Open darlings** to open the panel, which lists what you cut, with a count ("3 darlings"), and
**Open the darlings note** to open the note.

### Bring one back

In the **Darlings** panel:

- **Restore** puts the passage back where it came from. Escrita uses the text that surrounded it
  to find the spot. If that text has changed, the passage goes at the end of the note, and a notice
  says so. If the passage is already back, it is only removed from the darlings.
- **Open source** opens the note it was cut from.
- **Delete** removes it from the darlings note, after asking. If Obsidian's core File recovery
  plugin is on, it can still bring the passage back.

If the source note no longer exists, Escrita asks whether to paste the passage at the cursor of the
note you have open instead.

## When something looks wrong

| You see | Why | What to do |
|---|---|---|
| The lens shows nothing | The lens is off for this note, or you are in Reading view | Run **Toggle revision lens**, and leave Reading view |
| No echoes, adverbs or gerunds | The writing language isn't Portuguese or English | Choose one in Features |
| Crutch words or name variants never show | There is no word lists note, or its headings differ | Run **Create the word lists note** |
| A word in the word lists isn't marked | Whole words match as written, so *começou a* doesn't match *começaram a* | List each form |
| "Already in the list" | The word is already there | Nothing to do |
| The snapshots folder isn't saved | The folder breaks a rule | Read the warning under the setting |
| **Restore** says nothing was replaced | The note changed while restoring | Try again |
| A darling went to the end of the note | The text around its old place has changed | Move it where you want |
