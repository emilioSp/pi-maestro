import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { assertConfiguration } from '#config/assertConfiguration.ts';
import { SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';

describe('configuration input validation', () => {
  it('given a full configuration without worktree settings when validated then it is accepted', () => {
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

  it('given a minimal configuration when validated then it is accepted', () => {
    expect(() =>
      assertConfiguration({ version: SUPPORTED_CONFIG_VERSION }),
    ).not.toThrow();
  });

  it('given supported thinking levels when configuration is validated then all levels are accepted', () => {
    for (const level of Object.values(THINKING_LEVELS)) {
      expect(() =>
        assertConfiguration({
          version: SUPPORTED_CONFIG_VERSION,
          builder: { thinking: level },
        }),
      ).not.toThrow();
    }
  });

  it('given an unknown configuration field when validated then the configuration is rejected', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        worktreeDirectory: '.worktree',
      }),
    ).toThrow('Unknown configuration field: "worktreeDirectory".');
  });

  it('given an empty spec directory when configuration is validated then it is rejected', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        specDirectory: '',
      }),
    ).toThrow('Invalid specDirectory: expected a non-empty string.');
  });

  it.each([
    {
      fixture: 'invalid-version-format.json',
      message: 'Invalid configuration version: "v1.0.0".',
    },
    {
      fixture: 'unsupported-major-version.json',
      message: 'Unsupported configuration major version: 2.',
    },
    {
      fixture: 'unsupported-minor-version.json',
      message: 'Unsupported configuration version: "1.1.0".',
    },
    {
      fixture: 'missing-version.json',
      message:
        "Missing configuration version. The 'version' field is required.",
    },
    {
      fixture: 'invalid-model-format.json',
      message: 'Invalid model identifier at "builder.model".',
    },
    {
      fixture: 'invalid-thinking-level.json',
      message: 'Invalid thinking level at "verifier.thinking".',
    },
    {
      fixture: 'invalid-timeout-zero.json',
      message: 'Invalid timeout at "builder.timeoutMinutes".',
    },
    {
      fixture: 'invalid-timeout-too-large.json',
      message: 'Invalid timeout at "builder.timeoutMinutes".',
    },
    {
      fixture: 'unknown-root-field.json',
      message: 'Unknown configuration field: "unknownField".',
    },
    {
      fixture: 'unknown-builder-field.json',
      message: 'Unknown configuration field: "builder.unknownOption".',
    },
    {
      fixture: 'unknown-verifier-field.json',
      message: 'Unknown configuration field: "verifier.unknownOption".',
    },
  ])(
    'given $fixture when validated then the configuration is rejected',
    async ({ fixture, message }) => {
      const input = JSON.parse(
        await readFile(
          new URL(import.meta.resolve(`#test/fixtures/config/${fixture}`)),
          'utf8',
        ),
      );

      expect(() => assertConfiguration(input)).toThrow(message);
    },
  );
});
