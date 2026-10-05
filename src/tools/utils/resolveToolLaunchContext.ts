/**
 * Objective: Resolve the repository context shared by Pi tools.
 * Used: Whenever a Pi tool needs the current checkout, configuration, and paths.
 */

import { loadConfiguration } from '#config/loadConfiguration.ts';
import type { MaestroConfig } from '#config/schema.ts';
import { findRepositoryRoot } from '#git/repository/findRepositoryRoot.ts';
import { MaestroPaths } from '#MaestroPaths.ts';

export type ResolveToolLaunchContextInput = {
  cwd: string;
};

export type ToolLaunchContext = {
  repositoryRoot: string;
  config: MaestroConfig;
  paths: MaestroPaths;
};

export const resolveToolLaunchContext = async ({
  cwd,
}: ResolveToolLaunchContextInput): Promise<ToolLaunchContext> => {
  const repositoryRoot = await findRepositoryRoot({ cwd });
  const config = await loadConfiguration({ cwd: repositoryRoot });

  return {
    repositoryRoot,
    config,
    paths: new MaestroPaths({ repositoryRoot, config }),
  };
};
