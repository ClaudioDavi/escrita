// The stage snapshot as a switchable feature, split out of the snapshots module
// (0.7 plan Q9, Q11; requires snapshots). Stub: an empty FeatureModule until its task fills it.

import { FeatureModule } from "../core/module-context";

export class StageSnapshotFeature extends FeatureModule {
  readonly id = "stageSnapshot" as const;
  onload(): void {}
}
