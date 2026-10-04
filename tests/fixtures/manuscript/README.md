# Manuscript fixtures (0.8, task 0.2)

Inputs and the Markdown manuscript each preset must produce. Used by the tests for
`core/manuscript.ts` (1.3) and the Markdown writer (2.3).

## Inputs

- `conto.md`: a standalone conto. Export input: title `A visita` (the file name is not
  the title; the test passes it), author `Ana Souza` (also in its frontmatter).
- `book/A Casa.md`: the book note (`dedication` and `epigraph` link to notes).
  Chapters in `book/A Casa/Chapters/`: `Prólogo` (no number), `01 A chegada`,
  `03 A casa`, `02 Rascunho` (`compile: false`, left out). Title `A Casa`, author `Ana Souza`.
- Presets: `shunn-en` and `ptbr`. Expected files: `expected/<conto|book>.<preset>.md`.

The source text is Portuguese in both presets; only labels differ.

## Rules the expected files follow (Q5-Q8, N 7 stage 1)

Frontmatter dropped; `%% beat %%`, `%% XXX %%`, inline `%% %%`, and `<!-- -->` removed
(a space before an inline marker goes with it; a line left empty by removal disappears);
`[[A|B]]` becomes `B`, `[[A]]` becomes `A`; embeds `![[x]]` dropped; scene break `---`
becomes `#`, never first or last in a chapter, and never doubled. Bold, italics, quotes
and body headings stay as written. The `compile: false` chapter is absent. Numbering
counts numbered chapters only.

## Choices the plan left open (flagged for 1.3, 2.3 and the judge)

1. **Title block (both sources).** `# {title}`, a blank line, `by {author}` (shunn-en)
   or `por {author}` (ptbr). No word count in Markdown (the rounded count is a DOCX
   title-page item, Q8). Preset fields `endMark`, `countLabel`, `header`, `page`, `font`,
   `lineSpacing` and `indent` are page layout only: the Markdown writer ignores them and
   reads only `byline`, `chapterHeading` and `sceneBreak`.
2. **Heading levels.** Book title `#`, each chapter `##`. A single note has no chapter heading.
3. **Chapter heading text.** shunn-en `Chapter {n}: {title}`; ptbr `Capítulo {n} — {title}`
   (em dash). Unnumbered chapter: `## {title}` alone (`## Prólogo`).
4. **Chapter number.** The ordinal among the numbered chapters not left out by
   `compile: false`, counted before the export modal's range or ticks narrow the list
   (exporting chapters 5-7 keeps 5, 6, 7). Not the file-name prefix: `02 Rascunho` is
   left out, so `03 A casa` is "Chapter 2" / "Capítulo 2". A numbered chapter with no
   title of its own gets the number alone ("Capítulo 1"), without the separator.
5. **Front matter pages (book only).** Title block, dedication prose, epigraph prose, each
   followed by a `---` line, then the first chapter. The book's title block is followed by
   `---` because a novel has a separate title page; a conto's is not, because a short
   story starts below its title on page 1 (Shunn). The DOCX writer follows the same rule. No headings or labels on them.
   The dedication/epigraph note's frontmatter is dropped; its prose is kept as written
   (the epigraph keeps its italics and attribution line).
6. **Scene separator.** `#` for both presets, on its own line with blank lines around.
   The Markdown writer escapes a separator that would parse as Markdown structure, so
   it is written `\#` (renders as a literal #); a bare `#` would be an empty heading.
   `* * *` would be a faithful thematic break and may stay as written.
7. **Spacing.** One blank line between blocks; the file ends with one newline; a chapter
   follows the previous one with one blank line before its heading.
8. **Ignored text.** The book note's body ("Notas do livro") is never exported.
9. **Typography.** No changes: travessão dialogue and curly punctuation pass through.
10. **Body headings.** A heading inside the prose is written at `max(level, 2)` in a
    single note and at `max(level, 3)` in a book (chapters take `##`): the conto's
    `## Interlúdio` stays `##`, the book's `## Parte` becomes `### Parte`.
