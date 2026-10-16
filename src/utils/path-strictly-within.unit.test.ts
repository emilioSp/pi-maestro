import { describe, expect, it } from 'vitest';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

describe('isPathStrictlyWithin', () => {
  it('given paths inside a directory and paths equivalent to the directory itself when strict containment is checked then only paths inside count as contained', () => {
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

  it('given paths to a sibling directory and a parent directory when strict containment is checked then neither counts as inside the project directory', () => {
    expect(isPathStrictlyWithin({ parent: '/repo', path: '/repo2' })).toBe(
      false,
    );
    expect(isPathStrictlyWithin({ parent: '/repo', path: '/' })).toBe(false);
  });
});
