import { describe, expect, it } from "vitest";
import { runChecks } from "../src/publish/checks";
import { publishStrings } from "../src/publish/strings";

const ctx = { placeholderMarker: "XXX", recommendedProperties: ["title"] };
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

describe("publish checks and their strings", () => {
  const text = "um\ndois <!-- aberto\n%% XXX: x %%\n%% beat: b %%\n";
  const checks = runChecks(text, {}, ctx);

  it("shows the <!-- blocker with its line, first among the blockers", () => {
    const c = checks.find((x) => x.id === "unclosedHtmlComment")!;
    expect(c.level).toBe("blocker");
    expect(c.vars.line).toBe(2);
    expect(checks.findIndex((x) => x.id === "unclosedHtmlComment")).toBeLessThan(
      checks.findIndex((x) => x.level === "warning"),
    );
  });

  it("has a sentence in both languages for every check, filled by the check's vars", () => {
    for (const c of checks) {
      const key = `publish.check.${c.id}.${c.level === "passed" ? "ok" : "bad"}`;
      for (const lang of ["en", "pt-BR"] as const) {
        const s = (publishStrings as Record<string, Record<string, string>>)[lang]?.[key];
        expect(s, `${lang} ${key}`).toBeTruthy();
        for (const v of vars(s)) if (c.id !== "overLimit") expect(c.vars, `${key} {${v}}`).toHaveProperty(v);
      }
    }
  });
});
