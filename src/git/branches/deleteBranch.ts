/**
 * Objective: Delete a workflow branch if present.
 * Used: When Maestro cleans up workflow resources.
 * Entrypoint: deleteBranch().
 */

import { branchExists } from '#git/branches/branchExists.ts';
import { runGitCommand } from '#git/command.ts';

// git show-ref --verify --quiet refs/heads/<branch>
// git branch --delete <branch>
export const deleteBranch = async ({
  repositoryRoot,
  branch,
}: {
  repositoryRoot: string;
  branch: string;
}): Promise<void> => {
  if (!(await branchExists({ repositoryRoot, branch }))) {
    return;
  }

  await runGitCommand({
    arguments: ['branch', '--delete', branch],
    cwd: repositoryRoot,
  });
};
