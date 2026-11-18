/**
 * Objective: Coordinate first-use setup without mixing UI and configuration rules.
 * Used: By /maestro when the project has no configuration file.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

import { saveConfiguration } from '#config/saveConfiguration.ts';
import { selectAgentModels } from '#maestro/selectAgentModels.ts';

export const setupInitialConfiguration = async (context: ExtensionContext): Promise<boolean> => {
  if (context.mode !== 'tui') {
    throw new Error('Initial Maestro configuration requires interactive Pi.');
  }

  const agentModelSelections = await selectAgentModels({
    context,
    currentAgentsConfiguration: {},
  });

  if (agentModelSelections === undefined) return false;

  await saveConfiguration({ cwd: context.cwd, agentModelSelections });

  return true;
};
