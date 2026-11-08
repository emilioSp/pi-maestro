/**
 * Objective: Discover native Pi resources and exclude main Maestro registrations from children.
 * Used: During preparation of each standalone child execution.
 */

import { realpathSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createAgentSessionServices,
  createCodemodeExtension,
  createMcpExtension,
  createToolSearchExtension,
  getAgentDir,
  type InlineExtension,
  SettingsManager,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';

const MAIN_EXTENSION = fileURLToPath(new URL('../../extensions/maestro.ts', import.meta.url));

type MaestroPackage = { name: '@emiliosp/pi-maestro' };

const isMaestroPackage = (value: unknown): value is MaestroPackage =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  value.name === '@emiliosp/pi-maestro';

const isMainMaestroExtension = (path: string): boolean => {
  if (path.startsWith('builtin:') || path.startsWith('<inline:')) return false;

  const canonicalPath = realpathSync(path);

  if (canonicalPath === realpathSync(MAIN_EXTENSION)) return true;

  // Discovery can find an installed copy rather than the currently executing checkout.
  if (
    basename(canonicalPath) !== 'maestro.ts' ||
    basename(dirname(canonicalPath)) !== 'extensions'
  ) {
    return false;
  }

  try {
    return isMaestroPackage(
      JSON.parse(readFileSync(join(dirname(canonicalPath), '../package.json'), 'utf8')),
    );
  } catch {
    return false;
  }
};

type PrepareSubagentEnvironmentInput = {
  cwd: string;
  roleGuidance: string;
  additionalTools: ToolDefinition[];
};

export const prepareSubagentEnvironment = async ({
  cwd,
  roleGuidance,
  additionalTools,
}: PrepareSubagentEnvironmentInput) => {
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.create(cwd, agentDir);

  // SDK sessions need these CLI built-ins supplied explicitly.
  // The inline factory registers the child's additional tools with pi.registerTool.
  const extensionFactories: InlineExtension[] = [
    { name: 'codemode', factory: createCodemodeExtension(), builtin: true, replaceable: true },
    { name: 'tool-search', factory: createToolSearchExtension(), builtin: true, replaceable: true },
    { name: 'mcp', factory: createMcpExtension(), builtin: true, replaceable: true },
    (pi) => {
      for (const tool of additionalTools) pi.registerTool(tool);
    },
  ];

  const services = await createAgentSessionServices({
    cwd,
    agentDir,
    settingsManager,
    resourceLoaderOptions: {
      extensionFactories,
      // Exclude the main Maestro extension from the child session.
      extensionsOverride: (base) => ({
        ...base,
        extensions: base.extensions.filter(({ path }) => !isMainMaestroExtension(path)),
      }),
      appendSystemPromptOverride: (base) => [...base, roleGuidance],
    },
  });

  const errors = [
    ...services.resourceLoader.getExtensions().errors.map(({ error }) => error),
    ...services.diagnostics.filter(({ type }) => type === 'error').map(({ message }) => message),
  ];

  if (errors.length) throw new Error(errors.join('\n'));

  return services;
};
