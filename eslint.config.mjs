// Obsidian community-plugin guidelines lint (PLAN-1.0 Q9): the rules the
// submission review bot runs. Only src/ is linted; tests and build scripts are not
// part of the submitted plugin.
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["main.js", "node_modules/**", "tests/**", "docs/**", "*.mjs", "*.config.ts", ".claude/**"] },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 1.0.3 needs Obsidian 1.13 (the declarative settings tab, PLAN-1.0.3). manifest.json's
      // minAppVersion moves to 1.13.0 at release (Wave 2); drop these two options then.
      "obsidianmd/no-unsupported-api": ["error", { minAppVersion: "1.13.0" }],
      "obsidianmd/settings-tab/require-display": ["warn", { minAppVersion: "1.13.0" }],
    },
  },
  // Documented exceptions (ARCHITECTURE.md, "Documented exceptions"). Inline disables of
  // these rules are rejected by the review config, so each one is scoped to its file here.
  { files: ["src/ui/confirm.ts"], rules: { "@typescript-eslint/no-deprecated": "off" } },
  { files: ["src/snapshots/fs.ts"], rules: { "obsidianmd/prefer-file-manager-trash-file": "off" } },
]);
