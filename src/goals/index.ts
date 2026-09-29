import type EscritaPlugin from "../main";
import type { EscritaModule } from "../data";

export class GoalsModule implements EscritaModule {
  constructor(private plugin: EscritaPlugin) {}

  load(): void {
    void this.plugin;
  }
}
