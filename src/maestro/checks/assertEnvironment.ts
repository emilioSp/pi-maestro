/**
 * Objective: Validate the read-only environment required by Maestro.
 * Used: When the owner activates Maestro mode.
 */

import { realpath } from 'node:fs/promises';

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

import { loadConfiguration } from '#config/loadConfiguration.ts';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const getProjectRoot = async (context: ExtensionContext): Promise<string> => {
  try {
    const projectRoot = await realpath(context.cwd);

    if (!context.isProjectTrusted()) {
      throw new Error(`Project is not trusted: "${projectRoot}".`);
    }

    return projectRoot;
  } catch (error) {
    throw new Error(`Project check failed: ${getErrorMessage(error)}`);
  }
};

const getActivationConfiguration = async (
  projectRoot: string,
): Promise<Awaited<ReturnType<typeof loadConfiguration>>> => {
  try {
    return await loadConfiguration(projectRoot);
  } catch (error) {
    throw new Error(`Maestro configuration check failed: ${getErrorMessage(error)}`);
  }
};

type AssertModelsAvailableInput = {
  context: ExtensionContext;
  models: string[];
};

function assertModelsAvailable({ context, models }: AssertModelsAvailableInput): void {
  const availableModels = context.modelRegistry.getAvailable();

  for (const model of models) {
    if (!availableModels.some((entry) => `${entry.provider}/${entry.id}` === model)) {
      throw new Error(`Configured model is not available: "${model}".`);
    }
  }
}

type AssertEnvironmentInput = {
  context: ExtensionContext;
};

export async function assertEnvironment({ context }: AssertEnvironmentInput): Promise<void> {
  const projectRoot = await getProjectRoot(context);
  const config = await getActivationConfiguration(projectRoot);

  if (!config.builder.required) return;

  const enabledAgents = [config.builder, config.verifier, config.simplifier].filter(
    ({ required }) => required,
  );

  assertModelsAvailable({ context, models: enabledAgents.map(({ model }) => model) });
}
