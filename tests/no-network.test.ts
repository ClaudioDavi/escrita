// Milestone 0: Escrita never talks to a network. This fails when any source
// file (or the built main.js, when present) contains an API that can reach a
// server, including Node/Electron network modules (http, https, net, tls,
// dgram, dns, electron). Strict on purpose: only `//` lines, JSDoc lines and
// block comments are skipped (code before `/*` or after `*/` is still
// scanned), so a trailing `// fetch(` comment still fails. Rephrase it instead.
//
// CI runs this again after `npm run build` with ESCRITA_REQUIRE_BUNDLE=1
// (`npm run test:bundle`) so the bundle is always scanned there.

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..");

interface Rule {
  name: string;
  re: RegExp;
}

const RULES: Rule[] = [
  { name: "fetch(", re: /\bfetch\s*\(/ },
  { name: "requestUrl", re: /\brequestUrl\b/ },
  { name: "request(", re: /\brequest\s*\(/ },
  { name: "XMLHttpRequest", re: /\bXMLHttpRequest\b/ },
  { name: "WebSocket", re: /\bWebSocket\b/ },
  { name: "EventSource", re: /\bEventSource\b/ },
  { name: "sendBeacon", re: /\bsendBeacon\b/ },
  // Dynamic import of a URL (or of anything that isn't a relative module path).
  { name: "import( of a URL", re: /\bimport\s*\(\s*(?!["'`]\.{1,2}\/)/ },
  { name: "require( of a URL", re: /\brequire\s*\(\s*["'`](?:https?:|\/\/|data:)/ },
  // Node and Electron networking, which desktop Obsidian allows.
  { name: "require( of a network module", re: /\brequire\s*\(\s*["'`](?:node:)?(?:https?|http2|net|tls|dgram|dns|electron)["'`]\s*\)/ },
  { name: "import of a network module", re: /\b(?:from|import)\s*["'`](?:node:)?(?:https?|http2|net|tls|dgram|dns|electron)["'`]/ },
];

/** `request` or `requestUrl` named in an import from "obsidian" (also aliased). */
const OBSIDIAN_IMPORT = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']obsidian["']/g;

/**
 * Drops `// …` lines, JSDoc lines and block comments, but keeps any code on the
 * same line around a closed `/* … *\/` or after the `*\/` that ends a block.
 */
function stripLineComments(src: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (let line of src.split(/\r?\n/)) {
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end === -1) { out.push(""); continue; }
      line = " ".repeat(end + 2) + line.slice(end + 2);
      inBlock = false;
    }
    const s = line.trim();
    if (s.startsWith("//") || s === "*" || s.startsWith("* ")) { out.push(""); continue; }
    line = line.replace(/\/\*.*?\*\//g, " ");
    // An unclosed `/*` opens a block only at the start of a line. Mid-line it
    // may be a string ("**/*.md"), and treating it as a comment could hide the
    // rest of the file, so the line is kept and later lines stay scanned.
    if (line.trim().startsWith("/*")) { out.push(""); inBlock = true; continue; }
    out.push(line);
  }
  return out;
}

export function scan(src: string): string[] {
  const hits: string[] = [];
  const lines = stripLineComments(src);
  lines.forEach((line, i) => {
    for (const r of RULES) if (r.re.test(line)) hits.push(`${i + 1}: ${r.name}: ${line.trim().slice(0, 120)}`);
  });
  const code = lines.join("\n");
  for (const m of code.matchAll(OBSIDIAN_IMPORT)) {
    const names = m[1].split(",").map((x) => x.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]);
    for (const n of names) if (n === "request" || n === "requestUrl") hits.push(`import { ${n} } from "obsidian"`);
  }
  // A namespace import used for requests: `obsidian.request(`, `import_obsidian.requestUrl(`.
  if (/\b\w*obsidian\w*\s*\.\s*request(?:Url)?\b/.test(code)) hits.push("obsidian.request / requestUrl");
  return hits;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no network", () => {
  it("the scanner catches every forbidden API", () => {
    const bad = [
      "await fetch('https://x')",
      "fetch (url)",
      "const r = await requestUrl({ url })",
      "import { Notice, request } from \"obsidian\";",
      "import { requestUrl as get } from 'obsidian';",
      "obsidian.request({ url })",
      "import_obsidian.requestUrl(x)",
      "new XMLHttpRequest()",
      "new WebSocket('wss://x')",
      "new EventSource('/s')",
      "navigator.sendBeacon('/b', d)",
      "await import('https://cdn.example/x.js')",
      "await import(url)",
      "const x = 1; // then fetch('/x')",
      "import https from \"https\"; https.get(u)",
      "const h = require(\"http\")",
      "import { net } from \"electron\"",
      "export { net } from 'electron'",
      "require(\"node:net\")",
      "import * as tls from \"node:tls\"",
      "import \"dgram\"",
      "/* x */ fetch('https://a')",
      "/* a\n */ fetch(u)",
      "/* eslint-disable-next-line */ fetch(url)",
      "*/ fetch(u)",
      "fetch(u) /* trailing",
    ];
    for (const b of bad) expect([b, scan(b).length > 0]).toEqual([b, true]);
  });

  it("the scanner ignores ordinary code and whole-line comments", () => {
    const ok = [
      "this.plugin.requestSave();",
      "const fetched = prefetch + 1;",
      "import { Notice, Plugin } from \"obsidian\";",
      "// we never call fetch( here",
      "/* no WebSocket\n   and no requestUrl */",
      " * JSDoc line mentioning XMLHttpRequest",
      "const m = await import(\"./local\");",
      "import { x } from \"./https-utils\"",
      "import { netTotal } from \"./net\"",
      "const a = 1; /* fetch( */ const b = 2;",
      "/* a\n fetch(u) */ const ok = 1;",
      "const glob = \"**/*.md\";",
    ];
    for (const o of ok) expect([o, scan(o)]).toEqual([o, []]);
  });

  it("no source file uses the network", () => {
    const hits: string[] = [];
    for (const f of walk(join(ROOT, "src"))) {
      for (const h of scan(readFileSync(f, "utf8"))) hits.push(`${relative(ROOT, f)}:${h}`);
    }
    expect(hits).toEqual([]);
  });

  const bundle = join(ROOT, "main.js");
  const requireBundle = process.env.ESCRITA_REQUIRE_BUNDLE === "1";
  it.runIf(existsSync(bundle) || requireBundle)("the built main.js does not use the network", () => {
    expect(existsSync(bundle)).toBe(true);
    expect(scan(readFileSync(bundle, "utf8"))).toEqual([]);
  });
});
