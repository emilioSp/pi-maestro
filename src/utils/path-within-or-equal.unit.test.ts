import { describe, expect, it } from 'vitest';

import { isPathWithinOrEqual } from '#utils/path-within-or-equal.ts';

describe('isPathWithinOrEqual', () => {
  it('given a directory path and a path inside it when each is checked against that directory then both count as contained', () => {
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/repo' })).toBe(true);
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/repo/spec/file' })).toBe(true);
  });

  it('given paths to a sibling directory and a parent directory when checked against the project directory then neither counts as contained', () => {
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/repo2' })).toBe(false);
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/' })).toBe(false);
  });
});
