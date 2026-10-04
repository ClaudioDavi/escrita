// classify() on a 3,020-file tree; the works index's structural recompute is one
// classify per .md file, synchronous. Run: npm run bench.
import { bench, describe } from "vitest";
import { classify, listBooks, type VaultTree } from "../../src/core/classify";
import { DEFAULT_SETTINGS } from "../../src/settings";
import { worksSpec } from "../../src/core/works-index";

type N = { path: string };
const files = new Map<string, N>(), folders = new Map<string, N>();
const fm = new Map<string, Record<string, unknown>>();
const addF = (p: string, f: Record<string, unknown>) => {
  files.set(p, { path: p });
  fm.set(p, f);
  const parts = p.split("/");
  for (let i = 1; i < parts.length; i++) { const d = parts.slice(0, i).join("/"); folders.set(d, { path: d }); }
};
for (let i = 0; i < 2600; i++) addF(`Notas/Sub${i % 30}/n${i}.md`, { status: "rascunho", target: 3000 });
for (let b = 0; b < 20; b++) {
  addF(`Livros/L${b}.md`, { status: "revisão" });
  for (let c = 0; c < 20; c++) addF(`Livros/L${b}/Chapters/${c} Cap.md`, {});
}
const tree: VaultTree<N, N> = { file: (p) => files.get(p) ?? null, folder: (p) => folders.get(p) ?? null, folders: () => [...folders.values()], frontmatter: (f) => fm.get(f.path) };
const s = { ...DEFAULT_SETTINGS, trackFolders: "Notas, Livros", excludeFolders: "Notas/Sub3" };
const paths = [...files.keys()];
const spec = worksSpec<{ path: string; extension: string }>({ settings: () => s, placement: (f) => classify(tree, s, f.path) as never, frontmatter: (f) => fm.get(f.path), bookGoal: () => undefined });
const fs = paths.map((p) => ({ path: p, extension: "md" }));
const opts = { iterations: 20, warmupIterations: 5, time: 0, warmupTime: 0 };

describe(`classify, ${paths.length} files, ${folders.size} folders`, () => {
  bench("classify() every file once", () => { for (const p of paths) classify(tree, s, p); }, opts);
  bench("listBooks() once", () => { listBooks(tree, s); }, opts);
  bench("works index structural recompute (compute per file, sync)", () => { for (const f of fs) if (spec.include(f)) spec.compute(f, null); }, opts);
});
