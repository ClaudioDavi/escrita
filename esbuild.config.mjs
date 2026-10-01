import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { readFileSync } from "fs";

// jsdiff (the `diff` package, BSD-3-Clause) is bundled into main.js, and only
// main.js, manifest.json and styles.css ship in a release, so its license
// notice travels as a banner comment at the top of the bundle.
const jsdiffLicense = readFileSync("node_modules/diff/LICENSE", "utf8").trim().replace(/\*\//g, "* /");
const banner = `/*!\nEscrita bundles jsdiff (https://github.com/kpdecker/jsdiff).\n\n${jsdiffLicense}\n*/`;

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  banner: { js: banner },
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
