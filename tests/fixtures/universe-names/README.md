# Universe names fixtures (0.9, task 0.2)

A small pt-BR universe, written as a vault. Used by the tests for unlinked mentions
(`universe/unlinked.ts`, plan 1.2) and for the names rule of the lens (`lens/rules-names.ts`,
plan 1.3). Original text written for the tests.

## The world

Settings to use: universe mode `universe`; universe note `Universo.md`; default universe
folders `Contos`; type property `type`; character type value `personagem`, place type
value `lugar`; names language `pt-BR`. Other settings stay at their defaults.

- `Universo.md`: the universe note. Its entries live in `Universo/`.
- Entries (`Universo/Personagens/`, `Universo/Lugares/`):
  - `Beatriz Lemos` (alias `Bia`) and `Teodoro Ramos` (alias `Teo`): characters. The first
    names `Beatriz` and `Teodoro` match on their own.
  - `Porto Alto` (alias `Portinho`) and `Serra Azul`: places.
- `Contos/`: three contos, each a work of its own: `A travessia`, `O retorno`, `A febre`.

The entry notes and `Universo.md` name nobody. Nothing is read from them.

## Unlinked mentions (Q1, Q17)

`expected.json`, key `unlinked`: per conto, the mentions of an entry the conto never links.
Each item has the entry path, the text as written, and the 1-based line in the file
(frontmatter lines count; `UnlinkedMention.line` is 0-based, so a test subtracts 1). Items
are in order of position.

Rules assumed (from `computeMentions` in `universe/mentions.ts`, and `segment`):

- The mentions are the occurrences of the names matcher over `readerMask`, minus those
  inside a link. A heading counts like prose here (its `#` marks are blanked, its text
  stays), as in Appears in. The names rule below reads headings differently.
- Frontmatter, `%% comments %%` and code (fenced or inline) are blanked: never counted.
- A conto that links an entry anywhere lists no unlinked mention of that entry. The link
  may be the first mention or a later one, and the alias in `[[A|B]]` counts as the link.
- An alias and a first name count as mentions of their entry, each as its own item.

Cases:

- `A travessia` links nothing. It names `Beatriz` (lines 8 and 10), the alias `Bia`
  (line 10), the alias `Portinho` (line 16), the alias `Teo` (line 22) and `Porto Alto`
  (line 24). Six items. Line 3 (frontmatter) also names `Beatriz` and `Teo`: not counted.
- `O retorno` links `Teodoro Ramos` once (line 16) and names `Teodoro` and `Teo` after it:
  nothing listed for him. `Beatriz` appears only in frontmatter (line 3), a comment
  (line 18) and a code block (line 21): nothing listed. `Serra Azul` in the heading
  (line 6) is listed. `Portinho` (line 10) is listed. `Serra Azul` in the code block
  (line 21) is not.
- `A febre` links `Porto Alto` as `[[Porto Alto|Portinho]]` (line 26) and names it again
  in the same line: nothing listed. `Serra Azul` (line 28) is listed. Line 3 names
  `Porto Alto`: frontmatter, not counted.

## Names without an entry (Q2-Q4)

`expected.json`, key `names`: the names the rule marks in this vault, without and with the
"Not names" setting `Deus`. Each item has `text`, `works` (works with at least one
occurrence that is not at a sentence start) and `countInNote` (only where a name is
marked by the in-note count, and the most such occurrences in one note). A name is marked
in every note that holds such an occurrence. The lists are sorted by `text`.

Rules assumed:

- A candidate is a run from `core/name-runs.ts` (`nameRuns`): a capitalized word, or
  capitalized words separated by spaces or a joiner (`Rio Pequeno`), not at a sentence
  start. Sentence starts come from `core/sentences.ts` (`sentences(mask, md, "pt")`). The
  first word after opening marks and a dialogue travessão is a sentence start. A run
  that starts a sentence drops its first word when it is a stop word (`A Bia` gives
  `Bia`, `Em Porto Alto` gives `Porto Alto`); otherwise the whole run is skipped
  (`Seguiram Teo`, `Depois Teodoro`: the link markup between them is blank in the mask).
- A word is skipped when it matches an entry name, an alias or an automatic first name.
- A marked name recurs: `works >= 2`, or at least five occurrences in the note (Q3).
- Frontmatter, comments, code and headings are never read (the lens's mask and
  `namesMask` blank them).
- A name from "Not names" is never marked.

Cases:

- `Almeida`: `Sr. Almeida` at the start of a paragraph in `A travessia` (line 12), and
  `de Almeida` in `O retorno` (line 10). `Sr.` is an abbreviation and does not end the
  sentence, so `Almeida` is not at a sentence start. Two works: marked. If `Almeida` were
  taken as a start, it would have one work.
- `Paulo`: `Dr. Paulo` at a paragraph start in `A travessia` (line 14) and in `A febre`
  (line 10). Both follow an abbreviation. Two works: marked.
- `Tavares`: in `A febre` only. Five occurrences not at a start (lines 14 twice, 16, 18
  and 20): marked, `countInNote` 5. Two more are at a start and not counted: line 12
  (`— Tavares, venha cá`, after a travessão) and line 22.
- `Lucena`: twice in `O retorno` (lines 12 and 14), nowhere else: not marked.
- `Rio Pequeno`: one run, in `A travessia` (line 16) and `O retorno` (line 10). Two works:
  marked as `Rio Pequeno`, never as `Rio` or `Pequeno`.
- `Zeferino`: in the prose of `O retorno` (line 12) and in the heading
  `## A casa de Zeferino` of `A febre` (line 8). The heading is never read, so one work
  and one occurrence: not marked. This pins "a heading never counts".
- `Deus`: `O retorno` (line 8) and `A febre` (line 18). Marked, unless "Not names" holds
  `Deus`.
- `Chuva`: capitalized only at sentence starts. One in `A travessia`, one in `O retorno`
  (`Chuva ou sol`, line 8) and five in `A febre` (line 24): not marked.
- `Vamos`: `— Vamos, disse ...` at the start of a line in `A travessia` (line 10) and
  `O retorno` (line 14). After a travessão is a sentence start: not marked.
- `Zacarias`: in a comment (`A travessia`, line 20), a code block (`O retorno`, line 21)
  and frontmatter (`A febre`, line 3). Never read: not marked.
- `Portinho`, `Bia`, `Teo`, `Beatriz`, `Teodoro`, `Porto Alto`, `Serra Azul`: entries,
  aliases and first names. Not marked, although `Portinho` appears in all three contos.

`notMarked` in `expected.json` lists these with the reason, for tests that want to check
that none of them appears.

Capitalized words at a sentence start in the contos (`Beatriz`, `Desceram`, `Em`, `Na`,
`Ninguém`, `Teo`, `Tavares`, `Dali`...) are never marked.
