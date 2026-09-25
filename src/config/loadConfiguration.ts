/**
 * Objective: Load and validate repository configuration.
 * Used: When Maestro initializes for a repository.
 */

import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { assertConfiguration } from '#config/assertConfiguration.ts';
import { CONFIG_FILE_PATH, DEFAULT_CONFIG } from '#config/defaults.ts';
import type { MaestroConfig, PartialMaestroConfig } from '#config/schema.ts';
import { pathExists } from '#utils/path-exists.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';
import { isPathWithinOrEqual } from '#utils/path-within-or-equal.ts';

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

type ExistingAncestor = {
  path: string;
  realPath: string;
};

const findExistingAncestor = async (
  path: string,
): Promise<ExistingAncestor> => {
  let anchestor = path;

  while (true) {
    try {
      // lstat instead of access, because access follows symlinks
      await lstat(anchestor);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== 'ENOENT') {
        throw error;
      }

      const parent = dirname(anchestor);

      if (parent === anchestor) {
        throw new Error(`Cannot resolve an existing ancestor for "${path}".`);
      }
      anchestor = parent;
      continue;
    }

    try {
      return { path: anchestor, realPath: await realpath(anchestor) };
    } catch {
      throw new Error(`Cannot resolve symlink "${anchestor}".`);
    }
  }
};

const assertSafeDirectoryInput = (value: string, name: string): void => {
  if (value.includes('\0')) {
    throw new Error(`${name} must not contain a null byte.`);
  }

  if (isAbsolute(value)) {
    throw new Error(`${name} must be relative to the Git root.`);
  }
};

const resolveSafeDirectory = async ({
  repositoryRoot,
  directory,
  name,
}: {
  repositoryRoot: string;
  directory: string;
  name: string;
}): Promise<string> => {
  assertSafeDirectoryInput(directory, name);

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

  // The directory could not exist at the check time. We find the existing anchestor and do the check on that.
  const ancestor = await findExistingAncestor(requestedDirectory);

  if (
    !isPathWithinOrEqual({
      parent: repositoryRoot,
      candidate: ancestor.realPath,
    })
  ) {
    throw new Error(`${name} resolves outside the Git root through a symlink.`);
  }

  const unresolvedSuffix = relative(ancestor.path, requestedDirectory);
  const resolvedDirectory = resolve(ancestor.realPath, unresolvedSuffix);

  if (
    !isPathStrictlyWithin({
      parent: repositoryRoot,
      candidate: resolvedDirectory,
    })
  ) {
    throw new Error(`${name} resolves outside the Git root through a symlink.`);
  }

  return resolvedDirectory;
};

const resolveDirectories = async ({
  repositoryRoot: configuredRepositoryRoot,
  config,
}: {
  repositoryRoot: string;
  config: MaestroConfig;
}): Promise<MaestroConfig> => {
  const repositoryRoot = await realpath(configuredRepositoryRoot);
  const specDirectory = await resolveSafeDirectory({
    repositoryRoot,
    directory: config.specDirectory,
    name: 'specDirectory',
  });
  return {
    ...config,
    specDirectory,
  };
};

export const loadConfiguration = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<MaestroConfig> => {
  const repositoryRoot = await realpath(cwd);
  const targetPath = join(repositoryRoot, CONFIG_FILE_PATH);

  if (!(await pathExists(targetPath))) {
    return await resolveDirectories({ repositoryRoot, config: DEFAULT_CONFIG });
  }

  let parsed: unknown;
  try {
    const content = await readFile(targetPath, 'utf8');
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Invalid JSON in configuration file "${targetPath}": ${message}`,
    );
  }

  assertConfiguration(parsed);
  const config = resolveConfiguration(parsed);

  return await resolveDirectories({ repositoryRoot, config });
};
