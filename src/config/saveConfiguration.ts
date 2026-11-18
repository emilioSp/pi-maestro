/**
 * Objective: Build or patch and persist project configuration from confirmed agent model selections.
 * Used: After setup confirmation, before activation checks, and when the owner changes agent models.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assertConfiguration } from '#config/assertConfiguration.ts';
import {
  CONFIG_DIRECTORY_NAME,
  CONFIG_FILE_PATH,
  DEFAULT_SPEC_DIRECTORY,
} from '#config/defaults.ts';
import { readConfigurationFile } from '#config/loadConfiguration.ts';
import {
  type PartialMaestroConfig,
  SUPPORTED_CONFIG_VERSION,
  type ThinkingLevel,
} from '#config/schema.ts';
import { pathExists } from '#utils/path-exists.ts';

export const SETUP_ROLES = {
  BUILDER: 'builder',
  VERIFIER: 'verifier',
  SIMPLIFIER: 'simplifier',
  SCORER: 'scorer',
} as const;

export type SetupRole = (typeof SETUP_ROLES)[keyof typeof SETUP_ROLES];

export type RoleSelection = { model: string; thinking: ThinkingLevel };

export type AgentModelSelections = Partial<
  Record<Exclude<SetupRole, typeof SETUP_ROLES.SCORER>, RoleSelection>
> & {
  scorer?: { model: string };
};

type AgentSelection = RoleSelection | { model: string };

const toAgentSection = (selection?: AgentSelection) =>
  selection ? { required: true, ...selection } : { required: false };

const readCurrentConfiguration = async (
  path: string,
): Promise<PartialMaestroConfig | undefined> => {
  if (!(await pathExists(path))) return undefined;

  const parsed = await readConfigurationFile(path);
  assertConfiguration(parsed);

  return parsed;
};

type SaveConfigurationInput = {
  cwd: string;
  agentModelSelections: AgentModelSelections;
};

export const saveConfiguration = async ({
  cwd,
  agentModelSelections,
}: SaveConfigurationInput): Promise<void> => {
  const targetPath = join(cwd, CONFIG_FILE_PATH);

  const currentConfiguration = (await readCurrentConfiguration(targetPath)) ?? {
    specDirectory: DEFAULT_SPEC_DIRECTORY,
  };

  const config: PartialMaestroConfig = {
    ...currentConfiguration,
    version: SUPPORTED_CONFIG_VERSION,
    builder: toAgentSection(agentModelSelections.builder),
    verifier: toAgentSection(agentModelSelections.verifier),
    scorer: toAgentSection(agentModelSelections.scorer),
    simplifier: toAgentSection(agentModelSelections.simplifier),
  };

  assertConfiguration(config);
  await mkdir(join(cwd, CONFIG_DIRECTORY_NAME), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
};
