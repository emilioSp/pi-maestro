/**
 * Objective: Remove a clean managed worktree.
 * Used: When Maestro cleans up a managed worktree.
 */

import { resolve } from 'node:path';
import { runGitCommand } from '#git/command.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { findWorktree } from '#git/worktrees/findWorktree.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

// git worktree list --porcelain
// git status --porcelain=v1 --untracked-files=all -z
// git worktree remove <path>
export const removeWorktree = async ({
  repositoryRoot,
  path,
  branch,
  worktreeDirectory,
}: {
  repositoryRoot: string;
  path: string;
  branch: string;
  worktreeDirectory: string;
}): Promise<void> => {
  const normalizedPath = resolve(path);
  const worktree = await findWorktree({ repositoryRoot, path: normalizedPath });

  if (!worktree) {
    throw new Error(`Worktree is not registered at ${normalizedPath}.`);
  }

  if (worktree.branch !== branch) {
    throw new Error(
      `Refusing to remove worktree at ${normalizedPath}: expected branch ${branch}.`,
    );
  }

  if (
    !isPathStrictlyWithin({
      parent: resolve(worktreeDirectory),
      candidate: normalizedPath,
    })
  ) {
    throw new Error(
      `Refusing to remove worktree outside Maestro directory: ${normalizedPath}.`,
    );
  }

  const status = await getRepositoryStatus({ repositoryRoot: normalizedPath });

  if (!status.clean) {
    throw new Error(`Refusing to remove dirty worktree at ${normalizedPath}.`);
  }

  await runGitCommand({
    arguments: ['worktree', 'remove', normalizedPath],
    cwd: repositoryRoot,
  });
};
