// A tiny reader for STORE (uncompressed) zips, for tests. It walks the central
// directory, reads each local entry, and checks every CRC32 with its own table, so it
// shares no code with core/zip.ts.

export interface ZipEntry {
  path: string;
  data: Uint8Array;
  text(): string;
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

export function readerCrc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function readZip(zip: Uint8Array): ZipEntry[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const dec = new TextDecoder("utf-8", { fatal: true });
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip: no end of central directory");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("zip: bad central header");
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const csize = v.getUint32(p + 20, true);
    const usize = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const path = dec.decode(zip.subarray(p + 46, p + 46 + nameLen));
    if (method !== 0) throw new Error(`zip: ${path} is not stored (method ${method})`);
    if (csize !== usize) throw new Error(`zip: ${path} sizes differ`);
    if (v.getUint32(local, true) !== 0x04034b50) throw new Error(`zip: bad local header for ${path}`);
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = zip.slice(start, start + usize);
    if (data.length !== usize) throw new Error(`zip: ${path} is truncated`);
    if (readerCrc32(data) !== crc) throw new Error(`zip: bad CRC for ${path}`);
    out.push({ path, data, text: () => new TextDecoder().decode(data) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
