/**
 * Objective: Read the current Git branch.
 * Used: When Maestro checks the branch of a worktree.
 * Entrypoint: getCurrentBranch().
 */

import { runGitCommand } from '#git/command.ts';

// git symbolic-ref --quiet --short HEAD
export const getCurrentBranch = async ({
  repositoryRoot,
}: {
  repositoryRoot: string;
}): Promise<string> => {
  const result = await runGitCommand({
    arguments: ['symbolic-ref', '--quiet', '--short', 'HEAD'],
    cwd: repositoryRoot,
  });

  return result.stdout.replace(/\r?\n$/, '');
};
