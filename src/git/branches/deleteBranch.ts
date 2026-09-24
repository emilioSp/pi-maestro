/**
 * Objective: Delete a workflow branch if present.
 * Used: When Maestro cleans up workflow resources.
 */

import { branchExists } from '#git/branches/branchExists.ts';
import { runGitCommand } from '#git/command.ts';

// git show-ref --verify --quiet refs/heads/<branch>
// git branch --delete [--force] <branch>
export const deleteBranch = async ({
  repositoryRoot,
  branch,
  force = false,
}: {
  repositoryRoot: string;
  branch: string;
  force?: boolean;
}): Promise<void> => {
  if (!(await branchExists({ repositoryRoot, branch }))) {
    return;
  }

  await runGitCommand({
    arguments: ['branch', '--delete', ...(force ? ['--force'] : []), branch],
    cwd: repositoryRoot,
  });
};
