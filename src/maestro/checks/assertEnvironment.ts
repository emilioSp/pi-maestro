/**
 * Objective: Validate the read-only environment required by Maestro.
 * Used: When the owner activates Maestro mode.
 */

import { realpath } from 'node:fs/promises';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { resolveSubagentLaunchContract } from 'pi-subagents/preflight';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { AGENTS } from '#config/schema.ts';

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
    throw new Error(
      `Maestro configuration check failed: ${getErrorMessage(error)}`,
    );
  }
};

type AssertModelsAvailableInput = {
  context: ExtensionContext;
  config: Awaited<ReturnType<typeof loadConfiguration>>;
};

function assertModelsAvailable({
  context,
  config,
}: AssertModelsAvailableInput): void {
  const availableModels = context.modelRegistry.getAvailable();

  for (const model of [config.builder.model, config.verifier.model]) {
    const [provider, id] = model.split('/');

    if (
      !availableModels.some(
        (entry) => entry.provider === provider && entry.id === id,
      )
    ) {
      throw new Error(`Configured model is not available: "${model}".`);
    }
  }
}

async function assertAgentsAvailable(projectRoot: string): Promise<void> {
  for (const agent of [AGENTS.BUILDER, AGENTS.VERIFIER]) {
    const result = await resolveSubagentLaunchContract({
      agent,
      cwd: projectRoot,
      context: 'fresh',
    });

    if (!result.ok) {
      throw new Error(result.message);
    }
  }
}

export async function assertEnvironment(
  context: ExtensionContext,
): Promise<void> {
  const projectRoot = await getProjectRoot(context);

  try {
    await assertAgentsAvailable(projectRoot);
  } catch (error) {
    throw new Error(
      `Builder or verifier agent check failed: ${getErrorMessage(error)}`,
    );
  }

  const config = await getActivationConfiguration(projectRoot);

  assertModelsAvailable({ context, config });
}
