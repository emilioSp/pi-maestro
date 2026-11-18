/**
 * Objective: Validate that the models of enabled agents exist in Pi's registry.
 * Used: After the owner chooses the workflow action and before Maestro activates.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

import type { MaestroConfig } from '#config/schema.ts';

type AssertModelsAvailableInput = {
  context: ExtensionContext;
  models: string[];
};

const assertModelsAvailable = ({ context, models }: AssertModelsAvailableInput): void => {
  const availableModels = context.modelRegistry.getAvailable();

  for (const model of models) {
    if (!availableModels.some((entry) => `${entry.provider}/${entry.id}` === model)) {
      throw new Error(`Configured model is not available: "${model}".`);
    }
  }
};

type AssertEnvironmentInput = {
  context: ExtensionContext;
  config: MaestroConfig;
};

export const assertEnvironment = ({ context, config }: AssertEnvironmentInput): void => {
  if (!config.builder.required) return;

  const enabledAgents = [config.builder, config.verifier, config.simplifier].filter(
    ({ required }) => required,
  );

  assertModelsAvailable({ context, models: enabledAgents.map(({ model }) => model) });
};
