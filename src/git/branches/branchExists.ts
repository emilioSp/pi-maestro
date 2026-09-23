/**
 * Objective: Check whether a Git branch exists.
 * Used: When Maestro checks for branch collisions.
 * Entrypoint: branchExists().
 */

import { runGitCommand } from '#git/command.ts';
import { hasGitExitCode } from '#git/utils.ts';

const branchReference = (branch: string): string => `refs/heads/${branch}`;

// git show-ref --verify --quiet refs/heads/<branch>
export const branchExists = async ({
  repositoryRoot,
  branch,
}: {
  repositoryRoot: string;
  branch: string;
}): Promise<boolean> => {
  try {
    await runGitCommand({
      arguments: ['show-ref', '--verify', '--quiet', branchReference(branch)],
      cwd: repositoryRoot,
    });
    return true;
  } catch (error) {
    if (hasGitExitCode({ error, exitCode: 1 })) {
      return false;
    }
    throw error;
  }
};
