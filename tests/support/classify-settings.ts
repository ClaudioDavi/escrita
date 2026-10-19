// A whole ClassifySettings for tests (IMPROVEMENTS 43): the English defaults, then the fields a
// test cares about. ClassifySettings has no optional fields, so a hand-built object would
// otherwise list every one of them.

import { defaultsFor } from "../../src/settings";
import type { ClassifySettings } from "../../src/core/classify";

/** The English defaults with `partial` on top; extra keys the caller passes (a module's settings) are kept. */
export function classifySettings<T extends Partial<ClassifySettings>>(partial: T = {} as T): ClassifySettings & T {
  return { ...defaultsFor("en"), ...partial };
}
