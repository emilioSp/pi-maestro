/**
 * Objective: Define non-model defaults and project configuration paths.
 * Used: When resolving explicit project configuration.
 */

import { type MaestroConfig, SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';

export const DEFAULT_CONFIG_VERSION = SUPPORTED_CONFIG_VERSION;

export const DEFAULT_SPEC_DIRECTORY = '.specs';

export const CONFIG_DIRECTORY_NAME = '.pi';

export const CONFIG_FILE_NAME = 'maestro.json';

export const CONFIG_FILE_PATH = `${CONFIG_DIRECTORY_NAME}/${CONFIG_FILE_NAME}`;

export const DEFAULT_CONFIG: MaestroConfig = {
  version: DEFAULT_CONFIG_VERSION,
  specDirectory: DEFAULT_SPEC_DIRECTORY,
  builder: { required: true, model: '', thinking: THINKING_LEVELS.HIGH },
  verifier: { required: true, model: '', thinking: THINKING_LEVELS.MEDIUM },
  simplifier: { required: true, model: '', thinking: THINKING_LEVELS.HIGH },
};
