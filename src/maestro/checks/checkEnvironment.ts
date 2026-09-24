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
import { type GetMaestroPaths, getMaestroPaths } from '#paths.ts';
import { discoverActiveWorkflow } from '#workflow/state/discover.ts';
import { reconcileWorkflow } from '#workflow/state/reconcile.ts';

type CheckEnvironmentInput = {
  context: ExtensionContext;
};

const getRepositoryRoot = async ({
  context,
}: {
  context: ExtensionContext;
}): Promise<string> => {
  try {
    const repositoryRoot = await findRepositoryRoot({ cwd: context.cwd });
    await assertRepositoryTrusted({ repositoryRoot });

    if (!context.isProjectTrusted()) {
      throw new Error(`Project is not trusted: "${repositoryRoot}".`);
    }

    return repositoryRoot;
  } catch (error) {
    throw new Error(`Git repository check failed: ${(error as Error).message}`);
  }
};

const getActivationConfiguration = async ({
  repositoryRoot,
}: {
  repositoryRoot: string;
}): Promise<Awaited<ReturnType<typeof loadConfiguration>>> => {
  try {
    return await loadConfiguration({ cwd: repositoryRoot });
  } catch (error) {
    throw new Error(
      `Maestro configuration check failed: ${(error as Error).message}`,
    );
  }
};

const assertModelsAvailable = ({
  context,
  config,
}: {
  context: ExtensionContext;
  config: Awaited<ReturnType<typeof loadConfiguration>>;
}): void => {
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
};

const assertAgentsAvailable = async ({
  repositoryRoot,
}: {
  repositoryRoot: string;
}): Promise<void> => {
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
};

const getWorkflow = async (paths: GetMaestroPaths) => {
  try {
    const workflow = await discoverActiveWorkflow({ paths });
    return workflow;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Maestro workflow state check failed: ${message}`);
  }
};

export const checkEnvironment = async ({
  context,
}: CheckEnvironmentInput): Promise<void> => {
  const repositoryRoot = await getRepositoryRoot({ context });

  try {
    await assertAgentsAvailable({ repositoryRoot });
  } catch (error) {
    throw new Error(
      `Builder or verifier agent check failed: ${(error as Error).message}`,
    );
  }

  const config = await getActivationConfiguration({ repositoryRoot });

  assertModelsAvailable({ context, config });

  const paths = getMaestroPaths({ repositoryRoot, config });

  const workflow = await getWorkflow(paths);
  if (workflow !== null) {
    const reconciliation = await reconcileWorkflow({
      paths,
      state: workflow.state,
    });

    if (reconciliation.issues.length > 0) {
      throw new Error(
        `Maestro workflow state check failed: ${reconciliation.issues.join('\n\n')}`,
      );
    }
  }
};
