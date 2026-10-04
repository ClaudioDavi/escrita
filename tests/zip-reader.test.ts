import { describe, expect, it } from "vitest";
import { readerCrc32, readZip } from "./support/zip-reader";

const enc = new TextEncoder();

function u16(n: number) { return [n & 0xff, (n >> 8) & 0xff]; }
function u32(n: number) { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]; }

// Builds a STORE zip by hand, with CRCs given (so a test can corrupt one).
function build(files: { name: string; data: Uint8Array; crc: number }[]): Uint8Array {
  const bytes: number[] = [];
  const central: number[] = [];
  for (const f of files) {
    const name = [...enc.encode(f.name)];
    const offset = bytes.length;
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(f.crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0)];
    bytes.push(...u32(0x04034b50), ...common, ...name, ...f.data);
    central.push(...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name);
  }
  const cdOffset = bytes.length;
  bytes.push(...central);
  bytes.push(...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(central.length), ...u32(cdOffset), ...u16(0));
  return Uint8Array.from(bytes);
}

describe("readerCrc32", () => {
  it("matches the standard check values", () => {
    expect(readerCrc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(readerCrc32(new Uint8Array())).toBe(0);
    expect(readerCrc32(enc.encode("a"))).toBe(0xe8b7be43);
  });
});

describe("readZip", () => {
  const mk = (name: string, s: string, crc?: number) => {
    const data = enc.encode(s);
    return { name, data, crc: crc ?? readerCrc32(data) };
  };

  it("reads paths and data, including a UTF-8 name and an empty file", () => {
    const zip = build([mk("word/document.xml", "<w:document/>"), mk("Prólogo/capítulo.txt", "Olá, mundo — travessão"), mk("empty", "")]);
    const entries = readZip(zip);
    expect(entries.map(e => e.path)).toEqual(["word/document.xml", "Prólogo/capítulo.txt", "empty"]);
    expect(entries[0].text()).toBe("<w:document/>");
    expect(entries[1].text()).toBe("Olá, mundo — travessão");
    expect(entries[2].data.length).toBe(0);
  });

  it("reads a zip that sits inside a larger buffer", () => {
    const zip = build([mk("a.txt", "abc")]);
    const padded = new Uint8Array(zip.length + 7);
    padded.set(zip, 4);
    expect(readZip(padded.subarray(4, 4 + zip.length))[0].text()).toBe("abc");
  });

  it("rejects a wrong CRC", () => {
    expect(() => readZip(build([mk("a.txt", "abc", 123)]))).toThrow(/bad CRC for a\.txt/);
  });

  it("rejects bytes that are not a zip", () => {
    expect(() => readZip(enc.encode("not a zip at all, not a zip at all"))).toThrow(/central directory/);
  });
});
