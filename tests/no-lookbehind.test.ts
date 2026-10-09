// PLAN-1.0 Q8 (docs/MOBILE-1.0.md, F1): Safari before 16.4 can't parse a regex lookbehind,
// and one such literal anywhere in main.js stops the whole plugin from loading on an older
// iPhone. This fails on `(?<=` or `(?<!` in src/ and, when it exists, in the built main.js.
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..");
const LOOKBEHIND = /\(\?<[=!]/;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("no regex lookbehind (older iOS)", () => {
  it("src/ has none", () => {
    const hits = files(join(ROOT, "src")).filter((f) => LOOKBEHIND.test(readFileSync(f, "utf8")));
    expect(hits.map((f) => relative(ROOT, f))).toEqual([]);
  });
  it("main.js has none", () => {
    const bundle = join(ROOT, "main.js");
    if (!existsSync(bundle)) return;
    expect(LOOKBEHIND.test(readFileSync(bundle, "utf8"))).toBe(false);
  });
});
