import type EscritaPlugin from "../main";
import { CoreModule } from "../core/module-context";
import type { NewWorkKind, NewWorkStarter } from "../core/new-work";

/**
 * Start a new work (1.0.4, SF 14; boards 41-42; PLAN-1.0.4 Q1). A core module, not a feature:
 * starting a work is never switched off. main.ts starts it with `startCoreModule` after the
 * registry has applied the switches and assigns it to `plugin.newWork`, typed by the port
 * (`core/new-work.ts`), so the desk and the outline view call it without importing this
 * folder. It registers only through `this.ctx`.
 *
 * Wave 0 stub: the seam only. Task A (Wave 1) adds the commands ("new-work",
 * "new-short-story", and "create-book" moved from the outline with a checkCallback on the
 * outline), the list, the modal and the creation (`model.ts`, `modals.ts`).
 */
export class NewWorkModule extends CoreModule implements NewWorkStarter {
  constructor(private readonly plugin: EscritaPlugin) {
    super();
  }

  start(kind?: NewWorkKind): void {
    if (kind && !this.offers(kind)) return;
  }

  offers(kind: NewWorkKind): boolean {
    return kind === "story" || this.plugin.features.isOn("outline");
  }
}
