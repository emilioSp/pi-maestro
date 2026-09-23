/**
 * Objective: Check whether one commit precedes another.
 * Used: When Maestro checks commit ancestry.
 * Entrypoint: isAncestor().
 */

import { runGitCommand } from '#git/command.ts';
import { hasGitExitCode } from '#git/utils.ts';

// Checks whether one commit is reachable from another.
// git merge-base --is-ancestor <ancestor> <descendant>
export const isAncestor = async ({
  repositoryRoot,
  ancestor,
  descendant,
}: {
  repositoryRoot: string;
  ancestor: string;
  descendant: string;
}): Promise<boolean> => {
  try {
    await runGitCommand({
      arguments: ['merge-base', '--is-ancestor', ancestor, descendant],
      cwd: repositoryRoot,
    });
    return true;
  } catch (error) {
    if (hasGitExitCode({ error, exitCode: 1 })) {
      // git returns exit 1 to say "no"
      return false;
    }
    throw error;
  }
};
