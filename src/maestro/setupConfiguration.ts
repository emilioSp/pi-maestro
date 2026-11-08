/**
 * Objective: Coordinate first-use setup without mixing UI and configuration rules.
 * Used: By /maestro when interactive projects have no configuration.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

import {
  saveConfiguration,
  SETUP_ROLES,
  type AgentModelSelections,
} from '#config/saveConfiguration.ts';
import { setupChoices } from '#config/setupChoices.ts';
import { selectModel } from '#src/ui/selectModel.ts';
import { selectThinking } from '#src/ui/selectThinking.ts';
import { CONFIRM_SETUP, showSetupMenu } from '#src/ui/showSetupMenu.ts';

export const setupConfiguration = async (context: ExtensionContext): Promise<boolean> => {
  if (context.mode !== 'tui') {
    throw new Error('Initial Maestro configuration requires interactive Pi.');
  }

  const choices = setupChoices(context.modelRegistry.getAvailable());
  const selections: AgentModelSelections = {};

  while (true) {
    const action = await showSetupMenu({
      ui: context.ui,
      roles: Object.values(SETUP_ROLES),
      selections,
    });

    if (action === undefined) return false;

    if (action === CONFIRM_SETUP) {
      await saveConfiguration({ cwd: context.cwd, agentModelSelections: selections });

      return true;
    }

    const model = await selectModel({ ui: context.ui, choices: choices.map(({ value }) => value) });
    const choice = choices.find(({ value }) => value === model);

    if (!choice) continue;
    const thinking = await selectThinking({ ui: context.ui, choices: choice.thinkingLevels });

    if (thinking === undefined) continue;
    selections[action] = { model: choice.value, thinking };
  }
};
