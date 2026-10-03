// The editor's switchable features, split out of EditorModule (0.7 plan Q9, task 2.5).
// Stubs: each is an empty FeatureModule until 2.5 moves its code here.

import { FeatureModule } from "../core/module-context";

export class TypingFeature extends FeatureModule {
  readonly id = "typing" as const;
  onload(): void {}
}

export class DialogueFocusFeature extends FeatureModule {
  readonly id = "dialogueFocus" as const;
  onload(): void {}
}

export class MoveBlocksFeature extends FeatureModule {
  readonly id = "moveBlocks" as const;
  onload(): void {}
}

export class TemplatesFeature extends FeatureModule {
  readonly id = "templates" as const;
  onload(): void {}
}

export class SpellcheckFeature extends FeatureModule {
  readonly id = "spellcheck" as const;
  onload(): void {}
}
