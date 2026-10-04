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
  void files; void o;
  throw new Error("not implemented: 0.8 task 1.4");
}

/** CRC-32 (IEEE 802.3, the zip polynomial 0xEDB88320) of `data`, as an unsigned 32-bit number. */
export function crc32(data: Uint8Array): number {
  void data;
  throw new Error("not implemented: 0.8 task 1.4");
}
