# The world: the shared universe, "Appears in", threads and templates

How to use the universe (0.6) and what 0.7 adds to it, and how to set it up. The README
lists every feature and setting; this guide walks through them in the order a writer
meets them. Other pages: [Features and settings](features-and-settings.md) and
[Writing](writing.md). Names are given in English, with the Portuguese (pt-BR) labels in parentheses where they help.

Everything here is opt-in. The universe is off by default, threads and templates do
nothing until you use them, and no feature writes to a note without a click.

## 1. Choose a mode

Settings › Escrita › Features › **Shared universe** (Universo compartilhado). Since 0.7 the
mode is the universe's switch on the Features page, so there is no separate mode setting in
the Universe section:

| Mode | Choose it when | Where entries live |
|---|---|---|
| **Off** (default) | You don't want characters and places tracked | Nowhere. The universe is not loaded: no panel, no universe commands, no "Appears in". Threads still work. |
| **Per book** | Each novel has its own cast | Inside each book: `<Book>/Characters/`, `<Book>/Places/`… |
| **Universe** | Stories share characters and places | In one shared folder, beside the universe note |

Changing the mode never moves or edits notes. Going back to Off only unloads the feature
and hides things; your entries stay in your vault.

## 2. Set up a universe (universe mode)

1. **Universe note** (Nota do universo): a note that names the universe, for example
   `Universe.md`. The folder beside it with the same name (`Universe/`) holds the
   entries. There is no separate folder setting. Click **Create** (Criar) if the note
   doesn't exist yet; the universe panel offers the same button.
2. **Folders in the universe** (Pastas no universo): folders whose works join the
   universe without any property. One per line.
3. **Entry types** (Tipos de entrada): five fixed types (character, place, object, group,
   event). For each, set the word you write in the type property, the folder new entries
   go in, an optional template note, and the name shown in menus. You can rename the
   types, but not add or remove them.
4. **Form property and Form by folder** (Propriedade de forma, Forma por pasta): what kind
   of work a note is (short story, essay, novella, novel, poem, fragment), used to group
   the Works tab. See section 6.
5. **Thread word and closed word** (Palavra dos fios): the words in thread markers. See
   section 7.

### Choosing the folders in the universe: only fiction set in your world

A folder in this list pulls **every work in it** into the universe: any note with a
`status` (a known stage) counts as a work there. Put only the folders whose stories
happen in your world. Essays, chronicles and journals usually don't belong.

Example: with `Contos`, `Textos`, `Romances` listed, an essay in `Textos/Noite.md` with
`status: rascunho` shows up in the Works tab, even though it has no `universe` or type
property. The fix is to list only the fiction folders:

```
Contos
Romances
```

"Form by folder" is a separate setting: `Textos: ensaio` there only labels essays as
essays. It never pulls a folder into the universe.

### What belongs to a universe

A note belongs to a universe when the first of these applies:

0. It has `universe: false`. It stays out, whatever else is true (see below).
1. It has its own `universe` property linking the universe note
   (`universe: "[[Universe]]"`).
2. It's a chapter, or another file of a book, and its book note has that property.
3. It's inside the universe's folder (`Universe/`), or is the universe note.
4. It's inside one of the folders in the universe.

A file's own property wins over its book's. A note matching none of these is standalone: it
isn't in any universe.

### Keeping one note out: `universe: false`

Say an essay sits in `Contos/`, a folder you listed in "Folders in the universe", but it
isn't set in your world. Add this to its properties:

```
universe: false
```

The note is now standalone. Its names don't count as mentions, its text doesn't feed the
lens with names, and the panel's **Add to …** button doesn't show for it, because you chose
to keep it out. Remove the property and everything comes back, without a restart.

- **It beats everything else.** It wins over the universe folder, the universe note and the
  folders in the universe.
- **On a book note, it covers the whole book**: every chapter and every other file of that
  book stays out. A chapter that sets its own `universe` link stays in, because a file's own
  link beats its book's `false`. A chapter with its own `false` stays out even when the book
  has a link.
- **It is a plain true/false value.** The Properties editor may save it as the text
  `"false"`; that works too (spaces and capitals don't matter). There is no word to
  translate and no setting for it.
- **Entries.** A note that is an entry and has `universe: false` is not an entry of that
  universe.

### Joining one note by hand

Open a note that's outside any universe. The universe panel shows **Add to …** (Adicionar
ao …), which sets the `universe` property on that note. It only writes when you click it.

## 3. Entries: characters, places, objects, groups, events

An **entry** is a note that has the type property (`type`, or the name you chose, such as
`tipo`) with one of the five type values, and belongs to a universe (or, in per-book mode,
to a book). The folder is only where new entries are created; entries can move freely.

### Create an entry from your text

1. Select a name in your prose (one line, up to 60 characters).
2. Right-click and choose **Create universe entry** (Criar entrada do universo), or use
   the command.
3. Pick the type, and optionally add another alias. Leave **Turn this occurrence into a link** ticked
   to turn the selected text into a link (one undo removes it).
4. **Create** makes the note in the type's folder from its template, with the type and
   `universe` properties set (in per-book mode, no `universe`). It opens to the side.

If an entry with that name or alias already exists, the modal offers **Open** or **Just
link here** instead. Escrita never overwrites a note.

You can also create entries from the panel: the **+** next to each type, or **New entry**
in an empty universe.

### Find and use entries

The panel's **Entries** tab (Entradas) groups entries by type. The search matches names and
`aliases`, ignoring accents and case. Right-click an entry for **Open**, **Open to the
side**, **Insert link in note** (at your cursor in the last note you edited) and **Show in
file explorer**.

### Remove an entry

There is no remove button: deleting and renaming stay with Obsidian, so the panel never
deletes anything. A note stops being an entry when either condition goes away:

- **Remove its type property.** The note stays where it is and leaves the panel. This is
  the cleanest way.
- **Delete the note.** Use **Show in file explorer**, then delete it in Obsidian (it goes
  to the trash).
- **Move it out of the universe.** Move it out of the universe folder and the folders in
  the universe, and remove its `universe` property. Removing the property alone isn't
  enough while the note is still inside `Universe/`.

A note with a type property inside one of the folders in the universe (say `Contos/`)
also counts as an entry, so keep entries in the universe folder.

## 4. Move a book's entries to the universe

If a book has its own `Characters/` and `Places/` folders (from per-book mode, or from
before 0.6), switch to universe mode, open the book note or a chapter, and run **Move this
book's entries to the universe** (Mover as entradas deste livro para o universo). It's
also in the right-click menu of the book's folder.

The preview lists every note that will move, and every name that already exists in the
universe (those stay where they are; nothing is overwritten). Two boxes add the type
property where a note lacks it, and the `universe` property to the book note. Notes move
one by one with Obsidian's rename, so links everywhere update. Chapters are never moved.

## 5. The universe panel

Open it with **Open the universe panel** (Abrir o painel do universo). It follows the
universe of the note you're in; with no note open, it keeps the last one. With more than
one universe, a picker appears in its title.

- **Entries**: section 3. Each entry with mentions shows "N works" beside it; section 9
  explains the count and the list under it.
- **Threads**: section 7.
- **Works**: section 6.

## 6. Works and their form

The **Works** tab (Obras) lists the universe's works: books, and notes with a known stage
in their `status`. They're grouped by form, sorted by stage (published first) and name,
with a dot in the stage color and the word count. Click one to open it where you left
off.

A work's form comes from:

1. its own form property (`form: novella`), if it has one; else
2. **Form by folder**: lines like `Contos: conto`, one per folder. The deepest matching
   folder wins.

Works with neither go under **No form** (Sem forma). Nothing is written to your notes.

The form words are one comma-separated field, in this order: short story, essay, novella,
novel, poem, fragment. Example in Portuguese: `conto, ensaio, novela, romance, poema,
fragmento`.

## 7. Open threads

A **thread** is a loose end planted in one story for a later one. It's a comment, so it
never shows in Reading view or an export:

```
%% thread: who wrote the letters? %%
```

- **Plant a thread** (Plantar um fio): command or editor menu. It inserts the marker at
  the cursor; selected text is copied into it and stays in your prose.
- **See them**: the panel's **Threads** tab (Fios), grouped by work, with the date each
  thread was first seen (kept in the plugin's data, never in the note). With the universe
  off, use **Show open threads** (Mostrar fios abertos), which lists the threads in your
  tracked works. In per-book mode the panel shows the book's threads.
- **Close one**: the circle in the panel, or right-click the marker in the editor and
  choose **Close thread…** (Fechar o fio…). Optionally name the work that answers it. The
  marker becomes `%% thread closed: … → [[The House]] %%`. **Reopen thread** undoes it.
  Writing the closed form by hand works too.

Closing only writes if the marker is still exactly what the panel read. If you edited it
in the meantime, nothing changes and the list refreshes.

**The words are settings.** The thread word (default `thread`) and the closed word
(default `closed`) can be anything, for example `fio` and `fechado`, giving
`%% fio: … %%` and `%% fio fechado: … %%`.

## 8. Insert from a template

Set **Templates folder** (Pasta de modelos) under the chapter settings. Then **Insert from
a template** (Inserir de um modelo) lists the notes in that folder. The chosen template's
body goes in at the cursor, with `{{title}}` (this note's name), `{{date}}` and `{{time}}`
filled in. Its properties are added only where your note doesn't have them; nothing is
overwritten. One undo removes the whole insert.

The entry templates (section 2) use the same filling.

## 9. Appears in: where a character or place is mentioned

For each entry, Escrita shows which works mention it, how many times, and where. It finds
the mentions in your text by itself. You don't tag anything and nothing is written into
your notes.

### Where you see it

- **In the panel.** On the Entries tab, an entry with mentions shows "N works" beside its
  name. Click the row to open the list: each work with its mention count and its form,
  and for a book, the first and last chapter that mention it ("first in ch. 2, last in
  ch. 9"). A group called **Other notes** follows the works: other entries, the universe
  note and loose notes that are in the universe. It starts closed.
- **In the entry note.** Open the entry (for example `Universe/Characters/Maria.md`) and an
  **Appears in** section appears at the end, in Live Preview and Source mode. It is drawn
  by Escrita over the note. It is not part of the file: you can't select it, it isn't
  exported, it isn't counted and your file's text and modified time don't change. It stays
  empty in Reading view for now; use the panel there.
- **Click a work.** The note opens with the first mention selected. If you edited the note
  and the mention moved, Escrita finds the right place again. If the mention is gone, the
  note opens at the top.

While Escrita builds the first count after you start Obsidian, the panel says "counting…".
It works in the background in small steps, so typing stays smooth. After that, counts follow
your edits and settle about a second after you stop typing. If you add an alias to an entry,
the counts update within a few seconds.

### What counts as a mention

- Escrita reads what a reader sees: the text of your notes, headings included. It skips
  properties, `%% comments %%`, code, link addresses and embeds.
- A link counts. `[[Maria]]` is a mention. `[[Maria|her]]` counts once, not twice.
- A mention counts for an entry only in notes in that entry's scope: the universe's works in
  universe mode, the book's chapters in per-book mode. A note with `universe: false` is out.

### How names are matched

An entry matches by its note name and by its `aliases`. These rules decide the rest.

1. **Capitalized names need a capital letter.** An entry named *Rosa* counts *Rosa* and
   *ROSA* but not *rosa* in "a blusa rosa". For a name of several words, each capitalized
   word of the name needs its capital: *Rosa dos ventos* needs a capital on *Rosa*, not on
   *dos*. A heading in capitals (`## PORTO`) still counts. A common word at the start of a
   sentence still matches, so a sentence that begins with *rosa* (the colour) counts for the
   entry named *Rosa*. If that is a problem, use the entry's ignore list.
2. **Lowercase aliases match in any case.** An alias like *o menino* matches *o menino* and
   *O menino*.
3. **Articles must match as written.** *o menino* never matches *os meninos*, and *a casa*
   never matches *as casas*. If you want both, give both as aliases.
4. **Plurals and diminutives follow the language.** With Portuguese, *Maria* also matches
   *Mariazinha* and *Marias*, and *Mariano* does not match *Mariana*: they are different
   people. English handles plurals and possessives (*Teo's*). The language is **Writing
   language** at the top of the Features page. With no language (an Obsidian language
   Escrita doesn't know), names match only as written.
5. **Accents don't matter.** *Inês* and *Ines*, *Tomás* and *Tomas*, *Mário* and *Mario* are
   the same name, because writers are not always consistent with accents.
6. **Hyphens split words.** *Maria-José* matches the entry *Maria José*, and the entry
   *Santa-Rita* matches *Santa Rita*.
7. **Names of several words** match across spaces, line breaks and `*emphasis*` marks. Other
   punctuation breaks them.
8. **First name as an alias.** For a character with a full name, the first name counts too:
   *Dona Benta Encerrabodes* is also found as *Benta*. See "Titles" below.
9. **A tie counts for no one.** If two entries could own a word (*Marcos* and *Marco*), an
   exact name or alias wins over a derived first name. If it is still unclear, the word
   counts for nobody.
10. **Very short names don't match.** A one-letter name, or a name that is a common small
    word (like *a* or *de*), never matches.

### Titles

For a character whose note name starts with a title, Escrita skips the title and uses the next
word as the first name: *Dona Benta Encerrabodes* gives the alias *Benta*. The name without
its titles is also an alias, even when one word is left: *Mr Brown* gives *Brown*. A surname
alone is never made an alias when there is no title: *Maria Souza* gives *Maria*, not *Souza*.

Escrita knows common titles in Portuguese (*dona, dom, seu, sr, sra, dr, dra, padre, frei,
irmã, irmão, senhor, senhora, doutor, doutora, tia, tio, vó, vô, coronel, capitão,
professor, professora*) and in English (*mr, mrs, ms, miss, dr, sir, lady, lord, aunt,
uncle*). Titles keep their accents, so *Irma*, a given name, is not the title *Irmã*. To add
your own, use **Extra titles** (Títulos extras) in the Universe settings, one per line.

### Entry properties

Four properties in an entry's note adjust how it is matched. They are all optional, and
the names are settings (Universe › Entry properties).

| Property | Values | What it does |
|---|---|---|
| `aliases` | a list | Other names that count, like `Mari`. This is Obsidian's own property. |
| `caseSensitive` | `true` | Match with exact capitals only (accents are still ignored). For a name that is also a common word. |
| `ignore` | a list of phrases | Phrases where the name must not count. `Rosa` with `ignore: ["rosa dos ventos"]` still counts elsewhere. |
| `firstName` | `false` | Don't make the first name an alias for this character. |

Example, a character called *Rosa* in a world that also has a *rosa dos ventos*:

```
---
tipo: personagem
aliases: [Rosinha]
ignore: ["rosa dos ventos"]
---
```

### What it never does

- It never writes to your notes, not even the entry's.
- It never contacts a server. Everything runs on your device.
- It never decides for you. A wrong match doesn't change any note: add an `ignore` phrase or
  an alias, and the counts follow.

## 10. Names in the editor and the revision lens

Once an entry exists, its names stop being treated as typos.

- **Spellcheck.** Names and aliases in the notes of their universe aren't flagged as
  misspelled in Live Preview. The same word in a note outside the universe still is.
  Only names that start with a capital letter are marked this way. This works by marking the
  word as "don't spellcheck", so your own dictionary is never changed. On a phone, whether
  the squiggle goes away depends on the phone's keyboard; autocorrect there is not affected.
- **Underline.** Turn on **Underline names in the editor** (Sublinhar nomes no editor) in the
  Universe settings to see a thin line under every recognized name. It is off by default. The
  names are unflagged either way. **Ctrl-click** (**Cmd-click** on a Mac) on an underlined
  name opens its entry.
- **Revision lens.** With the lens on, a spelling variant of an entry's name (*Marianna* when
  the entry is *Mariana*) is flagged as a name variant, and repeating a name is not counted as
  an echo. Your word lists note still adds to the names.

The marks only draw over your text. They never change it.

## Example: a writer of short stories in Portuguese

```
Universe mode:          Universo
Universe note:          Universo.md           (entries in Universo/)
Folders in universe:    Contos
                        Romances
Type property:          tipo                  (personagem, lugar, objeto, grupo, evento)
Templates per type:     Modelos/Personagem.md, Modelos/Lugar.md
Form property:          forma                 (conto, ensaio, novela, romance, poema, fragmento)
Form by folder:         Contos: conto
                        Textos: ensaio
                        Romances: romance
Thread word:            fio
Closed word:            fechado
Templates folder:       Modelos
Extra titles:           (none needed: the Portuguese titles are built in)
Underline names:        on
```

Essays in `Textos/` stay out of the universe, but still get their form, and their threads
still show in **Show open threads**. An essay in `Contos/` that isn't in your world gets
`universe: false`.

## When something looks wrong

| You see | Why | What to do |
|---|---|---|
| A note that isn't fiction in the Works tab | Its folder is in "Folders in the universe" | Remove the folder from that list |
| A note in Entries you didn't mean as an entry | It has the type property and belongs to the universe | Remove the property (section 3) |
| The panel says the universe note doesn't exist | The note in the settings is missing | Click **Create**, or fix the path |
| "Create universe entry" says the note isn't in a universe | The note matches none of the rules in section 2 | Use **Add to …** in the panel, or add its folder |
| A note you expected is missing from "Appears in", the Works tab, or the names | It has `universe: false`, or it is outside the entry's universe | Remove `universe: false`, or check the rules in section 2 |
| A name is not counted | It is lowercase in the text, the entry is case-sensitive, or the word is on the entry's ignore list | See section 9 |
| Counts say "counting…" | The first count after starting Obsidian is still running | Wait a few seconds; it runs in the background |
| Universe commands are missing | The mode is Off (the feature is not loaded) | Choose Per book or Universe on the Features page |
| A work is under "No form" | No form property and no matching "Form by folder" line | Add the folder line, or the property |
| Closing a thread says it changed | The marker was edited since the list was read | Nothing was changed; try again from the refreshed list |
