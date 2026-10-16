// Dev only (PLAN-1.1 Q10), never imported by src/ and never bundled: exports each screenplay
// fixture to PDF with Escrita and with Afterwriting's CLI, then compares the page count and
// the first line of every page, and prints a table of the differences. Each difference is
// then decided (theirs or ours) and pinned in tests/screenplay-pages.test.ts.
//
// Needs: node, poppler's `pdftotext`, esbuild (a dev dependency), and Afterwriting (MIT)
// installed outside the repo:
//   npm --prefix ~/.cache/escrita-e2e/afterwriting install afterwriting
// Run (needs core/fountain.ts's real parser, from Wave 1 B):
//   node scripts/compare-screenplay.mjs [fixtures-dir] [letter|a4]
// Environment switches, to tell a real counting difference from a known Afterwriting quirk:
//   ESCRITA_COMPARE_TRIM=1      strip trailing spaces and CR from every line first. Afterwriting
//                               counts a trailing space as a character, so a line that is exactly
//                               as wide as its column wraps to an extra, empty line.
//   ESCRITA_COMPARE_AW_COLUMNS=1  give Escrita Afterwriting's column widths (action 61 on Letter,
//                               dialogue 36, cue at 35), so only the break rules differ.
// fixtures-dir defaults to tests/fixtures/screenplay (any *.fountain in it, or in another
// folder, e.g. Afterwriting's own samples in <cache>/node_modules/afterwriting/samples).
// Output goes to ESCRITA_COMPARE_OUT (default <os tmpdir>/escrita-compare/).

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = resolve(new URL("..", import.meta.url).pathname);
const fixtures = resolve(process.argv[2] ?? join(root, "tests/fixtures/screenplay"));
const page = process.argv[3] === "a4" ? "a4" : "letter";
const trim = process.env.ESCRITA_COMPARE_TRIM === "1";
const awColumns = process.env.ESCRITA_COMPARE_AW_COLUMNS === "1";
const out = process.env.ESCRITA_COMPARE_OUT ?? join(tmpdir(), "escrita-compare");
const aw = join(homedir(), ".cache/escrita-e2e/afterwriting/node_modules/afterwriting/awc.js");
mkdirSync(out, { recursive: true });

// Escrita's side: bundle the TypeScript on the fly.
const entry = `
import { parseFountain, fountainOptions } from ${JSON.stringify(join(root, "src/core/fountain.ts"))};
import { segment } from ${JSON.stringify(join(root, "src/core/markdown.ts"))};
import { screenplayPdf } from ${JSON.stringify(join(root, "src/core/screenplay-pdf.ts"))};
import { screenplayPreset } from ${JSON.stringify(join(root, "src/core/screenplay-presets.ts"))};
export function exportPdf(text, pageId) {
  const opts = fountainOptions({ screenplaySceneHeadings: "INT, EXT, EST, INT./EXT, INT/EXT, I/E", screenplayTransitions: "TO:" });
  const script = parseFountain(text, segment(text), opts);
  const tb = script.titleBlock ?? {};
  const title = { title: tb.title ?? "Untitled", credit: tb.credit, author: tb.author, source: tb.source, draftDate: tb.draftDate, contact: tb.contact };
  const preset = screenplayPreset(pageId, { screenplayMore: "(MORE)", screenplayContinued: "(CONT'D)", screenplaySceneNumbers: false });
  if (${JSON.stringify(awColumns)}) {
    // Afterwriting's print profile: left margins 1.5", action max 61 (Letter) or 58 (A4) characters
    const aRight = pageId === "a4" ? 73 : 76;
    const c = preset.columns;
    c.scene = c.action = c.transition = { left: 15, right: aRight };
    c.character = { left: 35, right: 68 };
    c.parenthetical = { left: 30, right: 56 };
    c.dialogue = c.lyric = { left: 25, right: 61 };
  }
  return screenplayPdf(script, title, preset);
}`;
const bundled = join(out, "escrita-bundle.mjs");
await build({ stdin: { contents: entry, resolveDir: root, loader: "ts" }, bundle: true, format: "esm", platform: "node", outfile: bundled, logLevel: "error" });
const { exportPdf } = await import(pathToFileURL(bundled).href + "?t=" + Date.now());

/** First text line of each page, ignoring a leading page number such as "2." */
function firstLines(pdf) {
  const text = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" });
  return text.split("\f").filter((p, i, a) => i < a.length - 1 || p.trim() !== "").map((p) => {
    const lines = p.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    while (lines.length > 0 && /^\d+\.$/.test(lines[0])) lines.shift();
    return (lines[0] ?? "").replace(/\s+/g, " ");
  });
}

const rows = [];
for (const f of readdirSync(fixtures).filter((n) => n.endsWith(".fountain")).sort()) {
  const name = basename(f, ".fountain");
  let text = readFileSync(join(fixtures, f), "utf8");
  let source = join(fixtures, f);
  if (trim) {
    text = text.replace(/[ \t\r]+$/gm, "");
    source = join(out, `${name}.trim.fountain`);
    writeFileSync(source, text);
  }
  const ours = join(out, `${name}.escrita.pdf`);
  const theirs = join(out, `${name}.afterwriting.pdf`);
  writeFileSync(ours, exportPdf(text, page).bytes);
  execFileSync("node", [aw, "--source", source, "--pdf", theirs, "--overwrite", "--setting", `print_profile=${page === "a4" ? "a4" : "usletter"}`], { stdio: "ignore" });
  const a = firstLines(ours);
  const b = firstLines(theirs);
  rows.push({ name, ours: a.length, theirs: b.length, pages: Math.max(a.length, b.length), a, b });
}

console.log(`page: ${page}   fixtures: ${fixtures}\n`);
console.log("fixture".padEnd(28), "Escrita".padStart(8), "Afterwriting".padStart(13), "  differing starts");
let diffs = 0;
for (const r of rows) {
  let n = 0;
  for (let i = 0; i < r.pages; i++) if ((r.a[i] ?? "") !== (r.b[i] ?? "")) n++;
  console.log(r.name.padEnd(28), String(r.ours).padStart(8), String(r.theirs).padStart(13), String(n).padStart(10), r.ours === r.theirs ? "" : "  <- page count differs");
  for (let i = 0; i < r.pages; i++) {
    if ((r.a[i] ?? "") !== (r.b[i] ?? "")) {
      diffs++;
      console.log(`  page ${String(i + 1).padStart(2)}  Escrita: ${r.a[i] ?? "(none)"}\n           Theirs:  ${r.b[i] ?? "(none)"}`);
    }
  }
}
console.log(`\n${diffs} page(s) start differently. PDFs are in ${out}`);
