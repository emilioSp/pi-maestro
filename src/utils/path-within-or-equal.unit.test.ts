import { describe, expect, it } from 'vitest';

import { isPathWithinOrEqual } from '#utils/path-within-or-equal.ts';

describe('isPathWithinOrEqual', () => {
  it('GIVEN a directory path and a path inside it WHEN each is checked against that directory THEN both count as contained', () => {
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/repo' })).toBe(true);
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/repo/spec/file' })).toBe(true);
  });

  it('GIVEN paths to a sibling directory and a parent directory WHEN checked against the project directory THEN neither counts as contained', () => {
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/repo2' })).toBe(false);
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/' })).toBe(false);
  });
});
