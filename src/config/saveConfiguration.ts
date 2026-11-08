/**
 * Objective: Build and persist project configuration from confirmed agent model selections.
 * Used: After setup confirmation and before activation checks.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assertConfiguration } from '#config/assertConfiguration.ts';
import {
  CONFIG_DIRECTORY_NAME,
  CONFIG_FILE_PATH,
  DEFAULT_SPEC_DIRECTORY,
} from '#config/defaults.ts';
import {
  type PartialMaestroConfig,
  SUPPORTED_CONFIG_VERSION,
  type ThinkingLevel,
} from '#config/schema.ts';

export const SETUP_ROLES = {
  BUILDER: 'builder',
  VERIFIER: 'verifier',
  SIMPLIFIER: 'simplifier',
} as const;

export type SetupRole = (typeof SETUP_ROLES)[keyof typeof SETUP_ROLES];

export type RoleSelection = { model: string; thinking: ThinkingLevel };

export type AgentModelSelections = Partial<Record<SetupRole, RoleSelection>>;

type SaveConfigurationInput = {
  cwd: string;
  agentModelSelections: AgentModelSelections;
};

export const saveConfiguration = async ({
  cwd,
  agentModelSelections,
}: SaveConfigurationInput): Promise<void> => {
  const config: PartialMaestroConfig = {
    version: SUPPORTED_CONFIG_VERSION,
    specDirectory: DEFAULT_SPEC_DIRECTORY,
    builder: agentModelSelections.builder
      ? { required: true, ...agentModelSelections.builder }
      : { required: false },
    verifier: agentModelSelections.verifier
      ? { required: true, ...agentModelSelections.verifier }
      : { required: false },
    simplifier: agentModelSelections.simplifier
      ? { required: true, ...agentModelSelections.simplifier }
      : { required: false },
  };

  assertConfiguration(config);
  await mkdir(join(cwd, CONFIG_DIRECTORY_NAME), { recursive: true });
  await writeFile(join(cwd, CONFIG_FILE_PATH), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
};
