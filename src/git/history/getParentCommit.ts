/**
 * Objective: Read the parent of a commit.
 * Used: When Maestro checks a checkpoint parent.
 */

import { runGitCommand } from '#git/command.ts';

// Gets a commit's direct parent.
// git rev-parse --verify <commit>^
type GetParentCommitInput = {
  repositoryRoot: string;
  commit: string;
};

export const getParentCommit = async ({
  repositoryRoot,
  commit,
}: GetParentCommitInput): Promise<string> => {
  const result = await runGitCommand({
    arguments: ['rev-parse', '--verify', `${commit}^`],
    cwd: repositoryRoot,
  });

  return result.stdout.trim();
};
