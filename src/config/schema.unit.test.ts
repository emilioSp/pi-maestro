import { ObjectOptions } from 'typebox/type';
import { describe, expect, it } from 'vitest';
import {
  MaestroConfigInputSchema,
  ResolvedMaestroConfigSchema,
} from '#config/schema.ts';

describe('configuration schemas', () => {
  it('exposes TypeBox schemas for Pi compatibility', () => {
    expect(MaestroConfigInputSchema.type).toBe('object');
    expect(ObjectOptions(MaestroConfigInputSchema).additionalProperties).toBe(
      false,
    );
    expect(ResolvedMaestroConfigSchema.type).toBe('object');
    expect(
      ObjectOptions(ResolvedMaestroConfigSchema).additionalProperties,
    ).toBe(false);
  });
});
