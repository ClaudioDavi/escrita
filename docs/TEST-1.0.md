# Escrita 1.0: manual test plan (G2 and G4)

This is the plan for testing Wave 2 of 1.0 by hand, in Obsidian on desktop: the setup
("Set up a writing vault"), the presets on the Features page, writing mode and the emulated
phone. It covers gates G2 and G4 of [PLAN-1.0.md](PLAN-1.0.md). G3 (the 0.9 `data.json`
loading unchanged) has its own test and is only checked by eye here. Wave 3 (the guide and
the README) adds its own section later.

How to read it:

- Each section has numbered steps. "Expected" says what you should see. Note anything else
  next to the step number, and keep going.
- Escrita's labels are given in Portuguese, with the English in brackets:
  **Preparar o cofre para escrever** [Set up a writing vault]. Obsidian's own labels are
  given the same way.
- Commands are run from the command palette (**Paleta de comandos** [Command palette],
  Ctrl+P). Escrita sets no hotkeys; step 6 of "Writing mode" checks that.
- Edge cases are marked **Edge case**. Things the judge could not settle are marked
  **Decide**.

Time needed: about an hour and a half.

## Before you start

### 1. Pause the automatic Git backup

As for 0.9: **Configurações** [Settings] › **Plugins da comunidade** [Community plugins],
turn off **Git** in the author's vault. Leave it off until "Clean up" at the end.

### 2. Back up the author's vault

```bash
cd ~/projects/website
git add -A escrita
git commit -m "escrita: antes do teste 1.0"
cd escrita/.obsidian/plugins/escrita
mkdir -p backup-before-1.0
cp main.js manifest.json styles.css data.json backup-before-1.0/
```

Don't push. To go back: copy the four files back and restart Obsidian.

### 3. Build

```bash
cd ~/projects/escrita
git switch 1.0
npm ci && npm run build
```

### 4. Make two scratch vaults

Both empty, outside the website repository, so nothing reaches the site:

```bash
mkdir -p ~/escrita-test/vazio-pt ~/escrita-test/empty-en
for v in vazio-pt empty-en; do
  mkdir -p ~/escrita-test/$v/.obsidian/plugins/escrita
  cp main.js manifest.json styles.css ~/escrita-test/$v/.obsidian/plugins/escrita/
done
```

No `data.json` in either: that is what makes them a fresh install. Open each with
**Abrir pasta como cofre** [Open folder as vault] and turn on community plugins and Escrita.

## G2a: the setup in an empty vault, in Portuguese

Obsidian in Portuguese (Brasil), vault `vazio-pt`.

1. Turn on Escrita for the first time.
   Expected: a notice, not a modal: "Escrita está pronto. Quer preparar este cofre para
   escrever? Mostro tudo antes de criar." with **Preparar…** and **Agora não**. It stays about
   20 seconds.
2. Click **Agora não**. Restart Obsidian.
   Expected: no notice again. `data.json` now has `"setupOffered": true`.
3. Run **Preparar o cofre para escrever**.
   Expected: step 1, "1 · Escolhas": **O que você escreve?** (Contos e ensaios, Um romance,
   Os dois; "Os dois" picked), **Idioma dos padrões** on Português (Brasil), three cards
   (Essencial, Escritor, Tudo; Escritor picked). No "Mundo compartilhado" yet.
4. Click **Tudo**.
   Expected: **Mundo compartilhado** appears (Desligado, Por livro, Universo), nothing picked.
   Click **Universo**, then click it again: it unpicks ("decide later"). Pick **Universo** and
   leave it. Then click **Escritor** again: the question goes away. Click **Tudo** once more.
5. Click **Ver o que vou criar**.
   Expected: step 2, "O que vou criar", in board 36's order: Pastas (`Contos`, `Livros`,
   marked `+`, one tick on the first row), Exemplos (`Contos/Exemplo · A travessia.md`, `Livros/Exemplo · O farol`,
   `Livros/Exemplo · O farol.md`, its `Capítulos` folder and `01 Chegada.md`,
   `02 A tempestade.md`, each with an "exemplo" pill and one tick on the first row),
   Configurações (Recursos "Tudo (19 de 19)", the language group with its tick, Mundo
   compartilhado "Universo", with its own tick, ticked), Nota inicial (`Início.md` and "Abrir a nota inicial ao
   iniciar"), Layout with the two cards **Mesa de escrita** and **Modo escrita**.
   The summary says no existing note changes and counts items and settings.
6. Untick **Exemplos**.
   Expected: the example rows grey out and the counts drop. Tick it again.
7. Keep **Mesa de escrita** and click **Criar**.
   Expected, all of:
   - One notice: "Pronto. Criei … e mudei …" and that the home note is open.
   - `Início.md` in front, with the line saying the note is yours, the works block drawing
     both examples (stage rascunho), and the line saying the "Exemplo ·" notes can be deleted.
   - The right sidebar: the outline on top; the lens below with **Marcadores** [Placeholders]
     as a second tab behind it. The universe panel is a tab behind the files on the left.
   - In the file explorer, the conto shows its count against 2000; the chapters show 1200
     and 1500 (their own targets), and the book note 1500 as the chapters' default.
8. Open the conto.
   Expected: the first beat has prose under it, the second is a ghost beat; the placeholder
   `%% XXX: … %%` is marked; the dialogue line starts with a travessão and dialogue focus
   picks it up. Open `02 A tempestade.md`: three ghost beats and no prose.
9. Open **Configurações › Escrita**.
   Expected: the statuses read ideia, rascunho, revisão, pronto, publicado; the chapters
   folder is "Capítulos"; the Features page reads **Tudo** with every switch on; the universe
   mode is Universo; "Abrir a nota inicial ao iniciar" is on.
10. Restart Obsidian.
    Expected: `Início.md` opens on startup. No first-run notice.
11. Run the command again and go to step 2.
    Expected: board 36 b. Every row is `=` ("fica"), the summary says there is nothing to do,
    and the only button besides **Voltar** is **Fechar**.

## G2b: the setup in an empty vault, in English

Obsidian in English, vault `empty-en`. Repeat G2a with the English names, with these changes:

1. Pick **Short fiction** only, **Essentials**, and the **Writing mode** layout card.
   Expected in the preview: only `Stories/` and `Stories/Example · The crossing.md`;
   no book; the layout row and the cards.
2. Create.
   Expected: `Home.md` opens and writing mode starts: no sidebars, no tab bar, no ribbon, no
   status bar; the note's header (its title) stays on desktop. A quiet **Exit writing mode**
   button at the top right; the notice "Writing mode. To leave: the button in the corner or
   the command." once. The goal counter "today 0 / 500" at the bottom (Goals is in
   Essentials).
3. **Settings** shows "Open in writing mode" on, beside "Open the home note on startup".
   Restart: Obsidian opens in writing mode on `Home.md`.
4. **Edge case**, the language tick off: in a third empty vault, pick Portuguese as the
   language with Obsidian in English, untick the language group and create.
   Expected: the folders and examples have Portuguese names, but the example book's chapters
   folder is the install's own ("Chapters"), so `Livros/Exemplo · O farol` still reads as a
   book in the outline.

## G2c: the setup in the author's vault (changes no note, no saved setting)

Vault `~/projects/website/escrita/`, Obsidian in Portuguese, the new build copied in:

```bash
cp ~/projects/escrita/{main.js,manifest.json,styles.css} \
   ~/projects/website/escrita/.obsidian/plugins/escrita/
cp ~/projects/website/escrita/.obsidian/plugins/escrita/data.json ~/escrita-test/data-before.json
```

1. Start Obsidian.
   Expected: no first-run notice (an install from 0.9 never sees it). The Features page reads
   **Personalizado** [Custom] or the preset your switches match; nothing switched.
2. Run **Preparar o cofre para escrever**. Pick **Contos e ensaios** and **Escritor**.
   **Ver o que vou criar**.
   Expected: `Contos` is `=` with your note count ("Já existe, fica. N notas"). The examples,
   the language group, "Abrir a nota inicial ao iniciar", the features row and the layout
   come **unticked**, each with its reason line. Every setting you saved reads "Você já
   salvou esta; ela fica." Your track folders are not swapped.
3. Look at **Nota inicial**. If your home note setting already names a note, it is `=` and
   the summary reads "Nada a fazer" or "Nada marcado", with **Criar** greyed. Otherwise
   `Início.md` is offered, ticked (a new note, never over an existing one): click **Criar**.
   Expected: at most `Início.md` is created, and only if it was offered.
   If your vault already has `Home.md`, `Início.md` or `Inicio.md` and the setting is empty,
   that note is `=` (adopted), and no second home note is offered.
4. Check that nothing else moved:

   ```bash
   cd ~/projects/website && git status --short escrita
   diff <(jq -S .settings ~/escrita-test/data-before.json) \
        <(jq -S .settings escrita/.obsidian/plugins/escrita/data.json)
   ```

   Expected: `git status` lists at most `Início.md` (and `data.json`). The settings diff is
   empty. The only `data.json` change outside `settings` is allowed bookkeeping
   (`setupOffered`, left-off records).
5. **Edge case**, "Os dois": run it again with **Os dois**.
   Expected: `Livros/` is a new folder (`+`) with a tick, **unticked** because your vault has
   works; the "Pastas que contam" line that would add `Livros` to your track list shares that
   tick and is unticked too. Create nothing: the vault is unchanged. Tick the folder row:
   both the folder and the track line turn on. Click **Cancelar**.
   (In a vault without works the same row comes ticked. Settled by the author, 2026-10-07.)
6. **Edge case**, a home note in another case: rename your home note to `início.md` (lower
   case), run the setup. Expected: it is used as it is (`=`), no `Início.md` beside it.
   Rename it back.

## Presets on the Features page

In `vazio-pt` after G2a (on **Tudo**).

1. **Configurações › Escrita › Recursos**.
   Expected: **Ponto de partida** with the label **Tudo**, and the buttons Essencial,
   Escritor, Tudo. No "Preparar o cofre para escrever" link (there is a home note).
2. Click **Essencial**.
   Expected: the confirm step: "Aplicar "Essencial"?", **Desliga** with the names in page
   order, **Liga** "nada", "Os dados de quem desliga ficam guardados.", **Cancelar** and
   **Aplicar**. Nothing switched yet; the page did not jump.
3. **Cancelar**, then **Essencial** again, then **Aplicar**.
   Expected: the page redraws, the label reads **Essencial**, nine switches on. The universe
   mode is unchanged (still Universo).
4. Click **Essencial** again.
   Expected: "Já está em "Essencial". Nada muda." and no Apply.
5. Turn one switch by hand.
   Expected: the label reads **Personalizado**.
6. Click **Tudo**.
   Expected: the confirm adds the universe line ("O universo não é um interruptor…").
7. Rename `Início.md` away from the setting's name.
   Expected: the quiet link **Preparar o cofre para escrever** appears below the buttons and
   opens the setup. Rename it back.

## Writing mode next to the Minimal theme and a zen plugin

In `empty-en` (Essentials, Writing mode on startup). Install the **Minimal** theme and one
zen plugin (**Zen Mode** or **Ultra Zen Mode**).

1. With Minimal on, run **Exit writing mode**, open both sidebars, run **Enter writing mode**.
   Expected: the same "only the note" look in light and dark; the exit button and the counter
   readable in both; nothing from Minimal's own chrome left over the text.
2. **Exit writing mode** (button).
   Expected: both sidebars come back, tabs, ribbon and status bar back.
3. Close the left sidebar, enter, exit.
   Expected: only the right sidebar comes back; the left stays closed (Escrita reopens only
   what it hid).
4. Turn on the zen plugin's mode, then enter Escrita's writing mode, then exit Escrita's.
   Expected: the zen plugin's hiding is still in force; Escrita did not reopen what the zen
   plugin closed. Exit the zen mode: everything back.
5. The other order: Escrita first, zen plugin second, exit the zen plugin first, then
   Escrita. Note what you see; a sidebar both closed may come back when Escrita exits.
6. Palette: type "writing mode".
   Expected: exactly one of **Enter writing mode** / **Exit writing mode**, by state. Under
   **Settings › Hotkeys**, neither has a key.
7. In the mode, from the home block click a work (the boards call this "Continue"; the block has no separate button, a click on the row opens the work).
   Expected: the work opens in the same tab, at the left-off spot, and the mode stays.
8. Turn **Goals** off on the Features page while in the mode (use the command to exit and
   enter around the settings if needed).
   Expected: the counter goes away; turning Goals on brings it back.
9. Turn the **home block** feature off while in the mode.
   Expected: the mode exits by itself; nothing stays hidden.
10. **Decide**: the board shows a reading column; today the theme's own line width applies
    (turn on **Readable line length** in Obsidian's Editor settings to see it).

## G4: the emulated phone

Vault `~/projects/website/escrita/`, window about 390 px wide, in the developer console
(Ctrl+Shift+I): `app.emulateMobile(true)`. Follow "Checklist for G4" in
[MOBILE-1.0.md](MOBILE-1.0.md), plus:

1. Run the setup.
   Expected: the preset cards and layout cards stack under 600 px; every tick and button is
   at least 32 px and reachable by a tap; no horizontal scroll in the preview.
2. In `vazio-pt` (emulated), the **Mesa de escrita** layout (a fresh vault, or a copy of it).
   Expected: outline and lens are two tabs of the right drawer, no split, no universe tab.
3. Writing mode.
   Expected: no bottom navigation bar and no note header; the exit button (44 px) always
   visible, no hover needed; the counter above the safe area.
4. Features page: the preset buttons wrap and are 44 px tall.
5. Universe panel: each entry row shows **⋯** (no hover needed); tapping it opens the same
   menu as the right click; tapping the row still opens the entry.
6. `app.emulateMobile(false)` when done.

## Release-candidate fixes (2026-10-09)

In `vazio-pt` unless noted.

1. **Settings fall back to the install's language.** Clear **Palavra de thread fechada**
   [Closed word] and leave the field. Expected: it reads `fechada`, not `closed`; the thread
   word reads `thread` (the same in both languages since 2026-10-09). Same for the universe
   note (`Universo.md`) and the export and submissions folders: each placeholder is
   Portuguese.
2. **One home note.** In a copy of `vazio-pt` with `Início.md` renamed to `Inicio.md` and the
   home note setting cleared: run **Abrir a nota inicial**, then the setup. Expected: both
   use `Inicio.md`; no `Início.md` is created.
3. **Darlings with the note open.** Open the darlings note in a tab beside a conto. Cut a
   passage to darlings, Ctrl+Z in the darlings note, cut again, restore it, delete another.
   Expected: the darlings note shows each change at once, undo works there, no text lost.
4. **Dialogue focus keeps working.** Type dialogue in a conto while the universe panel
   updates (in a note with entry names). Expected: the focus and the name marks keep
   following the cursor.

## Open gates to check by eye

- **G3**: after G2c the Features page and every section read as before the update.
- **Visual match** against boards 35–39 on the design canvas
  (https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6), light and dark theme.

## Points you may want to change

- **The "Today: Custom, 18 on" line** on the setup's features row (board 36) is not drawn;
  the row says the target preset, and the reason line says what changes.
- **Writing mode is two commands**, each shown only in its state, because renaming a command
  needs a private API. The palette shows one at a time, as the board wants.
- **The setup's home note open** never replaces a tab you have: it reuses an open tab of the
  note, else an empty tab, else opens a new tab.
- **The pt-BR example texts** (the conto, the book and its chapters) were written by the
  agents; read them once.
- **The layout with tabs already in the right sidebar**: the outline joins the first group
  there and the split happens below it; Escrita never closes your panels to get a clean half.

## Clean up

1. Restore the author's vault if anything moved: `git checkout -- escrita` in
   `~/projects/website`, and the `backup-before-1.0` files.
2. Remove `~/escrita-test`.
3. Turn **Git** back on.
