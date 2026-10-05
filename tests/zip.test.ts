import { describe, expect, it } from "vitest";
import { crc32, zipStore } from "../src/core/zip";
import { readZip } from "./support/zip-reader";

const enc = new TextEncoder();

describe("crc32", () => {
  it("matches known vectors", () => {
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(enc.encode("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });
});

describe("zipStore", () => {
  const files = [
    { path: "[Content_Types].xml", data: enc.encode("<Types/>") },
    { path: "word/document.xml", data: enc.encode("<w:document>olá</w:document>") },
    { path: "word/vazio.xml", data: new Uint8Array() },
  ];

  it("reads back every file in order", () => {
    const back = readZip(zipStore(files));
    expect(back.map((e) => e.path)).toEqual(files.map((f) => f.path));
    back.forEach((e, i) => expect(Array.from(e.data)).toEqual(Array.from(files[i].data)));
  });

  it("gives the same bytes for the same files", () => {
    expect(Array.from(zipStore(files))).toEqual(Array.from(zipStore(files)));
  });

  it("writes UTF-8 names with the language flag", () => {
    const z = zipStore([{ path: "capítulo/ação.txt", data: enc.encode("x") }]);
    expect(new DataView(z.buffer).getUint16(6, true) & 0x800).toBe(0x800);
    expect(readZip(z)[0].path).toBe("capítulo/ação.txt");
  });

  it("uses 1980-01-01 by default and honors a given date", () => {
    const d = new DataView(zipStore(files).buffer);
    expect(d.getUint16(10, true)).toBe(0);
    expect(d.getUint16(12, true)).toBe(0x21);
    const z = new DataView(zipStore(files, { modified: new Date(2024, 4, 17, 13, 45, 30) }).buffer);
    expect(z.getUint16(10, true)).toBe((13 << 11) | (45 << 5) | 15);
    expect(z.getUint16(12, true)).toBe((44 << 9) | (5 << 5) | 17);
  });

  it("handles an empty archive", () => {
    expect(readZip(zipStore([]))).toEqual([]);
  });

  it("throws on duplicate, empty and absolute paths", () => {
    const d = new Uint8Array();
    expect(() => zipStore([{ path: "a", data: d }, { path: "a", data: d }])).toThrow();
    expect(() => zipStore([{ path: "", data: d }])).toThrow();
    expect(() => zipStore([{ path: "/a", data: d }])).toThrow();
  });
});
