import { describe, expect, it } from 'vitest';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

describe('isPathStrictlyWithin', () => {
  it('accepts descendants but not the parent or an equivalent path', () => {
    expect(
      isPathStrictlyWithin({ parent: '/repo', candidate: '/repo/spec' }),
    ).toBe(true);
    expect(isPathStrictlyWithin({ parent: '/repo', candidate: '/repo' })).toBe(
      false,
    );
    expect(
      isPathStrictlyWithin({ parent: '/repo', candidate: '/repo/spec/..' }),
    ).toBe(false);
  });

  it('rejects siblings and paths above the parent', () => {
    expect(isPathStrictlyWithin({ parent: '/repo', candidate: '/repo2' })).toBe(
      false,
    );
    expect(isPathStrictlyWithin({ parent: '/repo', candidate: '/' })).toBe(
      false,
    );
  });
});
