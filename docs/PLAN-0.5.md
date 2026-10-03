# Escrita 0.5, "revision": implementation plan

This is the implementation plan for Escrita 0.5, generated 2026-10-02. It breaks
the release into waves of tasks that agents can run in parallel, with strict file
ownership per wave. The specs win on any disagreement: `docs/ROADMAP-short-fiction.md`
§5 (the revision lens and the stemmers), `docs/ROADMAP-universe.md` U 1.2, U 1.3 and
U 1.4 (what the universe will need from the stemmers and the sentence splitter), and
`docs/IMPROVEMENTS.md`, "Loose ends from 0.2.1" (the editor items). If this plan and a
spec disagree, fix this plan. Where this plan narrows or extends a spec, the change is
listed in "Deviations from SF 5" below, and the release writes each one back into
the spec (task 5.2).

File:line references point at the working tree on 2026-10-02 (the 0.4.0 commit).

0.5 serves the **revision** stage of a work's life (ARCHITECTURE.md, "Workflow"). The
upkeep it asks of the writer is one optional note of word lists; everything else
works with no setup.

## Open questions, with recommended answers

The author answers these in gate G2 (see "Gates"). Each has a recommended answer;
agents build to the recommendation unless the author says otherwise.

**Stemmers**

| # | Question | Recommendation |
|---|---|---|
| Q1 | SF 5 names one function, `stem(word, lang)`. Echoes want an aggressive stem (*olhar/olhou*); name matching wants a light one that never collides (*Maria/Mário*, *Ana/ano*, *Teodoro/Teo*). One function or two? | **One function with a profile argument**: `stem(word, lang, profile = "word")`, where profile is `"word"` or `"name"`. Both return an opaque key, compared only for equality. `"name"` is a new argument value, not a new function. U 1.2 and U 1.4 call `"name"` for people and places (feminine skipped on purpose, *Mariano/Mariana*, Q4) and `"word"` for common-noun entries and aliases (*menino / meninos / menina*). |
| Q2 | Run RSLP's noun-suffix step (`-mento`, `-ção`, `-dade`, `-ista`…) in the pt `"word"` profile? SF 5 lists it. | **No in 0.5.** It merges *casamento/casa* and *mentira/mente*. SF 5 also says "prefer missing a match over a wrong one". The pt `"word"` profile is: clitic split, plural, feminine, adverb, augmentative/diminutive, verb suffix, vowel removal, accent removal. |
| Q3 | English: SF 5 says "light Porter-style … common noun and verb suffixes". How far? | **Porter2 step 0 (possessive), 1a (plural), 1b (`-ed`/`-ing` with undoubling and restoring `e`), 1c (`y`→`i`), plus `-ly` on stems of 4 or more letters.** Steps 2–5 stay out (*universe/university*). |
| Q4 | What does the `"name"` profile do? | **pt:** plural, then diminutive/augmentative only; no feminine step, no vowel or accent removal (*Maria/Mariazinha* → `maria`, *Joãozinho* → `joão`, *Mário* stays apart, *Mariano* and *Mariana* stay apart). The feminine step is skipped on purpose: two people named *Mariano* and *Mariana* are different people. This narrows U 1.2's "plural, feminine, diminutive and augmentative" for person and place entries; common-noun entries get feminine through `"word"` (Q1). **en:** possessive (`'s`, `’s`, trailing `'`) and a simple plural `-s` on stems of 3 or more letters that don't end in `s`. Never Porter-stem a name (*James* stays `james`). Minimum stem 2 characters. |
| Q5 | Who normalizes case and Unicode? | **`stem` does**: NFC, `toLowerCase()` (no locale), `’`→`'`. Callers pass raw tokens. A bounded memo per (lang, profile) makes repeated calls cheap (U 1.2 scans every work). The key is case-folded, so a case-sensitive caller (U 1.2's per-entry `caseSensitive`) compares the raw token's casing first and uses `stem` only for inflection. No API change; written in the `core/stem/index.ts` doc comment and in ARCHITECTURE. |
| Q6 | Hyphenated words and enclitics (*olhou-me*, *dizê-lo*, *guarda-chuva*)? | **pt strips one known clitic after the last hyphen** (`me te se lhe lhes nos vos o a os as lo la los las no na`) and stems what is left, accepting *dizê-* as imperfect. The split is exported as `splitClitic(normalized)` so the word rules can test a token's base (*dizendo-lhe* is a gerund, Q18). Mesoclisis (*dir-se-ia*) is not handled. Other compounds stay one token and are stemmed whole. |
| Q7 | Stop words: where and how many? | **Our own lists, about 150–250 per language, in `src/core/stem/stopwords.ts`**, so the universe can reuse them. Written by hand, not copied from Snowball, so no notice is needed (Q31). Contractions (*don't*, *she'd*) are English stop words, matched whole before stemming. |

**Language and lists**

| # | Question | Recommendation |
|---|---|---|
| Q8 | The language setting's default? SF 5 says "from Obsidian's language". | **Store `"auto" \| "pt-BR" \| "en"`, default `"auto"`.** Auto maps any `pt*` locale to `pt-BR` and any `en*` locale to `en`. Any other locale (es, fr, de…) gives **no language**: the language-bound rules and measures (echoes, adverbs, gerunds, readability) are off, the panel shows one line, "Choose a language in settings" / "Escolha um idioma nas configurações", and crutch words, name variants, long sentences and dialogue share still run (they don't depend on the language). Running English rules on Spanish prose would be confidently wrong (SF 5: "prefer missing a match over a wrong one"). No per-note override in 0.5 (rule 3); a `lang` frontmatter field is a later candidate. |
| Q9 | How do the built-in pt-BR tables (stop words, `-mente` and gerund exceptions, abbreviations, *ir* forms) fit rule 6 ("every word list is a setting with English defaults")? | **They are language data, picked by the language setting, not the author's values.** Every setting has an English (or neutral) default; the pt-BR tables apply only when the language is pt-BR. The writer extends or overrides them from the word lists note (`Ignorar` removes, Q12), never by editing code. No textarea per built-in list (rule 3). The author confirms this reading of rule 6. |
| Q10 | The list note headings are Portuguese (`## Vícios`, `## Nomes`, `## Ignorar`). | **Fixed bilingual aliases, compared case- and accent-insensitively:** Vícios / Crutch words (also "Crutches"), Nomes / Names, Ignorar / Ignore. Not a setting. One entry per line; list markers, blank lines, `%% %%` comments, frontmatter and anything under other headings are skipped. A heading level of `#` to `######` is accepted. |
| Q11 | Ship a default crutch list (filter words, clichés)? | **No built-in crutch list.** Offer a command, "Create the word lists note", that writes a new note (never an existing one) with the three headings and a short starter list in the current lens language (pt-BR: *de repente, começou a, meio que, viu, ouviu, sentiu, percebeu*; en: *all of a sudden, started to, sort of, saw, heard, felt, noticed*). The words then live in the writer's vault (rule 6), and an empty note keeps the crutch and name rules silent (rule 3). The starter text is approved in G1d. This is an addition beyond SF 5, which asks only for a path setting (see "Deviations from SF 5"); if the author prefers less scope, drop the command and put the starter lists in the README. |
| Q12 | What does `Ignorar` cover? | **Echoes (by `"word"` stem), adverbs, gerunds and name variants. Not crutch phrases** (the writer listed those on purpose). It extends every built-in exception list. Matching is NFC and case-folded, never accent-folded for single words (*está* ≠ *esta*). |
| Q13 | Crutch matching: stems or exact phrases? | **Exact phrase, whole words, case-insensitive, NFC, insensitive to line breaks and runs of spaces.** No stemming in 0.5, so "começou a" does not catch "começaram a"; the README says so and suggests listing both. |
| Q14 | How does the list note follow renames and edits? | **A content-mode vault index spec** (`include: f => f.path === listsPath(settings.lensListsNote)`, `settingsKey: () => listsPath(settings.lensListsNote)`) re-parses it on modify, debounced by the index. The setting is normalized like `homeNote` (trimmed, no leading or trailing slash, `.md` added when there is no extension, task 1.7's `listsPath`), so `Modelos/Revisão` and `/Modelos/Revisão.md` both work. A follower moves the setting on rename and calls `await plugin.saveSettings()`, which triggers the index's `settingsChanged` rebuild (the hub drops the entry on rename because `include` still sees the old path). A delete leaves the setting alone; the rules that need lists go silent, and the panel says "Word lists note not found" instead of "Add a word lists note". |

**Rules**

| # | Question | Recommendation |
|---|---|---|
| Q15 | Echoes: what counts, and where does the window stop? | **Same `"word"` stem within N words (all words count toward N, default 40).** Each later occurrence is one match, with the earlier one as its `related` range (drawn fainter). The window runs across paragraphs and resets at a scene break and at a heading (the `breaks` offsets 3.1 passes to `echoes`). Ignored: stop words, stems under 3 characters, tokens under 4 characters, `Ignorar`, listed names (repeating a name is normal), and tokens with no letters. |
| Q16 | Adverbs. | **pt:** `-mente` with at least 3 letters before it, tested on the token's base after `splitClitic` (Q6), minus exceptions: *clemente, veemente, dormente*, and the subjunctive forms of `-mentar` verbs (*aumente, comente, lamente, alimente, experimente, fomente, atormente, implemente, complemente, cimente, argumente, documente*). *mente, semente, demente* and *ente* are not in the list: the 3-letter rule already keeps them out, and the README uses them as worked examples. **en:** `-ly`, length at least 5, minus about 45 exceptions (*only, family, reply, apply, supply, imply, rely, early, holy, ugly, silly, lonely, lovely, friendly, likely, lively, July, Italy, assembly, butterfly, monopoly, melancholy, anomaly, lily, Emily…*). Both skip capitalized tokens that are not sentence-initial (names). |
| Q17 | The English "Gerunds" rule is "began to / started to + verb", not a gerund. | **One rule id `gerund`, labelled per language** (pt "Gerúndios", en "Started to"). en matches *begin/begins/began/begun/beginning/start/starts/started/starting* + `to` + a word, over the whole construction. English `-ing` chains are not flagged. |
| Q18 | pt gerunds: base, gerundismo, chains. | **Base:** `-ando/-endo/-indo` on the token's base after `splitClitic` (so *dizendo-lhe*, *olhando-a*, *fazendo-o* count, and the match spans the whole token), minus exceptions (*quando, mundo, lindo, segundo, fundo, profundo, redondo, comando, bando, brando, rotundo, vagabundo, oriundo, estupendo, horrendo, tremendo, remendo, dividendo, adendo…*) and minus capitalized non-initial tokens and listed names (*Fernando, Armando*). **Gerundismo:** a form of *ir* only (*vou, vai, vamos, vão, ia, iam, íamos, iria, iriam, irá, irão…*), then a form of *estar*, then a gerund, inside one sentence, with at most one word between each; the match spans the construction (*vou estar enviando*). *Deve estar chegando* and *pode estar dormindo* are normal Portuguese (likelihood) and never match. SF 5's "estar + estar + gerúndio" is dropped: it is not a construction anyone writes, so the reading is narrowed to *ir + estar + gerúndio* (a narrowing, listed in "Deviations from SF 5"). **Chains:** a sentence with 3 or more base gerunds gives one extra match spanning the sentence (kind `chain`); each gerund still counts as a base match. |
| Q19 | Name variants: how close, and how do they stay off inflections? | **Flag a token only when all hold:** it is capitalized; it is not a listed name; its `"name"` stem differs from every name's `"name"` stem; it is not in `Ignorar` or the stop words; the same word does not appear lowercased elsewhere in the note (so *Teu* at a sentence start doesn't flag against *Teo*); and its case-folded distance to a name is within the limit for the name's length: **3 letters or fewer**, only an adjacent transposition or one doubled or undoubled letter (*Aan*, *Anna*, *Teeo*; never *Asa* or *Leo* against *Ana* or *Teo*); **4–5 letters**, Damerau–Levenshtein ≤ 1; **6 or more**, ≤ 2. This narrows SF 5's "edit distance 1–2" for short names. The limits are fixed in code, not a setting (rule 3). The rule takes `names: string[]` as an option and never reads the list note, so U 1.4 can feed it universe entries. |
| Q20 | Long sentences. | **More than N words (default 45), dialogue included**, one match per sentence spanning it. |
| Q21 | "Ignore here" dismissals: key, undo, renames? | **Key: rule + normalized matched text + up to 3 normalized words on each side** (NFC, case-folded), read from the live document at the match's current (mapped) offsets. A match is dismissed when a record with the same four fields exists for its note. Stored in `data.lensDismissed[path]`, capped at 500 per note (oldest dropped). They follow renames through `plugin.index.follow` (`renameKeys`, concatenating and de-duplicating on a collision), drop on delete, and are pruned on layout ready. Dismissed matches are left out of everything: marks, counts, rates and stepping (task 2.4's `withoutDismissed`). Undo: the panel shows "N ignored · Clear" for the note (an addition beyond SF 5). Dismissing is offered from the editor's context menu on a match and from the panel while stepping. |

**Measures and text handling**

| # | Question | Recommendation |
|---|---|---|
| Q22 | SF 5 says "compute in the view plugin only for the visible range plus a cached full pass for the panel". Echoes need context outside the viewport. | **One debounced full pass (400 ms after the last change on desktop, 800 ms when `Platform.isMobile`), and decorations built only for the visible ranges from it.** The session owns a version counter per path and caches the last pass with the text it was computed from; the same text never recomputes, so stepping and toggling reuse the cached pass. Between passes, the last result's matches are mapped through the edits (`ChangeSet.mapPos`) so underlines don't jump, and every consumer of a position (marks, stepping, the context menu, dismissals) reads that mapped list, never stale offsets. The pass keeps its intermediates (mask, tokens, sentences, dialogue ranges, syllables per token), so selection measures slice them instead of re-reading the note. Zero work while the lens is off. Two performance checks: a CI ceiling on the 10,000-word fixture to catch quadratic code, and a local budget (Risk 3). |
| Q23 | Which text does the lens read? | **The reader mask** (task 1.4): `md.masked()` with link targets, embeds, image targets, URLs, tags, heading, list and quote marks blanked to spaces, offset for offset. Wikilink aliases and link texts stay as words, as in `proseOnly`. On top of it, the lens's `readMask` (task 3.1) blanks whole heading lines, `$$` math blocks (through `editor/context.blockStateIn`; math is an editor overlay, not a segmenter span), and, with "Skip quotes" on (the default), whole `>` lines (quotes, callouts); epigraphs aren't the writer's sentences. So headings are never sentences, never rule targets and never in the denominator. |
| Q24 | Do the lens counts agree with the word count? | **Every lens number comes from one token list** over the lens mask with the shared word rule (`wordRegex`, core/wordcount.ts:11). Rates, dialogue share and readability use the same denominator ("words the lens read"), so the share can't pass 100%. The panel shows no word count of its own (the status bar has one); a small difference from the status bar (headings, skipped quotes, `$$` blocks) is expected and documented. |
| Q25 | Dialogue share. | **Speech words / words read, over `dialogueInDoc(md, 0, last, {quoteStyle, paragraphStyle})`** (editor/dialogue.ts:192), with the writer's settings. Per scene: split at `isSceneBreakAt` (core/markers.ts:120), shown only when the note has more than one scene, as "Cena 1 · 62%". |
| Q26 | Readability bands and limits. | **pt (Martins et al. 1996, `248.835 − 1.015·ASL − 84.6·ASW`): four bands**, 75–100 muito fácil, 50–75 fácil, 25–50 difícil, 0–25 muito difícil. **en (Flesch, `206.835 − …`): seven bands**, 90+ very easy, 80 easy, 70 fairly easy, 60 standard, 50 fairly difficult, 30 difficult, below 30 very difficult. The shown score is clamped to 0–100; tests pin the raw value. Shown as "—" under 100 words or 3 sentences, and off when there is no language (Q8). Dialogue is included. The panel says what the band means, not a grade to chase. |
| Q27 | Syllables: pt rising sequences (*histó-ri-a*, *sé-ri-e*) as 1 or 2? | **2, the dictionary split.** Pinned in tests and stated in ARCHITECTURE. The counters are approximate on purpose (about 95% exact on running text). |
| Q28 | The sentence splitter. | **Our own, not `Intl.Segmenter`** (ICU differs across Electron, iOS and Android, and knows nothing of travessão tags), in `src/core/sentences.ts` so U 1.2 (titles like *Dona*, *Dr.*) and U 1.3 (capitalized words not at a sentence start) reuse it without importing the lens. A sentence ends at `. ! ? …` (and runs like `?!`, `...`) plus trailing closers (`" ” ’ » ) * _`), when followed by whitespace and an uppercase letter, an opening quote or dash plus uppercase, or the end of a paragraph. Blank lines, headings and scene breaks always end one. A single line break ends one unless the previous line has no closing mark and the next starts lowercase. A dash after a closing mark followed by a lowercase word continues the sentence (`— Vamos? — perguntou ela.`); followed by a capital, a new one. `…` before lowercase does not end. Abbreviations per language (pt: *Sr. Sra. Srta. Dr. Dra. Prof. Profa. D. Sto. Sta. Av. pág. p. pp. vol. cap. nº etc.*…; en: *Mr. Mrs. Ms. Dr. Prof. St. Jr. vs. etc. e.g. i.e. a.m. p.m.*…), single-capital initials and numbers (`3.5`, `1.000`) never end one. With no language (Q8), only the shared rules and initials apply. |

**Surface**

| # | Question | Recommendation |
|---|---|---|
| Q29 | How long does "on" last, and how does the panel behave? | **Per note, per session, never saved, following renames, exactly like dialogue focus.** "Toggle revision lens" turns it on for the active note and opens or reveals the panel (`escrita-lens`, right sidebar). The panel follows the active note and shows a short prompt with a "Turn on" button when the lens is off for it. In Reading view the command shows a Notice, as dialogue focus does. No default hotkeys. |
| Q30 | The selection, and stepping. | **The measures switch to the selection, labelled "Selection"; the rule counts stay whole-note**, so stepping has one stable list. Clicking a rule's step button selects the next match after the cursor (wrapping), scrolls it to the centre and shows "3 / 12"; a second button steps back. Two commands, "Next revision lens match" and "Previous revision lens match" (no hotkeys, usable from the mobile toolbar), step the most recently chosen rule (echoes until one is chosen). On a phone (`Platform.isPhone`) the right drawer closes after a step button is tapped, so the match is visible. Stepping changes only the selection (rule 2). The two commands are an addition beyond SF 5. |
| Q31 | Runtime dependencies or vendored lists? | **None.** Stemmers, syllable counters, the splitter and every list are written by hand from the published algorithms (Orengo & Huyck 2001, Porter2, Martins et al. 1996). No NLTK or Snowball files are copied, so the esbuild banner (esbuild.config.mjs:9-10) and `THIRD_PARTY_NOTICES.md` don't change. |
| Q32 | The sample conto fixture: the author's or an original? | **Original texts written for the tests**: `tests/fixtures/lens/conto.pt.md` (about 1,500 words, pt-BR, dash dialogue, two scenes, a quote) and `essay.en.md` (about 800 words), plus a generated 10,000-word file built in the test from the conto. The repo is public and the author's two contos in `Contos/` are drafts. The author may swap in his own later. |
| Q33 | Does the lens module import the editor's pure `dialogue.ts` and `context.ts`? | **Yes, read-only**, with a note in ARCHITECTURE. Both are pure and SF 5 names `dialogueInDoc`. The universe won't need them, so they don't move to core. Tasks in 0.5 must not change the signatures of `dialogueInDoc`, `blockStateIn`, `inBlock` or `bodyLineIn`. |
| Q34 | The improvement's scope: also `outline/beats-edit.isBreak`? | **Yes.** `core/markers.bodyStartLine` is named among the wrappers to remove, but it has two production callers in `outline/beats-edit.ts` (:33, :193), so it can only go with the `isBreak` loose end (task 2.6). It changes one behaviour (a `---` inside code or a comment no longer counts as a break next to a beat) and gets its own changelog line. The unclosed `<!--` publish check, the classifier fake and the Markdown parity questions stay open. |
| Q35 | Colors for six rules? | **Obsidian color variables at low alpha** (`--color-orange`, `--color-yellow`, `--color-blue`, `--color-purple`, `--color-cyan`, `--color-pink`), dotted or dashed underlines that never look like the spellcheck squiggle; long sentences get a faint background tint instead of an underline, so they don't stack under word marks. A left bar is out: it needs a line decoration, and the lens uses marks only (Risk 7). Decided in G1a. |

## Deviations from SF 5

Every place this plan narrows, extends or reads SF 5 differently. Task 5.2 writes
each SF 5 edit; the author confirms them in G2.

| Ref | Kind | What changes | SF 5 edit at release |
|---|---|---|---|
| Q1 | reading | `stem(word, lang, profile)` with `"word"` and `"name"` | "One interface, `stem(word, lang, profile)`; `"name"` is the light profile for people and places." |
| Q2 | narrowing | No pt noun-suffix step | Drop "noun" from the Portuguese step list; say why (*casa/casamento*). |
| Q3 | narrowing | English stops at Porter2 1c plus `-ly` | Replace "common noun and verb suffixes" with the shipped steps. |
| Q4 | narrowing | `"name"` skips the feminine step | One sentence: names keep *Mariano/Mariana* apart. |
| Q8 | reading | Locales other than pt and en give no language | Add the "Choose a language" state to the language sentence. |
| Q11 | addition | Command "Create the word lists note" with starter lists | Add the command to "User lists in the vault". |
| Q13 | reading | Crutch phrases match exactly, no stemming | One sentence under the rules table. |
| Q16 | reading | `-mente` needs 3 letters before it; *mente, semente, demente, ente* fall out by length | Rewrite the adverb exceptions cell. |
| Q18 | narrowing | Gerundismo is *ir + estar + gerúndio* only; *estar + estar* dropped; enclitic gerunds count | Rewrite the gerund cell. |
| Q19 | narrowing | Distance by name length (≤3: transposition or doubled letter; 4–5: ≤1; 6+: ≤2), plus the lowercase-elsewhere condition | Rewrite the name variants cell. |
| Q21 | addition | "N ignored · Clear" undo per note | Add to "Dismissing". |
| Q22 | reading | One debounced full pass, visible-range marks, mapped between passes | Rewrite the performance sentence in "Done when". |
| Q30 | addition | "Next / Previous revision lens match" commands; the phone drawer closes on a step | Add to "How it works". |
| Q32 | reading | Original fixture texts, not the author's conto | Rewrite the fixture note in "Done when". |
| G1 | addition | "Open settings" button in the no-language state; on a phone a step shows a Notice ("Gerúndios · 2 / 9"); the Clear confirm ("Show the 2 ignored matches in this note again?", Cancel / Show); the context menu header "<rule>: <word>" and the "per 1,000 words" column header | Add to "Language", "How it works" and "Dismissing". |
| G3 | narrowing | English plural `-es` after x, z, ch, sh; Porter2's final-`e` rule | Name both in the English stemmer bullet. |
| Inferred names | narrowing | Words the note capitalizes in mid-sentence count as names for echoes and gerunds (a sentence-initial *Fernando* is not a gerund) | Add to the echoes and gerunds cells. |
| Rule signature | reading | SF 5 says each rule is `(text, options) → Match[]`; rules take tokens and sentences built once per pass (2.1, 2.2), and `analyze(md, options)` is the text-level function | Rewrite the "Pure, tested" sentence. |

## Scope

0.5 ships three things:

- **Stemmers** in `src/core/stem/`: Portuguese (RSLP-derived) and English (Porter2
  light), one `stem(word, lang, profile)` interface with `"word"` and `"name"`
  profiles, `splitClitic` for pt, and shared stop words. They don't import the lens or
  `obsidian`; the universe (U 1.2, U 1.4, 0.7) will reuse them.
- **The revision lens** in a new `src/lens/` module: the command "Toggle revision
  lens", editor underlines for six rules (echoes, adverbs, gerunds, crutch words,
  name variants, long sentences), a side panel with measures (dialogue share, per
  scene too; readability with its band) and rule counts per 1,000 words with
  stepping, "ignore here" dismissals, a word lists note, and a "Revision" settings
  section.
- **Shared core pieces** the universe will also use: a token list with offsets
  (`core/tokens.ts`), an offset-preserving reader mask (`core/wordcount.ts`), and the
  sentence splitter with its abbreviation lists (`core/sentences.ts`, for U 1.2's
  titles and U 1.3's "not at a sentence start").

**Additions beyond SF 5** (small, each in "Deviations from SF 5"): the command "Create
the word lists note" (Q11), the "N ignored · Clear" undo (Q21), the "Next / Previous
revision lens match" commands (Q30), and the "Choose a language" state (Q8).

The improvement is the 0.2.1 loose ends (IMPROVEMENTS.md, "Loose ends from 0.2.1"):
remove the compatibility wrappers (`editor/context.blockStateAt`, `bodyStart`,
`inProperties`, `core/markers.bodyStartLine`), `insertSceneBreak` on the segmenter,
`enter-flow` reading the `Markdown` directly, and, with `bodyStartLine`,
`outline/beats-edit.isBreak` on `isSceneBreakLine` (Q34). The lens adds another
editor decoration over the same segmentation.

**Out of scope:** passive voice, said-bookisms, repeated sentence starts, stem
matching of crutch phrases, a per-note language, languages other than pt-BR and en,
book-wide measures (N 10, after 1.0), inline `$…$` math, the unclosed `<!--` publish
check, the classifier fake, the Markdown parity questions (D6, D7, D9, D14 stay as
pinned), moving the measurer and explorer onto the vault index.

The author's vault settings (`~/projects/website/escrita/.obsidian/plugins/escrita/data.json`)
that matter here:

- `quoteStyle`: `curly`; `paragraphStyle`: `single` (dialogue share reads them).
- Obsidian in Portuguese, so `"auto"` gives pt-BR; the release sets `lensLanguage:
  "pt-BR"` explicitly anyway.
- No `Modelos/Revisão.md` yet. The release creates it with "Create the word lists
  note" and sets `lensListsNote: "Modelos/Revisão.md"`.
- `excludeFolders`: `Modelos`, `Arquivo`. The lens works in any Markdown note,
  tracked or not; exclusion is a goals concept.

## Gates (before building)

**G1. Design canvas mockups** (rule 7), on
https://claude.ai/artifact/DGww2xWiadXRuWqVv2jFv6. The author approves them before
the gated tasks start: G1a gates 4.1, G1b gates 4.2, G1c gates 4.3, and G1a also
gates the context menu in 5.1. **Nothing in waves 0–3 waits on them**: every pure
file, the session, the panel model, the wiring and the improvement are built first.
The visual comparison against the approved artboards happens in 5.1b, once the
views are registered.

- **G1a. Editor marks** (artboards 9–10):
  - a paragraph of the pt fixture in Live Preview and in Source mode, light and dark,
    with all six rules showing at once;
  - one style per rule (Q35): the echo pair (the later occurrence plus its fainter
    `related` range), an adverb inside a long sentence (the sentence's background
    tint and the word's underline don't fight), a gerundismo spanning three words, a
    gerund chain;
  - the current match while stepping (a stronger mark, no flash);
  - next to a spellcheck squiggle and a dialogue-focus dim, so they stay distinct;
  - the editor context menu on a match: "Ignore here" / "Ignorar aqui", with the
    rule name as a disabled header line ("Eco: *olhar*").
- **G1b. Lens panel** (artboards 11–14):
  - the panel for a note: a "Measures" block (dialogue share as a percentage with
    a thin bar, the per-scene list when there are scenes; readability score, band
    and a one-line meaning; average sentence length and syllables per word), then
    the rule rows: a color key, the rule name, the count, the rate per 1,000 (one
    decimal), and step buttons with "3 / 12"; rules that are off are left out;
  - the selection state ("Selection · 312 words" heading over the measures);
  - empty states: the lens off for this note (prompt plus "Turn on"), no word lists
    note (the crutch and name rows say "Add a word lists note" with a "Create" link),
    the lists note set but missing ("Word lists note not found"), no language for
    this locale ("Choose a language in settings", Q8), a short note (readability "—"
    and why), a non-Markdown active view;
  - the "N ignored · Clear" line and its confirm;
  - the Notice texts: Reading view, the lists note already exists, the lists note
    created;
  - a 300px sidebar, a 375px phone (right drawer, 40px targets, the drawer closing
    after a step, the two step commands on the mobile toolbar), hover and
    focus-visible.
- **G1c. Settings "Revision" section** (artboard 15): language dropdown
  (Automatic / Português (Brasil) / English), word lists note path with a "Create"
  button, echo window and long sentence numbers, one toggle per rule, "Skip quotes",
  "Show dialogue share", "Show readability"; light, dark and mobile.
- **G1d. Starter word lists note** (text only, approved with G1): the pt-BR and en
  content written by "Create the word lists note" (Q11).

**G1 approved 2026-10-02** (canvas artboards 9–14, row "0.5 · Revisão"), with three
additions the author asked to keep. Task 4.2 owns their strings and 5.1 wires them:
- the no-language state (artboard 11e) has an "Open settings" / "Abrir configurações"
  button that opens Escrita's settings tab;
- on a phone, a step shows a short Notice with the rule and position
  ("Gerúndios · 2 / 9"), since the drawer that holds the counter has closed (artboard 12.3);
- the Clear confirm reads "Show the 2 ignored matches in this note again?" /
  "Voltar a mostrar as 2 ocorrências ignoradas nesta nota?", buttons "Cancel" / "Show"
  ("Cancelar" / "Mostrar") (artboard 11h).
Also from the artboards: the context menu header is "<rule singular>: <matched word>"
("Advérbio: lentamente"); the rate column header is "per 1,000 words" / "por 1.000
palavras"; rule rows show count, rate, and previous / next buttons, with "2 / 9" and
"Ignore here" under the row being stepped. Add these three to "Deviations from SF 5"
at release.

**G2. Author decisions.** The questions at the top of this file and the "Deviations
from SF 5" table. Q2, Q3, Q8, Q9, Q11, Q18, Q19, Q22 and Q32 change or read the spec
most and need an explicit answer.
**Answered 2026-10-02: the author accepted every recommendation and the deviations table as written.**

**G3. Fixture check** (before 3.1 pins snapshots). The author checks
`tests/fixtures/syllables/pt-BR.tsv` against a dictionary split and reads
`tests/fixtures/stem/pt-*.tsv` for any pair that looks wrong. Task 0.2 writes these
expected values before the code exists; G3 can run any time during waves 1–2.

**G3 answered 2026-10-02.** The author accepted: `viagem` corrected to 3 syllables
(the only fixture row changed); `disse`/`dizendo` stay both stop words and clitic
merge rows (the narrow exemption in `tests/lens-rules-stem.test.ts` stays); the
English stemmer's `-es` after x/z/ch/sh and Porter2's final-e step are accepted (list
them in "Deviations from SF 5"); *bola/bolo*, *sede/seda*, *ponto/ponta* stay apart.
Fixtures are frozen from here.

## Ownership rules

- No two tasks in a wave touch the same file.
- Shared core files (`src/core/*`, `main.ts`, `settings.ts`, `data.ts`, `strings.ts`,
  `i18n.ts`) change only in tasks marked **[core]**. Each new core file is owned by
  one task per wave. `src/core/stem/*` and `src/core/sentences.ts` are new shared
  core.
- A task may import a type or stub that wave 0 created, or any file that existed at
  the start of its wave; it may not import anything a task in its own wave creates
  or changes the signature of.
- Fixture rows written by task 0.2 are frozen: a later task may add rows but never
  change or delete one. A row that looks wrong goes to the author (G3), not into a
  silent fix.
- `src/lens/*` files without `obsidian` or CodeMirror imports stay that way (they are
  tested in vitest with no mocks); they may not import `src/i18n.ts`. They return
  codes and numbers; the view translates (the `move-blocks` refusal pattern).
- `tests/markdown-consumers.test.ts` has one owner per wave (1.9 in wave 1, 2.6 in
  wave 2).
- Every task runs `npm run typecheck && npm test` before calling itself done.

## Wave 0: contracts and fixtures

**0.1 [core] Types and stubs**, one agent, effort S. It writes the types below and
`throw new Error("todo")` stubs for functions later tasks fill in. It changes no
behaviour. Done when typecheck and the existing tests pass.

Files: create `src/core/stem/index.ts`, `src/core/stem/pt.ts`, `src/core/stem/en.ts`,
`src/core/stem/stopwords.ts`, `src/core/tokens.ts`, `src/core/sentences.ts`,
`src/lens/types.ts`, `src/lens/analyze.ts`, `src/lens/index.ts` (`LensModule` with its
public surface, stubbed); change `src/core/wordcount.ts` (a `readerMask` stub only),
`src/settings.ts` and `src/data.ts` (additive fields only), `src/main.ts` (the field
declaration and a `lensDismissed: {}` default in the `loadAll` literal,
main.ts:134-140; 3.2 later swaps in `cleanDismissed(raw.lensDismissed)`).

`src/core/stem/index.ts` (filled here, it is small):

```ts
export type StemLang = "pt" | "en";
export type StemProfile = "word" | "name";
/**
 * NFC, lowercase, ’ → ', then the language's steps. An opaque key: compare for equality only.
 * The key is case-folded: a case-sensitive caller compares the raw token's casing first
 * and uses stem only for inflection.
 */
export function stem(word: string, lang: StemLang, profile: StemProfile = "word"): string;
export function normalizeWord(word: string): string;   // NFC, toLowerCase(), ’ → '
export function clearStemCache(): void;                 // for tests
// memo: one Map per (lang, profile), cleared past 20,000 entries
```

`src/core/stem/pt.ts`, `en.ts`: `stemPt(w: string, profile: StemProfile): string`,
`stemEn(...)` (input already normalized), stubs. `pt.ts` also exports
`splitClitic(normalized: string): { base: string; clitic: string | null }` (Q6), stub.

`src/core/stem/stopwords.ts`: `isStopWord(normalized: string, lang: StemLang): boolean`, stub.

`src/core/tokens.ts`:

```ts
export interface Token { from: number; to: number; text: string }
/** Words by the shared word rule (wordRegex), over text whose offsets match the document. */
export function tokens(text: string, from?: number, to?: number): Token[];
/** Normalized word sequences, for phrase matching (crutch phrases, later universe names). */
export function findPhrase(toks: readonly Token[], phrase: readonly string[], norm: (s: string) => string): { i: number; j: number }[];
```

`src/core/sentences.ts`:

```ts
export interface Sentence { from: number; to: number }
export const ABBREVIATIONS: Record<StemLang, ReadonlySet<string>>;
/** `lang` null: the shared rules and initials only, no abbreviation list (Q8, Q28). */
export function sentences(mask: string, md: Markdown, lang: StemLang | null, from?: number, to?: number): Sentence[];
```

`src/core/wordcount.ts`: `export function readerMask(md: Markdown): string;` (stub).

`src/lens/types.ts`:

```ts
export type { Sentence } from "../core/sentences";
export type LensLang = "pt-BR" | "en";
export const RULES = ["echo", "adverb", "gerund", "crutch", "name", "long"] as const;
export type RuleId = typeof RULES[number];
/** Rules and measures that need a language; off when lensLang gives null (Q8). */
export const LANG_RULES: ReadonlySet<RuleId>;   // echo, adverb, gerund
export type MatchKind = "base" | "gerundismo" | "chain" | "started";
export interface Match {
  rule: RuleId;
  kind: MatchKind;
  from: number; to: number;        // document offsets
  text: string;                    // the matched text as written
  related?: { from: number; to: number };  // echoes: the earlier occurrence
}
export interface Lists { crutch: string[]; names: string[]; ignore: string[] }
export interface Lexicon {
  adverbExceptions: readonly string[];
  gerundExceptions: readonly string[];   // pt only; [] for en
  irForms: readonly string[];            // pt gerundismo auxiliaries: forms of ir only (Q18)
  estarForms: readonly string[];
  startedForms: readonly string[];       // en
}
export interface RuleOptions {
  lang: LensLang | null;                 // null: language rules off (Q8)
  rules: ReadonlySet<RuleId>;
  echoWindow: number;
  longSentence: number;
  lists: Lists;
}
export interface ReadOptions {           // what the lens reads
  skipQuotes: boolean;
  quoteStyle: QuoteStyle;                // import type from ../settings
  paragraphStyle: ParagraphStyle;
}
export interface SceneShare { from: number; to: number; words: number; speech: number }
export interface Readability { asl: number; asw: number; raw: number; score: number; band: string }  // band: a code ("veryEasy", "easy", …), translated by the view
export interface Measures {
  words: number;                 // words the lens read in the range
  speech: number;
  scenes: SceneShare[];          // [] when one scene
  sentences: number;
  syllables: number;
  readability: Readability | null;  // null under 100 words or 3 sentences, or with no language
}
/** One pass's intermediates, kept so selection measures slice them (Q22). */
export interface LensPass {
  mask: string;
  tokens: readonly Token[];
  sentences: readonly Sentence[];
  speech: readonly { from: number; to: number }[];   // dialogue ranges, sorted
  syllables: Uint16Array;                             // per token, parallel to tokens
}
export interface LensResult {
  version: number;               // the session's per-path version it was computed for (2.5)
  matches: Match[];              // sorted by from, then rule order; dismissals not applied
  counts: Record<RuleId, number>;
  words: number;                 // denominator for rates
  measures: Measures;            // whole note
  pass: LensPass;
}
export interface Dismissal { rule: RuleId; text: string; before: string; after: string }
```

`src/lens/analyze.ts` (stubs, filled by 3.1):

```ts
export interface AnalyzeOptions extends RuleOptions, ReadOptions {}
export function readMask(md: Markdown, o: ReadOptions): string;
export function analyze(md: Markdown, o: AnalyzeOptions, version?: number): LensResult;
export function measuresFor(pass: LensPass, md: Markdown, o: AnalyzeOptions, range: { from: number; to: number }): Measures;
export function visible(matches: readonly Match[], from: number, to: number): Match[];
```

`src/lens/index.ts`: `class LensModule implements EscritaModule` with an empty `load`
and these public methods, stubbed (no-ops, or `undefined` results) until 3.2 and 5.1
fill them, so 4.2 and 4.3 build against a written contract:

```ts
lists(): Lists;
activeState(): { path: string | null; on: boolean; lang: LensLang | null; result: LensResult | undefined; selection: Measures | null; listsState: "ok" | "unset" | "missing" };
turnOn(path: string): void;
step(rule: RuleId, dir: 1 | -1): void;
clearDismissed(path: string): void;
dismissedCount(path: string): number;
createLists(): Promise<void>;
```

Additive fields:

- `EscritaSettings`: `lensLanguage: "auto" | "pt-BR" | "en"` (`"auto"`),
  `lensListsNote: string` (`""`), `lensEchoWindow: number` (40),
  `lensLongSentence: number` (45), `lensRulesOff: string[]` (`[]`; an array so
  `mergeDefaults` copies it and a future rule starts on), `lensSkipQuotes: boolean`
  (true), `lensShowDialogue: boolean` (true), `lensShowReadability: boolean` (true).
- `EscritaData.lensDismissed: Record<string, Dismissal[]>` (default `{}`).
- Plugin field: `lens!: LensModule`.

**0.2 Expected values for the stem and syllable fixtures**, a different agent from
1.1, 1.2 and 1.6, effort S–M. Runs in parallel with 0.1 (no shared file).

- Create `tests/fixtures/stem/{pt,en}-{merge,split,name-merge,name-split}.tsv` and
  `tests/fixtures/syllables/{pt-BR,en}.tsv`, each with a header comment saying where
  its values come from.
- Stem fixtures are linguistic, not tuned to any code: merge groups are words a
  reader would call the same word for echoes (`"word"`) or the same person
  (`"name"`); split pairs are words that must stay apart. Sizes and must-have rows
  as listed in 1.1 and 1.2, including *Mariano Mariana* in pt-name-split.
- Syllable values come from a dictionary split (pt: the hyphenation in a cited
  dictionary, with Q27's rising sequences as 2; en: a cited dictionary's
  hyphenation), at least 300 pt words (at least 15 per rule category in 1.6) and
  600 en words.
- Done when the files parse (one group per line, tab-separated; syllables `word\tn`)
  and the author has the G3 link. The rows are then frozen (Ownership rules).

## Wave 1: pure foundations (parallel)

**1.1 [core] Portuguese stemmer**, effort M
- Fill `src/core/stem/pt.ts` (`stemPt` and `splitClitic`); create
  `tests/stem-pt.test.ts`. May add rows to the pt fixtures from 0.2, never change one.
- `"word"` profile per Q2 and Q6: clitic split, plural, feminine, adverb (`-mente`),
  augmentative/diminutive, verb suffix, vowel removal, accent removal. Each rule has
  a minimum stem (3 characters) and an exceptions list, written out from Orengo &
  Huyck (2001), not copied from NLTK.
- `splitClitic`: the last hyphen followed by one known clitic (Q6) gives
  `{ base, clitic }`; anything else gives `{ base: input, clitic: null }`.
  `stemPt` uses it as its first step.
- Diminutives restore spelling: `-quinho` → `-co`, `-guinho` → `-go`, `-zinho/-zinha`
  after a vowel, nasal, `l` or `r`, `-inho/-inha` after a consonant; `-ito/-zito`
  behind exceptions. Mandatory `-inho/-inha` exceptions: *caminho, vizinho, linha,
  cozinha, rainha, farinha, marinho, pinho, vinho, ninho, espinho, carinho, padrinho,
  madrinha, focinho, moinho, sardinha, bainha, galinha, campainha, andorinha,
  adivinho, mesquinho*. `-ão` exceptions: *mão, pão, chão, irmão, coração, não,
  então, cão, grão, são*. `-ona`: *dona, zona, poltrona*.
- `"name"` profile per Q4.
- Fixtures (from 0.2): merge at least 150 groups (*olhar olhou olhando olhares*;
  *Maria Mariazinha*; *menino meninos menina* in `"word"`; *pouco pouquinho*; *amigo
  amiguinho*; *gato gatinho*; *café cafezinho*; *olhou-me olhou*). Split at least 100
  pairs (*Maria Mário*, *casa casamento*, *mente mentir*, *porto porta*, *linha
  lindo*, *caminho caminhar*, *vinho vir*, *Ana ano* in `"name"`, *Teo Teodoro*,
  *Rosa roso*, *Mariano Mariana* in `"name"`).
- Tests: every merge group shares one key, every split pair differs, for each
  profile; idempotence (`stem(stem(w))` merges with `w` where documented); no
  exception throws on empty, one-letter, digit and hyphen-only tokens; NFD input;
  `splitClitic` on *dizendo-lhe*, *olhando-a*, *guarda-chuva* (no clitic), *dir-se-ia*
  (only the last part).

**1.2 [core] English stemmer**, effort S–M
- Fill `src/core/stem/en.ts`; create `tests/stem-en.test.ts`. May add rows to the en
  fixtures from 0.2, never change one.
- `"word"` per Q3, with Porter2's special words (*skis, dying, lying, tying, news,
  howe, atlas, cosmos, bias, andes*), R1 exceptions (*gener, commun, arsen*) and
  Y-as-consonant handling. `"name"` per Q4.
- Fixtures (from 0.2): merge at least 120 groups (*walk walks walked walking*; *Teo
  Teo's Teo’s Teos* in `"name"`; *hope hoped hoping*; *stop stopped stopping*; *quick
  quickly*); split at least 80 pairs (*news new*, *universe university*, *James Jame*
  in `"name"`, *Agnes agn*).
- Tests as in 1.1, plus contractions are left whole.

**1.3 [core] Stop words**, effort S
- Fill `src/core/stem/stopwords.ts`; create `tests/stem-stopwords.test.ts`.
- Hand-written lists, 150–250 words per language: articles, pronouns, prepositions
  and contractions (*do, da, no, na, pelo, num, dum*), conjunctions, common forms of
  *ser, estar, ter, haver, ir, fazer, dizer* (pt) and *be, have, do, say, go* (en),
  English contractions. Stored as normalized `Set`s.
- Tests: membership is normalized (NFD *não*, *Não*); the said-verbs (*disse*,
  *said*) are stop words. (The cross-check against the merge fixtures lives in 2.2.)

**1.4 [core] Tokens and the reader mask**, effort S–M
- Fill `src/core/tokens.ts` and `readerMask` in `src/core/wordcount.ts`; create
  `tests/tokens.test.ts` and `tests/reader-mask.test.ts`.
- `readerMask(md)`: start from `md.masked()` and blank to spaces, same length,
  line breaks kept: embeds, images, wikilink targets (`[[`, the target and `|`,
  and `]]`; the alias or bare target text stays), markdown link brackets and
  `(url)`, bare URLs, scene-break and rule lines, quote and callout marks, heading
  marks, list and task marks, tags. Heading text stays (it is in the word count);
  the lens blanks it in 3.1.
- Refactor `stripMarkup` (wordcount.ts:38-51) and `readerMask` onto **one ordered
  table of patterns** so they can't drift. Entry shape:
  `{ re: RegExp; keep?: number /* the capture group kept as text */ }`.
  `stripMarkup` replaces a match with its kept group (or `" "` when there is none),
  exactly as today; `readerMask` blanks every character of the match outside the kept
  group to a space, keeping `\n` and `\r`, so offsets don't move. Order matters
  (embeds and images before wikilinks and links). `stripMarkup`'s output must not
  change.
- `tokens(text, from, to)` runs `wordRegex()` and returns absolute offsets.
  `findPhrase` matches normalized token sequences, whole tokens only.
- Tests:
  - `readerMask(md).length === md.text.length` and every `\n` stays at its offset,
    over a dozen representative texts copied from the rows of
    `tests/markdown-consumers.test.ts` (copied, not imported), in LF and CRLF;
  - parity: `tokens(readerMask(segment(t))).length === countWords(t)` for those
    texts, with documented exceptions only;
  - `[[Maria|a moça]]` gives the tokens *a moça*; a bare `[[Contos/O porão]]` keeps
    its target text as words, as `proseOnly` does;
  - `Teo’s`, `guarda-chuva`, `olhou-me` are one token each; NFD letters stay inside
    a token;
  - `findPhrase` across a line break and double spaces; no partial-token match
    (*de repente* in *de repentemente*);
  - every existing wordcount test passes unchanged.

**1.5 [core] Sentence splitter**, effort M
- Fill `src/core/sentences.ts`; create `tests/sentences.test.ts`.
- Signatures from 0.1. Depends only on `Markdown` and a `StemLang | null`; it imports
  `isSceneBreakLine` from `core/markers` and nothing from `src/lens/`.
- `mask` is a reader mask (tests build one with a local helper over `md.masked()`;
  3.1 switches them to the real mask). Hard breaks come from `md`: blank lines,
  headings (`^#{1,6} ` on the raw line), scene breaks (`isSceneBreakLine`). Rules per
  Q28.
- Tests: about 100 hand cases, half per language, at least 3 per pitfall in Q28
  (ellipsis before lowercase and uppercase, travessão tags with `?` and `.`, `--`
  and `–`, unspaced em dash interruption, quotes `"Ready?" she asked.`,
  abbreviations, initials *J. R. R. Tolkien* and *D. Pedro*, numbers, `etc.` before
  a capital, emphasis around the closing mark, a footnote ref after it, soft-wrapped
  lines, CRLF), plus a few with `lang` null; ranges never overlap and lie inside the
  input.

**1.6 Syllables and readability**, effort M
- Create `src/lens/syllables.ts`, `src/lens/readability.ts`,
  `tests/lens-syllables.test.ts`, `tests/lens-readability.test.ts`. Reads the
  syllable fixtures from 0.2 and may add rows, never change one.
- ```ts
  export function syllables(word: string, lang: LensLang): number;   // ≥ 1; 0 for tokens with no letters
  export function readability(words: number, sentences: number, syllables: number, lang: LensLang): Readability | null;
  export const BANDS: Record<LensLang, readonly { min: number; band: string }[]>;
  ```
- pt rules: `qu`/`gu` before e/i silent, before a/o semivowel; falling diphthongs
  (`ai ei oi ui au eu iu ou ão ãe õe ãi`) count 1; hiatus counts 2 for accented
  `í/ú` after a vowel, V + `i/u` closed by `r l z m n` with no vowel after (*ra-iz,
  ju-iz, ca-ir, a-in-da*), identical vowels, two strong vowels; rising sequences
  after a consonant count 2 (Q27). en: vowel groups, silent final `e` (not `-le`
  after a consonant, not `ee`, not short words), `-es`/`-ed` rules, splitting pairs
  (`ia io eo ua uo`, *quiet*), a map of about 150 irregular words.
- Tests: pt 100% on the 0.2 fixture; en at least 95% exact plus 100% on the
  irregular map; readability formula values on synthetic counts for both languages,
  band edges (a score equal to a band's `min` belongs to that band, so 75 is muito
  fácil), clamping, the null thresholds. A pt row the code can't reach without
  breaking others goes to the author (G3), not into a changed fixture.

**1.7 Word lists and language**, effort S
- Create `src/lens/lists.ts`, `src/lens/lang.ts`, `tests/lens-lists.test.ts`.
- ```ts
  export function lensLang(setting: "auto" | "pt-BR" | "en", obsidianLang: string): LensLang | null;   // auto: pt* → pt-BR, en* → en, else null
  export function stemLang(l: LensLang): StemLang;
  export function parseLists(text: string): Lists;       // Q10
  export function listsPath(setting: string): string;    // Q14: trim, no leading/trailing "/", collapse "//", add ".md"; "" stays ""
  export function starterNote(l: LensLang): string;      // G1d text; until approved, the Q11 lists
  export function sameLists(a: Lists, b: Lists): boolean;
  ```
- Tests: both heading languages, any heading level, accents and case
  (`## vicios`), list markers `-`, `*`, `1.`, task boxes, blank lines, `%%` comments,
  frontmatter, an unknown heading's lines ignored, duplicates kept once, NFC; the
  starter note parses back to its own lists; `lensLang` for `pt`, `pt-br`, `pt-PT`,
  `en`, `en-GB`, `es`, `fr`, `""` with `"auto"` (es, fr and `""` give null), and an
  explicit setting wins over the locale; `listsPath` for `Modelos/Revisão`,
  `/Modelos/Revisão.md`, `Revisão.MD`, `""`, spaces.

**1.8 Dismissal keys**, effort S
- Create `src/lens/dismiss.ts` and `tests/lens-dismiss.test.ts`.
- ```ts
  export function dismissalOf(text: string, m: Match, words?: number /* 3 */): Dismissal;
  export function isDismissed(list: readonly Dismissal[] | undefined, d: Dismissal): boolean;
  export function addDismissal(list: Dismissal[], d: Dismissal, cap?: number /* 500 */): Dismissal[];
  export function mergeDismissals(moved: Dismissal[], existing: Dismissal[]): Dismissal[];  // concat, de-dup
  export function cleanDismissed(raw: unknown): Record<string, Dismissal[]>;   // drops wrong types and unknown rules
  ```
  `text` is the live document text and `m` carries offsets valid for it (the caller
  passes a mapped match, 4.1). Surrounding words come from `wordRegex()` over the
  plain text (not the mask), so the key does not depend on settings; normalized with
  `normalizeWord`.
- Tests: a dismissal survives an insertion before, after and two sentences away; it
  stops matching when a neighbouring word changes; the same text in two places with
  different neighbours is two keys; the cap drops the oldest; merge de-duplicates;
  `cleanDismissed` on junk; NFD and case.

**1.9 Editor loose ends** (LE1–LE3), effort S–M
- Change `src/editor/context.ts`, `src/editor/enter-flow.ts`, `src/editor/index.ts`
  (only `insertSceneBreak` at :185-198, the Enter handler at :217-222 and
  `removeTrailingBreak` at :284-299), `tests/editor.test.ts`,
  `tests/editor-fixes.test.ts` and `tests/markdown-consumers.test.ts` (editor
  columns only).
- Delete `blockStateAt` (context.ts:63-66), `bodyStart` (:76-79) and `inProperties`
  (:81-84). **Keep `bodyLineIn` (:68-74)**: `insertSceneBreak` and `dialogueInDoc`
  use it (Q33). Narrow `decideEnter`, `trailingBreakKeep` and `breakEdit` to
  `Markdown` only; delete the `Doc` union and `read()` (enter-flow.ts:63-74);
  `runStart` and the forward loop read `md.lineStart` / `md.lineEnd` for visited lines
  only. `isProseLine(string)` keeps its signature.
- `insertSceneBreak`: `cursor.line < bodyLineIn(segment(doc))` (it has an `Editor`,
  not a view). Keep the `bodyLineIn` meaning (an unclosed frontmatter counts as
  properties); do not reuse `move-blocks.inProperties`.
- The Enter handler passes `segmentDoc(state.doc)` to `breakEdit` instead of
  `state.doc.toJSON()`.
- The vault path of `removeTrailingBreak`: extract a pure function into
  `src/editor/enter-flow.ts` and call it from the `vault.process` callback:

  ```ts
  /** The text without its trailing scene break; the input itself when there is none. */
  export function withoutTrailingBreak(text: string): string {
    const md = segment(text);
    const keep = trailingBreakKeep(md);
    if (keep === null) return text;
    return keep > 0 ? text.slice(0, md.lineStart(keep)) : "";
  }
  ```

  This keeps the file's own line endings; it no longer rewrites a mixed LF/CRLF file
  to all CRLF. That is the second intended behaviour change of the release (Risk 6),
  with its own D-row in `tests/markdown-consumers.test.ts` and a changelog line.
- Tests switch to `blockStateIn(segment(s), i)`, `bodyLineIn(segment(s))` and a
  helper `D = (s) => segment(s)`. In the "editor entry points" parity test
  (markdown-consumers.test.ts:1383-1397), 1.9 removes the `trailingBreakKeep(lines)`
  and `decideEnter(el, …)` comparisons and leaves the `scanBeats` line alone (2.6
  owns it). **No other expected value moves**; one that moves is a behaviour change
  and needs a D-number and a changelog line. New tests of `withoutTrailingBreak` in
  `tests/editor.test.ts`: a CRLF file, a mixed LF/CRLF file (its endings kept), a text
  with no trailing break comes back unchanged (the same string), a text that is only
  a break gives `""`.
- Must not change `blockStateIn`, `inBlock` or `bodyLineIn` (Q33).

**1.10 Lexicons**, effort S
- Create `src/lens/lexicon.ts` and `tests/lens-lexicon.test.ts`.
- `export const LEXICON: Record<LensLang, Lexicon>;` filled per Q16, Q17 and Q18.
  `irForms` holds forms of *ir* only. Data only, normalized at load.
- Tests: no entry is empty or has surrounding spaces; every pt adverb exception ends
  in `-mente` with at least 3 letters before it (an entry the rule can't reach is
  dead data); every gerund exception ends in `-ndo`; no form of *poder* or *dever* in
  `irForms`; no duplicates; NFC.

**1.11 Fixture texts**, effort S
- Create `tests/fixtures/lens/conto.pt.md`, `tests/fixtures/lens/essay.en.md` and
  `tests/fixtures/lens/README.md` (what each fixture is for, and that the texts are
  original, written for the repo).
- The pt conto (about 1,500 words) is written to exercise every rule at least twice
  and avoid each at least once: echoes inside and across the window and across a
  scene break; `-mente` adverbs and the exceptions; gerunds (one with an enclitic,
  *dizendo-lhe*), a gerundismo, a *deve estar chegando* that must not match, a chain;
  crutch phrases from the starter list; a name (*Teo*, *Mariana*) with a typo variant
  (*Mariana/Marianna*) and an inflection (*Teozinho*) that must not flag; a 50-word
  sentence; dash dialogue with tags; an epigraph in `>`; a heading; a beat, a
  placeholder, a wikilink with an alias, a code span; two scenes. The en essay covers
  the English rules the same way.
- No test file in this task; 3.1 pins the results.

## Wave 2: pure models (parallel)

**2.1 Word rules**, depends on 1.1, 1.3, 1.4, 1.5, 1.10, effort M
- Create `src/lens/rules-words.ts` and `tests/lens-rules-words.test.ts`.
- ```ts
  export function adverbs(toks: readonly Token[], sents: readonly Sentence[], o: RuleOptions, lex: Lexicon): Match[];
  export function gerunds(toks: readonly Token[], sents: readonly Sentence[], o: RuleOptions, lex: Lexicon): Match[];  // pt base, gerundismo, chain; en started
  export function crutches(toks: readonly Token[], o: RuleOptions): Match[];      // via findPhrase, Q13
  export function longSentences(toks: readonly Token[], sents: readonly Sentence[], o: RuleOptions): Match[];
  ```
  Matches carry the rule id even when the rule is off; `analyze` (3.1) filters. In pt,
  the `-mente` and `-ndo` tests run on `splitClitic(normalizeWord(tok.text)).base`;
  the match spans the whole token. `adverbs` and `gerunds` return `[]` when
  `o.lang` is null.
- Tests: a pt and an en paragraph per rule with expected ranges (Q16–Q20), the
  exceptions, `Ignorar` (Q12; not for crutches), capitalized non-initial skips,
  gerundismo with one word between, *deve estar chegando* and *pode estar dormindo*
  give no gerundismo (only their base gerund), *dizendo-lhe* and *olhando-a* give one
  base match each spanning the whole token, a chain gives one sentence match plus
  the base ones, crutch across a line break, empty lists give no crutch matches,
  `lang` null gives no adverb or gerund matches.

**2.2 Stem rules: echoes and name variants**, depends on 1.1–1.4, effort M
- Create `src/lens/rules-stem.ts` and `tests/lens-rules-stem.test.ts`.
- ```ts
  export function echoes(toks: readonly Token[], breaks: readonly number[] /* offsets that reset the window */, o: RuleOptions): Match[];
  export function nameVariants(toks: readonly Token[], sentStarts: ReadonlySet<number>, o: RuleOptions): Match[];
  export function editDistance(a: string, b: string, max: number): number;   // Damerau–Levenshtein, early exit past max
  export function closeToName(word: string, name: string): boolean;          // Q19's limits by name length
  ```
  Rules per Q15 and Q19. `echoes` returns `[]` when `o.lang` is null; `nameVariants`
  runs without a language (it uses the `"name"` profile of `pt` only when `o.lang` is
  pt-BR, of `en` when en, and plain `normalizeWord` when null).
- Tests: *olhou … olhando* within 40 words is one match with `related`; at 41 words
  none; a scene break between resets; stop words, short stems, names and `Ignorar`
  ignored; three occurrences give two matches. Names: *Marianna* flags against
  *Mariana*; *Mariazinha* and *Teozinho* don't; *Teu* at a sentence start doesn't
  when *teu* appears lowercased elsewhere; `closeToName` split rows *Ana Asa*, *Teo
  Leo*, *Ana Ama*, *Teo Teu* (all false) and flag rows *Ana Anna*, *Ana Aan*, *Teo
  Teeo* (true), a 5-letter name at distance 1 (true) and 2 (false), a 7-letter name
  at 2 (true); an empty name list gives nothing; `editDistance` cases including a
  transposition.
- The stop-word cross-check moved here from 1.3: no word in a stop list is a
  must-match member of the `"word"` merge fixtures (`tests/fixtures/stem/*-merge.tsv`),
  since an echo can't fire on a stop word.

**2.3 Measures**, depends on 1.4, 1.5, 1.6, effort S–M
- Create `src/lens/measures.ts` and `tests/lens-measures.test.ts`.
- ```ts
  /** Builds the pass's speech ranges and per-token syllables once. */
  export function passExtras(md: Markdown, toks: readonly Token[], o: ReadOptions & { lang: LensLang | null }): Pick<LensPass, "speech" | "syllables">;
  /** Whole note, or a range by binary search over the pass; never re-reads the note. */
  export function measures(md: Markdown, pass: LensPass, o: ReadOptions & { lang: LensLang | null }, range?: { from: number; to: number }): Measures;
  export function sceneBounds(md: Markdown): { from: number; to: number }[];   // split at isSceneBreakAt
  ```
  Imports `dialogueInDoc` from `../editor/dialogue` read-only (Q33), called once per
  pass in `passExtras`. With a range, only tokens and sentences inside it count, and
  scenes are left empty. With `lang` null, readability is null and syllables are 0.
- Tests: share 0 with no dialogue and 100 for a note of only speech lines; dash
  dialogue with tags; `curly` and `off` quote styles; `single` and `blank`
  paragraph styles; per scene with two scenes and none with one; share never above
  100; a selection inside one paragraph agrees with a whole-note measure of that
  paragraph alone; readability null under the thresholds and with no language.

**2.4 Panel model**, depends on wave 0 types only, effort S
- Create `src/lens/panel-model.ts` and `tests/lens-panel-model.test.ts`.
- ```ts
  export function per1000(count: number, words: number): number;      // unrounded; 0 when words is 0. The view shows one decimal (4.2)
  /** The result the writer sees: matches minus dismissed ones, counts recomputed. */
  export function withoutDismissed(r: LensResult, keep: (m: Match) => boolean): LensResult;
  export function stepTo(matches: readonly Match[], rule: RuleId, cursor: number, dir: 1 | -1): { index: number; of: number; match: Match } | null;  // next after cursor, wrapping
  export interface RuleRow { rule: RuleId; kind: "on" | "needsLists" | "needsLanguage"; count: number; rate: number }
  export function ruleRows(r: LensResult, enabled: ReadonlySet<RuleId>, lists: Pick<Lists, "crutch" | "names">, lang: LensLang | null): RuleRow[];
  export function enabledRules(rulesOff: readonly string[]): Set<RuleId>;   // unknown ids ignored
  ```
  `withoutDismissed` is the one filtered view: the module (5.1) builds it per result
  and per dismissal change, and the panel rows, the rates, stepping and the marks all
  read it, never `LensResult.matches` directly.
- Tests: rate values; `withoutDismissed` lowers the count of the dismissed rule only,
  and `stepTo` over its matches skips the dismissed one ("2 / 2", not "2 / 3");
  stepping forward and back, wrapping, a cursor inside a match steps past it, one
  match, none; rows leave out disabled rules; `crutch` is `needsLists` when
  `lists.crutch` is empty and `name` when `lists.names` is empty, each independently;
  the language rules are `needsLanguage` when `lang` is null.

**2.5 Lens session**, depends on wave 0 types only, effort S–M
- Create `src/lens/session.ts` and `tests/lens-session.test.ts`. No obsidian or
  CodeMirror imports.
- ```ts
  export const LENS_SETTLE_MS = 400;
  export const LENS_SETTLE_MOBILE_MS = 800;
  export class LensSession {
    constructor(opts: {
      timers: IndexTimers;                                         // type from core/vault-index
      settleMs: number;                                            // the module picks by Platform.isMobile
      analyze: (text: string, version: number) => LensResult;      // injected; 3.1 provides it
    });
    isOn(path: string): boolean;
    toggle(path: string): boolean;                 // returns the new state
    renamed(oldPath: string, newPath: string): void;   // prefix-aware via path-keys
    deleted(path: string): void;
    changed(path: string, text: () => string): number;  // debounced per path; returns the version it assigned
    now(path: string, text: string): LensResult;        // immediate; reuses the cached result when text is unchanged
    result(path: string): LensResult | undefined;
    version(path: string): number;                 // the latest version assigned for the path
    invalidate(): void;                            // settings or lists changed: recompute open ones
    onResult(cb: (path: string, r: LensResult) => void): () => void;
    dispose(): void;
  }
  ```
  **Versions are owned by the session**, one monotonic counter per path, not by a
  view (CodeMirror has no document version, and two panes on one note would each
  invent their own). `changed` and `now` assign the next version; `LensResult.version`
  echoes it; a result whose version is below `version(path)` when it completes is
  dropped. The session caches the text each result was computed from; `now` (and a
  debounced run) with identical text returns the cached result without calling
  `analyze`, so stepping and repeated toggles cost nothing. `invalidate` clears the
  cache. Nothing runs for a path that is off.
- Tests with fake timers: a burst of changes gives one analyze call; off paths never
  analyze; two callers on one path (two panes) interleaving `changed` give one
  analyze with the latest text and a result at the latest version; `now` with
  unchanged text calls analyze zero times; rename moves on-state, the counter and a
  pending timer; delete forgets them; `invalidate` recomputes only on paths; a stale
  version is dropped; dispose clears timers; `settleMs` is honoured.

**2.6 [core] Outline loose end and `bodyStartLine`** (LE4), effort S–M
- Change `src/outline/beats-edit.ts`, `src/outline/model.ts` (the lines form of
  `scanBeats`, :158-160, goes), `src/core/markers.ts` (remove `bodyStartLine`,
  :39-42) **[core]**, `tests/outline.test.ts`, `tests/outline-note.test.ts` and
  `tests/markdown-consumers.test.ts` (the `bodyStartLine` and `scanBeats` columns;
  `bodyStartLine` becomes `bodyLine`, same values; and the `scanBeats(md)` vs
  `scanBeats(lines)` line of the "editor entry points" test, the only line of that
  test 1.9 left for 2.6).
- `split()` keeps `md = segment(text)` on its Doc with `body: md.bodyLine`;
  `isBreak(k)` (:71) becomes `isSceneBreakLine(doc.md, k)`; `parseBeats(doc.md)`
  replaces the `lines.join` re-parses (:82, :123, :140, :216); `isBlankBody`
  (:191-194) uses `segment(text).bodyLine`.
- New tests: insertBeat and removeBeat next to a fenced block holding `---` (the
  behaviour change, with a D-row in markdown-consumers); CRLF chapters; every
  existing outline test passes unchanged.
- Note: 2.6 is the only wave-2 task touching outline or markers. No lens task
  imports `bodyStartLine`.

## Wave 3: composition and wiring (parallel)

**3.1 Analyze and the fixture results**, depends on 2.1–2.3, 1.11 and G3, effort S–M
- Fill `src/lens/analyze.ts` (the 0.1 stub); create `tests/lens-analyze.test.ts`;
  switch `tests/sentences.test.ts` from its local mask helper to `readerMask` (3.1
  owns that file in wave 3).
- `readMask(md, o)`: `readerMask(md)`, then blank to spaces (offsets kept) whole
  heading lines (`^#{1,6} ` on the raw line, outside code and comments), `$$` blocks
  (`blockStateIn(md, line).math`), and, with `skipQuotes`, whole `>` lines.
- `analyze` builds the mask, tokens, sentences and the pass extras (2.3) once, runs
  only enabled rules (and none of `LANG_RULES` when `o.lang` is null), sorts, counts,
  and returns the `LensPass` with the result. It leaves dismissals to the caller
  (2.4's `withoutDismissed`, so a dismissal never needs a recompute). The echo
  window's `breaks` are the offsets of scene breaks and headings, taken from `md`.
- `measuresFor(pass, md, o, range)` slices the pass (2.3); it never re-segments or
  re-tokenizes.
- `visible` is a binary search over the sorted matches.
- Tests:
  - snapshot of `matches` (rule, kind, text, line) and measures for
    `conto.pt.md` and `essay.en.md`, so a change in any rule shows in review ("stable
    and explainable"); written only after G3;
  - readability raw values for both fixtures pinned;
  - a heading's words give no matches and are not in `words`; an echo across a
    heading does not fire;
  - **CI ceiling**: a 10,000-word note built from the conto runs `analyze` under a
    generous ceiling (300 ms on CI) and `visible` under 1 ms; `measuresFor` on a
    paragraph of it under 5 ms once the pass exists;
  - **local budget** (`it.skipIf(!!process.env.CI)`): the median of 5 `analyze` runs
    on the 10,000-word note under 60 ms on the author's machine, so a mid-range phone
    (about 10× slower) stays under the 800 ms mobile settle; the number goes into
    ARCHITECTURE (5.2);
  - skipped text: frontmatter, comments, beats, code, `$$` math, headings, link
    targets, `>` lines with skipQuotes on, and present with it off;
  - disabled rules give no matches and a 0 count; `lang` null gives no echo, adverb
    or gerund matches and a null readability, and still gives crutch, name and long
    matches.

**3.2 [core] Wiring and scaffold**, depends on 1.7, 1.8, 2.5 (and 3.1's signatures,
which 0.1 stubbed), effort S
- Change `src/main.ts`, `src/settings.ts` (normalize only), `build-css.mjs`,
  `tests/strings.test.ts`; fill `src/lens/index.ts` (load and `lists()`; the other
  public methods stay stubbed for 5.1); create `src/lens/strings.ts` (only the keys
  below), empty `src/lens/editor.css` and `src/lens/panel.css`; create
  `tests/lens-lists-index.test.ts`.
- `main.ts`: import `LensModule` and `lensStrings`, register the strings, construct
  the module after `editor`, add it to `modules`; `loadAll` swaps 0.1's
  `lensDismissed: {}` for `cleanDismissed(raw.lensDismissed)`.
- `settings.ts` `normalizeSettings`: `lensLanguage` must be one of the three values;
  `lensListsNote` through `normalizePath` and `listsPath` (1.7); `lensEchoWindow`
  clamped 10–200 and `lensLongSentence` 15–200 (integers); `lensRulesOff` filtered to
  strings. No migration: every key is new.
- `build-css.mjs` parts: add `src/lens/editor.css` and `src/lens/panel.css`.
- `tests/strings.test.ts`: add `lens: lensStrings` to the `all` map (:14-25).
- `LensModule.load` (no UI yet):
  - the word-lists index spec (Q14) and a `lists(): Lists` getter (empty lists when
    the setting is empty or the file is missing), and a `listsState` for
    `activeState` (`"unset"`, `"missing"`, `"ok"`);
  - followers through `plugin.index.follow`: `session.renamed/deleted`;
    `renameKeys(data.lensDismissed, …, mergeDismissals)` / `dropKeys`, then
    `requestSave`; `movedPath(settings.lensListsNote, …)` updates the setting and
    calls `await plugin.saveSettings()` (not `requestSave`: `saveSettings` is what
    triggers the index's `settingsChanged` rebuild and the module's own
    `settingsChanged`, as the desk's home-note follower does, desk/index.ts:44-48);
    `pruneMissing`-style cleanup of `lensDismissed` on layout ready, through
    `workspace.onLayoutReady`;
  - `LensSession` with its own `IndexTimers`, built in `src/lens/index.ts` the way
    vault-indexes.ts:30-34 builds them (`window.setTimeout` / `clearTimeout`), and
    `settleMs` by `Platform.isMobile`; `analyze` bound to the current settings,
    `lists()` and `lensLang(settings.lensLanguage, lang())`;
  - `settingsChanged` and a lists change call `session.invalidate()`.
- Strings (en and pt-BR): `lens.cmd.toggle` ("Toggle revision lens" / "Ativar ou
  desativar a lente de revisão"), `lens.cmd.createLists` ("Create the word lists
  note" / "Criar a nota de listas de palavras"), `lens.cmd.next` / `lens.cmd.prev`
  ("Next revision lens match" / "Próxima ocorrência da lente de revisão", and the
  previous one), and the rule names `lens.rule.<id>` (with `lens.rule.gerund.en` =
  "Started to"), which come from SF 5's table and are shared by 4.2 and 4.3. Notice
  texts are G1b's and belong to 4.2.
- `tests/lens-lists-index.test.ts` (with `tests/support/memory-vault.ts`): the lists
  load after the first build; an edit to the note shows in `lists()` after the settle
  time; renaming the note moves the setting and `lists()` still returns its contents
  after the settle time; deleting it gives empty lists and `"missing"`.
- Done when all four checks pass and nothing visible changes.

## Wave 4: the UI (parallel, gated)

The wave-4 views and extensions are registered only in 5.1, so nothing here is
visible in Obsidian yet. Each task is done when typecheck, test and build pass and
its pure helpers have unit tests; the comparison with G1 happens in 5.1b.

**4.1 Editor decorations**, depends on G1a, 3.1 and 3.2, effort M
- Create `src/lens/decorations.ts`, `src/lens/marks-model.ts` (pure, no CodeMirror
  imports) and `tests/lens-marks.test.ts`; fill `src/lens/editor.css`.
- `marks-model.ts`: `mapMatches(matches, mapPos: (pos: number, assoc: -1 | 1) => number): Match[]`
  (drops a match whose range collapses) and `markSpecs(matches, current, from, to)`
  (the class list per range for the visible window, from `visible(...)`).
- `class LensMarks`, shaped like `editor/dialogue-focus.ts`, constructed with
  `pathOf(state)`, `session` and `shown(path): LensResult | undefined` (the module's
  `withoutDismissed` result) callbacks:
  - a `ViewPlugin` that is idle while off; on `docChanged` it calls
    `session.changed(path, () => state.doc.toString())` and maps its current match
    list through `update.changes` (`mapMatches`) until a result with the session's
    latest version arrives;
  - **the mapped list is the one source of positions**: marks, `matchAt` and
    stepping read it, never `session.result(path).matches`, so a step or a dismiss
    during the settle time lands on the right range;
  - on result, viewport change or refresh it rebuilds marks for `view.visibleRanges`
    only;
  - `Decoration.mark({class: "escrita-lens-<rule>"})` per match; echoes add a
    `escrita-lens-related` mark; long sentences get the background-tint mark (Q35);
    the current match (set through a `StateEffect`) gets `escrita-lens-current`;
  - `refresh()` dispatches a `StateEffect` to every live view and forgets dead ones;
  - `matchAt(state, pos): Match | null` and `matchesFor(state): readonly Match[]` read
    the mapped list;
  - `onSelection(cb: (path: string, ranges: { from: number; to: number }[]) => void)`,
    fired from the ViewPlugin's `update` when `selectionSet`; 5.1 wires it to the
    panel.
- CSS: `escrita-lens-*` classes, Obsidian color variables at low alpha (Q35), light
  and dark, no layout shift (no borders that change line height).
- Tests (`marks-model.ts`): an insertion before a match shifts it; a deletion over a
  match drops it; `markSpecs` gives the current match its extra class and only
  ranges inside the window.

**4.2 Lens panel**, depends on G1b, 2.4 and 3.2, effort M
- Create `src/lens/view.ts`; fill `src/lens/panel.css`; change `src/lens/strings.ts`
  (the only wave-4 owner): measure labels, bands (`lens.band.pt.*`, `lens.band.en.*`),
  empty states (off, no lists note, lists note not found, no language, short note,
  not Markdown), step labels, the ignored line, the context-menu item
  `lens.menu.ignore`, the confirm, and the notices `lens.notice.reading`,
  `lens.notice.listsExists`, `lens.notice.listsCreated` (G1b's text). Rule names are
  3.2's.
- `class LensView extends ItemView` (`escrita-lens`), built against the
  `LensModule` surface from 0.1: `activeState()`, `turnOn(path)`, `step(rule, dir)`,
  `clearDismissed(path)`, `dismissedCount(path)`, `createLists()`.
- DOM through `createDiv`, `createEl`, `setText` only; counts and percentages through
  `fmt`; rates through a local helper in `view.ts`,
  `n.toLocaleString(lang(), { maximumFractionDigits: 1, minimumFractionDigits: 1 })`
  (one decimal; `fmt` rounds to an integer, i18n.ts:34, and stays unchanged); `plural`
  for counts. Rule rows are buttons with 32px targets (40px on mobile); step buttons
  have `aria-label`s; the "3 / 12" counter is `aria-live="polite"`.
- Re-renders on `session.onResult` for the active path, on `active-leaf-change`
  (through `this.registerEvent`), and on a `refresh()` the module calls (5.1 calls it
  from 4.1's `onSelection`, debounced 150 ms, measures only).
- Tests: none beyond the strings test unless a pure helper appears; the rate
  formatting helper gets one test (`2.4` → "2,4" in pt-BR, "2.4" in en) if it is
  exported.

**4.3 [core] Revision settings section**, depends on G1c and 3.2, effort S
- Change `src/settings.ts` (a new private `lensSettings(containerEl, save)` called
  from `display()`, next to `stagesSettings`) and `src/strings.ts` (`settings.lens*`
  keys, en and pt-BR); create `tests/settings-lens.test.ts` (copying
  `tests/settings-stages.test.ts`: the keys exist in both languages).
- Rows per G1c. The rule toggles use 3.2's `lens.rule.<id>` names. The "Create"
  button calls `plugin.lens.createLists()` (0.1's surface, filled in 5.1). The path
  field shows the normalized path on blur. Numbers save on blur and change; the lens
  re-computes through `settingsChanged`.

## Wave 5: integration, docs and checks

**5.1 Lens integration**, depends on 4.1–4.3, effort S–M
- Change `src/lens/index.ts`.
- `registerView("escrita-lens", …)`; `registerEditorExtension(marks.extension)`.
- The shown result: per result and per dismissal change, the module builds
  `withoutDismissed(result, m => !isDismissed(data.lensDismissed[path], dismissalOf(text, m)))`
  once and hands it to the marks (`shown`), the panel and stepping.
- Command "Toggle revision lens" (`checkCallback`, Markdown views only; in Reading
  view a Notice, Q29): toggles the session, runs `session.now` for the note, opens
  or reveals the panel (`getRightLeaf(false)` → `setViewState` → `revealLeaf`, as
  snapshots/index.ts:258-267), refreshes the marks. No hotkey.
- Commands "Next revision lens match" / "Previous revision lens match"
  (`checkCallback`, only when the lens is on for the active note): step the most
  recently chosen rule (echoes until one is chosen). No hotkeys.
- Command "Create the word lists note": path is `listsPath(lensListsNote)` if set,
  else `Revision.md` / `Revisão.md` by the lens language (pt-BR when there is none);
  if the file exists, open it with `lens.notice.listsExists` and never write it;
  else `notes.ensureFolder` the parent, `vault.create(normalizePath(p),
  starterNote(lang))`, set the setting if it was empty, `saveSettings`, open the note.
- Stepping: read `marks.matchesFor(state)` (the mapped, filtered list), `stepTo`,
  then `editor.transaction({selection})` plus `scrollIntoView(range, true)`
  (editor/index.ts:174-180), then the current-match effect. On `Platform.isPhone`,
  close the right drawer after a step from the panel
  (`workspace.rightSplit.collapse()`).
- `this.plugin.registerEvent(workspace.on("editor-menu", …))`: when `matchAt` finds a
  match under the cursor, add a disabled header item and "Ignore here", which builds
  the key with `dismissalOf(view.state.doc.toString(), mappedMatch)`, `addDismissal`s,
  requestSaves, rebuilds the shown result and refreshes marks and panel. Also from
  the panel's current match.
- Wire 4.1's `onSelection` to the panel's refresh, debounced 150 ms; selection
  measures come from `measuresFor(result.pass, …)`.
- `unload` disposes the session and detaches nothing the user opened (Obsidian
  guideline: don't detach leaves in `onunload`).

**5.1b Visual check against the canvas**, depends on 5.1, effort S
- With a test vault, compare against the approved artboards: G1a marks on the
  fixture in Live Preview and Source, light and dark, next to spellcheck and
  dialogue focus; G1b panel in light, dark, a 300px sidebar and a phone (drawer,
  targets, closing after a step); G1c settings on desktop and mobile. Fix CSS and
  layout in `src/lens/editor.css`, `panel.css`, `view.ts` and the settings section.
  Anything that changes structure goes back to the author.

**5.2 Docs**, depends on 5.1, 1.9 and 2.6, effort S
- `docs/ARCHITECTURE.md`:
  - a "Stemmers" section: `core/stem/` contract (profiles, normalization, memo,
    opaque keys, how a case-sensitive caller uses them, `splitClitic`), the steps per
    language and profile, what is out (noun step, Porter 2–5, feminine in `"name"`),
    stop words, and that the universe reuses them (`"name"` for people and places,
    `"word"` for common-noun entries);
  - `core/tokens.ts`, `core/sentences.ts` and `readerMask` in the pure core list, with
    the one pattern table shared with `stripMarkup`;
  - a "Revision lens" module spec: what it reads (Q23), rules and kinds, the session
    (per-path versions, the text cache, settle times), the full-pass-plus-visible-marks
    design and the mapped match list as the one source of positions (Q22), the local
    performance budget measured in 3.1, measures, dismissals (`withoutDismissed`) and
    their follower, the lists note spec, the read-only imports of `editor/dialogue`
    and `editor/context` (Q33), syllable approximations (Q27);
  - the editor spec: wrappers gone, `enter-flow` on `Markdown`,
    `withoutTrailingBreak`; the outline spec: `beats-edit` on `isSceneBreakLine`.
- `CONTEXT.md` modules list gains `lens`; the weak spots line drops nothing new.
- `docs/ROADMAP-short-fiction.md` §5: every row of "Deviations from SF 5", each with
  the edit named there.

**5.3 Checks**
- `npm run typecheck`, `npm test`, `npm run build` and `npm run test:bundle` all pass.
- The no-network test passes (it scans `src/lens`, `src/core/stem` and
  `src/core/sentences.ts` with no change).
- `grep -rn innerHTML src` finds nothing; `grep -rn console.log src` finds nothing.
- `grep -rn "from \"obsidian\"" src/core/stem src/core/tokens.ts src/core/sentences.ts src/lens/{types,syllables,readability,lists,lang,dismiss,lexicon,rules-words,rules-stem,measures,panel-model,session,analyze,marks-model}.ts`
  finds nothing, and none of them imports `i18n`; `grep -rn "lens/" src/core` finds
  nothing (core never imports the lens).
- Rule 2: `grep -rnE "vault\.process|vault\.modify|replaceRange|changes:" src/lens`
  finds nothing; `grep -rnE "vault\.create|ensureFolder" src/lens` finds only the
  `createLists` path in `src/lens/index.ts`.
- Every `workspace.on(` in `src/lens` sits inside `registerEvent(`.

## Manual verification on ~/projects/website/escrita/

Back up `.obsidian/plugins/escrita/data.json` first. Copy `tests/fixtures/lens/conto.pt.md`
into `Contos/` as a test note (delete it afterwards). The author's check of the stem
and syllable fixtures is gate G3, done before 3.1.

**The lens**
1. Run "Create the word lists note" with the setting empty: `Revisão.md` is created
   with the starter lists and the setting set. Move it to `Modelos/`: the setting
   follows and the lists still apply without a restart. Run the command again: it
   opens the note and writes nothing. Type the setting as `Modelos/Revisão` (no
   extension): the lists still apply.
2. Open the fixture conto, run "Toggle revision lens": underlines appear, the panel
   opens with measures and counts per 1,000. Toggle off: everything clears, and
   typing does no lens work (the panel shows the prompt).
3. Each rule: an echo pair with its fainter partner; a `-mente` adverb and *semente*
   unmarked; a gerund, a gerund with an enclitic, a gerundismo, a chain, and *deve
   estar chegando* unmarked as gerundismo; a crutch phrase from the note; a typo of a
   listed name flagged and its diminutive not; a long sentence with its tint.
4. Add a word under `## Ignorar` and a name under `## Nomes`: the marks update
   within about a second, without reopening.
5. Dialogue share matches a rough hand count on one dash-dialogue scene; the
   per-scene list shows two scenes. Readability shows a band in Portuguese.
6. Select a paragraph: the measures switch to "Seleção"; the counts don't change.
7. Step through echoes: each click selects the next one and centres it, "3 / 12"
   updates, it wraps at the end. Type a word before the next match and step at once
   (inside the settle time): the right range is selected. Nothing in the text
   changes; undo history is empty.
8. "Ignorar aqui" from the context menu: the mark goes and the echo count drops by
   one. Step: the dismissed match is skipped. Type a sentence elsewhere: it stays
   gone. Edit a word next to it: it comes back. "Clear" restores all.
9. Rename the conto, then its folder: lens on-state and dismissals follow. Delete
   it: its dismissals are gone from data.json after a restart.
10. Paste the fixture conto seven times into one note (about 10,000 words), turn the
    lens on and type at the end and in the middle: no visible lag; underlines settle
    about half a second after typing stops. Scroll fast: no flicker. Drag a selection
    through it: the measures follow without lag. **Repeat on a phone**: typing in the
    middle stays smooth, underlines settle about a second after typing stops.
11. An epigraph in `>` is unmarked; turn "Skip quotes" off and it is marked. A
    heading is never marked.
12. Frontmatter, `%% beat %%`, a placeholder, code, a `[[link|alias]]` target and a
    `$$` block are never marked.
13. Reading view: the command shows the Notice. Light and dark themes. A phone: the
    panel in the right drawer, targets easy to hit, the command from the palette; a
    step from the panel closes the drawer and shows the match; "Next revision lens
    match" from the mobile toolbar steps.
14. Switch Obsidian to English (or set the language to English) on an essay in
    `Textos/`: English rules, "Started to", Flesch bands. Switch Obsidian to Spanish
    with the setting on "Automatic": the panel says "Choose a language in settings",
    and long sentences and dialogue share still show.
15. Dialogue focus and the lens on together: both draw, neither hides the other.

**The improvement**
16. Enter Enter Enter in a conto (style `single`): scene breaks and paragraphs as
    before; "Insert scene break" in properties refuses as before; removing the
    trailing break in a closed note keeps a mixed-ending file's endings, and a closed
    note with no trailing break is left exactly as it was.
17. Outline: insert and remove a beat next to a fenced block holding `---` in a
    chapter: the `---` is left alone.

## Release checklist (per CONTEXT.md)

- [ ] docs/ROADMAP.md: move the 0.5 row to "Shipped", name the improvement (the 0.2.1
      editor loose ends, plus `beats-edit.isBreak`), and plan 0.6 before editing the
      topic roadmaps. Align the effort note (ROADMAP "M + M" vs short-fiction "M–L").
- [ ] README.md:
  - the 0.5.0 changelog entry: the revision lens (rules, measures, dismissals, word
    lists note), the stemmers, the `beats-edit` scene-break change (its own line),
    and that a closed note's line endings are kept when the trailing break is
    removed (its own line);
  - a "Revision lens" section: the commands, the rules per language (with *mente,
    semente, demente, ente* as the worked example of the 3-letter rule, and why
    *deve estar chegando* isn't gerundismo), what is skipped, the word lists note
    format (both heading languages), that crutch phrases match exactly (Q13), the
    supported languages and the "Choose a language" state, that measures describe
    and don't grade;
  - the settings list: the Revision section; the commands table: "Toggle revision
    lens", "Next / Previous revision lens match" and "Create the word lists note".
- [ ] docs/IMPROVEMENTS.md: move the editor loose ends and `beats-edit.isBreak` to
      "Done" (0.5); correct the note that `bodyStartLine` was test-only; keep the
      `<!--` check, the classifier fake and the parity questions listed.
- [ ] Topic roadmaps: mark SF 5 shipped (ROADMAP-short-fiction.md:262 and the version
      row at :52) with the 5.2 edits; fix the settings summary's `revisao` to
      `revisão` (:650) and add the lens rows (rules off, skip quotes). In
      ROADMAP-universe.md, rewrite U 1.2's "Portuguese inflection" sentence: people
      and places match through `stem(word, lang, "name")` (plural, diminutive,
      augmentative; feminine skipped on purpose, *Mariano/Mariana*), common-noun
      entries and aliases through `"word"` (*menino / meninos / menina*), and
      case-sensitive entries compare casing before the stem. Note in U 1.2 and U 1.3
      that the sentence splitter and title abbreviations are in `core/sentences.ts`.
- [ ] docs/ARCHITECTURE.md: the items in 5.2.
- [ ] CONTEXT.md: the current version, the next version focus (0.6), the modules list.
- [ ] The author's vault (ROADMAP-short-fiction.md:670): in
      `escrita/.obsidian/plugins/escrita/data.json` set `lensLanguage: "pt-BR"` and
      `lensListsNote: "Modelos/Revisão.md"`; create that note with the command and
      fill `## Nomes`; update the "Plugin Escrita" section of `escrita/Como usar.md`.
- [ ] `npm version minor --no-git-tag-version` (manifest.json and versions.json to
      0.5.0), commit `0.5.0`, tag `0.5.0`, push the tag, and check the drafted release
      assets (main.js, manifest.json, styles.css including the lens CSS).

## Risks

1. **Over-stemming collisions** make the lens look wrong (*casa/casamento*,
   *Maria/Mário*). Mitigated by dropping the noun step and Porter 2–5 (Q2, Q3), the
   `"name"` profile (Q4), and the split fixtures, written before the code (0.2) and
   checked by the author (G3), which fail on any new collision. The universe inherits
   these keys, so a change after 0.7 is a matching change; the fixtures are the
   contract.
2. **False positives from name variants** (sentence-initial words, real words close
   to a short name). Mitigated by Q19's conditions and the length-graded distance
   (3-letter names accept only a transposition or a doubled letter). If it is still
   noisy in manual check 3, the rule ships off by default rather than loosening the
   conditions.
3. **Responsiveness on long notes, on phones above all.** The full pass is O(words)
   with a memoized stemmer; echoes use a sliding window, never pairwise. The CI
   ceiling catches quadratic code; the local budget (60 ms median on 10,000 words)
   keeps a phone under its 800 ms settle. Identical text never recomputes, so
   stepping is free; selection measures slice the cached pass. Mapping marks through
   edits hides the debounce. Decorations are built only for visible ranges. Manual
   check 10 runs on a phone.
4. **Reader mask drift from the word count.** One pattern table for `stripMarkup`
   and `readerMask`, and the parity test in 1.4. Lens numbers never mix with
   measurer numbers (Q24).
5. **Shared core changes** (`wordcount.ts`, `markers.ts`, `core/stem`,
   `core/tokens.ts`, `core/sentences.ts`) land in separate waves with one owner each;
   `stripMarkup`'s output is pinned by the existing word count tests.
6. **The loose ends touch Enter and outline edits**, which write prose. Every
   expected test value must stay, except two intended behaviour changes, each with a
   changelog line, a D-row and its own tests: the outline's `---` inside code (2.6),
   and `removeTrailingBreak` keeping a closed note's own line endings (1.9). The
   null guard in `withoutTrailingBreak` is tested (a note with no trailing break
   comes back unchanged). Manual checks 16–17.
7. **Two decorations on one line** (dialogue focus dims, lens marks, spellcheck).
   G1a shows them together; the lens uses marks only, never line classes (long
   sentences are a tint mark, Q35), so it composes with dialogue focus's line
   decorations.
8. **Dismissals store prose context** (up to 3 words each side) in data.json: local
   only, capped per note, cleaned on load, dropped on delete.
9. **Rule 2.** The lens only decorates and moves the selection. No lens code path
   calls `vault.process`, `vault.modify`, `replaceRange` or a transaction with
   `changes`; 5.3 greps `src/lens` for them. The only file it writes is a new word
   lists note, on an explicit command, never an existing one (`vault.create` and
   `notes.ensureFolder` in `createLists` only, also grepped).
10. **Syllable and readability error** (Q27). Approximate on purpose; the panel shows
    a band, and the fixtures pin values so changes are visible.
11. **Sentence splitting in dialogue** decides long-sentence matches and the average
    sentence length. The travessão rules are pinned by about 50 pt cases; the
    fixture snapshot shows any change.
12. **Module import across modules** (`lens` → `editor/dialogue`, `editor/context`).
    Accepted and documented (Q33); the editor task in wave 1 is told not to change
    those signatures. The reverse direction (core importing the lens) is grepped in
    5.3.
13. **Docs edited by the 0.4 release.** This plan cites line numbers from the 0.4.0
    commit; the release agent's edits to README, ROADMAP and ARCHITECTURE may move
    them. Re-check citations at the start of each task.
14. **Stale positions.** A result's offsets belong to the text it was computed from.
    Every consumer of a position reads 4.1's mapped list (Q22), and dismissal keys
    are built from the live document; manual checks 7 and 8 step and dismiss inside
    the settle time.

## Issues not applied

- **"Keep the old normalizing behaviour of `removeTrailingBreak`"** (the first
  option of the critique on 1.9 vs Risk 6). The other option was taken: keeping a
  file's own line endings changes fewer bytes of the writer's text, which suits rule
  1 better than rewriting every line ending. It is now a named, tested behaviour
  change (Risk 6, a D-row, a changelog line).
- **"Skip the pass while keys are still arriving"** (part of the mobile performance
  critique). Not a separate mechanism: the debounce already waits for typing to stop;
  only its length changes on mobile (800 ms). The 60 ms budget is a local-only test,
  not a CI gate, because CI machine speed varies too much to pin a tight number.
- **"Give 4.3 its own `settings.lens.rule.<id>` keys"** (critique on 4.3 vs 4.2 rule
  names). The other option was taken: the rule names move into 3.2's
  `src/lens/strings.ts`, since they come from SF 5's table rather than from G1, and
  one set of names serves the panel and the settings.
- **"Key the session cache by a hash of the text or by view id"** (critique on two
  panes). Replaced by the per-path counter owned by the session plus a text-equality
  cache, which needs no hash and treats two panes of one note as one caller.
- **"Make the stepping consumers call `session.now()` whenever the version is
  stale"** (option b of the stale-offsets critique). Option a was taken: the mapped
  match list in the ViewPlugin. Forcing a full pass on every step would cost up to a
  second on a phone.
- **"Ship the name-variant rule off by default is a weak fallback"** (part of the
  Q19 critique). The fallback stays as a last resort in Risk 2, but the tighter
  limits for 3-letter names now come first.
