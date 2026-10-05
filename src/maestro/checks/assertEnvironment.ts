/**
 * Objective: Validate the read-only environment required by Maestro.
 * Used: When the owner activates Maestro mode.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { resolveSubagentLaunchContract } from 'pi-subagents/preflight';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { AGENTS } from '#config/schema.ts';
import { assertRepositoryTrusted } from '#git/repository/assertRepositoryTrusted.ts';
import { findRepositoryRoot } from '#git/repository/findRepositoryRoot.ts';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type GetRepositoryRootInput = {
  context: ExtensionContext;
};

const getRepositoryRoot = async ({
  context,
}: GetRepositoryRootInput): Promise<string> => {
  try {
    const repositoryRoot = await findRepositoryRoot({ cwd: context.cwd });
    await assertRepositoryTrusted({ repositoryRoot });

    if (!context.isProjectTrusted()) {
      throw new Error(`Project is not trusted: "${repositoryRoot}".`);
    }

    return repositoryRoot;
  } catch (error) {
    throw new Error(`Git repository check failed: ${getErrorMessage(error)}`);
  }
};

type GetActivationConfigurationInput = {
  repositoryRoot: string;
};

const getActivationConfiguration = async ({
  repositoryRoot,
}: GetActivationConfigurationInput): Promise<
  Awaited<ReturnType<typeof loadConfiguration>>
> => {
  try {
    return await loadConfiguration({ cwd: repositoryRoot });
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

type AssertAgentsAvailableInput = {
  repositoryRoot: string;
};

async function assertAgentsAvailable({
  repositoryRoot,
}: AssertAgentsAvailableInput): Promise<void> {
  for (const agent of [AGENTS.BUILDER, AGENTS.VERIFIER]) {
    const result = await resolveSubagentLaunchContract({
      agent,
      cwd: repositoryRoot,
      context: 'fresh',
    });

    if (!result.ok) {
      throw new Error(result.message);
    }
  }
}

type AssertEnvironmentInput = {
  context: ExtensionContext;
};

export async function assertEnvironment({
  context,
}: AssertEnvironmentInput): Promise<void> {
  const repositoryRoot = await getRepositoryRoot({ context });

  try {
    await assertAgentsAvailable({ repositoryRoot });
  } catch (error) {
    throw new Error(
      `Builder or verifier agent check failed: ${getErrorMessage(error)}`,
    );
  }

  const config = await getActivationConfiguration({ repositoryRoot });

  assertModelsAvailable({ context, config });
}
