import { defineConfig } from "@playwright/test";

// The end-to-end checks drive a real Obsidian (docs/TESTING.md). One Obsidian at a time:
// the author's machine has limited resources. Not part of CI (no flatpak Obsidian there).
export default defineConfig({
  testDir: "e2e/specs",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "e2e/report/results",
  reporter: [["list"], ["html", { outputFolder: "e2e/report/html", open: "never" }]],
});
