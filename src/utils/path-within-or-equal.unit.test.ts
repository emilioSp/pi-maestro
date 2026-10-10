import { describe, expect, it } from 'vitest';
import { isPathWithinOrEqual } from '#utils/path-within-or-equal.ts';

describe('isPathWithinOrEqual', () => {
  it('given parent and descendant paths when checked for containment then they are accepted', () => {
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/repo' })).toBe(
      true,
    );
    expect(
      isPathWithinOrEqual({ parent: '/repo', candidate: '/repo/spec/file' }),
    ).toBe(true);
  });

  it('given sibling and ancestor paths when checked for containment then they are rejected', () => {
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/repo2' })).toBe(
      false,
    );
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/' })).toBe(
      false,
    );
  });
});
