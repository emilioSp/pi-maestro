import { describe, expect, it } from 'vitest';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

describe('isPathStrictlyWithin', () => {
  it('given descendant and equivalent paths when checked for strict containment then only descendants are accepted', () => {
    expect(isPathStrictlyWithin({ parent: '/repo', path: '/repo/spec' })).toBe(
      true,
    );
    expect(isPathStrictlyWithin({ parent: '/repo', path: '/repo' })).toBe(
      false,
    );
    expect(
      isPathStrictlyWithin({ parent: '/repo', path: '/repo/spec/..' }),
    ).toBe(false);
  });

  it('given sibling and ancestor paths when checked for strict containment then they are rejected', () => {
    expect(isPathStrictlyWithin({ parent: '/repo', path: '/repo2' })).toBe(
      false,
    );
    expect(isPathStrictlyWithin({ parent: '/repo', path: '/' })).toBe(false);
  });
});
