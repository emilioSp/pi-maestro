/**
 * Objective: Resolve repository paths inside a workflow worktree.
 * Used: When workflow operations access protocol files outside the base worktree.
 */

import { relative, resolve } from 'node:path';
import { branchExists } from '#git/branches/branchExists.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { findWorktree } from '#git/worktrees/findWorktree.ts';
import type { GetMaestroPaths } from '#paths.ts';

export const relativePath = ({
  root,
  target,
}: {
  root: string;
  target: string;
}): string => {
  const value = relative(root, target);
  if (value.length === 0 || value === '..' || value.startsWith('../')) {
    throw new Error(`Path is outside the expected root: ${target}.`);
  }
  return value;
};

export const getPath = ({
  paths,
  worktreePath,
  target,
}: {
  paths: GetMaestroPaths;
  worktreePath: string;
  target: string;
}): string =>
  resolve(
    worktreePath,
    relativePath({
      root: paths.repositoryRoot,
      target,
    }),
  );

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
