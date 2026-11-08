/**
 * Objective: Collect a thinking choice from supplied supported levels.
 * Used: After a model is selected during setup.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

import type { ThinkingLevel } from '#config/schema.ts';

type SelectThinkingInput = {
  ui: ExtensionContext['ui'];
  choices: ThinkingLevel[];
};

export const selectThinking = async ({ ui, choices }: SelectThinkingInput) => {
  const selected = await ui.select('Select thinking', choices);

  return choices.find((choice) => choice === selected);
};
