import { it, expect } from "vitest";
import { exportStrings } from "../src/export/strings";
it("parity", () => {
  const v = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  const en = exportStrings.en, pt = exportStrings["pt-BR"];
  expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
  for (const k of Object.keys(en)) expect([k, v(pt[k])]).toEqual([k, v(en[k])]);
});
