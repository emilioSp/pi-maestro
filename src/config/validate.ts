/**
 * Objective: Define and validate Maestro configuration contracts.
 * Used: When configuration input and configured directories are checked.
 * Entrypoint: validateConfiguration().
 */

import { lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { type Static, Type } from 'typebox';
import { Value } from 'typebox/value';
import { isInside, isStrictlyInside } from '#utils/path-security.ts';

export const THINKING_LEVELS = {
  OFF: 'off',
  MINIMAL: 'minimal',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  XHIGH: 'xhigh',
  MAX: 'max',
} as const;

export type ThinkingLevel =
  (typeof THINKING_LEVELS)[keyof typeof THINKING_LEVELS];

export const MODEL_PATTERN = '^[^/\\s]+/[^/\\s]+$';

export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const SUPPORTED_CONFIG_VERSION = '1.0.0';
export const MIN_TIMEOUT_MINUTES = 1;
export const MAX_TIMEOUT_MINUTES = 1440;

export const ThinkingSchema = Type.Union([
  Type.Literal(THINKING_LEVELS.OFF),
  Type.Literal(THINKING_LEVELS.MINIMAL),
  Type.Literal(THINKING_LEVELS.LOW),
  Type.Literal(THINKING_LEVELS.MEDIUM),
  Type.Literal(THINKING_LEVELS.HIGH),
  Type.Literal(THINKING_LEVELS.XHIGH),
  Type.Literal(THINKING_LEVELS.MAX),
]);

export const PartialAgentConfigSchema = Type.Object(
  {
    model: Type.Optional(Type.String({ pattern: MODEL_PATTERN })),
    thinking: Type.Optional(ThinkingSchema),
    timeoutMinutes: Type.Optional(
      Type.Integer({
        minimum: MIN_TIMEOUT_MINUTES,
        maximum: MAX_TIMEOUT_MINUTES,
      }),
    ),
  },
  { additionalProperties: false },
);

export const MaestroConfigInputSchema = Type.Object(
  {
    version: Type.String(),
    specDirectory: Type.Optional(Type.String({ minLength: 1 })),
    worktreeDirectory: Type.Optional(Type.String({ minLength: 1 })),
    builder: Type.Optional(PartialAgentConfigSchema),
    verifier: Type.Optional(PartialAgentConfigSchema),
  },
  { additionalProperties: false },
);

export const ResolvedAgentConfigSchema = Type.Object(
  {
    model: Type.String({ pattern: MODEL_PATTERN }),
    thinking: ThinkingSchema,
    timeoutMinutes: Type.Integer({
      minimum: MIN_TIMEOUT_MINUTES,
      maximum: MAX_TIMEOUT_MINUTES,
    }),
  },
  { additionalProperties: false },
);

export const ResolvedMaestroConfigSchema = Type.Object(
  {
    version: Type.Literal(SUPPORTED_CONFIG_VERSION),
    specDirectory: Type.String({ minLength: 1 }),
    worktreeDirectory: Type.String({ minLength: 1 }),
    builder: ResolvedAgentConfigSchema,
    verifier: ResolvedAgentConfigSchema,
  },
  { additionalProperties: false },
);

export type MaestroConfig = Static<typeof ResolvedMaestroConfigSchema>;
export type PartialMaestroConfig = Static<typeof MaestroConfigInputSchema>;

type SchemaValidationError = {
  instancePath: string;
  schemaPath: string;
  message: string;
};

const formatError = (error: SchemaValidationError): string => {
  const path = error.instancePath.replace(/^\//, '').replace(/\//g, '.');

  if (error.schemaPath.includes('additionalProperties')) {
    return `Unknown configuration field: "${path}".`;
  }

  if (path.endsWith('thinking')) {
    return `Invalid thinking level at "${path}". Allowed: ${Object.values(THINKING_LEVELS).join(', ')}.`;
  }

  if (path.endsWith('timeoutMinutes')) {
    return `Invalid timeout at "${path}". Must be an integer between ${MIN_TIMEOUT_MINUTES} and ${MAX_TIMEOUT_MINUTES}.`;
  }

  if (path.endsWith('model')) {
    return `Invalid model identifier at "${path}". Must use "provider/model" format.`;
  }

  if (path === 'builder' || path === 'verifier') {
    return `Invalid ${path} configuration: expected an object.`;
  }

  if (path === 'specDirectory' || path === 'worktreeDirectory') {
    return `Invalid ${path}: expected a non-empty string.`;
  }

  return `Invalid configuration at "${path}": ${error.message}.`;
};

function assertConfiguration(
  input: unknown,
): asserts input is PartialMaestroConfig {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Configuration must be a JSON object.');
  }

  const raw = input;

  if (!('version' in raw) || raw.version === undefined) {
    throw new Error(
      "Missing configuration version. The 'version' field is required.",
    );
  }

  if (typeof raw.version !== 'string') {
    throw new Error('Invalid configuration version: expected a string.');
  }

  const semverMatch = raw.version.match(SEMVER_PATTERN);
  if (!semverMatch) {
    throw new Error(
      `Invalid configuration version: "${raw.version}". Expected a semantic version (e.g. "1.0.0").`,
    );
  }

  const majorVersion = semverMatch[1];
  if (majorVersion !== '1') {
    throw new Error(
      `Unsupported configuration major version: ${majorVersion}. Expected major version 1.`,
    );
  }

  if (raw.version !== SUPPORTED_CONFIG_VERSION) {
    throw new Error(
      `Unsupported configuration version: "${raw.version}". Supported version is ${SUPPORTED_CONFIG_VERSION}.`,
    );
  }

  const [firstError] = Value.Errors(MaestroConfigInputSchema, raw);
  if (firstError !== undefined) {
    throw new Error(formatError(firstError));
  }
}

export const validateConfiguration = (input: unknown): PartialMaestroConfig => {
  assertConfiguration(input);
  return input;
};

type ExistingAncestor = {
  path: string;
  realPath: string;
};

const findExistingAncestor = async (
  path: string,
): Promise<ExistingAncestor> => {
  let anchestor = path;

  while (true) {
    try {
      // lstat instead of access, because access follows symlinks
      await lstat(anchestor);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw error;
      }

      const parent = dirname(anchestor);
      if (parent === anchestor) {
        throw new Error(`Cannot resolve an existing ancestor for "${path}".`);
      }
      anchestor = parent;
      continue;
    }

    try {
      return { path: anchestor, realPath: await realpath(anchestor) };
    } catch {
      throw new Error(`Cannot resolve symlink "${anchestor}".`);
    }
  }
};

const assertSafeDirectoryInput = (value: string, name: string): void => {
  if (value.includes('\0')) {
    throw new Error(`${name} must not contain a null byte.`);
  }

  if (isAbsolute(value)) {
    throw new Error(`${name} must be relative to the Git root.`);
  }
};

const resolveSafeDirectory = async ({
  repositoryRoot,
  directory,
  name,
}: {
  repositoryRoot: string;
  directory: string;
  name: string;
}): Promise<string> => {
  assertSafeDirectoryInput(directory, name);

  const requestedDirectory = resolve(repositoryRoot, directory);
  if (requestedDirectory === repositoryRoot) {
    throw new Error(`${name} must not be the Git root.`);
  }

  if (
    !isStrictlyInside({ parent: repositoryRoot, candidate: requestedDirectory })
  ) {
    throw new Error(`${name} must stay inside the Git root.`);
  }

  // The directory could not exist at the check time. We find the existing anchestor and do the check on that.
  const ancestor = await findExistingAncestor(requestedDirectory);
  if (!isInside({ parent: repositoryRoot, candidate: ancestor.realPath })) {
    throw new Error(`${name} resolves outside the Git root through a symlink.`);
  }

  const unresolvedSuffix = relative(ancestor.path, requestedDirectory);
  const resolvedDirectory = resolve(ancestor.realPath, unresolvedSuffix);
  if (
    !isStrictlyInside({ parent: repositoryRoot, candidate: resolvedDirectory })
  ) {
    throw new Error(`${name} resolves outside the Git root through a symlink.`);
  }

  return resolvedDirectory;
};

export const validateDirectories = async ({
  repositoryRoot: configuredRepositoryRoot,
  config,
}: {
  repositoryRoot: string;
  config: MaestroConfig;
}): Promise<MaestroConfig> => {
  const repositoryRoot = await realpath(configuredRepositoryRoot);
  const specDirectory = await resolveSafeDirectory({
    repositoryRoot,
    directory: config.specDirectory,
    name: 'specDirectory',
  });
  const worktreeDirectory = await resolveSafeDirectory({
    repositoryRoot,
    directory: config.worktreeDirectory,
    name: 'worktreeDirectory',
  });

  if (specDirectory === worktreeDirectory) {
    throw new Error(
      'specDirectory and worktreeDirectory must not be the same directory.',
    );
  }

  if (
    isStrictlyInside({ parent: specDirectory, candidate: worktreeDirectory }) ||
    isStrictlyInside({ parent: worktreeDirectory, candidate: specDirectory })
  ) {
    throw new Error(
      'specDirectory and worktreeDirectory must not contain one another.',
    );
  }

  return {
    ...config,
    specDirectory,
    worktreeDirectory,
  };
};
