/**
 * Objective: Check a configuration input against its schema and supported version.
 * Used: When Maestro reads configuration input.
 */

import { Value } from 'typebox/value';

import {
  MaestroConfigInputSchema,
  type PartialMaestroConfig,
  SUPPORTED_CONFIG_VERSION,
  THINKING_LEVELS,
} from '#config/schema.ts';

export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

type SchemaValidationError = {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  message: string;
};

const formatError = (error: SchemaValidationError): string => {
  const path = error.instancePath.replace(/^\//, '').replace(/\//g, '.');

  if (error.schemaPath === '#' && error.keyword === 'required') {
    return "Missing configuration version. The 'version' field is required.";
  }

  if (error.schemaPath === '#' && error.keyword === 'type') {
    return 'Configuration must be a JSON object.';
  }

  if (path === 'version') {
    return 'Invalid configuration version: expected a string.';
  }

  if (error.schemaPath.includes('additionalProperties')) {
    return `Unknown configuration field: "${path}".`;
  }

  if (path.endsWith('thinking')) {
    return `Invalid thinking level at "${path}". Allowed: ${Object.values(THINKING_LEVELS).join(', ')}.`;
  }

  if (path.endsWith('model')) {
    return `Invalid model at "${path}": expected a string.`;
  }

  if (path === 'builder' || path === 'verifier' || path === 'simplifier' || path === 'scorer') {
    return `Invalid ${path} configuration: expected an object.`;
  }

  if (path === 'specDirectory') {
    return `Invalid ${path}: expected a non-empty string.`;
  }

  return `Invalid configuration at "${path}": ${error.message}.`;
};

export function assertConfiguration(input: unknown): asserts input is PartialMaestroConfig {
  if (!Value.Check(MaestroConfigInputSchema, input)) {
    const [firstError] = Value.Errors(MaestroConfigInputSchema, input);
    throw new Error(firstError ? formatError(firstError) : 'Invalid configuration.');
  }

  const semverMatch = input.version.match(SEMVER_PATTERN);

  if (!semverMatch) {
    throw new Error(
      `Invalid configuration version: "${input.version}". Expected a semantic version (e.g. "1.0.0").`,
    );
  }

  const majorVersion = semverMatch[1];

  if (majorVersion !== '1') {
    throw new Error(
      `Unsupported configuration major version: ${majorVersion}. Expected major version 1.`,
    );
  }

  if (input.version !== SUPPORTED_CONFIG_VERSION) {
    throw new Error(
      `Unsupported configuration version: "${input.version}". Supported version is ${SUPPORTED_CONFIG_VERSION}.`,
    );
  }

  if (input.scorer?.required && !input.scorer.model?.trim()) {
    throw new Error('Scorer model is required when scorer.required is true.');
  }
}
