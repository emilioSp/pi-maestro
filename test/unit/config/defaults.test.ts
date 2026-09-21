import { describe, expect, it } from 'vitest';
import {
  CONFIG_DIRECTORY_NAME,
  CONFIG_FILE_NAME,
  CONFIG_FILE_PATH,
  DEFAULT_BUILDER_MODEL,
  DEFAULT_BUILDER_THINKING,
  DEFAULT_CONFIG,
  DEFAULT_CONFIG_VERSION,
  DEFAULT_SPEC_DIRECTORY,
  DEFAULT_TIMEOUT_MINUTES,
  DEFAULT_VERIFIER_MODEL,
  DEFAULT_VERIFIER_THINKING,
  DEFAULT_WORKTREE_DIRECTORY,
} from '#config/defaults.ts';

describe('configuration defaults', () => {
  it('provides approved default constants', () => {
    expect(DEFAULT_CONFIG_VERSION).toBe('1.0.0');
    expect(DEFAULT_SPEC_DIRECTORY).toBe('.specs');
    expect(DEFAULT_WORKTREE_DIRECTORY).toBe('.worktree');
    expect(DEFAULT_BUILDER_MODEL).toBe('openai-codex/gpt-5.6-luna');
    expect(DEFAULT_BUILDER_THINKING).toBe('high');
    expect(DEFAULT_VERIFIER_MODEL).toBe('openai-codex/gpt-5.6-sol');
    expect(DEFAULT_VERIFIER_THINKING).toBe('medium');
    expect(DEFAULT_TIMEOUT_MINUTES).toBe(60);
    expect(CONFIG_DIRECTORY_NAME).toBe('.pi');
    expect(CONFIG_FILE_NAME).toBe('maestro.json');
    expect(CONFIG_FILE_PATH).toBe('.pi/maestro.json');
  });

  it('provides a complete default configuration object with approved values', () => {
    expect(DEFAULT_CONFIG).toEqual({
      version: '1.0.0',
      specDirectory: '.specs',
      worktreeDirectory: '.worktree',
      builder: {
        model: 'openai-codex/gpt-5.6-luna',
        thinking: 'high',
        timeoutMinutes: 60,
      },
      verifier: {
        model: 'openai-codex/gpt-5.6-sol',
        thinking: 'medium',
        timeoutMinutes: 60,
      },
    });
  });

  it('freezes default configuration to prevent mutation', () => {
    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CONFIG.builder)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CONFIG.verifier)).toBe(true);

    const target = DEFAULT_CONFIG as unknown as Record<string, unknown>;
    const builderTarget = DEFAULT_CONFIG.builder as unknown as Record<
      string,
      unknown
    >;

    expect(() => {
      target.specDirectory = 'mutated';
    }).toThrow(TypeError);

    expect(() => {
      builderTarget.timeoutMinutes = 999;
    }).toThrow(TypeError);
  });
});
