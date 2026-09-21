import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CONFIG_FILE_PATH,
  DEFAULT_CONFIG,
  deepFreeze,
} from '#config/defaults.ts';
import {
  type MaestroConfig,
  type PartialMaestroConfig,
  validateConfiguration,
  validateDirectories,
} from '#config/validate.ts';
import { pathExists } from '#utils/path-exists.ts';

export const resolveConfiguration = (
  input: PartialMaestroConfig,
): MaestroConfig => {
  const resolved: MaestroConfig = {
    version: DEFAULT_CONFIG.version,
    specDirectory: input.specDirectory ?? DEFAULT_CONFIG.specDirectory,
    worktreeDirectory:
      input.worktreeDirectory ?? DEFAULT_CONFIG.worktreeDirectory,
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

  return deepFreeze(resolved);
};

export const loadConfiguration = async (): Promise<MaestroConfig> => {
  const repositoryRoot = await realpath(process.cwd());
  const targetPath = join(repositoryRoot, CONFIG_FILE_PATH);

  if (!(await pathExists(targetPath))) {
    return deepFreeze(
      await validateDirectories({ repositoryRoot, config: DEFAULT_CONFIG }),
    );
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

  const config = resolveConfiguration(validateConfiguration(parsed));
  return deepFreeze(await validateDirectories({ repositoryRoot, config }));
};
