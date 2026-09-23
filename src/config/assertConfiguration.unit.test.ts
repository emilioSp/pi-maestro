import { describe, expect, it } from 'vitest';
import { assertConfiguration } from '#config/assertConfiguration.ts';
import { SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';

describe('configuration input validation', () => {
  it('accepts a full valid configuration', () => {
    const input = {
      version: SUPPORTED_CONFIG_VERSION,
      specDirectory: '.specs',
      worktreeDirectory: '.worktree',
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
    };

    expect(() => assertConfiguration(input)).not.toThrow();
  });

  it('accepts a minimal configuration containing only version', () => {
    const input = { version: SUPPORTED_CONFIG_VERSION };
    expect(() => assertConfiguration(input)).not.toThrow();
  });

  it('accepts partial configurations with valid overrides', () => {
    const input = {
      version: SUPPORTED_CONFIG_VERSION,
      builder: {
        timeoutMinutes: 90,
      },
    };
    expect(() => assertConfiguration(input)).not.toThrow();
  });

  it('accepts all supported thinking levels', () => {
    for (const level of Object.values(THINKING_LEVELS)) {
      const input = {
        version: SUPPORTED_CONFIG_VERSION,
        builder: { thinking: level },
      };
      expect(() => assertConfiguration(input)).not.toThrow();
    }
  });

  it('accepts valid timeout bounds of 1 and 1440 minutes', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: { timeoutMinutes: 1 },
      }),
    ).not.toThrow();

    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        verifier: { timeoutMinutes: 1440 },
      }),
    ).not.toThrow();
  });

  it('rejects non-object root inputs', () => {
    expect(() => assertConfiguration(null)).toThrow(
      'Configuration must be a JSON object.',
    );
    expect(() => assertConfiguration('invalid')).toThrow(
      'Configuration must be a JSON object.',
    );
    expect(() => assertConfiguration([1, 2, 3])).toThrow(
      'Configuration must be a JSON object.',
    );
  });

  it('rejects configuration when version is missing', () => {
    expect(() => assertConfiguration({})).toThrow(
      "Missing configuration version. The 'version' field is required.",
    );
  });

  it('rejects configuration when version is not a string', () => {
    expect(() => assertConfiguration({ version: 1 })).toThrow(
      'Invalid configuration version: expected a string.',
    );
  });

  it('rejects invalid semantic version format', () => {
    expect(() => assertConfiguration({ version: 'v1.0.0' })).toThrow(
      'Invalid configuration version: "v1.0.0". Expected a semantic version (e.g. "1.0.0").',
    );
    expect(() => assertConfiguration({ version: '1.0' })).toThrow(
      'Invalid configuration version: "1.0". Expected a semantic version (e.g. "1.0.0").',
    );
    expect(() => assertConfiguration({ version: 'not-a-version' })).toThrow(
      'Invalid configuration version: "not-a-version". Expected a semantic version (e.g. "1.0.0").',
    );
  });

  it('rejects unsupported major versions', () => {
    expect(() => assertConfiguration({ version: '2.0.0' })).toThrow(
      'Unsupported configuration major version: 2. Expected major version 1.',
    );
    expect(() => assertConfiguration({ version: '0.9.0' })).toThrow(
      'Unsupported configuration major version: 0. Expected major version 1.',
    );
  });

  it('rejects unsupported minor or patch versions', () => {
    expect(() => assertConfiguration({ version: '1.1.0' })).toThrow(
      'Unsupported configuration version: "1.1.0". Supported version is 1.0.0.',
    );
    expect(() => assertConfiguration({ version: '1.0.1' })).toThrow(
      'Unsupported configuration version: "1.0.1". Supported version is 1.0.0.',
    );
  });

  it('rejects unknown field at root level', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        unknownRoot: 'test',
      }),
    ).toThrow('Unknown configuration field: "unknownRoot".');
  });

  it('rejects unknown field in builder configuration', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: { unknownChild: 123 },
      }),
    ).toThrow('Unknown configuration field: "builder.unknownChild".');
  });

  it('rejects unknown field in verifier configuration', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        verifier: { unknownChild: 'bad' },
      }),
    ).toThrow('Unknown configuration field: "verifier.unknownChild".');
  });

  it('rejects model identifier without provider prefix', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: { model: 'gpt-5.6-luna' },
      }),
    ).toThrow(
      'Invalid model identifier at "builder.model". Must use "provider/model" format.',
    );
  });

  it('rejects model identifier with empty provider or model', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: { model: '/gpt-5.6-luna' },
      }),
    ).toThrow(
      'Invalid model identifier at "builder.model". Must use "provider/model" format.',
    );

    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        verifier: { model: 'openai-codex/' },
      }),
    ).toThrow(
      'Invalid model identifier at "verifier.model". Must use "provider/model" format.',
    );
  });

  it('rejects model identifier containing whitespace', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: { model: 'openai codex/gpt-5.6-luna' },
      }),
    ).toThrow(
      'Invalid model identifier at "builder.model". Must use "provider/model" format.',
    );
  });

  it('rejects unsupported thinking levels', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: { thinking: 'extreme' },
      }),
    ).toThrow(
      'Invalid thinking level at "builder.thinking". Allowed: off, minimal, low, medium, high, xhigh, max.',
    );
  });

  it('rejects timeout values below minimum of 1', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: { timeoutMinutes: 0 },
      }),
    ).toThrow(
      'Invalid timeout at "builder.timeoutMinutes". Must be an integer between 1 and 1440.',
    );
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: { timeoutMinutes: -5 },
      }),
    ).toThrow(
      'Invalid timeout at "builder.timeoutMinutes". Must be an integer between 1 and 1440.',
    );
  });

  it('rejects timeout values above maximum of 1440', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        verifier: { timeoutMinutes: 1441 },
      }),
    ).toThrow(
      'Invalid timeout at "verifier.timeoutMinutes". Must be an integer between 1 and 1440.',
    );
  });

  it('rejects non-integer timeout values', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: { timeoutMinutes: 30.5 },
      }),
    ).toThrow(
      'Invalid timeout at "builder.timeoutMinutes". Must be an integer between 1 and 1440.',
    );
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: { timeoutMinutes: '60' },
      }),
    ).toThrow(
      'Invalid timeout at "builder.timeoutMinutes". Must be an integer between 1 and 1440.',
    );
  });

  it('rejects non-object builder and verifier entries', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        builder: 'not-an-object',
      }),
    ).toThrow('Invalid builder configuration: expected an object.');

    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        verifier: [1, 2, 3],
      }),
    ).toThrow('Invalid verifier configuration: expected an object.');
  });

  it('rejects empty specDirectory and worktreeDirectory', () => {
    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        specDirectory: '',
      }),
    ).toThrow('Invalid specDirectory: expected a non-empty string.');

    expect(() =>
      assertConfiguration({
        version: SUPPORTED_CONFIG_VERSION,
        worktreeDirectory: '',
      }),
    ).toThrow('Invalid worktreeDirectory: expected a non-empty string.');
  });
});
