/**
 * Objective: Load and validate project configuration.
 * Used: When Maestro initializes for a project.
 */

import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { assertConfiguration } from '#config/assertConfiguration.ts';
import { CONFIG_FILE_PATH, DEFAULT_CONFIG } from '#config/defaults.ts';
import type { MaestroConfig, PartialMaestroConfig } from '#config/schema.ts';
import { pathExists } from '#utils/path-exists.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

const resolveConfiguration = (input: PartialMaestroConfig): MaestroConfig => ({
  version: DEFAULT_CONFIG.version,
  specDirectory: input.specDirectory ?? DEFAULT_CONFIG.specDirectory,
  builder: { ...DEFAULT_CONFIG.builder, ...input.builder },
  verifier: { ...DEFAULT_CONFIG.verifier, ...input.verifier },
});

type ResolveSpecDirectoryInput = {
  projectRoot: string;
  directory: string;
};

const resolveSpecDirectory = ({
  projectRoot,
  directory,
}: ResolveSpecDirectoryInput): string => {
  if (directory.includes('\0')) {
    throw new Error('specDirectory must not contain a null byte.');
  }

  if (isAbsolute(directory)) {
    throw new Error('specDirectory must be relative to the project root.');
  }

  const requestedDirectory = resolve(projectRoot, directory);

  if (requestedDirectory === projectRoot) {
    throw new Error('specDirectory must not be the project root.');
  }

  if (
    !isPathStrictlyWithin({
      parent: projectRoot,
      path: requestedDirectory,
    })
  ) {
    throw new Error('specDirectory must stay inside the project root.');
  }

  return requestedDirectory;
};

type ResolveDirectoriesInput = {
  projectRoot: string;
  config: MaestroConfig;
};

const resolveDirectories = ({
  projectRoot,
  config,
}: ResolveDirectoriesInput): MaestroConfig => {
  const specDirectory = resolveSpecDirectory({
    projectRoot,
    directory: config.specDirectory,
  });

  return {
    ...config,
    specDirectory,
  };
};

const readConfigurationFile = async (path: string): Promise<unknown> => {
  try {
    const content = await readFile(path, 'utf8');

    return JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in configuration file "${path}": ${message}`);
  }
};

export const loadConfiguration = async (
  cwd: string = process.cwd(),
): Promise<MaestroConfig> => {
  const projectRoot = await realpath(cwd);
  const targetPath = join(projectRoot, CONFIG_FILE_PATH);

  if (!(await pathExists(targetPath))) {
    return resolveDirectories({ projectRoot, config: DEFAULT_CONFIG });
  }

  const parsed = await readConfigurationFile(targetPath);

  assertConfiguration(parsed);
  const config = resolveConfiguration(parsed);

  return resolveDirectories({ projectRoot, config });
};
