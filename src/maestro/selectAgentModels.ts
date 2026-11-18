/**
 * Objective: Collect agent model and thinking choices until the owner confirms the current list.
 * Used: During first-use setup and when the owner changes agent models before activation.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

import { type AgentModelSelections, SETUP_ROLES } from '#config/saveConfiguration.ts';
import { setupChoices } from '#config/setupChoices.ts';
import { selectModel } from '#src/ui/selectModel.ts';
import { selectThinking } from '#src/ui/selectThinking.ts';
import { CONFIRM_SETUP, showAgentRolesSetupMenu } from '#src/ui/showAgentRolesSetupMenu.ts';

type SelectAgentModelsInput = {
  context: ExtensionContext;
  currentAgentsConfiguration: AgentModelSelections;
};

export const selectAgentModels = async ({
  context,
  currentAgentsConfiguration,
}: SelectAgentModelsInput): Promise<AgentModelSelections | undefined> => {
  const choices = setupChoices(context.modelRegistry.getAvailable());

  const classifiers = (await context.modelRegistry.getAvailableOfType('classifier')).map(
    ({ provider, id }) => `${provider}/${id}`,
  );

  const models = choices.map(({ value }) => value);
  const draft: AgentModelSelections = { ...currentAgentsConfiguration };

  while (true) {
    const action = await showAgentRolesSetupMenu({
      ui: context.ui,
      roles: Object.values(SETUP_ROLES),
      currentAgentsConfiguration: draft,
    });

    if (action === undefined) return undefined;

    if (action === CONFIRM_SETUP) return draft;

    const model = await selectModel({
      ui: context.ui,
      choices: action === SETUP_ROLES.SCORER ? classifiers : models,
    });

    if (model === undefined) continue;

    if (model === null) {
      delete draft[action];
      continue;
    }

    if (action === SETUP_ROLES.SCORER) {
      draft.scorer = { model };
      continue;
    }

    const choice = choices.find(({ value }) => value === model);

    if (!choice) continue;

    const thinking = await selectThinking({ ui: context.ui, choices: choice.thinkingLevels });

    if (thinking === undefined) continue;

    draft[action] = { model: choice.value, thinking };
  }
};
