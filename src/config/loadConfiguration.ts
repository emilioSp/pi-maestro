/**
 * Objective: Load and validate repository configuration.
 * Used: When Maestro initializes for a repository.
 */

import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { assertConfiguration } from '#config/assertConfiguration.ts';
import { CONFIG_FILE_PATH, DEFAULT_CONFIG } from '#config/defaults.ts';
import type { MaestroConfig, PartialMaestroConfig } from '#config/schema.ts';
import { pathExists } from '#utils/path-exists.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

const resolveConfiguration = (input: PartialMaestroConfig): MaestroConfig => {
  const resolved: MaestroConfig = {
    version: DEFAULT_CONFIG.version,
    specDirectory: input.specDirectory ?? DEFAULT_CONFIG.specDirectory,
    builder: {
      model: input.builder?.model ?? DEFAULT_CONFIG.builder.model,
      thinking: input.builder?.thinking ?? DEFAULT_CONFIG.builder.thinking,
      timeoutMinutes:
        input.builder?.timeoutMinutes ?? DEFAULT_CONFIG.builder.timeoutMinutes,
    },
    verifier: {
      model: input.verifier?.model ?? DEFAULT_CONFIG.verifier.model,
      thinking: input.verifier?.thinking ?? DEFAULT_CONFIG.verifier.thinking,
      timeoutMinutes:
        input.verifier?.timeoutMinutes ??
        DEFAULT_CONFIG.verifier.timeoutMinutes,
    },
  };

  return resolved;
};

type AssertSafeDirectoryInput = {
  value: string;
  name: string;
};

function assertSafeDirectoryInput({
  value,
  name,
}: AssertSafeDirectoryInput): void {
  if (value.includes('\0')) {
    throw new Error(`${name} must not contain a null byte.`);
  }

  if (isAbsolute(value)) {
    throw new Error(`${name} must be relative to the Git root.`);
  }
}

type ResolveSafeDirectoryInput = {
  repositoryRoot: string;
  directory: string;
  name: string;
};

const resolveSafeDirectory = ({
  repositoryRoot,
  directory,
  name,
}: ResolveSafeDirectoryInput): string => {
  assertSafeDirectoryInput({ value: directory, name });

  const requestedDirectory = resolve(repositoryRoot, directory);

  if (requestedDirectory === repositoryRoot) {
    throw new Error(`${name} must not be the Git root.`);
  }

  if (
    !isPathStrictlyWithin({
      parent: repositoryRoot,
      candidate: requestedDirectory,
    })
  ) {
    throw new Error(`${name} must stay inside the Git root.`);
  }

  return requestedDirectory;
};

type ResolveDirectoriesInput = {
  repositoryRoot: string;
  config: MaestroConfig;
};

const resolveDirectories = ({
  repositoryRoot,
  config,
}: ResolveDirectoriesInput): MaestroConfig => {
  const specDirectory = resolveSafeDirectory({
    repositoryRoot,
    directory: config.specDirectory,
    name: 'specDirectory',
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
  const repositoryRoot = await realpath(cwd);
  const targetPath = join(repositoryRoot, CONFIG_FILE_PATH);

  if (!(await pathExists(targetPath))) {
    return resolveDirectories({ repositoryRoot, config: DEFAULT_CONFIG });
  }

  const parsed = await readConfigurationFile(targetPath);

  assertConfiguration(parsed);
  const config = resolveConfiguration(parsed);

  return resolveDirectories({ repositoryRoot, config });
};
