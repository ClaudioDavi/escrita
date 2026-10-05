// A STORE-only zip writer (PLAN-0.8 Q1): local headers, central directory, end
// record, CRC-32. No compression, no dependency. Pure, no Obsidian imports.
// A DOCX is a zip of a few small XML parts, so a manuscript stays a few hundred KB.
// Gate G0a checked that LibreOffice and Google Docs open the result; Word and
// Pages are checked before release. Filled by task 1.4; tests read the output
// back with tests/support/zip-reader.ts.

export interface ZipEntry {
  /** a relative path with "/" separators, no leading slash: "word/document.xml" */
  path: string;
  data: Uint8Array;
}

export interface ZipOptions {
  /**
   * The modification time written for every entry (DOS date and time, local
   * fields read as given). Default 1980-01-01 00:00, the earliest DOS date, so
   * the same entries always give the same bytes.
   */
  modified?: Date;
}

/**
 * The zip archive of `files`, in the given order (DOCX wants `[Content_Types].xml`
 * first; the caller orders). Every entry is STORE (method 0) with its CRC-32 and
 * sizes in the local header (no data descriptor). Paths are encoded as UTF-8 with
 * the language encoding flag (bit 11) set. Throws on a duplicate path, an empty or
 * absolute path, or an archive past the 4 GB / 65,535-entry limits of plain zip.
 */
export function zipStore(files: readonly ZipEntry[], o?: ZipOptions): Uint8Array {
  if (files.length > 0xffff) throw new Error("zip: too many entries (65,535 at most)");
  const { time, date } = dosStamp(o?.modified);
  const enc = new TextEncoder();
  const seen = new Set<string>();
  const names: Uint8Array[] = [];
  let total = 22;
  for (const f of files) {
    if (!f.path || f.path.startsWith("/")) throw new Error(`zip: bad path "${f.path}"`);
    if (seen.has(f.path)) throw new Error(`zip: duplicate path "${f.path}"`);
    seen.add(f.path);
    const name = enc.encode(f.path);
    if (name.length > 0xffff) throw new Error(`zip: path too long "${f.path}"`);
    names.push(name);
    total += 30 + 46 + 2 * name.length + f.data.length;
  }
  if (total > 0xffffffff) throw new Error("zip: archive too large (4 GB at most)");
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  const offsets: number[] = [];
  const crcs: number[] = [];
  let p = 0;
  files.forEach((f, i) => {
    const name = names[i];
    const crc = crc32(f.data);
    offsets.push(p);
    crcs.push(crc);
    v.setUint32(p, 0x04034b50, true);
    v.setUint16(p + 4, 20, true);
    v.setUint16(p + 6, 0x0800, true);
    v.setUint16(p + 8, 0, true);
    v.setUint16(p + 10, time, true);
    v.setUint16(p + 12, date, true);
    v.setUint32(p + 14, crc, true);
    v.setUint32(p + 18, f.data.length, true);
    v.setUint32(p + 22, f.data.length, true);
    v.setUint16(p + 26, name.length, true);
    v.setUint16(p + 28, 0, true);
    out.set(name, p + 30);
    out.set(f.data, p + 30 + name.length);
    p += 30 + name.length + f.data.length;
  });
  const cdStart = p;
  files.forEach((f, i) => {
    const name = names[i];
    v.setUint32(p, 0x02014b50, true);
    v.setUint16(p + 4, 20, true);
    v.setUint16(p + 6, 20, true);
    v.setUint16(p + 8, 0x0800, true);
    v.setUint16(p + 10, 0, true);
    v.setUint16(p + 12, time, true);
    v.setUint16(p + 14, date, true);
    v.setUint32(p + 16, crcs[i], true);
    v.setUint32(p + 20, f.data.length, true);
    v.setUint32(p + 24, f.data.length, true);
    v.setUint16(p + 28, name.length, true);
    v.setUint32(p + 42, offsets[i], true);
    out.set(name, p + 46);
    p += 46 + name.length;
  });
  v.setUint32(p, 0x06054b50, true);
  v.setUint16(p + 8, files.length, true);
  v.setUint16(p + 10, files.length, true);
  v.setUint32(p + 12, p - cdStart, true);
  v.setUint32(p + 16, cdStart, true);
  return out;
}

function dosStamp(d?: Date): { time: number; date: number } {
  if (!d) return { time: 0, date: (0 << 9) | (1 << 5) | 1 };
  const y = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (IEEE 802.3, the zip polynomial 0xEDB88320) of `data`, as an unsigned 32-bit number. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
