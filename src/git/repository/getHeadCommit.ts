/**
 * Objective: Read the current HEAD commit.
 * Used: When Maestro records a workflow commit.
 * Entrypoint: getHeadCommit().
 */

import { runGitCommand } from '#git/command.ts';

// git rev-parse --verify HEAD^{commit}
export const getHeadCommit = async ({
  repositoryRoot,
}: {
  repositoryRoot: string;
}): Promise<string> => {
  const result = await runGitCommand({
    arguments: ['rev-parse', '--verify', 'HEAD^{commit}'],
    cwd: repositoryRoot,
  });

  return result.stdout.replace(/\r?\n$/, '');
};
