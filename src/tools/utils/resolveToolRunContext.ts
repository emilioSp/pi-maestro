/**
 * Objective: Resolve the repository context shared by Pi tools.
 * Used: Whenever a Pi tool needs the current checkout, configuration, and paths.
 */

import { loadConfiguration } from '#config/loadConfiguration.ts';
import type { MaestroConfig } from '#config/schema.ts';
import { findRepositoryRoot } from '#git/repository/findRepositoryRoot.ts';
import { MaestroPaths } from '#MaestroPaths.ts';

export type ToolRunContext = {
  repositoryRoot: string;
  config: MaestroConfig;
  paths: MaestroPaths;
};

export const resolveToolRunContext = async (
  cwd: string,
): Promise<ToolRunContext> => {
  const repositoryRoot = await findRepositoryRoot(cwd);
  const config = await loadConfiguration(repositoryRoot);

  return {
    repositoryRoot,
    config,
    paths: new MaestroPaths({ repositoryRoot, config }),
  };
};
