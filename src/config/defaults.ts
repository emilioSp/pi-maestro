import type { MaestroConfig } from "#config/validate.ts";

export const DEFAULT_CONFIG_VERSION = "1.0.0";
export const DEFAULT_SPEC_DIRECTORY = ".specs";
export const DEFAULT_WORKTREE_DIRECTORY = ".worktree";
export const DEFAULT_BUILDER_MODEL = "openai-codex/gpt-5.6-luna";
export const DEFAULT_BUILDER_THINKING = "high" as const;
export const DEFAULT_VERIFIER_MODEL = "openai-codex/gpt-5.6-sol";
export const DEFAULT_VERIFIER_THINKING = "medium" as const;
export const DEFAULT_TIMEOUT_MINUTES = 60;

export const CONFIG_DIRECTORY_NAME = ".pi";
export const CONFIG_FILE_NAME = "maestro.json";
export const CONFIG_FILE_PATH = `${CONFIG_DIRECTORY_NAME}/${CONFIG_FILE_NAME}`;

export const deepFreeze = <T extends object>(target: T): Readonly<T> => {
  Object.freeze(target);
  for (const value of Object.values(target)) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return target;
};

export const DEFAULT_CONFIG: MaestroConfig = deepFreeze({
  version: DEFAULT_CONFIG_VERSION,
  specDirectory: DEFAULT_SPEC_DIRECTORY,
  worktreeDirectory: DEFAULT_WORKTREE_DIRECTORY,
  builder: {
    model: DEFAULT_BUILDER_MODEL,
    thinking: DEFAULT_BUILDER_THINKING,
    timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
  },
  verifier: {
    model: DEFAULT_VERIFIER_MODEL,
    thinking: DEFAULT_VERIFIER_THINKING,
    timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
  },
});
