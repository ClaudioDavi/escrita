# Serial fixtures (0.9, task 0.2)

Chapter lists with the expected result of `serialState(chapters, stages, unnumbered)` in
`publish/serial.ts` (N 4, plan Q10-Q13). `cases.json` has `stageWords` (the author's
Portuguese stage words, not the settings' English defaults: a test builds a `StageMapping`
whose `words` are these) and `cases`. Each case has `name`, `note`,
`chapters` in outline order and `expected`. A case may add `unnumberedTitles` (the
"Chapters without a number" setting; default empty).

A chapter is `{ file, status, date, compile }`: `file` is the file name without `.md`
(the sequence names are these strings), `status` the status word (`""` for none), `date`
`YYYY-MM-DD` or `null`, `compile` false for `compile: false`. A test turns `""` into a
`null` status, `compile` into `include`, and the file name into `number` and `title`
(`chapterNumber`, `chapterTitle`).

## Rules the expected values follow

- **Published** is a status word that maps to the published stage (read through `stageOf`);
  the date plays no part (Q10). Unknown words and an empty status are not published.
- **sequence**: the chapters that count, in order: numbered, and not `compile: false`.
  A `00` file (a prologue) and a title in `unnumberedTitles` are unnumbered, so they are not
  in the sequence, as in `core/book.ts` (`countedNumbers`). A chapter with no file-name
  number is unnumbered too.
- **next**: the first sequence chapter that is not published, or `null`.
- **last**: `{ chapter, date }`, the last published chapter of the sequence in order and
  its own date as written (`null` when it has none: case `published-without-date`), or
  `null` when nothing is published. A future date is kept as it is: Escrita only records
  it and does not compare it with today (N 4). In every case here the last chapter in
  order is also the latest date, so "latest by order" and "latest by date" agree.
- **gaps**: sequence chapters that are not published and come before the last published
  chapter of the sequence. The next chapter is a gap when a later one is published (case
  `gap`: next and gaps are both `04 A escada`).
- Left-out (`compile: false`) and unnumbered chapters never count as next, last or a gap,
  whatever their status.

Cases: `none-published`, `first-three-published`, `gap`, `all-published`,
`compile-false-and-unnumbered`, `left-out-published`, `future-date`,
`published-without-date`, `unknown-status`.
