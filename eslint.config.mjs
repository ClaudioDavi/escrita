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
    rules: {},
  },
  // Documented exceptions (ARCHITECTURE.md, "Documented exceptions"). Inline disables of
  // these rules are rejected by the review config, so each one is scoped to its file here.
  {
    files: ["src/settings.ts"],
    rules: {
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
      "@typescript-eslint/no-deprecated": "off",
    },
  },
  { files: ["src/ui/confirm.ts"], rules: { "@typescript-eslint/no-deprecated": "off" } },
  { files: ["src/snapshots/fs.ts"], rules: { "obsidianmd/prefer-file-manager-trash-file": "off" } },
]);
