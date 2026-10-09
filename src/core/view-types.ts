// The view type ids of Escrita's panels (1.0, Wave 2 seams). Obsidian saves them in the
// writer's workspace.json, so they never change. Each module's own constant is defined from
// this table (OUTLINE_VIEW = VIEW_TYPES.outline…), and code that only places a panel (the
// setup's layout, setup/layout.ts) reads the id here instead of importing the module's view.
// A panel is only placed while its feature is on (`features.isOn`): an off feature's slot
// draws a placeholder. Pure, no Obsidian imports.

export const VIEW_TYPES = {
  outline: "escrita-outline",
  lens: "escrita-lens",
  placeholders: "escrita-placeholders",
  universe: "escrita-universe",
} as const;
