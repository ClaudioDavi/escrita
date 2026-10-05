import { describe, expect, it } from "vitest";
import { propsOf, resultLine, submissionFileName, submissionText, workLine } from "../src/submissions/logic";

const bytes = (s: string): number => new TextEncoder().encode(s).length;

describe("submission file name length", () => {
  it("stays under 255 bytes for CJK titles", () => {
    const name = submissionFileName("2026-10-05", "雨".repeat(40), "市".repeat(50));
    expect(bytes(name)).toBeLessThanOrEqual(255 - 2);
  });
  it("never leaves a lone surrogate at the cut", () => {
    const name = submissionFileName("2026-10-05", "T", "Revista " + "🌙".repeat(100));
    expect(name).not.toMatch(/[\uD800-\uDBFF]\.md$/);
    expect(name).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(name.endsWith(".md")).toBe(true);
  });
});

describe("configured property names in the preview lines", () => {
  const props = { ...propsOf({}), work: "obra", result: "resultado" };
  it("uses them, matching the note", () => {
    expect(workLine(props, "[[O porão]]")).toBe('obra: "[[O porão]]"');
    expect(resultLine(props, "pendente")).toBe("resultado: pendente");
    const text = submissionText({ link: "[[O porão]]", market: "M", sent: "2026-10-05", result: "pendente" }, props);
    expect(text).toContain(workLine(props, "[[O porão]]"));
    expect(text).toContain(resultLine(props, "pendente"));
  });
});
