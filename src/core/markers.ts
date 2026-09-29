// Pure parsing of the plugin's in-text markers. All markers are single-line
// Obsidian comments so they are hidden in Reading view and by most publishers:
//
//   %% beat: As cartas na caixa de lata %%      ← a scene beat from the outline
//   %% XXX: conferir se o porão tem janela %%   ← a placeholder (marker configurable)
//
// Scene breaks are a line holding only `---` (or `***`, `* * *`) with blank lines around.

export interface BeatMarker {
  /** 0-based line index of the beat comment */
  line: number;
  text: string;
  /** true when non-blank prose exists after the beat, before the next beat/break/end */
  written: boolean;
}

export interface PlaceholderMarker {
  line: number;
  /** character offset of the `%%` opening within the whole text */
  from: number;
  to: number;
  text: string;
}

export const BEAT_LINE = /^[ \t]*%%[ \t]*beat:[ \t]*(.*?)[ \t]*%%[ \t]*$/i;
export const SCENE_BREAK = /^[ \t]*(?:-{3,}|\*{3,}|(?:\*[ \t]+){2}\*|(?:-[ \t]+){2}-)[ \t]*$/;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function placeholderRegex(marker: string): RegExp {
  return new RegExp(`%%[ \\t]*${escapeRe(marker)}\\b:?[ \\t]*([^\\n]*?)[ \\t]*%%`, "g");
}

/** Index of the first body line (after frontmatter), 0-based. */
export function bodyStartLine(lines: string[]): number {
  if (lines[0] !== undefined && /^---[ \t]*$/.test(lines[0])) {
    for (let i = 1; i < lines.length; i++) if (/^(---|\.\.\.)[ \t]*$/.test(lines[i])) return i + 1;
  }
  return 0;
}

function isProse(line: string): boolean {
  const t = line.replace(/%%[^\n]*?%%/g, "").trim();
  return t.length > 0 && !SCENE_BREAK.test(t);
}

export function parseBeats(text: string): BeatMarker[] {
  const lines = text.split(/\r?\n/);
  const start = bodyStartLine(lines);
  const beats: BeatMarker[] = [];
  for (let i = start; i < lines.length; i++) {
    const m = BEAT_LINE.exec(lines[i]);
    if (!m) continue;
    let written = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (BEAT_LINE.test(lines[j]) || SCENE_BREAK.test(lines[j])) break;
      if (isProse(lines[j])) { written = true; break; }
    }
    beats.push({ line: i, text: m[1], written });
  }
  return beats;
}

export function parsePlaceholders(text: string, marker: string): PlaceholderMarker[] {
  const out: PlaceholderMarker[] = [];
  const re = placeholderRegex(marker);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index).split("\n").length - 1;
    out.push({ line, from: m.index, to: m.index + m[0].length, text: m[1] });
  }
  return out;
}

export function beatLine(text: string): string {
  return `%% beat: ${text.replace(/%%/g, "%").replace(/\r?\n/g, " ").trim()} %%`;
}
