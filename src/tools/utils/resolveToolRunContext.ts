/**
 * Objective: Resolve the project context shared by Pi tools.
 * Used: Whenever a Pi tool needs the project directory, configuration, and paths.
 */

import { realpath } from 'node:fs/promises';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import type { MaestroConfig } from '#config/schema.ts';
import { MaestroPaths } from '#MaestroPaths.ts';

export type ToolRunContext = {
  projectRoot: string;
  config: MaestroConfig;
  paths: MaestroPaths;
};

export const resolveToolRunContext = async (
  cwd: string,
): Promise<ToolRunContext> => {
  const projectRoot = await realpath(cwd);
  const config = await loadConfiguration(projectRoot);

  return {
    projectRoot,
    config,
    paths: new MaestroPaths({ projectRoot, config }),
  };
};
