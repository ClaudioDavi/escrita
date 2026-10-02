// The grammar of the escrita-works code block (no Obsidian imports).
// Today only `folder:` lines mean anything; every other line is ignored.

export interface BlockOptions { folders: string[] }

function cleanFolder(raw: string): string {
  let v = raw.trim();
  const q = /^(["'])(.*)\1$/.exec(v);
  if (q) v = q[2].trim();
  const link = /^\[\[(.*)\]\]$/.exec(v);
  if (link) v = link[1].split("|")[0].split("#")[0].trim();
  return v.replace(/^\/+|\/+$/g, "").trim();
}

export function parseBlock(source: string): BlockOptions {
  const folders: string[] = [];
  for (const line of source.split(/\r\n?|\n/)) {
    const m = /^\s*folder\s*:(.*)$/i.exec(line);
    if (!m) continue;
    const f = cleanFolder(m[1]);
    if (f && !folders.includes(f)) folders.push(f);
  }
  return { folders };
}
