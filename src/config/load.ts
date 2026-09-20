import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CONFIG_FILE_PATH,
  DEFAULT_CONFIG,
  deepFreeze,
} from "#config/defaults.ts";
import {
  validateConfiguration,
  type MaestroConfig,
  type PartialMaestroConfig,
} from "#config/validate.ts";

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

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
        input.verifier?.timeoutMinutes ?? DEFAULT_CONFIG.verifier.timeoutMinutes,
    },
  };

  return deepFreeze(resolved);
};

export const loadConfiguration = async (): Promise<MaestroConfig> => {
  const targetPath = join(process.cwd(), CONFIG_FILE_PATH);

  if (!(await fileExists(targetPath))) {
    return DEFAULT_CONFIG;
  }

  let parsed: unknown;
  try {
    const content = await readFile(targetPath, "utf8");
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Invalid JSON in configuration file "${targetPath}": ${message}`,
    );
  }

  const validated = validateConfiguration(parsed);
  return resolveConfiguration(validated);
};
