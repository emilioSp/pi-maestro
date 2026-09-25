import { describe, expect, it } from 'vitest';
import { assertConfiguration } from '#config/assertConfiguration.ts';
import { SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';

describe('configuration input validation', () => {
  it('accepts a full configuration without worktree settings', () => {
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

  it('accepts a minimal configuration', () => {
    expect(() =>
      assertConfiguration({ version: SUPPORTED_CONFIG_VERSION }),
    ).not.toThrow();
  });

  it('accepts all supported thinking levels', () => {
    for (const level of Object.values(THINKING_LEVELS)) {
      expect(() =>
        assertConfiguration({
          version: SUPPORTED_CONFIG_VERSION,
          builder: { thinking: level },
        }),
      ).not.toThrow();
    }
  });

  it('rejects an unknown configuration', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        worktreeDirectory: '.worktree',
      }),
    ).toThrow('Unknown configuration field: "worktreeDirectory".');
  });

  it('rejects an empty spec directory', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        specDirectory: '',
      }),
    ).toThrow('Invalid specDirectory: expected a non-empty string.');
  });

  it('rejects invalid versions', () => {
    expect(() => assertConfiguration({ version: 'v1.0.0' })).toThrow(
      'Invalid configuration version: "v1.0.0".',
    );
    expect(() => assertConfiguration({ version: '2.0.0' })).toThrow(
      'Unsupported configuration major version: 2.',
    );
  });
});
