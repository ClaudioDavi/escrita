// Obsidian loads a single styles.css. Each module keeps its own CSS next to
// its code; this concatenates them (shared tokens first).
import { readFileSync, writeFileSync, existsSync } from "fs";

const parts = ["src/styles.css", "src/goals/styles.css", "src/outline/styles.css",
  "src/placeholders/styles.css", "src/darlings/styles.css", "src/editor/styles.css", "src/publish/styles.css",
  "src/explorer/styles.css", "src/snapshots/styles.css", "src/desk/styles.css",
  "src/lens/editor.css", "src/lens/panel.css"];
const css = parts.filter(existsSync).map((p) => `/* ${p} */\n${readFileSync(p, "utf8").trim()}\n`).join("\n");
writeFileSync("styles.css", css);
