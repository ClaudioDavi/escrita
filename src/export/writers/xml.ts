// XML helpers shared by the DOCX and EPUB writers. Pure, no Obsidian imports.

// A loop, not a regex: a regex with control characters trips no-control-regex.
function stripForbidden(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c <= 0x08 || c === 0x0b || c === 0x0c || (c >= 0x0e && c <= 0x1f) || c === 0xfffe || c === 0xffff) continue;
    out += ch;
  }
  return out;
}

/** XML text: the five entities, and characters XML 1.0 forbids dropped. */
export function xmlEscape(s: string): string {
  return stripForbidden(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
