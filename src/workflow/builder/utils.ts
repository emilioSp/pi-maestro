/**
 * Objective: Share builder worktree and protocol path validation.
 * Used: By builder launch preparation and terminal pass completion.
 */

import { relative, resolve } from 'node:path';
import { branchExists } from '#git/branches.ts';
import { getCurrentBranch } from '#git/repository.ts';
import { findWorktree } from '#git/worktrees.ts';
import type { GetMaestroPaths } from '#paths.ts';

export type BuilderWorktree = {
  branch: string;
  worktreePath: string;
};

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

export const getBuilderWorkflowPath = ({
  paths,
  worktreePath,
  specId,
}: {
  paths: GetMaestroPaths;
  worktreePath: string;
  specId: string;
}): string =>
  resolve(
    worktreePath,
    relativePath({
      root: paths.repositoryRoot,
      target: paths.getWorkflowPath(specId),
    }),
  );

export const getBuilderHandoffPath = ({
  paths,
  worktreePath,
  specId,
}: {
  paths: GetMaestroPaths;
  worktreePath: string;
  specId: string;
}): string =>
  resolve(
    worktreePath,
    relativePath({
      root: paths.repositoryRoot,
      target: paths.getBuilderHandoffPath(specId),
    }),
  );

export const validateBuilderWorktree = async ({
  paths,
  specId,
}: {
  paths: GetMaestroPaths;
  specId: string;
}): Promise<BuilderWorktree> => {
  const branch = paths.getBuilderBranch(specId);
  const worktreePath = paths.getBuilderWorktreePath(specId);
  const worktree = await findWorktree({
    repositoryRoot: paths.repositoryRoot,
    path: worktreePath,
  });

  if (worktree === undefined) {
    throw new Error(`Expected builder worktree is missing: ${worktreePath}.`);
  }
  if (worktree.branch !== branch) {
    throw new Error(`Expected builder branch is missing: ${branch}.`);
  }
  if (!(await branchExists({ repositoryRoot: paths.repositoryRoot, branch }))) {
    throw new Error(`Expected builder branch is missing: ${branch}.`);
  }

  const currentBranch = await getCurrentBranch({
    repositoryRoot: worktreePath,
  });
  if (currentBranch !== branch) {
    throw new Error(`Expected builder branch is missing: ${branch}.`);
  }

  return { branch, worktreePath };
};
