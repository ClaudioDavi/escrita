# Escrita 0.9: manual test plan

This is the plan for testing 0.9 by hand, in Obsidian on desktop, in your vault at
`~/projects/website/escrita/`. It covers every 0.9 feature, the gates still open in
[PLAN-0.9.md](PLAN-0.9.md), and the choices made while building that you may want to change.
It ends with the release checklist.

How to read it:

- Each feature has numbered steps. "Expected" says what you should see. Note anything else
  next to the step number, and keep going.
- Escrita's labels are given as your Obsidian shows them in Portuguese, with the English in
  brackets: **Criar link** [Create link]. Obsidian's own labels are given the same way.
- The plan assumes Obsidian runs in Portuguese (Brazil). If it runs in English, use the
  bracketed names; the reader's chapter headings and the export template picked first change
  with it.
- Commands are run from the command palette (**Paleta de comandos** [Command palette], Ctrl+P).
  Escrita sets no hotkeys.
- Edge cases are marked **Edge case**. Defects found while writing this plan, not yet fixed,
  are marked **Likely defect**.
- The likely defects of the first pass are fixed (`763f532` and the commit after it): the
  collection's draft status (Collections, step 4), the Export switch's text (Feature switches),
  the pipe notice and the vault's link setting (Unlinked mentions, steps 4, 6, 13 and 14). Those
  steps now say what the fix should show.

Time needed: about two hours, plus half an hour for the gates.

## Before you start

### 1. Pause the automatic Git backup

Your vault lives inside the `website` repository, and the Git plugin commits and pushes after
every change (`autoBackupAfterFileChange`, every 10 minutes). Without a pause, the test notes
and the `publicado` statuses set during the test would reach the website.

1. **Configurações** [Settings] › **Plugins da comunidade** [Community plugins]: turn off
   **Git**.
2. Expected: the Git status bar item goes away. Leave it off until "Clean up the vault" at the
   end.

### 2. Back up

1. Commit the vault as it is now:

   ```bash
   cd ~/projects/website
   git add -A escrita
   git commit -m "escrita: antes do teste 0.9"
   ```

   Don't push. This commit is the restore point.
2. Keep a copy of the installed plugin, as for earlier versions (`backup-0.7` is already there):

   ```bash
   cd ~/projects/website/escrita/.obsidian/plugins/escrita
   mkdir -p backup-before-0.9
   cp main.js manifest.json styles.css data.json backup-before-0.9/
   ```

   To go back: copy those four files back and restart Obsidian.

### 3. Write down today's numbers

These are for the no-regression checks later. With the build you have now:

1. Open `Universo/Personagens/Willian.md` in Live Preview. Write down the **Aparece em**
   [Appears in] line: works and mentions.
2. Open the universe panel (**Abrir o painel do universo** [Open the universe panel]), tab
   **Obras** [Works]. Write down how many works it lists and under which forms.
3. Note how long Obsidian takes to start and to show the file explorer counts. A rough feel
   is enough.

### 4. Build and install

`package.json` has no script that copies into a vault (`npm run dev` only builds in watch
mode), so build and copy by hand. Close Obsidian first.

```bash
cd ~/projects/escrita
git switch 0.9
npm run build
cp main.js manifest.json styles.css ~/projects/website/escrita/.obsidian/plugins/escrita/
```

- The build's `manifest.json` still says `0.8.0`. The version changes at release. Your
  installed one says `0.7.0`, so Obsidian's plugin list will show `0.8.0` after the copy.
- To check that 0.9 loaded: the export window has an **EPUB** format, and the command palette
  has **Ler o livro** [Read the book].
- On its first load, 0.9 adds its new settings to `data.json` (`lensRulesOn`, `notNames`,
  `coverProperty`, `epubSceneBreak`, `collectionProperty`, `readPosition`). That's expected.

### 5. Make the test notes

All test notes go in two folders, `Contos/Teste 0.9/` and `Romances/Teste 0.9/`, so the
clean-up is two deletions. Both sit in your "folders in the universe" (`Contos`, `Romances`).

Run this with **Obsidian closed**. Notes created while it's open get your draft status from
"New notes start as draft", and the dedication and epigraph notes would then show up as works.

```bash
magick -size 1600x2400 xc:'#3d5a6c' -gravity center -fill white -pointsize 160 \
  -annotate +0+0 'Livro Longo' ~/projects/website/escrita/Anexos/capa-teste.jpg

python3 -I - <<'EOF'
import os, random, sys

vault = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/projects/website/escrita")
rng = random.Random(9)

def write(rel, text):
    path = os.path.join(vault, rel)
    if os.path.exists(path):
        print("exists, left alone:", rel)
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote", rel)

# Three contos for unlinked mentions, the names rule and collections.
write("Contos/Teste 0.9/O farol apagado.md", """---
status: rascunho
---
A porta rangeu e Willian não olhou para trás.

Lá fora, o vento. Ninguém esperava que Willian voltasse tão cedo.

O barco de Almeida estava no cais, e o filho de Almeida dormia na proa.

Disseram que Almeida tinha visto Dona Zefa no mercado, e que Dona Zefa ria alto.

A casa de Almeida ficava longe do Rio Pequeno, mas a de Dona Zefa não.

Na véspera do Natal, Almeida trouxe peixe. Até no Natal ela cozinhava para Dona Zefa, como em todo Natal.

O chapéu de Almeida pingava. No Natal anterior, Dona Zefa tinha dito que o Natal era triste, e Dona Zefa nunca mentia. Era a noite de Natal outra vez.

Depois Teodoro disse que ia chover. Depois Teodoro foi embora.

| Quem | Onde |
|---|---|
| o velho Willian | no cais |

Li sobre [o barco do Willian](https://example.org/barco) num jornal antigo.
""")

write("Contos/Teste 0.9/Maré.md", """---
status: rascunho
---
A maré subiu cedo. A água do Rio Pequeno chegava salgada até a ponte.

Ela esperou o barco de Almeida até a noite.
""")

write("Contos/Teste 0.9/Sal.md", """---
status: rascunho
---
O sal secava nas pedras, e [[Willian]] contava os sacos.

No fim da tarde, Willian voltou para casa sem dizer nada.
""")

# The long book: G0d, Read the book, serial publishing, EPUB.
words = ("casa mar porta vento noite chuva rua janela barco ponte pedra caminho tempo "
         "mesa carta lume fogo sombra cidade campo rio areia sal voz silêncio mão olhos "
         "manhã tarde inverno verão cheiro sono memória escada quarto porão cais feira").split()
verbs = ("olhou disse esperou voltou abriu fechou contou ouviu guardou levou trouxe "
         "pensou lembrou subiu desceu chamou").split()

def sentence():
    n = rng.randint(8, 18)
    body = " ".join(rng.choice(words if i % 3 else verbs) for i in range(n))
    return "Ela " + body + "."

def paragraph():
    if rng.random() < 0.15:
        return "— " + sentence()[4:].capitalize()
    return " ".join(sentence() for _ in range(rng.randint(4, 7)))

def chapter(n):
    parts = []
    for scene in range(4):
        parts.append("\n\n".join(paragraph() for _ in range(11)))
    body = "\n\n---\n\n".join(parts)
    extra = ""
    if n == 2:
        extra = "%% beat: ela encontra a carta %%\nA carta estava debaixo da porta, molhada.\n\n%% nota só para mim: rever o tom %%\n\n"
    if n == 3:
        extra = "No cais, Willian esperava o barco. Ninguém falou com Willian naquela noite.\n\n"
    return "---\nstatus: rascunho\ndate:\n---\n" + extra + body + "\n"

book = "Romances/Teste 0.9"
write(book + "/Livro Longo.md", """---
dedication: "[[Dedicatória 0.9]]"
epigraph: "[[Epígrafe 0.9]]"
cover: "[[capa-teste.jpg]]"
---
""")
write(book + "/Dedicatória 0.9.md", "Para quem lê até o fim.\n")
write(book + "/Epígrafe 0.9.md", "> O mar não tem caminhos, só travessias.\n")
write(book + "/Livro Longo/Capítulos/00 Prólogo.md", "---\nstatus: rascunho\n---\n" + "\n\n".join(paragraph() for _ in range(6)) + "\n")
titles = ["A chegada", "A carta", "O cais", "A escada", "O porão", "A feira", "A ponte", "O inverno",
          "A janela", "O sal", "A voz", "O quarto", "A sombra", "O campo", "A areia", "O lume",
          "A cidade", "O sono", "A memória", "O rio", "A tarde", "O verão", "A mesa", "O caminho",
          "A pedra", "O fogo", "A rua", "O cheiro", "A manhã", "A travessia"]
for i, title in enumerate(titles, start=1):
    write(f"{book}/Livro Longo/Capítulos/{i:02d} {title}.md", chapter(i))
write(book + "/Livro Longo/Capítulos/31 Notas soltas.md", "---\nstatus: rascunho\ncompile: false\n---\nNotas que não entram no livro.\n")
write(book + "/Livro Vazio.md", "---\nstatus: rascunho\n---\n")
os.makedirs(os.path.join(vault, book, "Livro Vazio", "Capítulos"), exist_ok=True)
print("done")
EOF
```

What it makes:

| Path | For |
|---|---|
| `Contos/Teste 0.9/O farol apagado.md` | Unlinked mentions of Willian (3 rows, one in a table, one inside a web link that must not be listed); the names rule (Almeida, Dona Zefa and Natal 6 times each; Rio Pequeno once; Teodoro only at sentence starts) |
| `Contos/Teste 0.9/Maré.md` | Rio Pequeno and Almeida in a second work |
| `Contos/Teste 0.9/Sal.md` | Links Willian once and names him once more: no rows expected |
| `Romances/Teste 0.9/Livro Longo.md` | A book of 30 chapters, about 90,000 words, with a prologue (`00`), a chapter left out (`31 Notas soltas`, `compile: false`), a dedication, an epigraph and a cover. Chapter 02 has a beat and a comment; chapter 03 names Willian twice |
| `Romances/Teste 0.9/Livro Vazio.md` | A book with an empty chapters folder |
| `Anexos/capa-teste.jpg` | The cover |

The script never overwrites a file; it prints "exists, left alone" instead.

Then start Obsidian. Expected: the two folders show in the file explorer with word counts.

### 6. Things already noticed in your vault

These are not 0.9 changes, but they affect what you'll see:

- **The revision stage word is `revisao`, without the accent.** Settings › Estágios [Stages]
  has `revisao`, while your status colours and CONTEXT.md say `revisão`. A note with
  `status: revisão` is not in the revision stage. Fix the word if that's not what you meant.
- **There is no `Universo.md`.** The universe note setting is `Universo.md`, and the folder
  `Universo/` exists without it. If the panel says the universe note doesn't exist, click
  **Criar** [Create].
- **Your vault writes Markdown links** (**Usar [[Wikilinks]]** [Use [[Wikilinks]]] is off).
  **Criar link** follows that setting, so in your vault it writes `[Willian](…/Willian.md)`, the
  path as Obsidian writes your other links. **Criar uma coleção…** always writes wikilinks in
  `contents`, because Obsidian follows renames in properties only through wikilinks. The
  wikilink form is checked in step 14 of Unlinked mentions.

## Unlinked mentions

Board 29. Guide: [The world, section 11](guide/en/the-world.md#11-unlinked-mentions).

1. Open `Contos/Teste 0.9/O farol apagado.md`. Open the universe panel, tab **Obras** [Works].
   - Expected: under the active work, a section **Menções sem link** [Unlinked mentions] with
     the note's name and a count of 3.
   - Expected: three rows for Willian: "linha 4", "linha 6" and "linha 22" (the table row).
     Each row has the entry's name, the line, the sentence with "Willian" marked, and **Criar
     link** [Create link].
   - Expected: no row for "o barco do Willian", which is inside a web link.
2. Click the sentence of the "linha 6" row.
   - Expected: the note scrolls to line 6. Nothing is selected and nothing changes.
3. **Edge case, a changed line.** In the editor, change line 6 (add a word anywhere on it, far
   from "Willian"). Don't touch the panel yet. Then click **Criar link** on the "linha 6" row.
   - Expected: a notice: "A linha mudou desde que a lista foi feita. Nada foi escrito; a lista
     foi atualizada." The note is unchanged. The list refreshes and shows the new line.
4. **Edge case, a table row.** Click **Criar link** on the "linha 22" row.
   - Expected: the row becomes `| o velho [Willian](…/Willian.md) | no cais |`, a Markdown link
     because your vault writes them. The table still shows two columns in Live Preview and
     Reading view, and the link opens Willian's note.
   - Expected: a notice "Link criado na linha 22: [Willian](…/Willian.md)".
   - Expected: every other row goes. The note now links Willian, and one link per note is
     enough. The section says "Nenhuma menção sem link nesta nota." [No unlinked mentions in
     this note.]
5. Press Ctrl+Z in the editor.
   - Expected: one undo removes the link. The rows come back within a few seconds.
6. **Edge case, an alias in a table.** Add `aliases: [Will]` to Willian's note. In the farol
   table, change the cell to `o velho Will`. Click **Criar link** on that row.
   - Expected: `[Will](…/Willian.md)`. A Markdown link has no alias pipe, so nothing is escaped
     and the table keeps two columns. Undo it and keep the alias for steps 13 and 14.
7. Click **Criar link** on the "linha 4" row.
   - Expected: only "Willian" on line 4 changes, to `[Willian](…/Willian.md)`. The punctuation
     and the other lines stay as they were. Undo it.
8. Open `Contos/Teste 0.9/Sal.md`.
   - Expected: "Nenhuma menção sem link nesta nota.", because the note already links Willian.
9. **A chapter (Q22).** Open `Romances/Teste 0.9/Livro Longo/Capítulos/03 O cais.md`.
   - Expected: two rows for Willian, chapter 03 only. Open chapter 01: no rows.
10. Open `Textos/Noite.md` (it has `universe: false`).
    - Expected: no unlinked section at all.
11. Restart Obsidian with the farol note open and look at the panel at once.
    - Expected: "contando…" [counting…] for a moment, then the rows, without the rest of the
      panel flickering.
12. **Per-book mode (D1).** On the Features page set **Universo compartilhado** [Shared
    universe] to **Por livro** [Per book]. Open chapter 03.
    - Expected: the unlinked section sits at the bottom of the **Entradas** [Entries] tab.
      Willian lives in the shared universe, so this book may have no entries and no rows; the
      point is where the section sits. Set the mode back to **Universo** [Universe].
13. **Edge case, a pipe in the text.** Make Willian's aliases `aliases: [Will, Will Bill]`. On a
    new line at the end of the farol note, write `Ontem Will|Bill chegou.` and wait for the rows.
    - If no row lists "Will|Bill" (only "Will", or nothing), the matcher doesn't read across a
      pipe, and the case can't reach **Criar link**. Note it and go to step 14.
    - If a row lists it, click **Criar link**. Expected in your vault (Markdown links):
      `[Will|Bill](…/Willian.md)`, which reads fine outside a table. Undo it.
14. **A vault with wikilinks.** Settings › **Arquivos e links** [Files and links]: turn **Usar
    [[Wikilinks]]** [Use [[Wikilinks]]] on.
    - **Criar link** on the "linha 4" row. Expected: `[[Willian]]`. Undo it.
    - In the table, with the cell `o velho Will` from step 6: expected `[[Willian\|Will]]`, with
      the backslash, and two columns. Undo it.
    - If step 13 listed "Will|Bill", click **Criar link** on it. Expected: a notice "Este texto
      não pode ser vinculado aqui. Nada foi escrito." [This text can't be linked here. Nothing
      was written.], not "A linha mudou…". The note is unchanged.
    - Turn **Usar [[Wikilinks]]** off again, remove the `Will|Bill` line and the alias, and put
      the table cell back to `o velho Willian`.

## Names without an entry

Board 30. Guide: [The world, "Names without an entry"](guide/en/the-world.md#names-without-an-entry).

1. Open `O farol apagado.md` and run **Ativar ou desativar a lente de revisão** [Toggle
   revision lens].
   - Expected: the lens marks as before. Nothing is marked as a name without an entry, and the
     lens panel has no "Nomes sem entrada" row. The rule is off by default.
2. **Configurações** › Escrita › **Revisão** [Revision], under **Regras** [Rules]: turn on
   **Nomes sem entrada** [Names without an entry].
   - Expected: a green wavy underline under Almeida, Dona Zefa and Natal, mid-sentence. Never
     under Willian (an entry), Teodoro (only at sentence starts) or Onde (once, in the table
     header).
   - Expected in the lens panel: a row **Nomes sem entrada** and a list: each name with "6 na
     nota" [6 in the note] and a works count, plus **Criar entrada** [Create entry] and
     **Dispensar** [Dismiss].
3. Wait a few seconds.
   - Expected: "contando nas outras obras…" [counting in the other works…] may show first. Then
     Rio Pequeno is marked too (once in this note, but in 2 works) and joins the list with
     "1 na nota · 2 obras". Almeida shows "2 obras".
4. Click "Almeida" in the list several times.
   - Expected: each click goes to the next Almeida in the note. The lens's step buttons
     **Nome sem entrada anterior** and **Próximo nome sem entrada** [Previous/Next name without
     an entry] walk through all the marked names.
5. Click **Criar entrada** on "Dona Zefa".
   - Expected: the new entry window with "Dona Zefa" filled in (D8), editable. Your note is
     not touched. Create it as a Personagem.
   - Expected: the note opens to the side; the Dona Zefa marks go within a few seconds.
6. Click **Dispensar** on "Natal".
   - Expected: a notice: "“Natal” foi para “Não são nomes” e não será mais marcado." The Natal
     marks go.
   - Expected: Settings › Revisão › **Não são nomes** [Not names] now has the line `Natal`.
7. Delete the `Natal` line in **Não são nomes** and leave the field.
   - Expected: Natal is marked again.
8. Turn the rule off in the settings.
   - Expected: no name marks, no names list. Turn it back on for the next sections.
9. **Universe off.** Set **Universo compartilhado** to **Desligado** [Off] on the Features page.
   - Expected: no name marks. The lens panel says "Precisa do universo ligado." [Needs the
     universe on.] with **Abrir recursos** [Open Features]. The button opens the Features page.
     Set the mode back to **Universo**.
10. Open `Textos/Noite.md` with the lens on.
    - Expected: no names-rule marks and no "contando…" that stays forever.

## EPUB

Board 31. Guide: [Publishing, "Export an EPUB"](guide/en/publishing.md#export-an-epub).

1. Open `Romances/Teste 0.9/Livro Longo.md` and run **Exportar…** [Export…].
   - Expected: the window **Exportar “Livro Longo”**, with **Formato** [Format] offering
     **DOCX**, **Markdown** and **EPUB**.
2. Choose **EPUB**, template **pt-BR**, **Capítulos** [Chapters] **Todos (n)** [All (n)].
   - Expected: the line under the options says "Uma coluna de leitura: capa, folha de rosto,
     sumário e uma página por capítulo. Sem contagem de palavras." and names
     `Escrita/Exports/Livro Longo (pt-BR).epub` (D2: the template is in the name).
   - Expected: `31 Notas soltas` is listed as always left out (`compile: false`).
   - Expected: no **Antes de enviar** [Before you send] box, and the button reads **Exportar**.
3. Press **Prévia** [Preview].
   - Expected, in this order: the cover, the title page, the dedication, the epigraph, the
     contents ("Sumário"), then the chapters. "Prólogo" alone, then "Capítulo 1 — A chegada"
     and so on. Scene breaks show as `* * *`, never at a chapter's start or end. Chapter 02
     shows no beat and no comment.
   - Click a paragraph: the chapter opens at that line. **Voltar** [Back] returns.
4. Press **Exportar**.
   - Expected: a notice "Exportado: Livro Longo (pt-BR).epub." with **Abrir a pasta**.
5. Open the file in an ebook reader:

   ```bash
   ebook-viewer ~/projects/website/escrita/Escrita/Exports/"Livro Longo (pt-BR).epub"
   ```

   (Calibre's viewer. On a Mac or an iPhone, Apple Books works too.)
   - Expected: the cover image first; the title page with title and author; the dedication and
     epigraph pages; the table of contents panel lists Prólogo and Capítulo 1 to 30, and each
     entry jumps to its chapter; the scene breaks are centred `* * *`; dialogue dashes are kept;
     the reader's language is Portuguese.
   - Optional, a validity check of your own file:

     ```bash
     java -jar ~/.cache/escrita-epubcheck/epubcheck-5.4.0/epubcheck.jar \
       ~/projects/website/escrita/Escrita/Exports/"Livro Longo (pt-BR).epub"
     ```

     Expected: "No errors or warnings detected".
6. **Export again.** Open the export window again.
   - Expected: "Última exportação: EPUB · pt-BR · N capítulos · …" with the file name as a
     link. Run **Exportar de novo** [Export again] from the palette.
   - Expected: it writes at once, no window, the same file name. The notice says "Exportado".
7. **Shunn.** Export again with the **Shunn** template.
   - Expected: `Livro Longo (Shunn).epub`, beside the pt-BR one; "Contents" and "Chapter 1:
     A chegada" inside; the reader's language is English.
8. **Edge case, a missing cover.** In `Livro Longo.md`, change the cover to
   `cover: "[[capa-que-nao-existe.jpg]]"`. Open the export window with EPUB.
   - Expected: **Antes de enviar** says "Capa não encontrada ou ilegível:
     [[capa-que-nao-existe.jpg]]. O EPUB sai sem capa", and the button reads **Exportar mesmo
     assim** [Export anyway]. Export: the EPUB has no cover and opens fine.
9. **Edge case, not an image.** Point the cover at a Markdown note (`cover: "[[Maré]]"`).
   - Expected: the same warning. Then remove the `cover` line entirely.
   - Expected: no cover, no warning, the button reads **Exportar**.
   - Put `cover: "[[capa-teste.jpg]]"` back.
10. **Edge case, a plain path.** Try `cover: Anexos/capa-teste.jpg`.
    - Expected: it works like the link.
11. **A conto with its own cover (D3).** Add `cover: "[[capa-teste.jpg]]"` to `Maré.md` and
    export it to EPUB.
    - Expected: `Maré (pt-BR).epub` with the cover, a title page and a contents page with one
      entry. Remove the property afterwards.
12. **The scene break setting.** Settings › Exportação [Export] › **Separador de cena no EPUB**
    [EPUB scene break]: type `❦`. Export again.
    - Expected: `❦` between scenes. Empty the field and leave it: it goes back to `* * *`.
13. **The file already exists.** Export the same EPUB again from the window (not Export again).
    - Expected: **O arquivo já existe** [The file already exists] with **Cancelar**, **Manter os
      dois** [Keep both] and **Substituir** [Replace], as for DOCX.

## Collections

Board 34. Guide: [Publishing, "Export a collection of stories"](guide/en/publishing.md#export-a-collection-of-stories).

1. In the file explorer, click `Sal.md`, then Ctrl-click `O farol apagado.md` and `Maré.md`.
   Right-click one of them.
   - Expected: **Criar uma coleção…** [Create a collection…] in the menu.
2. **Edge case, a mixed selection.** Add `Anexos/capa-teste.jpg` to the selection and
   right-click.
   - Expected: no **Criar uma coleção…**. Select only one note: no item either.
3. Back to the three contos. Choose **Criar uma coleção…**.
   - Expected: a small window **Criar uma coleção** with an empty **Título** [Title] and the
     line "3 contos, nesta ordem, vão na propriedade “contents”." **Criar** [Create] is greyed
     out until you type.
4. Type `Marés e outros contos` and press Enter.
   - Expected: `Contos/Teste 0.9/Marés e outros contos.md` opens in the editor with:

     ```
     ---
     contents:
       - "[[Maré]]"
       - "[[O farol apagado]]"
       - "[[Sal]]"
     ---
     ```

     The order is the file explorer's (A to Z here), not the order you clicked. The links follow the vault's
     "New link format" setting (Files and links); with the default, "Shortest path when
     possible", they read as above.
   - Expected (fixed in `763f532`): wait two seconds; no `status` appears. "New notes start as
     draft" skips any note with the `contents` property (in any case, `Contents:` too), even an empty one. The collection is
     not in the **Obras** tab or on your home note.
   - **A collection with a status (Q27).** Add `status: rascunho` by hand. Expected: it shows
     in **Obras** as a work, with almost no words. Remove the line: it goes again.
5. **Edge case, a name clash.** Run **Criar uma coleção…** again on the same three contos with
   the same title.
   - Expected: a second note, `Marés e outros contos 1.md` or similar. The first is never
     overwritten. Delete the second.
6. Open the collection note and run **Exportar…**.
   - Expected: the line "Coleção: 3 contos" [Collection: 3 stories], a **Contos** [Stories] row
     instead of Capítulos (Todos, Do … ao …, Escolher…), and no **O quê** [What] row.
7. Choose **DOCX**, template **pt-BR**, and export. Open it:

   ```bash
   libreoffice ~/projects/website/escrita/Escrita/Exports/"Marés e outros contos (pt-BR).docx"
   ```

   - Expected: a title page of its own with the rounded count; then each conto on a new page
     under its title alone (no "Capítulo N"); the running header from page 2; `#` between
     scenes; "FIM" at the end. Word opens it the same way, if you have it.
8. Export the collection as **EPUB** and open it in `ebook-viewer`.
   - Expected: "Sumário" lists Maré, O farol apagado and Sal. Each starts on its own page
     under its title alone.
9. Add `dedication: "[[Dedicatória 0.9]]"` and `cover: "[[capa-teste.jpg]]"` to the
   collection note and export the EPUB again.
   - Expected: the cover and the dedication page, from the collection note.
10. **Edge case, a dangling link.** Add a line `- "[[Conto que não existe]]"` to `contents`.
    Open the export window.
    - Expected: "Coleção: 3 contos"; **Antes de enviar** says "Conto não encontrado: Conto que
      não existe. Fica de fora."; the button reads **Exportar mesmo assim**. Export: the
      three real contos only.
11. **Edge case, a reordered list.** Move `Sal` to the top of `contents` and export.
    - Expected: Sal comes first in the file.
12. **Stories row, picked.** Choose **Escolher…** and untick Maré.
    - Expected: "2 de 3 escolhidos"; the file has two contos.
13. **Stories row, a range.** Choose **Do … ao …** [From … to …] and pick the 2nd to the 3rd.
    - Expected: the range is counted in the `contents` order (Sal first after step 11), not by
      any number in the file names. The file has those two contos, in that order. Set the row
      back to **Todos**.
14. **Rename a conto.** Rename `Sal.md` to `Sal grosso.md` in the explorer.
    - Expected: Obsidian updates the link in `contents`; the collection still exports three
      contos.

## Publish next chapter

Board 32. Guide: [Publishing, "Publish a book one chapter at a time"](guide/en/publishing.md#publish-a-book-one-chapter-at-a-time).

1. Open `Livro Longo.md` and run **Abrir esboço** [Open outline].
   - Expected: no serial line and no **Publicar o próximo** [Publish next] button, because no
     chapter is published (board 32d).
2. Run **Publicar o próximo capítulo** [Publish next chapter].
   - Expected: chapter `01 A chegada` opens, then the publish window. It lists "Todos os
     capítulos anteriores estão publicados" [Every earlier chapter is published].
   - Press **Publicar** [Publish].
   - Expected: chapter 01 gets `status: publicado` and today's `date`.
3. Look at the outline header.
   - Expected: a line "Próximo: 02 A carta · último publicado em 7 out" (today's date, day
     first) and a **Publicar o próximo** button.
4. Press **Publicar o próximo** twice more, publishing 02 and 03.
   - Expected: each opens the next chapter first. The line ends at "Próximo: 04 A escada".
5. **Edge case, a gap.** Open `05 O porão` and run **Publicar esta nota** [Publish this note].
   - Expected: a warning "Capítulo anterior não publicado: 04. Quem lê pularia um capítulo."
     It is a warning: the button is still **Publicar**, with no "mesmo assim" tick. Publish.
   - Expected in the header: "Lacuna: 04 · Próximo: 04 A escada · último publicado em 7 out"
     (the gap first, board 32b).
6. Press **Publicar o próximo**.
   - Expected: it opens 04, the gap, and its check says every earlier chapter is published.
     Publish it. The gap goes; the line says "Próximo: 06 A feira".
7. **Edge case, a future date.** Press **Publicar o próximo** (chapter 06) and pick a date next
   week in the window.
   - Expected: the line shows that date as written ("último publicado em 14 out"). Escrita
     schedules nothing.
8. **Edge case, no date (Q23).** In chapter 06, empty the `date` property by hand.
   - Expected: "último publicado: 06 A feira", with no date. The line doesn't borrow the date of
     05.
9. **Outside a book.** Open `Maré.md` and look for **Publicar o próximo capítulo** in the
   palette.
   - Expected: not offered. The vault has three books (Livro Teste, Livro Longo, Livro Vazio),
     so the "only book" fallback doesn't apply.
10. **Out of the sequence.** Publish `00 Prólogo`.
    - Expected: nothing changes in the line. `31 Notas soltas` (`compile: false`) isn't in the
      sequence either.
11. Optional, slow: set chapters 07 to 30 to `publicado` by hand.
    - Expected: "Todos os capítulos estão publicados" [Every chapter is published]; the command
      says "Todos os capítulos do livro estão publicados."

## Read the book

Board 33. Guide: [Writing, "Read the book"](guide/en/writing.md#read-the-book).

1. Open `Livro Longo.md` and run **Ler o livro** [Read the book].
   - Expected: a new tab "Lendo: Livro Longo" [Reading: Livro Longo]. "Prólogo" first, then
     "Capítulo 1 — A chegada" (the export's headings, D7). `31 Notas soltas` is not there.
     Chapter 02 shows no beat and no comment. Scene breaks show as a dividing line. No chapter rail and
     no progress bar (D6).
   - The outline's header has a **Ler o livro** button that does the same.
2. Try to type in the tab.
   - Expected: nothing changes; it is read-only.
3. Click a paragraph in the middle of chapter 05.
   - Expected: chapter 05 opens in a new tab with the cursor on that paragraph's line.
4. Back in the reading tab, scroll to the middle of chapter 12. Close the tab. Run **Ler o
   livro** again.
   - Expected: it opens at the same place in chapter 12.
5. Run **Ler o livro** again while the tab is open.
   - Expected: it goes to the open tab instead of opening a second one.
6. **Edge case, renaming a chapter while reading.** With the reading tab at chapter 12, rename
   `12 O quarto.md` to `12 O quarto escuro.md` in the explorer.
   - Expected: the tab redraws and stays at the same place in chapter 12 (the position may be up
     to 0.6 s old, so a line or two off is fine). Close and reopen: still there.
7. **Edge case, renaming the book.** Rename `Livro Longo.md` and its folder (or the folder
   `Romances/Teste 0.9` that holds them).
   - Expected: the reading tab follows the book; no "Este livro não está mais no cofre." [This
     book is no longer in the vault.] Rename it back.
8. **Editing while reading.** Open chapter 12 in a split beside the reading tab. Add a sentence
   at the top of the chapter.
   - Expected: about a second after you stop typing, the reading tab shows the new sentence, and
     the text you were looking at doesn't jump.
9. **Deleting a chapter.** Read chapter 30, close the tab, delete `30 A travessia.md` (it goes
   to the trash), and open **Ler o livro**.
   - Expected: it opens at the top (the position was in the deleted chapter). Restore the file
     from `.trash`.
10. **An empty book.** Open `Livro Vazio.md` and run **Ler o livro**.
    - Expected: "Este livro ainda não tem capítulos para ler." with **Criar o primeiro
      capítulo** [Create the first chapter]. Click it: a chapter is made and opens in the editor.
11. **Outside a book.** Open `Maré.md`.
    - Expected: **Ler o livro** is not in the palette.

## Scope and no-regression checks

IMPROVEMENTS 9 moved scope into the classifier. Nothing should look different.

1. Open `Willian.md` in Live Preview.
   - Expected: the **Aparece em** numbers you wrote down, plus three works from the test notes:
     O farol apagado, Sal and Livro Longo (chapter 03). Maré doesn't name him.
2. The **Obras** tab.
   - Expected: what you wrote down, plus the test contos and the two test books.
     `Textos/Noite.md` is not there (`universe: false`).
3. In `Textos/Noite.md`, remove `universe: "false"`.
   - Expected: it joins the Works tab within a few seconds, without a restart. Put it back: it
     leaves.
4. Move `Maré.md` to `Ideias/` (tracked, not in the universe).
   - Expected: it leaves the Works tab and Willian's counts don't change. Move it back.
5. Settings › Universo: remove `Textos` from **Pastas no universo** [Folders in the universe],
   leave the field, then add it back.
   - Expected: the Works tab updates each time, once, with no freeze.
6. Open the outline of `Livro Teste`. Chapter 02 has `pov: Willian`.
   - Expected: its POV chip's menu has **Abrir a entrada** [Open the entry], as before.
7. File explorer.
   - Expected: counts and stage dots as before. Startup feels the same as in step 3 of "Before
     you start".
8. Typing in a long chapter of Livro Longo with the lens off.
   - Expected: no lag.

## Feature switches on and off

**Configurações** › Escrita › **Recursos** [Features]. Turn each one off, check, turn it back
on, check that nothing was lost.

| Switch | Off: expected | On again: expected |
|---|---|---|
| **Lente de revisão** [Revision lens] | No lens, no names rule; "Não são nomes" hides from the settings | The rule is still on; "Não são nomes" kept its lines |
| **Universo compartilhado** → **Desligado** | No universe panel, no unlinked section; the names rule shows "Precisa do universo ligado." | Panel and rows come back |
| **Exportar** [Export] | No **Exportar…**, no **Exportar de novo**, no **Criar uma coleção…** in the explorer menu; the collection note stays an ordinary note | "Última exportação: EPUB…" is still known; **Exportar de novo** writes the same file |
| **Checagem de publicação** [Publish check] | No serial line, no **Publicar o próximo** button, no **Publicar o próximo capítulo** command | Line and button come back; the outline redraws |
| **Esboço e beats fantasmas** [Outline and ghost beats] | No **Ler o livro** command; an open reading tab closes | **Ler o livro** opens at the saved place |

- Expected (fixed in `763f532`): the **Exportar** switch's description reads "DOCX, EPUB e
  Markdown no formato de manuscrito, para uma nota, um livro ou uma coleção."
- While a feature is off, rename a chapter you have a reading position in (outline off) or a
  work you exported (export off). Turn the feature on: the position and "Export again" follow
  the new name.

## Open gates to check by eye

### G0d: "Read the book" on a long book

Livro Longo has 30 chapters and about 90,000 words. Open the developer tools with
Ctrl+Shift+I.

1. **Time to the first chapter.** Open the **Performance** tab and press record. Run **Ler o
   livro** from the palette. Stop when the first text shows.
   - Read the time from the command to the first frame with text, in the screenshot strip.
   - The plan sets no number for this. Proposed pass: under 500 ms. Write down what you got.
2. **The longest block while scrolling.** In the **Console** tab, paste:

   ```js
   window.__lt = [];
   new PerformanceObserver((l) => l.getEntries().forEach((e) => __lt.push(Math.round(e.duration))))
     .observe({ type: "longtask" });
   ```

   Then drag the scrollbar of the reading tab from top to bottom in about five seconds, and
   back. Type `[__lt.length, Math.max(0, ...__lt)]` in the console.
   - This catches only tasks of 50 ms or more. `[0, 0]` means none.
   - For the finer number, record in **Performance** while scrolling and find the widest task
     in the **Main** track. The plan's bar is 0.8's 20 ms.
   - Expected: scrolling feels smooth; chapters arrive as you reach them, with their headings
     already in place and no jump in what you are reading.
3. Write both numbers in PLAN-0.9.md under the release review result, as G0d's result.

### 0.7's G0d: "Aparece em" across re-renders

0.7's G0d asked whether a Reading-view post-processor could draw "Aparece em" reliably across
re-renders. The spike plugin for it is gone. 0.9 still ships no post-processor: Reading view
shows no section, and the panel has the list. Check what ships:

1. Open `Willian.md` in Live Preview.
   - Expected: one **Aparece em** section at the end.
2. Switch to Reading view (Ctrl+E).
   - Expected: no section, no error, nothing doubled.
3. Switch back and forth five times.
   - Expected: exactly one section each time in Live Preview.
4. Open the same note in a split: Live Preview left, Reading view right. Type at the end of the
   note on the left.
   - Expected: the left keeps one section that follows the text; the right stays clean.
5. Open a long entry (or paste 200 lines into a test entry) and repeat 2 to 4.
6. Decide: close 0.7's G0d as "Reading view shows the panel only", or keep it open for 1.0
   and rebuild the spike.

### Visual match against the design canvas

Open the canvas at https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6, row "0.9 · O livro e o
seu mundo". Compare each screen with its board. Small spacing differences are fine; a missing
element, a different word or a different order is not.

| Board | Screen | Known, approved differences |
|---|---|---|
| 29 · Menções sem link | The unlinked section (a, b, c, d, e, f) | The section shows the note's name, not the work card. In per-book mode it sits in Entradas (D1) |
| 30 · Lente: nomes sem entrada | Settings (a), editor marks (b), panel list (c), universe off (d), counting (e), rule off (f), notices | None expected |
| 31 · Exportar: EPUB e capa | The modal with EPUB (a), the warning (b), the preview (c), Export again (d), a conto (e) | File names carry the template (D2). The button says "Exportar mesmo assim" (D4). A conto can have a cover (D3) |
| 32 · Esboço: publicar o próximo capítulo | Header line (a, b), the check with the gap (c), no published chapter (d), no date (e), future date (f) | The chapter label is "04 A escada", not the export heading |
| 33 · Ler o livro | Reading (a), hover (b), loading (c), how to open (d), empty book (e) | No chapter rail and no progress bar (D6) |
| 34 · Coleções | Explorer menu (a), title (b), the note (c), export (d), warning (e), EPUB preview (f) | None expected |

0.7's visual check (PLAN-0.7.md, task 5.2) is folded in here: also compare boards 21 and 22
(the Features page), 23 and 24 ("Aparece em", the panel, names in the editor) and 25 (the
outline's POV, filters and chapter targets).

### Light and dark theme

Your setup is the Typewriter theme with base colour "system", plus the `escrita` CSS snippet.

1. **Configurações** › **Aparência** [Appearance]: set the base colour scheme to dark, then
   light.
2. In each, look at: the unlinked section, the names marks and list, the export window with
   EPUB and the warning, the outline's serial line, the reading tab, the collection window.
   - Expected: readable text, visible marks, buttons at least 32 px tall.
   - Expected: the export preview's page stays light in both themes, on purpose.
3. Switch to Obsidian's default theme once and repeat a quick look, since other writers will use
   it.

## Points you may want to change

Every judgment call made while building 0.9, from the Wave 1, Wave 2 and release review
results and the follow-ups (`a96a68d`). Each says what was chosen, the alternative, and where it
lives. Some were already settled by the follow-ups; they are listed so you know.

### Unlinked mentions

| Point | Chosen | Alternative | Where |
|---|---|---|---|
| Link form | Follows "Use [[Wikilinks]]" through Obsidian's `generateMarkdownLink`: `[text](path)` in your vault; `[[Entry\|text]]`, or `[[text]]` when the text is the name, with wikilinks (fixed in `763f532`) | Always a wikilink | `src/universe/unlinked-link.ts` (`linkFromGenerated`), `src/universe/view-unlinked.ts` (`createLink`) |
| One link per note | A note that links an entry anywhere lists none of its other mentions | List every unlinked mention | `src/universe/unlinked.ts` (`unlinkedIn`) |
| Books | The active chapter only (Q22) | The whole book | `src/universe/index.ts` (`unlinkedFor`) |
| Where rows come from | The note's live text, with the mentions index only saying when it's ready | The stored mentions (Q17), which lag about 4 s behind edits | `src/universe/index.ts` (`unlinkedFor`) |
| Section header | The note's name | The work card of board 29 | `src/universe/view-unlinked.ts` |
| Clicking the excerpt | Goes to the line, selects nothing | Select the word | `src/universe/view-unlinked.ts` |
| What "changed" means | The whole line must be as listed, not only the word | Check only the word | `src/universe/unlinked-link.ts` (`linkPlan`) |
| Text that can't be linked | Brackets or a line break, or a pipe with wikilinks: its own notice, "Este texto não pode ser vinculado aqui." (fixed in `763f532`). A pipe in a Markdown link is allowed | Refuse a pipe in both forms | `src/universe/unlinked-link.ts` (`linkableText`), `src/universe/view-unlinked.ts` |
| In a table row | A wikilink's alias pipe is written `\|`; so is every pipe in a Markdown link's text | — (Obsidian requires it) | `src/universe/unlinked-link.ts` |
| Per-book mode | The section sits at the bottom of Entradas (D1) | A tab of its own | `src/universe/view.ts` |

### Names without an entry

| Point | Chosen | Alternative | Where |
|---|---|---|---|
| Thresholds | 5 times in the note, or 2 works | Higher or lower; a setting | `src/lens/rules-names.ts` (`NEW_NAME_IN_NOTE`, `NEW_NAME_IN_WORKS`) |
| Wait after an edit | The cross-work index notifies 3 s after a change | Shorter | `src/universe/names-index.ts` (`NAMES_NOTIFY_MS`) |
| The names list | Always open, under the rule's row, by count | Collapsible | `src/lens/view.ts` |
| Sentence starts | Skipped. A line break starts a sentence, so a name opening a line never counts | Count a name at a line start when it recurs mid-sentence elsewhere | `src/core/name-runs.ts` |
| A run at a sentence start | Drops a leading stop word ("A Bia" gives "Bia"); otherwise skipped ("Depois Teodoro") | Drop any first word | `src/core/name-runs.ts` |
| Joiners | `de`, `da`, `do`, `das`, `dos` in Portuguese; none in English (Q21) | Add `e`, `del`, `van`… or make it a setting | `src/core/name-runs.ts` |
| Titles | "Sr. Almeida" gives "Sr" and "Almeida"; "Sr" is known as a title | Keep the title with the name | `src/core/name-runs.ts` |
| Short runs | One-letter runs are dropped; English "I" and its contractions never start a run | — | `src/core/name-runs.ts` |
| No writing language | Every run at a sentence start is skipped | — | `src/core/name-runs.ts` |
| Skip quotes | With "Pular citações" on, the cross-work count can include quote lines the lens never marks | Mask quotes in the index too | `src/universe/names-index.ts` |
| Create entry | Fills the whole run, "Dona Zefa", editable (D8) | Only the name after the title | `src/lens/view.ts`, `src/core/names-source.ts` (`createEntry`) |
| Dismiss | Adds to the "Não são nomes" setting, for every note (Q4) | Per note, like "Ignorar aqui" | `src/lens/view.ts`, `src/lens/settings-ui.ts` |
| When the index starts | On the rule's first run, never before | At startup | `src/universe/names-index.ts` |
| Count updates | A separate counts signal; name marks and spellcheck don't refresh on it (follow-up 5) | — (settled) | `src/core/names-source.ts`, `src/lens/index.ts` |

### EPUB

| Point | Chosen | Alternative | Where |
|---|---|---|---|
| A bad cover | A warning that turns the button into "Exportar mesmo assim" | Information only, the button stays "Exportar" | `src/export/source.ts` (`withCoverWarning`, `needsConfirm`) |
| Cover link forms | A wikilink, an embed or a plain path | Also a Markdown link `[x](path)`, which your vault writes elsewhere | `src/export/logic.ts` (`coverLink`) |
| Cover type | Read from the file's first bytes; the extension isn't trusted | Trust the extension | `src/export/logic.ts` (`coverMediaType`) |
| Reading the cover | `vault.readBinary` in the export module, not through the book source (Q19) | Through the book source | `src/export/index.ts` (`readCover`) |
| File name | `<title> (<template>).epub` (D2) | `<title>.epub` | `src/export/logic.ts` (`exportFileName`) |
| Book identity | A UUID from the path and title: renaming the book makes a new book for your reader | From the title only, or stored once | `src/export/writers/epub.ts` (`epubIdentifier`) |
| Headings | A chapter is `h1`, headings inside start at `h2` | — | `src/export/writers/epub.ts` |
| Language and labels | Follow the template (pt-BR, en-US), including "Capa", "Início" | A separate language choice | `src/export/writers/epub.ts`, `src/export/presets.ts` |
| Scene break | Its own setting, `* * *`; blank goes back to it | The template's `#` | `src/export/writers/epub.ts` (`epubLayout`), `src/settings.ts` |
| A single note | Listed in the contents by the work's title, with no `h1` | No contents page | `src/export/writers/epub.ts` |
| Dedication and epigraph pages | Written only when they have text | Always written | `src/export/writers/epub.ts` |

### Collections

| Point | Chosen | Alternative | Where |
|---|---|---|---|
| Order | The file explorer's sort, read from Obsidian's `fileSortOrder` (not in the typed API); A to Z if unknown; folders first; time sorts only within one folder (follow-up 3) | The click order | `src/export/logic.ts` (`sortLikeExplorer`, `explorerSortOf`), `src/export/collection-menu.ts` |
| When the menu shows | Two or more files, every one a Markdown note Escrita can export; otherwise hidden (follow-up 3) | Show it and skip what doesn't fit | `src/export/collection-menu.ts` (`onFilesMenu`) |
| Title | Starts empty (board 34b) | The first conto's folder name | `src/export/collection-menu.ts` |
| Where the note goes | Beside the first conto, opened in the editor (D9) | The vault root, or ask | `src/export/collection-menu.ts` (`createCollection`) |
| Draft status | "New notes start as draft" skips a note with the collection property, even an empty one; a status you add by hand makes it a work (Q27; fixed in `763f532`) | Never a work, whatever its status | `src/core/new-note-status.ts` (`needsDraftStatus`), `src/main.ts` (`draftIfNew`) |
| `contents` link form | Always `[[Name]]` wikilinks, whatever the vault's link setting: Obsidian follows renames in properties only through wikilinks | Follow the setting, like **Criar link** | `src/export/collection-menu.ts` |
| A collection in the Works tab | Left as is (review): it is a note like any other | Never a work, whatever its status | `src/core/classify.ts` |
| Same-name contos | Linked by path when another note shares the name | Always by name | `src/export/collection-menu.ts` |
| A conto's title | Its file name; its `title` property is not read | Read `title` | `src/core/books.ts` (`collectionSource`) |
| A book with a `contents` list | Exports as a book | As a collection | `src/export/source.ts` (`sourceKindOf`) |
| What counts as missing | A link to nothing, to a file that isn't a note, or to the collection itself | — | `src/core/collection.ts` |
| Link forms read | Wikilinks, in a list or several in one text value | Markdown links too | `src/core/collection.ts` |

### Publish next chapter

| Point | Chosen | Alternative | Where |
|---|---|---|---|
| Line order | The gap first: "Lacuna: 04 · Próximo: 04 A escada · último publicado em 5 out" (follow-up 1, board 32b) | — (settled) | `src/outline/header.ts` (`serialParts`) |
| Chapter label | The digits in the file name and the title, "04 A escada" | The export heading, "Capítulo 4 — A escada" | `src/publish/serial.ts`, `src/outline/header.ts` |
| Date format | "D MMM" in pt-BR, "MMM D" in English | The date as written in the note | `src/outline/header.ts` |
| The gap warning | Names every earlier unpublished chapter | Only the nearest | `src/publish/checks.ts` |
| Outside a book | The command falls back to the vault's only book | The outline's book | `src/publish/index.ts` (`activeBook`) |
| The button | Waits for a first published chapter, like the line (board 32d) | Always shown | `src/outline/header.ts` |
| Future dates | Shown as written (D5) | "agendado para…" | `src/publish/serial.ts` |
| No date on the last published | Its title, no date (Q23) | The nearest earlier date | `src/publish/serial.ts` |
| Module import | The outline imports the pure `publish/serial.ts`. Precedent: `outline/bar.ts` imports goals | A port through `features.get` | `src/outline/view.ts`, `src/outline/header.ts` |
| With publish off | No line and no button | Show the line anyway | `src/outline/view.ts` |

### Read the book

| Point | Chosen | Alternative | Where |
|---|---|---|---|
| Chapter headings | `h1` | A smaller heading | `src/outline/reader-view.ts` |
| Clicking a paragraph | Opens the chapter in a new tab | The same tab, or a split | `src/outline/reader-view.ts` |
| Heading format | The export's "Chapter heading" setting; empty uses the language's template heading, a copy of the two export literals that can drift | Import the presets | `src/outline/reader-plan.ts` (`readerHeadingFormat`) |
| Navigation | No chapter rail and no progress bar; the outline navigates (D6) | The rail of board 33 | `src/outline/reader-view.ts` |
| A deleted chapter | The position goes back to the top | The nearest chapter | `src/outline/reader-plan.ts` (`restoreTarget`) |
| A rename while reading | The position can be up to 0.6 s old, because the rebuild cancels the pending save | Save before the rebuild | `src/outline/reader-view.ts` (`SAVE_DELAY`) |
| Edits | Redrawn 800 ms after the last change, keeping your place (follow-up 2) | — (settled) | `src/outline/reader-view.ts` |
| Tabs | Reuses the tab already reading the book | Always a new tab | `src/outline/index.ts` (`openReader`) |
| Tests | No DOM test for the view; your test is the check | Add a DOM test in 1.0 | `src/outline/reader-view.ts` |

### Scope (IMPROVEMENTS 9)

| Point | Chosen | Alternative | Where |
|---|---|---|---|
| Who reads `scope` | The universe module still calls `scopeFor` and `keptOut` from `core/scope.ts` | Read `books.classify(x).scope`, with a feature check in each caller | `src/universe/index.ts` |
| Mode | Scope follows the `universeMode` setting, not the feature switch | Follow the switch | `src/core/classify.ts` |
| Defaults | A missing universe note reads as `Universe.md`, a missing property as `universe`; an error gives the none scope | Throw | `src/core/scope.ts` |
| Cost | A plain field, about 7% on the 3,020-file bench | A lazy getter (Q15) | `src/core/classify.ts` |

## After your test

### Clean up the vault

1. Delete `Contos/Teste 0.9/`, `Romances/Teste 0.9/`, `Anexos/capa-teste.jpg`, the Dona Zefa
   entry you created, and the test exports in `Escrita/Exports/` (Livro Longo, Maré, Marés e
   outros contos).
2. Check what else changed: `cd ~/projects/website && git status escrita`. Restore anything the
   test touched by mistake with `git restore <file>`. Keep `data.json` if you want the new
   settings.
3. Turn **Git** back on in **Plugins da comunidade**.

### Release checklist

From CONTEXT.md, "Working process". On branch `0.9`:

1. Write the results into `docs/PLAN-0.9.md`: G0d's two numbers, the 0.7 gate's decision, and
   whatever you changed from "Points you may want to change".
2. **ROADMAP.md**: move 0.9 to "Shipped". Plan 1.0 as "Next" before editing the topic roadmaps.
3. **README.md**: in the changelog, change "0.9.0 (unreleased)" to "0.9.0".
4. **Topic roadmaps**: change "Built in 0.9, not yet released" to shipped in 0.9.0 for N 4,
   N 7 stage 3 and N 8 (`ROADMAP-novel.md`), U 2.5 (`ROADMAP-universe.md`) and SF 13
   (`ROADMAP-short-fiction.md`).
5. **IMPROVEMENTS.md**: move candidate 9 to "Done".
6. **Guide pages**: done in Wave 3 (`docs/guide/en/` and `docs/guide/pt-BR/`); update them if
   the test changed anything.
7. Run the four checks: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:bundle`.
8. `npm version minor --no-git-tag-version`. It updates `manifest.json` and `versions.json` to
   `0.9.0`.
9. Commit as `0.9.0`.
10. Push the branch and open the pull request from `0.9` to `main`. CI runs on it, and so does
    the **epubcheck** job for the first time (gate G0a on a GitHub runner). It must pass.
11. Merge, then tag the merge commit `0.9.0` and push the tag:
    `git tag 0.9.0 && git push origin 0.9.0`. The release workflow drafts a GitHub release with
    `main.js`, `manifest.json` and `styles.css`. Check the draft and publish it.
12. Install the released files in your vault, as in "Build and install".
