import { describe, expect, it } from 'vitest';
import {
  MaestroConfigInputSchema,
  ResolvedMaestroConfigSchema,
} from '#config/schema.ts';

describe('configuration schemas', () => {
  it('exposes TypeBox schemas for Pi compatibility', () => {
    expect(MaestroConfigInputSchema.type).toBe('object');
    expect(
      (MaestroConfigInputSchema as unknown as Record<string, unknown>)
        .additionalProperties,
    ).toBe(false);
    expect(ResolvedMaestroConfigSchema.type).toBe('object');
    expect(
      (ResolvedMaestroConfigSchema as unknown as Record<string, unknown>)
        .additionalProperties,
    ).toBe(false);
  });
});
