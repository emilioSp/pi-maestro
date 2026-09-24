import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';

describe('configuration defaults', () => {
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
