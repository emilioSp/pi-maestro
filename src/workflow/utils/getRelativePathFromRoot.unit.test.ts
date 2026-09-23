import { describe, expect, it } from 'vitest';
import { getRelativePathFromRoot } from '#workflow/utils/getRelativePathFromRoot.ts';

describe('getRelativePathFromRoot', () => {
  it('returns a path below the repository root', () => {
    expect(
      getRelativePathFromRoot({
        root: '/repo',
        target: '/repo/.specs/spec/workflow.json',
      }),
    ).toBe('.specs/spec/workflow.json');
  });

  it('rejects the root, parent, and sibling paths', () => {
    expect(() =>
      getRelativePathFromRoot({ root: '/repo', target: '/repo' }),
    ).toThrow('Path is outside the expected root');
    expect(() =>
      getRelativePathFromRoot({ root: '/repo', target: '/' }),
    ).toThrow('Path is outside the expected root');
    expect(() =>
      getRelativePathFromRoot({ root: '/repo', target: '/repo2' }),
    ).toThrow('Path is outside the expected root');
  });
});
