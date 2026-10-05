import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `obsidian` has no runtime code to import, so tests get a stand-in. The lifecycle
// tests (module context, registry, every module's lifecycle) run in happy-dom; the
// rest of the suite stays in node.
//
// Tests that assert on elapsed time live in tests/timing/ and run as their own "timing"
// project, one file at a time, after the other two have finished (`npm test` runs them in
// two steps). Wall-clock budgets fail at random when ~130 files compete for the same CPU.
// To run them alone: `npx vitest run --project timing`.
const dom = ["tests/lifecycle-*.test.ts", "tests/module-context.test.ts"];
const timing = ["tests/timing/**"];

export default defineConfig({
  resolve: {
    alias: { obsidian: fileURLToPath(new URL("./tests/support/obsidian.ts", import.meta.url)) },
  },
  test: {
    setupFiles: ["./tests/support/dom-setup.ts"],
    projects: [
      { extends: true, test: { name: "node", environment: "node", include: ["tests/**/*.test.ts"], exclude: [...dom, ...timing] } },
      { extends: true, test: { name: "dom", environment: "happy-dom", include: dom } },
      { extends: true, test: { name: "timing", environment: "node", include: ["tests/timing/**/*.test.ts"], fileParallelism: false, pool: "forks", poolOptions: { forks: { singleFork: true } } } },
    ],
  },
});
