# EPUB fixtures (0.9, task 0.2)

Inputs and expected structure for the EPUB writer (N 7 stage 3, plan Q5-Q9). The source
book is the 0.8 fixture in `../manuscript/` (`book/A Casa.md`); nothing there is edited.
Used by the writer's unit tests and by the CI job that builds this book through the real
writer and runs EPUBCheck (Q9, gate G0a).

## Files

- `cover.png`: a valid 60 x 90 RGB PNG (165 bytes), a plain dark panel with a light frame.
- `expected-files.txt`: the zip's entries, one per line, in archive order. `mimetype`
  is first, stored uncompressed, containing `application/epub+zip` with no trailing newline
  (EPUB 3.3, OCF: no extra field in its header).
- `expected-content.ptbr.opf`: the `OEBPS/content.opf` for the `ptbr` preset.

## The cover

`A Casa.md` has no `cover` property, and the manuscript fixtures stay as they are. Tests
that need a cover add `cover: "[[cover.png]]"` to the book note's frontmatter **in memory**
and serve `tests/fixtures/epub/cover.png` as the vault file `cover.png`. A test with no
`cover` property (or a link that does not resolve, or a non-image) expects the export
without `cover.xhtml`, `images/cover.png`, the `cover-image` item and `meta name="cover"`,
and with the cover spine item removed, plus a readiness warning (Q8). The
property name is a setting (default `cover`).

## What the expected files assume

- Chapters are the same as the manuscript fixture: `00 Prólogo` (unnumbered, kept as
  `## Prólogo`), `01 A chegada`, `03 A casa`; `02 Rascunho` is left out (`compile: false`).
  So there are three chapter files, named by position in the compiled list
  (`chapter-1.xhtml` is the prologue), not by file-name prefix.
- All paths sit under `OEBPS/`, flat apart from `images/`. `nav.xhtml` is the EPUB 3 nav
  document (`properties="nav"`, with a `landmarks` nav pointing at the cover, the
  table of contents and the first chapter); `toc.ncx` is the NCX for older readers.
  The visible table of contents is `nav.xhtml` ("Sumário" in `ptbr`, "Contents" in
  `shunn`), placed in the spine after the front matter (Q6).
- Reading order (spine): cover, title page, dedication, epigraph, nav, chapters.
  Dedication and epigraph pages exist only when the book note has them; the title page
  always does. No running header and no word count (Q6).
- `<dc:identifier>` is `urn:uuid:` plus a UUID **derived from the book note's path and
  title** (same path and title give the same id on every export; nothing is random). The
  test computes the value and replaces `@UUID@`.
- `dcterms:modified` is the export time as `CCYY-MM-DDThh:mm:ssZ` (`epubModified`). The
  writer takes it in `EpubBook.modified`, so a test passes a fixed value and replaces
  `@MODIFIED@` with it. EPUBCheck requires this exact form.
- The scene break is the `epubSceneBreak` setting (`* * *`), not the preset's `#`
  (`epubLayout`).
- `xml:lang` and `dc:language` are the preset's `language`: `pt-BR` for `ptbr` and
  `en-US` for `shunn` (`epubLayout`);
  the creator is the author from the 0.8 author settings or the `author` property.
- The `meta name="cover"` line is the EPUB 2 hint some readers still use; EPUB 3 itself
  uses the `cover-image` property on the manifest item.
- Every manifest item is in the spine or is a resource (image, stylesheet, NCX, nav is
  both). Every file in `expected-files.txt` is in the manifest, except `mimetype`,
  `META-INF/container.xml` and `content.opf` itself.
- `shunn` differs only in `dc:language` and `xml:lang` (`en-US`) and the labels inside
  the XHTML; the file list is the same. Compare the expected `.opf` with insignificant
  whitespace normalized.
