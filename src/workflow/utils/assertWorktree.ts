/**
 * Objective: Check that a workflow worktree is registered on its expected branch.
 * Used: Before workflow operations access a managed worktree.
 */

import { branchExists } from '#git/branches/branchExists.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { findWorktree } from '#git/worktrees/findWorktree.ts';

export const assertWorktree = async ({
  repositoryRoot,
  branch,
  worktreePath,
}: {
  repositoryRoot: string;
  branch: string;
  worktreePath: string;
}): Promise<void> => {
  const worktree = await findWorktree({ repositoryRoot, path: worktreePath });

  if (worktree === undefined) {
    throw new Error(`Expected workflow worktree is missing: ${worktreePath}.`);
  }

  if (worktree.branch !== branch) {
    throw new Error(`Expected workflow branch is missing: ${branch}.`);
  }
  if (!(await branchExists({ repositoryRoot, branch }))) {
    throw new Error(`Expected workflow branch is missing: ${branch}.`);
  }

  const currentBranch = await getCurrentBranch({
    repositoryRoot: worktreePath,
  });

  if (currentBranch !== branch) {
    throw new Error(`Expected workflow branch is missing: ${branch}.`);
  }
};
