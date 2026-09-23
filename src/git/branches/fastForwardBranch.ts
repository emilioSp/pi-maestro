/**
 * Objective: Advance a branch only to a descendant commit.
 * Used: When a workflow advances a branch after an owner decision.
 */

import { branchExists } from '#git/branches/branchExists.ts';
import { runGitCommand } from '#git/command.ts';
import { hasGitExitCode } from '#git/utils.ts';

const branchReference = (branch: string): string => `refs/heads/${branch}`;

// git show-ref --verify --quiet refs/heads/<branch>
// git merge-base --is-ancestor <branch> <target>
// git rev-parse --verify <target>^{commit}
// git rev-parse --verify <branch>^{commit}
// git update-ref refs/heads/<branch> <target-commit> <branch-commit>
export const fastForwardBranch = async ({
  repositoryRoot,
  branch,
  target,
}: {
  repositoryRoot: string;
  branch: string;
  target: string;
}): Promise<void> => {
  if (target.length === 0 || target.includes('\0')) {
    throw new Error('Fast-forward target must be non-empty.');
  }
  if (!(await branchExists({ repositoryRoot, branch }))) {
    throw new Error(`Branch does not exist: ${branch}.`);
  }

  try {
    await runGitCommand({
      arguments: ['merge-base', '--is-ancestor', branch, target],
      cwd: repositoryRoot,
    });
  } catch (error) {
    if (hasGitExitCode({ error, exitCode: 1 })) {
      throw new Error(
        `Cannot fast-forward ${branch}: it is not an ancestor of ${target}.`,
      );
    }
    throw error;
  }

  const [targetResult, branchResult] = await Promise.all([
    runGitCommand({
      arguments: ['rev-parse', '--verify', `${target}^{commit}`],
      cwd: repositoryRoot,
    }),
    runGitCommand({
      arguments: ['rev-parse', '--verify', `${branch}^{commit}`],
      cwd: repositoryRoot,
    }),
  ]);
  const targetCommit = targetResult.stdout.trim();
  const branchCommit = branchResult.stdout.trim();

  await runGitCommand({
    arguments: [
      'update-ref',
      branchReference(branch),
      targetCommit,
      branchCommit,
    ],
    cwd: repositoryRoot,
  });
};
