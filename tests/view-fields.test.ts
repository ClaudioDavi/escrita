// A view class must not declare a field named after one of Obsidian's own view members. Most
// of them are not in obsidian.d.ts, so TypeScript can't catch it, and a class field silently
// replaces the base's value after super(). The outline once had `actionsEl = null`: every
// plugin's `view.addAction` (the core bookmarks icon among them) threw on `prepend` (1.3.1).
// The names are read from Obsidian 1.15.1's View and ItemView.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..");

const VIEW_MEMBERS = [
  "app", "leaf", "containerEl", "contentEl", "headerEl", "titleEl", "titleContainerEl",
  "titleParentEl", "actionsEl", "leftActionsEl", "backButtonEl", "forwardButtonEl",
  "iconEl", "icon", "navigation", "scope", "closeable", "canDropAnywhere",
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

/** fields declared in the body of each class that extends a view class */
function shadowing(text: string): string[] {
  const out: string[] = [];
  const classRe = /class\s+\w+\s+extends\s+(ItemView|View|FileView|TextFileView|MarkdownRenderChild)\b[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(text))) {
    let depth = 1, i = classRe.lastIndex;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      i++;
    }
    const body = text.slice(start, i);
    // top-level field declarations only: lines at the class's own indentation
    for (const line of body.split("\n")) {
      const f = /^ {2}(?:(?:private|protected|public|readonly|override|declare)\s+)*(\w+)\s*[!?]?\s*[:=]/.exec(line);
      if (f && VIEW_MEMBERS.includes(f[1])) out.push(`${m[1]} field "${f[1]}": ${line.trim()}`);
    }
  }
  return out;
}

describe("view classes don't shadow Obsidian's view members", () => {
  it("no field named like a View or ItemView member", () => {
    const hits = files(join(ROOT, "src")).flatMap((p) =>
      shadowing(readFileSync(p, "utf8")).map((h) => `${relative(ROOT, p)}: ${h}`));
    expect(hits).toEqual([]);
  });
  it("catches the outline's old field", () => {
    expect(shadowing("class OutlineView extends ItemView {\n  private actionsEl: HTMLElement | null = null;\n}")).toHaveLength(1);
  });
});
