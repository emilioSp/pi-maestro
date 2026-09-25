/**
 * Objective: Check a configuration input against its schema and supported version.
 * Used: When Maestro reads configuration input.
 */

import { Value } from 'typebox/value';
import {
  MAX_TIMEOUT_MINUTES,
  MaestroConfigInputSchema,
  MIN_TIMEOUT_MINUTES,
  type PartialMaestroConfig,
  SUPPORTED_CONFIG_VERSION,
  THINKING_LEVELS,
} from '#config/schema.ts';

export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

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

  if (path === 'specDirectory') {
    return `Invalid ${path}: expected a non-empty string.`;
  }

  return `Invalid configuration at "${path}": ${error.message}.`;
};

export function assertConfiguration(
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
