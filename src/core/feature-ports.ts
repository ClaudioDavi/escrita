// Typed feature ports (1.2.5, IMPROVEMENTS 42). A module that offers something to other modules
// exposes it on itself, and the others read it through the registry while the feature is loaded,
// never by importing the module (CONTEXT.md, "features"). `features.get<T>(id)` casts the module
// to whatever `T` the caller names, so a renamed port returned undefined at runtime instead of
// failing to compile. `FeaturePorts` names, once, what each feature id offers; `port` reads it
// with that type. Pure types and one wrapper, no Obsidian imports. Every port type lives in core
// already (core/writing-mode.ts, core/daily-progress.ts, core/pending.ts, core/serial.ts), so
// core imports no module folder.

import type { FeatureId } from "./features";
import type { WritingModeHost } from "./writing-mode";
import type { DailyProgressHost } from "./daily-progress";
import type { PendingHost } from "./pending";
import type { PublishNextPort } from "./serial";

/**
 * What each feature offers other modules, by feature id: the shape of the loaded module as its
 * readers see it. A module class should `implements` its entry (the desk already implements
 * `WritingModeHost`, the publish module `PublishNextPort`), so a rename fails to compile on both
 * sides. Every key must be a `FeatureId` (`port` passes it to `features.get`). A new port is one
 * row here plus its type in core; candidate 24's "create entry" port lands here.
 */
export interface FeaturePorts {
  desk: WritingModeHost;
  goals: DailyProgressHost;
  submissions: PendingHost;
  publish: PublishNextPort;
}

/** The feature ids that offer a port. */
export type PortId = keyof FeaturePorts;

/** What `port` reads from: the feature registry, or a plain object in a test. */
export interface PortSource {
  get<T>(id: FeatureId): T | undefined;
}

/**
 * The port of feature `id` while it is loaded, else undefined (a soft dependency: the caller does
 * without it). Typed by `FeaturePorts`, so callers name no type of their own.
 *
 * A function over `PortSource` rather than a method on `FeatureRegistry`, because: the shims it
 * replaces (`writingModeOf`, `dailyProgressOf`) take a structural `{ get }` so their tests and
 * the setup's pass plain fakes, and this keeps that; the registry (which imports `main`) stays as
 * it is, with `get<T>` left for the settings tab's untyped `FeatureModule` reads; and the port
 * table stays a pure file a test can import alone. Callers write `port(plugin.features, "desk")`.
 */
export function port<K extends PortId>(features: PortSource, id: K): FeaturePorts[K] | undefined {
  return features.get<FeaturePorts[K]>(id);
}
