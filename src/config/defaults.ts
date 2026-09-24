/**
 * Objective: Define immutable default Maestro configuration values.
 * Used: When configuration is resolved from missing or partial input.
 */

import {
  type MaestroConfig,
  SUPPORTED_CONFIG_VERSION,
  THINKING_LEVELS,
} from '#config/schema.ts';
import { deepFreeze } from '#config/utils/deepFreeze.ts';

export const DEFAULT_CONFIG_VERSION = SUPPORTED_CONFIG_VERSION;
export const DEFAULT_SPEC_DIRECTORY = '.specs';
export const DEFAULT_WORKTREE_DIRECTORY = '.worktree';
export const DEFAULT_BUILDER_MODEL = 'openai-codex/gpt-6-luna';
export const DEFAULT_BUILDER_THINKING = THINKING_LEVELS.HIGH;
export const DEFAULT_VERIFIER_MODEL = 'openai-codex/gpt-6-sol';
export const DEFAULT_VERIFIER_THINKING = THINKING_LEVELS.MEDIUM;
export const DEFAULT_TIMEOUT_MINUTES = 60;

export const CONFIG_DIRECTORY_NAME = '.pi';
export const CONFIG_FILE_NAME = 'maestro.json';
export const CONFIG_FILE_PATH = `${CONFIG_DIRECTORY_NAME}/${CONFIG_FILE_NAME}`;

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
