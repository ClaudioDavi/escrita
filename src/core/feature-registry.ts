// Loads and unloads the switchable features (0.7 plan Q6, Q12). Stub until 1.1.

import type EscritaPlugin from "../main";
import type { EscritaModule } from "../data";
import type { FeatureId } from "./features";
import type { FeatureModule } from "./module-context";

export class FeatureRegistry {
  constructor(plugin: EscritaPlugin, modules: ReadonlyMap<FeatureId, FeatureModule | EscritaModule>) {
    throw new Error("todo");
  }

  /** At plugin load: view, extension and code block slots; data followers of every module. */
  init(): void {
    throw new Error("todo");
  }

  /** Synchronous; a re-entrant call re-runs once at the end (Q12). */
  apply(): void {
    throw new Error("todo");
  }

  isOn(id: FeatureId): boolean {
    throw new Error("todo");
  }

  /** The module when loaded. */
  get<T>(id: FeatureId): T | undefined {
    throw new Error("todo");
  }

  onChange(cb: (id: FeatureId, on: boolean) => void): () => void {
    throw new Error("todo");
  }

  /** Fans out to loaded modules only. */
  settingsChanged(): void {
    throw new Error("todo");
  }

  unloadAll(): void {
    throw new Error("todo");
  }
}
