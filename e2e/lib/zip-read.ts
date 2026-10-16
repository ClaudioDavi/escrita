// A small zip reader for specs that open what Escrita wrote (an .epub, a .docx). Entries are
// stored or deflated, which is all Escrita's own writer and word processors produce.
import { inflateRawSync } from "node:zlib";

export interface ZipEntry {
  name: string;
  /** 0 stored, 8 deflated */
  method: number;
  data: Buffer;
}

export function readZip(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip file: no end-of-central-directory record");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central directory entry");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + compSize);
    out.push({ name, method, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Entries by name, and the order they sit in the file. */
export function zipFiles(buf: Buffer): { names: string[]; entries: ZipEntry[]; text(name: string): string; has(name: string): boolean } {
  const entries = readZip(buf);
  const byName = new Map(entries.map((e) => [e.name, e]));
  return {
    names: entries.map((e) => e.name),
    entries,
    has: (name) => byName.has(name),
    text: (name) => {
      const e = byName.get(name);
      if (!e) throw new Error(`no ${name} in the zip`);
      return e.data.toString("utf8");
    },
  };
}
