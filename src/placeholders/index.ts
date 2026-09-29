import type EscritaPlugin from "../main";
import type { EscritaModule } from "../data";

export class PlaceholdersModule implements EscritaModule {
  constructor(private plugin: EscritaPlugin) {}

  load(): void {
    void this.plugin;
  }
}
