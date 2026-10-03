# Guide: the shared universe, threads and templates (0.6)

How to use what 0.6 adds, and how to set it up. The README lists every feature and
setting; this guide walks through them in the order a writer meets them. Names are given
in English, with the Portuguese (pt-BR) labels in parentheses where they help.

Everything here is opt-in. The universe is off by default, threads and templates do
nothing until you use them, and no feature writes to a note without a click.

## 1. Choose a mode

Settings › Escrita › Universe › **Shared universe** (Universo compartilhado):

| Mode | Choose it when | Where entries live |
|---|---|---|
| **Off** (default) | You don't want characters and places tracked | Nowhere. No panel, no universe commands. Threads still work. |
| **Per book** | Each novel has its own cast | Inside each book: `<Book>/Characters/`, `<Book>/Places/`… |
| **Universe** | Stories share characters and places | In one shared folder, beside the universe note |

Changing the mode never moves or edits notes. Going back to Off only hides things.

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

1. It has its own `universe` property linking the universe note
   (`universe: "[[Universe]]"`).
2. It's a chapter and its book note has that property.
3. It's inside the universe's folder (`Universe/`), or is the universe note.
4. It's inside one of the folders in the universe.

A chapter's own property wins over its book's. A note matching none of these is
standalone: it isn't in any universe. There is no per-note way yet to keep one note out
while its folder is in; move it to a folder outside the list.

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

- **Entries**: section 3.
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
```

Essays in `Textos/` stay out of the universe, but still get their form, and their threads
still show in **Show open threads**.

## When something looks wrong

| You see | Why | What to do |
|---|---|---|
| A note that isn't fiction in the Works tab | Its folder is in "Folders in the universe" | Remove the folder from that list |
| A note in Entries you didn't mean as an entry | It has the type property and belongs to the universe | Remove the property (section 3) |
| The panel says the universe note doesn't exist | The note in the settings is missing | Click **Create**, or fix the path |
| "Create universe entry" says the note isn't in a universe | The note matches none of the rules in section 2 | Use **Add to …** in the panel, or add its folder |
| Universe commands are missing | The mode is Off | Choose Per book or Universe |
| A work is under "No form" | No form property and no matching "Form by folder" line | Add the folder line, or the property |
| Closing a thread says it changed | The marker was edited since the list was read | Nothing was changed; try again from the refreshed list |
