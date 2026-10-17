import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { assertConfiguration } from '#config/assertConfiguration.ts';
import { SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';

describe('configuration input validation', () => {
  it('given configuration with a spec directory and builder and verifier settings when validated then it is accepted without requiring simplifier settings', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        specDirectory: '.specs',
        builder: {
          model: 'openai-codex/gpt-5.6-luna',
          thinking: THINKING_LEVELS.HIGH,
          timeoutMinutes: 60,
        },
        verifier: {
          model: 'openai-codex/gpt-5.6-sol',
          thinking: THINKING_LEVELS.MEDIUM,
          timeoutMinutes: 60,
        },
      }),
    ).not.toThrow();
  });

  it('given configuration containing only the supported version when validated then it is accepted', () => {
    expect(() => assertConfiguration({ version: SUPPORTED_CONFIG_VERSION })).not.toThrow();
  });

  it('given each supported builder thinking level when configuration is validated then every supported level is accepted', () => {
    for (const level of Object.values(THINKING_LEVELS)) {
      expect(() =>
        assertConfiguration({
          version: SUPPORTED_CONFIG_VERSION,
          builder: { thinking: level },
        }),
      ).not.toThrow();
    }
  });

  it('given configuration includes worktreeDirectory when validated then it is rejected as an unknown field', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        worktreeDirectory: '.worktree',
      }),
    ).toThrow('Unknown configuration field: "worktreeDirectory".');
  });

  it('given specDirectory is an empty string when configuration is validated then validation fails because the path must be nonempty', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        specDirectory: '',
      }),
    ).toThrow('Invalid specDirectory: expected a non-empty string.');
  });

  it.each([
    {
      scenario: 'a version prefixed with v',
      fixture: 'invalid-version-format.json',
      message: 'Invalid configuration version: "v1.0.0".',
    },
    {
      scenario: 'an unsupported major version',
      fixture: 'unsupported-major-version.json',
      message: 'Unsupported configuration major version: 2.',
    },
    {
      scenario: 'an unsupported minor version',
      fixture: 'unsupported-minor-version.json',
      message: 'Unsupported configuration version: "1.1.0".',
    },
    {
      scenario: 'no version field',
      fixture: 'missing-version.json',
      message: "Missing configuration version. The 'version' field is required.",
    },
    {
      scenario: 'a model name without a provider',
      fixture: 'invalid-model-format.json',
      message: 'Invalid model identifier at "builder.model".',
    },
    {
      scenario: 'an unsupported verifier thinking level',
      fixture: 'invalid-thinking-level.json',
      message: 'Invalid thinking level at "verifier.thinking".',
    },
    {
      scenario: 'a builder timeout of zero',
      fixture: 'invalid-timeout-zero.json',
      message: 'Invalid timeout at "builder.timeoutMinutes".',
    },
    {
      scenario: 'a builder timeout above the maximum',
      fixture: 'invalid-timeout-too-large.json',
      message: 'Invalid timeout at "builder.timeoutMinutes".',
    },
    {
      scenario: 'an unknown top-level field',
      fixture: 'unknown-root-field.json',
      message: 'Unknown configuration field: "unknownField".',
    },
    {
      scenario: 'an unknown builder field',
      fixture: 'unknown-builder-field.json',
      message: 'Unknown configuration field: "builder.unknownOption".',
    },
    {
      scenario: 'an unknown verifier field',
      fixture: 'unknown-verifier-field.json',
      message: 'Unknown configuration field: "verifier.unknownOption".',
    },
  ])(
    'given configuration with $scenario when validated then validation fails with the specific configuration error',
    async ({ fixture, message }) => {
      const input = JSON.parse(
        await readFile(new URL(import.meta.resolve(`#tests/fixtures/config/${fixture}`)), 'utf8'),
      );

      expect(() => assertConfiguration(input)).toThrow(message);
    },
  );
});
