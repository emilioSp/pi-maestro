import { describe, expect, it } from 'vitest';
import { isValidSpecId } from '#ids/isValidSpecId.ts';

describe('isValidSpecId', () => {
  it('validates the complete timestamp and slug format', () => {
    expect(isValidSpecId('20260229-235959-spec')).toBe(false);
    expect(isValidSpecId('20240229-235959-spec')).toBe(true);
    expect(isValidSpecId('20260321-143052-add-weather-alerts')).toBe(true);
    expect(isValidSpecId('20260321-143052-Add-weather-alerts')).toBe(false);
    expect(isValidSpecId('20260321-246052-add-weather-alerts')).toBe(false);
    expect(isValidSpecId('20260321-143052-')).toBe(false);
  });
});
