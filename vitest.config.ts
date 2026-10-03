import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `obsidian` has no runtime code to import, so tests get a stand-in. The lifecycle
// tests (module context, registry, every module's lifecycle) run in happy-dom; the
// rest of the suite stays in node.
const dom = ["tests/lifecycle-*.test.ts", "tests/module-context.test.ts"];

export default defineConfig({
  resolve: {
    alias: { obsidian: fileURLToPath(new URL("./tests/support/obsidian.ts", import.meta.url)) },
  },
  test: {
    setupFiles: ["./tests/support/dom-setup.ts"],
    projects: [
      { extends: true, test: { name: "node", environment: "node", include: ["tests/**/*.test.ts"], exclude: dom } },
      { extends: true, test: { name: "dom", environment: "happy-dom", include: dom } },
    ],
  },
});
