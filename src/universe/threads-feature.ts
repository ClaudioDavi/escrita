// Open threads as a switchable feature, split out of the universe module (0.7 plan Q9).
// Stub: an empty FeatureModule until the universe task moves the threads code here.

import { FeatureModule } from "../core/module-context";

export class ThreadsFeature extends FeatureModule {
  readonly id = "threads" as const;
  onload(): void {}
}
