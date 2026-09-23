/**
 * Objective: Find the shared ancestor of two commits.
 * Used: When Maestro checks whether histories share an ancestor.
 * Entrypoint: getMergeBase().
 */

import { runGitCommand } from '#git/command.ts';
import { hasGitExitCode } from '#git/utils.ts';

// Gets the shared ancestor of two histories, if one exists.
// git merge-base <first> <second>
export const getMergeBase = async ({
  repositoryRoot,
  first,
  second,
}: {
  repositoryRoot: string;
  first: string;
  second: string;
}): Promise<string | undefined> => {
  try {
    const result = await runGitCommand({
      arguments: ['merge-base', first, second],
      cwd: repositoryRoot,
    });
    return result.stdout.trim();
  } catch (error) {
    if (hasGitExitCode({ error, exitCode: 1 })) {
      return undefined;
    }
    throw error;
  }
};
