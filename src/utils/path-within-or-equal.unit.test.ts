import { describe, expect, it } from 'vitest';
import { isPathWithinOrEqual } from '#utils/path-within-or-equal.ts';

describe('isPathWithinOrEqual', () => {
  it('accepts the parent and its descendants', () => {
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/repo' })).toBe(
      true,
    );
    expect(
      isPathWithinOrEqual({ parent: '/repo', candidate: '/repo/spec/file' }),
    ).toBe(true);
  });

  it('rejects siblings and paths above the parent', () => {
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/repo2' })).toBe(
      false,
    );
    expect(isPathWithinOrEqual({ parent: '/repo', candidate: '/' })).toBe(
      false,
    );
  });
});
