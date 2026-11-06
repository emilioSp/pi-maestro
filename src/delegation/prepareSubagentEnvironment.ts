/**
 * Objective: Discover native Pi resources without loading the main Maestro extension.
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
  DefaultPackageManager,
  getAgentDir,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';

const MAIN_EXTENSION = fileURLToPath(new URL('../../extensions/maestro.ts', import.meta.url));

type MaestroPackage = { name: '@emiliosp/pi-maestro' };

const isMaestroPackage = (value: unknown): value is MaestroPackage =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  value.name === '@emiliosp/pi-maestro';

const isMainExtension = (path: string): boolean => {
  if (path.startsWith('builtin:')) return false;

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
};

export const prepareSubagentEnvironment = async ({
  cwd,
  roleGuidance,
}: PrepareSubagentEnvironmentInput) => {
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.create(cwd, agentDir);

  const extensionFactories = [
    { name: 'codemode', factory: createCodemodeExtension(), builtin: true, replaceable: true },
    { name: 'tool-search', factory: createToolSearchExtension(), builtin: true, replaceable: true },
    { name: 'mcp', factory: createMcpExtension(), builtin: true, replaceable: true },
  ];

  const packages = new DefaultPackageManager({
    cwd,
    agentDir,
    settingsManager,
    builtinExtensions: extensionFactories.map(({ name }) => name),
  });

  const resources = await packages.resolve(async () => 'error');

  if (resources.installFailures?.length) {
    throw new Error(resources.installFailures.map(({ message }) => message).join('\n'));
  }

  // extensionsOverride filters extensions after Pi has loaded and initialized them.
  // It would exclude Maestro's event handlers, but its initialization code would still run.
  // Use additionalExtensionPaths instead to exclude Maestro before loading it,
  // so none of its code executes in the child session.
  const additionalExtensionPaths = resources.extensions
    .filter(({ enabled, path }) => enabled && !isMainExtension(path))
    .map(({ path }) => path);

  const services = await createAgentSessionServices({
    cwd,
    agentDir,
    settingsManager,
    resourceLoaderOptions: {
      // Disable automatic extension discovery; load only the filtered paths below
      // and the built-in factories, so discovery cannot add Maestro back.
      noExtensions: true,
      additionalExtensionPaths,
      extensionFactories,
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
