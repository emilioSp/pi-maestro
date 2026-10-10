import { describe, expect, it } from 'vitest';
import { isValidSpecId } from '#ids/isValidSpecId.ts';

describe('isValidSpecId', () => {
  it('given valid and invalid timestamps and slugs when spec IDs are validated then only complete valid IDs are accepted', () => {
    expect(isValidSpecId('20260229-235959-spec')).toBe(false);
    expect(isValidSpecId('20240229-235959-spec')).toBe(true);
    expect(isValidSpecId('20260321-143052-add-weather-alerts')).toBe(true);
    expect(isValidSpecId('20260321-143052-Add-weather-alerts')).toBe(false);
    expect(isValidSpecId('20260321-246052-add-weather-alerts')).toBe(false);
    expect(isValidSpecId('20260321-143052-')).toBe(false);
  });
});
