/**
 * Objective: Find a Git worktree by path.
 * Used: When Maestro checks an expected worktree.
 */

import { resolve } from 'node:path';
import { listWorktrees, type Worktree } from '#git/worktrees/listWorktrees.ts';

// git worktree list --porcelain
export const findWorktree = async ({
  repositoryRoot,
  path,
}: {
  repositoryRoot: string;
  path: string;
}): Promise<Worktree | undefined> => {
  const expectedPath = resolve(path);
  const worktrees = await listWorktrees({ repositoryRoot });
  return worktrees.find((worktree) => resolve(worktree.path) === expectedPath);
};
