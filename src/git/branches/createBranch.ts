/**
 * Objective: Create a workflow branch.
 * Used: When Maestro starts a workflow role.
 * Entrypoint: createBranch().
 */

import { branchExists } from '#git/branches/branchExists.ts';
import { runGitCommand } from '#git/command.ts';

// git show-ref --verify --quiet refs/heads/<branch>
// git branch <branch> <start-point>
export const createBranch = async ({
  repositoryRoot,
  branch,
  startPoint,
}: {
  repositoryRoot: string;
  branch: string;
  startPoint: string;
}): Promise<void> => {
  if (startPoint.length === 0 || startPoint.includes('\0')) {
    throw new Error('Branch start point must be non-empty.');
  }
  if (await branchExists({ repositoryRoot, branch })) {
    throw new Error(`Branch already exists: ${branch}.`);
  }

  await runGitCommand({
    arguments: ['branch', branch, startPoint],
    cwd: repositoryRoot,
  });
};
