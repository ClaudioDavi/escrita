# Performance benchmarks

Vitest bench files, not part of `npm test` (the test projects only include `*.test.ts`).
They import the real `src/` modules and use synthetic pt-BR fixtures (`fixtures.ts`,
fixed seed: 300 name entries, chapters with dialogue, names, markup, beats,
placeholders and threads).

## Run

```
npm run bench                          # everything, node project only (about 40 s)
ESCRITA_BENCH_FILES=600 npm run bench  # smaller synthetic vault for index.bench.ts
npx vitest bench --run --project node tests/perf/editor.bench.ts   # one file
```

`ESCRITA_BENCH_FILES` sets the vault size of `index.bench.ts` (default 3020: 20 books
of 20 chapters of 3,000 words, the rest notes). Numbers depend on the machine; compare
runs on the same machine. The phone figure is desktop x5.

## What each file measures

| File | Measures |
|---|---|
| `editor.bench.ts` | On 3k and 10k-word chapters: per keystroke (segment, beats, placeholders, threads, dialogue focus), per pause (explorer count, name marks full and rematch, lens analyze), per save (each index compute, measurer, save total), selection count, snapshot compare. |
| `index.bench.ts` | Startup index passes over the synthetic vault through the real `IndexHub`: total time, reads and the **longest main-thread block** (max gap of a 0 ms ticker). That block is printed as `[perf]` lines, because vitest bench reports only throughput. Also compute-only tasks: separate vs shared segmentation. Mentions at batch 40, 8 and 1. |
| `names.bench.ts` | `segment` + `readerMask` + `findNames` on 2,000 words (G0h); `findNames` alone on 3k and 10k words. |
| `classify.bench.ts` | `classify` on every file of a 3,020-file tree, `listBooks`, the works index recompute. |
| `misc.bench.ts` | `syllables` and `normalizeWord` per token on 10k words; outline `loadRows` for a 30-chapter book. |

## Baseline, 2026-10-04 (desktop, before the 0.8 work)

From `docs/IMPROVEMENTS.md`, candidates 14, 21 and 22.

| What | Baseline |
|---|---|
| Index build, mentions, 3,020 notes | 4,214 ms (phone about 20 s) |
| Index build, placeholders / threads / measuring every file | 122 ms / 114 ms / 610 ms |
| Longest main-thread block, mentions at batch 40 | 125-155 ms (phone about 600-780 ms) |
| Longest block with an 8 ms budget (patched prototype) | 14 ms, total time +1-5% |
| Mentions compute on save, 10k-word chapter | 13.1 ms (phone about 65 ms) |
| Lens full pass, 10k words | 25.8 ms (phone about 130 ms) |
| `findNames`, 10k words | 12.1 ms; about 8.4-8.8 ms with module-level caches (prototype) |
