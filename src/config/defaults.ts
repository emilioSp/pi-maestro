/**
 * Objective: Define immutable default Maestro configuration values.
 * Used: When configuration is resolved from missing or partial input.
 */

import { type MaestroConfig, SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';

export const DEFAULT_CONFIG_VERSION = SUPPORTED_CONFIG_VERSION;

export const DEFAULT_SPEC_DIRECTORY = '.specs';

export const DEFAULT_BUILDER_MODEL = 'openai-codex/gpt-5.6-luna';

export const DEFAULT_BUILDER_THINKING = THINKING_LEVELS.MAX;

export const DEFAULT_VERIFIER_MODEL = 'openai-codex/gpt-6.1-sol';

export const DEFAULT_VERIFIER_THINKING = THINKING_LEVELS.HIGH;

export const DEFAULT_SIMPLIFIER_MODEL = 'openai-codex/gpt-6.1-sol';

export const CONFIG_DIRECTORY_NAME = '.pi';

export const CONFIG_FILE_NAME = 'maestro.json';

export const CONFIG_FILE_PATH = `${CONFIG_DIRECTORY_NAME}/${CONFIG_FILE_NAME}`;

export const DEFAULT_CONFIG: MaestroConfig = {
  version: DEFAULT_CONFIG_VERSION,
  specDirectory: DEFAULT_SPEC_DIRECTORY,
  builder: {
    required: true,
    model: DEFAULT_BUILDER_MODEL,
    thinking: DEFAULT_BUILDER_THINKING,
  },
  simplifier: {
    required: true,
    model: DEFAULT_SIMPLIFIER_MODEL,
    thinking: THINKING_LEVELS.HIGH,
  },
  verifier: {
    required: true,
    model: DEFAULT_VERIFIER_MODEL,
    thinking: DEFAULT_VERIFIER_THINKING,
  },
};
